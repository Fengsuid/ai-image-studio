#!/usr/bin/env node
// Static smoke for AIS-RLS-158 migrations directory consolidation.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

const packageJson = JSON.parse(read("package.json"));
const migrationsSource = read("migrations/index.js");
const jobsSource = read("migrations/jobs/index.js");
const orphanJobSource = read("migrations/jobs/orphan-images-cleanup.js");
const softDeleteJobSource = read("migrations/jobs/soft-delete-cleanup.js");
const mysqlStore = read("src/mysql-store.js");
const server = read("server.js");
const canvasInterface = read("packages/canvas-core/INTERFACE.md");
const agentInterface = read("packages/agent-core/INTERFACE.md");
const migrations = require(path.join(rootDir, "migrations"));
const migrationJobs = require(path.join(rootDir, "migrations/jobs"));

assert.equal(packageJson.scripts["smoke:migrations-consolidation"], "node scripts/smoke/check-migrations-consolidation.mjs", "root smoke:migrations-consolidation script missing");
assert.equal(typeof migrations.runAll, "function", "migrations.runAll must be exported");
assert.equal(typeof migrations.listSchemaFiles, "function", "migrations.listSchemaFiles must be exported");
assert.deepEqual(migrations.SLICE_MIGRATIONS.map((item) => item.name), ["canvas-core", "agent-core"], "slice migration order must be canvas-core then agent-core");
assert(migrations.listSchemaFiles().some((file) => file.endsWith("packages\\canvas-core\\schema\\001-canvas-projects.sql") || file.endsWith("packages/canvas-core/schema/001-canvas-projects.sql")), "canvas schema files must be listed");
assert(migrations.listSchemaFiles().some((file) => file.endsWith("packages\\agent-core\\schema\\001-agent-sessions.sql") || file.endsWith("packages/agent-core/schema/001-agent-sessions.sql")), "agent schema files must be listed");
assert(migrationsSource.includes('require("@ai-image-studio/canvas-core")'), "migrations must load canvas-core");
assert(migrationsSource.includes('require("@ai-image-studio/agent-core")'), "migrations must load agent-core");
assert(migrationsSource.includes(".filter((name) => name.endsWith(\".sql\"))"), "migrations must enumerate slice .sql files");
assert(migrationsSource.includes("await slice.applySchema(connection)"), "migrations must execute each slice applySchema");

assert(mysqlStore.includes('const migrations = require("../migrations");'), "mysql-store must require top-level migrations");
assert(mysqlStore.includes("await migrations.runAll(db);"), "mysql-store init must call migrations.runAll(db)");
assert(!mysqlStore.includes("await canvasCore.applySchema(db);"), "mysql-store must not call canvasCore.applySchema directly");
assert(!mysqlStore.includes("await agentCore.applySchema(db);"), "mysql-store must not call agentCore.applySchema directly");
assert(!/CREATE TABLE IF NOT EXISTS\s+canvas_/i.test(mysqlStore), "mysql-store must not hold canvas table DDL");
assert(!/CREATE TABLE IF NOT EXISTS\s+agent_/i.test(mysqlStore), "mysql-store must not hold agent table DDL");

assert.equal(typeof migrationJobs.runMaintenanceJobs, "function", "migrations/jobs must export runMaintenanceJobs");
assert(jobsSource.includes("runOrphanImageCleanup"), "jobs index must call orphan image cleanup");
assert(jobsSource.includes("runSoftDeleteCleanup"), "jobs index must call soft-delete cleanup");
assert(orphanJobSource.includes("runOrphanImageCleanup"), "orphan image cleanup job missing");
assert(orphanJobSource.includes("SELECT filename, source_filename FROM generations"), "orphan image job must read generation image references");
assert(orphanJobSource.includes("SELECT stored_filename FROM reference_assets"), "orphan image job must read reference asset filenames");
assert(softDeleteJobSource.includes("runSoftDeleteCleanup"), "soft-delete cleanup job missing");
assert(softDeleteJobSource.includes("DELETE FROM agent_steps WHERE deleted_at"), "soft-delete job must clean agent steps");
assert(softDeleteJobSource.includes("DELETE FROM agent_sessions WHERE deleted_at"), "soft-delete job must clean agent sessions");
assert(mysqlStore.includes("runMaintenanceJobs"), "mysql-store facade must expose runMaintenanceJobs");
assert(server.includes("scheduleMaintenanceJobs"), "server must schedule maintenance jobs");
assert(server.includes("setInterval(run, MAINTENANCE_JOBS_INTERVAL_MS)"), "server maintenance scheduler must use setInterval");
assert(server.includes("7 * 24 * 60 * 60 * 1000"), "server maintenance scheduler must default to 7 days");
assert(server.includes("MAINTENANCE_JOBS_RUN_ON_START"), "server must support optional run-on-start maintenance");

for (const name of ["001-", "002-", "003-"]) {
  assert(canvasInterface.includes("schema/") && canvasInterface.includes(name), `canvas INTERFACE.md must register ${name} schema files`);
  assert(agentInterface.includes("schema/") && agentInterface.includes(name), `agent INTERFACE.md must register ${name} schema files`);
}

console.log("[migrations-consolidation-smoke] ok");
