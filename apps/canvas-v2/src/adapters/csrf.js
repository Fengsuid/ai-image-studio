// SPDX-License-Identifier: AGPL-3.0-or-later
import { readCsrfCookie } from "./ai-image-studio-api.js";

export function getCsrfToken() {
  return readCsrfCookie();
}
