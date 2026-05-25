#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");

const files = [
  "index.js",
  "src/generation-service.js",
  "src/planner.js",
  "src/routes.js",
  "src/session-store.js",
  "src/schema-runner.js"
];

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", path.join(packageRoot, file)], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`[agent-core:check] FAIL ${file}`);
  }
}

if (failed) {
  console.error(`[agent-core:check] ${failed} file(s) failed syntax check`);
  process.exit(1);
}

console.log("[agent-core:check] OK");
