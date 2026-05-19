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

  function zoomAt(viewport, origin, nextScale) {
    const currentScale = clampScale(viewport.scale);
    const scale = clampScale(nextScale);
    const ratio = scale / currentScale;
    return {
      x: origin.x - (origin.x - Number(viewport.x || 0)) * ratio,
      y: origin.y - (origin.y - Number(viewport.y || 0)) * ratio,
      scale
    };
  }

  function fitBounds(bounds, size, padding = 80) {
    const width = Math.max(1, Number(bounds.width || 1));
    const height = Math.max(1, Number(bounds.height || 1));
    const availableWidth = Math.max(1, Number(size.width || 1) - padding * 2);
    const availableHeight = Math.max(1, Number(size.height || 1) - padding * 2);
    const scale = clampScale(Math.min(availableWidth / width, availableHeight / height), 0.2, 1.4);
    return {
      x: (Number(size.width || 0) - width * scale) / 2 - Number(bounds.x || 0) * scale,
      y: (Number(size.height || 0) - height * scale) / 2 - Number(bounds.y || 0) * scale,
      scale
    };
  }

  root.geometry = {
    clampScale,
    point,
    zoomAt,
    fitBounds
  };
})(window);
