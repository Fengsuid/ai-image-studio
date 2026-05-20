(function initCanvasShell(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const DRAFT_PREFIX = "imageStudio.canvasDraft.v1.";
  const SAVE_DEBOUNCE_MS = 800;
  const state = {
    projectId: "",
    projectTitle: "Untitled canvas",
    lastServerUpdatedAt: "",
    loadingProjectId: "",
    saveStatus: "saved",
    saveError: "",
    saveTimer: null,
    dirty: false,
    hydrating: false,
    background: "dots",
    viewport: { x: 80, y: 80, scale: 1 },
    nodes: [],
    edges: [],
    selectedNodeId: "",
    selectedNodeIds: [],
    selectionRect: null,
    pendingEdgeFrom: "",
    edgeError: "",
    drag: null,
    pointers: new Map(),
    history: null,
    assistant: null
  };

  function renderShell({ projectId = "", elements = {} } = {}) {
    const normalizedId = root.store?.normalizeProjectId(projectId) || "";
    if (state.projectId !== normalizedId) {
      loadCanvasProject(normalizedId);
    }
    elements.canvasListView?.classList.toggle("hidden", Boolean(normalizedId));
    elements.canvasWorkspaceView?.classList.toggle("hidden", !normalizedId);

    const title = document.querySelector("#canvasTitleText");
    if (title) title.textContent = state.projectTitle || (normalizedId === "new" ? "Untitled canvas" : normalizedId || "Untitled");
    renderBoard();
  }

  function renderBoard() {
    const board = document.querySelector("#canvasBoard");
    const viewport = document.querySelector("#canvasViewport");
    if (!board || !viewport) return;
    board.dataset.background = state.background;
    viewport.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
    viewport.innerHTML = edgeTemplate() + selectionBoxTemplate() + renderNodes().map((node) => nodeTemplate(node)).join("");
    root.minimap?.render?.(board, {
      viewport: state.viewport,
      nodes: state.nodes,
      edges: state.edges,
      selectedNodeId: state.selectedNodeId,
      selectedNodeIds: state.selectedNodeIds
    });
    renderInspector();
    document.querySelectorAll("[data-canvas-background]").forEach((button) => {
      button.classList.toggle("active", button.dataset.canvasBackground === state.background);
    });
    renderSaveStatus();
    renderHistoryControls();
    renderAssistant();
  }

  function resetCanvas(projectId) {
    state.projectId = projectId;
    state.projectTitle = projectId === "new" ? "Untitled canvas" : projectId || "Untitled";
    state.lastServerUpdatedAt = "";
    state.nodes = projectId ? root.nodes?.defaultNodes?.() || [] : [];
    state.edges = projectId ? defaultEdges() : [];
    state.selectedNodeId = state.nodes[0]?.id || "";
    state.selectedNodeIds = state.selectedNodeId ? [state.selectedNodeId] : [];
    state.selectionRect = null;
    state.pendingEdgeFrom = "";
    state.edgeError = "";
    state.viewport = { x: 80, y: 80, scale: 1 };
    state.background = "dots";
    state.dirty = false;
    setSaveStatus("saved");
    resetHistory();
  }

  function defaultEdges() {
    return [
      root.workflows.createEdge("node_prompt", "node_config"),
      root.workflows.createEdge("node_image", "node_config"),
      root.workflows.createEdge("node_config", "node_output")
    ];
  }

  async function loadCanvasProject(projectId) {
    clearTimeout(state.saveTimer);
    resetCanvas(projectId);
    if (!projectId) {
      renderBoard();
      return;
    }
    state.loadingProjectId = projectId;
    state.hydrating = true;
    try {
      let serverCanvas = null;
      if (projectId !== "new" && typeof root.request === "function") {
        const result = await root.request(`/api/canvases/${encodeURIComponent(projectId)}`);
        serverCanvas = result?.canvas || null;
        if (state.loadingProjectId !== projectId) return;
        applyProject(serverCanvas);
      }
      const draft = readDraft(projectId);
      if (draft && shouldRestoreDraft(projectId, draft, serverCanvas)) {
        applyDraft(draft);
        state.dirty = true;
        setSaveStatus("dirty");
        scheduleAutosave();
      }
    } catch (error) {
      const draft = readDraft(projectId);
      if (draft && global.confirm("恢复本地画布草稿？")) {
        applyDraft(draft);
        state.dirty = true;
        setSaveStatus("failed", error?.message || "同步失败");
      } else {
        setSaveStatus("failed", error?.message || "同步失败");
      }
    } finally {
      state.hydrating = false;
      renderBoard();
    }
  }

  function applyProject(project = {}) {
    if (!project) return;
    state.projectId = project.id || state.projectId;
    state.projectTitle = project.title || state.projectTitle || "Untitled canvas";
    state.lastServerUpdatedAt = project.updatedAt || "";
    hydrateFromData(project.dataJson || {});
    state.dirty = false;
    setSaveStatus("saved");
    resetHistory();
  }

  function applyDraft(draft = {}) {
    state.projectTitle = draft.title || state.projectTitle || "Untitled canvas";
    hydrateFromData(draft.data || {});
    resetHistory();
  }

  function hydrateFromData(data = {}) {
    if (data.background) state.background = ["dots", "grid", "blank"].includes(data.background) ? data.background : "dots";
    if (data.viewport && typeof data.viewport === "object") {
      state.viewport = {
        x: Number(data.viewport.x || 0),
        y: Number(data.viewport.y || 0),
        scale: Math.min(3, Math.max(0.25, Number(data.viewport.scale || 1)))
      };
    }
    state.nodes = Array.isArray(data.nodes) ? data.nodes.map((node) => root.nodes.createNode(node)) : state.nodes;
    state.edges = Array.isArray(data.edges) ? data.edges : state.edges;
    const persistedSelection = Array.isArray(data.selectedNodeIds) && data.selectedNodeIds.length
      ? data.selectedNodeIds
      : [data.selectedNodeId];
    setSelection(persistedSelection, data.selectedNodeId || persistedSelection[persistedSelection.length - 1] || state.nodes[0]?.id || "", true);
    state.selectionRect = null;
  }

  function canvasSnapshot() {
    return {
      background: state.background,
      viewport: state.viewport,
      nodes: state.nodes,
      edges: state.edges,
      selectedNodeId: state.selectedNodeId,
      selectedNodeIds: state.selectedNodeIds,
      pendingEdgeFrom: state.pendingEdgeFrom,
      edgeError: state.edgeError
    };
  }

  function applyCanvasSnapshot(snapshot = {}) {
    hydrateFromData(snapshot);
    state.pendingEdgeFrom = snapshot.pendingEdgeFrom || "";
    state.edgeError = snapshot.edgeError || "";
    state.drag = null;
    state.pointers.clear();
    markDirty();
    renderBoard();
  }

  function ensureHistory() {
    if (state.history || !root.history?.createController) return state.history;
    state.history = root.history.createController({
      getSnapshot: canvasSnapshot,
      applySnapshot: applyCanvasSnapshot,
      createNode: root.nodes.createNode,
      onChange: renderHistoryControls
    });
    return state.history;
  }

  function resetHistory() {
    ensureHistory()?.reset(canvasSnapshot());
  }

  function captureHistory(label) {
    return ensureHistory()?.capture(label);
  }

  function recordHistoryBefore(capture) {
    if (!capture) return false;
    return ensureHistory()?.recordBefore(capture.snapshot, capture.label);
  }

  function shouldRestoreDraft(projectId, draft, serverCanvas) {
    if (!draft) return false;
    if (projectId === "new") return global.confirm("恢复本地画布草稿？");
    const draftSaved = Date.parse(draft.savedAt || "") || 0;
    const serverSaved = Date.parse(serverCanvas?.updatedAt || "") || 0;
    return draftSaved > serverSaved && global.confirm("发现较新的本地画布草稿，是否恢复？");
  }

  function nodeTemplate(node) {
    const selected = state.selectedNodeIds.includes(node.id) ? " selected" : "";
    const primary = node.id === state.selectedNodeId ? " primary-selected" : "";
    const locked = node.locked ? " locked" : "";
    const pending = node.id === state.pendingEdgeFrom ? " pending-link" : "";
    const status = node.type === "output" ? `<small data-status="${escapeHtml(node.data.status || "idle")}">${escapeHtml(node.data.status || "idle")}</small>` : "";
    const size = node.type === "group"
      ? `width:${Math.max(220, Number(node.data.width || 320))}px;min-height:${Math.max(132, Number(node.data.height || 220))}px;`
      : "";
    const body = node.type === "config"
      ? `${node.data.model} · ${node.data.size} · ${node.data.quality} · ${node.data.candidateCount}x`
      : node.type === "group"
        ? groupBody(node)
      : node.data.prompt || node.data.body || node.data.imageUrl || "";
    return `<button class="canvas-demo-node canvas-node canvas-node-${node.type}${selected}${primary}${locked}${pending}" type="button" data-node-id="${node.id}" style="left:${node.x}px;top:${node.y}px;${size}">
      <span><i class="${root.nodes.meta[node.type].icon}"></i>${root.nodes.meta[node.type].label}</span>
      <strong>${escapeHtml(node.data.title || root.nodes.meta[node.type].label)}</strong>
      <em>${escapeHtml(body)}</em>
      ${status}
    </button>`;
  }

  function renderNodes() {
    return [
      ...state.nodes.filter((node) => node.type === "group"),
      ...state.nodes.filter((node) => node.type !== "group")
    ];
  }

  function selectionBoxTemplate() {
    if (!state.selectionRect) return "";
    const rect = state.selectionRect;
    return `<div class="canvas-selection-box" style="left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px"></div>`;
  }

  function groupBody(node) {
    const count = Array.isArray(node.data.memberIds) ? node.data.memberIds.length : 0;
    return node.data.body || `${count} grouped node${count === 1 ? "" : "s"}`;
  }

  function edgeTemplate() {
    const lines = state.edges.map((edge) => {
      const source = state.nodes.find((node) => node.id === edge.sourceId);
      const target = state.nodes.find((node) => node.id === edge.targetId);
      if (!source || !target) return "";
      const active = state.selectedNodeIds.includes(source.id) || state.selectedNodeIds.includes(target.id) ? " active" : "";
      const x1 = Number(source.x || 0) + 220;
      const y1 = Number(source.y || 0) + 66;
      const x2 = Number(target.x || 0);
      const y2 = Number(target.y || 0) + 66;
      const mid = Math.max(60, Math.abs(x2 - x1) / 2);
      return `<path class="canvas-edge${active}" data-edge-id="${edge.id}" d="M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}" />`;
    }).join("");
    return `<svg class="canvas-edges" width="2400" height="1600" viewBox="-400 -300 2400 1600">${lines}</svg>`;
  }

  function renderInspector() {
    const body = document.querySelector("#canvasInspectorBody");
    if (!body) return;
    const selected = selectedNodes();
    if (selected.length > 1) {
      body.innerHTML = `
        <div class="canvas-selection-summary">
          <strong>${selected.length} nodes selected</strong>
          <span>Drag any selected node to move the group. Shift-drag on empty canvas to box select.</span>
        </div>
        <div class="canvas-inspector-actions">
          <button type="button" data-node-action="group"><i class="ri-folder-add-line"></i><span>Group</span></button>
          <button type="button" data-node-action="duplicate"><i class="ri-file-copy-line"></i><span>Copy</span></button>
          <button type="button" data-node-action="delete"><i class="ri-delete-bin-line"></i><span>Delete</span></button>
        </div>
      `;
      return;
    }
    const node = selectedNode();
    if (!node) {
      body.innerHTML = `<p>Select a node to edit parameters.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="canvas-inspector-actions">
        ${["config", "output"].includes(node.type) ? `<button type="button" data-node-action="run"><i class="ri-play-line"></i><span>Run</span></button>` : ""}
        ${node.type === "output" && (node.data.generationIds || []).length ? `<button type="button" data-node-action="publish"><i class="ri-gallery-upload-line"></i><span>Publish</span></button>` : ""}
        <button type="button" data-node-action="duplicate"><i class="ri-file-copy-line"></i><span>Copy</span></button>
        <button type="button" data-node-action="lock"><i class="${node.locked ? "ri-lock-unlock-line" : "ri-lock-line"}"></i><span>${node.locked ? "Unlock" : "Lock"}</span></button>
        <button type="button" data-node-action="link"><i class="ri-link"></i><span>Start link</span></button>
        <button type="button" data-node-action="delete"><i class="ri-delete-bin-line"></i><span>Delete</span></button>
      </div>
      ${connectionPanel(node)}
      ${field("title", "Title", node.data.title || "")}
      ${nodeFields(node)}
    `;
  }

  function connectionPanel(node) {
    const incoming = state.edges.filter((edge) => edge.targetId === node.id);
    const outgoing = state.edges.filter((edge) => edge.sourceId === node.id);
    const summary = node.type === "config" ? root.workflows.configInputSummary(state.nodes, state.edges, node.id) : null;
    const conflict = summary?.hasConflict
      ? `<div class="canvas-input-warning">Input conflict: keep one prompt and one image upstream.</div>`
      : "";
    const upstream = summary
      ? `<div class="canvas-upstream"><strong>${summary.mode}</strong><span>${summary.prompts.length} prompt · ${summary.images.length} image</span></div>`
      : "";
    const error = state.edgeError ? `<div class="canvas-input-warning">${escapeHtml(state.edgeError)}</div>` : "";
    const pending = state.pendingEdgeFrom ? `<div class="canvas-linking">Linking from ${escapeHtml(labelFor(state.pendingEdgeFrom))}</div>` : "";
    const rows = [...incoming, ...outgoing].map((edge) => {
      const other = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
      return `<button type="button" data-edge-delete="${edge.id}"><i class="ri-close-line"></i><span>${escapeHtml(edge.sourceId === node.id ? "to" : "from")} ${escapeHtml(labelFor(other))}</span></button>`;
    }).join("");
    return `${error}${pending}${upstream}${conflict}${rows ? `<div class="canvas-edge-list">${rows}</div>` : ""}`;
  }

  function nodeFields(node) {
    if (node.type === "image") return field("imageUrl", "Image URL", node.data.imageUrl || "") + area("body", "Caption", node.data.body || "");
    if (node.type === "text") return area("body", "Text", node.data.body || "");
    if (node.type === "prompt") return area("prompt", "Prompt", node.data.prompt || node.data.body || "");
    if (node.type === "output") return select("status", "Status", node.data.status || "idle", ["idle", "loading", "success", "error"]) + area("body", "Message", node.data.body || "");
    if (node.type === "group") return area("body", "Description", node.data.body || "");
    return field("model", "Model", node.data.model || "GPT-IMAGE-2")
      + select("size", "Size", node.data.size || "1024x1024", ["1024x1024", "1536x1024", "1024x1536"])
      + select("quality", "Quality", node.data.quality || "medium", ["low", "medium", "high"])
      + select("candidateCount", "Candidates", String(node.data.candidateCount || 1), ["1", "2", "3", "4"]);
  }

  function field(name, label, value) {
    return `<label class="canvas-field"><span>${label}</span><input data-node-field="${name}" value="${escapeHtml(value)}"></label>`;
  }

  function area(name, label, value) {
    return `<label class="canvas-field"><span>${label}</span><textarea data-node-field="${name}">${escapeHtml(value)}</textarea></label>`;
  }

  function select(name, label, value, options) {
    return `<label class="canvas-field"><span>${label}</span><select data-node-field="${name}">${
      options.map((option) => `<option value="${option}"${String(value) === option ? " selected" : ""}>${option}</option>`).join("")
    }</select></label>`;
  }

  function bindShellEvents({ elements = {}, navigate } = {}) {
    if (typeof navigate !== "function") return;
    elements.canvasCreateBtn?.addEventListener("click", () => {
      navigate("canvas", { scrollTop: true, route: { canvasProjectId: "new" } });
    });
    document.querySelectorAll("[data-canvas-list]").forEach((button) => {
      button.addEventListener("click", () => navigate("canvas", { scrollTop: true, route: { canvasProjectId: "" } }));
    });
    bindBoardEvents();
  }

  function bindBoardEvents() {
    const board = document.querySelector("#canvasBoard");
    if (!board || board.dataset.bound === "1") return;
    board.dataset.bound = "1";
    board.addEventListener("wheel", onWheel, { passive: false });
    board.addEventListener("pointerdown", onMinimapPointerDown, true);
    board.addEventListener("pointerdown", onPointerDown);
    board.addEventListener("pointermove", onPointerMove);
    board.addEventListener("pointerup", endDrag);
    board.addEventListener("pointercancel", endDrag);
    global.addEventListener("keydown", onCanvasKeyDown);
    document.querySelector("[data-canvas-fit]")?.addEventListener("click", fitAll);
    document.querySelector("[data-canvas-save]")?.addEventListener("click", () => saveCanvasNow());
    document.querySelector("[data-canvas-undo]")?.addEventListener("click", undoCanvas);
    document.querySelector("[data-canvas-redo]")?.addEventListener("click", redoCanvas);
    document.querySelector("[data-canvas-copy]")?.addEventListener("click", copySelection);
    document.querySelector("[data-canvas-paste]")?.addEventListener("click", pasteSelection);
    document.querySelector("[data-canvas-group]")?.addEventListener("click", groupSelection);
    document.querySelector("[data-canvas-delete]")?.addEventListener("click", deleteSelectedNodes);
    document.querySelector("[data-canvas-export]")?.addEventListener("click", exportCanvasJson);
    document.querySelector("[data-canvas-import]")?.addEventListener("click", importCanvasJson);
    document.querySelectorAll("[data-canvas-background]").forEach((button) => {
      button.addEventListener("click", () => {
        const before = captureHistory("background");
        state.background = ["dots", "grid", "blank"].includes(button.dataset.canvasBackground)
          ? button.dataset.canvasBackground
          : "dots";
        recordHistoryBefore(before);
        markDirty();
        renderBoard();
      });
    });
    document.querySelectorAll("[data-canvas-add-type]").forEach((button) => {
      button.addEventListener("click", () => addNode(button.dataset.canvasAddType));
    });
    document.querySelector("#canvasInspectorBody")?.addEventListener("change", updateSelectedNode);
    document.querySelector("#canvasInspectorBody")?.addEventListener("click", onInspectorAction);
    ensureAssistant();
    global.addEventListener("beforeunload", (event) => {
      if (!state.dirty && state.saveStatus !== "saving" && state.saveStatus !== "failed") return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function onWheel(event) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = root.geometry.point(event.clientX - rect.left, event.clientY - rect.top);
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    state.viewport = root.geometry.zoomAt(state.viewport, origin, state.viewport.scale * delta);
    markDirty();
    renderBoard();
  }

  function onPointerDown(event) {
    const nodeButton = event.target.closest?.(".canvas-node");
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (state.pointers.size === 2) {
      const points = Array.from(state.pointers.values());
      state.drag = {
        type: "pinch",
        pointerId: event.pointerId,
        startDistance: distance(points[0], points[1]),
        startOrigin: midpoint(points[0], points[1]),
        startViewport: { ...state.viewport },
        history: captureHistory("pinch viewport")
      };
      return;
    }
    if (nodeButton) {
      const node = state.nodes.find((item) => item.id === nodeButton.dataset.nodeId);
      if (!node) return;
      if (state.pendingEdgeFrom && state.pendingEdgeFrom !== node.id) {
        createEdge(state.pendingEdgeFrom, node.id);
        renderBoard();
        return;
      }
      const nextSelection = event.shiftKey
        ? root.selection?.toggle(state.selectedNodeIds, node.id, state.nodes) || [node.id]
        : state.selectedNodeIds.includes(node.id)
          ? state.selectedNodeIds
          : root.selection?.replace(node.id, state.nodes) || [node.id];
      setSelection(nextSelection, node.id);
      if (!state.selectedNodeIds.includes(node.id)) {
        state.drag = null;
        renderBoard();
        return;
      }
      state.drag = node.locked ? null : {
        type: "node",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        nodeId: node.id,
        startNodes: selectedNodes().map((item) => ({ id: item.id, x: item.x, y: item.y })),
        history: captureHistory(selectedNodes().length > 1 ? "move selection" : "move node")
      };
      renderBoard();
      return;
    }
    if (event.shiftKey && root.selection?.rectFromDrag) {
      const start = boardToCanvasPoint(event.currentTarget, event);
      state.drag = {
        type: "select",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPoint: start,
        additive: event.ctrlKey || event.metaKey,
        baseSelection: state.selectedNodeIds.slice()
      };
      state.selectionRect = root.selection.rectFromDrag(start, start);
      renderBoard();
      return;
    }
    state.drag = {
      type: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: state.viewport.x,
      viewY: state.viewport.y,
      history: captureHistory("pan viewport")
    };
  }

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (state.pointers.has(event.pointerId)) {
      state.pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    if (!state.drag) return;
    if (state.drag.type === "minimap") {
      state.viewport = root.minimap?.viewportFromEvent?.(event, { viewport: state.viewport, nodes: state.nodes }) || state.viewport;
      renderBoard();
      return;
    }
    if (state.drag.type === "pinch") {
      const points = Array.from(state.pointers.values());
      if (points.length < 2) return;
      const currentOrigin = midpoint(points[0], points[1]);
      const nextScale = state.drag.startViewport.scale * (distance(points[0], points[1]) / Math.max(1, state.drag.startDistance));
      const zoomed = root.geometry.zoomAt(state.drag.startViewport, state.drag.startOrigin, nextScale);
      state.viewport = { ...zoomed, x: zoomed.x + currentOrigin.x - state.drag.startOrigin.x, y: zoomed.y + currentOrigin.y - state.drag.startOrigin.y };
      renderBoard();
      return;
    }
    if (state.drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.drag.startX;
    const dy = event.clientY - state.drag.startY;
    if (state.drag.type === "pan") {
      state.viewport = { ...state.viewport, x: state.drag.viewX + dx, y: state.drag.viewY + dy };
    } else if (state.drag.type === "select") {
      const end = boardToCanvasPoint(event.currentTarget, event);
      state.selectionRect = root.selection?.rectFromDrag(state.drag.startPoint, end) || null;
      const ids = root.selection?.nodesInRect(state.nodes, state.selectionRect) || [];
      const next = state.drag.additive ? [...state.drag.baseSelection, ...ids] : ids;
      setSelection(next, next[next.length - 1] || state.selectedNodeId);
    } else {
      const selectedIds = state.selectedNodeIds.includes(state.drag.nodeId) ? state.selectedNodeIds : [state.drag.nodeId];
      state.nodes = root.selection?.moveNodes(state.nodes, selectedIds, state.drag.startNodes, {
        x: dx / state.viewport.scale,
        y: dy / state.viewport.scale
      }) || state.nodes;
    }
    renderBoard();
  }

  function endDrag(event) {
    state.pointers.delete(event.pointerId);
    if (state.drag?.type === "pinch" && state.pointers.size < 2) {
      recordHistoryBefore(state.drag.history);
      state.drag = null;
      markDirty();
      return;
    }
    if (state.drag?.pointerId !== event.pointerId) return;
    const changed = ["node", "pan", "minimap"].includes(state.drag?.type);
    const wasSelect = state.drag?.type === "select";
    const before = state.drag?.history;
    state.drag = null;
    state.selectionRect = null;
    if (changed) {
      recordHistoryBefore(before);
      markDirty();
    }
    if (wasSelect) renderBoard();
  }

  function addNode(type) {
    const before = captureHistory("add node");
    const board = document.querySelector("#canvasBoard");
    const rect = board?.getBoundingClientRect() || { width: 800, height: 500 };
    const x = Math.round((rect.width / 2 - state.viewport.x) / state.viewport.scale);
    const y = Math.round((rect.height / 2 - state.viewport.y) / state.viewport.scale);
    const node = root.nodes.createNode({ type, x, y });
    state.nodes.push(node);
    setSelection([node.id], node.id);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  }

  function insertItem(payload = {}) {
    const before = captureHistory("insert item");
    if (!state.projectId) {
      state.projectId = "new";
      state.nodes = root.nodes.defaultNodes?.() || [];
      state.edges = [];
    }
    const board = document.querySelector("#canvasBoard");
    const rect = board?.getBoundingClientRect() || { width: 800, height: 500 };
    const x = Math.round((rect.width / 2 - state.viewport.x) / state.viewport.scale);
    const y = Math.round((rect.height / 2 - state.viewport.y) / state.viewport.scale);
    const isPrompt = payload.kind === "prompt";
    const isText = payload.kind === "text";
    const node = root.nodes.createNode({
      type: isPrompt ? "prompt" : isText ? "text" : "image",
      x,
      y,
      data: isPrompt
        ? {
            title: payload.title || "Prompt",
            prompt: payload.prompt || "",
            body: payload.prompt || "",
            promptId: payload.promptId || "",
            source: payload.source || "",
            tags: payload.tags || []
          }
        : isText
          ? {
              title: payload.title || "Text note",
              body: payload.body || payload.prompt || "",
              source: payload.source || ""
            }
        : {
            title: payload.title || "Image",
            body: payload.prompt || payload.title || "Canvas image",
            imageUrl: payload.imageUrl || "",
            generationId: payload.generationId || "",
            prompt: payload.prompt || "",
            sourceImage: payload.sourceImage || ""
          }
    });
    state.nodes.push(node);
    setSelection([node.id], node.id);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  }

  function ensureAssistant() {
    if (state.assistant || !root.assistant?.createController) return state.assistant;
    const container = document.querySelector("#canvasAssistantBody");
    if (!container) return null;
    state.assistant = root.assistant.createController({
      container,
      request: root.request,
      saveCanvas: saveCanvasNow,
      getContext: assistantContext,
      insertSuggestion: insertAssistantSuggestion
    });
    state.assistant.render();
    return state.assistant;
  }

  function renderAssistant() {
    ensureAssistant()?.render?.();
  }

  function assistantContext() {
    return {
      projectId: state.projectId,
      selectedNodeId: state.selectedNodeId,
      selectedNodeIds: state.selectedNodeIds.slice(),
      selectedNodes: selectedNodes().map(cloneNode),
      nodes: state.nodes.map(cloneNode),
      edges: state.edges.map((edge) => ({ ...edge }))
    };
  }

  function insertAssistantSuggestion(suggestion = {}) {
    if (!root.assistant?.suggestionToNodeInput) return null;
    const input = root.assistant.suggestionToNodeInput(suggestion);
    const before = captureHistory("assistant insert");
    const anchor = selectedNode();
    const point = assistantInsertPoint(anchor);
    const node = root.nodes.createNode({
      type: input.type,
      x: point.x,
      y: point.y,
      data: input.data || {}
    });
    state.nodes.push(node);
    if (anchor?.id) {
      const link = root.workflows?.canConnect?.(state.edges, anchor.id, node.id);
      if (link?.ok) state.edges.push(root.workflows.createEdge(anchor.id, node.id));
    }
    setSelection([node.id], node.id);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
    return node;
  }

  function assistantInsertPoint(anchor) {
    if (anchor) {
      return {
        x: Math.round(Number(anchor.x || 0) + 280),
        y: Math.round(Number(anchor.y || 0) + 36)
      };
    }
    const board = document.querySelector("#canvasBoard");
    const rect = board?.getBoundingClientRect() || { width: 800, height: 500 };
    return {
      x: Math.round((rect.width / 2 - state.viewport.x) / state.viewport.scale),
      y: Math.round((rect.height / 2 - state.viewport.y) / state.viewport.scale)
    };
  }

  function cloneNode(node = {}) {
    return {
      ...node,
      data: { ...(node.data || {}) }
    };
  }

  function updateSelectedNode(event) {
    const fieldName = event.target?.dataset?.nodeField;
    const node = selectedNode();
    if (!fieldName || !node) return;
    const before = captureHistory("edit node");
    const value = fieldName === "candidateCount" ? Number(event.target.value || 1) : event.target.value;
    node.data[fieldName] = value;
    if (fieldName === "prompt") node.data.body = value;
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  }

  async function onInspectorAction(event) {
    const action = event.target.closest?.("[data-node-action]")?.dataset.nodeAction;
    const node = selectedNode();
    if (!action) return;
    if (!node && !["delete", "duplicate", "group"].includes(action)) return;
    if (action === "run") {
      await runCanvasGeneration(node);
      return;
    }
    if (action === "publish") {
      await publishOutputNode(node);
      return;
    }
    if (action === "delete") {
      deleteSelectedNodes();
    }
    if (action === "duplicate") {
      duplicateSelection();
    }
    if (action === "group") {
      groupSelection();
    }
    if (action === "link") {
      state.pendingEdgeFrom = node.id;
      state.edgeError = "";
    }
    if (action === "lock") {
      const before = captureHistory("lock node");
      node.locked = !node.locked;
      recordHistoryBefore(before);
      markDirty();
    }
    renderBoard();
  }

  async function runCanvasGeneration(node) {
    const output = outputForRun(node);
    const config = configForRun(node, output);
    if (!output) {
      state.edgeError = "Add an output node before running.";
      renderBoard();
      return;
    }
    setSelection([output.id], output.id);
    if (!state.projectId || state.projectId === "new") {
      markOutput(output, "error", "Save this canvas before running generation.");
      renderBoard();
      return;
    }
    if (typeof root.request !== "function") {
      markOutput(output, "error", "Canvas generation API is not ready.");
      renderBoard();
      return;
    }
    markOutput(output, "loading", "Running canvas generation...");
    markDirty();
    renderBoard();
    try {
      const result = await root.request(`/api/canvases/${encodeURIComponent(state.projectId)}/generate`, {
        method: "POST",
        body: JSON.stringify({
          nodes: state.nodes,
          edges: state.edges,
          outputNodeId: output.id,
          configNodeId: config?.id || ""
        })
      });
      const generations = Array.isArray(result?.generations) ? result.generations : [];
      markOutput(output, "success", generations.length ? `${generations.length} image(s) generated.` : "Generation finished.", generations);
    } catch (error) {
      markOutput(output, "error", error?.message || "Canvas generation failed.");
    }
    markDirty();
    renderBoard();
  }

  function outputForRun(node) {
    if (node.type === "output") return node;
    const direct = state.edges
      .filter((edge) => edge.sourceId === node.id)
      .map((edge) => state.nodes.find((item) => item.id === edge.targetId))
      .find((item) => item?.type === "output");
    return direct || state.nodes.find((item) => item.type === "output") || null;
  }

  function configForRun(node, output) {
    if (node.type === "config") return node;
    const direct = state.edges
      .filter((edge) => edge.targetId === output?.id)
      .map((edge) => state.nodes.find((item) => item.id === edge.sourceId))
      .find((item) => item?.type === "config");
    return direct || state.nodes.find((item) => item.type === "config") || null;
  }

  function markOutput(output, status, message, generations = []) {
    output.data.status = status;
    output.data.body = message;
    output.data.generationIds = generations.map((generation) => generation.id).filter(Boolean);
    output.data.imageUrl = generations[0]?.imageUrl || output.data.imageUrl || "";
  }

  function onMinimapPointerDown(event) {
    if (!root.minimap?.consumePointerDown?.(event)) return;
    state.drag = { type: "minimap", pointerId: event.pointerId, history: captureHistory("minimap viewport") };
    state.viewport = root.minimap?.viewportFromEvent?.(event, { viewport: state.viewport, nodes: state.nodes }) || state.viewport;
    renderBoard();
  }

  async function publishOutputNode(output) {
    const generationId = output?.data?.generationIds?.[0] || "";
    if (!generationId) {
      markOutput(output, "error", "Run this output before publishing.");
      renderBoard();
      return;
    }
    if (typeof root.publishGeneration !== "function") {
      markOutput(output, "error", "Publish tools are not ready.");
      renderBoard();
      return;
    }
    try {
      await root.publishGeneration({
        generationId,
        conversationRoute: routeForOutput(output)
      });
    } catch (error) {
      markOutput(output, "error", error?.message || "Publish failed.");
      renderBoard();
    }
  }

  function routeForOutput(output) {
    const nodes = upstreamNodes(output.id);
    const ordered = [...nodes, output].filter(Boolean);
    return ordered.map((node) => {
      const data = node.data || {};
      const prompt = node.type === "config"
        ? `${data.model || "GPT-IMAGE-2"} · ${data.size || "1024x1024"} · ${data.quality || "medium"} · ${data.candidateCount || 1}x`
        : data.prompt || data.body || data.title || root.nodes.meta[node.type]?.label || "";
      return {
        id: node.id,
        prompt,
        imageUrl: data.imageUrl || "",
        type: `canvas-${node.type}`,
        createdAt: new Date().toISOString()
      };
    });
  }

  function upstreamNodes(nodeId, seen = new Set()) {
    return state.edges
      .filter((edge) => edge.targetId === nodeId)
      .flatMap((edge) => {
        if (seen.has(edge.sourceId)) return [];
        seen.add(edge.sourceId);
        const node = state.nodes.find((item) => item.id === edge.sourceId);
        return node ? [...upstreamNodes(node.id, seen), node] : [];
      });
  }

  function createEdge(sourceId, targetId) {
    const result = root.workflows.canConnect(state.edges, sourceId, targetId);
    state.pendingEdgeFrom = "";
    if (!result.ok) {
      state.edgeError = result.reason === "cycle" ? "Cycle links are blocked." : "This link cannot be created.";
      return;
    }
    const before = captureHistory("create edge");
    state.edges.push(root.workflows.createEdge(sourceId, targetId));
    setSelection([targetId], targetId);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
  }

  document.addEventListener("click", (event) => {
    const edgeId = event.target.closest?.("[data-edge-delete]")?.dataset.edgeDelete;
    if (!edgeId) return;
    const before = captureHistory("delete edge");
    state.edges = state.edges.filter((edge) => edge.id !== edgeId);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  });

  function undoCanvas() {
    if (!ensureHistory()?.undo()) return;
    markDirty();
  }

  function redoCanvas() {
    if (!ensureHistory()?.redo()) return;
    markDirty();
  }

  function copySelection() {
    const nodes = selectedNodes();
    if (!nodes.length) return;
    ensureHistory()?.copy(nodes, state.edges);
    renderHistoryControls();
  }

  function pasteSelection() {
    const pasted = ensureHistory()?.paste({ selectedNodeId: state.selectedNodeId });
    if (!pasted?.nodes?.length) return;
    const before = captureHistory("paste node");
    state.nodes.push(...pasted.nodes);
    state.edges.push(...pasted.edges);
    setSelection(pasted.nodes.map((node) => node.id), pasted.selectedNodeId || pasted.nodes[pasted.nodes.length - 1].id);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  }

  function onCanvasKeyDown(event) {
    if (!state.projectId || isTypingTarget(event.target)) return;
    const key = String(event.key || "").toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier && ["delete", "backspace"].includes(key)) {
      event.preventDefault();
      deleteSelectedNodes();
      return;
    }
    if (!modifier) return;
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) redoCanvas();
      else undoCanvas();
      return;
    }
    if (key === "y") {
      event.preventDefault();
      redoCanvas();
      return;
    }
    if (key === "c") {
      event.preventDefault();
      copySelection();
      return;
    }
    if (key === "v") {
      event.preventDefault();
      pasteSelection();
      return;
    }
    if (key === "g") {
      event.preventDefault();
      groupSelection();
    }
  }

  function isTypingTarget(target) {
    const tag = String(target?.tagName || "").toLowerCase();
    return target?.isContentEditable || ["input", "textarea", "select"].includes(tag);
  }

  function markDirty() {
    if (state.hydrating || !state.projectId) return;
    state.dirty = true;
    setSaveStatus("dirty");
    writeDraft();
    scheduleAutosave();
  }

  function scheduleAutosave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => saveCanvasNow(), SAVE_DEBOUNCE_MS);
  }

  async function saveCanvasNow() {
    if (!state.projectId || (!state.dirty && state.projectId !== "new") || state.saveStatus === "saving") return true;
    if (typeof root.request !== "function") {
      setSaveStatus("failed", "同步失败");
      writeDraft();
      return false;
    }
    clearTimeout(state.saveTimer);
    setSaveStatus("saving");
    const payload = canvasPayload();
    try {
      const result = state.projectId === "new"
        ? await root.request("/api/canvases", { method: "POST", body: JSON.stringify(payload) })
        : await root.request(`/api/canvases/${encodeURIComponent(state.projectId)}`, { method: "PATCH", body: JSON.stringify(payload) });
      const canvas = result?.canvas || null;
      if (canvas?.id) {
        const previousDraftKey = draftKey(state.projectId);
        state.projectId = canvas.id;
        state.projectTitle = canvas.title || state.projectTitle;
        state.lastServerUpdatedAt = canvas.updatedAt || state.lastServerUpdatedAt;
        removeDraft(previousDraftKey);
        removeDraft(draftKey(state.projectId));
        root.setProjectRoute?.(state.projectId);
      }
      state.dirty = false;
      setSaveStatus("saved");
      return true;
    } catch (error) {
      setSaveStatus("failed", error?.message || "同步失败");
      writeDraft();
      return false;
    } finally {
      renderBoard();
    }
  }

  async function exportCanvasJson() {
    if (!root.io?.exportCanvas) return;
    try {
      await saveCanvasNow();
      await root.io.exportCanvas({
        projectId: state.projectId,
        title: state.projectTitle,
        request: root.request
      });
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("failed", error?.message || "导出失败");
    }
    renderBoard();
  }

  async function importCanvasJson() {
    if (!root.io?.importCanvas) return;
    try {
      await saveCanvasNow();
      const result = await root.io.importCanvas({
        projectId: state.projectId,
        request: root.request
      });
      if (result?.canvas) {
        applyProject(result.canvas);
        state.dirty = false;
        setSaveStatus("saved");
        removeDraft(draftKey(state.projectId));
      }
    } catch (error) {
      setSaveStatus("failed", error?.message || "导入失败");
    }
    renderBoard();
  }

  function canvasPayload() {
    const data = {
      background: state.background,
      viewport: state.viewport,
      nodes: state.nodes,
      edges: state.edges,
      selectedNodeId: state.selectedNodeId,
      selectedNodeIds: state.selectedNodeIds
    };
    return {
      title: state.projectTitle || "Untitled canvas",
      visibility: "private",
      dataJson: data,
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length
    };
  }

  function draftKey(projectId = state.projectId) {
    return `${DRAFT_PREFIX}${projectId || "new"}`;
  }

  function writeDraft() {
    if (!state.projectId) return;
    try {
      global.localStorage?.setItem(draftKey(), JSON.stringify({
        projectId: state.projectId,
        title: state.projectTitle,
        savedAt: new Date().toISOString(),
        data: canvasPayload().dataJson
      }));
    } catch {
      // localStorage may be unavailable in private browsing.
    }
  }

  function readDraft(projectId) {
    try {
      return JSON.parse(global.localStorage?.getItem(draftKey(projectId)) || "null");
    } catch {
      return null;
    }
  }

  function removeDraft(key) {
    try {
      global.localStorage?.removeItem(key);
    } catch {
      // ignore localStorage failures
    }
  }

  function setSaveStatus(status, error = "") {
    state.saveStatus = status;
    state.saveError = error;
    renderSaveStatus();
  }

  function renderSaveStatus() {
    const status = document.querySelector("#canvasSaveStatus");
    if (!status) return;
    const labels = {
      saved: "已保存",
      saving: "保存中",
      dirty: "未保存",
      failed: "同步失败"
    };
    status.dataset.status = state.saveStatus;
    status.textContent = state.saveError && state.saveStatus === "failed"
      ? `${labels.failed}: ${state.saveError}`
      : labels[state.saveStatus] || labels.saved;
  }

  function renderHistoryControls() {
    const status = ensureHistory()?.status?.() || {};
    document.querySelectorAll("[data-canvas-undo]").forEach((button) => {
      button.disabled = !status.canUndo;
      button.title = "Undo (Ctrl/Cmd+Z)";
    });
    document.querySelectorAll("[data-canvas-redo]").forEach((button) => {
      button.disabled = !status.canRedo;
      button.title = "Redo (Ctrl/Cmd+Shift+Z)";
    });
    document.querySelectorAll("[data-canvas-copy]").forEach((button) => {
      button.disabled = !selectedNodes().length;
      button.title = "Copy selected node(s) (Ctrl/Cmd+C)";
    });
    document.querySelectorAll("[data-canvas-paste]").forEach((button) => {
      button.disabled = !status.canPaste;
      button.title = "Paste node (Ctrl/Cmd+V)";
    });
    document.querySelectorAll("[data-canvas-group]").forEach((button) => {
      button.disabled = selectedNodes().filter((node) => node.type !== "group").length < 2;
      button.title = "Group selected nodes (Ctrl/Cmd+G)";
    });
    document.querySelectorAll("[data-canvas-delete]").forEach((button) => {
      button.disabled = !selectedNodes().length;
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

  function selectedNode() {
    return state.nodes.find((node) => node.id === state.selectedNodeId) || null;
  }

  function selectedNodes() {
    const ids = new Set(state.selectedNodeIds);
    return state.nodes.filter((node) => ids.has(node.id));
  }

  function setSelection(ids = [], primaryId = "", fallbackToPrimary = false) {
    const normalized = root.selection?.normalize(ids, state.nodes) || ids.filter(Boolean);
    const primaryExists = state.nodes.some((node) => node.id === primaryId);
    const fallback = normalized[normalized.length - 1] || (fallbackToPrimary && primaryExists ? primaryId : "");
    state.selectedNodeIds = normalized;
    state.selectedNodeId = normalized.includes(primaryId) ? primaryId : fallback;
  }

  function deleteSelectedNodes() {
    const ids = state.selectedNodeIds.length ? state.selectedNodeIds : state.selectedNodeId ? [state.selectedNodeId] : [];
    if (!ids.length) return;
    const before = captureHistory(ids.length > 1 ? "delete selection" : "delete node");
    const result = root.selection?.deleteSelection(state.nodes, state.edges, ids);
    if (!result) return;
    state.nodes = result.nodes;
    state.edges = result.edges;
    setSelection([state.nodes[0]?.id || ""], state.nodes[0]?.id || "");
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  }

  function duplicateSelection() {
    const nodes = selectedNodes();
    if (!nodes.length) return;
    const before = captureHistory(nodes.length > 1 ? "duplicate selection" : "duplicate node");
    const duplicates = nodes.map((node) => root.nodes.duplicateNode(node)).filter(Boolean);
    if (!duplicates.length) return;
    state.nodes.push(...duplicates);
    setSelection(duplicates.map((node) => node.id), duplicates[duplicates.length - 1].id);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  }

  function groupSelection() {
    if (state.selectedNodeIds.length < 2 || !root.selection?.groupFromNodes) return;
    const before = captureHistory("group selection");
    const group = root.selection.groupFromNodes(state.nodes, state.selectedNodeIds, root.nodes.createNode);
    if (!group) return;
    state.nodes.push(group);
    setSelection([group.id], group.id);
    state.edgeError = "";
    recordHistoryBefore(before);
    markDirty();
    renderBoard();
  }

  function labelFor(nodeId) {
    const node = state.nodes.find((item) => item.id === nodeId);
    return node?.data?.title || nodeId;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a, b) {
    return root.geometry.point((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  function boardToCanvasPoint(board, event) {
    const rect = board.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - state.viewport.x) / state.viewport.scale,
      y: (event.clientY - rect.top - state.viewport.y) / state.viewport.scale
    };
  }

  function fitAll() {
    const board = document.querySelector("#canvasBoard");
    if (!board || !state.nodes.length) return;
    const rect = board.getBoundingClientRect();
    state.viewport = root.geometry.fitBounds(root.nodes.bounds(state.nodes), { width: rect.width, height: rect.height });
    renderBoard();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  root.renderShell = renderShell;
  root.bindShellEvents = bindShellEvents;
  root.insertItem = insertItem;
  root.getAssistantContext = assistantContext;
  root.addAssistantNode = insertAssistantSuggestion;
})(window, document);
