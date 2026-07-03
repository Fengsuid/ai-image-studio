"use strict";

const fs = require("fs/promises");
const path = require("path");

const DEFAULT_RETENTION_DAYS = 7;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

async function runOrphanImageCleanup(db, {
  directories = [],
  olderThanDays = DEFAULT_RETENTION_DAYS,
  now = new Date(),
  dryRun = false
} = {}) {
  if (!db || typeof db.execute !== "function") {
    throw new Error("runOrphanImageCleanup requires a database connection with execute()");
  }
  const roots = normalizeDirectories(directories);
  const cutoffMs = new Date(now).getTime() - normalizeDays(olderThanDays) * 24 * 60 * 60 * 1000;
  const referenced = await loadReferencedImageNames(db);
  const summary = {
    dryRun: Boolean(dryRun),
    scannedFiles: 0,
    deletedFiles: 0,
    skippedReferenced: 0,
    skippedYoung: 0,
    skippedNonImage: 0,
    missingDirectories: 0
  };

  for (const root of roots) {
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        summary.missingDirectories += 1;
        continue;
      }
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const absolutePath = path.join(root, entry.name);
      if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        summary.skippedNonImage += 1;
        continue;
      }
      summary.scannedFiles += 1;
      if (referenced.has(entry.name)) {
        summary.skippedReferenced += 1;
        continue;
      }
      const stat = await fs.stat(absolutePath);
      if (stat.mtimeMs >= cutoffMs) {
        summary.skippedYoung += 1;
        continue;
      }
      if (!dryRun) await fs.unlink(absolutePath);
      summary.deletedFiles += 1;
    }
  }
  return summary;
}

async function loadReferencedImageNames(db) {
  const referenced = new Set();
  const [generationRows] = await db.execute(
    "SELECT filename, source_filename FROM generations WHERE filename IS NOT NULL OR source_filename IS NOT NULL"
  );
  for (const row of generationRows || []) {
    addBasename(referenced, row.filename);
    addBasename(referenced, row.source_filename);
  }
  const [referenceRows] = await db.execute("SELECT stored_filename FROM reference_assets WHERE stored_filename IS NOT NULL");
  for (const row of referenceRows || []) addBasename(referenced, row.stored_filename);
  return referenced;
}

function addBasename(target, value) {
  const text = String(value || "").trim();
  if (text) target.add(path.basename(text));
}

function normalizeDirectories(directories) {
  return [...new Set((directories || []).map((dir) => path.resolve(String(dir || ""))).filter(Boolean))];
}

function normalizeDays(value) {
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
}

module.exports = {
  DEFAULT_RETENTION_DAYS,
  runOrphanImageCleanup
};
