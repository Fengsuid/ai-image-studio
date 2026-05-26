#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const adminHtml = read("public/admin.html");
const admin = read("public/admin.js");
const overview = read("public/admin-overview.js");
const users = read("public/admin-users.js");
const providers = read("public/admin-providers.js");
const gallery = read("public/admin-gallery.js");
const buildManifest = JSON.parse(read("public/frontend-build-manifest.json"));
const lazyAdminScripts = buildManifest.js?.lazyRoutes?.admin?.scripts || [];
const packageJson = JSON.parse(read("package.json"));
const server = read("server.js");
const adminRouteDir = path.join(rootDir, "src/routes/admin");
const backendModules = [
  "announcements.js",
  "diagnostics.js",
  "generations.js",
  "moderation.js",
  "prompt-sources.js",
  "public-images.js",
  "settings.js",
  "users.js"
];

assert.equal(packageJson.scripts["smoke:admin-module-split"], "node scripts/smoke/check-admin-module-split.mjs", "package.json must expose smoke:admin-module-split");
assert(adminHtml.includes("/app-router.js"), "admin.html must load app-router.js");
assert(!adminHtml.includes("/admin.js"), "admin.html must lazy-load admin.js through app-router");
for (const file of ["admin-overview.js", "admin-users.js", "admin-providers.js", "admin-gallery.js"]) {
  assert(lazyAdminScripts.includes(`/${file}`), `admin lazy route must load ${file}`);
}
assert(lazyAdminScripts.indexOf("/admin-overview.js") < lazyAdminScripts.indexOf("/admin.js"), "overview module must load before admin.js");
assert(lazyAdminScripts.indexOf("/admin-users.js") < lazyAdminScripts.indexOf("/admin.js"), "users module must load before admin.js");
assert(lazyAdminScripts.indexOf("/admin-providers.js") < lazyAdminScripts.indexOf("/admin.js"), "providers module must load before admin.js");
assert(admin.includes("renderAdminModule(\"overview\")"), "admin.js must delegate overview rendering");
assert(admin.includes("renderAdminModule(\"users\")"), "admin.js must delegate users rendering");
assert(admin.includes("renderAdminModule(\"providers\")"), "admin.js must delegate provider rendering");
assert(admin.includes("renderAdminModule(\"squareReview\")"), "admin.js must delegate square review rendering");
assert(admin.includes("renderAdminModule(\"galleryFiles\")"), "admin.js must delegate gallery files rendering");
assert(!admin.includes("function renderOverview()"), "renderOverview should move out of admin.js");
assert(!admin.includes("function renderUsers()"), "renderUsers should move out of admin.js");
assert(!admin.includes("function renderProvidersPlaceholder()"), "renderProvidersPlaceholder should move out of admin.js");
assert(!admin.includes("function renderSquareReview()"), "renderSquareReview should move out of admin.js");
assert(!admin.includes("function renderGalleryFiles()"), "renderGalleryFiles should move out of admin.js");

for (const [name, content] of [["overview", overview], ["users", users], ["providers", providers]]) {
  assert(content.includes(`window.AdminModules.${name}`), `${name} module must register window.AdminModules.${name}`);
}
assert(gallery.includes("window.AdminModules.squareReview"), "gallery module must register squareReview");
assert(gallery.includes("window.AdminModules.galleryFiles"), "gallery module must register galleryFiles");
assert(!fs.existsSync(path.join(rootDir, "src/routes/admin.js")), "legacy src/routes/admin.js must be deleted");
assert(!fs.existsSync(path.join(rootDir, "src/routes/admin-users.js")), "legacy src/routes/admin-users.js must be deleted");
assert(!fs.existsSync(path.join(rootDir, "src/routes/admin-announcements.js")), "legacy src/routes/admin-announcements.js must be deleted");
assert(server.includes('require("./src/routes/admin")'), "server.js must mount the admin directory index");
assert(!server.includes("handleAdminUsersRoute"), "server.js must not mount legacy admin-users separately");
assert(!server.includes("handleAdminAnnouncementsRoute"), "server.js must not mount legacy admin-announcements separately");

for (const file of ["index.js", ...backendModules]) {
  const fullPath = path.join(adminRouteDir, file);
  assert(fs.existsSync(fullPath), `src/routes/admin/${file} must exist`);
  const content = fs.readFileSync(fullPath, "utf8");
  const lineCount = content.split(/\r?\n/).length;
  assert(lineCount <= 400, `src/routes/admin/${file} must be <= 400 lines, got ${lineCount}`);
  assert(content.includes("module.exports"), `src/routes/admin/${file} must export its route factory`);
}

console.log("[admin-module-split-smoke] OK");
