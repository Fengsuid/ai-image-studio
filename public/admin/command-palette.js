(function initAdminCommandPalette(global, document) {
  "use strict";

  const handlers = new Map();
  const defaultRoutes = [
    ["overview", "总览", "ri-dashboard-line"],
    ["generation-requests", "生成请求", "ri-image-ai-line"],
    ["users-credits", "用户与积分", "ri-user-settings-line"],
    ["prompt-cms", "提示词 CMS", "ri-quill-pen-line"],
    ["announcements", "通知公告", "ri-notification-3-line"],
    ["system-settings", "系统设置", "ri-sliders-line"],
    ["rum-performance", "RUM/性能", "ri-speed-up-line"]
  ];
  let layer = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function register(route, handler) {
    const key = String(route || "").trim();
    if (!key || typeof handler !== "function") return false;
    handlers.set(key, handler);
    return true;
  }

  function routeItems() {
    const extra = [...handlers.keys()]
      .filter((route) => !defaultRoutes.some(([id]) => id === route))
      .map((route) => [route, route, "ri-command-line"]);
    return [...defaultRoutes, ...extra];
  }

  function close() {
    layer?.remove();
    layer = null;
    document.body.classList.remove("admin-command-open");
  }

  function activate(route) {
    const handler = handlers.get(route);
    if (handler) handler(route);
    else global.AdminCore?.navigate?.(route);
    close();
  }

  function render(query = "") {
    const q = query.trim().toLowerCase();
    const items = routeItems().filter(([route, label]) => !q || route.includes(q) || label.toLowerCase().includes(q));
    layer.innerHTML = `
      <div class="admin-command-card" role="dialog" aria-modal="true" aria-label="命令面板">
        <label><i class="ri-search-line" aria-hidden="true"></i><input data-command-query placeholder="跳转后台模块" value="${escapeHtml(query)}"></label>
        <div class="admin-command-list">
          ${items.map(([route, label, icon]) => `<button type="button" data-command-route="${escapeHtml(route)}"><i class="${escapeHtml(icon)}" aria-hidden="true"></i><span>${escapeHtml(label)}</span><small>${escapeHtml(route)}</small></button>`).join("") || `<p>没有匹配命令</p>`}
        </div>
      </div>`;
    layer.querySelector("[data-command-query]")?.addEventListener("input", (event) => render(event.target.value));
    layer.querySelectorAll("[data-command-route]").forEach((button) => button.addEventListener("click", () => activate(button.dataset.commandRoute)));
    layer.querySelector("[data-command-query]")?.focus?.({ preventScroll: true });
  }

  function open() {
    if (layer) return;
    layer = document.createElement("div");
    layer.className = "admin-command-layer";
    layer.addEventListener("click", (event) => {
      if (event.target === layer) close();
    });
    document.body.appendChild(layer);
    document.body.classList.add("admin-command-open");
    render();
  }

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
    } else if (event.key === "Escape" && layer) {
      close();
    }
  });

  global.AdminCommandPalette = { register, open, close };
})(window, document);
