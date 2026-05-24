import { createCanvasV2App } from "./app/create-app.0b13412f8199.js";

const root = document.querySelector("[data-canvas-v2-root]");

if (root instanceof HTMLElement) {
  createCanvasV2App(root);
}
