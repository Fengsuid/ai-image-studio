-- SPDX-License-Identifier: AGPL-3.0-or-later
-- canvas_projects: owns user-created canvas workspaces (private / public / template).
-- Migrated from src/mysql-store.js as part of AIS-RLS-147 backend slice extraction.

CREATE TABLE IF NOT EXISTS canvas_projects (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  cover_url VARCHAR(500) NOT NULL DEFAULT '',
  visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  is_template TINYINT(1) NOT NULL DEFAULT 0,
  fork_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_forked_at DATETIME(3) NULL,
  data_json LONGTEXT NOT NULL,
  node_count INT UNSIGNED NOT NULL DEFAULT 0,
  edge_count INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_canvas_projects_user_updated (user_id, updated_at),
  INDEX idx_canvas_projects_visibility_updated (visibility, updated_at),
  INDEX idx_canvas_projects_template_updated (is_template, updated_at),
  INDEX idx_canvas_projects_forks (fork_count, last_forked_at),
  INDEX idx_canvas_projects_status_updated (status, updated_at),
  CONSTRAINT fk_canvas_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Idempotent column backfill (matches mysql-store.js SHOW COLUMNS guard pattern).
-- Runners must execute this conditionally (e.g., via SHOW COLUMNS LIKE 'is_template').
-- ALTER TABLE canvas_projects ADD COLUMN is_template TINYINT(1) NOT NULL DEFAULT 0 AFTER visibility;
-- ALTER TABLE canvas_projects ADD COLUMN fork_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_template;
-- ALTER TABLE canvas_projects ADD COLUMN last_forked_at DATETIME(3) NULL AFTER fork_count;
