import { createAgentWorkspaceApp } from "./app/create-app.2b6330c046e8.js";

const root = document.querySelector("[data-agent-workspace-root]");

if (root instanceof HTMLElement) {
  createAgentWorkspaceApp(root);
}
