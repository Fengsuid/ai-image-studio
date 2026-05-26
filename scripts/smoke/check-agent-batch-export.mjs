#!/usr/bin/env node
// End-to-end smoke for AIS-RLS-152 Agent batch + canvas-export closure.
//
// Distinct from the existing `smoke:agent-batch-generation` (which exercises the dry-run batch
// in isolation), this smoke chains the full flow:
//   plan → confirm → generate (dry-run) → export-canvas
// and asserts that the exported canvas project includes one prompt/config/output node trio per
// selected variant — the contract that ai-image-studio.canvas.v1 freezes.

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
const userEmail = `codex-agent-batch-export-${runId}@example.test`;
const createdSessionIds = [];
const createdRequestIds = [];
const createdCanvasIds = [];
let createdUserId = "";

function log(...parts) {
  console.log("[agent-batch-export-smoke]", ...parts);
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
  if (!createdRequestIds.length && !createdSessionIds.length && !createdUserId && !createdCanvasIds.length) return;
  let connection;
  try {
    connection = await mysqlConnection();
    if (createdCanvasIds.length) {
      await connection.execute(
        `DELETE FROM canvas_projects WHERE id IN (${createdCanvasIds.map(() => "?").join(",")})`,
        createdCanvasIds
      );
    }
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
  const service = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/generation-service.js"), "utf8");
  const routes = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-batch-export"], "node scripts/smoke/check-agent-batch-export.mjs", "root smoke:agent-batch-export script missing");

  // Plan path (planner-flow's domain, asserted here too for the closure)
  assert(routes.includes("/plan"), "routes must expose /plan");
  assert(routes.includes("/generate"), "routes must expose /generate");
  assert(routes.includes("/export-canvas"), "routes must expose /export-canvas");

  // Canvas export contract
  assert(service.includes("function exportAgentCanvas"), "service must implement exportAgentCanvas");
  assert(service.includes('schema: "ai-image-studio.canvas.v1"'), "exported canvas must declare frozen schema");
  assert(service.includes("agent_prompt_"), "canvas export must emit prompt nodes per variant");
  assert(service.includes("agent_config_"), "canvas export must emit config nodes per variant");
  assert(service.includes("agent_output_"), "canvas export must emit output nodes per variant");
  assert(service.includes("agent_edge_prompt_"), "canvas export must connect prompt → output");
  assert(service.includes("agent_edge_config_"), "canvas export must connect config → output");
  assert(service.includes("createCanvasProject"), "service must persist canvas project");
  assert(service.includes("agentSessionId"), "exported canvas meta must reference source agent session");
  assert(service.includes('visibility: "private"'), "exported canvas must default to private");
}

async function apiChecks() {
  if (!adminEmail || !adminPassword) {
    log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped live batch-export end-to-end checks");
    return;
  }

  const admin = await login(adminEmail, adminPassword);
  assert.equal(admin.user?.role, "admin", "admin login should have admin role");
  const created = await request("/api/admin/users", {
    method: "POST", jar: admin.jar, csrfToken: admin.csrfToken,
    expected: 201, label: "POST /api/admin/users batch-export",
    body: {
      email: userEmail,
      name: `codex-agent-batch-export-${runId}`,
      role: "user",
      status: "active",
      credits: 8,
      generatePassword: true,
      note: "AIS-RLS-152 agent batch-export smoke"
    }
  });
  createdUserId = created.body?.user?.id || "";
  const password = String(created.body?.temporaryPassword || "");

  const user = await login(userEmail, password);
  const sessionResult = await request("/api/agent-sessions", {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 201, label: "POST /api/agent-sessions batch-export",
    body: {
      title: `AIS-RLS-152 batch-export ${runId}`,
      sourceType: "agent-workspace",
      sourceId: runId,
      data: { smoke: "agent-batch-export" }
    }
  });
  const sessionId = sessionResult.body?.session?.id || "";
  createdSessionIds.push(sessionId);

  const planResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /plan batch-export",
    body: { message: `茶饮新品 ${runId} 海报，社媒竖版`, variantCount: 3 }
  });
  const plan = planResult.body?.plan;
  assert.equal(plan?.format, "ai-image-studio.agent-plan.v1", "plan must use frozen format");
  const selectedVariantIds = plan.variants.map((variant) => variant.id);

  await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /plan confirm batch-export",
    body: { action: "confirm", plan, selectedVariantIds, note: "batch-export smoke confirm" }
  });

  const generated = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/generate`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /generate dry-run batch-export",
    body: { plan, selectedVariantIds, dryRun: true }
  });
  assert.equal(generated.body?.dryRun, true, "dry-run flag missing");
  createdRequestIds.push(...generated.body.requests.map((item) => item.id).filter(Boolean));

  const exported = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/export-canvas`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 201, label: "POST /export-canvas batch-export",
    body: { plan, selectedVariantIds, title: `AIS-RLS-152 export ${runId}` }
  });
  const canvas = exported.body?.canvas;
  assert(canvas?.id, "export response must include canvas id");
  assert(canvas.url?.startsWith("/canvas-v2?id="), "exported canvas must expose canvas-v2 deep link");
  assert.equal(canvas.visibility, "private", "exported canvas must default to private");
  assert.equal(canvas.nodeCount, selectedVariantIds.length * 3, "canvas must contain prompt/config/output nodes per variant");
  assert.equal(canvas.edgeCount, selectedVariantIds.length * 2, "canvas must contain prompt→output + config→output edges per variant");
  createdCanvasIds.push(canvas.id);

  let connection;
  try {
    connection = await mysqlConnection();
    const [rows] = await connection.execute("SELECT data_json, user_id, visibility FROM canvas_projects WHERE id = ? LIMIT 1", [canvas.id]);
    assert.equal(rows.length, 1, "canvas project row must persist");
    assert.equal(rows[0].user_id, createdUserId, "exported canvas must belong to current user");
    assert.equal(rows[0].visibility, "private", "persisted visibility must remain private");
    const data = JSON.parse(rows[0].data_json || "{}");
    assert.equal(data.schema, "ai-image-studio.canvas.v1", "persisted canvas must use frozen schema");
    assert.equal(data.meta?.source, "agent-workspace", "persisted canvas meta must point at agent-workspace");
    assert.equal(data.meta?.agentSessionId, sessionId, "persisted canvas meta must reference origin session");
    assert(Array.isArray(data.nodes) && data.nodes.length === selectedVariantIds.length * 3, "persisted node count mismatch");
    assert(Array.isArray(data.edges) && data.edges.length === selectedVariantIds.length * 2, "persisted edge count mismatch");
  } finally {
    await connection?.end().catch(() => null);
  }
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
  console.error("[agent-batch-export-smoke] ERROR:", error?.stack || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
