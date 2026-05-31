#!/usr/bin/env node
// Static and route-level smoke for AIS-RLS-125 frontend error monitoring.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function scriptIndex(html, scriptName) {
  const plain = html.indexOf(`/${scriptName}`);
  if (plain >= 0) return plain;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`));
  return match?.index ?? -1;
}

function manifestAsset(manifest, source) {
  return (manifest.js?.assets || []).find((asset) => asset.source === source) || null;
}

async function checkHealthRoute() {
  const { createHealthRoute } = require(path.join(root, "src/routes/health.js"));
  const writes = [];
  const rumEvents = [];
  const bodies = [
    {
      "csp-report": {
        "document-uri": "https://example.invalid/",
        "violated-directive": "script-src",
        "blocked-uri": "inline",
        "line-number": 7,
        "column-number": 11,
        "script-sample": "alert(1)"
      }
    },
    {
      kind: "client_error",
      message: "Smoke client error",
      source: "/dist/app.smoke.js",
      line: 12,
      column: 34,
      stack: "Error: Smoke client error\n    at smoke",
      path: "/",
      routeSource: "admin",
      sessionId: "cem_smoke",
      userAgent: "body-user-agent"
    }
  ];
  let readCount = 0;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...parts) => warnings.push(parts.join(" "));
  try {
    const route = createHealthRoute({
      appVersion: "smoke-version",
      imageDownloadTimeoutMs: 30_000,
      nowIso: () => "2026-06-01T00:00:00.000Z",
      openaiFetchTimeoutMs: 120_000,
      publicSettings: () => ({}),
      readJsonBody: async () => bodies[readCount++] || {},
      rumEvents,
      sendJson: (res, status, payload) => writes.push({ status, payload }),
      sendNoContent: () => writes.push({ status: 204 }),
      serverStartedAt: "2026-06-01T00:00:00.000Z",
      store: {
        countUsers: async () => 1,
        getDefaultProviderConfig: async () => ({}),
        getSettings: async () => ({})
      }
    });

    const cspReq = {
      method: "POST",
      headers: {
        "user-agent": "smoke-agent",
        "cf-connecting-ip": "127.0.0.1"
      },
      socket: {}
    };
    assert.equal(await route(cspReq, {}, new URL("http://local/api/csp-report")), true);
    assert.equal(writes.at(-1).status, 204);
    assert.equal(rumEvents.at(-1).name, "csp_report");
    assert.equal(rumEvents.at(-1).detail.userAgent, "smoke-agent");

    const errorReq = {
      method: "POST",
      headers: {
        "user-agent": "smoke-agent",
        "x-forwarded-for": "127.0.0.2"
      },
      socket: {}
    };
    assert.equal(await route(errorReq, {}, new URL("http://local/api/client-error")), true);
    assert.equal(writes.at(-1).status, 204);
    assert.equal(rumEvents.length, 2);
    assert.equal(rumEvents.at(-1).name, "client_error");
    assert.equal(rumEvents.at(-1).detail.message, "Smoke client error");
    assert.equal(rumEvents.at(-1).detail.source, "/dist/app.smoke.js");
    assert.equal(rumEvents.at(-1).detail.line, 12);
    assert.equal(rumEvents.at(-1).detail.column, 34);
    assert.match(rumEvents.at(-1).detail.stack, /Smoke client error/);
    assert.equal(rumEvents.at(-1).detail.userAgent, "smoke-agent");
    assert.equal(rumEvents.at(-1).detail.routeSource, "admin");
    assert(warnings.some((line) => line.includes("[client-error]")), "client errors should be logged");
  } finally {
    console.warn = originalWarn;
  }
}

function checkSourceAndDist() {
  check(exists("public/client-error-monitor.js"), "public/client-error-monitor.js must exist");
  const monitor = read("public/client-error-monitor.js");
  check(Buffer.byteLength(monitor) > 500, "client-error monitor must not be a stub");
  for (const snippet of [
    'const endpoint = "/api/client-error"',
    'global.addEventListener("error"',
    "unhandledrejection",
    "navigator.sendBeacon",
    "global.fetch?.(endpoint",
    "const throttleMs = 10_000",
    "sessionId",
    "HTMLScriptElement",
    "lazy_script_error",
    "ImageStudioClientErrorMonitor"
  ]) {
    check(monitor.includes(snippet), `client-error monitor missing ${snippet}`);
  }

  const health = read("src/routes/health.js");
  for (const snippet of [
    'url.pathname === "/api/client-error"',
    'url.pathname === "/api/csp-report"',
    "pushRumEvent",
    "rumEvents.push",
    "[client-error]",
    "userAgent",
    "line",
    "column",
    "stack"
  ]) {
    check(health.includes(snippet), `health route missing ${snippet}`);
  }

  const csrf = read("src/middleware/csrf.js");
  check(csrf.includes('/api/client-error'), "CSRF middleware must exempt /api/client-error");

  const router = read("public/app-router.js");
  check(router.includes("reportRouteLoadError"), "app-router must report lazy route load errors");
  check(router.includes("lazy_route_error"), "app-router must classify lazy route errors");
  check(router.includes("ImageStudioClientErrorMonitor"), "app-router must use the client error monitor");
  check(router.includes("script.dataset.routeSource"), "app-router must tag injected scripts with routeSource");

  const indexHtml = read("public/index.html");
  const adminHtml = read("public/admin.html");
  check(scriptIndex(indexHtml, "client-error-monitor.js") >= 0, "public index must load client-error-monitor.js");
  check(scriptIndex(indexHtml, "client-error-monitor.js") < scriptIndex(indexHtml, "app-router.js"), "public index must load monitor before app-router");
  check(scriptIndex(indexHtml, "client-error-monitor.js") < scriptIndex(indexHtml, "app.js"), "public index must load monitor before app.js");
  check(adminHtml.includes("/client-error-monitor.js"), "admin must load client-error-monitor.js");
  check(scriptIndex(adminHtml, "client-error-monitor.js") < scriptIndex(adminHtml, "app-router.js"), "admin must load monitor before app-router");

  const manifest = JSON.parse(read("public/frontend-build-manifest.json"));
  const asset = manifestAsset(manifest, "/client-error-monitor.js");
  check(Boolean(asset), "frontend manifest must include /client-error-monitor.js");
  if (asset) {
    check(/^\/dist\/client-error-monitor\.[a-f0-9]{12}\.js$/.test(asset.entry), "client-error monitor must have a hashed dist entry");
    check(indexHtml.includes(`src="${asset.entry}"`), "public index must load hashed client-error-monitor dist");
    const distPath = path.join("public", asset.entry.slice(1));
    check(exists(distPath), `hashed client-error monitor dist missing: ${asset.entry}`);
    if (exists(distPath)) {
      const dist = read(distPath);
      for (const snippet of ["/api/client-error", "unhandledrejection", "lazy_script_error", "sendBeacon"]) {
        check(dist.includes(snippet), `hashed client-error monitor missing ${snippet}`);
      }
    }
  }
}

try {
  checkSourceAndDist();
  await checkHealthRoute();
} catch (error) {
  fail(error?.stack || String(error));
}

if (failures.length) {
  console.error("[smoke] client error monitoring failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[smoke] client error monitoring checks passed");
