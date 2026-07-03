// SPDX-License-Identifier: AGPL-3.0-or-later
import { readCsrfCookie } from "./ai-image-studio-api.b2be83dc8ed3.js";

export function getCsrfToken() {
  return readCsrfCookie();
}
