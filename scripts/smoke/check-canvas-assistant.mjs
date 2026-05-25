#!/usr/bin/env node
// Module smoke for shared and browser canvas assistant helpers.

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import canvasAssistant from "../../packages/canvas-core/src/assistant.js";

const canvas = {
  id: "can_assistant_module",
  dataJson: {
    nodes: [
      { id: "node_prompt", type: "prompt", x: 0, y: 0, data: { title: "Prompt", prompt: "A glass teapot beside a rainy window" } },
      { id: "node_style", type: "text", x: 220, y: 80, data: { title: "Style", body: "soft morning light and muted greens" } },
      { id: "node_image", type: "image", x: 420, y: 100, data: { title: "Image", imageUrl: "data:image/png;base64,abc" } },
      { id: "node_output", type: "output", x: 640, y: 120, data: { title: "Output" } }
    ],
    edges: [
      { id: "edge_prompt_style", sourceId: "node_prompt", targetId: "node_style" },
      { id: "edge_style_image", sourceId: "node_style", targetId: "node_image" },
      { id: "edge_image_output", sourceId: "node_image", targetId: "node_output" }
    ],
    selectedNodeId: "node_output",
    selectedNodeIds: ["node_output"]
  }
};

const response = canvasAssistant.createAssistantResponse(canvas, { selectedNodeId: "node_output" }, { generatedAt: "2026-05-20T00:00:00.000Z" });
assert.equal(response.format, canvasAssistant.FORMAT);
assert.equal(response.canvasId, canvas.id);
assert.equal(response.context.selectedNodeId, "node_output");
assert(response.context.selectedNodeIds.includes("node_output"));
assert(response.context.upstreamNodes.some((node) => node.id === "node_prompt"));
assert(response.context.upstreamNodes.some((node) => node.id === "node_style"));
assert.equal(response.context.selectedNodes[0].id, "node_output");
assert.equal(response.context.mode, "image-to-image");
assert.equal(response.context.selectedNodes.length, 1);
assert(response.suggestions.some((item) => item.category === "rewrite" && item.type === "prompt"));
assert(response.suggestions.some((item) => item.category === "style" && item.type === "text"));
assert(response.suggestions.some((item) => item.category === "plan" && item.type === "text"));
assert(!JSON.stringify(response).includes("data:image/"));

const sandbox = {
  window: {
    ImageStudioCanvas: {}
  }
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(fs.readFileSync(new URL("../../public/canvas-assistant.js", import.meta.url), "utf8"), sandbox, {
  filename: "public/canvas-assistant.js"
});

const browserAssistant = sandbox.window.ImageStudioCanvas.assistant;
assert.equal(typeof browserAssistant.requestBodyFromState, "function");
assert.equal(typeof browserAssistant.insertSuggestion, "function");
assert.equal(
  JSON.stringify(browserAssistant.requestBodyFromState({ selectedNodeId: "node_output", selectedNodeIds: ["node_prompt", "node_output"] })),
  JSON.stringify({ selectedNodeId: "node_output", selectedNodeIds: ["node_prompt", "node_output"] })
);

const inserted = [];
const payload = browserAssistant.insertSuggestion(response.suggestions[0], (item) => inserted.push(item));
assert.equal(inserted.length, 1);
assert.equal(payload.kind, "prompt");
assert.match(payload.prompt, /glass teapot/i);

const textPayload = browserAssistant.createInsertPayload(response.suggestions.find((item) => item.type === "text"));
assert.equal(textPayload.kind, "text");
assert.match(textPayload.body, /Style direction|Generation plan/);

let requestedAfterFailedSave = false;
const controller = browserAssistant.createController({
  container: { dataset: {}, addEventListener() {}, innerHTML: "" },
  request: async () => {
    requestedAfterFailedSave = true;
    return {};
  },
  saveCanvas: async () => false,
  getContext: () => ({ projectId: "can_failed_save", selectedNodeId: "node_output", selectedNodeIds: ["node_output"] }),
  insertSuggestion: () => null
});
await controller.ask();
assert.equal(requestedAfterFailedSave, false, "assistant should not request stale context after save failure");
assert.match(controller.state().error, /Save failed/);

console.log("[canvas-assistant-smoke] OK");
