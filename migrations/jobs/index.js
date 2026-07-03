"use strict";

const { runOrphanImageCleanup } = require("./orphan-images-cleanup");
const { runSoftDeleteCleanup } = require("./soft-delete-cleanup");

async function runMaintenanceJobs({
  db,
  store,
  imageDirectories = [],
  now = new Date(),
  logger = console,
  dryRun = false
} = {}) {
  const results = {};
  if (store && typeof store.archiveOldAgentSessions === "function") {
    results.agentSessionArchive = await store.archiveOldAgentSessions({ before: archiveCutoff(now), limit: 500 });
  }
  results.softDeleteCleanup = await runSoftDeleteCleanup(db, { now });
  results.orphanImageCleanup = await runOrphanImageCleanup(db, {
    directories: imageDirectories,
    now,
    dryRun
  });
  logger?.log?.("[maintenance-jobs] completed", compactResults(results));
  return results;
}

function archiveCutoff(now) {
  return new Date(new Date(now).getTime() - 90 * 24 * 60 * 60 * 1000);
}

function compactResults(results = {}) {
  return {
    archivedSessions: Number(results.agentSessionArchive?.archivedCount || 0),
    softDeletedRows: Number(results.softDeleteCleanup?.totalDeletedRows || 0),
    orphanImagesDeleted: Number(results.orphanImageCleanup?.deletedFiles || 0),
    orphanImagesScanned: Number(results.orphanImageCleanup?.scannedFiles || 0)
  };
}

module.exports = {
  compactResults,
  runMaintenanceJobs
};
