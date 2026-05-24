"use strict";

function createCreditsRoute({
  store,
  sendJson,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  serializeUser,
  CHECKIN_CREDIT
}) {
  return async function handleCreditsRoute(req, res, url) {
    if (req.method === "POST" && url.pathname === "/api/checkin") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const user = await store.getUserById(current.user.id);
      if (!user || user.status !== "active") {
        throw httpError("Account is not active", 403);
      }
      const result = await store.checkInToday(user.id, CHECKIN_CREDIT);
      const updatedUser = await store.getUserById(user.id);
      sendJson(res, 200, {
        checkedIn: result.checkedIn,
        awarded: result.checkedIn ? CHECKIN_CREDIT : 0,
        credits: result.credits,
        user: serializeUser(updatedUser),
        checkin: {
          checkedInToday: true,
          credit: CHECKIN_CREDIT
        }
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/credits/detail") {
      const current = await getCurrentUser(req);
      ensureAuthenticated(current);
      const limit = Math.max(1, Math.min(120, Number(url.searchParams.get("limit")) || 80));
      const [ledger, rewards, credits, checkedInToday] = await Promise.all([
        store.listCreditLedger({ userId: current.user.id, limit }),
        store.listRewardLedger({ userId: current.user.id, limit: Math.min(limit, 80) }),
        store.getUserCredits(current.user.id),
        store.hasCheckedInToday(current.user.id)
      ]);
      sendJson(res, 200, {
        credits,
        ledger,
        rewards,
        checkin: {
          checkedInToday,
          credit: CHECKIN_CREDIT
        }
      });
      return true;
    }

    return false;
  };
}

module.exports = { createCreditsRoute };
