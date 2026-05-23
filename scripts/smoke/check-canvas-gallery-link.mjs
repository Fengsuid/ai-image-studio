#!/usr/bin/env node
// Authenticated smoke for gallery detail links back to the source canvas project.

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";

const base = String(process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const generatedDir = path.join(dataDir, "generated");
const sourcesDir = path.join(dataDir, "sources");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const email = `canvas-gallery-link-${runId}@example.invalid`;
const password = `CanvasGallery-${runId}!`;
const name = "Canvas Gallery Link Smoke";
const copyEmail = `canvas-gallery-copy-${runId}@example.invalid`;
const copyPassword = `CanvasGalleryCopy-${runId}!`;
const copyName = "Canvas Gallery Copy Smoke";
const generationId = `gen_${crypto.randomBytes(10).toString("hex")}`;
const filename = `${generationId}.png`;
const sourceFilename = `${generationId}-source.png`;
const jar = new Map();
let csrfToken = "";
let userId = "";
let copyUserId = "";
let createdCanvasId = "";

function log(...args) {
  console.log("[canvas-gallery-link-smoke]", ...args);
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

async function createActiveSmokeUser({ userEmail = email, userPassword = password, userName = name } = {}) {
  const passwordHash = hashPassword(userPassword);
  const id = `usr_${crypto.randomBytes(10).toString("hex")}`;
  const now = new Date();
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    await connection.execute(
      `INSERT INTO users
        (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', 0, ?, ?)`,
      [id, userName, userEmail, passwordHash.salt, passwordHash.iterations, passwordHash.hash, now, now]
    );
    log("created active smoke user through database fallback");
  } finally {
    await connection?.end().catch(() => {});
  }
  return id;
}

async function loginSmokeUser({ userEmail = email, userPassword = password } = {}) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: { email: userEmail, password: userPassword }
  });
  assert(data.user?.email === userEmail, "smoke user login email mismatch");
  return data.user?.id || "";
}

async function authenticate() {
  await request("/api/auth/me");
  try {
    const result = await request("/api/auth/register", {
      method: "POST",
      expected: 201,
      body: { email, password, name }
    });
    userId = result.user?.id || userId;
    if (result.pendingApproval) {
      await cleanup();
      userId = await createActiveSmokeUser();
      userId = await loginSmokeUser();
    }
  } catch (error) {
    log(`registration unavailable (${error.message}); switching to database fallback user`);
    await cleanup();
    userId = await createActiveSmokeUser();
    userId = await loginSmokeUser();
  }
}

async function authenticateCopyUser() {
  resetAuth();
  await request("/api/auth/me");
  copyUserId = await createActiveSmokeUser({ userEmail: copyEmail, userPassword: copyPassword, userName: copyName });
  copyUserId = await loginSmokeUser({ userEmail: copyEmail, userPassword: copyPassword });
}

async function createCanvasProject() {
  const created = await request("/api/canvases", {
    method: "POST",
    expected: 201,
    body: {
      title: "Canvas Gallery Link Smoke",
      visibility: "private",
      dataJson: {
        nodes: [
          {
            id: "node_prompt",
            type: "prompt",
            x: 0,
            y: 0,
            data: {
              prompt: "A tiny smoke-test pixel",
              userEmail: email
            }
          },
          {
            id: "node_output",
            type: "output",
            x: 260,
            y: 0,
            data: {
              title: "Output",
              imageUrl: `/api/images/${generationId}/file`,
              generationId,
              sourceImageUrl: `/api/images/${generationId}/source-file`,
              sourceImageId: generationId
            }
          }
        ],
        edges: [{ id: "edge_prompt_output", sourceId: "node_prompt", targetId: "node_output" }]
      }
    }
  });
  createdCanvasId = created.canvas?.id || "";
  assert(createdCanvasId, "created canvas id missing");
}

async function seedPublishedGeneration() {
  await fs.mkdir(generatedDir, { recursive: true });
  await fs.mkdir(sourcesDir, { recursive: true });
  await fs.writeFile(path.join(generatedDir, filename), Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  ));
  await fs.writeFile(path.join(sourcesDir, sourceFilename), Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  ));
  const now = new Date();
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    await connection.execute(
      `INSERT INTO generations
        (id, user_id, prompt, model, size, quality, background, output_format, filename, source_filename, is_public, publish_original, conversation_json, public_tags_json, created_at, published_at)
       VALUES (?, ?, ?, 'smoke-model', '1024x1024', 'auto', 'auto', 'png', ?, ?, 1, 0, ?, ?, ?, ?)`,
      [
        generationId,
        userId,
        "[canvas] A tiny smoke-test pixel",
        filename,
        sourceFilename,
        JSON.stringify([{ id: "node_output", type: "canvas-output", prompt: "A tiny smoke-test pixel" }]),
        JSON.stringify(["text-to-image"]),
        now,
        now
      ]
    );
    await connection.execute(
      `INSERT INTO canvas_generation_links
        (canvas_id, generation_id, output_node_id, config_node_id, created_at)
       VALUES (?, ?, 'node_output', 'node_prompt', ?)`,
      [createdCanvasId, generationId, now]
    );
  } finally {
    await connection?.end().catch(() => {});
  }
}

