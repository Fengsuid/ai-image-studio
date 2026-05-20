(function initPromptCoverFallback(global) {
  "use strict";

  function hashText(value = "") {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function fallbackMeta(prompt = {}) {
    const source = `${prompt.title || ""}\n${prompt.prompt || ""}\n${prompt.sourceRepo || prompt.source || ""}`;
    const hash = hashText(source);
    const hue = hash % 360;
    const hue2 = (hue + 38 + (hash % 44)) % 360;
    const icon = /视频|video|shot|camera|film|cinematic/i.test(source)
      ? "ri-movie-2-line"
      : /UI|界面|app|web|dashboard|interface/i.test(source)
        ? "ri-layout-4-line"
        : /海报|poster|logo|brand|广告/i.test(source)
          ? "ri-advertisement-line"
          : /photo|摄影|portrait|人像/i.test(source)
            ? "ri-camera-lens-line"
            : "ri-image-edit-line";
    return {
      icon,
      background: `linear-gradient(135deg, hsl(${hue} 72% 24%), hsl(${hue2} 84% 46%))`,
      accent: `hsl(${(hue + 120) % 360} 86% 72%)`
    };
  }

  function render(prompt = {}, { escapeHtml, truncate } = {}) {
    const safe = typeof escapeHtml === "function" ? escapeHtml : (value = "") => String(value);
    const cut = typeof truncate === "function" ? truncate : (value = "", length = 80) => String(value).slice(0, length);
    const meta = fallbackMeta(prompt);
    const title = prompt.title || cut(prompt.prompt || "", 30);
    const excerpt = cut(prompt.prompt || "", 84);
    return `
      <div class="prompt-cover-fallback" style="--fallback-bg:${safe(meta.background)};--fallback-accent:${safe(meta.accent)}">
        <i class="${meta.icon}"></i>
        <strong>${safe(title)}</strong>
        <span>${safe(excerpt)}</span>
      </div>
    `;
  }

  global.ImageStudioPromptCoverFallback = { render, fallbackMeta };
})(window);
