#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const adminHtml = read("public/admin.html");
const dashboard = read("public/admin/dashboard.js");
const prompts = read("public/admin/prompts.js");
const announcements = read("public/admin/announcements.js");
const settings = read("public/admin/settings.js");
const canvas = read("public/admin/canvas.js");
const commandPalette = read("public/admin/command-palette.js");
const shellCss = read("public/css/pages/admin-shell-polish.css");
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
assert(!adminHtml.includes("/admin/dashboard.js"), "admin.html must lazy-load admin dashboard through app-router");
for (const file of ["admin-overview.js", "admin-users.js", "admin-providers.js", "admin-gallery.js"]) {
  assert(lazyAdminScripts.includes(`/${file}`), `admin lazy route must load ${file}`);
}
for (const file of ["/admin/users.js", "/admin/prompts.js", "/admin/announcements.js", "/admin/settings.js", "/admin/canvas.js", "/admin/command-palette.js", "/admin/dashboard.js"]) {
  assert(lazyAdminScripts.includes(file), `admin lazy route must load ${file}`);
}
assert(lazyAdminScripts.indexOf("/admin-overview.js") < lazyAdminScripts.indexOf("/admin/dashboard.js"), "overview module must load before dashboard entry");
assert(lazyAdminScripts.indexOf("/admin/users.js") < lazyAdminScripts.indexOf("/admin/dashboard.js"), "users domain must load before dashboard entry");
assert(lazyAdminScripts.indexOf("/admin/canvas.js") < lazyAdminScripts.indexOf("/admin/dashboard.js"), "canvas domain must load before dashboard entry");
assert(dashboard.includes("renderAdminModule(\"overview\")"), "dashboard must delegate overview rendering");
assert(dashboard.includes("renderAdminModule(\"providers\")"), "dashboard must delegate provider rendering");
assert(dashboard.includes("renderAdminModule(\"squareReview\")"), "dashboard must delegate square review rendering");
assert(dashboard.includes("renderAdminModule(\"galleryFiles\")"), "dashboard must delegate gallery files rendering");
assert(!fs.existsSync(path.join(rootDir, "public/admin.js")), "legacy public/admin.js must be deleted");

for (const [name, content] of [["overview", overview], ["users", users], ["providers", providers]]) {
  assert(content.includes(`window.AdminModules.${name}`), `${name} module must register window.AdminModules.${name}`);
}
assert(gallery.includes("window.AdminModules.squareReview"), "gallery module must register squareReview");
assert(gallery.includes("window.AdminModules.galleryFiles"), "gallery module must register galleryFiles");
for (const [name, content] of Object.entries({ dashboard, prompts, announcements, settings, canvas, commandPalette })) {
  assert(content.split(/\r?\n/).length <= 400, `public/admin/${name}.js must stay <= 400 lines`);
}
assert(commandPalette.split(/\r?\n/).length <= 150, "public/admin/command-palette.js must stay <= 150 lines for AIS-RLS-144");
for (const token of [
  'document.documentElement.dataset.app !== "admin"',
  "adminCommandPaletteBtn",
  "primitive-modal--wide",
  'data-flavor="palette"',
  "data-command-query",
  'role="listbox"',
  "aria-selected",
  "arrowdown",
  "enter",
  "escape",
  'key === "/"',
  "localStorage",
  "admin.command.recentEntities",
  "admin.recent.users",
  "admin.recent.orders",
  "admin.recent.prompts",
  "matchMedia?.(\"(max-width: 760px)\")",
  "global.AdminCommandPalette = { register, open, close, remember }"
]) {
  assert(commandPalette.includes(token), `AIS-RLS-144 command palette missing ${token}`);
}
assert(adminHtml.includes('id="adminCommandPaletteBtn" class="btn btn--ghost btn--icon"'), "admin topbar must expose a mobile-visible command palette icon button");
for (const token of ["rememberDetail", "AdminCommandPalette?.remember?.(\"user\"", "AdminCommandPalette?.remember?.(\"order\"", "AdminCommandPalette?.remember?.(\"prompt\"", "showDetail, helpers"]) {
  assert(dashboard.includes(token), `dashboard must persist/reopen recent command entities: ${token}`);
}
for (const token of [
  ".admin-table tbody tr:hover",
  "background: color-mix(in srgb, var(--brand-50) 50%, transparent)",
  "box-shadow: inset 3px 0 var(--brand-600)",
  ".admin-command-card[data-flavor=\"palette\"]",
  ".admin-command-search",
  ".admin-command-list",
  ".admin-command-card[data-flavor=\"palette\"] footer"
]) {
  assert(shellCss.includes(token), `AIS-RLS-144 admin interaction CSS missing ${token}`);
}
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
