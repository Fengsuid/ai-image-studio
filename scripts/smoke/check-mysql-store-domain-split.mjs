#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const require = createRequire(import.meta.url);
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];
const MIN_STORE_EXPORT_COUNT = 139;

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const mysqlStore = read("src/mysql-store.js");
const userStore = read("src/stores/user-store.js");
const packageJson = JSON.parse(read("package.json"));
const { createMySQLStore } = require(path.join(root, "src/mysql-store.js"));

assert(mysqlStore.includes('require("./stores/user-store")'), "mysql-store.js must require user-store");
assert(mysqlStore.includes("const userStore = createUserStore({"), "mysql-store.js must create userStore");
for (const dependency of ["getPool", "mapUser"]) {
  assert(mysqlStore.includes(dependency), `mysql-store.js must inject ${dependency} into userStore`);
}
for (const name of ["createSession", "deleteSession", "touchSession", "getSessionUser"]) {
  assert(userStore.includes(`async function ${name}`), `user-store.js must implement ${name}`);
  assert(mysqlStore.includes(`${name}: userStore.${name}`), `mysql-store.js must export ${name} through userStore`);
  assert(!mysqlStore.includes(`async function ${name}`), `mysql-store.js should not keep ${name} implementation`);
}
assert(userStore.includes("DELETE FROM sessions WHERE expires_at <= ?"), "user-store.js must own expired session cleanup");
assert(mysqlStore.includes("deleteExpiredSessions: userStore.deleteExpiredSessions"), "mysql-store.js must export deleteExpiredSessions through userStore");
assert(mysqlStore.includes("function buildStoreFacade(exportGroups)"), "mysql-store.js must define programmatic facade builder");
assert(mysqlStore.includes("const storeExportGroups = ["), "mysql-store.js must collect exports in storeExportGroups");
assert(mysqlStore.includes("const store = buildStoreFacade(storeExportGroups);"), "mysql-store.js must build facade from export groups");
assert(mysqlStore.includes("Store export collision"), "mysql-store.js must retain duplicate export collision guard");
assert(!mysqlStore.includes("registerStoreExports("), "mysql-store.js must not use old manual registerStoreExports facade");
assert(
  packageJson.scripts?.["smoke:mysql-store-domain-split"] === "node scripts/smoke/check-mysql-store-domain-split.mjs",
  "package.json must expose smoke:mysql-store-domain-split"
);

const store = createMySQLStore();
const storeKeys = Object.keys(store);
assert(
  storeKeys.length >= MIN_STORE_EXPORT_COUNT,
  `mysql-store.js must export at least ${MIN_STORE_EXPORT_COUNT} facade methods, got ${storeKeys.length}`
);
for (const name of [
  "initializeDatabase",
  "createUser",
  "listAgentSessionsForUser",
  "insertGenerations",
  "listPublicGenerations",
  "createCanvasProject",
  "listPrompts",
  "listProviderConfigs"
]) {
  assert(typeof store[name] === "function", `mysql-store.js must expose ${name} through the facade`);
}

try {
  createMySQLStore._buildStoreFacadeForTest([
    { label: "first", source: { duplicateExport: () => "first" } },
    { label: "second", source: { duplicateExport: () => "second" } }
  ]);
  assert(false, "mysql-store.js facade builder must throw on duplicate export names");
} catch (error) {
  assert(
    error?.message?.includes("Store export collision: duplicateExport"),
    "mysql-store.js duplicate export guard must report the colliding export name"
  );
}

if (failures.length) {
  console.error("[smoke] mysql store domain split failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[smoke] mysql store domain split checks passed");
