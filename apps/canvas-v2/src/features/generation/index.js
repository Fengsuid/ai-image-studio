export function createGenerationRequest(outputNodeId, configNodeId) {
  return configNodeId ? { outputNodeId, configNodeId } : { outputNodeId };
}
