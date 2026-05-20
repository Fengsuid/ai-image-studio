#!/usr/bin/env node
// Verifies Canvas v2 editor graph operations and renderer markers without a browser.

import assert from "node:assert/strict";
import {
  canvasPayloadFromDocument,
  createEmptyCanvasDocument,
  normalizeCanvasDocument,
} from "../../apps/canvas-v2/src/adapters/canvas-schema.js";
import {
  documentBounds,
  edgePath,
  portPosition,
  screenToCanvas,
  viewportRect,
  zoomViewportAt,
} from "../../apps/canvas-v2/src/editor/geometry.js";
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
  supportedNodeTypes,
  updateNodeField,
  upstreamNodeIds,
} from "../../apps/canvas-v2/src/editor/model.js";
import { renderEditor } from "../../apps/canvas-v2/src/editor/view.js";

const title = "Canvas v2 editor smoke";
let document = createEmptyCanvasDocument(title);

const nodes = supportedNodeTypes().map((type, index) => createEditorNode(type, {
  id: `node_${type}`,
  x: 80 + index * 140,
  y: 100 + index * 32,
  content: `${type} content`,
  prompt: `${type} prompt`,
  imageUrl: type === "image" ? "/api/images/smoke/file" : undefined,
}));
for (const node of nodes) document = appendNode(document, node);

assert.equal(document.nodes.length, 6, "editor should create all supported node types");
assert.deepEqual(document.nodes.map((node) => node.type), ["image", "text", "prompt", "config", "output", "group"], "node type order mismatch");

document = connectNodes(document, "node_prompt", "node_config");
document = connectNodes(document, "node_config", "node_output");
document = connectNodes(document, "node_output", "node_prompt");
document = connectNodes(document, "node_prompt", "node_config");
assert.equal(document.edges.length, 3, "connectNodes should create unique valid edges");
assert(document.edges.every((edge) => edge.sourceHandle === "output" && edge.targetHandle === "input"), "edges should use output/input handles");

const moved = moveNodes(document, ["node_prompt", "node_config"], { x: 25, y: -10 });
assert.equal(moved.nodes.find((node) => node.id === "node_prompt").x, document.nodes.find((node) => node.id === "node_prompt").x + 25, "moveNodes should move selected node x");
assert.equal(moved.nodes.find((node) => node.id === "node_config").y, document.nodes.find((node) => node.id === "node_config").y - 10, "moveNodes should move selected node y");
document = moved;

document = resizeNode(document, "node_output", { width: 420, height: 260 });
const output = document.nodes.find((node) => node.id === "node_output");
assert.equal(output.width, 420, "resizeNode should persist width");
assert.equal(output.height, 260, "resizeNode should persist height");

document = updateNodeField(document, "node_image", "imageUrl", "data:image/png;base64,abc");
assert.equal(document.nodes.find((node) => node.id === "node_image").imageUrl, "", "data: image URLs should be dropped before save");
document = updateNodeField(document, "node_image", "imageUrl", "blob:http://local.invalid/abc");
assert.equal(document.nodes.find((node) => node.id === "node_image").imageUrl, "", "blob: image URLs should be dropped before save");
document = updateNodeField(document, "node_image", "imageUrl", "/api/images/smoke/file");

const selectedInRect = selectNodesInRect(document, { x1: 40, y1: 60, x2: 700, y2: 420 });
assert(selectedInRect.includes("node_prompt") && selectedInRect.includes("node_output"), "box selection should include nodes intersecting the rectangle");

const upstream = upstreamNodeIds(document, ["node_output"]);
assert(upstream.includes("node_prompt") && upstream.includes("node_config"), "upstream resolution should walk incoming edges");

const clipboard = copySelection(document, ["node_prompt", "node_config", "node_output"]);
assert.equal(clipboard.nodes.length, 3, "copySelection should copy selected nodes");
assert.equal(clipboard.edges.length, 3, "copySelection should copy only internal selected edges");
const pasted = pasteClipboard(document, clipboard, 64);
assert.equal(pasted.document.nodes.length, document.nodes.length + 3, "pasteClipboard should append copied nodes");
assert.equal(pasted.document.edges.length, document.edges.length + 3, "pasteClipboard should remap internal copied edges");
assert.equal(pasted.selectedNodeIds.length, 3, "pasteClipboard should return new selected ids");

