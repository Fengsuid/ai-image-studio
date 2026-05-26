// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from "vitest";
import {
  createCanvasExport,
  normalizeCanvasImport,
  validateCanvasData,
  FORMAT
} from "../src/import-export.js";

const sampleCanvas = {
  id: "can_round_trip",
  title: "Round Trip",
  description: "round trip smoke",
  visibility: "private",
  coverUrl: "/api/images/gen_abc/file?variant=thumb",
  dataJson: {
    background: "grid",
    viewport: { x: 10, y: 20, scale: 1 },
    nodes: [
      { id: "node_prompt", type: "prompt", x: 0, y: 0, data: { title: "Prompt", prompt: "A clean product photo" } },
      { id: "node_image", type: "image", x: 260, y: 40, data: { title: "Image", imageUrl: "/api/images/gen_abc/file" } }
    ],
    edges: [{ id: "edge_prompt_image", sourceId: "node_prompt", targetId: "node_image" }],
    selectedNodeId: "node_image",
    selectedNodeIds: ["node_prompt", "node_image"]
  }
};

describe("createCanvasExport", () => {
  it("wraps the canvas with the frozen format identifier", () => {
    const result = createCanvasExport(sampleCanvas, { exportedAt: "2026-05-25T00:00:00.000Z" });
    expect(result.format).toBe(FORMAT);
    expect(result.exportedAt).toBe("2026-05-25T00:00:00.000Z");
    expect(result.canvas.id).toBe("can_round_trip");
    expect(result.canvas.nodeCount).toBe(2);
    expect(result.canvas.edgeCount).toBe(1);
  });

  it("rejects embedded image data on the cover field", () => {
    expect(() =>
      createCanvasExport({ ...sampleCanvas, coverUrl: "data:image/png;base64,abc" })
    ).toThrow(/embedded base64/i);
  });
});

describe("normalizeCanvasImport round-trip", () => {
  it("re-imports an exported package without losing graph counts or selection", () => {
    const exported = createCanvasExport(sampleCanvas, { exportedAt: "2026-05-25T00:00:00.000Z" });
    const imported = normalizeCanvasImport(exported, { title: "Stale" });
    expect(imported.title).toBe("Round Trip");
    expect(imported.nodeCount).toBe(2);
    expect(imported.edgeCount).toBe(1);
    expect(imported.dataJson.selectedNodeIds).toEqual(["node_prompt", "node_image"]);
  });

  it("rejects edges that reference unknown nodes", () => {
    expect(() =>
      normalizeCanvasImport({
        dataJson: {
          nodes: [{ id: "a", type: "prompt", x: 0, y: 0, data: {} }],
          edges: [{ sourceId: "a", targetId: "missing" }]
        }
      })
    ).toThrow(/missing node/i);
  });

  it("rejects embedded base64 image data inside node payloads", () => {
    expect(() =>
      normalizeCanvasImport({
        dataJson: {
          nodes: [
            { id: "a", type: "image", x: 0, y: 0, data: { imageUrl: "data:image/png;base64,abc" } }
          ],
          edges: []
        }
      })
    ).toThrow(/embedded|base64/i);
  });

  it("rejects non-object payloads", () => {
    expect(() => normalizeCanvasImport("not-json")).toThrow(/object/i);
  });
});

describe("validateCanvasData", () => {
  it("dedupes selected node ids against the actual node list", () => {
    const data = validateCanvasData({
      nodes: [{ id: "a", type: "prompt", x: 0, y: 0, data: {} }],
      edges: [],
      selectedNodeId: "ghost",
      selectedNodeIds: ["a", "ghost", "ghost"]
    });
    expect(data.selectedNodeId).toBe("a");
    expect(data.selectedNodeIds).toEqual(["a"]);
  });

  it("rejects duplicate node ids", () => {
    expect(() =>
      validateCanvasData({
        nodes: [
          { id: "dupe", type: "prompt", x: 0, y: 0, data: {} },
          { id: "dupe", type: "text", x: 1, y: 1, data: {} }
        ],
        edges: []
      })
    ).toThrow(/duplicated/i);
  });

  it("requires node ids", () => {
    expect(() =>
      validateCanvasData({
        nodes: [{ type: "prompt", x: 0, y: 0, data: {} }],
        edges: []
      })
    ).toThrow(/missing id/i);
  });

  it("rejects non-finite node coordinates", () => {
    expect(() =>
      validateCanvasData({
        nodes: [{ id: "a", type: "prompt", x: Number.POSITIVE_INFINITY, y: 0, data: {} }],
        edges: []
      })
    ).toThrow(/finite number/i);
  });

  it("rounds fractional node coordinates to integers", () => {
    const data = validateCanvasData({
      nodes: [{ id: "a", type: "prompt", x: 12.7, y: -3.4, data: {} }],
      edges: []
    });
    expect(data.nodes[0].x).toBe(13);
    expect(data.nodes[0].y).toBe(-3);
  });

  it("rejects edges missing sourceId or targetId", () => {
    expect(() =>
      validateCanvasData({
        nodes: [{ id: "a", type: "prompt", x: 0, y: 0, data: {} }],
        edges: [{ targetId: "a" }]
      })
    ).toThrow(/sourceId and targetId/i);
  });

  it("rejects more than 10000 nodes", () => {
    const nodes = Array.from({ length: 10001 }, (_, i) => ({ id: `n${i}`, type: "text", x: 0, y: 0, data: {} }));
    expect(() => validateCanvasData({ nodes, edges: [] })).toThrow(/cannot exceed 10000/i);
  });

  it("strips data: and blob: image references inside node data", () => {
    expect(() =>
      validateCanvasData({
        nodes: [{ id: "a", type: "image", x: 0, y: 0, data: { imageUrl: "blob:https://x/foo" } }],
        edges: []
      })
    ).toThrow(/embedded base64|embedded file/i);
  });
});

