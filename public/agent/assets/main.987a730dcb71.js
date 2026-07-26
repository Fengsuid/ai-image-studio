import { createAgentWorkspaceApp } from "./app/create-app.e36ffdc19ac5.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
