'use strict';

function createAdminAnnouncementsRoute({
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt,
  sendJson,
  store,
  readJsonBody,
  cleanAnnouncementInput,
  randomId,
  writeAdminAudit,
  httpError
}) {
  return async function handleAdminAnnouncementsRoute(req, res, url) {

  if (req.method === "GET" && url.pathname === "/api/admin/announcements") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const status = url.searchParams.get("status") || "";
    sendJson(res, 200, { announcements: await store.listAnnouncements({ includeArchived: true, status, limit }) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/announcements") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const payload = cleanAnnouncementInput(body, null, { partial: false });
    const announcement = await store.createAnnouncement({
      ...payload,
      id: randomId("ann_"),
      createdBy: current.user.id
    });
    await writeAdminAudit(current, req, "create_announcement", "announcement", announcement.id, {
      title: announcement.title,
      status: announcement.status
    });
    sendJson(res, 201, { announcement });
    return true;
  }

  const adminAnnouncementActionMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)\/(publish|archive|withdraw)$/);
  if (adminAnnouncementActionMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementActionMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const action = adminAnnouncementActionMatch[2];
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

  const adminAnnouncementMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (adminAnnouncementMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const announcement = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!announcement) throw httpError("Announcement not found", 404);
    sendJson(res, 200, { announcement });
    return true;
  }

  if (adminAnnouncementMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const patch = cleanAnnouncementInput(await readJsonBody(req), existing, { partial: true });
    const announcement = await store.updateAnnouncement(existing.id, patch);
    await writeAdminAudit(current, req, "update_announcement", "announcement", announcement.id, {
      title: announcement.title,
      status: announcement.status
    });
    sendJson(res, 200, { announcement });
    return true;
  }

  if (adminAnnouncementMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementMatch[1]);
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
