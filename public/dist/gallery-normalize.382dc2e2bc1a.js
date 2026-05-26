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
      creativeRoute: generation.creativeRoute || fallback.creativeRoute || [],
      conversation: generation.creativeRoute || generation.conversation || fallback.creativeRoute || fallback.conversation || [],
      canvasProject: generation.canvasProject || fallback.canvasProject || null,
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

  function routeStepFromEntry(entry = {}) {
    return {
      id: entry.id,
      prompt: entry.prompt,
      imageUrl: entry.images?.[0] || entry.imageUrl || "",
      type: entry.type || (entry.sourceImageUrl || entry.sourceImageData || entry.sourceImageId || entry.sourceFilename ? "image-to-image" : "text-to-image"),
      createdAt: entry.time || entry.createdAt
    };
  }

  function isRouteEntryImageToImage(entry = {}) {
    return Boolean(
      entry.type === "image-to-image" ||
      entry.sourceImageUrl ||
      entry.sourceImageData ||
      entry.sourceImageId ||
      entry.sourceFilename
    );
  }

  function isCanvasCreativeRoute(route = []) {
    return route.some((entry) => entry?.nodeId || String(entry?.type || "").startsWith("canvas"));
  }

  function routeEntryMatchesItem(entry = {}, item = {}) {
    return String(entry.id || "") === String(item.id || "") ||
      String(entry.generationId || "") === String(item.id || "");
  }

  function cropContinuousCreativeRoute(route = [], item = {}) {
    const entries = Array.isArray(route) ? route.filter(Boolean) : [];
    if (!entries.length) return [routeStepFromEntry(item)];
    let targetIndex = entries.findIndex((entry) => routeEntryMatchesItem(entry, item));
    if (targetIndex < 0 && routeEntryMatchesItem(entries[entries.length - 1], item)) {
      targetIndex = entries.length - 1;
    }
    if (targetIndex < 0) {
      targetIndex = isRouteEntryImageToImage(item) ? entries.length - 1 : -1;
    }
    if (targetIndex < 0) return [routeStepFromEntry(item)];

    const target = entries[targetIndex];
    if (!isRouteEntryImageToImage(target)) return [routeStepFromEntry(target)];

    const cropped = [];
    for (let index = targetIndex; index >= 0; index -= 1) {
      const entry = entries[index];
      cropped.unshift(entry);
      if (index !== targetIndex && !isRouteEntryImageToImage(entry)) break;
    }
    return cropped.length ? cropped.map(routeStepFromEntry) : [routeStepFromEntry(item)];
  }

  function sessionEntriesForItem({ item = {}, history = [], imageSessions = [], activeImageSessionId = "" } = {}) {
    const historyById = new Map(history.map((entry) => [String(entry.id), entry]));
    const sessions = imageSessions.filter((session) =>
      (session.generationIds || []).some((id) => String(id) === String(item.id))
    );
    const active = sessions.find((session) => session.id === activeImageSessionId);
    const session = active || sessions[0];
    return (session?.generationIds || [])
      .map((id) => historyById.get(String(id)))
      .filter(Boolean);
  }

  function continuousSessionEntriesForItem(context = {}) {
    const item = context.item || {};
    const sessionEntries = sessionEntriesForItem(context);
    const targetIndex = sessionEntries.findIndex((entry) => String(entry.id) === String(item.id));
    if (targetIndex < 0) return [];
    const sliced = sessionEntries.slice(0, targetIndex + 1);
    const route = cropContinuousCreativeRoute(sliced, item);
    return Array.isArray(route) ? route : [];
  }

  function publishConversationRouteForItem(context = {}) {
    const item = context.item || {};
    const sessionRoute = continuousSessionEntriesForItem(context);
    if (sessionRoute.length) {
      return sessionRoute;
    }
    const storedRoute = item.creativeRoute?.length ? item.creativeRoute : item.conversation;
    if (Array.isArray(storedRoute) && storedRoute.length) {
      return isCanvasCreativeRoute(storedRoute) ? storedRoute : cropContinuousCreativeRoute(storedRoute, item);
    }
    return [routeStepFromEntry(item)];
  }

  root.promptImageDisplayUrl = promptImageDisplayUrl;
  root.generationEntryFromApi = generationEntryFromApi;
  root.imageListFromItem = imageListFromItem;
  root.publishConversationRouteForItem = publishConversationRouteForItem;
  window.ImageStudioGalleryModel = root;
})();
