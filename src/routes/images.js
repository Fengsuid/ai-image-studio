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
  generationResponseForViewer,
  ensureActiveAuthenticated,
  enforcePromptPublishAudit,
  publicKindTagForGeneration,
  normalizePublishPublicTags,
  canWithdrawDirectly,
  claimFirstPublicRewardForGeneration
}) {
  function normalizeLibraryDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const date = new Date(raw.length <= 10 ? `${raw}T00:00:00.000Z` : raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function generationType(generation) {
    return generation.sourceFilename || generation.sourceImageId || generation.sourcePrompt
      ? "image-to-image"
      : "text-to-image";
  }

  function normalizeTagValue(tag) {
    if (tag && typeof tag === "object") return String(tag.slug || tag.id || tag.label || tag.name || "").trim();
    return String(tag || "").trim();
  }

  function generationMatchesLibraryFilters(generation, url) {
    const status = String(url.searchParams.get("status") || "all").trim();
    if (status === "public" && (!generation.isPublic || generation.archived)) return false;
    if (status === "private" && (generation.isPublic || generation.archived)) return false;
    if (status === "archived" && !generation.archived) return false;
    const type = String(url.searchParams.get("type") || "").trim();
    if (type && generationType(generation) !== type) return false;
    const tag = String(url.searchParams.get("tag") || "").trim();
    if (tag && !(generation.publicTags || []).some((item) => normalizeTagValue(item) === tag)) return false;
    const createdAt = generation.createdAt ? new Date(generation.createdAt) : null;
    const dateFrom = normalizeLibraryDate(url.searchParams.get("dateFrom"));
    const dateTo = normalizeLibraryDate(url.searchParams.get("dateTo"));
    if (createdAt && dateFrom && createdAt < dateFrom) return false;
    if (createdAt && dateTo) {
      const end = new Date(dateTo);
      if (String(url.searchParams.get("dateTo") || "").trim().length <= 10) end.setUTCDate(end.getUTCDate() + 1);
      if (createdAt >= end) return false;
    }
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    if (query) {
      const haystack = [
        generation.prompt,
        generation.title,
        generation.createdAt,
        ...(generation.publicTags || []).map(normalizeTagValue)
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }

  function exportManifestItem(generation) {
    return {
      id: generation.id,
      prompt: generation.prompt || "",
      type: generationType(generation),
      createdAt: generation.createdAt || "",
      imageUrl: `/api/images/${generation.id}/file`,
      sourceImageUrl: sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
      publicTags: generation.publicTags || [],
      isPublic: Boolean(generation.isPublic),
      archived: Boolean(generation.archived)
    };
  }

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
      const status = String(url.searchParams.get("status") || "all").trim();
      const includeArchived = url.searchParams.get("includeArchived") === "1" || status === "archived";
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 200);
      const generations = await Promise.all((await store.listGenerationsForUser(current.user, limit, { includeArchived }))
        .filter((generation) => generationMatchesLibraryFilters(generation, url))
        .map(async (generation) => ({
        ...(generationResponseForViewer
          ? await generationResponseForViewer(generation, current)
          : generation),
        imageUrl: `/api/images/${generation.id}/file`,
        sourceImageUrl: sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
        ...sourceImageAuditFields(generation)
      })));
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
      const exportItems = [];
      const publishSettings = await store.getSettings();
      for (const id of ids) {
        try {
          const generation = await store.getGenerationById(id);
          if (!generation || !canTouchGeneration(current.user, generation)) {
            results.push({ id, ok: false, error: "not_found" });
            continue;
          }
          if (action === "export") {
            exportItems.push(exportManifestItem(generation));
            results.push({ id, ok: true });
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
          } else if (action === "delete") {
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
          if (typeof store.setReferenceAssetsPublicVisibleForGeneration === "function") {
            await store.setReferenceAssetsPublicVisibleForGeneration(updated.id, patch.isPublic === true && patch.archived !== true);
          }
          if (action === "publish" && !generation.isPublic) {
            updated = await claimFirstPublicRewardForGeneration(updated);
          }
          results.push({ id, ok: true, generation: updated });
        } catch (error) {
          results.push({ id, ok: false, error: error.message || String(error) });
        }
      }
      const payload = { results };
      if (action === "export") {
        payload.export = {
          format: "manifest",
          generatedAt: new Date().toISOString(),
          items: exportItems
        };
      }
      sendJson(res, 200, payload);
      return true;
    }

    return false;
  };
}

module.exports = { createImagesRoute };
