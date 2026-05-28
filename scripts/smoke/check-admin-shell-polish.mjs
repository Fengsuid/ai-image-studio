#!/usr/bin/env node
// Static guard for AIS-RLS-091 admin shell visual hierarchy polish.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const packageJson = JSON.parse(read("package.json"));
const adminHtml = read("public/admin.html");
const adminDashboard = read("public/admin/dashboard.js");
const polish = read("public/admin-shell-polish.js");
const buildManifest = JSON.parse(read("public/frontend-build-manifest.json"));
const lazyAdminScripts = buildManifest.js?.lazyRoutes?.admin?.scripts || [];
const styles = read("public/styles.css");
const adminCss = read("public/css/09-admin.css");
const shellCss = read("public/css/09-admin-shell-polish.css");
const drawerPrimitiveCss = read("public/css/primitives/_drawer.css");
const modalPrimitiveCss = read("public/css/primitives/_modal.css");
const tablePrimitiveCss = read("public/css/primitives/_table.css");

assert.equal(
  packageJson.scripts["smoke:admin-shell-polish"],
  "node scripts/smoke/check-admin-shell-polish.mjs",
  "package.json must expose smoke:admin-shell-polish"
);

assert(adminHtml.includes("/app-router.js"), "admin.html must load app-router.js");
assert(!adminHtml.includes("/admin/dashboard.js"), "admin.html must lazy-load admin dashboard through app-router");
assert(lazyAdminScripts.includes("/admin-shell-polish.js"), "admin lazy route must load admin-shell-polish.js");
assert(
  lazyAdminScripts.indexOf("/admin-shell-polish.js") < lazyAdminScripts.indexOf("/admin/dashboard.js"),
  "admin shell polish must load before dashboard entry"
);
assert(styles.includes('@import url("/css/09-admin-shell-polish.css");'), "styles.css must import admin shell polish CSS");
assert(styles.includes('@import url("/css/primitives/_drawer.css");'), "styles.css must import drawer primitive CSS");
assert(styles.includes('@import url("/css/primitives/_modal.css");'), "styles.css must import modal primitive CSS");
assert(styles.includes('@import url("/css/primitives/_table.css");'), "styles.css must import table primitive CSS");
assert(styles.indexOf("/css/primitives/_drawer.css") < styles.indexOf("/css/09-admin.css"), "drawer primitive must load before admin CSS");
for (const upstreamCss of ["/css/09-admin-diagnostics.css", "/css/10-canvas-tools.css"]) {
  assert(
    styles.indexOf(upstreamCss) < styles.indexOf("/css/09-admin-shell-polish.css"),
    `admin shell polish CSS should override ${upstreamCss}`
  );
}

for (const token of [
  'data-app="admin" data-density="compact"',
  "admin-topbar-global",
  "admin-topbar-page",
  "adminGlobalSearch",
  "adminViewSwitch",
  "adminSidebarBackdrop",
  "primitive-drawer-layer",
  "primitive-drawer",
  "primitive-pill",
  "adminNavHelp",
  'aria-controls="adminNav"'
]) {
  assert(adminHtml.includes(token), `admin.html shell scaffold missing ${token}`);
}

for (const token of [
  "window.AdminShellPolish",
  "MutationObserver",
  "admin-section-shell",
  "admin-list-meta",
  "admin-risk-strip",
  "admin-error-state",
  "admin-low-permission",
  "adminThemeToggle",
  "data-has-selection",
  "aria-hidden",
  "aria-modal"
]) {
  assert(polish.includes(token), `admin shell polish module missing ${token}`);
}

for (const token of [".primitive-drawer", ".primitive-drawer-layer.hidden", ".primitive-drawer__head", ".primitive-drawer__body"]) {
  assert(drawerPrimitiveCss.includes(token), `drawer primitive CSS missing ${token}`);
}

for (const token of [".modal-layer", ".modal", "modalIn", "ais-slide-up-sheet"]) {
  assert(modalPrimitiveCss.includes(token), `modal primitive CSS missing ${token}`);
}

assert(!read("public/css/06-gallery.css").includes("@keyframes modalIn"), "gallery CSS must not own modalIn keyframes");
assert(tablePrimitiveCss.includes(".primitive-table-wrap"), "table primitive CSS missing wrapper primitive");

for (const token of [
  "sidebarState",
  "sidebarDrawerOpen",
  "defaultSidebarState",
  "data-sidebar-state",
  "admin-sidebar-expanded",
  "admin-sidebar-collapsed",
  "admin-sidebar-drawer",
  "admin-sidebar-drawer-open",
  "adminGlobalSearch",
  "aria-hidden"
]) {
  assert(adminDashboard.includes(token), `admin dashboard sidebar shell state missing ${token}`);
}

for (const selector of [
  ".admin-section-shell",
  ".admin-list-meta",
  ".admin-risk-strip",
  ".admin-error-state",
  ".admin-table-wrap",
  ".admin-drawer-backdrop:not(.hidden)",
  ".admin-confirm-layer:not(.hidden)",
  ".admin-bulk-bar[data-has-selection=\"true\"]",
  ":root[data-theme=\"dark\"] .admin-body",
  "@media (max-width: 760px)"
]) {
  assert(shellCss.includes(selector), `admin shell polish CSS missing ${selector}`);
}

for (const token of [
  "min-height: max(700px, 100svh)",
  "grid-template-columns: 240px minmax(0, 1fr)",
  "grid-template-columns: 64px minmax(0, 1fr)",
  ".admin-topbar-row",
  ".admin-topbar-global",
  ".admin-topbar-page",
  ".admin-topbar-search",
  ".admin-page-actions",
  ".admin-sidebar-backdrop:not(.hidden)",
  "transform: translateX(-105%)",
  "admin-sidebar-drawer-open",
  ".primitive-pill",
  ".admin-sr-only"
]) {
  assert(shellCss.includes(token), `AIS-RLS-141 shell CSS missing ${token}`);
}

for (const status of [
  "queued",
  "running",
  "pending",
  "success",
  "succeeded",
  "failed",
  "cancelled",
  "blocked",
  "review",
  "allowed",
  "override_allowed",
  "reviewed",
  "error",
  "warning",
  "unknown"
]) {
  assert(adminCss.includes(`data-status="${status}"`), `admin status badge missing ${status}`);
}

assert(!adminDashboard.includes("AdminShellPolish"), "admin dashboard should not own shell polish wiring");

for (const relativePath of [
  "public/css/09-admin.css",
  "public/css/09-admin-shell-polish.css"
]) {
  const lines = read(relativePath).split(/\r?\n/).length;
  assert(lines < 500, `${relativePath} should stay below 500 lines (${lines})`);
}

console.log("[admin-shell-polish-smoke] OK");
