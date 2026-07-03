#!/usr/bin/env node

import fs from "fs";
import path from "path";

const root = process.cwd();
const files = {
  mysqlStore: path.join(root, "src", "mysql-store.js"),
  promptStore: path.join(root, "src", "stores", "prompt-store.js"),
  canvasStore: path.join(root, "packages", "canvas-core", "src", "store.js")
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")])
);

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), `${label} missing ${needle}`);
}

function assertExcludes(text, pattern, label) {
  assert(!pattern.test(text), `${label} should not match ${pattern}`);
}

function lineNumbersMatching(text, pattern) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ number }) => number);
}

assertIncludes(source.mysqlStore, 'const createPromptStore = require("./stores/prompt-store");', "mysql-store");
assertIncludes(source.mysqlStore, 'const canvasCore = require("@ai-image-studio/canvas-core");', "mysql-store");
assertIncludes(source.mysqlStore, "const { createCanvasStore } = canvasCore;", "mysql-store");
assertIncludes(source.mysqlStore, 'const migrations = require("../migrations");', "mysql-store");
assertIncludes(source.mysqlStore, "await migrations.runAll(db);", "mysql-store");
assert(!source.mysqlStore.includes("await canvasCore.applySchema(db);"), "mysql-store must not call canvasCore.applySchema directly after AIS-RLS-158");
assertIncludes(source.mysqlStore, "const promptStore = createPromptStore({ getPool, toIso });", "mysql-store");
assertIncludes(source.mysqlStore, "const canvasStore = createCanvasStore({ getPool, toIso, mapGeneration });", "mysql-store");

for (const exportName of [
  "listPrompts",
  "getPromptById",
  "setPromptLike",
  "incrementPromptUse",
  "listPromptImageLeaderboard",
  "listPromptSources",
  "createPromptSyncRun",
  "listPromptDuplicateCandidates",
  "createPromptAuditRecord"
]) {
  assertIncludes(source.mysqlStore, `${exportName}: promptStore.${exportName}`, "mysql-store exports");
}

for (const exportName of [
  "getCanvasProjectForGeneration",
  "getPublicGenerationForCanvas",
  "listCanvasProjectsForUser",
  "getCanvasProjectById",
  "createCanvasProject",
  "updateCanvasProject",
  "deleteCanvasProject",
  "createCanvasGenerationLinks"
]) {
  assertIncludes(source.mysqlStore, `${exportName}: canvasStore.${exportName}`, "mysql-store exports");
}

for (const pattern of [
  /function\s+mapPrompt\s*\(/,
  /async function\s+listPrompts\s*\(/,
  /async function\s+getPromptById\s*\(/,
  /async function\s+createPrompt\s*\(/,
  /async function\s+listPromptImageLeaderboard\s*\(/,
  /function\s+mapCanvasProject\s*\(/,
  /async function\s+listCanvasProjectsForUser\s*\(/,
  /async function\s+createCanvasProject\s*\(/,
  /async function\s+createCanvasGenerationLinks\s*\(/
]) {
  assertExcludes(source.mysqlStore, pattern, "mysql-store");
}

const promptSchemaRanges = [
  [1040, 1410]
];
const rootPromptTableRefs = lineNumbersMatching(
  source.mysqlStore,
  /\b(prompts|prompt_sources|prompt_sync_runs|prompt_likes|prompt_duplicate_candidates|prompt_audit_records)\b/
).filter((lineNumber) => {
  const line = source.mysqlStore.split(/\r?\n/)[lineNumber - 1] || "";
  return !/label:\s*"prompts"/.test(line);
});
for (const line of rootPromptTableRefs) {
  assert(
    promptSchemaRanges.some(([start, end]) => line >= start && line <= end),
    `mysql-store prompt table reference at line ${line} should stay in schema/migration ranges`
  );
}

const canvasTableRefsInMysqlStore = lineNumbersMatching(
  source.mysqlStore,
  /\b(canvas_projects|canvas_generation_links)\b/
);
assert(
  canvasTableRefsInMysqlStore.length === 0,
  `mysql-store should not reference canvas_projects/canvas_generation_links any more — found at lines ${canvasTableRefsInMysqlStore.join(", ")}`
);

for (const needle of [
  "function createPromptStore({ getPool, toIso })",
  "function mapPrompt(row)",
  "async function listPrompts",
  "async function listPromptImageLeaderboard",
  "async function listPromptSources",
  "async function scanPromptDuplicateCandidates",
  "async function createPromptAuditRecord"
]) {
  assertIncludes(source.promptStore, needle, "prompt-store");
}

for (const needle of [
  "function createCanvasStore({ getPool, toIso, mapGeneration })",
  "function mapCanvasProject",
  "function normalizeCanvasProjectInput",
  "async function getPublicGenerationForCanvas",
  "async function listCanvasProjectsForUser",
  "async function createCanvasProject",
  "async function createCanvasGenerationLinks"
]) {
  assertIncludes(source.canvasStore, needle, "canvas-store");
}

assertIncludes(source.canvasStore, "module.exports = {", "canvas-store named exports");
assertIncludes(source.canvasStore, "createCanvasStore", "canvas-store named exports");
assertIncludes(source.canvasStore, "SPDX-License-Identifier: AGPL-3.0-or-later", "canvas-store AGPL header");

for (const [label, text] of Object.entries({ promptStore: source.promptStore, canvasStore: source.canvasStore })) {
  assertExcludes(text, /require\(["']mysql2\/promise["']\)/, label);
  assertExcludes(text, /\b(req|res|next)\b/, label);
  assertExcludes(text, /\b(express|router)\b/i, label);
}

if (failures.length) {
  console.error("[prompt-canvas-store-split] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[prompt-canvas-store-split] ok");
