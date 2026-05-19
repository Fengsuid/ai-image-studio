#!/usr/bin/env node
// Import prompt cards from SummerSec/Gen-Image into the local prompts table.
// The script is intentionally conservative: dry-run by default, hash/source-url
// duplicate checks, and a small default import limit.
//
// Usage:
//   node scripts/import-gen-image-prompts.mjs --source external/Gen-Image/src/data/prompts.generated.ts --dry-run
//   node scripts/import-gen-image-prompts.mjs --source external/Gen-Image/src/data/prompts.generated.ts --apply --limit 120

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const store = require("../src/mysql-store");

const CATEGORY_TAGS = {
  ui: ["ui"],
  ue: ["ui"],
  "illustration-standing": ["portrait", "character"],
  "3d": ["3d", "product"],
  anime: ["anime", "illustration"],
  realistic: ["realistic", "photo"],
  vfx: ["poster", "vfx"],
  scene: ["scene", "architecture"]
};

function argValue(args, name, fallback = "") {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

function intArg(args, name, fallback) {
  const value = Number.parseInt(argValue(args, name, ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizePrompt(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\{argument name="[^"]+"\s+default="([^"]*)"\}/g, "$1")
    .replace(/[\u3000\r\n\t]+/g, " ")
    .replace(/[，。、“”‘’！：；（）【】《》]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function promptHash(value = "") {
  const normalized = normalizePrompt(value);
  return normalized ? crypto.createHash("sha256").update(normalized).digest("hex") : "";
}

function parsePromptCards(raw) {
  const match = raw.match(/PROMPT_LIBRARY_GENERATED\s*:\s*PromptCard\[\]\s*=\s*(\[[\s\S]*?\])\s*as\s+PromptCard\[\]/)
    || raw.match(/PROMPT_LIBRARY_MANUAL\s*:\s*PromptCard\[\]\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!match) {
    throw new Error("Cannot find PromptCard array in source file");
  }
  return JSON.parse(match[1]);
}

function sourceLabel(item) {
  const source = String(item.source || "").trim();
  return source ? `Gen-Image/${source}` : "Gen-Image";
}

function normalizeItem(item, index) {
  const title = String(item.title || "").trim().slice(0, 200);
  const prompt = String(item.prompt || "").trim();
  const categoryTags = CATEGORY_TAGS[String(item.category || "").trim()] || [];
  const tags = Array.from(new Set([
    ...categoryTags,
    String(item.category || "").trim()
  ].filter(Boolean))).slice(0, 8);
  return {
    title: title || `Gen-Image Prompt ${index + 1}`,
    prompt,
    image: String(item.thumbnail || "").trim().slice(0, 500),
    tags,
    author: "SummerSec/Gen-Image",
    source: sourceLabel(item).slice(0, 120),
    sourceUrl: String(item.sourceUrl || "https://github.com/SummerSec/Gen-Image").trim().slice(0, 500),
    status: "active",
    sortOrder: -1000 - index,
    hash: promptHash(prompt)
  };
}

function isGoodCandidate(item) {
  if (!item.prompt || item.prompt.length < 40) return false;
  if (!item.hash) return false;
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage:
  node scripts/import-gen-image-prompts.mjs --source external/Gen-Image/src/data/prompts.generated.ts --dry-run
  node scripts/import-gen-image-prompts.mjs --source external/Gen-Image/src/data/prompts.generated.ts --apply --limit 120

Options:
  --source <path>    Source TypeScript file from SummerSec/Gen-Image.
  --apply           Write new prompts to database. Without this, dry-run only.
  --limit <n>       Maximum number of prompts to import, default 120.
  --offset <n>      Skip this many non-duplicate candidates before importing.
`);
    return;
  }

  const source = argValue(args, "--source", "external/Gen-Image/src/data/prompts.generated.ts");
  const apply = args.includes("--apply");
  const limit = intArg(args, "--limit", 120);
  const offset = Math.max(0, Number.parseInt(argValue(args, "--offset", "0"), 10) || 0);
  const sourcePath = path.resolve(process.cwd(), source);
  const raw = await fs.readFile(sourcePath, "utf8");
  const parsed = parsePromptCards(raw).map(normalizeItem).filter(isGoodCandidate);

  await store.initializeDatabase({ defaultModel: process.env.IMAGE_MODEL || "GPT-IMAGE-2" });
  const existing = await store.listPrompts({ includeHidden: true, limit: 5000 });
  const existingHashes = new Set(existing.map((item) => promptHash(item.prompt)).filter(Boolean));
  const existingSourceUrls = new Set(existing.map((item) => String(item.sourceUrl || "").trim()).filter(Boolean));
  const existingTitles = new Set(existing.map((item) => String(item.title || "").trim().toLowerCase()).filter(Boolean));

  const seenHashes = new Set();
  const candidates = [];
  const skipped = {
    emptyOrInvalid: 0,
    duplicateInSource: 0,
    duplicateHash: 0,
    duplicateSourceUrl: 0,
    duplicateTitle: 0
  };

  for (const item of parsed) {
    if (seenHashes.has(item.hash)) {
      skipped.duplicateInSource += 1;
      continue;
    }
    seenHashes.add(item.hash);
    if (existingHashes.has(item.hash)) {
      skipped.duplicateHash += 1;
      continue;
    }
    if (item.sourceUrl && existingSourceUrls.has(item.sourceUrl)) {
      skipped.duplicateSourceUrl += 1;
      continue;
    }
    if (existingTitles.has(item.title.toLowerCase())) {
      skipped.duplicateTitle += 1;
      continue;
    }
    candidates.push(item);
  }

  skipped.emptyOrInvalid = parsePromptCards(raw).length - parsed.length;
  const selected = candidates.slice(offset, offset + limit);
  let inserted = 0;
  const errors = [];

  if (apply) {
    for (const item of selected) {
      try {
        await store.createPrompt(item);
        inserted += 1;
      } catch (error) {
        errors.push({ title: item.title, error: error.message || String(error) });
      }
    }
  }

  const report = {
    source: sourcePath,
    mode: apply ? "apply" : "dry-run",
    parsed: parsed.length,
    existingPrompts: existing.length,
    candidates: candidates.length,
    selected: selected.length,
    inserted,
    skipped,
    sample: selected.slice(0, 5).map((item) => ({
      title: item.title,
      tags: item.tags,
      source: item.source,
      sourceUrl: item.sourceUrl
    })),
    errors
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.stack || error);
    process.exit(1);
  });
