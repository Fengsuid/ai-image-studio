import { createShellState, renderShell } from "./shell.8497ebe3f34c.js";
import { apiFetch } from "../adapters/ai-image-studio-api.d0a45d04e521.js";

export function createCanvasV2App(root) {
  const state = createShellState();
  root.replaceChildren(renderShell(state));
  void bootCanvasV2(root, state);
}

async function bootCanvasV2(root, state) {
  try {
    const health = await apiFetch("/api/health");
    const auth = await apiFetch("/api/auth/me");
    const nextState = {
      ...state,
      status: auth?.user ? "ready" : "signed-out",
      health,
      user: auth?.user ?? null,
      csrfReady: Boolean(auth?.csrfToken),
    };
    root.replaceChildren(renderShell(nextState));
  } catch (error) {
    root.replaceChildren(renderShell({
      ...state,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    }));
  }
}
