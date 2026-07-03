// SPDX-License-Identifier: AGPL-3.0-or-later
const DB_NAME = "ai-image-studio-canvas-v2";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const FALLBACK_PREFIX = "canvas-v2:draft:";
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export async function saveCanvasDraft(projectId, document, meta = {}) {
  const id = String(projectId || "").trim();
  if (!id || !document) return false;
  const draft = {
    id,
    document,
    savedAt: new Date().toISOString(),
    serverUpdatedAt: String(meta.serverUpdatedAt || ""),
    userId: String(meta.userId || ""),
    title: String(document.title || ""),
    nodeCount: Array.isArray(document.nodes) ? document.nodes.length : 0,
    edgeCount: Array.isArray(document.edges) ? document.edges.length : 0,
  };
  const db = await openDraftDb();
  if (db && await transact(db, "readwrite", (store) => store.put(draft))) return true;
  return writeLocalStorage(id, draft);
}

export async function readCanvasDraft(projectId) {
  const id = String(projectId || "").trim();
  if (!id) return null;
  const db = await openDraftDb();
  const draft = db ? await transact(db, "readonly", (store) => store.get(id)) : null;
  const fallback = draft || readLocalStorage(id);
  if (!fallback || isExpired(fallback.savedAt)) {
    await deleteCanvasDraft(id);
    return null;
  }
  return fallback;
}

export async function deleteCanvasDraft(projectId) {
  const id = String(projectId || "").trim();
  if (!id) return false;
  const db = await openDraftDb();
  const indexed = db ? await transact(db, "readwrite", (store) => store.delete(id)) : false;
  return deleteLocalStorage(id) || Boolean(indexed);
}

function openDraftDb() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function transact(db, mode, run) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    request.onsuccess = () => resolve(request.result ?? true);
    request.onerror = () => resolve(null);
    tx.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

function isExpired(savedAt) {
  const time = Date.parse(savedAt || "");
  return Number.isFinite(time) && Date.now() - time > DRAFT_TTL_MS;
}

function fallbackKey(id) {
  return `${FALLBACK_PREFIX}${id}`;
}

function writeLocalStorage(id, draft) {
  try {
    localStorage?.setItem(fallbackKey(id), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function readLocalStorage(id) {
  try {
    const raw = localStorage?.getItem(fallbackKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function deleteLocalStorage(id) {
  try {
    localStorage?.removeItem(fallbackKey(id));
    return true;
  } catch {
    return false;
  }
}
