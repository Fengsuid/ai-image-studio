const NODE_DEFAULTS = {
  image: { width: 260, height: 190, imageUrl: "/api/images/example/file", content: "Image reference" },
  text: { width: 280, height: 150, content: "Canvas v2 text node" },
  prompt: { width: 320, height: 170, prompt: "Describe the image you want to create" },
  config: { width: 260, height: 180, model: "default", size: "1024x1024", quality: "auto", candidateCount: 1 },
  output: { width: 320, height: 210, content: "Generation output" },
  group: { width: 380, height: 260, content: "Group" },
};

const NODE_LABELS = {
  image: "Image",
  text: "Text",
  prompt: "Prompt",
  config: "Config",
  output: "Output",
  group: "Group",
};

const NODE_TYPE_ORDER = ["image", "text", "prompt", "config", "output", "group"];

let nodeSequence = 0;

export function supportedNodeTypes() {
  return NODE_TYPE_ORDER;
}

export function nodeTypeLabel(type) {
  return NODE_LABELS[type] || type;
}

export function createEditorNode(type, options = {}) {
  const safeType = NODE_DEFAULTS[type] ? type : "text";
  const defaults = NODE_DEFAULTS[safeType];
  const sequence = nodeSequence += 1;
  const offset = (sequence % 10) * 28;
  return {
    ...defaults,
    id: options.id || `${safeType}_${Date.now().toString(36)}_${sequence.toString(36)}`,
    type: safeType,
    x: finiteNumber(options.x, 100 + offset),
    y: finiteNumber(options.y, 100 + offset),
    width: finiteNumber(options.width, defaults.width),
    height: finiteNumber(options.height, defaults.height),
    ...compactNodeFields(options),
  };
}

export function fieldSpecsForNode(node) {
  if (!node) return [];
  if (node.type === "image") {
    return [{ key: "imageUrl", label: "Image URL", placeholder: "/api/images/.../file" }];
  }
  if (node.type === "text" || node.type === "group" || node.type === "output") {
    return [{ key: "content", label: node.type === "output" ? "Result note" : "Content", placeholder: "Write node content" }];
  }
  if (node.type === "prompt") {
    return [{ key: "prompt", label: "Prompt", placeholder: "Prompt text" }];
  }
  if (node.type === "config") {
    return [
      { key: "model", label: "Model", placeholder: "default" },
      { key: "size", label: "Size", placeholder: "1024x1024" },
      { key: "quality", label: "Quality", placeholder: "auto" },
      { key: "candidateCount", label: "Candidates", placeholder: "1" },
    ];
  }
  return [];
}

export function nodeSummary(node) {
  if (!node) return "";
  return node.prompt || node.content || node.imageUrl || node.model || node.id;
}

export function moveNodes(canvasDocument, nodeIds, delta) {
  const selected = new Set(nodeIds);
  if (!selected.size) return canvasDocument;
  return {
    ...canvasDocument,
    nodes: canvasDocument.nodes.map((node) => selected.has(node.id)
      ? { ...node, x: round(node.x + delta.x), y: round(node.y + delta.y) }
      : node),
  };
}

export function resizeNode(canvasDocument, nodeId, size) {
  return {
    ...canvasDocument,
    nodes: canvasDocument.nodes.map((node) => node.id === nodeId
      ? {
          ...node,
          width: Math.max(120, round(size.width)),
          height: Math.max(88, round(size.height)),
        }
      : node),
  };
}

export function updateNodeField(canvasDocument, nodeId, field, value) {
  return {
    ...canvasDocument,
    nodes: canvasDocument.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      if (field === "imageUrl" && isEphemeralImageUrl(value)) return { ...node, imageUrl: "" };
      return { ...node, [field]: String(value || "").trimStart() };
    }),
  };
}

export function appendNode(canvasDocument, node) {
  return {
    ...canvasDocument,
    nodes: [...canvasDocument.nodes, node],
  };
}

