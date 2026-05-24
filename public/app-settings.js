(function initAppSettings(global) {
  "use strict";

  const modules = global.AppModules || (global.AppModules = {});
  if (typeof modules.register === "function") {
    modules.register("settings", {
      bridge: true
    });
  }
})(window);
