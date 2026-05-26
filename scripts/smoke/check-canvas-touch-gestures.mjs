#!/usr/bin/env node
// Verifies Canvas v2 editor uses the unified Pointer Events API (which natively
// handles touch + mouse + pen) and configures wheel/pinch zoom with a
// non-passive listener so preventDefault() works on mobile pinch gestures.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readText(relativePath) {
  return readFile(join(rootDir, relativePath), "utf8");
}

const controller = await readText("apps/canvas-v2/src/editor/dom-controller.js");
const view = await readText("apps/canvas-v2/src/editor/view.js");
const styles = await readText("apps/canvas-v2/src/styles.css");

// Required pointer event coverage on the editor root.
const requiredListeners = ["pointerdown", "pointermove", "pointerup"];
for (const event of requiredListeners) {
  if (!new RegExp(`addEventListener\\(\\s*["']${event}["']`).test(controller)) {
    fail(`apps/canvas-v2/src/editor/dom-controller.js must attach a ${event} listener`);
  }
}

// Wheel handler must be non-passive so pinch/scroll zoom can preventDefault().
const wheelPassiveMatch = controller.match(/addEventListener\(\s*["']wheel["'][^)]*\)/);
if (!wheelPassiveMatch) {
  fail("apps/canvas-v2/src/editor/dom-controller.js must attach a wheel listener");
} else if (!/passive\s*:\s*false/.test(wheelPassiveMatch[0])) {
  fail("wheel listener must opt out of passive mode (passive: false) so pinch/zoom preventDefault works");
}

// preventDefault must be called inside the wheel handler.
if (!/wheel|onWheel/.test(controller) || !/preventDefault\(\)/.test(controller)) {
  fail("wheel handler must call event.preventDefault() to suppress page-level pinch-zoom on touch devices");
}

// Forbid mouse-only listeners that would break touch — pointer events should cover everything.
const mouseOnlyListeners = ["mousedown", "mousemove", "mouseup"];
for (const event of mouseOnlyListeners) {
  if (new RegExp(`addEventListener\\(\\s*["']${event}["']`).test(controller)) {
    fail(`apps/canvas-v2/src/editor/dom-controller.js should rely on pointer events instead of ${event} (excludes touch)`);
  }
}

// Editor view must declare touch-action so the browser hands gestures to JS rather than scrolling.
if (!/touch-action/i.test(view) && !/touch-action/i.test(controller) && !/touch-action/i.test(styles)) {
  fail("editor must set CSS touch-action (e.g. touch-action: none) on the stage so pinch/pan reach JS handlers");
}

// Pointer ID tracking is required for multi-touch (pinch) tracking — at minimum the controller should
// read event.pointerId or event.pointerType to differentiate touch from mouse/pen.
if (!/pointerId|pointerType/.test(controller)) {
  fail("dom-controller should track pointerId or pointerType to handle multi-touch / pen gestures");
}

if (failures.length) {
  console.error("[canvas-touch-gestures] FAIL:");
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}

console.log("[canvas-touch-gestures] OK: pointer events, non-passive wheel, touch-action, and pointer tracking verified");
