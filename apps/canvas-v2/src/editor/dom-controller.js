import { clampZoom, screenToCanvas, zoomViewportAt } from "./geometry.js";
import {
  appendNode,
  connectNodes,
  copySelection,
  createEditorNode,
  createHundredNodeDocument,
  deleteSelection,
  duplicateSelection,
  moveNodes,
  pasteClipboard,
  resizeNode,
  selectNodesInRect,
  updateNodeField,
} from "./model.js";

export function installEditorController(root, api) {
  const gesture = { current: null };

  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const port = event.target.closest("[data-canvas-port]");
    if (port instanceof HTMLElement) {
      handlePortClick(event, port, api);
      return;
    }
    const edge = event.target.closest("[data-canvas-edge-id]");
    if (edge instanceof Element) {
      handleEdgeClick(event, edge, api);
      return;
    }
    const action = event.target.closest("[data-canvas-editor-action]");
    if (action instanceof HTMLElement) {
      handleEditorAction(event, action, api);
    }
  };

  const onInput = (event) => {
    if (!(event.target instanceof HTMLTextAreaElement)) return;
    const field = event.target.dataset.canvasNodeField;
    const nodeId = event.target.dataset.canvasNodeId;
    if (!field || !nodeId) return;
    api.mutateDocument((canvasDocument) => updateNodeField(canvasDocument, nodeId, field, event.target.value), { commit: true });
  };

  const onPointerDown = (event) => {
    if (!(event.target instanceof Element) || event.button !== 0) return;
    const state = api.getState();
    if (!state.currentProjectId) return;
    const resize = event.target.closest("[data-canvas-node-resize]");
    const nodeElement = event.target.closest("[data-canvas-node-id]");
    const stage = event.target.closest("[data-canvas-stage]");
    if (resize instanceof HTMLElement) {
      startResize(event, resize, gesture, api);
    } else if (nodeElement instanceof HTMLElement && nodeElement.dataset.canvasNodeId) {
      if (event.target.closest("button, textarea, input, select, [data-canvas-port]")) return;
      startNodeDrag(event, nodeElement, gesture, api);
    } else if (stage instanceof HTMLElement && !event.target.closest("[data-canvas-minimap]")) {
      startStageGesture(event, stage, gesture, api);
    }
  };

  const onPointerMove = (event) => {
    if (!gesture.current) return;
    if (gesture.current.type === "drag") updateDrag(event, gesture.current, api);
    if (gesture.current.type === "resize") updateResize(event, gesture.current, api);
    if (gesture.current.type === "pan") updatePan(event, gesture.current, api);
    if (gesture.current.type === "box") updateBoxSelect(event, gesture.current, api);
  };

  const onPointerUp = () => {
    if (!gesture.current) return;
    const current = gesture.current;
    gesture.current = null;
    if (current.type === "drag" || current.type === "resize" || current.type === "pan") {
      api.commitDocument();
    }
    if (current.type === "box") {
      const state = api.getState();
      const nodeIds = selectNodesInRect(state.document, state.selectionRect || current.rect);
      api.setState({ selectedNodeIds: nodeIds, selectedEdgeIds: [], selectionRect: null, editorTool: "pan" });
    }
  };

  const onWheel = (event) => {
    if (!(event.target instanceof Element)) return;
    const stage = event.target.closest("[data-canvas-stage]");
    if (!(stage instanceof HTMLElement)) return;
    event.preventDefault();
    const state = api.getState();
    if (!state.currentProjectId) return;
    const rect = stage.getBoundingClientRect();
    const origin = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const viewport = zoomViewportAt(state.document.viewport, clampZoom(state.document.viewport.zoom * factor), origin);
    api.mutateDocument((canvasDocument) => ({ ...canvasDocument, viewport }), { commit: true });
  };

  const onKeyDown = (event) => {
    if (isTextInput(event.target)) return;
    const state = api.getState();
    if (!state.currentProjectId) return;
    const key = event.key.toLowerCase();
    if (event.ctrlKey && key === "a") {
      event.preventDefault();
      api.setState({ selectedNodeIds: state.document.nodes.map((node) => node.id), selectedEdgeIds: [] });
    } else if (event.ctrlKey && key === "c") {
      event.preventDefault();
      api.setState({ clipboard: copySelection(state.document, state.selectedNodeIds || []) });
    } else if (event.ctrlKey && key === "v") {
      event.preventDefault();
      pasteFromState(api);
    } else if (event.ctrlKey && key === "d") {
      event.preventDefault();
      duplicateFromState(api);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteFromState(api);
    } else if (event.key === "Escape") {
      api.setState({ selectedNodeIds: [], selectedEdgeIds: [], connectionSourceId: "", selectionRect: null, editorTool: "pan" });
    }
  };

  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);

  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("input", onInput);
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("wheel", onWheel);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
  };
}