const duplicated = duplicateSelection(document, ["node_prompt", "node_config"]);
assert.equal(duplicated.document.nodes.length, document.nodes.length + 2, "duplicateSelection should append cloned nodes");

const deleted = deleteSelection(document, { nodeIds: ["node_config"], edgeIds: [] });
assert(!deleted.nodes.some((node) => node.id === "node_config"), "deleteSelection should remove selected node");
assert(!deleted.edges.some((edge) => edge.source === "node_config" || edge.target === "node_config"), "deleteSelection should remove connected edges");

const hundred = createHundredNodeDocument(createEmptyCanvasDocument("100 node smoke"));
assert.equal(hundred.nodes.length, 100, "100 node seed should create exactly 100 nodes");
assert.equal(hundred.edges.length, 99, "100 node seed should create a connected chain");

const normalized = normalizeCanvasDocument({
  ...document,
  nodes: [
    ...document.nodes,
    { id: "bad_image", type: "image", x: 0, y: 0, imageUrl: "blob:http://local.invalid/secret" },
  ],
});
assert(!normalized.nodes.find((node) => node.id === "bad_image").imageUrl, "normalizeCanvasDocument should scrub blob image URLs");
const payload = canvasPayloadFromDocument({
  ...normalized,
  viewport: { x: 44, y: 88, zoom: 1.4 },
});
assert.equal(payload.dataJson.schema, "ai-image-studio.canvas.v1", "payload should keep canvas v1 schema");
assert.equal(payload.nodeCount, normalized.nodes.length, "payload nodeCount should match normalized nodes");
assert.equal(payload.edgeCount, normalized.edges.length, "payload edgeCount should match normalized edges");
assert.equal(payload.dataJson.viewport.zoom, 1.4, "payload should persist viewport zoom");

const nodeMap = new Map(document.nodes.map((node) => [node.id, node]));
const firstEdgePath = edgePath(document.edges[0], nodeMap);
assert(firstEdgePath.startsWith("M "), "edgePath should return an SVG cubic path");
assert.equal(portPosition(nodeMap.get("node_prompt"), "output").x, nodeMap.get("node_prompt").x + nodeMap.get("node_prompt").width, "output port should attach to node right edge");

const zoomed = zoomViewportAt({ x: 0, y: 0, zoom: 1 }, 1.5, { x: 300, y: 220 });
assert.equal(zoomed.zoom, 1.5, "zoomViewportAt should update zoom");
const canvasPoint = screenToCanvas({ x: 300, y: 220 }, zoomed);
assert(Math.abs(canvasPoint.x - 300) < 0.001, "screenToCanvas should preserve the zoom origin x");
assert(Math.abs(canvasPoint.y - 220) < 0.001, "screenToCanvas should preserve the zoom origin y");
const bounds = documentBounds(document);
const miniViewport = viewportRect({ x: 0, y: 0, zoom: 1 }, { width: 860, height: 520 }, bounds);
assert(miniViewport.width > 0 && miniViewport.height > 0, "viewportRect should project visible stage into minimap");

const html = renderEditor({
  document,
  selectedNodeIds: ["node_output"],
  selectedEdgeIds: [document.edges[0].id],
  connectionSourceId: "node_prompt",
  editorTool: "box-select",
  selectionRect: { x1: 10, y1: 20, x2: 220, y2: 180 },
}, { hasProject: true });
assert(html.includes("data-canvas-editor"), "renderEditor should expose editor root");
assert(html.includes("data-canvas-stage"), "renderEditor should expose stage");
assert(html.includes("data-canvas-minimap"), "renderEditor should render minimap");
assert(html.includes("data-canvas-port=\"output\""), "renderEditor should render output ports");
assert(html.includes("data-canvas-node-resize"), "renderEditor should render resize handles");
assert(html.includes("data-canvas-selection-rect"), "renderEditor should render active box selection");
assert(html.includes("canvas-v2-edge selected"), "renderEditor should render selected edge state");
assert(html.includes("canvas-v2-mobile-note"), "renderEditor should include mobile degradation note");

console.log("[canvas-v2-editor-smoke] OK: editor graph operations, viewport, minimap, save schema, and renderer markers verified");
