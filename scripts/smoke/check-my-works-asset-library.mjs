#!/usr/bin/env node
// Static and route-level guard for AIS-RLS-122 My Works asset library.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));

const packageJson = readJson("package.json");
const manifest = readJson("public/frontend-build-manifest.json");
const app = read("public/app.js");
const appAuth = read("public/app-auth.js");
const imagesRoute = read("src/routes/images.js");
const worksCss = read("public/css/pages/works-carousel.css");

assert.equal(
  packageJson.scripts["smoke:my-works-asset-library"],
  "node scripts/smoke/check-my-works-asset-library.mjs",
  "package.json must expose smoke:my-works-asset-library"
);
assert(
  packageJson.scripts.check.includes("npm run smoke:my-works-asset-library"),
  "npm run check must include smoke:my-works-asset-library"
);

for (const token of [
  'worksDateFilter: "all"',
  'worksTagFilter: "all"'
]) {
  assert(app.includes(token), `public app state must include ${token}`);
}

for (const token of [
  "works-library-filters",
  "id=\"worksDateFilter\"",
  "id=\"worksTagFilter\"",
  "data-works-bulk=\"export\"",
  "data-works-bulk=\"delete\"",
  "worksDateMinTime",
  "worksTagOptions",
  "exportWorks(ids)",
  'action: "export"',
  "delete private history"
]) {
  assert(appAuth.includes(token), `My Works source must include ${token}`);
}

for (const token of [
  ".works-library-filters",
  ".works-danger-action"
]) {
  assert(worksCss.includes(token), `My Works CSS must include ${token}`);
}

for (const token of [
  "generationMatchesLibraryFilters",
  "url.searchParams.get(\"status\")",
  "url.searchParams.get(\"type\")",
  "url.searchParams.get(\"tag\")",
  "url.searchParams.get(\"dateFrom\")",
  "url.searchParams.get(\"dateTo\")",
  "url.searchParams.get(\"q\")",
  'action === "export"',
  'action === "delete"',
  "exportManifestItem"
]) {
  assert(imagesRoute.includes(token), `images route must include ${token}`);
}

