import { createShellState, renderShell } from "./shell.js";

export function createCanvasV2App(root) {
  const state = createShellState();
  root.replaceChildren(renderShell(state));
}
