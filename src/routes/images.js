"use strict";

const path = require("path");
const { promises: fs } = require("fs");

// Owns image file delivery routes:
// GET/HEAD /api/images/:id/file and GET/HEAD /api/images/:id/source-file.
function createImagesRoute({
  store,
  withSecurityHeaders,
  mimeTypes,
  getCurrentUser,
  ensureAuthenticated,
  canTouchGeneration,
  isPubliclyVisibleGeneration,
  generatedDir,
  sourceDir,
  httpError,
  sendJson,
  readJsonBody,
  sanitizePositiveInt,
  sourceImageUrlForGeneration,
  sourceImageAuditFields,
  ensureActiveAuthenticated,
  enforcePromptPublishAudit,
  publicKindTagForGeneration,
  normalizePublishPublicTags,
  canWithdrawDirectly,
  claimFirstPublicRewardForGeneration
}) {
  async function sendImageFile(req, res, url, { filename, directory, contentSource }) {
    const absolutePath = path.join(directory, filename);
    const extension = path.extname(filename).toLowerCase();
    const bytes = await fs.readFile(absolutePath).catch((error) => {
      if (error?.code === "ENOENT") throw httpError("Image file not found", 404);
      throw error;
    });
    const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "original";
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": bytes.length,
      "X-Image-Variant": variant,
      "X-AI-Content-Source": contentSource,
      "X-Privacy-Download": url.searchParams.get("privacy") === "1" ? "metadata-minimized" : "standard",
      "Vary": "Accept"
    }));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(bytes);
  }

  return async function handleImagesRoute(req, res, url) {
    const sourceMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/source-file$/);
    if (sourceMatch && (req.method === "GET" || req.method === "HEAD")) {
      const current = await getCurrentUser(req);
      const generation = await store.getGenerationById(sourceMatch[1]);
      if (!generation?.sourceFilename) {
        throw httpError("Image not found", 404);
      }
      if (!isPubliclyVisibleGeneration(generation) || !generation.publishOriginal) {
        ensureAuthenticated(current);
        if (!canTouchGeneration(current.user, generation)) {
          throw httpError("Image not found", 404);
        }
      }
      await sendImageFile(req, res, url, {
        filename: generation.sourceFilename,
        directory: sourceDir,
        contentSource: "user-provided-source-image"
      });
      return true;
    }

    const fileMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/file$/);
    if (fileMatch && (req.method === "GET" || req.method === "HEAD")) {
      const current = await getCurrentUser(req);
      const generation = await store.getGenerationById(fileMatch[1]);
      if (!generation) {
        throw httpError("Image not found", 404);
      }
      if (!isPubliclyVisibleGeneration(generation)) {
        ensureAuthenticated(current);
        if (!canTouchGeneration(current.user, generation)) {
          throw httpError("Image not found", 404);
        }
      }
      await sendImageFile(req, res, url, {
        filename: generation.filename,
        directory: generatedDir,
        contentSource: "ai-generated"
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/images/history") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const includeArchived = url.searchParams.get("includeArchived") === "1";
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 200);
      const generations = (await store.listGenerationsForUser(current.user, limit, { includeArchived })).map((generation) => ({
        ...generation,
        imageUrl: `/api/images/${generation.id}/file`,
        sourceImageUrl: sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
        ...sourceImageAuditFields(generation)
      }));
      sendJson(res, 200, { generations });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/images/bulk") {
      const current = await getCurrentUser(req);
      ensureActiveAuthenticated(current);
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.generationIds)
        ? body.generationIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 200)
        : [];
      if (!ids.length) throw httpError("No images selected", 400);
      const action = String(body.action || "").trim();
      const results = [];
      const publishSettings = await store.getSettings();
      for (const id of ids) {
        try {
          const generation = await store.getGenerationById(id);
          if (!generation || !canTouchGeneration(current.user, generation)) {
            results.push({ id, ok: false, error: "not_found" });
            continue;
          }
          const patch = {};
          if (action === "publish") {
            await enforcePromptPublishAudit({ current, req, generation, body, patch });
            const kind = publicKindTagForGeneration(generation);
            patch.isPublic = true;
            patch.archived = false;
            patch.publicTags = await normalizePublishPublicTags(body.publicTags, {
              kind,
              incrementUsage: true
            });
          } else if (action === "unpublish") {
            if (generation.isPublic && current.user.role !== "admin" && !publishSettings.publicUnpublishAllowed) {
              throw new Error("public_unpublish_disabled");
            }
            if (generation.isPublic && !canWithdrawDirectly(generation) && current.user.role !== "admin") {
              throw new Error("withdrawal_request_required");
            }
            patch.isPublic = false;
            patch.publishOriginal = false;
          } else if (action === "archive") {
            if (generation.isPublic && current.user.role !== "admin" && !publishSettings.publicUnpublishAllowed) {
              throw new Error("public_unpublish_disabled");
            }
            if (generation.isPublic && !canWithdrawDirectly(generation) && current.user.role !== "admin") {
              throw new Error("withdrawal_request_required");
            }
            patch.archived = true;
            patch.isPublic = false;
            patch.publishOriginal = false;
          } else if (action === "unarchive") {
            patch.archived = false;
          } else {
            throw new Error("invalid_action");
          }
          let updated = await store.updateGenerationPublic(generation.id, patch);
          if (action === "publish" && !generation.isPublic) {
            updated = await claimFirstPublicRewardForGeneration(updated);
          }
          results.push({ id, ok: true, generation: updated });
        } catch (error) {
          results.push({ id, ok: false, error: error.message || String(error) });
        }
      }
      sendJson(res, 200, { results });
      return true;
    }

    return false;
  };
}

module.exports = { createImagesRoute };
