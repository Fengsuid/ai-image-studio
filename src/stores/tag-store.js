function createTagStore({ getPool, toIso, mapPromptCategory }) {
// ============================================================================
// gallery_tags
// ============================================================================

// 80 条系统种子（8 大类 × 10）。slug 全小写、ASCII；label_zh / label_en 决定展示；
// aliases 用于把用户输入归一化到 slug，包含中英常见别名。
const SYSTEM_TAG_SEED = [
  { slug: "text-to-image", label_zh: "文生图", label_en: "Text-to-image", aliases: ["文生图", "text-to-image", "txt2img"], category: "core", sort_order: 1 },
  { slug: "image-to-image", label_zh: "图生图", label_en: "Image-to-image", aliases: ["图生图", "image-to-image", "img2img"], category: "core", sort_order: 2 },
  // ---- 风格 ----
  { slug: "photo", label_zh: "摄影", label_en: "Photo", aliases: ["摄影", "照片", "photo", "photography"] },
  { slug: "realistic", label_zh: "写实", label_en: "Realistic", aliases: ["写实", "真实", "realistic", "photorealistic"] },
  { slug: "illustration", label_zh: "插画", label_en: "Illustration", aliases: ["插画", "插图", "illustration"] },
  { slug: "watercolor", label_zh: "水彩", label_en: "Watercolor", aliases: ["水彩", "水墨", "watercolor"] },
  { slug: "oil-painting", label_zh: "油画", label_en: "Oil painting", aliases: ["油画", "oil-painting", "oil"] },
  { slug: "pixel-art", label_zh: "像素", label_en: "Pixel art", aliases: ["像素", "像素风", "pixel", "pixel-art"] },
  { slug: "concept-art", label_zh: "概念", label_en: "Concept art", aliases: ["概念", "概念图", "concept", "concept-art"] },
  { slug: "anime", label_zh: "日式动漫", label_en: "Anime", aliases: ["动漫", "动画", "anime", "manga"] },
  { slug: "chinese-style", label_zh: "中国风", label_en: "Chinese style", aliases: ["中国风", "国风", "guofeng", "chinese-style"] },
  { slug: "minimalism", label_zh: "极简", label_en: "Minimalism", aliases: ["极简", "minimalism", "minimal"] },
  // ---- 题材 ----
  { slug: "portrait", label_zh: "人像", label_en: "Portrait", aliases: ["人像", "肖像", "portrait"] },
  { slug: "landscape", label_zh: "风景", label_en: "Landscape", aliases: ["风景", "山水", "landscape"] },
  { slug: "cityscape", label_zh: "城市", label_en: "Cityscape", aliases: ["城市", "都市", "cityscape", "city"] },
  { slug: "still-life", label_zh: "静物", label_en: "Still life", aliases: ["静物", "still-life"] },
  { slug: "food", label_zh: "美食", label_en: "Food", aliases: ["美食", "食物", "food"] },
  { slug: "animal", label_zh: "动物", label_en: "Animal", aliases: ["动物", "宠物", "animal", "pet"] },
  { slug: "architecture", label_zh: "建筑", label_en: "Architecture", aliases: ["建筑", "architecture"] },
  { slug: "ocean", label_zh: "海洋", label_en: "Ocean", aliases: ["海洋", "大海", "ocean", "sea"] },
  { slug: "space", label_zh: "太空", label_en: "Space", aliases: ["太空", "宇宙", "space", "cosmos"] },
  { slug: "holiday", label_zh: "节日", label_en: "Holiday", aliases: ["节日", "节庆", "holiday", "festival"] },
  // ---- 用途 ----
  { slug: "poster", label_zh: "海报", label_en: "Poster", aliases: ["海报", "招贴", "poster"] },
  { slug: "avatar", label_zh: "头像", label_en: "Avatar", aliases: ["头像", "avatar"] },
  { slug: "product", label_zh: "商品", label_en: "Product", aliases: ["商品", "产品", "product"] },
  { slug: "advertisement", label_zh: "广告", label_en: "Advertisement", aliases: ["广告", "advertisement", "ad"] },
  { slug: "web-banner", label_zh: "网站", label_en: "Web banner", aliases: ["网站", "网页", "web", "web-banner"] },
  { slug: "emoji", label_zh: "表情", label_en: "Emoji", aliases: ["表情", "表情包", "emoji", "sticker"] },
  { slug: "cover", label_zh: "头图", label_en: "Cover", aliases: ["头图", "封面", "cover"] },
  { slug: "business-card", label_zh: "名片", label_en: "Business card", aliases: ["名片", "business-card"] },
  { slug: "ticket", label_zh: "票券", label_en: "Ticket", aliases: ["票券", "门票", "ticket"] },
  { slug: "packaging", label_zh: "包装", label_en: "Packaging", aliases: ["包装", "packaging"] },
  // ---- 镜头 ----
  { slug: "close-up", label_zh: "特写", label_en: "Close-up", aliases: ["特写", "close-up", "closeup"] },
  { slug: "medium-shot", label_zh: "中景", label_en: "Medium shot", aliases: ["中景", "medium-shot"] },
  { slug: "wide-shot", label_zh: "全景", label_en: "Wide shot", aliases: ["全景", "wide-shot"] },
  { slug: "aerial", label_zh: "鸟瞰", label_en: "Aerial", aliases: ["鸟瞰", "航拍", "aerial"] },
  { slug: "fisheye", label_zh: "鱼眼", label_en: "Fisheye", aliases: ["鱼眼", "fisheye"] },
  { slug: "macro", label_zh: "微距", label_en: "Macro", aliases: ["微距", "macro"] },
  { slug: "panorama", label_zh: "全景接片", label_en: "Panorama", aliases: ["全景接片", "panorama"] },
  { slug: "low-angle", label_zh: "仰拍", label_en: "Low angle", aliases: ["仰拍", "仰角", "low-angle"] },
  { slug: "top-down", label_zh: "俯拍", label_en: "Top-down", aliases: ["俯拍", "俯视", "top-down"] },
  { slug: "perspective", label_zh: "透视", label_en: "Perspective", aliases: ["透视", "perspective"] },
  // ---- 灯光 ----
  { slug: "natural-light", label_zh: "自然光", label_en: "Natural light", aliases: ["自然光", "natural-light"] },
  { slug: "golden-hour", label_zh: "黄金时段", label_en: "Golden hour", aliases: ["黄金时段", "golden-hour"] },
  { slug: "dark-background", label_zh: "黑色背景", label_en: "Dark background", aliases: ["黑色背景", "暗背景", "dark-background"] },
  { slug: "studio-light", label_zh: "工作室光", label_en: "Studio light", aliases: ["工作室光", "studio-light", "studio"] },
  { slug: "neon", label_zh: "霓虹", label_en: "Neon", aliases: ["霓虹", "neon"] },
  { slug: "candlelight", label_zh: "烛光", label_en: "Candlelight", aliases: ["烛光", "candlelight"] },
  { slug: "volumetric", label_zh: "体积光", label_en: "Volumetric", aliases: ["体积光", "volumetric"] },
  { slug: "backlight", label_zh: "逆光", label_en: "Backlight", aliases: ["逆光", "backlight"] },
  { slug: "high-contrast", label_zh: "强对比", label_en: "High contrast", aliases: ["强对比", "高对比", "high-contrast"] },
  { slug: "soft-light", label_zh: "柔光", label_en: "Soft light", aliases: ["柔光", "soft-light"] },
  // ---- 情绪 ----
  { slug: "healing", label_zh: "治愈", label_en: "Healing", aliases: ["治愈", "healing"] },
  { slug: "mystic", label_zh: "神秘", label_en: "Mystic", aliases: ["神秘", "mystic", "mysterious"] },
  { slug: "nostalgia", label_zh: "怀旧", label_en: "Nostalgia", aliases: ["怀旧", "nostalgia", "retro"] },
  { slug: "joyful", label_zh: "欢快", label_en: "Joyful", aliases: ["欢快", "joyful"] },
  { slug: "serious", label_zh: "严肃", label_en: "Serious", aliases: ["严肃", "serious"] },
  { slug: "romantic", label_zh: "浪漫", label_en: "Romantic", aliases: ["浪漫", "romantic"] },
  { slug: "calm", label_zh: "冷淡", label_en: "Calm", aliases: ["冷淡", "calm", "serene"] },
  { slug: "dramatic", label_zh: "戏剧", label_en: "Dramatic", aliases: ["戏剧", "dramatic"] },
  { slug: "cozy", label_zh: "温馨", label_en: "Cozy", aliases: ["温馨", "cozy"] },
  { slug: "epic", label_zh: "史诗", label_en: "Epic", aliases: ["史诗", "epic"] },
  // ---- 颜色 ----
  { slug: "morandi", label_zh: "莫兰迪", label_en: "Morandi", aliases: ["莫兰迪", "morandi"] },
  { slug: "saturated", label_zh: "高饱和", label_en: "Saturated", aliases: ["高饱和", "saturated"] },
  { slug: "monochrome", label_zh: "黑白", label_en: "Monochrome", aliases: ["黑白", "monochrome", "bw"] },
  { slug: "vintage", label_zh: "复古", label_en: "Vintage", aliases: ["复古", "vintage"] },
  { slug: "pink", label_zh: "粉红", label_en: "Pink", aliases: ["粉红", "粉色", "pink"] },
  { slug: "blue-tone", label_zh: "蓝调", label_en: "Blue tone", aliases: ["蓝调", "blue-tone"] },
  { slug: "warm-tone", label_zh: "暖色", label_en: "Warm tone", aliases: ["暖色", "warm-tone", "warm"] },
  { slug: "cool-tone", label_zh: "冷色", label_en: "Cool tone", aliases: ["冷色", "cool-tone", "cool"] },
  { slug: "gradient", label_zh: "渐变", label_en: "Gradient", aliases: ["渐变", "gradient"] },
  { slug: "contrast-colors", label_zh: "撞色", label_en: "Contrast colors", aliases: ["撞色", "contrast-colors"] },
  // ---- 技法 ----
  { slug: "hdr", label_zh: "HDR", label_en: "HDR", aliases: ["hdr"] },
  { slug: "long-exposure", label_zh: "长曝光", label_en: "Long exposure", aliases: ["长曝光", "long-exposure"] },
  { slug: "light-painting", label_zh: "光绘", label_en: "Light painting", aliases: ["光绘", "light-painting"] },
  { slug: "double-exposure", label_zh: "双重曝光", label_en: "Double exposure", aliases: ["双重曝光", "double-exposure"] },
  { slug: "bokeh", label_zh: "散景", label_en: "Bokeh", aliases: ["散景", "bokeh"] },
  { slug: "tilt-shift", label_zh: "倾斜移轴", label_en: "Tilt-shift", aliases: ["倾斜移轴", "tilt-shift"] },
  { slug: "reflection", label_zh: "反射", label_en: "Reflection", aliases: ["反射", "reflection"] },
  { slug: "silhouette", label_zh: "剪影", label_en: "Silhouette", aliases: ["剪影", "倒影", "silhouette"] },
  { slug: "film-grain", label_zh: "颗粒", label_en: "Film grain", aliases: ["颗粒", "胶片", "film-grain"] },
  { slug: "lens-flare", label_zh: "镜头光晕", label_en: "Lens flare", aliases: ["镜头光晕", "lens-flare"] }
];

const SYSTEM_TAG_CATEGORIES = [
  "style",
  "subject",
  "use_case",
  "camera",
  "lighting",
  "mood",
  "color",
  "technique"
];

const PROMPT_CATEGORY_SEED = [
  { slug: "style", labelZh: "风格", labelEn: "Style", descriptionZh: "视觉风格、艺术流派和画面质感", descriptionEn: "Visual styles, art directions, and rendering texture", sortOrder: 10 },
  { slug: "subject", labelZh: "题材", labelEn: "Subject", descriptionZh: "人物、产品、场景和核心主体", descriptionEn: "People, products, scenes, and main subjects", sortOrder: 20 },
  { slug: "use_case", labelZh: "用途", labelEn: "Use", descriptionZh: "海报、封面、头像、UI、电商等使用场景", descriptionEn: "Posters, covers, avatars, UI, ecommerce, and other uses", sortOrder: 30 },
  { slug: "camera", labelZh: "镜头", labelEn: "Camera", descriptionZh: "景别、镜头语言、构图和摄影参数", descriptionEn: "Shot type, lens language, composition, and camera settings", sortOrder: 40 },
  { slug: "lighting", labelZh: "灯光", labelEn: "Lighting", descriptionZh: "光线方向、氛围和影调控制", descriptionEn: "Light direction, atmosphere, and tonal control", sortOrder: 50 },
  { slug: "mood", labelZh: "情绪", labelEn: "Mood", descriptionZh: "画面情绪、叙事感和审美倾向", descriptionEn: "Mood, narrative feeling, and aesthetic tone", sortOrder: 60 },
  { slug: "color", labelZh: "颜色", labelEn: "Color", descriptionZh: "配色、色调和色彩关系", descriptionEn: "Palettes, tones, and color relationships", sortOrder: 70 },
  { slug: "technique", labelZh: "技法", labelEn: "Technique", descriptionZh: "摄影技法、渲染技法和后期效果", descriptionEn: "Photo techniques, rendering methods, and post effects", sortOrder: 80 },
  { slug: "general", labelZh: "其他", labelEn: "Other", descriptionZh: "暂未归类或跨分类提示词", descriptionEn: "Uncategorized or cross-category prompts", sortOrder: 999 }
];

const PROMPT_SOURCE_SEED = [
  { id: "ps_evolinkai_gpt_image_2", name: "EvoLinkAI GPT Image 2", repoUrl: "https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts", parser: "github-generic", sortOrder: 10 },
  { id: "ps_zerolu_gpt_image", name: "ZeroLu Awesome GPT Image", repoUrl: "https://github.com/ZeroLu/awesome-gpt-image", parser: "github-generic", sortOrder: 20 },
  { id: "ps_imgedify_gpt4o", name: "ImgEdify GPT-4o Image Prompts", repoUrl: "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts", parser: "github-generic", sortOrder: 30 },
  { id: "ps_youmind_gpt_image_2", name: "YouMind GPT Image 2", repoUrl: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2", parser: "github-generic", sortOrder: 40 },
  { id: "ps_youmind_nano_banana_pro", name: "YouMind Nano Banana Pro", repoUrl: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts", parser: "github-generic", sortOrder: 50 },
  { id: "ps_basketikun_infinite_canvas", name: "Infinite Canvas Prompt Library", repoUrl: "https://github.com/basketikun/infinite-canvas", parser: "infinite-canvas", sortOrder: 60 },
  { id: "ps_davidwuw_gpt_image2_prompts", name: "Awesome GPT Image2 Prompts", repoUrl: "https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts", parser: "awesome-gpt-image2-prompts", sortOrder: 70 }
];

function systemTagMeta(index) {
  if (SYSTEM_TAG_SEED[index]?.category === "core") {
    return {
      category: "core",
      sortOrder: Number(SYSTEM_TAG_SEED[index].sort_order || index + 1),
      showInFilter: true
    };
  }
  return {
    category: SYSTEM_TAG_CATEGORIES[Math.floor((index - 2) / 10)] || "general",
    sortOrder: (index + 1) * 10,
    showInFilter: true
  };
}

function normalizeAliasInput(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidTagSlug(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(value);
}

function isValidCategorySlug(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/.test(value);
}

// 简单稳定 hash → 0..359 hue。crypto.createHash 已经在 server.js 导入；store 这里独立 require。
function deriveHueFromSlug(slug) {
  const crypto = require("crypto");
  const digest = crypto.createHash("sha1").update(String(slug || "")).digest();
  return digest.readUInt16BE(0) % 360;
}

function mapTag(row) {
  if (!row) return null;
  let aliases = [];
  if (row.aliases_json) {
    try {
      const parsed = JSON.parse(row.aliases_json);
      if (Array.isArray(parsed)) aliases = parsed.map((alias) => String(alias));
    } catch {
      aliases = [];
    }
  }
  return {
    slug: row.slug,
    labelZh: row.label_zh || "",
    labelEn: row.label_en || "",
    aliases,
    category: row.category || "",
    source: row.source || "user",
    status: row.status || "active",
    showInFilter: row.show_in_filter !== undefined ? Boolean(row.show_in_filter) : true,
    hue: Number(row.hue || 0),
    usageCount: Number(row.usage_count || 0),
    sortOrder: Number(row.sort_order || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function addJsonTagCounts(rows, column, target) {
  for (const row of rows) {
    if (!row[column]) continue;
    try {
      const parsed = JSON.parse(row[column]);
      if (!Array.isArray(parsed)) continue;
      const seen = new Set();
      for (const item of parsed) {
        const slug = String(item || "").trim().toLowerCase();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        target[slug] = (target[slug] || 0) + 1;
      }
    } catch {
      // Ignore malformed historical rows; tag lists remain usable.
    }
  }
}

async function loadTagCoverageCounts() {
  const promptCounts = {};
  const galleryCounts = {};
  const [promptRows] = await getPool().execute("SELECT tags_json FROM prompts WHERE status = 'active'");
  const [galleryRows] = await getPool().execute("SELECT public_tags_json FROM generations WHERE is_public = 1");
  addJsonTagCounts(promptRows, "tags_json", promptCounts);
  addJsonTagCounts(galleryRows, "public_tags_json", galleryCounts);
  return { promptCounts, galleryCounts };
}

async function seedPromptCategories() {
  for (const item of PROMPT_CATEGORY_SEED) {
    await getPool().execute(
      `INSERT INTO prompt_categories
          (slug, label_zh, label_en, description_zh, description_en, status, sort_order)
       VALUES (?, ?, ?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE
          label_zh = IF(label_zh = '', VALUES(label_zh), label_zh),
          label_en = IF(label_en = '', VALUES(label_en), label_en),
          description_zh = IF(description_zh = '', VALUES(description_zh), description_zh),
          description_en = IF(description_en = '', VALUES(description_en), description_en)`,
      [item.slug, item.labelZh, item.labelEn, item.descriptionZh, item.descriptionEn, item.sortOrder]
    );
  }
}

async function seedPromptSources() {
  for (const item of PROMPT_SOURCE_SEED) {
    await getPool().execute(
      `INSERT INTO prompt_sources
          (id, name, source_type, repo_url, branch, parser, config_json, status, sort_order)
       VALUES (?, ?, 'github', ?, 'main', ?, '{}', 'active', ?)
       ON DUPLICATE KEY UPDATE
          name = IF(name = '', VALUES(name), name),
          repo_url = IF(repo_url = '', VALUES(repo_url), repo_url),
          parser = IF(parser = '', VALUES(parser), parser)`,
      [item.id, item.name, item.repoUrl, item.parser, item.sortOrder]
    );
  }
}

async function listPromptCategories({ includeHidden = false } = {}) {
  const where = includeHidden ? "" : "WHERE status = 'active'";
  const [rows] = await getPool().execute(
    `SELECT * FROM prompt_categories ${where} ORDER BY sort_order ASC, slug ASC`
  );
  return rows.map(mapPromptCategory);
}

async function getPromptCategoryBySlug(slug) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return null;
  const [rows] = await getPool().execute("SELECT * FROM prompt_categories WHERE slug = ? LIMIT 1", [cleaned]);
  return mapPromptCategory(rows[0]);
}

async function upsertPromptCategory(payload) {
  const slug = String(payload.slug || "").trim().toLowerCase();
  if (!isValidCategorySlug(slug)) throw new Error("invalid category slug");
  const labelZh = String(payload.labelZh || "").trim().slice(0, 48);
  const labelEn = String(payload.labelEn || "").trim().slice(0, 48);
  const descriptionZh = String(payload.descriptionZh || "").trim().slice(0, 255);
  const descriptionEn = String(payload.descriptionEn || "").trim().slice(0, 255);
  const status = payload.status === "hidden" ? "hidden" : "active";
  const sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0;
  await getPool().execute(
    `INSERT INTO prompt_categories
        (slug, label_zh, label_en, description_zh, description_en, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        label_zh = VALUES(label_zh),
        label_en = VALUES(label_en),
        description_zh = VALUES(description_zh),
        description_en = VALUES(description_en),
        status = VALUES(status),
        sort_order = VALUES(sort_order)`,
    [slug, labelZh, labelEn, descriptionZh, descriptionEn, status, sortOrder]
  );
  return getPromptCategoryBySlug(slug);
}

async function listTags({ includeHidden = false, limit = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
  const where = includeHidden ? "" : "WHERE status = 'active'";
  const [rows] = await getPool().execute(
    `SELECT * FROM gallery_tags ${where} ORDER BY show_in_filter DESC, source = 'system' DESC, sort_order ASC, usage_count DESC, slug ASC LIMIT ${safeLimit}`
  );
  const tags = rows.map(mapTag);
  const { promptCounts, galleryCounts } = await loadTagCoverageCounts();
  return tags.map((tag) => {
    const promptCount = Number(promptCounts[tag.slug] || 0);
    const galleryCount = Number(galleryCounts[tag.slug] || 0);
    return {
      ...tag,
      promptCount,
      galleryCount,
      contentCount: promptCount + galleryCount
    };
  }).sort((left, right) => {
    const pinned = { "text-to-image": 1, "image-to-image": 2 };
    const leftPinned = pinned[left.slug] || 0;
    const rightPinned = pinned[right.slug] || 0;
    if (leftPinned || rightPinned) return (leftPinned || 99) - (rightPinned || 99);
    return Number(right.galleryCount || 0) - Number(left.galleryCount || 0)
      || Number(right.contentCount || 0) - Number(left.contentCount || 0)
      || Number(right.usageCount || 0) - Number(left.usageCount || 0)
      || Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
      || String(left.slug).localeCompare(String(right.slug));
  });
}

async function getTagBySlug(slug) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return null;
  const [rows] = await getPool().execute("SELECT * FROM gallery_tags WHERE slug = ? LIMIT 1", [cleaned]);
  return mapTag(rows[0]);
}

async function countTags() {
  const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM gallery_tags");
  return Number(rows[0]?.count || 0);
}

// 用归一化后的字符串去匹配 slug 或任意 alias；找到 active tag 时返回它，否则 null。
async function findTagByAlias(input) {
  const normalized = normalizeAliasInput(input);
  if (!normalized) return null;
  // slug 只能 ASCII；中文输入肯定不会命中 slug，需要走 aliases JSON 查询。
  if (isValidTagSlug(normalized)) {
    const direct = await getTagBySlug(normalized);
    if (direct && direct.status === "active") return direct;
  }
  const [rows] = await getPool().execute(
    "SELECT * FROM gallery_tags WHERE status = 'active' AND aliases_json LIKE ? LIMIT 50",
    [`%${normalized.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`]
  );
  for (const row of rows) {
    const tag = mapTag(row);
    const lowerAliases = tag.aliases.map((alias) => String(alias).trim().toLowerCase());
    if (lowerAliases.includes(normalized) || tag.slug === normalized) {
      return tag;
    }
  }
  return null;
}

async function createTag(payload) {
  const slug = String(payload.slug || "").trim().toLowerCase();
  if (!isValidTagSlug(slug)) {
    throw new Error("invalid tag slug");
  }
  const aliasesArray = Array.isArray(payload.aliases) ? payload.aliases.map(String) : [];
  const aliasesJson = JSON.stringify(aliasesArray);
  const hue = Number.isFinite(Number(payload.hue))
    ? Math.max(0, Math.min(359, Number(payload.hue)))
    : deriveHueFromSlug(slug);
  await getPool().execute(
    `INSERT INTO gallery_tags (slug, label_zh, label_en, aliases_json, category, source, status, show_in_filter, hue, usage_count, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      String(payload.labelZh || "").slice(0, 48),
      String(payload.labelEn || "").slice(0, 48),
      aliasesJson,
      String(payload.category || "").slice(0, 32),
      ["system", "admin", "user"].includes(payload.source) ? payload.source : "user",
      payload.status === "hidden" ? "hidden" : "active",
      payload.showInFilter === false ? 0 : 1,
      hue,
      Math.max(0, Number(payload.usageCount || 0) | 0),
      Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0
    ]
  );
  return getTagBySlug(slug);
}

async function updateTag(slug, patch) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return null;
  const columns = [];
  const values = [];
  if (Object.hasOwn(patch, "labelZh")) {
    columns.push("label_zh = ?");
    values.push(String(patch.labelZh || "").slice(0, 48));
  }
  if (Object.hasOwn(patch, "labelEn")) {
    columns.push("label_en = ?");
    values.push(String(patch.labelEn || "").slice(0, 48));
  }
  if (Object.hasOwn(patch, "aliases")) {
    columns.push("aliases_json = ?");
    values.push(JSON.stringify(Array.isArray(patch.aliases) ? patch.aliases.map(String) : []));
  }
  if (Object.hasOwn(patch, "category")) {
    columns.push("category = ?");
    values.push(String(patch.category || "").slice(0, 32));
  }
  if (Object.hasOwn(patch, "source")) {
    columns.push("source = ?");
    values.push(["system", "admin", "user"].includes(patch.source) ? patch.source : "user");
  }
  if (Object.hasOwn(patch, "status")) {
    columns.push("status = ?");
    values.push(patch.status === "hidden" ? "hidden" : "active");
  }
  if (Object.hasOwn(patch, "hue")) {
    const hue = Number(patch.hue);
    columns.push("hue = ?");
    values.push(Number.isFinite(hue) ? Math.max(0, Math.min(359, hue)) : deriveHueFromSlug(cleaned));
  }
  if (Object.hasOwn(patch, "showInFilter")) {
    columns.push("show_in_filter = ?");
    values.push(patch.showInFilter === false ? 0 : 1);
  }
  if (Object.hasOwn(patch, "sortOrder")) {
    columns.push("sort_order = ?");
    values.push(Number.isFinite(Number(patch.sortOrder)) ? Number(patch.sortOrder) : 0);
  }
  if (!columns.length) return getTagBySlug(cleaned);
  values.push(cleaned);
  await getPool().execute(`UPDATE gallery_tags SET ${columns.join(", ")} WHERE slug = ?`, values);
  return getTagBySlug(cleaned);
}

async function hideTag(slug) {
  return updateTag(slug, { status: "hidden" });
}

async function incrementTagUsage(slug) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return;
  await getPool().execute(
    "UPDATE gallery_tags SET usage_count = usage_count + 1 WHERE slug = ?",
    [cleaned]
  );
}

// merge：把 sourceSlug 的 alias 列表全部并到 targetSlug，把 sourceSlug 标 hidden（不真删），
// 并迁移 prompts.tags_json / generations.public_tags_json 中的历史标签。
async function mergeTag(sourceSlug, targetSlug) {
  const fromSlug = String(sourceSlug || "").trim().toLowerCase();
  const toSlug = String(targetSlug || "").trim().toLowerCase();
  if (!fromSlug || !toSlug || fromSlug === toSlug) {
    throw new Error("invalid merge slugs");
  }
  const [from, to] = await Promise.all([getTagBySlug(fromSlug), getTagBySlug(toSlug)]);
  if (!from) throw new Error("source tag not found");
  if (!to) throw new Error("target tag not found");
  const merged = Array.from(new Set([
    ...(to.aliases || []).map(String),
    ...(from.aliases || []).map(String),
    from.slug,
    from.labelZh,
    from.labelEn
  ].filter(Boolean)));
  await updateTag(toSlug, {
    aliases: merged,
    status: "active"
  });
  const migration = await migrateTagJsonSlugs({ [fromSlug]: toSlug }, { dryRun: false });
  await updateTag(fromSlug, { status: "hidden" });
  return { source: await getTagBySlug(fromSlug), target: await getTagBySlug(toSlug), migration };
}

function normalizeTagRewriteMap(mapping = {}) {
  const normalized = {};
  for (const [from, to] of Object.entries(mapping || {})) {
    const source = String(from || "").trim().toLowerCase();
    const target = String(to || "").trim().toLowerCase();
    if (source && target && source !== target) normalized[source] = target;
  }
  return normalized;
}

function rewriteTagArray(rawValue, mapping) {
  let tags = [];
  try {
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    if (Array.isArray(parsed)) tags = parsed;
  } catch {
    return { changed: false, malformed: true, tags: [], nextJson: rawValue || null, replacements: [] };
  }
  const replacements = [];
  const seen = new Set();
  const next = [];
  let changed = false;
  for (const tag of tags) {
    const original = String(tag || "").trim();
    if (!original) continue;
    const key = original.toLowerCase();
    const rewritten = mapping[key] || original;
    if (rewritten !== original) {
      changed = true;
      replacements.push({ from: original, to: rewritten });
    }
    const dedupeKey = String(rewritten).toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      next.push(rewritten);
    } else {
      changed = true;
    }
  }
  const nextJson = JSON.stringify(next);
  if (nextJson !== (rawValue || "[]")) changed = true;
  return { changed, malformed: false, tags: next, nextJson, replacements };
}

async function migrateTagJsonSlugs(mappingInput = {}, { dryRun = true } = {}) {
  const mapping = normalizeTagRewriteMap(mappingInput);
  const report = {
    dryRun: Boolean(dryRun),
    mapping,
    prompts: { scanned: 0, changed: 0, malformed: 0 },
    generations: { scanned: 0, changed: 0, malformed: 0 },
    replacements: []
  };
  if (!Object.keys(mapping).length) return report;

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [promptRows] = await connection.execute("SELECT id, tags_json FROM prompts");
    for (const row of promptRows) {
      report.prompts.scanned += 1;
      const result = rewriteTagArray(row.tags_json, mapping);
      if (result.malformed) {
        report.prompts.malformed += 1;
        continue;
      }
      if (!result.changed) continue;
      report.prompts.changed += 1;
      report.replacements.push({ table: "prompts", id: row.id, replacements: result.replacements });
      if (!dryRun) {
        await connection.execute("UPDATE prompts SET tags_json = ? WHERE id = ?", [result.nextJson, row.id]);
      }
    }

    const [generationRows] = await connection.execute("SELECT id, public_tags_json FROM generations");
    for (const row of generationRows) {
      report.generations.scanned += 1;
      const result = rewriteTagArray(row.public_tags_json, mapping);
      if (result.malformed) {
        report.generations.malformed += 1;
        continue;
      }
      if (!result.changed) continue;
      report.generations.changed += 1;
      report.replacements.push({ table: "generations", id: row.id, replacements: result.replacements });
      if (!dryRun) {
        await connection.execute("UPDATE generations SET public_tags_json = ? WHERE id = ?", [result.nextJson, row.id]);
      }
    }

    if (dryRun) await connection.rollback();
    else await connection.commit();
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function seedTagsIfEmpty() {
  const existing = await countTags();
  let inserted = 0;
  for (const [index, item] of SYSTEM_TAG_SEED.entries()) {
    const meta = systemTagMeta(index);
    try {
      const existingTag = await getTagBySlug(item.slug);
      if (existingTag) {
        await updateTag(item.slug, {
          labelZh: item.label_zh || existingTag.labelZh,
          labelEn: item.label_en || existingTag.labelEn,
          aliases: Array.from(new Set([...(existingTag.aliases || []), ...(item.aliases || [])])),
          category: meta.category,
          source: "system",
          status: "active",
          showInFilter: true,
          sortOrder: meta.sortOrder
        });
      } else {
        await createTag({
          slug: item.slug,
          labelZh: item.label_zh,
          labelEn: item.label_en,
          aliases: item.aliases,
          category: meta.category,
          source: "system",
          status: "active",
          showInFilter: true,
          sortOrder: meta.sortOrder
        });
        inserted += 1;
      }
    } catch (error) {
      console.warn(`seedTagsIfEmpty failed for slug=${item?.slug}: ${error.message}`);
    }
  }
  return existing > 0 ? inserted : Math.max(inserted, SYSTEM_TAG_SEED.length);
}
  return {
    seedPromptCategories,
    seedPromptSources,
    listPromptCategories,
    getPromptCategoryBySlug,
    upsertPromptCategory,
    listTags,
    getTagBySlug,
    countTags,
    findTagByAlias,
    createTag,
    updateTag,
    hideTag,
    mergeTag,
    migrateTagJsonSlugs,
    incrementTagUsage,
    seedTagsIfEmpty
  };
}

module.exports = createTagStore;
