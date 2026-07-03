"use strict";

const fs = require("fs");
const path = require("path");

const canvasCore = require("@ai-image-studio/canvas-core");
const agentCore = require("@ai-image-studio/agent-core");

const ROOT_DIR = path.resolve(__dirname, "..");

const SLICE_MIGRATIONS = [
  {
    name: "canvas-core",
    schemaDir: path.join(ROOT_DIR, "packages", "canvas-core", "schema"),
    applySchema: canvasCore.applySchema
  },
  {
    name: "agent-core",
    schemaDir: path.join(ROOT_DIR, "packages", "agent-core", "schema"),
    applySchema: agentCore.applySchema
  }
];

function listSliceSchemaFiles(slice) {
  return fs.readdirSync(slice.schemaDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.join(slice.schemaDir, name));
}

function listSchemaFiles() {
  return SLICE_MIGRATIONS.flatMap((slice) => listSliceSchemaFiles(slice));
}

async function runAll(connection) {
  if (!connection || typeof connection.query !== "function") {
    throw new Error("migrations.runAll requires a database connection with a query() method");
  }
  for (const slice of SLICE_MIGRATIONS) {
    if (typeof slice.applySchema !== "function") {
      throw new Error(`migrations slice ${slice.name} does not expose applySchema()`);
    }
    await slice.applySchema(connection);
  }
}

module.exports = {
  SLICE_MIGRATIONS,
  listSchemaFiles,
  listSliceSchemaFiles,
  runAll
};
