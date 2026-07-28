#!/usr/bin/env node
// Static + optional live API smoke for AIS-RLS-152 Agent planner flow.
// Covers: plan generation → confirm → re-plan, including format=ai-image-studio.agent-plan.v1
// envelope contract and confirmationRequired gate.

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
const userEmail = `codex-agent-plan-${runId}@example.test`;
const createdSessionIds = [];
let createdUserId = "";

function log(...parts) {
  console.log("[agent-planner-flow-smoke]", ...parts);
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
  const planner = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/planner.js"), "utf8");
  const routes = ["routes.js", "plan-routes.js"]
    .map((name) => fs.readFileSync(path.join(rootDir, "packages/agent-core/src", name), "utf8"))
    .join("\n");
  const interfaceMd = fs.readFileSync(path.join(rootDir, "packages/agent-core/INTERFACE.md"), "utf8");
  const tests = fs.readFileSync(path.join(rootDir, "packages/agent-core/tests/planner.test.mjs"), "utf8");
  const app = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/app/create-app.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-planner-flow"], "node scripts/smoke/check-agent-planner-flow.mjs", "root smoke:agent-planner-flow script missing");
  assert(planner.includes('"ai-image-studio.agent-plan.v1"'), "planner must declare frozen plan format");
  assert(planner.includes("confirmationRequired: true"), "planner must require confirmation");
  assert(planner.includes("nextAction: \"confirm_plan_before_batch_generation\""), "planner must point at confirmation step");
  assert(planner.includes("step[${index}].output.image_url"), "planner must support upstream step image refs");
  assert(planner.includes("function summarizeAgentPlan"), "planner must export summarizeAgentPlan");
  assert(routes.includes("/plan"), "routes must expose /plan endpoint");
  assert(routes.includes('action === "confirm"'), "routes must support plan confirmation action");
  assert(routes.includes("buildAgentPlan"), "routes must call buildAgentPlan on re-plan");
  assert(routes.includes("plan_confirmed"), "routes must record plan_confirmed step on confirmation");
  assert(interfaceMd.includes("ai-image-studio.agent-plan.v1"), "INTERFACE.md must freeze the plan format");
  assert(interfaceMd.includes("smoke:agent-planner-flow"), "INTERFACE.md must enumerate planner-flow smoke");
  assert(tests.includes("confirmationRequired"), "planner tests must cover confirmationRequired");
  assert(tests.includes("ai-image-studio.agent-plan.v1"), "planner tests must assert the frozen format");
  assert(app.includes("createAgentPlan") || app.includes("/plan"), "agent app must call plan endpoint");
}

async function apiChecks() {
  if (!adminEmail || !adminPassword) {
    log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped live API planner flow checks");
    return;
  }

  const admin = await login(adminEmail, adminPassword);
  assert.equal(admin.user?.role, "admin", "admin login should have admin role");
  const created = await request("/api/admin/users", {
    method: "POST", jar: admin.jar, csrfToken: admin.csrfToken,
    expected: 201, label: "POST /api/admin/users planner flow",
    body: {
      email: userEmail,
      name: `codex-agent-plan-${runId}`,
      role: "user",
      status: "active",
      credits: 6,
      generatePassword: true,
      note: "AIS-RLS-152 agent planner flow smoke"
    }
  });
  createdUserId = created.body?.user?.id || "";
  const password = String(created.body?.temporaryPassword || "");
  assert(createdUserId, "created user id missing");

  const user = await login(userEmail, password);
  const sessionResult = await request("/api/agent-sessions", {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 201, label: "POST /api/agent-sessions planner flow",
    body: {
      title: `AIS-RLS-152 planner ${runId}`,
      sourceType: "agent-workspace",
      sourceId: runId,
      data: { smoke: "agent-planner-flow" }
    }
  });
  const sessionId = sessionResult.body?.session?.id || "";
  assert(sessionId, "agent session id missing");
  createdSessionIds.push(sessionId);

  const firstPlanResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /plan (first)",
    body: { message: `生成宋代青绿瓷器主视觉 ${runId}`, variantCount: 3 }
  });
  const firstPlan = firstPlanResult.body?.plan;
  assert.equal(firstPlan?.format, "ai-image-studio.agent-plan.v1", "first plan must use frozen format");
  assert.equal(firstPlan?.confirmationRequired, true, "first plan must require confirmation");
  assert.equal(firstPlan?.willCreateGenerations, false, "first plan must not create generations");
  assert.equal(firstPlan?.variants?.length, 3, "first plan must respect variantCount=3");
  for (const variant of firstPlan.variants) {
    assert(variant.id && variant.title && variant.prompt, "variant must have id/title/prompt");
  }

  const planSteps = firstPlanResult.body?.session?.steps || [];
  const planStep = planSteps.find((step) => step.kind === "plan");
  assert(planStep, "plan step must be recorded");
  assert.equal(planStep.output?.format, "ai-image-studio.agent-plan.v1", "plan step must store frozen-format output");

  const selectedVariantIds = firstPlan.variants.slice(0, 2).map((variant) => variant.id);
  const confirmResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /plan (confirm)",
    body: {
      action: "confirm",
      plan: firstPlan,
      selectedVariantIds,
      note: "AIS-RLS-152 planner flow confirm"
    }
  });
  assert.equal(confirmResult.body?.confirmed, true, "confirm response must include confirmed:true");
  assert.equal(confirmResult.body?.willCreateGenerations, false, "confirmation must not yet create generations");
  const confirmedSteps = confirmResult.body?.session?.steps || [];
  const confirmedStep = confirmedSteps.find((step) => step.kind === "plan_confirmed");
  assert(confirmedStep, "plan_confirmed step must be recorded after confirm");
  assert.equal(confirmedStep.status, "succeeded", "plan_confirmed step must succeed");

  const rePlanResult = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "POST", jar: user.jar, csrfToken: user.csrfToken,
    expected: 200, label: "POST /plan (re-plan)",
    body: { message: `换一个方向：橙色国潮风 ${runId}`, variantCount: 2 }
  });
  const newPlan = rePlanResult.body?.plan;
  assert.equal(newPlan?.format, "ai-image-studio.agent-plan.v1", "re-plan must use frozen format");
  assert.equal(newPlan?.variants?.length, 2, "re-plan must respect variantCount=2");
  assert.equal(newPlan?.confirmationRequired, true, "re-plan must require fresh confirmation");
  assert.notDeepEqual(
    newPlan.variants.map((variant) => variant.prompt),
    firstPlan.variants.map((variant) => variant.prompt),
    "re-plan prompts should differ from the first plan"
  );
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
  console.error("[agent-planner-flow-smoke] ERROR:", error?.stack || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
