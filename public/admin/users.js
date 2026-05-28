(function initAdminUsersDomain(global) {
  "use strict";

  const domains = global.AdminDomains || (global.AdminDomains = {});

  async function userDrawer(core, user) {
    if (!user) return;
    const { api, escapeHtml, fmtNumber, fmtDate, openDrawer, confirmAction, recordAudit, refreshAndRender, closeDrawer } = core;
    const [creditLedger, rewardLedger, userGenerations] = await Promise.all([
      api(`/api/admin/users/${encodeURIComponent(user.id)}/credit-ledger?limit=80`),
      api(`/api/admin/users/${encodeURIComponent(user.id)}/reward-ledger?limit=80`),
      api(`/api/admin/users/${encodeURIComponent(user.id)}/generations?includeArchived=1&limit=80`)
    ]);
    const reward = user.firstPublicRewardStatus && user.firstPublicRewardStatus !== "none"
      ? `${user.firstPublicRewardStatus} · ${fmtNumber(user.firstPublicRewardAmount)} · ${user.firstPublicRewardGenerationId || "-"}`
      : "未发放";
    openDrawer("用户与积分", `
      <form id="drawerUserForm" class="admin-form-grid single">
        <label>姓名<input name="name" value="${escapeHtml(user.name || "")}"></label>
        <label>角色<select name="role"><option value="user"${user.role === "user" ? " selected" : ""}>user</option><option value="admin"${user.role === "admin" ? " selected" : ""}>admin</option></select></label>
        <label>状态<select name="status"><option value="active"${user.status === "active" ? " selected" : ""}>active</option><option value="disabled"${user.status === "disabled" ? " selected" : ""}>disabled</option></select></label>
        <label>首发奖励<input value="${escapeHtml(reward)}" disabled></label>
        <label>积分<input name="credits" type="number" min="0" value="${escapeHtml(user.credits || 0)}"></label>
        <label>积分调整<input name="creditDelta" type="number" value="0"></label>
        <label>备注<input name="note" value="Admin adjustment"></label>
        <button type="submit">保存用户</button>
        <button type="button" data-reset-user-password>重置密码</button>
      </form>
      <section class="admin-ledger-section"><h3>积分流水</h3><div class="admin-mini-table">${(creditLedger.ledger || []).map((item) => `<div><strong>${item.delta > 0 ? "+" : ""}${fmtNumber(item.delta)}</strong><span>${escapeHtml(item.source)}</span><small>${fmtNumber(item.balanceAfter)} · ${fmtDate(item.createdAt)}</small></div>`).join("") || "<p>暂无积分流水</p>"}</div></section>
      <section class="admin-ledger-section"><h3>奖励流水</h3><div class="admin-mini-table">${(rewardLedger.rewards || []).map((item) => `<div><strong>${escapeHtml(item.rewardType)}</strong><span>${escapeHtml(item.status)} · ${fmtNumber(item.amount)}</span><small>${fmtDate(item.awardedAt || item.createdAt)}</small></div>`).join("") || "<p>暂无奖励流水</p>"}</div></section>
      <section class="admin-ledger-section"><h3>用户作品与会话</h3><div class="admin-mini-table">${(userGenerations.generations || []).map((item) => `<div><strong>${escapeHtml(item.title || item.id)}</strong><span>${escapeHtml(item.prompt || "-")}</span><small>${escapeHtml(item.id)} · ${fmtDate(item.createdAt)} · ${item.isPublic ? "公开" : "私有"}</small></div>`).join("") || "<p>暂无生成作品</p>"}</div></section>
    `);
    core.$("#drawerUserForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      if (form.get("status") === "disabled" && !(await confirmAction({ title: "停用用户", message: "确认停用该用户？", confirmText: "停用", danger: true }))) return;
      await api(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: form.get("name"), role: form.get("role"), status: form.get("status"), credits: form.get("credits"), creditDelta: form.get("creditDelta"), note: form.get("note") })
      });
      recordAudit("update_user", user.id, user.email);
      await refreshAndRender();
      closeDrawer();
    });
    core.$("[data-reset-user-password]")?.addEventListener("click", async () => {
      if (!(await confirmAction({ title: "重置用户密码", message: `确认重置 ${user.email} 的密码？`, confirmText: "重置密码", danger: true }))) return;
      const response = await api(`/api/admin/users/${encodeURIComponent(user.id)}/reset-password`, { method: "POST", body: JSON.stringify({ generatePassword: true, note: "Admin reset password" }) });
      recordAudit("reset_user_password", user.id, user.email);
      await refreshAndRender();
      openDrawer("一次性临时密码", `<section class="admin-temp-password"><p>该密码只会返回一次。</p><div class="admin-copy-row"><code>${escapeHtml(response.temporaryPassword || "")}</code><button type="button" data-copy-temp-password>复制</button></div></section>`);
      core.$("[data-copy-temp-password]")?.addEventListener("click", () => navigator.clipboard?.writeText(response.temporaryPassword || "").catch(() => null));
    });
  }

  function bind(core) {
    const { state, api, confirmAction, recordAudit, refreshAndRender, render } = core;
    core.$("[data-create-user]")?.addEventListener("click", () => userDrawer(core, { id: "", name: "", email: "", role: "user", status: "active", credits: state.settings?.defaultCredits ?? 10 }));
    document.querySelectorAll("[data-user-select]").forEach((input) => input.addEventListener("change", () => {
      input.checked ? state.selectedUsers.add(input.dataset.userSelect) : state.selectedUsers.delete(input.dataset.userSelect);
      render();
    }));
    core.$("[data-select-page-users]")?.addEventListener("change", (event) => {
      document.querySelectorAll("[data-user-select]").forEach((input) => event.target.checked ? state.selectedUsers.add(input.dataset.userSelect) : state.selectedUsers.delete(input.dataset.userSelect));
      render();
    });
    core.$("[data-bulk-users]")?.addEventListener("click", async () => {
      const userIds = Array.from(state.selectedUsers);
      if (!userIds.length) return;
      const action = core.$("#bulkUserAction")?.value || "creditDelta";
      const status = core.$("#bulkStatus")?.value || "active";
      const dangerous = action === "status" && status === "disabled";
      if (!(await confirmAction({ title: dangerous ? "批量停用用户" : "批量更新用户", message: `确认更新 ${userIds.length} 个已选用户？`, confirmText: dangerous ? "停用" : "更新", danger: dangerous }))) return;
      await api("/api/admin/users/bulk", { method: "POST", body: JSON.stringify({ userIds, action, status, creditDelta: Number(core.$("#bulkCreditDelta")?.value || 0), note: core.$("#bulkNote")?.value || "Bulk adjustment" }) });
      recordAudit("bulk_user_update", "selected users", `${action} ${userIds.length}`);
      state.selectedUsers.clear();
      await refreshAndRender();
    });
  }

  domains.users = { bind, userDrawer };
})(window);
