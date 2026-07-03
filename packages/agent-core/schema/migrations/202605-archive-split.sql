-- AIS-RLS-157 idempotent archive/output split migration.
-- Safe to rerun: creates split/archive tables and backfills agent_step_outputs from legacy output_json.
-- Existing-table column/index upgrades are applied by packages/agent-core/src/schema-runner.js
-- with SHOW COLUMNS / SHOW INDEX guards to avoid non-portable ALTER IF NOT EXISTS syntax.

CREATE TABLE IF NOT EXISTS agent_sessions_archive (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  title VARCHAR(160) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'agent',
  source_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'archived',
  summary TEXT NULL,
  data_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL,
  archived_at DATETIME(3) NOT NULL,
  INDEX idx_agent_sessions_archive_user_updated (user_id, updated_at),
  INDEX idx_agent_sessions_archive_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_step_outputs (
  step_id VARCHAR(32) NOT NULL PRIMARY KEY,
  output_blob MEDIUMBLOB NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL DEFAULT '',
  byte_length INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_agent_step_outputs_step FOREIGN KEY (step_id) REFERENCES agent_steps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO agent_step_outputs (step_id, output_blob, checksum_sha256, byte_length, created_at, updated_at)
SELECT id, CAST(output_json AS BINARY), COALESCE(SHA2(output_json, 256), ''), OCTET_LENGTH(output_json), created_at, updated_at
  FROM agent_steps
 WHERE output_json IS NOT NULL
ON DUPLICATE KEY UPDATE
  output_blob = VALUES(output_blob),
  checksum_sha256 = VALUES(checksum_sha256),
  byte_length = VALUES(byte_length),
  updated_at = VALUES(updated_at);
