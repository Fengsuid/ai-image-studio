#!/usr/bin/env node
// Static coverage guard for AIS-RLS-116 unified list skeletons.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const app = read("public/app.js");
const styles = read("public/styles.css");
const skeletonCss = read("public/css/04-components-skeleton.css");

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} must exist`);
  const open = source.indexOf("{", start);
  assert(open >= 0, `${name} must have a body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${name} body is not closed`);
}

function assertBefore(body, earlier, later, message) {
  const earlierIndex = body.indexOf(earlier);
  const laterIndex = body.indexOf(later);
  assert(earlierIndex >= 0, `${message}: missing ${earlier}`);
  assert(laterIndex >= 0, `${message}: missing ${later}`);
  assert(earlierIndex < laterIndex, message);
}

assert(app.includes("function renderSkeleton("), "app.js must define renderSkeleton");
assert(app.includes("function renderInitialListSkeletons("), "app.js must define initial skeleton gate");
assert(app.includes("class=\"skeleton-card skeleton-card-${safeVariant} anim-shimmer\""), "renderSkeleton cards must use .anim-shimmer");
assert(app.includes("data-skeleton-list"), "renderSkeleton must mark list skeleton output for static and DOM checks");
assert(app.includes("renderInitialListSkeletons();"), "bootstrap must render initial skeletons before auth/network awaits");

const loadHistory = functionBody(app, "loadHistory");
assertBefore(loadHistory, "renderSkeleton(elements.historyList", "await api(\"/api/images/history", "history list skeleton must render before history fetch");
assertBefore(loadHistory, "renderSkeleton(elements.imageSessionList", "await api(\"/api/images/history", "session list skeleton must render before history fetch");

const loadPromptLibrary = functionBody(app, "loadPromptLibrary");
assertBefore(loadPromptLibrary, "renderSkeleton(elements.promptGrid", "await api(state.user?.role === \"admin\"", "prompt grid skeleton must render before prompt API fetch");

const renderLibrary = functionBody(app, "renderLibrary");
assert(renderLibrary.includes("if (state.promptLoading)"), "renderLibrary must branch on prompt loading state");
assert(renderLibrary.includes("renderSkeleton(elements.promptGrid"), "renderLibrary loading branch must use renderSkeleton");

const loadPublicGallery = functionBody(app, "loadPublicGallery");
assertBefore(loadPublicGallery, "renderSkeleton(elements.recentMasonry", "await api(\"/api/images/public", "recent creations skeleton must render before public gallery fetch");

const loadGalleryLeaderboard = functionBody(app, "loadGalleryLeaderboard");
assertBefore(loadGalleryLeaderboard, "renderSkeleton(elements.leaderboardPage", "await api(`/api/gallery/leaderboard", "leaderboard skeleton must render before leaderboard fetch");

for (const snippet of [
  "renderSkeleton(elements.imageSessionList",
  "renderSkeleton(elements.historyList",
  "renderSkeleton(elements.recentMasonry",
  "renderSkeleton(elements.promptGrid",
  "renderSkeleton(elements.leaderboardPage"
]) {
  assert(functionBody(app, "renderInitialListSkeletons").includes(snippet), `initial skeleton gate missing ${snippet}`);
}

assert(styles.includes('/css/04-components-skeleton.css'), "styles.css must import the skeleton CSS module");
for (const selector of [
  ".skeleton-list",
  ".skeleton-card",
  ".skeleton-thumb",
  ".skeleton-line"
]) {
  assert(skeletonCss.includes(selector), `skeleton CSS missing ${selector}`);
}
assert(skeletonCss.includes(".skeleton-list-card"), "skeleton CSS must support card grids");
assert(skeletonCss.includes(".skeleton-list-compact"), "skeleton CSS must support compact session lists");
assert(skeletonCss.includes(".skeleton-list-rank"), "skeleton CSS must support leaderboard lists");

console.log("[skeleton-coverage-smoke] OK: unified renderSkeleton coverage is present");
