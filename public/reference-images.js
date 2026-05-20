(function () {
  const MAX_ITEMS = 4;

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function fileToReference(file) {
    const imageData = await blobToDataUrl(file);
    return {
      file,
      name: file?.name || "reference-image",
      url: URL.createObjectURL(file),
      imageData
    };
  }

  async function filesToReferences(files, { limit = MAX_ITEMS } = {}) {
    const selected = [...(files || [])].filter(Boolean).slice(0, Math.max(1, limit));
    return Promise.all(selected.map(fileToReference));
  }

  function revokeReferences(references = []) {
    references.forEach((reference) => {
      if (/^blob:/i.test(reference?.url || "")) {
        URL.revokeObjectURL(reference.url);
      }
    });
  }

  function payload(references = [], { limit = MAX_ITEMS } = {}) {
    return references
      .map((reference) => ({
        name: reference?.name || "reference-image",
        imageData: String(reference?.imageData || "").trim()
      }))
      .filter((reference) => reference.imageData.startsWith("data:image/"))
      .slice(0, Math.max(1, limit));
  }

  window.ImageStudioReferenceImages = {
    maxItems: MAX_ITEMS,
    blobToDataUrl,
    filesToReferences,
    revokeReferences,
    payload
  };
})();
