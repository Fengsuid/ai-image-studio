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
