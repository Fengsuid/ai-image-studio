(function initAppRouter(global, document) {
  "use strict";

  const AppModules = global.AppModules || (global.AppModules = {});
  const routePromises = new Map();
  const scriptPromises = new Map();
  const ROUTER_VERSION = "20260527-lazy-route-loader-v1";
  const fallbackRoutes = Object.freeze({
    admin: {
      entry: "/admin/dashboard.js",
      scripts: [
        "/admin-generation-diagnostics.js",
        "/admin-overview.js",
        "/admin-users.js",
        "/admin-providers.js",
        "/admin-gallery.js",
        "/admin-settings.js",
        "/admin-shell-polish.js",
        "/admin/users.js",
        "/admin/prompts.js",
        "/admin/announcements.js",
        "/admin/settings.js",
        "/admin/canvas.js",
        "/admin/command-palette.js",
        "/admin/dashboard.js"
      ]
    },
    canvas: {
      entry: "/canvas.js",
      scripts: [
        "/cache-db.js",
        "/canvas-store.js",
        "/canvas-nodes.js",
        "/canvas-geometry.js",
        "/canvas-layout.js",
        "/canvas-edges.js",
        "/canvas-workflows.js",
        "/canvas-minimap.js",
        "/canvas-selection.js",
        "/canvas-history.js",
        "/canvas-io.js",
        "/canvas-assistant.js",
        "/canvas-toolbar.js",
        "/canvas-inspector.js",
        "/canvas-market.js",
        "/canvas.js"
      ]
    }
  });
  let canvasBindingContext = null;
  let canvasShellEventsBound = false;

  function manifest() {
    return AppModules.build || {};
  }

  function routeConfig(routeName) {
    return manifest().js?.lazyRoutes?.[routeName] || fallbackRoutes[routeName] || null;
  }

  function assetFor(source) {
    const cleanSource = cleanPath(source);
    const assets = manifest().js?.assets || [];
    return assets.find((asset) => asset.source === cleanSource) || null;
  }

  function cleanPath(src) {
    try {
      return new URL(src, global.location.href).pathname;
    } catch {
      return String(src || "").split("?")[0] || "";
    }
  }

  function entryFor(source) {
    const entry = assetFor(source)?.entry || source;
    return entry.includes("?") || entry.startsWith("/dist/") ? entry : `${entry}?v=${ROUTER_VERSION}`;
  }

  function scriptExists(src) {
    const expectedPath = cleanPath(src);
    return Array.from(document.scripts).some((script) => cleanPath(script.getAttribute("src") || "") === expectedPath);
  }

  function loadScript(source) {
    const entry = entryFor(source);
    const key = cleanPath(entry);
    if (!key) return Promise.resolve();
    if (scriptPromises.has(key)) return scriptPromises.get(key);
    if (scriptExists(entry)) return Promise.resolve();

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = entry;
      script.async = false;
      script.dataset.routeSource = cleanPath(source);
      script.addEventListener("load", () => resolve(script), { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${entry}`)), { once: true });
      document.head.appendChild(script);
    });
    scriptPromises.set(key, promise);
    return promise;
  }

  function routeFromPage() {
    const current = document.currentScript;
    const explicit = current?.dataset?.routeEntry || document.documentElement.dataset.routeEntry || "";
    if (explicit) return explicit;
    if (global.location.pathname.replace(/\/+$/, "") === "/admin") return "admin";
    if (global.location.hash.startsWith("#/canvas")) return "canvas";
    return "";
  }

  function dispatchLoaded(routeName) {
    document.dispatchEvent(new CustomEvent("imagestudio:route-loaded", {
      detail: { route: routeName }
    }));
  }

  function reportRouteLoadError(routeName, error) {
    global.ImageStudioClientErrorMonitor?.report?.({
      kind: "lazy_route_error",
      message: error?.message || `Failed to load route ${routeName}`,
      source: "app-router",
      routeSource: routeName,
      stack: error?.stack || ""
    });
  }

  function bindCanvasShellEvents(context = canvasBindingContext) {
    if (context) canvasBindingContext = context;
    if (canvasShellEventsBound || !canvasBindingContext || !global.ImageStudioCanvas?.bindShellEvents) return;
    global.ImageStudioCanvas.bindShellEvents(canvasBindingContext);
    canvasShellEventsBound = true;
  }

  function ensureRoute(routeName) {
    const name = String(routeName || "").trim();
    if (!name) return Promise.resolve(null);
    if (routePromises.has(name)) return routePromises.get(name);

    const route = routeConfig(name);
    if (!route || !Array.isArray(route.scripts)) return Promise.resolve(null);

    const promise = (async () => {
      for (const source of route.scripts) {
        await loadScript(source);
      }
      if (name === "canvas") bindCanvasShellEvents();
      dispatchLoaded(name);
      return route;
    })();
    routePromises.set(name, promise);
    return promise;
  }

  function routeScriptSources(routeName) {
    return [...(routeConfig(routeName)?.scripts || [])];
  }

  function ensureCanvas(context) {
    if (context) canvasBindingContext = context;
    return ensureRoute("canvas").then(() => {
      bindCanvasShellEvents(context);
      return global.ImageStudioCanvas || null;
    });
  }

  function ensureAdmin() {
    return ensureRoute("admin").then(() => global.AdminModules || null);
  }

  const router = {
    ensureRoute,
    ensureCanvas,
    ensureAdmin,
    bindCanvasShellEvents,
    loadScript,
    assetFor,
    routeScriptSources
  };
  global.ImageStudioRouter = router;

  if (typeof AppModules.register === "function") {
    AppModules.register("router", router);
  } else {
    AppModules.router = router;
  }

  const initialRoute = routeFromPage();
  if (initialRoute) {
    void ensureRoute(initialRoute).catch((error) => {
      console.error("[app-router]", error);
      reportRouteLoadError(initialRoute, error);
      document.dispatchEvent(new CustomEvent("imagestudio:route-load-error", {
        detail: { route: initialRoute, error }
      }));
    });
  }

  global.addEventListener("hashchange", () => {
    if (global.location.hash.startsWith("#/canvas")) {
      void ensureCanvas().catch((error) => {
        console.error("[app-router]", error);
        reportRouteLoadError("canvas", error);
      });
    }
  });
})(window, document);
