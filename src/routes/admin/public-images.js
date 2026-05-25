"use strict";

const { getLimit, requireAdmin } = require("./shared");

function createAdminPublicImagesRoute(deps) {
  const { store, sendJson, readJsonBody, writeAdminAudit } = deps;

  return async function handleAdminPublicImagesRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/public-images") {
      await requireAdmin(deps, req);
      const status = url.searchParams.get("status") || "queue";
      const includeBroken = url.searchParams.get("includeBroken") === "1";
      const generations = status === "all"
        ? (await store.listPublicGenerations(getLimit(deps, url, 120, 200), { includeModerated: true, includeBroken })).map(deps.generationResponse)
        : (await store.listGalleryModeration({ limit: getLimit(deps, url, 120, 200), status, includeBroken })).map(deps.generationResponse);
      sendJson(res, 200, { generations });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/gallery-file-checks") {
      await requireAdmin(deps, req);
      const checks = await store.listGalleryFileChecks({
        status: url.searchParams.get("status") || "broken",
        limit: getLimit(deps, url, 120, 500)
      });
      sendJson(res, 200, { checks });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/gallery-file-checks/run") {
      const current = await requireAdmin(deps, req);
      const body = await readJsonBody(req).catch(() => ({}));
      const result = await deps.runGalleryFileChecks({ limit: deps.sanitizePositiveInt(body.limit, 1000, 5000) });
      await writeAdminAudit(current, req, "gallery_file_check_run", "gallery", "public-images", {
        scanned: result.scanned,
        checked: result.checked,
        broken: result.broken
      });
      sendJson(res, 200, result);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/gallery-like-anomalies") {
      await requireAdmin(deps, req);
      sendJson(res, 200, { anomalies: await store.listGenerationLikeAnomalies({ limit: getLimit(deps, url, 100, 500) }) });
      return true;
    }

    return false;
  };
}

module.exports = { createAdminPublicImagesRoute };
