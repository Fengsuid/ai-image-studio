-- SPDX-License-Identifier: AGPL-3.0-or-later
-- canvas_project_snapshots: recent version history for rollback / undo across saves.

CREATE TABLE IF NOT EXISTS canvas_project_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  canvas_id VARCHAR(32) NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL DEFAULT '',
  node_count INT UNSIGNED NOT NULL DEFAULT 0,
  edge_count INT UNSIGNED NOT NULL DEFAULT 0,
  data MEDIUMBLOB NOT NULL,
  meta_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uniq_canvas_project_snapshot_version (canvas_id, version_no),
  INDEX idx_canvas_project_snapshots_canvas_created (canvas_id, created_at),
  CONSTRAINT fk_canvas_project_snapshots_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
