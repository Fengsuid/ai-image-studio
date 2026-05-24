#!/usr/bin/env node
// Verifies Canvas v2 generation contracts without reaching a real provider.

import assert from "node:assert/strict";
import { createRequire } from "node:module";

import {
  applyGenerationResult,
  applyGenerationStatus,
  generationRequestForOutput,
} from "../../apps/canvas-v2/src/features/generation/flow.js";
import { generateCanvasOutput } from "../../apps/canvas-v2/src/adapters/ai-image-studio-api.js";

const require = createRequire(import.meta.url);
const { createCanvasService } = require("../../src/canvas-service.js");

const user = { id: "usr_canvas_v2_generation", role: "user", status: "active", credits: 50 };
const persistedCanvas = {
  id: "can_canvas_v2_generation",
  userId: user.id,
  title: "Canvas v2 generation smoke",
  visibility: "private",
  dataJson: {
    schema: "ai-image-studio.canvas.v1",
    nodes: [
      { id: "prompt_saved", type: "prompt", x: 0, y: 0, prompt: "Saved prompt from database" },
      { id: "config_saved", type: "config", x: 260, y: 0, model: "saved-model", size: "1024x1024", quality: "medium", candidateCount: 2 },
      { id: "output_saved", type: "output", x: 560, y: 0 },
    ],
    edges: [
      { id: "edge_prompt_config", source: "prompt_saved", target: "config_saved" },
      { id: "edge_config_output", source: "config_saved", target: "output_saved" },
    ],
  },
};

const noConfigCanvas = {
  ...persistedCanvas,
  id: "can_canvas_v2_no_config_generation",
  dataJson: {
    ...persistedCanvas.dataJson,
    nodes: [
      { id: "prompt_direct", type: "prompt", x: 0, y: 0, prompt: "Direct prompt to output" },
      { id: "output_direct", type: "output", x: 320, y: 0 },
    ],
    edges: [
      { id: "edge_prompt_output", source: "prompt_direct", target: "output_direct" },
    ],
  },
};

const imageEditCanvas = {
  ...persistedCanvas,
  id: "can_canvas_v2_image_generation",
  dataJson: {
    ...persistedCanvas.dataJson,
    nodes: [
      { id: "prompt_saved", type: "prompt", x: 0, y: 0, prompt: "Saved image edit prompt" },
      { id: "image_saved", type: "image", x: 0, y: 180, imageUrl: "https://example.invalid/source.png", generationId: "img_source_saved" },
      { id: "config_saved", type: "config", x: 260, y: 0, model: "saved-model", size: "1024x1024", quality: "high", candidateCount: 4 },
      { id: "output_saved", type: "output", x: 560, y: 0 },
    ],
    edges: [
      { id: "edge_prompt_config", source: "prompt_saved", target: "config_saved" },
      { id: "edge_image_config", source: "image_saved", target: "config_saved" },
      { id: "edge_config_output", source: "config_saved", target: "output_saved" },
    ],
  },
};

const localImageEditCanvas = {
  ...persistedCanvas,
  id: "can_canvas_v2_local_image_generation",
  dataJson: {
    ...persistedCanvas.dataJson,
    nodes: [
      { id: "prompt_saved", type: "prompt", x: 0, y: 0, prompt: "Saved local image edit prompt" },
      { id: "image_saved", type: "image", x: 0, y: 180, imageUrl: "/api/images/img_source_saved/file" },
      { id: "config_saved", type: "config", x: 260, y: 0, model: "saved-model", size: "1024x1024", quality: "standard", candidateCount: 2 },
      { id: "output_saved", type: "output", x: 560, y: 0 },
    ],
    edges: [
      { id: "edge_prompt_config", source: "prompt_saved", target: "config_saved" },
      { id: "edge_image_config", source: "image_saved", target: "config_saved" },
      { id: "edge_config_output", source: "config_saved", target: "output_saved" },
    ],
  },
};

const captures = {
  imagePayloads: [],
  editPayloads: [],
  links: [],
  requests: [],
  updates: [],
  insertedGenerations: [],
  creditReservations: [],
  refunds: [],
};

function httpError(message, status = 400, details) {
  return Object.assign(new Error(message), { status, details });
}

