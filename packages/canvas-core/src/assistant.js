// SPDX-License-Identifier: AGPL-3.0-or-later
"use strict";

const FORMAT = "ai-image-studio.canvas-assistant.v1";
const MAX_SUMMARY = 420;
const MAX_PROMPT = 1600;
const MAX_CONTEXT_NODES = 24;

function createAssistantResponse(canvas = {}, request = {}, { generatedAt = new Date().toISOString() } = {}) {
  const context = collectAssistantContext(canvas.dataJson || {}, request);
  return {
    format: FORMAT,
    generatedAt,
    canvasId: String(canvas.id || ""),
    context,
    suggestions: createAssistantSuggestions(context)
  };
}

function collectAssistantContext(data = {}, request = {}) {
  const nodes = normalizeNodes(data.nodes);
  const edges = normalizeEdges(data.edges, new Set(nodes.map((node) => node.id)));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const requestedIds = normalizeSelection(request.selectedNodeIds, nodes);
  const selectedNodeId = byId.has(String(request.selectedNodeId || ""))
    ? String(request.selectedNodeId || "")
    : "";
  const persistedIds = normalizeSelection(data.selectedNodeIds, nodes);
  const persistedPrimary = byId.has(String(data.selectedNodeId || "")) ? String(data.selectedNodeId || "") : "";
  const selectedNodeIds = requestedIds.length
    ? requestedIds
    : selectedNodeId
      ? [selectedNodeId]
      : persistedIds.length
        ? persistedIds
        : persistedPrimary
          ? [persistedPrimary]
          : nodes[0]?.id
            ? [nodes[0].id]
            : [];
  const primaryNodeId = selectedNodeId && selectedNodeIds.includes(selectedNodeId)
    ? selectedNodeId
    : selectedNodeIds[selectedNodeIds.length - 1] || "";
  const selectedNodes = selectedNodeIds.map((id) => byId.get(id)).filter(Boolean);
  const upstreamNodes = uniqueById(selectedNodeIds.flatMap((id) => upstreamFor(id, nodes, edges))).slice(0, MAX_CONTEXT_NODES);
  const contextNodes = uniqueById([...upstreamNodes, ...selectedNodes]).slice(0, MAX_CONTEXT_NODES);
  const promptNodes = contextNodes.filter((node) => node.type === "prompt");
  const imageNodes = contextNodes.filter((node) => node.type === "image");
  const textNodes = contextNodes.filter((node) => node.type === "text");
  const configNodes = contextNodes.filter((node) => node.type === "config");
  const primaryText = bestPromptText(promptNodes, textNodes, selectedNodes);
  return {
    selectedNodeId: primaryNodeId,
    selectedNodeIds,
    selectedNodes: selectedNodes.map(summarizeNode),
    upstreamNodes: upstreamNodes.map(summarizeNode),
    mode: imageNodes.length ? "image-to-image" : "text-to-image",
    seedText: primaryText,
    config: summarizeConfig(configNodes[0]),
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      selected: selectedNodes.length,
      upstream: upstreamNodes.length,
      prompts: promptNodes.length,
      images: imageNodes.length,
      text: textNodes.length
    }
  };
}

function createAssistantSuggestions(context = {}) {
  const sourceNodeIds = uniqueStrings([...(context.upstreamNodes || []), ...(context.selectedNodes || [])].map((node) => node.id));
  const seed = context.seedText || "A clear image concept with subject, setting, composition, lighting, style, and constraints.";
  const config = context.config || {};
  const mode = context.mode || "text-to-image";
  const refinedPrompt = [
    `Create a polished ${mode} result based on this idea: ${clip(seed, 900)}`,
    "Emphasize a clear subject, intentional composition, specific materials, lighting direction, color palette, camera angle, and production-ready details.",
    "Avoid vague wording, accidental extra subjects, distorted anatomy, unreadable text, and low-quality artifacts."
  ].join(" ");
  const styleBody = [
    "Style direction:",
    `- Mode: ${mode}.`,
    `- Visual tone: cinematic, coherent, high-detail, with one dominant focal point.`,
    `- Model plan: ${config.model || "GPT-IMAGE-2"} · ${config.size || "1024x1024"} · ${config.quality || "auto"}.`,
    "- Keep prompt variables explicit, and move constraints into a separate text node when they become long."
  ].join("\n");
  const planBody = [
    "Generation plan:",
    "1. Keep one prompt node and one optional image node upstream of a config node.",
    "2. Run the config/output pair once with medium quality to validate composition.",
    "3. Duplicate the refined prompt node for style variants instead of editing the original.",
    "4. Publish only the best output after checking source image and tag rules."
  ].join("\n");
  return [
    {
      id: "assistant_prompt_rewrite",
      category: "rewrite",
      type: "prompt",
      title: "改写提示词",
      actionLabel: "插入 Prompt 节点",
      prompt: clip(refinedPrompt, MAX_PROMPT),
      body: clip(refinedPrompt, MAX_PROMPT),
      sourceNodeIds
    },
    {
      id: "assistant_style_direction",
      category: "style",
      type: "text",
      title: "风格建议",
      actionLabel: "插入 Text 节点",
      body: styleBody,
      sourceNodeIds
    },
    {
      id: "assistant_generation_plan",
      category: "plan",
      type: "text",
      title: "生成计划",
      actionLabel: "插入 Text 节点",
      body: planBody,
      sourceNodeIds
    }
  ];
}