async function cleanup() {
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    await connection.execute("DELETE FROM generations WHERE id = ?", [generationId]);
    await connection.execute("DELETE FROM users WHERE email IN (?, ?)", [email, copyEmail]);
    log("cleanup ok");
  } catch (error) {
    log("cleanup skipped:", error.message);
  } finally {
    await connection?.end().catch(() => {});
  }
  await fs.unlink(path.join(generatedDir, filename)).catch(() => {});
  await fs.unlink(path.join(sourcesDir, sourceFilename)).catch(() => {});
}

async function main() {
  log("base =", base);
  await authenticate();
  await createCanvasProject();
  await seedPublishedGeneration();

  const anonymousDetail = await request(`/api/gallery/${encodeURIComponent(generationId)}`, { auth: false });
  assert(anonymousDetail.generation?.id === generationId, "anonymous gallery detail id mismatch");
  assert(!anonymousDetail.generation?.canvasProject, "anonymous detail should not expose a private canvas link");

  const ownerDetail = await request(`/api/gallery/${encodeURIComponent(generationId)}`);
  assert(ownerDetail.generation?.canvasProject?.id === createdCanvasId, "owner gallery detail missing source canvas project");
  assert(ownerDetail.generation.canvasProject.outputNodeId === "node_output", "source canvas output node missing");
  assert(Array.isArray(ownerDetail.generation?.creativeRoute), "owner gallery detail missing creativeRoute");
  assert(ownerDetail.generation.creativeRoute.some((step) => step.nodeId === "node_prompt"), "creativeRoute should include source canvas prompt node");
  assert(ownerDetail.generation.creativeRoute.some((step) => step.nodeId === "node_output" && step.generationId === generationId), "creativeRoute should link output node to generation");
  assert(!JSON.stringify(ownerDetail.generation.creativeRoute).includes(email), "creativeRoute should scrub owner email metadata");

  const canvas = await request(`/api/canvases/${encodeURIComponent(ownerDetail.generation.canvasProject.id)}`);
  assert(canvas.canvas?.id === createdCanvasId, "source canvas project is not openable by owner");
  assert(canvas.canvas?.dataJson?.nodes?.[0]?.data?.userEmail === email, "owner source canvas should retain private owner metadata");

  await authenticateCopyUser();
  const copyUserDetail = await request(`/api/gallery/${encodeURIComponent(generationId)}`);
  assert(copyUserDetail.generation?.canvasProject?.id === createdCanvasId, "copy user gallery detail missing duplicable canvas route");
  assert(copyUserDetail.generation.canvasProject.canDuplicate === true, "copy user should be allowed to duplicate the public route");
  assert(copyUserDetail.generation.canvasProject.canOpenOriginal === false, "copy user should not open the private source canvas");
  assert(Array.isArray(copyUserDetail.generation?.creativeRoute), "copy user gallery detail missing creativeRoute");
  assert(!JSON.stringify(copyUserDetail.generation.creativeRoute).includes("/source-file"), "creativeRoute should not expose private source files to copy users");
  assert(!JSON.stringify(copyUserDetail.generation.creativeRoute).includes(copyEmail), "creativeRoute should not include viewer private metadata");
  await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}`, { expected: 404 });
  const duplicated = await request(`/api/canvases/${encodeURIComponent(createdCanvasId)}/duplicate`, {
    method: "POST",
    expected: 201,
    body: { title: "Copied public canvas route" }
  });
  assert(duplicated.canvas?.id && duplicated.canvas.id !== createdCanvasId, "duplicate canvas id missing or reused");
  assert(duplicated.canvas?.userId === copyUserId, "duplicated canvas should belong to the requesting user");
  assert(duplicated.canvas?.visibility === "private", "duplicated canvas should be private");
  assert(!duplicated.canvas?.dataJson?.nodes?.[0]?.data?.userEmail, "duplicated canvas should strip owner private metadata");
  const duplicatedOutput = duplicated.canvas?.dataJson?.nodes?.find((node) => node.id === "node_output");
  assert(duplicatedOutput?.data?.imageUrl === `/api/images/${generationId}/file`, "public generated image reference should be retained");
  assert(!duplicatedOutput?.data?.sourceImageUrl, "non-public source image URL should be stripped");
  assert(!duplicatedOutput?.data?.sourceImageId, "non-public source image id should be stripped");

  log("OK: public canvas route can be copied into a private canvas without leaking private source images");
}

main()
  .catch((error) => {
    console.error("[canvas-gallery-link-smoke] failed:", error?.stack || error);
    process.exitCode = 1;
  })
  .finally(cleanup);
