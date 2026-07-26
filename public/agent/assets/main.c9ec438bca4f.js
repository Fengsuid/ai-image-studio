import { createAgentWorkspaceApp } from "./app/create-app.3d6ddea11ca5.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
