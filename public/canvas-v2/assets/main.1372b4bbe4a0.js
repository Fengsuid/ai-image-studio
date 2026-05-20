import { createCanvasV2App } from "./app/create-app.098ed6a91f6b.js";

const root = document.querySelector("[data-canvas-v2-root]");

if (root instanceof HTMLElement) {
  createCanvasV2App(root);
}
