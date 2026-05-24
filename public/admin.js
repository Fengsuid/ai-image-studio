const adminState = {
  user: null,
  version: null,
  settings: null,
  users: [],
  generations: [],
  prompts: [],
  promptSources: [],
  promptSyncRuns: [],
  tags: [],
  promptCategories: [],
  publicImages: [],
  reports: [],
  promptDuplicates: [],
  promptAudits: [],
  providers: [],
  galleryLeaderboard: [],
  galleryLikeAnomalies: [],
  galleryFileChecks: [],
  defaultProviderId: "",
  announcements: [],
  rum: { summary: {}, events: [] },
  withdrawals: [],
  creditLedger: [],
  rewardLedger: [],
  active: location.hash.replace("#", "") || "overview",
  search: "",
  status: "all",
  page: 1,
  pageSize: 12,
  generationDiagnostics: {
    filters: {}
  },
  selectedUsers: new Set(),
  audit: [],
  csrfToken: "",
  sidebarCollapsed: localStorage.getItem("adminSidebarCollapsed") === "1"
};

const navItems = [
  ["overview", "ri-dashboard-line", "总览"],
  ["providers", "ri-plug-line", "API 供应商"],
  ["generation-requests", "ri-image-ai-line", "生成请求"],
  ["square-review", "ri-gallery-view-2", "广场审核"],
  ["gallery-files", "ri-folder-warning-line", "文件巡检"],
  ["users-credits", "ri-user-settings-line", "用户与积分"],
  ["prompt-cms", "ri-quill-pen-line", "提示词 CMS"],
  ["prompt-audit", "ri-shield-check-line", "Prompt Audit"],
  ["tag-library", "ri-price-tag-3-line", "标签库"],
  ["reports-withdrawals", "ri-alarm-warning-line", "举报与撤回"],
  ["growth", "ri-line-chart-line", "增长配置"],
  ["announcements", "ri-notification-3-line", "通知公告"],
  ["system-settings", "ri-sliders-line", "系统设置"],
  ["rum-performance", "ri-speed-up-line", "RUM/性能"],
  ["audit-log", "ri-file-list-3-line", "审计日志"]
];

const pageDescriptions = {
  overview: "系统健康、关键指标和最近异常。",
  providers: "多 API 地址、模型能力、健康检查和路由策略入口。",
  "generation-requests": "生成任务状态、耗时、错误和请求详情。",
  "square-review": "公开作品、举报下架和恢复到画廊。",
  "gallery-files": "公开画廊文件缺失、文件大小和最近巡检结果。",
  "users-credits": "用户状态、角色、积分和首发奖励流水。",
  "prompt-cms": "提示词内容、重复候选、互动数据和人工处理。",
  "prompt-audit": "AI 提示词重复审计、人工复核和发布门禁入口。",
  "tag-library": "标签目录、中文展示、合并迁移和筛选展示。",
  "reports-withdrawals": "举报、撤回申请、处理原因和审核日志。",
  growth: "推荐位、榜单、活动和运营增长配置。",
  announcements: "站内通知、登录弹窗、未读确认和公告预览。",
  "system-settings": "注册、积分、安全和非 API Provider 类系统设置。",
  "rum-performance": "Web Vitals、图片失败率、运行时和性能事件。",
  "audit-log": "后台敏感操作、人工巡检和审计记录。"
};

const $ = (selector, root = document) => root.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function imageVariantUrl(url, variant = "thumb") {
  if (!url || /^(data:|blob:)/i.test(url)) return url || "";
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}variant=${encodeURIComponent(variant)}`;
}

async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = adminState.csrfToken || readCookie("csrf");
  }
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (data?.csrfToken) adminState.csrfToken = data.csrfToken;
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function readCookie(name) {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split("="))
    .find(([key]) => decodeURIComponent(key) === name);
  return match ? decodeURIComponent(match.slice(1).join("=")) : "";
}

function fmtNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value || 0));
}

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function datetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtDuration(ms) {
  const value = Number(ms || 0);
  if (!value) return "-";
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}s`;
}

function todayItems(items, field = "createdAt") {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return items.filter((item) => new Date(item[field] || 0) >= start);
}

function recordAudit(action, target, detail = "") {
  adminState.audit.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action,
    target,
    detail,
    actor: adminState.user?.email || "admin",
    createdAt: new Date().toISOString()
  });
  adminState.audit = adminState.audit.slice(0, 80);
}

function generationDiagnosticsModule() {
  return window.AdminModules?.generationDiagnostics || null;
}

function generationDiagnosticsQuery() {
  const filters = adminState.generationDiagnostics?.filters || {};
  const params = new URLSearchParams({ limit: "500" });
  for (const [key, value] of Object.entries(filters)) {
    const text = String(value || "").trim();
    if (text) params.set(key, text);
  }
  return `/api/admin/generations?${params.toString()}`;
}

function generationDiagnosticsHelpers() {
  return {
    fmtNumber,
    fmtDate,
    fmtDuration,
    imageVariantUrl,
    paged,
    pagination
  };
}

function adminModuleContext() {
  return {
    state: adminState,
    helpers: {
      escapeHtml,
      fmtNumber,
      fmtDate,
      fmtDuration,
      imageVariantUrl,
      metrics,
      dashboardContext,
      requestTable,
      toolbar,
      filtered,
      paged,
      pagination,
      emptyState,
      renderPlaceholder
    }
  };
}

function renderAdminModule(name) {
  return window.AdminModules?.[name]?.render?.(adminModuleContext()) || "";
}

function currentNav() {
  return navItems.find(([id]) => id === adminState.active) || navItems[0];
}

function renderNav() {
  document.body.classList.toggle("admin-sidebar-collapsed", adminState.sidebarCollapsed);
  $("#adminNav").innerHTML = navItems.map(([id, icon, label]) => `
    <button class="${id === adminState.active ? "active" : ""}" type="button" data-section="${id}">
      <i class="${icon}"></i><span>${label}</span>
    </button>
  `).join("");
  $("#adminNav").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.active = button.dataset.section;
      adminState.page = 1;
      location.hash = adminState.active;
      render();
    });
  });
}

function setStatus(message, tone = "neutral") {
  const status = $("#adminStatus");
  status.textContent = message;
  status.dataset.tone = tone;
}

