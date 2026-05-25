(function initAppGalleryModule(global) {
  "use strict";

  const register = global.AppModules?.register || ((name, module) => {
    global.AppModules = global.AppModules || {};
    global.AppModules[name] = module;
    return module;
  });

  function createDetailMedia(options = {}) {
    return global.ImageStudioGalleryDetailMedia?.create?.(options) || null;
  }

  function createTagViewModel(options = {}) {
    return global.ImageStudioGalleryTagViewModel?.create?.(options) || null;
  }

  function renderLeaderboard(options = {}) {
    return global.ImageStudioGalleryLeaderboard?.render?.(options) || "";
  }

  register("gallery", {
    createDetailMedia,
    createTagViewModel,
    renderLeaderboard
  });
})(window);
