(function initAdminShellPolish(global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const root = doc.documentElement;
  const themeStorageKey = "theme";

  function preferredTheme() {
    try {
      const stored = global.localStorage?.getItem(themeStorageKey);
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }
    return global.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  function currentTheme() {
    return root.dataset.theme === "dark" || root.dataset.theme === "light" ? root.dataset.theme : preferredTheme();
  }

  function updateThemeButton() {
    const button = doc.getElementById("adminThemeToggle");
    if (!button) return;
    const isDark = currentTheme() === "dark";
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
    button.title = isDark ? "切换浅色模式" : "切换深色模式";
    button.innerHTML = `<i class="${isDark ? "ri-sun-line" : "ri-moon-line"}" aria-hidden="true"></i>`;
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    try {
      global.localStorage?.setItem(themeStorageKey, nextTheme);
    } catch {
      // Ignore persistence failures; the immediate UI state is still applied.
    }
    updateThemeButton();
  }

  function installThemeToggle() {
    const status = doc.querySelector(".admin-status");
    if (!status || doc.getElementById("adminThemeToggle")) return;
    const button = doc.createElement("button");
    button.id = "adminThemeToggle";
    button.className = "admin-icon-button admin-theme-toggle";
    button.type = "button";
    button.addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
    status.insertBefore(button, doc.getElementById("adminRefreshBtn") || status.firstChild);
    updateThemeButton();
  }

  function ensureStateIcon(element, iconClass) {
    if (element.querySelector("i")) return;
    const icon = doc.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");
    element.prepend(icon);
  }

  function isErrorState(text) {
    return /失败|错误|无权限|error|failed|forbidden|denied/i.test(text || "");
  }

  function decoratePanels(scope) {
    scope.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.classList.add("admin-section-shell");
      const heading = panel.querySelector("h2, h3");
      if (heading && !panel.dataset.adminSection) panel.dataset.adminSection = heading.textContent.trim().slice(0, 40);
    });
    scope.querySelectorAll(".admin-panel-head span").forEach((meta) => meta.classList.add("admin-list-meta"));
    scope.querySelectorAll(".admin-issue-list").forEach((list) => list.classList.add("admin-risk-strip"));
  }

  function decorateTables(scope) {
    scope.querySelectorAll(".admin-table-wrap").forEach((wrap) => {
      const table = wrap.querySelector(".admin-table");
      if (!table) return;
      const rows = table.querySelectorAll("tbody tr").length;
      wrap.dataset.adminTable = "true";
      wrap.dataset.rows = String(rows);
      if (!wrap.getAttribute("aria-label")) {
        const title = wrap.closest(".admin-panel")?.querySelector("h2, h3")?.textContent?.trim();
        if (title) wrap.setAttribute("aria-label", `${title} 表格`);
      }
    });
  }

  function decorateStates(scope) {
    scope.querySelectorAll(".admin-empty-state, .admin-auth-required").forEach((state) => {
      const error = isErrorState(state.textContent);
      state.classList.toggle("admin-error-state", error);
      state.setAttribute("role", error ? "alert" : "status");
      ensureStateIcon(state, error ? "ri-error-warning-line" : "ri-inbox-archive-line");
    });
    doc.body.classList.toggle("admin-low-permission", Boolean(scope.querySelector(".admin-auth-required")));
  }

  function decorateBulkBars(scope) {
    scope.querySelectorAll(".admin-bulk-bar").forEach((bar) => {
      const selectedText = bar.textContent.match(/已选\s*([\d,，]+)/)?.[1] || "0";
      const selectedCount = Number(selectedText.replace(/[^\d]/g, "") || 0);
      bar.setAttribute("data-has-selection", String(selectedCount > 0));
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "批量操作");
    });
  }

  function decorateDrawer() {
    const drawer = doc.getElementById("adminDrawer");
    const backdrop = doc.getElementById("adminDrawerBackdrop");
    if (drawer) {
      const open = !drawer.classList.contains("hidden");
      drawer.setAttribute("aria-hidden", String(!open));
      drawer.setAttribute("role", "dialog");
      drawer.setAttribute("aria-modal", "true");
      const title = drawer.querySelector(".admin-drawer-head h2");
      if (title) {
        if (!title.id) title.id = "adminDrawerTitle";
        drawer.setAttribute("aria-labelledby", title.id);
      }
    }
    if (backdrop) backdrop.setAttribute("aria-hidden", String(backdrop.classList.contains("hidden")));
  }

  function decorateShell() {
    installThemeToggle();
    const activeNav = doc.querySelector("#adminNav button.active");
    doc.body.dataset.adminSection = activeNav?.dataset.section || "overview";
    const content = doc.getElementById("adminContent") || doc;
    content.setAttribute?.("data-admin-active", doc.body.dataset.adminSection);
    decoratePanels(content);
    decorateTables(content);
    decorateStates(content);
    decorateBulkBars(content);
    decorateDrawer();
    updateThemeButton();
  }

  function scheduleDecorate() {
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(decorateShell);
    } else {
      global.setTimeout(decorateShell, 0);
    }
  }

  function start() {
    if (!root.dataset.theme) root.dataset.theme = preferredTheme();
    decorateShell();
    const observer = new MutationObserver(scheduleDecorate);
    ["adminContent", "adminDrawer", "adminStatus", "adminNav"].forEach((id) => {
      const target = doc.getElementById(id);
      if (target) observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-tone"] });
    });
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.AdminShellPolish = {
    apply: decorateShell,
    applyTheme
  };
})(window);
