(function initImageSessionList(global) {
  "use strict";

  function render({
    sessions = [],
    history = [],
    activeSessionId = "",
    text,
    escapeHtml,
    truncate,
    imageVariantUrl,
    imageFallbackImgAttrs,
    imageFallbackContainerAttrs,
    lang = "zh"
  }) {
    const historyById = new Map(history.map((item) => [String(item.id), item]));
    if (!sessions.length) return `<div class="session-empty">${text("emptyWorks")}</div>`;
    return sessions.map((session) => {
      const items = (session.generationIds || []).map((id) => historyById.get(String(id))).filter(Boolean);
      const latest = [...items].reverse().find((item) => item.images?.[0]);
      const latestPrompt = items.at(-1)?.prompt || "";
      const count = items.length;
      const active = session.id === activeSessionId ? "active" : "";
      const editLabel = lang === "zh" ? "编辑标题" : "Edit title";
      const thumb = latest
        ? `<img src="${escapeHtml(imageVariantUrl(latest.images[0]))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(truncate(latest.prompt, 60))}">`
        : `<i class="ri-chat-3-line"></i>`;
      return `
        <button class="chat-session-card ${active}" type="button" data-session-id="${escapeHtml(session.id)}">
          <span class="session-thumb" ${imageFallbackContainerAttrs()}>${thumb}</span>
          <span class="session-copy">
            <strong>${escapeHtml(session.title || text("sessionUntitled"))}</strong>
            <em>${count} ${text("roundCount")}</em>
            <small>${escapeHtml(truncate(latestPrompt || session.updatedAt || "", 42))}</small>
          </span>
          <span class="session-actions">
            <span class="session-action" data-rename-session="${escapeHtml(session.id)}" title="${escapeHtml(editLabel)}" aria-label="${escapeHtml(editLabel)}">
              <i class="ri-edit-2-line"></i>
            </span>
            <span class="session-action danger" data-delete-session="${escapeHtml(session.id)}" title="${escapeHtml(text("deleteConversation"))}" aria-label="${escapeHtml(text("deleteConversation"))}">
              <i class="ri-delete-bin-line"></i>
            </span>
          </span>
        </button>
      `;
    }).join("");
  }

  global.ImageStudioSessionList = { render };
})(window);
