#!/usr/bin/env node
// Static and pure-function smoke for incremental maintenance module boundaries.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const store = fs.readFileSync(path.join(rootDir, "src/mysql-store.js"), "utf8");
const healthSource = fs.readFileSync(path.join(rootDir, "src/routes/health.js"), "utf8");
const tagStoreSource = fs.readFileSync(path.join(rootDir, "src/stores/tag-store.js"), "utf8");
const { createHealthRoute } = require(path.join(rootDir, "src/routes/health.js"));
const createTagStore = require(path.join(rootDir, "src/stores/tag-store.js"));

const writes = [];
const rumEvents = [];
let readCount = 0;
const routeHealth = createHealthRoute({
  appVersion: "smoke-version",
  imageDownloadTimeoutMs: 456,
  nowIso: () => "2026-05-23T00:00:00.000Z",
  openaiFetchTimeoutMs: 123,
  publicSettings: (settings, activeProvider) => ({ settings, activeProvider }),
  readJsonBody: async () => {
    readCount += 1;
    return {
      name: "largest-contentful-paint",
      value: 42,
      path: "/",
      detail: { source: "smoke" }
    };
  },
  rumEvents,
  sendJson: (res, status, payload) => writes.push({ type: "json", status, payload }),
  sendNoContent: () => writes.push({ type: "empty", status: 204 }),
  serverStartedAt: "2026-05-23T00:00:00.000Z",
  store: {
    countUsers: async () => 0,
    getDefaultProviderConfig: async () => ({ id: "prov_default" }),
    getSettings: async () => ({ allowRegistration: true })
  }
});

assert.equal(await routeHealth({ method: "POST", headers: { "user-agent": "maintenance-smoke" } }, {}, new URL("http://local/api/csp-report")), true);
assert.equal(writes.at(-1).status, 204, "CSP reports should return no-content");
assert.equal(readCount, 1, "CSP reports should consume the JSON body");
assert.equal(rumEvents.length, 1, "CSP reports should be retained in the shared RUM buffer");
assert.equal(rumEvents[0].name, "csp_report");

assert.equal(await routeHealth({ method: "POST" }, {}, new URL("http://local/api/rum")), true);
assert.equal(writes.at(-1).status, 204, "RUM reports should return no-content");
assert.equal(rumEvents.length, 2, "RUM reports should be retained in the injected buffer");
assert.equal(rumEvents[1].name, "largest-contentful-paint");
assert.equal(rumEvents[1].createdAt, "2026-05-23T00:00:00.000Z");

assert.equal(await routeHealth({ method: "GET" }, {}, new URL("http://local/api/version")), true);
assert.equal(writes.at(-1).payload.version, "smoke-version", "version route should use injected metadata");
assert.equal(writes.at(-1).payload.timeoutMs.openai, 123);

assert.equal(await routeHealth({ method: "GET" }, {}, new URL("http://local/api/health")), true);
assert.equal(writes.at(-1).payload.firstRun, true, "health route should expose first-run state");
assert.equal(writes.at(-1).payload.settings.activeProvider.id, "prov_default");

assert.equal(await routeHealth({ method: "GET" }, {}, new URL("http://local/api/auth/me")), false);

assert(server.includes('require("./src/routes/health")'), "server must require extracted health routes");
assert(server.includes("if (await handleHealthRoute(req, res, url)) return;"), "health routes must run before CSRF");
assert(server.indexOf("handleHealthRoute(req, res, url)") < server.indexOf("verifyCsrf(req);"), "reporting routes must keep their no-CSRF behavior");
assert(!server.includes('url.pathname === "/api/version"'), "version route should not remain inline in server.js");
assert(!server.includes('url.pathname === "/api/rum"'), "RUM route should not remain inline in server.js");
assert(healthSource.includes("createHealthRoute"), "health route module must expose a route factory");

const tagStore = createTagStore({
  getPool: () => {
    throw new Error("maintenance boundary smoke should not touch the database");
  },
  toIso: (value) => value || null,
  mapPromptCategory: (row) => row || null
});

for (const method of [
  "seedPromptCategories",
  "seedPromptSources",
  "listPromptCategories",
  "getPromptCategoryBySlug",
  "upsertPromptCategory",
  "listTags",
  "getTagBySlug",
  "countTags",
  "findTagByAlias",
  "createTag",
  "updateTag",
  "hideTag",
  "mergeTag",
  "migrateTagJsonSlugs",
  "incrementTagUsage",
  "seedTagsIfEmpty"
]) {
  assert.equal(typeof tagStore[method], "function", `tag store must expose ${method}`);
  assert(store.includes(`${method}: tagStore.${method}`) || store.includes(`tagStore.${method}()`), `mysql-store must bridge ${method}`);
}

assert(store.includes('require("./stores/tag-store")'), "mysql-store must require the extracted tag store");
assert(tagStoreSource.includes("SYSTEM_TAG_SEED"), "tag store should own gallery tag seed data");
assert(!store.includes("const SYSTEM_TAG_SEED = ["), "mysql-store should no longer own gallery tag seed data");

console.log("[maintenance-boundaries] OK: health routes and tag store are extracted and wired");
