(function initCanvasIo(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function createFileInput() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.className = "canvas-import-input";
    input.hidden = true;
    return input;
  }

  async function exportCanvas({ projectId = "", title = "", request } = {}) {
    if (!projectId || projectId === "new" || typeof request !== "function") {
      throw new Error("Save this canvas before exporting.");
    }
    const payload = await request(`/api/canvases/${encodeURIComponent(projectId)}/export`);
    downloadJson(payload, `${safeFileName(title || projectId)}.canvas.json`);
    return payload;
  }

  async function importCanvas({ projectId = "", request, onImported } = {}) {
    if (!projectId || projectId === "new" || typeof request !== "function") {
      throw new Error("Save this canvas before importing.");
    }
    const file = await pickJsonFile();
    const text = await file.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON file.");
    }
    const result = await request(`/api/canvases/${encodeURIComponent(projectId)}/import`, {
      method: "POST",
      body: JSON.stringify(json)
    });
    onImported?.(result);
    return result;
  }

  function pickJsonFile() {
    return new Promise((resolve, reject) => {
      const input = createFileInput();
      input.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        input.remove();
        if (!file) reject(new Error("No JSON file selected."));
        else resolve(file);
      }, { once: true });
      document.body.appendChild(input);
      input.click();
    });
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function safeFileName(value) {
    return String(value || "canvas")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "canvas";
  }

  root.io = {
    exportCanvas,
    importCanvas,
    safeFileName
  };
})(window, document);
