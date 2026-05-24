'use strict';

function createAdminUsersRoute({
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt,
  sendJson,
  store,
  readJsonBody,
  httpError,
  writeAdminAudit,
  requireEmail,
  requirePassword,
  temporaryPassword,
  hashPassword,
  serializeUser,
  normalizeEmail,
  randomId,
  promptReview,
  reviewPendingPromptDuplicates,
  callOpenAITextResponses,
  notifyWithdrawalDecision,
  notifyModerationOutcome,
  generationResponse, sourceImageUrlForGeneration, sourceImageAuditFields
}) {
  return async function handleAdminUsersRoute(req, res, url) {

  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const status = ["active", "disabled", "all"].includes(url.searchParams.get("status"))
      ? url.searchParams.get("status")
      : "";
    const role = ["admin", "user", "all"].includes(url.searchParams.get("role"))
      ? url.searchParams.get("role")
      : "";
    const rewardStatus = ["none", "pending", "awarded", "cancelled", "all"].includes(url.searchParams.get("rewardStatus"))
      ? url.searchParams.get("rewardStatus")
      : "";
    sendJson(res, 200, {
      users: (await store.listUsers({
        search: url.searchParams.get("search") || "",
        status,
        role,
        rewardStatus,
        limit: sanitizePositiveInt(url.searchParams.get("limit"), 500, 1000),
        offset: Math.max(0, Number.parseInt(url.searchParams.get("offset"), 10) || 0)
      })).map(serializeUser)
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/credit-ledger") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    sendJson(res, 200, { ledger: await store.listCreditLedger({ limit }) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/reward-ledger") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    sendJson(res, 200, { rewards: await store.listRewardLedger({ limit }) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/audit-logs") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    sendJson(res, 200, { logs: await store.listAdminAuditLogs({ limit }) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/prompt-audits") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 500);
    const status = url.searchParams.get("status") || "all";
    sendJson(res, 200, { audits: await store.listPromptAuditRecords({ status, limit }) });
    return true;
  }

  const promptAuditAdminMatch = url.pathname.match(/^\/api\/admin\/prompt-audits\/(\d+)$/);
  if (promptAuditAdminMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const audit = await store.getPromptAuditRecordById(promptAuditAdminMatch[1]);
    if (!audit) throw httpError("Prompt audit not found", 404);
    sendJson(res, 200, { audit });
    return true;
  }

  if (promptAuditAdminMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getPromptAuditRecordById(promptAuditAdminMatch[1]);
    if (!existing) throw httpError("Prompt audit not found", 404);
    const body = await readJsonBody(req);
    const action = String(body.action || "").trim();
    const note = String(body.note || "").trim().slice(0, 500);
    const updated = await store.reviewPromptAuditRecord(existing.id, {
      action,
      note,
      reviewerUserId: current.user.id
    });
    await writeAdminAudit(current, req, `prompt_audit_${updated.overrideAction || action || "review"}`, "prompt_audit", String(existing.id), {
      generationId: existing.generationId,
      resultLevel: existing.resultLevel,
      requiredMode: existing.requiredMode,
      note
    });
    sendJson(res, 200, { audit: updated });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/withdrawals") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const requests = (await store.listWithdrawalRequests({ limit })).map((generation) => ({
      ...generation,
      imageUrl: `/api/images/${generation.id}/file`,
      sourceImageUrl: sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
      ...sourceImageAuditFields(generation)
    }));
    sendJson(res, 200, { requests });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/reports") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 500);
    const reports = (await store.listGalleryModeration({ limit, status: url.searchParams.get("status") || "queue" })).map(generationResponse);
    sendJson(res, 200, { reports });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/prompt-duplicates") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const status = url.searchParams.get("status") || "pending";
    sendJson(res, 200, { candidates: await store.listPromptDuplicateCandidates({ status, limit }) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/prompt-duplicates/scan") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req).catch(() => ({}));
    const result = await store.scanPromptDuplicateCandidates({
      limit: sanitizePositiveInt(body.limit, 2000, 5000),
      hammingThreshold: Math.max(0, Math.min(24, Number.parseInt(body.hammingThreshold, 10) || 6))
    });
    if (body.aiReview) {
      result.aiReviewed = await reviewPendingPromptDuplicates({
        limit: body.aiReviewLimit,
        mock: body.mockAiReview === true
      });
    }
    await writeAdminAudit(current, req, "scan_prompt_duplicates", "prompt", "duplicates", result);
    sendJson(res, 200, result);
    return true;
  }

  const promptDuplicateAiReviewMatch = url.pathname.match(/^\/api\/admin\/prompt-duplicates\/(\d+)\/ai-review$/);
  if (promptDuplicateAiReviewMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const candidate = await store.getPromptDuplicateCandidateById(promptDuplicateAiReviewMatch[1]);
    if (!candidate) throw httpError("Duplicate candidate not found", 404);
    const body = await readJsonBody(req).catch(() => ({}));
    const settings = await store.getSettings();
    const review = await promptReview.reviewPromptDuplicateCandidate(candidate, {
      mock: body.mock === true || process.env.PROMPT_REVIEW_MOCK === "1",
      callModel: (payload) => callOpenAITextResponses(settings, payload)
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
    return true;
  }

  const promptDuplicateMatch = url.pathname.match(/^\/api\/admin\/prompt-duplicates\/(\d+)$/);
  if (promptDuplicateMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const candidate = await store.getPromptDuplicateCandidateById(promptDuplicateMatch[1]);
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
    } else if (action === "ignore") {
      status = "ignored";
    } else {
      throw httpError("Invalid duplicate action", 400);
    }
    const updated = await store.reviewPromptDuplicateCandidate(candidate.id, {
      status,
      reviewerUserId: current.user.id,
      reviewNote: note
    });
    await writeAdminAudit(current, req, `prompt_duplicate_${action}`, "prompt_duplicate", candidate.id, {
      promptId: candidate.promptId,
      duplicatePromptId: candidate.duplicatePromptId,
      note
    });
    sendJson(res, 200, { candidate: updated });
    return true;
  }

  const adminWithdrawalMatch = url.pathname.match(/^\/api\/admin\/withdrawals\/([^/]+)$/);
  if (adminWithdrawalMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const generation = await store.getGenerationById(adminWithdrawalMatch[1]);
    if (!generation) throw httpError("Image not found", 404);
    const body = await readJsonBody(req);
    const decision = String(body.decision || "").trim();
    if (!["approved", "rejected"].includes(decision)) throw httpError("Invalid decision", 400);
    const patch = decision === "approved"
      ? { withdrawalStatus: "approved", isPublic: false, publishOriginal: false }
      : { withdrawalStatus: "rejected" };
    const updated = await store.updateGenerationPublic(generation.id, patch);
    const reason = String(body.reason || "").trim().slice(0, 255);
    await notifyWithdrawalDecision({
      generation: updated,
      decision,
      reason,
      actorUserId: current.user.id
    });
    await writeAdminAudit(current, req, `withdrawal_${decision}`, "generation", generation.id, { reason });
    sendJson(res, 200, { generation: updated });
    return true;
  }

  const adminModerationMatch = url.pathname.match(/^\/api\/admin\/public-images\/([^/]+)\/moderation$/);
  if (adminModerationMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const generation = await store.getGenerationById(adminModerationMatch[1]);
    if (!generation) throw httpError("Image not found", 404);
    const body = await readJsonBody(req);
    const action = String(body.action || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 255);
    const pendingReports = await store.listGenerationReports({ generationId: generation.id, status: "pending", limit: 500 });
    const patch = {};
    if (action === "hide") {
      patch.moderationStatus = "hidden";
      patch.moderationReason = reason || "hidden by admin";
    } else if (action === "restore") {
      patch.moderationStatus = "restored";
      patch.moderationReason = reason || "restored by admin";
      patch.reportCount = 0;
    } else if (action === "reject") {
      patch.moderationStatus = "restored";
      patch.moderationReason = reason || "report rejected by admin";
      patch.reportCount = 0;
    } else {
      throw httpError("Invalid moderation action", 400);
    }
    const updated = await store.updateGenerationPublic(generation.id, patch);
    await store.markGenerationReportsHandled(generation.id, {
      status: action === "restore" || action === "reject" ? "rejected" : "resolved",
      handledBy: current.user.id
    });
    await notifyModerationOutcome({
      generation: updated,
      action,
      reason: reason || patch.moderationReason || "",
      reports: pendingReports,
      actorUserId: current.user.id
    });
    await writeAdminAudit(current, req, `moderation_${action}`, "generation", generation.id, {
      reason,
      before: {
        moderationStatus: generation.moderationStatus,
        reportCount: generation.reportCount
      },
      after: patch
    });
    sendJson(res, 200, { generation: generationResponse(updated) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users/bulk") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 200)
      : [];
    if (!userIds.length) throw httpError("No users selected", 400);
    const action = String(body.action || "").trim();
    const results = [];
    for (const userId of userIds) {
      const target = await store.getUserById(userId);
      if (!target) {
        results.push({ userId, ok: false, error: "not_found" });
        continue;
      }
      try {
        if (action === "status") {
          const status = ["active", "disabled"].includes(body.status) ? body.status : "";
          if (!status) throw new Error("invalid_status");
          if (target.id === current.user.id && status !== "active") throw new Error("cannot_disable_self");
          await store.updateUser(target.id, { status });
        } else if (action === "creditDelta") {
          const delta = Math.max(-100000, Math.min(100000, Number.parseInt(body.creditDelta, 10) || 0));
          if (!delta) throw new Error("zero_delta");
          await store.adjustCredits(target.id, delta, {
            source: "admin_bulk_adjustment",
            note: String(body.note || "Bulk adjustment").slice(0, 255),
            actorUserId: current.user.id
          });
        } else {
          throw new Error("invalid_action");
        }
        results.push({ userId, ok: true });
      } catch (error) {
        results.push({ userId, ok: false, error: error.message || String(error) });
      }
    }
    await writeAdminAudit(current, req, "bulk_user_update", "user", "selected", {
      action,
      count: userIds.length,
      ok: results.filter((item) => item.ok).length,
      note: body.note || ""
    });
    sendJson(res, 200, { results });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    requireEmail(email);
    if (await store.getUserByEmail(email)) {
      throw httpError("Email is already registered", 409);
    }

    const generated = Boolean(body.generatePassword) || !String(body.password || "").trim();
    const password = generated ? temporaryPassword() : String(body.password || "");
    requirePassword(password);

    const role = ["admin", "user"].includes(body.role) ? body.role : "user";
    const status = ["active", "disabled"].includes(body.status) ? body.status : "active";
    const name = String(body.name || "").trim().slice(0, 60) || email.split("@")[0];
    const credits = Math.max(0, Math.min(100000, Number.parseInt(body.credits, 10) || 0));
    const note = String(body.note || "").slice(0, 255);

    const user = await store.createUser({
      id: randomId("usr_"),
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      status,
      credits
    });

    await writeAdminAudit(current, req, "create_user", "user", user.id, {
      email,
      role,
      status,
      credits,
      generatedPassword: generated,
      note
    });
    sendJson(res, 201, {
      user: serializeUser(user),
      temporaryPassword: generated ? password : undefined
    });
    return true;
  }
    return false;
  };
}

module.exports = { createAdminUsersRoute };
