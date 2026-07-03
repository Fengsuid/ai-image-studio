const crypto = require("crypto");

const AGENT_STEP_OUTPUT_SPLIT_LANDED_AT = Date.parse("2026-07-02T00:00:00.000Z");
const AGENT_STEP_OUTPUT_READ_SWITCH_AT = AGENT_STEP_OUTPUT_SPLIT_LANDED_AT + 7 * 24 * 60 * 60 * 1000;
const AGENT_SESSION_ARCHIVE_AFTER_DAYS = 90;

function createAgentSessionStore({ getPool, toIso, safeJsonSummary }) {
  const summarizeJson = typeof safeJsonSummary === "function" ? safeJsonSummary : (value) => value;

  function bufferToString(value) {
    if (!value) return "";
    if (Buffer.isBuffer(value)) return value.toString("utf8");
    if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
    return String(value || "");
  }

  function parseJson(value, fallback) {
    const text = bufferToString(value);
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function jsonForStorage(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    return JSON.stringify(summarizeJson(value));
  }

  function stepOutputTextForRow(row = {}) {
    const legacy = bufferToString(row.output_json);
    const split = bufferToString(row.output_blob);
    if (Date.now() >= AGENT_STEP_OUTPUT_READ_SWITCH_AT) return split || legacy;
    return legacy || split;
  }

  function outputChecksum(text) {
    return crypto.createHash("sha256").update(String(text || "")).digest("hex");
  }

  function mapAgentSession(row) {
    if (!row) return null;
    return {
      id: row.id || "",
      userId: row.user_id || "",
      title: row.title || "",
      sourceType: row.source_type || "agent",
      sourceId: row.source_id || "",
      status: row.status || "active",
      summary: row.summary || "",
      data: parseJson(row.data_json, {}),
      messageCount: Number(row.message_count || 0),
      stepCount: Number(row.step_count || 0),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      deletedAt: toIso(row.deleted_at)
    };
  }

  function mapAgentMessage(row) {
    if (!row) return null;
    return {
      id: row.id || "",
      sessionId: row.session_id || "",
      userId: row.user_id || "",
      role: row.role || "user",
      content: row.content || "",
      attachments: parseJson(row.attachments_json, []),
      createdAt: toIso(row.created_at),
      deletedAt: toIso(row.deleted_at)
    };
  }

  function mapAgentStep(row) {
    if (!row) return null;
    return {
      id: row.id || "",
      sessionId: row.session_id || "",
      messageId: row.message_id || "",
      stepNo: Number(row.step_no || 0),
      kind: row.kind || "",
      status: row.status || "pending",
      input: parseJson(row.input_json, null),
      output: parseJson(stepOutputTextForRow(row), null),
      requestId: row.request_id || "",
      generationId: row.generation_id || "",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      deletedAt: toIso(row.deleted_at)
    };
  }

  async function listAgentSessionsForUser(userId, { limit = 50, status = "" } = {}) {
    const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const filters = ["s.user_id = ?", "s.status <> 'deleted'", "s.deleted_at IS NULL"];
    const params = [userId];
    if (["active", "archived"].includes(status)) {
      filters.push("s.status = ?");
      params.push(status);
    }
    const [rows] = await getPool().execute(
      `SELECT s.*,
              (SELECT COUNT(*) FROM agent_messages m WHERE m.session_id = s.id AND m.deleted_at IS NULL) AS message_count,
              (SELECT COUNT(*) FROM agent_steps st WHERE st.session_id = s.id AND st.deleted_at IS NULL) AS step_count
         FROM agent_sessions s
        WHERE ${filters.join(" AND ")}
        ORDER BY s.updated_at DESC, s.created_at DESC
        LIMIT ${normalizedLimit}`,
      params
    );
    return rows.map(mapAgentSession);
  }

  async function getAgentSessionForUser(id, userId, { includeChildren = true } = {}) {
    const [rows] = await getPool().execute(
      `SELECT s.*,
              (SELECT COUNT(*) FROM agent_messages m WHERE m.session_id = s.id AND m.deleted_at IS NULL) AS message_count,
              (SELECT COUNT(*) FROM agent_steps st WHERE st.session_id = s.id AND st.deleted_at IS NULL) AS step_count
         FROM agent_sessions s
        WHERE s.id = ? AND s.user_id = ? AND s.status <> 'deleted' AND s.deleted_at IS NULL
        LIMIT 1`,
      [id, userId]
    );
    const session = mapAgentSession(rows[0]);
    if (!session || !includeChildren) return session;
    const [messageRows] = await getPool().execute(
      `SELECT *
         FROM agent_messages
        WHERE session_id = ? AND user_id = ? AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
      [id, userId]
    );
    const [stepRows] = await getPool().execute(
      `SELECT st.*, so.output_blob
         FROM agent_steps st
         LEFT JOIN agent_step_outputs so ON so.step_id = st.id
        WHERE st.session_id = ? AND st.deleted_at IS NULL
        ORDER BY st.step_no ASC, st.created_at ASC, st.id ASC`,
      [id]
    );
    return {
      ...session,
      messages: messageRows.map(mapAgentMessage),
      steps: stepRows.map(mapAgentStep)
    };
  }

  async function createAgentSession(input = {}) {
    const now = new Date();
    await getPool().execute(
      `INSERT INTO agent_sessions
        (id, user_id, title, source_type, source_id, status, summary, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.title,
        input.sourceType || "agent",
        input.sourceId || null,
        input.status || "active",
        input.summary || null,
        jsonForStorage(input.data, null),
        now,
        now
      ]
    );
    return getAgentSessionForUser(input.id, input.userId);
  }

  async function updateAgentSessionForUser(id, userId, patch = {}) {
    const columns = [];
    const values = [];
    const mappings = {
      title: "title",
      sourceType: "source_type",
      sourceId: "source_id",
      status: "status",
      summary: "summary"
    };
    for (const [key, column] of Object.entries(mappings)) {
      if (Object.hasOwn(patch, key)) {
        columns.push(`${column} = ?`);
        values.push(patch[key] || null);
      }
    }
    if (Object.hasOwn(patch, "data")) {
      columns.push("data_json = ?");
      values.push(jsonForStorage(patch.data, null));
    }
    if (!columns.length) return getAgentSessionForUser(id, userId);
    columns.push("updated_at = ?");
    values.push(new Date(), id, userId);
    const [result] = await getPool().execute(
      `UPDATE agent_sessions
          SET ${columns.join(", ")}
        WHERE id = ? AND user_id = ? AND status = 'active' AND deleted_at IS NULL`,
      values
    );
    if (!result.affectedRows) return null;
    return getAgentSessionForUser(id, userId);
  }

  async function deleteAgentSessionForUser(id, userId) {
    const connection = await getPool().getConnection();
    const now = new Date();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `UPDATE agent_sessions
            SET status = 'deleted', deleted_at = ?, updated_at = ?
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [now, now, id, userId]
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return false;
      }
      await connection.execute(
        "UPDATE agent_messages SET deleted_at = ? WHERE session_id = ? AND user_id = ? AND deleted_at IS NULL",
        [now, id, userId]
      );
      await connection.execute(
        "UPDATE agent_steps SET deleted_at = ? WHERE session_id = ? AND deleted_at IS NULL",
        [now, id]
      );
      await connection.execute(
        "UPDATE agent_sessions_archive SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
        [now, id]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function createAgentMessageForUser(sessionId, userId, input = {}) {
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [sessionRows] = await connection.execute(
        "SELECT id FROM agent_sessions WHERE id = ? AND user_id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1",
        [sessionId, userId]
      );
      if (!sessionRows.length) {
        await connection.rollback();
        return null;
      }

      const now = new Date();
      await connection.execute(
        `INSERT INTO agent_messages
          (id, session_id, user_id, role, content, attachments_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          sessionId,
          userId,
          input.role || "user",
          input.content || "",
          jsonForStorage(input.attachments, null),
          now
        ]
      );

      const [stepNoRows] = await connection.execute(
        "SELECT COALESCE(MAX(step_no), 0) AS max_step_no FROM agent_steps WHERE session_id = ? AND deleted_at IS NULL",
        [sessionId]
      );
      const baseStepNo = Number(stepNoRows?.[0]?.max_step_no || 0);
      for (const [index, step] of (input.steps || []).entries()) {
        const stepCreatedAt = new Date(now.getTime() + index);
        const outputText = jsonForStorage(step.output, null);
        await connection.execute(
          `INSERT INTO agent_steps
            (id, session_id, message_id, step_no, kind, status, input_json, output_json, request_id, generation_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            step.id,
            sessionId,
            input.id,
            baseStepNo + index + 1,
            step.kind,
            step.status || "pending",
            jsonForStorage(step.input, null),
            outputText,
            step.requestId || null,
            step.generationId || null,
            stepCreatedAt,
            stepCreatedAt
          ]
        );
        await upsertAgentStepOutput(connection, step.id, outputText, stepCreatedAt);
      }

      await connection.execute(
        "UPDATE agent_sessions SET updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active' AND deleted_at IS NULL",
        [now, sessionId, userId]
      );
      await connection.commit();
      return getAgentSessionForUser(sessionId, userId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function updateAgentStepForUser(stepId, userId, patch = {}) {
    const columns = [];
    const values = [];
    const mappings = {
      status: "status",
      requestId: "request_id",
      generationId: "generation_id"
    };
    for (const [key, column] of Object.entries(mappings)) {
      if (Object.hasOwn(patch, key)) {
        columns.push(`st.${column} = ?`);
        values.push(patch[key] || null);
      }
    }
    if (Object.hasOwn(patch, "input")) {
      columns.push("st.input_json = ?");
      values.push(jsonForStorage(patch.input, null));
    }
    const hasOutputPatch = Object.hasOwn(patch, "output");
    const outputText = hasOutputPatch ? jsonForStorage(patch.output, null) : null;
    if (hasOutputPatch) {
      columns.push("st.output_json = ?");
      values.push(outputText);
    }
    if (!columns.length) return false;
    const now = new Date();
    columns.push("st.updated_at = ?");
    values.push(now, stepId, userId);

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `UPDATE agent_steps st
          INNER JOIN agent_sessions s ON s.id = st.session_id
             SET ${columns.join(", ")}
           WHERE st.id = ?
             AND st.deleted_at IS NULL
             AND s.user_id = ?
             AND s.status = 'active'
             AND s.deleted_at IS NULL`,
        values
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return false;
      }
      if (hasOutputPatch) await upsertAgentStepOutput(connection, stepId, outputText, now);
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function archiveOldAgentSessions({ before, limit = 500 } = {}) {
    const cutoff = normalizeArchiveCutoff(before);
    const normalizedLimit = Math.max(1, Math.min(5000, Number(limit) || 500));
    const archivedAt = new Date();
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT *
           FROM agent_sessions
          WHERE updated_at < ?
            AND deleted_at IS NULL
            AND status NOT IN ('deleted', 'archived')
          ORDER BY updated_at ASC, created_at ASC
          LIMIT ${normalizedLimit}
          FOR UPDATE`,
        [cutoff]
      );
      for (const row of rows) {
        await connection.execute(
          `INSERT INTO agent_sessions_archive
            (id, user_id, title, source_type, source_id, status, summary, data_json, created_at, updated_at, deleted_at, archived_at)
           VALUES (?, ?, ?, ?, ?, 'archived', ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE archived_at = archived_at`,
          [
            row.id,
            row.user_id,
            row.title,
            row.source_type || "agent",
            row.source_id || null,
            row.summary || null,
            row.data_json || null,
            row.created_at,
            row.updated_at,
            row.deleted_at || null,
            archivedAt
          ]
        );
        await connection.execute(
          "UPDATE agent_sessions SET status = 'archived' WHERE id = ? AND deleted_at IS NULL",
          [row.id]
        );
      }
      await connection.commit();
      return {
        archivedCount: rows.length,
        archivedIds: rows.map((row) => row.id),
        cutoff: toIso(cutoff)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function upsertAgentStepOutput(db, stepId, outputText, now) {
    if (outputText === null || outputText === undefined) {
      await db.execute("DELETE FROM agent_step_outputs WHERE step_id = ?", [String(stepId || "")]);
      return;
    }
    const text = String(outputText);
    await db.execute(
      `INSERT INTO agent_step_outputs
          (step_id, output_blob, checksum_sha256, byte_length, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
          output_blob = VALUES(output_blob),
          checksum_sha256 = VALUES(checksum_sha256),
          byte_length = VALUES(byte_length),
          updated_at = VALUES(updated_at)`,
      [
        String(stepId || ""),
        Buffer.from(text, "utf8"),
        outputChecksum(text),
        Buffer.byteLength(text, "utf8"),
        now,
        now
      ]
    );
  }

  function normalizeArchiveCutoff(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (value) {
      const parsed = new Date(value);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    return new Date(Date.now() - AGENT_SESSION_ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  }

  return {
    listAgentSessionsForUser,
    getAgentSessionForUser,
    createAgentSession,
    updateAgentSessionForUser,
    deleteAgentSessionForUser,
    createAgentMessageForUser,
    updateAgentStepForUser,
    archiveOldAgentSessions
  };
}

module.exports = createAgentSessionStore;
