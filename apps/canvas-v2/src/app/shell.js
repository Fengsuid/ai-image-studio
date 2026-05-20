import { createEmptyCanvasDocument } from "../adapters/canvas-schema.js";

export function createShellState() {
  return {
    status: "booting",
    document: createEmptyCanvasDocument("Untitled canvas"),
  };
}

export function renderShell(state) {
  const shell = document.createElement("main");
  shell.className = "canvas-v2-shell";
  shell.dataset.status = state.status;

  const title = document.createElement("h1");
  title.textContent = "Canvas v2";

  const summary = document.createElement("p");
  summary.textContent =
    "Canvas v2 is isolated from the legacy canvas and will use ai-image-studio backend APIs for login, persistence, generation, and publishing.";

  const canvasLabel = document.createElement("p");
  canvasLabel.textContent = `Draft schema: ${state.document.schema}`;

  shell.append(title, summary, canvasLabel);
  return shell;
}
