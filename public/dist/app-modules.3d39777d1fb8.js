(function initAppModules(global) {
  "use strict";

  const modules = global.AppModules || {};

  function register(name, module) {
    if (!name || !module) return modules[name];
    modules[name] = Object.freeze({ ...(modules[name] || {}), ...module });
    return modules[name];
  }

  global.AppModules = modules;
  global.AppModules.register = register;
})(window);
