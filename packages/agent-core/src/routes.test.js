const { buildAgentPlan } = require("./planner");
const { confirmedPlanFromSession } = require("./plan-routes");
const { createAgentSessionRoute } = require("./routes");

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function planStep(plan, id = "ast_plan_1") {
  return { id, kind: "plan", status: "succeeded", input: {}, output: plan };
}

function confirmationStep(planId, selectedVariantIds) {
  return {
    id: "ast_confirm_1",
    kind: "plan_confirmed",
    status: "succeeded",
    input: { planStepId: planId, selectedVariantIds },
    output: { planStepId: planId, selectedVariantIds }
  };
}

function sessionWithSteps(steps) {
  return {
    id: "asn_1",
    userId: "usr_1",
    status: "active",
    createdAt: "2026-07-28T00:00:00.000Z",
    steps
  };
}

function routeHarness({ session, body, generateAgentBatch }) {
  const messages = [];
  const responses = [];
  const handler = createAgentSessionRoute({
    ensureAuthenticated() {},
    getCurrentUser: async () => ({ user: { id: "usr_1" } }),
    httpError,
    randomId: (prefix) => `${prefix}test`,
    readJsonBody: async () => body,
    sanitizePositiveInt: (value, fallback) => Number.parseInt(value, 10) || fallback,
    sendJson: (res, status, payload) => responses.push({ status, payload }),
    decorateAgentSession: async (value) => value,
    generateAgentBatch,
    store: {
      getAgentSessionForUser: async () => session,
      createAgentMessageForUser: async (sessionId, userId, message) => {
        messages.push(message);
        return sessionWithSteps([...session.steps, ...(message.steps || [])]);
      }
    }
  });
  return { handler, messages, responses };
}

describe("agent plan confirmation gate", () => {
  it("does not treat an unconfirmed or stale plan as confirmed", () => {
    const firstPlan = buildAgentPlan("第一版海报", { variantCount: 2 });
    const firstStep = planStep(firstPlan);
    expect(confirmedPlanFromSession(sessionWithSteps([firstStep]))).toBeNull();

    const confirmed = confirmationStep(firstStep.id, firstPlan.variants.map((variant) => variant.id));
    expect(confirmedPlanFromSession(sessionWithSteps([firstStep, confirmed]))?.plan).toBe(firstPlan);

    const secondPlan = buildAgentPlan("第二版海报", { variantCount: 2 });
    expect(confirmedPlanFromSession(sessionWithSteps([
      firstStep,
      confirmed,
      planStep(secondPlan, "ast_plan_2")
    ]))).toBeNull();
  });

  it("rejects direct generation when the latest plan has not been confirmed", async () => {
    const plan = buildAgentPlan("未确认计划", { variantCount: 2 });
    let generationCalled = false;
    const harness = routeHarness({
      session: sessionWithSteps([planStep(plan)]),
      body: { plan, selectedVariantIds: plan.variants.map((variant) => variant.id), dryRun: true },
      generateAgentBatch: async () => {
        generationCalled = true;
        return { dryRun: true, requests: [] };
      }
    });

    await expect(harness.handler(
      { method: "POST", headers: {}, socket: {} },
      {},
      new URL("http://localhost/api/agent-sessions/asn_1/generate")
    )).rejects.toMatchObject({ status: 409 });
    expect(generationCalled).toBe(false);
  });

  it("binds confirmation and generation to the server-side latest plan", async () => {
    const plan = buildAgentPlan("服务端计划", { variantCount: 3 });
    const selectedVariantIds = plan.variants.slice(0, 2).map((variant) => variant.id);
    const maliciousPlan = buildAgentPlan("客户端替换计划", { variantCount: 2 });
    const baseSession = sessionWithSteps([planStep(plan)]);
    const confirmHarness = routeHarness({
      session: baseSession,
      body: { action: "confirm", plan: maliciousPlan, selectedVariantIds },
      generateAgentBatch: async () => ({ dryRun: true, requests: [] })
    });

    await confirmHarness.handler(
      { method: "POST", headers: {}, socket: {} },
      {},
      new URL("http://localhost/api/agent-sessions/asn_1/plan")
    );
    const confirmedStep = confirmHarness.messages[0].steps[0];
    expect(confirmedStep.output.plan).toBe(plan);
    expect(confirmedStep.output.planStepId).toBe("ast_plan_1");
    expect(confirmedStep.output.selectedVariantIds).toEqual(selectedVariantIds);

    const confirmedSession = sessionWithSteps([
      planStep(plan),
      confirmationStep("ast_plan_1", selectedVariantIds)
    ]);
    let generationInput = null;
    const generateHarness = routeHarness({
      session: confirmedSession,
      body: { plan: maliciousPlan, selectedVariantIds, dryRun: true },
      generateAgentBatch: async (input) => {
        generationInput = input;
        return { dryRun: true, requests: [] };
      }
    });

    await generateHarness.handler(
      { method: "POST", headers: {}, socket: {} },
      {},
      new URL("http://localhost/api/agent-sessions/asn_1/generate")
    );
    expect(generationInput.plan).toBe(plan);
    expect(generationInput.variants.map((variant) => variant.id)).toEqual(selectedVariantIds);

    let unconfirmedGenerationCalled = false;
    const unconfirmedHarness = routeHarness({
      session: confirmedSession,
      body: { selectedVariantIds: plan.variants.map((variant) => variant.id), dryRun: true },
      generateAgentBatch: async () => {
        unconfirmedGenerationCalled = true;
        return { dryRun: true, requests: [] };
      }
    });
    await expect(unconfirmedHarness.handler(
      { method: "POST", headers: {}, socket: {} },
      {},
      new URL("http://localhost/api/agent-sessions/asn_1/generate")
    )).rejects.toMatchObject({ status: 409 });
    expect(unconfirmedGenerationCalled).toBe(false);
  });
});
