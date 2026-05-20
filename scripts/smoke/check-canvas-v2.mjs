#!/usr/bin/env node
// Smoke test for the Canvas v2 shell and static SPA route.

import crypto from "node:crypto";
import mysql from "mysql2/promise";

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://localhost:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const failures = [];
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const owner = {
  email: `canvas-v2-owner-${runId}@example.invalid`,
  password: `CanvasV2Owner-${runId}!`,
  name: "Canvas v2 Owner Smoke",
};
const otherUser = {
  email: `canvas-v2-other-${runId}@example.invalid`,
  password: `CanvasV2Other-${runId}!`,
  name: "Canvas v2 Other Smoke",
};

function log(...parts) {
  console.log("[canvas-v2-smoke]", ...parts);
}

function fail(message) {
  failures.push(message);
  console.error("[canvas-v2-smoke] FAIL:", message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function fetchText(pathSuffix, accept = "text/plain,*/*") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathSuffix}`, {
      headers: { Accept: accept },
      signal: controller.signal,
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(pathSuffix) {
  const response = await fetchText(pathSuffix, "application/json,*/*");
  let body = null;
  try {
    body = response.body ? JSON.parse(response.body) : null;
  } catch {
    body = { _raw: response.body };
  }
  return { ...response, body };
}

function createSession() {
  return {
    jar: new Map(),
    csrfToken: "",
  };
}

function storeCookies(session, headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  for (const header of values) {
    const [pair] = String(header).split(";");
    const index = pair.indexOf("=");
    if (index > 0) session.jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function cookieHeader(session) {
  return [...session.jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function requestJson(session, pathSuffix, { method = "GET", body, expected = 200 } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (session.csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    headers["X-CSRF-Token"] = session.csrfToken;
  }
  const cookies = cookieHeader(session);
  if (cookies) headers.Cookie = cookies;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathSuffix}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    storeCookies(session, response.headers);
    const data = await response.json().catch(() => ({}));
    if (data.csrfToken) session.csrfToken = data.csrfToken;
    const expectedList = Array.isArray(expected) ? expected : [expected];
    if (!expectedList.includes(response.status)) {
      throw new Error(`${method} ${pathSuffix} expected ${expectedList.join("/")}, got ${response.status}: ${JSON.stringify(data)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio",
  };
}

function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(value, salt, iterations, 32, "sha256").toString("hex");
  return { salt, iterations, hash };
}

async function createActiveSmokeUser(user) {
  const passwordHash = hashPassword(user.password);
  const id = `usr_${crypto.randomBytes(10).toString("hex")}`;
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    const now = new Date();
    await connection.execute(
      `INSERT INTO users
        (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', 50, ?, ?)`,
      [id, user.name, user.email, passwordHash.salt, passwordHash.iterations, passwordHash.hash, now, now],
    );
  } finally {
    await connection?.end().catch(() => {});
  }
}

async function cleanupSmokeUsers() {
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    await connection.execute("DELETE FROM users WHERE email IN (?, ?)", [owner.email, otherUser.email]);
  } catch (error) {
    log("cleanup skipped:", error.message);
  } finally {
    await connection?.end().catch(() => {});
  }
}

async function loginSmokeUser(session, user) {
  await requestJson(session, "/api/auth/me");
  const data = await requestJson(session, "/api/auth/login", {
    method: "POST",
    body: { email: user.email, password: user.password },
  });
  assert(data.user?.email === user.email, `login email mismatch for ${user.email}`);
}

async function ensureActiveLogin(session, user) {
  await requestJson(session, "/api/auth/me");
  try {
    const result = await requestJson(session, "/api/auth/register", {
      method: "POST",
      expected: 201,
      body: { email: user.email, password: user.password, name: user.name },
    });
    if (result.pendingApproval) {
      await cleanupSmokeUsers();
      await createActiveSmokeUser(owner);
      await createActiveSmokeUser(otherUser);
      await loginSmokeUser(session, user);
    }
  } catch (error) {
    await cleanupSmokeUsers();
    await createActiveSmokeUser(owner);
    await createActiveSmokeUser(otherUser);
    await loginSmokeUser(session, user);
  }
}

async function ensureSmokeLogin(session, user) {
  try {
    await loginSmokeUser(session, user);
  } catch {
    await createActiveSmokeUser(user);
    await loginSmokeUser(session, user);
  }
}

function canvasV2Document(title) {
  return {
    schema: "ai-image-studio.canvas.v1",
    version: 1,
    title,
    viewport: { x: 12, y: 24, zoom: 1.15 },
    nodes: [
      { id: "text_smoke", type: "text", x: 80, y: 90, width: 260, height: 140, content: "Canvas v2 smoke text" },
      { id: "output_smoke", type: "output", x: 420, y: 160, width: 300, height: 180 },
    ],
    edges: [],
    meta: { source: "canvas-v2", updatedBy: "client" },
  };
}

function assetPathFrom(html, pattern, fallback) {
  return html.match(pattern)?.[1] || fallback;
}

