(function initAdminAnnouncementsDomain(global, document) {
  "use strict";

  const domains = global.AdminDomains || (global.AdminDomains = {});

  function render(core) {
    const { state, escapeHtml, fmtNumber, fmtDate, toolbar, filtered, paged, pagination } = core;
    const items = filtered(state.announcements, ["title", "body", "level", "displayMode", "audience", "status"]);
    return `${toolbar("搜索标题、正文、等级或状态", ["draft", "published", "archived"])}
      <section class="admin-panel">
        <div class="admin-panel-head"><h2>通知公告</h2><button type="button" data-create-announcement><i class="ri-add-line"></i> 新建通知</button></div>
        <div class="admin-table-wrap primitive-table-wrap"><table class="admin-table primitive-table" data-density="compact">
          <thead><tr><th>标题</th><th>等级</th><th>展示</th><th>目标</th><th>状态</th><th>统计</th><th>时间</th><th></th></tr></thead>
          <tbody>${paged(items).map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><small class="admin-truncate">${escapeHtml(item.body)}</small></td><td>${escapeHtml(item.level || item.severity || "info")}${item.isImportant ? "<small>重要</small>" : ""}</td><td>${escapeHtml(item.displayMode || item.displayType || "feed")}</td><td>${escapeHtml(item.audience || item.targetAudience || "all")}</td><td><span class="admin-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${item.requiresAck ? "<small>需确认</small>" : ""}</td><td>读 ${fmtNumber(item.readCount || 0)} / 确认 ${fmtNumber(item.ackCount || 0)}</td><td><small>${fmtDate(item.publishedAt || item.createdAt)}</small></td><td><button type="button" data-detail="announcement:${escapeHtml(item.id)}">编辑</button>${item.status === "published" ? `<button type="button" data-announcement-action="withdraw:${escapeHtml(item.id)}">撤回</button>` : `<button type="button" data-announcement-action="publish:${escapeHtml(item.id)}">发布</button>`}<button type="button" data-announcement-action="archive:${escapeHtml(item.id)}">归档</button></td></tr>`).join("") || `<tr><td colspan="8">暂无通知公告</td></tr>`}</tbody>
        </table></div>${pagination(items.length)}
      </section>`;
  }

  function drawer(core, item = null) {
    const { escapeHtml, datetimeLocal, openDrawer, api, recordAudit, refreshAndRender, closeDrawer } = core;
    const announcement = item || { title: "", body: "", level: "info", displayMode: "feed", audience: "all", status: "draft", targetUserIds: [] };
    const isNew = !announcement.id;
    openDrawer(isNew ? "新建通知" : "编辑通知", `
      <form id="drawerAnnouncementForm" class="admin-form-grid">
        <label>标题<input name="title" value="${escapeHtml(announcement.title || "")}" required maxlength="160"></label>
        <label>等级<select name="level">${["info", "success", "warning", "danger", "maintenance", "feature"].map((level) => `<option value="${level}"${(announcement.level || announcement.severity) === level ? " selected" : ""}>${level}</option>`).join("")}</select></label>
        <label>展示方式<select name="displayMode">${["feed", "banner", "modal"].map((mode) => `<option value="${mode}"${(announcement.displayMode || announcement.displayType) === mode ? " selected" : ""}>${mode}</option>`).join("")}</select></label>
        <label>目标人群<select name="audience">${["all", "logged-in", "admin", "specific-users"].map((audience) => `<option value="${audience}"${(announcement.audience || announcement.targetAudience) === audience ? " selected" : ""}>${audience}</option>`).join("")}</select></label>
        <label>生效时间<input name="startsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(announcement.startsAt || announcement.publishAt))}"></label>
        <label>失效时间<input name="endsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(announcement.endsAt || announcement.expiresAt))}"></label>
        <label>指定用户 ID<textarea name="targetUserIds" rows="3">${escapeHtml((announcement.targetUserIds || []).join("\n"))}</textarea></label>
        <label>正文<textarea name="body" rows="10" required>${escapeHtml(announcement.body || "")}</textarea></label>
        <label class="admin-check"><input name="isImportant" type="checkbox"${announcement.isImportant ? " checked" : ""}>重要通知</label>
        <label class="admin-check"><input name="requiresAck" type="checkbox"${announcement.requiresAck ? " checked" : ""}>需要用户确认</label>
        <div class="admin-form-actions"><button type="submit">${isNew ? "创建通知" : "保存通知"}</button></div>
      </form>
    `);
    core.$("#drawerAnnouncementForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload = {
        title: form.get("title"),
        body: form.get("body"),
        level: form.get("level"),
        displayMode: form.get("displayMode"),
        audience: form.get("audience"),
        startsAt: form.get("startsAt"),
        endsAt: form.get("endsAt"),
        targetUserIds: String(form.get("targetUserIds") || "").split(/[,\n\s]+/).filter(Boolean),
        isImportant: Boolean(form.get("isImportant")),
        requiresAck: Boolean(form.get("requiresAck"))
      };
      const response = await api(isNew ? "/api/admin/announcements" : `/api/admin/announcements/${encodeURIComponent(announcement.id)}`, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) });
      recordAudit(isNew ? "create_announcement" : "update_announcement", response.announcement?.id || announcement.id, payload.title);
      await refreshAndRender();
      closeDrawer();
    });
  }

  async function runAction(core, action, id) {
    const labels = { publish: "发布", archive: "归档", withdraw: "撤回" };
    if (!(await core.confirmAction({ title: `${labels[action] || action}通知`, message: `确认${labels[action] || action}该通知？`, confirmText: labels[action] || "确认", danger: action !== "publish" }))) return;
    await core.api(`/api/admin/announcements/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, { method: "POST", body: "{}" });
    core.recordAudit(`${action}_announcement`, id, "");
    await core.refreshAndRender();
  }

  function bind(core) {
    core.$("[data-create-announcement]")?.addEventListener("click", () => drawer(core));
    document.querySelectorAll("[data-announcement-action]").forEach((button) => button.addEventListener("click", () => {
      const [action, id] = button.dataset.announcementAction.split(":");
      return runAction(core, action, id);
    }));
  }

  domains.announcements = { render, drawer, bind };
})(window, document);
