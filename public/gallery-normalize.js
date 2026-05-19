(function () {
  const root = window.ImageStudioGalleryModel || {};

  function firstText(...values) {
    for (const value of values) {
      const text = String(value || "").trim();
      if (text) return text;
    }
    return "";
  }

  function isInlineImageUrl(url = "") {
    return /^(data:|blob:)/i.test(String(url || ""));
  }

  function promptImageDisplayUrl(prompt = {}) {
    const raw = firstText(prompt.coverUrl, prompt.preview, prompt.image, prompt.imageUrl);
    if (!raw) return "";
    const promptId = firstText(prompt.promptId, prompt.id);
    const shouldProxy = prompt.kind !== "square"
      && /^\d+$/.test(promptId)
      && !isInlineImageUrl(raw)
      && !String(raw).startsWith("/api/prompt-images/");
    return shouldProxy ? `/api/prompt-images/${encodeURIComponent(promptId)}/file` : raw;
  }

  function imageListFromItem(item = {}, fallback = {}) {
    const existing = Array.isArray(item.images) ? item.images : [];
    const fallbackImages = Array.isArray(fallback.images) ? fallback.images : [];
    const primary = firstText(item.imageUrl, item.coverUrl, item.preview, item.image, existing[0], fallback.imageUrl, fallbackImages[0]);
    return primary ? [primary, ...existing.filter((url) => url && url !== primary)] : fallbackImages;
  }

  function generationEntryFromApi(generation = {}, fallback = {}, options = {}) {
    const currentUser = options.currentUser || {};
    return {
      ...fallback,
      id: generation.id || fallback.id,
      kind: generation.kind || fallback.kind || "",
      promptId: generation.promptId || fallback.promptId || "",
      title: generation.title || fallback.title || "",
      prompt: generation.prompt || fallback.prompt || "",
      images: imageListFromItem(generation, fallback),
      sourceImageUrl: generation.sourceImageUrl || fallback.sourceImageUrl || "",
      sourceImageId: generation.sourceImageId || fallback.sourceImageId || "",
      sourcePrompt: generation.sourcePrompt || fallback.sourcePrompt || "",
      originGalleryId: generation.originGalleryId || fallback.originGalleryId || "",
      publishOriginal: Boolean(generation.publishOriginal ?? fallback.publishOriginal),
      conversation: generation.conversation || fallback.conversation || [],
      publicTags: generation.publicTags || fallback.publicTags || [],
      userId: generation.userId || fallback.userId || currentUser.id || "",
      userName: generation.userName || fallback.userName || currentUser.name || "",
      status: fallback.status || "done",
      time: generation.createdAt || fallback.time,
      elapsedMs: Number(generation.durationMs || 0) || fallback.elapsedMs || null,
      model: generation.model || fallback.model,
      isPublic: Boolean(generation.isPublic ?? fallback.isPublic),
      archived: Boolean(generation.archived ?? fallback.archived),
      publishedAt: generation.publishedAt || fallback.publishedAt || "",
      publicRewardStatus: generation.publicRewardStatus || fallback.publicRewardStatus || "none",
      publicRewardAmount: Number(generation.publicRewardAmount || fallback.publicRewardAmount || 0),
      likeCount: Number(generation.likeCount || fallback.likeCount || 0),
      likedByCurrentUser: Boolean(generation.likedByCurrentUser ?? fallback.likedByCurrentUser),
      withdrawalStatus: generation.withdrawalStatus || fallback.withdrawalStatus || "none",
      withdrawalRequestedAt: generation.withdrawalRequestedAt || fallback.withdrawalRequestedAt || "",
      options: fallback.options || {
        size: generation.size,
        quality: generation.quality,
        background: generation.background,
        outputFormat: generation.outputFormat
      }
    };
  }

  root.promptImageDisplayUrl = promptImageDisplayUrl;
  root.generationEntryFromApi = generationEntryFromApi;
  root.imageListFromItem = imageListFromItem;
  window.ImageStudioGalleryModel = root;
})();
