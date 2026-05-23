#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { frontendBuildManifest } from "../../src/frontend/app-build-manifest.mjs";

const root = process.cwd();
const publicDir = path.join(root, "public");
const jsonPath = path.join(publicDir, "frontend-build-manifest.json");
const jsPath = path.join(publicDir, "frontend-build-manifest.js");
const manifestJson = JSON.stringify(frontendBuildManifest, null, 2);

const script = `(function initFrontendBuildManifest(global) {
  "use strict";

  const manifest = Object.freeze(${manifestJson});
  const register = global.AppModules && typeof global.AppModules.register === "function"
    ? global.AppModules.register
    : null;
  if (register) {
    register("build", manifest);
  } else {
    global.AppModules = global.AppModules || {};
    global.AppModules.build = manifest;
  }
})(window);
`;

await fs.writeFile(jsonPath, `${manifestJson}\n`, "utf8");
await fs.writeFile(jsPath, script, "utf8");

console.log(`[frontend-build] wrote ${path.relative(root, jsPath)} and ${path.relative(root, jsonPath)}`);
