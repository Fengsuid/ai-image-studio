const { buildAgentPlan, summarizeAgentPlan } = require("../agent-planner");

const SESSION_STATUSES = new Set(["active", "archived"]);
const MESSAGE_ROLES = new Set(["user", "assistant", "system", "tool", "agent"]);
const STEP_STATUSES = new Set(["pending", "running", "succeeded", "failed", "cancelled", "skipped"]);

function cleanText(value, { max = 1000, fallback = "" } = {}) {
  const text = String(value || "").trim();
  return (text || fallback).slice(0, max);
}

function cleanAgentSessionInput(body = {}, { partial = false } = {}) {
  const payload = {};
  const title = cleanText(body.title, { max: 160, fallback: "Agent session" });
  if (!partial || Object.hasOwn(body, "title")) payload.title = title;

  if (!partial || Object.hasOwn(body, "sourceType")) {
    payload.sourceType = cleanText(body.sourceType, { max: 32, fallback: "agent" }) || "agent";
  }
  if (!partial || Object.hasOwn(body, "sourceId")) {
    payload.sourceId = cleanText(body.sourceId, { max: 64 });
  }
  if (!partial || Object.hasOwn(body, "summary")) {
    payload.summary = cleanText(body.summary, { max: 4000 });
  }
  if (!partial || Object.hasOwn(body, "data")) {
    payload.data = body.data && typeof body.data === "object" ? body.data : {};
  }
  if (Object.hasOwn(body, "status")) {
    const status = cleanText(body.status, { max: 32, fallback: "active" });
    payload.status = SESSION_STATUSES.has(status) ? status : "active";
  }
  return payload;
}

function cleanAgentSteps(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 50).map((step) => {
    const kind = cleanText(step?.kind, { max: 64, fallback: "note" });
    const status = cleanText(step?.status, { max: 32, fallback: "pending" });
    return {
      kind,
      status: STEP_STATUSES.has(status) ? status : "pending",
      input: step?.input && typeof step.input === "object" ? step.input : null,
      output: step?.output && typeof step.output === "object" ? step.output : null,
      requestId: cleanText(step?.requestId, { max: 64 }),
      generationId: cleanText(step?.generationId, { max: 32 })
    };
  }).filter((step) => step.kind);
}

function cleanAgentMessageInput(body = {}) {
  const role = cleanText(body.role, { max: 32, fallback: "user" });
  const content = cleanText(body.content, { max: 20000 });
  if (!content) {
    const error = new Error("Message content is required");
    error.status = 400;
    throw error;
  }
  return {
    role: MESSAGE_ROLES.has(role) ? role : "user",
    content,
    attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 20) : [],
    steps: cleanAgentSteps(body.steps)
  };
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
    plan: body.plan && typeof body.plan === "object" ? body.plan : {},
    selectedVariantIds: Array.isArray(body.selectedVariantIds)
      ? body.selectedVariantIds.map((item) => cleanText(item, { max: 64 })).filter(Boolean).slice(0, 4)
      : [],
    note: cleanText(body.note, { max: 1000 })
  };
}

function latestPlanFromSession(session = {}) {
  const steps = Array.isArray(session.steps) ? session.steps : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const output = steps[index]?.output;
    if (steps[index]?.kind === "plan" && output?.format === "ai-image-studio.agent-plan.v1") {
      return output;
    }
  }
  return null;
}

function selectedPlanVariants(plan = {}, selectedVariantIds = []) {
  const variants = Array.isArray(plan.variants) ? plan.variants : [];
  const selected = new Set((selectedVariantIds || []).map((id) => cleanText(id, { max: 64 })).filter(Boolean));
  return (selected.size ? variants.filter((variant) => selected.has(variant.id)) : variants).slice(0, 4);
}

async function maybeDecorateSession(session, decorateAgentSession) {
  if (!session || typeof decorateAgentSession !== "function") return session;
  return decorateAgentSession(session);
}

function assertReadableAgentSession(session, userId, httpError) {
  if (!session || session.userId !== userId || session.status === "deleted") {
    throw httpError("Agent session not found", 404);
  }
  return session;
}

