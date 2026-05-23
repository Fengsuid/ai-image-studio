"use strict";

function createUserStore({ getPool, mapUser }) {
  async function createSession(tokenHash, userId, expiresAt) {
    await getPool().execute(
      "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      [tokenHash, userId, expiresAt, new Date()]
    );
  }

  async function deleteSession(tokenHash) {
    if (!tokenHash) return;
    await getPool().execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
  }

  async function touchSession(tokenHash, expiresAt) {
    await getPool().execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", [expiresAt, tokenHash]);
  }

  async function getSessionUser(tokenHash) {
    const [rows] = await getPool().execute(
      `SELECT u.*
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
        LIMIT 1`,
      [tokenHash, new Date()]
    );
    return mapUser(rows[0]);
  }

  async function deleteExpiredSessions() {
    await getPool().execute("DELETE FROM sessions WHERE expires_at <= ?", [new Date()]);
  }

  return {
    createSession,
    deleteSession,
    touchSession,
    getSessionUser,
    deleteExpiredSessions
  };
}

module.exports = createUserStore;
