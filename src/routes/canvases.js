"use strict";

// Owns canvas workspace routes:
// GET/POST /api/canvases, GET /api/canvases/templates,
// GET/PATCH/DELETE /api/canvases/:id,
// GET /api/canvases/:id/export, POST /api/canvases/:id/import|assistant|duplicate|generate.
function createCanvasesRoute({
  canvasService,
  sendJson,
  readJsonBody,
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt
}) {
  return async function handleCanvasesRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/canvases") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 200);
      const requestedScope = url.searchParams.get("scope");
      const scope = requestedScope === "public" ? "public" : requestedScope === "templates" ? "templates" : requestedScope === "all" ? "all" : "mine";
      if (scope === "all") ensureAdmin(current);
      sendJson(res, 200, await canvasService.list(current.user, { limit, scope }));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/canvases") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      sendJson(res, 201, await canvasService.create(current.user, body));
      return true;
    }

    const canvasExportMatch = url.pathname.match(/^\/api\/canvases\/([^/]+)\/export$/);
    if (canvasExportMatch && req.method === "GET") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      sendJson(res, 200, await canvasService.exportCanvas(current.user, canvasExportMatch[1]));
      return true;
    }

    const canvasImportMatch = url.pathname.match(/^\/api\/canvases\/([^/]+)\/import$/);
    if (canvasImportMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      sendJson(res, 200, await canvasService.importCanvas(current.user, canvasImportMatch[1], body));
      return true;
    }

    const canvasAssistantMatch = url.pathname.match(/^\/api\/canvases\/([^/]+)\/assistant$/);
    if (canvasAssistantMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      sendJson(res, 200, await canvasService.assistant(current.user, canvasAssistantMatch[1], body));
      return true;
    }

    const canvasDuplicateMatch = url.pathname.match(/^\/api\/canvases\/([^/]+)\/duplicate$/);
    if (canvasDuplicateMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      sendJson(res, 201, await canvasService.duplicate(current.user, canvasDuplicateMatch[1], body));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/canvases/templates") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 24, 100);
      sendJson(res, 200, await canvasService.templates(current.user, limit));
      return true;
    }

    const canvasMatch = url.pathname.match(/^\/api\/canvases\/([^/]+)$/);
    if (canvasMatch && req.method === "GET") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      sendJson(res, 200, await canvasService.get(current.user, canvasMatch[1]));
      return true;
    }

    if (canvasMatch && req.method === "PATCH") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      sendJson(res, 200, await canvasService.update(current.user, canvasMatch[1], body));
      return true;
    }

    if (canvasMatch && req.method === "DELETE") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      sendJson(res, 200, await canvasService.remove(current.user, canvasMatch[1]));
      return true;
    }

    const canvasGenerateMatch = url.pathname.match(/^\/api\/canvases\/([^/]+)\/generate$/);
    if (canvasGenerateMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const result = await canvasService.generate(current.user.id, canvasGenerateMatch[1], body, req, res);
      if (result) sendJson(res, 200, result);
      return true;
    }

    return false;
  };
}

module.exports = { createCanvasesRoute };
