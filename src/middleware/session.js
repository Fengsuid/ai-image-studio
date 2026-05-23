"use strict";

function createSessionMiddleware({
  crypto,
  store,
  randomId,
  sessionTtlMs,
  cookieSecureEnv = process.env.COOKIE_SECURE,
  nodeEnv = process.env.NODE_ENV
}) {
  function hashSessionToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
  }

  function timingSafeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }

  function parseCookies(header = "") {
    return Object.fromEntries(
      header
        .split(";")
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
          const index = pair.indexOf("=");
          if (index === -1) return [pair, ""];
          return [decodeURIComponent(pair.slice(0, index)), decodeURIComponent(pair.slice(index + 1))];
        })
    );
  }

  function shouldUseSecureCookie(req) {
    const override = String(cookieSecureEnv || "").trim().toLowerCase();
    if (["1", "true", "yes"].includes(override)) return true;
    if (["0", "false", "no"].includes(override)) return false;

    const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (forwardedProto === "https") return true;

    const host = String(req.headers.host || "").toLowerCase();
    const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
    return nodeEnv === "production" && !isLocalHost;
  }

  function sessionCookie(token, req) {
    const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
    return `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secure}`;
  }

  function clearSessionCookie(req) {
    const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
    return `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
  }

  async function createSession(userId) {
    const token = randomId("sess_");
    await store.createSession(hashSessionToken(token), userId, new Date(Date.now() + sessionTtlMs));
    return token;
  }

  async function destroySession(token) {
    if (!token) return;
    await store.deleteSession(hashSessionToken(token)).catch(() => null);
  }

  async function getCurrentUser(req) {
    const token = parseCookies(req.headers.cookie).session;
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const user = await store.getSessionUser(tokenHash);
    if (!user) {
      await store.deleteSession(tokenHash).catch(() => null);
      return null;
    }

    await store.touchSession(tokenHash, new Date(Date.now() + sessionTtlMs));
    return { user };
  }

  function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const iterations = 210000;
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
    return { salt, iterations, hash };
  }

  function verifyPassword(password, passwordHash) {
    if (!passwordHash?.salt || !passwordHash?.hash || !passwordHash?.iterations) return false;
    const hash = crypto
      .pbkdf2Sync(password, passwordHash.salt, passwordHash.iterations, 32, "sha256")
      .toString("hex");
    return timingSafeEqual(hash, passwordHash.hash);
  }

  return {
    clearSessionCookie,
    createSession,
    destroySession,
    getCurrentUser,
    hashPassword,
    hashSessionToken,
    parseCookies,
    sessionCookie,
    shouldUseSecureCookie,
    timingSafeEqual,
    verifyPassword
  };
}

module.exports = { createSessionMiddleware };
