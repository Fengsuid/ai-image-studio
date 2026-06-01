#!/usr/bin/env node
// AIS-RLS-135 static guardrail for public topbar density. No browser, network, or DB required.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const legacyTopbarNodeCount = 61;
const maxCompactTopbarNodes = Math.floor(legacyTopbarNodeCount * 0.7);

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function headerBlock(html) {
  return html.match(/<header class="topbar"[\s\S]*?<\/header>/)?.[0] || "";
}

function countElements(html) {
  return (html.match(/<[^/!][^>]*>/g) || []).length;
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function assertHeaderButtonsUseBtn(header) {
  const interactivePattern = /<(button|a)\b[^>]*\bclass=(["'])([^"']+)\2[^>]*>/g;
  let match;
  while ((match = interactivePattern.exec(header))) {
    const classes = match[3].split(/\s+/).filter(Boolean);
    assert(classes.includes("btn"), `topbar ${match[1]} must include .btn: ${match[0].slice(0, 140)}`);
  }
}

function manifestAssetFor(sourcePath) {
  const manifest = JSON.parse(read("public/frontend-build-manifest.json"));
  return (manifest.js?.assets || []).find((asset) => asset.source === sourcePath)?.entry || "";
}

function checkSourceTopbar() {
  const indexHtml = read("public/index.html");
  const header = headerBlock(indexHtml);
  assert(header, "public/index.html must contain the public topbar header");
  assert(header.includes('data-topbar-density="compact"'), "topbar must opt into compact density");
  assert(countElements(header) <= maxCompactTopbarNodes, `topbar header has ${countElements(header)} nodes; limit is ${maxCompactTopbarNodes} for >=30% reduction`);
  assert(!/\b(?:brand-btn|nav-pill|icon-pill|dark-pill)\b/.test(header), "topbar header must not contain legacy shell button classes");
  assertHeaderButtonsUseBtn(header);

  assert(header.includes('id="brandBtn"'), "topbar must retain the logo button");
  assert(header.includes('id="topbarSearchBtn"'), "topbar must expose search as a main control");
  assert(header.includes('id="topbarGenerateBtn"'), "topbar must expose generate as a main control");
  assert(header.includes('id="promptLibraryBtn"'), "topbar must expose community/gallery as a main control");
  assert(header.includes('id="topbarCheckinBtn"'), "topbar must expose check-in as a main control");
  assert(header.includes('id="topbarCreditsBtn"'), "topbar must expose credits as a main control");
  assert(header.includes('id="themeToggle"'), "topbar must expose dark-mode toggle as a main control");
  assert(countMatches(header, /\bdata-topbar-main\b/g) === 6, "topbar must have 6 data-topbar-main controls plus logo and auth slot");
  assert(countMatches(header, /\bdata-topbar-auth\b/g) === 2, "topbar must keep login/account as one auth slot with two states");

  const overflow = indexHtml.match(/<div id="topbarOverflowMenu"[\s\S]*?<\/div>\s*<div id="accountMenu"/)?.[0] || "";
  assert(overflow, "topbar overflow menu must live outside the header");
  assert(!header.includes('id="topbarOverflowMenu"'), "topbar overflow menu must not add nodes inside the header");
  assert(overflow.includes("primitive-modal--menu"), "topbar overflow menu must use primitive-modal--menu");
  assert(countMatches(overflow, /\bdata-topbar-overflow-item\b/g) >= 3, "topbar overflow must contain at least 3 low-frequency items");
  assert(overflow.includes('role="menu"'), "topbar overflow menu must expose role=menu");
  assert(countMatches(overflow, /\brole="menuitem"/g) >= 3, "topbar overflow entries must expose role=menuitem");
  assert(header.includes('aria-controls="topbarOverflowMenu"'), "overflow trigger must point to its menu");
  assert(header.includes('aria-expanded="false"'), "menu triggers must expose aria-expanded");
}

function checkCss() {
  const homeShell = read("public/css/05-home-shell.css");
  const topbarCss = homeShell.split("/* ── Hero shell")[0] || homeShell;
  const mobileShell = read("public/css/11-mobile-shell.css");
  const leaderboardResponsive = read("public/css/06-gallery-leaderboard-responsive.css");
  assert(topbarCss.includes("max-height: 60px"), "desktop topbar must cap height at 60px");
  assert(topbarCss.includes("max-height: calc(56px + env(safe-area-inset-top))"), "mobile topbar must cap height at 56px plus safe area");
  assert(topbarCss.includes("@media (min-width: 641px) and (max-width: 1279px)"), "CSS must define the tablet overflow range");
  assert(topbarCss.includes("@media (max-width: 640px)"), "CSS must define the mobile compact range");
  assert(/\.topbar-overflow\s*{[\s\S]*?display:\s*none;/.test(topbarCss), "desktop overflow trigger must be hidden by default");
  assert(/@media \(min-width: 641px\) and \(max-width: 1279px\)[\s\S]*?\.topbar-overflow\s*{[\s\S]*?display:\s*inline-flex;/.test(topbarCss), "overflow trigger must show in the 641-1279 range");
  assert(/@media \(max-width: 640px\)[\s\S]*?\.topbar-tab,[\s\S]*?\.topbar-chip,[\s\S]*?\.topbar-icon,[\s\S]*?\.topbar-overflow,[\s\S]*?\.topbar-login span[\s\S]*?display:\s*none;/.test(topbarCss), "mobile range must hide tabs, chips, dark-mode icon, overflow, and login text");
  assert(!/#[a-fA-F0-9]{3,6}/.test(topbarCss), "topbar density CSS must not introduce hard-coded hex colors");
  assert(!/\.brand-btn|\.nav-pill|\.dark-pill|\.icon-pill/.test(mobileShell), "mobile topbar shell must not target legacy topbar classes");
  assert(leaderboardResponsive.includes('.topbar:not([data-topbar-density="compact"])'), "legacy responsive topbar stacking must skip compact topbar");
}

function checkJavaScript() {
  const app = read("public/app.js");
  const auth = read("public/app-auth.js");
  for (const snippet of [
    "topbarSearchBtn",
    "topbarGenerateBtn",
    "topbarOverflowBtn",
    "topbarOverflowMenu",
    ".topbar-overflow, #topbarOverflowMenu",
    "topbarCreditsText"
  ]) {
    assert(app.includes(snippet), `public/app.js must wire compact topbar behavior: ${snippet}`);
  }
  assert(auth.includes("topbarCheckinBtn") && auth.includes("topbarCreditsBtn"), "public/app-auth.js must wire topbar check-in and credits actions");
}

function checkDist() {
  const manifestPath = "public/frontend-build-manifest.json";
  assert(exists(manifestPath), "frontend build manifest must exist before topbar density smoke");
  const manifest = JSON.parse(read(manifestPath));
  const cssEntry = manifest.css?.entry || "";
  assert(/^\/dist\/app\.[a-f0-9]{12}\.css$/.test(cssEntry), "frontend manifest must point to hashed CSS");
  const cssPath = `public/${cssEntry.slice(1)}`;
  assert(exists(cssPath), `hashed CSS is missing: ${cssEntry}`);
  const css = exists(cssPath) ? read(cssPath) : "";
  for (const snippet of ["topbar-brand", "topbar-overflow-menu", "data-topbar-density", "max-width: 1279px", "max-width: 640px"]) {
    assert(css.includes(snippet), `hashed CSS must include compact topbar rule: ${snippet}`);
  }

  const appEntry = manifestAssetFor("/app.js");
  const authEntry = manifestAssetFor("/app-auth.js");
  assert(/^\/dist\/app\.[a-f0-9]{12}\.js$/.test(appEntry), "frontend manifest must expose hashed app.js");
  assert(/^\/dist\/app-auth\.[a-f0-9]{12}\.js$/.test(authEntry), "frontend manifest must expose hashed app-auth.js");
  const appDist = appEntry ? read(`public/${appEntry.slice(1)}`) : "";
  const authDist = authEntry ? read(`public/${authEntry.slice(1)}`) : "";
  for (const snippet of ["topbarSearchBtn", "topbarGenerateBtn", "topbarOverflowMenu", "topbarCreditsText"]) {
    assert(appDist.includes(snippet), `hashed app.js must include compact topbar behavior: ${snippet}`);
  }
  assert(authDist.includes("topbarCheckinBtn") && authDist.includes("topbarCreditsBtn"), "hashed app-auth.js must include topbar auth actions");
}

checkSourceTopbar();
checkCss();
checkJavaScript();
checkDist();

if (failures.length) {
  console.error("[topbar-density-smoke] failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[topbar-density-smoke] OK: compact topbar source, CSS, JS, and hashed dist passed");
