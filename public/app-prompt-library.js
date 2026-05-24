(function initPromptLibrary(global) {
  "use strict";

  const LABELS = {
    zh: {
      noCover: "无封面",
      noCoverBody: "使用提示词摘要作为封面",
      remote: "远程来源",
      local: "内置来源",
      square: "广场作品",
      promptDb: "Prompt DB",
      heat: "热度",
      audit: "AI 审核中",
      duplicate: "重复候选",
      hidden: "已隐藏",
      loadingTitle: "正在整理提示词库",
      loadingBody: "正在同步分类、远程来源和点赞状态。",
      emptyTitle: "没有找到匹配的提示词",
      emptyBody: "换一个搜索词、分类或排序方式再试。",
      errorTitle: "提示词库加载失败",
      errorBody: "远程来源暂不可用，已保留可用的本地内容。",
      offlineTitle: "当前处于离线状态",
      offlineBody: "网络恢复后会继续同步远程提示词来源。",
      permissionTitle: "没有权限读取完整提示词库",
      permissionBody: "请登录或切换有权限的账号后重试。",
      fallbackTitle: "远程来源未完全同步",
      fallbackBody: "当前展示缓存或内置提示词，搜索、分类和使用功能保持可用。",
      likePending: "正在更新点赞",
      likeFailed: "点赞失败"
    },
    en: {
      noCover: "No cover",
      noCoverBody: "Using the prompt summary as its cover",
      remote: "Remote source",
      local: "Built-in source",
      square: "Gallery work",
      promptDb: "Prompt DB",
      heat: "Heat",
      audit: "AI audit",
      duplicate: "Duplicate candidate",
      hidden: "Hidden",
      loadingTitle: "Preparing prompt library",
      loadingBody: "Syncing categories, remote sources, and like states.",
      emptyTitle: "No matching prompts",
      emptyBody: "Try another search term, category, or sort.",
      errorTitle: "Prompt library failed to load",
      errorBody: "The remote source is unavailable; local content remains available.",
      offlineTitle: "You are offline",
      offlineBody: "Remote prompt sources will sync again when the network returns.",
      permissionTitle: "No permission for the full prompt library",
      permissionBody: "Sign in or switch to an account with access.",
      fallbackTitle: "Remote source is not fully synced",
      fallbackBody: "Cached or built-in prompts are shown; search, filters, and use still work.",
      likePending: "Updating like",
      likeFailed: "Like failed"
    }
  };

  function label(ctx = {}, key) {
    const lang = ctx.state?.lang === "en" || ctx.lang === "en" ? "en" : "zh";
    return LABELS[lang]?.[key] || LABELS.en[key] || key;
  }

  function html(ctx = {}, value = "") {
    return ctx.escapeHtml ? ctx.escapeHtml(value) : String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function truncate(ctx = {}, value = "", length = 120) {
    return ctx.truncate ? ctx.truncate(value, length) : String(value || "").slice(0, length);
  }

  function promptTags(prompt = {}) {
    return Array.isArray(prompt.tags) ? prompt.tags : [prompt.tag].filter(Boolean);
  }

  function sourceHost(value = "") {
    if (!value) return "";
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return String(value || "").replace(/^https?:\/\//, "").split("/")[0];
    }
  }

  function statusMeta(prompt = {}, ctx = {}) {
    if (prompt.status === "hidden") {
      return { key: "hidden", icon: "ri-eye-off-line", label: label(ctx, "hidden") };
    }
    const auditStatus = prompt.auditStatus || prompt.audit?.status || prompt.reviewStatus || "";
    if (["review", "pending", "blocked", "needs_review"].includes(String(auditStatus))) {
      return { key: "audit", icon: "ri-shield-check-line", label: label(ctx, "audit") };
    }
    const duplicateState = prompt.duplicateStatus || prompt.duplicateReview || prompt.aiReview?.decision || "";
    if (["duplicate", "pending", "needs_review", "manual_review"].includes(String(duplicateState))) {
      return { key: "duplicate", icon: "ri-git-merge-line", label: label(ctx, "duplicate") };
    }
    return null;
  }

  function renderPromptCard(prompt = {}, ctx = {}) {
    const state = ctx.state || {};
    const promptText = prompt.prompt || "";
    const title = prompt.title || "";
    const coverUrl = ctx.promptImageDisplayUrl?.(prompt) || "";
    const tagView = prompt.kind === "square"
      ? ctx.galleryTagViewModelForItem?.(prompt, prompt.publicTags || prompt.tags || []) || { publicTags: prompt.publicTags || prompt.tags || [] }
      : { publicTags: promptTags(prompt) };
    const tagsHtml = (tagView.publicTags || []).slice(0, 4).map((tag) => {
      const info = ctx.tagInfo?.(tag) || { label: tag, hue: 210 };
      return `<span class="tag-chip" style="--tag-hue:${html(ctx, info.hue)}">${html(ctx, info.label || tag)}</span>`;
    }).join("");
    const fallbackSrc = ctx.promptCoverFallbackSrc?.(prompt) || "";
    const cardImageUrl = ctx.promptCardImageUrl?.(prompt, coverUrl) || coverUrl;
    const removeBrokenPromptImage = prompt.kind !== "square" ? ' data-remove-on-image-error="1"' : "";
    const hasCover = Boolean(coverUrl);
    const art = hasCover
      ? `<img src="${html(ctx, cardImageUrl)}" ${ctx.imageFallbackImgAttrs?.(fallbackSrc) || ""}${removeBrokenPromptImage} loading="lazy" decoding="async" fetchpriority="low" alt="${html(ctx, title)}">`
      : global.ImageStudioPromptCoverFallback?.render?.(prompt, { escapeHtml: (value) => html(ctx, value), truncate: (value, length) => truncate(ctx, value, length) }) || `
        <div class="prompt-library-no-cover">
          <i class="${html(ctx, prompt.icon || "ri-quill-pen-line")}"></i>
          <strong>${html(ctx, label(ctx, "noCover"))}</strong>
          <span>${html(ctx, label(ctx, "noCoverBody"))}</span>
        </div>
      `;
    const canvasBadge = ctx.isCanvasRouteItem?.(prompt)
      ? `<b class="canvas-route-badge"><i class="ri-node-tree"></i>${html(ctx, state.lang === "zh" ? "画布线路" : "Canvas route")}</b>`
      : "";
    const sourceName = prompt.kind === "square"
      ? ctx.displayUserName?.(prompt) || prompt.author || label(ctx, "square")
      : prompt.sourceRepo || prompt.source || prompt.author || label(ctx, "promptDb");
    const sourceUrl = prompt.sourceUrl || prompt.githubUrl || "";
    const sourceKind = prompt.kind === "square"
      ? label(ctx, "square")
      : (prompt.sourceRepo || prompt.remoteId || sourceUrl ? label(ctx, "remote") : label(ctx, "local"));
    const sourceBadge = prompt.kind === "square"
      ? `<em class="square-badge prompt-card-source" title="${html(ctx, sourceName)}"><i class="ri-user-line"></i>${html(ctx, sourceName)}</em><b>${html(ctx, ctx.text?.(tagView.kindBadge?.textKey || (ctx.isImageToImageItem?.(prompt) ? "imageToImage" : "textToImage")) || "")}</b>${canvasBadge}`
      : `<em class="prompt-card-source" title="${html(ctx, [sourceKind, sourceName, sourceHost(sourceUrl)].filter(Boolean).join(" · "))}"><i class="ri-links-line"></i>${html(ctx, sourceName)}</em>`;
    const status = statusMeta(prompt, ctx);
    const statusBadge = status
      ? `<span class="prompt-status-badge ${html(ctx, status.key)}"><i class="${html(ctx, status.icon)}"></i>${html(ctx, status.label)}</span>`
      : "";
    const openAttr = prompt.kind === "square"
      ? ` data-open-square="${html(ctx, prompt.id)}" role="button" tabindex="0"`
      : ` data-open-prompt="${html(ctx, prompt.id)}" role="button" tabindex="0"`;
    const isAdmin = state.user?.role === "admin";
    const adminActions = isAdmin && prompt.kind !== "square"
      ? `
        <button type="button" data-edit-prompt="${html(ctx, prompt.id)}" class="prompt-admin-edit"><i class="ri-pencil-line"></i>${html(ctx, ctx.text?.("promptEdit") || "Edit")}</button>
        <button type="button" data-delete-prompt="${html(ctx, prompt.id)}" class="prompt-admin-delete"><i class="ri-delete-bin-line"></i>${html(ctx, ctx.text?.("promptDelete") || "Hide")}</button>
      `
      : "";
    const viewDetailButton = prompt.kind === "square"
      ? `<button type="button" data-view-square="${html(ctx, prompt.id)}"><i class="ri-eye-line"></i>${html(ctx, ctx.text?.("viewDetail") || "Details")}</button>`
      : `<button type="button" data-view-prompt="${html(ctx, prompt.id)}"><i class="ri-eye-line"></i>${html(ctx, ctx.text?.("viewDetail") || "Details")}</button>`;
    const engagement = prompt.kind === "square" ? `
      <div class="prompt-engagement">
        <button type="button" data-like-gallery="${html(ctx, prompt.generationId || prompt.id)}" class="${prompt.likedByCurrentUser ? "liked" : ""}" aria-label="${html(ctx, ctx.text?.("likeImage") || "Like")}">
          <i class="${prompt.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(prompt.likeCount || 0)}
        </button>
      </div>
    ` : `
      <div class="prompt-engagement">
        <button type="button" data-like-prompt="${html(ctx, prompt.id)}" class="${prompt.likedByCurrentUser ? "liked" : ""}" aria-label="${html(ctx, ctx.text?.("likeImage") || "Like")}">
          <i class="${prompt.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(prompt.likeCount || 0)}
        </button>
        <span title="${html(ctx, label(ctx, "heat"))}"><i class="ri-fire-line"></i>${Number(prompt.heatScore || 0).toFixed(0)}</span>
      </div>
    `;
    const classes = [
      "prompt-card",
      "prompt-library-card",
      hasCover ? "prompt-card-has-cover" : "prompt-card-no-cover",
      prompt.kind === "square" ? "prompt-card-square-source" : "prompt-card-db-source",
      prompt.status === "hidden" ? "prompt-hidden" : "",
      status ? `prompt-card-status-${status.key}` : ""
    ].filter(Boolean).join(" ");
    return `
      <article class="${classes}" data-prompt-source="${html(ctx, sourceKind)}" data-prompt-status="${html(ctx, status?.key || "active")}" style="--art-bg:${prompt.colors || "linear-gradient(135deg,#64748b,#cbd5e1)"}">
        <div class="card-art card-art-clickable" ${ctx.imageFallbackContainerAttrs?.() || ""}${openAttr}>${art}${sourceBadge}${statusBadge}</div>
        <div class="prompt-card-body">
          <div class="prompt-card-heading">
            <h3>${html(ctx, title)}</h3>
            ${engagement}
          </div>
          <div class="prompt-tags">${tagsHtml || `<span class="tag-chip muted">${html(ctx, sourceKind)}</span>`}</div>
          <p>${html(ctx, promptText)}</p>
        </div>
        <div class="card-actions">
          <button type="button" data-copy-prompt="${html(ctx, prompt.id)}"><i class="ri-file-copy-line"></i>${html(ctx, ctx.text?.("copy") || "Copy")}</button>
          ${viewDetailButton}
          <button class="use-button" type="button" data-use-prompt="${html(ctx, prompt.id)}">${html(ctx, ctx.text?.("use") || "Use")} <i class="ri-arrow-right-line"></i></button>
          ${adminActions}
        </div>
      </article>
    `;
  }

  function renderSortControl({ sortOptions = [], activeSort = "hot", ctx = {} } = {}) {
    return `
      <div class="library-sort prompt-library-sort" role="tablist" aria-label="${html(ctx, ctx.text?.("promptSortLabel") || "Prompt sort")}">
        ${sortOptions.map(([value, icon, labelText]) => `
          <button type="button" role="tab" aria-selected="${activeSort === value ? "true" : "false"}" class="${activeSort === value ? "active" : ""}" data-prompt-sort="${html(ctx, value)}">
            <i class="${html(ctx, icon)}"></i>${html(ctx, labelText)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderStats({ sourceLength = 0, sourceCount = 1, summary = {}, systemCount = 0, ctx = {} } = {}) {
    return `
      <div class="library-stats prompt-library-stats">
        <div><strong>${Number(sourceLength || 0).toLocaleString()}+</strong><span>${html(ctx, ctx.text?.("totalPrompts") || "Prompts")}</span></div>
        <div class="stat-divider"></div>
        <div><strong>${Number(sourceCount || 1)}</strong><span>${html(ctx, ctx.text?.("totalSources") || "Sources")}</span></div>
        <div class="stat-divider"></div>
        <div><strong>${Number(summary.systemCount || systemCount || 0)}</strong><span>${html(ctx, ctx.text?.("tagStatsSystem") || "System tags")}</span></div>
        <div><strong>${Number(summary.withContentCount || 0)}</strong><span>${html(ctx, ctx.text?.("tagStatsWithContent") || "With content")}</span></div>
        <div><strong>${Number(summary.emptyCount || 0)}</strong><span>${html(ctx, ctx.text?.("tagStatsEmpty") || "Empty tags")}</span></div>
      </div>
    `;
  }

  function renderTagFilters({ filterTags = [], activeTag = "all", sourceLength = 0, counts = {}, ctx = {} } = {}) {
    return filterTags.map((tag) => {
      const info = tag.slug === "all" ? tag : tag.isCategory ? tag : ctx.tagInfo?.(tag.slug) || tag;
      const count = tag.slug === "all" ? sourceLength : (counts[tag.slug] || info.contentCount || 0);
      const empty = tag.slug !== "all" && count === 0;
      const category = !tag.isCategory && info.category && info.category !== "core"
        ? ctx.tagCategoryLabel?.(info.category)
        : "";
      const title = `${info.slug || tag.slug}${info.aliases?.length ? ` · ${info.aliases.join(" · ")}` : ""}`;
      return `
        <button type="button" class="${activeTag === tag.slug ? "active" : ""} ${empty ? "empty" : ""}" data-tag="${html(ctx, tag.slug)}" title="${html(ctx, title)}">
          ${category ? `<em>${html(ctx, category)}</em>` : ""}
          ${html(ctx, info.label || tag.label || tag.slug)}
          <span>${Number(count || 0)}</span>
        </button>
      `;
    }).join("");
  }

  function renderLibraryState({ type = "empty", title = "", body = "", actionLabel = "", actionAttr = "", icon = "", compact = false, ctx = {} } = {}) {
    const meta = {
      loading: ["ri-loader-4-line", label(ctx, "loadingTitle"), label(ctx, "loadingBody")],
      empty: ["ri-search-eye-line", label(ctx, "emptyTitle"), label(ctx, "emptyBody")],
      error: ["ri-error-warning-line", label(ctx, "errorTitle"), label(ctx, "errorBody")],
      offline: ["ri-wifi-off-line", label(ctx, "offlineTitle"), label(ctx, "offlineBody")],
      permission: ["ri-shield-keyhole-line", label(ctx, "permissionTitle"), label(ctx, "permissionBody")],
      warning: ["ri-radar-line", label(ctx, "fallbackTitle"), label(ctx, "fallbackBody")]
    }[type] || ["ri-information-line", title, body];
    const stateIcon = icon || meta[0];
    const stateTitle = title || meta[1];
    const stateBody = body || meta[2];
    return `
      <div class="prompt-library-state prompt-library-state-${html(ctx, type)}${compact ? " compact" : ""}" data-prompt-library-state="${html(ctx, type)}" role="${type === "loading" ? "status" : "note"}">
        <i class="${html(ctx, stateIcon)}"></i>
        <div>
          <strong>${html(ctx, stateTitle)}</strong>
          <span>${html(ctx, stateBody)}</span>
        </div>
        ${actionLabel && actionAttr ? `<button type="button" ${actionAttr}>${html(ctx, actionLabel)}</button>` : ""}
        ${type === "loading" ? `<em class="prompt-library-loading-dots"><b></b><b></b><b></b></em>` : ""}
      </div>
    `;
  }

  function renderEmptyTagState({ tag = {}, related = [], isAdmin = false, ctx = {} } = {}) {
    const title = String(ctx.text?.("emptyTagTitle") || "No works for {tag} yet").replace("{tag}", tag.label || tag.slug || "");
    const adminAction = isAdmin
      ? `<button type="button" data-empty-tag-admin-create><i class="ri-add-circle-line"></i>${html(ctx, ctx.text?.("emptyTagAdminCreate") || "Create example")}</button>`
      : "";
    return `
      <div class="empty-message empty-tag-state prompt-library-state prompt-library-state-empty-tag" data-prompt-library-state="empty-tag">
        <i class="ri-price-tag-3-line"></i>
        <strong>${html(ctx, title)}</strong>
        <span>${html(ctx, ctx.text?.("emptyTagBody") || "")}</span>
        <div class="empty-tag-actions">
          <button type="button" data-empty-tag-generate><i class="ri-sparkling-2-line"></i>${html(ctx, ctx.text?.("emptyTagGenerate") || "Create")}</button>
          ${adminAction}
        </div>
        ${related.length ? `
          <div class="empty-tag-related">
            <em>${html(ctx, ctx.text?.("emptyTagNearby") || "Nearby")}</em>
            ${related.map((item) => {
              const info = ctx.tagInfo?.(item.slug) || item;
              return `<button type="button" data-tag="${html(ctx, item.slug)}">${html(ctx, info.label || item.slug)}</button>`;
            }).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderSourceNotice({ fallbackUsed = false, error = "", offline = false, permissionDenied = false, ctx = {} } = {}) {
    if (!fallbackUsed && !error && !offline && !permissionDenied) return "";
    const type = permissionDenied ? "permission" : offline ? "offline" : fallbackUsed ? "warning" : "error";
    return renderLibraryState({
      type,
      body: error ? `${label(ctx, type === "warning" ? "fallbackBody" : `${type}Body`)} ${error}` : "",
      compact: true,
      ctx
    });
  }

  function renderPromptDetailModal(prompt = {}, ctx = {}) {
    const state = ctx.state || {};
    const imageUrl = ctx.promptImageDisplayUrl?.(prompt) || "";
    const fallbackSrc = ctx.promptCoverFallbackSrc?.(prompt) || "";
    const tags = promptTags(prompt);
    const isAdmin = state.user?.role === "admin";
    const author = prompt.author || (state.lang === "zh" ? "公开来源" : "Public source");
    const sourceLabel = prompt.source || "-";
    const sourceUrl = prompt.sourceUrl || prompt.githubUrl || "";
    const categoryLabel = prompt.category ? ctx.tagCategoryLabel?.(prompt.category) || prompt.category : "-";
    const status = statusMeta(prompt, ctx);
    const statusLine = status
      ? `<div><span>${html(ctx, ctx.text?.("promptFieldStatus") || "Status")}</span><strong>${html(ctx, status.label)}</strong></div>`
      : `<div><span>${html(ctx, ctx.text?.("promptFieldStatus") || "Status")}</span><strong>${html(ctx, prompt.status === "hidden" ? ctx.text?.("promptStatusHidden") : ctx.text?.("promptStatusActive"))}</strong></div>`;
    return `
      <section class="modal square-preview-modal prompt-library-detail-modal">
        <button class="square-preview-close" type="button" aria-label="${html(ctx, ctx.text?.("close") || "Close")}"><i class="ri-close-line"></i></button>
        <div class="square-preview-stage" ${ctx.imageFallbackContainerAttrs?.() || ""}>
          ${imageUrl
            ? `<img class="square-preview-main" src="${html(ctx, imageUrl)}" ${ctx.imageFallbackImgAttrs?.(fallbackSrc) || ""} loading="lazy" decoding="async" alt="${html(ctx, truncate(ctx, prompt.prompt || prompt.title || "", 100))}">`
            : global.ImageStudioPromptCoverFallback?.render?.(prompt, { escapeHtml: (value) => html(ctx, value), truncate: (value, length) => truncate(ctx, value, length) }) || `<div class="square-preview-main prompt-no-cover-detail"><i class="ri-quill-pen-line"></i><span>${html(ctx, prompt.title || ctx.text?.("promptLibrary") || "Prompt")}</span></div>`}
        </div>
        <aside class="square-preview-side">
          <div class="square-preview-head">
            <span>${html(ctx, ctx.text?.("promptLibrary") || "Prompt library")}</span>
            <strong>${html(ctx, prompt.title || "")}</strong>
          </div>
          <div class="square-preview-section">
            <h3>${state.lang === "zh" ? "原提示词" : "Prompt"}</h3>
            <p>${html(ctx, prompt.prompt || "")}</p>
          </div>
          <div class="square-preview-meta prompt-library-detail-meta">
            <div><span>${html(ctx, ctx.text?.("promptFieldAuthor") || "Author")}</span><strong>${html(ctx, author)}</strong></div>
            <div><span>${html(ctx, ctx.text?.("promptFieldSource") || "Source")}</span><strong>${html(ctx, sourceLabel)}</strong></div>
            <div><span>${state.lang === "zh" ? "分类" : "Category"}</span><strong>${html(ctx, categoryLabel)}</strong></div>
            <div><span>${state.lang === "zh" ? "来源仓库" : "Source repo"}</span><strong>${html(ctx, prompt.sourceRepo || sourceHost(sourceUrl) || "-")}</strong></div>
            <div><span>ID</span><strong>${html(ctx, String(prompt.id || "-"))}</strong></div>
            ${statusLine}
          </div>
          ${tags.length ? `
            <div class="square-preview-tags">
              ${tags.map((tag) => {
                const info = ctx.tagInfo?.(tag) || { label: tag, hue: 210 };
                return `<button type="button" class="tag-chip" style="--tag-hue:${html(ctx, info.hue)}" data-prompt-tag="${html(ctx, tag)}">${html(ctx, info.label || tag)}</button>`;
              }).join("")}
            </div>
          ` : ""}
          ${sourceUrl ? `
            <div class="square-preview-section prompt-library-source-url">
              <h3>${html(ctx, ctx.text?.("promptFieldSourceUrl") || "Source URL")}</h3>
              <p><a href="${html(ctx, sourceUrl)}" target="_blank" rel="noreferrer">${html(ctx, sourceUrl)}</a></p>
            </div>
          ` : ""}
          <div class="square-preview-actions">
            <button type="button" data-prompt-text><i class="ri-sparkling-2-line"></i>${html(ctx, ctx.text?.("textToImageAction") || "Text to image")}</button>
            <button type="button" data-prompt-detail-like="${html(ctx, prompt.id)}" class="${prompt.likedByCurrentUser ? "liked" : ""}">
              <i class="${prompt.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(prompt.likeCount || 0)}
            </button>
            ${imageUrl ? `<button type="button" data-prompt-edit><i class="ri-image-edit-line"></i>${html(ctx, ctx.text?.("imageToImageAction") || "Image to image")}</button>` : ""}
            ${ctx.isCanvasEntryHidden?.() ? "" : `<button type="button" data-prompt-add-canvas><i class="ri-node-tree"></i>${html(ctx, ctx.text?.("addToCanvas") || "Add to canvas")}</button>`}
            <button type="button" data-prompt-copy><i class="ri-file-copy-line"></i>${html(ctx, ctx.text?.("copy") || "Copy")}</button>
            ${imageUrl ? `<a href="${html(ctx, imageUrl)}" target="_blank" rel="noreferrer"><i class="ri-external-link-line"></i>${html(ctx, ctx.text?.("download") || "Open")}</a>` : ""}
            ${isAdmin ? `<button type="button" data-prompt-admin-edit><i class="ri-pencil-line"></i>${html(ctx, ctx.text?.("promptEdit") || "Edit")}</button>` : ""}
            ${isAdmin ? `<button type="button" data-prompt-admin-delete><i class="ri-delete-bin-line"></i>${html(ctx, ctx.text?.("promptDelete") || "Hide")}</button>` : ""}
          </div>
        </aside>
      </section>
    `;
  }

  const api = {
    renderPromptCard,
    renderSortControl,
    renderStats,
    renderTagFilters,
    renderLibraryState,
    renderEmptyTagState,
    renderSourceNotice,
    renderPromptDetailModal
  };

  global.ImageStudioPromptLibrary = Object.freeze(api);
  global.AppModules?.register?.("promptLibrary", api);
})(window);
