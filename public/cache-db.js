(function initImageStudioCacheDb(global) {
  "use strict";

  const DB_NAME = "ai-image-studio-cache";
  const DB_VERSION = 1;
  const JSON_STORE = "jsonSnapshots";
  const IMAGE_STORE = "imageBlobs";
  const USER_INDEX_STORE = "userIndex";
  const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;
  const DEFAULT_MAX_BYTES = 36 * 1024 * 1024;
  const SENSITIVE_RE = /(api[_-]?key|authorization|bearer|token|cookie|password|secret|signature|providerUrl|ownerEmail|userEmail)/i;

  let dbPromise = null;
  let forcedUnavailable = false;

  function now() {
    return Date.now();
  }

  function unavailableReason() {
    if (forcedUnavailable) return "forced-unavailable";
    if (!global.indexedDB) return "indexeddb-unavailable";
    return "";
  }

  function openCacheDb() {
    const reason = unavailableReason();
    if (reason) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const request = global.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(JSON_STORE)) {
            const store = db.createObjectStore(JSON_STORE, { keyPath: "key" });
            store.createIndex("byUser", "userId", { unique: false });
            store.createIndex("byLastAccess", "lastAccessedAt", { unique: false });
            store.createIndex("byExpires", "expiresAt", { unique: false });
          }
          if (!db.objectStoreNames.contains(IMAGE_STORE)) {
            const store = db.createObjectStore(IMAGE_STORE, { keyPath: "key" });
            store.createIndex("byUser", "userId", { unique: false });
            store.createIndex("byLastAccess", "lastAccessedAt", { unique: false });
          }
          if (!db.objectStoreNames.contains(USER_INDEX_STORE)) {
            const store = db.createObjectStore(USER_INDEX_STORE, { keyPath: "id" });
            store.createIndex("byUser", "userId", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function withStore(storeName, mode, callback) {
    const db = await openCacheDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let settled = false;
        const done = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        tx.oncomplete = () => {
          if (!settled) resolve(null);
        };
        tx.onerror = () => done(null);
        tx.onabort = () => done(null);
        callback(store, done);
      } catch {
        resolve(null);
      }
    });
  }

  function requestValue(request, done, fallback = null) {
    request.onsuccess = () => done(request.result ?? fallback);
    request.onerror = () => done(fallback);
  }

  function cleanCacheKey(value, max = 240) {
    return String(value || "").trim().slice(0, max);
  }

  function currentUserId(explicitUserId = "") {
    const explicit = cleanCacheKey(explicitUserId, 64);
    if (explicit) return explicit;
    const user = global.ImageStudioCurrentUser || null;
    return cleanCacheKey(user?.id || user?.email || "anonymous", 64) || "anonymous";
  }

  function scrubForCache(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") {
      if (/^blob:/i.test(value)) return "";
      if (/^https?:\/\//i.test(value)) {
        try {
          const url = new URL(value);
          for (const key of [...url.searchParams.keys()]) {
            if (/(sig|signature|token|x-amz|expires|credential|policy)/i.test(key)) {
              url.searchParams.set(key, "[redacted]");
            }
          }
          return url.toString().slice(0, 600);
        } catch {
          return value.slice(0, 600);
        }
      }
      return value.slice(0, 4000);
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Date) return value.toISOString();
    if (depth > 6) return "[truncated]";
    if (Array.isArray(value)) return value.slice(0, 200).map((item) => scrubForCache(item, depth + 1));
    if (typeof value === "object") {
      const output = {};
      for (const [key, item] of Object.entries(value).slice(0, 80)) {
        if (SENSITIVE_RE.test(key)) continue;
        output[key] = scrubForCache(item, depth + 1);
      }
      return output;
    }
    return "";
  }

  function estimateBytes(value) {
    if (value instanceof Blob) return value.size || 0;
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return String(value || "").length;
    }
  }

  async function addUserIndex({ userId, storeName, key }) {
    const cleanUserId = currentUserId(userId);
    const cleanKey = cleanCacheKey(key);
    if (!cleanKey) return;
    await withStore(USER_INDEX_STORE, "readwrite", (store, done) => {
      const id = `${cleanUserId}:${storeName}:${cleanKey}`;
      store.put({ id, userId: cleanUserId, storeName, key: cleanKey, updatedAt: now() });
      done(true);
    });
  }

  async function putJsonSnapshot(key, value, options = {}) {
    const cleanKey = cleanCacheKey(key);
    if (!cleanKey) return false;
    const userId = currentUserId(options.userId);
    const ttlMs = Math.max(0, Number(options.ttlMs ?? options.ttl ?? DEFAULT_TTL_MS) || DEFAULT_TTL_MS);
    const safeValue = scrubForCache(value);
    const record = {
      key: cleanKey,
      userId,
      value: safeValue,
      meta: scrubForCache(options.meta || {}),
      bytes: estimateBytes(safeValue),
      createdAt: options.createdAt || now(),
      updatedAt: now(),
      lastAccessedAt: now(),
      expiresAt: ttlMs ? now() + ttlMs : 0
    };
    const ok = await withStore(JSON_STORE, "readwrite", (store, done) => {
      store.put(record);
      done(true);
    });
    if (ok) await addUserIndex({ userId, storeName: JSON_STORE, key: cleanKey });
    return Boolean(ok);
  }

  async function getJsonSnapshot(key) {
    const cleanKey = cleanCacheKey(key);
    if (!cleanKey) return null;
    const record = await withStore(JSON_STORE, "readwrite", (store, done) => {
      const request = store.get(cleanKey);
      request.onsuccess = () => {
        const item = request.result || null;
        if (!item) return done(null);
        if (item.expiresAt && item.expiresAt < now()) {
          store.delete(cleanKey);
          return done(null);
        }
        item.lastAccessedAt = now();
        store.put(item);
        done(item);
      };
      request.onerror = () => done(null);
    });
    return record ? { value: record.value, meta: record.meta || {}, updatedAt: record.updatedAt || 0 } : null;
  }

  async function putImageBlob(key, blob, meta = {}, options = {}) {
    const cleanKey = cleanCacheKey(key);
    if (!cleanKey || !(blob instanceof Blob)) return false;
    if (!/^image\//i.test(blob.type || "")) return false;
    const userId = currentUserId(options.userId || meta.userId);
    const safeMeta = scrubForCache(meta);
    if (String(safeMeta?.url || "").includes("/source-file")) delete safeMeta.url;
    const record = {
      key: cleanKey,
      userId,
      blob,
      meta: safeMeta,
      bytes: blob.size || 0,
      contentType: blob.type || "image/*",
      createdAt: now(),
      updatedAt: now(),
      lastAccessedAt: now()
    };
    const ok = await withStore(IMAGE_STORE, "readwrite", (store, done) => {
      store.put(record);
      done(true);
    });
    if (ok) await addUserIndex({ userId, storeName: IMAGE_STORE, key: cleanKey });
    if (ok) await pruneCache(options.maxBytes || DEFAULT_MAX_BYTES);
    return Boolean(ok);
  }

  async function getImageBlob(key) {
    const cleanKey = cleanCacheKey(key);
    if (!cleanKey) return null;
    return withStore(IMAGE_STORE, "readwrite", (store, done) => {
      const request = store.get(cleanKey);
      request.onsuccess = () => {
        const item = request.result || null;
        if (!item?.blob) return done(null);
        item.lastAccessedAt = now();
        store.put(item);
        done({ blob: item.blob, meta: item.meta || {}, updatedAt: item.updatedAt || 0 });
      };
      request.onerror = () => done(null);
    });
  }

  async function listStoreRecords(storeName) {
    return withStore(storeName, "readonly", (store, done) => {
      const request = store.getAll();
      requestValue(request, done, []);
    }) || [];
  }

  async function deleteStoreRecord(storeName, key) {
    return withStore(storeName, "readwrite", (store, done) => {
      store.delete(key);
      done(true);
    });
  }

  async function pruneCache(maxBytes = DEFAULT_MAX_BYTES) {
    const max = Math.max(1024 * 1024, Number(maxBytes) || DEFAULT_MAX_BYTES);
    const records = [
      ...(await listStoreRecords(JSON_STORE)).map((record) => ({ ...record, storeName: JSON_STORE })),
      ...(await listStoreRecords(IMAGE_STORE)).map((record) => ({ ...record, storeName: IMAGE_STORE }))
    ];
    let total = records.reduce((sum, record) => sum + Number(record.bytes || 0), 0);
    const expired = records.filter((record) => record.expiresAt && record.expiresAt < now());
    for (const record of expired) {
      await deleteStoreRecord(record.storeName, record.key);
      total -= Number(record.bytes || 0);
    }
    if (total <= max) return { totalBytes: Math.max(0, total), removed: expired.length };
    const sorted = records
      .filter((record) => !expired.includes(record))
      .sort((left, right) => Number(left.lastAccessedAt || 0) - Number(right.lastAccessedAt || 0));
    let removed = expired.length;
    for (const record of sorted) {
      if (total <= max) break;
      await deleteStoreRecord(record.storeName, record.key);
      total -= Number(record.bytes || 0);
      removed += 1;
    }
    return { totalBytes: Math.max(0, total), removed };
  }

  async function clearUserCache(userId = currentUserId()) {
    const cleanUserId = currentUserId(userId);
    const indexRecords = await withStore(USER_INDEX_STORE, "readonly", (store, done) => {
      const request = store.index("byUser").getAll(cleanUserId);
      requestValue(request, done, []);
    }) || [];
    for (const record of indexRecords) {
      await deleteStoreRecord(record.storeName, record.key);
      await deleteStoreRecord(USER_INDEX_STORE, record.id);
    }
    return indexRecords.length;
  }

  function generationIdFromUrl(url = "") {
    const match = String(url || "").match(/\/api\/images\/([^/]+)\/file(?:[?#].*)?$/);
    return match ? match[1] : "";
  }

  async function cacheImageElement(image, { key = "", userId = "", meta = {} } = {}) {
    if (!image?.currentSrc && !image?.src) return false;
    const src = image.currentSrc || image.src;
    return cacheImageUrl(src, { key, userId, meta });
  }

  async function cacheImageUrl(src, { key = "", userId = "", meta = {} } = {}) {
    if (!src || /^(data:|blob:)/i.test(src) || src.includes("/source-file")) return false;
    const cacheKey = key || `image:generation:${generationIdFromUrl(src)}:thumb`;
    if (!cacheKey.endsWith(":thumb") && !cacheKey.endsWith(":full")) return false;
    try {
      const response = await fetch(src, { credentials: "same-origin", cache: "force-cache" });
      if (!response.ok) return false;
      return putImageBlob(cacheKey, await response.blob(), { ...meta, src }, { userId });
    } catch {
      return false;
    }
  }

  async function preferCachedImage(image, key) {
    if (!image || !key) return false;
    const cached = await getImageBlob(key);
    if (!cached?.blob) return false;
    releaseImageObjectUrl(image);
    const url = URL.createObjectURL(cached.blob);
    image.dataset.cacheObjectUrl = url;
    image.src = url;
    return true;
  }

  function releaseImageObjectUrl(image) {
    const url = image?.dataset?.cacheObjectUrl || "";
    if (!url) return false;
    URL.revokeObjectURL(url);
    delete image.dataset.cacheObjectUrl;
    return true;
  }

  function releaseNodeObjectUrls(node) {
    if (!node?.querySelectorAll) return;
    if (node.matches?.("img[data-cache-object-url]")) releaseImageObjectUrl(node);
    node.querySelectorAll("img[data-cache-object-url]").forEach(releaseImageObjectUrl);
  }

  function installObjectUrlCleanup() {
    if (!global.MutationObserver || !global.document?.body) return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.removedNodes.forEach(releaseNodeObjectUrls);
      }
    });
    observer.observe(global.document.body, { childList: true, subtree: true });
    global.addEventListener?.("pagehide", () => releaseNodeObjectUrls(global.document.body));
  }

  function setAvailabilityForTests(value) {
    forcedUnavailable = value === false;
    if (forcedUnavailable) dbPromise = null;
  }

  global.ImageStudioCacheDb = {
    DB_NAME,
    JSON_STORE,
    IMAGE_STORE,
    USER_INDEX_STORE,
    openCacheDb,
    putJsonSnapshot,
    getJsonSnapshot,
    putImageBlob,
    getImageBlob,
    pruneCache,
    clearUserCache,
    scrubForCache,
    estimateBytes,
    generationIdFromUrl,
    cacheImageElement,
    cacheImageUrl,
    preferCachedImage,
    releaseImageObjectUrl,
    setAvailabilityForTests,
    unavailableReason
  };
  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", installObjectUrlCleanup, { once: true });
  } else {
    installObjectUrlCleanup();
  }
})(window);
