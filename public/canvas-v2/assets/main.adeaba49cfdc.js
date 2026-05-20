import { createCanvasV2App } from "./app/create-app.5419f8f296eb.js";

const root = document.querySelector("[data-canvas-v2-root]");

if (root instanceof HTMLElement) {
  createCanvasV2App(root);
}
