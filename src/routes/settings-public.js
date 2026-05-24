"use strict";

function createSettingsPublicRoute({
  store,
  sendJson,
  publicSettings
}) {
  return async function handleSettingsPublicRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/settings") {
      const settings = await store.getSettings();
      sendJson(res, 200, publicSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/growth") {
      const settings = await store.getSettings();
      const settingsPayload = publicSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true }));
      sendJson(res, 200, {
        growth: settingsPayload.growth,
        providerCapabilities: settingsPayload.providerCapabilities,
        activeProvider: settingsPayload.activeProvider
      });
      return true;
    }

    return false;
  };
}

module.exports = { createSettingsPublicRoute };
