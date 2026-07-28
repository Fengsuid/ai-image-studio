const { buildAgentPlanWithModel, summarizeAgentPlan } = require("./planner");

function cleanText(value, { max = 1000, fallback = "" } = {}) {
  const text = String(value || "").trim();
  return (text || fallback).slice(0, max);
}

function cleanAgentPlanRequest(body = {}) {
  return {
    message: cleanText(body.message || body.content || body.prompt, { max: 2000 }),
    variantCount: Math.max(2, Math.min(4, Number.parseInt(body.variantCount || body.count || "4", 10) || 4)),
    size: cleanText(body.size, { max: 32 }),
    quality: cleanText(body.quality, { max: 32 })
  };
}

function cleanAgentPlanConfirmation(body = {}) {
  return {
    selectedVariantIds: Array.isArray(body.selectedVariantIds)
      ? body.selectedVariantIds.map((item) => cleanText(item, { max: 64 })).filter(Boolean).slice(0, 4)
      : [],
    note: cleanText(body.note, { max: 1000 })
  };
}

function latestPlanRecordFromSession(session = {}) {
  const steps = Array.isArray(session.steps) ? session.steps : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const output = steps[index]?.output;
    if (steps[index]?.kind === "plan" && output?.format === "ai-image-studio.agent-plan.v1") {
      return { index, step: steps[index], plan: output };
    }
  }
  return null;
}

function latestPlanFromSession(session = {}) {
  return latestPlanRecordFromSession(session)?.plan || null;
}

function selectPlanVariants(plan = {}, selectedVariantIds = []) {
  const variants = Array.isArray(plan.variants) ? plan.variants : [];
  const requestedIds = [...new Set(
    (selectedVariantIds || []).map((id) => cleanText(id, { max: 64 })).filter(Boolean)
  )];
  const variantsById = new Map(variants.map((variant) => [cleanText(variant?.id, { max: 64 }), variant]));
  const invalidVariantIds = requestedIds.filter((id) => !variantsById.has(id));
  const selected = requestedIds.length ? requestedIds.map((id) => variantsById.get(id)).filter(Boolean) : variants;
  const bounded = selected.slice(0, 4);
  return {
    variants: bounded,
    selectedVariantIds: bounded.map((variant) => cleanText(variant?.id, { max: 64 })).filter(Boolean),
    invalidVariantIds
  };
}

function selectedPlanVariants(plan = {}, selectedVariantIds = []) {
  return selectPlanVariants(plan, selectedVariantIds).variants;
}

function confirmedPlanFromSession(session = {}) {
  const record = latestPlanRecordFromSession(session);
  if (!record?.step?.id) return null;
  const steps = Array.isArray(session.steps) ? session.steps : [];
  for (let index = steps.length - 1; index > record.index; index -= 1) {
    const step = steps[index];
    if (step?.kind !== "plan_confirmed" || step?.status !== "succeeded") continue;
    if (step.output?.planStepId !== record.step.id) continue;
    const selection = selectPlanVariants(
      record.plan,
      step.output?.selectedVariantIds || step.input?.selectedVariantIds || []
    );
    if (selection.invalidVariantIds.length || selection.variants.length < 2 || selection.variants.length > 4) continue;
    return {
      plan: record.plan,
      planStepId: record.step.id,
      variants: selection.variants,
      selectedVariantIds: selection.selectedVariantIds
    };
  }
  return null;
}

function assertReadableAgentSession(session, userId, httpError) {
  if (!session || session.userId !== userId || session.status === "deleted" || session.deletedAt) {
    throw httpError("Agent session not found", 404);
  }
  return session;
}

async function maybeDecorateSession(session, decorateAgentSession) {
  if (!session || typeof decorateAgentSession !== "function") return session;
  return decorateAgentSession(session);
}