function firstRelativeImport(source) {
  return source.match(/\bfrom\s*["'](\.{1,2}\/[^"']+\.js)["']/)?.[1] ||
    source.match(/\bimport\s*["'](\.{1,2}\/[^"']+\.js)["']/)?.[1] ||
    "";
}

function relativeAssetPath(fromPath, specifier) {
  return new URL(specifier, `http://canvas-v2-smoke.invalid${fromPath}`).pathname;
}

async function checkCanvasV2Shell() {
  log(`base = ${baseUrl}`);
  const shell = await fetchText("/canvas-v2", "text/html,*/*");
  assert(shell.status === 200, `/canvas-v2 status=${shell.status}`);
  assert(shell.headers.get("content-security-policy-report-only"), "/canvas-v2 missing CSP Report-Only header");
  assert(shell.headers.get("x-content-type-options") === "nosniff", "/canvas-v2 missing nosniff header");
  assert(shell.body.includes("Canvas v2"), "/canvas-v2 missing Canvas v2 marker");
  assert(shell.body.includes("data-canvas-v2-root"), "/canvas-v2 missing root mount");
  assert(shell.body.includes("/canvas-v2/assets/main."), "/canvas-v2 missing hashed JS asset");
  assert(shell.body.includes("/canvas-v2/assets/styles."), "/canvas-v2 missing hashed CSS asset");

  const nested = await fetchText("/canvas-v2/projects/example", "text/html,*/*");
  assert(nested.status === 200, `/canvas-v2/projects/example status=${nested.status}`);
  assert(nested.body.includes("data-canvas-v2-root"), "/canvas-v2 nested route should return SPA index");

  const dottedNested = await fetchText("/canvas-v2/projects/release.v1", "text/html,*/*");
  assert(dottedNested.status === 200, `/canvas-v2/projects/release.v1 status=${dottedNested.status}`);
  assert(dottedNested.body.includes("data-canvas-v2-root"), "/canvas-v2 dotted nested route should return SPA index");

  const jsPath = assetPathFrom(shell.body, /src="([^"]*\/canvas-v2\/assets\/main\.[^"]+\.js)"/, "");
  const cssPath = assetPathFrom(shell.body, /href="([^"]*\/canvas-v2\/assets\/styles\.[^"]+\.css)"/, "");
  assert(Boolean(jsPath), "/canvas-v2 JS asset path not found");
  assert(Boolean(cssPath), "/canvas-v2 CSS asset path not found");

  if (jsPath) {
    log(`GET ${jsPath}`);
    const js = await fetchText(jsPath, "application/javascript,*/*");
    assert(js.status === 200, `${jsPath} status=${js.status}`);
    assert((js.headers.get("content-type") || "").includes("javascript"), `${jsPath} content type should be JavaScript`);
    assert(/\bfrom\s*["']\.\/app\/create-app\.[a-f0-9]{12}\.js["']/.test(js.body), `${jsPath} should load a hashed Canvas v2 app module`);

    const appModulePath = relativeAssetPath(jsPath, firstRelativeImport(js.body));
    const appModule = await fetchText(appModulePath, "application/javascript,*/*");
    assert(appModule.status === 200, `${appModulePath} should be served`);
    assert(appModule.body.includes("getHealth"), "Canvas v2 app module should initialize health through the API adapter");
    assert(appModule.body.includes("getCurrentAuth"), "Canvas v2 app module should initialize auth and CSRF through the API adapter");
    assert(appModule.body.includes("listCanvasProjects"), "Canvas v2 app module should list projects through the API adapter");
    assert(appModule.body.includes("createCanvasProject"), "Canvas v2 app module should create projects through the API adapter");
    assert(appModule.body.includes("updateCanvasProject"), "Canvas v2 app module should save projects through the API adapter");
    assert(appModule.body.includes("deleteCanvasProject"), "Canvas v2 app module should delete projects through the API adapter");

    const apiImport = appModule.body.match(/\bfrom\s*["'](\.{1,2}\/[^"']*ai-image-studio-api\.[a-f0-9]{12}\.js)["']/)?.[1] || "";
    assert(Boolean(apiImport), "Canvas v2 app module should import a hashed API adapter");
    const apiModulePath = relativeAssetPath(appModulePath, apiImport);
    const apiModule = await fetchText(apiModulePath, "application/javascript,*/*");
    assert(apiModule.status === 200, `${apiModulePath} should be served`);
    assert(apiModule.body.includes("/api/health"), "Canvas v2 API adapter should expose /api/health");
    assert(apiModule.body.includes("/api/auth/me"), "Canvas v2 API adapter should expose /api/auth/me");
    assert(apiModule.body.includes("/api/canvases?scope="), "Canvas v2 API adapter should list projects through /api/canvases");
    assert(apiModule.body.includes("credentials: \"same-origin\""), "Canvas v2 API adapter should use same-origin credentials");
    assert(apiModule.body.includes("X-CSRF-Token"), "Canvas v2 API adapter should attach CSRF tokens for writes");
  }

  const missingAsset = await fetchText("/canvas-v2/assets/missing.js", "application/javascript,*/*");
  assert(missingAsset.status === 404, `/canvas-v2/assets/missing.js status=${missingAsset.status}, expected 404`);

  if (cssPath) {
    log(`GET ${cssPath}`);
    const css = await fetchText(cssPath, "text/css,*/*");
    assert(css.status === 200, `${cssPath} status=${css.status}`);
    assert((css.headers.get("content-type") || "").includes("text/css"), `${cssPath} content type should be CSS`);
    assert(css.body.includes(".canvas-v2-shell"), `${cssPath} should style the shell`);
  }
}

async function checkApiBoundaries() {
  const health = await fetchJson("/api/health");
  assert(health.status === 200, `/api/health status=${health.status}`);
  assert(health.body?.ok === true, "/api/health ok flag missing");

  const auth = await fetchJson("/api/auth/me");
  assert(auth.status === 200, `/api/auth/me status=${auth.status}`);
  assert("user" in (auth.body || {}), "/api/auth/me missing user field");
  assert(typeof auth.body?.csrfToken === "string", "/api/auth/me should return csrfToken");

  const canvases = await fetchJson("/api/canvases?scope=mine&limit=1");
  assert([401, 403].includes(canvases.status), `/api/canvases unauthenticated status=${canvases.status}, expected 401/403`);
}

async function checkAuthenticatedCrud() {
  const ownerSession = createSession();
  let canvasId = "";

  try {
    await ensureActiveLogin(ownerSession, owner);
    const title = `Canvas v2 CRUD Smoke ${runId}`;
    const document = canvasV2Document(title);
    const created = await requestJson(ownerSession, "/api/canvases", {
      method: "POST",
      expected: 201,
      body: {
        title,
        visibility: "private",
        dataJson: document,
        nodeCount: document.nodes.length,
        edgeCount: document.edges.length,
      },
    });
    canvasId = created.canvas?.id || "";
    assert(canvasId, "created canvas id missing");
    assert(created.canvas?.dataJson?.schema === "ai-image-studio.canvas.v1", "created canvas schema mismatch");
    assert(created.canvas?.dataJson?.meta?.source === "canvas-v2", "created canvas source mismatch");

    const listed = await requestJson(ownerSession, "/api/canvases?scope=mine&limit=50");
    assert(Array.isArray(listed.canvases), "canvas list missing canvases array");
    assert(listed.canvases.some((canvas) => canvas.id === canvasId), "created canvas missing from mine list");

    const updatedTitle = `${title} Updated`;
    const updatedDocument = {
      ...document,
      title: updatedTitle,
      viewport: { x: 44, y: 88, zoom: 1.4 },
      nodes: [
        ...document.nodes,
        { id: "text_smoke_2", type: "text", x: 120, y: 260, width: 260, height: 140, content: "Saved by Canvas v2 smoke" },
      ],
    };
    const updated = await requestJson(ownerSession, `/api/canvases/${encodeURIComponent(canvasId)}`, {
      method: "PATCH",
      body: {
        title: updatedTitle,
        visibility: "private",
        dataJson: updatedDocument,
        nodeCount: updatedDocument.nodes.length,
        edgeCount: updatedDocument.edges.length,
      },
    });
    assert(updated.canvas?.title === updatedTitle, "updated canvas title mismatch");
    assert(updated.canvas?.dataJson?.nodes?.length === 3, "updated canvas node count mismatch");

    const loaded = await requestJson(ownerSession, `/api/canvases/${encodeURIComponent(canvasId)}`);
    assert(loaded.canvas?.dataJson?.viewport?.x === 44, "loaded canvas viewport did not persist");
    assert(loaded.canvas?.dataJson?.nodes?.some((node) => node.id === "text_smoke_2"), "loaded canvas missing saved node");

    const exported = await requestJson(ownerSession, `/api/canvases/${encodeURIComponent(canvasId)}/export`);
    assert(exported.format === "ai-image-studio.canvas.v1", "export schema mismatch");
    assert(exported.canvas?.dataJson?.meta?.source === "canvas-v2", "export should preserve canvas-v2 source");

    const otherSession = createSession();
    await ensureSmokeLogin(otherSession, otherUser);
    await requestJson(otherSession, `/api/canvases/${encodeURIComponent(canvasId)}`, { expected: 404 });

    await requestJson(ownerSession, `/api/canvases/${encodeURIComponent(canvasId)}`, {
      method: "DELETE",
    });
    await requestJson(ownerSession, `/api/canvases/${encodeURIComponent(canvasId)}`, { expected: 404 });

    log("authenticated CRUD ok:", canvasId);
  } finally {
    await cleanupSmokeUsers();
  }
}

async function main() {
  await checkCanvasV2Shell();
  await checkApiBoundaries();
  await checkAuthenticatedCrud();
  if (failures.length) {
    console.error(`[canvas-v2-smoke] FAILED: ${failures.length} assertion(s) failed`);
    process.exit(1);
  }
  console.log("[canvas-v2-smoke] OK: canvas v2 shell, assets, API boundaries, and CRUD verified");
}

main().catch((error) => {
  console.error("[canvas-v2-smoke] crashed:", error?.stack || error);
  process.exit(2);
});
