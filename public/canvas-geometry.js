(function initCanvasGeometry(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function clampScale(value, min = 0.2, max = 3) {
    const scale = Number(value);
    if (!Number.isFinite(scale)) return 1;
    return Math.max(min, Math.min(max, scale));
  }

  function point(x = 0, y = 0) {
    return { x: Number(x) || 0, y: Number(y) || 0 };
  }

  root.geometry = {
    clampScale,
    point
  };
})(window);
