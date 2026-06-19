(function () {
  const STORAGE_KEY = "imageStudio.theme";
  const VALID_THEMES = new Set(["light", "dark"]);
  const root = document.documentElement;

  function systemPrefersDark() {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches || false;
  }

  function readStoredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return VALID_THEMES.has(stored) ? stored : "";
    } catch {
      return "";
    }
  }

  function currentTheme() {
    const explicit = root.dataset.theme;
    if (VALID_THEMES.has(explicit)) return explicit;
    return systemPrefersDark() ? "dark" : "light";
  }

  function syncLegacyThemeKey(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Legacy admin key stays best-effort only.
    }
  }

  function applyTheme(theme, { persist = false, transition = false } = {}) {
    if (!VALID_THEMES.has(theme)) return;
    if (transition) root.classList.add("theme-transitioning");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Theme preference is progressive enhancement.
      }
      syncLegacyThemeKey(theme);
    }
    updateThemeToggle();
    if (transition) {
      window.setTimeout(() => root.classList.remove("theme-transitioning"), 340);
    }
  }

  function toggleTheme() {
    applyTheme(currentTheme() === "dark" ? "light" : "dark", { persist: true, transition: true });
  }

  function updateThemeToggle() {
    const button = document.getElementById("themeToggle");
    if (!button) return;
    const isDark = currentTheme() === "dark";
    button.setAttribute("aria-pressed", String(isDark));
    button.title = isDark ? "切换浅色模式" : "切换深色模式";
    button.setAttribute("aria-label", button.title);
  }

  function actionToActive(action, state = {}) {
    if (action) return action;
    if (state.active) return state.active;
    if (state.view === "leaderboard") return "ranking";
    if (state.view === "home") return state.heroVisible === false ? "create" : "home";
    return "";
  }

  function setActive(action, state = {}) {
    const active = actionToActive(action, state);
    document.querySelectorAll("[data-mobile-nav-action]").forEach((item) => {
      const selected = item.dataset.mobileNavAction === active;
      item.classList.toggle("active", selected);
      if (selected) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function runAction(action) {
    const app = window.ImageStudioAppActions || {};
    if (action !== "create" && action !== "my" && action !== "notifications") {
      app.releaseSessionDrawerLock?.();
    }
    if (action === "home") {
      app.navigate?.("home", { scrollTop: true, scrollBehavior: "smooth" });
      return;
    }
    if (action === "ranking") {
      app.navigate?.("leaderboard", { scrollTop: true, scrollBehavior: "smooth" });
      return;
    }
    if (action === "create") {
      app.focusGenerationComposer?.();
      return;
    }
    if (action === "notifications") {
      if (app.isLoggedIn?.()) app.openNotificationsModal?.();
      else app.openAuthModal?.("login");
      setActive("notifications");
      return;
    }
    if (action === "my") {
      if (app.isLoggedIn?.()) app.openMyWorksModal?.();
      else app.openAuthModal?.("login");
      setActive("my");
    }
  }

  function bindBottomNav() {
    document.querySelectorAll("[data-mobile-nav-action]").forEach((item) => {
      item.addEventListener("click", () => runAction(item.dataset.mobileNavAction || ""));
    });
  }

  const storedTheme = readStoredTheme();
  applyTheme(storedTheme || currentTheme());

  window.ImageStudioThemeNav = {
    sync(state = {}) {
      setActive("", state);
      updateThemeToggle();
    },
    setActive,
    toggleTheme
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
    bindBottomNav();
    updateThemeToggle();
    setActive("home");
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
      if (!readStoredTheme()) applyTheme(currentTheme());
    });
  });
})();
