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

  root.nodes = {
    createNode
  };
})(window);
