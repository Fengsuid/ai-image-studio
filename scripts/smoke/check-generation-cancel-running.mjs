#!/usr/bin/env node
// Static guard: chat cancel must stop UI polling and abort running async provider jobs.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const app = read("public/app.js");
const runner = read("src/generation-queue-runner.js");
const server = read("server.js");
const imagesRoute = read("src/routes/images-generate.js");

assert(app.includes("abortableDelay"), "app.js polling must use an abortable delay");
assert(app.includes("waitForGenerationRequest(data.request.id, tempId, startedAt, state.generateAbortController.signal)"), "text generation polling must receive the active abort signal");
assert(app.includes("api(`/api/images/requests/${encodeURIComponent(requestId)}`, { signal })"), "request polling must abort fetch");
assert(app.includes("state.generateAbortController?.abort()"), "cancel button must abort the active generation controller");
assert(app.includes("cancelGenerationRequest(requestId)"), "cancel button must notify the backend for known request ids");
assert(app.includes("cancelActiveGenerationRequests()"), "cancel button must cancel active backend requests when request id is not yet attached");
assert(app.includes('api("/api/images/requests/active")'), "fallback cancellation must query active backend generation requests");
assert(app.includes('state.history = state.history.filter((entry) =>'), "cancel button must remove generating placeholders from chat history");
assert(app.includes("stopFunMessages();") && app.includes("stopGenerationTimer();"), "cancel button must clear bottom generation status");
assert(app.includes("stopEditorTimer();"), "cancel button must clear editor lower-left generation status");

assert(runner.includes("current.abortController = new AbortController()"), "queue runner must create a controller for running jobs");
assert(runner.includes("current.run({ signal: current.abortController.signal })"), "queue runner must pass signal to job.run");
assert(runner.includes("current.abortController?.abort"), "queue runner cancel must abort running jobs");
assert(runner.includes('return "running"'), "queue runner cancel must report running cancellation");

assert(server.includes("generationQueueRunner.cancel(id)"), "server cancel helper must cancel queued or running jobs");
assert(server.includes("callOpenAIImages(settings, openaiRequest, { signal,"), "text async provider call must receive cancel signal");
assert(server.includes("callOpenAIImageEdits(settings, payload, { signal,"), "image-edit async provider call must receive cancel signal");
assert(server.includes('source: cancelled ? "generation_cancel_refund"'), "running cancellation must refund as cancel");
assert(server.includes('status: "cancelled"') && server.includes('errorCode: "client_cancelled"'), "running cancellation must mark request cancelled");

assert(imagesRoute.includes("run: ({ signal } = {}) => runQueuedTextGeneration"), "text route async job must accept queue signal");
assert(imagesRoute.includes("run: ({ signal } = {}) => runQueuedImageEdit"), "image-edit route async job must accept queue signal");

console.log("[generation-cancel-running-smoke] OK");
