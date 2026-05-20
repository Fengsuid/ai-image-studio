#!/usr/bin/env node
// Static guard for gallery card tag view-model behavior.

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const indexHtml = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const tagModel = fs.readFileSync(path.join(rootDir, "public/gallery-tag-view-model.js"), "utf8");

assert(indexHtml.includes("/gallery-tag-view-model.js"), "index.html must load gallery-tag-view-model.js");
assert(indexHtml.indexOf("/gallery-tag-view-model.js") < indexHtml.indexOf("/app.js"), "gallery tag view model must load before app.js");
assert(app.includes("galleryTagViewModelForItem"), "app.js must use a gallery tag view model helper");
assert(app.includes("tagView.kindBadge.slug"), "gallery cards must keep the type badge separate from public tags");
assert(app.includes("publicTags: tagView.publicTags"), "square detail and card data must share filtered public tags");
assert(!app.includes('tags: ["square", isImageToImageItem(item)'), "gallery cards must not prepend square/type tags into visible tag data");

const sandbox = { window: {} };
vm.runInNewContext(tagModel, sandbox, { filename: "gallery-tag-view-model.js" });
const model = sandbox.window.ImageStudioGalleryTagViewModel.create({
  kind: "image-to-image",
  publicTags: ["image-to-image", "图生图", "portrait", "portrait", "cinematic", "text-to-image"]
});

assert.equal(model.kindBadge.slug, "image-to-image", "kind badge should preserve image-to-image");
assert.deepEqual(model.publicTags, ["portrait", "cinematic"], "public tags must filter type aliases and duplicates");

console.log("[gallery-card-tags-smoke] OK: gallery card type badges and public tags are separated");
