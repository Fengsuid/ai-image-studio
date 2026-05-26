(function initCanvasSelection(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 132;
  const GROUP_PADDING = 28;

  function unique(ids = []) {
    return [...new Set(ids.map((id) => String(id || "")).filter(Boolean))];
  }

  function normalize(ids = [], nodes = []) {
    const valid = new Set(nodes.map((node) => node.id));
    return unique(ids).filter((id) => valid.has(id));
  }

  function replace(id, nodes = []) {
    return normalize([id], nodes);
  }

  function toggle(ids = [], id, nodes = []) {
    const current = new Set(normalize(ids, nodes));
    if (current.has(id)) current.delete(id);
    else current.add(id);
    return normalize([...current], nodes);
  }

  function rectFromDrag(start = {}, end = {}) {
    const x1 = Number(start.x || 0);
    const y1 = Number(start.y || 0);
    const x2 = Number(end.x || 0);
    const y2 = Number(end.y || 0);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  function intersects(a, b) {
    return a.x <= b.x + b.width
      && a.x + a.width >= b.x
      && a.y <= b.y + b.height
      && a.y + a.height >= b.y;
  }

  function nodeRect(node = {}) {
    return {
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      width: Number(node.width || node.data?.width || NODE_WIDTH),
      height: Number(node.height || node.data?.height || NODE_HEIGHT)
    };
  }

  function nodesInRect(nodes = [], rect = {}) {
    return nodes.filter((node) => intersects(nodeRect(node), rect)).map((node) => node.id);
  }

  function moveNodes(nodes = [], ids = [], starts = [], delta = { x: 0, y: 0 }) {
    const selected = new Set(ids);
    const startById = new Map(starts.map((item) => [item.id, item]));
    return nodes.map((node) => {
      if (!selected.has(node.id) || node.locked) return node;
      const start = startById.get(node.id) || node;
      return {
        ...node,
        x: Math.round(Number(start.x || 0) + Number(delta.x || 0)),
        y: Math.round(Number(start.y || 0) + Number(delta.y || 0))
      };
    });
  }

  function deleteSelection(nodes = [], edges = [], ids = []) {
    const selected = new Set(ids);
    return {
      nodes: nodes.filter((node) => !selected.has(node.id)),
      edges: edges.filter((edge) => !selected.has(edge.sourceId) && !selected.has(edge.targetId))
    };
  }

  function groupFromNodes(nodes = [], ids = [], createNode) {
    const selected = nodes.filter((node) => ids.includes(node.id) && node.type !== "group");
    if (selected.length < 2 || typeof createNode !== "function") return null;
    const rects = selected.map(nodeRect);
    const minX = Math.min(...rects.map((rect) => rect.x));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
    return createNode({
      type: "group",
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - 34,
      data: {
        title: `Group ${selected.length}`,
        body: `${selected.length} nodes`,
        memberIds: selected.map((node) => node.id),
        collapsed: false,
        width: maxX - minX + GROUP_PADDING * 2,
        height: maxY - minY + GROUP_PADDING * 2 + 34
      }
    });
  }

  root.selection = {
    deleteSelection,
    groupFromNodes,
    moveNodes,
    nodeRect,
    normalize,
    nodesInRect,
    rectFromDrag,
    replace,
    toggle
  };
})(window);
