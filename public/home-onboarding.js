(function () {
  "use strict";

  const STORAGE_KEY = "imageStudio.homeOnboarding.v1";
  const REDUCED_MOTION_CLASS = "home-reduced-motion";
  let initialized = false;
  const PROMPTS = {
    product: "高端产品摄影，干净背景，柔和棚拍灯光，商业广告质感，突出材质细节",
    poster: "未来感活动海报，强烈视觉焦点，精致排版，适合社交媒体传播",
    portrait: "电影感人物角色设定，清晰轮廓，富有故事性的服装与环境光",
    illustration: "温柔细腻的插画场景，丰富层次，柔和笔触，适合封面视觉"
  };

  function hasSeenGuide() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "seen";
    } catch {
      return true;
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "seen");
    } catch {
      // localStorage can be blocked; the guide should still be dismissible.
    }
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function applyReducedMotionClass() {
    document.documentElement.classList.toggle(REDUCED_MOTION_CLASS, prefersReducedMotion());
  }

  function fillComposerPrompt(prompt) {
    const actions = window.ImageStudioAppActions;
    if (actions?.setDraftPrompt) {
      actions.setDraftPrompt(prompt, { focus: true });
      return;
    }
    const input = document.querySelector("#heroComposerMount .prompt-box");
    if (!input) return;
    input.value = prompt;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  function bindPromptDiscovery() {
    document.querySelectorAll("[data-home-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = PROMPTS[button.dataset.homePrompt] || "";
        if (prompt) fillComposerPrompt(prompt);
      });
    });
  }

  function openGuide() {
    const mount = document.querySelector("#homeView .hero");
    if (!mount || hasSeenGuide()) return;
    const card = document.createElement("aside");
    card.className = "home-onboarding-card";
    card.setAttribute("role", "status");
    card.innerHTML = `
      <div>
        <span>首次使用</span>
        <strong>三步开始创作</strong>
        <p>输入画面描述，按需添加参考图，点击生成。作品会自动保存，公开开关可在生成前调整。</p>
      </div>
      <button type="button" data-home-onboarding-close>我知道了</button>
    `;
    mount.append(card);
    card.querySelector("[data-home-onboarding-close]")?.addEventListener("click", () => {
      markSeen();
      card.remove();
    });
    window.setTimeout(() => {
      if (!card.isConnected) return;
      markSeen();
      card.remove();
    }, 9000);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    applyReducedMotionClass();
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", applyReducedMotionClass);
    bindPromptDiscovery();
    window.setTimeout(openGuide, 420);
  }

  window.ImageStudioHomeOnboarding = {
    init,
    fillComposerPrompt
  };
})();
