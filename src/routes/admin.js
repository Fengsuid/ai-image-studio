"use strict";

// Owns backend administration API routes under /api/admin*:
// settings, providers, users, generations, public images, prompt sources,
// prompt duplicate review, announcements, RUM, audit logs, and gallery file checks.
function createAdminRoute({
  store,
  promptReview,
  sendJson,
  readJsonBody,
  httpError,
  randomId,
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt,
  writeAdminAudit,
  cleanPromptSourceInput,
  runPromptSourceSync,
  reviewPendingPromptDuplicates,
  adminSettings,
  cleanProviderInput,
  normalizeProviderMapping,
  runProviderMappingRequest,
  fetchWithTimeout,
  DEFAULT_MODEL,
  extractImageItems,
  isSafeRemoteImageUrl,
  rumSummary,
  rumEvents,
  cleanAnnouncementInput,
  normalizeMaxReferenceImages,
  normalizeEmail,
  requireOptionalEmail,
  serializeUser,
  sourceImageUrlForGeneration,
  sourceImageAuditFields,
  generationResponse,
  callOpenAITextResponses,
  notifyWithdrawalDecision,
  notifyModerationOutcome,
  temporaryPassword,
  requireEmail,
  requirePassword,
  hashPassword,
  recoveredGenerationJobFromRequest,
  enqueueGenerationJob,
  cancelQueuedGenerationJob,
  traceGeneration,
  runGalleryFileChecks
}) {
  return async function handleAdminRoute(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/admin/prompt-sources") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const [sources, runs] = await Promise.all([
      store.listPromptSources({ includeDisabled: true }),
      store.listPromptSyncRuns({ limit: sanitizePositiveInt(url.searchParams.get("runsLimit"), 100, 500) })
    ]);
    sendJson(res, 200, { sources, runs });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/prompt-sources") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const input = cleanPromptSourceInput(await readJsonBody(req));
    const source = await store.createPromptSource({ ...input, id: randomId("ps_") });
    await writeAdminAudit(current, req, "create_prompt_source", "prompt_source", source.id, {
      name: source.name,
      repoUrl: source.repoUrl,
      status: source.status
    });
    sendJson(res, 201, { source });
    return true;
  }

  const promptSourceMatch = url.pathname.match(/^\/api\/admin\/prompt-sources\/([^/]+)$/);
  if (promptSourceMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getPromptSourceById(promptSourceMatch[1]);
    if (!existing) throw httpError("Prompt source not found", 404);
    const input = cleanPromptSourceInput(await readJsonBody(req), existing);
    const source = await store.updatePromptSource(existing.id, input);
    await writeAdminAudit(current, req, "update_prompt_source", "prompt_source", source.id, {
      fields: Object.keys(input),
      status: source.status
    });
    sendJson(res, 200, { source });
    return true;
  }

  const promptSourceSyncMatch = url.pathname.match(/^\/api\/admin\/prompt-sources\/([^/]+)\/sync$/);
  if (promptSourceSyncMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const source = await store.getPromptSourceById(promptSourceSyncMatch[1]);
    if (!source) throw httpError("Prompt source not found", 404);
    const now = new Date();
    if (source.status === "disabled") {
      const run = await store.createPromptSyncRun({
        sourceId: source.id,
        status: "skipped",
        startedAt: now,
        finishedAt: now,
        skippedCount: 1,
        errorLog: "source_disabled",
        createdByUserId: current.user.id
      });
      sendJson(res, 200, { run, source: await store.getPromptSourceById(source.id) });
      return true;
    }
    try {
      const result = await runPromptSourceSync(source);
      const aiReviewed = result.upserted
        ? await reviewPendingPromptDuplicates({ limit: Math.min(24, result.upserted) })
        : 0;
      const finishedAt = new Date();
      const status = result.errors.length ? "partial" : "success";
      const run = await store.createPromptSyncRun({
        sourceId: source.id,
        status,
        startedAt: now,
        finishedAt,
        successCount: result.upserted,
        failureCount: result.errors.length,
        skippedCount: result.skipped,
        errorLog: result.errors.join("\n"),
        createdByUserId: current.user.id
      });
      await writeAdminAudit(current, req, "prompt_source_sync", "prompt_source", source.id, {
        status,
        fetched: result.fetched,
        upserted: result.upserted,
        aiReviewed,
        errors: result.errors.length
      });
      sendJson(res, 200, { run, source: await store.getPromptSourceById(source.id), result, aiReviewed });
      return true;
    } catch (error) {
      const finishedAt = new Date();
      const run = await store.createPromptSyncRun({
        sourceId: source.id,
        status: "failed",
        startedAt: now,
        finishedAt,
        failureCount: 1,
        errorLog: error.message || String(error),
        createdByUserId: current.user.id
      });
      await writeAdminAudit(current, req, "prompt_source_sync_failed", "prompt_source", source.id, {
        reason: run.errorLog
      });
      sendJson(res, 200, { run, source: await store.getPromptSourceById(source.id) });
      return true;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/admin/settings") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const settings = await store.getSettings();
    sendJson(res, 200, adminSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/providers") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const settings = await store.getSettings();
    sendJson(res, 200, {
      providers: await store.listProviderConfigs(),
      defaultProviderId: settings.defaultProviderId || ""
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/providers") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const input = cleanProviderInput(await readJsonBody(req));
    const provider = await store.createProviderConfig({ ...input, id: randomId("prv_") });
    await writeAdminAudit(current, req, "create_provider", "provider", provider.id, {
      name: provider.name,
      baseUrl: provider.baseUrl,
      status: provider.status
    });
    sendJson(res, 201, { provider });
    return true;
  }

  const providerMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)$/);
  if (providerMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const provider = await store.getProviderConfigById(providerMatch[1]);
    if (!provider) throw httpError("Provider not found", 404);
    sendJson(res, 200, { provider });
    return true;
  }

  if (providerMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getProviderConfigById(providerMatch[1], { includeSecret: true });
    if (!existing) throw httpError("Provider not found", 404);
    const input = cleanProviderInput(await readJsonBody(req), existing);
    const provider = await store.updateProviderConfig(existing.id, input);
    await writeAdminAudit(current, req, "update_provider", "provider", provider.id, {
      name: provider.name,
      baseUrl: provider.baseUrl,
      status: provider.status
    });
    sendJson(res, 200, { provider });
    return true;
  }

  if (providerMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const ok = await store.deleteProviderConfig(providerMatch[1]);
    if (!ok) throw httpError("Provider cannot be deleted", 400);
    await writeAdminAudit(current, req, "delete_provider", "provider", providerMatch[1], {});
    sendJson(res, 200, { ok: true });
    return true;
  }

  const providerTestMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/test$/);
  if (providerTestMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const provider = await store.getProviderConfigById(providerTestMatch[1], { includeSecret: true });
    if (!provider) throw httpError("Provider not found", 404);
    const body = await readJsonBody(req).catch(() => ({}));
    const started = Date.now();
    try {
      if (provider.mapping && Object.keys(provider.mapping).length) {
        const mapping = normalizeProviderMapping(provider.mapping);
        const result = await runProviderMappingRequest({
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          fetchFn: (label, endpoint, init) => fetchWithTimeout(label, endpoint, init, 20_000),
          mapping,
          payload: {
            model: provider.defaultModel || DEFAULT_MODEL,
            prompt: String(body.prompt || "provider diagnostic test image").slice(0, 500),
            n: 1,
            size: String(body.size || "1024x1024"),
            quality: String(body.quality || "auto"),
            background: String(body.background || "auto"),
            output_format: String(body.outputFormat || "png")
          }
        });
        const imageItems = extractImageItems(result);
        for (const item of imageItems) {
          if (item.url && !isSafeRemoteImageUrl(item.url)) throw httpError("Provider returned an unsafe image URL", 400);
        }
        const updated = await store.updateProviderHealth(provider.id, {
          healthStatus: imageItems.length ? "ok" : "error",
          lastError: imageItems.length ? "" : "mapping test returned no image"
        });
        sendJson(res, 200, {
          provider: updated,
          ok: imageItems.length > 0,
          mappingMode: mapping.mode,
          imageCount: imageItems.length,
          providerTaskId: result.providerTaskId || "",
          durationMs: Date.now() - started
        });
        return true;
      }
      const response = await fetchWithTimeout("Provider test", provider.baseUrl, {
        method: "GET",
        headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}
      }, 8000);
      const healthStatus = response.status < 500 ? "ok" : "error";
      const updated = await store.updateProviderHealth(provider.id, {
        healthStatus,
        lastError: healthStatus === "ok" ? "" : `HTTP ${response.status}`
      });
      sendJson(res, 200, { provider: updated, ok: healthStatus === "ok", status: response.status, durationMs: Date.now() - started });
      return true;
    } catch (error) {
      const updated = await store.updateProviderHealth(provider.id, {
        healthStatus: "error",
        lastError: error.message || String(error)
      });
      sendJson(res, 200, { provider: updated, ok: false, error: error.message || String(error), durationMs: Date.now() - started });
      return true;
    }
  }

  const providerDefaultMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/set-default$/);
  if (providerDefaultMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const provider = await store.setDefaultProviderConfig(providerDefaultMatch[1]);
    if (!provider) throw httpError("Provider not found", 404);
    await writeAdminAudit(current, req, "set_default_provider", "provider", provider.id, { name: provider.name });
    sendJson(res, 200, { provider, defaultProviderId: provider.id });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/rum") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    sendJson(res, 200, { summary: rumSummary(), events: rumEvents.slice(-100).reverse() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/announcements") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const status = url.searchParams.get("status") || "";
    sendJson(res, 200, { announcements: await store.listAnnouncements({ includeArchived: true, status, limit }) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/announcements") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const payload = cleanAnnouncementInput(body, null, { partial: false });
    const announcement = await store.createAnnouncement({
      ...payload,
      id: randomId("ann_"),
      createdBy: current.user.id
    });
    await writeAdminAudit(current, req, "create_announcement", "announcement", announcement.id, {
      title: announcement.title,
      status: announcement.status
    });
    sendJson(res, 201, { announcement });
    return true;
  }

  const adminAnnouncementActionMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)\/(publish|archive|withdraw)$/);
  if (adminAnnouncementActionMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementActionMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const action = adminAnnouncementActionMatch[2];
    const status = action === "publish" ? "published" : action === "archive" ? "archived" : "draft";
    const announcement = await store.updateAnnouncement(existing.id, { status });
    await writeAdminAudit(current, req, `${action}_announcement`, "announcement", announcement.id, {
      title: announcement.title,
      from: existing.status,
      to: announcement.status
    });
    sendJson(res, 200, { announcement });
    return true;
  }

  const adminAnnouncementMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (adminAnnouncementMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const announcement = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!announcement) throw httpError("Announcement not found", 404);
    sendJson(res, 200, { announcement });
    return true;
  }

  if (adminAnnouncementMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const patch = cleanAnnouncementInput(await readJsonBody(req), existing, { partial: true });
    const announcement = await store.updateAnnouncement(existing.id, patch);
    await writeAdminAudit(current, req, "update_announcement", "announcement", announcement.id, {
      title: announcement.title,
      status: announcement.status
    });
    sendJson(res, 200, { announcement });
    return true;
  }

  if (adminAnnouncementMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const ok = await store.deleteAnnouncement(existing.id);
    if (!ok) throw httpError("Only draft announcements can be deleted", 400);
    await writeAdminAudit(current, req, "delete_announcement", "announcement", existing.id, {
      title: existing.title,
      status: existing.status
    });
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "PATCH" && url.pathname === "/api/admin/settings") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const patch = {};

    if (typeof body.openaiApiKey === "string") {
      const key = body.openaiApiKey.trim();
      if (key) patch.openaiApiKey = key;
    }
    if (body.clearApiKey === true) patch.openaiApiKey = "";
    if (typeof body.apiBaseUrl === "string") {
      patch.apiBaseUrl = body.apiBaseUrl.trim().replace(/\/+$/, "").slice(0, 255);
    }
    if (typeof body.model === "string" && body.model.trim()) {
      patch.model = body.model.trim().slice(0, 80);
    }
    if (body.defaultCredits !== undefined) {
      patch.defaultCredits = Math.max(0, Math.min(10000, Number.parseInt(body.defaultCredits, 10) || 0));
    }
    if (body.generationCreditCost !== undefined) {
      patch.generationCreditCost = Math.max(0, Math.min(10000, Number.parseInt(body.generationCreditCost, 10) || 0));
    }
    if (body.maxImagesPerRequest !== undefined) {
      patch.maxImagesPerRequest = Math.max(1, Math.min(4, Number.parseInt(body.maxImagesPerRequest, 10) || 1));
    }
    if (body.maxReferenceImages !== undefined) {
      patch.maxReferenceImages = normalizeMaxReferenceImages(body.maxReferenceImages);
    }
    const contactEmailInput = typeof body.contactEmail === "string" ? body.contactEmail : body.contactAdminEmail;
    if (typeof contactEmailInput === "string") {
      const email = normalizeEmail(contactEmailInput);
      requireOptionalEmail(email);
      patch.contactAdminEmail = email.slice(0, 255);
    }
    if (typeof body.allowRegistration === "boolean") patch.allowRegistration = body.allowRegistration ? 1 : 0;
    if (typeof body.requireApproval === "boolean") patch.requireApproval = body.requireApproval ? 1 : 0;
    if (body.growthConfig && typeof body.growthConfig === "object") patch.growthConfig = body.growthConfig;
    if (body.providerCapabilityConfig && typeof body.providerCapabilityConfig === "object") {
      patch.providerCapabilityConfig = body.providerCapabilityConfig;
    }
    if (typeof body.defaultProviderId === "string") {
      patch.defaultProviderId = body.defaultProviderId.trim().slice(0, 40);
    }

    const existingSettings = await store.getSettings();
    const settings = await store.updateSettings(patch);
    if (Object.hasOwn(patch, "contactAdminEmail") && patch.contactAdminEmail !== String(existingSettings.contactAdminEmail || "")) {
      await writeAdminAudit(current, req, "update_contact_email", "settings", "contactEmail", {
        from: existingSettings.contactAdminEmail || "",
        to: patch.contactAdminEmail
      });
    }
    sendJson(res, 200, adminSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
    return true;
  }

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

  if (req.method === "GET" && url.pathname === "/api/admin/generations") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const filters = {
      status: url.searchParams.get("status") || "",
      provider: url.searchParams.get("provider") || "",
      model: url.searchParams.get("model") || "",
      user: url.searchParams.get("user") || "",
      errorStage: url.searchParams.get("errorStage") || "",
      dateFrom: url.searchParams.get("dateFrom") || "",
      dateTo: url.searchParams.get("dateTo") || ""
    };
    const records = (await store.listGenerationRequests(limit, filters)).map((record) => ({
      ...record,
      imageUrl: record.firstGenerationId ? `/api/images/${record.firstGenerationId}/file` : ""
    }));
    sendJson(res, 200, { records });
    return true;
  }

  const adminGenerationMatch = url.pathname.match(/^\/api\/admin\/generations\/([^/]+)$/);
  if (adminGenerationMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const diagnostic = await store.getGenerationRequestDiagnostic(adminGenerationMatch[1]);
    if (!diagnostic) throw httpError("Generation request not found", 404);
    sendJson(res, 200, {
      request: {
        ...diagnostic.request,
        imageUrl: diagnostic.request.firstGenerationId ? `/api/images/${diagnostic.request.firstGenerationId}/file` : ""
      },
      trace: diagnostic.trace
    });
    return true;
  }

  const adminGenerationActionMatch = url.pathname.match(/^\/api\/admin\/generations\/([^/]+)\/(retry|cancel|mark-failed|copy-error)$/);
  if (adminGenerationActionMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const requestId = adminGenerationActionMatch[1];
    const action = adminGenerationActionMatch[2];
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
      const job = await recoveredGenerationJobFromRequest(retryRequest);
      if (!job) throw httpError("Generation request cannot be retried", 409);
      enqueueGenerationJob(job, { persistQueued: false });
      await traceGeneration(request.id, "admin_retry_queued", {
        userId: current.user.id,
        level: "warn",
        message: "admin queued generation request retry",
        data: { previousStatus: request.status, note: String(body.note || "").slice(0, 255) }
      });
      await writeAdminAudit(current, req, "generation_request_retry", "generation_request", request.id, { previousStatus: request.status });
    }
    if (action === "cancel") {
      if (!["pending", "running"].includes(request.status)) throw httpError("Only pending or running requests can be cancelled", 409);
      const queued = cancelQueuedGenerationJob(request.id);
      if (!queued) throw httpError("Only queued requests can be cancelled safely", 409);
      await store.updateGenerationRequest(request.id, {
        status: "cancelled",
        errorMessage: "admin cancelled",
        errorCode: "admin_cancelled",
        errorStage: "queue"
      });
      await traceGeneration(request.id, "admin_cancelled", {
        userId: current.user.id,
        level: "warn",
        message: "admin cancelled generation request",
        data: { queued, note: String(body.note || "").slice(0, 255) }
      });
      await writeAdminAudit(current, req, "generation_request_cancel", "generation_request", request.id, { queued });
    }
    if (action === "mark-failed") {
      if (["succeeded", "success"].includes(request.status)) throw httpError("Succeeded requests cannot be marked failed", 409);
      const queued = ["pending", "running"].includes(request.status) ? cancelQueuedGenerationJob(request.id) : false;
      if (["pending", "running"].includes(request.status) && !queued) throw httpError("Running requests cannot be marked failed safely", 409);
      const note = String(body.note || "admin marked failed").slice(0, 512);
      await store.updateGenerationRequest(request.id, {
        status: "failed",
        errorMessage: note,
        errorCode: "admin_marked_failed",
        errorStage: "admin"
      });
      await traceGeneration(request.id, "admin_marked_failed", {
        userId: current.user.id,
        level: "warn",
        message: note,
        data: { previousStatus: request.status, queued }
      });
      await writeAdminAudit(current, req, "generation_request_mark_failed", "generation_request", request.id, { previousStatus: request.status, queued });
    }
    if (action === "copy-error") {
      await traceGeneration(request.id, "admin_error_summary_copied", {
        userId: current.user.id,
        message: "admin copied generation error summary",
        data: { errorStage: request.errorStage || request.failureStage || "", errorCode: request.errorCode || "" }
      });
      await writeAdminAudit(current, req, "generation_request_copy_error", "generation_request", request.id, {
        errorStage: request.errorStage || request.failureStage || "",
        errorCode: request.errorCode || ""
      });
    }
    const diagnostic = await store.getGenerationRequestDiagnostic(request.id);
    sendJson(res, 200, {
      request: {
        ...diagnostic.request,
        imageUrl: diagnostic.request.firstGenerationId ? `/api/images/${diagnostic.request.firstGenerationId}/file` : ""
      },
      trace: diagnostic.trace
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/public-images") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 200);
    const status = url.searchParams.get("status") || "queue";
    const includeBroken = url.searchParams.get("includeBroken") === "1";
    const generations = status === "all"
      ? (await store.listPublicGenerations(limit, { includeModerated: true, includeBroken })).map(generationResponse)
      : (await store.listGalleryModeration({ limit, status, includeBroken })).map(generationResponse);
    sendJson(res, 200, { generations });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/gallery-file-checks") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 500);
    const checks = await store.listGalleryFileChecks({
      status: url.searchParams.get("status") || "broken",
      limit
    });
    sendJson(res, 200, { checks });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/gallery-file-checks/run") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req).catch(() => ({}));
    const limit = sanitizePositiveInt(body.limit, 1000, 5000);
    const result = await runGalleryFileChecks({ limit });
    await writeAdminAudit(current, req, "gallery_file_check_run", "gallery", "public-images", {
      scanned: result.scanned,
      checked: result.checked,
      broken: result.broken
    });
    sendJson(res, 200, result);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/gallery-like-anomalies") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    sendJson(res, 200, { anomalies: await store.listGenerationLikeAnomalies({ limit }) });
    return true;
  }

  const userCreditLedgerMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/credit-ledger$/);
  if (userCreditLedgerMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userCreditLedgerMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    sendJson(res, 200, { ledger: await store.listCreditLedger({ userId: target.id, limit }) });
    return true;
  }

  const userRewardLedgerMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/reward-ledger$/);
  if (userRewardLedgerMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userRewardLedgerMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    sendJson(res, 200, { rewards: await store.listRewardLedger({ userId: target.id, limit }) });
    return true;
  }

  const userResetPasswordMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/);
  if (userResetPasswordMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userResetPasswordMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const body = await readJsonBody(req);
    const generated = Boolean(body.generatePassword) || !String(body.password || "").trim();
    const password = generated ? temporaryPassword() : String(body.password || "");
    requirePassword(password);
    const user = await store.updateUserPassword(target.id, hashPassword(password));
    await writeAdminAudit(current, req, "reset_user_password", "user", target.id, {
      email: target.email,
      generatedPassword: generated,
      note: String(body.note || "").slice(0, 255)
    });
    sendJson(res, 200, {
      user: serializeUser(user),
      temporaryPassword: generated ? password : undefined
    });
    return true;
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const body = await readJsonBody(req);
    const patch = {};

    if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 60) || target.name;
    if (["admin", "user"].includes(body.role)) patch.role = body.role;
    if (["active", "disabled"].includes(body.status)) patch.status = body.status;
    if (target.id === current.user.id) {
      patch.role = "admin";
      patch.status = "active";
    }

    let user = await store.updateUser(target.id, patch);
    if (body.credits !== undefined) {
      user = await store.setUserCredits(target.id, body.credits, {
        source: "admin_set",
        note: String(body.note || "Admin set balance").slice(0, 255),
        actorUserId: current.user.id
      });
    }
    if (body.creditDelta !== undefined) {
      const delta = Math.max(-100000, Math.min(100000, Number.parseInt(body.creditDelta, 10) || 0));
      user = await store.adjustCredits(target.id, delta, {
        source: "admin_adjustment",
        note: String(body.note || "Admin adjustment").slice(0, 255),
        actorUserId: current.user.id
      });
    }
    await writeAdminAudit(current, req, "update_user", "user", target.id, {
      patch,
      credits: body.credits,
      creditDelta: body.creditDelta,
      note: body.note || ""
    });
    sendJson(res, 200, { user: serializeUser(user) });
    return true;
  }

  const adminUserGenerationsMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/generations$/);
  if (adminUserGenerationsMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAdmin(current);
    const target = await store.getUserById(adminUserGenerationsMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 200);
    const generations = (await store.listGenerationsForUserId(target.id, limit, { includeArchived })).map((generation) => ({
      ...generation,
      imageUrl: `/api/images/${generation.id}/file`,
      sourceImageUrl: sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
      ...sourceImageAuditFields(generation)
    }));
    sendJson(res, 200, { user: serializeUser(target), generations });
    return true;
  }

    return false;
  };
}

module.exports = { createAdminRoute };
