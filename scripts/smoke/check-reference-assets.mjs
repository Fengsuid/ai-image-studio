#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertIncludes(source, tokens, label) {
  for (const token of tokens) {
    assert(source.includes(token), `${label} must include ${token}`);
  }
}

const packageJson = readJson("package.json");
const appSettings = read("src/config/app-settings.js");
const frontendSource = read("src/frontend/app-build-manifest.mjs");
const manifest = readJson("public/frontend-build-manifest.json");
const mysqlStore = read("src/mysql-store.js");
const galleryStore = read("src/stores/gallery-store.js");
const referenceRoute = read("src/routes/reference-assets.js");
const imagesGenerate = read("src/routes/images-generate.js");
const imagesRoute = read("src/routes/images.js");
const galleryRoute = read("src/routes/gallery.js");
const adminModerationRoute = read("src/routes/admin/moderation.js");
const server = read("server.js");
const app = read("public/app.js");
const appAuth = read("public/app-auth.js");
const referenceImages = read("public/reference-images.js");
const galleryNormalize = read("public/gallery-normalize.js");
const renderStamp = read("public/render-stamp.js");
const referenceAssetsCss = read("public/css/04-reference-assets.css");
const galleryCss = read("public/css/06-gallery.css");

assert(
  packageJson.scripts?.["smoke:reference-assets"] === "node scripts/smoke/check-reference-assets.mjs",
  "package.json must expose smoke:reference-assets"
);
assert(
  packageJson.scripts?.check?.includes("npm run smoke:reference-assets"),
  "npm run check must include smoke:reference-assets"
);
assertIncludes(appSettings, [
  'REFERENCE_ASSET_DIR',
  'APP_VERSION = process.env.APP_VERSION || "20260531-reference-assets-v1"'
], "app settings");
assertIncludes(frontendSource, [
  'FRONTEND_BUILD_VERSION = "20260531-reference-assets-v1"'
], "frontend source manifest");
assert(manifest.version === "20260531-reference-assets-v1", "built frontend manifest version must match AIS-RLS-121");

assertIncludes(mysqlStore, [
  "CREATE TABLE IF NOT EXISTS reference_assets",
  "CREATE TABLE IF NOT EXISTS generation_reference_assets",
  "INDEX idx_reference_assets_user_created (user_id, created_at)",
  "INDEX idx_reference_assets_sha256 (sha256)",
  "INDEX idx_generation_reference_assets_asset (asset_id)",
  "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  "FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE",
  "FOREIGN KEY (asset_id) REFERENCES reference_assets(id) ON DELETE CASCADE",
  "createReferenceAsset: galleryStore.createReferenceAsset",
  "listReferenceAssetsForGeneration: galleryStore.listReferenceAssetsForGeneration",
  "setReferenceAssetsPublicVisibleForGeneration: galleryStore.setReferenceAssetsPublicVisibleForGeneration"
], "mysql store");

assertIncludes(galleryStore, [
  "function mapReferenceAsset",
  "async function createReferenceAsset",
  "async function listReferenceAssetsForUser",
  "async function getReferenceAssetById",
  "async function canReadReferenceAsset",
  "async function linkReferenceAssetToGeneration",
  "async function listReferenceAssetsForGeneration",
  "async function updateReferenceAssetVisibility",
  "async function setReferenceAssetsPublicVisibleForGeneration",
  "async function deleteReferenceAsset",
  "gra.public_visible = 1",
  "ra.user_id = ?"
], "gallery store");

assertIncludes(referenceRoute, [
  "function serializeReferenceAsset",
  "function createReferenceAssetsRoute",
  'url.pathname === "/api/reference-assets"',
  'req.method === "POST"',
  "/^\\/api\\/reference-assets\\/([^/]+)\\/file$/",
  "validateImageDataUrl(imageData)",
  "store.createReferenceAsset",
  "store.listReferenceAssetsForUser",
  "store.canReadReferenceAsset",
  "path.basename",
  "X-AI-Content-Source",
  "user-provided-reference-image"
], "reference assets route");

assertIncludes(server, [
  "createReferenceAssetsRoute",
  "serializeReferenceAsset",
  "REFERENCE_ASSET_DIR",
  "handleReferenceAssetsRoute",
  "await fs.mkdir(REFERENCE_ASSET_DIR, { recursive: true })",
  "async function referenceAssetsForGeneration",
  "response.referenceAssets = await referenceAssetsForGeneration",
  "request.referenceAssetIds",
  "linkReferenceAssetToGeneration",
  "publishReferenceAssets",
  "setReferenceAssetsPublicVisibleForGeneration(updated.id, updated.isPublic && !updated.archived)"
], "server");

