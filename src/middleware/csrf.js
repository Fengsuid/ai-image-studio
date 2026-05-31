"use strict";

function createCsrfMiddleware({
  crypto,
  httpError,
  parseCookies,
  shouldUseSecureCookie,
  timingSafeEqual,
  sessionTtlMs
}) {
  function csrfCookie(token, req) {
    const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
    return `csrf=${encodeURIComponent(token)}; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secure}`;
  }

  function getOrCreateCsrfToken(req) {
    const current = String(parseCookies(req.headers.cookie).csrf || "").trim();
    return /^[A-Za-z0-9_-]{32,}$/.test(current) ? current : crypto.randomBytes(24).toString("base64url");
  }

  function verifyCsrf(req) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
    if (req.url?.startsWith("/api/csp-report")) return;
    if (req.url?.startsWith("/api/client-error")) return;
    const cookieToken = String(parseCookies(req.headers.cookie).csrf || "");
    const headerToken = String(req.headers["x-csrf-token"] || "");
    if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
      throw httpError("Invalid CSRF token", 403);
    }
  }

  return {
    csrfCookie,
    getOrCreateCsrfToken,
    verifyCsrf
  };
}

module.exports = { createCsrfMiddleware };