function createService({ canvas = persistedCanvas, reserveCredits = true, editProviderError = false, resolveCanvasImageData } = {}) {
  const store = {
    async getCanvasProjectById() {
      return canvas;
    },
    async getUserById() {
      return user;
    },
    async getSettings() {
      return {
        generationCreditCost: 1,
        maxImagesPerRequest: 4,
        model: "settings-model",
      };
    },
    async insertGenerationRequest(request) {
      captures.requests.push(request);
    },
    async updateGenerationRequest(id, patch) {
      captures.updates.push({ id, patch });
    },
    async reserveCredits(userId, amount, meta) {
      captures.creditReservations.push({ userId, amount, meta });
      return reserveCredits;
    },
    async addCredits(userId, amount, meta) {
      captures.refunds.push({ userId, amount, meta });
    },
    async insertGenerations(generations) {
      captures.insertedGenerations.push(...generations);
    },
    async createCanvasGenerationLinks(link) {
      captures.links.push(link);
    },
    async getUserCredits() {
      return 48;
    },
  };

  return createCanvasService({
    store,
    httpError,
    randomId: (prefix) => `${prefix}smoke_${captures.requests.length + captures.links.length + 1}`,
    choose: (value, allowed, fallback) => allowed.includes(value) ? value : fallback,
    cleanPrompt: (prompt) => {
      const text = String(prompt || "").trim();
      if (text.length < 3) throw httpError("Prompt is too short", 400);
      return text;
    },
    sanitizePositiveInt: (value, fallback, max) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1) return fallback;
      return Math.min(parsed, max);
    },
    normalizeImageSize: (value) => String(value || "auto"),
    validateImageDataUrl: () => true,
    normalizeGenerationCost: (value) => Number(value || 0),
    enforceGenerationRate: () => {},
    attachRequestAbortController: () => ({
      signal: new AbortController().signal,
      isAborted: () => false,
      detach: () => {},
    }),
    callOpenAIImages: async (_settings, payload) => {
      captures.imagePayloads.push(payload);
      return { data: [{ b64_json: "unused" }] };
    },
    callOpenAIImageEdits: async (_settings, payload) => {
      captures.editPayloads.push(payload);
      if (editProviderError) throw httpError("No active Provider can handle image edit requests", 400);
      return { data: [{ b64_json: "unused" }] };
    },
    saveGeneratedImages: async (_user, request) => [{
      id: "img_canvas_v2_saved",
      prompt: request.prompt,
      sourceImageId: request.sourceImageId,
      imageUrl: "/api/images/img_canvas_v2_saved/file",
    }],
    getClientIp: () => "127.0.0.1",
    getUserAgent: () => "canvas-v2-generation-smoke",
    isPubliclyVisibleGeneration: () => true,
    resolveCanvasImageData,
    defaultModel: "default-model",
  });
}

const service = createService();
const result = await service.generate(user.id, persistedCanvas.id, {
  outputNodeId: "output_saved",
  configNodeId: "config_saved",
  prompt: "MALICIOUS frontend prompt must be ignored",
  n: 4,
  nodes: [
    { id: "prompt_saved", type: "prompt", data: { prompt: "MALICIOUS request body graph" } },
    { id: "config_saved", type: "config", data: { candidateCount: 4, size: "2048x2048" } },
    { id: "output_saved", type: "output" },
  ],
  edges: [{ sourceId: "prompt_saved", targetId: "output_saved" }],
}, { on: () => {}, off: () => {}, headers: {} }, { writableEnded: false });

assert.equal(captures.imagePayloads.length, 1, "text-to-image path should call image generation provider once");
assert.equal(captures.imagePayloads[0].prompt, "Saved prompt from database", "backend must ignore frontend prompt and use saved dataJson");
assert.equal(captures.imagePayloads[0].n, 2, "backend must use saved config candidateCount");
assert.equal(captures.imagePayloads[0].size, "1024x1024", "backend must use saved config size");
assert.equal(captures.imagePayloads[0].quality, "medium", "backend must use saved config quality");
assert.equal(captures.creditReservations[0].amount, 2, "credit reservation should use saved graph candidate count");
assert.equal(captures.links[0].canvasId, persistedCanvas.id, "generation links should target the canvas");
assert.equal(captures.links[0].outputNodeId, "output_saved", "generation links should record output node");
assert.equal(captures.links[0].configNodeId, "config_saved", "generation links should record config node");
assert.equal(result.outputNode.status, "success", "generate should return successful output status");
assert.equal(result.generations[0].imageUrl, "/api/images/img_canvas_v2_saved/file", "generate should return saved image URL");

const noConfigService = createService({ canvas: noConfigCanvas });
await noConfigService.generate(user.id, noConfigCanvas.id, { outputNodeId: "output_direct" }, { on: () => {}, off: () => {}, headers: {} }, { writableEnded: false });
const directPayload = captures.imagePayloads[captures.imagePayloads.length - 1];
assert.equal(directPayload.prompt, "Direct prompt to output", "direct prompt-to-output generation should use the saved prompt");
assert.equal(directPayload.n, 1, "direct prompt-to-output generation should default to one image");
assert.equal(captures.links[captures.links.length - 1].configNodeId, "", "direct prompt-to-output generation should not require a config node");

