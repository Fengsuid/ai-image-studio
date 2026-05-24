#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  mysqlStore: path.join(root, "src", "mysql-store.js"),
  userStore: path.join(root, "src", "stores", "user-store.js"),
  galleryStore: path.join(root, "src", "stores", "gallery-store.js"),
  adminStore: path.join(root, "src", "stores", "admin-store.js")
};
const source = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")])
);
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), `${label} missing ${needle}`);
}

function assertExcludes(text, pattern, label) {
  assert(!pattern.test(text), `${label} should not match ${pattern}`);
}

function lineNumbersMatching(text, pattern) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ number }) => number);
}

assertIncludes(source.mysqlStore, 'const createUserStore = require("./stores/user-store");', "mysql-store");
assertIncludes(source.mysqlStore, 'const createGalleryStore = require("./stores/gallery-store");', "mysql-store");
assertIncludes(source.mysqlStore, 'const createAdminStore = require("./stores/admin-store");', "mysql-store");
assertIncludes(source.mysqlStore, "const userStore = createUserStore({", "mysql-store");
assertIncludes(source.mysqlStore, "const galleryStore = createGalleryStore({", "mysql-store");
assertIncludes(source.mysqlStore, "const adminStore = createAdminStore({", "mysql-store");

for (const exportName of [
  "getUserByEmail",
  "listUsers",
  "reserveCredits",
  "listRewardLedger",
  "checkInToday",
  "claimFirstPublicReward",
  "awardMaturePublicRewards"
]) {
  assertIncludes(source.mysqlStore, `${exportName}: userStore.${exportName}`, "mysql-store user exports");
}

for (const exportName of [
  "listPublicGenerations",
  "setGenerationLike",
  "listGenerationLeaderboard",
  "createGenerationReport",
  "listGalleryModeration",
  "upsertGalleryFileCheck",
  "updateGenerationPublic",
  "countTodayGenerations"
]) {
  assertIncludes(source.mysqlStore, `${exportName}: galleryStore.${exportName}`, "mysql-store gallery exports");
}

for (const exportName of [
  "getSettings",
  "updateSettings",
  "listProviderConfigs",
  "writeAdminAuditLog",
  "listAdminAuditLogs",
  "listAnnouncements",
  "createAnnouncement",
  "countUnreadAnnouncements"
]) {
  assertIncludes(source.mysqlStore, `${exportName}: adminStore.${exportName}`, "mysql-store admin exports");
}

for (const pattern of [
  /async function\s+getUserByEmail\s*\(/,
  /async function\s+listUsers\s*\(/,
  /async function\s+reserveCredits\s*\(/,
  /async function\s+checkInToday\s*\(/,
  /async function\s+getSettings\s*\(/,
  /function\s+providerDbPayload\s*\(/,
  /async function\s+writeAdminAuditLog\s*\(/,
  /async function\s+listPublicGenerations\s*\(/,
  /async function\s+createGenerationReport\s*\(/,
  /async function\s+updateGenerationPublic\s*\(/
]) {
  assertExcludes(source.mysqlStore, pattern, "mysql-store");
}

const schemaRanges = [
  [650, 1080],
  [1080, 1325]
];
const migratedTableRefs = lineNumbersMatching(
  source.mysqlStore,
  /\b(users|sessions|credit_ledger|reward_ledger|user_checkins|user_daily_usage|app_settings|provider_configs|admin_audit_logs|announcements|announcement_reads|generation_reports|gallery_file_checks|generation_likes)\b/
);
const migrationStart = source.mysqlStore.indexOf("async function runMigrations()");
const migrationEnd = source.mysqlStore.indexOf("async function initializeDatabase", migrationStart);
const privateGenerationStart = source.mysqlStore.indexOf("async function listGenerationsForUser(");
const privateGenerationEnd = source.mysqlStore.indexOf("const agentSessionStore", privateGenerationStart);
for (const line of migratedTableRefs) {
  const offset = source.mysqlStore.split(/\r?\n/).slice(0, line - 1).join("\n").length;
  assert(
    schemaRanges.some(([start, end]) => line >= start && line <= end) ||
      (migrationStart >= 0 && migrationEnd > migrationStart && offset >= migrationStart && offset <= migrationEnd) ||
      (privateGenerationStart >= 0 && privateGenerationEnd > privateGenerationStart && offset >= privateGenerationStart && offset <= privateGenerationEnd),
    `mysql-store migrated table reference at line ${line} should stay in schema/migration ranges`
  );
}

for (const needle of [
  "function createUserStore({",
  "async function getUserByEmail",
  "async function createSession",
  "async function reserveCredits",
  "async function checkInToday",
  "async function claimFirstPublicReward"
]) {
  assertIncludes(source.userStore, needle, "user-store");
}

for (const needle of [
  "function createGalleryStore({",
  "async function listPublicGenerations",
  "async function setGenerationLike",
  "async function listGenerationLeaderboard",
  "async function createGenerationReport",
  "async function updateGenerationPublic"
]) {
  assertIncludes(source.galleryStore, needle, "gallery-store");
}

for (const needle of [
  "function createAdminStore({",
  "async function getSettings",
  "async function listProviderConfigs",
  "async function writeAdminAuditLog",
  "async function listAnnouncements",
  "async function createAnnouncement"
]) {
  assertIncludes(source.adminStore, needle, "admin-store");
}

for (const [label, text] of Object.entries({
  userStore: source.userStore,
  galleryStore: source.galleryStore,
  adminStore: source.adminStore
})) {
  assertExcludes(text, /require\(["']mysql2\/promise["']\)/, label);
  assertExcludes(text, /\b(req|res|next)\b/, label);
  assertExcludes(text, /\b(express|router)\b/i, label);
}

if (failures.length) {
  console.error("[user-gallery-admin-store-split] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[user-gallery-admin-store-split] ok");
