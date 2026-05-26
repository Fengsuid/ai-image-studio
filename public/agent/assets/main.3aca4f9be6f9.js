import { createAgentWorkspaceApp } from "./app/create-app.76ad1e19453c.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
