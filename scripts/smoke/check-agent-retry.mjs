#!/usr/bin/env node
// Static + optional live API smoke for AIS-RLS-152 Agent step retry behavior.
//
// Scope:
//   - Assert today's batch path threads maxAttempts (existing implementation in
//     generation-service.js sets maxAttempts: 2 for live runs, 1 for dry-run).
//   - Assert routes record `pending` step status for non-dry-run, enabling later resume/retry.
//   - Assert generation_trace records request_received + agent_batch_enqueued so retry replays
//     can pick up the same audit id.
//
// Forward-looking (depends on AIS-RLS-155):
//   - TODO 155: exponential backoff (≤ 3 attempts) on transient provider errors.
//   - TODO 155: manual retry endpoint (POST /api/agent-sessions/:id/steps/:stepId/retry).
// Until 155 lands those code paths, this smoke locks in the wiring that 148 already shipped
// and emits TODO logs for the missing endpoints.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function log(...parts) {
  console.log("[agent-retry-smoke]", ...parts);
}

function staticChecks() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const service = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/generation-service.js"), "utf8");
  const routes = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-retry"], "node scripts/smoke/check-agent-retry.mjs", "root smoke:agent-retry script missing");

  // Today's wiring: max-attempts must be present so the existing queue runner can retry.
  assert(service.includes("maxAttempts: dryRun ? 1 : 2"), "service must thread maxAttempts so the queue runner can retry");
  assert(service.includes("queuePayloadForTextGeneration"), "service must persist a recoverable queue payload");
  assert(service.includes("enqueueGenerationJob"), "service must enqueue via shared queue (retry-aware)");
  assert(service.includes("runQueuedTextGeneration"), "service must run via shared text-generation runner (retry-aware)");
  assert(service.includes("traceGeneration(auditId, \"agent_batch_enqueued\""), "service must trace enqueue so retry can replay");

  // Routes record per-step status pending so retry can target individual steps.
  assert(routes.includes("status: result.dryRun ? \"skipped\" : \"pending\""), "routes must mark non-dry-run steps as pending (retry-targetable)");
  assert(routes.includes("requestId: request.id"), "routes must bind step to per-step request id for retry");

  // TODO AIS-RLS-155: assert exponential-backoff + manual-retry endpoint when they land.
  const hasManualRetryRoute = routes.includes("/retry") || routes.includes("agent_step_retry");
  if (!hasManualRetryRoute) {
    log("TODO AIS-RLS-155: manual retry endpoint (POST /api/agent-sessions/:id/steps/:stepId/retry) not yet implemented");
  }
  const hasBackoff = service.includes("backoff") || service.includes("retryDelayMs") || service.includes("retry_attempt");
  if (!hasBackoff) {
    log("TODO AIS-RLS-155: exponential backoff (≤ 3 attempts) on transient provider errors not yet implemented");
  }
}

async function main() {
  staticChecks();
  log("ok (static-only; live retry path depends on AIS-RLS-155)");
}

main().catch((error) => {
  console.error("[agent-retry-smoke] ERROR:", error?.stack || error);
  process.exit(1);
});
