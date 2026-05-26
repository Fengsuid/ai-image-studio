(function(){window.AdminModules=window.AdminModules||{},window.AdminModules.users={render({state:e,helpers:n}){const{escapeHtml:a,fmtNumber:d,fmtDate:o,toolbar:r,filtered:c,paged:b,pagination:u,emptyState:m}=n,l=c(e.users,["name","email","role","status"]),p=b(l);return`${r("搜索用户姓名、邮箱或角色",["active","disabled","admin","user"])}
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>用户与积分</h2>
            <button type="button" data-create-user><i class="ri-user-add-line"></i> 新建用户</button>
          </div>
          <div class="admin-bulk-bar admin-bulk-bar-polished" role="region" aria-label="用户批量操作">
            <div class="admin-bulk-summary">
              <i class="ri-checkbox-multiple-line" aria-hidden="true"></i>
              <strong>已选 ${d(e.selectedUsers.size)} 个用户</strong>
              <span>批量操作仅作用于当前勾选用户；不会默认覆盖全部搜索结果。</span>
            </div>
            <div class="admin-bulk-controls">
              <select id="bulkUserAction" aria-label="批量操作类型">
                <option value="creditDelta">调整积分</option>
                <option value="status">修改状态</option>
              </select>
              <input id="bulkCreditDelta" type="number" value="1" aria-label="积分调整">
              <select id="bulkStatus" aria-label="状态"><option value="active">active</option><option value="disabled">disabled</option></select>
              <input id="bulkNote" placeholder="备注" aria-label="批量操作备注">
              <button type="button" data-bulk-users>应用到已选</button>
            </div>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table admin-table-polished admin-user-table">
              <thead><tr><th><input type="checkbox" data-select-page-users aria-label="选择当前页用户"></th><th>用户</th><th>角色</th><th>状态</th><th>积分</th><th>首发奖励</th><th>注册时间</th><th></th></tr></thead>
              <tbody>
                ${p.map(t=>{const i=t.firstPublicRewardStatus&&t.firstPublicRewardStatus!=="none"?{status:t.firstPublicRewardStatus,amount:t.firstPublicRewardAmount,referenceId:t.firstPublicRewardGenerationId}:e.rewardLedger.find(s=>s.userId===t.id&&s.rewardType==="first_public");return`
                    <tr>
                      <td class="admin-selection-cell"><input type="checkbox" data-user-select="${a(t.id)}"${e.selectedUsers.has(t.id)?" checked":""} aria-label="选择 ${a(t.name||t.email)}"></td>
                      <td><strong>${a(t.name||t.email)}</strong><small>${a(t.email)}</small></td>
                      <td>${a(t.role)}</td>
                      <td><span class="admin-badge" data-status="${a(t.status)}">${a(t.status)}</span></td>
                      <td>${d(t.credits)}</td>
                      <td>${i?`${a(i.status)} · ${d(i.amount)}<small>${a(i.referenceId||"")}</small>`:"未发放"}</td>
                      <td>${o(t.createdAt)}</td>
                      <td><button type="button" class="admin-row-action" data-detail="user:${a(t.id)}">编辑</button></td>
                    </tr>
                  `}).join("")||`<tr class="admin-table-empty-row"><td colspan="8">${m("暂无匹配用户","当前筛选条件下没有用户记录，可清空关键词或切换状态。","ri-user-search-line")}</td></tr>`}
              </tbody>
            </table>
          </div>${u(l.length)}
        </section>`}}})();
