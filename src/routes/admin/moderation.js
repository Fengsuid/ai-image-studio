"use strict";

const { getLimit, requireAdmin } = require("./shared");

function serializeGeneration(deps, generation) {
  return {
    ...generation,
    imageUrl: `/api/images/${generation.id}/file`,
    sourceImageUrl: deps.sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
    ...deps.sourceImageAuditFields(generation)
  };
}

async function syncReferenceAssetPublicVisibility(deps, generation) {
  if (typeof deps.store.setReferenceAssetsPublicVisibleForGeneration !== "function" || !generation?.id) return;
  const visible = generation.isPublic && !generation.archived && ["visible", "restored"].includes(generation.moderationStatus || "visible");
  await deps.store.setReferenceAssetsPublicVisibleForGeneration(generation.id, visible);
}

async function reviewPromptAudit(deps, req, res, id) {
  const { store, sendJson, readJsonBody, httpError, writeAdminAudit } = deps;
  const current = await requireAdmin(deps, req);
  const existing = await store.getPromptAuditRecordById(id);
  if (!existing) throw httpError("Prompt audit not found", 404);
  const body = await readJsonBody(req);
  const action = String(body.action || "").trim();
  const note = String(body.note || "").trim().slice(0, 500);
  const updated = await store.reviewPromptAuditRecord(existing.id, { action, note, reviewerUserId: current.user.id });
  await writeAdminAudit(current, req, `prompt_audit_${updated.overrideAction || action || "review"}`, "prompt_audit", String(existing.id), {
    generationId: existing.generationId,
    resultLevel: existing.resultLevel,
    requiredMode: existing.requiredMode,
    note
  });
  sendJson(res, 200, { audit: updated });
}

async function scanPromptDuplicates(deps, req, res) {
  const { store, sendJson, readJsonBody, writeAdminAudit } = deps;
  const current = await requireAdmin(deps, req);
  const body = await readJsonBody(req).catch(() => ({}));
  const result = await store.scanPromptDuplicateCandidates({
    limit: deps.sanitizePositiveInt(body.limit, 2000, 5000),
    hammingThreshold: Math.max(0, Math.min(24, Number.parseInt(body.hammingThreshold, 10) || 6))
  });
  if (body.aiReview) {
    result.aiReviewed = await deps.reviewPendingPromptDuplicates({
      limit: body.aiReviewLimit,
      mock: body.mockAiReview === true
    });
  }
  await writeAdminAudit(current, req, "scan_prompt_duplicates", "prompt", "duplicates", result);
  sendJson(res, 200, result);
}

async function reviewDuplicateWithAi(deps, req, res, id) {
  const { store, sendJson, readJsonBody, httpError, writeAdminAudit } = deps;
  const current = await requireAdmin(deps, req);
  const candidate = await store.getPromptDuplicateCandidateById(id);
  if (!candidate) throw httpError("Duplicate candidate not found", 404);
  const body = await readJsonBody(req).catch(() => ({}));
  const settings = await store.getSettings();
  const review = await deps.promptReview.reviewPromptDuplicateCandidate(candidate, {
    mock: body.mock === true || process.env.PROMPT_REVIEW_MOCK === "1",
    callModel: (payload) => deps.callOpenAITextResponses(settings, payload)
  });
  const updated = await store.updatePromptDuplicateAiReview(candidate.id, review);
  await writeAdminAudit(current, req, "prompt_duplicate_ai_review", "prompt_duplicate", candidate.id, {
    promptId: candidate.promptId,
    duplicatePromptId: candidate.duplicatePromptId,
    decision: review.decision,
    confidence: review.confidence,
    status: review.status
  });
  sendJson(res, 200, { candidate: updated, review });
}