const assetBySource = new Map((manifest.js?.assets || []).map((asset) => [asset.source, asset]));
function readDistFor(source) {
  const asset = assetBySource.get(source);
  assert(asset?.entry, `built manifest must expose ${source}`);
  return read(path.join("public", asset.entry.replace(/^\//, "")));
}

const appDist = readDistFor("/app.js");
const appAuthDist = readDistFor("/app-auth.js");
const cssEntry = manifest.css?.entry || "";
assert(/^\/dist\/app\.[a-f0-9]{12}\.css$/.test(cssEntry), "manifest must expose hashed CSS");
const cssDist = read(path.join("public", cssEntry.replace(/^\//, "")));

for (const token of ["worksDateFilter", "worksTagFilter"]) {
  assert(appDist.includes(token), `hashed app dist must include ${token}`);
}
for (const token of ["works-library-filters", "data-works-bulk=\"export\"", "data-works-bulk=\"delete\""]) {
  assert(appAuthDist.includes(token), `hashed app-auth dist must include ${token}`);
}
assert(cssDist.includes(".works-library-filters"), "hashed CSS dist must include My Works library filters");

const { createImagesRoute } = require(path.join(rootDir, "src/routes/images.js"));

function makeUrl(pathname) {
  return new URL(pathname, "http://local.test");
}

function makeResponse() {
  return {
    statusCode: 0,
    payload: null
  };
}

function makeHandler({ body = {}, calls = {} } = {}) {
  const user = { id: "user_1", role: "user", status: "active" };
  const generations = [
    {
      id: "gen_text",
      userId: "user_1",
      prompt: "poster cat",
      filename: "text.png",
      createdAt: "2026-05-31T00:00:00.000Z",
      publicTags: ["poster"],
      isPublic: false,
      archived: false
    },
    {
      id: "gen_image",
      userId: "user_1",
      prompt: "portrait edit",
      filename: "image.png",
      sourceFilename: "source.png",
      createdAt: "2026-05-30T00:00:00.000Z",
      publicTags: ["portrait"],
      isPublic: true,
      archived: false
    },
    {
      id: "gen_archived",
      userId: "user_1",
      prompt: "old logo",
      filename: "old.png",
      createdAt: "2026-05-01T00:00:00.000Z",
      publicTags: ["logo"],
      isPublic: false,
      archived: true
    }
  ];
  const byId = new Map(generations.map((item) => [item.id, item]));
  calls.patches = [];
  return createImagesRoute({
    store: {
      async listGenerationsForUser(_user, _limit, options) {
        return generations.filter((item) => options.includeArchived || !item.archived);
      },
      async getGenerationById(id) {
        return byId.get(id) || null;
      },
      async getSettings() {
        return { publicUnpublishAllowed: true };
      },
      async updateGenerationPublic(id, patch) {
        calls.patches.push({ id, patch });
        return { ...byId.get(id), ...patch };
      },
      async setReferenceAssetsPublicVisibleForGeneration() {}
    },
    withSecurityHeaders: (headers) => headers,
    mimeTypes: new Map(),
    getCurrentUser: async () => ({ user }),
    ensureAuthenticated(current) {
      if (!current?.user) throw new Error("unauthenticated");
    },
    canTouchGeneration: (currentUser, generation) => currentUser.id === generation.userId,
    isPubliclyVisibleGeneration: () => false,
    generatedDir: "",
    sourceDir: "",
    httpError(message, status) {
      const error = new Error(message);
      error.status = status;
      return error;
    },
    sendJson(res, status, payload) {
      res.statusCode = status;
      res.payload = payload;
    },
    readJsonBody: async () => body,
    sanitizePositiveInt: (value, fallback, max) => Math.min(max, Math.max(1, Number(value) || fallback)),
    sourceImageUrlForGeneration: (generation) => generation.sourceFilename ? `/api/images/${generation.id}/source-file` : "",
    sourceImageAuditFields: () => ({}),
    generationResponseForViewer: null,
    ensureActiveAuthenticated(current) {
      if (!current?.user || current.user.status === "disabled") throw new Error("inactive");
    },
    async enforcePromptPublishAudit() {},
    publicKindTagForGeneration: (generation) => generation.sourceFilename ? "image-to-image" : "text-to-image",
    normalizePublishPublicTags: async (tags) => tags || [],
    canWithdrawDirectly: () => true,
    claimFirstPublicRewardForGeneration: async (generation) => generation
  });
}

async function call(handler, method, pathname) {
  const res = makeResponse();
  const handled = await handler({ method }, res, makeUrl(pathname));
  assert.equal(handled, true, `${method} ${pathname} should be handled`);
  return res;
}

let handler = makeHandler();
let res = await call(handler, "GET", "/api/images/history?includeArchived=1&type=image-to-image&tag=portrait&dateFrom=2026-05-29&q=edit");
assert.deepEqual(res.payload.generations.map((item) => item.id), ["gen_image"], "history filters must combine type/date/tag/query");

res = await call(handler, "GET", "/api/images/history?status=archived");
assert.deepEqual(res.payload.generations.map((item) => item.id), ["gen_archived"], "history status=archived must include archived works");

const deleteCalls = {};
handler = makeHandler({ body: { generationIds: ["gen_text"], action: "delete" }, calls: deleteCalls });
res = await call(handler, "POST", "/api/images/bulk");
assert.equal(res.payload.results[0].ok, true, "bulk delete should succeed for owned private history");
assert.deepEqual(deleteCalls.patches[0].patch, { archived: true, isPublic: false, publishOriginal: false }, "bulk delete must be a soft archive patch");

handler = makeHandler({ body: { generationIds: ["gen_text", "gen_image"], action: "export" } });
res = await call(handler, "POST", "/api/images/bulk");
assert.equal(res.payload.export.format, "manifest", "bulk export must return a manifest");
assert.deepEqual(res.payload.export.items.map((item) => item.id), ["gen_text", "gen_image"], "bulk export manifest must include requested items");

console.log("[my-works-asset-library-smoke] OK");
