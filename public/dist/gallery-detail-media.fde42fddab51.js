(function initGalleryDetailMedia(global) {
  "use strict";

  function truncate(value, length = 64) {
    const text = String(value || "").trim();
    return text.length > length ? `${text.slice(0, length)}...` : text;
  }

  function baseMedia({ item, imageUrl, text }) {
    return {
      type: "result",
      key: "result",
      label: text("outputImage"),
      title: text("outputImage"),
      imageUrl,
      prompt: item.prompt || "",
      downloadName: `${item.id || "image"}.png`,
      generationId: item.id || item.generationId || "",
      sourceImage: item.sourceImageId || item.sourceImageUrl || ""
    };
  }

  function sourceMedia({ item, text }) {
    if (!item.sourceImageUrl) return null;
    return {
      type: "source",
      key: "source",
      label: text("inputImage"),
      title: text("inputImage"),
      imageUrl: item.sourceImageUrl,
      prompt: item.sourcePrompt || item.prompt || "",
      downloadName: `${item.id || "image"}-source.png`,
      generationId: item.id || item.generationId || "",
      sourceImage: item.sourceImageId || item.sourceImageUrl || ""
    };
  }

  function routeMedia({ item, imageUrl, route, index, text }) {
    const step = route[index];
    if (!step) return null;
    const label = step.label || `${text("routeStepUntitled").replace(/[()]/g, "") || "Step"} ${index + 1}`;
    return {
      type: "route-step",
      key: `route:${index}`,
      label,
      title: label,
      imageUrl: step.imageUrl || imageUrl,
      prompt: step.prompt || item.prompt || "",
      downloadName: `${item.id || "image"}-route-${index + 1}.png`,
      generationId: step.generationId || item.id || item.generationId || "",
      sourceImage: step.sourceImageUrl || item.sourceImageId || item.sourceImageUrl || ""
    };
  }

  function create({ item = {}, imageUrl = "", route = [], text }) {
    const options = { item, imageUrl, route, text };
    let selected = baseMedia(options);

    const api = {
      selected: () => selected,
      select(type, index = 0) {
        const next = type === "source"
          ? sourceMedia(options)
          : type === "route-step"
            ? routeMedia({ ...options, index })
            : baseMedia(options);
        if (next?.imageUrl) selected = next;
        return selected;
      },
      payload(title) {
        return {
          ...item,
          id: selected.generationId || item.id || item.generationId || "",
          imageUrl: selected.imageUrl,
          images: [selected.imageUrl],
          prompt: selected.prompt || item.prompt || "",
          sourceImageUrl: selected.sourceImage,
          selectedMediaType: selected.type,
          selectedMediaKey: selected.key,
          selectedMediaLabel: selected.label,
          title: title || selected.title || truncate(selected.prompt)
        };
      },
      sourceMedia: () => sourceMedia(options),
      resultMedia: () => baseMedia(options),
      routeMedia: (index) => routeMedia({ ...options, index })
    };
    return api;
  }

  global.ImageStudioGalleryDetailMedia = { create };
})(window);