assertIncludes(imagesGenerate, [
  "async function referenceAssetIdsForUser",
  "body.referenceAssetIds",
  "referenceAssetIds",
  "referenceAssetCount",
  "publishReferenceAssets",
  "store.getReferenceAssetById(id)",
  "asset.userId !== user.id"
], "images generate route");
assertIncludes(imagesRoute, [
  "generationResponseForViewer",
  "setReferenceAssetsPublicVisibleForGeneration"
], "images route");
assertIncludes(galleryRoute, [
  "generationResponseForViewer(generation, current)",
  "generationResponseForViewer(updated, current)"
], "gallery route");
assertIncludes(adminModerationRoute, [
  "syncReferenceAssetPublicVisibility",
  "setReferenceAssetsPublicVisibleForGeneration",
  "moderationStatus"
], "admin moderation route");

assertIncludes(referenceImages, [
  "function assetIds",
  "function assetsFromReferences",
  "function renderAssetStrip",
  "function persistAssets",
  'api("/api/reference-assets"',
  "referenceAssetId",
  "ImageStudioReferenceImages"
], "reference image helper");
assertIncludes(app, [
  "async function persistReferenceAssets",
  "function referenceAssetIds",
  "function referenceAssetsFromReferences",
  "function referenceAssetStrip",
  "composerReferenceAssetIds",
  "composerReferenceAssets",
  "publishReferenceAssets",
  "referenceAssetIds: composerReferenceAssetIds",
  "referenceAssets: composerReferenceAssets",
  "referenceAssetStrip(item.referenceAssets)",
  "square-reference-assets"
], "public app");
assertIncludes(appAuth, [
  "referenceAssetsHtml",
  "works-detail-reference-assets",
  "renderAssetStrip"
], "app auth");
assertIncludes(galleryNormalize, ["referenceAssets"], "gallery normalize");
assertIncludes(renderStamp, ["referenceAssets"], "render stamp");
assertIncludes(referenceAssetsCss, [
  ".reference-assets-strip",
  ".square-reference-assets",
  ".works-detail-reference-assets",
  "object-fit: cover"
], "reference assets CSS");
assertIncludes(galleryCss, [".works-detail-reference-assets"], "gallery CSS");

const jsAssets = Array.isArray(manifest.js?.assets) ? manifest.js.assets : [];
const assetBySource = new Map(jsAssets.map((asset) => [asset.source, asset]));
function readDistFor(source) {
  const asset = assetBySource.get(source);
  assert(asset?.entry, `built manifest must expose ${source}`);
  return asset?.entry ? read(path.join("public", asset.entry.replace(/^\//, ""))) : "";
}

const appDist = readDistFor("/app.js");
const appAuthDist = readDistFor("/app-auth.js");
const referenceImagesDist = readDistFor("/reference-images.js");
const galleryNormalizeDist = readDistFor("/gallery-normalize.js");
const renderStampDist = readDistFor("/render-stamp.js");
const cssEntry = manifest.css?.entry || "";
assert(/^\/dist\/app\.[a-f0-9]{12}\.css$/.test(cssEntry), "built manifest must expose hashed CSS");
const cssDist = cssEntry ? read(path.join("public", cssEntry.replace(/^\//, ""))) : "";

assertIncludes(appDist, [
  "referenceAssetIds",
  "referenceAssets",
  "publishReferenceAssets",
  "square-reference-assets"
], "hashed app dist");
assertIncludes(appAuthDist, [
  "referenceAssets",
  "works-detail-reference-assets"
], "hashed app-auth dist");
assertIncludes(referenceImagesDist, [
  "/api/reference-assets",
  "assetIds",
  "persistAssets",
  "renderAssetStrip"
], "hashed reference-images dist");
assertIncludes(galleryNormalizeDist, ["referenceAssets"], "hashed gallery-normalize dist");
assertIncludes(renderStampDist, ["referenceAssets"], "hashed render-stamp dist");
assertIncludes(cssDist, [
  ".reference-assets-strip",
  ".square-reference-assets",
  ".works-detail-reference-assets"
], "hashed CSS dist");

if (failures.length) {
  console.error("[reference-assets-smoke] FAIL:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log("[reference-assets-smoke] OK");
