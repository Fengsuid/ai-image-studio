// SPDX-License-Identifier: AGPL-3.0-or-later
import { createShellState, renderShell } from "./shell.js";
import {
  ApiError,
  createCanvasProject,
  deleteCanvasProject,
  exportCanvasProjectZip,
  exportCanvasProject,
  forkCanvasProject,
  generateCanvasOutput,
  getCanvasProject,
  getCurrentAuth,
  getHealth,
  listCanvasProjects,
  importCanvasProject,
  updateCanvasProject,
} from "../adapters/ai-image-studio-api.js";
import {
  canvasPayloadFromDocument,
  createEmptyCanvasDocument,
  normalizeCanvasDocument,
} from "../adapters/canvas-schema.js";
import { installEditorController } from "../editor/dom-controller.js";
import {
  applyGenerationResult,
  applyGenerationStatus,
  generationRequestForOutput,
} from "../features/generation/flow.js";
import { createHistory, pushHistory, undo, redo, canUndo, canRedo } from "../features/history/index.js";
import { triggerFileImport } from "../features/imports/index.js";
import { deleteCanvasDraft, readCanvasDraft, saveCanvasDraft } from "../features/drafts/cache-db.js";

const SAVE_DEBOUNCE_MS = 700;
const MAX_PARALLEL_GENERATIONS = 3;

