#!/usr/bin/env node
// Static smoke for AIS-RLS-155 Agent session resume capability.
// Verifies schema, ordered timeline detail, POST /resume, store status updates,
// and frontend resume controls.

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
  const sessionsDdl = fs.readFileSync(path.join(rootDir, "packages/agent-core/schema/001-agent-sessions.sql"), "utf8");
  const messagesDdl = fs.readFileSync(path.join(rootDir, "packages/agent-core/schema/002-agent-messages.sql"), "utf8");
  const stepsDdl = fs.readFileSync(path.join(rootDir, "packages/agent-core/schema/003-agent-steps.sql"), "utf8");
  const outputsDdl = fs.readFileSync(path.join(rootDir, "packages/agent-core/schema/005-agent-step-outputs.sql"), "utf8");
  const schemaRunner = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/schema-runner.js"), "utf8");
  const sessionStore = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/session-store.js"), "utf8");
  const service = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/generation-service.js"), "utf8");
  const routes = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");
  const interfaceMd = fs.readFileSync(path.join(rootDir, "packages/agent-core/INTERFACE.md"), "utf8");
  const app = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/app/create-app.js"), "utf8");
  const api = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/adapters/ai-image-studio-api.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-resume"], "node scripts/smoke/check-agent-resume.mjs", "root smoke:agent-resume script missing");

  // Schema: resume needs status + request_id + kind columns.
  assert(stepsDdl.includes("status VARCHAR(32) NOT NULL"), "agent_steps.status column required for resume scan");
  assert(stepsDdl.includes("request_id VARCHAR(64) NULL"), "agent_steps.request_id column required for resume binding");
  assert(stepsDdl.includes("generation_id VARCHAR(32) NULL"), "agent_steps.generation_id column required for resume binding");
  assert(stepsDdl.includes("kind VARCHAR(64) NOT NULL"), "agent_steps.kind column required for resume scan");
  assert(/INDEX\s+idx_agent_steps_session_created/.test(stepsDdl), "agent_steps must have (session_id, created_at) index so resume can scan in order");
  assert(sessionsDdl.includes("deleted_at DATETIME(3) NULL"), "agent_sessions.deleted_at required for soft delete");
  assert(messagesDdl.includes("deleted_at DATETIME(3) NULL"), "agent_messages.deleted_at required for soft delete");
  assert(stepsDdl.includes("step_no INT UNSIGNED NOT NULL DEFAULT 0"), "agent_steps.step_no required for stable resume order");
  assert(stepsDdl.includes("deleted_at DATETIME(3) NULL"), "agent_steps.deleted_at required for soft delete");
  assert(/INDEX\s+idx_agent_steps_session_step_no\s+\(session_id,\s*step_no\)/.test(stepsDdl), "agent_steps must expose (session_id, step_no) index");
  assert(outputsDdl.includes("CREATE TABLE IF NOT EXISTS agent_step_outputs"), "agent_step_outputs DDL missing");
  assert(outputsDdl.includes("output_blob MEDIUMBLOB NOT NULL"), "agent_step_outputs.output_blob MEDIUMBLOB required");
  assert(outputsDdl.includes("checksum_sha256 VARCHAR(64)"), "agent_step_outputs checksum column required");
  assert(schemaRunner.includes("splitStatements"), "agent schema runner must execute multi-statement schema safely");
  assert(schemaRunner.includes("ensureColumn") && schemaRunner.includes("deleted_at"), "agent schema runner must idempotently add soft-delete columns");
  assert(schemaRunner.includes("ensureIndex") && schemaRunner.includes("idx_agent_steps_session_step_no"), "agent schema runner must idempotently add resume indexes");
  assert(schemaRunner.includes("backfillAgentStepOutputs"), "agent schema runner must backfill agent_step_outputs");

  // Store contract: session detail must return ordered steps so the resume scan picks the
  // last pending/running step deterministically.
  assert(sessionStore.includes("agent_steps"), "session-store must read from agent_steps");
  assert(sessionStore.includes("ORDER BY"), "session-store must order step rows");
  assert(sessionStore.includes("updateAgentStepForUser"), "session-store must expose updateAgentStepForUser for resume status sync");
  assert(sessionStore.includes("LEFT JOIN agent_step_outputs"), "session-store must read split step outputs");
  assert(sessionStore.includes("upsertAgentStepOutput"), "session-store must dual-write split step outputs");
  assert(sessionStore.includes("output_json") && sessionStore.includes("output_blob"), "session-store must keep legacy output_json fallback during dual-write window");
  assert(sessionStore.includes("deleted_at IS NULL"), "session-store must filter soft-deleted session/message/step rows");
  assert(sessionStore.includes("step_no ASC"), "session-store must order steps by step_no");

  // Routes today: pending status on non-dry-run steps is the resume marker.
  assert(routes.includes("status: result.dryRun ? \"skipped\" : \"pending\""), "routes must persist pending status for resume targeting");
  assert(routes.includes("requestId: request.id"), "routes must record requestId on each step for resume binding");
  assert(routes.includes("resumeMatch") && routes.includes("\\/resume"), "routes must expose POST /api/agent-sessions/:id/resume");
  assert(routes.includes("SESSION_STATUSES.has(status)"), "routes must pass validated status filter to session list");
  assert(routes.includes("session.deletedAt"), "routes must reject soft-deleted sessions");
  assert(service.includes("function resumeAgentSession"), "service must implement resumeAgentSession");
  assert(service.includes("agent_session_resume_queued"), "resume must trace agent_session_resume_queued");
  assert(service.includes("TERMINAL_STEP_STATUSES"), "resume must skip terminal request states idempotently");

  // INTERFACE.md must declare the resume smoke so contract consumers know it's expected.
  assert(interfaceMd.includes("smoke:agent-resume"), "INTERFACE.md must enumerate the agent-resume smoke");
  assert(interfaceMd.includes("/resume"), "INTERFACE.md must document the resume endpoint");
  assert(api.includes("resumeAgentSession"), "frontend adapter must expose resumeAgentSession");
  assert(app.includes("data-agent-resume"), "frontend must render resume control");
  assert(app.includes("resumeSession"), "frontend must wire resume action");
}

async function main() {
  staticChecks();
  log("ok");
}

main().catch((error) => {
  console.error("[agent-resume-smoke] ERROR:", error?.stack || error);
  process.exit(1);
});
