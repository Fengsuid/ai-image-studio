#!/usr/bin/env node
// Static guard for AIS-RLS-046 gallery/input/admin experience work.

import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const app = fs.readFileSync(path.join(rootDir, "public/app.js"), "utf8");
const html = fs.readFileSync(path.join(rootDir, "public/index.html"), "utf8");
const styles = fs.readFileSync(path.join(rootDir, "public/styles.css"), "utf8");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const store = fs.readFileSync(path.join(rootDir, "src/mysql-store.js"), "utf8");
const syncModule = fs.readFileSync(path.join(rootDir, "src/prompt-source-sync.js"), "utf8");
const require = createRequire(import.meta.url);
const {
  parseAwesomeGptImage2PromptsBackup,
  parseAwesomeGptImage2PromptsJson
} = require(path.join(rootDir, "src/prompt-source-sync.js"));

assert(html.includes('id="leaderboardView"'), "leaderboard must have an independent page view");
assert(html.includes("/editor-image-import.js"), "editor paste/drop import module must be loaded separately");
assert(html.includes("/image-session-list.js"), "session list rendering must be split into its own module");
assert(html.includes("/render-stamp.js"), "render stamp logic must be split into its own module");
assert(app.includes('navigate("leaderboard"'), "top-level navigation must open the leaderboard page");
assert(app.includes("renderLeaderboardPage"), "leaderboard page renderer must be wired");
assert(!app.includes("<div class=\"gallery-main-grid\">${cardsHtml}</div>${renderGalleryLeaderboard()}"), "gallery must not inline leaderboard beside cards");
assert(!app.includes("data-open-leaderboard"), "gallery page must not show a leaderboard CTA");
assert(!styles.includes(".leaderboard-cta"), "gallery leaderboard CTA styles must be removed");
assert(html.includes('data-i18n="galleryLeaderboardPage">点赞排行榜</span>'), "top nav must show the Chinese leaderboard label before i18n hydration");
assert(app.includes('galleryLeaderboardPage: "点赞排行榜"'), "leaderboard nav label must be Chinese in zh locale");
assert(styles.includes(".leaderboard-page .gallery-leaderboard"), "leaderboard page styles must be present");
assert(html.includes("/prompt-cover-fallback.js"), "prompt fallback cover renderer must be loaded separately");
assert(app.includes("ImageStudioPromptCoverFallback"), "prompt cards must use fallback covers when no image exists");
assert(styles.includes(".prompt-cover-fallback"), "prompt fallback covers must have visible styles");
assert(styles.includes(".prompt-cover-fallback-image"), "prompt fallback covers must render as image-like covers");
assert(app.includes("promptCoverFallbackSrc"), "broken prompt images must have a generated fallback image source");
assert(app.includes("data-fallback-src"), "prompt image tags must carry fallback image sources");
assert(app.includes("document.addEventListener(\"error\"") && app.includes("markImageUnavailable(target)"), "image errors must switch to fallback covers");
assert(fs.readFileSync(path.join(rootDir, "public/prompt-cover-fallback.js"), "utf8").includes("data:image/svg+xml"), "prompt fallback module must generate SVG image data URLs");
assert(app.includes("function promptCardImageUrl"), "prompt cards must centralize card image URL selection");
assert(app.includes('return prompt.kind === "square" ? imageVariantUrl(coverUrl) : coverUrl;'), "prompt-library cards must use the same image URL as details");
assert(app.includes('src="${escapeHtml(cardImageUrl)}"'), "prompt card markup must render the normalized card image URL");
assert(app.includes('data-remove-on-image-error="1"'), "prompt-library cards with broken source images must not render synthetic fallback covers");
assert(app.includes('image.closest(".prompt-card")') && app.includes("card.remove()"), "broken prompt-library image cards must be removed from the gallery grid");

assert(app.includes("deleteImageSession"), "conversation delete handler must exist");
assert(app.includes("ImageStudioRenderStamp"), "conversation/history renders must use stable render stamps");
assert(app.includes("stamp && state.renderStamp.sessions === stamp") && app.includes("stamp && state.renderStamp.history === stamp"), "conversation/history render must skip unchanged DOM rebuilds after a valid stamp");
assert(app.includes("window.confirm") && app.includes("生成历史和公开作品不会被删除"), "conversation delete must ask for confirmation");
assert(app.includes("renameImageSession"), "conversation title editing must exist");
assert(styles.includes(".session-actions"), "conversation card actions must be styled");
assert(app.includes("window.ImageStudioEditorImageImport?.bindEditor"), "image-to-image paste/drop binding must be connected");

assert(server.includes("sanitizeGenerationTitle"), "backend must sanitize generation titles");
assert(store.includes("title VARCHAR(160) NOT NULL DEFAULT ''"), "generation table must include a title column");
assert(app.includes("publishTitleInput"), "publish modal must expose an image title field");
assert(app.includes("title: $(\"#publishTitleInput\""), "publish title must be sent to backend");

