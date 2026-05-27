#!/usr/bin/env node
// Regression smoke for generation status route handled-return semantics.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { createImagesGenerateRoute } = require(path.join(rootDir, "src/routes/images-generate.js"));

function makeDeps({ requestStatus = "pending", ownerId = "user_1", queuedCancel = false } = {}) {
  const calls = {
    status: [],
    cancelled: [],
    ensured: 0
  };
  const store = {
    async getGenerationRequestById(id) {
      return {
        id,
        userId: ownerId,
        status: requestStatus
      };
    },
    async updateGenerationRequest(id, patch) {
      calls.cancelled.push({ id, patch });
    }
  };
  return {
    calls,
    handler: createImagesGenerateRoute({
      getCurrentUser: async () => ({ user: { id: "user_1", role: "user" } }),
      ensureAuthenticated(current) {
        calls.ensured += 1;
        if (!current) throw new Error("unauthenticated");
      },
      store,
      requestStatusPayload: (request) => request,
      sendJson() {},
      async sendGenerationRequestStatus(req, res, id) {
        calls.status.push({ id });
        res.writableEnded = true;
      },
      httpError(message, status) {
        const error = new Error(message);
        error.status = status;
        return error;
      },
      cancelQueuedGenerationJob: () => queuedCancel,
      async traceGeneration() {},
      enforceGenerationRate() {},
      readJsonBody: async () => ({}),
      cleanPrompt: (prompt) => String(prompt || "").trim(),
      sanitizePositiveInt: () => 1,
      normalizeGenerationCost: () => 1,
      DEFAULT_MODEL: "mock-model",
      sanitizeGenerationTitle: () => "mock-title",
      normalizeImageSize: () => "1024x1024",
      choose: (value, allowed, fallback) => allowed.includes(value) ? value : fallback,
      sanitizeConversationRoute: () => "",
      normalizePublishPublicTags: async () => [],
      PUBLIC_KIND_TAGS: { text: "text", image: "image" },
      auditPayload: (value) => value,
      randomId: () => "req_generated",
      safeJsonSummary: (value) => value,
      getClientIp: () => "127.0.0.1",
      getUserAgent: () => "smoke",
      queuePayloadForTextGeneration: () => "{}",
      enqueueGenerationJob: () => ({ queueStatus: "queued" }),
      runQueuedTextGeneration: async () => null,
      attachRequestAbortController: () => ({
        signal: undefined,
        isAborted: () => false,
        detach() {}
      }),
      callOpenAIImages: async () => ({ data: [] }),
      finalizeSuccessfulGenerations: async () => ({ saved: [], missing: 0 }),
      errorSummary: () => ({}),
      editableImageSource() {},
      validateImageDataUrl() {},
      normalizedEditReferenceImages: () => [],
      normalizeMaxReferenceImages: () => 0,
      saveSourceImageFromData: async () => "",
      queuePayloadForImageEdit: () => "{}",
      runQueuedImageEdit: async () => null,
      callOpenAIImageEdits: async () => ({ data: [] })
    })
  };
}

async function assertHandled(label, deps, req, pathName) {
  const res = { writableEnded: false };
  const handled = await deps.handler(req, res, new URL(`http://localhost${pathName}`));
  assert.equal(handled, true, `${label} must return true after writing status`);
  assert.equal(deps.calls.status.length, 1, `${label} must write exactly one status response`);
}

await assertHandled(
  "GET /api/images/requests/:id",
  makeDeps(),
  { method: "GET" },
  "/api/images/requests/req_1"
);

await assertHandled(
  "POST terminal /api/images/requests/:id",
  makeDeps({ requestStatus: "succeeded" }),
  { method: "POST" },
  "/api/images/requests/req_done"
);

const cancelDeps = makeDeps({ requestStatus: "pending", queuedCancel: true });
await assertHandled(
  "POST cancel /api/images/requests/:id",
  cancelDeps,
  { method: "POST" },
  "/api/images/requests/req_pending"
);
assert.equal(cancelDeps.calls.cancelled.length, 1, "queued cancel path must persist cancellation before status response");
assert.equal(cancelDeps.calls.cancelled[0].patch.status, "cancelled", "queued cancel patch must mark request cancelled");

const missDeps = makeDeps();
const missResult = await missDeps.handler({ method: "GET" }, { writableEnded: false }, new URL("http://localhost/api/images/requests"));
assert.equal(missResult, false, "non-matching status collection path should still fall through");

console.log("[generation-status-route-return] OK: status GET, terminal POST, and cancel POST return handled=true");
