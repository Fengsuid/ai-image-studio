// SPDX-License-Identifier: AGPL-3.0-or-later
"use strict";

const FORMAT = "ai-image-studio.canvas.v1";
const MAX_NODES = 10000;
const MAX_EDGES = 10000;
const MAX_STRING = 5000;
const IMAGE_REFERENCE_FIELDS = ["imageUrl", "sourceImage", "sourceImageUrl", "coverUrl"];
const ZIP_IMAGE_REFERENCE_KEYS = new Set([
  "coverurl",
  "imagedata",
  "imageurl",
  "sourceimage",
  "sourceimagedata",
  "sourceimageurl",
  "thumbnailurl"
]);
const ZIP_ENTRY_TIME = new Date("2026-01-01T00:00:00.000Z");
const ZIP_FETCH_TIMEOUT_MS = 5000;

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

async function createCanvasZipExport(canvas = {}, options = {}) {
  const assets = [];
  const zipCanvas = await canvasWithZipAssets(canvas, assets, options);
  const exported = createCanvasExport(zipCanvas, options);
  const title = safeFilename(exported.canvas.title || exported.canvas.id || "canvas");
  return createZipBuffer([
    {
      name: "manifest.json",
      content: JSON.stringify({
        format: exported.format,
        exportedAt: exported.exportedAt,
        canvasId: exported.canvas.id,
        title: exported.canvas.title,
        nodeCount: exported.canvas.nodeCount,
        edgeCount: exported.canvas.edgeCount,
        imageAssetCount: assets.filter((asset) => asset.status === "included").length,
        imageReferenceCount: assets.length
      }, null, 2)
    },
    {
      name: "images/manifest.json",
      content: JSON.stringify({ references: assets.map(zipAssetManifestEntry) }, null, 2)
    },
    {
      name: `${title || "canvas"}.canvas.json`,
      content: JSON.stringify(exported, null, 2)
    },
    ...assets
      .filter((asset) => asset.status === "included" && asset.content)
      .map((asset) => ({ name: asset.path, content: asset.content }))
  ]);
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
  assertAcyclicGraph(edges);
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
    const sourceId = String(edge.sourceId || edge.source || "").trim();
    const targetId = String(edge.targetId || edge.target || "").trim();
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
  return /^(https?:\/\/|\/api\/images\/|\/api\/prompt-images\/|\/uploads\/|\/prompt-thumbs\/|assets\/|img_|gen_|src_|prompt_)/i.test(value);
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

async function canvasWithZipAssets(canvas = {}, assets, options) {
  return {
    ...canvas,
    coverUrl: await rewriteZipImageReference(canvas.coverUrl || "", "canvas.coverUrl", assets, options),
    dataJson: await rewriteZipImageReferences(canvas.dataJson || {}, "canvas.dataJson", assets, options)
  };
}

async function rewriteZipImageReferences(value, path, assets, options) {
  if (Array.isArray(value)) {
    const items = [];
    for (let index = 0; index < value.length; index += 1) {
      items.push(await rewriteZipImageReferences(value[index], `${path}[${index}]`, assets, options));
    }
    return items;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && looksLikeEmbeddedImage(value)) {
      return (await rewriteZipImageReference(value, path, assets, options)) || "";
    }
    return value;
  }
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`;
    if (typeof item === "string" && (isZipImageReferenceKey(key) || looksLikeEmbeddedImage(item))) {
      clean[key] = await rewriteZipImageReference(item, itemPath, assets, options);
    } else {
      clean[key] = await rewriteZipImageReferences(item, itemPath, assets, options);
    }
  }
  return clean;
}

async function rewriteZipImageReference(value, context, assets, options) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (looksLikeEmbeddedImage(text)) {
    return appendZipAsset(dataUrlToImageAsset(text), { source: "inline", context }, assets).path;
  }
  if (!isAllowedImageReference(text)) return text;

  const resolved = await resolveZipImageAsset(text, context, options);
  if (!resolved) return text;
  if (resolved.error) {
    assets.push({
      path: "",
      source: text,
      context,
      mime: "",
      bytes: 0,
      status: "failed",
      error: resolved.error
    });
    return text;
  }
  appendZipAsset(resolved, { source: text, context }, assets);
  return text;
}

async function resolveZipImageAsset(reference, context, options = {}) {
  try {
    if (typeof options.resolveImageReference === "function") {
      const resolved = await options.resolveImageReference(reference, { context });
      const asset = normalizeResolvedImageAsset(resolved);
      if (asset) return asset;
    }
    if (options.fetchImages === false || typeof fetch !== "function") return null;
    const url = absoluteFetchUrl(reference, options.baseUrl);
    if (!url) return null;
    return await fetchZipImageAsset(url, options.fetchHeaders || {});
  } catch (error) {
    return { error: String(error?.message || error).slice(0, 500) };
  }
}

async function fetchZipImageAsset(url, headers) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), ZIP_FETCH_TIMEOUT_MS) : 0;
  try {
    const response = await fetch(url, {
      headers,
      signal: controller?.signal
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const mime = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) return { error: `Unsupported content type: ${mime || "unknown"}` };
    return {
      content: Buffer.from(await response.arrayBuffer()),
      mime
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function normalizeResolvedImageAsset(value) {
  if (!value) return null;
  if (typeof value === "string") {
    if (!looksLikeEmbeddedImage(value)) return null;
    return dataUrlToImageAsset(value);
  }
  if (Buffer.isBuffer(value)) return { content: value, mime: "application/octet-stream" };
  if (value instanceof ArrayBuffer) return { content: Buffer.from(value), mime: "application/octet-stream" };
  if (value && typeof value === "object") {
    const content = value.content || value.buffer || value.data;
    if (typeof content === "string" && looksLikeEmbeddedImage(content)) return dataUrlToImageAsset(content);
    if (Buffer.isBuffer(content)) return { content, mime: String(value.mime || value.contentType || "application/octet-stream") };
    if (content instanceof ArrayBuffer) return { content: Buffer.from(content), mime: String(value.mime || value.contentType || "application/octet-stream") };
  }
  return null;
}

function dataUrlToImageAsset(value) {
  const match = String(value || "").match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) throw validationError("Inline image data must be a base64 image data URL");
  return {
    content: Buffer.from(match[2].replace(/\s+/g, ""), "base64"),
    mime: match[1].toLowerCase()
  };
}

function appendZipAsset(asset, meta, assets) {
  const index = assets.filter((item) => item.status === "included").length + 1;
  const content = Buffer.from(asset.content || "");
  const entry = {
    path: `assets/images/image-${String(index).padStart(3, "0")}.${extensionForMime(asset.mime)}`,
    source: meta.source,
    context: meta.context,
    mime: asset.mime || "application/octet-stream",
    bytes: content.length,
    status: "included",
    content
  };
  assets.push(entry);
  return entry;
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

function isZipImageReferenceKey(key) {
  return ZIP_IMAGE_REFERENCE_KEYS.has(String(key || "").toLowerCase());
}

function looksLikeEmbeddedImage(value) {
  return /^data:image\//i.test(String(value || ""));
}

function absoluteFetchUrl(reference, baseUrl = "") {
  const text = String(reference || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (baseUrl && text.startsWith("/")) return new URL(text, baseUrl).toString();
  return "";
}

function extensionForMime(mime) {
  const normalized = String(mime || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "bin";
}

function assertAcyclicGraph(edges = []) {
  const outgoing = new Map();
  const indegree = new Map();
  for (const edge of edges) {
    if (!outgoing.has(edge.sourceId)) outgoing.set(edge.sourceId, []);
    outgoing.get(edge.sourceId).push(edge.targetId);
    indegree.set(edge.targetId, (indegree.get(edge.targetId) || 0) + 1);
    if (!indegree.has(edge.sourceId)) indegree.set(edge.sourceId, indegree.get(edge.sourceId) || 0);
  }
  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    for (const target of outgoing.get(id) || []) {
      const next = (indegree.get(target) || 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  if (visited !== indegree.size) throw validationError("Canvas graph cannot contain cycles");
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
    local.writeUInt16LE(dosTime(ZIP_ENTRY_TIME), 10);
    local.writeUInt16LE(dosDate(ZIP_ENTRY_TIME), 12);
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
    central.writeUInt16LE(dosTime(ZIP_ENTRY_TIME), 12);
    central.writeUInt16LE(dosDate(ZIP_ENTRY_TIME), 14);
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

function safeFilename(value) {
  return String(value || "canvas").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

module.exports = {
  FORMAT,
  createCanvasExport,
  createCanvasZipExport,
  normalizeCanvasImport,
  validateCanvasData
};
