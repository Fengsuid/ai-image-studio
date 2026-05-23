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
const packageJson = JSON.parse(read("package.json"));

assert.equal(packageJson.scripts["smoke:admin-module-split"], "node scripts/smoke/check-admin-module-split.mjs", "package.json must expose smoke:admin-module-split");
for (const file of ["admin-overview.js", "admin-users.js", "admin-providers.js", "admin-gallery.js"]) {
  assert(adminHtml.includes(`/${file}`), `admin.html must load ${file}`);
}
assert(adminHtml.indexOf("/admin-overview.js") < adminHtml.indexOf("/admin.js"), "overview module must load before admin.js");
assert(adminHtml.indexOf("/admin-users.js") < adminHtml.indexOf("/admin.js"), "users module must load before admin.js");
assert(adminHtml.indexOf("/admin-providers.js") < adminHtml.indexOf("/admin.js"), "providers module must load before admin.js");
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

console.log("[admin-module-split-smoke] OK");
