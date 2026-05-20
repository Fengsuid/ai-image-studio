(function initCanvasMarket(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const text = (key, fallback) => (typeof global.ImageStudioText === "function" ? global.ImageStudioText(key) : fallback);
  const state = {
    mineCanvases: [],
    templateCanvases: [],
    loadingList: false,
    listError: "",
    listTab: "mine"
  };

  let bound = false;
  let navigateFn = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function renderProjectCards(items = [], { emptyLabel = "", emptyHint = "", templateMode = false } = {}) {
    if (!Array.isArray(items) || !items.length) {
      return `
        <div class="canvas-empty-workspace">
          <i class="ri-node-tree"></i>
          <strong>${escapeHtml(emptyLabel)}</strong>
          <span>${escapeHtml(emptyHint)}</span>
        </div>
      `;
    }
    return items.map((canvas) => {
      const badge = canvas.isTemplate ? `<span class="canvas-project-badge">${escapeHtml(text("canvasTemplateBadge", "Template"))}</span>` : "";
      const visibility = canvas.visibility === "public" ? "Public" : canvas.visibility === "unlisted" ? "Unlisted" : "Private";
      const templateAction = templateMode
        ? `<button type="button" data-canvas-template-duplicate="${escapeHtml(canvas.id)}"><i class="ri-node-tree"></i><span>${escapeHtml(text("canvasUseTemplate", "New from template"))}</span></button>`
        : canvas.isTemplate
          ? `<button type="button" data-canvas-template-toggle="${escapeHtml(canvas.id)}" class="secondary"><i class="ri-store-2-line"></i><span>${escapeHtml(text("canvasUnpublishTemplate", "Remove template"))}</span></button>`
          : `<button type="button" data-canvas-template-toggle="${escapeHtml(canvas.id)}"><i class="ri-store-2-line"></i><span>${escapeHtml(text("canvasPublishTemplate", "Publish as template"))}</span></button>`;
      return `
        <article class="canvas-project-card" data-canvas-project-card="${escapeHtml(canvas.id)}">
          <header>
            <div class="canvas-project-meta">
              ${badge}
              <span>${escapeHtml(visibility)}</span>
              <span>${escapeHtml(canvas.nodeCount || 0)} nodes</span>
            </div>
            <strong>${escapeHtml(canvas.title || "Untitled canvas")}</strong>
            <p>${escapeHtml(canvas.description || (templateMode ? text("canvasTemplateHint", "Publish a strong canvas as a reusable template first.") : text("canvasEmptyDesc", "Create a canvas to start editing.")))}</p>
          </header>
          <div class="canvas-project-actions">
            <button type="button" data-canvas-open-project="${escapeHtml(canvas.id)}"><i class="ri-folder-open-line"></i><span>${escapeHtml(text("openCanvasWorkspace", "Open Canvas"))}</span></button>
            ${templateAction}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderListView() {
    const mine = document.querySelector("#canvasMineList");
    const templates = document.querySelector("#canvasTemplateList");
    document.querySelectorAll("[data-canvas-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.canvasTab === state.listTab);
    });
    document.querySelectorAll("[data-canvas-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.canvasPanel !== state.listTab);
    });
    if (mine) {
      mine.innerHTML = renderProjectCards(state.mineCanvases, {
        emptyLabel: text("canvasEmptyTitle", "No canvas projects yet"),
        emptyHint: text("canvasEmptyDesc", "Create a canvas to start editing.")
      });
    }
    if (templates) {
      templates.innerHTML = renderProjectCards(state.templateCanvases, {
        emptyLabel: text("canvasTemplateEmpty", "No public templates yet"),
        emptyHint: text("canvasTemplateHint", "Publish a strong canvas as a reusable template first."),
        templateMode: true
      });
    }
    const head = document.querySelector(".canvas-list-head p");
    if (head && state.listError) {
      head.textContent = state.listError;
    } else if (head) {
      head.textContent = text("canvasComingDesc", "Manage your canvases and create private copies from public templates.");
    }
  }

  async function loadCanvasList() {
    if (state.loadingList || typeof root.request !== "function") return;
    state.loadingList = true;
    state.listError = "";
    renderListView();
    try {
      const [mineResult, templateResult] = await Promise.all([
        root.request("/api/canvases?limit=100"),
        root.request("/api/canvases?scope=templates&limit=24")
      ]);
      state.mineCanvases = Array.isArray(mineResult?.canvases) ? mineResult.canvases : [];
      state.templateCanvases = Array.isArray(templateResult?.canvases) ? templateResult.canvases : [];
    } catch (error) {
      state.listError = error?.message || "Canvas list failed";
    } finally {
      state.loadingList = false;
      renderListView();
    }
  }

  async function duplicateTemplate(canvasId) {
    if (!canvasId || typeof root.request !== "function") return;
    try {
      const result = await root.request(`/api/canvases/${encodeURIComponent(canvasId)}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ title: text("canvasUseTemplate", "New from template") })
      });
      const canvas = result?.canvas || null;
      if (canvas?.id) {
        navigateFn?.("canvas", { scrollTop: true, route: { canvasProjectId: canvas.id } });
      }
    } catch (error) {
      state.listError = error?.message || "Template copy failed";
      renderListView();
    }
  }

  async function toggleCanvasTemplate(canvasId) {
    if (!canvasId || typeof root.request !== "function") return;
    try {
      const canvas = state.mineCanvases.find((item) => item.id === canvasId) || state.templateCanvases.find((item) => item.id === canvasId) || null;
      const nextIsTemplate = !Boolean(canvas?.isTemplate);
      const result = await root.request(`/api/canvases/${encodeURIComponent(canvasId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          visibility: nextIsTemplate ? "public" : (canvas?.visibility || "private"),
          isTemplate: nextIsTemplate
        })
      });
      root.syncCurrentCanvasTemplate?.(result?.canvas || null);
      await loadCanvasList();
    } catch (error) {
      state.listError = error?.message || "Template publish failed";
      renderListView();
    }
  }

  function setListTab(tab) {
    state.listTab = tab === "templates" ? "templates" : "mine";
    renderListView();
    if (state.listTab === "templates") void loadCanvasList();
  }

  function bindListEvents({ navigate } = {}) {
    if (bound) return;
    if (typeof navigate === "function") navigateFn = navigate;
    bound = true;
    document.addEventListener("click", async (event) => {
      const openButton = event.target.closest?.("[data-canvas-open-project]");
      if (openButton) {
        navigateFn?.("canvas", { scrollTop: true, route: { canvasProjectId: openButton.dataset.canvasOpenProject || "" } });
        return;
      }
      const duplicateButton = event.target.closest?.("[data-canvas-template-duplicate]");
      if (duplicateButton) {
        await duplicateTemplate(duplicateButton.dataset.canvasTemplateDuplicate || "");
        return;
      }
      const toggleButton = event.target.closest?.("[data-canvas-template-toggle]");
      if (toggleButton && toggleButton.dataset.canvasTemplateToggle) {
        await toggleCanvasTemplate(toggleButton.dataset.canvasTemplateToggle);
        return;
      }
      const tabButton = event.target.closest?.("[data-canvas-tab]");
      if (tabButton) {
        setListTab(tabButton.dataset.canvasTab || "mine");
        return;
      }
      const listButton = event.target.closest?.("[data-canvas-list]");
      if (listButton) {
        navigateFn?.("canvas", { scrollTop: true, route: { canvasProjectId: "" } });
      }
    });
  }

  root.market = {
    state,
    bindListEvents,
    loadCanvasList,
    renderListView,
    setListTab
  };
})(window, document);
