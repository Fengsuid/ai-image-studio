(function initAppAuth(global) {
  "use strict";

  const modules = global.AppModules || (global.AppModules = {});
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readCookie(name) {
    const match = document.cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split("="))
      .find(([key]) => decodeURIComponent(key) === name);
    return match ? decodeURIComponent(match.slice(1).join("=")) : "";
  }

  function requireContext(context, name) {
    const value = context[name];
    if (value === undefined || value === null) {
      throw new Error(`AppModules.auth missing context: ${name}`);
    }
    return value;
  }

  function createAuthController(context = {}) {
    const state = requireContext(context, "state");
    const elements = requireContext(context, "elements");
    const text = requireContext(context, "text");
    const escapeHtml = requireContext(context, "escapeHtml");
    const formatDate = requireContext(context, "formatDate");
    const truncate = requireContext(context, "truncate");
    const openModal = requireContext(context, "openModal");
    const closeModal = requireContext(context, "closeModal");
    const showToast = requireContext(context, "showToast");

    async function api(path, options = {}) {
      const method = String(options.method || "GET").toUpperCase();
      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
      };
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        headers["X-CSRF-Token"] = state.csrfToken || readCookie("csrf");
      }
      const response = await fetch(path, {
        ...options,
        credentials: "same-origin",
        headers
      });
      if (response.status === 204) return null;
      const data = await response.json().catch(() => ({}));
      if (data.csrfToken) state.csrfToken = data.csrfToken;
      if (!response.ok) {
        const auditRequiredMode = data.details?.requiredMode || data.details?.audit?.requiredMode || "";
        const message = auditRequiredMode === "image-to-image"
          ? (state.lang === "zh"
            ? "提示词与已有公开内容高度相似，请改用图生图或含原图发布。"
            : "This prompt is highly similar to existing public content. Publish it as image-to-image instead.")
          : (data.error || "Request failed");
        const error = new Error(message);
        error.status = response.status;
        error.details = data.details || null;
        throw error;
      }
      return data;
    }

    function closeAccountMenu() {
      elements.accountMenu?.classList.add("hidden");
      elements.accountMenuBtn?.setAttribute("aria-expanded", "false");
    }

    function openAuthModal(mode = state.authMode) {
      state.authMode = mode;
      const isRegister = mode === "register";
      openModal(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-sparkling-2-fill"></i>
            <h2>${isRegister ? text("registerTitle") : text("loginTitle")}</h2>
            <p><i class="ri-gift-line"></i> ${text("authGift")}</p>
            <p class="auth-bonus"><i class="ri-flashlight-line"></i> ${text("authBonus")}</p>
          </div>
          <div class="auth-tabs">
            <button type="button" class="${!isRegister ? "active" : ""}" data-auth-mode="login">${text("submitLogin")}</button>
            <button type="button" class="${isRegister ? "active" : ""}" data-auth-mode="register">${text("submitRegister")}</button>
          </div>
          <form id="authForm" class="modal-form">
            ${isRegister ? `<label>${text("name")}<input id="authName" autocomplete="name"></label>` : ""}
            <label>${text("email")}<input id="authEmail" type="email" autocomplete="email" required></label>
            <label>${text("password")}<input id="authPassword" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required></label>
            <button class="modal-primary" type="submit">${isRegister ? text("submitRegister") : text("submitLogin")}</button>
            <button class="link-button" type="button" data-auth-mode="${isRegister ? "login" : "register"}">
              ${isRegister ? text("switchToLogin") : text("switchToRegister")}
            </button>
            <button class="link-button" type="button" data-close-auth>${text("skip")}</button>
          </form>
        </section>
      `);
      $$("[data-auth-mode]", elements.modalLayer).forEach((button) => {
        button.addEventListener("click", () => openAuthModal(button.dataset.authMode));
      });
      $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
      $("#authForm").addEventListener("submit", submitAuth);
    }

    async function submitAuth(event) {
      event.preventDefault();
      const submit = event.currentTarget.querySelector("button[type='submit']");
      submit.disabled = true;
      try {
        const payload = {
          email: $("#authEmail").value,
          password: $("#authPassword").value,
          name: $("#authName")?.value || ""
        };
        const data = await api(`/api/auth/${state.authMode}`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (data.pendingApproval) {
          showToast(state.lang === "zh" ? "账号已创建，等待管理员启用" : "Account created, waiting for approval", "ri-time-line");
          closeModal();
          return;
        }
        state.user = data.user;
        context.setCurrentCacheUser();
        const me = await api("/api/auth/me");
        state.settings = me.settings;
        state.firstRun = me.firstRun;
        state.checkin = me.checkin || state.checkin;
        await context.loadHistory();
        context.ensureImageSessions();
        await context.loadAnnouncements();
        closeModal();
        const pendingView = state.pendingAuthView;
        state.pendingAuthView = "";
        state.forceHero = pendingView ? false : true;
        context.renderAll();
        if (pendingView === "canvas-v2") global.location.assign(context.canvasV2ProjectUrl());
        else if (pendingView) context.navigate(pendingView, { scrollTop: true });
        setTimeout(context.maybeOpenUnreadAnnouncementModal, 300);
        global.scrollTo({ top: 0, behavior: "auto" });
        context.restartHeroVideo();
      } catch (error) {
        showToast(error.message, "ri-error-warning-line");
      } finally {
        submit.disabled = false;
      }
    }

    async function logout() {
      const cacheUserId = state.user?.id || state.user?.email || "";
      await api("/api/auth/logout", { method: "POST" }).catch(() => null);
      await context.cacheDb()?.clearUserCache?.(cacheUserId);
      state.user = null;
      context.setCurrentCacheUser(null);
      state.history = [];
      state.imageSessions = [];
      state.activeImageSessionId = "";
      state.announcements = [];
      state.unreadAnnouncements = [];
      state.notificationModalShown.clear();
      state.checkin = { checkedInToday: false, credit: state.settings?.checkinCredit || 1 };
      state.forceHero = true;
      context.renderAll();
      global.scrollTo({ top: 0, behavior: "auto" });
      context.restartHeroVideo();
    }

    async function loadCreditDetails() {
      try {
        return await api("/api/credits/detail?limit=80");
      } catch (error) {
        console.warn("[credits]", error);
        return { ledger: [], rewards: [] };
      }
    }

    async function openCreditsModal() {
      if (!state.user) {
        openAuthModal("login");
        return;
      }
      const details = await loadCreditDetails();
      openModal(global.ImageStudioCreditsDetail.renderModal({
        details,
        state,
        helpers: { escapeHtml, text, formatDate }
      }));
      $("[data-checkin]", elements.modalLayer)?.addEventListener("click", submitCheckin);
      $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
    }

    async function submitCheckin(event) {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const data = await api("/api/checkin", { method: "POST" });
        state.user = data.user || { ...state.user, credits: data.credits };
        context.setCurrentCacheUser();
        state.checkin = data.checkin || { checkedInToday: true, credit: state.checkin?.credit || 1 };
        showToast(data.checkedIn
          ? (state.lang === "zh" ? `签到成功，获得 ${data.awarded} 积分` : `Checked in, +${data.awarded} credit`)
          : text("checkedIn"), "ri-calendar-check-line");
        context.updateNav();
        openCreditsModal();
      } catch (error) {
        showToast(error.message, "ri-error-warning-line");
        button.disabled = false;
      }
    }

    function openContactModal() {
      const adminEmail = String(state.settings?.contactEmail ?? state.settings?.contactAdminEmail ?? "").trim();
      if (!adminEmail) return;
      const mailto = `mailto:${adminEmail}?subject=${encodeURIComponent("ai-image-studio support")}`;
      openModal(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-customer-service-2-line" style="color:#1677ff"></i>
            <h2>${text("contactTitle")}</h2>
            <p>${text("contactDesc")}</p>
          </div>
          <div class="contact-card">
            <span>${escapeHtml(text("contactEmailLabel"))}</span>
            <a class="contact-email" href="${escapeHtml(mailto)}">${escapeHtml(adminEmail)}</a>
            <button class="contact-copy" type="button" data-copy-contact-email>${escapeHtml(text("contactCopy"))}</button>
          </div>
          <button class="modal-secondary" type="button" data-close-auth>${text("close")}</button>
        </section>
      `);
      $("[data-copy-contact-email]", elements.modalLayer).addEventListener("click", async () => {
        await navigator.clipboard?.writeText(adminEmail);
        showToast(text("contactCopied"), "ri-file-copy-line");
      });
      $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
    }

    function openMyWorksModal(options = {}) {
      if (!state.user) {
        openAuthModal("login");
        return;
      }
      context.syncThemeMobileNav("works");
      const shouldReplaceRoute = options.replaceRoute !== false;
      state.worksFilter = state.worksFilter || "all";
      const filters = [
        { id: "all", label: text("worksFilterAll") },
        { id: "public", label: text("worksFilterPublic") },
        { id: "private", label: text("worksFilterPrivate") },
        { id: "text", label: text("worksFilterText") },
        { id: "image", label: text("worksFilterImage") },
        { id: "archived", label: text("worksFilterArchived") }
      ];
      openModal(`
        <section class="modal works-modal works-workspace">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="works-head">
            <div>
              <h2>${text("myWorks")}</h2>
              <p>${state.lang === "zh" ? "搜索、批量公开、撤回或归档历史作品。" : "Search, publish, unpublish, or archive generated assets in bulk."}</p>
            </div>
            <button class="ghost-button works-refresh" type="button" data-works-refresh><i class="ri-refresh-line"></i></button>
          </div>
          <div class="works-toolbar">
            <label class="works-search"><i class="ri-search-line"></i><input id="worksSearchInput" value="${escapeHtml(state.worksSearch || "")}" placeholder="${state.lang === "zh" ? "搜索提示词、标签或时间" : "Search prompt, tags, or date"}"></label>
            <div class="works-bulk-actions">
              <span data-works-selection>0 ${text("worksSelected")}</span>
              <button type="button" data-works-bulk="download"><i class="ri-download-2-line"></i>${text("worksBatchDownload")}</button>
              <button type="button" data-works-bulk="publish"><i class="ri-gallery-upload-line"></i>${text("publishImage")}</button>
              ${context.canUserUnpublishPublicWork() ? `<button type="button" data-works-bulk="unpublish"><i class="ri-eye-off-line"></i>${text("unpublish")}</button>` : ""}
              <button type="button" data-works-bulk="archive"><i class="ri-archive-line"></i>${state.lang === "zh" ? "归档" : "Archive"}</button>
              <button type="button" data-works-bulk="unarchive"><i class="ri-inbox-unarchive-line"></i>${state.lang === "zh" ? "取消归档" : "Unarchive"}</button>
            </div>
          </div>
          <div class="works-filter-bar" role="tablist">
            ${filters.map((filter) => `<button type="button" data-works-filter="${filter.id}" class="works-filter-btn${state.worksFilter === filter.id ? " active" : ""}">${escapeHtml(filter.label)}</button>`).join("")}
          </div>
          <p class="works-mobile-hint">${state.lang === "zh" ? "左右滑动浏览作品，点击卡片打开详情。" : "Swipe through works. Tap a card to open details."}</p>
          <div id="worksGrid" class="works-grid"><div class="empty-message">${text("loadingPrompts")}</div></div>
        </section>
      `);
      $("[data-works-refresh]", elements.modalLayer).addEventListener("click", () => loadMyWorks(true));
      $("#worksSearchInput", elements.modalLayer).addEventListener("input", (event) => {
        state.worksSearch = event.target.value;
        loadMyWorks(false);
      });
      $$("[data-works-filter]", elements.modalLayer).forEach((button) => {
        button.addEventListener("click", () => {
          state.worksFilter = button.dataset.worksFilter || "all";
          $$("[data-works-filter]", elements.modalLayer).forEach((other) => {
            other.classList.toggle("active", other === button);
          });
          loadMyWorks(false);
        });
      });
      $$("[data-works-bulk]", elements.modalLayer).forEach((button) => {
        button.addEventListener("click", () => bulkUpdateWorks(button.dataset.worksBulk));
      });
      loadMyWorks(false);
      if (shouldReplaceRoute && !state.routeSyncing) {
        const route = context.routeState({ modal: "works" });
        global.history?.pushState?.(route, "", context.routeUrl(route));
      }
    }

    async function loadMyWorks(forceReload = false) {
      const grid = $("#worksGrid", elements.modalLayer);
      if (!grid) return;
      grid.innerHTML = `<div class="empty-message">${text("loadingPrompts")}</div>`;
      if (forceReload) await context.loadHistory();
      const filterId = state.worksFilter || "all";
      const query = String(state.worksSearch || "").trim().toLowerCase();
      const items = [...state.history]
        .filter((item) => item.status === "done" && item.images?.[0])
        .filter((item) => {
          const isImageToImage = context.isImageToImageItem(item);
          switch (filterId) {
            case "public":
              return Boolean(item.isPublic) && !item.archived;
            case "private":
              return !item.isPublic && !item.archived;
            case "text":
              return !isImageToImage && !item.archived;
            case "image":
              return isImageToImage && !item.archived;
            case "archived":
              return Boolean(item.archived);
            default:
              return !item.archived;
          }
        })
        .filter((item) => {
          if (!query) return true;
          return [
            item.prompt,
            formatDate(item.time),
            ...(item.publicTags || []).map(context.displayTag)
          ].some((value) => String(value || "").toLowerCase().includes(query));
        })
        .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
      renderWorksSelectionState();
      if (!items.length) {
        grid.innerHTML = `<div class="empty-message">${text(filterId === "all" ? "emptyWorks" : "worksFilterEmpty")}</div>`;
        return;
      }
      grid.innerHTML = items.map((item) => {
        const canPublishOriginal = Boolean(item.sourceImageData || item.sourceImageUrl);
        const isImageToImage = context.isImageToImageItem(item);
        const tagNote = item.publicTags?.length
          ? ` · ${item.publicTags.map(context.displayTag).join(" / ")}`
          : "";
        const rewardNote = item.isPublic ? context.publicRewardLabel(item) : "";
        const publishTools = `
          <div class="work-image-tools">
            <button type="button" data-work-publish="${escapeHtml(item.id)}">
              <i class="${item.isPublic ? "ri-price-tag-3-line" : "ri-gallery-upload-line"}"></i>
              ${item.isPublic ? text("editPublicTags") : text("publishImage")}
            </button>
            ${canPublishOriginal && !item.publishOriginal ? `<button type="button" data-work-publish-original="${escapeHtml(item.id)}"><i class="ri-image-add-line"></i>${text("publishWithOriginal")}</button>` : ""}
          </div>
        `;
        return `
        <article class="work-card${item.archived ? " archived" : ""}" data-work-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(text("worksOpenDetail"))}">
          <div class="work-visual" data-work-detail="${escapeHtml(item.id)}" ${context.imageFallbackContainerAttrs()}>
            <label class="work-select"><input type="checkbox" data-work-select="${escapeHtml(item.id)}"${state.worksSelected.has(String(item.id)) ? " checked" : ""}></label>
            <img src="${escapeHtml(context.imageVariantUrl(item.images[0]))}" ${context.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(truncate(item.prompt, 80))}">
            <span class="work-type-badge ${isImageToImage ? "image" : "text"}">${escapeHtml(text(isImageToImage ? "imageToImage" : "textToImage"))}</span>
            ${item.isPublic ? `<span class="work-visibility-badge published">${escapeHtml(text("publishedImage"))}</span>` : ""}
            ${item.archived ? `<span class="work-visibility-badge archived">${state.lang === "zh" ? "已归档" : "Archived"}</span>` : ""}
            ${publishTools}
          </div>
          <div class="work-body">
            <p>${escapeHtml(truncate(item.prompt, 92))}</p>
            <span>${escapeHtml(formatDate(item.time))}${item.isPublic ? ` · ${text("publishToSquare")}${escapeHtml(tagNote)}${rewardNote ? ` · ${escapeHtml(rewardNote)}` : ""}` : ""}</span>
            <div class="work-actions">
              <a href="${escapeHtml(item.images[0])}" download="${escapeHtml(item.id)}.png"><i class="ri-download-line"></i>${text("download")}</a>
              <button type="button" data-work-detail="${escapeHtml(item.id)}"><i class="ri-eye-line"></i>${text("worksOpenDetail")}</button>
              <button type="button" data-work-retry="${escapeHtml(item.id)}"><i class="ri-refresh-line"></i>${text("retry")}</button>
              <button type="button" data-work-editor="${escapeHtml(item.id)}"><i class="ri-magic-line"></i>${text("openEditor")}</button>
              ${item.isPublic && context.canUserUnpublishPublicWork() ? `<button type="button" data-work-withdraw="${escapeHtml(item.id)}"><i class="ri-eye-off-line"></i>${text("unpublish")}</button>` : ""}
            </div>
          </div>
        </article>
      `;
      }).join("");
      bindWorksGrid(grid);
    }

    function bindWorksGrid(grid) {
      $$("[data-work-select]", grid).forEach((input) => {
        input.addEventListener("click", (event) => event.stopPropagation());
        input.addEventListener("change", () => {
          if (input.checked) state.worksSelected.add(String(input.dataset.workSelect));
          else state.worksSelected.delete(String(input.dataset.workSelect));
          renderWorksSelectionState();
        });
      });
      $$("[data-work-detail]", grid).forEach((node) => {
        node.addEventListener("click", (event) => {
          event.stopPropagation();
          openWorkDetail(node.dataset.workDetail);
        });
      });
      $$(".work-card", grid).forEach((card) => {
        const open = () => openWorkDetail(card.dataset.workId);
        card.addEventListener("click", open);
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      });
      $$("a, button", grid).forEach((node) => {
        if (!node.hasAttribute("data-work-detail")) node.addEventListener("click", (event) => event.stopPropagation());
      });
      $$("[data-work-retry]", grid).forEach((button) => {
        button.addEventListener("click", () => {
          const item = state.history.find((entry) => String(entry.id) === button.dataset.workRetry);
          if (!item) return;
          closeModal();
          state.forceHero = true;
          state.draftPrompt = item.prompt;
          context.setView("home");
          context.syncComposers();
          setTimeout(() => context.submitGeneration($(".composer", elements.heroComposerMount)), 80);
        });
      });
      $$("[data-work-editor]", grid).forEach((button) => {
        button.addEventListener("click", () => {
          const item = state.history.find((entry) => String(entry.id) === button.dataset.workEditor);
          if (!item?.images?.[0]) return;
          closeModal();
          context.openImageEditor(item.images[0], item.prompt);
        });
      });
      $$("[data-work-publish]", grid).forEach((button) => {
        button.addEventListener("click", () => {
          const item = state.history.find((entry) => String(entry.id) === button.dataset.workPublish);
          if (!item) return;
          context.openPublishModal(item, false);
        });
      });
      $$("[data-work-publish-original]", grid).forEach((button) => {
        button.addEventListener("click", () => {
          const item = state.history.find((entry) => String(entry.id) === button.dataset.workPublishOriginal);
          if (!item) return;
          context.openPublishModal(item, true);
        });
      });
      $$("[data-work-withdraw]", grid).forEach((button) => {
        button.addEventListener("click", () => requestWorkWithdrawal(button.dataset.workWithdraw));
      });
    }

    function publicWithdrawalWindowHours() {
      return Math.max(1, Number(state.settings?.publicWithdrawalWindowHours || 12));
    }

    function withdrawalPromptForItem(item) {
      const hours = publicWithdrawalWindowHours();
      const withinWindow = !item.publishedAt || Date.now() - new Date(item.publishedAt).getTime() <= hours * 60 * 60 * 1000;
      const hourText = state.lang === "zh" ? `${hours} 小时` : `${hours} hour${hours === 1 ? "" : "s"}`;
      return {
        withinWindow,
        message: withinWindow
          ? (state.lang === "zh" ? `确认撤回公开？${hourText}内撤回会取消未入账奖励。` : `Unpublish this work? Pending reward will be cancelled within ${hourText}.`)
          : (state.lang === "zh" ? `已超过 ${hourText}，将提交撤回申请。` : `More than ${hourText} passed. This will submit a withdrawal request.`)
      };
    }

    async function requestWorkWithdrawal(id) {
      if (!context.canUserUnpublishPublicWork()) {
        showToast(state.lang === "zh" ? "已关闭用户取消公开功能，请联系管理员处理。" : "User unpublish is disabled; contact an admin.", "ri-lock-line");
        return;
      }
      const item = state.history.find((entry) => String(entry.id) === String(id));
      if (!item) return;
      const { withinWindow, message } = withdrawalPromptForItem(item);
      if (!confirm(message)) return;
      try {
        await api(`/api/images/${encodeURIComponent(id)}/withdrawal`, {
          method: "POST",
          body: JSON.stringify({ reason: "user_request" })
        });
        await context.loadHistory();
        await context.loadPublicGallery();
        loadMyWorks(false);
        showToast(withinWindow ? text("unpublishDone") : (state.lang === "zh" ? "撤回申请已提交" : "Withdrawal request submitted"), "ri-checkbox-circle-line");
      } catch (error) {
        showToast(error.message, "ri-error-warning-line");
      }
    }

    function renderWorksSelectionState() {
      const label = $("[data-works-selection]", elements.modalLayer);
      if (!label) return;
      label.textContent = `${state.worksSelected.size} ${text("worksSelected")}`;
    }

    async function bulkUpdateWorks(action) {
      const ids = Array.from(state.worksSelected);
      if (!ids.length) return;
      if (action === "download") {
        downloadWorks(ids);
        return;
      }
      const dangerous = action === "unpublish" || action === "archive";
      const label = {
        publish: state.lang === "zh" ? "公开" : "publish",
        unpublish: state.lang === "zh" ? "撤回公开" : "unpublish",
        archive: state.lang === "zh" ? "归档" : "archive",
        unarchive: state.lang === "zh" ? "取消归档" : "unarchive"
      }[action] || action;
      if (dangerous && !confirm(`${state.lang === "zh" ? "确认" : "Confirm"}${label} ${ids.length} ${state.lang === "zh" ? "个作品？" : "works?"}`)) return;
      try {
        const selectedItems = ids.map(workById).filter(Boolean);
        const selectedKinds = [...new Set(selectedItems.map(context.publicKindTagForItem))];
        const publicTags = selectedKinds.length === 1 ? context.publicTagsForKind(selectedKinds[0], []) : [];
        const data = await api("/api/images/bulk", {
          method: "POST",
          body: JSON.stringify({ generationIds: ids, action, publicTags })
        });
        const okCount = (data.results || []).filter((item) => item.ok).length;
        state.worksSelected.clear();
        await context.loadHistory();
        await context.loadPublicGallery();
        showToast(`${label}: ${okCount}/${ids.length}`, "ri-checkbox-circle-line");
        loadMyWorks(false);
      } catch (error) {
        showToast(error.message, "ri-error-warning-line");
      }
    }

    function workById(id) {
      return state.history.find((entry) => String(entry.id) === String(id));
    }

    function downloadWorks(ids) {
      const items = ids.map(workById).filter((item) => item?.images?.[0]);
      items.forEach((item, index) => {
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = item.images[0];
          link.download = `${item.id}.png`;
          link.rel = "noreferrer";
          document.body.appendChild(link);
          link.click();
          link.remove();
        }, index * 220);
      });
      showToast(`${text("worksDownloadStarted")}: ${items.length}`, "ri-download-2-line");
    }

    function openWorkDetail(id, options = {}) {
      const item = workById(id);
      if (!item?.images?.[0]) return;
      const shouldReplaceRoute = options.replaceRoute !== false;
      closeWorkDetail();
      const tags = (item.publicTags || []).map(context.displayTag).filter(Boolean);
      const isImageToImage = context.isImageToImageItem(item);
      const route = item.creativeRoute?.length ? item.creativeRoute : item.conversation?.length ? item.conversation : context.conversationRouteForItem(item);
      const optionRows = [
        [text("model"), item.model || "-"],
        [text("size"), item.options?.size || "-"],
        [text("quality"), item.options?.quality || "-"],
        [text("background"), item.options?.background || "-"],
        [text("format"), item.options?.outputFormat || "-"],
        [text("elapsed"), item.elapsedMs ? context.formatElapsed(item.elapsedMs) : "-"]
      ];
      elements.modalLayer.insertAdjacentHTML("beforeend", `
        <div class="works-detail-backdrop" data-work-detail-close></div>
        <aside class="works-detail-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(text("worksDetailTitle"))}" data-work-id="${escapeHtml(item.id)}">
          <button class="works-detail-close" type="button" data-work-detail-close><i class="ri-close-line"></i></button>
          <div class="works-detail-stage" ${context.imageFallbackContainerAttrs()}>
            <img src="${escapeHtml(item.images[0])}" ${context.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(truncate(item.prompt, 100))}">
          </div>
          <div class="works-detail-body">
            <div class="works-detail-title">
              <span class="work-type-badge ${isImageToImage ? "image" : "text"}">${escapeHtml(text(isImageToImage ? "imageToImage" : "textToImage"))}</span>
              <h3>${escapeHtml(text("worksDetailTitle"))}</h3>
              <p>${escapeHtml(item.prompt || "")}</p>
            </div>
            <div class="works-detail-actions">
              <button type="button" data-work-detail-copy><i class="ri-file-copy-line"></i>${text("worksCopyPrompt")}</button>
              <a href="${escapeHtml(item.images[0])}" download="${escapeHtml(item.id)}.png"><i class="ri-download-line"></i>${text("download")}</a>
              <button type="button" data-work-detail-editor><i class="ri-magic-line"></i>${text("openEditor")}</button>
              <button type="button" data-work-detail-continue><i class="ri-refresh-line"></i>${text("worksContinue")}</button>
              ${context.isCanvasEntryHidden() ? "" : `<button type="button" data-work-detail-canvas><i class="ri-node-tree"></i>${text("addToCanvas")}</button>`}
            </div>
            <dl class="works-detail-meta">
              <dt>ID</dt><dd>${escapeHtml(String(item.id))}</dd>
              <dt>${escapeHtml(text("status"))}</dt><dd>${escapeHtml(item.isPublic ? text("publishedImage") : (item.archived ? (state.lang === "zh" ? "已归档" : "Archived") : text("worksFilterPrivate")))}</dd>
              <dt>${escapeHtml(text("publicTags"))}</dt><dd>${tags.length ? tags.map(escapeHtml).join(" / ") : "-"}</dd>
              <dt>${escapeHtml(state.lang === "zh" ? "创建时间" : "Created")}</dt><dd>${escapeHtml(formatDate(item.time) || "-")}</dd>
              ${optionRows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value || "-"))}</dd>`).join("")}
            </dl>
            ${item.sourceImageUrl ? `<section class="works-detail-source" ${context.imageFallbackContainerAttrs()}><h4>${escapeHtml(text("sourceImage"))}</h4><img src="${escapeHtml(item.sourceImageUrl)}" ${context.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(text("sourceImage"))}"></section>` : ""}
            ${route?.length ? `
              <section class="works-detail-route">
                <h4>${escapeHtml(text("routeTitle"))}</h4>
                ${route.map((step, index) => `
                  <article>
                    <strong>${index + 1}</strong>
                    <p>${escapeHtml(step.prompt || item.prompt || "")}</p>
                  </article>
                `).join("")}
              </section>
            ` : ""}
          </div>
        </aside>
      `);
      $$("[data-work-detail-close]", elements.modalLayer).forEach((node) => node.addEventListener("click", closeWorkDetail));
      $("[data-work-detail-copy]", elements.modalLayer)?.addEventListener("click", async () => {
        await context.copyText(item.prompt || "");
        showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
      });
      $("[data-work-detail-editor]", elements.modalLayer)?.addEventListener("click", () => {
        closeModal();
        context.openImageEditor(item.images[0], item.prompt);
      });
      $("[data-work-detail-continue]", elements.modalLayer)?.addEventListener("click", () => {
        closeModal();
        state.forceHero = true;
        state.draftPrompt = item.prompt;
        context.navigate("home");
        context.syncComposers();
        setTimeout(() => $(".prompt-box", elements.heroComposerMount)?.focus(), 100);
      });
      $("[data-work-detail-canvas]", elements.modalLayer)?.addEventListener("click", () => {
        context.openCanvasTargetModal(context.canvasPayloadFromGeneration(item, text("worksDetailTitle")));
      });
      if (shouldReplaceRoute && !state.routeSyncing) {
        const routeState = context.routeState({ modal: "works", workDetailId: item.id });
        global.history?.pushState?.(routeState, "", context.routeUrl(routeState));
      }
    }

    function closeWorkDetail() {
      $(".works-detail-drawer", elements.modalLayer)?.remove();
      $(".works-detail-backdrop", elements.modalLayer)?.remove();
      if (!state.routeSyncing && $(".works-modal", elements.modalLayer) && global.history?.pushState) {
        const route = context.routeState({ modal: "works", workDetailId: "" });
        global.history.replaceState(route, "", context.routeUrl(route));
      }
    }

    function bindAccountEvents() {
      elements.contactBtn.addEventListener("click", openContactModal);
      elements.accountContactBtn?.addEventListener("click", () => {
        closeAccountMenu();
        openContactModal();
      });
      elements.accountMenuBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = elements.accountMenu?.classList.contains("hidden");
        elements.accountMenu?.classList.toggle("hidden", !willOpen);
        elements.accountMenuBtn?.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
      document.addEventListener("click", (event) => {
        if (!elements.accountMenuWrap || elements.accountMenuWrap.contains(event.target)) return;
        closeAccountMenu();
      });
      elements.loginBtn.addEventListener("click", () => openAuthModal("login"));
      elements.logoutBtn.addEventListener("click", () => {
        closeAccountMenu();
        logout();
      });
      elements.creditsBtn.addEventListener("click", () => {
        closeAccountMenu();
        openCreditsModal();
      });
      elements.myWorksBtn.addEventListener("click", () => {
        closeAccountMenu();
        state.sessionDrawerLocked = false;
        openMyWorksModal();
      });
      elements.adminBtn.addEventListener("click", () => {
        closeAccountMenu();
        global.location.href = "/admin";
      });
    }

    return {
      api,
      closeAccountMenu,
      openAuthModal,
      submitAuth,
      logout,
      loadCreditDetails,
      openCreditsModal,
      submitCheckin,
      openContactModal,
      openMyWorksModal,
      loadMyWorks,
      openWorkDetail,
      closeWorkDetail,
      withdrawalPromptForItem,
      requestWorkWithdrawal,
      bindAccountEvents
    };
  }

  const authModule = {
    create: createAuthController,
    readCookie
  };

  if (typeof modules.register === "function") {
    modules.register("auth", authModule);
  } else {
    modules.auth = Object.freeze({ ...(modules.auth || {}), ...authModule });
  }
})(window);
