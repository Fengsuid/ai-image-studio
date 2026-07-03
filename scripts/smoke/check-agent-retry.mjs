#!/usr/bin/env node
// Static smoke for AIS-RLS-155 Agent step retry behavior.
// Covers automatic retry cap/backoff plus manual retry wiring through /messages and
// the explicit /steps/:stepId/retry endpoint.

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
  const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
  const service = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/generation-service.js"), "utf8");
  const routes = fs.readFileSync(path.join(rootDir, "packages/agent-core/src/routes.js"), "utf8");
  const app = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/app/create-app.js"), "utf8");
  const api = fs.readFileSync(path.join(rootDir, "apps/agent-workspace/src/adapters/ai-image-studio-api.js"), "utf8");

  assert.equal(packageJson.scripts["smoke:agent-retry"], "node scripts/smoke/check-agent-retry.mjs", "root smoke:agent-retry script missing");

  assert(service.includes("maxAttempts: dryRun ? 1 : 3"), "agent live steps must cap automatic retries at 3 attempts");
  assert(service.includes("queuePayloadForTextGeneration"), "service must persist a recoverable queue payload");
  assert(service.includes("enqueueGenerationJob"), "service must enqueue via shared queue (retry-aware)");
  assert(service.includes("runQueuedTextGeneration"), "service must run via shared text-generation runner (retry-aware)");
  assert(service.includes("traceGeneration(auditId, \"agent_batch_enqueued\""), "service must trace enqueue so retry can replay");
  assert(service.includes("function retryAgentStep"), "service must expose manual step retry");
  assert(service.includes("agent_step_retry_queued"), "manual retry must trace agent_step_retry_queued");

  // Routes record per-step status pending so retry can target individual steps.
  assert(routes.includes("status: result.dryRun ? \"skipped\" : \"pending\""), "routes must mark non-dry-run steps as pending (retry-targetable)");
  assert(routes.includes("requestId: request.id"), "routes must bind step to per-step request id for retry");
  assert(routes.includes("stepRetryMatch") && routes.includes("\\/steps\\/([^/]+)\\/retry"), "routes must expose explicit step retry endpoint");
  assert(routes.includes("retryStepId"), "POST /messages must support retryStepId payload");

  assert(server.includes("GENERATION_RETRY_BASE_DELAY_MS"), "server must define retry base delay");
  assert(server.includes('|| "2000"'), "retry base delay must default to 2000ms");
  assert(server.includes("retryDelayMsForAttempt"), "server must compute exponential retry delay");
  assert(server.includes("retryDelayMs"), "retry trace must expose retryDelayMs");

  assert(api.includes("retryAgentStepViaMessage"), "frontend adapter must expose message-based step retry");
  assert(app.includes("data-agent-retry-step"), "frontend must render a single-step retry button");
  assert(app.includes("retryAgentStepViaMessage"), "frontend retry button must call POST /messages retry flow");
}

async function main() {
  staticChecks();
  log("ok");
}

main().catch((error) => {
  console.error("[agent-retry-smoke] ERROR:", error?.stack || error);
  process.exit(1);
});
