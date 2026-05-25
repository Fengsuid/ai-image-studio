"use strict";

const { getLimit, requireAdmin } = require("./shared");

function generationDiagnosticPayload(diagnostic) {
  return {
    request: {
      ...diagnostic.request,
      imageUrl: diagnostic.request.firstGenerationId ? `/api/images/${diagnostic.request.firstGenerationId}/file` : ""
    },
    trace: diagnostic.trace
  };
}

function createAdminGenerationsRoute(deps) {
  const { store, sendJson, readJsonBody, httpError, writeAdminAudit } = deps;

  return async function handleAdminGenerationsRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/generations") {
      await requireAdmin(deps, req);
      const filters = {
        status: url.searchParams.get("status") || "",
        provider: url.searchParams.get("provider") || "",
        model: url.searchParams.get("model") || "",
        user: url.searchParams.get("user") || "",
        errorStage: url.searchParams.get("errorStage") || "",
        dateFrom: url.searchParams.get("dateFrom") || "",
        dateTo: url.searchParams.get("dateTo") || ""
      };
      const records = (await store.listGenerationRequests(getLimit(deps, url, 100, 500), filters)).map((record) => ({
        ...record,
        imageUrl: record.firstGenerationId ? `/api/images/${record.firstGenerationId}/file` : ""
      }));
      sendJson(res, 200, { records });
      return true;
    }

    const generationMatch = url.pathname.match(/^\/api\/admin\/generations\/([^/]+)$/);
    if (generationMatch && req.method === "GET") {
      await requireAdmin(deps, req);
      const diagnostic = await store.getGenerationRequestDiagnostic(generationMatch[1]);
      if (!diagnostic) throw httpError("Generation request not found", 404);
      sendJson(res, 200, generationDiagnosticPayload(diagnostic));
      return true;
    }

    const actionMatch = url.pathname.match(/^\/api\/admin\/generations\/([^/]+)\/(retry|cancel|mark-failed|copy-error)$/);
    if (actionMatch && req.method === "POST") {
      const current = await requireAdmin(deps, req);
      const requestId = actionMatch[1];
      const action = actionMatch[2];
      const body = await readJsonBody(req);
      const request = await store.getGenerationRequestById(requestId);
      if (!request) throw httpError("Generation request not found", 404);

      if (action === "retry") {
        if (!["failed", "cancelled", "expired"].includes(request.status)) throw httpError("Only failed, cancelled, or expired requests can be retried", 409);
        if (!request.queuePayloadJson) throw httpError("Generation request has no recoverable queue payload", 409);
        await store.updateGenerationRequest(request.id, {
          status: "pending",
          queueStatus: "queued",
          errorMessage: "",
          errorCode: "",
          errorStage: "",
          failureStage: "",
          lockedBy: null,
          lockedAt: null,
          retryAfterAt: null,
          maxAttempts: Math.max(Number(request.maxAttempts || 1), Number(request.attemptCount || 0) + 1)
        });
        const retryRequest = await store.getGenerationRequestById(request.id);
        const job = await deps.recoveredGenerationJobFromRequest(retryRequest);
        if (!job) throw httpError("Generation request cannot be retried", 409);
        deps.enqueueGenerationJob(job, { persistQueued: false });
        await deps.traceGeneration(request.id, "admin_retry_queued", {
          userId: current.user.id,
          level: "warn",
          message: "admin queued generation request retry",
          data: { previousStatus: request.status, note: String(body.note || "").slice(0, 255) }
        });
        await writeAdminAudit(current, req, "generation_request_retry", "generation_request", request.id, { previousStatus: request.status });
      }

      if (action === "cancel") {
        if (!["pending", "running"].includes(request.status)) throw httpError("Only pending or running requests can be cancelled", 409);
        const queued = deps.cancelQueuedGenerationJob(request.id);
        if (!queued) throw httpError("Only queued requests can be cancelled safely", 409);
        await store.updateGenerationRequest(request.id, { status: "cancelled", errorMessage: "admin cancelled", errorCode: "admin_cancelled", errorStage: "queue" });
        await deps.traceGeneration(request.id, "admin_cancelled", {
          userId: current.user.id,
          level: "warn",
          message: "admin cancelled generation request",
          data: { queued, note: String(body.note || "").slice(0, 255) }
        });
        await writeAdminAudit(current, req, "generation_request_cancel", "generation_request", request.id, { queued });
      }

      if (action === "mark-failed") {
        if (["succeeded", "success"].includes(request.status)) throw httpError("Succeeded requests cannot be marked failed", 409);
        const queued = ["pending", "running"].includes(request.status) ? deps.cancelQueuedGenerationJob(request.id) : false;
        if (["pending", "running"].includes(request.status) && !queued) throw httpError("Running requests cannot be marked failed safely", 409);
        const note = String(body.note || "admin marked failed").slice(0, 512);
        await store.updateGenerationRequest(request.id, { status: "failed", errorMessage: note, errorCode: "admin_marked_failed", errorStage: "admin" });
        await deps.traceGeneration(request.id, "admin_marked_failed", {
          userId: current.user.id,
          level: "warn",
          message: note,
          data: { previousStatus: request.status, queued }
        });
        await writeAdminAudit(current, req, "generation_request_mark_failed", "generation_request", request.id, { previousStatus: request.status, queued });
      }

      if (action === "copy-error") {
        await deps.traceGeneration(request.id, "admin_error_summary_copied", {
          userId: current.user.id,
          message: "admin copied generation error summary",
          data: { errorStage: request.errorStage || request.failureStage || "", errorCode: request.errorCode || "" }
        });
        await writeAdminAudit(current, req, "generation_request_copy_error", "generation_request", request.id, {
          errorStage: request.errorStage || request.failureStage || "",
          errorCode: request.errorCode || ""
        });
      }

      sendJson(res, 200, generationDiagnosticPayload(await store.getGenerationRequestDiagnostic(request.id)));
      return true;
    }

    return false;
  };
}

module.exports = { createAdminGenerationsRoute };
