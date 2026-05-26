#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Verifies the Canvas API persists large projects (≈500 nodes / 1000 edges)
// without truncating dataJson, mis-counting nodes/edges, or dropping payload
// fields on roundtrip. Real HTTP + DB — uses the canvas-assistant-api smoke's
// auth pattern so the same credential fallback applies.

import crypto from "crypto";
import mysql from "mysql2/promise";

const base = String(process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const email = `canvas-large-smoke-${runId}@example.invalid`;
const password = `CanvasLarge-${runId}!`;
const name = "Canvas Large Smoke";
const jar = new Map();
let csrfToken = "";
let createdCanvasId = "";

const NODE_COUNT = 500;
const EDGE_COUNT = 1000;

function log(...args) {
  console.log("[canvas-large-project]", ...args);
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
    throw new Error(`${method} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
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

function buildLargeCanvasPayload() {
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i += 1) {
    nodes.push({
      id: `node_${i}`,
      type: i === 0 ? "prompt" : i === NODE_COUNT - 1 ? "output" : "text",
      x: (i % 25) * 220,
      y: Math.floor(i / 25) * 160,
      data: {
        title: `Node ${i}`,
        body: `Body for node index ${i} — large project smoke marker`,
        meta: { index: i, parity: i % 2 === 0 ? "even" : "odd" }
      }
    });
  }
  const edges = [];
  for (let i = 0; i < EDGE_COUNT; i += 1) {
    const source = i % NODE_COUNT;
    const target = (i + 1) % NODE_COUNT;
    edges.push({
      id: `edge_${i}`,
      sourceId: `node_${source}`,
      targetId: `node_${target}`
    });
  }
  return {
    title: `Large Canvas Smoke ${runId}`,
    visibility: "private",
    dataJson: {
      viewport: { x: 0, y: 0, scale: 1 },
      nodes,
      edges,
      selectedNodeId: `node_${NODE_COUNT - 1}`,
      selectedNodeIds: [`node_${NODE_COUNT - 1}`]
    },
    nodeCount: NODE_COUNT,
    edgeCount: EDGE_COUNT
  };
}

async function main() {
  log("base =", base);
  await authenticate();

  const payload = buildLargeCanvasPayload();
  log(`creating canvas with ${NODE_COUNT} nodes / ${EDGE_COUNT} edges`);
  const created = await request("/api/canvases", {
    method: "POST",
    expected: 201,
    body: payload
  });
  createdCanvasId = created.canvas?.id || "";
  assert(createdCanvasId, "created canvas id missing");
  assert(created.canvas?.nodeCount === NODE_COUNT, `expected nodeCount ${NODE_COUNT}, got ${created.canvas?.nodeCount}`);
  assert(created.canvas?.edgeCount === EDGE_COUNT, `expected edgeCount ${EDGE_COUNT}, got ${created.canvas?.edgeCount}`);

  const fetched = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}`);
  const fetchedNodes = fetched.canvas?.dataJson?.nodes;
  const fetchedEdges = fetched.canvas?.dataJson?.edges;
  assert(Array.isArray(fetchedNodes), "fetched dataJson.nodes must be an array");
  assert(Array.isArray(fetchedEdges), "fetched dataJson.edges must be an array");
  assert(fetchedNodes.length === NODE_COUNT, `roundtrip nodes ${fetchedNodes.length} ≠ ${NODE_COUNT} (truncation?)`);
  assert(fetchedEdges.length === EDGE_COUNT, `roundtrip edges ${fetchedEdges.length} ≠ ${EDGE_COUNT} (truncation?)`);

  // Spot-check that node payloads roundtripped without being collapsed/escaped.
  const sampleIndexes = [0, 1, Math.floor(NODE_COUNT / 2), NODE_COUNT - 1];
  for (const i of sampleIndexes) {
    const node = fetchedNodes.find((n) => n.id === `node_${i}`);
    assert(node, `node_${i} missing after roundtrip`);
    assert(node.x === (i % 25) * 220, `node_${i} x coordinate mutated`);
    assert(node.data?.body?.includes(`node index ${i}`), `node_${i} body mutated/truncated`);
    assert(node.data?.meta?.index === i, `node_${i} nested meta dropped`);
  }
  // Spot-check edges.
  for (const i of [0, EDGE_COUNT - 1]) {
    const edge = fetchedEdges.find((e) => e.id === `edge_${i}`);
    assert(edge, `edge_${i} missing after roundtrip`);
    assert(edge.sourceId === `node_${i % NODE_COUNT}`, `edge_${i} sourceId mutated`);
    assert(edge.targetId === `node_${(i + 1) % NODE_COUNT}`, `edge_${i} targetId mutated`);
  }

  // Verify export endpoint also returns the full payload (not silently capped).
  const exported = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/export`);
  assert(exported.canvas?.dataJson?.nodes?.length === NODE_COUNT, "export truncated nodes");
  assert(exported.canvas?.dataJson?.edges?.length === EDGE_COUNT, "export truncated edges");

  log(`OK: ${NODE_COUNT} nodes / ${EDGE_COUNT} edges roundtripped without truncation`);
}

main()
  .catch((error) => {
    console.error("[canvas-large-project] failed:", error?.stack || error);
    process.exitCode = 1;
  })
  .finally(cleanup);
