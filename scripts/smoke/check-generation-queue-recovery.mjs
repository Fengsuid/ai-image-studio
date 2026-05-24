#!/usr/bin/env node
// Static and pure-function smoke for DB-backed generation queue recovery.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const store = fs.readFileSync(path.join(rootDir, "src/mysql-store.js"), "utf8");
const runner = fs.readFileSync(path.join(rootDir, "src/generation-queue-runner.js"), "utf8");
const helper = require(path.join(rootDir, "src/generation-queue-recovery.js"));

const now = new Date("2026-05-22T08:00:00.000Z");
const staleLockedAt = new Date(now.getTime() - 11 * 60 * 1000).toISOString();
const freshCreatedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
const payloadJson = helper.queuePayloadForTextGeneration({
  userId: "usr_test",
  request: { prompt: "a small red cube", n: 1, size: "1024x1024" },
  openaiRequest: { prompt: "a small red cube", n: 1, size: "1024x1024" },
  totalCost: 1,
  costPerImage: 1,
  requestStartedAt: now.getTime()
});

assert.equal(helper.parseQueuePayload(payloadJson).kind, "text-generation", "queue payload must roundtrip");

const released = helper.buildStartupRecoveryPatch({
  id: "req_running_payload",
  status: "running",
  queueStatus: "running",
  attemptCount: 1,
  maxAttempts: 2,
  lockedAt: staleLockedAt,
  createdAt: freshCreatedAt,
  queuePayloadJson: payloadJson
}, { now });
assert.equal(released.status, "pending", "stale running recoverable jobs must be released back to pending");
assert.equal(released.queueStatus, "queued", "stale running recoverable jobs must return to queued");
assert.equal(released.lockedBy, null, "released jobs must clear runner locks");

const expired = helper.buildStartupRecoveryPatch({
  id: "req_running_missing_payload",
  status: "running",
  queueStatus: "running",
  attemptCount: 1,
  maxAttempts: 1,
  lockedAt: staleLockedAt,
  createdAt: freshCreatedAt,
  queuePayloadJson: ""
}, { now });
assert.equal(expired.status, "expired", "non-recoverable stale running jobs must expire");
assert.equal(expired.failureStage, "queue_recovery", "expired jobs must expose queue recovery as failure stage");

const terminal = helper.buildStartupRecoveryPatch({
  id: "req_done",
  status: "succeeded",
  queueStatus: "succeeded",
  lockedAt: staleLockedAt,
  createdAt: freshCreatedAt
}, { now });
assert.equal(terminal, null, "terminal requests must not be patched by recovery");

for (const column of [
  "queue_status",
  "attempt_count",
  "max_attempts",
  "locked_by",
  "locked_at",
  "started_at",
  "finished_at",
  "latency_ms",
  "failure_stage",
  "job_type",
  "queue_payload_json"
]) {
  assert(store.includes(column), `mysql-store must migrate and map generation_requests.${column}`);
}

assert(server.includes("recoverGenerationQueueOnStartup"), "server must run startup queue recovery");
assert(server.includes("createGenerationQueueRunner"), "server must use the extracted queue runner module");
assert(server.includes("queuePayloadForTextGeneration"), "text async requests must persist recoverable payloads");
assert(server.includes("queuePayloadForImageEdit"), "image edit async requests must persist recoverable payloads");
assert(server.includes("GENERATION_QUEUE_CONCURRENCY"), "queue recovery must preserve concurrency controls");
assert(server.includes("OPENAI_IMAGE_GENERATION_TIMEOUT_MS"), "text-to-image provider calls must use a dedicated shorter timeout");
assert(server.includes("timedOut = true"), "fetchWithTimeout must classify its own abort timer as a timeout");
assert(server.includes("isRetryableGenerationError"), "queue worker must classify transient provider failures");
assert(server.includes("maybeRequeueTransientGenerationFailure"), "queue worker must requeue transient provider failures before marking failed");
assert(server.includes("retry_queued"), "queue worker must trace automatic transient retries");
assert(runner.includes("function createGenerationQueueRunner"), "queue runner module must expose createGenerationQueueRunner");
assert(runner.includes("onBeforeRun"), "queue runner must support DB lock/status hooks before execution");
assert(runner.includes("cancelQueued"), "queue runner must preserve queued cancellation");

console.log("[generation-queue-recovery] OK: recovery patches, schema fields, startup hook, and async payload persistence are present");
