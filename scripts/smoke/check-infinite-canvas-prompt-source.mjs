#!/usr/bin/env node
// Static guard for the basketikun/infinite-canvas prompt source integration.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const store = fs.readFileSync(path.join(rootDir, "src/mysql-store.js"), "utf8");
const syncModule = fs.readFileSync(path.join(rootDir, "src/prompt-source-sync.js"), "utf8");
const require = createRequire(import.meta.url);
const {
  parseGptImage2Readme,
  parseAwesomeGptImageReadme,
  parseAwesomeGpt4oReadme,
  parseYouMindReadme,
  firstContentImage
} = require(path.join(rootDir, "src/prompt-source-sync.js"));

assert(server.includes('require("./src/prompt-source-sync")'), "server.js must delegate prompt sync to src/prompt-source-sync.js");
assert(!server.includes("function syncGithubGenericPromptSource"), "prompt sync parser logic must stay out of server.js");
assert(server.includes("reviewPendingPromptDuplicates({ limit: Math.min(24, result.upserted) })"), "remote sync must trigger AI duplicate review after candidate scanning");
assert(store.includes("ps_basketikun_infinite_canvas"), "prompt source seed must include basketikun/infinite-canvas");
assert(store.includes("https://github.com/basketikun/infinite-canvas"), "prompt source seed must point at basketikun/infinite-canvas");
assert(store.includes('parser: "infinite-canvas"'), "basketikun/infinite-canvas must use the dedicated parser");

assert(syncModule.includes('INFINITE_CANVAS_SOURCE_REPO = "basketikun/infinite-canvas"'), "sync module must preserve sourceRepo");
assert(syncModule.includes("syncInfiniteCanvasPromptSource"), "sync module must expose the infinite-canvas parser path");
assert(syncModule.includes("EvoLinkAI/awesome-gpt-image-2-API-and-Prompts"), "parser must include the EvoLinkAI source used by infinite-canvas");
assert(syncModule.includes("ZeroLu/awesome-gpt-image"), "parser must include the ZeroLu source used by infinite-canvas");
assert(syncModule.includes("ImgEdify/Awesome-GPT4o-Image-Prompts"), "parser must include the ImgEdify source used by infinite-canvas");
assert(syncModule.includes("YouMind-OpenLab/awesome-gpt-image-2"), "parser must include the YouMind GPT Image 2 source");
assert(syncModule.includes("YouMind-OpenLab/awesome-nano-banana-pro-prompts"), "parser must include the YouMind Nano Banana Pro source");
assert(syncModule.includes("scanPromptDuplicateCandidatesForPrompt"), "synced prompts must be scanned for duplicate candidates");
assert(syncModule.includes("firstContentImage"), "parser must extract current upstream HTML image tags");

assert.equal(
  firstContentImage('<img src="assets/opennana/apple-park.jpg" />', "ZeroLu/awesome-gpt-image"),
  "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main/assets/opennana/apple-park.jpg",
  "relative HTML images must become raw GitHub URLs"
);
assert.equal(
  firstContentImage('![Language-EN](https://img.shields.io/badge/Language-EN-blue)\n<img src="https://cms-assets.youmind.com/media/sample.jpg" />', "YouMind-OpenLab/awesome-gpt-image-2"),
  "https://cms-assets.youmind.com/media/sample.jpg",
  "badge images must be ignored in favor of content images"
);

const youMindItems = parseYouMindReadme(`
### No. 1: VR 头显爆炸视图海报
![Language-EN](https://img.shields.io/badge/Language-EN-blue)
#### 📝 提示词
\`\`\`
{"type":"产品爆炸视图海报"}
\`\`\`
<div align="center">
<img src="https://cms-assets.youmind.com/media/1776658772018_lukyfw_HGSUfldbIAEiMWZ.jpg" width="700" alt="VR 头显爆炸视图海报 - Image 1">
</div>
`, { key: "youmind-gpt-image-2", category: "youmind-gpt-image-2-prompts", repo: "YouMind-OpenLab/awesome-gpt-image-2" });
assert.equal(youMindItems.length, 1, "YouMind parser must parse current No. sections");
assert.equal(youMindItems[0].image, "https://cms-assets.youmind.com/media/1776658772018_lukyfw_HGSUfldbIAEiMWZ.jpg", "YouMind parser must extract HTML content images");

const zeroLuItems = parseAwesomeGptImageReadme(`
### Apple Park 发布会人群视角
<img width="500" alt="Apple Park Keynote Crowd Shot" src="assets/opennana/apple-park-tim-cook-keynote.jpg" />

**提示词:**
\`\`\`text
在 Apple Park 举办 iPhone 20 发布会期间，用 iPhone 从远处人群中拍摄的一张业余照片。
\`\`\`
`, { key: "awesome-gpt-image", category: "awesome-gpt-image-prompts", repo: "ZeroLu/awesome-gpt-image" });
assert.equal(zeroLuItems[0].image, "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main/assets/opennana/apple-park-tim-cook-keynote.jpg", "ZeroLu parser must extract relative HTML images");

const imgEdifyItems = parseAwesomeGpt4oReadme(`
### a premium claw machine
- **提示词文本：** \`A high-end, hyper-realistic 3D render of a premium claw machine inspired by Milka branding.\`
- **示例图片：**
<img src="https://cdn.imgedify.com/imgedify/images/1746411555687-6mc7zaq2lk2.jpeg" alt="a premium claw machine" height="400">
`, { key: "awesome-gpt4o", category: "awesome-gpt4o-image-prompts", repo: "ImgEdify/Awesome-GPT4o-Image-Prompts" });
assert.equal(imgEdifyItems[0].image, "https://cdn.imgedify.com/imgedify/images/1746411555687-6mc7zaq2lk2.jpeg", "ImgEdify parser must extract HTML sample images");

const gptImage2Items = parseGptImage2Readme(`
### Case 151: [E-commerce Main Image](https://x.com/example/status/1) (by [@author](https://x.com/author))
| Output |
| :---: |
| <a href="https://example.com"><img src="https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case151/output.jpg" width="300"></a> |
**Prompt:**
\`\`\`
A hyper-realistic miniature diorama product advertisement.
\`\`\`
`, [{ title: "E-commerce Main Image", image_dir: "poster_case151" }], { key: "gpt-image-2", category: "gpt-image-2-prompts", repo: "EvoLinkAI/awesome-gpt-image-2-API-and-Prompts" });
assert.equal(gptImage2Items[0].image, "https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main/images/poster_case151/output.jpg", "EvoLinkAI parser must preserve generated output images");

console.log("[infinite-canvas-prompt-source-smoke] OK: source seed and parser boundaries are in place");
