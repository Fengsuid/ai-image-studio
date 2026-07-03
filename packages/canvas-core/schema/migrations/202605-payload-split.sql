-- SPDX-License-Identifier: AGPL-3.0-or-later
-- AIS-RLS-156 idempotent payload split migration.
-- Safe to rerun: creates split tables and backfills canvas_project_payloads from legacy data_json.

CREATE TABLE IF NOT EXISTS canvas_project_payloads (
  canvas_id VARCHAR(32) NOT NULL PRIMARY KEY,
  data MEDIUMBLOB NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL DEFAULT '',
  byte_length INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_canvas_project_payloads_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS canvas_node_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  canvas_id VARCHAR(32) NOT NULL,
  node_id VARCHAR(160) NOT NULL,
  node_type VARCHAR(64) NOT NULL DEFAULT '',
  source_key VARCHAR(64) NOT NULL DEFAULT 'imageUrl',
  image_url VARCHAR(1000) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uniq_canvas_node_image (canvas_id, node_id, source_key),
  INDEX idx_canvas_node_images_canvas (canvas_id),
  INDEX idx_canvas_node_images_url (image_url(191)),
  CONSTRAINT fk_canvas_node_images_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO canvas_project_payloads (canvas_id, data, checksum_sha256, byte_length, created_at, updated_at)
SELECT id, CAST(data_json AS BINARY), '', OCTET_LENGTH(data_json), created_at, updated_at
  FROM canvas_projects
 WHERE data_json IS NOT NULL
ON DUPLICATE KEY UPDATE
  data = VALUES(data),
  byte_length = VALUES(byte_length),
  updated_at = VALUES(updated_at);
