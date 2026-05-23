(function () {
  window.AdminModules = window.AdminModules || {};

  window.AdminModules.squareReview = {
    render({ state, helpers }) {
      const { escapeHtml, fmtNumber, fmtDate, imageVariantUrl, toolbar, filtered, paged, pagination } = helpers;
      const items = filtered(state.publicImages, ["prompt", "userName", "id", "moderationStatus"]);
      return `${toolbar("搜索待审作品、作者或提示词", ["reported", "reviewing", "requested", "hidden", "restored"])}
        <section class="admin-grid-list">
          ${paged(items).map((item) => `
            <article class="admin-work-card">
              <img src="${escapeHtml(imageVariantUrl(item.imageUrl))}" alt="">
              <div>
                <strong>${escapeHtml(item.userName || item.userId || "匿名")}</strong>
                <p>${escapeHtml(item.prompt || "")}</p>
                <small>${fmtDate(item.createdAt)} · ${escapeHtml(item.moderationStatus || "visible")} · 举报 ${fmtNumber(item.reportCount || 0)}</small>
                ${item.latestReportReason || item.moderationReason ? `<small>${escapeHtml(item.latestReportReason || item.moderationReason)}</small>` : ""}
              </div>
              <div class="admin-card-actions">
                <button type="button" data-detail="work:${escapeHtml(item.id)}">详情</button>
                ${item.moderationStatus === "hidden"
                  ? `<button type="button" data-moderation="restore:${escapeHtml(item.id)}">恢复</button>`
                  : Number(item.reportCount || 0) > 0
                    ? `<button type="button" data-moderation="hide:${escapeHtml(item.id)}">确认隐藏</button><button type="button" data-moderation="reject:${escapeHtml(item.id)}">驳回举报并恢复</button>`
                    : `<button type="button" data-moderation="hide:${escapeHtml(item.id)}">隐藏</button>`}
              </div>
            </article>
          `).join("") || `<div class="admin-empty-state">暂无待审核作品</div>`}
        </section>${pagination(items.length)}`;
    }
  };

  window.AdminModules.galleryFiles = {
    render({ state, helpers }) {
      const { escapeHtml, fmtNumber, fmtDate, toolbar, filtered, paged, pagination } = helpers;
      const checks = filtered(state.galleryFileChecks, ["generationId", "filename", "relativePath", "status", "errorMessage", "prompt", "userName"]);
      return `${toolbar("搜索作品 ID、文件名、作者或错误", ["broken", "ok", "unknown"])}
        <section class="admin-panel">
          <div class="admin-panel-head">
            <div>
              <h2>画廊文件巡检</h2>
              <span>${fmtNumber(state.galleryFileChecks.filter((item) => item.status === "broken").length)} 个异常文件</span>
            </div>
            <button type="button" data-gallery-file-check-run><i class="ri-loop-right-line"></i>运行巡检</button>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>作品</th><th>类型</th><th>文件</th><th>状态</th><th>大小</th><th>检查时间</th></tr></thead>
              <tbody>
                ${paged(checks).map((item) => `
                  <tr>
                    <td><strong>${escapeHtml(item.generationId)}</strong><small class="admin-truncate">${escapeHtml(item.prompt || item.userName || item.userEmail || "")}</small></td>
                    <td>${escapeHtml(item.imageKind || "-")}</td>
                    <td><strong>${escapeHtml(item.filename || "-")}</strong><small class="admin-truncate">${escapeHtml(item.relativePath || "")}</small>${item.errorMessage ? `<small class="admin-truncate">${escapeHtml(item.errorMessage)}</small>` : ""}</td>
                    <td><span class="admin-badge" data-status="${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
                    <td>${item.fileSize === null || item.fileSize === undefined ? "-" : fmtNumber(item.fileSize)}</td>
                    <td>${fmtDate(item.checkedAt)}</td>
                  </tr>
                `).join("") || `<tr><td colspan="6">暂无文件巡检记录</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>${pagination(checks.length)}`;
    }
  };
})();
