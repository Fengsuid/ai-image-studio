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
    const [columns] = await db.execute("SHOW COLUMNS FROM canvas_projects LIKE 'is_template'");
    if (!columns?.length) {
      await db.query("ALTER TABLE canvas_projects ADD COLUMN is_template TINYINT(1) NOT NULL DEFAULT 0 AFTER visibility");
    }
  }
}

module.exports = {
  applySchema,
  loadSchemaFiles
};
