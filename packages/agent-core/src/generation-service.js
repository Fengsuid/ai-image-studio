function createAgentGenerationService({
  store,
  httpError,
  randomId,
  nowIso,
  choose,
  cleanPrompt,
  sanitizeGenerationTitle,
  normalizeImageSize,
  normalizeGenerationCost,
  sanitizeConversationRoute,
  getClientIp,
  getUserAgent,
  enforceGenerationRate,
  queuePayloadForTextGeneration,
  enqueueGenerationJob,
  runQueuedTextGeneration,
  recoveredGenerationJobFromRequest,
  traceGeneration,
  safeJsonSummary,
  defaultModel
}) {
  const AGENT_SESSION_FORMAT = "ai-image-studio.agent-session.v1";
  const TERMINAL_STEP_STATUSES = new Set(["succeeded", "failed", "cancelled", "skipped", "expired"]);
  const RETRYABLE_STEP_STATUSES = new Set(["pending", "running", "failed", "cancelled", "expired"]);
  const ZIP_FETCH_TIMEOUT_MS = 5000;

  function normalizeAgentBatchQuality(value) {
    const quality = String(value || "").trim().toLowerCase();
    if (quality === "standard") return "auto";
    return choose(quality, ["auto", "low", "medium", "high"], "auto");
  }

  function cleanAgentValue(value, max = 1000) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function latestAgentPlanFromSession(session = {}) {
    const steps = Array.isArray(session.steps) ? session.steps : [];
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const output = steps[index]?.output;
      if (steps[index]?.kind === "plan" && output?.format === "ai-image-studio.agent-plan.v1") {
        return output;
      }
    }
    return null;
  }

  function selectedAgentPlanVariants(plan = {}, selectedVariantIds = []) {
    const variants = Array.isArray(plan.variants) ? plan.variants : [];
    const selected = new Set((selectedVariantIds || []).map((id) => cleanAgentValue(id, 64)).filter(Boolean));
    return (selected.size ? variants.filter((variant) => selected.has(variant.id)) : variants).slice(0, 4);
  }

  function agentRequestStatusPayload(request = {}) {
    const normalizedStatus = request.status === "success" ? "succeeded" : request.status || "";
    const generationIds = Array.isArray(request.generationIds) ? request.generationIds.filter(Boolean) : [];
    const firstGenerationId = request.firstGenerationId || generationIds[0] || "";
    return {
      id: request.id || "",
      status: normalizedStatus,
      queueStatus: request.queueStatus || "",
      firstGenerationId,
      generationIds,
      imageUrl: firstGenerationId ? `/api/images/${firstGenerationId}/file` : "",
      image_url: firstGenerationId ? `/api/images/${firstGenerationId}/file` : "",
      errorMessage: request.errorMessage || "",
      errorCode: request.errorCode || "",
      errorStage: request.errorStage || request.failureStage || "",
      updatedAt: request.updatedAt || "",
      createdAt: request.createdAt || ""
    };
  }

  function agentStepStatusFromRequest(request = {}) {
    const status = request.status === "success" ? "succeeded" : request.status || "";
    if (status === "succeeded") return "succeeded";
    if (status === "running") return "running";
    if (status === "pending") return "pending";
    if (status === "cancelled") return "cancelled";
    if (status === "failed" || status === "expired") return "failed";
    return "";
  }

  async function decorateAgentSession(session = {}) {
    const steps = Array.isArray(session.steps) ? session.steps : [];
    const requestIds = [...new Set(steps.map((step) => String(step?.requestId || "").trim()).filter(Boolean))].slice(0, 50);
    if (!requestIds.length) return session;

    const requestsById = new Map();
    for (const requestId of requestIds) {
      const request = await store.getGenerationRequestById(requestId).catch(() => null);
      if (request && request.userId === session.userId) requestsById.set(requestId, request);
    }
    if (!requestsById.size) return session;

    return {
      ...session,
      steps: steps.map((step) => {
        const request = requestsById.get(step.requestId);
        if (!request) return step;
        const summary = agentRequestStatusPayload(request);
        return {
          ...step,
          status: agentStepStatusFromRequest(request) || step.status,
          generationId: summary.firstGenerationId || step.generationId,
          output: {
            ...(step.output || {}),
            request: {
              ...(step.output?.request || {}),
              ...summary
            },
            requestStatus: summary.status,
            queueStatus: summary.queueStatus,
            generationIds: summary.generationIds,
            imageUrl: summary.imageUrl,
            image_url: summary.image_url,
            errorMessage: summary.errorMessage
          }
        };
      })
    };
  }

  function agentVariantGenerationRequest({ variant, index, plan, body, settings, session, stepRefs }) {
    const promptResult = resolveAgentStepReferences(variant.prompt || plan.userRequest || body.prompt || body.message || "", stepRefs);
    const prompt = cleanPrompt(promptResult.prompt);
    return {
      model: String(settings.model || defaultModel).trim() || defaultModel,
      title: sanitizeGenerationTitle(variant.title || body.title, prompt),
      prompt,
      upstreamRefs: promptResult.refs,
      n: 1,
      size: normalizeImageSize(variant.size || body.size || "1024x1536"),
      quality: normalizeAgentBatchQuality(variant.quality || body.quality),
      background: choose(String(body.background || "auto"), ["auto", "opaque", "transparent"], "auto"),
      output_format: choose(String(body.outputFormat || "png"), ["png", "webp", "jpeg"], "png"),
      isPublic: false,
      conversation: sanitizeConversationRoute([
        {
          id: session.id,
          type: "agent_session",
          prompt: plan.userRequest || body.message || "",
          createdAt: session.createdAt || nowIso()
        },
        {
          id: variant.id || `variant_${index + 1}`,
          type: "agent_variant",
          prompt
        },
        ...promptResult.refs.map((ref) => ({
          id: ref.ref,
          type: "agent_step_ref",
          prompt: ref.value
        }))
      ]),
      publicTags: []
    };
  }

  function collectAgentStepImageRefs(session = {}) {
    const refs = new Map();
    const steps = Array.isArray(session.steps) ? session.steps : [];
    let outputIndex = 0;
    for (const step of steps) {
      if (step?.kind !== "generate_batch") continue;
      outputIndex += 1;
      const imageUrl = cleanAgentValue(
        step.output?.image_url || step.output?.imageUrl || (step.generationId ? `/api/images/${step.generationId}/file` : ""),
        500
      );
      if (!imageUrl) continue;
      refs.set(`step[${outputIndex}].output.image_url`, imageUrl);
      refs.set(`step[${outputIndex}].output.imageUrl`, imageUrl);
      if (step.id) {
        refs.set(`step["${step.id}"].output.image_url`, imageUrl);
        refs.set(`step['${step.id}'].output.image_url`, imageUrl);
      }
    }
    return refs;
  }

  function resolveAgentStepReferences(prompt, stepRefs = new Map()) {
    const refs = [];
    const text = cleanAgentValue(prompt, 5000).replace(/step\[(\d+|["'][^"']+["'])\]\.output\.(image_url|imageUrl)/g, (match) => {
      const value = stepRefs.get(match) || "";
      refs.push({ ref: match, value });
      return value || match;
    });
    return {
      prompt: text,
      refs: refs.filter((ref) => ref.value)
    };
  }

  async function generateAgentBatch({ currentUser, session, plan, variants, body = {}, req }) {
    const dryRun = body.dryRun === true;
    if (!dryRun) enforceGenerationRate(currentUser.id);

    const user = await store.getUserById(currentUser.id);
    if (!user || user.status !== "active") {
      throw httpError("Account is not active", 403);
    }

    const settings = await store.getSettings();
    const costPerImage = normalizeGenerationCost(settings.generationCreditCost ?? 1);
    const requests = [];
    const stepRefs = collectAgentStepImageRefs(session);
    for (const [index, variant] of variants.entries()) {
      const request = agentVariantGenerationRequest({ variant, index, plan, body, settings, session, stepRefs });
      const openaiRequest = {
        model: request.model,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
        quality: request.quality,
        background: request.background,
        output_format: request.output_format
      };
      const totalCost = costPerImage * request.n;
      const auditId = randomId("req_");
      const requestStartedAt = Date.now();
      const variantId = cleanAgentValue(variant.id || `variant_${index + 1}`, 64);
      const requestedParams = safeJsonSummary({
        mode: "agent-batch",
        agentSessionId: session.id,
        planFormat: plan.format || "",
        variantId,
        variantTitle: variant.title || "",
        dryRun,
        prompt: variant.prompt,
        resolvedPrompt: request.prompt,
        upstreamRefs: request.upstreamRefs,
        size: variant.size,
        quality: variant.quality
      });
      const normalizedParams = safeJsonSummary({
        ...request,
        agentSessionId: session.id,
        agentVariantId: variantId,
        dryRun
      });
      const providerParams = safeJsonSummary(openaiRequest);

      await store.insertGenerationRequest({
        id: auditId,
        userId: user.id,
        prompt: request.prompt,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        isPublic: false,
        status: dryRun ? "cancelled" : "pending",
        queueStatus: dryRun ? "cancelled" : "queued",
        maxAttempts: dryRun ? 1 : 3,
        finishedAt: dryRun ? new Date() : null,
        latencyMs: dryRun ? 0 : null,
        jobType: dryRun ? "agent-batch-dry-run" : "text-generation",
        requestedParams,
        normalizedParams,
        providerParams,
        queuePayloadJson: dryRun ? null : queuePayloadForTextGeneration({
          userId: user.id,
          request,
          openaiRequest,
          totalCost,
          costPerImage,
          requestStartedAt
        }),
        errorCode: dryRun ? "agent_batch_dry_run" : null,
        errorStage: dryRun ? "dry_run" : null,
        errorMessage: dryRun ? "Agent batch dry run; provider not called" : null
      });
      await traceGeneration(auditId, "request_received", {
        userId: user.id,
        data: {
          mode: "agent-batch",
          async: !dryRun,
          dryRun,
          agentSessionId: session.id,
          variantId,
          requestedParams
        }
      });

      let queue = null;
      if (dryRun) {
        await traceGeneration(auditId, "agent_batch_dry_run", {
          userId: user.id,
          level: "debug",
          message: "agent batch dry run skipped provider enqueue",
          data: { agentSessionId: session.id, variantId }
        });
      } else {
        queue = enqueueGenerationJob({
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
        await traceGeneration(auditId, "agent_batch_enqueued", {
          userId: user.id,
          data: { agentSessionId: session.id, variantId, queue }
        });
      }

      requests.push({
        id: auditId,
        variantId,
        title: request.title,
        prompt: request.prompt,
        size: request.size,
        quality: request.quality,
        upstreamRefs: request.upstreamRefs,
        status: dryRun ? "cancelled" : "pending",
        queueStatus: dryRun ? "cancelled" : "queued",
        variant: {
          id: variantId,
          title: cleanAgentValue(variant.title || request.title, 160),
          prompt: request.prompt,
          size: request.size,
          quality: request.quality
        },
        queue
      });
    }

    return {
      dryRun,
      requests,
      credits: await store.getUserCredits(user.id),
      generationCost: costPerImage,
      totalEstimatedCost: dryRun ? 0 : costPerImage * requests.length
    };
  }

  async function resumeAgentSession({ currentUser, session }) {
    const steps = agentStepsForResume(session);
    const resumed = [];
    const skipped = [];
    for (const step of steps) {
      const result = await requeueAgentStep({ currentUser, session, step, mode: "resume" }).catch((error) => ({ error }));
      if (result?.error) {
        skipped.push({ stepId: step.id, reason: String(result.error.message || result.error).slice(0, 200) });
      } else if (result?.queued) {
        resumed.push(result);
      } else {
        skipped.push({ stepId: step.id, reason: result?.reason || "not resumable" });
      }
    }
    return {
      resumed,
      skipped,
      resumedCount: resumed.length,
      credits: await store.getUserCredits(currentUser.id)
    };
  }

  async function retryAgentStep({ currentUser, session, stepId, note = "" }) {
    const step = (Array.isArray(session.steps) ? session.steps : []).find((item) => item.id === stepId);
    if (!step) throw httpError("Agent step not found", 404);
    if (!RETRYABLE_STEP_STATUSES.has(String(step.status || "pending"))) {
      throw httpError("Agent step is not retryable", 400);
    }
    const result = await requeueAgentStep({ currentUser, session, step, mode: "manual_retry", note });
    if (!result?.queued) throw httpError(result?.reason || "Agent step could not be retried", 400);
    return {
      retry: result,
      credits: await store.getUserCredits(currentUser.id)
    };
  }

  function agentStepsForResume(session = {}) {
    return (Array.isArray(session.steps) ? session.steps : [])
      .filter((step) => step?.kind === "generate_batch" && step.requestId)
      .filter((step) => ["pending", "running"].includes(String(step.status || "pending")));
  }

  async function requeueAgentStep({ currentUser, session, step, mode, note = "" }) {
    if (typeof recoveredGenerationJobFromRequest !== "function") {
      throw httpError("Agent step recovery is not configured", 501);
    }
    const request = await store.getGenerationRequestById(step.requestId).catch(() => null);
    if (!request || request.userId !== currentUser.id || request.userId !== session.userId) {
      throw httpError("Agent generation request not found", 404);
    }
    if (!request.queuePayloadJson) return { queued: false, stepId: step.id, requestId: request.id, reason: "missing queue payload" };
    const requestStatus = agentStepStatusFromRequest(request);
    if (mode === "resume" && TERMINAL_STEP_STATUSES.has(requestStatus)) {
      await updateAgentStepSafe(currentUser.id, step.id, {
        status: requestStatus,
        generationId: request.firstGenerationId || step.generationId || "",
        output: {
          ...(step.output || {}),
          request: {
            ...(step.output?.request || {}),
            ...agentRequestStatusPayload(request)
          }
        }
      });
      return { queued: false, stepId: step.id, requestId: request.id, reason: `already ${requestStatus}` };
    }

    const resetAttempts = mode === "manual_retry";
    await store.updateGenerationRequest(request.id, {
      status: "pending",
      queueStatus: "queued",
      attemptCount: resetAttempts ? 0 : request.attemptCount,
      maxAttempts: 3,
      lockedBy: null,
      lockedAt: null,
      startedAt: null,
      finishedAt: null,
      retryAfterAt: null,
      errorMessage: null,
      errorCode: null,
      errorStage: null,
      failureStage: null
    });
    const updatedRequest = await store.getGenerationRequestById(request.id);
    const job = await recoveredGenerationJobFromRequest(updatedRequest);
    if (!job) return { queued: false, stepId: step.id, requestId: request.id, reason: "recovery job unavailable" };
    const queue = enqueueGenerationJob(job, { persistQueued: false });
    await updateAgentStepSafe(currentUser.id, step.id, {
      status: "running",
      output: {
        ...(step.output || {}),
        retry: {
          mode,
          note,
          queuedAt: nowIso(),
          maxAttempts: 3
        }
      }
    });
    await traceGeneration(request.id, mode === "resume" ? "agent_session_resume_queued" : "agent_step_retry_queued", {
      userId: currentUser.id,
      data: { agentSessionId: session.id, stepId: step.id, mode, queue }
    });
    return {
      queued: true,
      mode,
      stepId: step.id,
      requestId: request.id,
      queue
    };
  }

  async function updateAgentStepSafe(userId, stepId, patch) {
    if (typeof store.updateAgentStepForUser !== "function") return null;
    return store.updateAgentStepForUser(stepId, userId, patch);
  }

  function generatedRequestsFromAgentSession(session = {}) {
    const steps = Array.isArray(session.steps) ? session.steps : [];
    return steps
      .filter((step) => step?.kind === "generate_batch" && step.requestId)
      .map((step) => ({
        requestId: step.requestId,
        variantId: cleanAgentValue(step.output?.request?.variantId || step.input?.id || step.input?.variantId, 64)
      }));
  }

  async function loadAgentRequestsByVariant(session = {}, body = {}) {
    const entries = generatedRequestsFromAgentSession(session);
    const selectedRequestIds = Array.isArray(body.requestIds)
      ? new Set(body.requestIds.map((id) => cleanAgentValue(id, 64)).filter(Boolean))
      : null;
    const byVariant = new Map();
    for (const entry of entries) {
      if (selectedRequestIds?.size && !selectedRequestIds.has(entry.requestId)) continue;
      const request = await store.getGenerationRequestById(entry.requestId).catch(() => null);
      if (!request || request.userId !== session.userId) continue;
      if (entry.variantId) byVariant.set(entry.variantId, agentRequestStatusPayload(request));
    }
    return byVariant;
  }

  function agentCanvasTitle({ body = {}, session = {}, plan = {} } = {}) {
    const explicit = cleanAgentValue(body.title, 160);
    if (explicit) return explicit;
    const base = cleanAgentValue(session.title || plan.intent || "Agent session", 120);
    return `Agent Canvas - ${base}`.slice(0, 160);
  }

  function agentCanvasDocument({ title, session, plan, variants, requestByVariant }) {
    const nodes = [];
    const edges = [];
    const now = nowIso();
    for (const [index, variant] of variants.entries()) {
      const y = 80 + index * 250;
      const variantId = cleanAgentValue(variant.id || `variant_${index + 1}`, 64);
      const promptId = `agent_prompt_${index + 1}`;
      const configId = `agent_config_${index + 1}`;
      const outputId = `agent_output_${index + 1}`;
      const request = requestByVariant.get(variantId) || null;
      const generationId = request?.firstGenerationId || "";
      const generationIds = Array.isArray(request?.generationIds) ? request.generationIds : [];

      nodes.push({
        id: promptId,
        type: "prompt",
        x: 80,
        y,
        width: 320,
        height: 170,
        content: cleanAgentValue(variant.title || `Variant ${index + 1}`, 160),
        prompt: cleanAgentValue(variant.prompt || plan.userRequest || "", 4000)
      });
      nodes.push({
        id: configId,
        type: "config",
        x: 440,
        y,
        width: 250,
        height: 170,
        content: "Agent generation config",
        model: cleanAgentValue(variant.model || defaultModel, 120),
        size: cleanAgentValue(variant.size || "1024x1536", 32),
        quality: normalizeAgentBatchQuality(variant.quality || "auto"),
        candidateCount: 1
      });
      nodes.push({
        id: outputId,
        type: "output",
        x: 740,
        y,
        width: 300,
        height: 190,
        content: request?.status ? `Agent output: ${request.status}` : "Agent output placeholder",
        status: request?.status || "pending",
        generationStatus: request?.status || "",
        generationError: request?.errorMessage || "",
        generationId,
        generationIds,
        imageUrl: request?.imageUrl || ""
      });
      edges.push({ id: `agent_edge_prompt_${index + 1}`, source: promptId, target: outputId });
      edges.push({ id: `agent_edge_config_${index + 1}`, source: configId, target: outputId });
    }

    return {
      schema: "ai-image-studio.canvas.v1",
      version: 1,
      title,
      viewport: { x: 0, y: 0, zoom: 0.88 },
      nodes,
      edges,
      meta: {
        source: "agent-workspace",
        agentSessionId: session.id,
        planFormat: plan.format || "",
        exportedAt: now
      }
    };
  }

  function canvasProjectForAgentResponse(canvas = {}) {
    return {
      id: canvas.id || "",
      title: canvas.title || "",
      description: canvas.description || "",
      coverUrl: canvas.coverUrl || "",
      visibility: canvas.visibility || "private",
      isTemplate: Boolean(canvas.isTemplate),
      dataJson: canvas.dataJson || {},
      nodeCount: Number(canvas.nodeCount || 0),
      edgeCount: Number(canvas.edgeCount || 0),
      status: canvas.status || "active",
      createdAt: canvas.createdAt || "",
      updatedAt: canvas.updatedAt || "",
      url: canvas.id ? `/canvas-v2?id=${encodeURIComponent(canvas.id)}` : ""
    };
  }

  async function exportAgentCanvas({ currentUser, session, body = {} }) {
    const plan = body.plan && typeof body.plan === "object" ? body.plan : latestAgentPlanFromSession(session);
    if (!plan?.format || !Array.isArray(plan.variants)) {
      throw httpError("Agent plan is required before exporting Canvas", 400);
    }
    const variants = selectedAgentPlanVariants(plan, body.selectedVariantIds);
    if (!variants.length) throw httpError("No Agent plan variants selected for Canvas export", 400);

    const title = agentCanvasTitle({ body, session, plan });
    const requestByVariant = await loadAgentRequestsByVariant(session, body);
    const dataJson = agentCanvasDocument({ title, session, plan, variants, requestByVariant });
    const canvas = await store.createCanvasProject({
      id: randomId("can_"),
      userId: currentUser.id,
      title,
      description: cleanAgentValue(body.description || `Exported from Agent session ${session.id}`, 1000),
      visibility: "private",
      dataJson,
      nodeCount: dataJson.nodes.length,
      edgeCount: dataJson.edges.length
    });

    for (const [index, variant] of variants.entries()) {
      const request = requestByVariant.get(cleanAgentValue(variant.id || `variant_${index + 1}`, 64));
      if (!request?.generationIds?.length) continue;
      await store.createCanvasGenerationLinks({
        canvasId: canvas.id,
        generationIds: request.generationIds,
        outputNodeId: `agent_output_${index + 1}`,
        configNodeId: `agent_config_${index + 1}`
      });
    }

    return { canvas: canvasProjectForAgentResponse(canvas) };
  }

  async function exportAgentSessionArchive({ session, format = "json", baseUrl = "", fetchHeaders = {} }) {
    const exported = {
      format: AGENT_SESSION_FORMAT,
      exportedAt: nowIso(),
      session
    };
    if (format !== "zip") return exported;

    const imageAssets = await collectAgentZipImageAssets(session, { baseUrl, fetchHeaders });
    const safeTitle = safeZipName(session.title || session.id || "agent-session");
    return createZipBuffer([
      {
        name: "manifest.json",
        content: JSON.stringify({
          format: AGENT_SESSION_FORMAT,
          exportedAt: exported.exportedAt,
          sessionId: session.id,
          title: session.title,
          messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
          stepCount: Array.isArray(session.steps) ? session.steps.length : 0,
          imageAssetCount: imageAssets.filter((asset) => asset.status === "included").length,
          imageReferenceCount: imageAssets.length
        }, null, 2)
      },
      {
        name: "images/manifest.json",
        content: JSON.stringify({ references: imageAssets.map(zipAssetManifestEntry) }, null, 2)
      },
      {
        name: `${safeTitle || "agent-session"}.agent-session.json`,
        content: JSON.stringify(exported, null, 2)
      },
      ...imageAssets
        .filter((asset) => asset.status === "included" && asset.content)
        .map((asset) => ({ name: asset.path, content: asset.content }))
    ]);
  }

  async function collectAgentZipImageAssets(session = {}, options = {}) {
    const references = collectAgentSessionImageReferences(session);
    const assets = [];
    for (const reference of references) {
      const resolved = await fetchZipImageAsset(reference.url, options);
      if (resolved?.content) {
        const path = `assets/images/image-${String(assets.filter((item) => item.status === "included").length + 1).padStart(3, "0")}.${extensionForMime(resolved.mime)}`;
        assets.push({
          path,
          source: reference.url,
          context: reference.context,
          mime: resolved.mime,
          bytes: resolved.content.length,
          status: "included",
          content: resolved.content
        });
      } else {
        assets.push({
          path: "",
          source: reference.url,
          context: reference.context,
          mime: "",
          bytes: 0,
          status: "failed",
          error: resolved?.error || "unavailable"
        });
      }
    }
    return assets;
  }

  function collectAgentSessionImageReferences(session = {}) {
    const refs = [];
    const seen = new Set();
    const add = (url, context) => {
      const text = cleanAgentValue(url, 500);
      if (!text || seen.has(text)) return;
      seen.add(text);
      refs.push({ url: text, context });
    };
    for (const [index, step] of (Array.isArray(session.steps) ? session.steps : []).entries()) {
      add(step.output?.image_url || step.output?.imageUrl, `steps[${index}].output.image_url`);
      for (const generationId of step.output?.generationIds || []) add(`/api/images/${generationId}/file`, `steps[${index}].output.generationIds`);
      if (step.generationId) add(`/api/images/${step.generationId}/file`, `steps[${index}].generationId`);
    }
    return refs;
  }

  async function fetchZipImageAsset(reference, { baseUrl = "", fetchHeaders = {} } = {}) {
    if (typeof fetch !== "function") return { error: "fetch unavailable" };
    const url = absoluteFetchUrl(reference, baseUrl);
    if (!url) return { error: "relative reference requires baseUrl" };
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), ZIP_FETCH_TIMEOUT_MS) : 0;
    try {
      const response = await fetch(url, { headers: fetchHeaders, signal: controller?.signal });
      if (!response.ok) return { error: `HTTP ${response.status}` };
      const mime = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!mime.startsWith("image/")) return { error: `Unsupported content type: ${mime || "unknown"}` };
      return {
        content: Buffer.from(await response.arrayBuffer()),
        mime
      };
    } catch (error) {
      return { error: String(error?.message || error).slice(0, 500) };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return {
    decorateAgentSession,
    generateAgentBatch,
    resumeAgentSession,
    retryAgentStep,
    exportAgentCanvas,
    exportAgentSessionArchive
  };
}

