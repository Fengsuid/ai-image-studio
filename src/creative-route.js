"use strict";

const MAX_ROUTE_STEPS = 24;
const MAX_ROUTE_TEXT = 1200;
const MAX_REF = 500;

const PRIVATE_ROUTE_KEYS = new Set([
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
  "updatedByEmail",
  "email",
  "apiKey",
  "authorization",
  "password",
  "secret"
]);

function cleanText(value, max = MAX_ROUTE_TEXT) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanRef(value, { allowPrivateSources = false } = {}) {
  const text = String(value || "").trim();
  if (!text || /^(data:|blob:)/i.test(text)) return "";
  if (!allowPrivateSources && /^\/api\/images\/[^/]+\/source-file(?:[?#].*)?$/i.test(text)) return "";
  return text.slice(0, MAX_REF);
}

function cleanId(value) {
  return String(value || "").trim().slice(0, 160);
}

function scrubRouteValue(value) {
  if (Array.isArray(value)) return value.slice(0, 100).map(scrubRouteValue);
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? cleanText(value, MAX_REF) : value;
  }
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_ROUTE_KEYS.has(key)) continue;
    clean[String(key || "").slice(0, 80)] = scrubRouteValue(item);
  }
  return clean;
}

function normalizeCanvasNode(node = {}) {
  const data = node.data && typeof node.data === "object" && !Array.isArray(node.data) ? node.data : {};
  return {
    id: cleanId(node.id),
    type: cleanText(node.type || data.type, 32),
    title: cleanText(data.title || node.title || node.content, 160),
    prompt: cleanText(data.prompt || node.prompt || data.body || node.content),
    imageUrl: data.imageUrl || node.imageUrl || data.sourceImageUrl || node.sourceImageUrl || "",
    generationId: cleanId(data.generationId || node.generationId),
    generationIds: Array.isArray(data.generationIds || node.generationIds)
      ? (data.generationIds || node.generationIds).map(cleanId).filter(Boolean).slice(0, 16)
      : [],
    model: cleanText(data.model || node.model, 120),
    size: cleanText(data.size || node.size, 32),
    quality: cleanText(data.quality || node.quality, 32),
    sourceImageId: cleanId(data.sourceImageId || node.sourceImageId),
    sourceImageUrl: data.sourceImageUrl || node.sourceImageUrl || "",
    x: Number.isFinite(Number(node.x)) ? Number(node.x) : 0,
    y: Number.isFinite(Number(node.y)) ? Number(node.y) : 0,
    data: scrubRouteValue(data)
  };
}

function normalizeCanvasEdge(edge = {}) {
  return {
    id: cleanId(edge.id),
    source: cleanId(edge.source || edge.sourceId),
    target: cleanId(edge.target || edge.targetId)
  };
}

function upstreamNodeIds(nodes, edges, targetId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target).push(edge.source);
  }
  const seen = new Set();
  const ordered = [];
  const visit = (id) => {
    for (const source of incoming.get(id) || []) {
      if (seen.has(source)) continue;
      seen.add(source);
      visit(source);
      if (byId.has(source)) ordered.push(source);
    }
  };
  visit(targetId);
  return ordered;
}

function routeStepFromCanvasNode(node, index, options = {}) {
  const imageUrl = cleanRef(node.imageUrl, options);
  const sourceImageUrl = cleanRef(node.sourceImageUrl, options);
  const generationId = node.generationId || node.generationIds?.[0] || "";
  const prompt = node.prompt || node.title;
  if (!prompt && !imageUrl && !generationId && node.type !== "config") return null;
  return {
    index: index + 1,
    id: node.id,
    nodeId: node.id,
    type: node.type || "node",
    label: node.title || node.type || `Step ${index + 1}`,
    prompt,
    imageUrl,
    generationId,
    sourceImageId: node.sourceImageId,
    sourceImageUrl,
    model: node.model,
    size: node.size,
    quality: node.quality
  };
}

