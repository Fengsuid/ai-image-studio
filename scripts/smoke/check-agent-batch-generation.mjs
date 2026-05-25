#!/usr/bin/env node
// Static and optional live API smoke for AIS-RLS-066 Agent batch generation.

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
const userEmail = `codex-agent-batch-${runId}@example.test`;
const createdSessionIds = [];
const createdRequestIds = [];
let createdUserId = "";

function log(...parts) {
  console.log("[agent-batch-smoke]", ...parts);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

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

  header() {
    return Array.from(this.cookies.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
  }

  get(name) {
    return this.cookies.get(name) || "";
  }
}

function csrfFrom(body, jar) {
  return String(body?.csrfToken || jar.get("csrf") || "");
}

async function request(pathSuffix, {
  method = "GET",
  body,
  jar,
  csrfToken = "",
  expected,
  label = pathSuffix
} = {}) {
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
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text };
    }
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
    method: "POST",
    jar,
    csrfToken,
    body: { email, password },
    expected: 200,
    label: `POST /api/auth/login ${email}`
  });
  assert.equal(result.body?.user?.email, email, `login email mismatch for ${email}`);
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
  const route = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");
  const service = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/generation-service.js"), "utf8");
  const api = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/adapters/ai-image-studio-api.js"), "utf8");
  const app = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/app/create-app.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-batch-generation"], "node scripts/smoke/check-agent-batch-generation.mjs", "root smoke:agent-batch-generation script missing");
  assert(server.includes("createAgentGenerationService"), "server must wire Agent generation service");
  assert(route.includes("/generate"), "agent session route must expose batch generate endpoint");
  assert(route.includes("generate_batch"), "agent route must record generate_batch steps");
  assert(service.includes("queuePayloadForTextGeneration"), "Agent generation must persist recoverable text-generation payloads");
  assert(service.includes("enqueueGenerationJob"), "Agent generation must enqueue existing generation jobs");
  assert(service.includes("runQueuedTextGeneration"), "Agent generation must reuse existing queued text runner");
  assert(service.includes('"agent_batch_dry_run"'), "Agent generation must support dry-run smoke mode");
  assert(service.includes('"agent_batch_enqueued"'), "Agent generation must trace enqueue");
  assert(service.includes("isPublic: false"), "Agent generation must default requests to private");
  assert(api.includes("/generate"), "Agent API adapter must expose batch generation route");
  assert(app.includes("generateAgentBatch"), "Agent app must call batch generation API");
  assert(app.includes("确认并开始批量生成"), "Agent UI must expose explicit batch generation action");
}

