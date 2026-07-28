import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildAgentPlan, buildAgentPlanWithModel, summarizeAgentPlan } = require("../src/planner");
const agentCore = require("../index.js");

const PLAN_FORMAT = "ai-image-studio.agent-plan.v1";

test("buildAgentPlan returns frozen-format envelope with confirmation gate", () => {
  const plan = buildAgentPlan("我想做一组宋代瓷器主视觉海报");
  assert.equal(plan.format, PLAN_FORMAT);
  assert.equal(plan.confirmationRequired, true);
  assert.equal(plan.willCreateGenerations, false);
  assert.equal(plan.nextAction, "confirm_plan_before_batch_generation");
  assert.equal(plan.variantCount, plan.variants.length);
  assert.equal(plan.estimatedCredits, plan.variants.length);
  assert.equal(plan.source, "deterministic-agent-workspace-mvp");
  assert(plan.variantCount >= 2 && plan.variantCount <= 4, "variantCount must be between 2 and 4");
  for (const variant of plan.variants) {
    assert(variant.id && variant.title && variant.prompt, "variant must have id/title/prompt");
    assert(["1024x1024", "1024x1536", "1536x1024"].includes(variant.size), "variant size must be a supported value");
    assert(["standard", "high"].includes(variant.quality), "variant quality must be supported");
    assert(variant.style && Array.isArray(variant.style.palette), "variant style must expose palette");
    assert(Array.isArray(variant.style.mood), "variant style must expose mood");
    assert(Array.isArray(variant.style.visualLanguage), "variant style must expose visualLanguage");
    assert.equal(typeof variant.publicHint, "boolean", "variant must expose publicHint flag");
  }
});

test("buildAgentPlan throws when message is missing", () => {
  assert.throws(() => buildAgentPlan(""), (error) => error.message === "Agent plan message is required" && error.status === 400);
  assert.throws(() => buildAgentPlan("   "), /Agent plan message is required/);
  assert.throws(() => buildAgentPlan(null), /Agent plan message is required/);
  assert.throws(() => buildAgentPlan(undefined), /Agent plan message is required/);
});

test("buildAgentPlan honors variantCount within [2,4]", () => {
  assert.equal(buildAgentPlan("test brief", { variantCount: 2 }).variants.length, 2);
  assert.equal(buildAgentPlan("test brief", { variantCount: 3 }).variants.length, 3);
  assert.equal(buildAgentPlan("test brief", { variantCount: 4 }).variants.length, 4);
  assert.equal(buildAgentPlan("test brief", { variantCount: 9 }).variants.length, 4);
  assert.equal(buildAgentPlan("test brief", { variantCount: 0 }).variants.length, 2);
  assert.equal(buildAgentPlan("test brief", { variantCount: "bad" }).variants.length, 4);
  assert.equal(buildAgentPlan("test brief", { count: 3 }).variants.length, 3, "count alias should work");
});

test("buildAgentPlan inferSize picks landscape / square / vertical defaults", () => {
  assert.equal(buildAgentPlan("做一个 16:9 banner 主图").variants[0].size, "1536x1024");
  assert.equal(buildAgentPlan("生成一组 youtube 封面").variants[0].size, "1536x1024");
  assert.equal(buildAgentPlan("做一个横版海报").variants[0].size, "1536x1024");
  assert.equal(buildAgentPlan("logo 头像方图设计").variants[0].size, "1024x1024");
  assert.equal(buildAgentPlan("正方形 icon").variants[0].size, "1024x1024");
  assert.equal(buildAgentPlan("默认竖版 brief").variants[0].size, "1024x1536");
});

test("buildAgentPlan honors explicit size and quality with validation", () => {
  assert.equal(buildAgentPlan("brief", { size: "1024x1024" }).variants[0].size, "1024x1024");
  assert.equal(buildAgentPlan("brief", { size: "1536x1024" }).variants[0].size, "1536x1024");
  assert.equal(buildAgentPlan("brief", { size: "invalid-size" }).variants[0].size, "1024x1536", "invalid size falls back");
  assert.equal(buildAgentPlan("brief", { quality: "standard" }).variants[0].quality, "standard");
  assert.equal(buildAgentPlan("brief", { quality: "HIGH" }).variants[0].quality, "high", "quality is lowercased");
  assert.equal(buildAgentPlan("brief", { quality: "ultra" }).variants[0].quality, "high", "unknown quality falls back");
  assert.equal(buildAgentPlan("brief").variants[0].quality, "high", "default quality is high");
});