function confirmAction({ title = "确认操作", message = "该操作会立即生效。", confirmText = "确认", danger = false } = {}) {
  const layer = $("#adminConfirmLayer");
  if (!layer) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    layer.classList.remove("hidden");
    layer.setAttribute("aria-hidden", "false");
    layer.innerHTML = `
      <div class="admin-confirm-card" role="dialog" aria-modal="true" aria-labelledby="adminConfirmTitle">
        <div class="admin-confirm-icon" data-danger="${danger ? "true" : "false"}"><i class="${danger ? "ri-error-warning-line" : "ri-question-line"}" aria-hidden="true"></i></div>
        <h2 id="adminConfirmTitle">${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="admin-confirm-actions">
          <button type="button" data-confirm-cancel>取消</button>
          <button type="button" data-confirm-ok class="${danger ? "danger" : ""}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    const cleanup = (value) => {
      layer.classList.add("hidden");
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = "";
      window.removeEventListener("keydown", onConfirmKeydown);
      resolve(value);
    };
    const onConfirmKeydown = (event) => {
      if (event.key === "Escape") cleanup(false);
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) cleanup(true);
    };
    $("[data-confirm-cancel]", layer).addEventListener("click", () => cleanup(false));
    $("[data-confirm-ok]", layer).addEventListener("click", () => cleanup(true));
    window.addEventListener("keydown", onConfirmKeydown);
    layer.addEventListener("click", function onBackdrop(event) {
      if (event.target === layer) {
        layer.removeEventListener("click", onBackdrop);
        cleanup(false);
      }
    });
    $("[data-confirm-cancel]", layer)?.focus?.({ preventScroll: true });
  });
}

async function loadAll() {
  setStatus("同步中");
  const me = await api("/api/auth/me");
  adminState.user = me.user;
  if (!adminState.user || adminState.user.role !== "admin") {
    setStatus("需要管理员", "danger");
    $("#adminContent").innerHTML = `
      <section class="admin-auth-required">
        <i class="ri-shield-user-line"></i>
        <h2>需要管理员权限</h2>
        <p>请在前台登录管理员账号后再进入 /admin。</p>
        <a href="/" class="admin-primary-link">返回前台登录</a>
      </section>
    `;
    return;
  }
  const [version, settings, users, generations, prompts, promptSources, tags, promptCategories, publicImages, galleryFileChecks, creditLedger, rewardLedger, auditLogs, withdrawals, reports, promptDuplicates, promptAudits, rum, providers, galleryLeaderboard, galleryLikeAnomalies, announcements] = await Promise.all([
    api("/api/version"),
    api("/api/admin/settings"),
    api("/api/admin/users"),
    api(generationDiagnosticsQuery()),
    api("/api/prompts?includeHidden=1&limit=2000"),
    api("/api/admin/prompt-sources?runsLimit=120"),
    api("/api/tags?includeHidden=1&limit=2000"),
    api("/api/prompt-categories?includeHidden=1"),
    api("/api/admin/public-images?status=queue&limit=120"),
    api("/api/admin/gallery-file-checks?status=broken&limit=120"),
    api("/api/admin/credit-ledger?limit=120"),
    api("/api/admin/reward-ledger?limit=120"),
    api("/api/admin/audit-logs?limit=120"),
    api("/api/admin/withdrawals?limit=120"),
    api("/api/admin/reports?status=queue&limit=120"),
    api("/api/admin/prompt-duplicates?limit=120"),
    api("/api/admin/prompt-audits?limit=160"),
    api("/api/admin/rum"),
    api("/api/admin/providers"),
    api("/api/gallery/leaderboard?range=week&limit=20"),
    api("/api/admin/gallery-like-anomalies?limit=80"),
    api("/api/admin/announcements?limit=200")
  ]);
  adminState.version = version;
  adminState.settings = settings;
  adminState.users = users.users || [];
  adminState.generations = generations.records || [];
  adminState.prompts = prompts.prompts || [];
  adminState.promptSources = promptSources.sources || [];
  adminState.promptSyncRuns = promptSources.runs || [];
  adminState.tags = tags.tags || [];
  adminState.promptCategories = promptCategories.categories || tags.categories || [];
  adminState.tagSummary = tags.summary || null;
  adminState.publicImages = publicImages.generations || [];
  adminState.galleryFileChecks = galleryFileChecks.checks || [];
  adminState.creditLedger = creditLedger.ledger || [];
  adminState.rewardLedger = rewardLedger.rewards || [];
  adminState.audit = auditLogs.logs || adminState.audit;
  adminState.withdrawals = withdrawals.requests || [];
  adminState.reports = reports.reports || [];
  adminState.promptDuplicates = promptDuplicates.candidates || [];
  adminState.promptAudits = promptAudits.audits || [];
  adminState.rum = rum || { summary: {}, events: [] };
  adminState.providers = providers.providers || [];
  adminState.galleryLeaderboard = galleryLeaderboard.generations || [];
  adminState.galleryLikeAnomalies = galleryLikeAnomalies.anomalies || [];
  adminState.announcements = announcements.announcements || [];
  adminState.defaultProviderId = providers.defaultProviderId || settings.defaultProviderId || "";
  setStatus(`${adminState.user.name || adminState.user.email} · ${version.version}`, "ok");
}

function metrics() {
  const todayRequests = todayItems(adminState.generations);
  const total = adminState.generations.length;
  const success = adminState.generations.filter((item) => item.status === "success" || item.status === "succeeded").length;
  const failed = adminState.generations.filter((item) => item.status === "failed").length;
  const durationItems = adminState.generations.filter((item) => Number(item.durationMs) > 0);
  const avgDuration = durationItems.reduce((sum, item) => sum + Number(item.durationMs), 0) / Math.max(1, durationItems.length);
  return {
    todayGenerated: todayRequests.length,
    successRate: total ? Math.round((success / total) * 100) : 0,
    failedRate: total ? Math.round((failed / total) * 100) : 0,
    avgDuration,
    newUsers: todayItems(adminState.users).length,
    publicWorks: adminState.publicImages.length,
    pendingReview: adminState.publicImages.filter((item) => item.isPublic).length,
    total
  };
}

function dashboardContext() {
  const brokenFiles = adminState.galleryFileChecks.filter((item) => item.status === "broken");
  const syncFailures = (adminState.promptSyncRuns || []).filter((run) => {
    const status = String(run.status || "").toLowerCase();
    return ["failed", "error", "warning"].includes(status);
  });
  const providerIssues = (adminState.providers || []).filter((provider) => String(provider.healthStatus || "").toLowerCase() === "error");
  const reportQueue = adminState.reports.length;
  const withdrawalQueue = adminState.withdrawals.filter((item) => String(item.withdrawalStatus || "") === "requested").length;
  const rumSummary = adminState.rum?.summary || {};
  const issues = [];
  const pushIssue = (issue) => issues.push(issue);
  const latestReport = [...adminState.reports].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0];
  const latestBrokenFile = [...brokenFiles].sort((left, right) => new Date(right.checkedAt || 0) - new Date(left.checkedAt || 0))[0];
  const latestSyncFailure = [...syncFailures].sort((left, right) => new Date(right.startedAt || 0) - new Date(left.startedAt || 0))[0];

  if (latestBrokenFile) {
    pushIssue({
      tone: "danger",
      icon: "ri-folder-warning-line",
      title: "文件异常",
      detail: `${latestBrokenFile.generationId || "-"} · ${latestBrokenFile.filename || latestBrokenFile.relativePath || "未知文件"}`,
      meta: latestBrokenFile.errorMessage || latestBrokenFile.status || "broken",
      time: latestBrokenFile.checkedAt,
      jump: "gallery-files"
    });
  }
  if (latestSyncFailure) {
    pushIssue({
      tone: "warn",
      icon: "ri-sync-warning-line",
      title: "提示词同步失败",
      detail: `${latestSyncFailure.sourceName || latestSyncFailure.sourceId || "-"} · ${latestSyncFailure.errorLog || latestSyncFailure.message || latestSyncFailure.status || "failed"}`,
      meta: `${fmtNumber(latestSyncFailure.successCount || 0)} 成功 / ${fmtNumber(latestSyncFailure.failureCount || 0)} 失败`,
      time: latestSyncFailure.startedAt,
      jump: "prompt-cms"
    });
  }
  providerIssues.slice(0, 2).forEach((provider) => {
    pushIssue({
      tone: "danger",
      icon: "ri-plug-line",
      title: "供应商健康异常",
      detail: `${provider.name || provider.id || "-"} · ${provider.lastError || provider.healthStatus || "error"}`,
      meta: provider.baseUrl || provider.providerType || "",
      time: provider.updatedAt || provider.createdAt,
      jump: "providers"
    });
  });
  if (reportQueue > 0) {
    pushIssue({
      tone: "warn",
      icon: "ri-alarm-warning-line",
      title: "举报待处理",
      detail: `${fmtNumber(reportQueue)} 条公开作品举报正在队列中`,
      meta: latestReport ? `${latestReport.id || "-"} · ${latestReport.userName || latestReport.userEmail || "匿名"}` : "等待人工审核",
      time: latestReport?.createdAt || null,
      jump: "square-review"
    });
  }
  if (withdrawalQueue > 0) {
    pushIssue({
      tone: "warn",
      icon: "ri-inbox-unarchive-line",
      title: "撤回申请待处理",
      detail: `${fmtNumber(withdrawalQueue)} 条公开撤回申请未处理`,
      meta: "需要在举报与撤回页处理",
      time: adminState.withdrawals.find((item) => String(item.withdrawalStatus || "") === "requested")?.withdrawalRequestedAt || null,
      jump: "reports-withdrawals"
    });
  }
  if (Number(rumSummary.imageFailures || 0) > 0) {
    pushIssue({
      tone: "warn",
      icon: "ri-image-warning-line",
      title: "图片失败事件",
      detail: `${fmtNumber(rumSummary.imageFailures)} 次图片加载或生成失败`,
      meta: `RUM 事件 ${fmtNumber(rumSummary.total || 0)}`,
      time: rumSummary.updatedAt || null,
      jump: "rum-performance"
    });
  }

  const criticalCount = brokenFiles.length + syncFailures.length + providerIssues.length;
  const cautionCount = reportQueue + withdrawalQueue + Number(rumSummary.imageFailures || 0);
  const tone = criticalCount > 0 ? "danger" : cautionCount > 0 ? "warn" : "ok";
  const label = criticalCount > 0 ? "需要关注" : cautionCount > 0 ? "有待处理项" : "运行正常";
  const detail = criticalCount > 0
    ? `${fmtNumber(brokenFiles.length)} 个文件异常 · ${fmtNumber(syncFailures.length)} 个同步失败 · ${fmtNumber(providerIssues.length)} 个供应商异常`
    : cautionCount > 0
      ? `${fmtNumber(reportQueue)} 条举报 · ${fmtNumber(withdrawalQueue)} 条撤回 · ${fmtNumber(rumSummary.imageFailures || 0)} 次图片失败`
      : "当前没有明显阻断项";

  return {
    tone,
    label,
    detail,
    reportQueue,
    brokenFiles,
    syncFailures,
    providerIssues,
    withdrawalQueue,
    rumSummary,
    issues: issues.slice(0, 6)
  };
}

function statCard(label, value, hint, icon, tone = "blue") {
  return `
    <article class="admin-stat" data-tone="${tone}">
      <i class="${icon}"></i>
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `;
}

function toolbar(placeholder, statuses = []) {
  return `
    <div class="admin-toolbar admin-toolbar-polished" role="search">
      <div class="admin-toolbar-meta">
        <strong>快速筛选</strong>
        <span>实时过滤当前模块的数据，不会改变服务端记录。</span>
      </div>
      <label><i class="ri-search-line" aria-hidden="true"></i><input id="adminSearchInput" value="${escapeHtml(adminState.search)}" placeholder="${placeholder}"></label>
      <select id="adminStatusFilter">
        <option value="all"${adminState.status === "all" ? " selected" : ""}>全部状态</option>
        ${statuses.map((status) => `<option value="${status}"${adminState.status === status ? " selected" : ""}>${status}</option>`).join("")}
      </select>
    </div>
  `;
}

function bindToolbar() {
  $("#adminSearchInput")?.addEventListener("input", (event) => {
    adminState.search = event.target.value;
    adminState.page = 1;
    render();
  });
  $("#adminStatusFilter")?.addEventListener("change", (event) => {
    adminState.status = event.target.value;
    adminState.page = 1;
    render();
  });
}

function filtered(items, fields) {
  const q = adminState.search.trim().toLowerCase();
  return items.filter((item) => {
    const statusOk = adminState.status === "all" ||
      item.status === adminState.status ||
      item.moderationStatus === adminState.status ||
      item.withdrawalStatus === adminState.status ||
      String(item.role || "") === adminState.status;
    if (!statusOk) return false;
    if (!q) return true;
    return fields.some((field) => String(item[field] || "").toLowerCase().includes(q));
  });
}

function paged(items) {
  const start = (adminState.page - 1) * adminState.pageSize;
  return items.slice(start, start + adminState.pageSize);
}

function pagination(total) {
  const pages = Math.max(1, Math.ceil(total / adminState.pageSize));
  return `
    <div class="admin-pagination">
      <button type="button" data-page="${Math.max(1, adminState.page - 1)}"${adminState.page === 1 ? " disabled" : ""}>上一页</button>
      <span>${adminState.page} / ${pages}</span>
      <button type="button" data-page="${Math.min(pages, adminState.page + 1)}"${adminState.page >= pages ? " disabled" : ""}>下一页</button>
    </div>
  `;
}

function emptyState(title, detail, icon = "ri-inbox-archive-line", tone = "neutral") {
  return `
    <div class="admin-empty-state admin-empty-state-polished" data-tone="${escapeHtml(tone)}">
      <i class="${escapeHtml(icon)}" aria-hidden="true"></i>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function bindPagination() {
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.page = Number(button.dataset.page || 1);
      render();
    });
  });
}

