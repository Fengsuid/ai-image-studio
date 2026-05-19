(function initCanvasShell(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function renderShell({ projectId = "", elements = {} } = {}) {
    const normalizedId = root.store?.normalizeProjectId(projectId) || "";
    elements.canvasListView?.classList.toggle("hidden", Boolean(normalizedId));
    elements.canvasWorkspaceView?.classList.toggle("hidden", !normalizedId);

    const title = document.querySelector("#canvasTitleText");
    if (title) title.textContent = normalizedId === "new" ? "Untitled canvas" : normalizedId || "Untitled";
  }

  function bindShellEvents({ elements = {}, navigate } = {}) {
    if (typeof navigate !== "function") return;
    elements.canvasCreateBtn?.addEventListener("click", () => {
      navigate("canvas", { scrollTop: true, route: { canvasProjectId: "new" } });
    });
    document.querySelectorAll("[data-canvas-list]").forEach((button) => {
      button.addEventListener("click", () => navigate("canvas", { scrollTop: true, route: { canvasProjectId: "" } }));
    });
  }

  root.renderShell = renderShell;
  root.bindShellEvents = bindShellEvents;
})(window, document);
