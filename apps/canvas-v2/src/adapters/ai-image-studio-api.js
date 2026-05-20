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
    throw new ApiError(`Canvas v2 API request failed with HTTP ${response.status}`, response.status, payload);
  }

  return payload;
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
