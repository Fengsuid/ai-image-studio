(function initCanvasWorkflows(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function emptyWorkflow() {
    return {
      nodes: [],
      edges: []
    };
  }

  root.workflows = {
    emptyWorkflow
  };
})(window);
