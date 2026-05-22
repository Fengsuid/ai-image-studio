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

function createAgentSessionRoute({
  ensureAuthenticated,
  getCurrentUser,
  httpError,
  randomId,
  readJsonBody,
  sanitizePositiveInt,
  sendJson,
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
      const session = await store.getAgentSessionForUser(sessionMatch[1], current.user.id);
      if (!session) throw httpError("Agent session not found", 404);
      sendJson(res, 200, { session });
      return true;
    }

    if (sessionMatch && req.method === "PATCH") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const patch = cleanAgentSessionInput(body, { partial: true });
      const session = await store.updateAgentSessionForUser(sessionMatch[1], current.user.id, patch);
      if (!session) throw httpError("Agent session not found", 404);
      sendJson(res, 200, { session });
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

    const messageMatch = url.pathname.match(/^\/api\/agent-sessions\/([^/]+)\/messages$/);
    if (messageMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const body = await readJsonBody(req);
      const input = cleanAgentMessageInput(body);
      const session = await store.createAgentMessageForUser(messageMatch[1], current.user.id, {
        id: randomId("ams_"),
        ...input,
        steps: input.steps.map((step) => ({ id: randomId("ast_"), ...step }))
      });
      if (!session) throw httpError("Agent session not found", 404);
      sendJson(res, 201, { session });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAgentSessionRoute
};