assert(server.includes("api\\/admin\\/users\\/([^/]+)\\/generations"), "admin user generations endpoint must exist");
assert(store.includes("async function listGenerationsForUserId"), "admin must use explicit user-scoped generation query");
assert(!store.includes("user.role === \"admin\"\n      ? `SELECT g.*, u.name AS user_name"), "normal history must not show every user's generations to admins");
assert(app.includes("openUserConversationsModal"), "user management must expose user conversation review");

assert(store.includes("ps_davidwuw_gpt_image2_prompts"), "new davidwuw prompt source seed must exist");
assert(syncModule.includes("parseAwesomeGptImage2PromptsBackup"), "new prompt source parser must exist");
assert(syncModule.includes("prompts_backup.md"), "new parser must read prompts_backup.md");
assert(syncModule.includes("prompts.json"), "new parser must read prompts.json for prompt cover images");
assert(syncModule.includes("parseAwesomeGptImage2PromptsJson"), "new parser must preserve prompts.json images");
const parsedSample = parseAwesomeGptImage2PromptsBackup(`
## UI与界面 (154 条)

### #1 信息图可视化设计

**中文标题**: UI与界面

**分类**: UI与界面

**提示词**:

\`\`\`
Vertical 9:16 isometric cutaway infographic.
\`\`\`

**作者**: freestylefly

**来源**: freestylefly/awesome-gpt-image-2
`, { repo: "davidwuw0811-boop/awesome-gpt-image2-prompts", category: "gpt-image-2-prompts", key: "awesome-gpt-image2-prompts" });
assert.equal(parsedSample.length, 1, "new prompt source parser must parse prompts_backup.md sections");
assert.equal(parsedSample[0].title, "信息图可视化设计", "parser must preserve prompt title");
assert.equal(parsedSample[0].sourceCategory, "UI与界面", "parser must preserve prompt category");
const parsedJsonSample = parseAwesomeGptImage2PromptsJson([{
  id: 101,
  title_en: "信息图可视化设计",
  title_cn: "UI与界面",
  category: "ui",
  category_cn: "UI与界面",
  prompt: "Vertical 9:16 isometric cutaway infographic.",
  author: "freestylefly",
  image: "images/101.jpg"
}], { repo: "davidwuw0811-boop/awesome-gpt-image2-prompts", category: "gpt-image-2-prompts", key: "awesome-gpt-image2-prompts" });
assert.equal(parsedJsonSample.length, 1, "prompts.json parser must parse records");
assert(parsedJsonSample[0].image.includes("raw.githubusercontent.com/davidwuw0811-boop/awesome-gpt-image2-prompts/main/images/101.jpg"), "prompts.json parser must convert image paths to raw GitHub URLs");
assert.equal(parsedJsonSample[0].preview, parsedJsonSample[0].image, "prompts.json parser must use the same cover for preview");
assert.equal(parsedJsonSample[0].sourceCategory, "UI与界面", "prompts.json parser must preserve Chinese categories");
assert(app.includes("ensureGalleryLeaderboardLoaded"), "leaderboard route must actively load leaderboard data");
assert(app.includes("galleryLeaderboardLoadedKey"), "leaderboard route must track loaded range/type state");
assert(app.includes("&limit=2000"), "prompt library must request the full prompt database instead of the 500 item default");
assert(styles.includes("min-height: 50px") && styles.includes("min-height: 68px"), "chat prompt input must be shorter vertically");
assert(!styles.includes("width: min(760px, var(--chat-main-width)"), "chat prompt input must not be narrowed horizontally");

const sessionListSource = fs.readFileSync(path.join(rootDir, "public/image-session-list.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(sessionListSource, sandbox);
const htmlOut = sandbox.window.ImageStudioSessionList.render({
  sessions: [{ id: "s1", title: "Demo", generationIds: ["g1"], updatedAt: "2026-05-20T00:00:00.000Z" }],
  history: [{ id: "g1", prompt: "A prompt", images: ["/x.png"] }],
  activeSessionId: "s1",
  text: (key) => ({ roundCount: "轮", deleteConversation: "删除对话", sessionUntitled: "未命名" }[key] || key),
  escapeHtml: (value = "") => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  truncate: (value = "", length = 10) => String(value).slice(0, length),
  imageVariantUrl: (url) => url,
  imageFallbackImgAttrs: () => "",
  imageFallbackContainerAttrs: () => "",
  lang: "zh"
});
assert(htmlOut.includes("data-rename-session=\"s1\""), "session list module must render rename action");
assert(htmlOut.includes("data-delete-session=\"s1\""), "session list module must render delete action");

console.log("[gallery-experience-task46-smoke] OK");
