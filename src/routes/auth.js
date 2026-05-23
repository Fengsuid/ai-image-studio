"use strict";

// Owns: GET /api/auth/me, POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout.
function createAuthRoute({
  store,
  sendJson,
  sendNoContent,
  readJsonBody,
  publicSettings,
  httpError,
  randomId,
  parseCookies,
  normalizeEmail,
  requireEmail,
  requirePassword,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  sessionCookie,
  clearSessionCookie,
  csrfCookie,
  getOrCreateCsrfToken,
  getCurrentUser,
  serializeUser,
  CHECKIN_CREDIT
}) {
  return async function handleAuthRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const current = await getCurrentUser(req);
      const settings = await store.getSettings();
      const activeProvider = await store.getDefaultProviderConfig({ includeSecret: true });
      const csrfToken = getOrCreateCsrfToken(req);
      sendJson(res, 200, {
        user: current?.user ? serializeUser(current.user) : null,
        firstRun: (await store.countUsers()) === 0,
        checkin: {
          checkedInToday: current?.user ? await store.hasCheckedInToday(current.user.id) : false,
          credit: CHECKIN_CREDIT
        },
        settings: publicSettings(settings, activeProvider),
        csrfToken
      }, {
        "Set-Cookie": csrfCookie(csrfToken, req)
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const name = String(body.name || "").trim() || email.split("@")[0];
      requireEmail(email);
      requirePassword(password);

      const settings = await store.getSettings();
      if (!settings.allowRegistration) {
        throw httpError("Registration is closed", 403);
      }
      if (await store.getUserByEmail(email)) {
        throw httpError("Email is already registered", 409);
      }

      const user = await store.createUser({
        id: randomId("usr_"),
        name: name.slice(0, 60),
        email,
        passwordHash: hashPassword(password),
        role: "user",
        status: !settings.requireApproval ? "active" : "disabled",
        credits: Math.max(0, Number(settings.defaultCredits ?? 10) || 0)
      });

      if (user.status !== "active") {
        sendJson(res, 201, { user: serializeUser(user), pendingApproval: true });
        return true;
      }

      const token = await createSession(user.id);
      sendJson(res, 201, { user: serializeUser(user) }, {
        "Set-Cookie": sessionCookie(token, req)
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const user = await store.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw httpError("Email or password is incorrect", 401);
      }
      if (user.status !== "active") {
        throw httpError("Account is disabled", 403);
      }
      const token = await createSession(user.id);
      sendJson(res, 200, { user: serializeUser(user) }, {
        "Set-Cookie": sessionCookie(token, req)
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      await destroySession(parseCookies(req.headers.cookie).session);
      sendNoContent(res, {
        "Set-Cookie": clearSessionCookie(req)
      });
      return true;
    }

    return false;
  };
}

module.exports = { createAuthRoute };
