import { createCanvasV2App } from "./app/create-app.ddf5b6ad8bc2.js";

const root = document.querySelector("[data-canvas-v2-root]");

if (root instanceof HTMLElement) {
  createCanvasV2App(root);
}
