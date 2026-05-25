// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from "vitest";
import { createService } from "../src/service.js";

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function makeService(overrides = {}) {
  return createService({
    store: {
      getCanvasProjectById: async () => null,
      listCanvasProjectsForUser: async () => [],
      createCanvasProject: async (data) => data,
      updateCanvasProject: async (_id, patch) => patch,
      deleteCanvasProject: async (_id) => ({ id: _id, status: "deleted" }),
      getGenerationById: async () => null
    },
    httpError,
    randomId: () => "can_test",
    choose: (value, allowed, fallback) => (allowed.includes(value) ? value : fallback),
    cleanPrompt: (value) => String(value || ""),
    sanitizePositiveInt: (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    },
    normalizeImageSize: (value) => String(value || "1024x1024"),
    validateImageDataUrl: () => true,
    normalizeGenerationCost: (value) => Number(value) || 0,
    enforceGenerationRate: () => undefined,
    attachRequestAbortController: () => undefined,
    callOpenAIImages: async () => ({ images: [] }),
    callOpenAIImageEdits: async () => ({ images: [] }),
    saveGeneratedImages: async () => ({ generation: null }),
    getClientIp: () => "127.0.0.1",
    getUserAgent: () => "vitest",
    isPubliclyVisibleGeneration: () => true,
    defaultModel: "GPT-IMAGE-2",
    ...overrides
  });
}

describe("cleanCanvasProjectInput", () => {
  const service = makeService();

  it("requires a non-empty title on full payloads", () => {
    expect(() => service.cleanCanvasProjectInput({ title: "   " })).toThrow(/title is required/i);
  });

  it("trims and clips the title to 160 chars", () => {
    const long = "X".repeat(200);
    const cleaned = service.cleanCanvasProjectInput({ title: long });
    expect(cleaned.title.length).toBe(160);
  });

  it("falls back to private when visibility is unknown", () => {
    const cleaned = service.cleanCanvasProjectInput({ title: "Test", visibility: "weird" });
    expect(cleaned.visibility).toBe("private");
  });

  it("rejects array dataJson payloads", () => {
    expect(() => service.cleanCanvasProjectInput({ title: "Test", dataJson: [] })).toThrow(/object/i);
  });

  it("preserves partial patches without forcing required fields", () => {
    const cleaned = service.cleanCanvasProjectInput({ description: "patch" }, { partial: true });
    expect(cleaned).toEqual({ description: "patch" });
  });

  it("clamps oversized nodeCount/edgeCount to 10000", () => {
    const cleaned = service.cleanCanvasProjectInput({ title: "Test", nodeCount: 50000, edgeCount: 99999 });
    expect(cleaned.nodeCount).toBe(10000);
    expect(cleaned.edgeCount).toBe(10000);
  });

  it("rejects negative nodeCount/edgeCount", () => {
    expect(() => service.cleanCanvasProjectInput({ title: "Test", edgeCount: -1 })).toThrow(/non-negative/i);
    expect(() => service.cleanCanvasProjectInput({ title: "Test", nodeCount: -1 })).toThrow(/non-negative/i);
  });
});

describe("canReadCanvas / canManageCanvas", () => {
  const service = makeService();
  const owner = { id: "u1", role: "user" };
  const admin = { id: "u2", role: "admin" };
  const other = { id: "u3", role: "user" };
  const canvas = { id: "can_a", userId: "u1", visibility: "private" };
  const publicCanvas = { id: "can_b", userId: "u1", visibility: "public" };

  it("lets the owner read and manage their own canvas", () => {
    expect(service.canReadCanvas(owner, canvas)).toBe(true);
    expect(service.canManageCanvas(owner, canvas)).toBe(true);
  });

  it("lets admins read and manage any canvas", () => {
    expect(service.canReadCanvas(admin, canvas)).toBe(true);
    expect(service.canManageCanvas(admin, canvas)).toBe(true);
  });

  it("lets unrelated users read public canvases but not manage them", () => {
    expect(service.canReadCanvas(other, publicCanvas)).toBe(true);
    expect(service.canManageCanvas(other, publicCanvas)).toBe(false);
  });

  it("blocks unrelated users from private canvases", () => {
    expect(service.canReadCanvas(other, canvas)).toBe(false);
    expect(service.canManageCanvas(other, canvas)).toBe(false);
  });
});

describe("canvasGenerationPlan", () => {
  const service = makeService();
  const dataJson = {
    nodes: [
      { id: "p1", type: "prompt", x: 0, y: 0, data: { prompt: "a teapot" } },
      { id: "c1", type: "config", x: 100, y: 0, data: { model: "GPT-IMAGE-2", size: "1024x1024", quality: "high", candidateCount: 2 } },
      { id: "o1", type: "output", x: 200, y: 0, data: {} }
    ],
    edges: [
      { sourceId: "p1", targetId: "c1" },
      { sourceId: "c1", targetId: "o1" }
    ]
  };

  it("builds a generation plan from the upstream prompt node", () => {
    const plan = service.canvasGenerationPlan(dataJson, { outputNodeId: "o1" });
    expect(plan.prompt).toContain("teapot");
    expect(plan.size).toBe("1024x1024");
    expect(plan.quality).toBe("high");
  });
});
