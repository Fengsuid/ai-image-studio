(function () {
  window.AdminModules = window.AdminModules || {};

  window.AdminModules.overview = {
    render({ state, helpers }) {
      const { escapeHtml, fmtNumber, fmtDate, metrics, dashboardContext, requestTable } = helpers;
      const m = metrics();
      const dashboard = dashboardContext();
      const heroActions = [
        ["generation-requests", "ri-image-ai-line", "生成请求", "排查队列与耗时"],
        ["users-credits", "ri-user-settings-line", "用户管理", "账号、积分、状态"],
        ["square-review", "ri-gallery-view-2", "广场审核", "公开作品与举报处理"],
        ["system-settings", "ri-sliders-line", "系统设置", "注册、积分和开关"]
      ];
      const actions = [
        ["users-credits", "ri-user-settings-line", "用户管理", "账号、积分、状态"],
        ["square-review", "ri-gallery-view-2", "广场审核", "公开作品与举报处理"],
        ["tag-library", "ri-price-tag-3-line", "标签管理", "标签、分类和合并"],
        ["prompt-cms", "ri-quill-pen-line", "提示词来源", "远程来源和同步记录"],
        ["system-settings", "ri-sliders-line", "系统设置", "注册、积分和开关"]
      ];
      return `
        <section class="admin-overview-hero primitive-card primitive-card--hero">
          <div class="admin-overview-hero-copy">
            <p class="admin-kicker">运营控制台</p>
            <h2>${dashboard.label}</h2>
            <p>${dashboard.detail}</p>
            <div class="admin-overview-meta">
              <span class="admin-status-pill" data-tone="${dashboard.tone}">${dashboard.label}</span>
              <span>${fmtDate(dashboard.rumSummary.updatedAt)} · RUM ${fmtNumber(dashboard.rumSummary.total || 0)}</span>
            </div>
          </div>
          <div class="admin-overview-hero-panel">
            <div class="primitive-card__actions" aria-label="常用后台操作">
              ${heroActions.map(([jump, icon, label]) => `
                <button type="button" class="btn btn--secondary" data-jump="${jump}">
                  <i class="${icon}" aria-hidden="true"></i>
                  <span>${label}</span>
                </button>
              `).join("")}
            </div>
            <div class="admin-overview-hero-row">
              <strong>${fmtNumber(dashboard.issues.length)} 个最近异常</strong>
              <span>${fmtNumber(dashboard.providerIssues.length)} 个供应商异常</span>
            </div>
            <div class="admin-overview-hero-row">
              <strong>${fmtNumber(dashboard.reportQueue)} 条举报队列</strong>
              <span>${fmtNumber(dashboard.brokenFiles.length)} 个文件异常</span>
            </div>
            <div class="admin-overview-hero-row">
              <strong>${fmtNumber(dashboard.syncFailures.length)} 个同步失败</strong>
              <span>${fmtNumber(dashboard.withdrawalQueue)} 条撤回待处理</span>
            </div>
          </div>
        </section>
        <section class="admin-stats-grid admin-dashboard-grid">
          ${statCard("用户", fmtNumber(m.newUsers), `今日新增 / 总用户 ${fmtNumber(state.users.length)}`, "ri-user-add-line", "teal", "success", [35, 52, 44, 68])}
          ${statCard("生成量", fmtNumber(m.todayGenerated), `今日生成 / 总请求 ${fmtNumber(m.total)}`, "ri-image-ai-line", "blue", "success", [42, 56, 62, 78])}
          ${statCard("公开作品", fmtNumber(m.publicWorks), "当前公开广场内容", "ri-gallery-view-2", "violet", "success", [28, 36, 55, 49])}
          ${statCard("举报", fmtNumber(dashboard.reportQueue), "待处理举报队列", "ri-alarm-warning-line", "amber", dashboard.reportQueue ? "danger" : "success", [18, 31, 24, 34])}
          ${statCard("提示词同步", fmtNumber(dashboard.syncFailures.length), "异常同步任务", "ri-sync-warning-line", "rose", dashboard.syncFailures.length ? "danger" : "success", [20, 24, 18, 26])}
          ${statCard("文件异常", fmtNumber(dashboard.brokenFiles.length), "巡检命中异常文件", "ri-folder-warning-line", "slate", dashboard.brokenFiles.length ? "danger" : "success", [16, 21, 17, 22])}
        </section>
        <section class="admin-overview-split">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h2>快捷入口</h2>
              <span>常用运营路径</span>
            </div>
            <div class="admin-quick-links">
              ${actions.map(([jump, icon, label, hint]) => `
                <button type="button" class="admin-quick-link btn btn--secondary" data-jump="${jump}">
                  <i class="${icon}" aria-hidden="true"></i>
                  <strong>${label}</strong>
                  <span>${hint}</span>
                </button>
              `).join("")}
            </div>
          </section>
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h2>最近异常</h2>
              <span>${fmtNumber(dashboard.issues.length)} 项</span>
            </div>
            <div class="admin-issue-list">
              ${dashboard.issues.map((issue) => `
                <article class="admin-issue" data-tone="${issue.tone}">
                  <i class="${issue.icon}" aria-hidden="true"></i>
                  <div>
                    <strong>${escapeHtml(issue.title)}</strong>
                    <p>${escapeHtml(issue.detail)}</p>
                    <small>${escapeHtml(issue.meta || "")}${issue.time ? ` · ${fmtDate(issue.time)}` : ""}</small>
                  </div>
                  <button type="button" data-jump="${issue.jump}">查看</button>
                </article>
              `).join("") || `
                <div class="admin-empty-state admin-empty-state-polished primitive-card primitive-card--empty" data-tone="ok">
                  <svg class="primitive-card__empty-illustration" viewBox="0 0 86 58" role="img" aria-label="暂无异常">
                    <rect x="10" y="11" width="66" height="38" rx="8" fill="currentColor" opacity=".1"></rect>
                    <path d="M22 37h18M22 27h32M22 19h20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path>
                    <circle cx="62" cy="33" r="8" fill="currentColor" opacity=".18"></circle>
                    <path d="m58 33 4 4 8-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                  <h3>暂无异常</h3>
                  <p>当前没有文件、供应商、同步或举报阻断项。</p>
                  <div class="primitive-card__empty-actions">
                    <button type="button" class="btn btn--primary" data-jump="generation-requests">查看生成队列</button>
                    <a href="#system-settings" class="btn btn--link" data-jump="system-settings">检查系统设置</a>
                  </div>
                </div>
              `}
            </div>
          </section>
        </section>
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>最近生成请求</h2>
            <button type="button" data-jump="generation-requests">查看全部</button>
          </div>
          ${requestTable(state.generations.slice(0, 8))}
        </section>
      `;
    }
  };

  function statCard(label, value, hint, icon, tone = "blue", trend = "success", bars = [32, 48, 36, 60]) {
    return `
      <article class="admin-stat primitive-card primitive-card--stat" data-tone="${tone}">
        <i class="${icon}" aria-hidden="true"></i>
        <span>${label}</span>
        <strong>${value}</strong>
        <em class="primitive-card__trend" data-trend="${trend}">
          <i class="${trend === "danger" ? "ri-alarm-warning-line" : "ri-arrow-up-line"}" aria-hidden="true"></i>
          ${trend === "danger" ? "需关注" : "稳定"}
        </em>
        <div class="primitive-card__sparkline" data-sparkline-mount aria-hidden="true">
          ${bars.map((height) => `<span style="--spark:${height}%"></span>`).join("")}
        </div>
        <small>${hint}</small>
      </article>
    `;
  }
})();
