// SPDX-License-Identifier: AGPL-3.0-or-later
"use strict";

const fs = require("fs");
const path = require("path");

const SCHEMA_DIR = path.join(__dirname, "..", "schema");

function loadSchemaFiles() {
  return fs.readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(SCHEMA_DIR, name), "utf8")
    }));
}

function stripComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

function splitStatements(sql) {
  return stripComments(sql)
    .split(/;\s*(?:\r?\n|$)/)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

async function applySchema(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error("applySchema requires a database connection with a query() method");
  }
  for (const file of loadSchemaFiles()) {
    for (const statement of splitStatements(file.sql)) {
      await db.query(statement);
    }
  }

  if (typeof db.execute === "function") {
    await ensureColumn(db, "canvas_projects", "is_template", "ALTER TABLE canvas_projects ADD COLUMN is_template TINYINT(1) NOT NULL DEFAULT 0 AFTER visibility");
    await ensureColumn(db, "canvas_projects", "fork_count", "ALTER TABLE canvas_projects ADD COLUMN fork_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_template");
    await ensureColumn(db, "canvas_projects", "last_forked_at", "ALTER TABLE canvas_projects ADD COLUMN last_forked_at DATETIME(3) NULL AFTER fork_count");
    await ensureColumn(db, "canvas_generation_links", "request_id", "ALTER TABLE canvas_generation_links ADD COLUMN request_id VARCHAR(32) NOT NULL DEFAULT '' AFTER config_node_id");
    await ensureColumn(db, "canvas_generation_links", "status", "ALTER TABLE canvas_generation_links ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'succeeded' AFTER request_id");
    await ensureColumn(db, "canvas_generation_links", "candidate_count", "ALTER TABLE canvas_generation_links ADD COLUMN candidate_count INT UNSIGNED NOT NULL DEFAULT 1 AFTER status");
    await ensureColumn(db, "canvas_generation_links", "updated_at", "ALTER TABLE canvas_generation_links ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at");
  }
}

async function ensureColumn(db, table, column, statement) {
  // MySQL 不支持 SHOW 语句走 prepared statement，改用 query 让客户端插值
  const [columns] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (!columns?.length) await db.query(statement);
}

module.exports = {
  applySchema,
  loadSchemaFiles
};