function requestTable(items) {
  if (!items.length) return emptyState("暂无生成请求", "当前筛选条件下没有生成任务，可调整状态或关键词后重试。", "ri-image-ai-line");
  return `
    <div class="admin-table-wrap">
      <table class="admin-table admin-table-polished">
        <thead><tr><th>状态</th><th>用户</th><th>提示词</th><th>耗时</th><th>时间</th><th></th></tr></thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td><span class="admin-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
              <td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</td>
              <td class="admin-truncate">${escapeHtml(item.prompt || item.errorMessage || "-")}</td>
              <td>${fmtDuration(item.durationMs)}</td>
              <td>${fmtDate(item.createdAt)}</td>
              <td><button type="button" data-detail="request:${escapeHtml(item.id)}">详情</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRequests() {
  const module = generationDiagnosticsModule();
  if (module?.render) {
    return module.render({ state: adminState, helpers: generationDiagnosticsHelpers() });
  }
  const items = filtered(adminState.generations, ["prompt", "userName", "userEmail", "status"]);
  return `${toolbar("搜索用户、提示词或错误", ["pending", "running", "success", "failed", "cancelled"])}
    <section class="admin-panel">${requestTable(paged(items))}${pagination(items.length)}</section>`;
}

function renderPrompts() {
  const items = filtered(adminState.prompts, ["title", "prompt", "author", "status", "category", "sourceRepo", "sourceCategory"]);
  return `${toolbar("搜索标题、提示词、作者", ["active", "hidden"])}
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>远程来源</h2><button type="button" data-create-prompt-source>新建来源</button></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>来源</th><th>仓库</th><th>状态</th><th>最近同步</th><th>结果</th><th></th></tr></thead>
          <tbody>
            ${(adminState.promptSources || []).map((source) => `
              <tr>
                <td><strong>${escapeHtml(source.name || source.id)}</strong><small>${escapeHtml(source.sourceType || "")} · ${escapeHtml(source.parser || "parser 待配置")}</small></td>
                <td>${escapeHtml(source.repoUrl || "-")}<small>${escapeHtml(source.branch || "main")}</small></td>
                <td><span class="admin-badge" data-status="${escapeHtml(source.status)}">${escapeHtml(source.status)}</span></td>
                <td>${fmtDate(source.lastSyncedAt)}<small>${escapeHtml(source.lastStatus || "never")}</small></td>
                <td>${fmtNumber(source.lastSuccessCount)} 成功 / ${fmtNumber(source.lastFailureCount)} 失败<small>${escapeHtml(source.lastError || "")}</small></td>
                <td><button type="button" data-detail="promptSource:${escapeHtml(source.id)}">编辑</button><button type="button" data-prompt-source-sync="${escapeHtml(source.id)}">同步</button></td>
              </tr>
            `).join("") || `<tr><td colspan="6">暂无远程来源</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="admin-mini-table">
        ${(adminState.promptSyncRuns || []).slice(0, 6).map((run) => `
          <div><strong>${escapeHtml(run.sourceName || run.sourceId)}</strong><span>${escapeHtml(run.status)} · 成功 ${fmtNumber(run.successCount)} / 失败 ${fmtNumber(run.failureCount)} / 跳过 ${fmtNumber(run.skippedCount)}</span><small>${fmtDate(run.startedAt)} · ${escapeHtml(run.errorLog || "")}</small></div>
        `).join("") || "<p>暂无同步记录</p>"}
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head">
        <h2>重复候选</h2>
        <button type="button" data-scan-prompt-duplicates>扫描候选</button>
        <span>${fmtNumber(adminState.promptDuplicates.length)} 组需人工确认</span>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>提示词 A</th><th>提示词 B</th><th>召回</th><th>处理</th></tr></thead>
          <tbody>
            ${adminState.promptDuplicates.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.prompt?.title || `#${item.promptId}`)}</strong><small class="admin-truncate">${escapeHtml(item.prompt?.prompt || "")}</small></td>
                <td><strong>${escapeHtml(item.duplicate?.title || `#${item.duplicatePromptId}`)}</strong><small class="admin-truncate">${escapeHtml(item.duplicate?.prompt || "")}</small></td>
                <td>${escapeHtml(item.method || "")}<small>score ${Number(item.score || 0).toFixed(4)} · ${escapeHtml(item.embeddingRecall || "")} · AI ${escapeHtml(item.aiReview?.decision || item.llmReview || "not_reviewed")} ${Number(item.aiReview?.confidence || 0).toFixed(2)}</small><small>${escapeHtml(item.aiReview?.reason || "")}</small></td>
                <td>
                  <button type="button" data-detail="prompt:${item.promptId}">编辑 A</button>
                  <button type="button" data-detail="prompt:${item.duplicatePromptId}">编辑 B</button>
                  <button type="button" data-duplicate-ai-review="${item.id}">AI 复核</button>
                  <button type="button" data-duplicate-action="keep:${item.id}">保留</button>
                  <button type="button" data-duplicate-action="confirm:${item.id}">确认重复</button>
                  <button type="button" data-duplicate-action="hide_duplicate:${item.id}">隐藏 B</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="4">暂无重复候选</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>提示词 CMS</h2><button type="button" data-create-prompt>新建提示词</button></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>标题</th><th>分类/标签</th><th>来源</th><th>状态</th><th>互动</th><th>排序</th><th></th></tr></thead>
          <tbody>
            ${paged(items).map((prompt) => `
              <tr>
                <td><strong>${escapeHtml(prompt.title || `#${prompt.id}`)}</strong><small class="admin-truncate">${escapeHtml(prompt.prompt || "")}</small></td>
                <td><strong>${escapeHtml(prompt.category || "general")}</strong><small>${escapeHtml((prompt.tags || []).join(", "))}</small></td>
                <td>${escapeHtml(prompt.sourceRepo || prompt.source || "-")}<small>${escapeHtml(prompt.remoteId || prompt.sourceCategory || prompt.author || "")}</small></td>
                <td><span class="admin-badge" data-status="${escapeHtml(prompt.status)}">${escapeHtml(prompt.status)}</span></td>
                <td>Like ${fmtNumber(prompt.likeCount)} / Use ${fmtNumber(prompt.useCount)} / Heat ${fmtNumber(prompt.heatScore)}</td>
                <td>${fmtNumber(prompt.sortOrder)}</td>
                <td><button type="button" data-detail="prompt:${prompt.id}">编辑</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>${pagination(items.length)}
    </section>`;
}

function renderTags() {
  const items = filtered(adminState.tags, ["slug", "labelZh", "labelEn", "category", "status"]);
  const categories = [...(adminState.promptCategories || [])]
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || String(left.slug).localeCompare(String(right.slug)));
  return `${toolbar("搜索 slug、中文名、分类", ["active", "hidden"])}
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>提示词分类</h2><button type="button" data-create-category>新建分类</button></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Slug</th><th>中文/英文</th><th>说明</th><th>状态</th><th>排序</th><th></th></tr></thead>
          <tbody>
            ${categories.map((category) => `
              <tr>
                <td><strong>${escapeHtml(category.slug)}</strong></td>
                <td>${escapeHtml(category.labelZh || "")}<small>${escapeHtml(category.labelEn || "")}</small></td>
                <td><small>${escapeHtml(category.descriptionZh || category.descriptionEn || "-")}</small></td>
                <td><span class="admin-badge" data-status="${escapeHtml(category.status)}">${escapeHtml(category.status)}</span></td>
                <td>${fmtNumber(category.sortOrder || 0)}</td>
                <td><button type="button" data-detail="category:${escapeHtml(category.slug)}">编辑</button></td>
              </tr>
            `).join("") || `<tr><td colspan="6">暂无分类</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>标签库</h2><button type="button" data-create-tag>新建标签</button></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Slug</th><th>中文/英文</th><th>分类</th><th>状态</th><th>覆盖</th><th></th></tr></thead>
          <tbody>
            ${paged(items).map((tag) => `
              <tr>
                <td><strong>${escapeHtml(tag.slug)}</strong><small>${escapeHtml(tag.source || "")}</small></td>
                <td>${escapeHtml(tag.labelZh || "")}<small>${escapeHtml(tag.labelEn || "")}</small></td>
                <td>${escapeHtml(tag.category || "-")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(tag.status)}">${escapeHtml(tag.status)}</span></td>
                <td>${fmtNumber(Number(tag.promptCount || 0) + Number(tag.galleryCount || 0))}</td>
                <td><button type="button" data-detail="tag:${escapeHtml(tag.slug)}">编辑</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>${pagination(items.length)}
    </section>`;
}

function renderSettings() {
  return renderAdminModule("settings");
}

function renderPlaceholder(title, icon, items) {
  return `
    <section class="admin-panel admin-placeholder">
      <i class="${icon}"></i>
      <h2>${title}</h2>
      <p>该模块已进入独立后台信息架构，当前版本先保留稳定入口和上下文。后续任务会接入完整数据表、审核流和审计落库。</p>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>`;
}

function renderGrowthPlaceholder() {
  const growth = adminState.settings?.growthConfig || adminState.settings?.growth || {};
  const leaderboard = adminState.galleryLeaderboard || [];
  const anomalies = adminState.galleryLikeAnomalies || [];
  return `
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>增长配置</h2><span>Growth JSON 只读摘要</span></div>
      <pre class="admin-code-block">${escapeHtml(JSON.stringify(growth, null, 2))}</pre>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>画廊点赞排行榜</h2><span>${fmtNumber(leaderboard.length)} 条热门作品</span></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>作品</th><th>作者</th><th>点赞</th><th>标签</th><th>时间</th><th></th></tr></thead>
          <tbody>
            ${leaderboard.map((item, index) => `
              <tr>
                <td><strong>#${index + 1} ${escapeHtml(item.id)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || "")}</small></td>
                <td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</td>
                <td><strong>${fmtNumber(item.likeCount || 0)}</strong><small>${item.likedByCurrentUser ? "liked by admin" : ""}</small></td>
                <td class="admin-truncate">${escapeHtml((item.publicTags || []).join(", "))}</td>
                <td>${fmtDate(item.createdAt)}</td>
                <td><button type="button" data-detail="work:${escapeHtml(item.id)}">详情</button></td>
              </tr>
            `).join("") || `<tr><td colspan="6">暂无点赞榜数据</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>异常点赞检查</h2><span>${fmtNumber(anomalies.length)} 个 24h 高频账号</span></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>用户</th><th>24h 点赞</th><th>首次</th><th>最近</th></tr></thead>
          <tbody>
            ${anomalies.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</strong><small>${escapeHtml(item.userId || "")}</small></td>
                <td>${fmtNumber(item.likeCount || 0)}</td>
                <td>${fmtDate(item.firstLikeAt)}</td>
                <td>${fmtDate(item.lastLikeAt)}</td>
              </tr>
            `).join("") || `<tr><td colspan="4">暂无异常点赞记录</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    ${renderPlaceholder("运营增长工作台预留", "ri-line-chart-line", [
      "推荐位、榜单、活动和奖励配置保持独立入口。",
      "图片点赞排行榜、异常点赞检查已接入，后续继续扩展运营位管理。",
      "增长配置不再混在 Settings 长表单里。"
    ])}`;
}

function renderAnnouncements() {
  const items = filtered(adminState.announcements, ["title", "body", "level", "displayMode", "audience", "status"]);
  return `
    ${toolbar("搜索标题、正文、等级或状态", ["draft", "published", "archived"])}
    <section class="admin-panel">
      <div class="admin-panel-head">
        <h2>通知公告</h2>
        <button type="button" data-create-announcement><i class="ri-add-line"></i> 新建通知</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>标题</th><th>等级</th><th>展示</th><th>目标</th><th>状态</th><th>统计</th><th>时间</th><th></th></tr></thead>
          <tbody>
            ${paged(items).map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.title)}</strong><small class="admin-truncate">${escapeHtml(item.body)}</small></td>
                <td>${escapeHtml(item.level || item.severity || "info")}${item.isImportant ? "<small>重要</small>" : ""}</td>
                <td>${escapeHtml(item.displayMode || item.displayType || "feed")}</td>
                <td>${escapeHtml(item.audience || item.targetAudience || "all")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${item.requiresAck ? "<small>需确认</small>" : ""}</td>
                <td>读 ${fmtNumber(item.readCount || 0)} / 确认 ${fmtNumber(item.ackCount || 0)}</td>
                <td><small>${fmtDate(item.publishedAt || item.createdAt)}</small></td>
                <td>
                  <button type="button" data-detail="announcement:${escapeHtml(item.id)}">编辑</button>
                  ${item.status === "published" ? `<button type="button" data-announcement-action="withdraw:${escapeHtml(item.id)}">撤回</button>` : `<button type="button" data-announcement-action="publish:${escapeHtml(item.id)}">发布</button>`}
                  <button type="button" data-announcement-action="archive:${escapeHtml(item.id)}">归档</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="8">暂无通知公告</td></tr>`}
          </tbody>
        </table>
      </div>${pagination(items.length)}
    </section>`;
}

function renderPromptAudit() {
  const items = filtered(adminState.promptAudits, ["prompt", "userName", "userEmail", "status", "resultLevel", "resultAction", "matchedPromptTitle"]);
  return `
    ${toolbar("搜索提示词、用户、状态或匹配项", ["blocked", "review", "allowed", "override_allowed", "reviewed"])}
    <section class="admin-panel">
      <div class="admin-panel-head">
        <h2>Prompt Audit</h2>
        <span>${fmtNumber(items.length)} 条审计记录</span>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>提示词</th><th>重复等级</th><th>建议动作</th><th>匹配项</th><th>人工复核</th><th>时间</th></tr></thead>
          <tbody>
            ${paged(items).map((item) => `
              <tr>
                <td>
                  <strong>${escapeHtml(item.userName || item.userEmail || item.generationId || `#${item.id}`)}</strong>
                  <small class="admin-truncate">${escapeHtml(item.prompt || "")}</small>
                </td>
                <td><span class="admin-badge" data-status="${escapeHtml(item.resultLevel)}">${escapeHtml(item.resultLevel)}</span><small>${escapeHtml(item.method || "none")} · score ${Number(item.score || 0).toFixed(4)}</small></td>
                <td><strong>${escapeHtml(item.resultAction || "allow")}</strong><small>${escapeHtml(item.requiredMode ? `required: ${item.requiredMode}` : item.requestedMode || "")}</small></td>
                <td>
                  <strong>${escapeHtml(item.matchedPromptTitle || item.matchedGenerationId || "-")}</strong>
                  <small class="admin-truncate">${escapeHtml(item.matchedPromptText || item.matchedGenerationPrompt || "")}</small>
                </td>
                <td>
                  <span class="admin-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
                  <small>${escapeHtml(item.overrideAction || item.overrideNote || "")}</small>
                  <div class="admin-card-actions">
                    <button type="button" data-detail="promptAudit:${escapeHtml(item.id)}">详情</button>
                    <button type="button" data-prompt-audit-action="allow_text_to_image:${escapeHtml(item.id)}">允许文生图</button>
                    <button type="button" data-prompt-audit-action="require_image_to_image:${escapeHtml(item.id)}">要求图生图</button>
                    <button type="button" data-prompt-audit-action="mark_reviewed:${escapeHtml(item.id)}">标记已复核</button>
                  </div>
                </td>
                <td>${fmtDate(item.createdAt)}</td>
              </tr>
            `).join("") || `<tr><td colspan="6">暂无 Prompt Audit 记录</td></tr>`}
          </tbody>
        </table>
      </div>
      ${pagination(items.length)}
    </section>`;
}

function renderRum() {
  const m = metrics();
  const rum = adminState.rum?.summary || {};
  return `
    <section class="admin-stats-grid compact">
      ${statCard("平均生成耗时", fmtDuration(m.avgDuration), "generation_requests.durationMs", "ri-timer-flash-line")}
      ${statCard("LCP", rum.lcp ? `${fmtNumber(rum.lcp)} ms` : "-", "web-vitals", "ri-speed-up-line")}
      ${statCard("INP", rum.inp ? `${fmtNumber(rum.inp)} ms` : "-", "web-vitals", "ri-cursor-line")}
      ${statCard("CLS", rum.cls ?? "-", "web-vitals", "ri-layout-masonry-line")}
      ${statCard("图片失败", fmtNumber(rum.imageFailures || 0), "RUM image_error", "ri-image-close-line")}
      ${statCard("后端运行", fmtDuration((adminState.version?.uptimeSeconds || 0) * 1000), "process uptime", "ri-server-line")}
      ${statCard("Node", escapeHtml(adminState.version?.node || "-"), escapeHtml(adminState.version?.platform || ""), "ri-code-box-line")}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>RUM 事件</h2><span>${fmtNumber(rum.total || 0)} 条近期事件</span></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>指标</th><th>值</th><th>路径</th><th>时间</th></tr></thead>
          <tbody>${(adminState.rum?.events || []).map((item) => `
            <tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.path || "-")}</td><td>${fmtDate(item.createdAt)}</td></tr>
          `).join("") || `<tr><td colspan="4">暂无 RUM 事件</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;
}

function renderWithdrawals() {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>举报队列</h2><span>${fmtNumber(adminState.reports.length)} 条记录</span></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>作品</th><th>用户</th><th>状态</th><th>举报</th><th>原因</th><th></th></tr></thead>
          <tbody>
            ${adminState.reports.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.id)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || "")}</small></td>
                <td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(item.moderationStatus || "visible")}">${escapeHtml(item.moderationStatus || "visible")}</span></td>
                <td>${fmtNumber(item.reportCount || 0)}</td>
                <td>${escapeHtml(item.latestReportReason || item.moderationReason || "-")}</td>
                <td>
                  ${item.moderationStatus === "hidden"
                    ? `<button type="button" data-moderation="restore:${escapeHtml(item.id)}">恢复</button>`
                    : `<button type="button" data-moderation="hide:${escapeHtml(item.id)}">确认隐藏</button><button type="button" data-moderation="reject:${escapeHtml(item.id)}">驳回举报并恢复</button>`}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="6">暂无举报</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>举报与撤回</h2><span>${fmtNumber(adminState.withdrawals.length)} 条记录</span></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>作品</th><th>用户</th><th>状态</th><th>公开时间</th><th>申请时间</th><th>原因</th><th></th></tr></thead>
          <tbody>
            ${adminState.withdrawals.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.id)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || "")}</small></td>
                <td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(item.withdrawalStatus)}">${escapeHtml(item.withdrawalStatus)}</span></td>
                <td>${fmtDate(item.publishedAt)}</td>
                <td>${fmtDate(item.withdrawalRequestedAt)}</td>
                <td>${escapeHtml(item.withdrawalReason || "-")}</td>
                <td>
                  ${item.withdrawalStatus === "requested" ? `
                    <button type="button" data-withdrawal-decision="approved:${escapeHtml(item.id)}">批准</button>
                    <button type="button" data-withdrawal-decision="rejected:${escapeHtml(item.id)}">拒绝</button>
                  ` : ""}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7">暂无撤回申请</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderAudit() {
  return `
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>审计日志</h2><button type="button" data-audit-demo>记录一次只读巡检</button></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>动作</th><th>对象</th><th>操作者</th><th>详情</th><th>时间</th></tr></thead>
          <tbody>
            ${adminState.audit.map((item) => `
              <tr><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.target)}</td><td>${escapeHtml(item.actor)}</td><td>${escapeHtml(item.detail)}</td><td>${fmtDate(item.createdAt)}</td></tr>
            `).join("") || `<tr><td colspan="5">本地会话暂无审计动作；服务端落库将在审计任务中接入。</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
}

