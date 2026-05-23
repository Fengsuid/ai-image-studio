"use strict";

const path = require("path");
const { promises: fs } = require("fs");

// Owns image file delivery routes:
// GET/HEAD /api/images/:id/file and GET/HEAD /api/images/:id/source-file.
function createImagesRoute({
  store,
  sendError,
  withSecurityHeaders,
  mimeTypes,
  getCurrentUser,
  ensureAuthenticated,
  canTouchGeneration,
  isPubliclyVisibleGeneration,
  generatedDir,
  sourceDir,
  httpError
}) {
  async function sendImageFile(req, res, url, { generation, filename, directory, contentSource }) {
    const absolutePath = path.join(directory, filename);
    const extension = path.extname(filename).toLowerCase();
    const bytes = await fs.readFile(absolutePath).catch((error) => {
      if (error?.code === "ENOENT") throw httpError("Image file not found", 404);
      throw error;
    });
    const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "original";
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": bytes.length,
      "X-Image-Variant": variant,
      "X-AI-Content-Source": contentSource,
      "X-Privacy-Download": url.searchParams.get("privacy") === "1" ? "metadata-minimized" : "standard",
      "Vary": "Accept"
    }));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(bytes);
  }

  return async function handleImagesRoute(req, res, url) {
    const sourceMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/source-file$/);
    if (sourceMatch && (req.method === "GET" || req.method === "HEAD")) {
      const current = await getCurrentUser(req);
      const generation = await store.getGenerationById(sourceMatch[1]);
      if (!generation?.sourceFilename) {
        throw httpError("Image not found", 404);
      }
      if (!isPubliclyVisibleGeneration(generation) || !generation.publishOriginal) {
        ensureAuthenticated(current);
        if (!canTouchGeneration(current.user, generation)) {
          throw httpError("Image not found", 404);
        }
      }
      await sendImageFile(req, res, url, {
        generation,
        filename: generation.sourceFilename,
        directory: sourceDir,
        contentSource: "user-provided-source-image"
      });
      return true;
    }

    const fileMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/file$/);
    if (fileMatch && (req.method === "GET" || req.method === "HEAD")) {
      const current = await getCurrentUser(req);
      const generation = await store.getGenerationById(fileMatch[1]);
      if (!generation) {
        throw httpError("Image not found", 404);
      }
      if (!isPubliclyVisibleGeneration(generation)) {
        ensureAuthenticated(current);
        if (!canTouchGeneration(current.user, generation)) {
          throw httpError("Image not found", 404);
        }
      }
      await sendImageFile(req, res, url, {
        generation,
        filename: generation.filename,
        directory: generatedDir,
        contentSource: "ai-generated"
      });
      return true;
    }

    return false;
  };
}

module.exports = { createImagesRoute };
