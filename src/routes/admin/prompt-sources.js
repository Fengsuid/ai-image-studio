"use strict";

const { requireAdmin } = require("./shared");

function createAdminPromptSourcesRoute(deps) {
  const { store, sendJson, readJsonBody, httpError, randomId, writeAdminAudit } = deps;

  return async function handleAdminPromptSourcesRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/prompt-sources") {
      await requireAdmin(deps, req);
      const [sources, runs] = await Promise.all([
        store.listPromptSources({ includeDisabled: true }),
        store.listPromptSyncRuns({ limit: deps.sanitizePositiveInt(url.searchParams.get("runsLimit"), 100, 500) })
      ]);
      sendJson(res, 200, { sources, runs });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/prompt-sources") {
      const current = await requireAdmin(deps, req);
      const input = deps.cleanPromptSourceInput(await readJsonBody(req));
      const source = await store.createPromptSource({ ...input, id: randomId("ps_") });
      await writeAdminAudit(current, req, "create_prompt_source", "prompt_source", source.id, {
        name: source.name,
        repoUrl: source.repoUrl,
        status: source.status
      });
      sendJson(res, 201, { source });
      return true;
    }

    const promptSourceMatch = url.pathname.match(/^\/api\/admin\/prompt-sources\/([^/]+)$/);
    if (promptSourceMatch && req.method === "PATCH") {
      const current = await requireAdmin(deps, req);
      const existing = await store.getPromptSourceById(promptSourceMatch[1]);
      if (!existing) throw httpError("Prompt source not found", 404);
      const input = deps.cleanPromptSourceInput(await readJsonBody(req), existing);
      const source = await store.updatePromptSource(existing.id, input);
      await writeAdminAudit(current, req, "update_prompt_source", "prompt_source", source.id, {
        fields: Object.keys(input),
        status: source.status
      });
      sendJson(res, 200, { source });
      return true;
    }

    const promptSourceSyncMatch = url.pathname.match(/^\/api\/admin\/prompt-sources\/([^/]+)\/sync$/);
    if (promptSourceSyncMatch && req.method === "POST") {
      const current = await requireAdmin(deps, req);
      const source = await store.getPromptSourceById(promptSourceSyncMatch[1]);
      if (!source) throw httpError("Prompt source not found", 404);
      const now = new Date();
      if (source.status === "disabled") {
        const run = await store.createPromptSyncRun({
          sourceId: source.id,
          status: "skipped",
          startedAt: now,
          finishedAt: now,
          skippedCount: 1,
          errorLog: "source_disabled",
          createdByUserId: current.user.id
        });
        sendJson(res, 200, { run, source: await store.getPromptSourceById(source.id) });
        return true;
      }
      try {
        const result = await deps.runPromptSourceSync(source);
        const aiReviewed = result.upserted ? await deps.reviewPendingPromptDuplicates({ limit: Math.min(24, result.upserted) }) : 0;
        const finishedAt = new Date();
        const status = result.errors.length ? "partial" : "success";
        const run = await store.createPromptSyncRun({
          sourceId: source.id,
          status,
          startedAt: now,
          finishedAt,
          successCount: result.upserted,
          failureCount: result.errors.length,
          skippedCount: result.skipped,
          errorLog: result.errors.join("\n"),
          createdByUserId: current.user.id
        });
        await writeAdminAudit(current, req, "prompt_source_sync", "prompt_source", source.id, {
          status,
          fetched: result.fetched,
          upserted: result.upserted,
          aiReviewed,
          errors: result.errors.length
        });
        sendJson(res, 200, { run, source: await store.getPromptSourceById(source.id), result, aiReviewed });
        return true;
      } catch (error) {
        const finishedAt = new Date();
        const run = await store.createPromptSyncRun({
          sourceId: source.id,
          status: "failed",
          startedAt: now,
          finishedAt,
          failureCount: 1,
          errorLog: error.message || String(error),
          createdByUserId: current.user.id
        });
        await writeAdminAudit(current, req, "prompt_source_sync_failed", "prompt_source", source.id, { reason: run.errorLog });
        sendJson(res, 200, { run, source: await store.getPromptSourceById(source.id) });
        return true;
      }
    }

    return false;
  };
}

module.exports = { createAdminPromptSourcesRoute };
