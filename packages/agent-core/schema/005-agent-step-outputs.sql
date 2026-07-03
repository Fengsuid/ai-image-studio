CREATE TABLE IF NOT EXISTS agent_step_outputs (
  step_id VARCHAR(32) NOT NULL PRIMARY KEY,
  output_blob MEDIUMBLOB NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL DEFAULT '',
  byte_length INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_agent_step_outputs_step FOREIGN KEY (step_id) REFERENCES agent_steps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