function renderContent() {
  switch (adminState.active) {
    case "providers": return renderAdminModule("providers");
    case "generation-requests": return renderRequests();
    case "square-review": return renderAdminModule("squareReview");
    case "gallery-files": return renderAdminModule("galleryFiles");
    case "users-credits": return renderAdminModule("users");
    case "prompt-cms": return renderPrompts();
    case "prompt-audit": return renderPromptAudit();
    case "tag-library": return renderTags();
    case "system-settings": return renderSettings();
    case "reports-withdrawals": return renderWithdrawals();
    case "growth": return renderGrowthPlaceholder();
    case "announcements": return renderAnnouncements();
    case "rum-performance": return renderRum();
    case "audit-log": return renderAudit();
    default: return renderAdminModule("overview");
  }
}

function render() {
  const [pageId, , label] = currentNav();
  const app = $("#adminApp");
  const content = $("#adminContent");
  if (app) app.dataset.adminPage = pageId;
  if (content) content.dataset.adminSection = pageId;
  document.body.dataset.adminSection = pageId;
  $("#adminPageTitle").textContent = label;
  const description = $("#adminPageDescription");
  if (description) description.textContent = pageDescriptions[adminState.active] || pageDescriptions.overview;
  const userLabel = $("#adminUserLabel");
  if (userLabel) {
    userLabel.textContent = adminState.user ? `${adminState.user.name || adminState.user.email} · 管理员` : "-";
  }
  renderNav();
  content.innerHTML = renderContent();
  bindToolbar();
  bindPagination();
  bindActions();
}

function openDrawer(title, body) {
  const drawer = $("#adminDrawer");
  const backdrop = $("#adminDrawerBackdrop");
  backdrop?.classList.remove("hidden");
  backdrop?.setAttribute("aria-hidden", "false");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", title);
  document.body.classList.add("admin-drawer-open");
  drawer.innerHTML = `
    <div class="admin-drawer-head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" data-close-drawer aria-label="关闭详情"><i class="ri-close-line" aria-hidden="true"></i></button>
    </div>
    <div class="admin-drawer-body">${body}</div>
  `;
  $("[data-close-drawer]", drawer).addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer, { once: true });
  $("[data-close-drawer]", drawer)?.focus?.({ preventScroll: true });
}

function closeDrawer() {
  $("#adminDrawerBackdrop")?.classList.add("hidden");
  $("#adminDrawerBackdrop")?.setAttribute("aria-hidden", "true");
  const drawer = $("#adminDrawer");
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
  drawer.removeAttribute("role");
  drawer.removeAttribute("aria-modal");
  drawer.removeAttribute("aria-label");
  drawer.innerHTML = "";
  document.body.classList.remove("admin-drawer-open");
}

function jsonBlock(value) {
  if (value === null || value === undefined || value === "") return "-";
  try {
    return escapeHtml(JSON.stringify(value, null, 2));
  } catch {
    return escapeHtml(String(value));
  }
}

