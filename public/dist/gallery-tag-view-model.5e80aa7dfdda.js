(function initGalleryTagViewModel(global) {
  "use strict";

  const TYPE_TAGS = new Set([
    "square",
    "generation-square",
    "text-to-image",
    "txt2img",
    "text2image",
    "t2i",
    "文生图",
    "文本生成图像",
    "image-to-image",
    "img2img",
    "image2image",
    "i2i",
    "图生图",
    "以图生图"
  ]);

  function normalizeKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  }

  function isTypeTag(value) {
    const raw = String(value || "").trim();
    return TYPE_TAGS.has(raw) || TYPE_TAGS.has(normalizeKey(raw));
  }

  function cleanPublicTags(tags = []) {
    const rawTags = Array.isArray(tags) ? tags : String(tags || "").split(/[,，、#\s]+/);
    const seen = new Set();
    return rawTags
      .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
      .filter(Boolean)
      .filter((tag) => !isTypeTag(tag))
      .filter((tag) => {
        const key = normalizeKey(tag);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }

  function kindBadge(kind) {
    const slug = kind === "image-to-image" ? "image-to-image" : "text-to-image";
    return {
      slug,
      textKey: slug === "image-to-image" ? "imageToImage" : "textToImage",
      className: slug === "image-to-image" ? "image" : "text"
    };
  }

  function create({ kind = "text-to-image", publicTags = [], adminBadge = null } = {}) {
    return {
      kindBadge: kindBadge(kind),
      adminBadge,
      publicTags: cleanPublicTags(publicTags)
    };
  }

  global.ImageStudioGalleryTagViewModel = {
    create,
    cleanPublicTags,
    isTypeTag
  };
})(window);
