"use strict";

// Owns prompt library routes:
// GET/POST /api/prompts, GET/PATCH/DELETE /api/prompts/:id, POST /api/prompts/:id/like|use,
// GET/POST /api/tags, GET/PATCH/DELETE /api/tags/:slug, POST /api/tags/:slug/merge,
// GET/POST /api/prompt-categories, PATCH/DELETE /api/prompt-categories/:slug.
function createPromptsRoute({
  store,
  sendJson,
  readJsonBody,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt,
  buildPromptPayload,
  buildTagPayload,
  buildPromptCategoryPayload,
  tagSummary,
  writeAdminAudit,
  reviewPendingPromptDuplicates,
  TAG_SLUG_PATTERN
}) {
  return async function handlePromptsRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/prompts") {
      const current = await getCurrentUser(req);
      const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 500, 2000);
      const requestedSort = url.searchParams.get("sort") || "default";
      const sort = ["hot", "new", "used", "liked"].includes(requestedSort) ? requestedSort : "default";
      const prompts = await store.listPrompts({ includeHidden, limit, sort, currentUserId: current?.user?.id || "" });
      sendJson(res, 200, { prompts });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/prompts") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const body = await readJsonBody(req);
      const payload = buildPromptPayload(body, { partial: false });
      const created = await store.createPrompt(payload);
      const duplicateScan = await store.scanPromptDuplicateCandidatesForPrompt(created.id, {
        limit: 2000,
        hammingThreshold: 6
      });
      const aiReviewed = duplicateScan.candidates
        ? await reviewPendingPromptDuplicates({ limit: 6, mock: body.mockAiReview === true })
        : 0;
      await writeAdminAudit(current, req, "create_prompt", "prompt", String(created.id), {
        title: created.title,
        duplicateCandidates: duplicateScan.candidates,
        duplicateInserted: duplicateScan.inserted,
        aiReviewed
      });
      sendJson(res, 201, { prompt: created, duplicateScan, aiReviewed });
      return true;
    }

    const promptIdMatch = url.pathname.match(/^\/api\/prompts\/(\d+)$/);
    if (promptIdMatch && req.method === "GET") {
      const current = await getCurrentUser(req);
      const prompt = await store.getPromptById(promptIdMatch[1]);
      if (!prompt) throw httpError("Prompt not found", 404);
      if (prompt.status !== "active" && current?.user?.role !== "admin") {
        throw httpError("Prompt not found", 404);
      }
      sendJson(res, 200, { prompt });
      return true;
    }

    const promptLikeMatch = url.pathname.match(/^\/api\/prompts\/(\d+)\/like$/);
    if (promptLikeMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const prompt = await store.getPromptById(promptLikeMatch[1]);
      if (!prompt || prompt.status !== "active") throw httpError("Prompt not found", 404);
      const updated = await store.setPromptLike(prompt.id, current.user.id, body.liked !== false);
      sendJson(res, 200, { prompt: updated });
      return true;
    }

    const promptUseMatch = url.pathname.match(/^\/api\/prompts\/(\d+)\/use$/);
    if (promptUseMatch && req.method === "POST") {
      const prompt = await store.getPromptById(promptUseMatch[1]);
      if (!prompt || prompt.status !== "active") throw httpError("Prompt not found", 404);
      const updated = await store.incrementPromptUse(prompt.id);
      sendJson(res, 200, { prompt: updated });
      return true;
    }

    if (promptIdMatch && req.method === "PATCH") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const existing = await store.getPromptById(promptIdMatch[1]);
      if (!existing) throw httpError("Prompt not found", 404);
      const body = await readJsonBody(req);
      const payload = buildPromptPayload(body, { partial: true });
      const updated = await store.updatePrompt(existing.id, payload);
      await writeAdminAudit(current, req, "update_prompt", "prompt", String(existing.id), {
        fields: Object.keys(payload),
        duplicateReview: body.duplicateReview || ""
      });
      sendJson(res, 200, { prompt: updated });
      return true;
    }

    if (promptIdMatch && req.method === "DELETE") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const existing = await store.getPromptById(promptIdMatch[1]);
      if (!existing) throw httpError("Prompt not found", 404);
      const updated = await store.softDeletePrompt(existing.id);
      await writeAdminAudit(current, req, "hide_prompt", "prompt", String(existing.id), {
        reason: "manual_duplicate_or_quality_review"
      });
      sendJson(res, 200, { prompt: updated });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/tags") {
      const current = await getCurrentUser(req);
      const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 500, 2000);
      const [tags, categories] = await Promise.all([
        store.listTags({ includeHidden, limit }),
        store.listPromptCategories({ includeHidden })
      ]);
      sendJson(res, 200, { tags, categories, summary: tagSummary(tags) });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/prompt-categories") {
      const current = await getCurrentUser(req);
      const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
      const categories = await store.listPromptCategories({ includeHidden });
      sendJson(res, 200, { categories });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/prompt-categories") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const body = await readJsonBody(req);
      const payload = buildPromptCategoryPayload(body, { partial: false });
      const existing = await store.getPromptCategoryBySlug(payload.slug);
      if (existing) throw httpError(`Category '${payload.slug}' already exists`, 409);
      const category = await store.upsertPromptCategory(payload);
      await writeAdminAudit(current, req, "create_prompt_category", "prompt_category", category.slug, {
        labelZh: category.labelZh,
        status: category.status
      });
      sendJson(res, 201, { category });
      return true;
    }

    const promptCategoryMatch = url.pathname.match(/^\/api\/prompt-categories\/([a-z0-9][a-z0-9_-]{0,30}[a-z0-9]|[a-z0-9])$/i);
    if (promptCategoryMatch && req.method === "PATCH") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const existing = await store.getPromptCategoryBySlug(promptCategoryMatch[1]);
      if (!existing) throw httpError("Category not found", 404);
      const body = await readJsonBody(req);
      const payload = buildPromptCategoryPayload({ ...existing, ...body, slug: existing.slug }, { partial: false });
      const category = await store.upsertPromptCategory(payload);
      await writeAdminAudit(current, req, "update_prompt_category", "prompt_category", category.slug, {
        fields: Object.keys(body)
      });
      sendJson(res, 200, { category });
      return true;
    }

    if (promptCategoryMatch && req.method === "DELETE") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const existing = await store.getPromptCategoryBySlug(promptCategoryMatch[1]);
      if (!existing) throw httpError("Category not found", 404);
      const category = await store.upsertPromptCategory({ ...existing, status: "hidden" });
      await writeAdminAudit(current, req, "hide_prompt_category", "prompt_category", category.slug, {});
      sendJson(res, 200, { category });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/tags") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const body = await readJsonBody(req);
      const payload = buildTagPayload(body, { partial: false });
      if (await store.getTagBySlug(payload.slug)) {
        throw httpError(`Tag '${payload.slug}' already exists`, 409);
      }
      const tag = await store.createTag(payload);
      sendJson(res, 201, { tag });
      return true;
    }

    const tagSlugMatch = url.pathname.match(/^\/api\/tags\/([a-z0-9][a-z0-9-]{0,46}[a-z0-9]|[a-z0-9])$/i);
    if (tagSlugMatch && req.method === "GET") {
      const tag = await store.getTagBySlug(tagSlugMatch[1]);
      if (!tag) throw httpError("Tag not found", 404);
      sendJson(res, 200, { tag });
      return true;
    }

    if (tagSlugMatch && req.method === "PATCH") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const existing = await store.getTagBySlug(tagSlugMatch[1]);
      if (!existing) throw httpError("Tag not found", 404);
      const body = await readJsonBody(req);
      const payload = buildTagPayload(body, { partial: true });
      const updated = await store.updateTag(existing.slug, payload);
      sendJson(res, 200, { tag: updated });
      return true;
    }

    if (tagSlugMatch && req.method === "DELETE") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const existing = await store.getTagBySlug(tagSlugMatch[1]);
      if (!existing) throw httpError("Tag not found", 404);
      const updated = await store.hideTag(existing.slug);
      sendJson(res, 200, { tag: updated });
      return true;
    }

    const tagMergeMatch = url.pathname.match(/^\/api\/tags\/([a-z0-9][a-z0-9-]{0,46}[a-z0-9]|[a-z0-9])\/merge$/i);
    if (tagMergeMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      ensureAdmin(current);
      const body = await readJsonBody(req);
      const targetSlug = String(body.targetSlug || "").trim().toLowerCase();
      if (!targetSlug || !TAG_SLUG_PATTERN.test(targetSlug)) {
        throw httpError("targetSlug is invalid", 400);
      }
      try {
        const result = await store.mergeTag(tagMergeMatch[1], targetSlug);
        await writeAdminAudit(current, req, "merge_tag", "tag", tagMergeMatch[1], {
          targetSlug,
          migration: result.migration || null
        });
        sendJson(res, 200, result);
        return true;
      } catch (error) {
        throw httpError(error.message || "merge failed", 400);
      }
    }

    return false;
  };
}

module.exports = { createPromptsRoute };
