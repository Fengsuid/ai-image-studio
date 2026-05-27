#!/usr/bin/env node
// Regression smoke for generic text-to-image prompt expansion.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = fs.readFileSync(path.join(rootDir, "server.js"), "utf8");
const imagesGenerateRoute = fs.readFileSync(path.join(rootDir, "src/routes/images-generate.js"), "utf8");
const promptModule = require(path.join(rootDir, "src/generation-prompt.js"));

const {
  GENERIC_TEXT_TO_IMAGE_PROMPTS,
  isGenericTextToImagePrompt,
  normalizeTextToImagePrompt
} = promptModule;

assert.equal(GENERIC_TEXT_TO_IMAGE_PROMPTS.length, 5, "generic prompt pool should keep five provider-ready prompts");
assert(GENERIC_TEXT_TO_IMAGE_PROMPTS.every((prompt) => prompt.includes("An original ")), "generic prompts must be original descriptive prompts");
assert(GENERIC_TEXT_TO_IMAGE_PROMPTS.every((prompt) => prompt.includes("no text")), "generic prompts should avoid text artifacts");

for (const prompt of [
  "生成一张图片",
  "随机图片",
  "帮我画一张图",
  "请生成图片",
  "generate image",
  "random image",
  "please create a photo",
  "draw an artwork"
]) {
  assert.equal(isGenericTextToImagePrompt(prompt), true, `${prompt} should be detected as generic`);
  const normalized = normalizeTextToImagePrompt(prompt, { seed: "req_generic_smoke" });
  assert(GENERIC_TEXT_TO_IMAGE_PROMPTS.includes(normalized), `${prompt} should normalize into prompt pool`);
  assert.notEqual(normalized, prompt.trim(), `${prompt} should not be sent to provider literally`);
}

for (const prompt of [
  "一只红色的猫在咖啡馆里看书",
  "cinematic portrait of a violin maker in warm window light"
]) {
  assert.equal(isGenericTextToImagePrompt(prompt), false, `${prompt} should remain specific`);
  assert.equal(normalizeTextToImagePrompt(prompt, { seed: "req_specific_smoke" }), prompt, "specific prompt must be unchanged");
}

const stableA = normalizeTextToImagePrompt("生成图片", { seed: "req_same_seed" });
const stableB = normalizeTextToImagePrompt("生成图片", { seed: "req_same_seed" });
const stableC = normalizeTextToImagePrompt("生成图片", { seed: "req_different_seed" });
assert.equal(stableA, stableB, "same audit/request seed must choose the same provider prompt");
assert(GENERIC_TEXT_TO_IMAGE_PROMPTS.includes(stableC), "different seed must still choose from the provider prompt pool");

for (const token of [
  "normalizeTextToImagePrompt",
  "const providerPrompt = normalizeTextToImagePrompt(prompt, { seed: auditId })",
  "prompt: providerPrompt",
  "providerPrompt: providerPrompt === prompt ? undefined : providerPrompt"
]) {
  assert(imagesGenerateRoute.includes(token) || server.includes(token), `generation route/server must wire ${token}`);
}

console.log("[generic-prompt-normalize] OK: generic prompts expand deterministically and generation route sends providerPrompt");
