function createAgentSessionStore({ getPool, toIso, safeJsonSummary }) {
  function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function jsonForStorage(value, fallback = null) {
    if (value === null || value === undefined) return fallback;
    return JSON.stringify(safeJsonSummary(value));
  }

  function mapAgentSession(row = {}) {
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
      updatedAt: toIso(row.updated_at)
    };
  }

  function mapAgentMessage(row = {}) {
    if (!row) return null;
    return {
      id: row.id || "",
      sessionId: row.session_id || "",
      userId: row.user_id || "",
      role: row.role || "user",
      content: row.content || "",
      attachments: parseJson(row.attachments_json, []),
      createdAt: toIso(row.created_at)
    };
  }

  function mapAgentStep(row = {}) {
    if (!row) return null;
    return {
      id: row.id || "",
      sessionId: row.session_id || "",
      messageId: row.message_id || "",
      kind: row.kind || "",
      status: row.status || "pending",
      input: parseJson(row.input_json, null),
      output: parseJson(row.output_json, null),
      requestId: row.request_id || "",
      generationId: row.generation_id || "",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    };
  }

  async function listAgentSessionsForUser(userId, { limit = 50 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const [rows] = await getPool().execute(
      `SELECT s.*,
              (SELECT COUNT(*) FROM agent_messages m WHERE m.session_id = s.id) AS message_count,
              (SELECT COUNT(*) FROM agent_steps st WHERE st.session_id = s.id) AS step_count
         FROM agent_sessions s
        WHERE s.user_id = ? AND s.status <> 'deleted'
        ORDER BY s.updated_at DESC, s.created_at DESC
        LIMIT ${normalizedLimit}`,
      [userId]
    );
    return rows.map(mapAgentSession);
  }

  async function getAgentSessionForUser(id, userId, { includeChildren = true } = {}) {
    const [rows] = await getPool().execute(
      `SELECT s.*,
              (SELECT COUNT(*) FROM agent_messages m WHERE m.session_id = s.id) AS message_count,
              (SELECT COUNT(*) FROM agent_steps st WHERE st.session_id = s.id) AS step_count
         FROM agent_sessions s
        WHERE s.id = ? AND s.user_id = ? AND s.status <> 'deleted'
        LIMIT 1`,
      [id, userId]
    );
    const session = mapAgentSession(rows[0]);
    if (!session || !includeChildren) return session;
    const [messageRows] = await getPool().execute(
      `SELECT *
         FROM agent_messages
        WHERE session_id = ? AND user_id = ?
        ORDER BY created_at ASC, id ASC`,
      [id, userId]
    );
    const [stepRows] = await getPool().execute(
      `SELECT *
         FROM agent_steps
        WHERE session_id = ?
        ORDER BY created_at ASC, id ASC`,
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
        WHERE id = ? AND user_id = ? AND status <> 'deleted'`,
      values
    );
    if (!result.affectedRows) return null;
    return getAgentSessionForUser(id, userId);
  }

  async function deleteAgentSessionForUser(id, userId) {
    const [result] = await getPool().execute(
      `UPDATE agent_sessions
          SET status = 'deleted', updated_at = ?
        WHERE id = ? AND user_id = ? AND status <> 'deleted'`,
      [new Date(), id, userId]
    );
    return result.affectedRows > 0;
  }

  async function createAgentMessageForUser(sessionId, userId, input = {}) {
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [sessionRows] = await connection.execute(
        "SELECT id FROM agent_sessions WHERE id = ? AND user_id = ? AND status <> 'deleted' LIMIT 1",
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

      for (const [index, step] of (input.steps || []).entries()) {
        const stepCreatedAt = new Date(now.getTime() + index);
        await connection.execute(
          `INSERT INTO agent_steps
            (id, session_id, message_id, kind, status, input_json, output_json, request_id, generation_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            step.id,
            sessionId,
            input.id,
            step.kind,
            step.status || "pending",
            jsonForStorage(step.input, null),
            jsonForStorage(step.output, null),
            step.requestId || null,
            step.generationId || null,
            stepCreatedAt,
            stepCreatedAt
          ]
        );
      }

      await connection.execute(
        "UPDATE agent_sessions SET updated_at = ? WHERE id = ? AND user_id = ?",
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

  return {
    listAgentSessionsForUser,
    getAgentSessionForUser,
    createAgentSession,
    updateAgentSessionForUser,
    deleteAgentSessionForUser,
    createAgentMessageForUser
  };
}

module.exports = createAgentSessionStore;
