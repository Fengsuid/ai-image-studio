"use strict";

const { requireAdmin } = require("./shared");

function createAdminDiagnosticsRoute(deps) {
  const { sendJson, rumEvents, rumSummary } = deps;

  return async function handleAdminDiagnosticsRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/rum") {
      await requireAdmin(deps, req);
      sendJson(res, 200, { summary: rumSummary(), events: rumEvents.slice(-100).reverse() });
      return true;
    }

    return false;
  };
}

module.exports = { createAdminDiagnosticsRoute };
