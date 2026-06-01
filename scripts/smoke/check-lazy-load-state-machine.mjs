#!/usr/bin/env node
// Static + simulated DOM smoke for AIS-RLS-126 lazy route state machine.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const routerSource = read("public/app-router.js");
const packageJson = JSON.parse(read("package.json"));
const skeletonCss = read("public/css/04-components-skeleton.css");
const indexHtml = read("public/index.html");
const adminHtml = read("public/admin.html");
const manifest = JSON.parse(read("public/frontend-build-manifest.json"));

assert.equal(packageJson.scripts["smoke:lazy-load-state-machine"], "node scripts/smoke/check-lazy-load-state-machine.mjs");
for (const token of [
  "const routeStates = new Map()",
  "const scriptStates = new Map()",
  "status: \"idle\"",
  "updateState(routeStates, name, \"loading\"",
  "updateState(routeStates, name, \"ready\"",
  "updateState(routeStates, name, \"error\"",
  "updateState(scriptStates",
  "renderRouteLoading",
  "route-loading-shell",
  "renderRouteError",
  "data-route-retry",
  "retryRoute",
  "script.defer = true",
  "script.async = false",
  "ensureAdmin"
]) {
  assert(routerSource.includes(token), `app-router.js missing ${token}`);
}
assert(skeletonCss.includes(".route-loading-shell"), "skeleton CSS must style route loading shell");
assert(skeletonCss.includes(".route-error-shell"), "skeleton CSS must style route error shell");
assert(adminHtml.includes("20260601-lazy-load-state-machine-v1"), "admin route cache-bust version must be bumped");
assert(indexHtml.includes("/dist/app-router."), "public index must load hashed app-router");
assert(manifest.js.assets.some((asset) => asset.source === "/app-router.js"), "manifest must include app-router asset");

class FakeElement {
  constructor(tagName = "div", ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this._innerHTML = "";
    this.parentNode = null;
    this.id = "";
    this.src = "";
    this.async = true;
    this.defer = false;
  }
  set innerHTML(value) { this._innerHTML = String(value); }
  get innerHTML() { return this._innerHTML; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "src") this.src = String(value);
    if (name === "id") this.id = String(value);
  }
  getAttribute(name) {
    if (name === "src") return this.src;
    return this.attributes.get(name) || "";
  }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  dispatch(type) {
    for (const handler of this.listeners.get(type) || []) handler({ target: this, currentTarget: this });
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    if (child.tagName === "SCRIPT") this.ownerDocument.scripts.push(child);
    return child;
  }
  closest(selector) {
    if (selector === "[data-route-retry]" && this.dataset.routeRetry) return this;
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.scripts = [];
    this.elements = new Map();
    this.documentElement = new FakeElement("html", this);
    this.head = new FakeElement("head", this);
    this.currentScript = new FakeElement("script", this);
    this.currentScript.dataset.routeEntry = "admin";
    this.register("adminContent", new FakeElement("section", this));
  }
  createElement(tagName) { return new FakeElement(tagName, this); }
  getElementById(id) { return this.elements.get(id) || null; }
  register(id, element) {
    element.id = id;
    element.ownerDocument = this;
    this.elements.set(id, element);
    return element;
  }
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  dispatchEvent(event) {
    for (const handler of this.listeners.get(event.type) || []) handler(event);
    return true;
  }
}

async function waitFor(predicate, label) {
  const started = Date.now();
  while (Date.now() - started < 2000) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const document = new FakeDocument();
const events = [];
const errors = [];
const window = {
  document,
  location: { href: "https://example.invalid/admin", pathname: "/admin", hash: "#users" },
  AppModules: {
    build: {
      js: {
        lazyRoutes: {
          admin: { scripts: ["/admin/dashboard.js"] }
        },
        assets: [
          { source: "/admin/dashboard.js", entry: "/dist/admin-dashboard.test.js" }
        ]
      }
    },
    register(name, module) {
      this[name] = module;
    }
  },
  ImageStudioClientErrorMonitor: { report: (payload) => errors.push(payload) },
  addEventListener() {},
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail || {};
    }
  },
  console
};
document.addEventListener("imagestudio:route-state", (event) => events.push(event.detail));
vm.runInNewContext(routerSource, { window, document, CustomEvent: window.CustomEvent, console });

const adminContent = document.getElementById("adminContent");
await waitFor(() => adminContent.innerHTML.includes("route-loading-shell"), "loading skeleton");
assert.equal(window.ImageStudioRouter.routeStatus("admin").status, "loading");
const firstScript = document.scripts.find((script) => script.dataset.routeSource === "/admin/dashboard.js");
assert(firstScript, "admin dashboard script should be injected");
assert.equal(firstScript.async, false, "dynamic script async must be false");
assert.equal(firstScript.defer, true, "dynamic script defer must be true");
firstScript.dispatch("error");
await waitFor(() => window.ImageStudioRouter.routeStatus("admin").status === "error", "error state");
assert(adminContent.innerHTML.includes("route-error-shell"), "error shell must render");
assert(adminContent.innerHTML.includes("data-route-retry=\"admin\""), "error shell must include retry button");
assert(errors.some((payload) => payload.routeSource === "admin"), "load failure must report through client-error monitor");

window.AppModules.AdminModules = { ready: true };
const retryPromise = window.ImageStudioRouter.retryRoute("admin");
await waitFor(() => document.scripts.filter((script) => script.dataset.routeSource === "/admin/dashboard.js").length === 2, "retry script injection");
const retryScript = document.scripts.at(-1);
retryScript.dispatch("load");
await retryPromise;
assert.equal(window.ImageStudioRouter.routeStatus("admin").status, "ready");
assert.equal(window.ImageStudioRouter.scriptStatus("/admin/dashboard.js").status, "ready");
assert(events.some((event) => event.status === "loading"), "state events must include loading");
assert(events.some((event) => event.status === "error"), "state events must include error");
assert(events.some((event) => event.status === "ready"), "state events must include ready");
assert.equal(adminContent.dataset.routeState, "ready", "ready state should clear the gate");

console.log("[lazy-load-state-machine-smoke] OK");
