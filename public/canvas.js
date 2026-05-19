(function initCanvasShell(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const state = {
    projectId: "",
    background: "dots",
    viewport: { x: 80, y: 80, scale: 1 },
    nodes: [],
    edges: [],
    selectedNodeId: "",
    pendingEdgeFrom: "",
    edgeError: "",
    drag: null,
    pointers: new Map()
  };

  function renderShell({ projectId = "", elements = {} } = {}) {
    const normalizedId = root.store?.normalizeProjectId(projectId) || "";
    if (state.projectId !== normalizedId) {
      state.projectId = normalizedId;
      state.nodes = normalizedId ? root.nodes?.defaultNodes?.() || [] : [];
      state.edges = normalizedId ? [
        root.workflows.createEdge("node_prompt", "node_config"),
        root.workflows.createEdge("node_image", "node_config"),
        root.workflows.createEdge("node_config", "node_output")
      ] : [];
      state.selectedNodeId = state.nodes[0]?.id || "";
      state.pendingEdgeFrom = "";
      state.edgeError = "";
      state.viewport = { x: 80, y: 80, scale: 1 };
    }
    elements.canvasListView?.classList.toggle("hidden", Boolean(normalizedId));
    elements.canvasWorkspaceView?.classList.toggle("hidden", !normalizedId);

    const title = document.querySelector("#canvasTitleText");
    if (title) title.textContent = normalizedId === "new" ? "Untitled canvas" : normalizedId || "Untitled";
    renderBoard();
  }

  function renderBoard() {
    const board = document.querySelector("#canvasBoard");
    const viewport = document.querySelector("#canvasViewport");
    if (!board || !viewport) return;
    board.dataset.background = state.background;
    viewport.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
    viewport.innerHTML = edgeTemplate() + state.nodes.map((node) => nodeTemplate(node)).join("");
    renderInspector();
    document.querySelectorAll("[data-canvas-background]").forEach((button) => {
      button.classList.toggle("active", button.dataset.canvasBackground === state.background);
    });
  }

  function nodeTemplate(node) {
    const selected = node.id === state.selectedNodeId ? " selected" : "";
    const locked = node.locked ? " locked" : "";
    const pending = node.id === state.pendingEdgeFrom ? " pending-link" : "";
    const status = node.type === "output" ? `<small data-status="${escapeHtml(node.data.status || "idle")}">${escapeHtml(node.data.status || "idle")}</small>` : "";
    const body = node.type === "config"
      ? `${node.data.model} · ${node.data.size} · ${node.data.quality} · ${node.data.candidateCount}x`
      : node.data.prompt || node.data.body || node.data.imageUrl || "";
    return `<button class="canvas-demo-node canvas-node canvas-node-${node.type}${selected}${locked}${pending}" type="button" data-node-id="${node.id}" style="left:${node.x}px;top:${node.y}px">
      <span><i class="${root.nodes.meta[node.type].icon}"></i>${root.nodes.meta[node.type].label}</span>
      <strong>${escapeHtml(node.data.title || root.nodes.meta[node.type].label)}</strong>
      <em>${escapeHtml(body)}</em>
      ${status}
    </button>`;
  }

  function edgeTemplate() {
    const lines = state.edges.map((edge) => {
      const source = state.nodes.find((node) => node.id === edge.sourceId);
      const target = state.nodes.find((node) => node.id === edge.targetId);
      if (!source || !target) return "";
      const active = [source.id, target.id].includes(state.selectedNodeId) ? " active" : "";
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
    const node = selectedNode();
    if (!node) {
      body.innerHTML = `<p>Select a node to edit parameters.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="canvas-inspector-actions">
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
    board.addEventListener("pointerdown", onPointerDown);
    board.addEventListener("pointermove", onPointerMove);
    board.addEventListener("pointerup", endDrag);
    board.addEventListener("pointercancel", endDrag);
    document.querySelector("[data-canvas-fit]")?.addEventListener("click", fitAll);
    document.querySelectorAll("[data-canvas-background]").forEach((button) => {
      button.addEventListener("click", () => {
        state.background = ["dots", "grid", "blank"].includes(button.dataset.canvasBackground)
          ? button.dataset.canvasBackground
          : "dots";
        renderBoard();
      });
    });
    document.querySelectorAll("[data-canvas-add-type]").forEach((button) => {
      button.addEventListener("click", () => addNode(button.dataset.canvasAddType));
    });
    document.querySelector("#canvasInspectorBody")?.addEventListener("change", updateSelectedNode);
    document.querySelector("#canvasInspectorBody")?.addEventListener("click", onInspectorAction);
  }

  function onWheel(event) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = root.geometry.point(event.clientX - rect.left, event.clientY - rect.top);
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    state.viewport = root.geometry.zoomAt(state.viewport, origin, state.viewport.scale * delta);
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
        startViewport: { ...state.viewport }
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
      state.selectedNodeId = node.id;
      state.drag = node.locked ? null : {
        type: "node",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        nodeX: node.x,
        nodeY: node.y,
        nodeId: node.id
      };
      renderBoard();
      return;
    }
    state.drag = {
      type: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: state.viewport.x,
      viewY: state.viewport.y
    };
  }

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (state.pointers.has(event.pointerId)) {
      state.pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    if (!state.drag) return;
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
    } else {
      const node = state.nodes.find((item) => item.id === state.drag.nodeId);
      if (node) {
        node.x = Math.round(state.drag.nodeX + dx / state.viewport.scale);
        node.y = Math.round(state.drag.nodeY + dy / state.viewport.scale);
      }
    }
    renderBoard();
  }

  function endDrag(event) {
    state.pointers.delete(event.pointerId);
    if (state.drag?.type === "pinch" && state.pointers.size < 2) {
      state.drag = null;
      return;
    }
    if (state.drag?.pointerId !== event.pointerId) return;
    state.drag = null;
  }

  function addNode(type) {
    const board = document.querySelector("#canvasBoard");
    const rect = board?.getBoundingClientRect() || { width: 800, height: 500 };
    const x = Math.round((rect.width / 2 - state.viewport.x) / state.viewport.scale);
    const y = Math.round((rect.height / 2 - state.viewport.y) / state.viewport.scale);
    const node = root.nodes.createNode({ type, x, y });
    state.nodes.push(node);
    state.selectedNodeId = node.id;
    state.edgeError = "";
    renderBoard();
  }

  function updateSelectedNode(event) {
    const fieldName = event.target?.dataset?.nodeField;
    const node = selectedNode();
    if (!fieldName || !node) return;
    const value = fieldName === "candidateCount" ? Number(event.target.value || 1) : event.target.value;
    node.data[fieldName] = value;
    if (fieldName === "prompt") node.data.body = value;
    renderBoard();
  }

  function onInspectorAction(event) {
    const action = event.target.closest?.("[data-node-action]")?.dataset.nodeAction;
    const node = selectedNode();
    if (!action || !node) return;
    if (action === "delete") {
      state.nodes = state.nodes.filter((item) => item.id !== node.id);
      state.edges = state.edges.filter((edge) => edge.sourceId !== node.id && edge.targetId !== node.id);
      state.selectedNodeId = state.nodes[0]?.id || "";
    }
    if (action === "duplicate") {
      const duplicate = root.nodes.duplicateNode(node);
      if (duplicate) {
        state.nodes.push(duplicate);
        state.selectedNodeId = duplicate.id;
      }
    }
    if (action === "link") {
      state.pendingEdgeFrom = node.id;
      state.edgeError = "";
    }
    if (action === "lock") node.locked = !node.locked;
    renderBoard();
  }

  function createEdge(sourceId, targetId) {
    const result = root.workflows.canConnect(state.edges, sourceId, targetId);
    state.pendingEdgeFrom = "";
    if (!result.ok) {
      state.edgeError = result.reason === "cycle" ? "Cycle links are blocked." : "This link cannot be created.";
      return;
    }
    state.edges.push(root.workflows.createEdge(sourceId, targetId));
    state.selectedNodeId = targetId;
    state.edgeError = "";
  }

  document.addEventListener("click", (event) => {
    const edgeId = event.target.closest?.("[data-edge-delete]")?.dataset.edgeDelete;
    if (!edgeId) return;
    state.edges = state.edges.filter((edge) => edge.id !== edgeId);
    state.edgeError = "";
    renderBoard();
  });

  function selectedNode() {
    return state.nodes.find((node) => node.id === state.selectedNodeId) || null;
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
})(window, document);
