#!/usr/bin/env node
// Static and route-level guard for AIS-RLS-120 multi-candidate generation.

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
const index = read("public/index.html");
const routeSource = read("src/routes/images-generate.js");
const server = read("server.js");
const queueRecovery = read("src/generation-queue-recovery.js");

assert.equal(
  packageJson.scripts["smoke:multi-candidate-generation"],
  "node scripts/smoke/check-multi-candidate-generation.mjs",
  "package.json must expose smoke:multi-candidate-generation"
);

const appAsset = manifest.js?.assets?.find((asset) => asset.source === "/app.js");
assert(appAsset?.entry, "frontend manifest must expose hashed /app.js asset");
const appDist = read(path.join("public", appAsset.entry.replace(/^\//, "")));

for (const token of [
  "candidate-count-input",
  "<option value=\"2\">2</option>",
  "<option value=\"3\">3</option>",
  "<option value=\"4\">4</option>"
]) {
  assert(index.includes(token), `composer template must expose multi-candidate control: ${token}`);
}

for (const token of [
  "candidateCount: Math.max(1, Math.min(Number(state.settings?.maxImagesPerRequest || 1)",
  "const candidateCount = Math.max(1, Number(state.generationOptions.candidateCount || 1));",
  "n: candidateCount",
  "isPublic: item.isPublic && candidateCount === 1",
  "data.generations.map((candidate) => candidate.imageUrl)",
  "data.generations.map((candidate) => candidate.id)",
  "state.user.credits = data.credits"
]) {
  assert(app.includes(token), `public app must thread candidate count through generation flow: ${token}`);
}

for (const token of [
  "candidate-strip",
  "data-candidate-index",
  "$$(\"[data-candidate]\"",
  "images.splice(index, 1)",
  "candidateIds.splice(index, 1)",
  "replaceSessionGenerationId(entry.id, selectedId, entry.elapsedMs)",
  "images: [selectedImage, ...images]"
]) {
  assert(app.includes(token), `public app must support candidate comparison and selection: ${token}`);
}

for (const token of [
  "candidate-strip",
  "data-candidate",
  "candidateIds",
  "splice"
]) {
  assert(appDist.includes(token), `hashed app dist must include candidate UI token: ${token}`);
}

for (const token of [
  "const n = sanitizePositiveInt(body.n, 1, maxImages);",
  "const totalCost = costPerImage * n;",
  "openaiRequest",
  "n: request.n",
  "queuePayloadForTextGeneration({",
  "totalCost,",
  "costPerImage,",
  "run: ({ signal } = {}) => runQueuedTextGeneration({",
  "generationCost: costPerImage",
  "expectedCount: request.n",
  "unused candidate refund",
  "costPerImage * missing"
]) {
  assert(routeSource.includes(token), `text generation route must bill and persist n-candidate requests: ${token}`);
}

for (const token of [
  "request,",
  "openaiRequest,",
  "totalCost,",
  "costPerImage,"
]) {
  assert(queueRecovery.includes(token), `queue recovery payload must preserve candidate billing state: ${token}`);
}

for (const token of [
  "candidateCount > 1",
  "providerCapabilityValue(capabilities, \"multiCandidate\")",
  "candidateCount > maxImages",
  "expectedCount: request.n",
  "unused candidate refund"
]) {
  assert(server.includes(token), `server must preserve provider capability and queued candidate handling: ${token}`);
}

const { createImagesGenerateRoute } = require(path.join(rootDir, "src/routes/images-generate.js"));
const { queuePayloadForTextGeneration } = require(path.join(rootDir, "src/generation-queue-recovery.js"));

function makeJsonReq(body) {
  return {
    method: "POST",
    headers: {},
    body
  };
}

function makeDeps(body) {
  const calls = {
    inserted: [],
    reserved: [],
    refunded: [],
    provider: [],
    finalized: [],
    queued: [],
    queuedRuns: [],
    responses: []
  };
  const settings = {
    model: "mock-image-model",
    maxImagesPerRequest: 4,
    generationCreditCost: 2
  };
  const store = {
    async getSettings() {
      return settings;
    },
    async getUserById(id) {
      return { id, status: "active", credits: 20 };
    },
    async auditPromptForPublish() {
      throw new Error("publish audit should not run for multi-candidate private generations");
    },
    async insertGenerationRequest(record) {
      calls.inserted.push(record);
    },
    async reserveCredits(userId, amount, meta) {
      calls.reserved.push({ userId, amount, meta });
      return true;
    },
    async addCredits(userId, amount, meta) {
      calls.refunded.push({ userId, amount, meta });
    },
    async getUserCredits() {
      return 14;
    }
  };
  const handler = createImagesGenerateRoute({
    getCurrentUser: async () => ({ user: { id: "user_1", role: "user" } }),
    ensureAuthenticated(current) {
      if (!current?.user) throw new Error("unauthenticated");
    },
    store,
    requestStatusPayload: (request) => request,
    sendJson(res, status, payload) {
      calls.responses.push({ status, payload });
      res.statusCode = status;
      res.payload = payload;
      res.writableEnded = true;
    },
    async sendGenerationRequestStatus() {},
    httpError(message, status, extra = {}) {
      const error = new Error(message);
      error.status = status;
      Object.assign(error, extra);
      return error;
    },
    cancelQueuedGenerationJob: () => false,
    async traceGeneration() {},
    enforceGenerationRate() {},
    readJsonBody: async () => body,
    cleanPrompt: (prompt) => String(prompt || "").trim(),
    normalizeTextToImagePrompt: (prompt) => `normalized:${prompt}`,
    sanitizePositiveInt(value, fallback, max) {
      const number = Math.max(1, Number.parseInt(value ?? fallback, 10) || fallback);
      return Math.min(number, max);
    },
    normalizeGenerationCost: (value) => Math.max(0, Number(value) || 0),
    DEFAULT_MODEL: "fallback-model",
    sanitizeGenerationTitle: (title, prompt) => String(title || prompt || "").slice(0, 42),
    normalizeImageSize: (value) => String(value || "1024x1024"),
    choose: (value, allowed, fallback) => allowed.includes(value) ? value : fallback,
    sanitizeConversationRoute: () => [],
    normalizePublishPublicTags: async () => [],
    PUBLIC_KIND_TAGS: { text: "text-to-image", image: "image-to-image" },
    auditPayload: (value) => value,
    randomId: () => "req_multi_candidate",
    safeJsonSummary: (value) => value,
    getClientIp: () => "127.0.0.1",
    getUserAgent: () => "multi-candidate-smoke",
    queuePayloadForTextGeneration,
    enqueueGenerationJob(job) {
      calls.queued.push(job);
      return { queueStatus: "queued", queuePosition: 1, queueTotal: 1 };
    },
    async runQueuedTextGeneration(args) {
      calls.queuedRuns.push(args);
      return [];
    },
    attachRequestAbortController: () => ({
      signal: undefined,
      isAborted: () => false,
      detach() {}
    }),
    async callOpenAIImages(_settings, request) {
      calls.provider.push(request);
      return { data: [{ b64_json: "a" }, { b64_json: "b" }] };
    },
    async finalizeSuccessfulGenerations(args) {
      calls.finalized.push(args);
      return {
        saved: [
          { id: "gen_1", imageUrl: "/api/images/gen_1/file", prompt: args.request.prompt },
          { id: "gen_2", imageUrl: "/api/images/gen_2/file", prompt: args.request.prompt }
        ],
        missing: 1
      };
    },
    errorSummary: (error) => ({ message: String(error?.message || error) }),
    editableImageSource() {},
    validateImageDataUrl() {},
    normalizedEditReferenceImages: () => [],
    normalizeMaxReferenceImages: () => 0,
    saveSourceImageFromData: async () => "",
    queuePayloadForImageEdit: () => "{}",
    runQueuedImageEdit: async () => null,
    callOpenAIImageEdits: async () => ({ data: [] })
  });
  return { calls, handler };
}

async function exerciseSyncTextGeneration() {
  const body = {
    prompt: "same prompt, compare three branches",
    title: "branch compare",
    n: 3,
    size: "1024x1024",
    quality: "medium",
    background: "opaque",
    outputFormat: "png",
    isPublic: false,
    async: false
  };
  const { calls, handler } = makeDeps(body);
  const res = {};
  const handled = await handler(makeJsonReq(body), res, new URL("http://local.test/api/images/generate"));

  assert.equal(handled, true, "sync multi-candidate request must be handled");
  assert.equal(calls.inserted[0]?.normalizedParams?.n, 3, "generation request must persist normalized n=3");
  assert.equal(calls.inserted[0]?.providerParams?.n, 3, "generation request must persist provider n=3");
  assert.equal(calls.provider[0]?.n, 3, "provider request must receive n=3");
  assert.equal(calls.reserved[0]?.amount, 6, "credits must reserve costPerImage * n");
  assert.equal(calls.reserved[0]?.meta?.note, "3 image(s)", "credit ledger note must include candidate count");
  assert.equal(calls.finalized[0]?.expectedCount, 3, "finalizer must expect all requested candidates");
  assert.equal(calls.refunded[0]?.amount, 2, "missing candidates must refund costPerImage * missing");
  assert.equal(calls.responses[0]?.status, 200, "sync response should succeed");
  assert.equal(calls.responses[0]?.payload?.generations?.length, 2, "response must return saved candidates");
  assert.equal(calls.responses[0]?.payload?.credits, 14, "response must return updated credits");
  assert.equal(calls.responses[0]?.payload?.generationCost, 2, "response must expose per-candidate generation cost");
}

async function exerciseAsyncTextGeneration() {
  const body = {
    prompt: "same prompt, queued branches",
    n: 3,
    async: true,
    isPublic: false
  };
  const { calls, handler } = makeDeps(body);
  const res = {};
  const handled = await handler(makeJsonReq(body), res, new URL("http://local.test/api/images/generate"));
  const payload = JSON.parse(calls.inserted[0]?.queuePayloadJson || "{}");

  assert.equal(handled, true, "async multi-candidate request must be handled");
  assert.equal(calls.responses[0]?.status, 202, "async response should enqueue");
  assert.equal(calls.responses[0]?.payload?.request?.queueStatus, "queued", "async response must return queue metadata");
  assert.equal(calls.responses[0]?.payload?.credits, 14, "async response must return current credits");
  assert.equal(calls.reserved.length, 0, "async route must defer credit reservation to the queued runner");
  assert.equal(payload.kind, "text-generation", "queue payload must persist text generation kind");
  assert.equal(payload.request?.n, 3, "queue payload must preserve requested n");
  assert.equal(payload.openaiRequest?.n, 3, "queue payload must preserve provider n");
  assert.equal(payload.totalCost, 6, "queue payload must preserve total candidate cost");
  assert.equal(payload.costPerImage, 2, "queue payload must preserve per-candidate cost");
  assert.equal(calls.queued.length, 1, "async route must enqueue exactly one grouped request");

  await calls.queued[0].run({ signal: "smoke-signal" });
  assert.equal(calls.queuedRuns[0]?.totalCost, 6, "queued runner closure must receive total candidate cost");
  assert.equal(calls.queuedRuns[0]?.request?.n, 3, "queued runner closure must receive candidate count");
  assert.equal(calls.queuedRuns[0]?.openaiRequest?.n, 3, "queued runner closure must receive provider candidate count");
}

await exerciseSyncTextGeneration();
await exerciseAsyncTextGeneration();

console.log("[multi-candidate-generation] OK: UI selection, n-candidate routing, queue payloads, and credit accounting are guarded");
