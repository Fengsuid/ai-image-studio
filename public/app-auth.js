(function initAppAuth(global) {
  "use strict";

  const modules = global.AppModules || (global.AppModules = {});
  if (typeof modules.register === "function") {
    modules.register("auth", {
      bridge: true
    });
  }
})(window);
