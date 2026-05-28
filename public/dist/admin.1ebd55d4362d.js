const adminState={user:null,version:null,settings:null,users:[],generations:[],prompts:[],promptSources:[],promptSyncRuns:[],tags:[],promptCategories:[],publicImages:[],reports:[],promptDuplicates:[],promptAudits:[],providers:[],galleryLeaderboard:[],galleryLikeAnomalies:[],galleryFileChecks:[],defaultProviderId:"",announcements:[],rum:{summary:{},events:[]},withdrawals:[],creditLedger:[],rewardLedger:[],active:location.hash.replace("#","")||"overview",search:"",status:"all",page:1,pageSize:12,generationDiagnostics:{filters:{}},selectedUsers:new Set,audit:[],csrfToken:"",sidebarState:localStorage.getItem("admin.sidebar-state")||(localStorage.getItem("adminSidebarCollapsed")==="1"?"collapsed":""),sidebarDrawerOpen:!1},navItems=[["overview","ri-dashboard-line","总览"],["providers","ri-plug-line","API 供应商"],["generation-requests","ri-image-ai-line","生成请求"],["square-review","ri-gallery-view-2","广场审核"],["gallery-files","ri-folder-warning-line","文件巡检"],["users-credits","ri-user-settings-line","用户与积分"],["prompt-cms","ri-quill-pen-line","提示词 CMS"],["prompt-audit","ri-shield-check-line","Prompt Audit"],["tag-library","ri-price-tag-3-line","标签库"],["reports-withdrawals","ri-alarm-warning-line","举报与撤回"],["growth","ri-line-chart-line","增长配置"],["announcements","ri-notification-3-line","通知公告"],["system-settings","ri-sliders-line","系统设置"],["rum-performance","ri-speed-up-line","RUM/性能"],["audit-log","ri-file-list-3-line","审计日志"]],pageDescriptions={overview:"系统健康、关键指标和最近异常。",providers:"多 API 地址、模型能力、健康检查和路由策略入口。","generation-requests":"生成任务状态、耗时、错误和请求详情。","square-review":"公开作品、举报下架和恢复到画廊。","gallery-files":"公开画廊文件缺失、文件大小和最近巡检结果。","users-credits":"用户状态、角色、积分和首发奖励流水。","prompt-cms":"提示词内容、重复候选、互动数据和人工处理。","prompt-audit":"AI 提示词重复审计、人工复核和发布门禁入口。","tag-library":"标签目录、中文展示、合并迁移和筛选展示。","reports-withdrawals":"举报、撤回申请、处理原因和审核日志。",growth:"推荐位、榜单、活动和运营增长配置。",announcements:"站内通知、登录弹窗、未读确认和公告预览。","system-settings":"注册、积分、安全和非 API Provider 类系统设置。","rum-performance":"Web Vitals、图片失败率、运行时和性能事件。","audit-log":"后台敏感操作、人工巡检和审计记录。"},$=(e,t=document)=>t.querySelector(e),isAdminMobile=()=>window.matchMedia?.("(max-width:760px)")?.matches,defaultSidebarState=()=>isAdminMobile()?"drawer":window.matchMedia?.("(max-width:1440px)")?.matches?"collapsed":"expanded",normalizeSidebarState=e=>["expanded","collapsed","drawer"].includes(e)?e:defaultSidebarState();function applySidebarState(){const e=normalizeSidebarState(adminState.sidebarState),t=isAdminMobile()||e==="drawer",a=t&&adminState.sidebarDrawerOpen;adminState.sidebarState=t?"drawer":e,[["admin-sidebar-expanded",!t&&e==="expanded"],["admin-sidebar-collapsed",!t&&e==="collapsed"],["admin-sidebar-drawer",t],["admin-sidebar-drawer-open",a]].forEach(([i,r])=>document.body.classList.toggle(i,r)),$("#adminApp")?.setAttribute("data-sidebar-state",t?"drawer":e),$(".admin-sidebar")?.setAttribute("aria-hidden",String(t&&!a));const n=!a;$("#adminSidebarBackdrop")?.classList.toggle("hidden",n),$("#adminSidebarBackdrop")?.setAttribute("aria-hidden",String(n)),$("#adminSidebarToggle")?.setAttribute("aria-expanded",String(t?a:e==="expanded"))}function setSidebarState(e,t=!0){adminState.sidebarState=normalizeSidebarState(e),t&&adminState.sidebarState!=="drawer"&&localStorage.setItem("admin.sidebar-state",adminState.sidebarState),applySidebarState()}function escapeHtml(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function imageVariantUrl(e,t="thumb"){if(!e||/^(data:|blob:)/i.test(e))return e||"";const a=e.includes("?")?"&":"?";return`${e}${a}variant=${encodeURIComponent(t)}`}async function api(e,t={}){const a=String(t.method||"GET").toUpperCase(),n={"Content-Type":"application/json",...t.headers||{}};["GET","HEAD","OPTIONS"].includes(a)||(n["X-CSRF-Token"]=adminState.csrfToken||readCookie("csrf"));const i=await fetch(e,{...t,credentials:"same-origin",headers:n}),r=await i.text(),d=r?JSON.parse(r):null;if(d?.csrfToken&&(adminState.csrfToken=d.csrfToken),!i.ok){const l=new Error(d?.error||d?.message||`HTTP ${i.status}`);throw l.status=i.status,l}return d}function readCookie(e){const t=document.cookie.split(";").map(a=>a.trim()).filter(Boolean).map(a=>a.split("=")).find(([a])=>decodeURIComponent(a)===e);return t?decodeURIComponent(t.slice(1).join("=")):""}function fmtNumber(e){return new Intl.NumberFormat("zh-CN").format(Number(e||0))}function fmtDate(e){if(!e)return"-";const t=new Date(e);return Number.isNaN(t.getTime())?"-":new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(t)}function datetimeLocal(e){if(!e)return"";const t=new Date(e);if(Number.isNaN(t.getTime()))return"";const a=n=>String(n).padStart(2,"0");return`${t.getFullYear()}-${a(t.getMonth()+1)}-${a(t.getDate())}T${a(t.getHours())}:${a(t.getMinutes())}`}function fmtDuration(e){const t=Number(e||0);return t?t<1e3?`${Math.round(t)}ms`:`${(t/1e3).toFixed(t<1e4?1:0)}s`:"-"}function todayItems(e,t="createdAt"){const a=new Date;return a.setHours(0,0,0,0),e.filter(n=>new Date(n[t]||0)>=a)}function recordAudit(e,t,a=""){adminState.audit.unshift({id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,action:e,target:t,detail:a,actor:adminState.user?.email||"admin",createdAt:new Date().toISOString()}),adminState.audit=adminState.audit.slice(0,80)}function generationDiagnosticsModule(){return window.AdminModules?.generationDiagnostics||null}function generationDiagnosticsQuery(){const e=adminState.generationDiagnostics?.filters||{},t=new URLSearchParams({limit:"500"});for(const[a,n]of Object.entries(e)){const i=String(n||"").trim();i&&t.set(a,i)}return`/api/admin/generations?${t.toString()}`}function generationDiagnosticsHelpers(){return{fmtNumber,fmtDate,fmtDuration,imageVariantUrl,paged,pagination}}function adminModuleContext(){return{state:adminState,helpers:{escapeHtml,fmtNumber,fmtDate,fmtDuration,imageVariantUrl,metrics,dashboardContext,requestTable,toolbar,filtered,paged,pagination,emptyState,renderPlaceholder}}}function renderAdminModule(e){return window.AdminModules?.[e]?.render?.(adminModuleContext())||""}function currentNav(){return navItems.find(([e])=>e===adminState.active)||navItems[0]}function renderNav(){applySidebarState(),$("#adminNav").innerHTML=navItems.map(([e,t,a])=>`
    <button class="btn btn--ghost ${e===adminState.active?"active":""}" type="button" data-section="${e}" data-label="${escapeHtml(a)}" title="${escapeHtml(a)}" aria-label="${escapeHtml(a)}">
      <i class="${t}"></i><span>${a}</span>
    </button>
  `).join(""),$("#adminNav").querySelectorAll("button").forEach(e=>{e.addEventListener("click",()=>{adminState.active=e.dataset.section,adminState.page=1,location.hash=adminState.active,adminState.sidebarDrawerOpen=!1,render()})})}function setStatus(e,t="neutral"){const a=$("#adminStatus");a.textContent=e,a.dataset.tone=t}function confirmAction({title:e="确认操作",message:t="该操作会立即生效。",confirmText:a="确认",danger:n=!1}={}){const i=$("#adminConfirmLayer");return i?new Promise(r=>{i.classList.remove("hidden"),i.setAttribute("aria-hidden","false"),i.innerHTML=`
      <div class="admin-confirm-card" role="dialog" aria-modal="true" aria-labelledby="adminConfirmTitle">
        <div class="admin-confirm-icon" data-danger="${n?"true":"false"}"><i class="${n?"ri-error-warning-line":"ri-question-line"}" aria-hidden="true"></i></div>
        <h2 id="adminConfirmTitle">${escapeHtml(e)}</h2>
        <p>${escapeHtml(t)}</p>
        <div class="admin-confirm-actions">
          <button type="button" data-confirm-cancel>取消</button>
          <button type="button" data-confirm-ok class="${n?"danger":""}">${escapeHtml(a)}</button>
        </div>
      </div>
    `;const d=s=>{i.classList.add("hidden"),i.setAttribute("aria-hidden","true"),i.innerHTML="",window.removeEventListener("keydown",l),r(s)},l=s=>{s.key==="Escape"&&d(!1),s.key==="Enter"&&(s.ctrlKey||s.metaKey)&&d(!0)};$("[data-confirm-cancel]",i).addEventListener("click",()=>d(!1)),$("[data-confirm-ok]",i).addEventListener("click",()=>d(!0)),window.addEventListener("keydown",l),i.addEventListener("click",function s(c){c.target===i&&(i.removeEventListener("click",s),d(!1))}),$("[data-confirm-cancel]",i)?.focus?.({preventScroll:!0})}):Promise.resolve(window.confirm(t))}async function loadAll(){setStatus("同步中");const e=await api("/api/auth/me");if(adminState.user=e.user,!adminState.user||adminState.user.role!=="admin"){setStatus("需要管理员","danger"),$("#adminContent").innerHTML=`
      <section class="admin-auth-required">
        <i class="ri-shield-user-line"></i>
        <h2>需要管理员权限</h2>
        <p>请在前台登录管理员账号后再进入 /admin。</p>
        <a href="/" class="admin-primary-link">返回前台登录</a>
      </section>
    `;return}const[t,a,n,i,r,d,l,s,c,u,p,b,g,h,v,o,m,y,w,f,S,A]=await Promise.all([api("/api/version"),api("/api/admin/settings"),api("/api/admin/users"),api(generationDiagnosticsQuery()),api("/api/prompts?includeHidden=1&includeNoImage=1&limit=2000"),api("/api/admin/prompt-sources?runsLimit=120"),api("/api/tags?includeHidden=1&limit=2000"),api("/api/prompt-categories?includeHidden=1"),api("/api/admin/public-images?status=queue&limit=120"),api("/api/admin/gallery-file-checks?status=broken&limit=120"),api("/api/admin/credit-ledger?limit=120"),api("/api/admin/reward-ledger?limit=120"),api("/api/admin/audit-logs?limit=120"),api("/api/admin/withdrawals?limit=120"),api("/api/admin/reports?status=queue&limit=120"),api("/api/admin/prompt-duplicates?limit=120"),api("/api/admin/prompt-audits?limit=160"),api("/api/admin/rum"),api("/api/admin/providers"),api("/api/gallery/leaderboard?range=week&limit=20"),api("/api/admin/gallery-like-anomalies?limit=80"),api("/api/admin/announcements?limit=200")]);adminState.version=t,adminState.settings=a,adminState.users=n.users||[],adminState.generations=i.records||[],adminState.prompts=r.prompts||[],adminState.promptSources=d.sources||[],adminState.promptSyncRuns=d.runs||[],adminState.tags=l.tags||[],adminState.promptCategories=s.categories||l.categories||[],adminState.tagSummary=l.summary||null,adminState.publicImages=c.generations||[],adminState.galleryFileChecks=u.checks||[],adminState.creditLedger=p.ledger||[],adminState.rewardLedger=b.rewards||[],adminState.audit=g.logs||adminState.audit,adminState.withdrawals=h.requests||[],adminState.reports=v.reports||[],adminState.promptDuplicates=o.candidates||[],adminState.promptAudits=m.audits||[],adminState.rum=y||{summary:{},events:[]},adminState.providers=w.providers||[],adminState.galleryLeaderboard=f.generations||[],adminState.galleryLikeAnomalies=S.anomalies||[],adminState.announcements=A.announcements||[],adminState.defaultProviderId=w.defaultProviderId||a.defaultProviderId||"",setStatus(`${adminState.user.name||adminState.user.email} · ${t.version}`,"ok")}function metrics(){const e=todayItems(adminState.generations),t=adminState.generations.length,a=adminState.generations.filter(d=>d.status==="success"||d.status==="succeeded").length,n=adminState.generations.filter(d=>d.status==="failed").length,i=adminState.generations.filter(d=>Number(d.durationMs)>0),r=i.reduce((d,l)=>d+Number(l.durationMs),0)/Math.max(1,i.length);return{todayGenerated:e.length,successRate:t?Math.round(a/t*100):0,failedRate:t?Math.round(n/t*100):0,avgDuration:r,newUsers:todayItems(adminState.users).length,publicWorks:adminState.publicImages.length,pendingReview:adminState.publicImages.filter(d=>d.isPublic).length,total:t}}function dashboardContext(){const e=adminState.galleryFileChecks.filter(o=>o.status==="broken"),t=(adminState.promptSyncRuns||[]).filter(o=>{const m=String(o.status||"").toLowerCase();return["failed","error","warning"].includes(m)}),a=(adminState.providers||[]).filter(o=>String(o.healthStatus||"").toLowerCase()==="error"),n=adminState.reports.length,i=adminState.withdrawals.filter(o=>String(o.withdrawalStatus||"")==="requested").length,r=adminState.rum?.summary||{},d=[],l=o=>d.push(o),s=[...adminState.reports].sort((o,m)=>new Date(m.createdAt||0)-new Date(o.createdAt||0))[0],c=[...e].sort((o,m)=>new Date(m.checkedAt||0)-new Date(o.checkedAt||0))[0],u=[...t].sort((o,m)=>new Date(m.startedAt||0)-new Date(o.startedAt||0))[0];c&&l({tone:"danger",icon:"ri-folder-warning-line",title:"文件异常",detail:`${c.generationId||"-"} · ${c.filename||c.relativePath||"未知文件"}`,meta:c.errorMessage||c.status||"broken",time:c.checkedAt,jump:"gallery-files"}),u&&l({tone:"warn",icon:"ri-sync-warning-line",title:"提示词同步失败",detail:`${u.sourceName||u.sourceId||"-"} · ${u.errorLog||u.message||u.status||"failed"}`,meta:`${fmtNumber(u.successCount||0)} 成功 / ${fmtNumber(u.failureCount||0)} 失败`,time:u.startedAt,jump:"prompt-cms"}),a.slice(0,2).forEach(o=>{l({tone:"danger",icon:"ri-plug-line",title:"供应商健康异常",detail:`${o.name||o.id||"-"} · ${o.lastError||o.healthStatus||"error"}`,meta:o.baseUrl||o.providerType||"",time:o.updatedAt||o.createdAt,jump:"providers"})}),n>0&&l({tone:"warn",icon:"ri-alarm-warning-line",title:"举报待处理",detail:`${fmtNumber(n)} 条公开作品举报正在队列中`,meta:s?`${s.id||"-"} · ${s.userName||s.userEmail||"匿名"}`:"等待人工审核",time:s?.createdAt||null,jump:"square-review"}),i>0&&l({tone:"warn",icon:"ri-inbox-unarchive-line",title:"撤回申请待处理",detail:`${fmtNumber(i)} 条公开撤回申请未处理`,meta:"需要在举报与撤回页处理",time:adminState.withdrawals.find(o=>String(o.withdrawalStatus||"")==="requested")?.withdrawalRequestedAt||null,jump:"reports-withdrawals"}),Number(r.imageFailures||0)>0&&l({tone:"warn",icon:"ri-image-warning-line",title:"图片失败事件",detail:`${fmtNumber(r.imageFailures)} 次图片加载或生成失败`,meta:`RUM 事件 ${fmtNumber(r.total||0)}`,time:r.updatedAt||null,jump:"rum-performance"});const p=e.length+t.length+a.length,b=n+i+Number(r.imageFailures||0),g=p>0?"danger":b>0?"warn":"ok",h=p>0?"需要关注":b>0?"有待处理项":"运行正常",v=p>0?`${fmtNumber(e.length)} 个文件异常 · ${fmtNumber(t.length)} 个同步失败 · ${fmtNumber(a.length)} 个供应商异常`:b>0?`${fmtNumber(n)} 条举报 · ${fmtNumber(i)} 条撤回 · ${fmtNumber(r.imageFailures||0)} 次图片失败`:"当前没有明显阻断项";return{tone:g,label:h,detail:v,reportQueue:n,brokenFiles:e,syncFailures:t,providerIssues:a,withdrawalQueue:i,rumSummary:r,issues:d.slice(0,6)}}function statCard(e,t,a,n,i="blue"){return`
    <article class="admin-stat" data-tone="${i}">
      <i class="${n}"></i>
      <span>${e}</span>
      <strong>${t}</strong>
      <small>${a}</small>
    </article>
  `}function toolbar(e,t=[]){return`
    <div class="admin-toolbar admin-toolbar-polished" role="search">
      <div class="admin-toolbar-meta">
        <strong>快速筛选</strong>
        <span>实时过滤当前模块的数据，不会改变服务端记录。</span>
      </div>
      <label><i class="ri-search-line" aria-hidden="true"></i><input id="adminSearchInput" value="${escapeHtml(adminState.search)}" placeholder="${e}"></label>
      <select id="adminStatusFilter">
        <option value="all"${adminState.status==="all"?" selected":""}>全部状态</option>
        ${t.map(a=>`<option value="${a}"${adminState.status===a?" selected":""}>${a}</option>`).join("")}
      </select>
    </div>
  `}function bindToolbar(){$("#adminSearchInput")?.addEventListener("input",e=>{adminState.search=e.target.value,adminState.page=1,render()}),$("#adminStatusFilter")?.addEventListener("change",e=>{adminState.status=e.target.value,adminState.page=1,render()})}function filtered(e,t){const a=adminState.search.trim().toLowerCase();return e.filter(n=>adminState.status==="all"||n.status===adminState.status||n.moderationStatus===adminState.status||n.withdrawalStatus===adminState.status||String(n.role||"")===adminState.status?a?t.some(r=>String(n[r]||"").toLowerCase().includes(a)):!0:!1)}function paged(e){const t=(adminState.page-1)*adminState.pageSize;return e.slice(t,t+adminState.pageSize)}function pagination(e){const t=Math.max(1,Math.ceil(e/adminState.pageSize));return`
    <div class="admin-pagination">
      <button type="button" data-page="${Math.max(1,adminState.page-1)}"${adminState.page===1?" disabled":""}>上一页</button>
      <span>${adminState.page} / ${t}</span>
      <button type="button" data-page="${Math.min(t,adminState.page+1)}"${adminState.page>=t?" disabled":""}>下一页</button>
    </div>
  `}function emptyState(e,t,a="ri-inbox-archive-line",n="neutral"){return`
    <div class="admin-empty-state admin-empty-state-polished primitive-table__empty" data-tone="${escapeHtml(n)}">
      <i class="${escapeHtml(a)}" aria-hidden="true"></i>
      <h3>${escapeHtml(e)}</h3>
      <p>${escapeHtml(t)}</p>
    </div>
  `}function bindPagination(){document.querySelectorAll("[data-page]").forEach(e=>{e.addEventListener("click",()=>{adminState.page=Number(e.dataset.page||1),render()})})}function requestTable(e){return e.length?`
    <div class="admin-table-wrap primitive-table-wrap">
      <table class="admin-table primitive-table admin-table-polished" data-density="compact">
        <thead><tr><th>状态</th><th>用户</th><th>提示词</th><th>耗时</th><th>时间</th><th></th></tr></thead>
        <tbody>
          ${e.map(t=>`
            <tr>
              <td><span class="admin-badge" data-status="${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
              <td>${escapeHtml(t.userName||t.userEmail||t.userId||"-")}</td>
              <td class="admin-truncate">${escapeHtml(t.prompt||t.errorMessage||"-")}</td>
              <td>${fmtDuration(t.durationMs)}</td>
              <td>${fmtDate(t.createdAt)}</td>
              <td><button type="button" data-detail="request:${escapeHtml(t.id)}">详情</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `:emptyState("暂无生成请求","当前筛选条件下没有生成任务，可调整状态或关键词后重试。","ri-image-ai-line")}function renderRequests(){const e=generationDiagnosticsModule();if(e?.render)return e.render({state:adminState,helpers:generationDiagnosticsHelpers()});const t=filtered(adminState.generations,["prompt","userName","userEmail","status"]);return`${toolbar("搜索用户、提示词或错误",["pending","running","success","failed","cancelled"])}
    <section class="admin-panel">${requestTable(paged(t))}${pagination(t.length)}</section>`}function renderPrompts(){const e=filtered(adminState.prompts,["title","prompt","author","status","category","sourceRepo","sourceCategory"]);return`${toolbar("搜索标题、提示词、作者",["active","hidden"])}
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>远程来源</h2><button type="button" data-create-prompt-source>新建来源</button></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>来源</th><th>仓库</th><th>状态</th><th>最近同步</th><th>结果</th><th></th></tr></thead>
          <tbody>
            ${(adminState.promptSources||[]).map(t=>`
              <tr>
                <td><strong>${escapeHtml(t.name||t.id)}</strong><small>${escapeHtml(t.sourceType||"")} · ${escapeHtml(t.parser||"parser 待配置")}</small></td>
                <td>${escapeHtml(t.repoUrl||"-")}<small>${escapeHtml(t.branch||"main")}</small></td>
                <td><span class="admin-badge" data-status="${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
                <td>${fmtDate(t.lastSyncedAt)}<small>${escapeHtml(t.lastStatus||"never")}</small></td>
                <td>${fmtNumber(t.lastSuccessCount)} 成功 / ${fmtNumber(t.lastFailureCount)} 失败<small>${escapeHtml(t.lastError||"")}</small></td>
                <td><button type="button" data-detail="promptSource:${escapeHtml(t.id)}">编辑</button><button type="button" data-prompt-source-sync="${escapeHtml(t.id)}">同步</button></td>
              </tr>
            `).join("")||'<tr><td colspan="6">暂无远程来源</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="admin-mini-table">
        ${(adminState.promptSyncRuns||[]).slice(0,6).map(t=>`
          <div><strong>${escapeHtml(t.sourceName||t.sourceId)}</strong><span>${escapeHtml(t.status)} · 成功 ${fmtNumber(t.successCount)} / 失败 ${fmtNumber(t.failureCount)} / 跳过 ${fmtNumber(t.skippedCount)}</span><small>${fmtDate(t.startedAt)} · ${escapeHtml(t.errorLog||"")}</small></div>
        `).join("")||"<p>暂无同步记录</p>"}
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head">
        <h2>重复候选</h2>
        <button type="button" data-scan-prompt-duplicates>扫描候选</button>
        <span>${fmtNumber(adminState.promptDuplicates.length)} 组需人工确认</span>
      </div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>提示词 A</th><th>提示词 B</th><th>召回</th><th>处理</th></tr></thead>
          <tbody>
            ${adminState.promptDuplicates.map(t=>`
              <tr>
                <td><strong>${escapeHtml(t.prompt?.title||`#${t.promptId}`)}</strong><small class="admin-truncate">${escapeHtml(t.prompt?.prompt||"")}</small></td>
                <td><strong>${escapeHtml(t.duplicate?.title||`#${t.duplicatePromptId}`)}</strong><small class="admin-truncate">${escapeHtml(t.duplicate?.prompt||"")}</small></td>
                <td>${escapeHtml(t.method||"")}<small>score ${Number(t.score||0).toFixed(4)} · ${escapeHtml(t.embeddingRecall||"")} · AI ${escapeHtml(t.aiReview?.decision||t.llmReview||"not_reviewed")} ${Number(t.aiReview?.confidence||0).toFixed(2)}</small><small>${escapeHtml(t.aiReview?.reason||"")}</small></td>
                <td>
                  <button type="button" data-detail="prompt:${t.promptId}">编辑 A</button>
                  <button type="button" data-detail="prompt:${t.duplicatePromptId}">编辑 B</button>
                  <button type="button" data-duplicate-ai-review="${t.id}">AI 复核</button>
                  <button type="button" data-duplicate-action="keep:${t.id}">保留</button>
                  <button type="button" data-duplicate-action="confirm:${t.id}">确认重复</button>
                  <button type="button" data-duplicate-action="hide_duplicate:${t.id}">隐藏 B</button>
                </td>
              </tr>
            `).join("")||'<tr><td colspan="4">暂无重复候选</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>提示词 CMS</h2><button type="button" data-create-prompt>新建提示词</button></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>标题</th><th>分类/标签</th><th>来源</th><th>状态</th><th>互动</th><th>排序</th><th></th></tr></thead>
          <tbody>
            ${paged(e).map(t=>`
              <tr>
                <td><strong>${escapeHtml(t.title||`#${t.id}`)}</strong><small class="admin-truncate">${escapeHtml(t.prompt||"")}</small></td>
                <td><strong>${escapeHtml(t.category||"general")}</strong><small>${escapeHtml((t.tags||[]).join(", "))}</small></td>
                <td>${escapeHtml(t.sourceRepo||t.source||"-")}<small>${escapeHtml(t.remoteId||t.sourceCategory||t.author||"")}</small></td>
                <td><span class="admin-badge" data-status="${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
                <td>Like ${fmtNumber(t.likeCount)} / Use ${fmtNumber(t.useCount)} / Heat ${fmtNumber(t.heatScore)}</td>
                <td>${fmtNumber(t.sortOrder)}</td>
                <td><button type="button" data-detail="prompt:${t.id}">编辑</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>${pagination(e.length)}
    </section>`}function renderTags(){const e=filtered(adminState.tags,["slug","labelZh","labelEn","category","status"]),t=[...adminState.promptCategories||[]].sort((a,n)=>Number(a.sortOrder||0)-Number(n.sortOrder||0)||String(a.slug).localeCompare(String(n.slug)));return`${toolbar("搜索 slug、中文名、分类",["active","hidden"])}
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>提示词分类</h2><button type="button" data-create-category>新建分类</button></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>Slug</th><th>中文/英文</th><th>说明</th><th>状态</th><th>排序</th><th></th></tr></thead>
          <tbody>
            ${t.map(a=>`
              <tr>
                <td><strong>${escapeHtml(a.slug)}</strong></td>
                <td>${escapeHtml(a.labelZh||"")}<small>${escapeHtml(a.labelEn||"")}</small></td>
                <td><small>${escapeHtml(a.descriptionZh||a.descriptionEn||"-")}</small></td>
                <td><span class="admin-badge" data-status="${escapeHtml(a.status)}">${escapeHtml(a.status)}</span></td>
                <td>${fmtNumber(a.sortOrder||0)}</td>
                <td><button type="button" data-detail="category:${escapeHtml(a.slug)}">编辑</button></td>
              </tr>
            `).join("")||'<tr><td colspan="6">暂无分类</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>标签库</h2><button type="button" data-create-tag>新建标签</button></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>Slug</th><th>中文/英文</th><th>分类</th><th>状态</th><th>覆盖</th><th></th></tr></thead>
          <tbody>
            ${paged(e).map(a=>`
              <tr>
                <td><strong>${escapeHtml(a.slug)}</strong><small>${escapeHtml(a.source||"")}</small></td>
                <td>${escapeHtml(a.labelZh||"")}<small>${escapeHtml(a.labelEn||"")}</small></td>
                <td>${escapeHtml(a.category||"-")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(a.status)}">${escapeHtml(a.status)}</span></td>
                <td>${fmtNumber(Number(a.promptCount||0)+Number(a.galleryCount||0))}</td>
                <td><button type="button" data-detail="tag:${escapeHtml(a.slug)}">编辑</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>${pagination(e.length)}
    </section>`}function renderSettings(){return renderAdminModule("settings")}function renderPlaceholder(e,t,a){return`
    <section class="admin-panel admin-placeholder">
      <i class="${t}"></i>
      <h2>${e}</h2>
      <p>该模块已进入独立后台信息架构，当前版本先保留稳定入口和上下文。后续任务会接入完整数据表、审核流和审计落库。</p>
      <ul>${a.map(n=>`<li>${escapeHtml(n)}</li>`).join("")}</ul>
    </section>`}function renderGrowthPlaceholder(){const e=adminState.settings?.growthConfig||adminState.settings?.growth||{},t=adminState.galleryLeaderboard||[],a=adminState.galleryLikeAnomalies||[];return`
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>增长配置</h2><span>Growth JSON 只读摘要</span></div>
      <pre class="admin-code-block">${escapeHtml(JSON.stringify(e,null,2))}</pre>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>画廊点赞排行榜</h2><span>${fmtNumber(t.length)} 条热门作品</span></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>作品</th><th>作者</th><th>点赞</th><th>标签</th><th>时间</th><th></th></tr></thead>
          <tbody>
            ${t.map((n,i)=>`
              <tr>
                <td><strong>#${i+1} ${escapeHtml(n.id)}</strong><small class="admin-truncate">${escapeHtml(n.prompt||"")}</small></td>
                <td>${escapeHtml(n.userName||n.userEmail||n.userId||"-")}</td>
                <td><strong>${fmtNumber(n.likeCount||0)}</strong><small>${n.likedByCurrentUser?"liked by admin":""}</small></td>
                <td class="admin-truncate">${escapeHtml((n.publicTags||[]).join(", "))}</td>
                <td>${fmtDate(n.createdAt)}</td>
                <td><button type="button" data-detail="work:${escapeHtml(n.id)}">详情</button></td>
              </tr>
            `).join("")||'<tr><td colspan="6">暂无点赞榜数据</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>异常点赞检查</h2><span>${fmtNumber(a.length)} 个 24h 高频账号</span></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>用户</th><th>24h 点赞</th><th>首次</th><th>最近</th></tr></thead>
          <tbody>
            ${a.map(n=>`
              <tr>
                <td><strong>${escapeHtml(n.userName||n.userEmail||n.userId||"-")}</strong><small>${escapeHtml(n.userId||"")}</small></td>
                <td>${fmtNumber(n.likeCount||0)}</td>
                <td>${fmtDate(n.firstLikeAt)}</td>
                <td>${fmtDate(n.lastLikeAt)}</td>
              </tr>
            `).join("")||'<tr><td colspan="4">暂无异常点赞记录</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    ${renderPlaceholder("运营增长工作台预留","ri-line-chart-line",["推荐位、榜单、活动和奖励配置保持独立入口。","图片点赞排行榜、异常点赞检查已接入，后续继续扩展运营位管理。","增长配置不再混在 Settings 长表单里。"])}`}function renderAnnouncements(){const e=filtered(adminState.announcements,["title","body","level","displayMode","audience","status"]);return`
    ${toolbar("搜索标题、正文、等级或状态",["draft","published","archived"])}
    <section class="admin-panel">
      <div class="admin-panel-head">
        <h2>通知公告</h2>
        <button type="button" data-create-announcement><i class="ri-add-line"></i> 新建通知</button>
      </div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>标题</th><th>等级</th><th>展示</th><th>目标</th><th>状态</th><th>统计</th><th>时间</th><th></th></tr></thead>
          <tbody>
            ${paged(e).map(t=>`
              <tr>
                <td><strong>${escapeHtml(t.title)}</strong><small class="admin-truncate">${escapeHtml(t.body)}</small></td>
                <td>${escapeHtml(t.level||t.severity||"info")}${t.isImportant?"<small>重要</small>":""}</td>
                <td>${escapeHtml(t.displayMode||t.displayType||"feed")}</td>
                <td>${escapeHtml(t.audience||t.targetAudience||"all")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(t.status)}">${escapeHtml(t.status)}</span>${t.requiresAck?"<small>需确认</small>":""}</td>
                <td>读 ${fmtNumber(t.readCount||0)} / 确认 ${fmtNumber(t.ackCount||0)}</td>
                <td><small>${fmtDate(t.publishedAt||t.createdAt)}</small></td>
                <td>
                  <button type="button" data-detail="announcement:${escapeHtml(t.id)}">编辑</button>
                  ${t.status==="published"?`<button type="button" data-announcement-action="withdraw:${escapeHtml(t.id)}">撤回</button>`:`<button type="button" data-announcement-action="publish:${escapeHtml(t.id)}">发布</button>`}
                  <button type="button" data-announcement-action="archive:${escapeHtml(t.id)}">归档</button>
                </td>
              </tr>
            `).join("")||'<tr><td colspan="8">暂无通知公告</td></tr>'}
          </tbody>
        </table>
      </div>${pagination(e.length)}
    </section>`}function renderPromptAudit(){const e=filtered(adminState.promptAudits,["prompt","userName","userEmail","status","resultLevel","resultAction","matchedPromptTitle"]);return`
    ${toolbar("搜索提示词、用户、状态或匹配项",["blocked","review","allowed","override_allowed","reviewed"])}
    <section class="admin-panel">
      <div class="admin-panel-head">
        <h2>Prompt Audit</h2>
        <span>${fmtNumber(e.length)} 条审计记录</span>
      </div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>提示词</th><th>重复等级</th><th>建议动作</th><th>匹配项</th><th>人工复核</th><th>时间</th></tr></thead>
          <tbody>
            ${paged(e).map(t=>`
              <tr>
                <td>
                  <strong>${escapeHtml(t.userName||t.userEmail||t.generationId||`#${t.id}`)}</strong>
                  <small class="admin-truncate">${escapeHtml(t.prompt||"")}</small>
                </td>
                <td><span class="admin-badge" data-status="${escapeHtml(t.resultLevel)}">${escapeHtml(t.resultLevel)}</span><small>${escapeHtml(t.method||"none")} · score ${Number(t.score||0).toFixed(4)}</small></td>
                <td><strong>${escapeHtml(t.resultAction||"allow")}</strong><small>${escapeHtml(t.requiredMode?`required: ${t.requiredMode}`:t.requestedMode||"")}</small></td>
                <td>
                  <strong>${escapeHtml(t.matchedPromptTitle||t.matchedGenerationId||"-")}</strong>
                  <small class="admin-truncate">${escapeHtml(t.matchedPromptText||t.matchedGenerationPrompt||"")}</small>
                </td>
                <td>
                  <span class="admin-badge" data-status="${escapeHtml(t.status)}">${escapeHtml(t.status)}</span>
                  <small>${escapeHtml(t.overrideAction||t.overrideNote||"")}</small>
                  <div class="admin-card-actions">
                    <button type="button" data-detail="promptAudit:${escapeHtml(t.id)}">详情</button>
                    <button type="button" data-prompt-audit-action="allow_text_to_image:${escapeHtml(t.id)}">允许文生图</button>
                    <button type="button" data-prompt-audit-action="require_image_to_image:${escapeHtml(t.id)}">要求图生图</button>
                    <button type="button" data-prompt-audit-action="mark_reviewed:${escapeHtml(t.id)}">标记已复核</button>
                  </div>
                </td>
                <td>${fmtDate(t.createdAt)}</td>
              </tr>
            `).join("")||'<tr><td colspan="6">暂无 Prompt Audit 记录</td></tr>'}
          </tbody>
        </table>
      </div>
      ${pagination(e.length)}
    </section>`}function renderRum(){const e=metrics(),t=adminState.rum?.summary||{};return`
    <section class="admin-stats-grid compact">
      ${statCard("平均生成耗时",fmtDuration(e.avgDuration),"generation_requests.durationMs","ri-timer-flash-line")}
      ${statCard("LCP",t.lcp?`${fmtNumber(t.lcp)} ms`:"-","web-vitals","ri-speed-up-line")}
      ${statCard("INP",t.inp?`${fmtNumber(t.inp)} ms`:"-","web-vitals","ri-cursor-line")}
      ${statCard("CLS",t.cls??"-","web-vitals","ri-layout-masonry-line")}
      ${statCard("图片失败",fmtNumber(t.imageFailures||0),"RUM image_error","ri-image-close-line")}
      ${statCard("后端运行",fmtDuration((adminState.version?.uptimeSeconds||0)*1e3),"process uptime","ri-server-line")}
      ${statCard("Node",escapeHtml(adminState.version?.node||"-"),escapeHtml(adminState.version?.platform||""),"ri-code-box-line")}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>RUM 事件</h2><span>${fmtNumber(t.total||0)} 条近期事件</span></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>指标</th><th>值</th><th>路径</th><th>时间</th></tr></thead>
          <tbody>${(adminState.rum?.events||[]).map(a=>`
            <tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.value)}</td><td>${escapeHtml(a.path||"-")}</td><td>${fmtDate(a.createdAt)}</td></tr>
          `).join("")||'<tr><td colspan="4">暂无 RUM 事件</td></tr>'}</tbody>
        </table>
      </div>
    </section>`}function renderWithdrawals(){return`
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>举报队列</h2><span>${fmtNumber(adminState.reports.length)} 条记录</span></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>作品</th><th>用户</th><th>状态</th><th>举报</th><th>原因</th><th></th></tr></thead>
          <tbody>
            ${adminState.reports.map(e=>`
              <tr>
                <td><strong>${escapeHtml(e.id)}</strong><small class="admin-truncate">${escapeHtml(e.prompt||"")}</small></td>
                <td>${escapeHtml(e.userName||e.userEmail||e.userId||"-")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(e.moderationStatus||"visible")}">${escapeHtml(e.moderationStatus||"visible")}</span></td>
                <td>${fmtNumber(e.reportCount||0)}</td>
                <td>${escapeHtml(e.latestReportReason||e.moderationReason||"-")}</td>
                <td>
                  ${e.moderationStatus==="hidden"?`<button type="button" data-moderation="restore:${escapeHtml(e.id)}">恢复</button>`:`<button type="button" data-moderation="hide:${escapeHtml(e.id)}">确认隐藏</button><button type="button" data-moderation="reject:${escapeHtml(e.id)}">驳回举报并恢复</button>`}
                </td>
              </tr>
            `).join("")||'<tr><td colspan="6">暂无举报</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>举报与撤回</h2><span>${fmtNumber(adminState.withdrawals.length)} 条记录</span></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>作品</th><th>用户</th><th>状态</th><th>公开时间</th><th>申请时间</th><th>原因</th><th></th></tr></thead>
          <tbody>
            ${adminState.withdrawals.map(e=>`
              <tr>
                <td><strong>${escapeHtml(e.id)}</strong><small class="admin-truncate">${escapeHtml(e.prompt||"")}</small></td>
                <td>${escapeHtml(e.userName||e.userEmail||e.userId||"-")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(e.withdrawalStatus)}">${escapeHtml(e.withdrawalStatus)}</span></td>
                <td>${fmtDate(e.publishedAt)}</td>
                <td>${fmtDate(e.withdrawalRequestedAt)}</td>
                <td>${escapeHtml(e.withdrawalReason||"-")}</td>
                <td>
                  ${e.withdrawalStatus==="requested"?`
                    <button type="button" data-withdrawal-decision="approved:${escapeHtml(e.id)}">批准</button>
                    <button type="button" data-withdrawal-decision="rejected:${escapeHtml(e.id)}">拒绝</button>
                  `:""}
                </td>
              </tr>
            `).join("")||'<tr><td colspan="7">暂无撤回申请</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`}function renderAudit(){return`
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>审计日志</h2><button type="button" data-audit-demo>记录一次只读巡检</button></div>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>动作</th><th>对象</th><th>操作者</th><th>详情</th><th>时间</th></tr></thead>
          <tbody>
            ${adminState.audit.map(e=>`
              <tr><td>${escapeHtml(e.action)}</td><td>${escapeHtml(e.target)}</td><td>${escapeHtml(e.actor)}</td><td>${escapeHtml(e.detail)}</td><td>${fmtDate(e.createdAt)}</td></tr>
            `).join("")||'<tr><td colspan="5">本地会话暂无审计动作；服务端落库将在审计任务中接入。</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>`}function renderContent(){switch(adminState.active){case"providers":return renderAdminModule("providers");case"generation-requests":return renderRequests();case"square-review":return renderAdminModule("squareReview");case"gallery-files":return renderAdminModule("galleryFiles");case"users-credits":return renderAdminModule("users");case"prompt-cms":return renderPrompts();case"prompt-audit":return renderPromptAudit();case"tag-library":return renderTags();case"system-settings":return renderSettings();case"reports-withdrawals":return renderWithdrawals();case"growth":return renderGrowthPlaceholder();case"announcements":return renderAnnouncements();case"rum-performance":return renderRum();case"audit-log":return renderAudit();default:return renderAdminModule("overview")}}function render(){const[e,,t]=currentNav(),a=$("#adminApp"),n=$("#adminContent");a&&(a.dataset.adminPage=e),n&&(n.dataset.adminSection=e),document.body.dataset.adminSection=e,$("#adminPageTitle").textContent=t,$("#adminEyebrow").textContent=`后台 / ${t}`;const i=$("#adminPageDescription");i&&(i.textContent=pageDescriptions[adminState.active]||pageDescriptions.overview),$("#adminViewSwitch .active")?.replaceChildren(document.createTextNode(t));const r=$("#adminUserLabel");r&&(r.textContent=adminState.user?`${adminState.user.name||adminState.user.email} · 管理员`:"-"),renderNav(),n.innerHTML=renderContent(),bindToolbar(),bindPagination(),bindActions()}function openDrawer(e,t){const a=$("#adminDrawer"),n=$("#adminDrawerBackdrop");n?.classList.remove("hidden"),n?.setAttribute("aria-hidden","false"),a.classList.remove("hidden"),a.setAttribute("aria-hidden","false"),a.setAttribute("role","dialog"),a.setAttribute("aria-modal","true"),a.setAttribute("aria-label",e),document.body.classList.add("admin-drawer-open"),a.innerHTML=`
    <div class="admin-drawer-head primitive-drawer__head">
      <h2>${escapeHtml(e)}</h2>
      <button type="button" data-close-drawer aria-label="关闭详情"><i class="ri-close-line" aria-hidden="true"></i></button>
    </div>
    <div class="admin-drawer-body primitive-drawer__body">${t}</div>
  `,$("[data-close-drawer]",a).addEventListener("click",closeDrawer),n?.addEventListener("click",closeDrawer,{once:!0}),$("[data-close-drawer]",a)?.focus?.({preventScroll:!0})}function closeDrawer(){$("#adminDrawerBackdrop")?.classList.add("hidden"),$("#adminDrawerBackdrop")?.setAttribute("aria-hidden","true");const e=$("#adminDrawer");e.classList.add("hidden"),e.setAttribute("aria-hidden","true"),e.removeAttribute("role"),e.removeAttribute("aria-modal"),e.removeAttribute("aria-label"),e.innerHTML="",document.body.classList.remove("admin-drawer-open")}function jsonBlock(e){if(e==null||e==="")return"-";try{return escapeHtml(JSON.stringify(e,null,2))}catch{return escapeHtml(String(e))}}async function requestDrawer(e){const t=typeof e=="string"?e:e?.id,a=typeof e=="object"?e:adminState.generations.find(l=>l.id===t),n=t?await api(`/api/admin/generations/${encodeURIComponent(t)}`).catch(()=>null):null,i=n?.request||a,r=n?.trace||[];if(!i)return;const d=generationDiagnosticsModule();if(d?.renderDrawer){openDrawer("生成请求详情",d.renderDrawer({item:i,trace:r,helpers:generationDiagnosticsHelpers()})),d.bind({root:$("#adminDrawer"),state:adminState,api,refresh:loadAll,render,confirmAction,toast:l=>setStatus(l,"ok")});return}openDrawer("生成请求详情",`
    <dl class="admin-detail-list">
      <dt>ID</dt><dd>${escapeHtml(i.id)}</dd>
      <dt>状态</dt><dd>${escapeHtml(i.status)}</dd>
      <dt>队列</dt><dd>${escapeHtml(i.queueStatus||"-")} · attempts ${escapeHtml(i.attemptCount??0)}/${escapeHtml(i.maxAttempts??1)}</dd>
      <dt>用户</dt><dd>${escapeHtml(i.userName||i.userEmail||i.userId||"-")}</dd>
      <dt>耗时</dt><dd>${fmtDuration(i.durationMs)}</dd>
      <dt>模型</dt><dd>${escapeHtml(i.model||"-")}</dd>
      <dt>错误阶段</dt><dd>${escapeHtml(i.errorStage||i.failureStage||"-")}</dd>
      <dt>错误码</dt><dd>${escapeHtml(i.errorCode||"-")}</dd>
      <dt>错误</dt><dd>${escapeHtml(i.errorMessage||"-")}</dd>
      <dt>Revised prompt</dt><dd>${escapeHtml(i.revisedPrompt||"-")}</dd>
      <dt>提示词</dt><dd>${escapeHtml(i.prompt||"-")}</dd>
    </dl>
    <h3>请求参数</h3>
    <pre class="admin-code-block">${jsonBlock(i.requestedParams)}</pre>
    <h3>规范化参数</h3>
    <pre class="admin-code-block">${jsonBlock(i.normalizedParams)}</pre>
    <h3>Provider 参数</h3>
    <pre class="admin-code-block">${jsonBlock(i.providerParams)}</pre>
    <h3>Provider 响应摘要</h3>
    <pre class="admin-code-block">${jsonBlock(i.providerResponse)}</pre>
    <h3>Trace 时间线</h3>
    <div class="admin-table-wrap primitive-table-wrap">
      <table class="admin-table primitive-table" data-density="compact">
        <thead><tr><th>时间</th><th>阶段</th><th>级别</th><th>消息</th><th>数据</th></tr></thead>
        <tbody>
          ${r.map(l=>`
            <tr>
              <td>${fmtDate(l.createdAt)}</td>
              <td>${escapeHtml(l.stage||"-")}</td>
              <td><span class="admin-badge" data-status="${escapeHtml(l.level||"info")}">${escapeHtml(l.level||"info")}</span></td>
              <td>${escapeHtml(l.message||"-")}</td>
              <td><pre class="admin-code-block compact">${jsonBlock(l.data)}</pre></td>
            </tr>
          `).join("")||'<tr><td colspan="5">暂无 trace 记录</td></tr>'}
        </tbody>
      </table>
    </div>
  `)}async function promptAuditDrawer(e){const a=(await api(`/api/admin/prompt-audits/${encodeURIComponent(e)}`)).audit||adminState.promptAudits.find(n=>String(n.id)===String(e));a&&(openDrawer("Prompt Audit 详情",`
    <dl class="admin-detail-list">
      <dt>ID</dt><dd>${escapeHtml(a.id)}</dd>
      <dt>作品</dt><dd>${escapeHtml(a.generationId||"-")}</dd>
      <dt>用户</dt><dd>${escapeHtml(a.userName||a.userEmail||a.userId||"-")}</dd>
      <dt>请求模式</dt><dd>${escapeHtml(a.requestedMode||"-")}</dd>
      <dt>风险等级</dt><dd>${escapeHtml(a.resultLevel||"-")} / ${escapeHtml(a.resultAction||"-")}</dd>
      <dt>强制模式</dt><dd>${escapeHtml(a.requiredMode||"-")}</dd>
      <dt>状态</dt><dd>${escapeHtml(a.status||"-")}</dd>
      <dt>分数</dt><dd>${Number(a.score||0).toFixed(4)} · ${escapeHtml(a.method||"none")}</dd>
      <dt>原提示词</dt><dd>${escapeHtml(a.prompt||"-")}</dd>
      <dt>匹配提示词</dt><dd>${escapeHtml(a.matchedPromptText||a.matchedGenerationPrompt||"-")}</dd>
      <dt>人工覆盖</dt><dd>${escapeHtml(a.overrideAction||"-")} ${escapeHtml(a.overrideNote||"")}</dd>
      <dt>复核人</dt><dd>${escapeHtml(a.reviewerName||a.reviewerEmail||a.reviewerUserId||"-")}</dd>
      <dt>创建时间</dt><dd>${fmtDate(a.createdAt)}</dd>
      <dt>复核时间</dt><dd>${fmtDate(a.reviewedAt)}</dd>
    </dl>
    <div class="admin-drawer-actions">
      <button type="button" data-prompt-audit-action="allow_text_to_image:${escapeHtml(a.id)}">允许文生图</button>
      <button type="button" data-prompt-audit-action="require_image_to_image:${escapeHtml(a.id)}">要求图生图</button>
      <button type="button" data-prompt-audit-action="mark_reviewed:${escapeHtml(a.id)}">标记已复核</button>
    </div>
  `),bindPromptAuditActions($("#adminDrawer")))}function showTemporaryPassword(e){e&&(openDrawer("一次性临时密码",`
    <section class="admin-temp-password">
      <p>该密码只会在本次操作后返回一次。关闭后无法再次查看，只能重新重置密码。</p>
      <div class="admin-copy-row">
        <code>${escapeHtml(e)}</code>
        <button type="button" data-copy-temp-password>复制</button>
      </div>
    </section>
  `),$("[data-copy-temp-password]")?.addEventListener("click",async()=>{await navigator.clipboard?.writeText(e).catch(()=>null)}))}function createUserDrawer(){openDrawer("新建用户",`
    <form id="drawerCreateUserForm" class="admin-form-grid single">
      <label>昵称<input name="name" placeholder="运营同学"></label>
      <label>邮箱<input name="email" type="email" required placeholder="ops@example.com"></label>
      <label>密码<input name="password" type="password" placeholder="留空则自动生成临时密码"></label>
      <label class="admin-check"><input name="generatePassword" type="checkbox" checked>自动生成临时密码</label>
      <label>角色<select name="role"><option value="user">user</option><option value="admin">admin</option></select></label>
      <label>状态<select name="status"><option value="active">active</option><option value="disabled">disabled</option></select></label>
      <label>初始积分<input name="credits" type="number" min="0" value="${escapeHtml(adminState.settings?.defaultCredits??10)}"></label>
      <label>备注<input name="note" value="Admin created user"></label>
      <button type="submit">创建用户</button>
    </form>
  `),$("#drawerCreateUserForm").addEventListener("submit",async e=>{e.preventDefault();const t=new FormData(e.currentTarget),a=String(t.get("role")||"user");if(a==="admin"&&!await confirmAction({title:"创建管理员用户",message:"确认创建 admin 用户？该账号将拥有后台管理权限。",confirmText:"创建 admin",danger:!0}))return;const n=await api("/api/admin/users",{method:"POST",body:JSON.stringify({name:t.get("name"),email:t.get("email"),password:t.get("password"),generatePassword:!!t.get("generatePassword"),role:a,status:t.get("status"),credits:t.get("credits"),note:t.get("note")})});recordAudit("create_user",n.user?.id||String(t.get("email")),t.get("email")),await loadAll(),render(),n.temporaryPassword?showTemporaryPassword(n.temporaryPassword):closeDrawer()})}function providerDrawer(e={}){const t=!e.id,a={textToImage:!0,imageEdit:!0,imageToImage:!0,multiCandidate:!1,asyncTasks:!1,responses:!0,revisedPrompt:!0,sizes:[],qualities:[],formats:[],transparentBackground:!1,sourceTransparency:!1,privacyDownload:!1,maxImagesPerRequest:1,...e.capabilities||{}},n={role:t?"fallback":"default",weight:1,...e.routing||{}},i=e.mapping||{};openDrawer(t?"新增 Provider":"编辑 Provider",`
    <form id="drawerProviderForm" class="admin-form-grid single">
      <label>名称<input name="name" value="${escapeHtml(e.name||"")}" required></label>
      <label>类型<select name="providerType">
        ${["openai","openai-compatible","custom-proxy"].map(r=>`<option value="${r}"${(e.providerType||"openai-compatible")===r?" selected":""}>${r}</option>`).join("")}
      </select></label>
      <label>Base URL<input name="baseUrl" value="${escapeHtml(e.baseUrl||"")}" required placeholder="https://api.openai.com"></label>
      <label>API Key<input name="apiKey" type="password" placeholder="${escapeHtml(e.apiKeyMask||"留空则保持不变")}"></label>
      <label>默认模型<input name="defaultModel" value="${escapeHtml(e.defaultModel||"gpt-image-2")}"></label>
      <label>Images endpoint override<input name="endpointImages" value="${escapeHtml(e.endpointImages||"")}"></label>
      <label>Responses endpoint override<input name="endpointResponses" value="${escapeHtml(e.endpointResponses||"")}"></label>
      <label>Edits endpoint override<input name="endpointEdits" value="${escapeHtml(e.endpointEdits||"")}"></label>
      <label>状态<select name="status"><option value="active"${e.status!=="disabled"?" selected":""}>active</option><option value="disabled"${e.status==="disabled"?" selected":""}>disabled</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(e.sortOrder||0)}"></label>
      <label>能力 JSON<textarea name="capabilities" rows="8">${escapeHtml(JSON.stringify(a,null,2))}</textarea></label>
      <label>路由 JSON<textarea name="routing" rows="5">${escapeHtml(JSON.stringify(n,null,2))}</textarea></label>
      <label>Provider Mapping JSON<textarea name="mapping" rows="12" placeholder='{"mode":"openai-compatible","submit":{"method":"POST","path":"/v1/images/generations"}}'>${escapeHtml(JSON.stringify(i,null,2))}</textarea></label>
      <button type="submit">${t?"创建 Provider":"保存 Provider"}</button>
      ${t||e.id==="prv_default"?"":'<button type="button" class="danger" data-delete-provider>删除 Provider</button>'}
    </form>
  `),$("#drawerProviderForm").addEventListener("submit",async r=>{r.preventDefault();const d=new FormData(r.currentTarget);let l,s,c;try{l=JSON.parse(d.get("capabilities")||"{}"),s=JSON.parse(d.get("routing")||"{}"),c=JSON.parse(d.get("mapping")||"{}")}catch{setStatus("Provider JSON 格式错误","danger");return}const u=String(d.get("apiKey")||"").trim(),p={name:d.get("name"),providerType:d.get("providerType"),baseUrl:d.get("baseUrl"),defaultModel:d.get("defaultModel"),endpointImages:d.get("endpointImages"),endpointResponses:d.get("endpointResponses"),endpointEdits:d.get("endpointEdits"),status:d.get("status"),sortOrder:d.get("sortOrder"),capabilities:l,routing:s,mapping:c};(t||u)&&(p.apiKey=u),await api(t?"/api/admin/providers":`/api/admin/providers/${encodeURIComponent(e.id)}`,{method:t?"POST":"PATCH",body:JSON.stringify(p)}),recordAudit(t?"create_provider":"update_provider",e.id||String(p.name),p.baseUrl),await refreshAndRender(),closeDrawer()}),$("[data-delete-provider]")?.addEventListener("click",async()=>{await confirmAction({title:"删除 Provider",message:`确认删除 ${e.name}？默认 Provider 不能删除。`,confirmText:"删除",danger:!0})&&(await api(`/api/admin/providers/${encodeURIComponent(e.id)}`,{method:"DELETE"}),recordAudit("delete_provider",e.id,e.name),await refreshAndRender(),closeDrawer())})}async function userDrawer(e){const[t,a,n]=await Promise.all([api(`/api/admin/users/${encodeURIComponent(e.id)}/credit-ledger?limit=80`),api(`/api/admin/users/${encodeURIComponent(e.id)}/reward-ledger?limit=80`),api(`/api/admin/users/${encodeURIComponent(e.id)}/generations?includeArchived=1&limit=80`)]),i=t.ledger||[],r=a.rewards||[],d=n.generations||[],l=e.firstPublicRewardStatus&&e.firstPublicRewardStatus!=="none"?`${e.firstPublicRewardStatus} · ${fmtNumber(e.firstPublicRewardAmount)} · ${e.firstPublicRewardGenerationId||"-"}`:"未发放";openDrawer("用户与积分",`
    <form id="drawerUserForm" class="admin-form-grid single">
      <label>姓名<input name="name" value="${escapeHtml(e.name||"")}"></label>
      <label>角色<select name="role"><option value="user"${e.role==="user"?" selected":""}>user</option><option value="admin"${e.role==="admin"?" selected":""}>admin</option></select></label>
      <label>状态<select name="status"><option value="active"${e.status==="active"?" selected":""}>active</option><option value="disabled"${e.status==="disabled"?" selected":""}>disabled</option></select></label>
      <label>首发奖励<input value="${escapeHtml(l)}" disabled></label>
      <label>积分<input name="credits" type="number" min="0" value="${escapeHtml(e.credits||0)}"></label>
      <label>积分调整<input name="creditDelta" type="number" value="0"></label>
      <label>备注<input name="note" value="Admin adjustment"></label>
      <button type="submit">保存用户</button>
      <button type="button" data-reset-user-password>重置密码</button>
    </form>
    <section class="admin-ledger-section">
      <h3>积分流水</h3>
      <div class="admin-mini-table">
        ${i.map(s=>`
          <div><strong>${s.delta>0?"+":""}${fmtNumber(s.delta)}</strong><span>${escapeHtml(s.source)}</span><small>${fmtNumber(s.balanceAfter)} · ${fmtDate(s.createdAt)}</small></div>
        `).join("")||"<p>暂无积分流水</p>"}
      </div>
    </section>
    <section class="admin-ledger-section">
      <h3>奖励流水</h3>
      <div class="admin-mini-table">
        ${r.map(s=>`
          <div><strong>${escapeHtml(s.rewardType)}</strong><span>${escapeHtml(s.status)} · ${fmtNumber(s.amount)}</span><small>${fmtDate(s.awardedAt||s.createdAt)}</small></div>
        `).join("")||"<p>暂无奖励流水</p>"}
      </div>
    </section>
    <section class="admin-ledger-section">
      <h3>用户作品与会话</h3>
      <div class="admin-mini-table">
        ${d.map(s=>`
          <div>
            <strong>${escapeHtml(s.title||s.id)}</strong>
            <span>${escapeHtml(s.prompt||"-")}</span>
            <small>${escapeHtml(s.id)} · ${fmtDate(s.createdAt)} · ${s.isPublic?"公开":"私有"}${s.archived?" · 已归档":""}</small>
          </div>
        `).join("")||"<p>暂无生成作品</p>"}
      </div>
    </section>
  `),$("#drawerUserForm").addEventListener("submit",async s=>{s.preventDefault();const c=new FormData(s.currentTarget);c.get("status")==="disabled"&&!await confirmAction({title:"停用用户",message:"确认停用该用户？停用后该用户将无法正常使用账号。",confirmText:"停用",danger:!0})||(await api(`/api/admin/users/${encodeURIComponent(e.id)}`,{method:"PATCH",body:JSON.stringify({name:c.get("name"),role:c.get("role"),status:c.get("status"),credits:c.get("credits"),creditDelta:c.get("creditDelta"),note:c.get("note")})}),recordAudit("update_user",e.id,e.email),await refreshAndRender(),closeDrawer())}),$("[data-reset-user-password]")?.addEventListener("click",async()=>{if(!await confirmAction({title:"重置用户密码",message:`确认重置 ${e.email} 的密码？系统会生成一次性临时密码。`,confirmText:"重置密码",danger:!0}))return;const s=await api(`/api/admin/users/${encodeURIComponent(e.id)}/reset-password`,{method:"POST",body:JSON.stringify({generatePassword:!0,note:"Admin reset password"})});recordAudit("reset_user_password",e.id,e.email),await loadAll(),render(),showTemporaryPassword(s.temporaryPassword)})}function promptSourcePayload(e){let t={};const a=String(e.get("config")||"").trim();if(a)try{t=JSON.parse(a)}catch{throw new Error("来源配置必须是 JSON 对象")}return{name:e.get("name"),sourceType:e.get("sourceType"),repoUrl:e.get("repoUrl"),branch:e.get("branch"),parser:e.get("parser"),status:e.get("status"),sortOrder:Number(e.get("sortOrder")||0),config:t}}function promptSourceDrawer(e={}){const t=!e.id;openDrawer(t?"新建远程来源":"编辑远程来源",`
    <form id="drawerPromptSourceForm" class="admin-form-grid single">
      <label>名称<input name="name" value="${escapeHtml(e.name||"")}" required></label>
      <label>类型<input name="sourceType" value="${escapeHtml(e.sourceType||"github")}" required></label>
      <label>仓库 URL<input name="repoUrl" value="${escapeHtml(e.repoUrl||"")}" required></label>
      <label>分支<input name="branch" value="${escapeHtml(e.branch||"main")}"></label>
      <label>Parser<input name="parser" value="${escapeHtml(e.parser||"")}" placeholder="AIS-RLS-011 接入"></label>
      <label>状态<select name="status"><option value="active"${e.status!=="disabled"?" selected":""}>active</option><option value="disabled"${e.status==="disabled"?" selected":""}>disabled</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(e.sortOrder||0)}"></label>
      <label>配置 JSON<textarea name="config" rows="5">${escapeHtml(JSON.stringify(e.config||{},null,2))}</textarea></label>
      <button type="submit">${t?"创建":"保存"}</button>
    </form>
  `),$("#drawerPromptSourceForm").addEventListener("submit",async a=>{a.preventDefault();let n;try{n=promptSourcePayload(new FormData(a.currentTarget))}catch(i){setStatus(i.message,"danger");return}await api(t?"/api/admin/prompt-sources":`/api/admin/prompt-sources/${encodeURIComponent(e.id)}`,{method:t?"POST":"PATCH",body:JSON.stringify(n)}),recordAudit(t?"create_prompt_source":"update_prompt_source",e.id||n.name,n.name),await refreshAndRender(),closeDrawer()})}function promptPayload(e){return{title:e.get("title"),image:e.get("imageUrl"),preview:e.get("preview"),prompt:e.get("prompt"),tags:String(e.get("tags")||"").split(/[,，\s]+/).filter(Boolean),category:e.get("category"),visibility:e.get("visibility"),author:e.get("author"),source:e.get("source"),sourceUrl:e.get("sourceUrl"),githubUrl:e.get("githubUrl"),remoteId:e.get("remoteId"),sourceRepo:e.get("sourceRepo"),sourceCategory:e.get("sourceCategory"),promptType:e.get("promptType"),language:e.get("language"),modelHint:e.get("modelHint"),syncedAt:e.get("syncedAt"),status:e.get("status"),sortOrder:Number(e.get("sortOrder")||0)}}function promptDrawer(e={}){const t=!e.id,a=(adminState.promptCategories||[]).filter(i=>i.status!=="hidden"),n=e.category||"general";openDrawer(t?"新建提示词":"编辑提示词",`
    <form id="drawerPromptForm" class="admin-form-grid single">
      <label>标题<input name="title" value="${escapeHtml(e.title||"")}" required></label>
      <label>旧封面 URL<input name="imageUrl" value="${escapeHtml(e.image||"")}"></label>
      <label>预览封面 URL<input name="preview" value="${escapeHtml(e.preview||e.coverUrl||"")}"></label>
      <label>提示词<textarea name="prompt" rows="6" required>${escapeHtml(e.prompt||"")}</textarea></label>
      <label>标签<input name="tags" value="${escapeHtml((e.tags||[]).join(", "))}"></label>
      <label>分类<select name="category">
        ${a.map(i=>`<option value="${escapeHtml(i.slug)}"${n===i.slug?" selected":""}>${escapeHtml(i.labelZh||i.slug)}</option>`).join("")}
        ${a.some(i=>i.slug===n)?"":`<option value="${escapeHtml(n)}" selected>${escapeHtml(n)}</option>`}
      </select></label>
      <label>可见性<select name="visibility"><option value="public"${e.visibility!=="private"&&e.visibility!=="internal"?" selected":""}>public</option><option value="private"${e.visibility==="private"?" selected":""}>private</option><option value="internal"${e.visibility==="internal"?" selected":""}>internal</option></select></label>
      <label>作者<input name="author" value="${escapeHtml(e.author||"")}"></label>
      <label>来源<input name="source" value="${escapeHtml(e.source||"admin")}"></label>
      <label>来源 URL<input name="sourceUrl" value="${escapeHtml(e.sourceUrl||"")}"></label>
      <label>GitHub URL<input name="githubUrl" value="${escapeHtml(e.githubUrl||"")}"></label>
      <label>远程 ID<input name="remoteId" value="${escapeHtml(e.remoteId||"")}"></label>
      <label>来源仓库<input name="sourceRepo" value="${escapeHtml(e.sourceRepo||"")}"></label>
      <label>来源分类<input name="sourceCategory" value="${escapeHtml(e.sourceCategory||"")}"></label>
      <label>Prompt 类型<input name="promptType" value="${escapeHtml(e.promptType||"text-to-image")}"></label>
      <label>语言<input name="language" value="${escapeHtml(e.language||"zh")}"></label>
      <label>模型提示<input name="modelHint" value="${escapeHtml(e.modelHint||"")}"></label>
      <label>同步时间<input name="syncedAt" value="${escapeHtml(e.syncedAt||"")}" placeholder="2026-05-19T12:00:00.000Z"></label>
      <label>状态<select name="status"><option value="active"${e.status!=="hidden"?" selected":""}>active</option><option value="hidden"${e.status==="hidden"?" selected":""}>hidden</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(e.sortOrder||0)}"></label>
      <button type="submit">${t?"创建":"保存"}</button>
      ${t?"":'<button type="button" class="danger" data-hide-prompt>隐藏此条</button>'}
    </form>
  `),$("#drawerPromptForm").addEventListener("submit",async i=>{i.preventDefault();const r=promptPayload(new FormData(i.currentTarget));await api(t?"/api/prompts":`/api/prompts/${e.id}`,{method:t?"POST":"PATCH",body:JSON.stringify(r)}),recordAudit(t?"create_prompt":"update_prompt",String(e.id||r.title),r.title),await refreshAndRender(),closeDrawer()}),$("[data-hide-prompt]")?.addEventListener("click",async()=>{await confirmAction({title:"隐藏提示词",message:"确认隐藏该提示词？隐藏后前台将不再展示。",confirmText:"隐藏",danger:!0})&&(await api(`/api/prompts/${e.id}`,{method:"DELETE"}),recordAudit("hide_prompt",String(e.id),e.title||""),await refreshAndRender(),closeDrawer())})}function categoryDrawer(e={}){const t=!e.slug;openDrawer(t?"新建提示词分类":"编辑提示词分类",`
    <form id="drawerCategoryForm" class="admin-form-grid single">
      <label>Slug<input name="slug" value="${escapeHtml(e.slug||"")}" ${t?"required":"readonly"}></label>
      <label>中文名<input name="labelZh" value="${escapeHtml(e.labelZh||"")}" required></label>
      <label>英文名<input name="labelEn" value="${escapeHtml(e.labelEn||"")}"></label>
      <label>中文说明<textarea name="descriptionZh" rows="3">${escapeHtml(e.descriptionZh||"")}</textarea></label>
      <label>英文说明<textarea name="descriptionEn" rows="3">${escapeHtml(e.descriptionEn||"")}</textarea></label>
      <label>状态<select name="status"><option value="active"${e.status!=="hidden"?" selected":""}>active</option><option value="hidden"${e.status==="hidden"?" selected":""}>hidden</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(e.sortOrder||0)}"></label>
      <button type="submit">${t?"创建":"保存"}</button>
      ${t?"":'<button type="button" class="danger" data-hide-category>停用分类</button>'}
    </form>
  `),$("#drawerCategoryForm").addEventListener("submit",async a=>{a.preventDefault();const n=new FormData(a.currentTarget);if(n.get("status")==="hidden"&&!await confirmAction({title:"停用分类",message:"确认停用该分类？前台筛选将不再展示停用分类名。",confirmText:"停用",danger:!0}))return;const i={slug:String(n.get("slug")||"").trim().toLowerCase(),labelZh:n.get("labelZh"),labelEn:n.get("labelEn"),descriptionZh:n.get("descriptionZh"),descriptionEn:n.get("descriptionEn"),status:n.get("status"),sortOrder:Number(n.get("sortOrder")||0)};await api(t?"/api/prompt-categories":`/api/prompt-categories/${encodeURIComponent(e.slug)}`,{method:t?"POST":"PATCH",body:JSON.stringify(i)}),recordAudit(t?"create_prompt_category":"update_prompt_category",i.slug,i.labelZh||""),await refreshAndRender(),closeDrawer()}),$("[data-hide-category]")?.addEventListener("click",async()=>{await confirmAction({title:"停用分类",message:"确认停用该分类？已有标签不会删除。",confirmText:"停用",danger:!0})&&(await api(`/api/prompt-categories/${encodeURIComponent(e.slug)}`,{method:"DELETE"}),recordAudit("hide_prompt_category",e.slug,e.labelZh||""),await refreshAndRender(),closeDrawer())})}function tagDrawer(e={}){const t=!e.slug;openDrawer(t?"新建标签":"编辑标签",`
    <form id="drawerTagForm" class="admin-form-grid single">
      <label>Slug<input name="slug" value="${escapeHtml(e.slug||"")}" ${t?"required":"readonly"}></label>
      <label>中文<input name="labelZh" value="${escapeHtml(e.labelZh||"")}"></label>
      <label>英文<input name="labelEn" value="${escapeHtml(e.labelEn||"")}"></label>
      <label>别名<input name="aliases" value="${escapeHtml((e.aliases||[]).join(", "))}"></label>
      <label>分类<input name="category" value="${escapeHtml(e.category||"")}"></label>
      <label>状态<select name="status"><option value="active"${e.status!=="hidden"?" selected":""}>active</option><option value="hidden"${e.status==="hidden"?" selected":""}>hidden</option></select></label>
      <label>排序<input name="sortOrder" type="number" value="${escapeHtml(e.sortOrder||0)}"></label>
      <label>色相<input name="hue" type="number" min="0" max="359" value="${escapeHtml(e.hue||0)}"></label>
      <label class="admin-check"><input name="showInFilter" type="checkbox"${e.showInFilter!==!1?" checked":""}>前台筛选展示</label>
      <button type="submit">${t?"创建":"保存"}</button>
      ${t?"":'<label>合并到目标 slug<input id="mergeTargetSlug" placeholder="target-slug"></label><button type="button" data-merge-tag>合并标签</button>'}
    </form>
  `),$("#drawerTagForm").addEventListener("submit",async a=>{a.preventDefault();const n=new FormData(a.currentTarget);if(n.get("status")==="hidden"&&!await confirmAction({title:"隐藏标签",message:"确认隐藏该标签？前台筛选和推荐可能受影响。",confirmText:"隐藏",danger:!0}))return;const i={slug:String(n.get("slug")||"").trim().toLowerCase(),labelZh:n.get("labelZh"),labelEn:n.get("labelEn"),aliases:String(n.get("aliases")||"").split(/[,，\n]+/).map(r=>r.trim()).filter(Boolean),category:n.get("category"),status:n.get("status"),sortOrder:Number(n.get("sortOrder")||0),hue:Number(n.get("hue")||0),showInFilter:!!n.get("showInFilter"),source:e.source||"admin"};await api(t?"/api/tags":`/api/tags/${encodeURIComponent(e.slug)}`,{method:t?"POST":"PATCH",body:JSON.stringify(i)}),recordAudit(t?"create_tag":"update_tag",i.slug,i.labelZh||i.labelEn||""),await refreshAndRender(),closeDrawer()}),$("[data-merge-tag]")?.addEventListener("click",async()=>{const a=$("#mergeTargetSlug").value.trim().toLowerCase();!a||!await confirmAction({title:"合并标签",message:`确认把 ${e.slug} 合并到 ${a}？历史内容会迁移到目标标签。`,confirmText:"合并",danger:!0})||(await api(`/api/tags/${encodeURIComponent(e.slug)}/merge`,{method:"POST",body:JSON.stringify({targetSlug:a})}),recordAudit("merge_tag",e.slug,`target=${a}`),await refreshAndRender(),closeDrawer())})}function workDrawer(e){openDrawer("公开作品详情",`
    <img class="admin-drawer-image" src="${escapeHtml(e.imageUrl)}" alt="">
    <dl class="admin-detail-list">
      <dt>ID</dt><dd>${escapeHtml(e.id)}</dd>
      <dt>作者</dt><dd>${escapeHtml(e.userName||e.userId||"-")}</dd>
      <dt>标签</dt><dd>${escapeHtml((e.publicTags||[]).join(", "))||"-"}</dd>
      <dt>提示词</dt><dd>${escapeHtml(e.prompt||"-")}</dd>
    </dl>
  `)}function announcementDrawer(e=null){const t=!e,a=e||{title:"",body:"",level:"info",displayMode:"feed",audience:"all",status:"draft",isImportant:!1,requiresAck:!1,startsAt:"",endsAt:"",targetUserIds:[]};openDrawer(t?"新建通知":"编辑通知",`
    <form id="drawerAnnouncementForm" class="admin-form-grid">
      <label>标题<input name="title" value="${escapeHtml(a.title||"")}" required maxlength="160"></label>
      <label>等级
        <select name="level">
          ${["info","success","warning","danger","maintenance","feature"].map(n=>`<option value="${n}"${(a.level||a.severity)===n?" selected":""}>${n}</option>`).join("")}
        </select>
      </label>
      <label>展示方式
        <select name="displayMode">
          ${["feed","banner","modal"].map(n=>`<option value="${n}"${(a.displayMode||a.displayType)===n?" selected":""}>${n}</option>`).join("")}
        </select>
      </label>
      <label>目标人群
        <select name="audience">
          ${["all","logged-in","admin","specific-users"].map(n=>`<option value="${n}"${(a.audience||a.targetAudience)===n?" selected":""}>${n}</option>`).join("")}
        </select>
      </label>
      <label>生效时间<input name="startsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(a.startsAt||a.publishAt))}"></label>
      <label>失效时间<input name="endsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(a.endsAt||a.expiresAt))}"></label>
      <label>指定用户 ID<textarea name="targetUserIds" rows="3" placeholder="仅 specific-users 使用，多个 ID 用逗号或换行分隔">${escapeHtml((a.targetUserIds||[]).join(`
`))}</textarea></label>
      <label>正文<textarea name="body" rows="10" required>${escapeHtml(a.body||"")}</textarea></label>
      <label class="admin-check"><input name="isImportant" type="checkbox"${a.isImportant?" checked":""}>重要通知</label>
      <label class="admin-check"><input name="requiresAck" type="checkbox"${a.requiresAck?" checked":""}>需要用户点击“我已知晓”确认</label>
      <div class="admin-form-actions">
        <button type="submit">${t?"创建通知":"保存通知"}</button>
        ${!t&&a.status!=="published"?`<button type="button" data-announcement-drawer-action="publish:${escapeHtml(a.id)}">发布</button>`:""}
        ${!t&&a.status==="published"?`<button type="button" data-announcement-drawer-action="withdraw:${escapeHtml(a.id)}">撤回</button>`:""}
        ${t?"":`<button type="button" data-announcement-drawer-action="archive:${escapeHtml(a.id)}">归档</button>`}
      </div>
    </form>
  `),$("#drawerAnnouncementForm").addEventListener("submit",async n=>{n.preventDefault();const i=new FormData(n.currentTarget),r={title:i.get("title"),body:i.get("body"),level:i.get("level"),displayMode:i.get("displayMode"),audience:i.get("audience"),startsAt:i.get("startsAt"),endsAt:i.get("endsAt"),targetUserIds:String(i.get("targetUserIds")||"").split(/[,\n\s]+/).filter(Boolean),isImportant:!!i.get("isImportant"),requiresAck:!!i.get("requiresAck")},d=await api(t?"/api/admin/announcements":`/api/admin/announcements/${encodeURIComponent(a.id)}`,{method:t?"POST":"PATCH",body:JSON.stringify(r)});recordAudit(t?"create_announcement":"update_announcement",d.announcement?.id||a.id,r.title),await refreshAndRender(),closeDrawer()}),document.querySelectorAll("[data-announcement-drawer-action]").forEach(n=>{n.addEventListener("click",async()=>{const[i,r]=n.dataset.announcementDrawerAction.split(":");await runAnnouncementAction(i,r),closeDrawer()})})}async function runAnnouncementAction(e,t){const a={publish:"发布",archive:"归档",withdraw:"撤回"},n=e==="archive"||e==="withdraw";await confirmAction({title:`${a[e]||e}通知`,message:`确认${a[e]||e}该通知？`,confirmText:a[e]||"确认",danger:n})&&(await api(`/api/admin/announcements/${encodeURIComponent(t)}/${encodeURIComponent(e)}`,{method:"POST",body:"{}"}),recordAudit(`${e}_announcement`,t,""),await refreshAndRender())}async function saveSettings(e){e.preventDefault();const t=new FormData(e.currentTarget);await api("/api/admin/settings",{method:"PATCH",body:JSON.stringify(window.AdminModules.settings.buildPayload(t))}),recordAudit("update_settings","system","settings saved"),await refreshAndRender()}async function refreshAndRender(){await loadAll(),render()}function bindPromptAuditActions(e=document){e.querySelectorAll("[data-prompt-audit-action]").forEach(t=>{t.addEventListener("click",async()=>{const[a,n]=t.dataset.promptAuditAction.split(":"),i=prompt("复核备注",a==="allow_text_to_image"?"人工确认可文生图发布":"")||"";await confirmAction({title:"复核 Prompt Audit",message:`${a} audit #${n}？`,confirmText:"确认复核",danger:a==="require_image_to_image"})&&(await api(`/api/admin/prompt-audits/${encodeURIComponent(n)}`,{method:"PATCH",body:JSON.stringify({action:a,note:i})}),recordAudit(`prompt_audit_${a}`,n,i),await refreshAndRender())})})}function bindActions(){generationDiagnosticsModule()?.bind?.({root:document,state:adminState,api,refresh:loadAll,render,confirmAction,toast:e=>setStatus(e,"ok")}),document.querySelectorAll("[data-jump]").forEach(e=>{e.addEventListener("click",()=>{adminState.active=e.dataset.jump,location.hash=adminState.active,render()})}),document.querySelectorAll("[data-detail]").forEach(e=>{e.addEventListener("click",async()=>{const[t,a]=e.dataset.detail.split(":");t==="request"&&await requestDrawer(a),t==="work"&&workDrawer(adminState.publicImages.find(n=>n.id===a)),t==="user"&&await userDrawer(adminState.users.find(n=>n.id===a)),t==="prompt"&&promptDrawer(adminState.prompts.find(n=>String(n.id)===a)),t==="promptSource"&&promptSourceDrawer(adminState.promptSources.find(n=>n.id===a)),t==="promptAudit"&&await promptAuditDrawer(a),t==="tag"&&tagDrawer(adminState.tags.find(n=>n.slug===a)),t==="category"&&categoryDrawer(adminState.promptCategories.find(n=>n.slug===a)),t==="provider"&&providerDrawer(adminState.providers.find(n=>n.id===a)),t==="announcement"&&announcementDrawer(adminState.announcements.find(n=>n.id===a))})}),$("[data-create-user]")?.addEventListener("click",createUserDrawer),$("[data-create-provider]")?.addEventListener("click",()=>providerDrawer()),$("[data-create-announcement]")?.addEventListener("click",()=>announcementDrawer()),document.querySelectorAll("[data-announcement-action]").forEach(e=>{e.addEventListener("click",async()=>{const[t,a]=e.dataset.announcementAction.split(":");await runAnnouncementAction(t,a)})}),document.querySelectorAll("[data-provider-test]").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.providerTest;e.disabled=!0;try{const a=await api(`/api/admin/providers/${encodeURIComponent(t)}/test`,{method:"POST",body:"{}"});recordAudit("test_provider",t,a.ok?"ok":a.error||"failed")}finally{await refreshAndRender()}})}),document.querySelectorAll("[data-provider-default]").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.providerDefault;await confirmAction({title:"设为默认 Provider",message:"确认把该 Provider 设为默认线路？",confirmText:"设为默认"})&&(await api(`/api/admin/providers/${encodeURIComponent(t)}/set-default`,{method:"POST",body:"{}"}),recordAudit("set_default_provider",t,""),await refreshAndRender())})}),document.querySelectorAll("[data-user-select]").forEach(e=>{e.addEventListener("change",()=>{e.checked?adminState.selectedUsers.add(e.dataset.userSelect):adminState.selectedUsers.delete(e.dataset.userSelect),render()})}),$("[data-select-page-users]")?.addEventListener("change",e=>{document.querySelectorAll("[data-user-select]").forEach(t=>{e.target.checked?adminState.selectedUsers.add(t.dataset.userSelect):adminState.selectedUsers.delete(t.dataset.userSelect)}),render()}),$("[data-bulk-users]")?.addEventListener("click",async()=>{const e=Array.from(adminState.selectedUsers);if(!e.length)return;const t=$("#bulkUserAction")?.value||"creditDelta",a=$("#bulkStatus")?.value||"active",n=Number($("#bulkCreditDelta")?.value||0),i=$("#bulkNote")?.value||"Bulk adjustment",r=t==="status"&&a==="disabled";await confirmAction({title:r?"批量停用用户":"批量更新用户",message:`${r?"确认停用":"确认更新"} ${e.length} 个已选用户？`,confirmText:r?"停用":"更新",danger:r})&&(await api("/api/admin/users/bulk",{method:"POST",body:JSON.stringify({userIds:e,action:t,status:a,creditDelta:n,note:i})}),recordAudit("bulk_user_update","selected users",`${t} ${e.length}`),adminState.selectedUsers.clear(),await refreshAndRender())}),$("[data-create-prompt]")?.addEventListener("click",()=>promptDrawer()),$("[data-create-prompt-source]")?.addEventListener("click",()=>promptSourceDrawer()),document.querySelectorAll("[data-prompt-source-sync]").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.promptSourceSync;await api(`/api/admin/prompt-sources/${encodeURIComponent(t)}/sync`,{method:"POST",body:"{}"}),recordAudit("sync_prompt_source",t,""),await refreshAndRender()})}),$("[data-scan-prompt-duplicates]")?.addEventListener("click",async()=>{await api("/api/admin/prompt-duplicates/scan",{method:"POST",body:JSON.stringify({limit:2e3,hammingThreshold:6,aiReview:!0,aiReviewLimit:12})}),recordAudit("scan_prompt_duplicates","prompt","manual scan"),await refreshAndRender()}),document.querySelectorAll("[data-duplicate-ai-review]").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.duplicateAiReview;await api(`/api/admin/prompt-duplicates/${encodeURIComponent(t)}/ai-review`,{method:"POST",body:"{}"}),recordAudit("prompt_duplicate_ai_review",t,"AI semantic review"),await refreshAndRender()})}),document.querySelectorAll("[data-duplicate-action]").forEach(e=>{e.addEventListener("click",async()=>{const[t,a]=e.dataset.duplicateAction.split(":"),n=prompt("处理备注",t==="hide_duplicate"?"人工确认重复，隐藏 B":"")||"";await confirmAction({title:"处理重复候选",message:`${t} duplicate candidate #${a}？`,confirmText:"处理",danger:t==="hide_duplicate"})&&(await api(`/api/admin/prompt-duplicates/${encodeURIComponent(a)}`,{method:"PATCH",body:JSON.stringify({action:t,note:n})}),recordAudit(`prompt_duplicate_${t}`,a,n),await refreshAndRender())})}),bindPromptAuditActions(document),$("[data-create-category]")?.addEventListener("click",()=>categoryDrawer()),$("[data-create-tag]")?.addEventListener("click",()=>tagDrawer()),$("#adminSettingsForm")?.addEventListener("submit",saveSettings),$("[data-clear-key]")?.addEventListener("click",async()=>{await confirmAction({title:"清除 API Key",message:"确认清除 OpenAI API Key？清除后生成能力可能不可用。",confirmText:"清除",danger:!0})&&(await api("/api/admin/settings",{method:"PATCH",body:JSON.stringify({clearApiKey:!0})}),recordAudit("clear_api_key","system","API key cleared"),await refreshAndRender())}),$("[data-audit-demo]")?.addEventListener("click",()=>{recordAudit("read_audit","admin-console","manual inspection"),render()}),document.querySelectorAll("[data-withdrawal-decision]").forEach(e=>{e.addEventListener("click",async()=>{const[t,a]=e.dataset.withdrawalDecision.split(":"),n=prompt("处理原因",t==="rejected"?"withdrawal rejected":"")||"";await confirmAction({title:`${t==="approved"?"批准":"拒绝"}撤回申请`,message:`${t==="approved"?"批准":"拒绝"}该撤回申请？`,confirmText:t==="approved"?"批准":"拒绝",danger:t!=="approved"})&&(await api(`/api/admin/withdrawals/${encodeURIComponent(a)}`,{method:"PATCH",body:JSON.stringify({decision:t,reason:n})}),recordAudit(`withdrawal_${t}`,a,n),await refreshAndRender())})}),document.querySelectorAll("[data-moderation]").forEach(e=>{e.addEventListener("click",async()=>{const[t,a]=e.dataset.moderation.split(":"),n=prompt("处理原因",t==="hide"?"policy_review":"")||"";await confirmAction({title:"处理公开作品",message:`${t} ${a}？`,confirmText:"确认处理",danger:t==="hide"})&&(await api(`/api/admin/public-images/${encodeURIComponent(a)}/moderation`,{method:"PATCH",body:JSON.stringify({action:t,reason:n})}),recordAudit(`moderation_${t}`,a,n),await refreshAndRender())})}),document.querySelector("[data-gallery-file-check-run]")?.addEventListener("click",async()=>{setStatus("正在巡检画廊文件...","loading");const e=await api("/api/admin/gallery-file-checks/run",{method:"POST",body:JSON.stringify({limit:5e3})});recordAudit("gallery_file_check_run","public-images",`broken=${e.broken||0}`),await refreshAndRender(),setStatus(`巡检完成：${fmtNumber(e.checked||0)} 个文件，异常 ${fmtNumber(e.broken||0)}`,e.broken?"warn":"ok")})}async function init(){$("#adminRefreshBtn").addEventListener("click",refreshAndRender),$("#adminSidebarToggle")?.addEventListener("click",()=>isAdminMobile()?(adminState.sidebarDrawerOpen=!adminState.sidebarDrawerOpen,applySidebarState()):setSidebarState(adminState.sidebarState==="collapsed"?"expanded":"collapsed")),$("#adminSidebarBackdrop")?.addEventListener("click",()=>{adminState.sidebarDrawerOpen=!1,applySidebarState()}),$("#adminGlobalSearch")?.addEventListener("input",e=>{adminState.search=e.target.value,adminState.page=1,render()}),$("#adminDrawerBackdrop")?.addEventListener("click",closeDrawer),window.addEventListener("keydown",e=>{e.key==="Escape"&&(adminState.sidebarDrawerOpen=!1,applySidebarState(),closeDrawer())}),window.addEventListener("resize",applySidebarState),window.addEventListener("hashchange",()=>{adminState.active=location.hash.replace("#","")||"overview",adminState.page=1,render()});try{await loadAll(),render()}catch(e){setStatus(e.status===403?"无权限":"加载失败","danger"),$("#adminContent").innerHTML=`<div class="admin-empty-state">后台加载失败：${escapeHtml(e.message)}</div>`}}init();
