const TERMINAL_QUEUE_STATUSES = new Set(["succeeded", "failed", "cancelled", "expired"]);
const TERMINAL_REQUEST_STATUSES = new Set(["success", "succeeded", "failed", "cancelled", "expired"]);

function dateMs(value) {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function parseQueuePayload(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function serializeQueuePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  return JSON.stringify({
    version: 1,
    ...payload
  });
}

function inferQueueStatus(request = {}) {
  const queueStatus = String(request.queueStatus || request.queue_status || "").trim();
  if (queueStatus) return queueStatus;
  const status = String(request.status || "").trim();
  if (status === "success") return "succeeded";
  if (status === "pending") return "queued";
  if (status === "running") return "running";
  return status || "queued";
}

function isTerminalQueueRequest(request = {}) {
  return TERMINAL_QUEUE_STATUSES.has(inferQueueStatus(request)) ||
    TERMINAL_REQUEST_STATUSES.has(String(request.status || ""));
}

function queuePayloadForTextGeneration({
  userId,
  request,
  openaiRequest,
  totalCost,
  costPerImage,
  requestStartedAt
}) {
  return serializeQueuePayload({
    kind: "text-generation",
    userId,
    request,
    openaiRequest,
    totalCost,
    costPerImage,
    requestStartedAt
  });
}

function queuePayloadForImageEdit({
  userId,
  request,
  payload,
  totalCost,
  costPerImage,
  requestStartedAt
}) {
  return serializeQueuePayload({
    kind: "image-edit",
    userId,
    request,
    payload,
    totalCost,
    costPerImage,
    requestStartedAt
  });
}

function buildStartupRecoveryPatch(request, {
  now = new Date(),
  staleRunningMs = 10 * 60 * 1000,
  staleQueuedMs = 60 * 60 * 1000
} = {}) {
  if (!request || isTerminalQueueRequest(request)) return null;
  const status = inferQueueStatus(request);
  const nowMs = dateMs(now) || Date.now();
  const touchedMs = dateMs(request.lockedAt || request.locked_at || request.updatedAt || request.updated_at || request.createdAt || request.created_at);
  const createdMs = dateMs(request.createdAt || request.created_at);
  const attemptCount = Number(request.attemptCount ?? request.attempt_count ?? 0) || 0;
  const maxAttempts = Math.max(1, Number(request.maxAttempts ?? request.max_attempts ?? 1) || 1);
  const payload = parseQueuePayload(request.queuePayloadJson || request.queue_payload_json);
  const isStaleRunning = status === "running" && (!touchedMs || nowMs - touchedMs >= staleRunningMs);
  const isStaleQueued = status === "queued" && createdMs && nowMs - createdMs >= staleQueuedMs;

  if ((isStaleRunning || isStaleQueued) && (!payload || attemptCount >= maxAttempts)) {
    return {
      status: "expired",
      queueStatus: "expired",
      errorMessage: isStaleRunning
        ? "generation queue running job expired during startup recovery"
        : "generation queue queued job expired during startup recovery",
      failureStage: "queue_recovery",
      lockedBy: null,
      lockedAt: null,
      finishedAt: now,
      latencyMs: createdMs ? Math.max(0, nowMs - createdMs) : null
    };
  }

  if (isStaleRunning && payload && attemptCount < maxAttempts) {
    return {
      status: "pending",
      queueStatus: "queued",
      errorMessage: "",
      failureStage: "",
      lockedBy: null,
      lockedAt: null,
      retryAfterAt: null
    };
  }

  return null;
}

function summarizeRecovery(requests = [], options = {}) {
  const patches = [];
  for (const request of requests) {
    const patch = buildStartupRecoveryPatch(request, options);
    if (patch) patches.push({ id: request.id, patch });
  }
  return {
    scanned: requests.length,
    patched: patches.length,
    patches
  };
}

module.exports = {
  TERMINAL_QUEUE_STATUSES,
  TERMINAL_REQUEST_STATUSES,
  buildStartupRecoveryPatch,
  inferQueueStatus,
  isTerminalQueueRequest,
  parseQueuePayload,
  queuePayloadForImageEdit,
  queuePayloadForTextGeneration,
  serializeQueuePayload,
  summarizeRecovery
};
