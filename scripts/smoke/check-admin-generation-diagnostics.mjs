#!/usr/bin/env node
// Static guard for AIS-RLS-068 admin generation diagnostics.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const server = read("server.js");
const adminRoute = read("src/routes/admin/generations.js");
const generationStore = read("src/stores/generation-store.js");
const adminHtml = read("public/admin.html");
const dashboard = read("public/admin/dashboard.js");
const diagnostics = read("public/admin-generation-diagnostics.js");
const buildManifest = JSON.parse(read("public/frontend-build-manifest.json"));
const lazyAdminScripts = buildManifest.js?.lazyRoutes?.admin?.scripts || [];
const packageJson = JSON.parse(read("package.json"));

assert.equal(packageJson.scripts["smoke:admin-generation-diagnostics"], "node scripts/smoke/check-admin-generation-diagnostics.mjs", "smoke script missing");

for (const token of [
  "/api/admin/generations",
  "status: url.searchParams.get(\"status\")",
  "provider: url.searchParams.get(\"provider\")",
  "model: url.searchParams.get(\"model\")",
  "errorStage: url.searchParams.get(\"errorStage\")",
  "generation_request_retry",
  "generation_request_cancel",
  "generation_request_mark_failed",
  "generation_request_copy_error",
  "admin_retry_queued",
  "admin_cancelled",
  "admin_marked_failed",
  "recoveredGenerationJobFromRequest"
]) {
  assert(server.includes(token) || adminRoute.includes(token), `server/admin route missing ${token}`);
}

assert(generationStore.includes("async function listGenerationRequests(limit = 100, filters = {})"), "generation store must accept generation filters");
for (const token of [
  "gr.provider_params_json LIKE ?",
  "g.model LIKE ?",
  "gr.user_id LIKE ?",
  "gr.error_stage = ?",
  "gr.created_at >= ?",
  "gr.created_at <= ?"
]) {
  assert(generationStore.includes(token), `generation store filter missing ${token}`);
}

assert(adminHtml.includes("/app-router.js"), "admin page must load app-router.js");
assert(!adminHtml.includes("/admin/dashboard.js"), "admin page must lazy-load admin dashboard through app-router");
assert(lazyAdminScripts.includes("/admin-generation-diagnostics.js"), "admin lazy route must load diagnostics module before dashboard");
assert(lazyAdminScripts.indexOf("/admin-generation-diagnostics.js") < lazyAdminScripts.indexOf("/admin/dashboard.js"), "diagnostics module must load before dashboard");
assert(dashboard.includes("generationDiagnosticsQuery"), "dashboard must query diagnostics filters");
assert(dashboard.includes("AdminModules?.generationDiagnostics"), "dashboard must delegate to diagnostics module");
assert(dashboard.includes("module.renderDrawer"), "request drawer must delegate diagnostics rendering");

for (const token of [
  "data-generation-filter=\"provider\"",
  "data-generation-filter=\"model\"",
  "data-generation-filter=\"user\"",
  "data-generation-filter=\"errorStage\"",
  "type=\"datetime-local\"",
  "data-generation-action=\"retry:",
  "data-generation-action=\"cancel:",
  "data-generation-action=\"mark-failed:",
  "data-generation-copy-error",
  "Trace 时间线",
  "Provider 响应摘要"
]) {
  assert(diagnostics.includes(token), `diagnostics module missing ${token}`);
}

for (const sensitive of ["apiKey", "password", "Authorization", "Cookie", "Bearer"]) {
  assert(!diagnostics.includes(sensitive), `diagnostics frontend should not reference sensitive token ${sensitive}`);
}

console.log("[admin-generation-diagnostics] ok");
