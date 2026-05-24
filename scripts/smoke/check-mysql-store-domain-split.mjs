#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const mysqlStore = read("src/mysql-store.js");
const userStore = read("src/stores/user-store.js");
const packageJson = JSON.parse(read("package.json"));

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
assert(
  packageJson.scripts?.["smoke:mysql-store-domain-split"] === "node scripts/smoke/check-mysql-store-domain-split.mjs",
  "package.json must expose smoke:mysql-store-domain-split"
);

if (failures.length) {
  console.error("[smoke] mysql store domain split failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[smoke] mysql store domain split checks passed");
