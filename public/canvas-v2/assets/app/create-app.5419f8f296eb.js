import { createShellState, renderShell } from "./shell.0313daac826d.js";
import {
  ApiError,
  createCanvasProject,
  deleteCanvasProject,
  exportCanvasProject,
  generateCanvasOutput,
  getCanvasProject,
  getCurrentAuth,
  getHealth,
  listCanvasProjects,
  updateCanvasProject,
} from "../adapters/ai-image-studio-api.76de7730d185.js";
import {
  canvasPayloadFromDocument,
  createEmptyCanvasDocument,
  normalizeCanvasDocument,
} from "../adapters/canvas-schema.8fae55d925c4.js";
import { installEditorController } from "../editor/dom-controller.b1491be2268c.js";
import {
  applyGenerationResult,
  applyGenerationStatus,
  generationRequestForOutput,
} from "../features/generation/flow.f2772561bfb2.js";

const SAVE_DEBOUNCE_MS = 700;

export function createCanvasV2App(root) {
  let state = createShellState();
  let saveTimer = 0;

  const render = () => {
    root.replaceChildren(renderShell(state));
  };

  const setState = (patch) => {
    state = { ...state, ...patch };
    render();
  };

  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveCurrentCanvas();
    }, SAVE_DEBOUNCE_MS);
  };

  const commitDocument = () => {
    window.clearTimeout(saveTimer);
    setState({ dirty: true, saveStatus: "unsaved", saveError: "" });
    scheduleSave();
  };

  async function loadProject(canvasId) {
    if (!canvasId) return;
    setState({ projectLoading: true, errorMessage: "" });
    try {
      const result = await getCanvasProject(canvasId);
      const canvas = result.canvas;
      setState({
        currentProjectId: canvas.id,
        document: documentFromCanvas(canvas),
        projects: upsertProject(state.projects, canvas),
        projectLoading: false,
        dirty: false,
        saveStatus: "saved",
        saveError: "",
        selectedNodeIds: [],
        selectedEdgeIds: [],
        connectionSourceId: "",
        selectionRect: null,
      });
      updateRoute(canvas.id);
    } catch (error) {
      setState({
        projectLoading: false,
        saveStatus: "error",
        errorMessage: errorMessage(error),
      });
    }
  }

  async function refreshProjects({ openInitial = false } = {}) {
    setState({ projectsLoading: true, errorMessage: "" });
    try {
      const result = await listCanvasProjects({ scope: "mine", limit: 50 });
      const projects = Array.isArray(result.canvases) ? result.canvases : [];
      setState({ projects, projectsLoading: false });
      if (openInitial) {
        const routeProjectId = projectIdFromRoute();
        const target = routeProjectId || projects[0]?.id || "";
        if (target) await loadProject(target);
      }
    } catch (error) {
      setState({
        projectsLoading: false,
        errorMessage: errorMessage(error),
      });
    }
  }

  async function createProject() {
    const title = `Canvas v2 ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
    const document = createEmptyCanvasDocument(title);
    setState({ saveStatus: "saving", saveError: "" });
    try {
      const result = await createCanvasProject(canvasPayloadFromDocument(document, title));
      const canvas = result.canvas;
      setState({
        projects: upsertProject(state.projects, canvas),
        currentProjectId: canvas.id,
        document: documentFromCanvas(canvas),
        dirty: false,
        saveStatus: "saved",
        selectedNodeIds: [],
        selectedEdgeIds: [],
        connectionSourceId: "",
        selectionRect: null,
      });
      updateRoute(canvas.id);
    } catch (error) {
      setState({ saveStatus: "error", saveError: errorMessage(error) });
    }
  }

  async function saveCurrentCanvas() {
    window.clearTimeout(saveTimer);
    if (!state.currentProjectId) {
      setState({ saveStatus: "unsaved", saveError: "请先新建或打开一个画布。" });
      return;
    }
    setState({ saveStatus: "saving", saveError: "" });
    try {
      const payload = canvasPayloadFromDocument(state.document, state.document.title);
      const result = await updateCanvasProject(state.currentProjectId, payload);
      const canvas = result.canvas;
      setState({
        projects: upsertProject(state.projects, canvas),
        document: documentFromCanvas(canvas),
        dirty: false,
        saveStatus: "saved",
      });
    } catch (error) {
      setState({ saveStatus: "error", saveError: errorMessage(error), dirty: true });
    }
  }

  async function saveCurrentCanvasForGeneration() {
    window.clearTimeout(saveTimer);
    if (!state.currentProjectId) throw new Error("请先新建或打开一个画布。");
    setState({ saveStatus: "saving", saveError: "" });
    const payload = canvasPayloadFromDocument(state.document, state.document.title);
    const result = await updateCanvasProject(state.currentProjectId, payload);
    const canvas = result.canvas;
    state = {
      ...state,
      projects: upsertProject(state.projects, canvas),
      document: documentFromCanvas(canvas),
      dirty: false,
      saveStatus: "saved",
      saveError: "",
    };
    render();
  }

  async function deleteCurrentProject() {
    if (!state.currentProjectId) return;
    const project = state.projects.find((item) => item.id === state.currentProjectId);
    if (window.confirm && !window.confirm(`删除画布「${project?.title || state.document.title}」？`)) return;
    setState({ saveStatus: "saving", saveError: "" });
    try {
      await deleteCanvasProject(state.currentProjectId);
      const projects = state.projects.filter((item) => item.id !== state.currentProjectId);
      setState({
        projects,
        currentProjectId: "",
        document: createEmptyCanvasDocument("Untitled canvas"),
        dirty: false,
        saveStatus: "idle",
        selectedNodeIds: [],
        selectedEdgeIds: [],
        connectionSourceId: "",
        selectionRect: null,
      });
      updateRoute("");
      if (projects[0]?.id) await loadProject(projects[0].id);
    } catch (error) {
      setState({ saveStatus: "error", saveError: errorMessage(error) });
    }
  }

  async function exportCurrentProject() {
    if (!state.currentProjectId) return;
    try {
      const exported = await exportCanvasProject(state.currentProjectId);
      setState({ exportSummary: `${exported.format || "unknown"} · ${exported.canvas?.dataJson?.nodes?.length || 0} nodes` });
    } catch (error) {
      setState({ exportSummary: "", saveError: errorMessage(error) });
    }
  }

  function mutateDocument(updater, { commit = true } = {}) {
    const nextDocument = normalizeCanvasDocument(updater(state.document), state.document.title);
    state = {
      ...state,
      document: nextDocument,
      dirty: true,
      saveStatus: "unsaved",
      saveError: "",
    };
    render();
    if (commit) scheduleSave();
  }

  async function runOutputGeneration(outputNodeId) {
    if (!state.currentProjectId) {
      setState({ saveError: "请先新建或打开一个画布。", saveStatus: "error" });
      return;
    }
    const request = generationRequestForOutput(state.document, outputNodeId);
    if (!request.outputNodeId) return;
    window.clearTimeout(saveTimer);
    state = {
      ...state,
      document: normalizeCanvasDocument(applyGenerationStatus(state.document, request.outputNodeId, "queued", "已保存，准备提交生成..."), state.document.title),
      dirty: true,
      saveStatus: "unsaved",
      saveError: "",
    };
    render();
    try {
      await saveCurrentCanvasForGeneration();
      state = {
        ...state,
        document: normalizeCanvasDocument(applyGenerationStatus(state.document, request.outputNodeId, "running", "生成中：后端队列、积分和 Provider 已接管。"), state.document.title),
        dirty: true,
        saveStatus: "unsaved",
      };
      render();
      const result = await generateCanvasOutput(state.currentProjectId, request);
      state = {
        ...state,
        document: normalizeCanvasDocument(applyGenerationResult(state.document, request.outputNodeId, result), state.document.title),
        dirty: true,
        saveStatus: "unsaved",
      };
      render();
      await saveCurrentCanvasForGeneration();
    } catch (error) {
      const message = errorMessage(error);
      state = {
        ...state,
        document: normalizeCanvasDocument(applyGenerationStatus(state.document, request.outputNodeId, "error", message), state.document.title),
        dirty: true,
        saveStatus: "error",
        saveError: message,
      };
      render();
      try {
        await saveCurrentCanvasForGeneration();
      } catch (saveError) {
        setState({
          dirty: true,
          saveStatus: "error",
          saveError: `${message}；生成失败状态保存失败：${errorMessage(saveError)}`,
        });
      }
    }
  }

  installEditorController(root, {
    getState: () => state,
    setState,
    mutateDocument,
    commitDocument,
    runOutputGeneration,
  });

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const actionElement = event.target.closest("[data-canvas-action]");
    if (!(actionElement instanceof HTMLElement)) return;
    const action = actionElement.dataset.canvasAction || "";
    if (action === "new-project") void createProject();
    if (action === "refresh-projects") void refreshProjects({ openInitial: false });
    if (action === "open-project") void loadProject(actionElement.dataset.canvasProjectId || "");
    if (action === "save-now") void saveCurrentCanvas();
    if (action === "delete-project") void deleteCurrentProject();
    if (action === "export-project") void exportCurrentProject();
  });

  root.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (!event.target.matches("[data-canvas-title-input]")) return;
    const title = event.target.value.trim() || "Untitled canvas";
    mutateDocument((document) => ({ ...document, title }));
  });

  render();
  void bootCanvasV2(root, state);

  async function bootCanvasV2() {
    try {
      const health = await getHealth();
      const auth = await getCurrentAuth();
      setState({
        status: auth?.user ? "ready" : "signed-out",
        health,
        user: auth?.user ?? null,
        csrfReady: Boolean(auth?.csrfToken),
      });
      if (auth?.user) await refreshProjects({ openInitial: true });
    } catch (error) {
      setState({
        status: "error",
        errorMessage: errorMessage(error),
      });
    }
  }
}

function documentFromCanvas(canvas) {
  const document = normalizeCanvasDocument(canvas?.dataJson, canvas?.title || "Untitled canvas");
  return { ...document, title: canvas?.title || document.title };
}

function upsertProject(projects, canvas) {
  const next = [canvas, ...projects.filter((project) => project.id !== canvas.id)];
  return next.sort((left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""));
}

function projectIdFromRoute() {
  const match = window.location.pathname.match(/^\/canvas-v2\/projects\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function updateRoute(projectId) {
  const nextPath = projectId ? `/canvas-v2/projects/${encodeURIComponent(projectId)}` : "/canvas-v2";
  if (window.location.pathname !== nextPath) {
    window.history.replaceState({}, "", nextPath);
  }
}

function errorMessage(error) {
  if (error instanceof ApiError && error.status === 404) return "画布不存在，或你没有权限访问。";
  if (error instanceof ApiError && error.status === 401) return "请登录后继续使用 Canvas v2。";
  if (error instanceof Error) return error.message;
  return String(error);
}