async function requestDrawer(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  const fallback = typeof itemOrId === "object" ? itemOrId : adminState.generations.find((item) => item.id === id);
  const response = id ? await api(`/api/admin/generations/${encodeURIComponent(id)}`).catch(() => null) : null;
  const item = response?.request || fallback;
  const trace = response?.trace || [];
  if (!item) return;
  const module = generationDiagnosticsModule();
  if (module?.renderDrawer) {
    openDrawer("生成请求详情", module.renderDrawer({ item, trace, helpers: generationDiagnosticsHelpers() }));
    module.bind({
      root: $("#adminDrawer"),
      state: adminState,
      api,
      refresh: loadAll,
      render,
      confirmAction,
      toast: (message) => setStatus(message, "ok")
    });
    return;
  }
  openDrawer("生成请求详情", `
    <dl class="admin-detail-list">
      <dt>ID</dt><dd>${escapeHtml(item.id)}</dd>
      <dt>状态</dt><dd>${escapeHtml(item.status)}</dd>
      <dt>队列</dt><dd>${escapeHtml(item.queueStatus || "-")} · attempts ${escapeHtml(item.attemptCount ?? 0)}/${escapeHtml(item.maxAttempts ?? 1)}</dd>
      <dt>用户</dt><dd>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</dd>
      <dt>耗时</dt><dd>${fmtDuration(item.durationMs)}</dd>
      <dt>模型</dt><dd>${escapeHtml(item.model || "-")}</dd>
      <dt>错误阶段</dt><dd>${escapeHtml(item.errorStage || item.failureStage || "-")}</dd>
      <dt>错误码</dt><dd>${escapeHtml(item.errorCode || "-")}</dd>
      <dt>错误</dt><dd>${escapeHtml(item.errorMessage || "-")}</dd>
      <dt>Revised prompt</dt><dd>${escapeHtml(item.revisedPrompt || "-")}</dd>
      <dt>提示词</dt><dd>${escapeHtml(item.prompt || "-")}</dd>
    </dl>
    <h3>请求参数</h3>
    <pre class="admin-code-block">${jsonBlock(item.requestedParams)}</pre>
    <h3>规范化参数</h3>
    <pre class="admin-code-block">${jsonBlock(item.normalizedParams)}</pre>
    <h3>Provider 参数</h3>
    <pre class="admin-code-block">${jsonBlock(item.providerParams)}</pre>
    <h3>Provider 响应摘要</h3>
    <pre class="admin-code-block">${jsonBlock(item.providerResponse)}</pre>
    <h3>Trace 时间线</h3>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>时间</th><th>阶段</th><th>级别</th><th>消息</th><th>数据</th></tr></thead>
        <tbody>
          ${trace.map((entry) => `
            <tr>
              <td>${fmtDate(entry.createdAt)}</td>
              <td>${escapeHtml(entry.stage || "-")}</td>
              <td><span class="admin-badge" data-status="${escapeHtml(entry.level || "info")}">${escapeHtml(entry.level || "info")}</span></td>
              <td>${escapeHtml(entry.message || "-")}</td>
              <td><pre class="admin-code-block compact">${jsonBlock(entry.data)}</pre></td>
            </tr>
          `).join("") || `<tr><td colspan="5">暂无 trace 记录</td></tr>`}
        </tbody>
      </table>
    </div>
  `);
}

async function promptAuditDrawer(id) {
  const response = await api(`/api/admin/prompt-audits/${encodeURIComponent(id)}`);
  const item = response.audit || adminState.promptAudits.find((audit) => String(audit.id) === String(id));
  if (!item) return;
  openDrawer("Prompt Audit 详情", `
    <dl class="admin-detail-list">
      <dt>ID</dt><dd>${escapeHtml(item.id)}</dd>
      <dt>作品</dt><dd>${escapeHtml(item.generationId || "-")}</dd>
      <dt>用户</dt><dd>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</dd>
      <dt>请求模式</dt><dd>${escapeHtml(item.requestedMode || "-")}</dd>
      <dt>风险等级</dt><dd>${escapeHtml(item.resultLevel || "-")} / ${escapeHtml(item.resultAction || "-")}</dd>
      <dt>强制模式</dt><dd>${escapeHtml(item.requiredMode || "-")}</dd>
      <dt>状态</dt><dd>${escapeHtml(item.status || "-")}</dd>
      <dt>分数</dt><dd>${Number(item.score || 0).toFixed(4)} · ${escapeHtml(item.method || "none")}</dd>
      <dt>原提示词</dt><dd>${escapeHtml(item.prompt || "-")}</dd>
      <dt>匹配提示词</dt><dd>${escapeHtml(item.matchedPromptText || item.matchedGenerationPrompt || "-")}</dd>
      <dt>人工覆盖</dt><dd>${escapeHtml(item.overrideAction || "-")} ${escapeHtml(item.overrideNote || "")}</dd>
      <dt>复核人</dt><dd>${escapeHtml(item.reviewerName || item.reviewerEmail || item.reviewerUserId || "-")}</dd>
      <dt>创建时间</dt><dd>${fmtDate(item.createdAt)}</dd>
      <dt>复核时间</dt><dd>${fmtDate(item.reviewedAt)}</dd>
    </dl>
    <div class="admin-drawer-actions">
      <button type="button" data-prompt-audit-action="allow_text_to_image:${escapeHtml(item.id)}">允许文生图</button>
      <button type="button" data-prompt-audit-action="require_image_to_image:${escapeHtml(item.id)}">要求图生图</button>
      <button type="button" data-prompt-audit-action="mark_reviewed:${escapeHtml(item.id)}">标记已复核</button>
    </div>
  `);
  bindPromptAuditActions($("#adminDrawer"));
}

function showTemporaryPassword(password) {
  if (!password) return;
  openDrawer("一次性临时密码", `
    <section class="admin-temp-password">
      <p>该密码只会在本次操作后返回一次。关闭后无法再次查看，只能重新重置密码。</p>
      <div class="admin-copy-row">
        <code>${escapeHtml(password)}</code>
        <button type="button" data-copy-temp-password>复制</button>
      </div>
    </section>
  `);
  $("[data-copy-temp-password]")?.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(password).catch(() => null);
  });
}

function createUserDrawer() {
  openDrawer("新建用户", `
    <form id="drawerCreateUserForm" class="admin-form-grid single">
      <label>昵称<input name="name" placeholder="运营同学"></label>
      <label>邮箱<input name="email" type="email" required placeholder="ops@example.com"></label>
      <label>密码<input name="password" type="password" placeholder="留空则自动生成临时密码"></label>
      <label class="admin-check"><input name="generatePassword" type="checkbox" checked>自动生成临时密码</label>
      <label>角色<select name="role"><option value="user">user</option><option value="admin">admin</option></select></label>
      <label>状态<select name="status"><option value="active">active</option><option value="disabled">disabled</option></select></label>
      <label>初始积分<input name="credits" type="number" min="0" value="${escapeHtml(adminState.settings?.defaultCredits ?? 10)}"></label>
      <label>备注<input name="note" value="Admin created user"></label>
      <button type="submit">创建用户</button>
    </form>
  `);
  $("#drawerCreateUserForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const role = String(form.get("role") || "user");
    if (role === "admin" && !(await confirmAction({
      title: "创建管理员用户",
      message: "确认创建 admin 用户？该账号将拥有后台管理权限。",
      confirmText: "创建 admin",
      danger: true
    }))) return;
    const response = await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        generatePassword: Boolean(form.get("generatePassword")),
        role,
        status: form.get("status"),
        credits: form.get("credits"),
        note: form.get("note")
      })
    });
    recordAudit("create_user", response.user?.id || String(form.get("email")), form.get("email"));
    await loadAll();
    render();
    if (response.temporaryPassword) {
      showTemporaryPassword(response.temporaryPassword);
    } else {
      closeDrawer();
    }
  });
}

function providerDrawer(provider = {}) {
  const isNew = !provider.id;
  const caps = {
    textToImage: true,
    imageEdit: true,
    imageToImage: true,
    multiCandidate: false,
    asyncTasks: false,
    responses: true,
    revisedPrompt: true,
    sizes: [],
    qualities: [],
    formats: [],
    transparentBackground: false,
    sourceTransparency: false,
    privacyDownload: false,
    maxImagesPerRequest: 1,
    ...(provider.capabilities || {})
  };
  const routing = {
    role: isNew ? "fallback" : "default",
    weight: 1,
    ...(provider.routing || {})
  };
  const mapping = provider.mapping || {};
  openDrawer(isNew ? "新增 Provider" : "编辑 Provider", `
    <form id="drawerProviderForm" class="admin-form-grid single">
      <label>名称<input name="name" value="${escapeHtml(provider.name || "")}" required></label>
      <label>类型<select name="providerType">
        ${["openai", "openai-compatible", "custom-proxy"].map((type) => `<option value="${type}"${(provider.providerType || "openai-compatible") === type ? " selected" : ""}>${type}</option>`).join("")}
      </select></label>
      <label>Base URL<input name="baseUrl" value="${escapeHtml(provider.baseUrl || "")}" required placeholder="https://api.openai.com"></label>
      <label>API Key<input name="apiKey" type="password" placeholder="${escapeHtml(provider.apiKeyMask || "留空则保持不变")}"></label>
      <label>默认模型<input name="defaultModel" value="${escapeHtml(provider.defaultModel || "gpt-image-2")}"></label>
      <label>Images endpoint override<input name="endpointImages" value="${escapeHtml(provider.endpointImages || "")}"></label>
      <label>Responses endpoint override<input name="endpointResponses" value="${escapeHtml(provider.endpointResponses || "")}"></label>
      <label>Edits endpoint override<input name="endpointEdits" value="${escapeHtml(provider.endpointEdits || "")}"></label>
      <label>状态<select name="status"><option value="active"${provider.status !== "disabled" ? " selected" : ""}>active</option><option value="disabled"${provider.status === "disabled" ? " selected" : ""}>disabled</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(provider.sortOrder || 0)}"></label>
      <label>能力 JSON<textarea name="capabilities" rows="8">${escapeHtml(JSON.stringify(caps, null, 2))}</textarea></label>
      <label>路由 JSON<textarea name="routing" rows="5">${escapeHtml(JSON.stringify(routing, null, 2))}</textarea></label>
      <label>Provider Mapping JSON<textarea name="mapping" rows="12" placeholder='{"mode":"openai-compatible","submit":{"method":"POST","path":"/v1/images/generations"}}'>${escapeHtml(JSON.stringify(mapping, null, 2))}</textarea></label>
      <button type="submit">${isNew ? "创建 Provider" : "保存 Provider"}</button>
      ${isNew || provider.id === "prv_default" ? "" : `<button type="button" class="danger" data-delete-provider>删除 Provider</button>`}
    </form>
  `);
  $("#drawerProviderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let capabilities;
    let routing;
    let mapping;
    try {
      capabilities = JSON.parse(form.get("capabilities") || "{}");
      routing = JSON.parse(form.get("routing") || "{}");
      mapping = JSON.parse(form.get("mapping") || "{}");
    } catch {
      setStatus("Provider JSON 格式错误", "danger");
      return;
    }
    const apiKey = String(form.get("apiKey") || "").trim();
    const payload = {
      name: form.get("name"),
      providerType: form.get("providerType"),
      baseUrl: form.get("baseUrl"),
      defaultModel: form.get("defaultModel"),
      endpointImages: form.get("endpointImages"),
      endpointResponses: form.get("endpointResponses"),
      endpointEdits: form.get("endpointEdits"),
      status: form.get("status"),
      sortOrder: form.get("sortOrder"),
      capabilities,
      routing,
      mapping
    };
    if (isNew || apiKey) payload.apiKey = apiKey;
    await api(isNew ? "/api/admin/providers" : `/api/admin/providers/${encodeURIComponent(provider.id)}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(payload)
    });
    recordAudit(isNew ? "create_provider" : "update_provider", provider.id || String(payload.name), payload.baseUrl);
    await refreshAndRender();
    closeDrawer();
  });
  $("[data-delete-provider]")?.addEventListener("click", async () => {
    if (!(await confirmAction({
      title: "删除 Provider",
      message: `确认删除 ${provider.name}？默认 Provider 不能删除。`,
      confirmText: "删除",
      danger: true
    }))) return;
    await api(`/api/admin/providers/${encodeURIComponent(provider.id)}`, { method: "DELETE" });
    recordAudit("delete_provider", provider.id, provider.name);
    await refreshAndRender();
    closeDrawer();
  });
}

async function userDrawer(user) {
  const [creditLedger, rewardLedger] = await Promise.all([
    api(`/api/admin/users/${encodeURIComponent(user.id)}/credit-ledger?limit=80`),
    api(`/api/admin/users/${encodeURIComponent(user.id)}/reward-ledger?limit=80`)
  ]);
  const ledgerRows = creditLedger.ledger || [];
  const rewardRows = rewardLedger.rewards || [];
  const firstPublicReward = user.firstPublicRewardStatus && user.firstPublicRewardStatus !== "none"
    ? `${user.firstPublicRewardStatus} · ${fmtNumber(user.firstPublicRewardAmount)} · ${user.firstPublicRewardGenerationId || "-"}`
    : "未发放";
  openDrawer("用户与积分", `
    <form id="drawerUserForm" class="admin-form-grid single">
      <label>姓名<input name="name" value="${escapeHtml(user.name || "")}"></label>
      <label>角色<select name="role"><option value="user"${user.role === "user" ? " selected" : ""}>user</option><option value="admin"${user.role === "admin" ? " selected" : ""}>admin</option></select></label>
      <label>状态<select name="status"><option value="active"${user.status === "active" ? " selected" : ""}>active</option><option value="disabled"${user.status === "disabled" ? " selected" : ""}>disabled</option></select></label>
      <label>首发奖励<input value="${escapeHtml(firstPublicReward)}" disabled></label>
      <label>积分<input name="credits" type="number" min="0" value="${escapeHtml(user.credits || 0)}"></label>
      <label>积分调整<input name="creditDelta" type="number" value="0"></label>
      <label>备注<input name="note" value="Admin adjustment"></label>
      <button type="submit">保存用户</button>
      <button type="button" data-reset-user-password>重置密码</button>
    </form>
    <section class="admin-ledger-section">
      <h3>积分流水</h3>
      <div class="admin-mini-table">
        ${ledgerRows.map((item) => `
          <div><strong>${item.delta > 0 ? "+" : ""}${fmtNumber(item.delta)}</strong><span>${escapeHtml(item.source)}</span><small>${fmtNumber(item.balanceAfter)} · ${fmtDate(item.createdAt)}</small></div>
        `).join("") || "<p>暂无积分流水</p>"}
      </div>
    </section>
    <section class="admin-ledger-section">
      <h3>奖励流水</h3>
      <div class="admin-mini-table">
        ${rewardRows.map((item) => `
          <div><strong>${escapeHtml(item.rewardType)}</strong><span>${escapeHtml(item.status)} · ${fmtNumber(item.amount)}</span><small>${fmtDate(item.awardedAt || item.createdAt)}</small></div>
        `).join("") || "<p>暂无奖励流水</p>"}
      </div>
    </section>
  `);
  $("#drawerUserForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("status") === "disabled" && !(await confirmAction({
      title: "停用用户",
      message: "确认停用该用户？停用后该用户将无法正常使用账号。",
      confirmText: "停用",
      danger: true
    }))) return;
    await api(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: form.get("name"),
        role: form.get("role"),
        status: form.get("status"),
        credits: form.get("credits"),
        creditDelta: form.get("creditDelta"),
        note: form.get("note")
      })
    });
    recordAudit("update_user", user.id, user.email);
    await refreshAndRender();
    closeDrawer();
  });
  $("[data-reset-user-password]")?.addEventListener("click", async () => {
    if (!(await confirmAction({
      title: "重置用户密码",
      message: `确认重置 ${user.email} 的密码？系统会生成一次性临时密码。`,
      confirmText: "重置密码",
      danger: true
    }))) return;
    const response = await api(`/api/admin/users/${encodeURIComponent(user.id)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ generatePassword: true, note: "Admin reset password" })
    });
    recordAudit("reset_user_password", user.id, user.email);
    await loadAll();
    render();
    showTemporaryPassword(response.temporaryPassword);
  });
}