function handleEditorAction(event, action, api) {
  event.preventDefault();
  const state = api.getState();
  const name = action.dataset.canvasEditorAction || "";
  if (!state.currentProjectId && !name.startsWith("tool-")) return;
  if (name === "add-node") {
    const type = action.dataset.nodeType || "text";
    const center = visibleCanvasCenter(api);
    const node = createEditorNode(type, center);
    api.mutateDocument((canvasDocument) => appendNode(canvasDocument, node), { commit: true });
    api.setState({ selectedNodeIds: [node.id], selectedEdgeIds: [] });
  } else if (name === "zoom-in" || name === "zoom-out") {
    zoomBy(api, name === "zoom-in" ? 1.16 : 0.86);
  } else if (name === "reset-viewport") {
    api.mutateDocument((canvasDocument) => ({ ...canvasDocument, viewport: { x: 0, y: 0, zoom: 1 } }), { commit: true });
  } else if (name === "tool-pan") {
    api.setState({ editorTool: "pan", selectionRect: null });
  } else if (name === "tool-box-select") {
    api.setState({ editorTool: "box-select", selectionRect: null });
  } else if (name === "connect-selected") {
    const [source, target] = state.selectedNodeIds || [];
    api.mutateDocument((canvasDocument) => connectNodes(canvasDocument, source, target), { commit: true });
  } else if (name === "duplicate-selection") {
    duplicateFromState(api);
  } else if (name === "delete-selection") {
    deleteFromState(api);
  } else if (name === "seed-100") {
    api.mutateDocument((canvasDocument) => createHundredNodeDocument(canvasDocument), { commit: true });
    api.setState({ selectedNodeIds: [], selectedEdgeIds: [] });
  }
}

function handlePortClick(event, port, api) {
  event.preventDefault();
  event.stopPropagation();
  const kind = port.dataset.canvasPort;
  const nodeId = port.dataset.canvasNodeId || "";
  const state = api.getState();
  if (!state.currentProjectId || !nodeId) return;
  if (kind === "output") {
    api.setState({ connectionSourceId: nodeId, selectedNodeIds: [nodeId], selectedEdgeIds: [] });
    return;
  }
  if (kind === "input" && state.connectionSourceId) {
    api.mutateDocument((canvasDocument) => connectNodes(canvasDocument, state.connectionSourceId, nodeId), { commit: true });
    api.setState({ connectionSourceId: "", selectedNodeIds: [state.connectionSourceId, nodeId], selectedEdgeIds: [] });
  }
}

function handleEdgeClick(event, edge, api) {
  event.preventDefault();
  event.stopPropagation();
  const edgeId = edge.dataset.canvasEdgeId || "";
  const state = api.getState();
  const current = new Set(state.selectedEdgeIds || []);
  if (event.ctrlKey || event.metaKey) {
    current.has(edgeId) ? current.delete(edgeId) : current.add(edgeId);
  } else {
    current.clear();
    current.add(edgeId);
  }
  api.setState({ selectedEdgeIds: [...current], selectedNodeIds: [] });
}

function startNodeDrag(event, nodeElement, gesture, api) {
  const nodeId = nodeElement.dataset.canvasNodeId || "";
  const state = api.getState();
  const selected = new Set(state.selectedNodeIds || []);
  if (event.ctrlKey || event.metaKey) {
    selected.has(nodeId) ? selected.delete(nodeId) : selected.add(nodeId);
  } else if (!selected.has(nodeId)) {
    selected.clear();
    selected.add(nodeId);
  }
  const selectedNodeIds = [...selected];
  api.setState({ selectedNodeIds, selectedEdgeIds: [] });
  gesture.current = {
    type: "drag",
    selectedNodeIds,
    startPoint: pointerCanvasPoint(event, api),
    lastPoint: pointerCanvasPoint(event, api),
  };
}

