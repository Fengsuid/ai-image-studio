#!/usr/bin/env node
// Static smoke for configurable public-work reward policy and no-user-unpublish UX.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const server = read("server.js");
const mysqlStore = read("src/mysql-store.js");
const adminRoute = read("src/routes/admin.js");
const userStore = read("src/stores/user-store.js");
const app = read("public/app.js");
const admin = read("public/admin.js");
const html = read("public/index.html");
const rewardPolicy = read("public/app-reward-policy.js");
const pkg = JSON.parse(read("package.json"));

for (const field of [
  "first_public_reward_credit",
  "public_reward_hold_minutes",
  "public_unpublish_allowed",
  "public_reward_notifications_enabled"
]) {
  assert(mysqlStore.includes(field), `mysql-store must migrate ${field}`);
}

assert(server.includes("notifyPublicRewardLocked"), "server must notify when first public reward locks");
assert(server.includes("notifyPublicRewardAwarded"), "server must notify when first public reward is awarded");
assert(server.includes("minAgeMinutes"), "server/user-store must award public rewards by minutes, not fixed hours");
assert(server.includes("publicUnpublishDisabled"), "server must reject user unpublish when policy disables it");
assert(adminRoute.includes("publicRewardHoldMinutes"), "admin settings route must save publicRewardHoldMinutes");
assert(adminRoute.includes("publicUnpublishAllowed"), "admin settings route must save publicUnpublishAllowed");
assert(userStore.includes("Public reward hold elapsed"), "reward ledger note must be policy-generic");
assert(admin.includes('name="firstPublicRewardCredit"'), "admin UI must expose reward credit input");
assert(admin.includes('name="publicRewardHoldMinutes"'), "admin UI must expose reward hold minutes input");
assert(admin.includes('name="publicUnpublishAllowed"'), "admin UI must expose user unpublish toggle");
assert(html.includes("app-reward-policy.js"), "index must load app reward policy module");
assert(rewardPolicy.includes("ImageStudioRewardPolicy"), "reward policy module must register global helper");
assert(app.includes("ImageStudioRewardPolicy?.confirmPublish"), "publish flow must confirm reward/no-unpublish policy before publishing");
assert(app.includes("canUserUnpublishPublicWork"), "app must hide/guard unpublish controls by policy");
assert(pkg.scripts?.["smoke:public-reward-policy"] === "node scripts/smoke/check-public-reward-policy.mjs", "package.json must expose smoke:public-reward-policy");

console.log("[public-reward-policy] OK");