test("buildAgentPlan inferStyle resolves palette / mood / visualLanguage branches", () => {
  const cyber = buildAgentPlan("赛博朋克 cyberpunk 霓虹蓝色场景").variants[0].style;
  assert(cyber.palette.includes("electric blue"), "blue palette branch should trigger");
  assert(cyber.mood.includes("futuristic"), "cyber mood branch should trigger");
  assert(cyber.visualLanguage.some((item) => item.includes("neon")), "neon visual language");

  const heritage = buildAgentPlan("宋代瓷器 porcelain 国风海报").variants[0].style;
  assert(heritage.mood.includes("quiet luxury"), "heritage mood branch");
  assert(heritage.visualLanguage.some((item) => item.includes("porcelain")), "porcelain visual");

  const social = buildAgentPlan("小红书社媒封面 instagram cover").variants[0].style;
  assert(social.mood.includes("shareable"), "social mood branch");
  assert(social.visualLanguage.some((item) => item.includes("composition")), "composition visual");

  const red = buildAgentPlan("scarlet 红色品牌主视觉").variants[0].style;
  assert(red.palette.includes("deep red"), "red palette branch");

  const gold = buildAgentPlan("premium 奢华金色 brand poster").variants[0].style;
  assert(gold.palette.includes("warm gold"), "gold palette branch");

  const green = buildAgentPlan("青绿 emerald jade design").variants[0].style;
  assert(green.palette.some((color) => color.includes("green")), "green palette branch");

  const fallback = buildAgentPlan("一组产品宣传 brief").variants[0].style;
  assert(fallback.palette.length > 0, "fallback palette must not be empty");
  assert(fallback.mood.length > 0, "fallback mood must not be empty");
  assert(fallback.visualLanguage.length > 0, "fallback visualLanguage must not be empty");
});

test("buildAgentPlan buildQuestions returns up to 3 confirmation prompts", () => {
  const baseline = buildAgentPlan("一组产品主视觉");
  assert(Array.isArray(baseline.questions), "questions must be array");
  assert(baseline.questions.length <= 3, "no more than 3 confirmation questions");
  assert(baseline.questions.some((q) => q.includes("Logo")), "logo question expected when brief has none");
  assert(baseline.questions.some((q) => q.includes("色调")), "palette question expected when brief lacks color");
  assert(baseline.questions.some((q) => q.includes("比例") || q.includes("渠道")), "channel question expected");

  const fullySpecified = buildAgentPlan("logo 红色横版 banner 海报");
  assert.equal(fullySpecified.questions.length, 0, "fully specified brief should not need confirmation questions");
});

test("buildAgentPlan summarizeIntent strips polite prefixes and sentence tails", () => {
  const plan = buildAgentPlan("我想生成一组茶饮新品上市海报，强调春日质感。");
  assert(plan.intent && !plan.intent.startsWith("我想"), "intent should strip 我想 prefix");
  assert(!plan.intent.includes("。"), "intent should stop at sentence end");

  const fallback = buildAgentPlan("。。。");
  assert.equal(fallback.intent, "image_series", "fallback intent label when empty");
});

test("buildAgentPlan variants embed prompt referencing intent and direction", () => {
  const plan = buildAgentPlan("生成宋代青绿瓷器主视觉系列");
  assert(plan.variants.length >= 2);
  const promptsHaveIntent = plan.variants.every((variant) => variant.prompt.includes("Direction:"));
  assert(promptsHaveIntent, "variant prompts must reference direction");
  const promptsHaveBrief = plan.variants.every((variant) => variant.prompt.includes("Original brief:"));
  assert(promptsHaveBrief, "variant prompts must reference original brief");
  const promptsMentionPalette = plan.variants.every((variant) => variant.prompt.includes("Palette:"));
  assert(promptsMentionPalette, "variant prompts must include palette descriptor");
  assert(plan.variants[1].prompt.includes("step[1].output.image_url"), "follow-up variants must support upstream step image refs");
});

test("summarizeAgentPlan mentions confirmation and variant titles", () => {
  const plan = buildAgentPlan("社媒封面图，强调小红书可读性");
  const summary = summarizeAgentPlan(plan);
  assert(summary.includes("确认前不会扣积分"), "summary should explain no-credit-before-confirm contract");
  for (const variant of plan.variants) {
    assert(summary.includes(variant.title), `summary should include variant title ${variant.title}`);
  }
});

test("summarizeAgentPlan handles empty / malformed plans gracefully", () => {
  assert.equal(summarizeAgentPlan({}).startsWith("我已拆出 0 个"), true, "empty plan still summarized");
  assert.equal(summarizeAgentPlan(null).startsWith("我已拆出 0 个"), true, "null plan tolerated");
  const summaryWithQuestions = summarizeAgentPlan({
    variants: [{ title: "Hero" }],
    questions: ["是否需要 Logo？", "色调是否统一？"]
  });
  assert(summaryWithQuestions.includes("需要确认"), "questions appended to summary");
  assert(summaryWithQuestions.includes("Hero"), "variant title still rendered");
});

test("buildAgentPlan trims input message to 2000 chars and collapses whitespace", () => {
  const long = "x".repeat(5000);
  const plan = buildAgentPlan(long);
  assert.equal(plan.userRequest.length, 2000, "userRequest must be clipped to 2000 chars");
  const whitespace = buildAgentPlan("  a   b\n\nc   ");
  assert.equal(whitespace.userRequest, "a b c", "whitespace must be normalized");
});

