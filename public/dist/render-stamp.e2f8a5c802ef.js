(function initRenderStamp(global) {
  "use strict";

  function imageSessionStamp({ lang = "zh", activeSessionId = "", sessions = [], history = [] } = {}) {
    return JSON.stringify({
      lang,
      active: activeSessionId,
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        generationIds: session.generationIds || []
      })),
      history: history.map((item) => ({
        id: item.id,
        status: item.status,
        prompt: item.prompt,
        image: item.images?.[0] || "",
        requestId: item.requestId || ""
      }))
    });
  }

  function historyStamp({ lang = "zh", activeSessionId = "", items = [] } = {}) {
    return JSON.stringify({
      lang,
      active: activeSessionId,
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        prompt: item.prompt,
        images: item.images || [],
        requestId: item.requestId || "",
        queuePosition: item.queuePosition ?? null,
        queueTotal: item.queueTotal ?? null,
        isPublic: Boolean(item.isPublic),
        publicTags: item.publicTags || [],
        error: item.error || ""
      }))
    });
  }

  global.ImageStudioRenderStamp = { imageSessionStamp, historyStamp };
})(window);
