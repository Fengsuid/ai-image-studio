(function initCanvasToolbar(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function renderTemplateToggle({ state, text, escapeHtml }) {
    const button = document.querySelector(".canvas-toolbar [data-canvas-template-toggle]");
    if (!button) return;
    const canToggle = Boolean(state.projectId && state.projectId !== "new");
    button.disabled = !canToggle;
    button.dataset.templateState = state.isTemplate ? "1" : "0";
    button.innerHTML = state.isTemplate
      ? `<i class="ri-store-2-line"></i><span>${escapeHtml(text("canvasUnpublishTemplate", "Remove template"))}</span>`
      : `<i class="ri-store-2-line"></i><span>${escapeHtml(text("canvasPublishTemplate", "Publish as template"))}</span>`;
    button.title = state.isTemplate
      ? text("canvasUnpublishTemplate", "Remove template")
      : text("canvasPublishTemplate", "Publish as template");
  }

  function renderBackgroundToggles(state) {
    document.querySelectorAll("[data-canvas-background]").forEach((button) => {
      button.classList.toggle("active", button.dataset.canvasBackground === state.background);
    });
  }

  function renderSaveStatus({ state, text }) {
    const status = document.querySelector("#canvasSaveStatus");
    if (!status) return;
    const labels = {
      saved: "已保存",
      saving: "保存中",
      dirty: "未保存",
      failed: "同步失败"
    };
    status.dataset.status = state.saveStatus;
    const templateLabel = state.isTemplate ? ` · ${text("canvasTemplateBadge", "Template")}` : "";
    status.textContent = state.saveError && state.saveStatus === "failed"
      ? `${labels.failed}: ${state.saveError}${templateLabel}`
      : `${labels[state.saveStatus] || labels.saved}${templateLabel}`;
  }

  function renderHistoryControls({ state, historyStatus = {}, selectedNodes = [] }) {
    document.querySelectorAll("[data-canvas-undo]").forEach((button) => {
      button.disabled = !historyStatus.canUndo;
      button.title = "Undo (Ctrl/Cmd+Z)";
    });
    document.querySelectorAll("[data-canvas-redo]").forEach((button) => {
      button.disabled = !historyStatus.canRedo;
      button.title = "Redo (Ctrl/Cmd+Shift+Z)";
    });
    document.querySelectorAll("[data-canvas-copy]").forEach((button) => {
      button.disabled = !selectedNodes.length;
      button.title = "Copy selected node(s) (Ctrl/Cmd+C)";
    });
    document.querySelectorAll("[data-canvas-paste]").forEach((button) => {
      button.disabled = !historyStatus.canPaste;
      button.title = "Paste node (Ctrl/Cmd+V)";
    });
    document.querySelectorAll("[data-canvas-group]").forEach((button) => {
      button.disabled = selectedNodes.filter((node) => node.type !== "group").length < 2;
      button.title = "Group selected nodes (Ctrl/Cmd+G)";
    });
    document.querySelectorAll("[data-canvas-delete]").forEach((button) => {
      button.disabled = !selectedNodes.length;
      button.title = "Delete selected nodes";
    });
    document.querySelectorAll("[data-canvas-export]").forEach((button) => {
      button.disabled = !state.projectId;
      button.title = "Export canvas JSON";
    });
    document.querySelectorAll("[data-canvas-import]").forEach((button) => {
      button.disabled = !state.projectId;
      button.title = "Import canvas JSON";
    });
  }

  function render(options) {
    renderTemplateToggle(options);
    renderBackgroundToggles(options.state);
    renderSaveStatus(options);
    renderHistoryControls(options);
  }

  root.toolbar = {
    render,
    renderSaveStatus,
    renderHistoryControls
  };
})(window, document);
