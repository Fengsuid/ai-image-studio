(function () {
  window.AdminModules = window.AdminModules || {};

  window.AdminModules.users = {
    render({ state, helpers }) {
      const { escapeHtml, fmtNumber, fmtDate, toolbar, filtered, paged, pagination } = helpers;
      const items = filtered(state.users, ["name", "email", "role", "status"]);
      const pageItems = paged(items);
      return `${toolbar("搜索用户姓名、邮箱或角色", ["active", "disabled", "admin", "user"])}
        <section class="admin-panel">
          <div class="admin-panel-head">
            <h2>用户与积分</h2>
            <button type="button" data-create-user><i class="ri-user-add-line"></i> 新建用户</button>
          </div>
          <div class="admin-bulk-bar">
            <strong>已选 ${fmtNumber(state.selectedUsers.size)} 个用户</strong>
            <span>批量操作仅作用于当前勾选用户；不会默认覆盖全部搜索结果。</span>
            <select id="bulkUserAction">
              <option value="creditDelta">调整积分</option>
              <option value="status">修改状态</option>
            </select>
            <input id="bulkCreditDelta" type="number" value="1" aria-label="积分调整">
            <select id="bulkStatus" aria-label="状态"><option value="active">active</option><option value="disabled">disabled</option></select>
            <input id="bulkNote" placeholder="备注">
            <button type="button" data-bulk-users>应用到已选</button>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th><input type="checkbox" data-select-page-users></th><th>用户</th><th>角色</th><th>状态</th><th>积分</th><th>首发奖励</th><th>注册时间</th><th></th></tr></thead>
              <tbody>
                ${pageItems.map((user) => {
                  const latestReward = user.firstPublicRewardStatus && user.firstPublicRewardStatus !== "none"
                    ? {
                        status: user.firstPublicRewardStatus,
                        amount: user.firstPublicRewardAmount,
                        referenceId: user.firstPublicRewardGenerationId
                      }
                    : state.rewardLedger.find((item) => item.userId === user.id && item.rewardType === "first_public");
                  return `
                    <tr>
                      <td><input type="checkbox" data-user-select="${escapeHtml(user.id)}"${state.selectedUsers.has(user.id) ? " checked" : ""}></td>
                      <td><strong>${escapeHtml(user.name || user.email)}</strong><small>${escapeHtml(user.email)}</small></td>
                      <td>${escapeHtml(user.role)}</td>
                      <td><span class="admin-badge" data-status="${escapeHtml(user.status)}">${escapeHtml(user.status)}</span></td>
                      <td>${fmtNumber(user.credits)}</td>
                      <td>${latestReward ? `${escapeHtml(latestReward.status)} · ${fmtNumber(latestReward.amount)}<small>${escapeHtml(latestReward.referenceId || "")}</small>` : "未发放"}</td>
                      <td>${fmtDate(user.createdAt)}</td>
                      <td><button type="button" data-detail="user:${escapeHtml(user.id)}">编辑</button></td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>${pagination(items.length)}
        </section>`;
    }
  };
})();
