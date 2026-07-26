import { createAgentWorkspaceApp } from "./app/create-app.1660c60bb217.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
