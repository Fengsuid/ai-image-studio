#!/usr/bin/env node
// Static guard for AIS-RLS-067 browser IndexedDB cache integration.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

const cacheDb = read("public/cache-db.js");
const indexHtml = read("public/index.html");
const buildManifest = JSON.parse(read("public/frontend-build-manifest.json"));
const app = read("public/app.js");
const appAuth = read("public/app-auth.js");
const canvas = read("public/canvas.js");
const agentApp = read("apps/agent-workspace/src/app/create-app.js");
const agentCache = read("apps/agent-workspace/src/adapters/cache-db.js");
const agentBuild = read("apps/agent-workspace/scripts/build.mjs");
const packageJson = JSON.parse(read("package.json"));

function scriptPosition(html, scriptName) {
  const plainIndex = html.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`))?.index ?? -1;
}

assert.equal(packageJson.scripts["smoke:indexeddb-cache-static"], "node scripts/smoke/check-indexeddb-cache-static.mjs", "root smoke script missing");

for (const token of [
  "openCacheDb",
  "putJsonSnapshot",
  "getJsonSnapshot",
  "putImageBlob",
  "getImageBlob",
  "pruneCache",
  "clearUserCache",
  "scrubForCache",
  "cacheImageUrl",
  "releaseImageObjectUrl",
  "unavailableReason",
  "setAvailabilityForTests"
]) {
  assert(cacheDb.includes(token), `cache-db.js missing ${token}`);
}

for (const store of ["jsonSnapshots", "imageBlobs", "userIndex"]) {
  assert(cacheDb.includes(store), `cache store ${store} missing`);
}

assert(cacheDb.includes("SENSITIVE_RE"), "sensitive field scrubber missing");
assert(cacheDb.includes("api[_-]?key"), "API key scrub guard missing");
assert(cacheDb.includes("password"), "password scrub guard missing");
assert(cacheDb.includes("secret"), "secret scrub guard missing");
assert(cacheDb.includes("/source-file"), "source-file image guard missing");
assert(cacheDb.includes("data:|blob:"), "blob/data URL guard missing");
assert(cacheDb.includes("lastAccessedAt"), "LRU access timestamp missing");
assert(cacheDb.includes("DEFAULT_MAX_BYTES"), "capacity limit missing");
assert(cacheDb.includes("URL.revokeObjectURL"), "cached image object URLs must be released");
assert(cacheDb.includes("MutationObserver"), "removed cached image nodes must be cleaned up");

const cacheScriptIndex = scriptPosition(indexHtml, "cache-db.js");
const appScriptIndex = scriptPosition(indexHtml, "app.js");
const lazyCanvasScripts = buildManifest.js?.lazyRoutes?.canvas?.scripts || [];
assert(cacheScriptIndex > -1, "index.html must load cache-db.js");
assert(lazyCanvasScripts.indexOf("/cache-db.js") > -1, "canvas lazy route must include cache-db.js");
assert(lazyCanvasScripts.indexOf("/cache-db.js") < lazyCanvasScripts.indexOf("/canvas.js"), "cache-db.js must load before lazy canvas.js");
assert(cacheScriptIndex < appScriptIndex, "cache-db.js must load before app.js");

assert(app.includes("gallery:${cleanId}:detail"), "gallery detail JSON snapshot key missing");
assert(app.includes("image:generation:${cleanId}:thumb"), "gallery thumbnail cache key missing");
assert(app.includes("preferCachedImage"), "gallery must prefer cached thumbnails");
assert(app.includes("gallery-thumb-refresh"), "gallery must refresh thumbnail cache in background");
assert(app.includes("cacheImageElement"), "gallery must save loaded thumbnails");
assert(app.includes("cachePreUploadImageMetadata"), "pre-upload metadata cache missing");
assert(app.includes("SHA-256"), "pre-upload metadata must include SHA-256 hashing");
assert(appAuth.includes("clearUserCache"), "logout cache clear missing");
assert(appAuth.includes("setCurrentCacheUser(null)"), "logout must clear current cache user");
assert(!/putJsonSnapshot\([^)]*password/i.test(app), "app must not cache passwords");
assert(!/putJsonSnapshot\([^)]*apiKey/i.test(app), "app must not cache API keys");

assert(canvas.includes("canvas:${projectId || \"new\"}:draft-snapshot"), "canvas draft snapshot key missing");
assert(canvas.includes("putJsonSnapshot"), "canvas must write IndexedDB draft snapshot");
assert(canvas.includes("readCachedDraft"), "canvas must read IndexedDB draft fallback");
assert(canvas.includes("localStorage?.setItem"), "canvas localStorage fallback should remain");

assert(agentCache.includes("agent:${sessionId}:snapshot"), "agent session snapshot key missing");
assert(agentCache.includes("putAgentSessionSnapshot"), "agent snapshot writer missing");
assert(agentCache.includes("getAgentSessionSnapshot"), "agent snapshot reader missing");
assert(agentApp.includes("putAgentSessionSnapshot"), "agent app must save read-only session snapshots");
assert(agentApp.includes("getAgentSessionSnapshot"), "agent app must try cached session snapshots");
assert(agentBuild.includes("/cache-db.js?v=20260523-indexeddb-cache-v1"), "agent page must load cache module");

console.log("[indexeddb-cache-static] ok");
