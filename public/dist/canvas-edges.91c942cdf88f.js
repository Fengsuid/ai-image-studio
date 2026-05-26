(function initCanvasEdges(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const SVG_PADDING = 260;
  const FALLBACK_SIZE = { width: 220, height: 132 };

  function nodeSize(node) {
    return root.nodes?.size?.(node) || FALLBACK_SIZE;
  }

  function nodeCenter(node) {
    const size = nodeSize(node);
    return {
      x: Number(node.x || 0) + size.width / 2,
      y: Number(node.y || 0) + size.height / 2
    };
  }

  function edgeEndpoints(source, target) {
    const sourceSize = nodeSize(source);
    const targetSize = nodeSize(target);
    const sourceCenter = nodeCenter(source);
    const targetCenter = nodeCenter(target);
    const forward = sourceCenter.x <= targetCenter.x;
    return {
      source: {
        x: Number(source.x || 0) + (forward ? sourceSize.width : 0),
        y: sourceCenter.y,
        side: forward ? "right" : "left"
      },
      target: {
        x: Number(target.x || 0) + (forward ? 0 : targetSize.width),
        y: targetCenter.y,
        side: forward ? "left" : "right"
      }
    };
  }

  function edgePath(source, target) {
    const points = edgeEndpoints(source, target);
    const direction = points.source.side === "right" ? 1 : -1;
    const distance = Math.abs(points.target.x - points.source.x);
    const handle = Math.max(72, distance / 2);
    return {
      points,
      d: [
        `M ${round(points.source.x)} ${round(points.source.y)}`,
        `C ${round(points.source.x + handle * direction)} ${round(points.source.y)},`,
        `${round(points.target.x - handle * direction)} ${round(points.target.y)},`,
        `${round(points.target.x)} ${round(points.target.y)}`
      ].join(" ")
    };
  }

  function svgBounds(nodes = []) {
    const bounds = root.nodes?.bounds?.(nodes) || { x: 0, y: 0, width: 1, height: 1 };
    return {
      x: Number(bounds.x || 0) - SVG_PADDING,
      y: Number(bounds.y || 0) - SVG_PADDING,
      width: Math.max(1, Number(bounds.width || 1) + SVG_PADDING * 2),
      height: Math.max(1, Number(bounds.height || 1) + SVG_PADDING * 2)
    };
  }

  function render({ nodes = [], edges = [], selectedNodeIds = [] } = {}) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const selected = new Set(selectedNodeIds);
    const lines = edges.map((edge) => {
      const source = byId.get(edge.sourceId);
      const target = byId.get(edge.targetId);
      if (!source || !target) return "";
      const active = selected.has(source.id) || selected.has(target.id) ? " active" : "";
      return `<path class="canvas-edge${active}" data-edge-id="${escapeAttr(edge.id)}" d="${edgePath(source, target).d}" />`;
    }).join("");
    const view = svgBounds(nodes);
    return `<svg class="canvas-edges" width="${round(view.width)}" height="${round(view.height)}" viewBox="${round(view.x)} ${round(view.y)} ${round(view.width)} ${round(view.height)}" style="left:${round(view.x)}px;top:${round(view.y)}px;width:${round(view.width)}px;height:${round(view.height)}px">${lines}</svg>`;
  }

  function round(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function escapeAttr(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  root.edges = {
    edgeEndpoints,
    edgePath,
    render,
    svgBounds
  };
})(window);
