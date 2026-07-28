const DEFAULT_QUALITY = "high";
const QUALITY_VALUES = new Set(["standard", "high"]);
const SIZE_VALUES = new Set(["1024x1024", "1024x1536", "1536x1024"]);

const DIRECTIONS = [
  {
    key: "hero",
    title: "主视觉海报",
    angle: "single hero composition, clear subject hierarchy, premium campaign poster",
    publicHint: true
  },
  {
    key: "scene",
    title: "场景叙事图",
    angle: "lifestyle scene, environment storytelling, natural interaction and atmosphere",
    publicHint: true
  },
  {
    key: "detail",
    title: "材质细节图",
    angle: "close-up details, texture, craft, lighting gradients, refined product surface",
    publicHint: false
  },
  {
    key: "social",
    title: "社媒封面图",
    angle: "bold social cover, strong negative space, editorial layout, thumbnail readability",
    publicHint: true
  }
];

function buildAgentPlan(message, options = {}) {
  const request = cleanText(message, 2000);
  if (!request) {
    const error = new Error("Agent plan message is required");
    error.status = 400;
    throw error;
  }

  const variantCount = clampInt(options.variantCount ?? options.count, 4, 2, 4);
  const size = normalizeSize(options.size || inferSize(request));
  const quality = normalizeQuality(options.quality);
  const style = inferStyle(request);
  const directions = DIRECTIONS.slice(0, variantCount);
  const intent = summarizeIntent(request);
  const questions = buildQuestions(request);

  const variants = directions.map((direction, index) => ({
    id: `plan_${index + 1}`,
    title: direction.title,
    prompt: buildPrompt({
      request,
      intent,
      direction,
      style,
      index
    }),
    size,
    quality,
    style: {
      palette: style.palette,
      mood: style.mood,
      visualLanguage: style.visualLanguage
    },
    publicHint: direction.publicHint
  }));

  return {
    format: "ai-image-studio.agent-plan.v1",
    source: "deterministic-agent-workspace-mvp",
    userRequest: request,
    intent,
    variantCount: variants.length,
    estimatedCredits: variants.length,
    confirmationRequired: true,
    willCreateGenerations: false,
    variants,
    questions,
    nextAction: "confirm_plan_before_batch_generation"
  };
}

const MODEL_PLAN_SOURCE = "model-enriched-agent-plan";

async function buildAgentPlanWithModel(message, options = {}, { callModel } = {}) {
  const fallback = buildAgentPlan(message, options);
  if (typeof callModel !== "function") return fallback;
  try {
    const data = await callModel({
      input: planModelPrompt(fallback),
      temperature: 0.4,
      max_output_tokens: 1600
    });
    const parsed = parsePlanModelJson(extractPlanResponseText(data));
    const enriched = applyModelPlan(fallback, parsed);
    if (!enriched) return fallback;
    return { ...enriched, model: data?.model || "" };
  } catch {
    return fallback;
  }
}

function planModelPrompt(fallback) {
  return [
    {
      role: "system",
      content: [
        "You are an art director planning a coherent AI image series from one user brief.",
        "Return only JSON with keys: intent, variants, questions.",
        `variants must be an array of exactly ${fallback.variantCount} objects with keys:`,
        "title (short Chinese label), angle (English art direction, one sentence),",
        "palette (array of 1-4 short English color phrases), mood (array of 1-4 short English mood words),",
        "visualLanguage (array of 1-4 short English technique phrases), publicHint (boolean, true if suitable for a public gallery).",
        "intent is a concise summary of the brief in its original language, max 96 chars.",
        "questions is an array of 0-3 short clarifying questions in the brief's language.",
        "Each variant must serve a distinct purpose in the series (e.g. hero, scene, detail, social cover).",
        "No markdown, no commentary, JSON only."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        brief: fallback.userRequest,
        variantCount: fallback.variantCount,
        size: fallback.variants[0]?.size || "1024x1536",
        quality: fallback.variants[0]?.quality || DEFAULT_QUALITY
      })
    }
  ];
}

