-- SPDX-License-Identifier: AGPL-3.0-or-later
-- canvas_generation_links: bridges canvas_projects -> generations for output node provenance.
-- Migrated from src/mysql-store.js as part of AIS-RLS-147 backend slice extraction.

CREATE TABLE IF NOT EXISTS canvas_generation_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  canvas_id VARCHAR(32) NOT NULL,
  generation_id VARCHAR(32) NOT NULL,
  output_node_id VARCHAR(160) NOT NULL DEFAULT '',
  config_node_id VARCHAR(160) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uniq_canvas_generation_link (canvas_id, generation_id),
  INDEX idx_canvas_generation_links_canvas (canvas_id),
  INDEX idx_canvas_generation_links_generation (generation_id),
  CONSTRAINT fk_canvas_generation_links_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_canvas_generation_links_generation FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
