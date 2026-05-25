#!/usr/bin/env node
// Static and optional live API smoke for AIS-RLS-066 Agent Canvas v2 export.

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
const userEmail = `codex-agent-canvas-${runId}@example.test`;
const createdSessionIds = [];
const createdRequestIds = [];
const createdCanvasIds = [];
let createdUserId = "";

function log(...parts) {
  console.log("[agent-export-canvas-smoke]", ...parts);
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
  if (!createdCanvasIds.length && !createdRequestIds.length && !createdSessionIds.length && !createdUserId) return;
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
  const route = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");
  const service = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/generation-service.js"), "utf8");
  const api = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/adapters/ai-image-studio-api.js"), "utf8");
  const app = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/app/create-app.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-export-canvas"], "node scripts/smoke/check-agent-export-canvas.mjs", "root smoke:agent-export-canvas script missing");
  assert(route.includes("/export-canvas"), "agent session route must expose Canvas export endpoint");
  assert(route.includes("canvas_route_suggestion"), "Agent route must record Canvas route suggestion steps");
  assert(service.includes("schema: \"ai-image-studio.canvas.v1\""), "Agent export must create Canvas v2 schema document");
  assert(service.includes("type: \"prompt\""), "Agent export must create prompt nodes");
  assert(service.includes("type: \"config\""), "Agent export must create config nodes");
  assert(service.includes("type: \"output\""), "Agent export must create output nodes");
  assert(service.includes("visibility: \"private\""), "Agent export must create private canvases");
  assert(service.includes("createCanvasGenerationLinks"), "Agent export should link generated results to Canvas nodes");
  assert(!service.includes("userEmail"), "Agent Canvas export service must not persist owner email fields");
  assert(!service.includes("apiKey"), "Agent Canvas export service must not persist provider secrets");
  assert(api.includes("/export-canvas"), "Agent API adapter must expose Canvas export route");
  assert(app.includes("exportAgentCanvas"), "Agent app must call Canvas export API");
  assert(app.includes("导出到 Canvas v2"), "Agent UI must expose Canvas export action");
}

function containsSensitiveOwnerInfo(value) {
  const text = JSON.stringify(value);
  return /userEmail|ownerEmail|apiKey|authorization|password|secret/i.test(text);
}

async function loadCanvasRow(canvasId) {
  let connection;
  try {
    connection = await mysqlConnection();
    const [rows] = await connection.execute(
      "SELECT id, user_id, title, visibility, data_json, node_count, edge_count FROM canvas_projects WHERE id = ? LIMIT 1",
      [canvasId]
    );
    return rows[0] || null;
  } finally {
    await connection?.end().catch(() => null);
  }
}

async function apiChecks() {
  if (!adminEmail || !adminPassword) {
    log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped live API Canvas export checks");
    return;
  }

  const admin = await login(adminEmail, adminPassword);
  assert.equal(admin.user?.role, "admin", "admin login should have admin role");
  const created = await request("/api/admin/users", {
    method: "POST",
    jar: admin.jar,
    csrfToken: admin.csrfToken,
    expected: 201,
    label: "POST /api/admin/users agent canvas",
    body: {
      email: userEmail,
      name: `codex-agent-canvas-${runId}`,
      role: "user",
      status: "active",
      credits: 9,
      generatePassword: true,
      note: "AIS-RLS-066 agent canvas export smoke"
    }
  });
  createdUserId = created.body?.user?.id || "";
  const password = String(created.body?.temporaryPassword || "");
  assert(createdUserId, "created user id missing");
  assert(password.length >= 8, "temporary password missing");

  const user = await login(userEmail, password);
  const sessionResult = await request("/api/agent-sessions", {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 201,
    label: "POST /api/agent-sessions agent canvas",
    body: {
      title: `AIS-RLS-066 canvas ${runId}`,
      sourceType: "agent-workspace",
      sourceId: runId,
      data: { smoke: "agent-export-canvas" }
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
      message: `为茶饮品牌做三张社媒海报，青绿色，留白高级 ${runId}`,
      variantCount: 3
    }
  });
  const plan = planResult.body?.plan || {};
  const selectedVariantIds = (plan.variants || []).slice(0, 3).map((variant) => variant.id);
  assert.equal(selectedVariantIds.length, 3, "plan should provide three selected variants for Canvas smoke");

  const generated = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/generate`, {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 200,
    label: "POST /api/agent-sessions/:id/generate dry-run before export",
    body: { plan, selectedVariantIds, dryRun: true }
  });
  createdRequestIds.push(...(generated.body?.requests || []).map((item) => item.id).filter(Boolean));
  assert.equal(createdRequestIds.length, 3, "dry-run generation should create three request ids before export");

  const exported = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/export-canvas`, {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 201,
    label: "POST /api/agent-sessions/:id/export-canvas",
    body: {
      plan,
      selectedVariantIds,
      title: `Agent Canvas Smoke ${runId}`
    }
  });
  const canvas = exported.body?.canvas || {};
  assert(canvas.id, "exported canvas id missing");
  createdCanvasIds.push(canvas.id);
  assert.equal(canvas.visibility, "private", "Agent export must return private Canvas");
  assert.equal(canvas.nodeCount, 9, "three variants should export prompt/config/output nodes");
  assert.equal(canvas.edgeCount, 6, "three variants should export prompt/config edges");
  assert(canvas.url?.includes("/canvas-v2"), "exported canvas should include Canvas v2 URL");
  assert(exported.body?.session?.steps?.some((step) => step.kind === "canvas_route_suggestion" && step.output?.canvasId === canvas.id), "session should include Canvas export step");

  const row = await loadCanvasRow(canvas.id);
  assert(row, "canvas row missing");
  assert.equal(row.user_id, createdUserId, "canvas owner mismatch");
  assert.equal(row.visibility, "private", "canvas row must be private");
  const data = JSON.parse(row.data_json);
  assert.equal(data.schema, "ai-image-studio.canvas.v1", "canvas schema mismatch");
  assert.equal(data.meta?.source, "agent-workspace", "canvas meta source mismatch");
  assert.equal(data.meta?.agentSessionId, sessionId, "canvas meta session id mismatch");
  assert.equal(data.nodes.filter((node) => node.type === "prompt").length, 3, "canvas must include prompt nodes");
  assert.equal(data.nodes.filter((node) => node.type === "config").length, 3, "canvas must include config nodes");
  assert.equal(data.nodes.filter((node) => node.type === "output").length, 3, "canvas must include output nodes");
  assert(data.edges.length >= 6, "canvas must include prompt/config to output edges");
  assert(!containsSensitiveOwnerInfo(data), "canvas document must not contain sensitive owner/provider fields");
  assert(!JSON.stringify(data).includes("/source-file"), "canvas export must not include unpublished source image routes");
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
  console.error("[agent-export-canvas-smoke] ERROR:", error?.stack || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
