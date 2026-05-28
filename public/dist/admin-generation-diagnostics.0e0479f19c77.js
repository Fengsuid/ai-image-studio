(function(u){"use strict";const f=["queue","credit_reserved","provider_generation","provider_edit","provider_failed","admin"],m=["pending","running","queued","polling","succeeded","success","failed","cancelled"];function e(t){return String(t??"").replace(/[&<>"']/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[n])}function l(t){try{return e(JSON.stringify(t??{},null,2))}catch{return e(String(t??""))}}function s(t,n){return e(t.generationDiagnostics?.filters?.[n]||"")}function b(t={}){return t.providerParams?.provider||t.providerParams?.name||t.providerParams?.endpoint||"-"}function $(t={}){return t.model||t.normalizedParams?.model||t.providerParams?.model||"-"}function p(t={}){return[t.errorStage||t.failureStage||"",t.errorCode||"",t.errorMessage||""].filter(Boolean).join(" | ")}function v({state:t}){return`
      <div class="admin-toolbar generation-diagnostics-toolbar">
        <label><i class="ri-search-line"></i><input data-generation-filter="user" value="${s(t,"user")}" placeholder="用户 ID、姓名或邮箱"></label>
        <label><input data-generation-filter="provider" value="${s(t,"provider")}" placeholder="Provider"></label>
        <label><input data-generation-filter="model" value="${s(t,"model")}" placeholder="模型"></label>
        <select data-generation-filter="status">
          <option value="">全部状态</option>
          ${m.map(n=>`<option value="${n}"${t.generationDiagnostics?.filters?.status===n?" selected":""}>${n}</option>`).join("")}
        </select>
        <select data-generation-filter="errorStage">
          <option value="">全部错误阶段</option>
          ${f.map(n=>`<option value="${n}"${t.generationDiagnostics?.filters?.errorStage===n?" selected":""}>${n}</option>`).join("")}
        </select>
        <label><input type="datetime-local" data-generation-filter="dateFrom" value="${s(t,"dateFrom")}" aria-label="开始时间"></label>
        <label><input type="datetime-local" data-generation-filter="dateTo" value="${s(t,"dateTo")}" aria-label="结束时间"></label>
        <button type="button" data-generation-filter-refresh><i class="ri-filter-3-line"></i>筛选</button>
        <button type="button" data-generation-filter-clear>清空</button>
      </div>
    `}function h({state:t,helpers:n}){const o=t.generations||[],i=n.paged(o);return`${v({state:t})}
      <section class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>生成请求诊断</h2>
            <span>${n.fmtNumber(o.length)} 条请求 · trace / provider / credit / queue</span>
          </div>
          <button type="button" data-generation-filter-refresh><i class="ri-refresh-line"></i>刷新诊断</button>
        </div>
        <div class="admin-table-wrap primitive-table-wrap">
          <table class="admin-table primitive-table" data-density="compact">
            <thead><tr><th>状态</th><th>用户</th><th>Provider / 模型</th><th>耗时/积分</th><th>错误阶段</th><th>结果</th><th>时间</th><th></th></tr></thead>
            <tbody>
              ${i.map(a=>`
                <tr>
                  <td><span class="admin-badge" data-status="${e(a.status)}">${e(a.status)}</span><small>${e(a.queueStatus||"-")} · ${e(a.attemptCount??0)}/${e(a.maxAttempts??1)}</small></td>
                  <td>${e(a.userName||a.userEmail||a.userId||"-")}<small>${e(a.userEmail||a.userId||"")}</small></td>
                  <td>${e(b(a))}<small>${e($(a))}</small></td>
                  <td>${n.fmtDuration(a.durationMs||a.latencyMs)}<small>${e(String(a.normalizedParams?.n||a.requestedParams?.n||1))} 张</small></td>
                  <td>${e(a.errorStage||a.failureStage||"-")}<small class="admin-truncate">${e(a.errorCode||a.errorMessage||"")}</small></td>
                  <td>${a.imageUrl?`<img class="admin-diagnostics-thumb" src="${e(n.imageVariantUrl(a.imageUrl))}" alt="">`:"-"}</td>
                  <td>${n.fmtDate(a.createdAt)}<small>${n.fmtDate(a.finishedAt)}</small></td>
                  <td>
                    <button type="button" data-detail="request:${e(a.id)}">详情</button>
                    ${["failed","cancelled","expired"].includes(a.status)&&a.queuePayloadJson?`<button type="button" data-generation-action="retry:${e(a.id)}">重试</button>`:""}
                    ${["pending","running"].includes(a.status)?`<button type="button" data-generation-action="cancel:${e(a.id)}">取消</button>`:""}
                    ${["succeeded","success"].includes(a.status)?"":`<button type="button" data-generation-action="mark-failed:${e(a.id)}">标记失败</button>`}
                    <button type="button" data-generation-copy-error="${e(a.id)}">复制错误</button>
                  </td>
                </tr>
              `).join("")||'<tr><td colspan="8">暂无生成请求</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>${n.pagination(o.length)}`}function y({item:t,trace:n,helpers:o}){if(!t)return"";const i=p(t);return`
      ${t.imageUrl?`<img class="admin-drawer-image" src="${e(o.imageVariantUrl(t.imageUrl,"thumb"))}" alt="">`:""}
      <dl class="admin-detail-list">
        <dt>ID</dt><dd>${e(t.id)}</dd>
        <dt>状态</dt><dd>${e(t.status)} / ${e(t.queueStatus||"-")}</dd>
        <dt>用户</dt><dd>${e(t.userName||t.userEmail||t.userId||"-")}</dd>
        <dt>Provider</dt><dd>${e(b(t))}</dd>
        <dt>模型</dt><dd>${e($(t))}</dd>
        <dt>耗时</dt><dd>${o.fmtDuration(t.durationMs||t.latencyMs)}</dd>
        <dt>错误摘要</dt><dd>${e(i||"-")}</dd>
        <dt>Revised prompt</dt><dd>${e(t.revisedPrompt||"-")}</dd>
        <dt>提示词</dt><dd>${e(t.prompt||"-")}</dd>
      </dl>
      <div class="admin-drawer-actions">
        ${["pending","running"].includes(t.status)?`<button type="button" data-generation-action="cancel:${e(t.id)}">取消请求</button>`:""}
        ${["failed","cancelled","expired"].includes(t.status)&&t.queuePayloadJson?`<button type="button" data-generation-action="retry:${e(t.id)}">重试请求</button>`:""}
        ${["succeeded","success"].includes(t.status)?"":`<button type="button" data-generation-action="mark-failed:${e(t.id)}">标记失败</button>`}
        <button type="button" data-generation-copy-error="${e(t.id)}">复制错误摘要</button>
      </div>
      <h3>请求参数</h3><pre class="admin-code-block">${l(t.requestedParams)}</pre>
      <h3>规范化参数</h3><pre class="admin-code-block">${l(t.normalizedParams)}</pre>
      <h3>Provider 参数</h3><pre class="admin-code-block">${l(t.providerParams)}</pre>
      <h3>Provider 响应摘要</h3><pre class="admin-code-block">${l(t.providerResponse)}</pre>
      <h3>Trace 时间线</h3>
      <div class="admin-table-wrap primitive-table-wrap">
        <table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>时间</th><th>阶段</th><th>级别</th><th>消息</th><th>数据</th></tr></thead>
          <tbody>
            ${(n||[]).map(a=>`
              <tr>
                <td>${o.fmtDate(a.createdAt)}</td>
                <td>${e(a.stage||"-")}</td>
                <td><span class="admin-badge" data-status="${e(a.level||"info")}">${e(a.level||"info")}</span></td>
                <td>${e(a.message||"-")}</td>
                <td><pre class="admin-code-block compact">${l(a.data)}</pre></td>
              </tr>
            `).join("")||'<tr><td colspan="5">暂无 trace 记录</td></tr>'}
          </tbody>
        </table>
      </div>
    `}function S({root:t=document,state:n,api:o,refresh:i,render:a,confirmAction:P,toast:w}){t.querySelectorAll("[data-generation-filter]").forEach(r=>{r.addEventListener("change",()=>{n.generationDiagnostics.filters[r.dataset.generationFilter]=r.value}),r.addEventListener("input",()=>{n.generationDiagnostics.filters[r.dataset.generationFilter]=r.value})}),t.querySelectorAll("[data-generation-filter-refresh]").forEach(r=>{r.addEventListener("click",()=>i().then(a))}),t.querySelector("[data-generation-filter-clear]")?.addEventListener("click",async()=>{n.generationDiagnostics.filters={},await i(),a()}),t.querySelectorAll("[data-generation-copy-error]").forEach(r=>{r.addEventListener("click",async()=>{const d=n.generations.find(g=>g.id===r.dataset.generationCopyError),c=p(d)||d?.id||"";try{navigator.clipboard?.writeText&&await navigator.clipboard.writeText(c)}catch{}await o(`/api/admin/generations/${encodeURIComponent(r.dataset.generationCopyError)}/copy-error`,{method:"POST",body:"{}"}),w?.("错误摘要已复制")})}),t.querySelectorAll("[data-generation-action]").forEach(r=>{r.addEventListener("click",async()=>{const[d,c]=r.dataset.generationAction.split(":"),g=d==="mark-failed"?prompt("失败备注","admin marked failed")||"admin marked failed":"";await P({title:d==="retry"?"重试生成请求":d==="cancel"?"取消生成请求":"标记生成失败",message:`确认 ${d} ${c}？`,confirmText:d==="retry"?"重试":d==="cancel"?"取消请求":"标记失败",danger:d!=="retry"})&&(await o(`/api/admin/generations/${encodeURIComponent(c)}/${encodeURIComponent(d)}`,{method:"POST",body:JSON.stringify({note:g})}),await i(),a())})})}u.AdminModules=u.AdminModules||{},u.AdminModules.generationDiagnostics={render:h,renderDrawer:y,bind:S,errorSummary:p}})(window);
