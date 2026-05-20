import { createEmptyCanvasDocument } from "../adapters/canvas-schema.fab1d3a97d42.js";

export function createShellState() {
  return {
    status: "booting",
    document: createEmptyCanvasDocument("Untitled canvas"),
    health: null,
    user: null,
    csrfReady: false,
    errorMessage: "",
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
  projectPanel.innerHTML = `
    <h2>项目列表</h2>
    <p>${state.status === "ready" ? "下一阶段将接入 /api/canvases。" : "登录后显示你的画布项目。"}</p>
  `;

  const canvasPanel = document.createElement("section");
  canvasPanel.className = "canvas-v2-board";
  canvasPanel.innerHTML = `
    <h2>空画布</h2>
    <p>Draft schema: ${state.document.schema}</p>
    <p>Source: ${state.document.meta.source}</p>
  `;

  const statusPanel = document.createElement("aside");
  statusPanel.className = "canvas-v2-panel";
  statusPanel.innerHTML = `
    <h2>状态</h2>
    <p>用户：${state.user?.name || state.user?.email || "未登录"}</p>
    <p>版本：${state.health?.version || "初始化中"}</p>
    <p>CSRF：${state.csrfReady ? "已初始化" : "等待初始化"}</p>
    ${state.errorMessage ? `<p class="canvas-v2-error">${escapeHtml(state.errorMessage)}</p>` : ""}
  `;

  workspace.append(projectPanel, canvasPanel, statusPanel);

  shell.append(eyebrow, title, summary, workspace);
  return shell;
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
