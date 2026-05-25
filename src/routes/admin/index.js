"use strict";

const { createAdminAnnouncementsRoute } = require("./announcements");
const { createAdminDiagnosticsRoute } = require("./diagnostics");
const { createAdminGenerationsRoute } = require("./generations");
const { createAdminModerationRoute } = require("./moderation");
const { createAdminPromptSourcesRoute } = require("./prompt-sources");
const { createAdminPublicImagesRoute } = require("./public-images");
const { createAdminSettingsRoute } = require("./settings");
const { createAdminUsersRoute } = require("./users");

function createAdminRoute(deps) {
  const handlers = [
    createAdminAnnouncementsRoute(deps),
    createAdminPromptSourcesRoute(deps),
    createAdminSettingsRoute(deps),
    createAdminDiagnosticsRoute(deps),
    createAdminGenerationsRoute(deps),
    createAdminPublicImagesRoute(deps),
    createAdminUsersRoute(deps),
    createAdminModerationRoute(deps)
  ];

  return async function handleAdminRoute(req, res, url) {
    for (const handle of handlers) {
      if (await handle(req, res, url)) return true;
    }
    return false;
  };
}

module.exports = { createAdminRoute };
