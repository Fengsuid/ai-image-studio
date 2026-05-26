(function(){window.AdminModules=window.AdminModules||{},window.AdminModules.overview={render({state:t,helpers:o}){const{escapeHtml:n,fmtNumber:e,fmtDate:l,metrics:d,dashboardContext:c,requestTable:m}=o,r=d(),s=c(),p=[["users-credits","ri-user-settings-line","用户管理","账号、积分、状态"],["square-review","ri-gallery-view-2","广场审核","公开作品与举报处理"],["tag-library","ri-price-tag-3-line","标签管理","标签、分类和合并"],["prompt-cms","ri-quill-pen-line","提示词来源","远程来源和同步记录"],["system-settings","ri-sliders-line","系统设置","注册、积分和开关"]];return`
        <section class="admin-overview-hero">
          <div class="admin-overview-hero-copy">
            <p class="admin-kicker">运营控制台</p>
            <h2>${s.label}</h2>
            <p>${s.detail}</p>
            <div class="admin-overview-meta">
              <span class="admin-status-pill" data-tone="${s.tone}">${s.label}</span>
              <span>${l(s.rumSummary.updatedAt)} · RUM ${e(s.rumSummary.total||0)}</span>
            </div>
          </div>
          <div class="admin-overview-hero-panel">
            <div class="admin-overview-hero-row">
              <strong>${e(s.issues.length)} 个最近异常</strong>
              <span>${e(s.providerIssues.length)} 个供应商异常</span>
            </div>
            <div class="admin-overview-hero-row">
              <strong>${e(s.reportQueue)} 条举报队列</strong>
              <span>${e(s.brokenFiles.length)} 个文件异常</span>
            </div>
            <div class="admin-overview-hero-row">
              <strong>${e(s.syncFailures.length)} 个同步失败</strong>
              <span>${e(s.withdrawalQueue)} 条撤回待处理</span>
            </div>
          </div>
        </section>
        <section class="admin-stats-grid admin-dashboard-grid">
          ${a("用户",e(r.newUsers),`今日新增 / 总用户 ${e(t.users.length)}`,"ri-user-add-line","teal")}
          ${a("生成量",e(r.todayGenerated),`今日生成 / 总请求 ${e(r.total)}`,"ri-image-ai-line","blue")}
          ${a("公开作品",e(r.publicWorks),"当前公开广场内容","ri-gallery-view-2","violet")}
          ${a("举报",e(s.reportQueue),"待处理举报队列","ri-alarm-warning-line","amber")}
          ${a("提示词同步",e(s.syncFailures.length),"异常同步任务","ri-sync-warning-line","rose")}
          ${a("文件异常",e(s.brokenFiles.length),"巡检命中异常文件","ri-folder-warning-line","slate")}
        </section>
        <section class="admin-overview-split">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h2>快捷入口</h2>
              <span>常用运营路径</span>
            </div>
            <div class="admin-quick-links">
              ${p.map(([i,v,u,$])=>`
                <button type="button" class="admin-quick-link" data-jump="${i}">
                  <i class="${v}"></i>
                  <strong>${u}</strong>
                  <span>${$}</span>
                </button>
              `).join("")}
            </div>
          </section>
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h2>最近异常</h2>
              <span>${e(s.issues.length)} 项</span>
            </div>
            <div class="admin-issue-list">
              ${s.issues.map(i=>`
                <article class="admin-issue" data-tone="${i.tone}">
                  <i class="${i.icon}"></i>
                  <div>
                    <strong>${n(i.title)}</strong>
                    <p>${n(i.detail)}</p>
                    <small>${n(i.meta||"")}${i.time?` · ${l(i.time)}`:""}</small>
                  </div>
                  <button type="button" data-jump="${i.jump}">查看</button>
                </article>
              `).join("")||'<div class="admin-empty-state">暂无异常</div>'}
            </div>
          </section>
        </section>
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>最近生成请求</h2>
            <button type="button" data-jump="generation-requests">查看全部</button>
          </div>
          ${m(t.generations.slice(0,8))}
        </section>
      `}};function a(t,o,n,e,l="blue"){return`
      <article class="admin-stat" data-tone="${l}">
        <i class="${e}"></i>
        <span>${t}</span>
        <strong>${o}</strong>
        <small>${n}</small>
      </article>
    `}})();
