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
});
