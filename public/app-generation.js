(function initAppGenerationModule(global) {
  "use strict";

  const register = global.AppModules?.register || ((name, module) => {
    global.AppModules = global.AppModules || {};
    global.AppModules[name] = module;
    return module;
  });

  function renderResultActions(options = {}) {
    return global.ImageStudioGenerationResultActions?.render?.(options) || "";
  }

  register("generation", {
    renderResultActions
  });
})(window);
