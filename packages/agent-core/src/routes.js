const { createAgentPlanRoute } = require("./plan-routes");

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

async function maybeDecorateSession(session, decorateAgentSession) {
  if (!session || typeof decorateAgentSession !== "function") return session;
  return decorateAgentSession(session);
}

function assertReadableAgentSession(session, userId, httpError) {
  if (!session || session.userId !== userId || session.status === "deleted" || session.deletedAt) {
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
  resumeAgentSession,
  retryAgentStep,
  exportAgentSessionArchive,
  store,
  callModel
}) {
  const handleAgentPlanRoute = createAgentPlanRoute({
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
  });
  return async function handleAgentSessionRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/agent-sessions") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 50, 200);
      const status = cleanText(url.searchParams.get("status"), { max: 32 });
      const sessions = await store.listAgentSessionsForUser(current.user.id, {
        limit,
        status: SESSION_STATUSES.has(status) ? status : ""
      });
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

    const exportMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/export$/);
    if (exportMatch && req.method === "GET") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      if (typeof exportAgentSessionArchive !== "function") throw httpError("Agent session export is not configured", 501);
      const session = assertReadableAgentSession(
        await store.getAgentSessionForUser(exportMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      const decorated = await maybeDecorateSession(session, decorateAgentSession);
      const format = String(url.searchParams.get("format") || "json").toLowerCase();
      const exported = await exportAgentSessionArchive({
        session: decorated,
        format,
        baseUrl: requestBaseUrl(req),
        fetchHeaders: req.headers?.cookie ? { cookie: req.headers.cookie } : {}
      });
      if (format === "zip") {
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="agent-session-${exportMatch[1]}.zip"`,
          "Cache-Control": "no-store"
        });
        res.end(exported);
      } else {
        sendJson(res, 200, exported);
      }
      return true;
    }

    const resumeMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/resume$/);
    if (resumeMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      if (typeof resumeAgentSession !== "function") throw httpError("Agent session resume is not configured", 501);
      const session = assertReadableAgentSession(
        await store.getAgentSessionForUser(resumeMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      const result = await resumeAgentSession({ currentUser: current.user, session });
      const refreshed = assertReadableAgentSession(
        await store.getAgentSessionForUser(resumeMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      sendJson(res, 200, { session: await maybeDecorateSession(refreshed, decorateAgentSession), ...result });
      return true;
    }

    const stepRetryMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/steps\/([^/]+)\/retry$/);
    if (stepRetryMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      if (typeof retryAgentStep !== "function") throw httpError("Agent step retry is not configured", 501);
      const body = await readJsonBody(req);
      const session = assertReadableAgentSession(
        await store.getAgentSessionForUser(stepRetryMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      const result = await retryAgentStep({
        currentUser: current.user,
        session,
        stepId: stepRetryMatch[2],
        note: cleanText(body.note, { max: 1000 })
      });
      const refreshed = assertReadableAgentSession(
        await store.getAgentSessionForUser(stepRetryMatch[1], current.user.id),
        current.user.id,
        httpError
      );
      sendJson(res, 202, { session: await maybeDecorateSession(refreshed, decorateAgentSession), ...result });
      return true;
    }

    if (await handleAgentPlanRoute(req, res, url)) return true;

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
      const retryStepId = cleanText(body.retryStepId || body.stepId, { max: 64 });
      if (body.action === "retry_step" || retryStepId) {
        if (typeof retryAgentStep !== "function") throw httpError("Agent step retry is not configured", 501);
        const session = assertReadableAgentSession(
          await store.getAgentSessionForUser(messageMatch[1], current.user.id),
          current.user.id,
          httpError
        );
        const result = await retryAgentStep({
          currentUser: current.user,
          session,
          stepId: retryStepId,
          note: cleanText(body.content || body.note, { max: 1000 })
        });
        const updated = assertReadableAgentSession(
          await store.createAgentMessageForUser(messageMatch[1], current.user.id, {
            id: randomId("ams_"),
            role: "user",
            content: cleanText(body.content || `重试 Agent 步骤 ${retryStepId}`, { max: 20000, fallback: `重试 Agent 步骤 ${retryStepId}` }),
            attachments: [{ kind: "agent_step_retry", stepId: retryStepId, requestId: result.retry?.requestId || "" }],
            steps: []
          }),
          current.user.id,
          httpError
        );
        sendJson(res, 202, { session: await maybeDecorateSession(updated, decorateAgentSession), ...result });
        return true;
      }
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

function requestBaseUrl(req) {
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim();
  if (!host) return "";
  const proto = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim()
    || (req.socket?.encrypted ? "https" : "http");
  return `${proto}://${host}`;
}

module.exports = {
  createAgentSessionRoute
};
