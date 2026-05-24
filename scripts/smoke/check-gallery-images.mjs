#!/usr/bin/env node
// Verifies that gallery and prompt-database images returned to the public UI are displayable.
// Usage:
//   node scripts/smoke/check-gallery-images.mjs http://127.0.0.1:3000

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://localhost:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const promptLimit = Math.max(1, Math.min(2000, Number.parseInt(process.env.GALLERY_PROMPT_LIMIT || "2000", 10) || 2000));
const perSourceImageChecks = Math.max(1, Math.min(5, Number.parseInt(process.env.GALLERY_PER_SOURCE_IMAGE_CHECKS || "2", 10) || 2));
const failures = [];

function log(...parts) {
  console.log("[gallery-smoke]", ...parts);
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error("[gallery-smoke] FAIL:", message);
  }
}

async function fetchJson(pathSuffix) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathSuffix}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { _raw: text };
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHead(pathSuffix) {
  const url = new URL(pathSuffix, baseUrl);
  url.searchParams.set("variant", "thumb");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      signal: controller.signal
    });
    return { url: url.pathname + url.search, status: response.status, headers: response.headers };
  } finally {
    clearTimeout(timer);
  }
}

function imageUrlFor(item = {}) {
  if (item.imageUrl) return item.imageUrl;
  if (Array.isArray(item.images) && item.images[0]) return item.images[0];
  return "";
}

function promptImageUrlFor(item = {}) {
  return item.preview || item.coverUrl || item.image || item.imageUrl || "";
}

function normalizePromptText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u3000\r\n\t]+/g, " ")
    .replace(/[，。、“”‘’！：；（）【】《》]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function promptDisplayKey(item = {}) {
  const normalizedHash = String(item.normalizedHash || "").trim().toLowerCase();
  if (normalizedHash) return `hash:${normalizedHash}`;
  const promptText = normalizePromptText(item.prompt || "");
  if (promptText) return `prompt:${promptText}`;
  const sourceRepo = String(item.sourceRepo || "").trim().toLowerCase();
  const remoteId = String(item.remoteId || "").trim().toLowerCase();
  if (sourceRepo && remoteId) return `remote:${sourceRepo}:${remoteId}`;
  const image = String(promptImageUrlFor(item)).trim().toLowerCase();
  if (image && sourceRepo) return `image:${sourceRepo}:${image}`;
  return `id:${item.id || ""}`;
}

function leaderboardDisplayKey(item = {}) {
  if (item.kind === "prompt" || String(item.id || "").startsWith("prompt_")) {
    return `prompt:${item.promptId || String(item.id || "").replace(/^prompt_/, "") || normalizePromptText(item.prompt)}`;
  }
  return `generation:${item.id || imageUrlFor(item) || normalizePromptText(item.prompt)}`;
}

function publicGalleryDisplayKey(item = {}) {
  return `generation:${item.id || imageUrlFor(item) || normalizePromptText(item.prompt)}`;
}

function sourceLabelForPrompt(item = {}) {
  return String(item.sourceRepo || item.source || item.sourceCategory || item.author || "unknown").trim() || "unknown";
}

function assertNoDuplicateKeys(items = [], keyFn, label) {
  const seen = new Map();
  const duplicates = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (seen.has(key)) {
      duplicates.push(`${seen.get(key)} + ${item.id || item.promptId || "unknown"} => ${key.slice(0, 120)}`);
      continue;
    }
    seen.set(key, item.id || item.promptId || "unknown");
  }
  assert(!duplicates.length, `${label} duplicate display keys: ${duplicates.slice(0, 8).join("; ")}`);
}

async function assertImageHead(pathSuffix, label) {
  try {
    const image = await fetchHead(pathSuffix);
    const contentType = (image.headers.get("content-type") || "").toLowerCase();
    assert(image.status === 200, `${label} image ${image.url} status=${image.status}`);
    assert(contentType.startsWith("image/"), `${label} image ${image.url} content-type=${contentType || "-"}`);
    return image;
  } catch (error) {
    assert(false, `${label} image request failed: ${error.message || error}`);
    return null;
  }
}

