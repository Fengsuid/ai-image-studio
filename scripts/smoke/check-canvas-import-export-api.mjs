#!/usr/bin/env node
// Authenticated API smoke for canvas JSON export/import.

import crypto from "crypto";
import mysql from "mysql2/promise";

const base = String(process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const email = `canvas-io-smoke-${runId}@example.invalid`;
const password = `CanvasIo-${runId}!`;
const name = "Canvas IO Smoke";
const jar = new Map();
let csrfToken = "";
let createdCanvasId = "";

function log(...args) {
  console.log("[canvas-io-api-smoke]", ...args);
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

function canvasPayload(title = "Canvas IO Smoke") {
  return {
    title,
    visibility: "private",
    dataJson: {
      background: "grid",
      viewport: { x: 0, y: 0, scale: 1 },
      nodes: [
        { id: "node_prompt", type: "prompt", x: 0, y: 0, data: { title: "Prompt", prompt: "A product photo" } },
        { id: "node_image", type: "image", x: 260, y: 40, data: { title: "Image", imageUrl: "/api/images/gen_smoke/file?variant=thumb", generationId: "gen_smoke" } }
      ],
      edges: [{ id: "edge_prompt_image", sourceId: "node_prompt", targetId: "node_image" }],
      selectedNodeId: "node_image",
      selectedNodeIds: ["node_prompt", "node_image"]
    }
  };
}

async function main() {
  log("base =", base);
  await authenticate();

  const created = await request("/api/canvases", {
    method: "POST",
    expected: 201,
    body: canvasPayload()
  });
  createdCanvasId = created.canvas?.id || "";
  assert(createdCanvasId, "created canvas id missing");

  const exported = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/export`);
  assert(exported.format === "ai-image-studio.canvas.v1", "export format mismatch");
  assert(exported.canvas?.dataJson?.nodes?.length === 2, "export should include nodes");
  assert(exported.canvas?.dataJson?.edges?.length === 1, "export should include edges");

  exported.canvas.title = "Canvas IO Imported";
  exported.canvas.dataJson.nodes[0].x = 88;
  const imported = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/import`, {
    method: "POST",
    body: exported
  });
  assert(imported.imported?.nodeCount === 2, "import summary node count mismatch");
  assert(imported.canvas?.title === "Canvas IO Imported", "import should update title");
  assert(imported.canvas?.dataJson?.nodes?.[0]?.x === 88, "import should update canvas data");

  const invalidEdge = canvasPayload("Invalid Edge");
  invalidEdge.dataJson.edges = [{ sourceId: "node_prompt", targetId: "missing_node" }];
  await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/import`, {
    method: "POST",
    expected: 400,
    body: invalidEdge
  });

  const embeddedImage = canvasPayload("Embedded Image");
  embeddedImage.dataJson.nodes[1].data.imageUrl = "data:image/png;base64,abc";
  await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/import`, {
    method: "POST",
    expected: 400,
    body: embeddedImage
  });

  await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/import`, {
    method: "POST",
    expected: 400,
    rawBody: "{"
  });

  log("OK: authenticated export/import API checks passed");
}

main()
  .catch((error) => {
    console.error("[canvas-io-api-smoke] failed:", error?.stack || error);
    process.exitCode = 1;
  })
  .finally(cleanup);
