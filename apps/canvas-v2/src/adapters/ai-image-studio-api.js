// SPDX-License-Identifier: AGPL-3.0-or-later
export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function readCsrfCookie(cookieSource = document.cookie) {
  return cookieSource
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrf="))
    ?.slice("csrf=".length) ?? "";
}

export async function apiFetch(path, options = {}) {
  if (!path.startsWith("/api/")) {
    throw new Error("Canvas v2 API calls must target ai-image-studio /api routes.");
  }

  const method = options.method?.toUpperCase() ?? "GET";
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readCsrfCookie();
    if (csrf) {
      headers.set("X-CSRF-Token", csrf);
    }
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });

  const payload = options.parseJson === false ? null : await parseJsonResponse(response);

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Canvas v2 API request failed with HTTP ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export async function getHealth() {
  return apiFetch("/api/health");
}

export async function getCurrentAuth() {
  return apiFetch("/api/auth/me");
}

export async function listCanvasProjects({ limit = 50, scope = "mine" } = {}) {
  return apiFetch(`/api/canvases?scope=${encodeURIComponent(scope)}&limit=${encodeURIComponent(String(limit))}`);
}

export async function createCanvasProject(payload) {
  return apiFetch("/api/canvases", jsonRequest("POST", payload));
}

export async function getCanvasProject(canvasId) {
  return apiFetch(`/api/canvases/${encodeURIComponent(canvasId)}`);
}

export async function updateCanvasProject(canvasId, payload) {
  return apiFetch(`/api/canvases/${encodeURIComponent(canvasId)}`, jsonRequest("PATCH", payload));
}

export async function deleteCanvasProject(canvasId) {
  return apiFetch(`/api/canvases/${encodeURIComponent(canvasId)}`, jsonRequest("DELETE", {}));
}

export async function exportCanvasProject(canvasId) {
  return apiFetch(`/api/canvases/${encodeURIComponent(canvasId)}/export`);
}

export async function generateCanvasOutput(canvasId, payload) {
  return apiFetch(`/api/canvases/${encodeURIComponent(canvasId)}/generate`, jsonRequest("POST", {
    outputNodeId: payload?.outputNodeId || "",
    configNodeId: payload?.configNodeId || "",
  }));
}

function jsonRequest(method, payload) {
  return {
    method,
    body: JSON.stringify(payload ?? {}),
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError("Canvas v2 API returned invalid JSON.", response.status, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
