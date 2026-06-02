(function initAdminCommandPalette(global, document) {
  "use strict";

  if (document.documentElement.dataset.app !== "admin") {
    global.AdminCommandPalette = { register() { return false; }, open() {}, close() {}, remember() {} };
    return;
  }

  const handlers = new Map(), recentKey = "admin.command.recentEntities";
  const routes = [["overview", "总览", "ri-dashboard-line"], ["providers", "API 供应商", "ri-plug-line"], ["generation-requests", "生成请求", "ri-image-ai-line"], ["square-review", "广场审核", "ri-gallery-view-2"], ["gallery-files", "文件巡检", "ri-folder-warning-line"], ["users-credits", "用户与积分", "ri-user-settings-line"], ["prompt-cms", "提示词 CMS", "ri-quill-pen-line"], ["prompt-audit", "Prompt Audit", "ri-shield-check-line"], ["tag-library", "标签库", "ri-price-tag-3-line"], ["reports-withdrawals", "举报与撤回", "ri-alarm-warning-line"], ["growth", "增长配置", "ri-line-chart-line"], ["announcements", "通知公告", "ri-notification-3-line"], ["system-settings", "系统设置", "ri-sliders-line"], ["audit-log", "审计日志", "ri-file-list-3-line"], ["rum-performance", "RUM/性能", "ri-speed-up-line"]];
  const entityMeta = { user: ["用户", "users-credits", "ri-user-line"], order: ["订单", "generation-requests", "ri-receipt-line"], prompt: ["提示词", "prompt-cms", "ri-quill-pen-line"] };
  let layer = null, query = "", activeIndex = 0, visibleItems = [];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  const isMobile = () => global.matchMedia?.("(max-width: 760px)")?.matches;
  const readList = (key) => {
    try { const value = JSON.parse(global.localStorage?.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
  };
  function register(route, handler) {
    const key = String(route || "").trim();
    if (!key || typeof handler !== "function") return false;
    handlers.set(key, handler);
    return true;
  }
  function remember(type, id, label = "") {
    const cleanType = String(type || "").trim(), cleanId = String(id || "").trim();
    if (!cleanType || !cleanId || !entityMeta[cleanType]) return false;
    const next = [{ type: cleanType, id: cleanId, label: String(label || ""), at: Date.now() }, ...readList(recentKey)]
      .filter((item, index, rows) => item?.type && item?.id && rows.findIndex((row) => row.type === item.type && row.id === item.id) === index)
      .slice(0, 8);
    try { global.localStorage?.setItem(recentKey, JSON.stringify(next)); } catch { return false; }
    return true;
  }
  function recentRows() {
    const legacy = [
      ...readList("admin.recent.users").map((item) => ({ type: "user", id: item.id || item })),
      ...readList("admin.recent.orders").map((item) => ({ type: "order", id: item.id || item })),
      ...readList("admin.recent.prompts").map((item) => ({ type: "prompt", id: item.id || item }))
    ];
    return [...readList(recentKey), ...legacy].filter((item) => entityMeta[item?.type] && item?.id).slice(0, 6);
  }
  function commandItems() {
    const routeItems = routes.map(([route, label, icon]) => ({ route, label, icon, hint: "跳转后台模块" }));
    const extra = [...handlers.keys()].filter((route) => !routes.some(([id]) => id === route)).map((route) => ({ route, label: route, icon: "ri-command-line", hint: "自定义后台命令" }));
    const recent = recentRows().map(({ type, id, label }) => {
      const [typeLabel, route, icon] = entityMeta[type];
      return { route, label: label || `${typeLabel} ${id}`, icon, hint: `最近访问 · ${type}:${id}`, detail: `${type === "order" ? "request" : type}:${id}` };
    });
    return [...routeItems, ...extra, ...recent];
  }
  function close() {
    layer?.remove();
    layer = null;
    document.body.classList.remove("admin-command-open");
  }
  function activate(item = visibleItems[activeIndex]) {
    if (!item) return;
    const handler = handlers.get(item.route);
    if (handler) handler(item.route);
    else global.AdminCore?.navigate?.(item.route);
    if (item.detail) global.setTimeout(() => global.AdminCore?.showDetail?.(item.detail), 80);
    close();
  }
  function select(index) {
    activeIndex = Math.max(0, Math.min(index, visibleItems.length - 1));
    layer?.querySelectorAll("[data-command-index]").forEach((button, itemIndex) => {
      const selected = itemIndex === activeIndex;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      if (selected) button.scrollIntoView({ block: "nearest" });
    });
  }
  function render(nextQuery = query) {
    query = nextQuery;
    const q = query.trim().toLowerCase();
    visibleItems = commandItems().filter((item) => !q || `${item.route} ${item.label} ${item.hint}`.toLowerCase().includes(q));
    activeIndex = Math.min(activeIndex, Math.max(0, visibleItems.length - 1));
    layer.innerHTML = `
      <div class="admin-command-card primitive-modal primitive-modal--wide" data-flavor="palette" role="dialog" aria-modal="true" aria-label="命令面板">
        <label class="admin-command-search"><i class="ri-search-line" aria-hidden="true"></i><input data-command-query placeholder="搜索模块、用户、订单、提示词" value="${escapeHtml(query)}"></label>
        <div class="admin-command-list" role="listbox" aria-label="后台命令">
          ${visibleItems.map((item, index) => `<button type="button" role="option" data-command-index="${index}" aria-selected="${index === activeIndex ? "true" : "false"}"><i class="${escapeHtml(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.hint || item.route)}</small></button>`).join("") || `<p>没有匹配命令</p>`}
        </div>
        <footer><kbd>↑↓</kbd><span>选择</span><kbd>Enter</kbd><span>执行</span><kbd>/</kbd><span>搜索</span><kbd>Esc</kbd><span>关闭</span></footer>
      </div>`;
    layer.querySelector("[data-command-query]")?.addEventListener("input", (event) => { activeIndex = 0; render(event.target.value); });
    layer.querySelectorAll("[data-command-index]").forEach((button) => button.addEventListener("click", () => activate(visibleItems[Number(button.dataset.commandIndex || 0)])));
    layer.querySelector("[data-command-query]")?.focus?.({ preventScroll: true });
    select(activeIndex);
  }
  function open() {
    if (layer) return render(query);
    layer = document.createElement("div");
    query = "";
    activeIndex = 0;
    layer.className = "admin-command-layer primitive-modal-layer";
    layer.addEventListener("click", (event) => { if (event.target === layer) close(); });
    document.body.appendChild(layer);
    document.body.classList.add("admin-command-open");
    render();
  }
  document.getElementById("adminCommandPaletteBtn")?.addEventListener("click", open);
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (!layer && !isMobile() && (event.ctrlKey || event.metaKey) && key === "k") { event.preventDefault(); open(); }
    else if (!layer) return;
    else if (key === "escape") { event.preventDefault(); close(); }
    else if (key === "arrowdown" || key === "arrowup") { event.preventDefault(); select(activeIndex + (key === "arrowdown" ? 1 : -1)); }
    else if (key === "enter") { event.preventDefault(); activate(); }
    else if (key === "/" && event.target !== layer.querySelector("[data-command-query]")) { event.preventDefault(); layer.querySelector("[data-command-query]")?.focus?.({ preventScroll: true }); }
  });
  global.AdminCommandPalette = { register, open, close, remember };
})(window, document);
