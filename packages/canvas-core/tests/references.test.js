// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from "vitest";
import { createService } from "../src/service.js";

function makeService() {
  return createService({
    store: { getGenerationById: async () => null },
    httpError: (message, status) => Object.assign(new Error(message), { status }),
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
    defaultModel: "GPT-IMAGE-2"
  });
}

describe("canvasImageReference", () => {
  const service = makeService();

  it("parses /api/images/:id/file URLs", () => {
    expect(service.canvasImageReference("/api/images/gen_abc/file")).toEqual({ id: "gen_abc", kind: "file" });
  });

  it("parses /api/images/:id/source-file URLs", () => {
    expect(service.canvasImageReference("/api/images/gen_xyz/source-file")).toEqual({ id: "gen_xyz", kind: "source-file" });
  });

  it("strips query strings and fragments before matching", () => {
    expect(service.canvasImageReference("/api/images/gen_q/file?variant=thumb")).toEqual({ id: "gen_q", kind: "file" });
    expect(service.canvasImageReference("/api/images/gen_h/file#anchor")).toEqual({ id: "gen_h", kind: "file" });
  });

  it("returns empty reference for non-matching URLs", () => {
    expect(service.canvasImageReference("https://cdn.example.com/foo.png")).toEqual({ id: "", kind: "" });
    expect(service.canvasImageReference("/api/prompt-images/abc.png")).toEqual({ id: "", kind: "" });
    expect(service.canvasImageReference("")).toEqual({ id: "", kind: "" });
    expect(service.canvasImageReference(null)).toEqual({ id: "", kind: "" });
  });
});

describe("isCanvasReferenceAlwaysPublic", () => {
  const service = makeService();

  it("treats empty values as public-safe", () => {
    expect(service.isCanvasReferenceAlwaysPublic("")).toBe(true);
    expect(service.isCanvasReferenceAlwaysPublic("   ")).toBe(true);
  });

  it("allows absolute http/https URLs", () => {
    expect(service.isCanvasReferenceAlwaysPublic("https://cdn.example.com/img.png")).toBe(true);
    expect(service.isCanvasReferenceAlwaysPublic("http://example.com/img.png")).toBe(true);
  });

  it("allows /api/prompt-images and /prompt-thumbs paths", () => {
    expect(service.isCanvasReferenceAlwaysPublic("/api/prompt-images/abc.png")).toBe(true);
    expect(service.isCanvasReferenceAlwaysPublic("/prompt-thumbs/abc.png")).toBe(true);
  });

  it("rejects gated /api/images/:id/file paths", () => {
    expect(service.isCanvasReferenceAlwaysPublic("/api/images/gen_abc/file")).toBe(false);
    expect(service.isCanvasReferenceAlwaysPublic("/api/images/gen_abc/source-file")).toBe(false);
  });

  it("rejects upload paths and bare ids that may require permission checks", () => {
    expect(service.isCanvasReferenceAlwaysPublic("/uploads/abc.png")).toBe(false);
    expect(service.isCanvasReferenceAlwaysPublic("gen_abc")).toBe(false);
    expect(service.isCanvasReferenceAlwaysPublic("img_abc")).toBe(false);
  });

  it("is case-insensitive for the https?:// and /api/prompt-images/ prefixes", () => {
    expect(service.isCanvasReferenceAlwaysPublic("HTTPS://cdn.example.com/x.png")).toBe(true);
    expect(service.isCanvasReferenceAlwaysPublic("/API/prompt-images/abc.png")).toBe(true);
  });

  it("treats unknown/relative paths as gated by default", () => {
    expect(service.isCanvasReferenceAlwaysPublic("../etc/passwd")).toBe(false);
    expect(service.isCanvasReferenceAlwaysPublic("javascript:alert(1)")).toBe(false);
  });
});

describe("canvasImageReference edge cases", () => {
  const service = makeService();

  it("returns empty kind for paths missing the file/source-file segment", () => {
    expect(service.canvasImageReference("/api/images/gen_abc")).toEqual({ id: "", kind: "" });
    expect(service.canvasImageReference("/api/images/gen_abc/thumbnail")).toEqual({ id: "", kind: "" });
  });

  it("coerces non-string inputs to empty references", () => {
    expect(service.canvasImageReference(undefined)).toEqual({ id: "", kind: "" });
    expect(service.canvasImageReference(123)).toEqual({ id: "", kind: "" });
    expect(service.canvasImageReference({})).toEqual({ id: "", kind: "" });
  });

  it("trims surrounding whitespace before matching", () => {
    expect(service.canvasImageReference("  /api/images/gen_ws/file  ")).toEqual({ id: "gen_ws", kind: "file" });
  });
});
