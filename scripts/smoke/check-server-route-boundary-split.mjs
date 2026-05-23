#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const server = read("server.js");
const packageJson = JSON.parse(read("package.json"));
const routeFiles = {
  auth: read("src/routes/auth.js"),
  health: read("src/routes/health.js"),
  agentSessions: read("src/routes/agent-sessions.js")
};

assert(server.includes('require("./src/routes/auth")'), "server.js must require src/routes/auth");
assert(server.includes("const handleAuthRoute = createAuthRoute({"), "server.js must create handleAuthRoute");
assert(server.includes("if (await handleAuthRoute(req, res, url)) return;"), "server.js must mount handleAuthRoute");

for (const endpoint of ["/api/auth/me", "/api/auth/register", "/api/auth/login", "/api/auth/logout"]) {
  assert(routeFiles.auth.includes(endpoint), `src/routes/auth.js must own ${endpoint}`);
  assert(!server.includes(`url.pathname === "${endpoint}"`), `server.js should not directly branch on ${endpoint}`);
}

assert(routeFiles.auth.includes("Owns: GET /api/auth/me"), "src/routes/auth.js must list owned endpoints at the top");
assert(routeFiles.auth.includes("createAuthRoute") && routeFiles.auth.includes("module.exports"), "src/routes/auth.js must export createAuthRoute");
assert(!routeFiles.auth.includes("return sendJson("), "src/routes/auth.js handlers must explicitly return true after sendJson");
assert(!routeFiles.auth.includes("return sendNoContent("), "src/routes/auth.js handlers must explicitly return true after sendNoContent");
assert((routeFiles.auth.match(/return true;/g) || []).length >= 4, "src/routes/auth.js must stop route fallthrough after handled auth responses");
assert(routeFiles.health.includes("createHealthRoute") && routeFiles.health.includes("module.exports"), "src/routes/health.js must export createHealthRoute");
assert(routeFiles.agentSessions.includes("createAgentSessionRoute") && routeFiles.agentSessions.includes("module.exports"), "src/routes/agent-sessions.js must export createAgentSessionRoute");

const csrfIndex = server.indexOf("verifyCsrf(req);");
const authIndex = server.indexOf("if (await handleAuthRoute(req, res, url)) return;");
assert(csrfIndex >= 0 && authIndex >= 0 && csrfIndex < authIndex, "verifyCsrf(req) must run before handleAuthRoute");

assert(
  packageJson.scripts?.["smoke:server-route-boundary-split"] === "node scripts/smoke/check-server-route-boundary-split.mjs",
  "package.json must expose smoke:server-route-boundary-split"
);

if (failures.length) {
  console.error("[smoke] server route boundary split failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[smoke] server route boundary split checks passed");
