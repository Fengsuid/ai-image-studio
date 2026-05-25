#!/usr/bin/env node
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const source = read("src/frontend/app-build-manifest.mjs");
const buildScript = read("scripts/frontend/build-public-modules.mjs");
const checkScript = read("scripts/frontend/check-public-modules.mjs");
const builtJs = read("public/frontend-build-manifest.js");
const builtJson = JSON.parse(read("public/frontend-build-manifest.json"));
const indexHtml = read("public/index.html");
const packageJson = JSON.parse(read("package.json"));
const dockerfilePath = path.join(root, "Dockerfile");
const dockerfile = fs.existsSync(dockerfilePath) ? fs.readFileSync(dockerfilePath, "utf8") : "";
const cssBundleEntry = builtJson.css?.entry || "";
const cssBundlePath = cssBundleEntry.startsWith("/") ? path.join(root, "public", cssBundleEntry.slice(1)) : "";
const jsAssets = Array.isArray(builtJson.js?.assets) ? builtJson.js.assets : [];
const jsAssetBySource = new Map(jsAssets.map((asset) => [asset.source, asset]));
const appJsEntry = jsAssetBySource.get("/app.js")?.entry || "";
const appModulesEntry = jsAssetBySource.get("/app-modules.js")?.entry || "";

assert(source.includes("export const frontendBuildManifest"), "frontend source must use standard export");
assert(buildScript.includes("from \"../../src/frontend/app-build-manifest.mjs\""), "build script must import frontend source module");
assert(buildScript.includes("buildCssBundle"), "build script must build the hashed CSS bundle");
assert(buildScript.includes("buildJsAssets"), "build script must build hashed JS assets");
assert(checkScript.includes("frontendBuildManifest"), "frontend check must validate source manifest");
assert(builtJs.includes("register(\"build\", manifest)"), "built JS must register AppModules.build");
assert(builtJson.version === "20260525-js-bundle-v1", "built manifest version mismatch");
assert(/^\/dist\/app\.[a-f0-9]{12}\.css$/.test(cssBundleEntry), "built manifest must expose hashed CSS bundle entry");
assert(fs.existsSync(cssBundlePath), "built manifest CSS bundle file must exist");
assert(
  createHash("sha256").update(fs.readFileSync(cssBundlePath)).digest("hex").slice(0, 12) === builtJson.css?.hash,
  "built manifest CSS hash must match file content"
);
assert(/^\/dist\/app\.[a-f0-9]{12}\.js$/.test(appJsEntry), "built manifest must expose hashed app.js entry");
assert(jsAssets.length >= 30, "built manifest must include hashed JS asset entries");
for (const asset of jsAssets) {
  assert(/^\/[a-z0-9-]+\.js$/.test(asset.source), `JS asset source must be a root public script: ${asset.source}`);
  assert(/^\/dist\/[a-z0-9-]+\.[a-f0-9]{12}\.js$/.test(asset.entry), `JS asset entry must be content-hashed: ${asset.entry}`);
  const assetPath = path.join(root, "public", asset.entry.slice(1));
  assert(fs.existsSync(assetPath), `hashed JS asset missing: ${asset.entry}`);
  assert(
    createHash("sha256").update(fs.readFileSync(assetPath)).digest("hex").slice(0, 12) === asset.hash,
    `JS asset hash must match file content: ${asset.entry}`
  );
}
assert(indexHtml.includes(`href="${cssBundleEntry}"`), "public index must load the manifest CSS bundle");
assert(indexHtml.includes(`src="${appJsEntry}"`), "public index must load hashed app.js");
assert(!indexHtml.includes("?v="), "public index must not use manual query-string cache busting");
assert(!indexHtml.includes('href="/styles.css'), "public index must not load styles.css directly");
assert(indexHtml.indexOf(appModulesEntry) < indexHtml.indexOf("/frontend-build-manifest.js"), "frontend manifest must load after app-modules.js");
assert(indexHtml.indexOf("/frontend-build-manifest.js") < indexHtml.indexOf(appJsEntry), "frontend manifest must load before app.js");
assert(packageJson.scripts?.["frontend:check"] === "node scripts/frontend/check-public-modules.mjs", "package.json must expose frontend:check");
assert(packageJson.scripts?.["frontend:build"] === "node scripts/frontend/build-public-modules.mjs", "package.json must expose frontend:build");
assert(packageJson.scripts?.["smoke:frontend-build-tooling"] === "node scripts/smoke/check-frontend-build-tooling.mjs", "package.json must expose smoke:frontend-build-tooling");
if (dockerfile) {
  assert(dockerfile.includes("COPY src ./src"), "Dockerfile must copy src for frontend source modules");
  assert(dockerfile.includes("COPY public ./public"), "Dockerfile must copy generated public frontend assets");
  assert(dockerfile.includes("COPY scripts ./scripts"), "Dockerfile must copy frontend build/smoke scripts");
}

if (failures.length) {
  console.error("[smoke] frontend build tooling failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[smoke] frontend build tooling checks passed");
