(function initClientErrorMonitor(global) {
  "use strict";

  const endpoint = "/api/client-error";
  const seen = new Map();
  const sessionId = `cem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const throttleMs = 10_000;

  function compact(value, max = 1000) {
    return String(value || "").slice(0, max);
  }

  function errorStack(error) {
    return compact(error?.stack || "", 2000);
  }

  function errorMessage(error, fallback = "") {
    return compact(error?.message || fallback || String(error || ""), 500);
  }

  function dedupeKey(payload) {
    return [
      payload.kind,
      payload.message,
      payload.source,
      payload.line || 0,
      payload.column || 0,
      payload.routeSource || ""
    ].join("|");
  }

  function shouldSend(payload) {
    const key = dedupeKey(payload);
    const now = Date.now();
    const last = seen.get(key) || 0;
    if (now - last < throttleMs) return false;
    seen.set(key, now);
    if (seen.size > 80) {
      for (const [entry, timestamp] of seen) {
        if (now - timestamp > throttleMs * 6) seen.delete(entry);
      }
    }
    return true;
  }

  function send(payload) {
    const body = JSON.stringify({
      kind: compact(payload.kind || "client_error", 40),
      message: compact(payload.message, 500),
      source: compact(payload.source, 255),
      line: Number(payload.line || 0),
      column: Number(payload.column || 0),
      stack: compact(payload.stack, 2000),
      path: compact(global.location?.pathname || "", 255),
      routeSource: compact(payload.routeSource, 160),
      sessionId,
      userAgent: compact(global.navigator?.userAgent || "", 255)
    });
    if (!shouldSend(JSON.parse(body))) return;
    if (global.navigator?.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (global.navigator.sendBeacon(endpoint, blob)) return;
    }
    global.fetch?.(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  }

  global.addEventListener("error", (event) => {
    const target = event.target;
    if (target instanceof HTMLScriptElement) {
      send({
        kind: "lazy_script_error",
        message: `Failed to load script ${target.src || target.dataset.routeSource || ""}`,
        source: target.src || "",
        routeSource: target.dataset.routeSource || ""
      });
      return;
    }
    if (target && target !== global) return;
    send({
      kind: "client_error",
      message: errorMessage(event.error, event.message),
      source: event.filename || "",
      line: event.lineno || 0,
      column: event.colno || 0,
      stack: errorStack(event.error)
    });
  }, true);

  global.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    send({
      kind: "unhandledrejection",
      message: errorMessage(reason, "Unhandled promise rejection"),
      source: reason?.fileName || "",
      line: reason?.lineNumber || 0,
      column: reason?.columnNumber || 0,
      stack: errorStack(reason)
    });
  });

  global.ImageStudioClientErrorMonitor = { report: send, sessionId };
})(window);
