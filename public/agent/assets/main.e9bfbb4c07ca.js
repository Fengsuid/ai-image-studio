import { createAgentWorkspaceApp } from "./app/create-app.68efc0dfc5f3.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