function promptSourcePayload(form) {
  let config = {};
  const configText = String(form.get("config") || "").trim();
  if (configText) {
    try {
      config = JSON.parse(configText);
    } catch {
      throw new Error("来源配置必须是 JSON 对象");
    }
  }
  return {
    name: form.get("name"),
    sourceType: form.get("sourceType"),
    repoUrl: form.get("repoUrl"),
    branch: form.get("branch"),
    parser: form.get("parser"),
    status: form.get("status"),
    sortOrder: Number(form.get("sortOrder") || 0),
    config
  };
}

function promptSourceDrawer(source = {}) {
  const isNew = !source.id;
  openDrawer(isNew ? "新建远程来源" : "编辑远程来源", `
    <form id="drawerPromptSourceForm" class="admin-form-grid single">
      <label>名称<input name="name" value="${escapeHtml(source.name || "")}" required></label>
      <label>类型<input name="sourceType" value="${escapeHtml(source.sourceType || "github")}" required></label>
      <label>仓库 URL<input name="repoUrl" value="${escapeHtml(source.repoUrl || "")}" required></label>
      <label>分支<input name="branch" value="${escapeHtml(source.branch || "main")}"></label>
      <label>Parser<input name="parser" value="${escapeHtml(source.parser || "")}" placeholder="AIS-RLS-011 接入"></label>
      <label>状态<select name="status"><option value="active"${source.status !== "disabled" ? " selected" : ""}>active</option><option value="disabled"${source.status === "disabled" ? " selected" : ""}>disabled</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(source.sortOrder || 0)}"></label>
      <label>配置 JSON<textarea name="config" rows="5">${escapeHtml(JSON.stringify(source.config || {}, null, 2))}</textarea></label>
      <button type="submit">${isNew ? "创建" : "保存"}</button>
    </form>
  `);
  $("#drawerPromptSourceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = promptSourcePayload(new FormData(event.currentTarget));
    } catch (error) {
      setStatus(error.message, "danger");
      return;
    }
    await api(isNew ? "/api/admin/prompt-sources" : `/api/admin/prompt-sources/${encodeURIComponent(source.id)}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(payload)
    });
    recordAudit(isNew ? "create_prompt_source" : "update_prompt_source", source.id || payload.name, payload.name);
    await refreshAndRender();
    closeDrawer();
  });
}

function promptPayload(form) {
  return {
    title: form.get("title"),
    image: form.get("imageUrl"),
    preview: form.get("preview"),
    prompt: form.get("prompt"),
    tags: String(form.get("tags") || "").split(/[,，\s]+/).filter(Boolean),
    category: form.get("category"),
    visibility: form.get("visibility"),
    author: form.get("author"),
    source: form.get("source"),
    sourceUrl: form.get("sourceUrl"),
    githubUrl: form.get("githubUrl"),
    remoteId: form.get("remoteId"),
    sourceRepo: form.get("sourceRepo"),
    sourceCategory: form.get("sourceCategory"),
    promptType: form.get("promptType"),
    language: form.get("language"),
    modelHint: form.get("modelHint"),
    syncedAt: form.get("syncedAt"),
    status: form.get("status"),
    sortOrder: Number(form.get("sortOrder") || 0)
  };
}

function promptDrawer(prompt = {}) {
  const isNew = !prompt.id;
  const categories = (adminState.promptCategories || []).filter((category) => category.status !== "hidden");
  const selectedCategory = prompt.category || "general";
  openDrawer(isNew ? "新建提示词" : "编辑提示词", `
    <form id="drawerPromptForm" class="admin-form-grid single">
      <label>标题<input name="title" value="${escapeHtml(prompt.title || "")}" required></label>
      <label>旧封面 URL<input name="imageUrl" value="${escapeHtml(prompt.image || "")}"></label>
      <label>预览封面 URL<input name="preview" value="${escapeHtml(prompt.preview || prompt.coverUrl || "")}"></label>
      <label>提示词<textarea name="prompt" rows="6" required>${escapeHtml(prompt.prompt || "")}</textarea></label>
      <label>标签<input name="tags" value="${escapeHtml((prompt.tags || []).join(", "))}"></label>
      <label>分类<select name="category">
        ${categories.map((category) => `<option value="${escapeHtml(category.slug)}"${selectedCategory === category.slug ? " selected" : ""}>${escapeHtml(category.labelZh || category.slug)}</option>`).join("")}
        ${categories.some((category) => category.slug === selectedCategory) ? "" : `<option value="${escapeHtml(selectedCategory)}" selected>${escapeHtml(selectedCategory)}</option>`}
      </select></label>
      <label>可见性<select name="visibility"><option value="public"${prompt.visibility !== "private" && prompt.visibility !== "internal" ? " selected" : ""}>public</option><option value="private"${prompt.visibility === "private" ? " selected" : ""}>private</option><option value="internal"${prompt.visibility === "internal" ? " selected" : ""}>internal</option></select></label>
      <label>作者<input name="author" value="${escapeHtml(prompt.author || "")}"></label>
      <label>来源<input name="source" value="${escapeHtml(prompt.source || "admin")}"></label>
      <label>来源 URL<input name="sourceUrl" value="${escapeHtml(prompt.sourceUrl || "")}"></label>
      <label>GitHub URL<input name="githubUrl" value="${escapeHtml(prompt.githubUrl || "")}"></label>
      <label>远程 ID<input name="remoteId" value="${escapeHtml(prompt.remoteId || "")}"></label>
      <label>来源仓库<input name="sourceRepo" value="${escapeHtml(prompt.sourceRepo || "")}"></label>
      <label>来源分类<input name="sourceCategory" value="${escapeHtml(prompt.sourceCategory || "")}"></label>
      <label>Prompt 类型<input name="promptType" value="${escapeHtml(prompt.promptType || "text-to-image")}"></label>
      <label>语言<input name="language" value="${escapeHtml(prompt.language || "zh")}"></label>
      <label>模型提示<input name="modelHint" value="${escapeHtml(prompt.modelHint || "")}"></label>
      <label>同步时间<input name="syncedAt" value="${escapeHtml(prompt.syncedAt || "")}" placeholder="2026-05-19T12:00:00.000Z"></label>
      <label>状态<select name="status"><option value="active"${prompt.status !== "hidden" ? " selected" : ""}>active</option><option value="hidden"${prompt.status === "hidden" ? " selected" : ""}>hidden</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(prompt.sortOrder || 0)}"></label>
      <button type="submit">${isNew ? "创建" : "保存"}</button>
      ${isNew ? "" : `<button type="button" class="danger" data-hide-prompt>隐藏此条</button>`}
    </form>
  `);
  $("#drawerPromptForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = promptPayload(new FormData(event.currentTarget));
    await api(isNew ? "/api/prompts" : `/api/prompts/${prompt.id}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(payload)
    });
    recordAudit(isNew ? "create_prompt" : "update_prompt", String(prompt.id || payload.title), payload.title);
    await refreshAndRender();
    closeDrawer();
  });
  $("[data-hide-prompt]")?.addEventListener("click", async () => {
    if (!(await confirmAction({
      title: "隐藏提示词",
      message: "确认隐藏该提示词？隐藏后前台将不再展示。",
      confirmText: "隐藏",
      danger: true
    }))) return;
    await api(`/api/prompts/${prompt.id}`, { method: "DELETE" });
    recordAudit("hide_prompt", String(prompt.id), prompt.title || "");
    await refreshAndRender();
    closeDrawer();
  });
}

