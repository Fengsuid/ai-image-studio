'use strict';

function createAppAuth({ httpError, PUBLIC_WITHDRAWAL_WINDOW_HOURS }) {
  const generationWindows = new Map();

  function ensureAuthenticated(current) {
    if (!current?.user) {
      throw httpError("Please sign in first", 401);
    }
  }

  function ensureActiveAuthenticated(current) {
    ensureAuthenticated(current);
    if (current.user.status !== "active") {
      throw httpError("Account is not active", 403);
    }
  }

  function ensureAdmin(current) {
    if (!current?.user || current.user.role !== "admin") {
      throw httpError("Admin permission required", 403);
    }
  }

  function canTouchGeneration(user, generation) {
    return user.role === "admin" || generation.userId === user.id;
  }

  function canWithdrawDirectly(generation) {
    if (!generation?.publishedAt) return true;
    return Date.now() - new Date(generation.publishedAt).getTime() <= PUBLIC_WITHDRAWAL_WINDOW_HOURS * 60 * 60 * 1000;
  }

  function isPubliclyVisibleGeneration(generation) {
    const moderationStatus = generation?.moderationStatus || "visible";
    return Boolean(
      generation?.isPublic &&
      !generation.archived &&
      ["visible", "restored"].includes(moderationStatus)
    );
  }

  function enforceGenerationRate(userId) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxPerWindow = 6;
    const entries = (generationWindows.get(userId) || []).filter((stamp) => now - stamp < windowMs);
    if (entries.length >= maxPerWindow) {
      throw httpError("Too many generation requests. Please try again later", 429);
    }
    entries.push(now);
    generationWindows.set(userId, entries);
  }

  return {
    ensureAuthenticated,
    ensureActiveAuthenticated,
    ensureAdmin,
    canTouchGeneration,
    canWithdrawDirectly,
    isPubliclyVisibleGeneration,
    enforceGenerationRate
  };
}

module.exports = { createAppAuth };
