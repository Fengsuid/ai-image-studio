#!/usr/bin/env node
// Verifies the standalone canvas history controller without requiring a browser.

global.window = {};
await import("../../public/canvas-nodes.js");
await import("../../public/canvas-history.js");

const root = global.window.ImageStudioCanvas;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error("[canvas-history-smoke] FAIL:", message);
  }
}

let current = {
  nodes: [
    root.nodes.createNode({ id: "node_a", type: "prompt", x: 0, y: 0, data: { title: "A", prompt: "alpha" } })
  ],
  edges: [],
  selectedNodeId: "node_a"
};

const controller = root.history.createController({
  getSnapshot: () => current,
  applySnapshot: (snapshot) => {
    current = snapshot;
  },
  createNode: root.nodes.createNode
});

controller.reset(current);
const beforeMove = controller.capture("move");
current.nodes[0].x = 120;
controller.recordBefore(beforeMove.snapshot, beforeMove.label);
assert(controller.status().canUndo, "move should enable undo");
controller.undo();
assert(current.nodes[0].x === 0, "undo should restore node position");
assert(controller.status().canRedo, "undo should enable redo");
controller.redo();
assert(current.nodes[0].x === 120, "redo should restore moved position");

assert(controller.copy(current.nodes, current.edges), "copy should accept selected nodes");
const pasted = controller.paste({ selectedNodeId: current.selectedNodeId });
assert(pasted?.nodes?.length === 1, "paste should create one copied node");
assert(pasted.nodes[0].id !== current.nodes[0].id, "pasted node should have a new id");
assert(pasted.nodes[0].x === current.nodes[0].x + 44, "pasted node should preserve relative offset");
assert(pasted.selectedNodeId === pasted.nodes[0].id, "paste should select the pasted node");

const beforePaste = controller.capture("paste");
current = {
  ...current,
  nodes: [...current.nodes, ...pasted.nodes],
  edges: [...current.edges, ...pasted.edges],
  selectedNodeId: pasted.selectedNodeId
};
controller.recordBefore(beforePaste.snapshot, beforePaste.label);
assert(current.nodes.length === 2, "paste should append copied node");
controller.undo();
assert(current.nodes.length === 1, "undo should remove pasted node");

if (failures.length) {
  console.error(`[canvas-history-smoke] ${failures.length} failure(s)`);
  process.exitCode = 1;
} else {
  console.log("[canvas-history-smoke] OK: undo, redo, copy, and paste behavior verified");
}