function startResize(event, resize, gesture, api) {
  const nodeId = resize.dataset.canvasNodeId || "";
  const node = api.getState().document.nodes.find((item) => item.id === nodeId);
  if (!node) return;
  gesture.current = {
    type: "resize",
    nodeId,
    startPoint: pointerCanvasPoint(event, api),
    startSize: { width: Number(node.width || 240), height: Number(node.height || 150) },
  };
  api.setState({ selectedNodeIds: [nodeId], selectedEdgeIds: [] });
}

function startStageGesture(event, stage, gesture, api) {
  const state = api.getState();
  const point = stagePoint(event, stage);
  if (event.shiftKey || state.editorTool === "box-select") {
    const canvasPoint = screenToCanvas(point, state.document.viewport);
    const rect = { x1: canvasPoint.x, y1: canvasPoint.y, x2: canvasPoint.x, y2: canvasPoint.y };
    gesture.current = { type: "box", rect };
    api.setState({ selectionRect: rect });
    return;
  }
  gesture.current = {
    type: "pan",
    startClient: { x: event.clientX, y: event.clientY },
    startViewport: { ...state.document.viewport },
  };
}

function updateDrag(event, current, api) {
  const point = pointerCanvasPoint(event, api);
  const delta = { x: point.x - current.lastPoint.x, y: point.y - current.lastPoint.y };
  current.lastPoint = point;
  api.mutateDocument((canvasDocument) => moveNodes(canvasDocument, current.selectedNodeIds, delta), { commit: false });
}

function updateResize(event, current, api) {
  const point = pointerCanvasPoint(event, api);
  const delta = { x: point.x - current.startPoint.x, y: point.y - current.startPoint.y };
  api.mutateDocument((canvasDocument) => resizeNode(canvasDocument, current.nodeId, {
    width: current.startSize.width + delta.x,
    height: current.startSize.height + delta.y,
  }), { commit: false });
}

function updatePan(event, current, api) {
  const dx = event.clientX - current.startClient.x;
  const dy = event.clientY - current.startClient.y;
  api.mutateDocument((canvasDocument) => ({
    ...canvasDocument,
    viewport: {
      ...canvasDocument.viewport,
      x: Math.round((current.startViewport.x + dx) * 10) / 10,
      y: Math.round((current.startViewport.y + dy) * 10) / 10,
    },
  }), { commit: false });
}

function updateBoxSelect(event, current, api) {
  const point = pointerCanvasPoint(event, api);
  current.rect = { ...current.rect, x2: point.x, y2: point.y };
  api.setState({ selectionRect: current.rect });
}

function zoomBy(api, factor) {
  const state = api.getState();
  const stage = document.querySelector("[data-canvas-stage]");
  const rect = stage?.getBoundingClientRect?.();
  const origin = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 430, y: 260 };
  const viewport = zoomViewportAt(state.document.viewport, clampZoom(state.document.viewport.zoom * factor), origin);
  api.mutateDocument((canvasDocument) => ({ ...canvasDocument, viewport }), { commit: true });
}

function visibleCanvasCenter(api) {
  const stage = document.querySelector("[data-canvas-stage]");
  const rect = stage?.getBoundingClientRect?.();
  const state = api.getState();
  const center = rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 430, y: 260 };
  return screenToCanvas(center, state.document.viewport);
}

function deleteFromState(api) {
  const state = api.getState();
  api.mutateDocument((canvasDocument) => deleteSelection(canvasDocument, {
    nodeIds: state.selectedNodeIds || [],
    edgeIds: state.selectedEdgeIds || [],
  }), { commit: true });
  api.setState({ selectedNodeIds: [], selectedEdgeIds: [], connectionSourceId: "" });
}

function duplicateFromState(api) {
  const state = api.getState();
  const result = duplicateSelection(state.document, state.selectedNodeIds || []);
  api.mutateDocument(() => result.document, { commit: true });
  api.setState({ selectedNodeIds: result.selectedNodeIds, selectedEdgeIds: [] });
}

function pasteFromState(api) {
  const state = api.getState();
  const result = pasteClipboard(state.document, state.clipboard, 46);
  api.mutateDocument(() => result.document, { commit: true });
  api.setState({ selectedNodeIds: result.selectedNodeIds, selectedEdgeIds: [] });
}

function pointerCanvasPoint(event, api) {
  const stage = document.querySelector("[data-canvas-stage]");
  const rect = stage?.getBoundingClientRect?.();
  const point = rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: event.clientX, y: event.clientY };
  return screenToCanvas(point, api.getState().document.viewport);
}

function stagePoint(event, stage) {
  const rect = stage.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function isTextInput(target) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
}
