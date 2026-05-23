(function initAdminGenerationDiagnostics(global) {
  "use strict";

  const stageOptions = ["queue", "credit_reserved", "provider_generation", "provider_edit", "provider_failed", "admin"];
  const statusOptions = ["pending", "running", "queued", "polling", "succeeded", "success", "failed", "cancelled"];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function jsonBlock(value) {
    try {
      return escapeHtml(JSON.stringify(value ?? {}, null, 2));
    } catch {
      return escapeHtml(String(value ?? ""));
    }
  }

  function fieldValue(state, key) {
    return escapeHtml(state.generationDiagnostics?.filters?.[key] || "");
  }

  function providerLabel(item = {}) {
    return item.providerParams?.provider || item.providerParams?.name || item.providerParams?.endpoint || "-";
  }

  function modelLabel(item = {}) {
    return item.model || item.normalizedParams?.model || item.providerParams?.model || "-";
  }

  function errorSummary(item = {}) {
    return [
      item.errorStage || item.failureStage || "",
      item.errorCode || "",
      item.errorMessage || ""
    ].filter(Boolean).join(" | ");
  }

  function renderToolbar({ state }) {
    return `
      <div class="admin-toolbar generation-diagnostics-toolbar">
        <label><i class="ri-search-line"></i><input data-generation-filter="user" value="${fieldValue(state, "user")}" placeholder="用户 ID、姓名或邮箱"></label>
        <label><input data-generation-filter="provider" value="${fieldValue(state, "provider")}" placeholder="Provider"></label>
        <label><input data-generation-filter="model" value="${fieldValue(state, "model")}" placeholder="模型"></label>
        <select data-generation-filter="status">
          <option value="">全部状态</option>
          ${statusOptions.map((status) => `<option value="${status}"${state.generationDiagnostics?.filters?.status === status ? " selected" : ""}>${status}</option>`).join("")}
        </select>
        <select data-generation-filter="errorStage">
          <option value="">全部错误阶段</option>
          ${stageOptions.map((stage) => `<option value="${stage}"${state.generationDiagnostics?.filters?.errorStage === stage ? " selected" : ""}>${stage}</option>`).join("")}
        </select>
        <label><input type="datetime-local" data-generation-filter="dateFrom" value="${fieldValue(state, "dateFrom")}" aria-label="开始时间"></label>
        <label><input type="datetime-local" data-generation-filter="dateTo" value="${fieldValue(state, "dateTo")}" aria-label="结束时间"></label>
        <button type="button" data-generation-filter-refresh><i class="ri-filter-3-line"></i>筛选</button>
        <button type="button" data-generation-filter-clear>清空</button>
      </div>
    `;
  }

  function render({ state, helpers }) {
    const items = state.generations || [];
    const pageItems = helpers.paged(items);
    return `${renderToolbar({ state })}
      <section class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>生成请求诊断</h2>
            <span>${helpers.fmtNumber(items.length)} 条请求 · trace / provider / credit / queue</span>
          </div>
          <button type="button" data-generation-filter-refresh><i class="ri-refresh-line"></i>刷新诊断</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>状态</th><th>用户</th><th>Provider / 模型</th><th>耗时/积分</th><th>错误阶段</th><th>结果</th><th>时间</th><th></th></tr></thead>
            <tbody>
              ${pageItems.map((item) => `
                <tr>
                  <td><span class="admin-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span><small>${escapeHtml(item.queueStatus || "-")} · ${escapeHtml(item.attemptCount ?? 0)}/${escapeHtml(item.maxAttempts ?? 1)}</small></td>
                  <td>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}<small>${escapeHtml(item.userEmail || item.userId || "")}</small></td>
                  <td>${escapeHtml(providerLabel(item))}<small>${escapeHtml(modelLabel(item))}</small></td>
                  <td>${helpers.fmtDuration(item.durationMs || item.latencyMs)}<small>${escapeHtml(String(item.normalizedParams?.n || item.requestedParams?.n || 1))} 张</small></td>
                  <td>${escapeHtml(item.errorStage || item.failureStage || "-")}<small class="admin-truncate">${escapeHtml(item.errorCode || item.errorMessage || "")}</small></td>
                  <td>${item.imageUrl ? `<img class="admin-diagnostics-thumb" src="${escapeHtml(helpers.imageVariantUrl(item.imageUrl))}" alt="">` : "-"}</td>
                  <td>${helpers.fmtDate(item.createdAt)}<small>${helpers.fmtDate(item.finishedAt)}</small></td>
                  <td>
                    <button type="button" data-detail="request:${escapeHtml(item.id)}">详情</button>
                    ${["failed", "cancelled", "expired"].includes(item.status) && item.queuePayloadJson ? `<button type="button" data-generation-action="retry:${escapeHtml(item.id)}">重试</button>` : ""}
                    ${["pending", "running"].includes(item.status) ? `<button type="button" data-generation-action="cancel:${escapeHtml(item.id)}">取消</button>` : ""}
                    ${!["succeeded", "success"].includes(item.status) ? `<button type="button" data-generation-action="mark-failed:${escapeHtml(item.id)}">标记失败</button>` : ""}
                    <button type="button" data-generation-copy-error="${escapeHtml(item.id)}">复制错误</button>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="8">暂无生成请求</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>${helpers.pagination(items.length)}`;
  }

  function renderDrawer({ item, trace, helpers }) {
    if (!item) return "";
    const summary = errorSummary(item);
    return `
      ${item.imageUrl ? `<img class="admin-drawer-image" src="${escapeHtml(helpers.imageVariantUrl(item.imageUrl, "thumb"))}" alt="">` : ""}
      <dl class="admin-detail-list">
        <dt>ID</dt><dd>${escapeHtml(item.id)}</dd>
        <dt>状态</dt><dd>${escapeHtml(item.status)} / ${escapeHtml(item.queueStatus || "-")}</dd>
        <dt>用户</dt><dd>${escapeHtml(item.userName || item.userEmail || item.userId || "-")}</dd>
        <dt>Provider</dt><dd>${escapeHtml(providerLabel(item))}</dd>
        <dt>模型</dt><dd>${escapeHtml(modelLabel(item))}</dd>
        <dt>耗时</dt><dd>${helpers.fmtDuration(item.durationMs || item.latencyMs)}</dd>
        <dt>错误摘要</dt><dd>${escapeHtml(summary || "-")}</dd>
        <dt>Revised prompt</dt><dd>${escapeHtml(item.revisedPrompt || "-")}</dd>
        <dt>提示词</dt><dd>${escapeHtml(item.prompt || "-")}</dd>
      </dl>
      <div class="admin-drawer-actions">
        ${["pending", "running"].includes(item.status) ? `<button type="button" data-generation-action="cancel:${escapeHtml(item.id)}">取消请求</button>` : ""}
        ${["failed", "cancelled", "expired"].includes(item.status) && item.queuePayloadJson ? `<button type="button" data-generation-action="retry:${escapeHtml(item.id)}">重试请求</button>` : ""}
        ${!["succeeded", "success"].includes(item.status) ? `<button type="button" data-generation-action="mark-failed:${escapeHtml(item.id)}">标记失败</button>` : ""}
        <button type="button" data-generation-copy-error="${escapeHtml(item.id)}">复制错误摘要</button>
      </div>
      <h3>请求参数</h3><pre class="admin-code-block">${jsonBlock(item.requestedParams)}</pre>
      <h3>规范化参数</h3><pre class="admin-code-block">${jsonBlock(item.normalizedParams)}</pre>
      <h3>Provider 参数</h3><pre class="admin-code-block">${jsonBlock(item.providerParams)}</pre>
      <h3>Provider 响应摘要</h3><pre class="admin-code-block">${jsonBlock(item.providerResponse)}</pre>
      <h3>Trace 时间线</h3>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>时间</th><th>阶段</th><th>级别</th><th>消息</th><th>数据</th></tr></thead>
          <tbody>
            ${(trace || []).map((entry) => `
              <tr>
                <td>${helpers.fmtDate(entry.createdAt)}</td>
                <td>${escapeHtml(entry.stage || "-")}</td>
                <td><span class="admin-badge" data-status="${escapeHtml(entry.level || "info")}">${escapeHtml(entry.level || "info")}</span></td>
                <td>${escapeHtml(entry.message || "-")}</td>
                <td><pre class="admin-code-block compact">${jsonBlock(entry.data)}</pre></td>
              </tr>
            `).join("") || `<tr><td colspan="5">暂无 trace 记录</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function bind({ root = document, state, api, refresh, render, confirmAction, toast }) {
    root.querySelectorAll("[data-generation-filter]").forEach((input) => {
      input.addEventListener("change", () => {
        state.generationDiagnostics.filters[input.dataset.generationFilter] = input.value;
      });
      input.addEventListener("input", () => {
        state.generationDiagnostics.filters[input.dataset.generationFilter] = input.value;
      });
    });
    root.querySelectorAll("[data-generation-filter-refresh]").forEach((button) => {
      button.addEventListener("click", () => refresh().then(render));
    });
    root.querySelector("[data-generation-filter-clear]")?.addEventListener("click", async () => {
      state.generationDiagnostics.filters = {};
      await refresh();
      render();
    });
    root.querySelectorAll("[data-generation-copy-error]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = state.generations.find((entry) => entry.id === button.dataset.generationCopyError);
        const text = errorSummary(item) || item?.id || "";
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard may be unavailable outside secure browser contexts.
        }
        await api(`/api/admin/generations/${encodeURIComponent(button.dataset.generationCopyError)}/copy-error`, { method: "POST", body: "{}" });
        toast?.("错误摘要已复制");
      });
    });
    root.querySelectorAll("[data-generation-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const [action, id] = button.dataset.generationAction.split(":");
        const note = action === "mark-failed" ? (prompt("失败备注", "admin marked failed") || "admin marked failed") : "";
        if (!(await confirmAction({
          title: action === "retry" ? "重试生成请求" : action === "cancel" ? "取消生成请求" : "标记生成失败",
          message: `确认 ${action} ${id}？`,
          confirmText: action === "retry" ? "重试" : action === "cancel" ? "取消请求" : "标记失败",
          danger: action !== "retry"
        }))) return;
        await api(`/api/admin/generations/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
          method: "POST",
          body: JSON.stringify({ note })
        });
        await refresh();
        render();
      });
    });
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules.generationDiagnostics = {
    render,
    renderDrawer,
    bind,
    errorSummary
  };
})(window);
