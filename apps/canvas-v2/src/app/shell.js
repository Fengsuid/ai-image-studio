// SPDX-License-Identifier: AGPL-3.0-or-later
import { createEmptyCanvasDocument } from "../adapters/canvas-schema.js";
import { renderEditor } from "../editor/view.js";

export function createShellState() {
  return {
    status: "booting",
    document: createEmptyCanvasDocument("Untitled canvas"),
    health: null,
    user: null,
    csrfReady: false,
    errorMessage: "",
    projects: [],
    templateMarket: [],
    myTemplates: [],
    projectsLoading: false,
    templatesLoading: false,
    projectLoading: false,
    currentProjectId: "",
    dirty: false,
    saveStatus: "idle",
    saveError: "",
    exportSummary: "",
    draftStatus: "idle",
    draftSummary: "",
    localDraft: null,
    conflictSummary: "",
    conflictDiff: "",
    shortcutsOpen: false,
    generationQueue: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    clipboard: { nodes: [], edges: [] },
    connectionSourceId: "",
    editorTool: "pan",
    selectionRect: null,
  };
}

export function renderShell(state) {
  const shell = document.createElement("main");
  shell.className = "canvas-v2-shell";
  shell.dataset.status = state.status;

  const title = document.createElement("h1");
  title.textContent = "Canvas v2";

  const eyebrow = document.createElement("p");
  eyebrow.className = "canvas-v2-eyebrow";
  eyebrow.textContent = statusCopy(state);

  const summary = document.createElement("p");
  summary.className = "canvas-v2-summary";
  summary.textContent =
    "Canvas v2 is isolated from the legacy canvas and will use ai-image-studio backend APIs for login, persistence, generation, and publishing.";

  const workspace = document.createElement("section");
  workspace.className = "canvas-v2-workspace";

  const projectPanel = document.createElement("aside");
  projectPanel.className = "canvas-v2-panel";
  projectPanel.innerHTML = renderProjectPanel(state);

  const canvasPanel = document.createElement("section");
  canvasPanel.className = "canvas-v2-board";
  canvasPanel.innerHTML = renderCanvasPanel(state);

  const statusPanel = document.createElement("aside");
  statusPanel.className = "canvas-v2-panel";
  statusPanel.innerHTML = renderStatusPanel(state);

  workspace.append(projectPanel, canvasPanel, statusPanel);

  shell.append(eyebrow, title, summary, workspace);
  return shell;
}

function renderProjectPanel(state) {
  if (state.status !== "ready") {
    return `
      <h2>项目列表</h2>
      <p>登录后显示你的画布项目。</p>
    `;
  }

  const items = state.projects.map((project) => `
    <li>
      <button
        type="button"
        class="canvas-v2-project ${project.id === state.currentProjectId ? "active" : ""}"
        data-canvas-action="open-project"
        data-canvas-project-id="${escapeAttr(project.id)}">
        <span>${escapeHtml(project.title || "Untitled canvas")}</span>
        <small>${project.nodeCount || 0} nodes · ${project.edgeCount || 0} edges${project.isTemplate ? " · 我的模板" : ""}</small>
      </button>
    </li>
  `).join("");
  const myTemplateItems = renderTemplateItems(state.myTemplates, { mine: true });
  const marketItems = renderTemplateItems(state.templateMarket, { mine: false });

  return `
    <div class="canvas-v2-panel-head">
      <h2>项目列表</h2>
      <button type="button" data-canvas-action="refresh-projects">刷新</button>
    </div>
    <button type="button" class="canvas-v2-primary" data-canvas-action="new-project">新建画布</button>
    ${state.projectsLoading ? "<p>正在加载项目...</p>" : ""}
    <ul class="canvas-v2-project-list" data-canvas-project-list>${items || "<li><p>暂无画布，先新建一个。</p></li>"}</ul>
    <div class="canvas-v2-template-section">
      <div class="canvas-v2-panel-head">
        <h2>我的模板</h2>
        <button type="button" data-canvas-action="refresh-templates">刷新模板</button>
      </div>
      <p class="canvas-v2-muted">私有标签：只在你的账号下可见。</p>
      <ul class="canvas-v2-project-list">${myTemplateItems || "<li><p>当前没有私有模板。</p></li>"}</ul>
    </div>
    <div class="canvas-v2-template-section">
      <h2>模板市场</h2>
      ${state.templatesLoading ? "<p>正在加载模板...</p>" : ""}
      <ul class="canvas-v2-project-list">${marketItems || "<li><p>暂无公开模板。</p></li>"}</ul>
    </div>
  `;
}

function renderTemplateItems(templates, { mine }) {
  return (templates || []).map((template) => `
    <li>
      <article class="canvas-v2-template-card">
        <strong>${escapeHtml(template.title || "Untitled template")}</strong>
        <small>${template.nodeCount || 0} nodes · fork ${template.forkCount || 0}</small>
        <button
          type="button"
          data-canvas-action="${mine ? "open-project" : "fork-template"}"
          data-canvas-project-id="${escapeAttr(template.id)}">${mine ? "打开" : "复制到我的画布"}</button>
      </article>
    </li>
  `).join("");
}

