function createHealthRoute({
  appVersion,
  imageDownloadTimeoutMs,
  nowIso,
  openaiFetchTimeoutMs,
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

  function pushRumEvent(event) {
    if (!event.name) return;
    rumEvents.push(event);
    if (rumEvents.length > 1000) rumEvents.splice(0, rumEvents.length - 1000);
  }

  function clientIp(req) {
    return String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
      .split(",")[0]
      .trim()
      .slice(0, 80);
  }

  function text(value, max = 255) {
    return String(value || "").slice(0, max);
  }

  return async function handleHealthRoute(req, res, url) {
    if (req.method === "POST" && url.pathname === "/api/csp-report") {
      const body = await readJsonBody(req).catch(() => ({}));
      const report = body["csp-report"] || body.cspReport || body.report || {};
      pushRumEvent({
        name: "csp_report",
        value: 1,
        path: text(report["document-uri"] || report.documentUri || body.path || "", 255),
        detail: {
          message: text(report["violated-directive"] || report.violatedDirective || "csp-report", 160),
          source: text(report["blocked-uri"] || report.blockedUri || "", 255),
          line: Number(report["line-number"] || report.lineNumber || 0),
          column: Number(report["column-number"] || report.columnNumber || 0),
          stack: text(report["script-sample"] || report.scriptSample || "", 500),
          userAgent: text(req.headers["user-agent"] || "", 255),
          ip: clientIp(req)
        },
        createdAt: nowIso()
      });
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
        pushRumEvent(metric);
      }
      sendNoContent(res);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/client-error") {
      const body = await readJsonBody(req).catch(() => ({}));
      const kind = text(body.kind || "client_error", 40);
      const metric = {
        name: kind,
        value: 1,
        path: text(body.path || "", 255),
        detail: {
          message: text(body.message || "", 500),
          source: text(body.source || body.filename || "", 255),
          line: Number(body.line || body.lineno || 0),
          column: Number(body.column || body.colno || 0),
          stack: text(body.stack || "", 2000),
          userAgent: text(req.headers["user-agent"] || body.userAgent || "", 255),
          sessionId: text(body.sessionId || "", 80),
          routeSource: text(body.routeSource || "", 160),
          ip: clientIp(req)
        },
        createdAt: nowIso()
      };
      if (metric.detail.message || metric.detail.source || metric.detail.stack) {
        pushRumEvent(metric);
        console.warn("[client-error]", metric);
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
