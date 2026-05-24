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
const admin = read("public/admin.js");
const polish = read("public/admin-shell-polish.js");
const styles = read("public/styles.css");
const adminCss = read("public/css/09-admin.css");
const shellCss = read("public/css/09-admin-shell-polish.css");

assert.equal(
  packageJson.scripts["smoke:admin-shell-polish"],
  "node scripts/smoke/check-admin-shell-polish.mjs",
  "package.json must expose smoke:admin-shell-polish"
);

assert(adminHtml.includes("/admin-shell-polish.js"), "admin.html must load admin-shell-polish.js");
assert(
  adminHtml.indexOf("/admin-shell-polish.js") < adminHtml.indexOf("/admin.js"),
  "admin shell polish must load before admin.js"
);
assert(styles.includes('@import url("/css/09-admin-shell-polish.css");'), "styles.css must import admin shell polish CSS");
assert(
  styles.indexOf("/css/09-admin-diagnostics.css") < styles.indexOf("/css/09-admin-shell-polish.css"),
  "admin shell polish CSS should override base admin diagnostics CSS"
);

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

assert(!admin.includes("AdminShellPolish"), "public/admin.js should not own shell polish wiring");

for (const relativePath of [
  "public/css/09-admin.css",
  "public/css/09-admin-shell-polish.css"
]) {
  const lines = read(relativePath).split(/\r?\n/).length;
  assert(lines < 500, `${relativePath} should stay below 500 lines (${lines})`);
}

console.log("[admin-shell-polish-smoke] OK");
