#!/usr/bin/env node
// Verifies canvas JSON import/export schema behavior without requiring a browser.

import canvasImportExport from "../../src/canvas-import-export.js";

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error("[canvas-io-smoke] FAIL:", message);
  }
}

function assertThrows(fn, pattern, message) {
  try {
    fn();
    fail(`${message}: did not throw`);
  } catch (error) {
    assert(pattern.test(String(error?.message || "")), `${message}: ${error?.message || error}`);
  }
}

function fail(message) {
  failures.push(message);
  console.error("[canvas-io-smoke] FAIL:", message);
}

const canvas = {
  id: "can_smoke",
  title: "Smoke Canvas",
  description: "export import smoke",
  visibility: "private",
  coverUrl: "/api/images/gen_abc/file?variant=thumb",
  dataJson: {
    background: "grid",
    viewport: { x: 10, y: 20, scale: 1 },
    nodes: [
      {
        id: "node_prompt",
        type: "prompt",
        x: 0,
        y: 0,
        data: { title: "Prompt", prompt: "A clean product photo" }
      },
      {
        id: "node_image",
        type: "image",
        x: 260,
        y: 40,
        data: { title: "Image", imageUrl: "/api/images/gen_abc/file?variant=thumb", generationId: "gen_abc" }
      }
    ],
    edges: [{ id: "edge_prompt_image", sourceId: "node_prompt", targetId: "node_image" }],
    selectedNodeId: "node_image",
    selectedNodeIds: ["node_prompt", "node_image"]
  }
};

const exported = canvasImportExport.createCanvasExport(canvas, { exportedAt: "2026-05-20T00:00:00.000Z" });
assert(exported.format === canvasImportExport.FORMAT, "export should include supported format");
assert(exported.canvas.nodeCount === 2, "export should count nodes");
assert(exported.canvas.edgeCount === 1, "export should count edges");
assert(exported.canvas.dataJson.nodes[1].data.imageUrl.startsWith("/api/images/"), "export should keep image URL references");

const imported = canvasImportExport.normalizeCanvasImport(exported, { title: "Existing" });
assert(imported.title === "Smoke Canvas", "import should restore exported title");
assert(imported.nodeCount === 2 && imported.edgeCount === 1, "import should preserve graph counts");
assert(imported.dataJson.selectedNodeIds.length === 2, "import should preserve selected node ids");

assertThrows(
  () => canvasImportExport.normalizeCanvasImport({ dataJson: { nodes: [{ id: "a" }], edges: [{ sourceId: "a", targetId: "missing" }] } }),
  /missing node/i,
  "invalid edge references should be rejected"
);
assertThrows(
  () => canvasImportExport.normalizeCanvasImport({ dataJson: { nodes: [{ id: "a", type: "image", data: { imageUrl: "data:image/png;base64,abc" } }], edges: [] } }),
  /base64|embedded/i,
  "embedded image data should be rejected"
);
assertThrows(
  () => canvasImportExport.normalizeCanvasImport("not json"),
  /object/i,
  "non-object imports should be rejected"
);

if (failures.length) {
  console.error(`[canvas-io-smoke] ${failures.length} failure(s)`);
  process.exitCode = 1;
} else {
  console.log("[canvas-io-smoke] OK: export package, import normalization, schema errors, and embedded image rejection verified");
}
