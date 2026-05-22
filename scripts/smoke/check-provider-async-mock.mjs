#!/usr/bin/env node
// Pure-function smoke for async provider mapping submit + poll.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const mapping = require(path.join(rootDir, "src/provider-mapping.js"));

const calls = [];
let pollCount = 0;

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

const asyncMapping = mapping.normalizeProviderMapping({
  mode: "async-task",
  submit: {
    method: "POST",
    path: "/generate",
    bodyTemplate: {
      prompt: "{{prompt}}",
      model: "{{model}}",
      size: "{{size}}",
      n: "{{n}}"
    },
    taskIdPath: "$.id"
  },
  poll: {
    method: "GET",
    path: "/tasks/{{providerTaskId}}",
    statusPath: "$.status",
    successValues: ["completed"],
    failedValues: ["failed", "cancelled"],
    imageUrlPath: "$.result.image_url",
    revisedPromptPath: "$.result.revised_prompt",
    intervalMs: 10,
    maxAttempts: 3
  }
});

const trace = [];
const result = await mapping.runProviderMappingRequest({
  apiKey: "test-key",
  baseUrl: "https://provider.example",
  mapping: asyncMapping,
  payload: {
    model: "mock-image",
    prompt: "a ceramic robot",
    n: 1,
    size: "1024x1024",
    quality: "auto",
    background: "auto",
    output_format: "png"
  },
  delay: async () => null,
  onTrace: async (stage, data) => trace.push({ stage, data }),
  fetchFn: async (label, endpoint, init) => {
    calls.push({ label, endpoint, init });
    if (endpoint.endsWith("/generate")) {
      assert.equal(init.method, "POST", "submit must POST");
      assert.equal(init.headers.Authorization, "Bearer test-key", "submit must keep API key server-side");
      assert.equal(JSON.parse(init.body).prompt, "a ceramic robot", "submit template must render prompt");
      return jsonResponse({ id: "task_123" });
    }
    if (endpoint.endsWith("/tasks/task_123")) {
      pollCount += 1;
      assert.equal(init.method, "GET", "poll must GET");
      return pollCount === 1
        ? jsonResponse({ status: "running" })
        : jsonResponse({
          status: "completed",
          result: {
            image_url: "https://cdn.example/generated.png",
            revised_prompt: "a revised ceramic robot"
          }
        });
    }
    throw new Error(`unexpected endpoint: ${endpoint}`);
  }
});

assert.equal(calls.length, 3, "async mock should submit once and poll twice");
assert.equal(result.providerTaskId, "task_123", "async result must retain providerTaskId");
assert.equal(result.data?.[0]?.url, "https://cdn.example/generated.png", "async poll result must map image URL");
assert.equal(result.data?.[0]?.revised_prompt, "a revised ceramic robot", "async poll result must map revised prompt");
assert(trace.some((item) => item.stage === "provider_task_submitted"), "async mapping must trace provider_task_submitted");
assert(trace.some((item) => item.stage === "provider_polled" && item.data.status === "completed"), "async mapping must trace completed poll");

for (const token of [
  "provider_task_submitted",
  "provider_polled",
  "queueStatus = \"polling\"",
  "providerTaskId"
]) {
  assert(server.includes(token), `server must wire async provider token: ${token}`);
}

console.log("[provider-async-mock] OK: async provider submit + poll maps task id, status, image URL, revised prompt, and trace stages");
