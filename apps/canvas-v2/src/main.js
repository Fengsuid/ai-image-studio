import { createCanvasV2App } from "./app/create-app.js";

const root = document.querySelector("[data-canvas-v2-root]");

if (root instanceof HTMLElement) {
  createCanvasV2App(root);
}