describe("roundtrip invariants", () => {
  function makeCanvas(nodeCount, edgeCount) {
    const nodes = [];
    for (let i = 0; i < nodeCount; i += 1) {
      nodes.push({
        id: `n${i}`,
        type: i === 0 ? "prompt" : i === nodeCount - 1 ? "output" : "text",
        x: i * 10,
        y: (i % 5) * 20,
        data: {
          title: `Title ${i}`,
          body: `Body for node ${i}`,
          meta: { index: i, tag: i % 2 === 0 ? "even" : "odd" }
        }
      });
    }
    const edges = [];
    for (let i = 0; i < edgeCount; i += 1) {
      edges.push({
        id: `e${i}`,
        sourceId: `n${i % nodeCount}`,
        targetId: `n${(i + 1) % nodeCount}`
      });
    }
    return {
      id: "can_invariants",
      title: "Invariants",
      description: "roundtrip invariants",
      visibility: "private",
      coverUrl: "",
      dataJson: {
        viewport: { x: 0, y: 0, scale: 1 },
        nodes,
        edges,
        selectedNodeId: `n${nodeCount - 1}`,
        selectedNodeIds: [`n${nodeCount - 1}`]
      }
    };
  }

  it("preserves node and edge counts across export → import", () => {
    const canvas = makeCanvas(50, 100);
    const exported = createCanvasExport(canvas);
    const imported = normalizeCanvasImport(exported);
    expect(imported.nodeCount).toBe(50);
    expect(imported.edgeCount).toBe(100);
    expect(imported.dataJson.nodes.length).toBe(50);
    expect(imported.dataJson.edges.length).toBe(100);
  });

  it("preserves node coordinates and nested data through export → import", () => {
    const canvas = makeCanvas(10, 9);
    const exported = createCanvasExport(canvas);
    const imported = normalizeCanvasImport(exported);
    for (let i = 0; i < 10; i += 1) {
      const node = imported.dataJson.nodes.find((n) => n.id === `n${i}`);
      expect(node).toBeTruthy();
      expect(node.x).toBe(i * 10);
      expect(node.data.title).toBe(`Title ${i}`);
      expect(node.data.meta.index).toBe(i);
    }
  });

  it("is idempotent: a second roundtrip yields the same dataJson", () => {
    const canvas = makeCanvas(20, 25);
    const first = normalizeCanvasImport(createCanvasExport(canvas));
    const second = normalizeCanvasImport(createCanvasExport({ ...canvas, dataJson: first.dataJson }));
    expect(second.dataJson.nodes).toEqual(first.dataJson.nodes);
    expect(second.dataJson.edges).toEqual(first.dataJson.edges);
    expect(second.nodeCount).toBe(first.nodeCount);
    expect(second.edgeCount).toBe(first.edgeCount);
  });

  it("clears selection that points at nodes removed during import", () => {
    const canvas = makeCanvas(3, 2);
    canvas.dataJson.selectedNodeId = "ghost";
    canvas.dataJson.selectedNodeIds = ["ghost", "n0"];
    const imported = normalizeCanvasImport(createCanvasExport(canvas));
    expect(imported.dataJson.selectedNodeId).not.toBe("ghost");
    expect(imported.dataJson.selectedNodeIds).toEqual(["n0"]);
  });

  it("rejects import of payloads with the wrong format identifier", () => {
    const canvas = makeCanvas(2, 1);
    const exported = createCanvasExport(canvas);
    exported.format = "ai-image-studio.canvas.v999";
    expect(() => normalizeCanvasImport(exported)).toThrow(/unsupported.*format/i);
  });
});
