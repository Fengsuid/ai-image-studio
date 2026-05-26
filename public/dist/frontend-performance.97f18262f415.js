(function initFrontendPerformance(global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const root = doc.documentElement;
  const perf = global.performance;
  const reduceMotionQuery = global.matchMedia?.("(prefers-reduced-motion: reduce)");
  const connection = global.navigator?.connection || global.navigator?.mozConnection || global.navigator?.webkitConnection || null;
  const patchedHeroVideos = new WeakMap();

  function prefersReducedMotion() {
    return Boolean(reduceMotionQuery?.matches);
  }

  function saveDataEnabled() {
    return Boolean(connection?.saveData);
  }

  function slowConnectionEnabled() {
    return ["slow-2g", "2g"].includes(String(connection?.effectiveType || "").toLowerCase());
  }

  function lowDeviceClass() {
    const memory = Number(global.navigator?.deviceMemory || 0);
    const cores = Number(global.navigator?.hardwareConcurrency || 0);
    return (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
  }

  function isLowPowerMode() {
    return prefersReducedMotion() || saveDataEnabled() || slowConnectionEnabled() || lowDeviceClass();
  }

  function setFlags() {
    root.classList.toggle("performance-reduced-motion", prefersReducedMotion());
    root.classList.toggle("performance-save-data", saveDataEnabled());
    root.classList.toggle("performance-slow-connection", slowConnectionEnabled());
    root.classList.toggle("performance-low", isLowPowerMode());
  }

  function scheduleIdle(callback, timeout = 1200) {
    if (typeof callback !== "function") return 0;
    if (global.requestIdleCallback) {
      return global.requestIdleCallback(callback, { timeout });
    }
    return global.setTimeout(callback, Math.min(timeout, 180));
  }

  function applyImageBudgets(scope = doc) {
    scope.querySelectorAll?.("img").forEach((image) => {
      if (!image.hasAttribute("decoding")) image.decoding = "async";
      if (!image.hasAttribute("loading") && !image.closest(".hero")) image.loading = "lazy";
      if (!image.hasAttribute("fetchpriority") && image.loading === "lazy") image.setAttribute("fetchpriority", "low");
    });
  }

  function observeCards(scope = doc) {
    const candidates = scope.querySelectorAll?.([
      ".recent-tile",
      ".prompt-card",
      ".work-card",
      ".gallery-rank-card",
      ".generation-card",
      ".admin-panel"
    ].join(",")) || [];
    if (!candidates.length) return;
    if (!("IntersectionObserver" in global)) {
      candidates.forEach((node) => node.classList.add("perf-observed"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        entry.target.classList.add("perf-observed");
        entry.target.dataset.perfVisible = String(entry.isIntersecting);
      }
    }, { rootMargin: "180px 0px", threshold: 0.01 });
    candidates.forEach((node) => {
      if (node.dataset.perfObserved === "true") return;
      node.dataset.perfObserved = "true";
      observer.observe(node);
    });
  }

  function shouldDisableHeroVideo() {
    return prefersReducedMotion() || saveDataEnabled() || slowConnectionEnabled() || lowDeviceClass();
  }

  function shouldAvoidHeroWatchdog() {
    return isLowPowerMode() || doc.visibilityState === "hidden";
  }

  function scheduleHeroVideo(callback, video) {
    if (shouldDisableHeroVideo()) return;
    const start = () => {
      if (doc.hidden || shouldDisableHeroVideo()) return;
      callback?.();
    };
    if (video && "IntersectionObserver" in global) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          scheduleIdle(start, 1600);
        }
      }, { threshold: 0.2 });
      observer.observe(video);
      return;
    }
    scheduleIdle(start, 1600);
  }

  function applyHeroVideoBudget(scope = doc) {
    const video = scope.querySelector?.(".hero-video-layer video") || doc.querySelector(".hero-video-layer video");
    if (!video) return;
    video.removeAttribute("autoplay");
    if (!shouldDisableHeroVideo()) {
      video.preload = "metadata";
      return;
    }
    video.preload = "none";
    video.pause();
    if (!patchedHeroVideos.has(video)) {
      patchedHeroVideos.set(video, video.play?.bind(video));
      video.play = () => Promise.resolve();
    }
  }

  function installMutationBudget() {
    if (!("MutationObserver" in global)) return;
    let scheduled = false;
    const run = () => {
      scheduled = false;
      applyHeroVideoBudget();
      applyImageBudgets();
      observeCards();
    };
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      scheduleIdle(run, 900);
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  function reportNavigationBudget() {
    const nav = perf?.getEntriesByType?.("navigation")?.[0];
    if (!nav) return;
    doc.body.dataset.perfDomInteractive = String(Math.round(nav.domInteractive || 0));
  }

  function apply() {
    setFlags();
    applyHeroVideoBudget();
    applyImageBudgets();
    observeCards();
    scheduleIdle(reportNavigationBudget, 2000);
  }

  function start() {
    apply();
    installMutationBudget();
    reduceMotionQuery?.addEventListener?.("change", apply);
    connection?.addEventListener?.("change", apply);
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  global.ImageStudioPerformance = {
    apply,
    scheduleIdle,
    scheduleHeroVideo,
    shouldAvoidHeroWatchdog,
    shouldDisableHeroVideo,
    budget: Object.freeze({
      appEntryMaxBytes: 340000,
      adminEntryMaxBytes: 120000,
      initialNonCanvasJsMaxBytes: 430000,
      cssModuleMaxBytes: 16000
    })
  };
})(window);
