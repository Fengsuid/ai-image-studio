// SPDX-License-Identifier: AGPL-3.0-or-later
"use strict";

const { createService, createCanvasService } = require("./service");
const { createRoutes, createCanvasesRoute } = require("./routes");
const { createCanvasStore } = require("./store");
const { applySchema, loadSchemaFiles } = require("./schema-runner");

module.exports = {
  createService,
  createCanvasService,
  createRoutes,
  createCanvasesRoute,
  createCanvasStore,
  applySchema,
  loadSchemaFiles
};
