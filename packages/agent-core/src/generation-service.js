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
  traceGeneration,
  safeJsonSummary,
  defaultModel
}) {
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
            errorMessage: summary.errorMessage
          }
        };
      })
    };
  }

  function agentVariantGenerationRequest({ variant, index, plan, body, settings, session }) {
    const prompt = cleanPrompt(variant.prompt || plan.userRequest || body.prompt || body.message || "");
    return {
      model: String(settings.model || defaultModel).trim() || defaultModel,
      title: sanitizeGenerationTitle(variant.title || body.title, prompt),
      prompt,
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
        }
      ]),
      publicTags: []
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
    for (const [index, variant] of variants.entries()) {
      const request = agentVariantGenerationRequest({ variant, index, plan, body, settings, session });
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
        maxAttempts: dryRun ? 1 : 2,
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

  return {
    decorateAgentSession,
    generateAgentBatch,
    exportAgentCanvas
  };
}

module.exports = {
  createAgentGenerationService
};
