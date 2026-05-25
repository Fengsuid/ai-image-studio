(function initCanvasLayout(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function boardSize(board) {
    const rect = board?.getBoundingClientRect?.();
    const width = Number(rect?.width || board?.clientWidth || 0);
    const height = Number(rect?.height || board?.clientHeight || 0);
    if (!width || !height) return null;
    return { width, height };
  }

  function fitNodesInBoard(board, nodes = [], options = {}) {
    if (!board || !nodes.length || !root.nodes?.bounds || !root.geometry?.fitBounds) return null;
    const size = boardSize(board);
    if (!size) return null;
    const padding = Number(options.padding || 96);
    const maxScale = Number(options.maxScale || 1);
    const viewport = root.geometry.fitBounds(root.nodes.bounds(nodes), size, padding);
    return {
      ...viewport,
      scale: Math.min(maxScale, viewport.scale)
    };
  }

  root.layout = {
    fitNodesInBoard
  };
})(window);
