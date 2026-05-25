"use strict";

const { getLimit, requireAdmin } = require("./shared");

function createAdminAnnouncementsRoute(deps) {
  const { store, sendJson, readJsonBody, cleanAnnouncementInput, randomId, writeAdminAudit, httpError } = deps;

  return async function handleAdminAnnouncementsRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/announcements") {
      await requireAdmin(deps, req);
      const status = url.searchParams.get("status") || "";
      sendJson(res, 200, { announcements: await store.listAnnouncements({ includeArchived: true, status, limit: getLimit(deps, url) }) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/announcements") {
      const current = await requireAdmin(deps, req);
      const payload = cleanAnnouncementInput(await readJsonBody(req), null, { partial: false });
      const announcement = await store.createAnnouncement({ ...payload, id: randomId("ann_"), createdBy: current.user.id });
      await writeAdminAudit(current, req, "create_announcement", "announcement", announcement.id, {
        title: announcement.title,
        status: announcement.status
      });
      sendJson(res, 201, { announcement });
      return true;
    }

    const actionMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)\/(publish|archive|withdraw)$/);
    if (actionMatch && req.method === "POST") {
      const current = await requireAdmin(deps, req);
      const existing = await store.getAnnouncementById(actionMatch[1]);
      if (!existing) throw httpError("Announcement not found", 404);
      const action = actionMatch[2];
      const status = action === "publish" ? "published" : action === "archive" ? "archived" : "draft";
      const announcement = await store.updateAnnouncement(existing.id, { status });
      await writeAdminAudit(current, req, `${action}_announcement`, "announcement", announcement.id, {
        title: announcement.title,
        from: existing.status,
        to: announcement.status
      });
      sendJson(res, 200, { announcement });
      return true;
    }

    const match = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
    if (match && req.method === "GET") {
      await requireAdmin(deps, req);
      const announcement = await store.getAnnouncementById(match[1]);
      if (!announcement) throw httpError("Announcement not found", 404);
      sendJson(res, 200, { announcement });
      return true;
    }

    if (match && req.method === "PATCH") {
      const current = await requireAdmin(deps, req);
      const existing = await store.getAnnouncementById(match[1]);
      if (!existing) throw httpError("Announcement not found", 404);
      const announcement = await store.updateAnnouncement(existing.id, cleanAnnouncementInput(await readJsonBody(req), existing, { partial: true }));
      await writeAdminAudit(current, req, "update_announcement", "announcement", announcement.id, {
        title: announcement.title,
        status: announcement.status
      });
      sendJson(res, 200, { announcement });
      return true;
    }

    if (match && req.method === "DELETE") {
      const current = await requireAdmin(deps, req);
      const existing = await store.getAnnouncementById(match[1]);
      if (!existing) throw httpError("Announcement not found", 404);
      const ok = await store.deleteAnnouncement(existing.id);
      if (!ok) throw httpError("Only draft announcements can be deleted", 400);
      await writeAdminAudit(current, req, "delete_announcement", "announcement", existing.id, {
        title: existing.title,
        status: existing.status
      });
      sendJson(res, 200, { ok: true });
      return true;
    }

    return false;
  };
}

module.exports = { createAdminAnnouncementsRoute };
