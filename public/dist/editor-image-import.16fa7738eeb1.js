(function initEditorImageImport(global) {
  "use strict";

  function imageFiles(list) {
    return [...(list || [])].filter((file) => /^image\//i.test(file?.type || ""));
  }

  function bindDropZone(target, { onFiles, activeClass = "drag-active" } = {}) {
    if (!target || typeof onFiles !== "function") return;
    const leave = () => target.classList.remove(activeClass);
    target.addEventListener("dragover", (event) => {
      const files = imageFiles(event.dataTransfer?.items || event.dataTransfer?.files);
      if (!files.length && event.dataTransfer?.types && ![...event.dataTransfer.types].includes("Files")) return;
      event.preventDefault();
      target.classList.add(activeClass);
    });
    target.addEventListener("dragleave", leave);
    target.addEventListener("drop", (event) => {
      const files = imageFiles(event.dataTransfer?.files);
      if (!files.length) return;
      event.preventDefault();
      leave();
      onFiles(files);
    });
  }

  function bindPaste(target, { onFiles } = {}) {
    if (!target || typeof onFiles !== "function") return;
    target.addEventListener("paste", (event) => {
      const files = imageFiles(event.clipboardData?.files);
      if (!files.length) return;
      event.preventDefault();
      onFiles(files);
    });
  }

  function bindEditor({ root, dropTargets = [], onFiles } = {}) {
    bindPaste(root || document, { onFiles });
    dropTargets.filter(Boolean).forEach((target) => bindDropZone(target, { onFiles }));
  }

  global.ImageStudioEditorImageImport = { bindEditor, imageFiles };
})(window);
