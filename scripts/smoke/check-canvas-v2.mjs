#!/usr/bin/env node
// Smoke test for the Canvas v2 shell and static SPA route.

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://localhost:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const failures = [];

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
    assert(appModule.body.includes("/api/health"), "Canvas v2 app module should initialize through /api/health");
    assert(appModule.body.includes("/api/auth/me"), "Canvas v2 app module should initialize auth and CSRF through /api/auth/me");

    const apiImport = appModule.body.match(/\bfrom\s*["'](\.{1,2}\/[^"']*ai-image-studio-api\.[a-f0-9]{12}\.js)["']/)?.[1] || "";
    assert(Boolean(apiImport), "Canvas v2 app module should import a hashed API adapter");
    const apiModulePath = relativeAssetPath(appModulePath, apiImport);
    const apiModule = await fetchText(apiModulePath, "application/javascript,*/*");
    assert(apiModule.status === 200, `${apiModulePath} should be served`);
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

async function main() {
  await checkCanvasV2Shell();
  await checkApiBoundaries();
  if (failures.length) {
    console.error(`[canvas-v2-smoke] FAILED: ${failures.length} assertion(s) failed`);
    process.exit(1);
  }
  console.log("[canvas-v2-smoke] OK: canvas v2 shell, assets, and API boundaries verified");
}

main().catch((error) => {
  console.error("[canvas-v2-smoke] crashed:", error?.stack || error);
  process.exit(2);
});