function buildCreativeRouteFromCanvasData(dataJson = {}, {
  outputNodeId = "",
  configNodeId = "",
  resultImageUrl = "",
  generationId = "",
  allowPrivateSources = false
} = {}) {
  const nodes = Array.isArray(dataJson.nodes) ? dataJson.nodes.map(normalizeCanvasNode).filter((node) => node.id) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(dataJson.edges)
    ? dataJson.edges.map(normalizeCanvasEdge).filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target))
    : [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const output = byId.get(cleanId(outputNodeId)) || nodes.find((node) => node.type === "output") || null;
  if (!output) return [];
  const upstreamIds = upstreamNodeIds(nodes, edges, output.id);
  const orderedIds = [
    ...upstreamIds.filter((id) => id !== configNodeId),
    ...(configNodeId && upstreamIds.includes(configNodeId) ? [configNodeId] : []),
    output.id
  ];
  const steps = [];
  for (const id of orderedIds) {
    const node = byId.get(id);
    if (!node) continue;
    const step = routeStepFromCanvasNode(node, steps.length, { allowPrivateSources });
    if (step) steps.push(step);
  }
  const last = steps[steps.length - 1];
  if (last && output.id === last.nodeId) {
    last.type = "output";
    last.imageUrl = cleanRef(resultImageUrl || last.imageUrl, { allowPrivateSources });
    last.generationId = cleanId(generationId || last.generationId);
  }
  return steps.slice(0, MAX_ROUTE_STEPS).map((step, index) => ({ ...step, index: index + 1 }));
}

function normalizeConversationRoute(conversation = [], {
  resultImageUrl = "",
  generationId = "",
  fallbackPrompt = "",
  createdAt = "",
  allowPrivateSources = false
} = {}) {
  const input = Array.isArray(conversation) ? conversation : [];
  const steps = input.map((step, index) => ({
    index: index + 1,
    id: cleanId(step?.id || step?.nodeId || (index === input.length - 1 ? generationId : "")),
    nodeId: cleanId(step?.nodeId),
    type: cleanText(step?.type || "step", 32),
    label: cleanText(step?.label || step?.title || step?.type, 160),
    prompt: cleanText(step?.prompt || step?.body || ""),
    imageUrl: cleanRef(step?.imageUrl || step?.images?.[0] || "", { allowPrivateSources }),
    generationId: cleanId(step?.generationId || ""),
    sourceImageId: cleanId(step?.sourceImageId || ""),
    sourceImageUrl: cleanRef(step?.sourceImageUrl || "", { allowPrivateSources }),
    model: cleanText(step?.model, 120),
    size: cleanText(step?.size, 32),
    quality: cleanText(step?.quality, 32),
    createdAt: cleanText(step?.createdAt || step?.time, 64)
  })).filter((step) => step.prompt || step.imageUrl || step.generationId);

  if (steps.length) {
    const last = steps[steps.length - 1];
    last.imageUrl = cleanRef(last.imageUrl || resultImageUrl, { allowPrivateSources });
    last.generationId = cleanId(last.generationId || generationId);
    return steps.slice(0, MAX_ROUTE_STEPS).map((step, index) => ({ ...step, index: index + 1 }));
  }

  return [{
    index: 1,
    id: cleanId(generationId),
    type: "output",
    label: "Output",
    prompt: cleanText(fallbackPrompt),
    imageUrl: cleanRef(resultImageUrl, { allowPrivateSources }),
    generationId: cleanId(generationId),
    createdAt: cleanText(createdAt, 64)
  }].filter((step) => step.prompt || step.imageUrl || step.generationId);
}

function buildCreativeRouteForGeneration(generation = {}, {
  resultImageUrl = "",
  sourceImageUrl = "",
  canvasProject = null,
  allowPrivateSources = false
} = {}) {
  const canvasRoute = canvasProject?.dataJson
    ? buildCreativeRouteFromCanvasData(canvasProject.dataJson, {
        outputNodeId: canvasProject.outputNodeId,
        configNodeId: canvasProject.configNodeId,
        resultImageUrl,
        generationId: generation.id,
        allowPrivateSources
      })
    : [];
  const route = canvasRoute.length
    ? canvasRoute
    : normalizeConversationRoute(generation.conversation, {
        resultImageUrl,
        generationId: generation.id,
        fallbackPrompt: generation.prompt,
        createdAt: generation.createdAt,
        allowPrivateSources
      });
  if (sourceImageUrl && !route.some((step) => step.type === "source" || step.sourceImageUrl)) {
    route.unshift({
      index: 1,
      id: cleanId(generation.sourceImageId || generation.originGalleryId || ""),
      type: "source",
      label: "Input image",
      prompt: cleanText(generation.sourcePrompt || ""),
      imageUrl: cleanRef(sourceImageUrl, { allowPrivateSources }),
      generationId: cleanId(generation.sourceImageId || ""),
      sourceImageId: cleanId(generation.sourceImageId || ""),
      sourceImageUrl: cleanRef(sourceImageUrl, { allowPrivateSources })
    });
  }
  return route.slice(0, MAX_ROUTE_STEPS).map((step, index) => ({ ...step, index: index + 1 }));
}

module.exports = {
  buildCreativeRouteForGeneration,
  buildCreativeRouteFromCanvasData,
  normalizeConversationRoute,
  scrubRouteValue
};
