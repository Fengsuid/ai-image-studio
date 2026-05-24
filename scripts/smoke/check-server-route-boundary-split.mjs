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
  agentSessions: read("src/routes/agent-sessions.js"),
  images: read("src/routes/images.js"),
  prompts: read("src/routes/prompts.js"),
  canvases: read("src/routes/canvases.js"),
  admin: read("src/routes/admin.js"),
  credits: read("src/routes/credits.js"),
  settingsPublic: read("src/routes/settings-public.js"),
  announcements: read("src/routes/announcements.js")
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

const splitRoutes = [
  {
    key: "images",
    requirePath: 'require("./src/routes/images")',
    factory: "createImagesRoute",
    handle: "handleImagesRoute",
    endpoints: [
      "/api/images/history",
      "/api/images/bulk"
    ],
    allowLocalRequires: true
  },
  {
    key: "prompts",
    requirePath: 'require("./src/routes/prompts")',
    factory: "createPromptsRoute",
    handle: "handlePromptsRoute",
    endpoints: [
      "/api/prompts",
      "/api/tags",
      "/api/prompt-categories"
    ]
  },
  {
    key: "canvases",
    requirePath: 'require("./src/routes/canvases")',
    factory: "createCanvasesRoute",
    handle: "handleCanvasesRoute",
    endpoints: [
      "/api/canvases",
      "/api/canvases/templates"
    ]
  },
  {
    key: "admin",
    requirePath: 'require("./src/routes/admin")',
    factory: "createAdminRoute",
    handle: "handleAdminRoute",
    endpoints: [
      "/api/admin/settings",
      "/api/admin/providers",
      "/api/admin/generations",
      "/api/admin/public-images",
      "/api/admin/prompt-sources"
    ]
  },
  {
    key: "credits",
    requirePath: 'require("./src/routes/credits")',
    factory: "createCreditsRoute",
    handle: "handleCreditsRoute",
    endpoints: [
      "/api/checkin",
      "/api/credits/detail"
    ]
  },
  {
    key: "settingsPublic",
    requirePath: 'require("./src/routes/settings-public")',
    factory: "createSettingsPublicRoute",
    handle: "handleSettingsPublicRoute",
    endpoints: [
      "/api/settings",
      "/api/growth"
    ]
  },
  {
    key: "announcements",
    requirePath: 'require("./src/routes/announcements")',
    factory: "createAnnouncementsRoute",
    handle: "handleAnnouncementsRoute",
    endpoints: [
      "/api/announcements",
      "/api/announcements/unread",
      "/api/stats/today"
    ],
    fragments: [
      "announcementPublicMatch",
      "(read|ack)"
    ],
    forbiddenServerFragments: [
      "announcementPublicMatch"
    ]
  }
];

for (const route of splitRoutes) {
  const routeFile = routeFiles[route.key];
  assert(server.includes(route.requirePath), `server.js must require src/routes/${route.key}`);
  assert(server.includes(`const ${route.handle} = ${route.factory}({`), `server.js must create ${route.handle}`);
  assert(server.includes(`if (await ${route.handle}(req, res, url)) return;`), `server.js must mount ${route.handle}`);
  assert(routeFile.includes(route.factory) && routeFile.includes("module.exports"), `src/routes/${route.key}.js must export ${route.factory}`);
  assert(!routeFile.includes("return sendJson("), `src/routes/${route.key}.js handlers must explicitly return true after sendJson`);
  assert(!routeFile.includes("return sendNoContent("), `src/routes/${route.key}.js handlers must explicitly return true after sendNoContent`);
  assert(routeFile.includes("return false;"), `src/routes/${route.key}.js must fall through with return false`);
  for (const endpoint of route.endpoints) {
    assert(routeFile.includes(endpoint), `src/routes/${route.key}.js must own ${endpoint}`);
    assert(!server.includes(`url.pathname === "${endpoint}"`), `server.js should not directly branch on ${endpoint}`);
  }
  for (const fragment of route.fragments || []) {
    assert(routeFile.includes(fragment), `src/routes/${route.key}.js must include ${fragment}`);
  }
  for (const fragment of route.forbiddenServerFragments || []) {
    assert(!server.includes(fragment), `server.js should not directly own ${fragment}`);
  }
  assert(!routeFile.includes('require("mysql2/promise")'), `src/routes/${route.key}.js must not open mysql2 connections directly`);
  assert(!routeFile.includes("require('mysql2/promise')"), `src/routes/${route.key}.js must not open mysql2 connections directly`);
  if (!route.allowLocalRequires) {
    assert(!/\brequire\s*\(/.test(routeFile), `src/routes/${route.key}.js must stay dependency-injected and avoid local require cycles`);
  }
}

const csrfIndex = server.indexOf("verifyCsrf(req);");
const authIndex = server.indexOf("if (await handleAuthRoute(req, res, url)) return;");
assert(csrfIndex >= 0 && authIndex >= 0 && csrfIndex < authIndex, "verifyCsrf(req) must run before handleAuthRoute");

const galleryIndex = server.indexOf("if (await handleGalleryRoute(req, res, url)) return;");
const promptsIndex = server.indexOf("if (await handlePromptsRoute(req, res, url)) return;");
const canvasesIndex = server.indexOf("if (await handleCanvasesRoute(req, res, url)) return;");
const adminIndex = server.indexOf("if (await handleAdminRoute(req, res, url)) return;");
assert(galleryIndex >= 0 && promptsIndex > galleryIndex, "handlePromptsRoute must mount after handleGalleryRoute");
assert(canvasesIndex > promptsIndex, "handleCanvasesRoute must mount after handlePromptsRoute");
assert(adminIndex > canvasesIndex, "handleAdminRoute must mount after handleCanvasesRoute");

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
