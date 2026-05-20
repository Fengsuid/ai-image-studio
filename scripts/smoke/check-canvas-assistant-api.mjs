#!/usr/bin/env node
// Authenticated API smoke for canvas assistant context and suggestions.

import crypto from "crypto";
import mysql from "mysql2/promise";

const base = String(process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const email = `canvas-assistant-smoke-${runId}@example.invalid`;
const password = `CanvasAssistant-${runId}!`;
const name = "Canvas Assistant Smoke";
const jar = new Map();
let csrfToken = "";
let createdCanvasId = "";

function log(...args) {
  console.log("[canvas-assistant-api-smoke]", ...args);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function request(path, { method = "GET", body, expected = 200, rawBody = undefined } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined || rawBody !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) headers["X-CSRF-Token"] = csrfToken;
  const cookies = cookieHeader();
  if (cookies) headers.Cookie = cookies;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body)
  });
  storeCookies(response.headers);
  const data = await response.json().catch(() => ({}));
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (response.status !== expected) {
    throw new Error(`${method} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
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

async function createActiveSmokeUser() {
  const passwordHash = hashPassword(password);
  const id = `usr_${crypto.randomBytes(10).toString("hex")}`;
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    const now = new Date();
    await connection.execute(
      `INSERT INTO users
        (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', 0, ?, ?)`,
      [id, name, email, passwordHash.salt, passwordHash.iterations, passwordHash.hash, now, now]
    );
    log("created active smoke user through database fallback");
  } finally {
    await connection?.end().catch(() => {});
  }
}

async function loginSmokeUser() {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
  assert(data.user?.email === email, "smoke user login email mismatch");
}

async function authenticate() {
  await request("/api/auth/me");
  try {
    const result = await request("/api/auth/register", {
      method: "POST",
      expected: 201,
      body: { email, password, name }
    });
    if (result.pendingApproval) {
      await cleanup();
      await createActiveSmokeUser();
      await loginSmokeUser();
    }
  } catch (error) {
    log(`registration unavailable (${error.message}); switching to database fallback user`);
    await cleanup();
    await createActiveSmokeUser();
    await loginSmokeUser();
  }
}

async function cleanup() {
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    await connection.execute("DELETE FROM users WHERE email = ?", [email]);
    log("cleanup ok");
  } catch (error) {
    log("cleanup skipped:", error.message);
  } finally {
    await connection?.end().catch(() => {});
  }
}

function canvasPayload() {
  return {
    title: "Canvas Assistant Smoke",
    visibility: "private",
    dataJson: {
      nodes: [
        { id: "node_prompt", type: "prompt", x: 0, y: 0, data: { title: "Prompt", prompt: "A ceramic tea cup on a rainy window ledge" } },
        { id: "node_style", type: "text", x: 220, y: 80, data: { title: "Style", body: "soft morning light, muted green palette" } },
        { id: "node_output", type: "output", x: 520, y: 140, data: { title: "Output" } }
      ],
      edges: [
        { id: "edge_prompt_style", sourceId: "node_prompt", targetId: "node_style" },
        { id: "edge_style_output", sourceId: "node_style", targetId: "node_output" }
      ],
      selectedNodeId: "node_output",
      selectedNodeIds: ["node_output"]
    }
  };
}

async function main() {
  log("base =", base);
  await request(`/api/canvases/can_missing_${runId}/assistant`, {
    method: "POST",
    expected: 401,
    body: { selectedNodeId: "node_output" }
  });
  await authenticate();

  const created = await request("/api/canvases", {
    method: "POST",
    expected: 201,
    body: canvasPayload()
  });
  createdCanvasId = created.canvas?.id || "";
  assert(createdCanvasId, "created canvas id missing");

  const result = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/assistant`, {
    method: "POST",
    body: { action: "variants", selectedNodeId: "node_output" }
  });
  const assistant = result.assistant || {};
  assert(assistant.format === "ai-image-studio.canvas-assistant.v1", "assistant format mismatch");
  assert(assistant.context?.selectedNodeIds?.includes("node_output"), "selected output node missing");
  assert(assistant.context?.upstreamNodes?.some((node) => node.id === "node_style"), "upstream style node missing");
  assert(assistant.context?.upstreamNodes?.some((node) => node.id === "node_prompt"), "upstream prompt node missing");
  assert(Array.isArray(assistant.suggestions) && assistant.suggestions.length >= 3, "assistant suggestions missing");
  assert(assistant.suggestions.some((item) => item.category === "rewrite" && item.type === "prompt"), "rewrite suggestion missing");
  assert(assistant.suggestions.some((item) => item.category === "style" && item.type === "text"), "style suggestion missing");
  assert(assistant.suggestions.some((item) => item.category === "plan" && item.type === "text"), "plan suggestion missing");
  assert(!JSON.stringify(assistant).includes("data:image/"), "assistant should not leak embedded image data");

  const forged = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/assistant`, {
    method: "POST",
    body: {
      selectedNodeId: "node_output",
      nodes: [
        { id: "forged", type: "prompt", data: { prompt: "Injected secret from request body" } }
      ]
    }
  });
  assert(!JSON.stringify(forged.assistant || {}).includes("Injected secret"), "assistant should ignore forged request nodes");

  const saved = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}`);
  assert(saved.canvas?.dataJson?.nodes?.length === 3, "assistant request should not mutate saved canvas nodes");

  await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/assistant`, {
    method: "POST",
    expected: 400,
    rawBody: "{"
  });

  log("OK: authenticated canvas assistant API checks passed");
}

main()
  .catch((error) => {
    console.error("[canvas-assistant-api-smoke] failed:", error?.stack || error);
    process.exitCode = 1;
  })
  .finally(cleanup);
