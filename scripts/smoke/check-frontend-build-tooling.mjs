#!/usr/bin/env node
import fs from "node:fs";
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

assert(source.includes("export const frontendBuildManifest"), "frontend source must use standard export");
assert(buildScript.includes("from \"../../src/frontend/app-build-manifest.mjs\""), "build script must import frontend source module");
assert(checkScript.includes("frontendBuildManifest"), "frontend check must validate source manifest");
assert(builtJs.includes("register(\"build\", manifest)"), "built JS must register AppModules.build");
assert(builtJson.version === "20260523-frontend-tooling-v1", "built manifest version mismatch");
assert(indexHtml.indexOf("/app-modules.js") < indexHtml.indexOf("/frontend-build-manifest.js"), "frontend manifest must load after app-modules.js");
assert(indexHtml.indexOf("/frontend-build-manifest.js") < indexHtml.indexOf("/app.js"), "frontend manifest must load before app.js");
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
