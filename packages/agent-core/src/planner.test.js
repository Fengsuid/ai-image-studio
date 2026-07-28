const { buildAgentPlan, buildAgentPlanWithModel, summarizeAgentPlan } = require("./planner");

describe("agent planner pure functions", () => {
  it("builds a frozen-format plan without creating generation work", () => {
    const plan = buildAgentPlan("我想做一组宋代瓷器主视觉海报", { variantCount: 3 });

    expect(plan.format).toBe("ai-image-studio.agent-plan.v1");
    expect(plan.confirmationRequired).toBe(true);
    expect(plan.willCreateGenerations).toBe(false);
    expect(plan.nextAction).toBe("confirm_plan_before_batch_generation");
    expect(plan.variants).toHaveLength(3);
    expect(plan.estimatedCredits).toBe(3);
    expect(plan.variants.every((variant) => variant.prompt.includes("Original brief:"))).toBe(true);
  });

  it("clamps variant count and infers size from the brief", () => {
    expect(buildAgentPlan("横版 banner 主图", { variantCount: 10 }).variants).toHaveLength(4);
    expect(buildAgentPlan("logo 头像方图", { variantCount: 1 }).variants).toHaveLength(2);
    expect(buildAgentPlan("横版 banner 主图").variants[0].size).toBe("1536x1024");
    expect(buildAgentPlan("logo 头像方图").variants[0].size).toBe("1024x1024");
    expect(buildAgentPlan("默认产品海报").variants[0].size).toBe("1024x1536");
  });

  it("normalizes quality, style and confirmation questions", () => {
    const plan = buildAgentPlan("premium 赛博 cyber 蓝色海报", { quality: "STANDARD" });
    const variant = plan.variants[0];

    expect(variant.quality).toBe("standard");
    expect(variant.style.palette).toContain("electric blue");
    expect(variant.style.mood).toContain("futuristic");
    expect(variant.style.visualLanguage).toContain("controlled neon rim light");
    expect(plan.questions.length).toBeGreaterThan(0);
    expect(plan.questions.length).toBeLessThanOrEqual(3);
  });

  it("summarizes variant titles and confirmation contract", () => {
    const plan = buildAgentPlan("社媒封面图，强调小红书可读性", { variantCount: 2 });
    const summary = summarizeAgentPlan(plan);

    expect(summary).toContain("确认前不会扣积分");
    expect(summary).toContain(plan.variants[0].title);
    expect(summary).toContain(plan.variants[1].title);
  });

  it("requires model enrichment to return the exact requested variant count", async () => {
    const variant = (index) => ({
      title: `方案 ${index}`,
      angle: `distinct art direction ${index}`,
      palette: ["blue"],
      mood: ["calm"],
      visualLanguage: ["soft light"],
      publicHint: true
    });
    const callModel = async (count) => ({
      output_text: JSON.stringify({ variants: Array.from({ length: count }, (_, index) => variant(index + 1)) })
    });
    const shortPlan = await buildAgentPlanWithModel("生成四张系列海报", { variantCount: 4 }, {
      callModel: () => callModel(3)
    });
    const exactPlan = await buildAgentPlanWithModel("生成四张系列海报", { variantCount: 4 }, {
      callModel: () => callModel(4)
    });

    expect(shortPlan.source).toBe("deterministic-agent-workspace-mvp");
    expect(shortPlan.variants).toHaveLength(4);
    expect(exactPlan.source).toBe("model-enriched-agent-plan");
    expect(exactPlan.variants).toHaveLength(4);
  });

  it("aborts a slow model call and returns the deterministic fallback before the request deadline", async () => {
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

    expect(aborted).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(plan.source).toBe("deterministic-agent-workspace-mvp");
    expect(plan.variants).toHaveLength(3);
  });
});
