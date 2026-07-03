#!/usr/bin/env node
// Static and authenticated API smoke for AIS-RLS-065 Agent workspace MVP.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { buildAgentPlan } = require("@ai-image-studio/agent-core");
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://127.0.0.1:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userEmail = `codex-agent-workspace-${runId}@example.test`;
const createdSessionIds = [];
let createdUserId = "";

function log(...parts) {
  console.log("[agent-workspace-smoke]", ...parts);
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

async function fetchText(pathSuffix, accept = "text/html,*/*") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathSuffix}`, {
      headers: { Accept: accept },
      signal: controller.signal
    });
    const body = await response.text();
    return { response, body };
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
  if (!createdSessionIds.length && !createdUserId) return;
  let connection;
  try {
    connection = await mysqlConnection();
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
  const agentPackage = JSON.parse(fs.readFileSync(path.join(rootDir, "apps/agent-workspace/package.json"), "utf8"));
  const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
  const dockerfile = readOptionalText(path.join(rootDir, "Dockerfile"));
  const dockerignore = readOptionalText(path.join(rootDir, ".dockerignore"));
  const home = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
  const mobileCss = fs.readFileSync(path.join(rootDir, "public/css/mobile/_safe-area.css"), "utf8");
  const appSource = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/app/create-app.js"), "utf8");
  const apiSource = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/adapters/ai-image-studio-api.js"), "utf8");
  const plannerSource = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/planner.js"), "utf8");
  const routeSource = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");
  const indexHtml = fs.readFileSync(path.join(rootDir, "public/agent/index.html"), "utf8");

  assert.equal(packageJson.scripts["agent:check"], "npm run check --prefix apps/agent-workspace", "root agent:check script missing");
  assert.equal(packageJson.scripts["agent:build"], "npm run build --prefix apps/agent-workspace", "root agent:build script missing");
  assert.equal(packageJson.scripts["smoke:agent-workspace"], "node scripts/smoke/check-agent-workspace.mjs", "root smoke:agent-workspace script missing");
  assert(agentPackage.scripts.build.includes("node scripts/build.mjs"), "agent workspace build script missing");
  assert(agentPackage.scripts.build.includes("npm run check"), "agent workspace build must run check");

  assert(server.includes('pathname === "/agent" || pathname.startsWith("/agent/")'), "server must detect /agent SPA paths");
  assert(server.includes('pathname.startsWith("/agent/assets/")'), "server must keep /agent assets static");
  assert(server.includes('"/agent/index.html"'), "server must serve agent index for SPA routes");
  assert(server.includes('path.join(PUBLIC_DIR, "agent", "index.html")'), "server fallback must read agent index");
  if (dockerfile) {
    assert(dockerfile.includes("AS agent-workspace-build"), "Dockerfile must include isolated agent build stage");
    assert(dockerfile.includes("npm run build --prefix apps/agent-workspace"), "Dockerfile must build agent workspace");
    assert(dockerfile.includes("COPY --from=agent-workspace-build /app/public/agent ./public/agent"), "Dockerfile must publish built agent assets");
  }
  if (dockerignore) {
    assert(dockerignore.includes("apps/agent-workspace/node_modules"), ".dockerignore must exclude agent node_modules");
  }

  assert(home.includes('id="agentWorkspaceBtn"'), "home topbar must include Agent workspace entry");
  assert(home.includes('href="/agent"'), "Agent entry must link to /agent");
  assert(mobileCss.includes("#agentWorkspaceBtn"), "mobile CSS must explicitly account for Agent entry");

  assert(routeSource.includes("/plan"), "agent session route must expose plan endpoint");
  assert(routeSource.includes("buildAgentPlan"), "agent session route must call planner");
  assert(routeSource.includes("plan_confirmed"), "agent session route must record confirmation step");
  assert(plannerSource.includes("willCreateGenerations: false"), "planner must make no-generation contract explicit");
  assert(plannerSource.includes("confirmationRequired: true"), "planner must require confirmation");

  assert(apiSource.includes("/api/agent-sessions"), "agent API adapter must use agent session routes");
  assert(apiSource.includes('credentials: "same-origin"'), "agent API adapter must use same-origin credentials");
  assert(apiSource.includes("X-CSRF-Token"), "agent API adapter must attach CSRF token");
  assert(apiSource.includes("resumeAgentSession"), "agent API adapter must expose session resume");
  assert(apiSource.includes("retryAgentStepViaMessage"), "agent API adapter must expose message-based step retry");
  assert(apiSource.includes("exportAgentSessionZip"), "agent API adapter must expose session ZIP export");
  assert(!apiSource.includes("openai.com"), "agent workspace must not call providers directly");
  assert(!apiSource.includes("apiKey"), "agent workspace must not handle provider API keys");
  assert(appSource.includes("createAgentPlan"), "agent app must submit plan requests");
  assert(appSource.includes("confirmAgentPlan"), "agent app must confirm plans through API");
  assert(appSource.includes("generateAgentBatch"), "agent app must submit batch generation requests");
  assert(appSource.includes("exportAgentCanvas"), "agent app must export Agent sessions to Canvas v2");
  assert(appSource.includes("agent-step-timeline"), "agent app must render step timeline");
  assert(appSource.includes("data-agent-resume"), "agent app must expose resume button");
  assert(appSource.includes("data-agent-retry-step"), "agent app must expose single-step retry button");
  assert(appSource.includes("data-agent-export-session"), "agent app must expose session ZIP export button");
  assert(appSource.includes("点击批量生成后才会进入队列"), "agent UI must state explicit queue/credit boundary");

  const jsPath = indexHtml.match(/src="([^"]*\/agent\/assets\/main\.[^"]+\.js)"/)?.[1] || "";
  const cssPath = indexHtml.match(/href="([^"]*\/agent\/assets\/styles\.[^"]+\.css)"/)?.[1] || "";
  assert(jsPath, "agent index must reference hashed JS");
  assert(cssPath, "agent index must reference hashed CSS");
  assert(indexHtml.includes('<html lang="zh-CN" data-app="agent"'), "agent index html must opt into data-app tokens");
  assert(indexHtml.includes('<body data-app="agent">'), "agent index body must expose data-app for sub-app styling");
  assert(indexHtml.includes('const k="imageStudio.theme"'), "agent index must bootstrap shared theme before CSS");
  for (const tokenLink of [
    "/css/00-tokens.css",
    "/css/00-tokens-typography.css",
    "/css/00-tokens-motion.css",
    "/css/00-theme.css",
    "/css/primitives/_toast.css",
    "/css/primitives/_drawer.css",
    "/css/primitives/_modal.css"
  ]) {
    assert(indexHtml.includes(`href="${tokenLink}"`), `agent index must load ${tokenLink}`);
  }
  assert(indexHtml.includes("data-agent-workspace-root"), "agent index must expose root mount");
  assert(fs.existsSync(path.join(rootDir, "public", jsPath.replace(/^\/+/, ""))), "agent hashed JS missing");
  assert(fs.existsSync(path.join(rootDir, "public", cssPath.replace(/^\/+/, ""))), "agent hashed CSS missing");

  const samplePlan = buildAgentPlan("我想做一组赛博茶饮品牌海报，适合小红书，统一青绿色并带宋代瓷器质感。", { variantCount: 4 });
  assert.equal(samplePlan.format, "ai-image-studio.agent-plan.v1", "planner format mismatch");
  assert(samplePlan.variants.length >= 2 && samplePlan.variants.length <= 4, "planner must return 2-4 variants");
  assert.equal(samplePlan.confirmationRequired, true, "planner must require confirmation");
  assert.equal(samplePlan.willCreateGenerations, false, "planner must not create generations");
  assert(samplePlan.variants.every((variant) => variant.prompt && variant.size && variant.quality), "planner variants must be executable");
}

function readOptionalText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function apiChecks() {
  if (!adminEmail || !adminPassword) {
    log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped live API plan checks");
    return;
  }

  const agentPage = await fetchText("/agent");
  assert.equal(agentPage.response.status, 200, `/agent status=${agentPage.response.status}`);
  assert(agentPage.body.includes("data-agent-workspace-root"), "/agent must serve Agent workspace root");
  const jsPath = agentPage.body.match(/src="([^"]*\/agent\/assets\/main\.[^"]+\.js)"/)?.[1] || "";
  const cssPath = agentPage.body.match(/href="([^"]*\/agent\/assets\/styles\.[^"]+\.css)"/)?.[1] || "";
  assert(jsPath, "/agent must reference hashed JS");
  assert(cssPath, "/agent must reference hashed CSS");
  const [agentJs, agentCss] = await Promise.all([
    fetchText(jsPath, "application/javascript,*/*"),
    fetchText(cssPath, "text/css,*/*")
  ]);
  assert.equal(agentJs.response.status, 200, `${jsPath} status=${agentJs.response.status}`);
  assert.equal(agentCss.response.status, 200, `${cssPath} status=${agentCss.response.status}`);
  assert(agentJs.body.includes("createAgentWorkspaceApp"), "Agent JS must bootstrap workspace app");
  assert(agentCss.body.includes(".agent-shell"), "Agent CSS must style workspace shell");

  const admin = await login(adminEmail, adminPassword);
  assert.equal(admin.user?.role, "admin", "admin login should have admin role");
  const created = await request("/api/admin/users", {
    method: "POST",
    jar: admin.jar,
    csrfToken: admin.csrfToken,
    expected: 201,
    label: "POST /api/admin/users agent workspace",
    body: {
      email: userEmail,
      name: `codex-agent-workspace-${runId}`,
      role: "user",
      status: "active",
      credits: 7,
      generatePassword: true,
      note: "AIS-RLS-065 smoke"
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
    label: "POST /api/agent-sessions for workspace",
    body: {
      title: `AIS-RLS-065 smoke ${runId}`,
      sourceType: "agent-workspace",
      sourceId: runId,
      data: { smoke: "agent-workspace" }
    }
  });
  const sessionId = sessionResult.body?.session?.id || "";
  assert(sessionId, "agent workspace session id missing");
  createdSessionIds.push(sessionId);

  const planResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 200,
    label: "POST /api/agent-sessions/:id/plan",
    body: {
      message: `我想做一组赛博茶饮品牌海报，适合小红书，统一青绿色 ${runId}`,
      variantCount: 4
    }
  });
  const plan = planResult.body?.plan || {};
  assert.equal(plan.format, "ai-image-studio.agent-plan.v1", "plan format mismatch");
  assert(plan.variants?.length >= 2 && plan.variants?.length <= 4, "plan should contain 2-4 variants");
  assert.equal(plan.confirmationRequired, true, "plan should require confirmation");
  assert.equal(plan.willCreateGenerations, false, "plan should not create generation tasks");
  assert(planResult.body?.session?.messages?.some((message) => message.role === "assistant"), "plan response should include assistant message");
  assert(planResult.body?.session?.steps?.some((step) => step.kind === "plan"), "plan response should include plan step");

  const confirmResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST",
    jar: user.jar,
    csrfToken: user.csrfToken,
    expected: 200,
    label: "POST /api/agent-sessions/:id/plan confirm",
    body: {
      action: "confirm",
      plan,
      selectedVariantIds: plan.variants.slice(0, 2).map((variant) => variant.id),
      note: "confirm without generation"
    }
  });
  assert.equal(confirmResult.body?.confirmed, true, "plan confirmation flag missing");
  assert.equal(confirmResult.body?.willCreateGenerations, false, "confirmation must not create generations in MVP");
  assert(confirmResult.body?.session?.steps?.some((step) => step.kind === "plan_confirmed"), "confirmation should create plan_confirmed step");

  const after = await userCounters(createdUserId);
  assert.equal(after.credits, before.credits, "agent plan must not deduct credits");
  assert.equal(after.generationRequests, before.generationRequests, "agent plan must not create generation_requests");
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

async function main() {
  staticChecks();
  await apiChecks();
  log("ok");
}

main()
  .catch(async (error) => {
    console.error("[agent-workspace-smoke] ERROR:", error?.stack || error);
    process.exitCode = 1;
  })
  .finally(cleanup);
