import { createCanvasV2App } from "./app/create-app.6253cb085610.js";

const root = document.querySelector("[data-canvas-v2-root]");

if (root instanceof HTMLElement) {
  createCanvasV2App(root);
}