const insufficient = createService({ reserveCredits: false });
await assert.rejects(
  () => insufficient.generate(user.id, persistedCanvas.id, { outputNodeId: "output_saved" }, { on: () => {}, off: () => {}, headers: {} }, { writableEnded: false }),
  (error) => error.status === 402 && /Not enough credits/.test(error.message),
  "insufficient credits should return stable 402 error",
);

const imageService = createService({ canvas: imageEditCanvas, editProviderError: true });
await assert.rejects(
  () => imageService.generate(user.id, imageEditCanvas.id, { outputNodeId: "output_saved" }, { on: () => {}, off: () => {}, headers: {} }, { writableEnded: false }),
  (error) => error.status === 400 && /No active Provider can handle image edit requests/.test(error.message),
  "image-to-image provider mismatch should return stable non-500 error",
);
assert.equal(captures.editPayloads[0].prompt, "Saved image edit prompt", "image edit path should use saved prompt");
assert.equal(captures.editPayloads[0].imageData, "https://example.invalid/source.png", "image edit path should use saved image reference");
assert.equal(captures.editPayloads[0].n, 1, "image edit path should request one output");

const localImageService = createService({
  canvas: localImageEditCanvas,
  resolveCanvasImageData: async ({ imageData, sourceImageId, user: resolverUser, canvas: resolverCanvas }) => {
    assert.equal(imageData, "/api/images/img_source_saved/file", "resolver should receive saved local image reference");
    assert.equal(sourceImageId, "img_source_saved", "source image id should be derived from local image URL");
    assert.equal(resolverUser.id, user.id, "resolver should receive the authenticated canvas owner");
    assert.equal(resolverCanvas.id, localImageEditCanvas.id, "resolver should receive the saved canvas");
    return "data:image/png;base64,canvas-local-reference";
  },
});
await localImageService.generate(user.id, localImageEditCanvas.id, { outputNodeId: "output_saved" }, { on: () => {}, off: () => {}, headers: {} }, { writableEnded: false });
const localEditPayload = captures.editPayloads[captures.editPayloads.length - 1];
assert.equal(localEditPayload.prompt, "Saved local image edit prompt", "local image edit path should use saved prompt");
assert.equal(localEditPayload.imageData, "data:image/png;base64,canvas-local-reference", "local image reference should be resolved before provider call");
assert.equal(localEditPayload.n, 1, "local image edit path should request one output");
assert.equal(captures.insertedGenerations[captures.insertedGenerations.length - 1].sourceImageId, "img_source_saved", "local image edit should preserve source image id");

const request = generationRequestForOutput(persistedCanvas.dataJson, "output_saved");
assert.deepEqual(request, { outputNodeId: "output_saved", configNodeId: "config_saved" }, "Canvas v2 should derive output/config selectors");

const statusDocument = applyGenerationStatus(persistedCanvas.dataJson, "output_saved", "running", "Running through backend queue.");
assert.equal(statusDocument.nodes.find((node) => node.id === "output_saved").generationStatus, "running", "status helper should update output node");
const resultDocument = applyGenerationResult(statusDocument, "output_saved", { generations: [{ id: "img_frontend_result", prompt: "Saved prompt" }] });
const resultOutput = resultDocument.nodes.find((node) => node.id === "output_saved");
assert.equal(resultOutput.generationId, "img_frontend_result", "result helper should persist generation id");
assert.equal(resultOutput.imageUrl, "/api/images/img_frontend_result/file", "result helper should derive image URL fallback");

globalThis.document = { cookie: "csrf=csrf-token" };
let fetchCapture = null;
globalThis.fetch = async (path, options) => {
  fetchCapture = { path, options, body: JSON.parse(options.body || "{}") };
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
await generateCanvasOutput("can_frontend", {
  outputNodeId: "output_saved",
  configNodeId: "config_saved",
  nodes: [{ id: "malicious_node" }],
  prompt: "malicious prompt",
  providerApiKey: "must-not-be-sent",
});
assert.equal(fetchCapture.path, "/api/canvases/can_frontend/generate", "frontend adapter should call backend generate route");
assert.deepEqual(Object.keys(fetchCapture.body).sort(), ["configNodeId", "outputNodeId"], "frontend adapter must send only selectors");
assert.equal(fetchCapture.options.headers.get("X-CSRF-Token"), "csrf-token", "frontend adapter should keep CSRF protection");

console.log("[canvas-v2-generation-smoke] OK: saved-graph backend generation, credit/provider errors, and frontend selector contract verified");
