(function initAppGalleryModule(global) {
  "use strict";

  const register = global.AppModules?.register || ((name, module) => {
    global.AppModules = global.AppModules || {};
    global.AppModules[name] = module;
    return module;
  });

  function createDetailMedia(options = {}) {
    return global.ImageStudioGalleryDetailMedia?.create?.(options) || null;
  }

  function createTagViewModel(options = {}) {
    return global.ImageStudioGalleryTagViewModel?.create?.(options) || null;
  }

  function renderLeaderboard(options = {}) {
    return global.ImageStudioGalleryLeaderboard?.render?.(options) || "";
  }

  function createController(deps = {}) {
    const {
      $,
      $$,
      api,
      cacheDb,
      categoryInfo,
      copyText,
      displayUserName,
      elements,
      escapeHtml,
      GALLERY_LEADERBOARD_LIMIT,
      generationEntryFromApi,
      getPromptSource,
      getTagCounts,
      imageFallbackContainerAttrs,
      imageFallbackImgAttrs,
      imageVariantUrl,
      isCanvasEntryHidden,
      isCanvasRouteItem,
      isCategoryFilter,
      isImageToImageItem,
      loadPromptLibrary,
      navigate,
      normalizePublicTags,
      observeMotion,
      openAuthModal,
      openModal,
      openPromptDetailModal,
      openPromptEditorModal,
      openSquarePreview,
      promptCardImageUrl,
      promptCoverFallbackSrc,
      promptImageDisplayUrl,
      publicKindTagForItem,
      publicTagSuggestions,
      renderSkeleton,
      replaceRoute,
      setView,
      showToast,
      state,
      syncComposers,
      tagCategoryLabel,
      tagCategoryLabels,
      tagInfo,
      tagLabels,
      tags,
      text,
      truncate,
      uniquePromptDisplayItems
    } = deps;
    if (!state || !elements || typeof api !== "function") {
      throw new Error("Gallery controller requires state, elements, and api dependencies");
    }

    function galleryDetailCacheKey(id) {
      const cleanId = String(id || "").replace(/^square_/, "");
      return cleanId ? `gallery:${cleanId}:detail` : "";
    }

    function galleryThumbCacheKey(id) {
      const cleanId = String(id || "").replace(/^square_/, "");
      return cleanId ? `image:generation:${cleanId}:thumb` : "";
    }

    async function cacheGalleryDetail(id, generation) {
      const key = galleryDetailCacheKey(id);
      if (!key || !generation) return;
      await cacheDb()?.putJsonSnapshot?.(key, generation, {
        userId: state.user?.id,
        ttlMs: 1000 * 60 * 60 * 6,
        meta: { kind: "gallery-detail", generationId: String(id || "").replace(/^square_/, "") }
      });
    }

    async function readCachedGalleryDetail(id) {
      const snapshot = await cacheDb()?.getJsonSnapshot?.(galleryDetailCacheKey(id));
      return snapshot?.value || null;
    }

    function wireGalleryImageCache(container, item = {}) {
      const generationId = item.generationId || item.id || "";
      const cacheKey = galleryThumbCacheKey(generationId);
      if (!cacheKey || !container) return;
      $$("img", container).forEach((image) => {
        const src = image.getAttribute("src") || "";
        if (!src || src.includes("/source-file") || /^(data:|blob:)/i.test(src)) return;
        void cacheDb()?.preferCachedImage?.(image, cacheKey);
        void cacheDb()?.cacheImageUrl?.(src, {
          key: cacheKey,
          userId: state.user?.id,
          meta: { generationId, kind: "gallery-thumb-refresh" }
        });
        image.addEventListener("load", () => {
          if (image.dataset.cacheObjectUrl) return;
          void cacheDb()?.cacheImageElement?.(image, {
            key: cacheKey,
            userId: state.user?.id,
            meta: { generationId, kind: "gallery-thumb" }
          });
        }, { once: true });
      });
    }

    function uniqueGalleryEntries(items = []) {
      const seen = new Set();
      return items.filter((item) => {
        const key = String(item.generationId || item.id || item.images?.[0] || item.image || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function galleryTagViewModelForItem(item = {}, tags = item.publicTags || []) {
      const kind = publicKindTagForItem(item);
      return createTagViewModel({
        kind,
        publicTags: tags,
        adminBadge: null
      }) || window.ImageStudioGalleryTagViewModel?.create?.({
        kind,
        publicTags: tags,
        adminBadge: null
      }) || {
        kindBadge: {
          slug: kind,
          textKey: kind === "image-to-image" ? "imageToImage" : "textToImage",
          className: kind === "image-to-image" ? "image" : "text"
        },
        adminBadge: null,
        publicTags: normalizePublicTags(tags).filter((tag) => !["text-to-image", "image-to-image", "square"].includes(tag.toLowerCase()))
      };
    }

    function renderExamples() {
      elements.exampleGrid.innerHTML = getPromptSource().slice(0, 4).map(p => promptCardHtml(p).replace('class="prompt-card', 'class="prompt-card example-card')).join("");
      bindPromptCards(elements.exampleGrid);
    }

    function filterableSystemTags() {
      const list = Array.isArray(state.tagsLibrary?.list) ? state.tagsLibrary.list : [];
      if (!list.length) {
        return tags
          .filter((slug) => slug !== "all")
          .map((slug, index) => ({ ...tagInfo(slug), slug, sortOrder: index * 10, contentCount: 0 }));
      }
      return list
        .filter((tag) => tag.status !== "hidden" && tag.showInFilter !== false)
        .sort(sortGalleryTags);
    }

    function promptCategoriesForFilters() {
      const list = Array.isArray(state.tagsLibrary?.categories) ? state.tagsLibrary.categories : [];
      const source = list.length
        ? list
        : Object.keys(tagCategoryLabels.zh || {}).map((slug, index) => ({ slug, labelZh: tagCategoryLabels.zh[slug], sortOrder: index * 10 }));
      return source
        .filter((category) => category?.slug && category.status !== "hidden")
        .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || String(left.slug).localeCompare(String(right.slug)))
        .map((category) => ({ ...category, ...categoryInfo(category.slug) }));
    }

    function sortGalleryTags(left, right) {
      const pinned = { "text-to-image": 1, "image-to-image": 2 };
      const leftPinned = pinned[left.slug] || 0;
      const rightPinned = pinned[right.slug] || 0;
      if (leftPinned || rightPinned) return (leftPinned || 99) - (rightPinned || 99);
      return Number(right.galleryCount || 0) - Number(left.galleryCount || 0)
        || Number(right.contentCount || 0) - Number(left.contentCount || 0)
        || Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
        || String(left.slug).localeCompare(String(right.slug));
    }

    function existingPublishTagChoices(currentTags = []) {
      const blocked = new Set(["all", "square", "text-to-image", "image-to-image"]);
      const selected = new Set(normalizePublicTags(currentTags).map((tag) => tag.toLowerCase()));
      const library = Array.isArray(state.tagsLibrary?.list) ? state.tagsLibrary.list : [];
      const source = library.length
        ? library.filter((tag) => tag.status !== "hidden" && tag.showInFilter !== false)
        : publicTagSuggestions.map((slug, index) => ({ ...tagInfo(slug), slug, sortOrder: index * 10, galleryCount: 0 }));
      return source
        .filter((tag) => tag?.slug && !blocked.has(String(tag.slug).toLowerCase()))
        .sort((left, right) => {
          const leftSelected = selected.has(String(left.slug).toLowerCase()) ? 1 : 0;
          const rightSelected = selected.has(String(right.slug).toLowerCase()) ? 1 : 0;
          return rightSelected - leftSelected || sortGalleryTags(left, right);
        })
        .slice(0, 24);
    }

    function tagSearchText(slug) {
      const info = tagInfo(slug);
      return [info.slug, info.label, ...(info.aliases || [])].filter(Boolean).join(" ");
    }

    function relatedTagsFor(tag) {
      const category = tag.category || "general";
      return filterableSystemTags()
        .filter((item) => item.slug !== tag.slug && (item.category || "general") === category)
        .slice(0, 4);
    }

    function promptLibraryModule() {
      return window.AppModules?.promptLibrary || window.ImageStudioPromptLibrary || null;
    }

    function promptLibraryRenderContext() {
      return {
        state,
        text,
        escapeHtml,
        truncate,
        tagInfo,
        tagCategoryLabel,
        displayUserName,
        promptImageDisplayUrl,
        promptCardImageUrl,
        promptCoverFallbackSrc,
        imageFallbackImgAttrs,
        imageFallbackContainerAttrs,
        galleryTagViewModelForItem,
        isImageToImageItem,
        isCanvasRouteItem,
        isCanvasEntryHidden
      };
    }

    function emptyTagMessageHtml(tag) {
      const module = promptLibraryModule();
      if (module?.renderEmptyTagState) {
        return module.renderEmptyTagState({
          tag,
          related: relatedTagsFor(tag),
          isAdmin: state.user?.role === "admin",
          ctx: promptLibraryRenderContext()
        });
      }
      const related = relatedTagsFor(tag);
      const title = text("emptyTagTitle").replace("{tag}", tag.label || tag.slug);
      const adminAction = state.user?.role === "admin"
        ? `<button type="button" data-empty-tag-admin-create><i class="ri-add-circle-line"></i>${escapeHtml(text("emptyTagAdminCreate"))}</button>`
        : "";
      return `
        <div class="empty-message empty-tag-state">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(text("emptyTagBody"))}</span>
          <div class="empty-tag-actions">
            <button type="button" data-empty-tag-generate><i class="ri-sparkling-2-line"></i>${escapeHtml(text("emptyTagGenerate"))}</button>
            ${adminAction}
          </div>
          ${related.length ? `
            <div class="empty-tag-related">
              <em>${escapeHtml(text("emptyTagNearby"))}</em>
              ${related.map((item) => {
                const info = tagInfo(item.slug);
                return `<button type="button" data-tag="${escapeHtml(item.slug)}">${escapeHtml(info.label)}</button>`;
              }).join("")}
            </div>
          ` : ""}
        </div>
      `;
    }

    function renderLibrary() {
      elements.librarySearchInput.value = state.librarySearch;
      const module = promptLibraryModule();
      const ctx = promptLibraryRenderContext();
      const source = getLibrarySource();
      const counts = getTagCounts(source);
      const systemTags = filterableSystemTags();
      const categories = promptCategoriesForFilters();
      const known = new Set(systemTags.map((tag) => tag.slug));
      const dynamicTags = Object.keys(counts)
        .filter((tag) => !known.has(tag) && !tags.includes(tag))
        .sort((left, right) => counts[right] - counts[left] || left.localeCompare(right))
        .slice(0, 20)
        .map((slug) => ({ ...tagInfo(slug), slug, contentCount: counts[slug] || 0, category: "general" }));
      const filterTags = [
        { slug: "all", label: tagLabels[state.lang].all, contentCount: source.length, category: "core" },
        ...categories.map((category) => {
          const count = systemTags
            .filter((tag) => (tag.category || "general") === category.slug)
            .reduce((sum, tag) => sum + Number(counts[tag.slug] || tag.contentCount || 0), 0);
          return { ...category, slug: `category:${category.slug}`, categorySlug: category.slug, contentCount: count, isCategory: true };
        }),
        ...systemTags,
        ...dynamicTags
      ];
      elements.tagFilters.innerHTML = module?.renderTagFilters?.({
        filterTags,
        activeTag: state.libraryTag,
        sourceLength: source.length,
        counts,
        ctx
      }) || filterTags.map((tag) => {
        const info = tag.slug === "all" ? tag : tag.isCategory ? tag : tagInfo(tag.slug);
        const count = tag.slug === "all" ? source.length : (counts[tag.slug] || info.contentCount || 0);
        const empty = tag.slug !== "all" && count === 0;
        const category = !tag.isCategory && info.category && info.category !== "core"
          ? tagCategoryLabel(info.category)
          : "";
        const title = `${info.slug}${info.aliases?.length ? ` · ${info.aliases.join(" · ")}` : ""}`;
        return `
          <button type="button" class="${state.libraryTag === tag.slug ? "active" : ""} ${empty ? "empty" : ""}" data-tag="${escapeHtml(tag.slug)}" title="${escapeHtml(title)}">
            ${category ? `<em>${escapeHtml(category)}</em>` : ""}
            ${escapeHtml(info.label || tag.label || tag.slug)}
            <span>${count}</span>
          </button>
        `;
      }).join("");
      $$("[data-tag]", elements.tagFilters).forEach((button) => {
        button.addEventListener("click", () => {
          state.libraryTag = button.dataset.tag;
          state.promptVisible = 20;
          renderLibrary();
        });
      });

      const query = state.librarySearch.trim().toLowerCase();
      const selectedCategory = isCategoryFilter(state.libraryTag) ? state.libraryTag.replace(/^category:/, "") : "";
      const filtered = source.filter((prompt) => {
        const promptTags = Array.isArray(prompt.tags) ? prompt.tags : [prompt.tag].filter(Boolean);
        const matchesTags = state.libraryTag === "all"
          || (selectedCategory
            ? promptTags.some((slug) => (tagInfo(slug).category || "general") === selectedCategory)
            : promptTags.includes(state.libraryTag));
        const haystack = `${prompt.title} ${prompt.prompt} ${promptTags.join(" ")} ${prompt.author || ""} ${promptTags.map(tagSearchText).join(" ")}`.toLowerCase();
        return matchesTags && (!query || haystack.includes(query));
      });
      const visible = filtered.slice(0, state.promptVisible);
      const sourceCount = getSourceCount(source);
      const summary = state.tagsLibrary?.summary || {};
      const sortOptions = [
        ["hot", "ri-fire-line", text("promptSortHot")],
        ["new", "ri-time-line", text("promptSortNew")],
        ["used", "ri-arrow-right-circle-line", text("promptSortUsed")],
        ["liked", "ri-heart-line", text("promptSortLiked")]
      ];
      const sortControl = module?.renderSortControl?.({
        sortOptions,
        activeSort: state.librarySort,
        ctx
      }) || `
        <div class="library-sort" role="tablist" aria-label="${escapeHtml(text("promptSortLabel"))}">
          ${sortOptions.map(([value, icon, label]) => `
            <button type="button" role="tab" aria-selected="${state.librarySort === value ? "true" : "false"}" class="${state.librarySort === value ? "active" : ""}" data-prompt-sort="${escapeHtml(value)}">
              <i class="${icon}"></i>${escapeHtml(label)}
            </button>
          `).join("")}
        </div>
      `;
      const stats = module?.renderStats?.({
        sourceLength: source.length,
        sourceCount,
        summary,
        systemCount: filterableSystemTags().length,
        ctx
      }) || `
        <div class="library-stats">
          <div><strong>${source.length.toLocaleString()}+</strong><span>${text("totalPrompts")}</span></div>
          <div class="stat-divider"></div>
          <div><strong>${sourceCount}</strong><span>${text("totalSources")}</span></div>
          <div class="stat-divider"></div>
          <div><strong>${Number(summary.systemCount || filterableSystemTags().length)}</strong><span>${text("tagStatsSystem")}</span></div>
          <div><strong>${Number(summary.withContentCount || 0)}</strong><span>${text("tagStatsWithContent")}</span></div>
          <div><strong>${Number(summary.emptyCount || 0)}</strong><span>${text("tagStatsEmpty")}</span></div>
        </div>
      `;
      const selectedInfo = state.libraryTag !== "all"
        ? selectedCategory
          ? categoryInfo(selectedCategory)
          : tagInfo(state.libraryTag)
        : null;
      const sourceNotice = state.promptLoading ? "" : module?.renderSourceNotice?.({
        ...state.promptLibraryMeta,
        offline: state.promptLibraryMeta?.offline || navigator.onLine === false,
        ctx
      }) || "";
      const canRevealLoaded = visible.length < filtered.length;
      const canFetchMore = !state.promptLibraryMeta?.fallbackUsed && state.promptHasMore;
      const loadMoreHtml = (canRevealLoaded || canFetchMore) ? `
        <div class="load-more-wrap">
          <button id="loadMorePrompts" type="button" ${state.promptLoadingMore ? "disabled" : ""}>
            ${state.promptLoadingMore ? (state.lang === "zh" ? "加载中" : "Loading") : text("loadMore")}
            <span>(${visible.length}/${filtered.length}${canFetchMore ? "+" : ""})</span>
          </button>
        </div>
      ` : "";
      const cardsHtml = visible.map(promptCardHtml).join("")
        + loadMoreHtml;
      if (state.promptLoading) {
        renderSkeleton(elements.promptGrid, { rows: 6, variant: "card", label: text("promptLibrary") });
      } else {
        elements.promptGrid.innerHTML = filtered.length || canFetchMore
            ? `${sourceNotice}<div class="gallery-main-grid">${cardsHtml}</div>`
            : selectedInfo
              ? `${sourceNotice}${emptyTagMessageHtml(selectedInfo)}`
              : `${sourceNotice}${module?.renderLibraryState?.({
                type: state.promptLibraryMeta?.permissionDenied ? "permission" : state.promptLibraryMeta?.offline ? "offline" : state.promptLibraryMeta?.error ? "error" : "empty",
                title: text("noResults"),
                ctx
              }) || `<div class="empty-message">${text("noResults")}</div>`}`;
      }
      const statsTarget = $(".library-stats", elements.libraryView);
      if (statsTarget) statsTarget.remove();
      const sortTarget = $(".library-sort", elements.libraryView);
      if (sortTarget) sortTarget.remove();
      const leaderboardTarget = $(".library-mobile-leaderboard", elements.libraryView);
      if (leaderboardTarget) leaderboardTarget.remove();
      const adminCreate = $(".library-admin-create", elements.libraryView);
      if (adminCreate) adminCreate.remove();
      const libraryHero = $(".library-hero", elements.libraryView);
      libraryHero?.insertAdjacentHTML("beforeend", `
        <button class="library-mobile-leaderboard" type="button" data-open-leaderboard-inline>
          <i class="ri-trophy-line"></i>
          <span>${escapeHtml(text("galleryLeaderboardPage"))}</span>
          <small>${state.lang === "zh" ? "查看热门作品" : "Top liked works"}</small>
        </button>
      `);
      libraryHero?.insertAdjacentHTML("beforeend", sortControl);
      libraryHero?.insertAdjacentHTML("beforeend", stats);
      $("[data-open-leaderboard-inline]", elements.libraryView)?.addEventListener("click", () => navigate("leaderboard", { scrollTop: true }));
      $$("[data-prompt-sort]", elements.libraryView).forEach((button) => {
        button.addEventListener("click", async () => {
          const nextSort = button.dataset.promptSort;
          if (!nextSort || nextSort === state.librarySort) return;
          state.librarySort = nextSort;
          state.promptVisible = 20;
          replaceRoute();
          await loadPromptLibrary();
        });
      });
      if (state.user?.role === "admin") {
        libraryHero?.insertAdjacentHTML("beforeend", `
          <button class="library-admin-create" type="button" data-prompt-create>
            <i class="ri-add-circle-line"></i>${escapeHtml(text("promptCreateTitle"))}
          </button>
        `);
        $("[data-prompt-create]", elements.libraryView)?.addEventListener("click", () => openPromptEditorModal());
      }
      $("[data-empty-tag-generate]", elements.promptGrid)?.addEventListener("click", () => {
        const label = selectedInfo?.label || state.libraryTag;
        state.draftPrompt = state.lang === "zh" ? `${label}风格的图片` : `${label} image`;
        state.forceHero = true;
        setView("home");
        syncComposers();
      });
      $("[data-empty-tag-admin-create]", elements.promptGrid)?.addEventListener("click", () => {
        openPromptEditorModal();
        const tagsInput = $("#promptEditorTags", elements.modalLayer);
        if (tagsInput) tagsInput.value = state.libraryTag;
        const titleInput = $("#promptEditorTitle", elements.modalLayer);
        if (titleInput && !titleInput.value) titleInput.value = selectedInfo?.label || state.libraryTag;
      });
      $$("[data-tag]", elements.promptGrid).forEach((button) => {
        button.addEventListener("click", () => {
          state.libraryTag = button.dataset.tag;
          state.promptVisible = 20;
          renderLibrary();
        });
      });
      $("#loadMorePrompts")?.addEventListener("click", async () => {
        if (state.promptLoadingMore) return;
        const nextVisible = state.promptVisible + 20;
        if (state.promptVisible < filtered.length) {
          state.promptVisible = nextVisible;
          renderLibrary();
          return;
        }
        if (state.promptHasMore && !state.promptLibraryMeta?.fallbackUsed) {
          state.promptVisible = nextVisible;
          await loadPromptLibrary({ append: true });
        }
      });
      bindPromptCards(elements.promptGrid);
      observeMotion(elements.libraryView);
    }

    function renderGalleryLeaderboard() {
      return renderLeaderboard({
        state,
        text,
        escapeHtml,
        truncate,
        displayUserName,
        imageVariantUrl,
        imageFallbackImgAttrs,
        imageFallbackContainerAttrs
      }) || window.ImageStudioGalleryLeaderboard?.render?.({
        state,
        text,
        escapeHtml,
        truncate,
        displayUserName,
        imageVariantUrl,
        imageFallbackImgAttrs,
        imageFallbackContainerAttrs
      }) || "";
    }

    function galleryLeaderboardRequestKey() {
      return `${state.galleryLeaderboardRange || "all"}:${state.galleryLeaderboardType || "all"}`;
    }

    function renderLeaderboardPage() {
      if (!elements.leaderboardPage) return;
      elements.leaderboardPage.innerHTML = `
        <div class="leaderboard-page-head">
          <span class="library-badge"><i class="ri-trophy-line"></i>${escapeHtml(text("galleryLeaderboardPage"))}</span>
          <h1>${escapeHtml(text("galleryLeaderboard"))}</h1>
          <p>${escapeHtml(text("galleryLeaderboardDesc"))}</p>
        </div>
        ${renderGalleryLeaderboard()}
      `;
      bindGalleryLeaderboardControls(elements.leaderboardPage);
      bindPromptCards(elements.leaderboardPage);
      observeMotion(elements.leaderboardPage);
    }

    function bindGalleryLeaderboardControls(root = document) {
      $$("[data-rank-range]", root).forEach((button) => {
        button.addEventListener("click", async () => {
          if (button.dataset.rankRange === state.galleryLeaderboardRange || state.galleryLeaderboardLoading) return;
          state.galleryLeaderboardRange = button.dataset.rankRange;
          await loadGalleryLeaderboard();
          if (state.view === "leaderboard") renderLeaderboardPage();
          else renderLibrary();
        });
      });
      $$("[data-rank-type]", root).forEach((button) => {
        button.addEventListener("click", async () => {
          if (button.dataset.rankType === state.galleryLeaderboardType || state.galleryLeaderboardLoading) return;
          state.galleryLeaderboardType = button.dataset.rankType;
          await loadGalleryLeaderboard();
          if (state.view === "leaderboard") renderLeaderboardPage();
          else renderLibrary();
        });
      });
    }

    function getSourceCount(source) {
      const origins = new Set();
      source.forEach((prompt) => {
        if (prompt.source) origins.add(prompt.source);
        if (!prompt.sourceUrl) return;
        try {
          origins.add(new URL(prompt.sourceUrl).hostname.replace(/^www\./, ""));
        } catch {
          origins.add(prompt.sourceUrl);
        }
      });
      return Math.max(1, origins.size);
    }

    function promptCardHtml(prompt) {
      const module = promptLibraryModule();
      if (module?.renderPromptCard) {
        return module.renderPromptCard(prompt, promptLibraryRenderContext());
      }
      const promptText = prompt.prompt;
      const title = prompt.title;
      const coverUrl = promptImageDisplayUrl(prompt);
      const tagView = prompt.kind === "square"
        ? galleryTagViewModelForItem(prompt, prompt.publicTags || prompt.tags || [])
        : { publicTags: prompt.tags || [prompt.tag].filter(Boolean) };
      const tagsHtml = tagView.publicTags.slice(0, 3).map((tag) => {
        const info = tagInfo(tag);
        return `
        <span class="tag-chip" style="--tag-hue:${info.hue}">${escapeHtml(info.label)}</span>
      `;
      }).join("");
      const fallbackSrc = promptCoverFallbackSrc(prompt);
      const cardImageUrl = promptCardImageUrl(prompt, coverUrl);
      const removeBrokenPromptImage = prompt.kind !== "square" ? ' data-remove-on-image-error="1"' : "";
      const art = coverUrl
        ? `<img src="${escapeHtml(cardImageUrl)}" ${imageFallbackImgAttrs(fallbackSrc)}${removeBrokenPromptImage} loading="lazy" decoding="async" fetchpriority="low" alt="${escapeHtml(title)}">`
        : window.ImageStudioPromptCoverFallback?.render?.(prompt, { escapeHtml, truncate }) || `<i class="${prompt.icon || "ri-image-line"}"></i>`;
      const canvasBadge = isCanvasRouteItem(prompt)
        ? `<b class="canvas-route-badge"><i class="ri-node-tree"></i>${escapeHtml(state.lang === "zh" ? "画布线路" : "Canvas route")}</b>`
        : "";
      const sourceBadge = prompt.kind === "square"
        ? `<em class="square-badge"><i class="ri-user-line"></i>${escapeHtml(displayUserName(prompt))}</em><b>${text(tagView.kindBadge?.textKey || (isImageToImageItem(prompt) ? "imageToImage" : "textToImage"))}</b>${canvasBadge}`
        : `<em><i class="ri-user-line"></i>${escapeHtml(prompt.sourceRepo || prompt.source || prompt.author || "@open")}</em>`;
      const openAttr = prompt.kind === "square"
        ? ` data-open-square="${escapeHtml(prompt.id)}" role="button" tabindex="0"`
        : ` data-open-prompt="${escapeHtml(prompt.id)}" role="button" tabindex="0"`;
      const cardArtClickable = " card-art-clickable";
      const isAdmin = state.user?.role === "admin";
      const adminBadge = isAdmin && prompt.kind !== "square" && prompt.status === "hidden"
        ? `<span class="prompt-status-badge hidden">${escapeHtml(text("promptHidden"))}</span>`
        : "";
      const adminActions = isAdmin && prompt.kind !== "square"
        ? `
          <button type="button" data-edit-prompt="${escapeHtml(prompt.id)}" class="prompt-admin-edit"><i class="ri-pencil-line"></i>${text("promptEdit")}</button>
          <button type="button" data-delete-prompt="${escapeHtml(prompt.id)}" class="prompt-admin-delete"><i class="ri-delete-bin-line"></i>${text("promptDelete")}</button>
        `
        : "";
      const viewDetailButton = prompt.kind === "square"
        ? `<button type="button" data-view-square="${escapeHtml(prompt.id)}"><i class="ri-eye-line"></i>${text("viewDetail")}</button>`
        : `<button type="button" data-view-prompt="${escapeHtml(prompt.id)}"><i class="ri-eye-line"></i>${text("viewDetail")}</button>`;
      const engagement = prompt.kind === "square" ? `
        <div class="prompt-engagement">
          <button type="button" data-like-gallery="${escapeHtml(prompt.generationId || prompt.id)}" class="${prompt.likedByCurrentUser ? "liked" : ""}">
            <i class="${prompt.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(prompt.likeCount || 0)}
          </button>
        </div>
      ` : `
        <div class="prompt-engagement">
          <button type="button" data-like-prompt="${escapeHtml(prompt.id)}" class="${prompt.likedByCurrentUser ? "liked" : ""}">
            <i class="${prompt.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(prompt.likeCount || 0)}
          </button>
          <span><i class="ri-fire-line"></i>${Number(prompt.heatScore || 0).toFixed(0)}</span>
        </div>
      `;
      return `
        <article class="prompt-card${prompt.status === "hidden" ? " prompt-hidden" : ""}" style="--art-bg:${prompt.colors || "linear-gradient(135deg,#64748b,#cbd5e1)"}">
          <div class="card-art${cardArtClickable}" ${imageFallbackContainerAttrs()}${openAttr}>${art}${sourceBadge}${adminBadge}</div>
          <h3>${escapeHtml(title)}</h3>
          ${engagement}
          <div class="prompt-tags">${tagsHtml}</div>
          <p>${escapeHtml(promptText)}</p>
          <div class="card-actions">
            <button type="button" data-copy-prompt="${escapeHtml(prompt.id)}"><i class="ri-file-copy-line"></i>${text("copy")}</button>
            ${viewDetailButton}
            <button class="btn btn--primary use-button" type="button" data-use-prompt="${escapeHtml(prompt.id)}">${text("use")} <i class="ri-arrow-right-line"></i></button>
            ${adminActions}
          </div>
        </article>
      `;
    }

    function bindPromptCards(root) {
      $$("[data-open-square], [data-view-square]", root).forEach((node) => {
        const open = () => {
          const id = node.dataset.openSquare || node.dataset.viewSquare;
          const prompt = getPromptById(id);
          if (prompt) {
            openSquarePreview(prompt);
            return;
          }
          openSquarePreviewById(id);
        };
        node.addEventListener("click", open);
        if (node.hasAttribute("data-open-square")) {
          node.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          });
        }
      });
      $$("[data-open-prompt], [data-view-prompt]", root).forEach((node) => {
        const open = () => {
          const id = node.dataset.openPrompt || node.dataset.viewPrompt;
          const prompt = getPromptById(id) || findPromptLikeItem(id);
          if (prompt) openPromptDetailModal(prompt);
        };
        node.addEventListener("click", open);
        if (node.hasAttribute("data-open-prompt")) {
          node.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          });
        }
      });
      $$("[data-copy-prompt]", root).forEach((button) => {
        button.addEventListener("click", async () => {
          const prompt = getPromptById(button.dataset.copyPrompt);
          if (!prompt) return;
          await copyText(prompt.prompt);
          showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
        });
      });
      $$("[data-use-prompt]", root).forEach((button) => {
        button.addEventListener("click", async () => {
          const prompt = getPromptById(button.dataset.usePrompt);
          if (!prompt) return;
          api(`/api/prompts/${encodeURIComponent(prompt.id)}/use`, { method: "POST" }).catch(() => null);
          state.draftPrompt = prompt.prompt;
          state.forceHero = true;
          setView("home");
          syncComposers();
          showToast(state.lang === "zh" ? "已填入生成框" : "Sent to composer", "ri-arrow-right-line");
          setTimeout(() => $(".prompt-box", elements.heroComposerMount)?.focus(), 120);
        });
      });
      $$("[data-like-prompt]", root).forEach((button) => {
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          await togglePromptLike(button.dataset.likePrompt);
        });
      });
      $$("[data-like-gallery]", root).forEach((button) => {
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          await toggleGalleryLike(button.dataset.likeGallery);
        });
      });
      $$("[data-edit-prompt]", root).forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.dataset.editPrompt;
          const prompt = getPromptById(id);
          if (prompt) openPromptEditorModal(prompt);
        });
      });
      $$("[data-delete-prompt]", root).forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.dataset.deletePrompt;
          const prompt = getPromptById(id);
          if (!prompt) return;
          if (!confirm(state.lang === "zh"
            ? `确认隐藏提示词「${prompt.title || prompt.id}」？该操作会软删，可由管理员重新激活。`
            : `Hide prompt "${prompt.title || prompt.id}"? This is a soft delete and can be re-activated by an admin.`)) {
            return;
          }
          try {
            await api(`/api/prompts/${encodeURIComponent(id)}`, { method: "DELETE" });
            showToast(state.lang === "zh" ? "已隐藏提示词" : "Prompt hidden", "ri-archive-line");
            await loadPromptLibrary();
          } catch (error) {
            showToast(error.message, "ri-error-warning-line");
          }
        });
      });
    }

    function publicGalleryPromptItems() {
      const seen = new Set();
      return [...state.publicGallery, ...state.galleryLeaderboard]
        .filter((item) => item.kind !== "prompt" && !String(item.id || "").startsWith("prompt_"))
        .filter((item) => item.images?.[0] && item.prompt)
        .filter((item) => {
          const key = String(item.id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item) => {
          const tagView = galleryTagViewModelForItem(item, item.publicTags || []);
          return {
            id: `square_${item.id}`,
            generationId: item.id,
            kind: "square",
            tag: tagView.kindBadge.slug,
            tags: [tagView.kindBadge.slug, ...tagView.publicTags],
            title: truncate(item.prompt, 38),
            prompt: item.prompt,
            image: item.images[0],
            images: item.images,
            source: "generation-square",
            author: displayUserName(item),
            userId: item.userId || "",
            userName: item.userName || "",
            colors: "linear-gradient(135deg,#0f172a,#94a3b8)",
            creativeRoute: item.creativeRoute || item.conversation || [],
            conversation: item.conversation || [],
            sourceImageUrl: item.sourceImageUrl || "",
            sourceImageId: item.sourceImageId || "",
            sourcePrompt: item.sourcePrompt || "",
            originGalleryId: item.originGalleryId || "",
            likeCount: Number(item.likeCount || 0),
            likedByCurrentUser: Boolean(item.likedByCurrentUser),
            publicTags: tagView.publicTags,
            isPublic: true,
            time: item.time
          };
        });
    }

    function getLibrarySource() {
      const prompts = getPromptSource();
      const publicItems = publicGalleryPromptItems();
      return uniquePromptDisplayItems([...publicItems, ...prompts]);
    }

    function getPromptById(id) {
      const key = String(id);
      return getLibrarySource().find((item) => String(item.id) === key);
    }

    function squareItemFromPrompt(prompt) {
      if (prompt.kind === "square") {
        return state.publicGallery.find((item) => String(item.id) === String(prompt.generationId)) || {
          id: prompt.generationId || String(prompt.id).replace(/^square_/, ""),
          prompt: prompt.prompt,
          images: prompt.images || [prompt.image],
          sourceImageUrl: prompt.sourceImageUrl || "",
          sourceImageId: prompt.sourceImageId || "",
          sourcePrompt: prompt.sourcePrompt || "",
          originGalleryId: prompt.originGalleryId || "",
          likeCount: Number(prompt.likeCount || 0),
          likedByCurrentUser: Boolean(prompt.likedByCurrentUser),
          conversation: prompt.conversation || [],
          creativeRoute: prompt.creativeRoute || prompt.conversation || [],
          referenceAssets: prompt.referenceAssets || [],
          publicTags: prompt.publicTags || [],
          userId: prompt.userId || "",
          userName: prompt.userName || prompt.author || "",
          time: prompt.time,
          isPublic: true
        };
      }
      return prompt;
    }

    function openGalleryUnavailableModal(id = "") {
      openModal(`
        <section class="modal square-empty-modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-image-close-line"></i>
            <h2>${escapeHtml(state.lang === "zh" ? "作品暂不可见" : "Work unavailable")}</h2>
            <p>${escapeHtml(state.lang === "zh" ? "该画廊作品不存在、已隐藏，或当前链接无法访问。" : "This gallery work does not exist, is hidden, or cannot be opened from this link.")}</p>
            ${id ? `<small>${escapeHtml(id)}</small>` : ""}
          </div>
        </section>
      `);
    }

    async function openSquarePreviewById(id, options = {}) {
      const key = String(id || "").replace(/^square_/, "");
      const localPrompt = getPromptById(`square_${key}`) || getPromptById(key);
      if (localPrompt) {
        openSquarePreview(localPrompt, options);
        return;
      }
      const cachedGeneration = await readCachedGalleryDetail(key);
      if (cachedGeneration) {
        const cached = generationEntryFromApi(cachedGeneration, { status: "done" });
        state.publicGallery = [cached, ...state.publicGallery.filter((item) => String(item.id) !== String(cached.id))];
        openSquarePreview({ ...cached, id: `square_${cached.id}`, generationId: cached.id, kind: "square" }, options);
      }
      try {
        const data = await api(`/api/gallery/${encodeURIComponent(key)}`);
        const generation = generationEntryFromApi(data.generation, { status: "done" });
        state.publicGallery = [generation, ...state.publicGallery.filter((item) => String(item.id) !== String(generation.id))];
        await cacheGalleryDetail(key, data.generation || generation);
        openSquarePreview({ ...generation, id: `square_${generation.id}`, generationId: generation.id, kind: "square" }, cachedGeneration ? { ...options, replaceRoute: false } : options);
      } catch {
        if (!cachedGeneration) openGalleryUnavailableModal(key);
      }
    }

    async function loadPublicGallery() {
      renderSkeleton(elements.recentMasonry, { rows: 6, variant: "card", label: text("recentCreations") });
      try {
        const data = await api("/api/images/public?limit=120");
        state.publicGallery = uniqueGalleryEntries((data.generations || []).map((generation) => generationEntryFromApi(generation, { status: "done" })));
      } catch {
        state.publicGallery = [];
      }
    }

    async function loadGalleryLeaderboard() {
      state.galleryLeaderboardLoading = true;
      const requestKey = galleryLeaderboardRequestKey();
      renderSkeleton(elements.leaderboardPage, { rows: 5, variant: "rank", label: text("galleryLeaderboard") });
      try {
        const params = new URLSearchParams({
          range: state.galleryLeaderboardRange || "all",
          limit: String(GALLERY_LEADERBOARD_LIMIT)
        });
        if (state.galleryLeaderboardType && state.galleryLeaderboardType !== "all") {
          params.set("type", state.galleryLeaderboardType);
        }
        const data = await api(`/api/gallery/leaderboard?${params.toString()}`);
        state.galleryLeaderboard = uniqueGalleryEntries((data.generations || []).map((generation) => generationEntryFromApi(generation, { status: "done" })));
        state.galleryLeaderboardLoadedKey = requestKey;
      } catch {
        state.galleryLeaderboard = [];
        state.galleryLeaderboardLoadedKey = "";
      } finally {
        state.galleryLeaderboardLoading = false;
      }
    }

    async function ensureGalleryLeaderboardLoaded() {
      if (state.galleryLeaderboardLoading || (state.galleryLeaderboard.length && state.galleryLeaderboardLoadedKey === galleryLeaderboardRequestKey())) return;
      renderLeaderboardPage();
      await loadGalleryLeaderboard();
      if (state.view === "leaderboard") renderLeaderboardPage();
    }

    function findPromptLikeItem(promptId) {
      const key = String(promptId || "");
      if (!key) return null;
      return getPromptById(key) || state.galleryLeaderboard.find((entry) => {
        const entryPromptId = entry.promptId || (String(entry.id || "").startsWith("prompt_") ? String(entry.id).slice(7) : "");
        return String(entryPromptId) === key;
      }) || null;
    }

    function updatePromptLikeState(prompt) {
      const updated = {
        ...prompt,
        likeCount: Number(prompt.likeCount || 0),
        likedByCurrentUser: Boolean(prompt.likedByCurrentUser)
      };
      state.promptItems = state.promptItems.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item);
      state.galleryLeaderboard = state.galleryLeaderboard.map((item) => {
        const promptId = item.promptId || (String(item.id || "").startsWith("prompt_") ? String(item.id).slice(7) : "");
        return String(promptId) === String(updated.id)
          ? { ...item, likeCount: updated.likeCount, likedByCurrentUser: updated.likedByCurrentUser }
          : item;
      });
      $$(`[data-like-prompt="${CSS.escape(String(updated.id))}"], [data-prompt-detail-like="${CSS.escape(String(updated.id))}"]`).forEach((button) => {
        button.classList.toggle("liked", updated.likedByCurrentUser);
        button.innerHTML = `<i class="${updated.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(updated.likeCount || 0)}`;
      });
    }

    function setLikeFeedback(selector, { busy = false, failed = false, message = "" } = {}) {
      $$(selector).forEach((button) => {
        button.toggleAttribute("aria-busy", busy);
        button.disabled = busy;
        button.classList.toggle("prompt-like-error", failed);
        if (message) button.setAttribute("title", message);
        if (failed) {
          setTimeout(() => button.classList.remove("prompt-like-error"), 1400);
        }
      });
    }

    async function togglePromptLike(promptId) {
      if (!state.user) {
        openAuthModal("login");
        return;
      }
      const item = findPromptLikeItem(promptId);
      if (!item) return;
      const targetId = item.promptId || String(item.id || "").replace(/^prompt_/, "");
      const nextLiked = !item.likedByCurrentUser;
      const selector = `[data-like-prompt="${CSS.escape(String(targetId))}"], [data-prompt-detail-like="${CSS.escape(String(targetId))}"]`;
      try {
        setLikeFeedback(selector, { busy: true });
        const data = await api(`/api/prompts/${encodeURIComponent(targetId)}/like`, {
          method: "POST",
          body: JSON.stringify({ liked: nextLiked })
        });
        if (data?.prompt) updatePromptLikeState(data.prompt);
        if (state.view === "library") renderLibrary();
      } catch (error) {
        setLikeFeedback(selector, { failed: true, message: error.message || text("publishFailed") });
        showToast(error.message || text("publishFailed"), "ri-error-warning-line");
      } finally {
        setLikeFeedback(selector, { busy: false });
      }
    }

    function updateGalleryLikeState(generation) {
      const updated = generationEntryFromApi(generation, { status: "done" });
      const apply = (item) => String(item.id) === String(updated.id) || String(item.generationId) === String(updated.id)
        ? { ...item, likeCount: updated.likeCount, likedByCurrentUser: updated.likedByCurrentUser }
        : item;
      state.publicGallery = state.publicGallery.map(apply);
      state.galleryLeaderboard = state.galleryLeaderboard.map(apply);
      state.history = state.history.map(apply);
      state.promptItems = state.promptItems.map(apply);
      $$(`[data-like-gallery="${CSS.escape(String(updated.id))}"]`).forEach((button) => {
        button.classList.toggle("liked", updated.likedByCurrentUser);
        button.innerHTML = `<i class="${updated.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(updated.likeCount || 0)}`;
      });
      $$(`[data-square-like="${CSS.escape(String(updated.id))}"]`).forEach((button) => {
        button.classList.toggle("liked", updated.likedByCurrentUser);
        button.innerHTML = `<i class="${updated.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(updated.likeCount || 0)}`;
      });
    }

    async function toggleGalleryLike(generationId) {
      if (!state.user) {
        openAuthModal("login");
        return;
      }
      const item = [...state.publicGallery, ...state.galleryLeaderboard, ...state.history]
        .find((entry) => String(entry.id) === String(generationId) || String(entry.generationId) === String(generationId));
      const nextLiked = !item?.likedByCurrentUser;
      const selector = `[data-like-gallery="${CSS.escape(String(generationId))}"], [data-square-like="${CSS.escape(String(generationId))}"]`;
      try {
        setLikeFeedback(selector, { busy: true });
        const data = await api(`/api/gallery/${encodeURIComponent(generationId)}/like`, {
          method: nextLiked ? "POST" : "DELETE",
          body: "{}"
        });
        if (data?.generation) updateGalleryLikeState(data.generation);
        if (state.view === "library") renderLibrary();
      } catch (error) {
        setLikeFeedback(selector, { failed: true, message: error.message || text("publishFailed") });
        showToast(error.message || text("publishFailed"), "ri-error-warning-line");
      } finally {
        setLikeFeedback(selector, { busy: false });
      }
    }

    return Object.freeze({
      galleryDetailCacheKey,
      galleryThumbCacheKey,
      cacheGalleryDetail,
      readCachedGalleryDetail,
      wireGalleryImageCache,
      uniqueGalleryEntries,
      galleryTagViewModelForItem,
      renderExamples,
      filterableSystemTags,
      promptCategoriesForFilters,
      sortGalleryTags,
      existingPublishTagChoices,
      tagSearchText,
      relatedTagsFor,
      promptLibraryModule,
      promptLibraryRenderContext,
      emptyTagMessageHtml,
      renderLibrary,
      renderGalleryLeaderboard,
      galleryLeaderboardRequestKey,
      renderLeaderboardPage,
      bindGalleryLeaderboardControls,
      getSourceCount,
      promptCardHtml,
      bindPromptCards,
      publicGalleryPromptItems,
      getLibrarySource,
      getPromptById,
      squareItemFromPrompt,
      openGalleryUnavailableModal,
      openSquarePreviewById,
      loadPublicGallery,
      loadGalleryLeaderboard,
      ensureGalleryLeaderboardLoaded,
      findPromptLikeItem,
      updatePromptLikeState,
      setLikeFeedback,
      togglePromptLike,
      updateGalleryLikeState,
      toggleGalleryLike
    });
  }

  register("gallery", {
    createDetailMedia,
    createTagViewModel,
    renderLeaderboard,
    createController
  });
})(window);
