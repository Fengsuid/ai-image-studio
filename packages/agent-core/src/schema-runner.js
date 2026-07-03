const fs = require("fs");
const path = require("path");

const SCHEMA_DIR = path.join(__dirname, "..", "schema");

function loadSchemaFiles() {
  return fs.readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(SCHEMA_DIR, name), "utf8")
    }));
}

function stripComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function splitStatements(sql) {
  return stripComments(sql)
    .split(/;\s*(?:\r?\n|$)/)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

async function applySchema(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error("applySchema requires a database connection with a query() method");
  }
  for (const file of loadSchemaFiles()) {
    for (const statement of splitStatements(file.sql)) {
      await db.query(statement);
    }
  }

  if (typeof db.execute === "function") {
    await ensureColumn(db, "agent_sessions", "deleted_at", "ALTER TABLE agent_sessions ADD COLUMN deleted_at DATETIME(3) NULL AFTER updated_at");
    await ensureColumn(db, "agent_messages", "deleted_at", "ALTER TABLE agent_messages ADD COLUMN deleted_at DATETIME(3) NULL AFTER created_at");
    await ensureColumn(db, "agent_steps", "step_no", "ALTER TABLE agent_steps ADD COLUMN step_no INT UNSIGNED NOT NULL DEFAULT 0 AFTER message_id");
    await ensureColumn(db, "agent_steps", "deleted_at", "ALTER TABLE agent_steps ADD COLUMN deleted_at DATETIME(3) NULL AFTER updated_at");
    await ensureIndex(db, "agent_sessions", "idx_agent_sessions_user_updated", "ALTER TABLE agent_sessions ADD INDEX idx_agent_sessions_user_updated (user_id, updated_at)");
    await ensureIndex(db, "agent_sessions", "idx_agent_sessions_status_updated", "ALTER TABLE agent_sessions ADD INDEX idx_agent_sessions_status_updated (status, updated_at)");
    await ensureIndex(db, "agent_messages", "idx_agent_messages_session_created", "ALTER TABLE agent_messages ADD INDEX idx_agent_messages_session_created (session_id, created_at)");
    await ensureIndex(db, "agent_steps", "idx_agent_steps_session_step_no", "ALTER TABLE agent_steps ADD INDEX idx_agent_steps_session_step_no (session_id, step_no)");
    await ensureIndex(db, "agent_steps", "idx_agent_steps_generation", "ALTER TABLE agent_steps ADD INDEX idx_agent_steps_generation (generation_id)");
    await backfillAgentStepOutputs(db);
  }
}

async function ensureColumn(db, table, column, statement) {
  const [columns] = await db.execute(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (!columns?.length) await db.query(statement);
}

async function ensureIndex(db, table, index, statement) {
  const [indexes] = await db.execute(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [index]);
  if (!indexes?.length) await db.query(statement);
}

async function backfillAgentStepOutputs(db) {
  await db.query(`
    INSERT INTO agent_step_outputs (step_id, output_blob, checksum_sha256, byte_length, created_at, updated_at)
    SELECT id,
           CAST(output_json AS BINARY),
           COALESCE(SHA2(output_json, 256), ''),
           OCTET_LENGTH(output_json),
           created_at,
           updated_at
      FROM agent_steps
     WHERE output_json IS NOT NULL
    ON DUPLICATE KEY UPDATE
      output_blob = VALUES(output_blob),
      checksum_sha256 = VALUES(checksum_sha256),
      byte_length = VALUES(byte_length),
      updated_at = VALUES(updated_at)
  `);
}

module.exports = {
  applySchema,
  loadSchemaFiles
};
