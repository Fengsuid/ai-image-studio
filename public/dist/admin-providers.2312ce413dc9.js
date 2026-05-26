(function(){window.AdminModules=window.AdminModules||{},window.AdminModules.providers={render({state:d,helpers:n}){const{escapeHtml:t,renderPlaceholder:s}=n;return`
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>API 供应商</h2>
            <button type="button" data-create-provider><i class="ri-add-line"></i> 新增 Provider</button>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>名称</th><th>Base URL</th><th>模型</th><th>能力</th><th>健康</th><th>状态</th><th></th></tr></thead>
              <tbody>
                ${d.providers.map(a=>`
                  <tr>
                    <td><strong>${t(a.name)}${a.id===d.defaultProviderId?" · 默认":""}</strong><small>${t(a.providerType)} · ${t(a.apiKeyMask||"no key")}</small></td>
                    <td class="admin-truncate">${t(a.baseUrl||"-")}</td>
                    <td>${t(a.defaultModel||"-")}</td>
                    <td class="admin-truncate">${t(e(a))}</td>
                    <td><span class="admin-badge" data-status="${t(a.healthStatus||"unknown")}">${t(a.healthStatus||"unknown")}</span><small>${t(a.lastError||"")}</small></td>
                    <td><span class="admin-badge" data-status="${t(a.status)}">${t(a.status)}</span></td>
                    <td>
                      <button type="button" data-detail="provider:${t(a.id)}">编辑</button>
                      <button type="button" data-provider-test="${t(a.id)}">测试</button>
                      ${a.id===d.defaultProviderId?"":`<button type="button" data-provider-default="${t(a.id)}">设默认</button>`}
                    </td>
                  </tr>
                `).join("")||'<tr><td colspan="7">暂无 Provider</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
        ${s("Provider Router 预留","ri-route-line",["T019 将把生成和编辑接口改为 provider-router。","当前 T018 已提供 provider_configs、CRUD、测试连接和默认供应商。"])}`}};function e(d){const n=d.capabilities||{};return Object.entries(n).filter(([,t])=>t===!0).map(([t])=>t).join(", ")||"-"}})();
