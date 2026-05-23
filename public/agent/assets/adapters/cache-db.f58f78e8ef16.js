const SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 12;

export function agentSessionSnapshotKey(sessionId) {
  return sessionId ? `agent:${sessionId}:snapshot` : "";
}

export async function putAgentSessionSnapshot(session, { userId = "" } = {}) {
  const key = agentSessionSnapshotKey(session?.id || "");
  const cache = globalThis.ImageStudioCacheDb;
  if (!key || !cache?.putJsonSnapshot) return false;
  return cache.putJsonSnapshot(key, session, {
    userId,
    ttlMs: SNAPSHOT_TTL_MS,
    meta: { kind: "agent-session-readonly", sessionId: session.id }
  });
}

export async function getAgentSessionSnapshot(sessionId) {
  const key = agentSessionSnapshotKey(sessionId);
  const cache = globalThis.ImageStudioCacheDb;
  if (!key || !cache?.getJsonSnapshot) return null;
  const snapshot = await cache.getJsonSnapshot(key);
  return snapshot?.value || null;
}
