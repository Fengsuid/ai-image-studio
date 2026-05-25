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

async function applySchema(db) {
  if (!db || typeof db.query !== "function") {
    throw new Error("applySchema requires a database connection with a query() method");
  }
  for (const file of loadSchemaFiles()) {
    await db.query(file.sql);
  }
}

module.exports = {
  applySchema,
  loadSchemaFiles
};
