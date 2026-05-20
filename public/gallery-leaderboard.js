(function initGalleryLeaderboard(global) {
  "use strict";

  function render({
    state,
    text,
    escapeHtml,
    truncate,
    displayUserName,
    imageVariantUrl,
    imageFallbackImgAttrs,
    imageFallbackContainerAttrs
  }) {
    const items = (state.galleryLeaderboard || []).filter((item) => item.images?.[0]).slice(0, 24);
    const rangeTabs = [
      ["day", state.lang === "zh" ? "日榜" : "Day"],
      ["week", state.lang === "zh" ? "周榜" : "Week"],
      ["month", state.lang === "zh" ? "月榜" : "Month"],
      ["all", state.lang === "zh" ? "总榜" : "All-time"]
    ];
    const typeTabs = [
      ["all", state.lang === "zh" ? "全部" : "All"],
      ["text-to-image", text("textToImage")],
      ["image-to-image", text("imageToImage")]
    ];
    return `
      <aside class="gallery-leaderboard${state.galleryLeaderboardLoading ? " loading" : ""}" aria-label="${escapeHtml(text("galleryLeaderboard"))}">
        <div class="gallery-leaderboard-head">
          <div>
            <strong>${escapeHtml(text("galleryLeaderboard"))}</strong>
            <span>${escapeHtml(text("galleryLeaderboardDesc"))}</span>
          </div>
          <i class="ri-trophy-line"></i>
        </div>
        <div class="gallery-rank-tabs" aria-label="${escapeHtml(text("galleryLeaderboard"))}">
          <div>
            ${rangeTabs.map(([value, label]) => `<button type="button" data-rank-range="${value}" class="${state.galleryLeaderboardRange === value ? "active" : ""}">${escapeHtml(label)}</button>`).join("")}
          </div>
          <div>
            ${typeTabs.map(([value, label]) => `<button type="button" data-rank-type="${value}" class="${state.galleryLeaderboardType === value ? "active" : ""}">${escapeHtml(label)}</button>`).join("")}
          </div>
        </div>
        <div class="gallery-leaderboard-list">
          ${items.length ? items.map((item, index) => rankCard({
            item,
            index,
            text,
            escapeHtml,
            truncate,
            displayUserName,
            imageVariantUrl,
            imageFallbackImgAttrs,
            imageFallbackContainerAttrs
          })).join("") : `<div class="gallery-rank-empty">${state.lang === "zh" ? "暂无榜单作品" : "No ranked works yet"}</div>`}
        </div>
      </aside>
    `;
  }

  function rankCard({
    item,
    index,
    text,
    escapeHtml,
    truncate,
    displayUserName,
    imageVariantUrl,
    imageFallbackImgAttrs,
    imageFallbackContainerAttrs
  }) {
    const isPromptItem = item.kind === "prompt";
    const rankTitle = item.title || truncate(item.prompt, 44);
    const openAttr = isPromptItem
      ? `data-open-prompt="${escapeHtml(item.promptId || String(item.id).replace(/^prompt_/, ""))}"`
      : `data-open-square="${escapeHtml(`square_${item.id}`)}"`;
    const author = displayUserName(item);
    const likeId = isPromptItem ? item.promptId || String(item.id).replace(/^prompt_/, "") : item.id;
    const likeAttr = isPromptItem ? "data-like-prompt" : "data-like-gallery";
    const likeButton = `<button type="button" class="rank-like ${item.likedByCurrentUser ? "liked" : ""}" ${likeAttr}="${escapeHtml(likeId)}" aria-label="${escapeHtml(item.likedByCurrentUser ? text("unlikeImage") : text("likeImage"))}">
      <i class="${item.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(item.likeCount || 0)}
    </button>`;
    return `
      <article class="gallery-rank-card ${index < 3 ? `top-${index + 1}` : ""}">
        <span class="gallery-rank-index">#${index + 1}</span>
        <button type="button" class="gallery-rank-visual" ${openAttr} ${imageFallbackContainerAttrs()}>
          <img src="${escapeHtml(imageVariantUrl(item.images[0]))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(rankTitle)}">
        </button>
        <div class="gallery-rank-copy">
          <p>${escapeHtml(rankTitle)}</p>
          <small>${escapeHtml(author)}</small>
        </div>
        <div class="gallery-rank-actions">${likeButton}</div>
      </article>
    `;
  }

  global.ImageStudioGalleryLeaderboard = { render };
})(window);