function categoryDrawer(category = {}) {
  const isNew = !category.slug;
  openDrawer(isNew ? "新建提示词分类" : "编辑提示词分类", `
    <form id="drawerCategoryForm" class="admin-form-grid single">
      <label>Slug<input name="slug" value="${escapeHtml(category.slug || "")}" ${isNew ? "required" : "readonly"}></label>
      <label>中文名<input name="labelZh" value="${escapeHtml(category.labelZh || "")}" required></label>
      <label>英文名<input name="labelEn" value="${escapeHtml(category.labelEn || "")}"></label>
      <label>中文说明<textarea name="descriptionZh" rows="3">${escapeHtml(category.descriptionZh || "")}</textarea></label>
      <label>英文说明<textarea name="descriptionEn" rows="3">${escapeHtml(category.descriptionEn || "")}</textarea></label>
      <label>状态<select name="status"><option value="active"${category.status !== "hidden" ? " selected" : ""}>active</option><option value="hidden"${category.status === "hidden" ? " selected" : ""}>hidden</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(category.sortOrder || 0)}"></label>
      <button type="submit">${isNew ? "创建" : "保存"}</button>
      ${isNew ? "" : `<button type="button" class="danger" data-hide-category>停用分类</button>`}
    </form>
  `);
  $("#drawerCategoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("status") === "hidden" && !(await confirmAction({
      title: "停用分类",
      message: "确认停用该分类？前台筛选将不再展示停用分类名。",
      confirmText: "停用",
      danger: true
    }))) return;
    const payload = {
      slug: String(form.get("slug") || "").trim().toLowerCase(),
      labelZh: form.get("labelZh"),
      labelEn: form.get("labelEn"),
      descriptionZh: form.get("descriptionZh"),
      descriptionEn: form.get("descriptionEn"),
      status: form.get("status"),
      sortOrder: Number(form.get("sortOrder") || 0)
    };
    await api(isNew ? "/api/prompt-categories" : `/api/prompt-categories/${encodeURIComponent(category.slug)}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(payload)
    });
    recordAudit(isNew ? "create_prompt_category" : "update_prompt_category", payload.slug, payload.labelZh || "");
    await refreshAndRender();
    closeDrawer();
  });
  $("[data-hide-category]")?.addEventListener("click", async () => {
    if (!(await confirmAction({
      title: "停用分类",
      message: "确认停用该分类？已有标签不会删除。",
      confirmText: "停用",
      danger: true
    }))) return;
    await api(`/api/prompt-categories/${encodeURIComponent(category.slug)}`, { method: "DELETE" });
    recordAudit("hide_prompt_category", category.slug, category.labelZh || "");
    await refreshAndRender();
    closeDrawer();
  });
}

function tagDrawer(tag = {}) {
  const isNew = !tag.slug;
  openDrawer(isNew ? "新建标签" : "编辑标签", `
    <form id="drawerTagForm" class="admin-form-grid single">
      <label>Slug<input name="slug" value="${escapeHtml(tag.slug || "")}" ${isNew ? "required" : "readonly"}></label>
      <label>中文<input name="labelZh" value="${escapeHtml(tag.labelZh || "")}"></label>
      <label>英文<input name="labelEn" value="${escapeHtml(tag.labelEn || "")}"></label>
      <label>别名<input name="aliases" value="${escapeHtml((tag.aliases || []).join(", "))}"></label>
      <label>分类<input name="category" value="${escapeHtml(tag.category || "")}"></label>
      <label>状态<select name="status"><option value="active"${tag.status !== "hidden" ? " selected" : ""}>active</option><option value="hidden"${tag.status === "hidden" ? " selected" : ""}>hidden</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(tag.sortOrder || 0)}"></label>
      <label>色相<input name="hue" type="number" min="0" max="359" value="${escapeHtml(tag.hue || 0)}"></label>
      <label class="admin-check"><input name="showInFilter" type="checkbox"${tag.showInFilter !== false ? " checked" : ""}>前台筛选展示</label>
      <button type="submit">${isNew ? "创建" : "保存"}</button>
      ${isNew ? "" : `<label>合并到目标 slug<input id="mergeTargetSlug" placeholder="target-slug"></label><button type="button" data-merge-tag>合并标签</button>`}
    </form>
  `);
  $("#drawerTagForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("status") === "hidden" && !(await confirmAction({
      title: "隐藏标签",
      message: "确认隐藏该标签？前台筛选和推荐可能受影响。",
      confirmText: "隐藏",
      danger: true
    }))) return;
    const payload = {
      slug: String(form.get("slug") || "").trim().toLowerCase(),
      labelZh: form.get("labelZh"),
      labelEn: form.get("labelEn"),
      aliases: String(form.get("aliases") || "").split(/[,，\n]+/).map((v) => v.trim()).filter(Boolean),
      category: form.get("category"),
      status: form.get("status"),
      sortOrder: Number(form.get("sortOrder") || 0),
      hue: Number(form.get("hue") || 0),
      showInFilter: Boolean(form.get("showInFilter")),
      source: tag.source || "admin"
    };
    await api(isNew ? "/api/tags" : `/api/tags/${encodeURIComponent(tag.slug)}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(payload)
    });
    recordAudit(isNew ? "create_tag" : "update_tag", payload.slug, payload.labelZh || payload.labelEn || "");
    await refreshAndRender();
    closeDrawer();
  });
  $("[data-merge-tag]")?.addEventListener("click", async () => {
    const targetSlug = $("#mergeTargetSlug").value.trim().toLowerCase();
    if (!targetSlug || !(await confirmAction({
      title: "合并标签",
      message: `确认把 ${tag.slug} 合并到 ${targetSlug}？历史内容会迁移到目标标签。`,
      confirmText: "合并",
      danger: true
    }))) return;
    await api(`/api/tags/${encodeURIComponent(tag.slug)}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetSlug })
    });
    recordAudit("merge_tag", tag.slug, `target=${targetSlug}`);
    await refreshAndRender();
    closeDrawer();
  });
}

function workDrawer(item) {
  openDrawer("公开作品详情", `
    <img class="admin-drawer-image" src="${escapeHtml(item.imageUrl)}" alt="">
    <dl class="admin-detail-list">
      <dt>ID</dt><dd>${escapeHtml(item.id)}</dd>
      <dt>作者</dt><dd>${escapeHtml(item.userName || item.userId || "-")}</dd>
      <dt>标签</dt><dd>${escapeHtml((item.publicTags || []).join(", ")) || "-"}</dd>
      <dt>提示词</dt><dd>${escapeHtml(item.prompt || "-")}</dd>
    </dl>
  `);
}

function announcementDrawer(item = null) {
  const isNew = !item;
  const announcement = item || {
    title: "",
    body: "",
    level: "info",
    displayMode: "feed",
    audience: "all",
    status: "draft",
    isImportant: false,
    requiresAck: false,
    startsAt: "",
    endsAt: "",
    targetUserIds: []
  };
  openDrawer(isNew ? "新建通知" : "编辑通知", `
    <form id="drawerAnnouncementForm" class="admin-form-grid">
      <label>标题<input name="title" value="${escapeHtml(announcement.title || "")}" required maxlength="160"></label>
      <label>等级
        <select name="level">
          ${["info", "success", "warning", "danger", "maintenance", "feature"].map((level) => `<option value="${level}"${(announcement.level || announcement.severity) === level ? " selected" : ""}>${level}</option>`).join("")}
        </select>
      </label>
      <label>展示方式
        <select name="displayMode">
          ${["feed", "banner", "modal"].map((mode) => `<option value="${mode}"${(announcement.displayMode || announcement.displayType) === mode ? " selected" : ""}>${mode}</option>`).join("")}
        </select>
      </label>
      <label>目标人群
        <select name="audience">
          ${["all", "logged-in", "admin", "specific-users"].map((audience) => `<option value="${audience}"${(announcement.audience || announcement.targetAudience) === audience ? " selected" : ""}>${audience}</option>`).join("")}
        </select>
      </label>
      <label>生效时间<input name="startsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(announcement.startsAt || announcement.publishAt))}"></label>
      <label>失效时间<input name="endsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(announcement.endsAt || announcement.expiresAt))}"></label>
      <label>指定用户 ID<textarea name="targetUserIds" rows="3" placeholder="仅 specific-users 使用，多个 ID 用逗号或换行分隔">${escapeHtml((announcement.targetUserIds || []).join("\n"))}</textarea></label>
      <label>正文<textarea name="body" rows="10" required>${escapeHtml(announcement.body || "")}</textarea></label>
      <label class="admin-check"><input name="isImportant" type="checkbox"${announcement.isImportant ? " checked" : ""}>重要通知</label>
      <label class="admin-check"><input name="requiresAck" type="checkbox"${announcement.requiresAck ? " checked" : ""}>需要用户点击“我已知晓”确认</label>
      <div class="admin-form-actions">
        <button type="submit">${isNew ? "创建通知" : "保存通知"}</button>
        ${!isNew && announcement.status !== "published" ? `<button type="button" data-announcement-drawer-action="publish:${escapeHtml(announcement.id)}">发布</button>` : ""}
        ${!isNew && announcement.status === "published" ? `<button type="button" data-announcement-drawer-action="withdraw:${escapeHtml(announcement.id)}">撤回</button>` : ""}
        ${!isNew ? `<button type="button" data-announcement-drawer-action="archive:${escapeHtml(announcement.id)}">归档</button>` : ""}
      </div>
    </form>
  `);
  $("#drawerAnnouncementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"),
      body: form.get("body"),
      level: form.get("level"),
      displayMode: form.get("displayMode"),
      audience: form.get("audience"),
      startsAt: form.get("startsAt"),
      endsAt: form.get("endsAt"),
      targetUserIds: String(form.get("targetUserIds") || "").split(/[,\n\s]+/).filter(Boolean),
      isImportant: Boolean(form.get("isImportant")),
      requiresAck: Boolean(form.get("requiresAck"))
    };
    const response = await api(isNew ? "/api/admin/announcements" : `/api/admin/announcements/${encodeURIComponent(announcement.id)}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(payload)
    });
    recordAudit(isNew ? "create_announcement" : "update_announcement", response.announcement?.id || announcement.id, payload.title);
    await refreshAndRender();
    closeDrawer();
  });
  document.querySelectorAll("[data-announcement-drawer-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [action, id] = button.dataset.announcementDrawerAction.split(":");
      await runAnnouncementAction(action, id);
      closeDrawer();
    });
  });
}