async function userCounters(userId) {
  let connection;
  try {
    connection = await mysqlConnection();
    const [userRows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
    const [requestRows] = await connection.execute("SELECT COUNT(*) AS count FROM generation_requests WHERE user_id = ?", [userId]);
    return {
      credits: Number(userRows[0]?.credits || 0),
      generationRequests: Number(requestRows[0]?.count || 0)
    };
  } finally {
    await connection?.end().catch(() => null);
  }
}

async function generationRequestRows(ids) {
  let connection;
  try {
    connection = await mysqlConnection();
    const [rows] = await connection.execute(
      `SELECT id, user_id, status, queue_status, job_type, is_public, queue_payload_json, requested_params_json, normalized_params_json, error_code
         FROM generation_requests
        WHERE id IN (${ids.map(() => "?").join(",")})
        ORDER BY created_at ASC`,
      ids
    );
    return rows;
  } finally {
    await connection?.end().catch(() => null);
  }
}

async function traceStages(ids) {
  let connection;
  try {
    connection = await mysqlConnection();
    const [rows] = await connection.execute(
      `SELECT request_id, stage
         FROM generation_trace
        WHERE request_id IN (${ids.map(() => "?").join(",")})
        ORDER BY request_id, created_at, id`,
      ids
    );
    const byId = new Map(ids.map((id) => [id, []]));
    for (const row of rows) byId.get(row.request_id)?.push(row.stage);
    return byId;
  } finally {
    await connection?.end().catch(() => null);
  }
}

async function apiChecks() {
  if (!adminEmail || !adminPassword) {
    log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped live API batch checks");
    return;
  }

  const admin = await login(adminEmail, adminPassword);
  assert.equal(admin.user?.role, "admin", "admin login should have admin role");
  const created = await request("/api/admin/users", {
    method: "POST",
    jar: admin.jar,
    csrfToken: admin.csrfToken,
    expected: 201,
    label: "POST /api/admin/users agent batch",
    body: {
      email: userEmail,
      name: `codex-agent-batch-${runId}`,
      role: "user",
      status: "active",
      credits: 9,
      generatePassword: true,
      note: "AIS-RLS-066 agent batch smoke"
    }
  });
  createdUserId = created.body?.user?.id || "";
  const password = String(created.body?.temporaryPassword || "");
  assert(createdUserId, "created user id missing");
  assert(password.length >= 8, "temporary password missing");

  const user = await login(userEmail, password);
  const before = await userCounters(createdUserId);
  const sessionResult = await request("/api/agent-sessions", {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 201,
    label: "POST /api/agent-sessions agent batch",
    body: {
      title: `AIS-RLS-066 batch ${runId}`,
      sourceType: "agent-workspace",
      sourceId: runId,
      data: { smoke: "agent-batch" }
    }
  });
  const sessionId = sessionResult.body?.session?.id || "";
  assert(sessionId, "agent session id missing");
  createdSessionIds.push(sessionId);

  const planResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 200,
    label: "POST /api/agent-sessions/:id/plan",
    body: {
      message: `生成一组茶饮新品上市海报，青绿色，社媒竖版 ${runId}`,
      variantCount: 4
    }
  });
  const plan = planResult.body?.plan || {};
  const selectedVariantIds = (plan.variants || []).slice(0, 3).map((variant) => variant.id);
  assert.equal(selectedVariantIds.length, 3, "plan should provide three selected variants for smoke");

  await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 200,
    label: "POST /api/agent-sessions/:id/plan confirm",
    body: {
      action: "confirm",
      plan,
      selectedVariantIds,
      note: "confirm before dry-run batch"
    }
  });

  const generated = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/generate`, {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 200,
    label: "POST /api/agent-sessions/:id/generate dry-run",
    body: {
      plan,
      selectedVariantIds,
      dryRun: true
    }
  });
  assert.equal(generated.body?.dryRun, true, "generate dryRun flag missing");
  assert.equal(generated.body?.requests?.length, 3, "dry-run batch should create three independent requests");
  createdRequestIds.push(...generated.body.requests.map((item) => item.id).filter(Boolean));
  assert.equal(new Set(createdRequestIds).size, 3, "request ids must be unique");
  const steps = generated.body?.session?.steps || [];
  const generatedSteps = steps.filter((step) => step.kind === "generate_batch" && createdRequestIds.includes(step.requestId));
  assert.equal(generatedSteps.length, 3, "session should include one generate_batch step per request");
  assert(generatedSteps.every((step) => step.output?.request?.id === step.requestId), "decorated steps must include request summary");

  const rows = await generationRequestRows(createdRequestIds);
  assert.equal(rows.length, 3, "generation_requests rows missing");
  for (const row of rows) {
    assert.equal(row.user_id, createdUserId, "request owner mismatch");
    assert.equal(row.status, "cancelled", "dry-run request should be terminal cancelled");
    assert.equal(row.queue_status, "cancelled", "dry-run queue status should be cancelled");
    assert.equal(row.job_type, "agent-batch-dry-run", "dry-run job_type mismatch");
    assert.equal(Number(row.is_public), 0, "Agent batch requests must be private by default");
    assert.equal(row.queue_payload_json, null, "dry-run must not persist provider queue payload");
    assert(String(row.requested_params_json || "").includes(sessionId), "requested params should include agent session id");
    assert(String(row.normalized_params_json || "").includes("agentVariantId"), "normalized params should include agent variant id");
  }

  const stages = await traceStages(createdRequestIds);
  for (const requestId of createdRequestIds) {
    assert(stages.get(requestId)?.includes("request_received"), `request ${requestId} missing request_received trace`);
    assert(stages.get(requestId)?.includes("agent_batch_dry_run"), `request ${requestId} missing dry-run trace`);
  }

  const after = await userCounters(createdUserId);
  assert.equal(after.credits, before.credits, "dry-run batch must not deduct credits");
  assert.equal(after.generationRequests, before.generationRequests + 3, "dry-run batch should create three request records");
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
  console.error("[agent-batch-smoke] ERROR:", error?.stack || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
