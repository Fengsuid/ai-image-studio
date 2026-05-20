import { readCsrfCookie } from "./ai-image-studio-api.js";

export function getCsrfToken() {
  return readCsrfCookie();
}
