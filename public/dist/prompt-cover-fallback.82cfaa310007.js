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
      hue,
      hue2,
      icon,
      background: `linear-gradient(135deg, hsl(${hue} 72% 24%), hsl(${hue2} 84% 46%))`,
      accent: `hsl(${(hue + 120) % 360} 86% 72%)`
    };
  }

  function escapeSvg(value = "") {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function textLines(value = "", maxChars = 22, maxLines = 3) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    if (!/\s/.test(text)) {
      return Array.from({ length: Math.min(maxLines, Math.ceil(text.length / maxChars)) }, (_, index) => (
        text.slice(index * maxChars, (index + 1) * maxChars)
      )).filter(Boolean);
    }
    const lines = [];
    let current = "";
    for (const word of text.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
      if (lines.length >= maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    return lines;
  }

  function dataUrl(prompt = {}, { truncate } = {}) {
    const cut = typeof truncate === "function" ? truncate : (value = "", length = 80) => String(value).slice(0, length);
    const meta = fallbackMeta(prompt);
    const title = prompt.title || cut(prompt.prompt || "", 36) || "Prompt";
    const excerpt = cut(prompt.prompt || title, 110);
    const titleSvg = textLines(title, 24, 3).map((line, index) => (
      `<tspan x="92" dy="${index === 0 ? 0 : 54}">${escapeSvg(line)}</tspan>`
    )).join("");
    const excerptSvg = textLines(excerpt, 38, 3).map((line, index) => (
      `<tspan x="92" dy="${index === 0 ? 0 : 31}">${escapeSvg(line)}</tspan>`
    )).join("");
    const label = /video|视频|film|movie|trailer/i.test(`${title} ${excerpt}`) ? "VIDEO"
      : /ui|web|app|界面|dashboard/i.test(`${title} ${excerpt}`) ? "UI"
        : /photo|摄影|portrait|人像/i.test(`${title} ${excerpt}`) ? "PHOTO"
          : "PROMPT";
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="hsl(${meta.hue} 72% 24%)"/>
            <stop offset="1" stop-color="hsl(${meta.hue2} 84% 46%)"/>
          </linearGradient>
          <radialGradient id="glow" cx="72%" cy="16%" r="60%">
            <stop offset="0" stop-color="hsl(${(meta.hue + 120) % 360} 92% 76%)" stop-opacity=".78"/>
            <stop offset=".52" stop-color="hsl(${(meta.hue + 72) % 360} 88% 58%)" stop-opacity=".28"/>
            <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
          </radialGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#020617" flood-opacity=".28"/>
          </filter>
        </defs>
        <rect width="960" height="960" fill="url(#bg)"/>
        <rect width="960" height="960" fill="url(#glow)"/>
        <circle cx="778" cy="96" r="210" fill="#fff" opacity=".09"/>
        <circle cx="820" cy="138" r="118" fill="#fff" opacity=".12"/>
        <path d="M0 704 C180 606 330 698 504 628 C690 553 770 390 960 450 L960 960 L0 960 Z" fill="#020617" opacity=".22"/>
        <path d="M88 102 L872 102 L872 858 L88 858 Z" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>
        <g filter="url(#shadow)">
          <rect x="92" y="92" width="176" height="72" rx="36" fill="#fff" fill-opacity=".18"/>
          <text x="180" y="139" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="26" font-weight="800" letter-spacing="4">${label}</text>
        </g>
        <text x="92" y="544" fill="#fff" font-family="Georgia, serif" font-size="48" font-weight="700">${titleSvg}</text>
        <text x="92" y="738" fill="#fff" fill-opacity=".72" font-family="Arial, sans-serif" font-size="26" font-weight="600">${excerptSvg}</text>
      </svg>
    `.replace(/\s{2,}/g, " ").trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function render(prompt = {}, { escapeHtml, truncate } = {}) {
    const safe = typeof escapeHtml === "function" ? escapeHtml : (value = "") => String(value);
    const cut = typeof truncate === "function" ? truncate : (value = "", length = 80) => String(value).slice(0, length);
    const title = prompt.title || cut(prompt.prompt || "", 30);
    return `<img class="prompt-cover-fallback-image" src="${safe(dataUrl(prompt, { truncate: cut }))}" loading="lazy" decoding="async" alt="${safe(title)}">`;
  }

  global.ImageStudioPromptCoverFallback = { render, fallbackMeta, dataUrl };
})(window);
