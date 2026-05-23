#!/usr/bin/env node
// Static guard for AIS-RLS-082 auth route and session/CSRF middleware split.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const server = read("server.js");
const authRoute = read("src/routes/auth.js");
const session = read("src/middleware/session.js");
const csrf = read("src/middleware/csrf.js");
const packageJson = JSON.parse(read("package.json"));

assert.equal(
  packageJson.scripts["smoke:auth-route-session-split"],
  "node scripts/smoke/check-auth-route-session-split.mjs",
  "package.json must expose smoke:auth-route-session-split"
);

assert(server.includes('require("./src/routes/auth")'), "server.js must load src/routes/auth");
assert(server.includes('require("./src/middleware/session")'), "server.js must load src/middleware/session");
assert(server.includes('require("./src/middleware/csrf")'), "server.js must load src/middleware/csrf");
assert(server.includes("createSessionMiddleware({"), "server.js must instantiate session middleware");
assert(server.includes("createCsrfMiddleware({"), "server.js must instantiate CSRF middleware");
assert(server.includes("const handleAuthRoute = createAuthRoute({"), "server.js must mount auth route factory");
assert(server.includes("if (await handleAuthRoute(req, res, url)) return;"), "server.js must dispatch auth route");
assert(server.includes("verifyCsrf(req);"), "server.js must keep CSRF gate before write routes");

for (const forbidden of [
  "function hashSessionToken(",
  "function sessionCookie(",
  "function clearSessionCookie(",
  "function csrfCookie(",
  "function getOrCreateCsrfToken(",
  "function verifyCsrf(",
  "async function createSession(",
  "async function destroySession(",
  "async function getCurrentUser(",
  "function verifyPassword("
]) {
  assert(!server.includes(forbidden), `server.js should not keep auth/session implementation: ${forbidden}`);
}

for (const endpoint of [
  "/api/auth/me",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout"
]) {
  assert(authRoute.includes(endpoint), `auth route must own ${endpoint}`);
}

for (const snippet of [
  "function createSessionMiddleware",
  "function parseCookies",
  "function sessionCookie",
  "function clearSessionCookie",
  "async function createSession",
  "async function destroySession",
  "async function getCurrentUser",
  "function hashPassword",
  "function verifyPassword",
  "module.exports = { createSessionMiddleware }"
]) {
  assert(session.includes(snippet), `session middleware missing ${snippet}`);
}

for (const snippet of [
  "function createCsrfMiddleware",
  "function csrfCookie",
  "function getOrCreateCsrfToken",
  "function verifyCsrf",
  "Invalid CSRF token",
  "module.exports = { createCsrfMiddleware }"
]) {
  assert(csrf.includes(snippet), `CSRF middleware missing ${snippet}`);
}

assert(authRoute.includes("pendingApproval: true"), "registration pending approval response must remain intact");
assert(authRoute.includes('"Set-Cookie": sessionCookie(token, req)'), "login/register must continue setting session cookie");
assert(authRoute.includes('"Set-Cookie": csrfCookie(csrfToken, req)'), "GET /api/auth/me must continue setting CSRF cookie");
assert(authRoute.includes('"Set-Cookie": clearSessionCookie(req)'), "logout must continue clearing session cookie");

console.log("[auth-route-session-split-smoke] OK");
