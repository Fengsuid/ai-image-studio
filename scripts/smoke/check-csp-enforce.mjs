#!/usr/bin/env node
// Static and pure-function smoke for AIS-RLS-118 CSP enforce rollout.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const root = process.cwd();
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const publicSmoke = fs.readFileSync(path.join(root, "scripts/smoke/check-public-api.mjs"), "utf8");
const canvasSmoke = fs.readFileSync(path.join(root, "scripts/smoke/check-canvas-v2.mjs"), "utf8");
const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const {
  CSP_POLICY,
  cspHeaderName,
  securityHeaders,
  withSecurityHeaders
} = require(path.join(root, "src/security-headers.js"));

assert.equal(cspHeaderName({ CSP_ENFORCE: "true" }), "Content-Security-Policy");
assert.equal(cspHeaderName({ CSP_ENFORCE: "1" }), "Content-Security-Policy");
assert.equal(cspHeaderName({ CSP_ENFORCE: "false" }), "Content-Security-Policy-Report-Only");
assert.equal(cspHeaderName({}), "Content-Security-Policy-Report-Only");

const enforceHeaders = securityHeaders({ CSP_ENFORCE: "true" });
assert(enforceHeaders["Content-Security-Policy"], "CSP_ENFORCE=true must emit enforced CSP");
assert(!enforceHeaders["Content-Security-Policy-Report-Only"], "CSP_ENFORCE=true must not emit Report-Only");

const reportOnlyHeaders = securityHeaders({ CSP_ENFORCE: "false" });
assert(reportOnlyHeaders["Content-Security-Policy-Report-Only"], "CSP_ENFORCE=false must emit Report-Only");
assert(!reportOnlyHeaders["Content-Security-Policy"], "CSP_ENFORCE=false must not emit enforced CSP");

for (const policy of [enforceHeaders["Content-Security-Policy"], reportOnlyHeaders["Content-Security-Policy-Report-Only"]]) {
  assert.equal(policy, CSP_POLICY, "enforce and report-only modes must share the same policy");
  assert(policy.includes("script-src 'self'"), "CSP must keep scripts self-only");
  assert(policy.includes("'sha256-Uo+5wss4OrAt98qVKAzkKoEC3P0AJe7a/g6/8hOhVUw='"), "CSP must allow the early theme bootstrap hash");
  assert(policy.includes("font-src 'self'"), "CSP must keep fonts self-only");
  assert(policy.includes("media-src 'self'"), "CSP must keep media self-only");
  assert(!policy.includes("fonts.googleapis.com"), "CSP must not allow Google Fonts");
  assert(!policy.includes("cdn.jsdelivr.net"), "CSP must not allow jsDelivr");
}

const merged = withSecurityHeaders({ "Cache-Control": "no-store" }, { CSP_ENFORCE: "true" });
assert.equal(merged["Cache-Control"], "no-store", "withSecurityHeaders must preserve caller headers");
assert.equal(merged["X-Content-Type-Options"], "nosniff", "security headers must include nosniff");
assert(merged["Content-Security-Policy"], "withSecurityHeaders must include enforced CSP when enabled");

assert(server.includes('require("./src/security-headers")'), "server must use shared security header helper");
assert(!server.includes('"Content-Security-Policy-Report-Only": ['), "server must not hard-code Report-Only headers inline");
assert(envExample.includes("CSP_ENFORCE=false"), ".env.example must document the rollback switch");
assert(publicSmoke.includes("SMOKE_EXPECT_CSP_ENFORCE"), "public smoke must expose CSP mode expectation");
assert(canvasSmoke.includes("SMOKE_EXPECT_CSP_ENFORCE"), "Canvas v2 smoke must expose CSP mode expectation");

console.log("[csp-enforce-smoke] OK: CSP enforce/report-only header switch verified");