async function reviewDuplicate(deps, req, res, id) {
  const { store, sendJson, readJsonBody, httpError, writeAdminAudit } = deps;
  const current = await requireAdmin(deps, req);
  const candidate = await store.getPromptDuplicateCandidateById(id);
  if (!candidate) throw httpError("Duplicate candidate not found", 404);
  const body = await readJsonBody(req);
  const action = String(body.action || "").trim();
  const note = String(body.note || "").trim().slice(0, 500);
  let status = "ignored";
  if (action === "confirm") status = "confirmed_duplicate";
  else if (action === "keep") status = "kept_distinct";
  else if (action === "merge") {
    status = "merged";
    await store.updatePrompt(candidate.duplicatePromptId, { status: "hidden" });
  } else if (action === "hide_duplicate") {
    status = "hidden";
    await store.softDeletePrompt(candidate.duplicatePromptId);
  } else if (action !== "ignore") {
    throw httpError("Invalid duplicate action", 400);
  }
  const updated = await store.reviewPromptDuplicateCandidate(candidate.id, { status, reviewerUserId: current.user.id, reviewNote: note });
  await writeAdminAudit(current, req, `prompt_duplicate_${action}`, "prompt_duplicate", candidate.id, {
    promptId: candidate.promptId,
    duplicatePromptId: candidate.duplicatePromptId,
    note
  });
  sendJson(res, 200, { candidate: updated });
}

async function decideWithdrawal(deps, req, res, generationId) {
  const { store, sendJson, readJsonBody, httpError, writeAdminAudit } = deps;
  const current = await requireAdmin(deps, req);
  const generation = await store.getGenerationById(generationId);
  if (!generation) throw httpError("Image not found", 404);
  const body = await readJsonBody(req);
  const decision = String(body.decision || "").trim();
  if (!["approved", "rejected"].includes(decision)) throw httpError("Invalid decision", 400);
  const updated = await store.updateGenerationPublic(generation.id, decision === "approved"
    ? { withdrawalStatus: "approved", isPublic: false, publishOriginal: false }
    : { withdrawalStatus: "rejected" });
  if (decision === "approved") await syncReferenceAssetPublicVisibility(deps, updated);
  const reason = String(body.reason || "").trim().slice(0, 255);
  await deps.notifyWithdrawalDecision({ generation: updated, decision, reason, actorUserId: current.user.id });
  await writeAdminAudit(current, req, `withdrawal_${decision}`, "generation", generation.id, { reason });
  sendJson(res, 200, { generation: updated });
}

async function moderatePublicImage(deps, req, res, generationId) {
  const { store, sendJson, readJsonBody, httpError, writeAdminAudit } = deps;
  const current = await requireAdmin(deps, req);
  const generation = await store.getGenerationById(generationId);
  if (!generation) throw httpError("Image not found", 404);
  const body = await readJsonBody(req);
  const action = String(body.action || "").trim();
  const reason = String(body.reason || "").trim().slice(0, 255);
  const pendingReports = await store.listGenerationReports({ generationId: generation.id, status: "pending", limit: 500 });
  const patch = {};
  if (action === "hide") {
    Object.assign(patch, { moderationStatus: "hidden", moderationReason: reason || "hidden by admin" });
  } else if (action === "restore" || action === "reject") {
    Object.assign(patch, {
      moderationStatus: "restored",
      moderationReason: reason || (action === "reject" ? "report rejected by admin" : "restored by admin"),
      reportCount: 0
    });
  } else {
    throw httpError("Invalid moderation action", 400);
  }
  const updated = await store.updateGenerationPublic(generation.id, patch);
  await syncReferenceAssetPublicVisibility(deps, updated);
  await store.markGenerationReportsHandled(generation.id, { status: action === "restore" || action === "reject" ? "rejected" : "resolved", handledBy: current.user.id });
  await deps.notifyModerationOutcome({ generation: updated, action, reason: reason || patch.moderationReason || "", reports: pendingReports, actorUserId: current.user.id });
  await writeAdminAudit(current, req, `moderation_${action}`, "generation", generation.id, {
    reason,
    before: { moderationStatus: generation.moderationStatus, reportCount: generation.reportCount },
    after: patch
  });
  sendJson(res, 200, { generation: deps.generationResponse(updated) });
}

