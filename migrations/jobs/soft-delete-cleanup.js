"use strict";

const DEFAULT_RETENTION_DAYS = 7;

async function runSoftDeleteCleanup(db, { olderThanDays = DEFAULT_RETENTION_DAYS, now = new Date() } = {}) {
  if (!db || typeof db.execute !== "function") {
    throw new Error("runSoftDeleteCleanup requires a database connection with execute()");
  }
  const cutoff = new Date(new Date(now).getTime() - normalizeDays(olderThanDays) * 24 * 60 * 60 * 1000);
  const results = {};
  results.stepOutputs = await affectedRows(db, `
    DELETE so
      FROM agent_step_outputs so
      INNER JOIN agent_steps st ON st.id = so.step_id
     WHERE st.deleted_at IS NOT NULL AND st.deleted_at < ?
  `, [cutoff]);
  results.steps = await affectedRows(db, "DELETE FROM agent_steps WHERE deleted_at IS NOT NULL AND deleted_at < ?", [cutoff]);
  results.messages = await affectedRows(db, "DELETE FROM agent_messages WHERE deleted_at IS NOT NULL AND deleted_at < ?", [cutoff]);
  results.sessionArchives = await affectedRows(db, "DELETE FROM agent_sessions_archive WHERE deleted_at IS NOT NULL AND deleted_at < ?", [cutoff]);
  results.sessions = await affectedRows(db, "DELETE FROM agent_sessions WHERE deleted_at IS NOT NULL AND deleted_at < ?", [cutoff]);
  return {
    cutoff,
    deletedRows: results,
    totalDeletedRows: Object.values(results).reduce((sum, value) => sum + value, 0)
  };
}

async function affectedRows(db, sql, params) {
  const [result] = await db.execute(sql, params);
  return Number(result?.affectedRows || 0);
}

function normalizeDays(value) {
  const days = Number(value);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
}

module.exports = {
  DEFAULT_RETENTION_DAYS,
  runSoftDeleteCleanup
};