function absoluteFetchUrl(reference, baseUrl) {
  const text = String(reference || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (!baseUrl) return "";
  try {
    return new URL(text, baseUrl).toString();
  } catch {
    return "";
  }
}

function zipAssetManifestEntry(asset) {
  return {
    path: asset.path,
    source: asset.source,
    context: asset.context,
    mime: asset.mime,
    bytes: asset.bytes,
    status: asset.status,
    error: asset.error || ""
  };
}

function extensionForMime(mime) {
  const normalized = String(mime || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "bin";
}

function safeZipName(value) {
  return String(value || "agent-session")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createZipBuffer(entries = []) {
  const fileRecords = [];
  const chunks = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(String(entry.name || "entry.txt"), "utf8");
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(String(entry.content || ""), "utf8");
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime(new Date("2026-01-01T00:00:00.000Z")), 10);
    local.writeUInt16LE(dosDate(new Date("2026-01-01T00:00:00.000Z")), 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, content);
    fileRecords.push({ name, content, crc, offset });
    offset += local.length + name.length + content.length;
  }

  const centralStart = offset;
  for (const record of fileRecords) {
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime(new Date("2026-01-01T00:00:00.000Z")), 12);
    central.writeUInt16LE(dosDate(new Date("2026-01-01T00:00:00.000Z")), 14);
    central.writeUInt32LE(record.crc, 16);
    central.writeUInt32LE(record.content.length, 20);
    central.writeUInt32LE(record.content.length, 24);
    central.writeUInt16LE(record.name.length, 28);
    central.writeUInt32LE(record.offset, 42);
    chunks.push(central, record.name);
    offset += central.length + record.name.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(fileRecords.length, 8);
  end.writeUInt16LE(fileRecords.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  chunks.push(end);
  return Buffer.concat(chunks);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  return (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
}

function dosDate(date) {
  return ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
}

module.exports = {
  createAgentGenerationService
};
