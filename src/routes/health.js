function createHealthRoute({
  appVersion,
  imageDownloadTimeoutMs,
  nowIso,
  openaiFetchTimeoutMs,
  openaiImageEditTimeoutMs,
  openaiImageGenerationTimeoutMs,
  publicSettings,
  readJsonBody,
  rumEvents,
  sendJson,
  sendNoContent,
  serverStartedAt,
  store
}) {
  if (!Array.isArray(rumEvents)) {
    throw new Error("createHealthRoutes requires rumEvents array");
  }

  return async function handleHealthRoute(req, res, url) {
    if (req.method === "POST" && url.pathname === "/api/csp-report") {
      await readJsonBody(req).catch(() => ({}));
      sendNoContent(res);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/rum") {
      const body = await readJsonBody(req).catch(() => ({}));
      const metric = {
        name: String(body.name || "").slice(0, 40),
        value: Number(body.value || 0),
        path: String(body.path || "").slice(0, 255),
        detail: body.detail && typeof body.detail === "object" ? body.detail : null,
        createdAt: nowIso()
      };
      if (metric.name) {
        rumEvents.push(metric);
        if (rumEvents.length > 1000) rumEvents.splice(0, rumEvents.length - 1000);
      }
      sendNoContent(res);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/version") {
      sendJson(res, 200, {
        ok: true,
        version: appVersion,
        startedAt: serverStartedAt,
        uptimeSeconds: Math.round(process.uptime()),
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        timeoutMs: {
          openai: openaiFetchTimeoutMs,
          openaiImageGeneration: openaiImageGenerationTimeoutMs,
          openaiImageEdit: openaiImageEditTimeoutMs,
          imageDownload: imageDownloadTimeoutMs
        }
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      const settings = await store.getSettings();
      const activeProvider = await store.getDefaultProviderConfig({ includeSecret: true });
      sendJson(res, 200, {
        ok: true,
        version: appVersion,
        startedAt: serverStartedAt,
        firstRun: (await store.countUsers()) === 0,
        settings: publicSettings(settings, activeProvider)
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createHealthRoute
};