export function createCanvasV2App(root) {
  let state = createShellState();
  let saveTimer = 0;
  let history = createHistory(state.document);
  let documentRevision = 0;
  let textCompositionActive = false;
  let deferredRender = false;

  const isTextComposing = () => textCompositionActive || Boolean(root.querySelector("[data-canvas-composing='true']"));

  const render = () => {
    if (isTextComposing()) {
      deferredRender = true;
      return;
    }
    deferredRender = false;
    const focused = document.activeElement;
    const focusNodeId = focused?.dataset?.canvasNodeId || "";
    const focusField = focused?.dataset?.canvasNodeField || "";
    const focusSelStart = focused?.selectionStart;
    const focusSelEnd = focused?.selectionEnd;

    root.replaceChildren(renderShell(state));

    if (focusNodeId && focusField) {
      const target = root.querySelector(`[data-canvas-node-id="${focusNodeId}"][data-canvas-node-field="${focusField}"]`);
      if (target) {
        target.focus();
        if (typeof focusSelStart === "number") {
          target.selectionStart = focusSelStart;
          target.selectionEnd = focusSelEnd ?? focusSelStart;
        }
      }
    }
  };

  const setState = (patch) => {
    state = { ...state, ...patch };
    render();
  };

  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    const revision = documentRevision;
    saveTimer = window.setTimeout(() => {
      void saveCurrentCanvas({ revision });
    }, SAVE_DEBOUNCE_MS);
  };

  const setTextCompositionActive = (active) => {
    textCompositionActive = Boolean(active);
    if (!textCompositionActive && deferredRender) render();
  };

  const commitDocument = () => {
    window.clearTimeout(saveTimer);
    history = pushHistory(history, state.document);
    setState({ dirty: true, saveStatus: "unsaved", saveError: "", canUndo: canUndo(history), canRedo: canRedo(history) });
    scheduleSave();
  };

  function undoDocument() {
    const result = undo(history);
    if (!result) return;
    history = result;
    documentRevision += 1;
    state = { ...state, document: result.current, dirty: true, saveStatus: "unsaved", canUndo: canUndo(history), canRedo: canRedo(history) };
    render();
    void persistLocalDraft(result.current);
    scheduleSave();
  }

  function redoDocument() {
    const result = redo(history);
    if (!result) return;
    history = result;
    documentRevision += 1;
    state = { ...state, document: result.current, dirty: true, saveStatus: "unsaved", canUndo: canUndo(history), canRedo: canRedo(history) };
    render();
    void persistLocalDraft(result.current);
    scheduleSave();
  }

  async function loadProject(canvasId) {
    if (!canvasId) return;
    setState({ projectLoading: true, errorMessage: "" });
    try {
      const result = await getCanvasProject(canvasId);
      const canvas = result.canvas;
      const doc = documentFromCanvas(canvas);
      const draft = await readCanvasDraft(canvas.id);
      const draftDocument = draft?.document ? normalizeCanvasDocument(draft.document, doc.title) : null;
      const hasDraftConflict = Boolean(draftDocument && isDraftNewerThanCanvas(draft, canvas));
      history = createHistory(doc);
      setState({
        currentProjectId: canvas.id,
        document: doc,
        projects: upsertProject(state.projects, canvas),
        projectLoading: false,
        dirty: false,
        saveStatus: "saved",
        saveError: "",
        selectedNodeIds: [],
        selectedEdgeIds: [],
        connectionSourceId: "",
        selectionRect: null,
        canUndo: false,
        canRedo: false,
        localDraft: hasDraftConflict ? { ...draft, document: draftDocument } : null,
        draftStatus: hasDraftConflict ? "conflict" : "idle",
        draftSummary: hasDraftConflict ? `IndexedDB 草稿 ${formatTime(draft.savedAt)}` : "",
        conflictSummary: hasDraftConflict ? "发现此画布的本地草稿，可选择恢复或保留远端版本。" : "",
        conflictDiff: hasDraftConflict ? draftDiffSummary(draftDocument, doc, draft, canvas) : "",
      });
      updateRoute(canvas.id);
    } catch (error) {
      const draft = await readCanvasDraft(canvasId).catch(() => null);
      if (draft?.document) {
        const doc = normalizeCanvasDocument(draft.document, draft.document.title || "Offline canvas draft");
        history = createHistory(doc);
        setState({
          currentProjectId: canvasId,
          document: doc,
          projectLoading: false,
          dirty: true,
          saveStatus: "error",
          saveError: "远端画布暂时不可用，已载入本地草稿。",
          localDraft: { ...draft, document: doc },
          draftStatus: "saved",
          draftSummary: `IndexedDB ${formatTime(draft.savedAt)}`,
          conflictSummary: "",
          conflictDiff: "",
        });
        updateRoute(canvasId);
        return;
      }
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
      void refreshTemplates();
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

  async function refreshTemplates() {
    setState({ templatesLoading: true });
    try {
      const [marketResult, mineResult] = await Promise.all([
        listCanvasProjects({ scope: "templates", limit: 24 }),
        listCanvasProjects({ scope: "my-templates", limit: 24 }),
      ]);
      setState({
        templateMarket: Array.isArray(marketResult.canvases) ? marketResult.canvases : [],
        myTemplates: Array.isArray(mineResult.canvases) ? mineResult.canvases : [],
        templatesLoading: false,
      });
    } catch (error) {
      setState({ templatesLoading: false, saveError: errorMessage(error) });
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
        localDraft: null,
        conflictSummary: "",
      });
      void deleteCanvasDraft(canvas.id);
      updateRoute(canvas.id);
    } catch (error) {
      setState({ saveStatus: "error", saveError: errorMessage(error) });
    }
  }

  async function saveCurrentCanvas({ revision = documentRevision } = {}) {
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
      if (revision !== documentRevision) {
        setState({ projects: upsertProject(state.projects, canvas) });
        return;
      }
      setState({
        projects: upsertProject(state.projects, canvas),
        document: documentFromCanvas(canvas),
        dirty: false,
        saveStatus: "saved",
      });
      void deleteCanvasDraft(state.currentProjectId);
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
    void deleteCanvasDraft(state.currentProjectId);
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
      const jsonExport = await exportCanvasProject(state.currentProjectId);
      const zipped = await exportCanvasProjectZip(state.currentProjectId);
      downloadBlob(zipped.blob, zipped.filename);
      setState({ exportSummary: `ZIP · ${jsonExport.canvas?.dataJson?.nodes?.length || 0} nodes · ${zipped.filename}` });
    } catch (error) {
      setState({ exportSummary: "", saveError: errorMessage(error) });
    }
  }

  async function importProject() {
    const result = await triggerFileImport();
    if (result.error) {
      setState({ saveError: result.error, saveStatus: "error" });
      return;
    }
    const title = result.document.title || "Imported canvas";
    setState({ saveStatus: "saving", saveError: "" });
    try {
      let canvas;
      if (state.currentProjectId) {
        const imported = await importCanvasProject(state.currentProjectId, result.payload || canvasPayloadFromDocument(result.document, title));
        canvas = imported.canvas;
      } else {
        const payload = canvasPayloadFromDocument(result.document, title);
        const created = await createCanvasProject(payload);
        canvas = created.canvas;
      }
      const doc = documentFromCanvas(canvas);
      history = createHistory(doc);
      setState({
        projects: upsertProject(state.projects, canvas),
        currentProjectId: canvas.id,
        document: doc,
        dirty: false,
        saveStatus: "saved",
        saveError: "",
        selectedNodeIds: [],
        selectedEdgeIds: [],
        connectionSourceId: "",
        selectionRect: null,
        localDraft: null,
        conflictSummary: "",
        draftStatus: "idle",
        draftSummary: "",
        canUndo: false,
        canRedo: false,
      });
      void deleteCanvasDraft(canvas.id);
      updateRoute(canvas.id);
    } catch (error) {
      setState({ saveStatus: "error", saveError: errorMessage(error) });
    }
  }

  async function toggleCurrentTemplate() {
    if (!state.currentProjectId) return;
    const project = state.projects.find((item) => item.id === state.currentProjectId);
    const nextIsTemplate = !project?.isTemplate;
    setState({ saveStatus: "saving", saveError: "" });
    try {
      const result = await updateCanvasProject(state.currentProjectId, { isTemplate: nextIsTemplate });
      const canvas = result.canvas;
      setState({
        projects: upsertProject(state.projects, canvas),
        myTemplates: nextIsTemplate
          ? upsertProject(state.myTemplates, canvas)
          : state.myTemplates.filter((item) => item.id !== canvas.id),
        saveStatus: "saved",
      });
    } catch (error) {
      setState({ saveStatus: "error", saveError: errorMessage(error) });
    }
  }

  async function forkTemplate(templateId) {
    if (!templateId) return;
    const template = state.templateMarket.find((item) => item.id === templateId) || state.myTemplates.find((item) => item.id === templateId);
    setState({ saveStatus: "saving", saveError: "" });
    try {
      const result = await forkCanvasProject(templateId, { title: `${template?.title || "Template"} copy` });
      const canvas = result.canvas;
      setState({
        projects: upsertProject(state.projects, canvas),
        saveStatus: "saved",
        saveError: "",
      });
      await refreshTemplates();
      await loadProject(canvas.id);
    } catch (error) {
      setState({ saveStatus: "error", saveError: errorMessage(error) });
    }
  }

  function mutateDocument(updater, { commit = true } = {}) {
    const nextDocument = normalizeCanvasDocument(updater(state.document), state.document.title);
    documentRevision += 1;
    state = {
      ...state,
      document: nextDocument,
      dirty: true,
      saveStatus: "unsaved",
      saveError: "",
    };
    render();
    void persistLocalDraft(nextDocument);
    if (commit) scheduleSave();
  }

  async function persistLocalDraft(document) {
    if (!state.currentProjectId) return;
    const project = state.projects.find((item) => item.id === state.currentProjectId);
    const ok = await saveCanvasDraft(state.currentProjectId, document, {
      serverUpdatedAt: project?.updatedAt || "",
      userId: state.user?.id || "",
    });
    if (ok) {
      setState({ draftStatus: "saved", draftSummary: `IndexedDB ${formatTime(new Date().toISOString())}` });
    } else {
      setState({ draftStatus: "error", draftSummary: "" });
    }
  }

  function restoreLocalDraft() {
    const draftDocument = state.localDraft?.document;
    if (!draftDocument) return;
    history = pushHistory(history, draftDocument);
    documentRevision += 1;
    setState({
      document: draftDocument,
      dirty: true,
      saveStatus: "unsaved",
      saveError: "",
      conflictSummary: "",
      draftStatus: "saved",
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    });
    scheduleSave();
  }

  async function discardLocalDraft() {
    if (!state.currentProjectId) return;
    await deleteCanvasDraft(state.currentProjectId);
    setState({
      localDraft: null,
      conflictSummary: "",
      conflictDiff: "",
      draftStatus: "idle",
      draftSummary: "",
    });
  }

  async function runOutputGeneration(outputNodeId) {
    await runOutputGenerationBatch([outputNodeId]);
  }

  async function runOutputGenerationBatch(outputNodeIds = []) {
    if (!state.currentProjectId) {
      setState({ saveError: "请先新建或打开一个画布。", saveStatus: "error" });
      return;
    }
    const targets = generationTargets(outputNodeIds);
    if (!targets.length) return;
    window.clearTimeout(saveTimer);
    const queuedDocument = targets.reduce(
      (document, outputId) => applyGenerationStatus(document, outputId, "queued", "已加入本地生成队列。"),
      state.document
    );
    state = {
      ...state,
      document: normalizeCanvasDocument(queuedDocument, state.document.title),
      dirty: true,
      saveStatus: "unsaved",
      saveError: "",
      generationQueue: queueState(targets.length, { pending: targets.length }),
    };
    render();
    try {
      await saveCurrentCanvasForGeneration();
      await runGenerationWorkers(targets);
      await saveCurrentCanvasForGeneration();
    } catch (error) {
      const message = errorMessage(error);
      state = {
        ...state,
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

  function generationTargets(outputNodeIds = []) {
    const requested = outputNodeIds.length
      ? new Set(outputNodeIds.map((id) => String(id || "").trim()).filter(Boolean))
      : new Set(state.document.nodes.filter((node) => node.type === "output").map((node) => node.id));
    return state.document.nodes
      .filter((node) => node.type === "output" && requested.has(node.id))
      .filter((node) => !["queued", "running"].includes(node.generationStatus || node.status || ""))
      .map((node) => node.id);
  }

  async function runGenerationWorkers(targets) {
    let nextIndex = 0;
    const queue = queueState(targets.length, { pending: targets.length });
    const updateQueue = (patch) => {
      Object.assign(queue, patch);
      state = { ...state, generationQueue: { ...queue } };
      render();
    };
    const worker = async () => {
      while (nextIndex < targets.length) {
        const outputNodeId = targets[nextIndex];
        nextIndex += 1;
        updateQueue({ pending: Math.max(0, queue.pending - 1), running: queue.running + 1 });
        setOutputGenerationStatus(outputNodeId, "running", "生成中：后端队列、积分和 Provider 已接管。");
        try {
          const request = generationRequestForOutput(state.document, outputNodeId);
          const result = await generateCanvasOutput(state.currentProjectId, request);
          state = {
            ...state,
            document: normalizeCanvasDocument(applyGenerationResult(state.document, outputNodeId, result), state.document.title),
            dirty: true,
            saveStatus: "unsaved",
          };
          updateQueue({ running: Math.max(0, queue.running - 1), completed: queue.completed + 1 });
        } catch (error) {
          const message = errorMessage(error);
          setOutputGenerationStatus(outputNodeId, "error", message);
          updateQueue({ running: Math.max(0, queue.running - 1), failed: queue.failed + 1 });
        }
        void persistLocalDraft(state.document);
      }
    };
    const workers = Array.from({ length: Math.min(MAX_PARALLEL_GENERATIONS, targets.length) }, () => worker());
    await Promise.all(workers);
  }

  function setOutputGenerationStatus(outputNodeId, status, message) {
    state = {
      ...state,
      document: normalizeCanvasDocument(applyGenerationStatus(state.document, outputNodeId, status, message), state.document.title),
      dirty: true,
      saveStatus: "unsaved",
      saveError: status === "error" ? message : state.saveError,
    };
    render();
  }

  installEditorController(root, {
    getState: () => state,
    setState,
    mutateDocument,
    commitDocument,
    runOutputGeneration,
    runOutputGenerationBatch,
    undoDocument,
    redoDocument,
    setTextCompositionActive,
  });

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const actionElement = event.target.closest("[data-canvas-action]");
    if (!(actionElement instanceof HTMLElement)) return;
    const action = actionElement.dataset.canvasAction || "";
    if (action === "new-project") void createProject();
    if (action === "refresh-projects") void refreshProjects({ openInitial: false });
    if (action === "refresh-templates") void refreshTemplates();
    if (action === "open-project") void loadProject(actionElement.dataset.canvasProjectId || "");
    if (action === "fork-template") void forkTemplate(actionElement.dataset.canvasProjectId || "");
    if (action === "save-now") void saveCurrentCanvas();
    if (action === "toggle-template") void toggleCurrentTemplate();
    if (action === "delete-project") void deleteCurrentProject();
    if (action === "export-project") void exportCurrentProject();
    if (action === "import-project") void importProject();
    if (action === "restore-local-draft") restoreLocalDraft();
    if (action === "discard-local-draft") void discardLocalDraft();
    if (action === "toggle-shortcuts") setState({ shortcutsOpen: !state.shortcutsOpen });
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      void saveCurrentCanvas();
    }
    if (!isEditableTarget(event.target) && event.shiftKey && event.key === "?") {
      event.preventDefault();
      setState({ shortcutsOpen: !state.shortcutsOpen });
    }
  });

  root.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (!event.target.matches("[data-canvas-title-input]")) return;
    if (event.isComposing || event.target.dataset.canvasComposing === "true") return;
    const title = event.target.value.trim() || "Untitled canvas";
    mutateDocument((document) => ({ ...document, title }));
  });

  root.addEventListener("compositionstart", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (!event.target.matches("[data-canvas-title-input]")) return;
    event.target.dataset.canvasComposing = "true";
    setTextCompositionActive(true);
  });

  root.addEventListener("compositionend", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (!event.target.matches("[data-canvas-title-input]")) return;
    delete event.target.dataset.canvasComposing;
    const title = event.target.value.trim() || "Untitled canvas";
    mutateDocument((document) => ({ ...document, title }));
    setTextCompositionActive(false);
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

function queueState(total, patch = {}) {
  return {
    total,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    maxConcurrency: Math.min(MAX_PARALLEL_GENERATIONS, Math.max(1, total)),
    ...patch,
  };
}

function isDraftNewerThanCanvas(draft, canvas) {
  const draftTime = Date.parse(draft?.savedAt || "");
  const canvasTime = Date.parse(canvas?.updatedAt || "");
  if (!Number.isFinite(draftTime)) return false;
  if (!Number.isFinite(canvasTime)) return true;
  return draftTime > canvasTime + 1000;
}

function draftDiffSummary(localDocument, remoteDocument, draft, canvas) {
  const parts = [
    `本地 ${formatTime(draft?.savedAt)} / 远端 ${formatTime(canvas?.updatedAt)}`,
    `标题：${localDocument.title === remoteDocument.title ? "一致" : "不同"}`,
    `节点：本地 ${localDocument.nodes.length} / 远端 ${remoteDocument.nodes.length}`,
    `连线：本地 ${localDocument.edges.length} / 远端 ${remoteDocument.edges.length}`,
  ];
  return parts.join("；");
}

function isEditableTarget(target) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: filename || "canvas.zip",
  });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function errorMessage(error) {
  if (error instanceof ApiError && error.status === 404) return "画布不存在，或你没有权限访问。";
  if (error instanceof ApiError && error.status === 401) return "请登录后继续使用 Canvas v2。";
  if (error instanceof Error) return error.message;
  return String(error);
}
