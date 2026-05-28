(function initAdminPromptsDomain(global, document) {
  "use strict";

  const domains = global.AdminDomains || (global.AdminDomains = {});

  function renderPrompts(core) {
    const { state, escapeHtml, fmtNumber, fmtDate, toolbar, filtered, paged, pagination } = core;
    const items = filtered(state.prompts, ["title", "prompt", "author", "status", "category", "sourceRepo", "sourceCategory"]);
    return `${toolbar("搜索标题、提示词、作者", ["active", "hidden"])}
      <section class="admin-panel">
        <div class="admin-panel-head"><h2>远程来源</h2><button type="button" data-create-prompt-source>新建来源</button></div>
        <div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><thead><tr><th>来源</th><th>仓库</th><th>状态</th><th>最近同步</th><th>结果</th><th></th></tr></thead><tbody>
          ${(state.promptSources || []).map((source) => `<tr><td><strong>${escapeHtml(source.name || source.id)}</strong><small>${escapeHtml(source.sourceType || "")}</small></td><td>${escapeHtml(source.repoUrl || "-")}<small>${escapeHtml(source.branch || "main")}</small></td><td><span class="admin-badge" data-status="${escapeHtml(source.status)}">${escapeHtml(source.status)}</span></td><td>${fmtDate(source.lastSyncedAt)}<small>${escapeHtml(source.lastStatus || "never")}</small></td><td>${fmtNumber(source.lastSuccessCount)} 成功 / ${fmtNumber(source.lastFailureCount)} 失败<small>${escapeHtml(source.lastError || "")}</small></td><td><button type="button" data-detail="promptSource:${escapeHtml(source.id)}">编辑</button><button type="button" data-prompt-source-sync="${escapeHtml(source.id)}">同步</button></td></tr>`).join("") || `<tr><td colspan="6">暂无远程来源</td></tr>`}
        </tbody></table></div>
      </section>
      <section class="admin-panel">
        <div class="admin-panel-head"><h2>重复候选</h2><button type="button" data-scan-prompt-duplicates>扫描候选</button><span>${fmtNumber(state.promptDuplicates.length)} 组需人工确认</span></div>
        <div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><thead><tr><th>提示词 A</th><th>提示词 B</th><th>召回</th><th>处理</th></tr></thead><tbody>
          ${state.promptDuplicates.map((item) => `<tr><td><strong>${escapeHtml(item.prompt?.title || `#${item.promptId}`)}</strong><small class="admin-truncate">${escapeHtml(item.prompt?.prompt || "")}</small></td><td><strong>${escapeHtml(item.duplicate?.title || `#${item.duplicatePromptId}`)}</strong><small class="admin-truncate">${escapeHtml(item.duplicate?.prompt || "")}</small></td><td>${escapeHtml(item.method || "")}<small>score ${Number(item.score || 0).toFixed(4)} · AI ${escapeHtml(item.aiReview?.decision || item.llmReview || "not_reviewed")}</small></td><td><button type="button" data-detail="prompt:${item.promptId}">编辑 A</button><button type="button" data-detail="prompt:${item.duplicatePromptId}">编辑 B</button><button type="button" data-duplicate-ai-review="${item.id}">AI 复核</button><button type="button" data-duplicate-action="keep:${item.id}">保留</button><button type="button" data-duplicate-action="confirm:${item.id}">确认重复</button><button type="button" data-duplicate-action="hide_duplicate:${item.id}">隐藏 B</button></td></tr>`).join("") || `<tr><td colspan="4">暂无重复候选</td></tr>`}
        </tbody></table></div>
      </section>
      <section class="admin-panel">
        <div class="admin-panel-head"><h2>提示词 CMS</h2><button type="button" data-create-prompt>新建提示词</button></div>
        <div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><thead><tr><th>标题</th><th>分类/标签</th><th>来源</th><th>状态</th><th>互动</th><th>排序</th><th></th></tr></thead><tbody>
          ${paged(items).map((prompt) => `<tr><td><strong>${escapeHtml(prompt.title || `#${prompt.id}`)}</strong><small class="admin-truncate">${escapeHtml(prompt.prompt || "")}</small></td><td><strong>${escapeHtml(prompt.category || "general")}</strong><small>${escapeHtml((prompt.tags || []).join(", "))}</small></td><td>${escapeHtml(prompt.sourceRepo || prompt.source || "-")}<small>${escapeHtml(prompt.remoteId || prompt.sourceCategory || prompt.author || "")}</small></td><td><span class="admin-badge" data-status="${escapeHtml(prompt.status)}">${escapeHtml(prompt.status)}</span></td><td>Like ${fmtNumber(prompt.likeCount)} / Use ${fmtNumber(prompt.useCount)}</td><td>${fmtNumber(prompt.sortOrder)}</td><td><button type="button" data-detail="prompt:${prompt.id}">编辑</button></td></tr>`).join("")}
        </tbody></table></div>${pagination(items.length)}
      </section>`;
  }

  function renderTags(core) {
    const { state, escapeHtml, fmtNumber, toolbar, filtered, paged, pagination } = core;
    const items = filtered(state.tags, ["slug", "labelZh", "labelEn", "category", "status"]);
    const categories = [...(state.promptCategories || [])].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || String(left.slug).localeCompare(String(right.slug)));
    return `${toolbar("搜索 slug、中文名、分类", ["active", "hidden"])}
      <section class="admin-panel"><div class="admin-panel-head"><h2>提示词分类</h2><button type="button" data-create-category>新建分类</button></div><div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><tbody>
        ${categories.map((category) => `<tr><td><strong>${escapeHtml(category.slug)}</strong></td><td>${escapeHtml(category.labelZh || "")}<small>${escapeHtml(category.labelEn || "")}</small></td><td>${escapeHtml(category.status)}</td><td>${fmtNumber(category.sortOrder || 0)}</td><td><button type="button" data-detail="category:${escapeHtml(category.slug)}">编辑</button></td></tr>`).join("") || `<tr><td colspan="5">暂无分类</td></tr>`}
      </tbody></table></div></section>
      <section class="admin-panel"><div class="admin-panel-head"><h2>标签库</h2><button type="button" data-create-tag>新建标签</button></div><div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><tbody>
        ${paged(items).map((tag) => `<tr><td><strong>${escapeHtml(tag.slug)}</strong><small>${escapeHtml(tag.source || "")}</small></td><td>${escapeHtml(tag.labelZh || "")}<small>${escapeHtml(tag.labelEn || "")}</small></td><td>${escapeHtml(tag.category || "-")}</td><td><span class="admin-badge" data-status="${escapeHtml(tag.status)}">${escapeHtml(tag.status)}</span></td><td>${fmtNumber(Number(tag.promptCount || 0) + Number(tag.galleryCount || 0))}</td><td><button type="button" data-detail="tag:${escapeHtml(tag.slug)}">编辑</button></td></tr>`).join("")}
      </tbody></table></div>${pagination(items.length)}</section>`;
  }

  function renderPromptAudit(core) {
    const { state, escapeHtml, fmtNumber, fmtDate, toolbar, filtered, paged, pagination } = core;
    const items = filtered(state.promptAudits, ["prompt", "userName", "userEmail", "status", "resultLevel", "resultAction", "matchedPromptTitle"]);
    return `${toolbar("搜索提示词、用户、状态或匹配项", ["blocked", "review", "allowed", "override_allowed", "reviewed"])}
      <section class="admin-panel"><div class="admin-panel-head"><h2>Prompt Audit</h2><span>${fmtNumber(items.length)} 条审计记录</span></div><div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><tbody>
      ${paged(items).map((item) => `<tr><td><strong>${escapeHtml(item.userName || item.userEmail || item.generationId || `#${item.id}`)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || "")}</small></td><td><span class="admin-badge" data-status="${escapeHtml(item.resultLevel)}">${escapeHtml(item.resultLevel)}</span><small>${escapeHtml(item.method || "none")} · score ${Number(item.score || 0).toFixed(4)}</small></td><td><strong>${escapeHtml(item.resultAction || "allow")}</strong></td><td><span class="admin-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span><div class="admin-card-actions"><button type="button" data-detail="promptAudit:${escapeHtml(item.id)}">详情</button><button type="button" data-prompt-audit-action="allow_text_to_image:${escapeHtml(item.id)}">允许文生图</button><button type="button" data-prompt-audit-action="require_image_to_image:${escapeHtml(item.id)}">要求图生图</button><button type="button" data-prompt-audit-action="mark_reviewed:${escapeHtml(item.id)}">标记已复核</button></div></td><td>${fmtDate(item.createdAt)}</td></tr>`).join("") || `<tr><td colspan="5">暂无 Prompt Audit 记录</td></tr>`}
      </tbody></table></div>${pagination(items.length)}</section>`;
  }

  function promptForm(core, title, item, fields, onSubmit) {
    const { openDrawer } = core;
    openDrawer(title, `<form id="adminDomainForm" class="admin-form-grid single">${fields(item).join("")}<button type="submit">保存</button></form>`);
    core.$("#adminDomainForm")?.addEventListener("submit", onSubmit);
  }

  function showDetail(core, type, id) {
    const { state, api, escapeHtml, refreshAndRender, closeDrawer, recordAudit, setStatus } = core;
    if (type === "promptSource") {
      const source = state.promptSources.find((item) => item.id === id) || {};
      promptForm(core, source.id ? "编辑远程来源" : "新建远程来源", source, (item) => [
        `<label>名称<input name="name" value="${escapeHtml(item.name || "")}" required></label>`,
        `<label>仓库 URL<input name="repoUrl" value="${escapeHtml(item.repoUrl || "")}" required></label>`,
        `<label>分支<input name="branch" value="${escapeHtml(item.branch || "main")}"></label>`,
        `<label>状态<select name="status"><option value="active"${item.status !== "disabled" ? " selected" : ""}>active</option><option value="disabled"${item.status === "disabled" ? " selected" : ""}>disabled</option></select></label>`
      ], async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await api(source.id ? `/api/admin/prompt-sources/${encodeURIComponent(source.id)}` : "/api/admin/prompt-sources", { method: source.id ? "PATCH" : "POST", body: JSON.stringify({ name: form.get("name"), repoUrl: form.get("repoUrl"), branch: form.get("branch"), status: form.get("status"), sourceType: source.sourceType || "github" }) });
        recordAudit(source.id ? "update_prompt_source" : "create_prompt_source", source.id || String(form.get("name")), "");
        await refreshAndRender();
        closeDrawer();
      });
      return;
    }
    if (type === "prompt" || type === "tag" || type === "category") {
      const item = type === "prompt" ? state.prompts.find((entry) => String(entry.id) === id) : type === "tag" ? state.tags.find((entry) => entry.slug === id) : state.promptCategories.find((entry) => entry.slug === id);
      core.openDrawer(type === "prompt" ? "提示词详情" : type === "tag" ? "标签详情" : "分类详情", `<pre class="admin-code-block">${escapeHtml(JSON.stringify(item || {}, null, 2))}</pre>`);
      return;
    }
    if (type === "promptAudit") {
      api(`/api/admin/prompt-audits/${encodeURIComponent(id)}`).then((response) => core.openDrawer("Prompt Audit 详情", `<pre class="admin-code-block">${escapeHtml(JSON.stringify(response.audit || {}, null, 2))}</pre>`)).catch((error) => setStatus(error.message, "danger"));
    }
  }

  function bind(core) {
    const { api, confirmAction, recordAudit, refreshAndRender } = core;
    core.$("[data-create-prompt]")?.addEventListener("click", () => showDetail(core, "prompt", ""));
    core.$("[data-create-prompt-source]")?.addEventListener("click", () => showDetail(core, "promptSource", ""));
    document.querySelectorAll("[data-prompt-source-sync]").forEach((button) => button.addEventListener("click", async () => {
      await api(`/api/admin/prompt-sources/${encodeURIComponent(button.dataset.promptSourceSync)}/sync`, { method: "POST", body: "{}" });
      recordAudit("sync_prompt_source", button.dataset.promptSourceSync, "");
      await refreshAndRender();
    }));
    core.$("[data-scan-prompt-duplicates]")?.addEventListener("click", async () => {
      await api("/api/admin/prompt-duplicates/scan", { method: "POST", body: JSON.stringify({ limit: 2000, hammingThreshold: 6, aiReview: true, aiReviewLimit: 12 }) });
      recordAudit("scan_prompt_duplicates", "prompt", "manual scan");
      await refreshAndRender();
    });
    document.querySelectorAll("[data-duplicate-ai-review]").forEach((button) => button.addEventListener("click", async () => {
      await api(`/api/admin/prompt-duplicates/${encodeURIComponent(button.dataset.duplicateAiReview)}/ai-review`, { method: "POST", body: "{}" });
      await refreshAndRender();
    }));
    document.querySelectorAll("[data-duplicate-action],[data-prompt-audit-action]").forEach((button) => button.addEventListener("click", async () => {
      const attr = button.dataset.duplicateAction ? "duplicateAction" : "promptAuditAction";
      const [action, id] = button.dataset[attr].split(":");
      if (!(await confirmAction({ title: "确认处理", message: `${action} #${id}？`, confirmText: "处理", danger: /hide|require/.test(action) }))) return;
      await api(attr === "duplicateAction" ? `/api/admin/prompt-duplicates/${encodeURIComponent(id)}` : `/api/admin/prompt-audits/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ action, note: "" }) });
      await refreshAndRender();
    }));
  }

  domains.prompts = { renderPrompts, renderTags, renderPromptAudit, showDetail, bind };
})(window, document);
