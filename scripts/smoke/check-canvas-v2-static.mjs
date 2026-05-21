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
const dockerfile = fs.readFileSync(path.join(rootDir, "Dockerfile"), "utf8");
const dockerignore = fs.readFileSync(path.join(rootDir, ".dockerignore"), "utf8");

assert.equal(packageJson.scripts["canvas:v2:check"], "npm run check --prefix apps/canvas-v2", "root canvas:v2:check script missing");
assert.equal(packageJson.scripts["canvas:v2:build"], "npm run build --prefix apps/canvas-v2", "root canvas:v2:build script missing");
assert.equal(packageJson.scripts["smoke:canvas-v2"], "node scripts/smoke/check-canvas-v2.mjs", "root smoke:canvas-v2 script missing");
assert.equal(packageJson.scripts["smoke:canvas-v2:static"], "node scripts/smoke/check-canvas-v2-static.mjs", "root smoke:canvas-v2:static script missing");
assert.equal(packageJson.scripts["smoke:canvas-v2:editor"], "node scripts/smoke/check-canvas-v2-editor.mjs", "root smoke:canvas-v2:editor script missing");
assert.equal(packageJson.scripts["smoke:canvas-v2:generation"], "node scripts/smoke/check-canvas-v2-generation.mjs", "root smoke:canvas-v2:generation script missing");
assert.equal(canvasPackage.scripts.check, "node scripts/check-syntax.mjs", "canvas-v2 check script missing");
assert.equal(canvasPackage.scripts.typecheck, "npm run check", "canvas-v2 typecheck script missing");
assert(canvasPackage.scripts.build.includes("node scripts/build.mjs"), "canvas-v2 build script missing");
assert(canvasPackage.scripts.build.includes("npm run check"), "canvas-v2 build should run check before writing public output");

assert(server.includes('pathname === "/canvas-v2" || pathname.startsWith("/canvas-v2/")'), "server must detect canvas-v2 SPA paths");
assert(server.includes('pathname.startsWith("/canvas-v2/assets/")'), "server must keep canvas-v2 assets on the static path");
assert(server.includes('"/canvas-v2/index.html"'), "server must serve canvas-v2 index for SPA routes");
assert(server.includes('path.join(PUBLIC_DIR, "canvas-v2", "index.html")'), "server fallback must read canvas-v2 index");

assert(dockerfile.includes("AS canvas-v2-build"), "Dockerfile must include an isolated Canvas v2 build stage");
assert(dockerfile.includes("npm run build --prefix apps/canvas-v2"), "Dockerfile must build Canvas v2 from source");
assert(dockerfile.includes("COPY --from=canvas-v2-build /app/public/canvas-v2 ./public/canvas-v2"), "Dockerfile must publish built Canvas v2 assets into public/canvas-v2");
assert(!dockerfile.includes("apps/canvas-v2/node_modules"), "Dockerfile must not copy apps/canvas-v2/node_modules");
assert(dockerignore.includes("apps/canvas-v2/node_modules"), ".dockerignore must exclude Canvas v2 node_modules");
assert(dockerignore.includes("docs/REMOTE_DEVELOPMENT_PRIVATE.md"), ".dockerignore must exclude private deployment notes");

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
assert(appModule.includes("getHealth"), "app module must initialize health through the API adapter");
assert(appModule.includes("getCurrentAuth"), "app module must initialize auth and csrf through the API adapter");
assert(appModule.includes("listCanvasProjects"), "app module must list canvas projects through the API adapter");
assert(appModule.includes("createCanvasProject"), "app module must create canvas projects");
assert(appModule.includes("updateCanvasProject"), "app module must save canvas projects");
assert(appModule.includes("deleteCanvasProject"), "app module must delete canvas projects");
assert(appModule.includes("installEditorController"), "app module must install Canvas v2 editor interactions");
assert(appModule.includes("generateCanvasOutput"), "app module must call backend canvas generation adapter");
assert(appModule.includes("saveCurrentCanvasForGeneration"), "app module must save before generation");

