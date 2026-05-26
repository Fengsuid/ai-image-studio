(function initCanvasStore(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function normalizeProjectId(value) {
    return String(value || "").trim();
  }

  function createProjectState(input = {}) {
    return {
      id: normalizeProjectId(input.id),
      title: String(input.title || "").trim() || "Untitled canvas",
      nodes: Array.isArray(input.nodes) ? input.nodes : [],
      edges: Array.isArray(input.edges) ? input.edges : []
    };
  }

  root.store = {
    normalizeProjectId,
    createProjectState
  };
})(window);
