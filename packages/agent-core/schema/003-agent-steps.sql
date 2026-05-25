CREATE TABLE IF NOT EXISTS agent_steps (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  session_id VARCHAR(32) NOT NULL,
  message_id VARCHAR(32) NULL,
  kind VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  input_json LONGTEXT NULL,
  output_json LONGTEXT NULL,
  request_id VARCHAR(64) NULL,
  generation_id VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_agent_steps_session_created (session_id, created_at),
  INDEX idx_agent_steps_message (message_id),
  INDEX idx_agent_steps_request (request_id),
  INDEX idx_agent_steps_generation (generation_id),
  CONSTRAINT fk_agent_steps_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_agent_steps_message FOREIGN KEY (message_id) REFERENCES agent_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
