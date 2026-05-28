(function () {
  window.AdminModules = window.AdminModules || {};

  window.AdminModules.providers = {
    render({ state, helpers }) {
      const { escapeHtml, renderPlaceholder } = helpers;
      return `
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>API 供应商</h2>
            <button type="button" data-create-provider><i class="ri-add-line"></i> 新增 Provider</button>
          </div>
          <div class="admin-table-wrap primitive-table-wrap">
            <table class="admin-table primitive-table" data-density="compact">
              <thead><tr><th>名称</th><th>Base URL</th><th>模型</th><th>能力</th><th>健康</th><th>状态</th><th></th></tr></thead>
              <tbody>
                ${state.providers.map((provider) => `
                  <tr>
                    <td><strong>${escapeHtml(provider.name)}${provider.id === state.defaultProviderId ? " · 默认" : ""}</strong><small>${escapeHtml(provider.providerType)} · ${escapeHtml(provider.apiKeyMask || "no key")}</small></td>
                    <td class="admin-truncate">${escapeHtml(provider.baseUrl || "-")}</td>
                    <td>${escapeHtml(provider.defaultModel || "-")}</td>
                    <td class="admin-truncate">${escapeHtml(providerCapabilityText(provider))}</td>
                    <td><span class="admin-badge" data-status="${escapeHtml(provider.healthStatus || "unknown")}">${escapeHtml(provider.healthStatus || "unknown")}</span><small>${escapeHtml(provider.lastError || "")}</small></td>
                    <td><span class="admin-badge" data-status="${escapeHtml(provider.status)}">${escapeHtml(provider.status)}</span></td>
                    <td>
                      <button type="button" data-detail="provider:${escapeHtml(provider.id)}">编辑</button>
                      <button type="button" data-provider-test="${escapeHtml(provider.id)}">测试</button>
                      ${provider.id === state.defaultProviderId ? "" : `<button type="button" data-provider-default="${escapeHtml(provider.id)}">设默认</button>`}
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="7">暂无 Provider</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
        ${renderPlaceholder("Provider Router 预留", "ri-route-line", [
          "T019 将把生成和编辑接口改为 provider-router。",
          "当前 T018 已提供 provider_configs、CRUD、测试连接和默认供应商。"
        ])}`;
    }
  };

  function providerCapabilityText(provider) {
    const caps = provider.capabilities || {};
    return Object.entries(caps).filter(([, value]) => value === true).map(([key]) => key).join(", ") || "-";
  }
})();