function extractPlanResponseText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (typeof data.text === "string") return data.text;
  if (Array.isArray(data.output)) {
    return data.output
      .flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .map((part) => part.text || part.output_text || "")
      .filter(Boolean)
      .join("\n");
  }
  if (Array.isArray(data.choices)) {
    return data.choices
      .map((choice) => choice.message?.content || choice.text || "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function parsePlanModelJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function applyModelPlan(fallback, parsed) {
  if (!parsed || !Array.isArray(parsed.variants) || !parsed.variants.length) return null;
  const modelVariants = parsed.variants
    .slice(0, fallback.variantCount)
    .map((variant) => normalizeModelVariant(variant))
    .filter(Boolean);
  if (modelVariants.length !== fallback.variantCount) return null;

  const intent = cleanText(parsed.intent, 96) || fallback.intent;
  const size = fallback.variants[0]?.size || "1024x1536";
  const quality = fallback.variants[0]?.quality || DEFAULT_QUALITY;
  const variants = modelVariants.map((variant, index) => ({
    id: `plan_${index + 1}`,
    title: variant.title,
    prompt: buildPrompt({
      request: fallback.userRequest,
      intent,
      direction: { title: variant.title, angle: variant.angle },
      style: variant.style,
      index
    }),
    size,
    quality,
    style: variant.style,
    publicHint: variant.publicHint
  }));

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.map((item) => cleanText(item, 200)).filter(Boolean).slice(0, 3)
    : fallback.questions;

  return {
    ...fallback,
    source: MODEL_PLAN_SOURCE,
    intent,
    variantCount: variants.length,
    estimatedCredits: variants.length,
    variants,
    questions
  };
}

function normalizeModelVariant(variant) {
  const title = cleanText(variant?.title, 80);
  const angle = cleanText(variant?.angle, 300);
  if (!title || !angle) return null;
  const listOf = (value, fallbackItems) => {
    const items = Array.isArray(value) ? unique(value).slice(0, 4) : [];
    return items.length ? items : fallbackItems;
  };
  return {
    title,
    angle,
    publicHint: variant?.publicHint !== false,
    style: {
      palette: listOf(variant?.palette, ["soft porcelain white", "controlled accent color"]),
      mood: listOf(variant?.mood, ["premium", "polished", "cohesive"]),
      visualLanguage: listOf(variant?.visualLanguage, ["cinematic lighting", "balanced negative space"])
    }
  };
}

function summarizeAgentPlan(plan) {
  const count = Array.isArray(plan?.variants) ? plan.variants.length : 0;
  const titles = (plan?.variants || []).map((item) => item.title).filter(Boolean).join("、");
  const questionText = (plan?.questions || []).length ? ` 需要确认：${plan.questions.join("；")}` : "";
  return `我已拆出 ${count} 个可执行生成方案：${titles}。确认前不会扣积分，也不会创建真实生成任务。${questionText}`;
}

function cleanText(value, max = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function clampInt(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeSize(value) {
  const size = cleanText(value, 32);
  return SIZE_VALUES.has(size) ? size : "1024x1536";
}

function normalizeQuality(value) {
  const quality = cleanText(value, 32).toLowerCase();
  return QUALITY_VALUES.has(quality) ? quality : DEFAULT_QUALITY;
}

function inferSize(request) {
  if (/(横版|封面|banner|youtube|16[:：]9|landscape|wide)/i.test(request)) return "1536x1024";
  if (/(头像|logo|icon|方图|正方形|1[:：]1|square)/i.test(request)) return "1024x1024";
  return "1024x1536";
}

function inferStyle(request) {
  const palette = [];
  const mood = [];
  const visualLanguage = [];

  if (/(青绿|绿色|cyan|green|jade|emerald)/i.test(request)) palette.push("cyan green", "jade green");
  if (/(红|red|scarlet|crimson)/i.test(request)) palette.push("deep red");
  if (/(蓝|blue|navy|azure)/i.test(request)) palette.push("electric blue");
  if (/(金|gold|premium|奢华)/i.test(request)) palette.push("warm gold");
  if (!palette.length) palette.push("soft porcelain white", "controlled accent color");

  if (/(赛博|cyber|未来|futuristic|霓虹|neon)/i.test(request)) {
    mood.push("futuristic", "high contrast");
    visualLanguage.push("controlled neon rim light");
  }
  if (/(宋代|瓷器|porcelain|东方|古典|国风)/i.test(request)) {
    mood.push("quiet luxury", "heritage craft");
    visualLanguage.push("porcelain texture", "Song dynasty restraint");
  }
  if (/(小红书|社媒|social|instagram|封面)/i.test(request)) {
    mood.push("shareable", "clean editorial");
    visualLanguage.push("strong readable composition");
  }
  if (!mood.length) mood.push("premium", "polished", "cohesive");
  if (!visualLanguage.length) visualLanguage.push("cinematic lighting", "balanced negative space");

  return { palette: unique(palette).slice(0, 4), mood: unique(mood).slice(0, 4), visualLanguage: unique(visualLanguage).slice(0, 4) };
}

function summarizeIntent(request) {
  return request
    .replace(/[。！？.!?].*$/, "")
    .replace(/^(我想|请|帮我|需要|做|生成|设计)+/g, "")
    .trim()
    .slice(0, 96) || "image_series";
}

function buildPrompt({ request, intent, direction, style, index }) {
  const palette = style.palette.join(", ");
  const mood = style.mood.join(", ");
  const language = style.visualLanguage.join(", ");
  return [
    `Create image ${index + 1} for: ${intent}.`,
    `Original brief: ${request}.`,
    `Direction: ${direction.title}; ${direction.angle}.`,
    index > 0 ? `If available, keep continuity with upstream reference step[${index}].output.image_url.` : "",
    `Palette: ${palette}. Mood: ${mood}. Visual language: ${language}.`,
    "Keep the image production-ready, coherent as part of one series, with no accidental logos, no unreadable text, and no UI chrome."
  ].filter(Boolean).join(" ");
}

function buildQuestions(request) {
  const questions = [];
  if (!/(logo|品牌|brand|商标)/i.test(request)) questions.push("是否需要加入品牌 Logo 或占位文字？");
  if (!/(统一|色调|palette|颜色|青绿|红|蓝|金|黑|白)/i.test(request)) questions.push("这一组图是否需要统一色调？");
  if (!/(比例|尺寸|竖版|横版|方图|小红书|banner|封面|海报)/i.test(request)) questions.push("主要发布渠道和画面比例是什么？");
  return questions.slice(0, 3);
}

function unique(items) {
  return [...new Set(items.map((item) => cleanText(item, 80)).filter(Boolean))];
}

module.exports = {
  buildAgentPlan,
  buildAgentPlanWithModel,
  summarizeAgentPlan
};
