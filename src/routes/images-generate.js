'use strict';

function createImagesGenerateRoute({
  getCurrentUser,
  ensureAuthenticated,
  store,
  requestStatusPayload,
  sendJson,
  sendGenerationRequestStatus,
  httpError,
  cancelQueuedGenerationJob,
  traceGeneration,
  enforceGenerationRate,
  readJsonBody,
  cleanPrompt,
  normalizeTextToImagePrompt = (prompt) => prompt,
  sanitizePositiveInt,
  normalizeGenerationCost,
  DEFAULT_MODEL,
  sanitizeGenerationTitle,
  normalizeImageSize,
  choose,
  sanitizeConversationRoute,
  normalizePublishPublicTags,
  PUBLIC_KIND_TAGS,
  auditPayload,
  randomId,
  safeJsonSummary,
  getClientIp,
  getUserAgent,
  queuePayloadForTextGeneration,
  enqueueGenerationJob,
  runQueuedTextGeneration,
  attachRequestAbortController,
  callOpenAIImages,
  finalizeSuccessfulGenerations,
  errorSummary,
  editableImageSource,
  validateImageDataUrl,
  normalizedEditReferenceImages,
  normalizeMaxReferenceImages,
  saveSourceImageFromData,
  queuePayloadForImageEdit,
  runQueuedImageEdit,
  callOpenAIImageEdits
}) {
  return async function handleImagesGenerateRoute(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/images/requests/active") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const requests = await store.listActiveGenerationRequestsForUser(current.user.id, 20);
    sendJson(res, 200, {
      requests: requests.map(requestStatusPayload)
    });
    return true;
  }

  const requestStatusMatch = url.pathname.match(/^\/api\/images\/requests\/([^/]+)$/);
  if (requestStatusMatch && req.method === "GET") {
    await sendGenerationRequestStatus(req, res, requestStatusMatch[1]);
    return true;
  }

    if (requestStatusMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const request = await store.getGenerationRequestById(requestStatusMatch[1]);
    if (!request || (request.userId !== current.user.id && current.user.role !== "admin")) {
      throw httpError("Generation request not found", 404);
    }
    if (!["pending", "running"].includes(request.status)) {
      await sendGenerationRequestStatus(req, res, request.id);
      return true;
    }
    const queued = cancelQueuedGenerationJob(request.id);
    if (queued) {
      await store.updateGenerationRequest(request.id, {
        status: "cancelled",
        errorMessage: "client cancelled",
        errorCode: "client_cancelled",
        errorStage: "queue"
      });
      await traceGeneration(request.id, "failed", {
        userId: current.user.id,
        level: "warn",
        message: "client cancelled queued request",
        data: { stage: "queue" }
      });
    }
    await sendGenerationRequestStatus(req, res, request.id);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/images/generate") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    enforceGenerationRate(current.user.id);

    const body = await readJsonBody(req);
    const auditId = randomId("req_");
    const prompt = cleanPrompt(body.prompt);
    const providerPrompt = normalizeTextToImagePrompt(prompt, { seed: auditId });
    const settings = await store.getSettings();

    const user = await store.getUserById(current.user.id);
    if (!user || user.status !== "active") {
      throw httpError("Account is not active", 403);
    }

    const maxImages = Number(settings.maxImagesPerRequest || 1);
    const n = sanitizePositiveInt(body.n, 1, maxImages);
    const costPerImage = normalizeGenerationCost(settings.generationCreditCost ?? 1);
    const totalCost = costPerImage * n;
    const request = {
      model: String(settings.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      title: sanitizeGenerationTitle(body.title, prompt),
      prompt,
      n,
      size: normalizeImageSize(body.size),
      quality: choose(body.quality, ["auto", "low", "medium", "high"], "auto"),
      background: choose(body.background, ["auto", "opaque", "transparent"], "auto"),
      output_format: choose(body.outputFormat, ["png", "webp", "jpeg"], "png"),
      isPublic: body.isPublic === true,
      conversation: sanitizeConversationRoute(body.conversationRoute),
      publicTags: await normalizePublishPublicTags(body.publicTags, {
        kind: PUBLIC_KIND_TAGS.text,
        incrementUsage: body.isPublic === true
      })
    };
    if (request.isPublic) {
      const audit = await store.auditPromptForPublish({
        prompt: request.prompt,
        userId: user.id,
        requestedMode: "text-to-image",
        persist: true
      });
      if (audit.requiredMode === "image-to-image") {
        throw httpError("Prompt is too similar to existing public prompt; publish as image-to-image instead", 409, {
          requiredMode: "image-to-image",
          audit: auditPayload(audit)
        });
      }
    }
    const openaiRequest = {
      model: request.model,
      prompt: providerPrompt,
      n: request.n,
      size: request.size,
      quality: request.quality,
      background: request.background,
      output_format: request.output_format
    };
    const requestStartedAt = Date.now();
    const isAsyncGeneration = body.async === true;
    const requestedParams = safeJsonSummary({
      prompt: body.prompt,
      providerPrompt: providerPrompt === prompt ? undefined : providerPrompt,
      title: body.title,
      n: body.n,
      size: body.size,
      quality: body.quality,
      background: body.background,
      outputFormat: body.outputFormat,
      isPublic: body.isPublic,
      publicTags: body.publicTags
    });
    const normalizedParams = safeJsonSummary(request);
    const providerParams = safeJsonSummary(openaiRequest);
    await store.insertGenerationRequest({
      id: auditId,
      userId: user.id,
      prompt,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      isPublic: request.isPublic,
      status: "pending",
      queueStatus: "queued",
      maxAttempts: isAsyncGeneration ? 2 : 1,
      jobType: isAsyncGeneration ? "text-generation" : null,
      requestedParams,
      normalizedParams,
      providerParams,
      queuePayloadJson: isAsyncGeneration ? queuePayloadForTextGeneration({
        userId: user.id,
        request,
        openaiRequest,
        totalCost,
        costPerImage,
        requestStartedAt
      }) : null
    });
    await traceGeneration(auditId, "request_received", {
      userId: user.id,
      data: { mode: "text-to-image", async: isAsyncGeneration, requestedParams }
    });

    if (isAsyncGeneration) {
      const queue = enqueueGenerationJob({
        id: auditId,
        userId: user.id,
        run: () => runQueuedTextGeneration({
          auditId,
          user,
          settings,
          request,
          openaiRequest,
          totalCost,
          costPerImage,
          requestStartedAt
        })
      });
      sendJson(res, 202, {
        request: {
          id: auditId,
          status: "pending",
          normalizedStatus: "pending",
          ...queue
        },
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
      return true;
    }

    let reservedCredits = false;
    if (totalCost > 0) {
      reservedCredits = await store.reserveCredits(user.id, totalCost, {
        source: "generation_charge",
        referenceId: auditId,
        note: `${n} image(s)`
      });
      if (!reservedCredits) {
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          errorCode: "not_enough_credits",
          errorStage: "credit_reserved",
          durationMs: Date.now() - requestStartedAt
        });
        await traceGeneration(auditId, "failed", {
          userId: user.id,
          level: "warn",
          message: "not enough credits",
          data: { stage: "credit_reserved", totalCost }
        });
        throw httpError("Not enough credits", 402);
      }
      await traceGeneration(auditId, "credit_reserved", {
        userId: user.id,
        data: { totalCost, costPerImage }
      });
    }

    const aborter = attachRequestAbortController(req);
    try {
      await traceGeneration(auditId, "provider_selected", {
        userId: user.id,
        data: { model: openaiRequest.model, mode: "text-to-image" }
      });
      await traceGeneration(auditId, "params_normalized", {
        userId: user.id,
        data: { normalizedParams, providerParams }
      });
      await traceGeneration(auditId, "provider_submitted", {
        userId: user.id,
        data: { endpoint: "images/generations", providerParams }
      });
      const openaiResult = await callOpenAIImages(settings, openaiRequest, { signal: aborter.signal });
      const { saved, missing } = await finalizeSuccessfulGenerations({
        auditId,
        user,
        request,
        openaiResult,
        requestStartedAt,
        expectedCount: request.n
      });
      reservedCredits = false;
      if (costPerImage > 0 && missing > 0) {
        await store.addCredits(user.id, costPerImage * missing, {
          source: "generation_refund",
          referenceId: auditId,
          note: "unused candidate refund"
        }).catch((error) => console.error(error));
        await traceGeneration(auditId, "credit_refunded", {
          userId: user.id,
          data: { amount: costPerImage * missing, reason: "unused candidate refund" }
        });
      }
      await traceGeneration(auditId, "credit_charged", {
        userId: user.id,
        data: { totalCost, saved: saved.length }
      });

      sendJson(res, 200, {
        generations: saved,
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
      return true;
    } catch (error) {
      const cancelled = aborter.isAborted() || error?.name === "AbortError";
      const durationMs = Date.now() - requestStartedAt;
      if (reservedCredits) await store.addCredits(user.id, totalCost, {
        source: cancelled ? "generation_cancel_refund" : "generation_error_refund",
        referenceId: auditId,
        note: cancelled ? "client aborted" : "generation failed"
      }).catch((refundError) => console.error(refundError));
      if (reservedCredits) {
        await traceGeneration(auditId, "credit_refunded", {
          userId: user.id,
          data: { amount: totalCost, reason: cancelled ? "client aborted" : "generation failed" }
        });
      }
      await traceGeneration(auditId, "failed", {
        userId: user.id,
        level: cancelled ? "warn" : "error",
        message: cancelled ? "client aborted" : String(error.message || error).slice(0, 512),
        data: errorSummary(error)
      });
      await store.updateGenerationRequest(auditId, cancelled
        ? { status: "cancelled", errorMessage: "client aborted", errorCode: "client_aborted", errorStage: "provider_generation", durationMs }
        : { status: "failed", errorMessage: String(error.message || error).slice(0, 2000), errorCode: String(error.code || error.status || "generation_failed").slice(0, 96), errorStage: "provider_generation", durationMs }
      ).catch((auditError) => console.error(auditError));
      if (cancelled) {
        // 连接已断，无法/无需写入响应；调用方上层 try/catch 的 status>=500 抑制也不会触发。
        if (!res.writableEnded) {
          try { res.end(); } catch { /* ignore */ }
        }
        return true;
      }
      throw error;
    } finally {
      aborter.detach();
    }
  }

  if (req.method === "POST" && url.pathname === "/api/images/edit") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    enforceGenerationRate(current.user.id);

    const body = await readJsonBody(req);
    const prompt = cleanPrompt(body.prompt);
    const imageData = String(body.imageData || "").trim();
    const maskData = String(body.maskData || "").trim();
    if (!imageData) {
      throw httpError("Please provide an editable image", 400);
    }
    editableImageSource(imageData, "Editable image");
    if (maskData.startsWith("data:image/")) validateImageDataUrl(maskData);

    const settings = await store.getSettings();
    const referenceImages = normalizedEditReferenceImages(body, {
      limit: normalizeMaxReferenceImages(settings.maxReferenceImages)
    });

    const user = await store.getUserById(current.user.id);
    if (!user || user.status !== "active") {
      throw httpError("Account is not active", 403);
    }

    const maxImages = Number(settings.maxImagesPerRequest || 1);
    const n = sanitizePositiveInt(body.n, 1, maxImages);
    const costPerImage = normalizeGenerationCost(settings.generationCreditCost ?? 1);
    const totalCost = costPerImage * n;
    const sourceFilename = body.publishOriginal === true
      ? await saveSourceImageFromData(body.sourceImageData || imageData)
      : "";
    const request = {
      model: String(settings.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      title: sanitizeGenerationTitle(body.title, prompt),
      prompt,
      n,
      size: normalizeImageSize(body.size),
      quality: "auto",
      background: "auto",
      output_format: "png",
      isPublic: body.isPublic === true,
      sourceFilename,
      publishOriginal: body.publishOriginal === true,
      conversation: sanitizeConversationRoute(body.conversationRoute),
      publicTags: await normalizePublishPublicTags(body.publicTags, {
        kind: PUBLIC_KIND_TAGS.image,
        incrementUsage: body.isPublic === true
      })
    };
    if (request.isPublic) {
      await store.auditPromptForPublish({
        prompt: request.prompt,
        userId: user.id,
        requestedMode: "image-to-image",
        persist: true
      });
    }
    const auditId = randomId("req_");
    const requestStartedAt = Date.now();
    const payload = {
      model: request.model,
      prompt: maskData
        ? `${prompt}\nThe uploaded image contains a purple visual annotation. Only modify the purple boxed or purple painted area, keep all unmarked areas unchanged, and remove the purple annotation from the final image.`
        : prompt,
      n: request.n,
      size: request.size,
      imageData,
      referenceImages,
      maskData
    };
    const isAsyncGeneration = body.async === true;
    const requestedParams = safeJsonSummary({
      prompt: body.prompt,
      n: body.n,
      size: body.size,
      isPublic: body.isPublic,
      publishOriginal: body.publishOriginal,
      publicTags: body.publicTags,
      hasMask: Boolean(maskData),
      referenceImageCount: referenceImages.length
    });
    const normalizedParams = safeJsonSummary(request);
    const providerParams = safeJsonSummary({
      ...payload,
      imageData: "[image-data]",
      referenceImages: "[reference-images]",
      maskData: payload.maskData ? "[edit-mask]" : ""
    });
    await store.insertGenerationRequest({
      id: auditId,
      userId: user.id,
      prompt: `[image-edit] ${prompt}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      isPublic: request.isPublic,
      status: "pending",
      queueStatus: "queued",
      maxAttempts: isAsyncGeneration ? 2 : 1,
      jobType: isAsyncGeneration ? "image-edit" : null,
      requestedParams,
      normalizedParams,
      providerParams,
      queuePayloadJson: isAsyncGeneration ? queuePayloadForImageEdit({
        userId: user.id,
        request,
        payload,
        totalCost,
        costPerImage,
        requestStartedAt
      }) : null
    });
    await traceGeneration(auditId, "request_received", {
      userId: user.id,
      data: { mode: "image-to-image", async: isAsyncGeneration, requestedParams }
    });

    if (isAsyncGeneration) {
      const queue = enqueueGenerationJob({
        id: auditId,
        userId: user.id,
        run: () => runQueuedImageEdit({
          auditId,
          user,
          settings,
          request,
          payload,
          totalCost,
          costPerImage,
          requestStartedAt
        })
      });
      sendJson(res, 202, {
        request: {
          id: auditId,
          status: "pending",
          normalizedStatus: "pending",
          ...queue
        },
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
      return true;
    }

    let reservedCredits = false;
    if (totalCost > 0) {
      reservedCredits = await store.reserveCredits(user.id, totalCost, {
        source: "generation_charge",
        referenceId: auditId,
        note: request.n > 1 ? `image edit ${request.n} image(s)` : "image edit"
      });
      if (!reservedCredits) {
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          errorCode: "not_enough_credits",
          errorStage: "credit_reserved",
          durationMs: Date.now() - requestStartedAt
        });
        await traceGeneration(auditId, "failed", {
          userId: user.id,
          level: "warn",
          message: "not enough credits",
          data: { stage: "credit_reserved", totalCost }
        });
        throw httpError("Not enough credits", 402);
      }
      await traceGeneration(auditId, "credit_reserved", {
        userId: user.id,
        data: { totalCost, costPerImage }
      });
    }

    const aborter = attachRequestAbortController(req);
    try {
      await traceGeneration(auditId, "provider_selected", {
        userId: user.id,
        data: { model: payload.model, mode: "image-to-image" }
      });
      await traceGeneration(auditId, "params_normalized", {
        userId: user.id,
        data: { normalizedParams, providerParams }
      });
      await traceGeneration(auditId, "provider_submitted", {
        userId: user.id,
        data: { endpoint: "images/edits", providerParams }
      });
      const openaiResult = await callOpenAIImageEdits(settings, payload, { signal: aborter.signal });
      const { saved, missing } = await finalizeSuccessfulGenerations({
        auditId,
        user,
        request,
        openaiResult,
        requestStartedAt,
        expectedCount: request.n
      });
      reservedCredits = false;
      if (costPerImage > 0 && missing > 0) {
        await store.addCredits(user.id, costPerImage * missing, {
          source: "generation_refund",
          referenceId: auditId,
          note: "unused image edit candidate refund"
        }).catch((error) => console.error(error));
        await traceGeneration(auditId, "credit_refunded", {
          userId: user.id,
          data: { amount: costPerImage * missing, reason: "unused image edit candidate refund" }
        });
      }
      await traceGeneration(auditId, "credit_charged", {
        userId: user.id,
        data: { totalCost, saved: saved.length }
      });

      sendJson(res, 200, {
        generations: saved,
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
      return true;
    } catch (error) {
      const cancelled = aborter.isAborted() || error?.name === "AbortError";
      const durationMs = Date.now() - requestStartedAt;
      if (reservedCredits) await store.addCredits(user.id, totalCost, {
        source: cancelled ? "generation_cancel_refund" : "generation_error_refund",
        referenceId: auditId,
        note: cancelled ? "client aborted" : "image edit failed"
      }).catch((refundError) => console.error(refundError));
      if (reservedCredits) {
        await traceGeneration(auditId, "credit_refunded", {
          userId: user.id,
          data: { amount: totalCost, reason: cancelled ? "client aborted" : "image edit failed" }
        });
      }
      await traceGeneration(auditId, "failed", {
        userId: user.id,
        level: cancelled ? "warn" : "error",
        message: cancelled ? "client aborted" : String(error.message || error).slice(0, 512),
        data: errorSummary(error)
      });
      await store.updateGenerationRequest(auditId, cancelled
        ? { status: "cancelled", errorMessage: "client aborted", errorCode: "client_aborted", errorStage: "provider_edit", durationMs }
        : { status: "failed", errorMessage: String(error.message || error).slice(0, 2000), errorCode: String(error.code || error.status || "image_edit_failed").slice(0, 96), errorStage: "provider_edit", durationMs }
      ).catch((auditError) => console.error(auditError));
      if (cancelled) {
        if (!res.writableEnded) {
          try { res.end(); } catch { /* ignore */ }
        }
        return true;
      }
      throw error;
    } finally {
      aborter.detach();
    }
  }
    return false;
  };
}

module.exports = { createImagesGenerateRoute };
