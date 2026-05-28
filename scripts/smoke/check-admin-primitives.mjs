#!/usr/bin/env node
// Static guard for AIS-RLS-142 admin table/drawer/modal primitives.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const packageJson = JSON.parse(read("package.json"));
const styles = read("public/styles.css");
const tableCss = read("public/css/primitives/_table.css");
const drawerCss = read("public/css/primitives/_drawer.css");
const modalCss = read("public/css/primitives/_modal.css");
const galleryCss = read("public/css/06-gallery.css");
const adminHtml = read("public/admin.html");
const indexHtml = read("public/index.html");
const app = read("public/app.js");
const admin = read("public/admin.js");
const adminUsers = read("public/admin-users.js");
const adminDiagnostics = read("public/admin-generation-diagnostics.js");

assert.equal(
  packageJson.scripts["smoke:admin-primitives"],
  "node scripts/smoke/check-admin-primitives.mjs",
  "package.json must expose smoke:admin-primitives"
);

for (const primitive of [
  "/css/primitives/_button.css",
  "/css/primitives/_table.css",
  "/css/primitives/_drawer.css",
  "/css/primitives/_modal.css",
  "/css/03-layout-app-shell.css"
]) {
  assert(styles.includes(primitive), `styles.css must import ${primitive}`);
}
assert(styles.indexOf("/css/primitives/_button.css") < styles.indexOf("/css/03-layout-app-shell.css"), "primitive layer must stay before layout");
assert(styles.indexOf("/css/primitives/_modal.css") < styles.indexOf("/css/03-layout-app-shell.css"), "modal primitive must stay before layout");

for (const token of [
  ".primitive-table",
  "position: sticky",
  "data-density=\"compact\"",
  "data-density=\"comfortable\"",
  ".primitive-table__empty",
  ".primitive-table__shimmer",
  "@keyframes primitiveTableShimmer",
  ".primitive-table--bulk",
  ".primitive-table-bulk-bar",
  "box-shadow: var(--shadow-lg"
]) {
  assert(tableCss.includes(token), `table primitive missing ${token}`);
}

for (const token of [
  ".primitive-drawer",
  ".primitive-drawer--bottom-sheet",
  ".primitive-drawer__tabs",
  ".primitive-drawer__body",
  "overflow: auto",
  "max-height: calc(100svh - 56px)"
]) {
  assert(drawerCss.includes(token), `drawer primitive missing ${token}`);
}

for (const token of [
  ".primitive-modal-layer",
  ".primitive-modal",
  ".primitive-modal--wide",
  ".primitive-modal--split",
  ".primitive-modal--keep-centered",
  "@keyframes modalIn",
  "@keyframes ais-slide-up-sheet",
  ".modal-layer",
  ".primitive-modal:not(.primitive-modal--keep-centered):not(.primitive-modal--split)::before",
  "max-width: 640px",
  "border-radius: var(--radius-xl) var(--radius-xl) 0 0",
  "max-height: calc(100svh - 56px)",
  "grid-template-columns: 1fr"
]) {
  assert(modalCss.includes(token), `modal primitive missing ${token}`);
}
assert(!galleryCss.includes("@keyframes modalIn"), "06-gallery.css must not define modalIn");
assert.equal((`${tableCss}\n${drawerCss}\n${modalCss}\n${galleryCss}`.match(/@keyframes\s+modalIn/g) || []).length, 1, "modalIn must be defined exactly once in primitive modal CSS");

for (const token of [
  "primitive-drawer-layer",
  "admin-drawer primitive-drawer"
]) {
  assert(adminHtml.includes(token), `admin.html must consume drawer primitive: ${token}`);
}

assert(indexHtml.includes("modal-layer primitive-modal-layer"), "public modal layer must consume primitive modal layer");
for (const token of [
  "primitive-modal",
  "primitive-modal--split",
  "primitive-modal--wide",
  "primitive-modal--keep-centered"
]) {
  assert(app.includes(token), `openModal must apply ${token}`);
}

for (const [label, source, tokens] of [
  ["users", adminUsers, ["primitive-table--bulk", "primitive-table-bulk-bar", "admin-user-table", "data-density=\"compact\""]],
  ["prompts", admin, ["提示词 CMS", "primitive-table", "data-detail=\"prompt:"]],
  ["requests", adminDiagnostics, ["生成请求诊断", "primitive-table", "data-detail=\"request:"]],
  ["announcements", admin, ["通知公告", "primitive-table", "data-detail=\"announcement:"]]
]) {
  for (const token of tokens) {
    assert(source.includes(token), `${label} admin list must consume primitive table token: ${token}`);
  }
}

for (const token of [
  "primitive-drawer__head",
  "primitive-drawer__body",
  "primitive-table__empty"
]) {
  assert(admin.includes(token), `admin.js must consume ${token}`);
}

console.log("[admin-primitives-smoke] OK");