const apiImport = appModule.match(/\bfrom\s*["'](\.\.\/adapters\/ai-image-studio-api\.[a-f0-9]{12}\.js)["']/)?.[1] || "";
assert(apiImport, "app module must import hashed API adapter");
const apiModulePath = resolveAssetPath(appModulePath, apiImport);
const apiModule = fs.readFileSync(publicPath(apiModulePath), "utf8");
assert(apiModule.includes("/api/health"), "api adapter must expose /api/health");
assert(apiModule.includes("/api/auth/me"), "api adapter must expose /api/auth/me");
assert(apiModule.includes("/api/canvases?scope="), "api adapter must list canvas projects through /api/canvases");
assert(apiModule.includes('credentials: "same-origin"'), "api adapter must use same-origin credentials");
assert(apiModule.includes("X-CSRF-Token"), "api adapter must attach CSRF token on writes");
assert(apiModule.includes("POST"), "api adapter must expose POST writes");
assert(apiModule.includes("PATCH"), "api adapter must expose PATCH writes");
assert(apiModule.includes("DELETE"), "api adapter must expose DELETE writes");
assert(apiModule.includes("/generate"), "api adapter must expose backend canvas generate route");
assert(apiModule.includes("outputNodeId"), "api adapter must send output node selector");
assert(!apiModule.includes("openai.com"), "api adapter must not call OpenAI directly");
assert(!apiModule.includes("apiKey"), "api adapter must not handle provider API keys");
const shellImport = appModule.match(/\bfrom\s*["'](\.\/shell\.[a-f0-9]{12}\.js)["']/)?.[1] || "";
assert(shellImport, "app module must import hashed shell renderer");
const shellModule = fs.readFileSync(publicPath(resolveAssetPath(appModulePath, shellImport)), "utf8");
assert(shellModule.includes("data-canvas-action"), "shell module must render CRUD action controls");
assert(shellModule.includes("data-canvas-title-input"), "shell module must render title editing input");
assert(shellModule.includes("data-canvas-save-status"), "shell module must render save status");
assert(shellModule.includes("renderEditor"), "shell module must render the Canvas v2 editor");
const editorImport = shellModule.match(/\bfrom\s*["'](\.\.\/editor\/view\.[a-f0-9]{12}\.js)["']/)?.[1] || "";
assert(editorImport, "shell module must import hashed editor renderer");
const editorModule = fs.readFileSync(publicPath(resolveAssetPath(resolveAssetPath(appModulePath, shellImport), editorImport)), "utf8");
assert(editorModule.includes("data-canvas-editor"), "editor renderer must expose editor root");
assert(editorModule.includes("data-canvas-stage"), "editor renderer must expose stage");
assert(editorModule.includes("data-canvas-minimap"), "editor renderer must expose minimap");
assert(editorModule.includes("data-canvas-port"), "editor renderer must expose node ports");
assert(editorModule.includes("data-canvas-node-resize"), "editor renderer must expose resize handles");
assert(editorModule.includes("generate-output"), "editor renderer must expose output generation controls");
assert(editorModule.includes("data-canvas-output-status"), "editor renderer must expose output generation status");
assert(css.includes(".canvas-v2-shell"), "canvas-v2 CSS must style the shell");
assert(css.includes(".canvas-v2-project-list"), "canvas-v2 CSS must style project list");
assert(css.includes(".canvas-v2-editor-stage"), "canvas-v2 CSS must style editor stage");
assert(css.includes(".canvas-v2-node"), "canvas-v2 CSS must style editor nodes");
assert(css.includes(".canvas-v2-edge"), "canvas-v2 CSS must style editor edges");
assert(css.includes(".canvas-v2-minimap"), "canvas-v2 CSS must style minimap");

console.log("[canvas-v2-static-smoke] OK: scripts, route wiring, and build output verified");

function publicPath(pathname) {
  return path.join(rootDir, "public", pathname.replace(/^\/+/, ""));
}

function resolveAssetPath(fromPath, specifier) {
  return new URL(specifier, `http://canvas-v2-static.invalid${fromPath}`).pathname;
}
