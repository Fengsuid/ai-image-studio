(function(){window.AdminModules=window.AdminModules||{},window.AdminModules.overview={render({state:r,helpers:o}){const{escapeHtml:t,fmtNumber:i,fmtDate:l,metrics:n,dashboardContext:c,requestTable:p}=o,d=n(),e=c(),v=[["generation-requests","ri-image-ai-line","生成请求","排查队列与耗时"],["users-credits","ri-user-settings-line","用户管理","账号、积分、状态"],["square-review","ri-gallery-view-2","广场审核","公开作品与举报处理"],["system-settings","ri-sliders-line","系统设置","注册、积分和开关"]],h=[["users-credits","ri-user-settings-line","用户管理","账号、积分、状态"],["square-review","ri-gallery-view-2","广场审核","公开作品与举报处理"],["tag-library","ri-price-tag-3-line","标签管理","标签、分类和合并"],["prompt-cms","ri-quill-pen-line","提示词来源","远程来源和同步记录"],["system-settings","ri-sliders-line","系统设置","注册、积分和开关"]];return`
        <section class="admin-overview-hero primitive-card primitive-card--hero">
          <div class="admin-overview-hero-copy">
            <p class="admin-kicker">运营控制台</p>
            <h2>${e.label}</h2>
            <p>${e.detail}</p>
            <div class="admin-overview-meta">
              <span class="admin-status-pill" data-tone="${e.tone}">${e.label}</span>
              <span>${l(e.rumSummary.updatedAt)} · RUM ${i(e.rumSummary.total||0)}</span>
            </div>
          </div>
          <div class="admin-overview-hero-panel">
            <div class="primitive-card__actions" aria-label="常用后台操作">
              ${v.map(([s,m,u])=>`
                <button type="button" class="btn btn--secondary" data-jump="${s}">
                  <i class="${m}" aria-hidden="true"></i>
                  <span>${u}</span>
                </button>
              `).join("")}
            </div>
            <div class="admin-overview-hero-row">
              <strong>${i(e.issues.length)} 个最近异常</strong>
              <span>${i(e.providerIssues.length)} 个供应商异常</span>
            </div>
            <div class="admin-overview-hero-row">
              <strong>${i(e.reportQueue)} 条举报队列</strong>
              <span>${i(e.brokenFiles.length)} 个文件异常</span>
            </div>
            <div class="admin-overview-hero-row">
              <strong>${i(e.syncFailures.length)} 个同步失败</strong>
              <span>${i(e.withdrawalQueue)} 条撤回待处理</span>
            </div>
          </div>
        </section>
        <section class="admin-stats-grid admin-dashboard-grid">
          ${a("用户",i(d.newUsers),`今日新增 / 总用户 ${i(r.users.length)}`,"ri-user-add-line","teal","success",[35,52,44,68])}
          ${a("生成量",i(d.todayGenerated),`今日生成 / 总请求 ${i(d.total)}`,"ri-image-ai-line","blue","success",[42,56,62,78])}
          ${a("公开作品",i(d.publicWorks),"当前公开广场内容","ri-gallery-view-2","violet","success",[28,36,55,49])}
          ${a("举报",i(e.reportQueue),"待处理举报队列","ri-alarm-warning-line","amber",e.reportQueue?"danger":"success",[18,31,24,34])}
          ${a("提示词同步",i(e.syncFailures.length),"异常同步任务","ri-sync-warning-line","rose",e.syncFailures.length?"danger":"success",[20,24,18,26])}
          ${a("文件异常",i(e.brokenFiles.length),"巡检命中异常文件","ri-folder-warning-line","slate",e.brokenFiles.length?"danger":"success",[16,21,17,22])}
        </section>
        <section class="admin-overview-split">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h2>快捷入口</h2>
              <span>常用运营路径</span>
            </div>
            <div class="admin-quick-links">
              ${h.map(([s,m,u,g])=>`
                <button type="button" class="admin-quick-link btn btn--secondary" data-jump="${s}">
                  <i class="${m}" aria-hidden="true"></i>
                  <strong>${u}</strong>
                  <span>${g}</span>
                </button>
              `).join("")}
            </div>
          </section>
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h2>最近异常</h2>
              <span>${i(e.issues.length)} 项</span>
            </div>
            <div class="admin-issue-list">
              ${e.issues.map(s=>`
                <article class="admin-issue" data-tone="${s.tone}">
                  <i class="${s.icon}" aria-hidden="true"></i>
                  <div>
                    <strong>${t(s.title)}</strong>
                    <p>${t(s.detail)}</p>
                    <small>${t(s.meta||"")}${s.time?` · ${l(s.time)}`:""}</small>
                  </div>
                  <button type="button" data-jump="${s.jump}">查看</button>
                </article>
              `).join("")||`
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
          ${p(r.generations.slice(0,8))}
        </section>
      `}};function a(r,o,t,i,l="blue",n="success",c=[32,48,36,60]){return`
      <article class="admin-stat primitive-card primitive-card--stat" data-tone="${l}">
        <i class="${i}" aria-hidden="true"></i>
        <span>${r}</span>
        <strong>${o}</strong>
        <em class="primitive-card__trend" data-trend="${n}">
          <i class="${n==="danger"?"ri-alarm-warning-line":"ri-arrow-up-line"}" aria-hidden="true"></i>
          ${n==="danger"?"需关注":"稳定"}
        </em>
        <div class="primitive-card__sparkline" data-sparkline-mount aria-hidden="true">
          ${c.map(p=>`<span style="--spark:${p}%"></span>`).join("")}
        </div>
        <small>${t}</small>
      </article>
    `}})();
