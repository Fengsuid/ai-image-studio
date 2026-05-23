"use strict";

function createGenerationStore({ getPool, toIso, safeJsonSummary, normalizeTraceLevel }) {
  function parseJsonObject(value, fallback = {}) {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function mapGenerationRequest(row) {
    if (!row) return null;
    let generationIds = [];
    if (row.generation_ids) {
      try {
        generationIds = JSON.parse(row.generation_ids);
      } catch {
        generationIds = [];
      }
    }
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name || "",
      userEmail: row.user_email || "",
      prompt: row.prompt,
      ipAddress: row.ip_address || "",
      userAgent: row.user_agent || "",
      isPublic: Boolean(row.is_public ?? 0),
      status: row.status,
      errorMessage: row.error_message || "",
      firstGenerationId: row.first_generation_id || "",
      generationIds,
      queueStatus: row.queue_status || "",
      attemptCount: Number(row.attempt_count || 0),
      maxAttempts: Number(row.max_attempts || 1),
      lockedBy: row.locked_by || "",
      lockedAt: toIso(row.locked_at),
      startedAt: toIso(row.started_at),
      finishedAt: toIso(row.finished_at),
      providerTaskId: row.provider_task_id || "",
      nextPollAt: toIso(row.next_poll_at),
      retryAfterAt: toIso(row.retry_after_at),
      latencyMs: row.latency_ms === null || row.latency_ms === undefined ? null : Number(row.latency_ms),
      failureStage: row.failure_stage || "",
      jobType: row.job_type || "",
      queuePayloadJson: row.queue_payload_json || "",
      requestedParams: parseJsonObject(row.requested_params_json, null),
      normalizedParams: parseJsonObject(row.normalized_params_json, null),
      providerParams: parseJsonObject(row.provider_params_json, null),
      providerResponse: parseJsonObject(row.provider_response_json, null),
      revisedPrompt: row.revised_prompt || "",
      errorCode: row.error_code || "",
      errorStage: row.error_stage || "",
      model: row.model || "",
      filename: row.filename || "",
      durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    };
  }

  function mapGenerationTrace(row) {
    if (!row) return null;
    return {
      id: Number(row.id || 0),
      requestId: row.request_id || "",
      generationId: row.generation_id || "",
      userId: row.user_id || "",
      stage: row.stage || "",
      level: row.level || "info",
      message: row.message || "",
      data: parseJsonObject(row.data_json, null),
      createdAt: toIso(row.created_at)
    };
  }

  async function insertGenerationRequest(request) {
    const createdAt = new Date();
    await getPool().execute(
      `INSERT INTO generation_requests
        (id, user_id, prompt, ip_address, user_agent, is_public, status, queue_status, attempt_count, max_attempts,
         locked_by, locked_at, started_at, finished_at, provider_task_id, next_poll_at, retry_after_at, latency_ms,
         failure_stage, job_type, queue_payload_json, requested_params_json, normalized_params_json, provider_params_json,
         provider_response_json, revised_prompt, error_code, error_stage, error_message, first_generation_id, generation_ids,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.id,
        request.userId,
        request.prompt,
        request.ipAddress || "",
        request.userAgent || "",
        request.isPublic ? 1 : 0,
        request.status || "pending",
        request.queueStatus || (request.status === "running" ? "running" : "queued"),
        Math.max(0, Number(request.attemptCount || 0)),
        Math.max(1, Number(request.maxAttempts || 1)),
        request.lockedBy || null,
        request.lockedAt || null,
        request.startedAt || null,
        request.finishedAt || null,
        request.providerTaskId || null,
        request.nextPollAt || null,
        request.retryAfterAt || null,
        request.latencyMs === null || request.latencyMs === undefined ? null : Math.max(0, Number(request.latencyMs) || 0),
        request.failureStage || null,
        request.jobType || null,
        request.queuePayloadJson || (request.queuePayload ? JSON.stringify(request.queuePayload) : null),
        request.requestedParams ? JSON.stringify(safeJsonSummary(request.requestedParams)) : null,
        request.normalizedParams ? JSON.stringify(safeJsonSummary(request.normalizedParams)) : null,
        request.providerParams ? JSON.stringify(safeJsonSummary(request.providerParams)) : null,
        request.providerResponse ? JSON.stringify(safeJsonSummary(request.providerResponse)) : null,
        request.revisedPrompt || null,
        request.errorCode || null,
        request.errorStage || null,
        request.errorMessage || null,
        request.firstGenerationId || null,
        request.generationIds ? JSON.stringify(request.generationIds) : null,
        createdAt,
        createdAt
      ]
    );
  }

  async function updateGenerationRequest(id, patch) {
    // Do not let late client aborts overwrite an already committed successful request.
    if (patch?.status === "cancelled") {
      const [existing] = await getPool().execute(
        "SELECT status FROM generation_requests WHERE id = ? LIMIT 1",
        [id]
      );
      const currentStatus = existing?.[0]?.status;
      if (currentStatus === "success" || currentStatus === "succeeded") {
        return;
      }
    }
    if (patch && Object.hasOwn(patch, "status") && !Object.hasOwn(patch, "queueStatus")) {
      if (patch.status === "success" || patch.status === "succeeded") patch.queueStatus = "succeeded";
      else if (patch.status === "running") patch.queueStatus = "running";
      else if (patch.status === "pending") patch.queueStatus = "queued";
      else if (["failed", "cancelled", "expired"].includes(patch.status)) patch.queueStatus = patch.status;
    }
    if (patch && Object.hasOwn(patch, "durationMs") && !Object.hasOwn(patch, "latencyMs")) {
      patch.latencyMs = patch.durationMs;
    }
    if (patch?.status === "running" && !Object.hasOwn(patch, "startedAt")) {
      patch.startedAt = new Date();
    }
    if (["success", "succeeded", "failed", "cancelled", "expired"].includes(String(patch?.status || "")) && !Object.hasOwn(patch, "finishedAt")) {
      patch.finishedAt = new Date();
    }
    const columns = [];
    const values = [];
    const mapping = {
      status: "status",
      queueStatus: "queue_status",
      attemptCount: "attempt_count",
      maxAttempts: "max_attempts",
      lockedBy: "locked_by",
      lockedAt: "locked_at",
      startedAt: "started_at",
      finishedAt: "finished_at",
      providerTaskId: "provider_task_id",
      nextPollAt: "next_poll_at",
      retryAfterAt: "retry_after_at",
      latencyMs: "latency_ms",
      failureStage: "failure_stage",
      jobType: "job_type",
      queuePayloadJson: "queue_payload_json",
      revisedPrompt: "revised_prompt",
      errorCode: "error_code",
      errorStage: "error_stage",
      errorMessage: "error_message",
      firstGenerationId: "first_generation_id",
      durationMs: "duration_ms"
    };

    for (const [key, column] of Object.entries(mapping)) {
      if (Object.hasOwn(patch, key)) {
        columns.push(`${column} = ?`);
        values.push(patch[key]);
      }
    }
    if (Object.hasOwn(patch, "generationIds")) {
      columns.push("generation_ids = ?");
      values.push(JSON.stringify(patch.generationIds || []));
    }
    for (const [key, column] of [
      ["requestedParams", "requested_params_json"],
      ["normalizedParams", "normalized_params_json"],
      ["providerParams", "provider_params_json"],
      ["providerResponse", "provider_response_json"]
    ]) {
      if (Object.hasOwn(patch, key)) {
        columns.push(`${column} = ?`);
        values.push(patch[key] === null || patch[key] === undefined ? null : JSON.stringify(safeJsonSummary(patch[key])));
      }
    }
    if (!columns.length) return;
    columns.push("updated_at = ?");
    values.push(new Date(), id);
    await getPool().execute(`UPDATE generation_requests SET ${columns.join(", ")} WHERE id = ?`, values);
  }

  async function listGenerationRequests(limit = 100, filters = {}) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const where = [];
    const values = [];
    const addLike = (column, value) => {
      const text = String(value || "").trim();
      if (!text) return;
      where.push(`${column} LIKE ?`);
      values.push(`%${text.slice(0, 120)}%`);
    };
    const status = String(filters.status || "").trim();
    if (status && status !== "all") {
      where.push("(gr.status = ? OR gr.queue_status = ?)");
      values.push(status, status);
    }
    addLike("gr.provider_params_json", filters.provider);
    const model = String(filters.model || "").trim();
    if (model) {
      where.push("(g.model LIKE ? OR gr.normalized_params_json LIKE ? OR gr.provider_params_json LIKE ?)");
      values.push(`%${model.slice(0, 120)}%`, `%${model.slice(0, 120)}%`, `%${model.slice(0, 120)}%`);
    }
    const user = String(filters.user || "").trim();
    if (user) {
      where.push("(gr.user_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
      values.push(`%${user.slice(0, 120)}%`, `%${user.slice(0, 120)}%`, `%${user.slice(0, 120)}%`);
    }
    const errorStage = String(filters.errorStage || filters.failureStage || "").trim();
    if (errorStage) {
      where.push("(gr.error_stage = ? OR gr.failure_stage = ?)");
      values.push(errorStage, errorStage);
    }
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : null;
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      where.push("gr.created_at >= ?");
      values.push(dateFrom);
    }
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      where.push("gr.created_at <= ?");
      values.push(dateTo);
    }
    const [rows] = await getPool().execute(
      `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename
         FROM generation_requests gr
         LEFT JOIN users u ON u.id = gr.user_id
         LEFT JOIN generations g ON g.id = gr.first_generation_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY gr.created_at DESC
        LIMIT ${normalizedLimit}`,
      values
    );
    return rows.map(mapGenerationRequest);
  }

  async function getGenerationRequestById(id) {
    const [rows] = await getPool().execute(
      `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename
         FROM generation_requests gr
         LEFT JOIN users u ON u.id = gr.user_id
         LEFT JOIN generations g ON g.id = gr.first_generation_id
        WHERE gr.id = ? LIMIT 1`,
      [id]
    );
    return mapGenerationRequest(rows[0]);
  }

  async function listActiveGenerationRequestsForUser(userId, limit = 20) {
    const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const [rows] = await getPool().execute(
      `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename
         FROM generation_requests gr
         LEFT JOIN users u ON u.id = gr.user_id
         LEFT JOIN generations g ON g.id = gr.first_generation_id
        WHERE gr.user_id = ? AND gr.status IN ('pending', 'running')
        ORDER BY gr.created_at ASC
        LIMIT ${normalizedLimit}`,
      [userId]
    );
    return rows.map(mapGenerationRequest);
  }

  async function listRecoverableGenerationRequests(limit = 100) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const [rows] = await getPool().execute(
      `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename
         FROM generation_requests gr
         LEFT JOIN users u ON u.id = gr.user_id
         LEFT JOIN generations g ON g.id = gr.first_generation_id
        WHERE gr.status IN ('pending', 'running')
          AND gr.queue_status IN ('queued', 'running', 'failed_retryable')
        ORDER BY gr.created_at ASC
        LIMIT ${normalizedLimit}`
    );
    return rows.map(mapGenerationRequest);
  }

  async function appendGenerationTrace(entry) {
    if (!entry?.requestId || !entry?.stage) return null;
    const [result] = await getPool().execute(
      `INSERT INTO generation_trace
        (request_id, generation_id, user_id, stage, level, message, data_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.requestId,
        entry.generationId || null,
        entry.userId || null,
        String(entry.stage).slice(0, 64),
        normalizeTraceLevel(entry.level),
        String(entry.message || "").slice(0, 512),
        entry.data === null || entry.data === undefined ? null : JSON.stringify(safeJsonSummary(entry.data)),
        entry.createdAt ? new Date(entry.createdAt) : new Date()
      ]
    );
    return {
      id: result.insertId,
      ...entry,
      level: normalizeTraceLevel(entry.level),
      data: safeJsonSummary(entry.data)
    };
  }

  async function listGenerationTraceForRequest(requestId, limit = 200) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const [rows] = await getPool().execute(
      `SELECT * FROM generation_trace
        WHERE request_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT ${normalizedLimit}`,
      [requestId]
    );
    return rows.map(mapGenerationTrace);
  }

  async function getGenerationRequestDiagnostic(id) {
    const request = await getGenerationRequestById(id);
    if (!request) return null;
    const trace = await listGenerationTraceForRequest(id, 300);
    return { request, trace };
  }

  return {
    insertGenerationRequest,
    updateGenerationRequest,
    appendGenerationTrace,
    listGenerationRequests,
    getGenerationRequestById,
    getGenerationRequestDiagnostic,
    listGenerationTraceForRequest,
    listActiveGenerationRequestsForUser,
    listRecoverableGenerationRequests
  };
}

module.exports = createGenerationStore;
