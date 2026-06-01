(function initAppMotion(global) {
  "use strict";

  const SELECTOR = ".recent-tile, .prompt-card, .gallery-rank-card, .message-card";
  const register = global.AppModules?.register || ((name, module) => {
    global.AppModules = global.AppModules || {};
    global.AppModules[name] = module;
    return module;
  });
  const reduceMotion = () => global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let observer = null;

  function setPointerVars(event) {
    event.currentTarget.style.setProperty("--mx", `${event.offsetX}px`);
    event.currentTarget.style.setProperty("--my", `${event.offsetY}px`);
  }

  function observe(root = document) {
    const cards = [...root.querySelectorAll(SELECTOR)].filter((card) => card.dataset.motionReady !== "1");
    if (!cards.length) return;
    cards.forEach((card, index) => {
      card.dataset.motionReady = "1";
      card.style.setProperty("--motion-stagger", String(index % 8));
      if (!reduceMotion()) card.addEventListener("pointermove", setPointerVars);
      card.classList.add("motion-reveal");
    });
    if (reduceMotion() || !("IntersectionObserver" in global)) {
      cards.forEach((card) => card.classList.add("is-visible"));
      return;
    }
    observer ||= new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "80px 0px", threshold: 0.08 });
    cards.forEach((card) => observer.observe(card));
  }

  register("motion", { observe });
})(window);
