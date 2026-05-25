#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { frontendBuildManifest } from "../../src/frontend/app-build-manifest.mjs";
import { buildCssBundle } from "./css-bundle.mjs";

const root = process.cwd();
const publicDir = path.join(root, "public");
const jsonPath = path.join(publicDir, "frontend-build-manifest.json");
const jsPath = path.join(publicDir, "frontend-build-manifest.js");
const cssBundle = await buildCssBundle({ root });
const buildManifest = {
  ...frontendBuildManifest,
  css: {
    ...frontendBuildManifest.css,
    entry: cssBundle.entry,
    file: cssBundle.entry,
    hash: cssBundle.hash,
    bytes: cssBundle.bytes,
    sources: cssBundle.sources.map((source) => source.publicPath)
  }
};
const manifestJson = JSON.stringify(buildManifest, null, 2);

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

console.log(
  `[frontend-build] wrote ${path.relative(root, jsPath)}, ${path.relative(root, jsonPath)} and ${cssBundle.entry}`
);
