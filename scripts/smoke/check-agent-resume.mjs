#!/usr/bin/env node
// Static + optional live API smoke for AIS-RLS-152 Agent session resume capability.
//
// Scope:
//   - Assert agent_steps table has the columns required for resume (`status`, `request_id`,
//     `generation_id`, `kind`) and that today's routes persist status: "pending" for non
//     dry-run steps (so a future /resume endpoint can scan for unfinished steps).
//   - Assert session detail returns the steps array in order (the resume scan walks them).
//
// Forward-looking (depends on AIS-RLS-155):
//   - TODO 155: POST /api/agent-sessions/:id/resume should re-pickup the last `pending` /
//     `running` step row, re-enqueue its variant, and bump its status to running.
//   - TODO 155: resume must be idempotent on already-succeeded steps.
// Until 155 ships those code paths, this smoke locks in the schema + step-status invariants
// and emits TODO logs for the missing endpoint.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function log(...parts) {
  console.log("[agent-resume-smoke]", ...parts);
}

function staticChecks() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const stepsDdl = fs.readFileSync(path.join(rootDir, "packages/agent-core/schema/003-agent-steps.sql"), "utf8");
  const sessionStore = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/session-store.js"), "utf8");
  const routes = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");
  const interfaceMd = fs.readFileSync(path.join(rootDir, "packages/agent-core/INTERFACE.md"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-resume"], "node scripts/smoke/check-agent-resume.mjs", "root smoke:agent-resume script missing");

  // Schema: resume needs status + request_id + kind columns.
  assert(stepsDdl.includes("status VARCHAR(32) NOT NULL"), "agent_steps.status column required for resume scan");
  assert(stepsDdl.includes("request_id VARCHAR(64) NULL"), "agent_steps.request_id column required for resume binding");
  assert(stepsDdl.includes("generation_id VARCHAR(32) NULL"), "agent_steps.generation_id column required for resume binding");
  assert(stepsDdl.includes("kind VARCHAR(64) NOT NULL"), "agent_steps.kind column required for resume scan");
  assert(/INDEX\s+idx_agent_steps_session_created/.test(stepsDdl), "agent_steps must have (session_id, created_at) index so resume can scan in order");

  // Store contract: session detail must return ordered steps so the resume scan picks the
  // last pending/running step deterministically.
  assert(sessionStore.includes("agent_steps"), "session-store must read from agent_steps");
  assert(sessionStore.includes("ORDER BY"), "session-store must order step rows");

  // Routes today: pending status on non-dry-run steps is the resume marker.
  assert(routes.includes("status: result.dryRun ? \"skipped\" : \"pending\""), "routes must persist pending status for resume targeting");
  assert(routes.includes("requestId: request.id"), "routes must record requestId on each step for resume binding");

  // INTERFACE.md must declare the resume smoke so contract consumers know it's expected.
  assert(interfaceMd.includes("smoke:agent-resume"), "INTERFACE.md must enumerate the agent-resume smoke");

  // TODO AIS-RLS-155: resume endpoint not yet present in routes.
  const hasResumeRoute = routes.includes("/resume") || routes.includes("agent_session_resume");
  if (!hasResumeRoute) {
    log("TODO AIS-RLS-155: POST /api/agent-sessions/:id/resume endpoint not yet implemented (expected)");
  }
}

async function main() {
  staticChecks();
  log("ok (static-only; live resume path depends on AIS-RLS-155)");
}

main().catch((error) => {
  console.error("[agent-resume-smoke] ERROR:", error?.stack || error);
  process.exit(1);
});