async function runAnnouncementAction(action, id) {
  const labels = { publish: "发布", archive: "归档", withdraw: "撤回" };
  const danger = action === "archive" || action === "withdraw";
  if (!(await confirmAction({
    title: `${labels[action] || action}通知`,
    message: `确认${labels[action] || action}该通知？`,
    confirmText: labels[action] || "确认",
    danger
  }))) return;
  await api(`/api/admin/announcements/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
    method: "POST",
    body: "{}"
  });
  recordAudit(`${action}_announcement`, id, "");
  await refreshAndRender();
}

async function saveSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(window.AdminModules.settings.buildPayload(form))
  });
  recordAudit("update_settings", "system", "settings saved");
  await refreshAndRender();
}

async function refreshAndRender() {
  await loadAll();
  render();
}

function bindPromptAuditActions(root = document) {
  root.querySelectorAll("[data-prompt-audit-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [action, id] = button.dataset.promptAuditAction.split(":");
      const note = prompt("复核备注", action === "allow_text_to_image" ? "人工确认可文生图发布" : "") || "";
      if (!(await confirmAction({
        title: "复核 Prompt Audit",
        message: `${action} audit #${id}？`,
        confirmText: "确认复核",
        danger: action === "require_image_to_image"
      }))) return;
      await api(`/api/admin/prompt-audits/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note })
      });
      recordAudit(`prompt_audit_${action}`, id, note);
      await refreshAndRender();
    });
  });
}

function bindActions() {
  generationDiagnosticsModule()?.bind?.({
    root: document,
    state: adminState,
    api,
    refresh: loadAll,
    render,
    confirmAction,
    toast: (message) => setStatus(message, "ok")
  });
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.active = button.dataset.jump;
      location.hash = adminState.active;
      render();
    });
  });
  document.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [type, id] = button.dataset.detail.split(":");
      if (type === "request") await requestDrawer(id);
      if (type === "work") workDrawer(adminState.publicImages.find((item) => item.id === id));
      if (type === "user") await userDrawer(adminState.users.find((item) => item.id === id));
      if (type === "prompt") promptDrawer(adminState.prompts.find((item) => String(item.id) === id));
      if (type === "promptSource") promptSourceDrawer(adminState.promptSources.find((item) => item.id === id));
      if (type === "promptAudit") await promptAuditDrawer(id);
      if (type === "tag") tagDrawer(adminState.tags.find((item) => item.slug === id));
      if (type === "category") categoryDrawer(adminState.promptCategories.find((item) => item.slug === id));
      if (type === "provider") providerDrawer(adminState.providers.find((item) => item.id === id));
      if (type === "announcement") announcementDrawer(adminState.announcements.find((item) => item.id === id));
    });
  });
  $("[data-create-user]")?.addEventListener("click", createUserDrawer);
  $("[data-create-provider]")?.addEventListener("click", () => providerDrawer());
  $("[data-create-announcement]")?.addEventListener("click", () => announcementDrawer());
  document.querySelectorAll("[data-announcement-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [action, id] = button.dataset.announcementAction.split(":");
      await runAnnouncementAction(action, id);
    });
  });
  document.querySelectorAll("[data-provider-test]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.providerTest;
      button.disabled = true;
      try {
        const result = await api(`/api/admin/providers/${encodeURIComponent(id)}/test`, { method: "POST", body: "{}" });
        recordAudit("test_provider", id, result.ok ? "ok" : result.error || "failed");
      } finally {
        await refreshAndRender();
      }
    });
  });
  document.querySelectorAll("[data-provider-default]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.providerDefault;
      if (!(await confirmAction({
        title: "设为默认 Provider",
        message: "确认把该 Provider 设为默认线路？",
        confirmText: "设为默认"
      }))) return;
      await api(`/api/admin/providers/${encodeURIComponent(id)}/set-default`, { method: "POST", body: "{}" });
      recordAudit("set_default_provider", id, "");
      await refreshAndRender();
    });
  });
  document.querySelectorAll("[data-user-select]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        adminState.selectedUsers.add(input.dataset.userSelect);
      } else {
        adminState.selectedUsers.delete(input.dataset.userSelect);
      }
      render();
    });
  });
  $("[data-select-page-users]")?.addEventListener("change", (event) => {
    document.querySelectorAll("[data-user-select]").forEach((input) => {
      if (event.target.checked) {
        adminState.selectedUsers.add(input.dataset.userSelect);
      } else {
        adminState.selectedUsers.delete(input.dataset.userSelect);
      }
    });
    render();
  });
  $("[data-bulk-users]")?.addEventListener("click", async () => {
    const userIds = Array.from(adminState.selectedUsers);
    if (!userIds.length) return;
    const action = $("#bulkUserAction")?.value || "creditDelta";
    const status = $("#bulkStatus")?.value || "active";
    const creditDelta = Number($("#bulkCreditDelta")?.value || 0);
    const note = $("#bulkNote")?.value || "Bulk adjustment";
    const dangerous = action === "status" && status === "disabled";
    if (!(await confirmAction({
      title: dangerous ? "批量停用用户" : "批量更新用户",
      message: `${dangerous ? "确认停用" : "确认更新"} ${userIds.length} 个已选用户？`,
      confirmText: dangerous ? "停用" : "更新",
      danger: dangerous
    }))) return;
    await api("/api/admin/users/bulk", {
      method: "POST",
      body: JSON.stringify({ userIds, action, status, creditDelta, note })
    });
    recordAudit("bulk_user_update", "selected users", `${action} ${userIds.length}`);
    adminState.selectedUsers.clear();
    await refreshAndRender();
  });
  $("[data-create-prompt]")?.addEventListener("click", () => promptDrawer());
  $("[data-create-prompt-source]")?.addEventListener("click", () => promptSourceDrawer());
  document.querySelectorAll("[data-prompt-source-sync]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sourceId = button.dataset.promptSourceSync;
      await api(`/api/admin/prompt-sources/${encodeURIComponent(sourceId)}/sync`, {
        method: "POST",
        body: "{}"
      });
      recordAudit("sync_prompt_source", sourceId, "");
      await refreshAndRender();
    });
  });
  $("[data-scan-prompt-duplicates]")?.addEventListener("click", async () => {
    await api("/api/admin/prompt-duplicates/scan", {
      method: "POST",
      body: JSON.stringify({ limit: 2000, hammingThreshold: 6, aiReview: true, aiReviewLimit: 12 })
    });
    recordAudit("scan_prompt_duplicates", "prompt", "manual scan");
    await refreshAndRender();
  });
  document.querySelectorAll("[data-duplicate-ai-review]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.duplicateAiReview;
      await api(`/api/admin/prompt-duplicates/${encodeURIComponent(id)}/ai-review`, {
        method: "POST",
        body: "{}"
      });
      recordAudit("prompt_duplicate_ai_review", id, "AI semantic review");
      await refreshAndRender();
    });
  });
  document.querySelectorAll("[data-duplicate-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [action, id] = button.dataset.duplicateAction.split(":");
      const note = prompt("处理备注", action === "hide_duplicate" ? "人工确认重复，隐藏 B" : "") || "";
      if (!(await confirmAction({
        title: "处理重复候选",
        message: `${action} duplicate candidate #${id}？`,
        confirmText: "处理",
        danger: action === "hide_duplicate"
      }))) return;
      await api(`/api/admin/prompt-duplicates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note })
      });
      recordAudit(`prompt_duplicate_${action}`, id, note);
      await refreshAndRender();
    });
  });
  bindPromptAuditActions(document);
  $("[data-create-category]")?.addEventListener("click", () => categoryDrawer());
  $("[data-create-tag]")?.addEventListener("click", () => tagDrawer());
  $("#adminSettingsForm")?.addEventListener("submit", saveSettings);
  $("[data-clear-key]")?.addEventListener("click", async () => {
    if (!(await confirmAction({
      title: "清除 API Key",
      message: "确认清除 OpenAI API Key？清除后生成能力可能不可用。",
      confirmText: "清除",
      danger: true
    }))) return;
    await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ clearApiKey: true }) });
    recordAudit("clear_api_key", "system", "API key cleared");
    await refreshAndRender();
  });
  $("[data-audit-demo]")?.addEventListener("click", () => {
    recordAudit("read_audit", "admin-console", "manual inspection");
    render();
  });
  document.querySelectorAll("[data-withdrawal-decision]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [decision, id] = button.dataset.withdrawalDecision.split(":");
      const reason = prompt("处理原因", decision === "rejected" ? "withdrawal rejected" : "") || "";
      if (!(await confirmAction({
        title: `${decision === "approved" ? "批准" : "拒绝"}撤回申请`,
        message: `${decision === "approved" ? "批准" : "拒绝"}该撤回申请？`,
        confirmText: decision === "approved" ? "批准" : "拒绝",
        danger: decision !== "approved"
      }))) return;
      await api(`/api/admin/withdrawals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, reason })
      });
      recordAudit(`withdrawal_${decision}`, id, reason);
      await refreshAndRender();
    });
  });
  document.querySelectorAll("[data-moderation]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [action, id] = button.dataset.moderation.split(":");
      const reason = prompt("处理原因", action === "hide" ? "policy_review" : "") || "";
      if (!(await confirmAction({
        title: "处理公开作品",
        message: `${action} ${id}？`,
        confirmText: "确认处理",
        danger: action === "hide"
      }))) return;
      await api(`/api/admin/public-images/${encodeURIComponent(id)}/moderation`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason })
      });
      recordAudit(`moderation_${action}`, id, reason);
      await refreshAndRender();
    });
  });
  document.querySelector("[data-gallery-file-check-run]")?.addEventListener("click", async () => {
    setStatus("正在巡检画廊文件...", "loading");
    const result = await api("/api/admin/gallery-file-checks/run", {
      method: "POST",
      body: JSON.stringify({ limit: 5000 })
    });
    recordAudit("gallery_file_check_run", "public-images", `broken=${result.broken || 0}`);
    await refreshAndRender();
    setStatus(`巡检完成：${fmtNumber(result.checked || 0)} 个文件，异常 ${fmtNumber(result.broken || 0)}`, result.broken ? "warn" : "ok");
  });
}

async function init() {
  $("#adminRefreshBtn").addEventListener("click", refreshAndRender);
  $("#adminSidebarToggle")?.addEventListener("click", () => {
    adminState.sidebarCollapsed = !adminState.sidebarCollapsed;
    localStorage.setItem("adminSidebarCollapsed", adminState.sidebarCollapsed ? "1" : "0");
    renderNav();
  });
  $("#adminDrawerBackdrop")?.addEventListener("click", closeDrawer);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
  window.addEventListener("hashchange", () => {
    adminState.active = location.hash.replace("#", "") || "overview";
    adminState.page = 1;
    render();
  });
  try {
    await loadAll();
    render();
  } catch (error) {
    setStatus(error.status === 403 ? "无权限" : "加载失败", "danger");
    $("#adminContent").innerHTML = `<div class="admin-empty-state">后台加载失败：${escapeHtml(error.message)}</div>`;
  }
}

init();
