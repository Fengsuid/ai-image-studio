(function initAdminCanvasDomain(global, document) {
  "use strict";

  const domains = global.AdminDomains || (global.AdminDomains = {});

  function renderWithdrawals(core) {
    const { state, escapeHtml, fmtNumber, fmtDate } = core;
    return `<section class="admin-panel"><div class="admin-panel-head"><h2>举报队列</h2><span>${fmtNumber(state.reports.length)} 条记录</span></div><div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><tbody>
      ${state.reports.map((item) => `<tr><td><strong>${escapeHtml(item.id)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || "")}</small></td><td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</td><td><span class="admin-badge" data-status="${escapeHtml(item.moderationStatus || "visible")}">${escapeHtml(item.moderationStatus || "visible")}</span></td><td>${fmtNumber(item.reportCount || 0)}</td><td>${escapeHtml(item.latestReportReason || item.moderationReason || "-")}</td><td>${item.moderationStatus === "hidden" ? `<button type="button" data-moderation="restore:${escapeHtml(item.id)}">恢复</button>` : `<button type="button" data-moderation="hide:${escapeHtml(item.id)}">确认隐藏</button><button type="button" data-moderation="reject:${escapeHtml(item.id)}">驳回举报并恢复</button>`}</td></tr>`).join("") || `<tr><td colspan="6">暂无举报</td></tr>`}
    </tbody></table></div></section>
    <section class="admin-panel"><div class="admin-panel-head"><h2>举报与撤回</h2><span>${fmtNumber(state.withdrawals.length)} 条记录</span></div><div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><tbody>
      ${state.withdrawals.map((item) => `<tr><td><strong>${escapeHtml(item.id)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || "")}</small></td><td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</td><td><span class="admin-badge" data-status="${escapeHtml(item.withdrawalStatus)}">${escapeHtml(item.withdrawalStatus)}</span></td><td>${fmtDate(item.publishedAt)}</td><td>${fmtDate(item.withdrawalRequestedAt)}</td><td>${escapeHtml(item.withdrawalReason || "-")}</td><td>${item.withdrawalStatus === "requested" ? `<button type="button" data-withdrawal-decision="approved:${escapeHtml(item.id)}">批准</button><button type="button" data-withdrawal-decision="rejected:${escapeHtml(item.id)}">拒绝</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7">暂无撤回申请</td></tr>`}
    </tbody></table></div></section>`;
  }

  function renderGrowth(core) {
    const { state, escapeHtml, fmtNumber, fmtDate, renderPlaceholder } = core;
    return `<section class="admin-panel"><div class="admin-panel-head"><h2>增长配置</h2><span>Growth JSON 只读摘要</span></div><pre class="admin-code-block">${escapeHtml(JSON.stringify(state.settings?.growthConfig || state.settings?.growth || {}, null, 2))}</pre></section>
    <section class="admin-panel"><div class="admin-panel-head"><h2>画廊点赞排行榜</h2><span>${fmtNumber(state.galleryLeaderboard.length)} 条热门作品</span></div><div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><tbody>
      ${state.galleryLeaderboard.map((item, index) => `<tr><td><strong>#${index + 1} ${escapeHtml(item.id)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || "")}</small></td><td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</td><td><strong>${fmtNumber(item.likeCount || 0)}</strong></td><td class="admin-truncate">${escapeHtml((item.publicTags || []).join(", "))}</td><td>${fmtDate(item.createdAt)}</td><td><button type="button" data-detail="work:${escapeHtml(item.id)}">详情</button></td></tr>`).join("") || `<tr><td colspan="6">暂无点赞榜数据</td></tr>`}
    </tbody></table></div></section>
    <section class="admin-panel"><div class="admin-panel-head"><h2>异常点赞检查</h2><span>${fmtNumber(state.galleryLikeAnomalies.length)} 个 24h 高频账号</span></div><div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact"><tbody>
      ${state.galleryLikeAnomalies.map((item) => `<tr><td><strong>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</strong><small>${escapeHtml(item.userId || "")}</small></td><td>${fmtNumber(item.likeCount || 0)}</td><td>${fmtDate(item.firstLikeAt)}</td><td>${fmtDate(item.lastLikeAt)}</td></tr>`).join("") || `<tr><td colspan="4">暂无异常点赞记录</td></tr>`}
    </tbody></table></div></section>
    ${renderPlaceholder("运营增长工作台预留", "ri-line-chart-line", ["推荐位、榜单、活动和奖励配置保持独立入口。", "图片点赞排行榜、异常点赞检查已接入。"])}`;
  }

  function workDrawer(core, item) {
    if (!item) return;
    const { escapeHtml, openDrawer } = core;
    openDrawer("公开作品详情", `<img class="admin-drawer-image" src="${escapeHtml(item.imageUrl)}" alt=""><dl class="admin-detail-list"><dt>ID</dt><dd>${escapeHtml(item.id)}</dd><dt>作者</dt><dd>${escapeHtml(item.userName || item.userId || "-")}</dd><dt>标签</dt><dd>${escapeHtml((item.publicTags || []).join(", ")) || "-"}</dd><dt>提示词</dt><dd>${escapeHtml(item.prompt || "-")}</dd></dl>`);
  }

  function providerDrawer(core, provider = {}) {
    const { escapeHtml, openDrawer, api, recordAudit, refreshAndRender, closeDrawer, confirmAction, setStatus } = core;
    const isNew = !provider.id;
    openDrawer(isNew ? "新增 Provider" : "编辑 Provider", `<form id="drawerProviderForm" class="admin-form-grid single">
      <label>名称<input name="name" value="${escapeHtml(provider.name || "")}" required></label>
      <label>类型<select name="providerType">${["openai", "openai-compatible", "custom-proxy"].map((type) => `<option value="${type}"${(provider.providerType || "openai-compatible") === type ? " selected" : ""}>${type}</option>`).join("")}</select></label>
      <label>Base URL<input name="baseUrl" value="${escapeHtml(provider.baseUrl || "")}" required></label>
      <label>API Key<input name="apiKey" type="password" placeholder="${escapeHtml(provider.apiKeyMask || "留空则保持不变")}"></label>
      <label>默认模型<input name="defaultModel" value="${escapeHtml(provider.defaultModel || "gpt-image-2")}"></label>
      <label>状态<select name="status"><option value="active"${provider.status !== "disabled" ? " selected" : ""}>active</option><option value="disabled"${provider.status === "disabled" ? " selected" : ""}>disabled</option></select></label>
      <label>能力 JSON<textarea name="capabilities" rows="8">${escapeHtml(JSON.stringify(provider.capabilities || {}, null, 2))}</textarea></label>
      <label>路由 JSON<textarea name="routing" rows="5">${escapeHtml(JSON.stringify(provider.routing || {}, null, 2))}</textarea></label>
      <label>Provider Mapping JSON<textarea name="mapping" rows="10">${escapeHtml(JSON.stringify(provider.mapping || {}, null, 2))}</textarea></label>
      <button type="submit">${isNew ? "创建 Provider" : "保存 Provider"}</button>
    </form>`);
    core.$("#drawerProviderForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      let capabilities, routing, mapping;
      try {
        capabilities = JSON.parse(form.get("capabilities") || "{}");
        routing = JSON.parse(form.get("routing") || "{}");
        mapping = JSON.parse(form.get("mapping") || "{}");
      } catch {
        setStatus("Provider JSON 格式错误", "danger");
        return;
      }
      const payload = { name: form.get("name"), providerType: form.get("providerType"), baseUrl: form.get("baseUrl"), defaultModel: form.get("defaultModel"), status: form.get("status"), capabilities, routing, mapping };
      const apiKey = String(form.get("apiKey") || "").trim();
      if (isNew || apiKey) payload.apiKey = apiKey;
      await api(isNew ? "/api/admin/providers" : `/api/admin/providers/${encodeURIComponent(provider.id)}`, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) });
      recordAudit(isNew ? "create_provider" : "update_provider", provider.id || String(payload.name), payload.baseUrl);
      await refreshAndRender();
      closeDrawer();
    });
    core.$("[data-delete-provider]")?.addEventListener("click", async () => {
      if (!(await confirmAction({ title: "删除 Provider", message: `确认删除 ${provider.name}？`, confirmText: "删除", danger: true }))) return;
      await api(`/api/admin/providers/${encodeURIComponent(provider.id)}`, { method: "DELETE" });
      await refreshAndRender();
    });
  }

  function bind(core) {
    document.querySelectorAll("[data-provider-test],[data-provider-default],[data-withdrawal-decision],[data-moderation]").forEach((button) => button.addEventListener("click", async () => {
      if (button.dataset.providerTest) {
        await core.api(`/api/admin/providers/${encodeURIComponent(button.dataset.providerTest)}/test`, { method: "POST", body: "{}" });
      } else if (button.dataset.providerDefault) {
        await core.api(`/api/admin/providers/${encodeURIComponent(button.dataset.providerDefault)}/set-default`, { method: "POST", body: "{}" });
      } else if (button.dataset.withdrawalDecision) {
        const [decision, id] = button.dataset.withdrawalDecision.split(":");
        await core.api(`/api/admin/withdrawals/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ decision, reason: "" }) });
      } else if (button.dataset.moderation) {
        const [action, id] = button.dataset.moderation.split(":");
        await core.api(`/api/admin/public-images/${encodeURIComponent(id)}/moderation`, { method: "PATCH", body: JSON.stringify({ action, reason: "policy_review" }) });
      }
      await core.refreshAndRender();
    }));
    document.querySelector("[data-gallery-file-check-run]")?.addEventListener("click", async () => {
      core.setStatus("正在巡检画廊文件...", "loading");
      const result = await core.api("/api/admin/gallery-file-checks/run", { method: "POST", body: JSON.stringify({ limit: 5000 }) });
      await core.refreshAndRender();
      core.setStatus(`巡检完成：${core.fmtNumber(result.checked || 0)} 个文件`, result.broken ? "warn" : "ok");
    });
  }

  domains.canvas = { renderWithdrawals, renderGrowth, workDrawer, providerDrawer, bind };
})(window, document);
