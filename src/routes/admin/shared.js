"use strict";

async function requireAdmin(deps, req) {
  const current = await deps.getCurrentUser(req);
  deps.ensureAuthenticated(current);
  deps.ensureAdmin(current);
  return current;
}

function getLimit(deps, url, fallback = 100, max = 500) {
  return deps.sanitizePositiveInt(url.searchParams.get("limit"), fallback, max);
}

module.exports = { getLimit, requireAdmin };