async function checkPromptImages() {
  log(`GET /api/prompts?sort=hot&limit=${promptLimit}`);
  const { status, body } = await fetchJson(`/api/prompts?sort=hot&limit=${promptLimit}`);
  assert(status === 200, `/api/prompts status=${status}`);
  const prompts = Array.isArray(body?.prompts) ? body.prompts : [];
  assert(prompts.length > 0, "/api/prompts returned zero prompts");
  assertNoDuplicateKeys(prompts, promptDisplayKey, "/api/prompts");
  const withImages = prompts.filter((item) => item.preview || item.coverUrl || item.image || item.imageUrl);
  assert(withImages.length > 0, "/api/prompts returned no prompt-database images");

  const groups = new Map();
  for (const prompt of prompts) {
    const label = sourceLabelForPrompt(prompt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(prompt);
  }

  const checked = [];
  for (const [label, sourcePrompts] of groups) {
    const sourceImages = sourcePrompts.filter((item) => promptImageUrlFor(item));
    assert(sourceImages.length > 0, `prompt source ${label} has no image-backed prompts`);
    for (const prompt of sourceImages.slice(0, perSourceImageChecks)) {
      await assertImageHead(`/api/prompt-images/${encodeURIComponent(prompt.id)}/file`, `prompt ${prompt.id} (${label})`);
      checked.push(`${label}:${prompt.id}`);
    }
  }
  log("prompt source image checks:", checked.join(", "));
}

async function checkPublicGalleryImages() {
  log("GET /api/images/public?limit=120");
  const { status, body } = await fetchJson("/api/images/public?limit=120");
  assert(status === 200, `/api/images/public status=${status}`);
  const items = Array.isArray(body?.generations) ? body.generations : [];
  assert(items.length > 0, "/api/images/public returned zero entries");
  assertNoDuplicateKeys(items, publicGalleryDisplayKey, "/api/images/public");
  for (const item of items.slice(0, 12)) {
    const url = imageUrlFor(item);
    assert(Boolean(url), `public gallery item ${item.id} missing imageUrl`);
    if (url) await assertImageHead(url, `public gallery ${item.id}`);
  }
  log("public gallery images ok:", items.slice(0, 12).map((item) => item.id).join(", "));
}

async function checkLeaderboardImages() {
  log("GET /api/gallery/leaderboard?range=all&limit=99");
  const { status, body } = await fetchJson("/api/gallery/leaderboard?range=all&limit=99");
  assert(status === 200, `/api/gallery/leaderboard status=${status}`);
  const items = Array.isArray(body?.generations) ? body.generations : [];
  assert(items.length > 0, "/api/gallery/leaderboard returned zero entries");
  assert(items.length <= 99, `/api/gallery/leaderboard returned more than 99 entries: ${items.length}`);
  assertNoDuplicateKeys(items, leaderboardDisplayKey, "/api/gallery/leaderboard");
  const promptItems = items.filter((item) => item.kind === "prompt" || String(item.id || "").startsWith("prompt_"));
  assert(promptItems.length > 0, "prompt-database images are missing from gallery leaderboard");
  const itemsToCheck = [...new Map([...items.slice(0, 12), ...promptItems.slice(0, 10)].map((item) => [leaderboardDisplayKey(item), item])).values()];
  for (const item of itemsToCheck) {
    const url = imageUrlFor(item);
    assert(Boolean(url), `leaderboard item ${item.id} missing imageUrl`);
    if (url) await assertImageHead(url, `leaderboard ${item.id}`);
  }
  log("leaderboard images ok:", itemsToCheck.map((item) => item.id).join(", "));
}

async function main() {
  log("base =", baseUrl, `(timeout ${timeoutMs}ms)`);
  await checkPromptImages();
  await checkPublicGalleryImages();
  await checkLeaderboardImages();
  if (failures.length) {
    console.error(`[gallery-smoke] ${failures.length} failure(s)`);
    process.exitCode = 1;
    return;
  }
  log("OK: gallery images are displayable and prompt images participate in leaderboard");
}

main().catch((error) => {
  console.error("[gallery-smoke] crashed:", error);
  process.exitCode = 1;
});
