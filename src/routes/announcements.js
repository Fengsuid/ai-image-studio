"use strict";

function createAnnouncementsRoute({
  store,
  sendJson,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  sanitizePositiveInt
}) {
  return async function handleAnnouncementsRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/announcements") {
      const current = await getCurrentUser(req);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 50, 100);
      const announcements = await store.listPublishedAnnouncements({ user: current?.user || null, limit });
      sendJson(res, 200, { announcements });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/announcements/unread") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const limit = sanitizePositiveInt(url.searchParams.get("limit"), 20, 100);
      const modalOnly = url.searchParams.get("modal") === "1";
      const announcements = await store.listPublishedAnnouncements({
        user: current.user,
        unreadOnly: true,
        modalOnly,
        limit
      });
      sendJson(res, 200, { announcements, unreadCount: announcements.length });
      return true;
    }

    const announcementPublicMatch = url.pathname.match(/^\/api\/announcements\/([^/]+)\/(read|ack)$/);
    if (announcementPublicMatch && req.method === "POST") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const announcement = await store.getAnnouncementById(announcementPublicMatch[1], { userId: current.user.id });
      if (!announcement || announcement.status !== "published") throw httpError("Announcement not found", 404);
      const updated = await store.markAnnouncementRead(announcement.id, current.user.id, {
        ack: announcementPublicMatch[2] === "ack"
      });
      sendJson(res, 200, { announcement: updated });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/stats/today") {
      const offset = Math.max(0, Number.parseInt(process.env.TODAY_GENERATED_OFFSET || "0", 10) || 0);
      const generatedToday = await store.countTodayGenerations();
      sendJson(res, 200, {
        todayGenerated: offset + generatedToday
      });
      return true;
    }

    return false;
  };
}

module.exports = { createAnnouncementsRoute };
