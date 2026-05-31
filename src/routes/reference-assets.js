"use strict";

const crypto = require("crypto");
const path = require("path");
const { promises: fs } = require("fs");

const EXTENSION_BY_MIME = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"]
]);

function normalizeAssetRole(value) {
  const role = String(value || "reference").trim();
  return ["reference", "source", "mask", "output"].includes(role) ? role : "reference";
}

function normalizeAssetVisibility(value) {
  const visibility = String(value || "private").trim();
  return ["private", "public"].includes(visibility) ? visibility : "private";
}

function serializeReferenceAsset(asset = {}) {
  if (!asset?.id) return null;
  const url = `/api/reference-assets/${encodeURIComponent(asset.id)}/file`;
  return {
    id: asset.id,
    role: asset.role || "reference",
    filename: asset.filename || "reference-image",
    url,
    thumbUrl: `${url}?variant=thumb`,
    mimeType: asset.mimeType || "",
    fileSize: Number(asset.fileSize || 0),
    width: asset.width ?? null,
    height: asset.height ?? null,
    sha256: asset.sha256 || "",
    visibility: asset.visibility || "private",
    publicVisible: Boolean(asset.publicVisible || asset.visibility === "public"),
    sortOrder: Number(asset.sortOrder || 0),
    generationId: asset.generationId || "",
    createdAt: asset.createdAt || null,
    updatedAt: asset.updatedAt || null
  };
}

function createReferenceAssetsRoute({
  store,
  getCurrentUser,
  ensureAuthenticated,
  ensureActiveAuthenticated,
  withSecurityHeaders,
  mimeTypes,
  referenceAssetDir,
  httpError,
  sendJson,
  readJsonBody,
  sanitizePositiveInt,
  randomId,
  validateImageDataUrl
}) {
  async function createAssetForUser(user, input = {}) {
    const imageData = String(input.imageData || input.dataUrl || "").trim();
    if (!imageData) throw httpError("Please provide a reference image", 400);
    const validated = validateImageDataUrl(imageData);
    const extension = EXTENSION_BY_MIME.get(validated.mime) || "png";
    const id = randomId("asset_");
    const storedFilename = `${id}.${extension}`;
    await fs.mkdir(referenceAssetDir, { recursive: true });
    await fs.writeFile(path.join(referenceAssetDir, storedFilename), validated.buffer);
    const asset = await store.createReferenceAsset(user, {
      id,
      role: normalizeAssetRole(input.role),
      filename: String(input.filename || input.name || "reference-image").slice(0, 255),
      storedFilename,
      mimeType: validated.mime,
      fileSize: validated.buffer.length,
      width: null,
      height: null,
      sha256: crypto.createHash("sha256").update(validated.buffer).digest("hex"),
      visibility: normalizeAssetVisibility(input.visibility),
      status: "active"
    });
    return serializeReferenceAsset(asset);
  }

  async function sendAssetFile(req, res, url, asset) {
    const safeName = path.basename(String(asset.storedFilename || ""));
    if (!safeName) throw httpError("Reference asset file not found", 404);
    const bytes = await fs.readFile(path.join(referenceAssetDir, safeName)).catch((error) => {
      if (error?.code === "ENOENT") throw httpError("Reference asset file not found", 404);
      throw error;
    });
    const extension = path.extname(safeName).toLowerCase();
    const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "original";
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": asset.mimeType || mimeTypes.get(extension) || "application/octet-stream",
      "Cache-Control": asset.visibility === "public" || asset.publicVisible
        ? "public, max-age=86400"
        : "private, max-age=86400",
      "Content-Length": bytes.length,
      "X-Image-Variant": variant,
      "X-AI-Content-Source": "user-provided-reference-image",
      "Vary": "Accept"
    }));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(bytes);
  }

  return async function handleReferenceAssetsRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/reference-assets") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 60, 200);
      const role = url.searchParams.get("role") || "reference";
      const includeArchived = url.searchParams.get("includeArchived") === "1";
      const assets = await store.listReferenceAssetsForUser(current.user, { limit, role, includeArchived });
      sendJson(res, 200, { assets: assets.map(serializeReferenceAsset).filter(Boolean) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/reference-assets") {
      const current = await getCurrentUser(req);
      ensureActiveAuthenticated(current);
      const body = await readJsonBody(req);
      const asset = await createAssetForUser(current.user, body);
      sendJson(res, 201, { asset });
      return true;
    }

    const assetMatch = url.pathname.match(/^\/api\/reference-assets\/([^/]+)$/);
    if (assetMatch && req.method === "GET") {
      const asset = await store.getReferenceAssetById(assetMatch[1]);
      if (!asset) throw httpError("Reference asset not found", 404);
      const current = await getCurrentUser(req);
      if (!(await store.canReadReferenceAsset(asset, current?.user || {}))) {
        throw httpError("Reference asset not found", 404);
      }
      sendJson(res, 200, { asset: serializeReferenceAsset(asset) });
      return true;
    }

    if (assetMatch && req.method === "PATCH") {
      const current = await getCurrentUser(req);
      ensureActiveAuthenticated(current);
      const asset = await store.getReferenceAssetById(assetMatch[1]);
      if (!asset || (asset.userId !== current.user.id && current.user.role !== "admin")) {
        throw httpError("Reference asset not found", 404);
      }
      const body = await readJsonBody(req);
      if (!Object.hasOwn(body || {}, "visibility")) {
        throw httpError("Please provide a visibility value", 400);
      }
      const updated = await store.updateReferenceAssetVisibility(asset.id, normalizeAssetVisibility(body.visibility));
      sendJson(res, 200, { asset: serializeReferenceAsset(updated) });
      return true;
    }

    if (assetMatch && req.method === "DELETE") {
      const current = await getCurrentUser(req);
      ensureActiveAuthenticated(current);
      const deleted = await store.deleteReferenceAsset(assetMatch[1], current.user);
      if (!deleted) throw httpError("Reference asset not found", 404);
      sendJson(res, 200, { asset: serializeReferenceAsset(deleted) });
      return true;
    }

    const fileMatch = url.pathname.match(/^\/api\/reference-assets\/([^/]+)\/file$/);
    if (fileMatch && (req.method === "GET" || req.method === "HEAD")) {
      const asset = await store.getReferenceAssetById(fileMatch[1]);
      if (!asset) throw httpError("Reference asset not found", 404);
      const current = await getCurrentUser(req);
      if (!(await store.canReadReferenceAsset(asset, current?.user || {}))) {
        throw httpError("Reference asset not found", 404);
      }
      await sendAssetFile(req, res, url, asset);
      return true;
    }

    return false;
  };
}

module.exports = {
  createReferenceAssetsRoute,
  serializeReferenceAsset
};
