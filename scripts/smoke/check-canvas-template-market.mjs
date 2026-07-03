#!/usr/bin/env node
// Smoke for canvas template publishing, listing, and private duplication.

import crypto from "crypto";
import mysql from "mysql2/promise";

const base = String(process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const accounts = [
  {
    email: `canvas-template-a-${runId}@example.invalid`,
    password: `CanvasTemplateA-${runId}!`,
    name: "Canvas Template A"
  },
  {
    email: `canvas-template-b-${runId}@example.invalid`,
    password: `CanvasTemplateB-${runId}!`,
    name: "Canvas Template B"
  }
];
const jar = new Map();
let csrfToken = "";

function log(...args) {
  console.log("[canvas-template-market-smoke]", ...args);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio"
  };
}

function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(value, salt, iterations, 32, "sha256").toString("hex");
  return { salt, iterations, hash };
}

function storeCookies(headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  for (const header of values) {
    const [pair] = String(header).split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(pathname, { method = "GET", body, expected = 200, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) headers["X-CSRF-Token"] = csrfToken;
  const cookies = auth ? cookieHeader() : "";
  if (cookies) headers.Cookie = cookies;
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (auth) storeCookies(response.headers);
  const data = await response.json().catch(() => ({}));
  if (auth && data.csrfToken) csrfToken = data.csrfToken;
  if (response.status !== expected) {
    throw new Error(`${method} ${pathname} expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function resetAuth() {
  jar.clear();
  csrfToken = "";
}

async function createActiveSmokeUser({ email, password, name }) {
  const passwordHash = hashPassword(password);
  const id = `usr_${crypto.randomBytes(10).toString("hex")}`;
  const now = new Date();
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    await connection.execute("DELETE FROM users WHERE email = ?", [email]);
    await connection.execute(
      `INSERT INTO users
        (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', 0, ?, ?)`,
      [id, name, email, passwordHash.salt, passwordHash.iterations, passwordHash.hash, now, now]
    );
    log(`created fallback user ${email}`);
  } finally {
    await connection?.end().catch(() => {});
  }
  return id;
}

async function loginOrRegister(account) {
  resetAuth();
  await request("/api/auth/me");
  try {
    const result = await request("/api/auth/register", {
      method: "POST",
      expected: 201,
      body: account
    });
    if (result.pendingApproval) {
      resetAuth();
      await createActiveSmokeUser(account);
      await request("/api/auth/me");
      const login = await request("/api/auth/login", {
        method: "POST",
        body: { email: account.email, password: account.password }
      });
      return login.user?.id || "";
    }
    return result.user?.id || "";
  } catch (error) {
    log(`register unavailable for ${account.email}: ${error.message}`);
    resetAuth();
    await createActiveSmokeUser(account);
    await request("/api/auth/me");
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: account.email, password: account.password }
    });
    return login.user?.id || "";
  }
}

function canvasPayload(title) {
  return {
    title,
    visibility: "private",
    dataJson: {
      nodes: [
        {
          id: "node_prompt",
          type: "prompt",
          x: 0,
          y: 0,
          data: {
            prompt: "Reusable canvas template prompt",
            userEmail: accounts[0].email
          }
        },
        {
          id: "node_output",
          type: "output",
          x: 260,
          y: 0,
          data: {
            title: "Output",
            status: "idle",
            body: "Waiting"
          }
        }
      ],
      edges: [{ id: "edge_1", sourceId: "node_prompt", targetId: "node_output" }]
    }
  };
}

async function main() {
  await loginOrRegister(accounts[0]);
  const privateCanvas = await request("/api/canvases", {
    method: "POST",
    expected: 201,
    body: canvasPayload("Private Draft")
  });
  const templateCanvas = await request("/api/canvases", {
    method: "POST",
    expected: 201,
    body: canvasPayload("Template Seed")
  });
  const templateId = templateCanvas.canvas?.id || "";
  assert(templateId, "template canvas id missing");
  const published = await request(`/api/canvases/${encodeURIComponent(templateId)}`, {
    method: "PATCH",
    body: { visibility: "public", isTemplate: true }
  });
  assert(published.canvas?.isTemplate === true, "template publish flag missing");
  assert(published.canvas?.visibility === "public", "template should be public");

  const templates = await request("/api/canvases?scope=templates&limit=20");
  const templateIds = (templates.canvases || []).map((canvas) => canvas.id);
  assert(templateIds.includes(templateId), "published template missing from market");
  assert(!templateIds.includes(privateCanvas.canvas?.id || ""), "private canvas leaked into market");
  const initialForkCount = Number((templates.canvases || []).find((canvas) => canvas.id === templateId)?.forkCount || 0);

  await loginOrRegister(accounts[1]);
  const copied = await request(`/api/canvases/${encodeURIComponent(templateId)}/fork`, {
    method: "POST",
    expected: 201,
    body: { title: "Copied from template" }
  });
  assert(copied.forked?.sourceCanvasId === templateId, "fork response should identify source template");
  assert(copied.canvas?.userId, "duplicated canvas user missing");
  assert(copied.canvas.userId !== (privateCanvas.canvas?.userId || ""), "duplicate should belong to second user");
  assert(copied.canvas?.visibility === "private", "duplicate should stay private");
  assert(copied.canvas?.isTemplate === false, "duplicate should not stay a template");
  assert(!copied.canvas?.dataJson?.nodes?.[0]?.data?.userEmail, "duplicate should scrub private node metadata");
  assert(copied.canvas?.dataJson?.nodes?.length === 2, "duplicate should keep nodes");
  const refreshedTemplates = await request("/api/canvases?scope=templates&limit=20");
  const refreshedTemplate = (refreshedTemplates.canvases || []).find((canvas) => canvas.id === templateId);
  assert(Number(refreshedTemplate?.forkCount || 0) >= initialForkCount + 1, "template forkCount should increment after fork");

  log("OK: template publish, market listing, and private duplication verified");
}

main().catch((error) => {
  console.error("[canvas-template-market-smoke] failed:", error?.stack || error);
  process.exitCode = 1;
});
