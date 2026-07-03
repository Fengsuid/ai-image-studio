// SPDX-License-Identifier: AGPL-3.0-or-later
import { createCanvasV2App } from "./app/create-app.983f9d572319.js";

const root = document.querySelector("[data-canvas-v2-root]");

if (root instanceof HTMLElement) {
  createCanvasV2App(root);
}
