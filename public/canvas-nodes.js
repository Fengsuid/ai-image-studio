(function initCanvasNodes(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function createNode(input = {}) {
    return {
      id: String(input.id || "").trim(),
      type: String(input.type || "prompt"),
      x: Number(input.x || 0),
      y: Number(input.y || 0),
      data: input.data && typeof input.data === "object" ? input.data : {}
    };
  }

  function demoNodes() {
    return [
      createNode({ id: "prompt", type: "prompt", x: 0, y: 0, data: { title: "Prompt", body: "A cinematic product photo" } }),
      createNode({ id: "image", type: "image", x: 320, y: 120, data: { title: "Reference", body: "Input image" } }),
      createNode({ id: "output", type: "output", x: 680, y: 20, data: { title: "Output", body: "Generated result" } })
    ];
  }

  function bounds(nodes = []) {
    if (!nodes.length) return { x: 0, y: 0, width: 1, height: 1 };
    const width = 220;
    const height = 112;
    const minX = Math.min(...nodes.map((node) => Number(node.x || 0)));
    const minY = Math.min(...nodes.map((node) => Number(node.y || 0)));
    const maxX = Math.max(...nodes.map((node) => Number(node.x || 0) + width));
    const maxY = Math.max(...nodes.map((node) => Number(node.y || 0) + height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  root.nodes = {
    createNode,
    demoNodes,
    bounds
  };
})(window);
