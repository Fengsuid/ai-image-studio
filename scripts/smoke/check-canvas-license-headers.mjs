#!/usr/bin/env node
// Verifies every canvas slice source file declares the AGPL-3.0 SPDX header.
// Scope: packages/canvas-core/** and apps/canvas-v2/** (UNLICENSED agent-core / agent-workspace are out of scope).

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HEADER = "SPDX-License-Identifier: AGPL-3.0-or-later";
const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const scanRoots = [
  join(rootDir, "packages", "canvas-core", "src"),
  join(rootDir, "packages", "canvas-core", "tests"),
  join(rootDir, "packages", "canvas-core", "scripts"),
  join(rootDir, "apps", "canvas-v2", "src"),
  join(rootDir, "apps", "canvas-v2", "scripts")
];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);
const EXT = new Set([".js", ".mjs", ".cjs"]);

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await collect(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    const dot = entry.name.lastIndexOf(".");
    if (dot < 0) continue;
    if (!EXT.has(entry.name.slice(dot))) continue;
    files.push(full);
  }
  return files;
}

const failures = [];
let scanned = 0;
for (const root of scanRoots) {
  let files;
  try {
    files = await collect(root);
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  for (const file of files) {
    scanned += 1;
    const head = (await readFile(file, "utf8")).slice(0, 200);
    if (!head.includes(HEADER)) failures.push(relative(rootDir, file));
  }
}

if (failures.length) {
  console.error(`[canvas-license-headers] FAIL — ${failures.length} of ${scanned} file(s) missing "${HEADER}":`);
  for (const file of failures) console.error(` - ${file}`);
  process.exit(1);
}

console.log(`[canvas-license-headers] OK: ${scanned} canvas slice file(s) carry AGPL header`);
