import { createAgentWorkspaceApp } from "./app/create-app.8b6f6eac7afa.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
