"use strict";

const crypto = require("crypto");

const GENERIC_TEXT_TO_IMAGE_PROMPTS = [
  "An original cinematic digital artwork of a glass greenhouse on a misty mountain morning, warm sunrise light, dew on leaves, layered depth, natural colors, high detail, no text.",
  "An original editorial product photo of a matte ceramic coffee cup on a walnut desk beside a sketchbook, soft window light, clean composition, realistic shadows, premium commercial photography, no text.",
  "An original fantasy landscape illustration of a quiet floating island above a blue lake at dawn, waterfalls, small lanterns, atmospheric clouds, painterly detail, balanced composition, no text.",
  "An original futuristic city street scene after rain, neon reflections on pavement, people with umbrellas, cinematic lighting, realistic scale, crisp details, no text.",
  "An original cozy interior scene of a small reading corner with plants, linen curtains, morning sunlight, warm modern design, realistic texture, inviting mood, no text."
];

function compactPromptText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[，。！？、,.!?;:：；"'“”‘’()[\]{}<>《》]/g, "")
    .replace(/\s+/g, "");
}

function isGenericTextToImagePrompt(prompt = "") {
  const compact = compactPromptText(prompt);
  if (!compact) return false;
  if (/^(请|帮我|给我|麻烦)?(随机|随便|任意|自动)?(生成|创建|画|绘制|做|来)(一张|一个|一幅|张|个|幅)?(图片|图|图像|照片|画|作品)$/.test(compact)) {
    return true;
  }
  if (/^(随机|随便|任意)(图片|图|图像|照片|画|作品)$/.test(compact)) {
    return true;
  }
  return /^(please)?(randomly)?(generate|create|make|draw)?(a|an|one)?(random)?(image|picture|photo|artwork)$/.test(compact);
}

function promptSeedIndex(seed = "", length = GENERIC_TEXT_TO_IMAGE_PROMPTS.length) {
  const hash = crypto.createHash("sha1").update(String(seed || Date.now())).digest();
  return hash[0] % length;
}

function normalizeTextToImagePrompt(prompt = "", { seed = "" } = {}) {
  const value = String(prompt || "").trim();
  if (!isGenericTextToImagePrompt(value)) return value;
  return GENERIC_TEXT_TO_IMAGE_PROMPTS[promptSeedIndex(seed || value)] || GENERIC_TEXT_TO_IMAGE_PROMPTS[0];
}

module.exports = {
  GENERIC_TEXT_TO_IMAGE_PROMPTS,
  isGenericTextToImagePrompt,
  normalizeTextToImagePrompt
};