test("buildAgentPlanWithModel returns deterministic fallback when callModel is absent", async () => {
  const fallback = buildAgentPlan("宋代瓷器主视觉", { variantCount: 3 });
  const plan = await buildAgentPlanWithModel("宋代瓷器主视觉", { variantCount: 3 });
  assert.equal(plan.source, "deterministic-agent-workspace-mvp");
  assert.deepEqual(plan, fallback, "no callModel must behave exactly like buildAgentPlan");
});

test("buildAgentPlanWithModel adopts valid model JSON output", async () => {
  const modelJson = {
    intent: "茶饮新品上市系列",
    variants: [
      {
        title: "主视觉",
        angle: "hero composition with product front and center",
        palette: ["matcha green"],
        mood: ["fresh"],
        visualLanguage: ["soft daylight"],
        publicHint: true
      },
      {
        title: "细节图",
        angle: "macro close-up of tea texture",
        palette: ["warm cream"],
        mood: ["calm"],
        visualLanguage: ["shallow depth of field"],
        publicHint: false
      }
    ],
    questions: ["是否需要英文标语？"]
  };
  const plan = await buildAgentPlanWithModel("茶饮新品上市海报", { variantCount: 2 }, {
    callModel: async () => ({ output_text: JSON.stringify(modelJson), model: "test-model" })
  });
  assert.equal(plan.source, "model-enriched-agent-plan");
  assert.equal(plan.model, "test-model");
  assert.equal(plan.intent, "茶饮新品上市系列");
  assert.equal(plan.variants.length, 2);
  assert.equal(plan.variants[0].title, "主视觉");
  assert.equal(plan.variants[1].publicHint, false);
  assert(plan.variants[0].prompt.includes("Original brief:"), "prompt assembly must stay through buildPrompt");
  assert.deepEqual(plan.questions, ["是否需要英文标语？"]);
  assert.equal(plan.confirmationRequired, true, "confirmation gate must survive enrichment");
  assert.equal(plan.estimatedCredits, plan.variants.length);
});

test("buildAgentPlanWithModel falls back when callModel throws", async () => {
  const plan = await buildAgentPlanWithModel("品牌海报", {}, {
    callModel: async () => { throw new Error("upstream down"); }
  });
  assert.equal(plan.source, "deterministic-agent-workspace-mvp");
  assert.equal(plan.format, PLAN_FORMAT);
});

test("buildAgentPlanWithModel aborts slow model calls before falling back", async () => {
  let aborted = false;
  const startedAt = Date.now();
  const plan = await buildAgentPlanWithModel("快速生成三张海报", { variantCount: 3 }, {
    modelTimeoutMs: 25,
    callModel: async (payload, { signal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        resolve({ output_text: "" });
      }, { once: true });
    })
  });
  assert.equal(aborted, true, "planner must abort the slow model request");
  assert(Date.now() - startedAt < 500, "planner timeout fallback must complete promptly");
  assert.equal(plan.source, "deterministic-agent-workspace-mvp");
  assert.equal(plan.variants.length, 3);
});

test("buildAgentPlanWithModel falls back on unparseable or insufficient model output", async () => {
  const garbage = await buildAgentPlanWithModel("品牌海报", {}, {
    callModel: async () => ({ output_text: "对不起，我无法输出 JSON" })
  });
  assert.equal(garbage.source, "deterministic-agent-workspace-mvp");

  const tooFew = await buildAgentPlanWithModel("品牌海报", {}, {
    callModel: async () => ({
      output_text: JSON.stringify({ intent: "x", variants: [{ title: "唯一", angle: "only one" }] })
    })
  });
  assert.equal(tooFew.source, "deterministic-agent-workspace-mvp", "fewer than 2 valid variants must fall back");

  const variant = (index) => ({ title: `方案 ${index}`, angle: `direction ${index}` });
  const wrongCount = await buildAgentPlanWithModel("四张系列海报", { variantCount: 4 }, {
    callModel: async () => ({
      output_text: JSON.stringify({ variants: [variant(1), variant(2), variant(3)] })
    })
  });
  assert.equal(wrongCount.source, "deterministic-agent-workspace-mvp", "variant count mismatch must fall back");
  assert.equal(wrongCount.variants.length, 4, "fallback must preserve the requested variant count");
});

test("agent-core package exposes INTERFACE.md normalized exports", () => {
  assert.equal(typeof agentCore.createGenerationService, "function");
  assert.equal(typeof agentCore.createRoutes, "function");
  assert.equal(typeof agentCore.createSessionStore, "function");
  assert.equal(typeof agentCore.applySchema, "function");
  assert.equal(typeof agentCore.buildAgentPlan, "function");
  assert.equal(typeof agentCore.buildAgentPlanWithModel, "function");
  assert.equal(typeof agentCore.summarizeAgentPlan, "function");
});