export function connectNodes(canvasDocument, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return canvasDocument;
  const nodeIds = new Set(canvasDocument.nodes.map((node) => node.id));
  if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return canvasDocument;
  const exists = canvasDocument.edges.some((edge) => edge.source === sourceId && edge.target === targetId);
  if (exists) return canvasDocument;
  const edge = {
    id: `edge_${Date.now().toString(36)}_${sourceId}_${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle: "output",
    targetHandle: "input",
  };
  return {
    ...canvasDocument,
    edges: [...canvasDocument.edges, edge],
  };
}

export function deleteSelection(canvasDocument, selection) {
  const nodeIds = new Set(selection.nodeIds || []);
  const edgeIds = new Set(selection.edgeIds || []);
  return {
    ...canvasDocument,
    nodes: canvasDocument.nodes.filter((node) => !nodeIds.has(node.id)),
    edges: canvasDocument.edges.filter((edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)),
  };
}

export function copySelection(canvasDocument, nodeIds) {
  const selected = new Set(nodeIds);
  const nodes = canvasDocument.nodes.filter((node) => selected.has(node.id)).map((node) => ({ ...node }));
  const edges = canvasDocument.edges
    .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
    .map((edge) => ({ ...edge }));
  return { nodes, edges };
}

export function pasteClipboard(canvasDocument, clipboard, offset = 38) {
  const sourceNodes = Array.isArray(clipboard?.nodes) ? clipboard.nodes : [];
  if (!sourceNodes.length) return { document: canvasDocument, selectedNodeIds: [] };
  const idMap = new Map();
  const nodes = sourceNodes.map((node) => {
    const nextId = `${node.type || "node"}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    idMap.set(node.id, nextId);
    return {
      ...node,
      id: nextId,
      x: round(finiteNumber(node.x, 0) + offset),
      y: round(finiteNumber(node.y, 0) + offset),
    };
  });
  const edges = (Array.isArray(clipboard?.edges) ? clipboard.edges : [])
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({
      ...edge,
      id: `edge_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
      source: idMap.get(edge.source),
      target: idMap.get(edge.target),
    }));
  return {
    document: {
      ...canvasDocument,
      nodes: [...canvasDocument.nodes, ...nodes],
      edges: [...canvasDocument.edges, ...edges],
    },
    selectedNodeIds: nodes.map((node) => node.id),
  };
}

export function duplicateSelection(canvasDocument, nodeIds) {
  return pasteClipboard(canvasDocument, copySelection(canvasDocument, nodeIds), 42);
}

export function selectNodesInRect(canvasDocument, rect) {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);
  return canvasDocument.nodes
    .filter((node) => {
      const width = finiteNumber(node.width, 220);
      const height = finiteNumber(node.height, 140);
      return node.x < right && node.x + width > left && node.y < bottom && node.y + height > top;
    })
    .map((node) => node.id);
}

export function upstreamNodeIds(canvasDocument, selectedNodeIds) {
  const selected = new Set(selectedNodeIds);
  const upstream = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of canvasDocument.edges) {
      if ((selected.has(edge.target) || upstream.has(edge.target)) && !upstream.has(edge.source)) {
        upstream.add(edge.source);
        changed = true;
      }
    }
  }
  for (const id of selected) upstream.delete(id);
  return [...upstream];
}

export function createHundredNodeDocument(canvasDocument) {
  const nodes = [];
  const types = supportedNodeTypes();
  for (let index = 0; index < 100; index += 1) {
    nodes.push(createEditorNode(types[index % types.length], {
      x: 80 + (index % 10) * 210,
      y: 80 + Math.floor(index / 10) * 150,
      content: `Node ${index + 1}`,
      prompt: `Prompt ${index + 1}`,
    }));
  }
  return {
    ...canvasDocument,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      id: `edge_seed_${index + 1}`,
      source: nodes[index].id,
      target: node.id,
      sourceHandle: "output",
      targetHandle: "input",
    })),
  };
}

function compactNodeFields(options) {
  const fields = {};
  for (const key of ["content", "prompt", "imageUrl", "model", "size", "quality", "candidateCount"]) {
    if (typeof options[key] === "string") fields[key] = options[key];
  }
  return fields;
}

function isEphemeralImageUrl(value) {
  const text = String(value || "").trim();
  return text.startsWith("data:") || text.startsWith("blob:");
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
