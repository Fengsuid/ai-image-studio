#!/usr/bin/env node
// Static guard for Canvas v2 build output and server route wiring.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const canvasPackage = JSON.parse(fs.readFileSync(path.join(rootDir, "apps/canvas-v2/package.json"), "utf8"));
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/canvas-v2/index.html"), "utf8");

assert.equal(packageJson.scripts["canvas:v2:check"], "npm run check --prefix apps/canvas-v2", "root canvas:v2:check script missing");
assert.equal(packageJson.scripts["canvas:v2:build"], "npm run build --prefix apps/canvas-v2", "root canvas:v2:build script missing");
assert.equal(packageJson.scripts["smoke:canvas-v2"], "node scripts/smoke/check-canvas-v2.mjs", "root smoke:canvas-v2 script missing");
assert.equal(packageJson.scripts["smoke:canvas-v2:static"], "node scripts/smoke/check-canvas-v2-static.mjs", "root smoke:canvas-v2:static script missing");
assert.equal(canvasPackage.scripts.check, "node scripts/check-syntax.mjs", "canvas-v2 check script missing");
assert.equal(canvasPackage.scripts.typecheck, "npm run check", "canvas-v2 typecheck script missing");
assert(canvasPackage.scripts.build.includes("node scripts/build.mjs"), "canvas-v2 build script missing");
assert(canvasPackage.scripts.build.includes("npm run check"), "canvas-v2 build should run check before writing public output");

assert(server.includes('pathname === "/canvas-v2" || pathname.startsWith("/canvas-v2/")'), "server must detect canvas-v2 SPA paths");
assert(server.includes('pathname.startsWith("/canvas-v2/assets/")'), "server must keep canvas-v2 assets on the static path");
assert(server.includes('"/canvas-v2/index.html"'), "server must serve canvas-v2 index for SPA routes");
assert(server.includes('path.join(PUBLIC_DIR, "canvas-v2", "index.html")'), "server fallback must read canvas-v2 index");

const jsPath = indexHtml.match(/src="([^"]*\/canvas-v2\/assets\/main\.[^"]+\.js)"/)?.[1] || "";
const cssPath = indexHtml.match(/href="([^"]*\/canvas-v2\/assets\/styles\.[^"]+\.css)"/)?.[1] || "";
assert(jsPath, "canvas-v2 index must reference hashed JS");
assert(cssPath, "canvas-v2 index must reference hashed CSS");
assert(indexHtml.includes("data-canvas-v2-root"), "canvas-v2 index must expose root mount");

const js = fs.readFileSync(publicPath(jsPath), "utf8");
const css = fs.readFileSync(publicPath(cssPath), "utf8");

const appImport = js.match(/\bfrom\s*["'](\.\/app\/create-app\.[a-f0-9]{12}\.js)["']/)?.[1] || "";
assert(appImport, "main bundle must import hashed app shell");
const appModulePath = resolveAssetPath(jsPath, appImport);
const appModule = fs.readFileSync(publicPath(appModulePath), "utf8");
assert(appModule.includes("/api/health"), "app module must call /api/health");
assert(appModule.includes("/api/auth/me"), "app module must call /api/auth/me for auth and csrf");

const apiImport = appModule.match(/\bfrom\s*["'](\.\.\/adapters\/ai-image-studio-api\.[a-f0-9]{12}\.js)["']/)?.[1] || "";
assert(apiImport, "app module must import hashed API adapter");
const apiModulePath = resolveAssetPath(appModulePath, apiImport);
const apiModule = fs.readFileSync(publicPath(apiModulePath), "utf8");
assert(apiModule.includes('credentials: "same-origin"'), "api adapter must use same-origin credentials");
assert(apiModule.includes("X-CSRF-Token"), "api adapter must attach CSRF token on writes");
assert(css.includes(".canvas-v2-shell"), "canvas-v2 CSS must style the shell");

console.log("[canvas-v2-static-smoke] OK: scripts, route wiring, and build output verified");

function publicPath(pathname) {
  return path.join(rootDir, "public", pathname.replace(/^\/+/, ""));
}

function resolveAssetPath(fromPath, specifier) {
  return new URL(specifier, `http://canvas-v2-static.invalid${fromPath}`).pathname;
}
