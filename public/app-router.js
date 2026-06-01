(function initAppRouter(global, document) {
  "use strict";

  const AppModules = global.AppModules || (global.AppModules = {});
  const routePromises = new Map();
  const scriptPromises = new Map();
  const routeStates = new Map();
  const scriptStates = new Map();
  const ROUTER_VERSION = "20260601-lazy-load-state-machine-v1";
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

  function stateFor(map, name) {
    if (!map.has(name)) {
      map.set(name, {
        name,
        status: "idle",
        error: "",
        updatedAt: Date.now()
      });
    }
    return map.get(name);
  }

  function updateState(map, name, status, details = {}) {
    const state = stateFor(map, name);
    state.status = status;
    state.error = details.error?.message || details.error || "";
    state.updatedAt = Date.now();
    document.dispatchEvent(new CustomEvent("imagestudio:route-state", {
      detail: {
        name,
        status,
        kind: map === routeStates ? "route" : "script",
        error: state.error,
        ...details
      }
    }));
    return state;
  }

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
    return Array.from(document.scripts).some((script) => {
      if (script.dataset.routeState === "error") return false;
      return cleanPath(script.getAttribute("src") || "") === expectedPath;
    });
  }

  function loadingTarget(routeName) {
    if (routeName === "admin") return document.getElementById("adminContent");
    if (routeName === "canvas") return document.getElementById("canvasListView") || document.getElementById("canvasWorkspaceView");
    return null;
  }

  function routeLabel(routeName) {
    return routeName === "admin" ? "后台模块" : routeName === "canvas" ? "画布模块" : "模块";
  }

  function renderRouteLoading(routeName) {
    const target = loadingTarget(routeName);
    if (!target || target.dataset.routeReady === routeName) return;
    target.dataset.routeState = "loading";
    target.innerHTML = `<section class="route-loading-shell" role="status" aria-live="polite" data-route-loading="${routeName}">
      <div class="skeleton-list skeleton-list-card">
        ${Array.from({ length: 3 }, () => `<article class="skeleton-card anim-shimmer"><div class="skeleton-thumb"></div><div class="skeleton-copy"><span class="skeleton-line"></span><span class="skeleton-line short"></span></div></article>`).join("")}
      </div>
      <p>${routeLabel(routeName)}加载中...</p>
    </section>`;
  }

  function clearRouteLoading(routeName) {
    const target = loadingTarget(routeName);
    if (!target || target.dataset.routeState !== "loading") return;
    target.dataset.routeReady = routeName;
    target.dataset.routeState = "ready";
    target.innerHTML = "";
  }

  function renderRouteError(routeName, error) {
    const target = loadingTarget(routeName);
    if (!target) return;
    target.dataset.routeState = "error";
    target.innerHTML = `<section class="route-error-shell" role="alert" data-route-error="${routeName}">
      <i class="ri-error-warning-line" aria-hidden="true"></i>
      <h2>${routeLabel(routeName)}加载失败</h2>
      <p>${escapeHtml(error?.message || "请检查网络后重试。")}</p>
      <button class="btn btn--primary" type="button" data-route-retry="${routeName}">
        <i class="ri-refresh-line" aria-hidden="true"></i>
        <span>重试</span>
      </button>
    </section>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function resetRoute(routeName) {
    routePromises.delete(routeName);
    updateState(routeStates, routeName, "idle");
  }

  function loadScript(source, routeName = "") {
    const entry = entryFor(source);
    const key = cleanPath(entry);
    if (!key) return Promise.resolve();
    if (scriptPromises.has(key)) return scriptPromises.get(key);
    if (scriptExists(entry)) {
      updateState(scriptStates, cleanPath(source), "ready", { route: routeName, entry });
      return Promise.resolve();
    }

    updateState(scriptStates, cleanPath(source), "loading", { route: routeName, entry });
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = entry;
      script.async = false;
      script.defer = true;
      script.dataset.routeSource = cleanPath(source);
      script.dataset.routeName = routeName;
      script.dataset.routeState = "loading";
      script.addEventListener("load", () => {
        script.dataset.routeState = "ready";
        updateState(scriptStates, cleanPath(source), "ready", { route: routeName, entry });
        resolve(script);
      }, { once: true });
      script.addEventListener("error", () => {
        const error = new Error(`Failed to load ${entry}`);
        scriptPromises.delete(key);
        script.dataset.routeState = "error";
        script.remove?.();
        updateState(scriptStates, cleanPath(source), "error", { route: routeName, entry, error });
        reject(error);
      }, { once: true });
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

    renderRouteLoading(name);
    updateState(routeStates, name, "loading", { route });
    const promise = (async () => {
      try {
        for (const source of route.scripts) {
          await loadScript(source, name);
        }
        if (name === "canvas") bindCanvasShellEvents();
        clearRouteLoading(name);
        updateState(routeStates, name, "ready", { route });
        dispatchLoaded(name);
        return route;
      } catch (error) {
        routePromises.delete(name);
        updateState(routeStates, name, "error", { route, error });
        renderRouteError(name, error);
        reportRouteLoadError(name, error);
        document.dispatchEvent(new CustomEvent("imagestudio:route-load-error", {
          detail: { route: name, error }
        }));
        throw error;
      }
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

  function routeStatus(routeName) {
    return { ...stateFor(routeStates, String(routeName || "")) };
  }

  function scriptStatus(source) {
    return { ...stateFor(scriptStates, cleanPath(source)) };
  }

  function retryRoute(routeName) {
    const name = String(routeName || "").trim();
    if (!name) return Promise.resolve(null);
    resetRoute(name);
    return ensureRoute(name);
  }

  const router = {
    ensureRoute,
    ensureCanvas,
    ensureAdmin,
    bindCanvasShellEvents,
    loadScript,
    assetFor,
    routeScriptSources,
    routeStatus,
    scriptStatus,
    retryRoute
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
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-route-retry]");
    if (!button) return;
    event.preventDefault();
    const routeName = button.dataset.routeRetry || "";
    void retryRoute(routeName).catch((error) => {
      console.error("[app-router]", error);
    });
  });

  global.addEventListener("hashchange", () => {
    if (global.location.hash.startsWith("#/canvas")) {
      void ensureCanvas().catch((error) => {
        console.error("[app-router]", error);
      });
    }
  });
})(window, document);
