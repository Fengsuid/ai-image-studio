(function initCanvasShell(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const state = {
    projectId: "",
    background: "dots",
    viewport: { x: 80, y: 80, scale: 1 },
    nodes: [],
    selectedNodeId: "",
    drag: null,
    pointers: new Map()
  };

  function renderShell({ projectId = "", elements = {} } = {}) {
    const normalizedId = root.store?.normalizeProjectId(projectId) || "";
    if (state.projectId !== normalizedId) {
      state.projectId = normalizedId;
      state.nodes = normalizedId ? root.nodes?.demoNodes?.() || [] : [];
      state.selectedNodeId = state.nodes[0]?.id || "";
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
    viewport.innerHTML = state.nodes.map((node) => nodeTemplate(node)).join("");
    const inspector = document.querySelector(".canvas-inspector p");
    const selected = state.nodes.find((node) => node.id === state.selectedNodeId);
    if (inspector && selected) inspector.textContent = `${selected.data.title}: ${selected.data.body}`;
    document.querySelectorAll("[data-canvas-background]").forEach((button) => {
      button.classList.toggle("active", button.dataset.canvasBackground === state.background);
    });
  }

  function nodeTemplate(node) {
    const selected = node.id === state.selectedNodeId ? " selected" : "";
    return `<button class="canvas-demo-node${selected}" type="button" data-node-id="${node.id}" style="left:${node.x}px;top:${node.y}px">
      <span>${node.type}</span>
      <strong>${node.data.title}</strong>
      <em>${node.data.body}</em>
    </button>`;
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
    const nodeButton = event.target.closest?.(".canvas-demo-node");
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
      state.selectedNodeId = node.id;
      state.drag = {
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
      viewY: state.viewport.y,
      rect
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
      state.viewport = {
        ...zoomed,
        x: zoomed.x + currentOrigin.x - state.drag.startOrigin.x,
        y: zoomed.y + currentOrigin.y - state.drag.startOrigin.y
      };
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

  root.renderShell = renderShell;
  root.bindShellEvents = bindShellEvents;
})(window, document);