function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((node) => node && typeof node === "object" && !Array.isArray(node))
    .map((node) => ({
      id: String(node.id || "").trim(),
      type: ["image", "text", "prompt", "config", "output", "group"].includes(node.type) ? node.type : "prompt",
      x: finite(node.x),
      y: finite(node.y),
      data: node.data && typeof node.data === "object" && !Array.isArray(node.data) ? node.data : {}
    }))
    .filter((node) => node.id);
}

function normalizeEdges(edges, nodeIds) {
  if (!Array.isArray(edges)) return [];
  return edges
    .filter((edge) => edge && typeof edge === "object" && !Array.isArray(edge))
    .map((edge) => ({
      id: String(edge.id || "").trim(),
      sourceId: String(edge.sourceId || "").trim(),
      targetId: String(edge.targetId || "").trim()
    }))
    .filter((edge) => edge.sourceId && edge.targetId && nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId));
}

function normalizeSelection(ids, nodes) {
  if (!Array.isArray(ids)) return [];
  const valid = new Set(nodes.map((node) => node.id));
  return uniqueStrings(ids.map((id) => String(id || "").trim()).filter((id) => valid.has(id)));
}

function upstreamFor(nodeId, nodes, edges, seen = new Set()) {
  if (!nodeId || seen.has(nodeId)) return [];
  seen.add(nodeId);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges
    .filter((edge) => edge.targetId === nodeId)
    .flatMap((edge) => {
      const node = byId.get(edge.sourceId);
      return node ? [...upstreamFor(node.id, nodes, edges, seen), node] : [];
    });
}

function summarizeNode(node = {}) {
  const data = node.data || {};
  return {
    id: node.id,
    type: node.type,
    title: clip(safeText(data.title) || node.type, 90),
    summary: nodeSummary(node),
    imageRef: node.type === "image" ? safeImageReference(data.imageUrl || data.sourceImage || "") : ""
  };
}

function nodeSummary(node = {}) {
  const data = node.data || {};
  if (node.type === "prompt") return clip(safeText(data.prompt || data.body || data.title), MAX_SUMMARY);
  if (node.type === "text") return clip(safeText(data.body || data.title), MAX_SUMMARY);
  if (node.type === "image") return clip(safeText(data.body || data.prompt || data.title || "Image reference"), MAX_SUMMARY);
  if (node.type === "config") {
    return `${safeText(data.model || "GPT-IMAGE-2")} · ${safeText(data.size || "auto")} · ${safeText(data.quality || "auto")} · ${Number(data.candidateCount || 1)}x`;
  }
  if (node.type === "output") return clip(safeText(data.body || data.status || "Output"), MAX_SUMMARY);
  return clip(safeText(data.body || data.title || node.type), MAX_SUMMARY);
}

function bestPromptText(promptNodes, textNodes, selectedNodes) {
  const selectedPrompt = selectedNodes.find((node) => node.type === "prompt" || node.type === "text");
  const candidate = selectedPrompt || promptNodes[promptNodes.length - 1] || textNodes[textNodes.length - 1] || selectedNodes[0];
  return clip(nodeSummary(candidate), MAX_PROMPT);
}

function summarizeConfig(node) {
  if (!node) return null;
  const data = node.data || {};
  return {
    model: clip(safeText(data.model || "GPT-IMAGE-2"), 80),
    size: clip(safeText(data.size || "1024x1024"), 32),
    quality: clip(safeText(data.quality || "auto"), 32),
    candidateCount: Math.max(1, Math.min(4, Number.parseInt(data.candidateCount, 10) || 1))
  };
}

function safeText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (/^(data|blob):/i.test(text)) return "[embedded file omitted]";
  return text;
}

function safeImageReference(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(data|blob):/i.test(text)) return "[embedded image omitted]";
  return clip(text, 260);
}

function clip(value, max = MAX_SUMMARY) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function uniqueById(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    if (!node?.id || seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function finite(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

module.exports = {
  FORMAT,
  collectAssistantContext,
  createAssistantResponse,
  createAssistantSuggestions
};
