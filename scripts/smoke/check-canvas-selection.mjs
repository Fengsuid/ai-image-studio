#!/usr/bin/env node
// Verifies standalone canvas selection helpers without requiring a browser.

global.window = {};
await import("../../public/canvas-nodes.js");
await import("../../public/canvas-selection.js");

const root = global.window.ImageStudioCanvas;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error("[canvas-selection-smoke] FAIL:", message);
  }
}

const nodes = [
  root.nodes.createNode({ id: "node_a", type: "prompt", x: 0, y: 0 }),
  root.nodes.createNode({ id: "node_b", type: "image", x: 260, y: 80 }),
  root.nodes.createNode({ id: "node_c", type: "text", x: 700, y: 360 })
];
const edges = [{ id: "edge_a_b", sourceId: "node_a", targetId: "node_b" }];

const rect = root.selection.rectFromDrag({ x: -20, y: -20 }, { x: 520, y: 260 });
const selected = root.selection.nodesInRect(nodes, rect);
assert(selected.includes("node_a"), "box selection should include node_a");
assert(selected.includes("node_b"), "box selection should include node_b");
assert(!selected.includes("node_c"), "box selection should exclude node_c");

const toggled = root.selection.toggle(["node_a"], "node_b", nodes);
assert(toggled.includes("node_a") && toggled.includes("node_b"), "toggle should add a valid node");
const removed = root.selection.toggle(toggled, "node_a", nodes);
assert(!removed.includes("node_a") && removed.includes("node_b"), "toggle should remove an existing node");

const moved = root.selection.moveNodes(nodes, ["node_a", "node_b"], nodes, { x: 33, y: 17 });
const movedA = moved.find((node) => node.id === "node_a");
const movedB = moved.find((node) => node.id === "node_b");
assert(movedA.x === 33 && movedA.y === 17, "batch move should move first node by delta");
assert(movedB.x === 293 && movedB.y === 97, "batch move should preserve relative offset");

const deleted = root.selection.deleteSelection(nodes, edges, ["node_a", "node_b"]);
assert(deleted.nodes.length === 1 && deleted.nodes[0].id === "node_c", "deleteSelection should remove selected nodes");
assert(deleted.edges.length === 0, "deleteSelection should remove connected edges");

const group = root.selection.groupFromNodes(nodes, ["node_a", "node_b"], root.nodes.createNode);
assert(group?.type === "group", "groupFromNodes should create a group node");
assert(group.data.memberIds.length === 2, "group should remember member ids");
assert(group.data.title === "Group 2", "group should expose a readable title");
assert(group.data.width > 220 && group.data.height > 132, "group should size around selected nodes");

if (failures.length) {
  console.error(`[canvas-selection-smoke] ${failures.length} failure(s)`);
  process.exitCode = 1;
} else {
  console.log("[canvas-selection-smoke] OK: box select, toggle, batch move, delete, and group behavior verified");
}
