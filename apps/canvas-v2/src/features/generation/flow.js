// SPDX-License-Identifier: AGPL-3.0-or-later
import { connectNodes, updateNodeField } from "../../editor/model.js";

export function generationRequestForOutput(canvasDocument, outputNodeId) {
  const outputId = String(outputNodeId || "").trim();
  const outputNode = canvasDocument.nodes.find((node) => node.id === outputId && node.type === "output");
  if (!outputNode) return { outputNodeId: outputId, configNodeId: "" };
  return {
    outputNodeId: outputNode.id,
    configNodeId: findConfigForOutput(canvasDocument, outputNode.id),
  };
}

export function applyGenerationStatus(canvasDocument, outputNodeId, status, message) {
  return updateOutputNode(canvasDocument, outputNodeId, {
    status,
    generationStatus: status,
    content: message || generationStatusCopy(status),
    generationError: status === "error" ? message || "Canvas generation failed." : "",
  });
}

export function applyGenerationResult(canvasDocument, outputNodeId, result) {
  const generations = Array.isArray(result?.generations) ? result.generations : [];
  const first = generations[0] || {};
  const generationIds = generations.map((generation) => generation.id).filter(Boolean);
  const firstGenerationId = String(first.id || generationIds[0] || "");
  return updateOutputNode(canvasDocument, outputNodeId, {
    status: "success",
    generationStatus: "success",
    generationId: firstGenerationId,
    generationIds,
    imageUrl: String(first.imageUrl || first.url || (firstGenerationId ? `/api/images/${firstGenerationId}/file` : "")),
    prompt: String(first.prompt || result?.prompt || ""),
    content: generations.length ? `${generations.length} image(s) generated.` : "Generation finished.",
    generationError: "",
  });
}

export function ensureOutputConnection(canvasDocument, sourceId, outputNodeId) {
  return connectNodes(canvasDocument, sourceId, outputNodeId);
}

function findConfigForOutput(canvasDocument, outputNodeId) {
  const nodeById = new Map(canvasDocument.nodes.map((node) => [node.id, node]));
  const seen = new Set();
  const stack = canvasDocument.edges
    .filter((edge) => edge.target === outputNodeId || edge.targetId === outputNodeId)
    .map((edge) => edge.source || edge.sourceId)
    .filter(Boolean);

  while (stack.length) {
    const nodeId = stack.shift();
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    const node = nodeById.get(nodeId);
    if (node?.type === "config") return node.id;
    for (const edge of canvasDocument.edges) {
      const target = edge.target || edge.targetId;
      if (target === nodeId) stack.push(edge.source || edge.sourceId);
    }
  }
  return canvasDocument.nodes.find((node) => node.type === "config")?.id || "";
}

function updateOutputNode(canvasDocument, outputNodeId, patch) {
  return {
    ...canvasDocument,
    nodes: canvasDocument.nodes.map((node) => node.id === outputNodeId ? { ...node, ...patch } : node),
  };
}

function generationStatusCopy(status) {
  if (status === "queued") return "Generation queued.";
  if (status === "running") return "Generation running.";
  if (status === "success") return "Generation succeeded.";
  if (status === "error") return "Generation failed.";
  return "Generation pending.";
}