function createAgentSessionRoute({
  ensureAuthenticated,
  getCurrentUser,
  httpError,
  randomId,
  readJsonBody,
  sanitizePositiveInt,
  sendJson,
  decorateAgentSession,
  generateAgentBatch,
  exportAgentCanvas,
  store
}) {
  return async function handleAgentSessionRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/agent-sessions") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 50, 200);
      const sessions = await store.listAgentSessionsForUser(current.user.id, { limit });
      sendJson(res, 200, { sessions });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/agent-sessions") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const input = cleanAgentSessionInput(body);
      const session = await store.createAgentSession({
        id: randomId("asn_"),
        userId: current.user.id,
        ...input
      });
      sendJson(res, 201, { session });
      return true;
    }

    const sessionMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)$/);
    if (sessionMatch && req.method === "GET") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const session = assertReadableAgentSession(
        await store.getAgentSessionForUser(sessionMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      sendJson(res, 200, { session: await maybeDecorateSession(session, decorateAgentSession) });
      return true;
    }

    if (sessionMatch && req.method === "PATCH") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const patch = cleanAgentSessionInput(body, { partial: true });
      const session = assertReadableAgentSession(
        await store.updateAgentSessionForUser(sessionMatch[1], current.user.id, patch),
        current.user.id,
        httpError
      );
      sendJson(res, 200, { session: await maybeDecorateSession(session, decorateAgentSession) });
      return true;
    }

    if (sessionMatch && req.method === "DELETE") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const deleted = await store.deleteAgentSessionForUser(sessionMatch[1], current.user.id);
      if (!deleted) throw httpError("Agent session not found", 404);
      sendJson(res, 200, { ok: true });
      return true;
    }

    const planMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/plan$/);
    if (planMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);

      if (body?.action === "confirm") {
        const confirmation = cleanAgentPlanConfirmation(body);
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
                selectedVariantIds: confirmation.selectedVariantIds,
                note: confirmation.note
              },
              output: {
                plan: confirmation.plan,
                confirmationRequired: false,
                willCreateGenerations: false,
                nextAction: "batch_generation_available"
              }
            }]
          }),
          current.user.id,
          httpError
        );
        sendJson(res, 200, { session: await maybeDecorateSession(session, decorateAgentSession), confirmed: true, willCreateGenerations: false });
        return true;
      }

      const request = cleanAgentPlanRequest(body);
      const plan = buildAgentPlan(request.message, request);
      const userSession = assertReadableAgentSession(
        await store.createAgentMessageForUser(planMatch[1], current.user.id, {
          id: randomId("ams_"),
          role: "user",
          content: request.message,
          attachments: [],
          steps: []
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
            id: randomId("ast_"),
            kind: "plan",
            status: "succeeded",
            input: request,
            output: plan
          }]
        }),
        current.user.id,
        httpError
      );
      sendJson(res, 200, { session: await maybeDecorateSession(session, decorateAgentSession), previousSession: userSession, plan });
      return true;
    }

    const generateMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/generate$/);
    if (generateMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      if (typeof generateAgentBatch !== "function") throw httpError("Agent generation is not configured", 501);
      const body = await readJsonBody(req);
      const baseSession = assertReadableAgentSession(
        await store.getAgentSessionForUser(generateMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      const plan = body.plan && typeof body.plan === "object" ? body.plan : latestPlanFromSession(baseSession);
      const variants = selectedPlanVariants(plan, body.selectedVariantIds);
      if (variants.length < 2 || variants.length > 4) {
        throw httpError("Please select 2 to 4 Agent plan variants", 400);
      }
      const result = await generateAgentBatch({
        currentUser: current.user,
        session: baseSession,
        plan,
        variants,
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
            output: {
              request,
              dryRun: result.dryRun,
              willCreateGenerations: !result.dryRun
            }
          }))
        }),
        current.user.id,
        httpError
      );
      sendJson(res, result.dryRun ? 200 : 202, { session: await maybeDecorateSession(session, decorateAgentSession), ...result });
      return true;
    }

    const exportCanvasMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/export-canvas$/);
    if (exportCanvasMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      if (typeof exportAgentCanvas !== "function") throw httpError("Agent canvas export is not configured", 501);
      const body = await readJsonBody(req);
      const baseSession = assertReadableAgentSession(
        await store.getAgentSessionForUser(exportCanvasMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      const result = await exportAgentCanvas({
        currentUser: current.user,
        session: baseSession,
        body
      });
      const session = assertReadableAgentSession(
        await store.createAgentMessageForUser(exportCanvasMatch[1], current.user.id, {
          id: randomId("ams_"),
          role: "assistant",
          content: `已导出为私有 Canvas v2 项目：${result.canvas.title}`,
          attachments: [{ kind: "canvas", id: result.canvas.id }],
          steps: [{
            id: randomId("ast_"),
            kind: "canvas_route_suggestion",
            status: "succeeded",
            input: { sessionId: baseSession.id },
            output: {
              canvasId: result.canvas.id,
              title: result.canvas.title,
              url: result.canvas.url || "",
              nodeCount: result.canvas.nodeCount,
              edgeCount: result.canvas.edgeCount
            }
          }]
        }),
        current.user.id,
        httpError
      );
      sendJson(res, 201, { session: await maybeDecorateSession(session, decorateAgentSession), canvas: result.canvas });
      return true;
    }

    const messageMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/messages$/);
    if (messageMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const input = cleanAgentMessageInput(body);
      const session = assertReadableAgentSession(
        await store.createAgentMessageForUser(messageMatch[1], current.user.id, {
          id: randomId("ams_"),
          ...input,
          steps: input.steps.map((step) => ({ id: randomId("ast_"), ...step }))
        }),
        current.user.id,
        httpError
      );
      sendJson(res, 201, { session: await maybeDecorateSession(session, decorateAgentSession) });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAgentSessionRoute
};
