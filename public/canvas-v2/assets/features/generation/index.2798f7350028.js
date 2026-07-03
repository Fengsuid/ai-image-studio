// SPDX-License-Identifier: AGPL-3.0-or-later
export function createGenerationRequest(outputNodeId, configNodeId) {
  return configNodeId ? { outputNodeId, configNodeId } : { outputNodeId };
}
