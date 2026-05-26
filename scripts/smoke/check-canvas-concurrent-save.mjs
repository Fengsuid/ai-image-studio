#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Verifies the Canvas PATCH endpoint handles concurrent writes coherently:
// firing two overlapping PATCH /api/canvases/:id calls must NOT produce a
// torn write (a final state that is a partial mix of both payloads).
// Real HTTP + DB — auth pattern matches check-canvas-assistant-api.mjs.
//
// Acceptable outcomes per request:
//   - both succeed with 200 → final state must match exactly one payload, never a mix
//   - one fails with 409 (optimistic concurrency) and the winning payload persists
//   - one fails with any 4xx/5xx — the surviving payload must still match coherently

import crypto from "crypto";
import mysql from "mysql2/promise";

const base = String(process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const email = `canvas-concurrent-smoke-${runId}@example.invalid`;
const password = `CanvasConcurrent-${runId}!`;
const name = "Canvas Concurrent Smoke";
const jar = new Map();
let csrfToken = "";
let createdCanvasId = "";

function log(...args) {
  console.log("[canvas-concurrent-save]", ...args);
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

async function rawRequest(path, { method = "GET", body, rawBody = undefined } = {}) {
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
  return { status: response.status, data };
}

async function request(path, options = {}) {
  const { expected = 200, ...rest } = options;
  const result = await rawRequest(path, rest);
  if (result.status !== expected) {
    throw new Error(`${options.method || "GET"} ${path} expected ${expected}, got ${result.status}: ${JSON.stringify(result.data).slice(0, 300)}`);
  }
  return result.data;
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

function buildPayload(marker) {
  return {
    title: `Concurrent Canvas ${marker}`,
    dataJson: {
      marker,
      viewport: { x: 0, y: 0, scale: 1 },
      nodes: [
        { id: "node_a", type: "prompt", x: 0, y: 0, data: { title: `A-${marker}`, prompt: `prompt for ${marker}` } },
        { id: "node_b", type: "text", x: 240, y: 60, data: { title: `B-${marker}`, body: `body for ${marker}` } }
      ],
      edges: [{ id: "edge_ab", sourceId: "node_a", targetId: "node_b" }]
    }
  };
}

async function main() {
  log("base =", base);
  await authenticate();

  const seed = await request("/api/canvases", {
    method: "POST",
    expected: 201,
    body: buildPayload("seed")
  });
  createdCanvasId = seed.canvas?.id || "";
  assert(createdCanvasId, "created canvas id missing");

  const path = `/api/canvases/${encodeURIComponent(createdCanvasId)}`;
  const payloadAlpha = buildPayload("alpha");
  const payloadBeta = buildPayload("beta");

  log("firing two concurrent PATCH calls");
  const [resAlpha, resBeta] = await Promise.all([
    rawRequest(path, { method: "PATCH", body: payloadAlpha }),
    rawRequest(path, { method: "PATCH", body: payloadBeta })
  ]);

  log(`alpha → ${resAlpha.status} | beta → ${resBeta.status}`);
  for (const [label, result] of [["alpha", resAlpha], ["beta", resBeta]]) {
    if (result.status !== 200 && result.status !== 409 && result.status !== 412) {
      throw new Error(`${label} got unexpected status ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
    }
  }
  if (resAlpha.status !== 200 && resBeta.status !== 200) {
    throw new Error("neither concurrent PATCH succeeded — at least one must persist");
  }

  // Read back final state and assert it matches EXACTLY one of the two payloads
  // (no torn write where, e.g., title comes from alpha but nodes from beta).
  const final = await request(path);
  const finalMarker = final.canvas?.dataJson?.marker || "";
  const finalTitle = final.canvas?.title || "";
  const finalNodeATitle = final.canvas?.dataJson?.nodes?.find((n) => n.id === "node_a")?.data?.title || "";
  const finalNodeBBody = final.canvas?.dataJson?.nodes?.find((n) => n.id === "node_b")?.data?.body || "";

  const matchesAlpha = finalMarker === "alpha"
    && finalTitle === `Concurrent Canvas alpha`
    && finalNodeATitle === "A-alpha"
    && finalNodeBBody === "body for alpha";
  const matchesBeta = finalMarker === "beta"
    && finalTitle === `Concurrent Canvas beta`
    && finalNodeATitle === "A-beta"
    && finalNodeBBody === "body for beta";

  if (!matchesAlpha && !matchesBeta) {
    throw new Error(`final state is a torn write — marker=${finalMarker} title="${finalTitle}" nodeA="${finalNodeATitle}" nodeB="${finalNodeBBody}"`);
  }
  log(`coherent final state: matches ${matchesAlpha ? "alpha" : "beta"} payload (last-write-wins)`);

  // Sanity: counts should equal the payload's array length.
  assert(final.canvas?.dataJson?.nodes?.length === 2, "final node count mismatch");
  assert(final.canvas?.dataJson?.edges?.length === 1, "final edge count mismatch");

  log("OK: concurrent PATCH calls produced a coherent final state");
}

main()
  .catch((error) => {
    console.error("[canvas-concurrent-save] failed:", error?.stack || error);
    process.exitCode = 1;
  })
  .finally(cleanup);
