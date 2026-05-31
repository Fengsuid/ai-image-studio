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

  function assetIds(references = [], { limit = SERVER_MAX_ITEMS } = {}) {
    return references
      .map((reference) => reference?.assetId || reference?.referenceAssetId || reference?.asset?.id || "")
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .slice(0, normalizeLimit(limit));
  }

  function assetsFromReferences(references = []) {
    return references
      .map((reference, index) => {
        const asset = reference?.asset || {};
        const id = reference?.assetId || reference?.referenceAssetId || asset.id || "";
        const url = asset.url || reference?.url || "";
        return id || url ? { ...asset, id, url, thumbUrl: asset.thumbUrl || url, sortOrder: index } : null;
      })
      .filter(Boolean);
  }

  function renderAssetStrip(assets = [], options = {}) {
    const escapeHtml = options.escapeHtml || ((value) => String(value || ""));
    const label = options.label || "Reference";
    const className = options.className || "reference-assets-strip";
    const maxItems = normalizeLimit(options.maxItems || DEFAULT_MAX_ITEMS);
    const fallbackContainerAttrs = typeof options.imageFallbackContainerAttrs === "function" ? options.imageFallbackContainerAttrs : () => "";
    const fallbackImgAttrs = typeof options.imageFallbackImgAttrs === "function" ? options.imageFallbackImgAttrs : () => "";
    const visible = (assets || []).filter((asset) => asset?.url || asset?.thumbUrl).slice(0, maxItems);
    if (!visible.length) return "";
    return `
      <div class="${className}" aria-label="${escapeHtml(label)}">
        ${visible.map((asset, index) => `
          <a href="${escapeHtml(asset.url || asset.thumbUrl)}" target="_blank" rel="noreferrer" ${fallbackContainerAttrs()} title="${escapeHtml(asset.filename || label)}">
            <img src="${escapeHtml(asset.thumbUrl || asset.url)}" ${fallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(`${label} ${index + 1}`)}">
            <span>${index + 1}</span>
          </a>
        `).join("")}
      </div>
    `;
  }

  async function persistAssets(references = [], api, { visibility = "private" } = {}) {
    if (typeof api !== "function") return references;
    return Promise.all(references.map(async (reference) => {
      if (reference?.assetId || !String(reference?.imageData || "").startsWith("data:image/")) return reference;
      const data = await api("/api/reference-assets", {
        method: "POST",
        body: JSON.stringify({
          name: reference.name || "reference-image",
          filename: reference.name || "reference-image",
          imageData: reference.imageData,
          role: "reference",
          visibility
        })
      });
      const asset = data?.asset || {};
      return asset.id ? { ...reference, asset, assetId: asset.id, referenceAssetId: asset.id, url: asset.url || reference.url } : reference;
    }));
  }

  window.ImageStudioReferenceImages = {
    maxItems: DEFAULT_MAX_ITEMS,
    serverMaxItems: SERVER_MAX_ITEMS,
    normalizeLimit,
    blobToDataUrl,
    filesToReferences,
    revokeReferences,
    payload,
    assetIds,
    assetsFromReferences,
    renderAssetStrip,
    persistAssets
  };
})();
