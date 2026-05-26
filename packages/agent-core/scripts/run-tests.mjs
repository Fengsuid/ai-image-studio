#!/usr/bin/env node
// Test runner wrapper: translates `--coverage` into Node's `--experimental-test-coverage` flag
// so `npm run test -- --coverage` works on Node 20.1+ without requiring callers to know the
// Node-specific flag name.

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const testsDir = path.resolve(packageRoot, "tests");

const userArgs = process.argv.slice(2);
const wantCoverage = userArgs.includes("--coverage");
const remainingArgs = userArgs.filter((arg) => arg !== "--coverage");

const testFiles = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join(testsDir, name));

if (!testFiles.length) {
  console.error("[agent-core/run-tests] no test files found in", testsDir);
  process.exit(1);
}

const nodeArgs = ["--test"];
if (wantCoverage) nodeArgs.push("--experimental-test-coverage");
nodeArgs.push(...testFiles, ...remainingArgs);

const child = spawn(process.execPath, nodeArgs, { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
