// SPDX-License-Identifier: AGPL-3.0-or-later
"use strict";

const canvasAssistant = require("./assistant");
const canvasImportExport = require("./import-export");

const CANVAS_PRIVATE_KEYS = new Set([
  "userId",
  "userName",
  "userEmail",
  "author",
  "authorId",
  "authorName",
  "authorEmail",
  "owner",
  "ownerId",
  "ownerName",
  "ownerEmail",
  "createdBy",
  "createdById",
  "createdByName",
  "createdByEmail",
  "updatedBy",
  "updatedById",
  "updatedByName",
  "updatedByEmail"
]);
const CANVAS_IMAGE_REFERENCE_KEYS = new Set([
  "imageData",
  "imageUrl",
  "sourceImage",
  "sourceImageData",
  "sourceImageUrl",
  "coverUrl"
]);
const CANVAS_GENERATION_REFERENCE_KEYS = new Set([
  "generationId",
  "sourceImageId",
  "originGalleryId"
]);

function createService({
  store,
  httpError,
  randomId,
  choose,
  cleanPrompt,
  sanitizePositiveInt,
  normalizeImageSize,
  validateImageDataUrl,
  normalizeGenerationCost,
  enforceGenerationRate,
  attachRequestAbortController,
  callOpenAIImages,
  callOpenAIImageEdits,
  saveGeneratedImages,
  getClientIp,
  getUserAgent,
  isPubliclyVisibleGeneration,
  resolveCanvasImageData = async ({ imageData }) => imageData,
  defaultModel
}) {
  function cleanCanvasProjectInput(body = {}, { partial = false } = {}) {
    const payload = {};
    const has = (key) => Object.hasOwn(body, key);
    if (!partial || has("title")) {
      const title = String(body.title || "").trim().slice(0, 160);
      if (title.length < 1) throw httpError("Canvas title is required", 400);
      payload.title = title;
    }
    if (!partial || has("description")) {
      payload.description = String(body.description || "").trim().slice(0, 1000);
    }
    if (!partial || has("coverUrl") || has("cover")) {
      payload.coverUrl = String(body.coverUrl || body.cover || "").trim().slice(0, 500);
    }
    if (!partial || has("coverGenerationId")) {
      payload.coverGenerationId = String(body.coverGenerationId || "").trim().slice(0, 32);
    }
    if (!partial || has("visibility")) {
      payload.visibility = choose(String(body.visibility || "private"), ["private", "public", "unlisted"], "private");
    }
    if (!partial || has("isTemplate")) {
      payload.isTemplate = Boolean(body.isTemplate);
    }
    if (!partial || has("dataJson") || has("data")) {
      const data = has("dataJson") ? body.dataJson : body.data;
      if (data && (typeof data !== "object" || Array.isArray(data))) {
        throw httpError("Canvas dataJson must be an object", 400);
      }
      payload.dataJson = data || {};
    }
    if (has("nodeCount")) {
      payload.nodeCount = sanitizeCanvasCount(body.nodeCount, "nodeCount");
    }
    if (has("edgeCount")) {
      payload.edgeCount = sanitizeCanvasCount(body.edgeCount, "edgeCount");
    }
    return payload;
  }

  function sanitizeCanvasCount(value, field) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw httpError(`${field} must be a non-negative number`, 400);
    return Math.min(10000, Math.floor(parsed));
  }

  function canReadCanvas(user, canvas) {
    if (!user || !canvas) return false;
    return user.role === "admin" || canvas.userId === user.id || ["public", "unlisted"].includes(canvas.visibility);
  }

  function canManageCanvas(user, canvas) {
    if (!user || !canvas) return false;
    return user.role === "admin" || canvas.userId === user.id;
  }

  function canvasImageReference(value = "") {
    const text = String(value || "").trim();
    const match = text.match(/^\/api\/images\/([^/]+)\/(file|source-file)(?:[?#].*)?$/);
    return match ? { id: match[1], kind: match[2] } : { id: "", kind: "" };
  }

  function isCanvasReferenceAlwaysPublic(value = "") {
    const text = String(value || "").trim();
    return !text
      || /^https?:\/\//i.test(text)
      || /^\/api\/prompt-images\//i.test(text)
      || /^\/prompt-thumbs\//i.test(text);
  }

  async function canCopyCanvasGenerationReference(value = "", { source = false } = {}) {
    const text = String(value || "").trim();
    if (!text) return true;
    const reference = canvasImageReference(text);
    const id = reference.id || (/^gen_/i.test(text) ? text : "");
    if (!id) return isCanvasReferenceAlwaysPublic(text);
    const generation = await store.getGenerationById(id);
    if (!isPubliclyVisibleGeneration(generation)) return false;
    return source || reference.kind === "source-file" ? Boolean(generation.publishOriginal) : true;
  }

  async function scrubCanvasCopyValue(value, key = "") {
    if (Array.isArray(value)) {
      const items = [];
      for (const item of value) items.push(await scrubCanvasCopyValue(item, ""));
      return items;
    }
    if (!value || typeof value !== "object") {
      if (CANVAS_IMAGE_REFERENCE_KEYS.has(key)) {
        return (await canCopyCanvasGenerationReference(value, { source: key.toLowerCase().startsWith("source") })) ? String(value || "") : "";
      }
      if (CANVAS_GENERATION_REFERENCE_KEYS.has(key)) {
        return (await canCopyCanvasGenerationReference(value, { source: key === "sourceImageId" })) ? String(value || "") : "";
      }
      return value;
    }
    const clean = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (CANVAS_PRIVATE_KEYS.has(entryKey)) continue;
      clean[entryKey] = await scrubCanvasCopyValue(entryValue, entryKey);
    }
    return clean;
  }

  async function createCanvasDuplicatePayload(source, { title = "" } = {}, { copyMetadata = true } = {}) {
    const exported = canvasImportExport.createCanvasExport(source);
    const dataJson = await scrubCanvasCopyValue(exported.canvas.dataJson || {}, "dataJson");
    const coverUrl = (await canCopyCanvasGenerationReference(source.coverUrl)) ? source.coverUrl : "";
    const fallbackTitle = copyMetadata ? source.title : "Canvas route copy";
    const copyTitle = String(title || fallbackTitle || "Untitled canvas").trim().slice(0, 160) || "Untitled canvas";
    return {
      title: copyTitle,
      description: copyMetadata ? String(source.description || "").trim().slice(0, 1000) : "",
      coverUrl,
      visibility: "private",
      dataJson,
      nodeCount: Array.isArray(dataJson.nodes) ? dataJson.nodes.length : 0,
      edgeCount: Array.isArray(dataJson.edges) ? dataJson.edges.length : 0
    };
  }

  function normalizeGenerationNode(node) {
    const data = node.data && typeof node.data === "object" && !Array.isArray(node.data) ? node.data : {};
    return {
      ...node,
      id: String(node.id || "").trim(),
      type: String(node.type || "").trim(),
      data: {
        ...data,
        prompt: data.prompt ?? node.prompt ?? "",
        body: data.body ?? node.content ?? "",
        imageUrl: data.imageUrl ?? node.imageUrl ?? "",
        generationId: data.generationId ?? node.generationId ?? "",
        model: data.model ?? node.model ?? "",
        size: data.size ?? node.size ?? "",
        quality: data.quality ?? node.quality ?? "",
        candidateCount: data.candidateCount ?? node.candidateCount ?? node.n ?? ""
      }
    };
  }

  function normalizeGenerationEdge(edge) {
    return {
      ...edge,
      id: String(edge.id || "").trim(),
      sourceId: String(edge.sourceId || edge.source || "").trim(),
      targetId: String(edge.targetId || edge.target || "").trim()
    };
  }

  function canvasGenerationPlan(canvasData = {}, selectors = {}) {
    const nodes = Array.isArray(canvasData.nodes) ? canvasData.nodes.map(normalizeGenerationNode).filter((node) => node.id) : [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = Array.isArray(canvasData.edges)
      ? canvasData.edges.map(normalizeGenerationEdge).filter((edge) => edge.sourceId && edge.targetId && nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
      : [];
    const byId = new Map(nodes.map((node) => [String(node.id || ""), node]));
    const outputNode = byId.get(String(selectors.outputNodeId || "")) || nodes.find((node) => node.type === "output");
    const incoming = (id) => edges.filter((edge) => String(edge.targetId || "") === String(id || ""));
    const visitUpstream = (id, seen = new Set()) => incoming(id).flatMap((edge) => {
      const sourceId = String(edge.sourceId || "");
      if (!sourceId || seen.has(sourceId)) return [];
      seen.add(sourceId);
      const node = byId.get(sourceId);
      return node ? [node, ...visitUpstream(sourceId, seen)] : [];
    });
    if (!outputNode) throw httpError("Canvas output node not found", 400);
    const configNode = byId.get(String(selectors.configNodeId || ""))
      || visitUpstream(outputNode?.id || "").find((node) => node.type === "config")
      || nodes.find((node) => node.type === "config")
      || { id: "", type: "config", data: {} };
    const upstream = uniqueNodesById([...visitUpstream(outputNode.id), ...visitUpstream(configNode.id)]);
    const promptNodes = upstream.filter((node) => node.type === "prompt");
    const textNodes = upstream.filter((node) => node.type === "text");
    const imageNodes = upstream.filter((node) => node.type === "image");
    if (promptNodes.length > 1 || imageNodes.length > 1) {
      throw httpError("Canvas input conflict: use at most one prompt and one image", 400);
    }
    const promptSource = promptNodes[0] || textNodes[0] || null;
    const prompt = cleanPrompt(promptSource?.data?.prompt || promptSource?.data?.body || "");
    if (!prompt) throw httpError("Canvas prompt node is required before generation", 400);
    const imageNode = imageNodes[0] || null;
    const imageUrl = String(imageNode?.data?.imageUrl || "");
    const imageReference = canvasImageReference(imageUrl);
    const sourceImageId = String(imageNode?.data?.generationId || imageReference.id || "");
    const imageData = imageUrl || (sourceImageId ? `/api/images/${sourceImageId}/file` : "");
    const qualityValue = String(configNode.data?.quality || "").trim();
    const quality = qualityValue === "standard"
      ? "auto"
      : choose(qualityValue, ["auto", "low", "medium", "high"], "auto");
    return {
      outputNodeId: String(outputNode.id || selectors.outputNodeId || ""),
      configNodeId: String(configNode.id || ""),
      prompt,
      imageData,
      sourceImageId,
      sourcePrompt: String(imageNode?.data?.prompt || ""),
      model: String(configNode.data?.model || defaultModel),
      size: normalizeImageSize(configNode.data?.size),
      quality,
      n: sanitizePositiveInt(configNode.data?.candidateCount, 1, 4)
    };
  }

  function uniqueNodesById(nodes = []) {
    const seen = new Set();
    return nodes.filter((node) => {
      if (!node?.id || seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    });
  }

  async function list(user, { limit, scope }) {
    const canvases = await store.listCanvasProjectsForUser(user, { limit, scope });
    return { canvases };
  }

  async function create(user, body) {
    const payload = cleanCanvasProjectInput(body);
    const canvas = await store.createCanvasProject({
      ...payload,
      id: randomId("can_"),
      userId: user.id
    });
    return { canvas };
  }

  async function exportCanvas(user, canvasId) {
    const canvas = await store.getCanvasProjectById(canvasId);
    if (!canReadCanvas(user, canvas)) throw httpError("Canvas not found", 404);
    return canvasImportExport.createCanvasExport(canvas);
  }

  async function importCanvas(user, canvasId, body) {
    const existing = await store.getCanvasProjectById(canvasId);
    if (!canManageCanvas(user, existing)) throw httpError("Canvas not found", 404);
    const payload = canvasImportExport.normalizeCanvasImport(body, existing);
    const canvas = await store.updateCanvasProject(existing.id, payload);
    return {
      canvas,
      imported: {
        format: canvasImportExport.FORMAT,
        nodeCount: payload.nodeCount,
        edgeCount: payload.edgeCount
      }
    };
  }

  async function assistant(user, canvasId, body) {
    const canvas = await store.getCanvasProjectById(canvasId);
    if (!canReadCanvas(user, canvas)) throw httpError("Canvas not found", 404);
    return { assistant: canvasAssistant.createAssistantResponse(canvas, body) };
  }

  async function duplicate(user, canvasId, body) {
    const source = await store.getCanvasProjectById(canvasId);
    const canReadSource = canReadCanvas(user, source);
    if (!canReadSource) {
      const publicRouteGeneration = source ? await store.getPublicGenerationForCanvas(source.id) : null;
      if (!isPubliclyVisibleGeneration(publicRouteGeneration)) throw httpError("Canvas not found", 404);
    }
    if (!source) throw httpError("Canvas not found", 404);
    const payload = await createCanvasDuplicatePayload(source, body, { copyMetadata: canReadSource });
    const canvas = await store.createCanvasProject({
      ...payload,
      id: randomId("can_"),
      userId: user.id
    });
    return {
      canvas,
      duplicated: {
        sourceCanvasId: source.id,
        nodeCount: payload.nodeCount,
        edgeCount: payload.edgeCount
      }
    };
  }

  async function templates(user, limit) {
    const canvases = await store.listCanvasProjectsForUser(user, { limit, scope: "templates" });
    return { canvases };
  }

  async function get(user, canvasId) {
    const canvas = await store.getCanvasProjectById(canvasId);
    if (!canReadCanvas(user, canvas)) throw httpError("Canvas not found", 404);
    return { canvas };
  }

  async function update(user, canvasId, body) {
    const existing = await store.getCanvasProjectById(canvasId);
    if (!canManageCanvas(user, existing)) throw httpError("Canvas not found", 404);
    const payload = cleanCanvasProjectInput(body, { partial: true });
    const canvas = await store.updateCanvasProject(existing.id, payload);
    return { canvas };
  }

  async function remove(user, canvasId) {
    const existing = await store.getCanvasProjectById(canvasId);
    if (!canManageCanvas(user, existing)) throw httpError("Canvas not found", 404);
    const canvas = await store.deleteCanvasProject(existing.id);
    return { ok: true, canvas };
  }

  async function generate(userId, canvasId, body, req, res) {
    enforceGenerationRate(userId);
    const canvas = await store.getCanvasProjectById(canvasId);
    const user = await store.getUserById(userId);
    if (!canManageCanvas(user, canvas)) throw httpError("Canvas not found", 404);
    const plan = canvasGenerationPlan(canvas.dataJson || {}, body);
    if (plan.imageData) {
      plan.imageData = await resolveCanvasImageData({
        imageData: plan.imageData,
        sourceImageId: plan.sourceImageId,
        user,
        canvas
      });
    }
    if (plan.imageData && !plan.imageData.startsWith("data:image/") && !/^https?:\/\//i.test(plan.imageData)) {
      throw httpError("Canvas image node is missing an editable image", 400);
    }
    if (plan.imageData.startsWith("data:image/")) validateImageDataUrl(plan.imageData);

    const settings = await store.getSettings();
    if (!user || user.status !== "active") throw httpError("Account is not active", 403);
    const costPerImage = normalizeGenerationCost(settings.generationCreditCost ?? 1);
    const n = plan.imageData ? 1 : Math.min(plan.n, Number(settings.maxImagesPerRequest || 1));
    const totalCost = costPerImage * n;
    const auditId = randomId("req_");
    const requestStartedAt = Date.now();
    const request = {
      model: plan.model || String(settings.model || defaultModel).trim() || defaultModel,
      prompt: plan.prompt,
      n,
      size: plan.size,
      quality: plan.imageData ? "auto" : plan.quality,
      background: "auto",
      output_format: "png",
      isPublic: false,
      sourceImageId: plan.sourceImageId,
      sourcePrompt: plan.sourcePrompt,
      conversation: []
    };
    await store.insertGenerationRequest({
      id: auditId,
      userId: user.id,
      prompt: plan.imageData ? `[canvas-edit] ${plan.prompt}` : `[canvas] ${plan.prompt}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      isPublic: false,
      status: "pending"
    });

    let reservedCredits = false;
    if (totalCost > 0) {
      reservedCredits = await store.reserveCredits(user.id, totalCost, {
        source: "canvas_generation_charge",
        referenceId: auditId,
        note: `${canvas.id} ${n} image(s)`
      });
      if (!reservedCredits) {
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          durationMs: Date.now() - requestStartedAt
        });
        throw httpError("Not enough credits", 402);
      }
    }

    const aborter = attachRequestAbortController(req);
    try {
      const openaiResult = plan.imageData
        ? await callOpenAIImageEdits(settings, {
            model: request.model,
            prompt: plan.prompt,
            n: 1,
            size: request.size,
            imageData: plan.imageData,
            maskData: ""
          }, { signal: aborter.signal })
        : await callOpenAIImages(settings, {
            model: request.model,
            prompt: plan.prompt,
            n,
            size: request.size,
            quality: request.quality,
            background: request.background,
            output_format: request.output_format
          }, { signal: aborter.signal });
      const durationMs = Date.now() - requestStartedAt;
      const saved = (await saveGeneratedImages(user, request, openaiResult))
        .map((generation) => ({ ...generation, durationMs }));
      if (!saved.length) throw httpError("Canvas generation returned no image", 502);
      await store.insertGenerations(saved);
      await store.createCanvasGenerationLinks({
        canvasId: canvas.id,
        generationIds: saved.map((generation) => generation.id),
        outputNodeId: plan.outputNodeId,
        configNodeId: plan.configNodeId
      });
      await store.updateGenerationRequest(auditId, {
        status: "succeeded",
        firstGenerationId: saved[0]?.id || "",
        generationIds: saved.map((generation) => generation.id),
        durationMs
      });
      reservedCredits = false;
      if (costPerImage > 0 && saved.length < n) {
        await store.addCredits(user.id, costPerImage * (n - saved.length), {
          source: "canvas_generation_refund",
          referenceId: auditId,
          note: "unused canvas candidate refund"
        }).catch((error) => console.error(error));
      }

      return {
        generations: saved,
        outputNode: {
          id: plan.outputNodeId,
          status: "success",
          generationIds: saved.map((generation) => generation.id)
        },
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      };
    } catch (error) {
      const cancelled = aborter.isAborted() || error?.name === "AbortError";
      const durationMs = Date.now() - requestStartedAt;
      if (reservedCredits) await store.addCredits(user.id, totalCost, {
        source: cancelled ? "canvas_generation_cancel_refund" : "canvas_generation_error_refund",
        referenceId: auditId,
        note: cancelled ? "client aborted" : "canvas generation failed"
      }).catch((refundError) => console.error(refundError));
      await store.updateGenerationRequest(auditId, cancelled
        ? { status: "cancelled", errorMessage: "client aborted", durationMs }
        : { status: "failed", errorMessage: String(error.message || error).slice(0, 2000), durationMs }
      ).catch((auditError) => console.error(auditError));
      if (cancelled) {
        if (!res.writableEnded) {
          try { res.end(); } catch { /* ignore */ }
        }
        return null;
      }
      throw error;
    } finally {
      aborter.detach();
    }
  }

  return {
    canReadCanvas,
    canManageCanvas,
    list,
    create,
    exportCanvas,
    importCanvas,
    assistant,
    duplicate,
    templates,
    get,
    update,
    remove,
    generate,
    cleanCanvasProjectInput,
    canvasImageReference,
    isCanvasReferenceAlwaysPublic,
    canvasGenerationPlan
  };
}

module.exports = {
  createService,
  createCanvasService: createService
};
