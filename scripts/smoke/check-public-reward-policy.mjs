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
const adminRoute = read("src/routes/admin/settings.js");
const userStore = read("src/stores/user-store.js");
const app = read("public/app.js");
const adminDashboard = read("public/admin/dashboard.js");
const adminSettings = read("public/admin-settings.js");
const html = read("public/index.html");
const adminHtml = read("public/admin.html");
const rewardPolicy = read("public/app-reward-policy.js");
const buildManifest = JSON.parse(read("public/frontend-build-manifest.json"));
const lazyAdminScripts = buildManifest.js?.lazyRoutes?.admin?.scripts || [];
const pkg = JSON.parse(read("package.json"));

function scriptPosition(htmlSource, scriptName) {
  const plainIndex = htmlSource.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return htmlSource.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`))?.index ?? -1;
}

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
assert(adminSettings.includes('name="firstPublicRewardCredit"'), "admin settings module must expose reward credit input");
assert(adminSettings.includes('name="publicRewardHoldMinutes"'), "admin settings module must expose reward hold minutes input");
assert(adminSettings.includes('name="publicUnpublishAllowed"'), "admin settings module must expose user unpublish toggle");
assert(scriptPosition(html, "app-reward-policy.js") >= 0, "index must load app reward policy module");
assert(adminHtml.includes("app-router.js"), "admin must load app-router module");
assert(lazyAdminScripts.includes("/admin-settings.js"), "admin lazy route must load settings module");
assert(rewardPolicy.includes("ImageStudioRewardPolicy"), "reward policy module must register global helper");
assert(adminDashboard.includes('renderAdminModule("settings")'), "admin settings page must render through AdminModules.settings");
assert(app.includes("ImageStudioRewardPolicy?.confirmPublish"), "publish flow must confirm reward/no-unpublish policy before publishing");
assert(app.includes("canUserUnpublishPublicWork"), "app must hide/guard unpublish controls by policy");
assert(pkg.scripts?.["smoke:public-reward-policy"] === "node scripts/smoke/check-public-reward-policy.mjs", "package.json must expose smoke:public-reward-policy");

console.log("[public-reward-policy] OK");
