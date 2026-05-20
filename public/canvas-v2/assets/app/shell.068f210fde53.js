import { createEmptyCanvasDocument } from "../adapters/canvas-schema.47a1d0062c00.js";

export function createShellState() {
  return {
    status: "booting",
    document: createEmptyCanvasDocument("Untitled canvas"),
    health: null,
    user: null,
    csrfReady: false,
    errorMessage: "",
    projects: [],
    projectsLoading: false,
    projectLoading: false,
    currentProjectId: "",
    dirty: false,
    saveStatus: "idle",
    saveError: "",
    exportSummary: "",
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
        <small>${project.nodeCount || 0} nodes · ${project.edgeCount || 0} edges</small>
      </button>
    </li>
  `).join("");

  return `
    <div class="canvas-v2-panel-head">
      <h2>项目列表</h2>
      <button type="button" data-canvas-action="refresh-projects">刷新</button>
    </div>
    <button type="button" class="canvas-v2-primary" data-canvas-action="new-project">新建画布</button>
    ${state.projectsLoading ? "<p>正在加载项目...</p>" : ""}
    <ul class="canvas-v2-project-list" data-canvas-project-list>${items || "<li><p>暂无画布，先新建一个。</p></li>"}</ul>
  `;
}

function renderCanvasPanel(state) {
  const hasProject = Boolean(state.currentProjectId);
  const nodes = state.document.nodes.map((node) => `
    <li>
      <strong>${escapeHtml(node.type)}</strong>
      <span>${escapeHtml(node.content || node.prompt || node.id)}</span>
    </li>
  `).join("");

  return `
    <div class="canvas-v2-board-head">
      <label>
        <span>标题</span>
        <input data-canvas-title-input value="${escapeAttr(state.document.title)}" ${hasProject ? "" : "disabled"}>
      </label>
      <div class="canvas-v2-actions">
        <button type="button" data-canvas-action="save-now" ${hasProject ? "" : "disabled"}>保存</button>
        <button type="button" data-canvas-action="export-project" ${hasProject ? "" : "disabled"}>导出</button>
        <button type="button" data-canvas-action="delete-project" ${hasProject ? "" : "disabled"}>删除</button>
      </div>
    </div>
    <div class="canvas-v2-board-stage" data-canvas-board>
      <h2>${hasProject ? "基础保存恢复" : "空画布"}</h2>
      <p>Schema: ${escapeHtml(state.document.schema)} · Source: ${escapeHtml(state.document.meta.source)}</p>
      <p>Viewport: ${state.document.viewport.x}, ${state.document.viewport.y}, zoom ${state.document.viewport.zoom}</p>
      <div class="canvas-v2-actions">
        <button type="button" data-canvas-action="add-text-node" ${hasProject ? "" : "disabled"}>添加 Text 节点</button>
        <button type="button" data-canvas-action="add-output-node" ${hasProject ? "" : "disabled"}>添加 Output 节点</button>
      </div>
      <ul class="canvas-v2-node-list" data-canvas-node-list>${nodes || "<li>还没有节点。</li>"}</ul>
    </div>
  `;
}

function renderStatusPanel(state) {
  return `
    <h2>状态</h2>
    <p>用户：${escapeHtml(state.user?.name || state.user?.email || "未登录")}</p>
    <p>版本：${escapeHtml(state.health?.version || "初始化中")}</p>
    <p>CSRF：${state.csrfReady ? "已初始化" : "等待初始化"}</p>
    <p>保存：<span data-canvas-save-status>${saveStatusCopy(state)}</span></p>
    <p>节点：${state.document.nodes.length} · 连线：${state.document.edges.length}</p>
    ${state.projectLoading ? "<p>正在读取画布...</p>" : ""}
    ${state.exportSummary ? `<p>导出：${escapeHtml(state.exportSummary)}</p>` : ""}
    ${state.errorMessage ? `<p class="canvas-v2-error">${escapeHtml(state.errorMessage)}</p>` : ""}
    ${state.saveError ? `<p class="canvas-v2-error">${escapeHtml(state.saveError)}</p>` : ""}
  `;
}

function saveStatusCopy(state) {
  if (state.saveStatus === "saving") return "保存中";
  if (state.saveStatus === "saved") return state.dirty ? "已修改" : "已保存";
  if (state.saveStatus === "unsaved") return "未保存";
  if (state.saveStatus === "error") return "保存失败";
  return "等待操作";
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
