import { createAgentWorkspaceApp } from "./app/create-app.a4fdbad89959.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