function createAgentPlanRoute({
  ensureAuthenticated,
  getCurrentUser,
  httpError,
  randomId,
  readJsonBody,
  sendJson,
  decorateAgentSession,
  generateAgentBatch,
  store,
  callModel
}) {
  return async function handleAgentPlanRoute(req, res, url) {
    const planMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/plan$/);
    if (planMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);

      if (body?.action === "confirm") {
        const confirmation = cleanAgentPlanConfirmation(body);
        const baseSession = assertReadableAgentSession(
          await store.getAgentSessionForUser(planMatch[1], current.user.id),
          current.user.id,
          httpError
        );
        const planRecord = latestPlanRecordFromSession(baseSession);
        if (!planRecord?.step?.id) throw httpError("Create an Agent plan before confirming it", 409);
        const selection = selectPlanVariants(planRecord.plan, confirmation.selectedVariantIds);
        if (selection.invalidVariantIds.length) throw httpError("Agent plan selection contains unknown variants", 400);
        if (selection.variants.length < 2 || selection.variants.length > 4) {
          throw httpError("Please select 2 to 4 Agent plan variants", 400);
        }
        const session = assertReadableAgentSession(
          await store.createAgentMessageForUser(planMatch[1], current.user.id, {
            id: randomId("ams_"),
            role: "assistant",
            content: "已确认计划。点击批量生成后，选中的每个方案会各自进入生成队列并按现有规则扣积分。",
            attachments: [],
            steps: [{
              id: randomId("ast_"),
              kind: "plan_confirmed",
              status: "succeeded",
              input: {
                planStepId: planRecord.step.id,
                selectedVariantIds: selection.selectedVariantIds,
                note: confirmation.note
              },
              output: {
                plan: planRecord.plan,
                planStepId: planRecord.step.id,
                selectedVariantIds: selection.selectedVariantIds,
                confirmationRequired: false,
                willCreateGenerations: false,
                nextAction: "batch_generation_available"
              }
            }]
          }),
          current.user.id,
          httpError
        );
        sendJson(res, 200, {
          session: await maybeDecorateSession(session, decorateAgentSession),
          confirmed: true,
          willCreateGenerations: false
        });
        return true;
      }

      const request = cleanAgentPlanRequest(body);
      const plan = await buildAgentPlanWithModel(request.message, request, { callModel });
      const userSession = assertReadableAgentSession(
        await store.createAgentMessageForUser(planMatch[1], current.user.id, {
          id: randomId("ams_"), role: "user", content: request.message, attachments: [], steps: []
        }),
        current.user.id,
        httpError
      );
      const session = assertReadableAgentSession(
        await store.createAgentMessageForUser(planMatch[1], current.user.id, {
          id: randomId("ams_"),
          role: "assistant",
          content: summarizeAgentPlan(plan),
          attachments: [{ kind: "agent_plan", format: plan.format }],
          steps: [{
            id: randomId("ast_"), kind: "plan", status: "succeeded", input: request, output: plan
          }]
        }),
        current.user.id,
        httpError
      );
      sendJson(res, 200, {
        session: await maybeDecorateSession(session, decorateAgentSession), previousSession: userSession, plan
      });
      return true;
    }

    const generateMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/generate$/);
    if (!generateMatch || req.method !== "POST") return false;
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    if (typeof generateAgentBatch !== "function") throw httpError("Agent generation is not configured", 501);
    const body = await readJsonBody(req);
    const baseSession = assertReadableAgentSession(
      await store.getAgentSessionForUser(generateMatch[1], current.user.id),
      current.user.id,
      httpError
    );
    const confirmation = confirmedPlanFromSession(baseSession);
    if (!confirmation) throw httpError("Confirm the latest Agent plan before generation", 409);
    const requested = Array.isArray(body.selectedVariantIds) && body.selectedVariantIds.length
      ? selectPlanVariants(confirmation.plan, body.selectedVariantIds)
      : {
          variants: confirmation.variants,
          selectedVariantIds: confirmation.selectedVariantIds,
          invalidVariantIds: []
        };
    if (requested.invalidVariantIds.length) throw httpError("Agent plan selection contains unknown variants", 400);
    const confirmedIds = new Set(confirmation.selectedVariantIds);
    if (requested.selectedVariantIds.some((id) => !confirmedIds.has(id))) {
      throw httpError("Confirm the selected Agent plan variants before generation", 409);
    }
    if (requested.variants.length < 2 || requested.variants.length > 4) {
      throw httpError("Please select 2 to 4 Agent plan variants", 400);
    }
    const result = await generateAgentBatch({
      currentUser: current.user,
      session: baseSession,
      plan: confirmation.plan,
      variants: requested.variants,
      body,
      req
    });
    const session = assertReadableAgentSession(
      await store.createAgentMessageForUser(generateMatch[1], current.user.id, {
        id: randomId("ams_"),
        role: "assistant",
        content: result.dryRun
          ? `已完成批量生成 dry run：${result.requests.length} 个独立请求已写入诊断记录，未调用 provider。`
          : `已提交 ${result.requests.length} 个独立生成请求。每张图会独立排队、扣费、追踪和失败处理。`,
        attachments: [{ kind: "agent_batch_generation", requestCount: result.requests.length, dryRun: result.dryRun }],
        steps: result.requests.map((request) => ({
          id: randomId("ast_"),
          kind: "generate_batch",
          status: result.dryRun ? "skipped" : "pending",
          requestId: request.id,
          input: request.variant,
          output: { request, dryRun: result.dryRun, willCreateGenerations: !result.dryRun }
        }))
      }),
      current.user.id,
      httpError
    );
    sendJson(res, result.dryRun ? 200 : 202, {
      session: await maybeDecorateSession(session, decorateAgentSession), ...result
    });
    return true;
  };
}

module.exports = {
  confirmedPlanFromSession,
  createAgentPlanRoute,
  latestPlanFromSession,
  selectedPlanVariants,
  selectPlanVariants
};
