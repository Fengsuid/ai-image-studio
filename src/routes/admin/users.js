"use strict";

const { getLimit, requireAdmin } = require("./shared");

function serializeGenerations(deps, generations) {
  return generations.map((generation) => ({
    ...generation,
    imageUrl: `/api/images/${generation.id}/file`,
    sourceImageUrl: deps.sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
    ...deps.sourceImageAuditFields(generation)
  }));
}

function createAdminUsersRoute(deps) {
  const { store, sendJson, readJsonBody, httpError, writeAdminAudit } = deps;

  return async function handleAdminUsersRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/users") {
      await requireAdmin(deps, req);
      const status = ["active", "disabled", "all"].includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "";
      const role = ["admin", "user", "all"].includes(url.searchParams.get("role")) ? url.searchParams.get("role") : "";
      const rewardStatus = ["none", "pending", "awarded", "cancelled", "all"].includes(url.searchParams.get("rewardStatus")) ? url.searchParams.get("rewardStatus") : "";
      const users = await store.listUsers({
        search: url.searchParams.get("search") || "",
        status,
        role,
        rewardStatus,
        limit: getLimit(deps, url, 500, 1000),
        offset: Math.max(0, Number.parseInt(url.searchParams.get("offset"), 10) || 0)
      });
      sendJson(res, 200, { users: users.map(deps.serializeUser) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/users") {
      const current = await requireAdmin(deps, req);
      const body = await readJsonBody(req);
      const email = deps.normalizeEmail(body.email);
      deps.requireEmail(email);
      if (await store.getUserByEmail(email)) throw httpError("Email is already registered", 409);
      const generated = Boolean(body.generatePassword) || !String(body.password || "").trim();
      const password = generated ? deps.temporaryPassword() : String(body.password || "");
      deps.requirePassword(password);
      const user = await store.createUser({
        id: deps.randomId("usr_"),
        name: String(body.name || "").trim().slice(0, 60) || email.split("@")[0],
        email,
        passwordHash: deps.hashPassword(password),
        role: ["admin", "user"].includes(body.role) ? body.role : "user",
        status: ["active", "disabled"].includes(body.status) ? body.status : "active",
        credits: Math.max(0, Math.min(100000, Number.parseInt(body.credits, 10) || 0))
      });
      await writeAdminAudit(current, req, "create_user", "user", user.id, {
        email,
        role: user.role,
        status: user.status,
        credits: user.credits,
        generatedPassword: generated,
        note: String(body.note || "").slice(0, 255)
      });
      sendJson(res, 201, { user: deps.serializeUser(user), temporaryPassword: generated ? password : undefined });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/users/bulk") {
      const current = await requireAdmin(deps, req);
      const body = await readJsonBody(req);
      const userIds = Array.isArray(body.userIds) ? body.userIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 200) : [];
      if (!userIds.length) throw httpError("No users selected", 400);
      const results = [];
      for (const userId of userIds) {
        const target = await store.getUserById(userId);
        if (!target) {
          results.push({ userId, ok: false, error: "not_found" });
          continue;
        }
        try {
          if (body.action === "status") {
            const status = ["active", "disabled"].includes(body.status) ? body.status : "";
            if (!status) throw new Error("invalid_status");
            if (target.id === current.user.id && status !== "active") throw new Error("cannot_disable_self");
            await store.updateUser(target.id, { status });
          } else if (body.action === "creditDelta") {
            const delta = Math.max(-100000, Math.min(100000, Number.parseInt(body.creditDelta, 10) || 0));
            if (!delta) throw new Error("zero_delta");
            await store.adjustCredits(target.id, delta, {
              source: "admin_bulk_adjustment",
              note: String(body.note || "Bulk adjustment").slice(0, 255),
              actorUserId: current.user.id
            });
          } else {
            throw new Error("invalid_action");
          }
          results.push({ userId, ok: true });
        } catch (error) {
          results.push({ userId, ok: false, error: error.message || String(error) });
        }
      }
      await writeAdminAudit(current, req, "bulk_user_update", "user", "selected", {
        action: String(body.action || "").trim(),
        count: userIds.length,
        ok: results.filter((item) => item.ok).length,
        note: body.note || ""
      });
      sendJson(res, 200, { results });
      return true;
    }

    for (const [regex, key, listFn] of [
      [/^\/api\/admin\/users\/([^/]+)\/credit-ledger$/, "ledger", (target) => store.listCreditLedger({ userId: target.id, limit: getLimit(deps, url, 100, 500) })],
      [/^\/api\/admin\/users\/([^/]+)\/reward-ledger$/, "rewards", (target) => store.listRewardLedger({ userId: target.id, limit: getLimit(deps, url, 100, 500) })]
    ]) {
      const match = url.pathname.match(regex);
      if (match && req.method === "GET") {
        await requireAdmin(deps, req);
        const target = await store.getUserById(match[1]);
        if (!target) throw httpError("User not found", 404);
        sendJson(res, 200, { [key]: await listFn(target) });
        return true;
      }
    }

    const resetMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/);
    if (resetMatch && req.method === "POST") {
      const current = await requireAdmin(deps, req);
      const target = await store.getUserById(resetMatch[1]);
      if (!target) throw httpError("User not found", 404);
      const body = await readJsonBody(req);
      const generated = Boolean(body.generatePassword) || !String(body.password || "").trim();
      const password = generated ? deps.temporaryPassword() : String(body.password || "");
      deps.requirePassword(password);
      const user = await store.updateUserPassword(target.id, deps.hashPassword(password));
      await writeAdminAudit(current, req, "reset_user_password", "user", target.id, {
        email: target.email,
        generatedPassword: generated,
        note: String(body.note || "").slice(0, 255)
      });
      sendJson(res, 200, { user: deps.serializeUser(user), temporaryPassword: generated ? password : undefined });
      return true;
    }

    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && req.method === "PATCH") {
      const current = await requireAdmin(deps, req);
      const target = await store.getUserById(userMatch[1]);
      if (!target) throw httpError("User not found", 404);
      const body = await readJsonBody(req);
      const patch = {};
      if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 60) || target.name;
      if (["admin", "user"].includes(body.role)) patch.role = body.role;
      if (["active", "disabled"].includes(body.status)) patch.status = body.status;
      if (target.id === current.user.id) Object.assign(patch, { role: "admin", status: "active" });
      let user = await store.updateUser(target.id, patch);
      if (body.credits !== undefined) user = await store.setUserCredits(target.id, body.credits, { source: "admin_set", note: String(body.note || "Admin set balance").slice(0, 255), actorUserId: current.user.id });
      if (body.creditDelta !== undefined) {
        const delta = Math.max(-100000, Math.min(100000, Number.parseInt(body.creditDelta, 10) || 0));
        user = await store.adjustCredits(target.id, delta, { source: "admin_adjustment", note: String(body.note || "Admin adjustment").slice(0, 255), actorUserId: current.user.id });
      }
      await writeAdminAudit(current, req, "update_user", "user", target.id, { patch, credits: body.credits, creditDelta: body.creditDelta, note: body.note || "" });
      sendJson(res, 200, { user: deps.serializeUser(user) });
      return true;
    }

    const generationsMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/generations$/);
    if (generationsMatch && req.method === "GET") {
      const current = await deps.getCurrentUser(req);
      deps.ensureAdmin(current);
      const target = await store.getUserById(generationsMatch[1]);
      if (!target) throw httpError("User not found", 404);
      const generations = await store.listGenerationsForUserId(target.id, getLimit(deps, url, 120, 200), { includeArchived: url.searchParams.get("includeArchived") === "1" });
      sendJson(res, 200, { user: deps.serializeUser(target), generations: serializeGenerations(deps, generations) });
      return true;
    }

    return false;
  };
}

module.exports = { createAdminUsersRoute };
