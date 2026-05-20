"use strict";

const FORMAT = "ai-image-studio.canvas.v1";
const MAX_NODES = 10000;
const MAX_EDGES = 10000;
const MAX_STRING = 5000;
const IMAGE_REFERENCE_FIELDS = ["imageUrl", "sourceImage", "coverUrl"];

function createCanvasExport(canvas = {}, { exportedAt = new Date().toISOString() } = {}) {
  const dataJson = validateCanvasData(canvas.dataJson || {});
  return {
    format: FORMAT,
    exportedAt,
    canvas: {
      id: String(canvas.id || ""),
      title: String(canvas.title || "Untitled canvas"),
      description: String(canvas.description || ""),
      visibility: ["private", "public", "unlisted"].includes(canvas.visibility) ? canvas.visibility : "private",
      coverUrl: safeImageReference(canvas.coverUrl || "", "coverUrl"),
      dataJson,
      nodeCount: dataJson.nodes.length,
      edgeCount: dataJson.edges.length,
      createdAt: canvas.createdAt || "",
      updatedAt: canvas.updatedAt || ""
    }
  };
}

function normalizeCanvasImport(input = {}, existing = {}) {
  const source = unwrapImport(input);
  const dataJson = validateCanvasData(source.dataJson || source.data || {});
  const title = String(source.title || existing.title || "Imported canvas").trim().slice(0, 160) || "Imported canvas";
  const description = String(source.description || existing.description || "").trim().slice(0, 1000);
  return {
    title,
    description,
    coverUrl: safeImageReference(source.coverUrl || existing.coverUrl || "", "coverUrl"),
    visibility: ["private", "public", "unlisted"].includes(source.visibility) ? source.visibility : existing.visibility || "private",
    dataJson,
    nodeCount: dataJson.nodes.length,
    edgeCount: dataJson.edges.length
  };
}

function unwrapImport(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Canvas import JSON must be an object");
  }
  const payload = input.import || input.package || input.canvas || input;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("Canvas import payload must be an object");
  }
  if (input.format && input.format !== FORMAT) {
    throw validationError(`Unsupported canvas export format: ${input.format}`);
  }
  return payload;
}

function validateCanvasData(data = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw validationError("Canvas dataJson must be an object");
  }
  const nodes = validateNodes(data.nodes || []);
  const edges = validateEdges(data.edges || [], new Set(nodes.map((node) => node.id)));
  return {
    ...sanitizeObject(data, "dataJson"),
    nodes,
    edges,
    selectedNodeId: nodes.some((node) => node.id === data.selectedNodeId) ? String(data.selectedNodeId) : nodes[0]?.id || "",
    selectedNodeIds: Array.isArray(data.selectedNodeIds)
      ? data.selectedNodeIds.map((id) => String(id || "")).filter((id) => nodes.some((node) => node.id === id))
      : []
  };
}

function validateNodes(nodes) {
  if (!Array.isArray(nodes)) throw validationError("Canvas nodes must be an array");
  if (nodes.length > MAX_NODES) throw validationError(`Canvas nodes cannot exceed ${MAX_NODES}`);
  const ids = new Set();
  return nodes.map((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw validationError(`Canvas node at index ${index} must be an object`);
    }
    const id = String(node.id || "").trim();
    if (!id) throw validationError(`Canvas node at index ${index} is missing id`);
    if (ids.has(id)) throw validationError(`Canvas node id is duplicated: ${id}`);
    ids.add(id);
    return {
      ...sanitizeObject(node, `nodes[${index}]`),
      id,
      type: String(node.type || "prompt").trim().slice(0, 32) || "prompt",
      x: finiteNumber(node.x, `nodes[${index}].x`),
      y: finiteNumber(node.y, `nodes[${index}].y`),
      locked: Boolean(node.locked),
      data: sanitizeNodeData(node.data || {}, `nodes[${index}].data`)
    };
  });
}

function validateEdges(edges, nodeIds) {
  if (!Array.isArray(edges)) throw validationError("Canvas edges must be an array");
  if (edges.length > MAX_EDGES) throw validationError(`Canvas edges cannot exceed ${MAX_EDGES}`);
  return edges.map((edge, index) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      throw validationError(`Canvas edge at index ${index} must be an object`);
    }
    const sourceId = String(edge.sourceId || "").trim();
    const targetId = String(edge.targetId || "").trim();
    if (!sourceId || !targetId) throw validationError(`Canvas edge at index ${index} must include sourceId and targetId`);
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
      throw validationError(`Canvas edge at index ${index} references a missing node`);
    }
    return {
      ...sanitizeObject(edge, `edges[${index}]`),
      id: String(edge.id || `edge_${sourceId}_${targetId}`).slice(0, 160),
      sourceId,
      targetId
    };
  });
}

function sanitizeNodeData(data, path) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const clean = sanitizeObject(data, path);
  for (const field of IMAGE_REFERENCE_FIELDS) {
    if (Object.hasOwn(clean, field)) clean[field] = safeImageReference(clean[field], `${path}.${field}`);
  }
  return clean;
}

function sanitizeObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    const safeKey = String(key || "").slice(0, 80);
    if (!safeKey) continue;
    clean[safeKey] = sanitizeValue(item, `${path}.${safeKey}`);
  }
  return clean;
}

function sanitizeValue(value, path) {
  if (typeof value === "string") {
    if (looksLikeEmbeddedFile(value)) throw validationError(`${path} must reference an image by URL or id, not embedded file data`);
    return value.slice(0, MAX_STRING);
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 500).map((item, index) => sanitizeValue(item, `${path}[${index}]`));
  if (value && typeof value === "object") return sanitizeObject(value, path);
  return "";
}

function safeImageReference(value, path) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (looksLikeEmbeddedFile(text)) throw validationError(`${path} must use a file id or URL instead of embedded base64 data`);
  if (!isAllowedImageReference(text)) throw validationError(`${path} must be a URL, absolute path, or file id reference`);
  return text.slice(0, 500);
}

function isAllowedImageReference(value) {
  return /^(https?:\/\/|\/api\/images\/|\/api\/prompt-images\/|\/uploads\/|\/prompt-thumbs\/|img_|gen_|src_|prompt_)/i.test(value);
}

function looksLikeEmbeddedFile(value) {
  return /^data:/i.test(value) || /^blob:/i.test(value) || value.length > MAX_STRING;
}

function finiteNumber(value, path) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) throw validationError(`${path} must be a finite number`);
  return Math.round(number);
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

module.exports = {
  FORMAT,
  createCanvasExport,
  normalizeCanvasImport,
  validateCanvasData
};
