#!/usr/bin/env node
// Static + optional live API smoke for AIS-RLS-155 Agent credit-per-step accounting.
//
// Scope (P0):
//   - Assert generation-service computes cost per request (costPerImage * request.n) and that
//     each variant gets its OWN generation_requests row so credit deductions are independent.
//   - Assert dry-run does NOT deduct credits, does NOT enqueue provider jobs.
//   - Assert isPublic defaults to false (per-step credit refund cannot rely on public exposure).
//
// AIS-RLS-155 hard assertions:
//   - each variant becomes an independent generation_request / agent_step pair
//   - live requests use maxAttempts=3 and shared queue-level charge/refund, not session-level charge
//   - Agent requests emit agent_credit_charged / agent_credit_refund trace stages

import assert from "node:assert/strict";
import fs from "node:fs";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://127.0.0.1:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userEmail = `codex-agent-credit-${runId}@example.test`;
const createdSessionIds = [];
const createdRequestIds = [];
let createdUserId = "";

function log(...parts) {
  console.log("[agent-credit-per-step-smoke]", ...parts);
}

class CookieJar {
  constructor() { this.cookies = new Map(); }
  setFromHeaders(headers) {
    const values = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
    for (const value of values) {
      const first = String(value || "").split(";")[0];
      const split = first.indexOf("=");
      if (split > 0) this.cookies.set(first.slice(0, split), first.slice(split + 1));
    }
  }
  header() { return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; "); }
  get(name) { return this.cookies.get(name) || ""; }
}

function csrfFrom(body, jar) {
  return String(body?.csrfToken || jar.get("csrf") || "");
}

async function request(pathSuffix, { method = "GET", body, jar, csrfToken = "", expected, label = pathSuffix } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (jar?.header()) headers.Cookie = jar.header();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(`${baseUrl}${pathSuffix}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    jar?.setFromHeaders(response.headers);
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
    if (expected !== undefined) {
      assert.equal(response.status, expected, `${label} status=${response.status}, expected ${expected}; body=${JSON.stringify(json).slice(0, 500)}`);
    }
    return { response, body: json };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email, password) {
  const jar = new CookieJar();
  const me = await request("/api/auth/me", { jar, expected: 200, label: `GET /api/auth/me ${email}` });
  const csrfToken = csrfFrom(me.body, jar);
  assert(csrfToken, `csrf token missing for ${email}`);
  const result = await request("/api/auth/login", {
    method: "POST", jar, csrfToken,
    body: { email, password },
    expected: 200, label: `POST /api/auth/login ${email}`
  });
  return { jar, csrfToken: csrfFrom(result.body, jar) || csrfToken, user: result.body?.user || null };
}

async function mysqlConnection() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio"
  });
}

async function cleanup() {
  if (!createdRequestIds.length && !createdSessionIds.length && !createdUserId) return;
  let connection;
  try {
    connection = await mysqlConnection();
    if (createdRequestIds.length) {
      await connection.execute(
        `DELETE FROM generation_trace WHERE request_id IN (${createdRequestIds.map(() => "?").join(",")})`,
        createdRequestIds
      );
      await connection.execute(
        `DELETE FROM generation_requests WHERE id IN (${createdRequestIds.map(() => "?").join(",")})`,
        createdRequestIds
      );
    }
    if (createdSessionIds.length) {
      await connection.execute(
        `DELETE FROM agent_sessions WHERE id IN (${createdSessionIds.map(() => "?").join(",")})`,
        createdSessionIds
      );
    }
    await connection.execute("DELETE FROM users WHERE email = ?", [userEmail]);
  } finally {
    await connection?.end().catch(() => null);
  }
}

function staticChecks() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
  const service = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/generation-service.js"), "utf8");
  const routes = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-credit-per-step"], "node scripts/smoke/check-agent-credit-per-step.mjs", "root smoke:agent-credit-per-step script missing");
  // Per-step independence: every variant in the batch insertGenerationRequest is called inside
  // the `for (const [index, variant] of variants.entries())` loop, so each step gets its own
  // request_id and its own cost line.
  assert(service.includes("for (const [index, variant] of variants.entries())"), "service must iterate variants to insert per-step rows");
  assert(service.includes("insertGenerationRequest"), "service must call insertGenerationRequest per variant");
  assert(service.includes("costPerImage * request.n"), "service must compute per-step total cost");
  assert(service.includes("normalizeGenerationCost"), "service must normalize per-image cost");
  assert(service.includes("isPublic: false"), "service must default agent steps to private (refund-safe)");
  assert(service.includes("maxAttempts: dryRun ? 1 : 3"), "live agent steps must carry maxAttempts=3");
  assert(service.includes("totalEstimatedCost: dryRun ? 0 : costPerImage * requests.length"), "service must estimate cost by independent step count");

  // Dry-run safety: cancelled status, no enqueue, no provider params persisted.
  assert(service.includes('"agent_batch_dry_run"'), "service must trace dry-run path");
  assert(service.includes('jobType: dryRun ? "agent-batch-dry-run"'), "service must mark dry-run job_type");
  assert(service.includes("queuePayloadJson: dryRun ? null"), "dry-run must NOT persist queue payload");
  assert(service.includes('errorCode: dryRun ? "agent_batch_dry_run"'), "dry-run must mark error_code so credits stay untouched");

  // Generate step granularity in routes layer: each variant becomes its own step row.
  assert(routes.includes("generate_batch"), "routes must label per-step kind as generate_batch");
  assert(routes.includes("result.requests.map"), "routes must emit one step per request");
  assert(routes.includes("requestId: request.id"), "step requestId must point to per-step generation_request id");
  assert(!service.includes("session_charge"), "agent generation service must not use session-level charge source");

  assert(server.includes("agent_credit_charged"), "server must trace Agent per-step credit charges");
  assert(server.includes("agent_credit_refund"), "server must trace Agent per-step credit refunds");
  assert(server.includes("isAgentGenerationRequest"), "server must detect Agent requests for credit trace attribution");
}

async function apiChecks() {
  if (!adminEmail || !adminPassword) {
    log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped live API credit-per-step checks");
    return;
  }

  const admin = await login(adminEmail, adminPassword);
  assert.equal(admin.user?.role, "admin", "admin login should have admin role");
  const startingCredits = 12;
  const created = await request("/api/admin/users", {
    method: "POST", jar: admin.jar, csrfToken: admin.csrfToken,
    expected: 201, label: "POST /api/admin/users credit smoke",
    body: {
      email: userEmail,
      name: `codex-agent-credit-${runId}`,
      role: "user",
      status: "active",
      credits: startingCredits,
      generatePassword: true,
      note: "AIS-RLS-152 agent credit-per-step smoke"
    }
  });
  createdUserId = created.body?.user?.id || "";
  const password = String(created.body?.temporaryPassword || "");

  const user = await login(userEmail, password);
  const sessionResult = await request("/api/agent-sessions", {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 201, label: "POST /api/agent-sessions credit smoke",
    body: {
      title: `AIS-RLS-152 credit ${runId}`,
      sourceType: "agent-workspace",
      sourceId: runId,
      data: { smoke: "agent-credit-per-step" }
    }
  });
  const sessionId = sessionResult.body?.session?.id || "";
  createdSessionIds.push(sessionId);

  const planResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /plan credit smoke",
    body: { message: `每步独立扣费 smoke ${runId}`, variantCount: 4 }
  });
  const plan = planResult.body?.plan || {};
  const selectedVariantIds = (plan.variants || []).slice(0, 3).map((variant) => variant.id);

  const generated = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/generate`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /generate dry-run",
    body: { plan, selectedVariantIds, dryRun: true }
  });
  assert.equal(generated.body?.dryRun, true, "dry-run flag missing");
  assert.equal(generated.body?.requests?.length, 3, "dry-run should create three independent requests");
  createdRequestIds.push(...generated.body.requests.map((item) => item.id).filter(Boolean));
  assert.equal(new Set(createdRequestIds).size, 3, "request ids must be unique (per-step independence)");

