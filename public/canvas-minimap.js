(function initCanvasMinimap(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 132;

  function render(board, snapshot = {}) {
    let minimap = board.querySelector(".canvas-minimap");
    if (!minimap) {
      minimap = document.createElement("div");
      minimap.className = "canvas-minimap";
      minimap.setAttribute("role", "button");
      minimap.setAttribute("aria-label", "Canvas minimap");
      board.appendChild(minimap);
    }
    const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
    if (!nodes.length) {
      minimap.innerHTML = `<span>Mini map</span>`;
      return;
    }
    const edges = Array.isArray(snapshot.edges) ? snapshot.edges : [];
    const viewport = snapshot.viewport || { x: 0, y: 0, scale: 1 };
    const scale = root.geometry.clampScale(viewport.scale);
    const rect = board.getBoundingClientRect();
    const layout = layoutFor(minimap, nodes);
    const view = {
      x: -Number(viewport.x || 0) / scale,
      y: -Number(viewport.y || 0) / scale,
      width: rect.width / scale,
      height: rect.height / scale
    };
    const viewStart = layout.project(view.x, view.y);
    const viewEnd = layout.project(view.x + view.width, view.y + view.height);
    const nodeRects = nodes.map((node) => {
      const start = layout.project(node.x, node.y);
      const end = layout.project(Number(node.x || 0) + NODE_WIDTH, Number(node.y || 0) + NODE_HEIGHT);
      const active = node.id === snapshot.selectedNodeId ? " active" : "";
      return `<i class="canvas-minimap-node${active}" style="left:${start.x}px;top:${start.y}px;width:${Math.max(3, end.x - start.x)}px;height:${Math.max(3, end.y - start.y)}px"></i>`;
    }).join("");
    const edgeLines = edges.map((edge) => {
      const source = nodes.find((node) => node.id === edge.sourceId);
      const target = nodes.find((node) => node.id === edge.targetId);
      if (!source || !target) return "";
      const start = layout.project(Number(source.x || 0) + NODE_WIDTH, Number(source.y || 0) + NODE_HEIGHT / 2);
      const end = layout.project(Number(target.x || 0), Number(target.y || 0) + NODE_HEIGHT / 2);
      const active = [source.id, target.id].includes(snapshot.selectedNodeId) ? " active" : "";
      return `<line class="canvas-minimap-edge${active}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"></line>`;
    }).join("");
    minimap.innerHTML = `
      <span>${nodes.length} nodes</span>
      <div class="canvas-minimap-stage" style="width:${layout.width}px;height:${layout.height}px">
        <svg class="canvas-minimap-edges" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${edgeLines}</svg>
        ${nodeRects}
        <b class="canvas-minimap-view" style="left:${viewStart.x}px;top:${viewStart.y}px;width:${Math.max(10, viewEnd.x - viewStart.x)}px;height:${Math.max(8, viewEnd.y - viewStart.y)}px"></b>
      </div>
    `;
  }

  function consumePointerDown(event) {
    const minimap = event.target.closest?.(".canvas-minimap");
    if (!minimap) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    return true;
  }

  function worldPointFromEvent(event, nodes = []) {
    const stage = document.querySelector(".canvas-minimap-stage");
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    const layout = root.geometry.minimapLayout(root.nodes.bounds(nodes), { width: rect.width, height: rect.height });
    return layout.unproject(event.clientX - rect.left, event.clientY - rect.top);
  }

  function viewportFromEvent(event, snapshot = {}) {
    const board = document.querySelector("#canvasBoard");
    if (!board) return null;
    const point = worldPointFromEvent(event, snapshot.nodes);
    if (!point) return null;
    const viewport = snapshot.viewport || { x: 0, y: 0, scale: 1 };
    const boardRect = board.getBoundingClientRect();
    return {
      ...viewport,
      x: boardRect.width / 2 - point.x * viewport.scale,
      y: boardRect.height / 2 - point.y * viewport.scale
    };
  }

  function layoutFor(minimap, nodes) {
    return root.geometry.minimapLayout(root.nodes.bounds(nodes), minimapSize(minimap));
  }

  function minimapSize(minimap) {
    const fallback = { width: 180, height: 118 };
    if (!minimap) return fallback;
    const styles = global.getComputedStyle?.(minimap);
    const paddingX = Number.parseFloat(styles?.paddingLeft || "0") + Number.parseFloat(styles?.paddingRight || "0");
    const width = Math.min(180, Math.max(120, Math.floor(minimap.clientWidth - paddingX - 6) || fallback.width));
    return { width, height: Math.max(82, Math.round(width * 0.655)) };
  }

  root.minimap = {
    render,
    consumePointerDown,
    worldPointFromEvent,
    viewportFromEvent
  };
})(window, document);
