#!/usr/bin/env node
// Static and pure-function smoke for provider capabilities and mapping safety.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const store = fs.readFileSync(path.join(rootDir, "src/mysql-store.js"), "utf8");
const adminStore = fs.readFileSync(path.join(rootDir, "src/stores/admin-store.js"), "utf8");
const adminCanvas = fs.readFileSync(path.join(rootDir, "public/admin/canvas.js"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const mapping = require(path.join(rootDir, "src/provider-mapping.js"));

const openaiMapping = mapping.normalizeProviderMapping({
  mode: "openai-compatible",
  submit: {
    method: "POST",
    path: "/v1/images/generations",
    bodyTemplate: {
      model: "{{model}}",
      prompt: "{{prompt}}",
      n: "{{n}}",
      size: "{{size}}"
    }
  },
  result: {
    imageUrlPath: "$.data[0].url",
    b64JsonPath: "$.data[0].b64_json",
    revisedPromptPath: "$.data[0].revised_prompt"
  }
});
assert.equal(openaiMapping.mode, "openai-compatible", "openai-compatible mapping should normalize");
assert.equal(mapping.getJsonPathValue({ data: [{ url: "https://example.com/a.png" }] }, "$.data[0].url"), "https://example.com/a.png");
assert.equal(mapping.renderTemplateValue("{{n}}", { n: 2 }), 2, "exact template should preserve primitive values");
assert.equal(mapping.renderTemplateValue("image-{{n}}", { n: 2 }), "image-2", "inline template should render string values");

assert.throws(() => mapping.parseJsonPath("$.data[0].url.constructor()"), /Unsupported JSON path/i, "JSON path must reject method calls");
assert.throws(() => mapping.parseJsonPath("$..data"), /Unsupported JSON path/i, "JSON path must reject recursive descent");
assert.throws(() => mapping.normalizeProviderMapping({
  mode: "openai-compatible",
  submit: { method: "POST", path: "https://unsafe.example/v1/images/generations" }
}), /relative HTTP path/i, "mapping paths must stay relative to provider baseUrl");

for (const token of [
  "provider_mapping_json",
  "mapping: parseProviderJson"
]) {
  assert(store.includes(token), `mysql-store must expose provider mapping via ${token}`);
}
for (const token of [
  "provider_mapping_json",
  "JSON.stringify(payload.mapping)"
]) {
  assert(adminStore.includes(token), `admin-store must persist provider mapping via ${token}`);
}

for (const token of [
  "normalizeProviderMapping",
  "runProviderMappingRequest",
  "providerCapabilityListIncludes",
  "provider.mapping || {}",
  "provider-mapping:${mapping.mode}",
  "isSafeRemoteImageUrl(item.url)"
]) {
  assert(server.includes(token), `server must wire provider capabilities/mapping token: ${token}`);
}

for (const token of [
  "Provider Mapping JSON",
  "form.get(\"mapping\")",
  "capabilities, routing, mapping"
]) {
  assert(adminCanvas.includes(token), `admin provider drawer must expose mapping token: ${token}`);
}

for (const token of [
  "capabilityValues(\"sizes\")",
  "capabilityValues(\"qualities\")",
  "capabilityValues(\"formats\")",
  "isCapabilityValueAllowed"
]) {
  assert(app.includes(token), `public app must disable unsupported provider capability token: ${token}`);
}

console.log("[provider-capabilities] OK: provider mapping schema, safe JSON path subset, DB persistence, admin UI, and capability-driven composer guards are wired");
