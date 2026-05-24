#!/usr/bin/env node
// Static and pure-function smoke for generation trace diagnostics.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const store = fs.readFileSync(path.join(rootDir, "src/mysql-store.js"), "utf8");
const adminRoute = fs.readFileSync(path.join(rootDir, "src/routes/admin.js"), "utf8");
const admin = fs.readFileSync(path.join(rootDir, "public/admin.js"), "utf8");
const trace = require(path.join(rootDir, "src/generation-trace-service.js"));

const sensitive = trace.safeJsonSummary({
  headers: {
    Authorization: "Bearer secret-token-should-not-leak",
    Cookie: "session=abc; csrf=def"
  },
  apiKey: "test-api-key-should-not-leak",
  providerUrl: "https://example.com/file.png?X-Amz-Signature=secret&safe=1",
  nested: {
    password: "correct horse battery staple",
    prompt: "safe prompt"
  }
});
const serialized = JSON.stringify(sensitive);
assert(!serialized.includes("secret-token-should-not-leak"), "bearer token must be redacted");
assert(!serialized.includes("test-api-key-should-not-leak"), "api key must be redacted");
assert(!serialized.includes("correct horse"), "password must be redacted");
assert(!serialized.includes("session=abc"), "cookie must be redacted");
assert(serialized.includes("[redacted]"), "sanitized summary must include redaction marker");
assert(serialized.includes("safe prompt"), "non-sensitive prompt text should remain visible");

for (const token of [
  "CREATE TABLE IF NOT EXISTS generation_trace",
  "requested_params_json",
  "normalized_params_json",
  "provider_params_json",
  "provider_response_json",
  "revised_prompt",
  "error_code",
  "error_stage",
  "appendGenerationTrace",
  "getGenerationRequestDiagnostic"
]) {
  assert(store.includes(token), `mysql-store must include ${token}`);
}

for (const stage of [
  "request_received",
  "provider_selected",
  "params_normalized",
  "provider_submitted",
  "image_validated",
  "generation_saved",
  "credit_charged",
  "credit_refunded",
  "failed"
]) {
  assert(server.includes(`"${stage}"`), `server must trace ${stage}`);
}

assert(server.includes("createAdminRoute"), "server must mount the admin route module");
assert(adminRoute.includes("/api/admin/generations") && adminRoute.includes("getGenerationRequestDiagnostic"), "admin route must expose generation diagnostic API");
assert(admin.includes("/api/admin/generations/${encodeURIComponent(id)}"), "admin request drawer must fetch diagnostic detail");
assert(admin.includes("Trace 时间线"), "admin request drawer must render trace timeline");

console.log("[generation-trace] OK: sanitization, schema, trace stages, and admin diagnostics are wired");
