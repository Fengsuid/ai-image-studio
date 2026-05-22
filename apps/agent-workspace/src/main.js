import { createAgentWorkspaceApp } from "./app/create-app.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
