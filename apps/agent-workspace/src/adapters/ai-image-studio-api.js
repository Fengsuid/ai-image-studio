export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function readCsrfCookie(cookieSource = document.cookie) {
  return cookieSource
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrf="))
    ?.slice("csrf=".length) ?? "";
}

export async function apiFetch(path, options = {}) {
  if (!path.startsWith("/api/")) {
    throw new Error("Agent workspace API calls must target ai-image-studio /api routes.");
  }

  const method = options.method?.toUpperCase() ?? "GET";
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readCsrfCookie();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });
  const payload = options.parseJson === false ? null : await parseJsonResponse(response);

  if (!response.ok) {
    throw new ApiError(`Agent workspace API request failed with HTTP ${response.status}`, response.status, payload);
  }
  return payload;
}

export function getCurrentAuth() {
  return apiFetch("/api/auth/me");
}

export function listAgentSessions({ limit = 30 } = {}) {
  return apiFetch(`/api/agent-sessions?limit=${encodeURIComponent(String(limit))}`);
}

export function createAgentSession(payload = {}) {
  return apiFetch("/api/agent-sessions", jsonRequest("POST", {
    title: payload.title || "Agent session",
    sourceType: "agent-workspace",
    sourceId: payload.sourceId || "",
    summary: payload.summary || "",
    data: payload.data || {}
  }));
}

export function getAgentSession(sessionId) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}`);
}

export function updateAgentSession(sessionId, patch) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, jsonRequest("PATCH", patch));
}

export function deleteAgentSession(sessionId) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    parseJson: false
  });
}

export function appendAgentMessage(sessionId, payload) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/messages`, jsonRequest("POST", payload));
}

export function retryAgentStepViaMessage(sessionId, stepId, payload = {}) {
  return appendAgentMessage(sessionId, {
    action: "retry_step",
    retryStepId: stepId,
    content: payload.content || `重试 Agent 步骤 ${stepId}`,
    note: payload.note || ""
  });
}

export function retryAgentStep(sessionId, stepId, payload = {}) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/steps/${encodeURIComponent(stepId)}/retry`, jsonRequest("POST", payload));
}

export function resumeAgentSession(sessionId) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/resume`, jsonRequest("POST", {}));
}

export async function exportAgentSessionZip(sessionId) {
  const response = await fetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/export?format=zip`, {
    method: "GET",
    headers: { Accept: "application/zip" },
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = await parseJsonResponse(response).catch(() => null);
    throw new ApiError(payload?.error || `Agent session ZIP export failed with HTTP ${response.status}`, response.status, payload);
  }
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("Content-Disposition")) || `agent-session-${sessionId}.zip`,
  };
}

export function createAgentPlan(sessionId, payload) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, jsonRequest("POST", payload));
}

export function confirmAgentPlan(sessionId, payload) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/plan`, jsonRequest("POST", {
    action: "confirm",
    ...payload
  }));
}

export function generateAgentBatch(sessionId, payload) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/generate`, jsonRequest("POST", payload));
}

export function exportAgentCanvas(sessionId, payload) {
  return apiFetch(`/api/agent-sessions/${encodeURIComponent(sessionId)}/export-canvas`, jsonRequest("POST", payload));
}

function filenameFromDisposition(value) {
  const match = String(value || "").match(/filename="?([^";]+)"?/i);
  return match ? match[1] : "";
}

function jsonRequest(method, payload) {
  return {
    method,
    body: JSON.stringify(payload ?? {}),
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError("Agent workspace API returned invalid JSON.", response.status, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
