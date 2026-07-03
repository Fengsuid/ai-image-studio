-- SPDX-License-Identifier: AGPL-3.0-or-later
-- canvas_project_payloads: split large canvas graph payloads from canvas_projects metadata.

CREATE TABLE IF NOT EXISTS canvas_project_payloads (
  canvas_id VARCHAR(32) NOT NULL PRIMARY KEY,
  data MEDIUMBLOB NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL DEFAULT '',
  byte_length INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_canvas_project_payloads_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
