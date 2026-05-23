"use strict";

// Owns public gallery read routes and likes:
// GET /api/images/public
// GET /api/gallery/leaderboard
// GET /api/gallery/:id
// POST/DELETE /api/gallery/:id/like
function createGalleryRoute({
  store,
  sendJson,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  isPubliclyVisibleGeneration,
  generationResponse,
  generationResponseForViewer,
  promptLeaderboardResponse,
  filterGenerationsWithImageFiles,
  imageFileExists,
  sanitizePositiveInt,
  writeAdminAudit,
  GALLERY_LEADERBOARD_LIMIT_MAX
}) {
  return async function handleGalleryRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/images/public") {
      const current = await getCurrentUser(req);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 60, 120);
      const sort = url.searchParams.get("sort") === "likes" ? "likes" : "recent";
      const includeBroken = current?.user?.role === "admin" && url.searchParams.get("includeBroken") === "1";
      const rawGenerations = await store.listPublicGenerations(limit, { includeBroken, currentUserId: current?.user?.id || "", sort });
      const visibleGenerations = includeBroken ? rawGenerations : await filterGenerationsWithImageFiles(rawGenerations);
      const generations = await Promise.all(
        visibleGenerations.map((generation) => generationResponseForViewer(generation, current))
      );
      sendJson(res, 200, { generations });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/gallery/leaderboard") {
      const current = await getCurrentUser(req);
      const range = ["day", "week", "month", "all"].includes(url.searchParams.get("range"))
        ? url.searchParams.get("range")
        : "week";
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 30, GALLERY_LEADERBOARD_LIMIT_MAX);
      const type = url.searchParams.get("type") || "";
      const includeBroken = current?.user?.role === "admin" && url.searchParams.get("includeBroken") === "1";
      const rawGenerationItems = await store.listGenerationLeaderboard({
        range,
        tag: url.searchParams.get("tag") || "",
        type,
        limit,
        currentUserId: current?.user?.id || "",
        includeBroken
      });
      const visibleGenerationItems = includeBroken ? rawGenerationItems : await filterGenerationsWithImageFiles(rawGenerationItems);
      const generationItems = visibleGenerationItems.map(generationResponse);
      const promptItems = type === "image-to-image"
        ? []
        : (await store.listPromptImageLeaderboard({
          range,
          limit,
          currentUserId: current?.user?.id || "",
          includeHidden: current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1"
        })).map(promptLeaderboardResponse);
      const generations = [...generationItems, ...promptItems]
        .sort((left, right) => {
          const likes = Number(right.likeCount || 0) - Number(left.likeCount || 0);
          if (likes) return likes;
          return new Date(right.publishedAt || right.createdAt || 0) - new Date(left.publishedAt || left.createdAt || 0);
        })
        .slice(0, limit);
      sendJson(res, 200, { generations, range });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/gallery/prompt-audit") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const prompt = cleanPrompt(body.prompt);
      const requestedMode = body.requestedMode === "image-to-image" ? "image-to-image" : "text-to-image";
      const audit = await store.auditPromptForPublish({
        prompt,
        userId: current.user.id,
        requestedMode,
        persist: true
      });
      sendJson(res, 200, { audit: auditPayload(audit) });
      return true;
    }

    const galleryDetailMatch = url.pathname.match(/^\/api\/gallery\/([^/]+)$/);
    if (galleryDetailMatch && req.method === "GET") {
      const current = await getCurrentUser(req);
      const generation = await store.getGenerationById(galleryDetailMatch[1]);
      const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
      const imageMissing = generation && !(await imageFileExists("generated", generation.filename));
      if (!generation || (!includeHidden && (!isPubliclyVisibleGeneration(generation) || imageMissing))) {
        throw httpError("Gallery image not found", 404);
      }
      sendJson(res, 200, { generation: await generationResponseForViewer(generation, current) });
      return true;
    }

    const galleryLikeMatch = url.pathname.match(/^\/api\/gallery\/([^/]+)\/like$/);
    if (galleryLikeMatch && (req.method === "POST" || req.method === "DELETE")) {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const generation = await store.getGenerationById(galleryLikeMatch[1]);
      if (!generation || !isPubliclyVisibleGeneration(generation)) {
        throw httpError("Gallery image not found", 404);
      }
      const liked = req.method === "POST";
      const updated = await store.setGenerationLike(generation.id, current.user.id, liked);
      if (liked) {
        const anomalies = await store.listGenerationLikeAnomalies({ limit: 50 }).catch(() => []);
        const row = anomalies.find((item) => item.userId === current.user.id);
        if (row) {
          await writeAdminAudit(current, req, "gallery_like_anomaly", "user", current.user.id, {
            generationId: generation.id,
            likeCount24h: row.likeCount,
            firstLikeAt: row.firstLikeAt,
            lastLikeAt: row.lastLikeAt
          });
        }
      }
      sendJson(res, 200, { generation: generationResponse(updated) });
      return true;
    }

    return false;
  };
}

module.exports = { createGalleryRoute };
