export const CANVAS_V1_SCHEMA = "ai-image-studio.canvas.v1";

export function createEmptyCanvasDocument(title) {
  return {
    schema: CANVAS_V1_SCHEMA,
    version: 1,
    title,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    nodes: [],
    edges: [],
    meta: {
      source: "canvas-v2",
      updatedBy: "client",
    },
  };
}

export function normalizeCanvasDocument(value, fallbackTitle = "Untitled canvas") {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim() : fallbackTitle;
  const viewport = normalizeViewport(input.viewport);
  const nodes = Array.isArray(input.nodes) ? input.nodes.map(normalizeNode).filter(Boolean) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(input.edges)
    ? input.edges.map(normalizeEdge).filter((edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target))
    : [];

  return {
    schema: CANVAS_V1_SCHEMA,
    version: 1,
    title,
    viewport,
    nodes,
    edges,
    meta: {
      source: "canvas-v2",
      updatedBy: "client",
    },
  };
}

export function createTextNode(content = "Canvas v2 text node") {
  return {
    id: `text_${Date.now().toString(36)}`,
    type: "text",
    x: 80,
    y: 80,
    width: 260,
    height: 140,
    content,
  };
}

export function createOutputNode() {
  return {
    id: `output_${Date.now().toString(36)}`,
    type: "output",
    x: 400,
    y: 140,
    width: 300,
    height: 180,
  };
}

export function canvasPayloadFromDocument(document, title = document?.title || "Untitled canvas") {
  const safeDocument = normalizeCanvasDocument(document, title);
  return {
    title: safeDocument.title,
    visibility: "private",
    dataJson: safeDocument,
    nodeCount: safeDocument.nodes.length,
    edgeCount: safeDocument.edges.length,
  };
}

export function isPersistableImageUrl(value) {
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  return value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://");
}

function normalizeViewport(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    zoom: finiteNumber(input.zoom ?? input.scale, 1),
  };
}

function normalizeNode(node) {
  if (!node || typeof node !== "object") return null;
  const id = String(node.id || "").trim();
  const type = String(node.type || "").trim();
  if (!id || !["image", "text", "prompt", "config", "output", "group"].includes(type)) return null;

  const clean = {
    id,
    type,
    x: finiteNumber(node.x, 0),
    y: finiteNumber(node.y, 0),
  };

  for (const key of ["width", "height", "promptId", "candidateCount"]) {
    if (Number.isFinite(Number(node[key]))) clean[key] = Number(node[key]);
  }
  for (const key of ["content", "prompt", "imageUrl", "model", "size", "quality", "generationId", "status", "generationStatus", "generationError"]) {
    if (typeof node[key] === "string" && node[key].trim()) clean[key] = node[key].trim();
  }
  if (Array.isArray(node.generationIds)) clean.generationIds = node.generationIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 16);
  if (clean.imageUrl && !isPersistableImageUrl(clean.imageUrl)) delete clean.imageUrl;
  return clean;
}

function normalizeEdge(edge) {
  if (!edge || typeof edge !== "object") return null;
  const id = String(edge.id || "").trim();
  const source = String(edge.source || edge.sourceId || "").trim();
  const target = String(edge.target || edge.targetId || "").trim();
  if (!id || !source || !target || source === target) return null;
  const clean = { id, source, target };
  if (typeof edge.sourceHandle === "string") clean.sourceHandle = edge.sourceHandle;
  if (typeof edge.targetHandle === "string") clean.targetHandle = edge.targetHandle;
  return clean;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
