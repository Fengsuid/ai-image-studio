CREATE TABLE IF NOT EXISTS agent_messages (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  session_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  role VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  attachments_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL,
  INDEX idx_agent_messages_session_created (session_id, created_at),
  INDEX idx_agent_messages_user_created (user_id, created_at),
  CONSTRAINT fk_agent_messages_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
