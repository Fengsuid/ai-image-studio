(function initCanvasWorkflows(global) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function emptyWorkflow() {
    return { nodes: [], edges: [] };
  }

  function createEdge(sourceId, targetId) {
    return {
      id: `edge_${sourceId}_${targetId}`,
      sourceId,
      targetId
    };
  }

  function hasPath(edges = [], fromId, toId, visited = new Set()) {
    if (fromId === toId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    return edges
      .filter((edge) => edge.sourceId === fromId)
      .some((edge) => hasPath(edges, edge.targetId, toId, visited));
  }

  function canConnect(edges = [], sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return { ok: false, reason: "same_node" };
    if (edges.some((edge) => edge.sourceId === sourceId && edge.targetId === targetId)) {
      return { ok: false, reason: "duplicate" };
    }
    if (hasPath(edges, targetId, sourceId)) return { ok: false, reason: "cycle" };
    return { ok: true, reason: "" };
  }

  function upstreamNodes(nodes = [], edges = [], nodeId) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const result = [];
    const visit = (id) => {
      for (const edge of edges.filter((item) => item.targetId === id)) {
        const node = byId.get(edge.sourceId);
        if (!node || result.some((item) => item.id === node.id)) continue;
        result.push(node);
        visit(node.id);
      }
    };
    visit(nodeId);
    return result;
  }

  function configInputSummary(nodes = [], edges = [], configId) {
    const upstream = upstreamNodes(nodes, edges, configId);
    const prompts = upstream.filter((node) => node.type === "prompt");
    const images = upstream.filter((node) => node.type === "image");
    return {
      upstream,
      prompts,
      images,
      hasConflict: prompts.length > 1 || images.length > 1,
      mode: images.length ? "image-to-image" : "text-to-image"
    };
  }

  root.workflows = {
    emptyWorkflow,
    createEdge,
    canConnect,
    upstreamNodes,
    configInputSummary
  };
})(window);