function createAdminModerationRoute(deps) {
  const { store, sendJson, httpError } = deps;

  return async function handleAdminModerationRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/credit-ledger") {
      await requireAdmin(deps, req);
      sendJson(res, 200, { ledger: await store.listCreditLedger({ limit: getLimit(deps, url, 100, 500) }) });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/admin/reward-ledger") {
      await requireAdmin(deps, req);
      sendJson(res, 200, { rewards: await store.listRewardLedger({ limit: getLimit(deps, url, 100, 500) }) });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/admin/audit-logs") {
      await requireAdmin(deps, req);
      sendJson(res, 200, { logs: await store.listAdminAuditLogs({ limit: getLimit(deps, url, 100, 500) }) });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/admin/prompt-audits") {
      await requireAdmin(deps, req);
      sendJson(res, 200, { audits: await store.listPromptAuditRecords({ status: url.searchParams.get("status") || "all", limit: getLimit(deps, url, 120, 500) }) });
      return true;
    }
    const auditMatch = url.pathname.match(/^\/api\/admin\/prompt-audits\/(\d+)$/);
    if (auditMatch && req.method === "GET") {
      await requireAdmin(deps, req);
      const audit = await store.getPromptAuditRecordById(auditMatch[1]);
      if (!audit) throw httpError("Prompt audit not found", 404);
      sendJson(res, 200, { audit });
      return true;
    }
    if (auditMatch && req.method === "PATCH") {
      await reviewPromptAudit(deps, req, res, auditMatch[1]);
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/admin/withdrawals") {
      await requireAdmin(deps, req);
      const requests = (await store.listWithdrawalRequests({ limit: getLimit(deps, url, 100, 500) })).map((generation) => serializeGeneration(deps, generation));
      sendJson(res, 200, { requests });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/admin/reports") {
      await requireAdmin(deps, req);
      const reports = (await store.listGalleryModeration({ limit: getLimit(deps, url, 120, 500), status: url.searchParams.get("status") || "queue" })).map(deps.generationResponse);
      sendJson(res, 200, { reports });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/api/admin/prompt-duplicates") {
      await requireAdmin(deps, req);
      sendJson(res, 200, { candidates: await store.listPromptDuplicateCandidates({ status: url.searchParams.get("status") || "pending", limit: getLimit(deps, url, 100, 500) }) });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/api/admin/prompt-duplicates/scan") {
      await scanPromptDuplicates(deps, req, res);
      return true;
    }
    const aiReviewMatch = url.pathname.match(/^\/api\/admin\/prompt-duplicates\/(\d+)\/ai-review$/);
    if (aiReviewMatch && req.method === "POST") {
      await reviewDuplicateWithAi(deps, req, res, aiReviewMatch[1]);
      return true;
    }
    const duplicateMatch = url.pathname.match(/^\/api\/admin\/prompt-duplicates\/(\d+)$/);
    if (duplicateMatch && req.method === "PATCH") {
      await reviewDuplicate(deps, req, res, duplicateMatch[1]);
      return true;
    }
    const withdrawalMatch = url.pathname.match(/^\/api\/admin\/withdrawals\/([^/]+)$/);
    if (withdrawalMatch && req.method === "PATCH") {
      await decideWithdrawal(deps, req, res, withdrawalMatch[1]);
      return true;
    }
    const moderationMatch = url.pathname.match(/^\/api\/admin\/public-images\/([^/]+)\/moderation$/);
    if (moderationMatch && req.method === "PATCH") {
      await moderatePublicImage(deps, req, res, moderationMatch[1]);
      return true;
    }
    return false;
  };
}

module.exports = { createAdminModerationRoute };