function renderCanvasPanel(state) {
  const hasProject = Boolean(state.currentProjectId);

  return `
    <div class="canvas-v2-board-head">
      <label>
        <span>标题</span>
        <input data-canvas-title-input value="${escapeAttr(state.document.title)}" ${hasProject ? "" : "disabled"}>
      </label>
      <div class="canvas-v2-actions">
        <button type="button" data-canvas-action="save-now" ${hasProject ? "" : "disabled"}>保存</button>
        <button type="button" data-canvas-action="toggle-template" ${hasProject ? "" : "disabled"}>${currentProject(state)?.isTemplate ? "取消模板" : "设为模板"}</button>
        <button type="button" data-canvas-action="export-project" ${hasProject ? "" : "disabled"}>导出 ZIP</button>
        <button type="button" data-canvas-action="import-project">导入</button>
        <button type="button" data-canvas-action="toggle-shortcuts">快捷键</button>
        <button type="button" data-canvas-action="delete-project" ${hasProject ? "" : "disabled"}>删除</button>
      </div>
    </div>
    ${renderEditor(state, { hasProject })}
    ${state.shortcutsOpen ? renderShortcutSheet() : ""}
  `;
}

function renderStatusPanel(state) {
  return `
    <h2>状态</h2>
    <p>用户：${escapeHtml(state.user?.name || state.user?.email || "未登录")}</p>
    <p>版本：${escapeHtml(state.health?.version || "初始化中")}</p>
    <p>CSRF：${state.csrfReady ? "已初始化" : "等待初始化"}</p>
    <p>保存：<span data-canvas-save-status>${saveStatusCopy(state)}</span></p>
    <p>本地草稿：${escapeHtml(draftStatusCopy(state))}</p>
    ${renderGenerationQueue(state.generationQueue)}
    <p>节点：${state.document.nodes.length} · 连线：${state.document.edges.length}</p>
    <p>选中：${state.selectedNodeIds.length} 节点 · ${state.selectedEdgeIds.length} 连线</p>
    <p>工具：${escapeHtml(state.editorTool)}</p>
    ${state.projectLoading ? "<p>正在读取画布...</p>" : ""}
    ${state.exportSummary ? `<p>导出：${escapeHtml(state.exportSummary)}</p>` : ""}
    ${state.conflictSummary ? `<p class="canvas-v2-warning">${escapeHtml(state.conflictSummary)}</p><p>${escapeHtml(state.conflictDiff || "")}</p><button type="button" data-canvas-action="restore-local-draft">恢复本地草稿</button><button type="button" data-canvas-action="discard-local-draft">保留远端版本</button>` : ""}
    ${state.errorMessage ? `<p class="canvas-v2-error">${escapeHtml(state.errorMessage)}</p>` : ""}
    ${state.saveError ? `<p class="canvas-v2-error">${escapeHtml(state.saveError)}</p>` : ""}
  `;
}

function renderGenerationQueue(queue) {
  if (!queue) return "";
  return `<p>生成队列：${queue.completed || 0}/${queue.total || 0} 完成 · 运行 ${queue.running || 0} · 失败 ${queue.failed || 0} · 并发 ${queue.maxConcurrency || 1}</p>`;
}

function renderShortcutSheet() {
  return `
    <div class="canvas-v2-shortcuts" data-canvas-shortcuts>
      <h2>快捷键</h2>
      <p><kbd>Ctrl</kbd> + <kbd>S</kbd> 保存；<kbd>Ctrl</kbd> + <kbd>Z</kbd> 撤销；<kbd>Ctrl</kbd> + <kbd>Y</kbd> 重做。</p>
      <p><kbd>Ctrl</kbd> + <kbd>A/C/V/D</kbd> 全选、复制、粘贴、复制选中；<kbd>Delete</kbd> 删除；<kbd>Shift</kbd> + 拖拽框选。</p>
      <p><kbd>B</kbd>/<kbd>V</kbd> 框选/平移；<kbd>+</kbd>/<kbd>-</kbd> 缩放；<kbd>Shift</kbd> + <kbd>?</kbd> 打开或关闭此面板。</p>
    </div>
  `;
}

function currentProject(state) {
  return state.projects.find((project) => project.id === state.currentProjectId) || null;
}

function saveStatusCopy(state) {
  if (state.saveStatus === "saving") return "保存中";
  if (state.saveStatus === "saved") return state.dirty ? "已修改" : "已保存";
  if (state.saveStatus === "unsaved") return "未保存";
  if (state.saveStatus === "error") return "保存失败";
  return "等待操作";
}

function draftStatusCopy(state) {
  if (state.draftStatus === "saved") return state.draftSummary || "已写入 IndexedDB";
  if (state.draftStatus === "error") return "IndexedDB 不可用";
  if (state.draftStatus === "conflict") return "发现本地草稿";
  return "等待编辑";
}

function statusCopy(state) {
  if (state.status === "ready") return "已登录，Canvas v2 Shell 可用";
  if (state.status === "signed-out") return "未登录，请先登录 ai-image-studio";
  if (state.status === "error") return "初始化失败";
  return "正在初始化登录态与 CSRF";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
