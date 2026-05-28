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
const envExample = read(".env.example");
const packageJson = JSON.parse(read("package.json"));

for (const token of [
  'intEnv("MYSQL_PORT", 3306, { min: 1, max: 65535 })',
  'boolEnv("MYSQL_WAIT_FOR_CONNECTIONS", true)',
  'intEnv("MYSQL_CONNECTION_LIMIT", 10, { min: 1 })',
  'intEnv("MYSQL_MAX_IDLE", connectionLimit, { min: 1, max: connectionLimit })',
  'intEnv("MYSQL_IDLE_TIMEOUT_MS", 60000, { min: 1000 })',
  'intEnv("MYSQL_QUEUE_LIMIT", 0, { min: 0 })',
  'intEnv("MYSQL_CONNECT_TIMEOUT_MS", 10000, { min: 1000 })',
  'intEnv("MYSQL_SLOW_QUERY_MS", 1000, { min: 0 })',
  'intEnv("MYSQL_MIGRATION_WARN_MS", 10000, { min: 0 })'
]) {
  assert(mysqlStore.includes(token), `mysql-store.js must retain pool health config: ${token}`);
}

for (const token of [
  "waitForConnections: config.waitForConnections",
  "connectionLimit: config.connectionLimit",
  "maxIdle: config.maxIdle",
  "idleTimeout: config.idleTimeout",
  "queueLimit: config.queueLimit",
  "connectTimeout: config.connectTimeout",
  "instrumentMysqlPool(pool, config.slowQueryMs)",
  "config.migrationWarnMs > 0",
  "slow mysql query",
  "slow mysql pool checkout",
  "mysql migrations completed slowly"
]) {
  assert(mysqlStore.includes(token), `mysql-store.js must keep mysql health instrumentation: ${token}`);
}

for (const token of [
  "MYSQL_WAIT_FOR_CONNECTIONS=true",
  "MYSQL_CONNECTION_LIMIT=10",
  "MYSQL_MAX_IDLE=10",
  "MYSQL_IDLE_TIMEOUT_MS=60000",
  "MYSQL_QUEUE_LIMIT=0",
  "MYSQL_CONNECT_TIMEOUT_MS=10000",
  "MYSQL_SLOW_QUERY_MS=1000",
  "MYSQL_MIGRATION_WARN_MS=10000"
]) {
  assert(envExample.includes(token), `.env.example must document ${token}`);
}

assert(
  packageJson.scripts?.["smoke:mysql-health-config"] === "node scripts/smoke/check-mysql-health-config.mjs",
  "package.json must expose smoke:mysql-health-config"
);

if (failures.length) {
  console.error("[mysql-health-config-smoke] FAIL:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[mysql-health-config-smoke] OK");
