(function () {
  const DEFAULT_MAX_ITEMS = 4;
  const SERVER_MAX_ITEMS = 15;

  function normalizeLimit(limit = DEFAULT_MAX_ITEMS) {
    const parsed = Number.parseInt(limit, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_ITEMS;
    return Math.min(parsed, SERVER_MAX_ITEMS);
  }

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

  async function filesToReferences(files, { limit = DEFAULT_MAX_ITEMS } = {}) {
    const selected = [...(files || [])].filter(Boolean).slice(0, normalizeLimit(limit));
    return Promise.all(selected.map(fileToReference));
  }

  function revokeReferences(references = []) {
    references.forEach((reference) => {
      if (/^blob:/i.test(reference?.url || "")) {
        URL.revokeObjectURL(reference.url);
      }
    });
  }

  function payload(references = [], { limit = DEFAULT_MAX_ITEMS } = {}) {
    return references
      .map((reference) => ({
        name: reference?.name || "reference-image",
        imageData: String(reference?.imageData || "").trim()
      }))
      .filter((reference) => reference.imageData.startsWith("data:image/"))
      .slice(0, normalizeLimit(limit));
  }

  window.ImageStudioReferenceImages = {
    maxItems: DEFAULT_MAX_ITEMS,
    serverMaxItems: SERVER_MAX_ITEMS,
    normalizeLimit,
    blobToDataUrl,
    filesToReferences,
    revokeReferences,
    payload
  };
})();