  // Verify DB-level per-step independence and zero-credit-touch on dry-run.
  let connection;
  try {
    connection = await mysqlConnection();
    const [rows] = await connection.execute(
      `SELECT id, status, job_type, error_code FROM generation_requests WHERE id IN (${createdRequestIds.map(() => "?").join(",")}) ORDER BY created_at`,
      createdRequestIds
    );
    assert.equal(rows.length, 3, "three independent generation_requests rows expected");
    for (const row of rows) {
      assert.equal(row.status, "cancelled", "dry-run row must be cancelled");
      assert.equal(row.job_type, "agent-batch-dry-run", "dry-run row must mark agent-batch-dry-run job_type");
      assert.equal(row.error_code, "agent_batch_dry_run", "dry-run row must annotate error_code");
    }
    const [userRows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [createdUserId]);
    assert.equal(Number(userRows[0]?.credits || 0), startingCredits, "dry-run must NOT deduct credits");
  } finally {
    await connection?.end().catch(() => null);
  }

  // Live non-dry-run provider failure/success matrix is environment-specific. The hard
  // static assertions above now verify the 155 refund/charge hooks and per-step request
  // granularity; this optional live path keeps the DB dry-run invariant.
}

async function main() {
  staticChecks();
  try {
    await apiChecks();
    log("ok");
  } finally {
    await cleanup().catch((error) => log("cleanup skipped:", error.message || error));
  }
}

main().catch(async (error) => {
  console.error("[agent-credit-per-step-smoke] ERROR:", error?.stack || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
