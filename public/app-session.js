(function initAppSessionModule(global) {
  "use strict";

  const register = global.AppModules?.register || ((name, module) => {
    global.AppModules = global.AppModules || {};
    global.AppModules[name] = module;
    return module;
  });

  function renderImageSessions(options = {}) {
    return global.ImageStudioSessionList?.render?.(options) || "";
  }

  register("session", {
    renderImageSessions
  });
})(window);
