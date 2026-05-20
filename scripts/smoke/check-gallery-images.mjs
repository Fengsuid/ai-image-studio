#!/usr/bin/env node
// Verifies that gallery and prompt-database images returned to the public UI are displayable.
// Usage:
//   node scripts/smoke/check-gallery-images.mjs http://127.0.0.1:3000

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://localhost:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
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

async function assertImageHead(pathSuffix, label) {
  const image = await fetchHead(pathSuffix);
  const contentType = (image.headers.get("content-type") || "").toLowerCase();
  assert(image.status === 200, `${label} image ${image.url} status=${image.status}`);
  assert(contentType.startsWith("image/"), `${label} image ${image.url} content-type=${contentType || "-"}`);
  return image;
}

async function checkPromptImages() {
  log("GET /api/prompts?sort=hot&limit=12");
  const { status, body } = await fetchJson("/api/prompts?sort=hot&limit=12");
  assert(status === 200, `/api/prompts status=${status}`);
  const prompts = Array.isArray(body?.prompts) ? body.prompts : [];
  const withImages = prompts.filter((item) => item.preview || item.coverUrl || item.image || item.imageUrl);
  assert(withImages.length > 0, "/api/prompts returned no prompt-database images");
  for (const prompt of withImages.slice(0, 5)) {
    await assertImageHead(`/api/prompt-images/${encodeURIComponent(prompt.id)}/file`, `prompt ${prompt.id}`);
  }
  log("prompt images ok:", withImages.slice(0, 5).map((item) => item.id).join(", "));
}

async function checkLeaderboardImages() {
  log("GET /api/gallery/leaderboard?range=all&limit=99");
  const { status, body } = await fetchJson("/api/gallery/leaderboard?range=all&limit=99");
  assert(status === 200, `/api/gallery/leaderboard status=${status}`);
  const items = Array.isArray(body?.generations) ? body.generations : [];
  assert(items.length > 0, "/api/gallery/leaderboard returned zero entries");
  assert(items.length <= 99, `/api/gallery/leaderboard returned more than 99 entries: ${items.length}`);
  const promptItems = items.filter((item) => item.kind === "prompt" || String(item.id || "").startsWith("prompt_"));
  assert(promptItems.length > 0, "prompt-database images are missing from gallery leaderboard");
  for (const item of items.slice(0, 12)) {
    const url = imageUrlFor(item);
    assert(Boolean(url), `leaderboard item ${item.id} missing imageUrl`);
    if (url) await assertImageHead(url, `leaderboard ${item.id}`);
  }
  log("leaderboard images ok:", items.slice(0, 12).map((item) => item.id).join(", "));
}

async function main() {
  log("base =", baseUrl, `(timeout ${timeoutMs}ms)`);
  await checkPromptImages();
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
