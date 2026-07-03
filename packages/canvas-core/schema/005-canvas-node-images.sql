-- SPDX-License-Identifier: AGPL-3.0-or-later
-- canvas_node_images: normalized node image references for later orphan cleanup jobs.

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
