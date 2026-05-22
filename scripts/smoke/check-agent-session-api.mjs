#!/usr/bin/env node
// Smoke test for AIS-RLS-064 agent session data model and API.
// Requires a running server and admin credentials:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke/check-agent-session-api.mjs http://127.0.0.1:3000

import mysql from "mysql2/promise";

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://127.0.0.1:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userAEmail = `codex-rls064-a-${runId}@example.test`;
const userBEmail = `codex-rls064-b-${runId}@example.test`;
const createdUserIds = [];
const createdSessionIds = [];
const failures = [];

function log(...parts) {
  console.log("[agent-session-smoke]", ...parts);
}

function fail(message) {
  failures.push(message);
  console.error("[agent-session-smoke] FAIL:", message);
}

function assert(condition, message) {
  if (!condition) fail(message);
  return Boolean(condition);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setFromHeaders(headers) {
    const values = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
    for (const value of values) {
      const first = String(value || "").split(";")[0];
      const split = first.indexOf("=");
      if (split > 0) this.cookies.set(first.slice(0, split), first.slice(split + 1));
    }
  }

  header() {
    return Array.from(this.cookies.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
  }

  get(name) {
    return this.cookies.get(name) || "";
  }

  summary() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${String(value).slice(0, 12)}`)
      .join("; ");
  }
}

function csrfFrom(body, jar) {
  return String(body?.csrfToken || jar.get("csrf") || "");
}

async function request(pathSuffix, {
  method = "GET",
  body,
  jar,
  csrfToken = "",
  expected,
  label = pathSuffix
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (jar?.header()) headers.Cookie = jar.header();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(`${baseUrl}${pathSuffix}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    jar?.setFromHeaders(response.headers);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text };
    }
    if (expected !== undefined) {
      assert(response.status === expected, `${label} status=${response.status}, expected ${expected}; body=${JSON.stringify(json).slice(0, 500)}`);
    }
    return { response, body: json };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email, password) {
  const jar = new CookieJar();
  const me = await request("/api/auth/me", { jar, expected: 200, label: `GET /api/auth/me ${email}` });
  const csrfToken = csrfFrom(me.body, jar);
  assert(csrfToken, `csrf token missing for ${email}`);
  const result = await request("/api/auth/login", {
    method: "POST",
    jar,
    csrfToken,
    body: { email, password },
    expected: 200,
    label: `POST /api/auth/login ${email}`
  });
  assert(result.body?.user?.email === email, `login email mismatch for ${email}`);
  assert(jar.get("session"), `session cookie missing for ${email}; cookies=${jar.summary()}`);
  const current = await request("/api/auth/me", {
    jar,
    expected: 200,
    label: `GET /api/auth/me after login ${email}`
  });
  assert(current.body?.user?.email === email, `current user mismatch for ${email}; got ${current.body?.user?.email || "anonymous"}`);
  return { jar, csrfToken: csrfFrom(result.body, jar) || csrfToken, user: result.body?.user || null };
}

async function mysqlConnection() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio"
  });
}

async function cleanup() {
  let connection;
  try {
    connection = await mysqlConnection();
    if (createdSessionIds.length) {
      await connection.execute(
        `DELETE FROM agent_sessions WHERE id IN (${createdSessionIds.map(() => "?").join(",")})`,
        createdSessionIds
      );
    }
    await connection.execute("DELETE FROM users WHERE email IN (?, ?)", [userAEmail, userBEmail]);
  } catch (error) {
    fail(`cleanup failed: ${error.message || error}`);
  } finally {
    await connection?.end().catch(() => null);
  }
}

async function createManagedUser(admin, email, label) {
  const result = await request("/api/admin/users", {
    method: "POST",
    jar: admin.jar,
    csrfToken: admin.csrfToken,
    expected: 201,
    label: `POST /api/admin/users ${label}`,
    body: {
      email,
      name: `codex-rls064-${label}-${runId}`,
      role: "user",
      status: "active",
      credits: 1,
      generatePassword: true,
      note: "AIS-RLS-064 smoke"
    }
  });
  const userId = result.body?.user?.id || "";
  const password = String(result.body?.temporaryPassword || "");
  assert(userId, `${label} user id missing`);
  assert(password.length >= 8, `${label} temporary password missing`);
  if (userId) createdUserIds.push(userId);
  return { userId, password };
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for AIS-RLS-064 smoke");
  }

  log(`base = ${baseUrl}`);
  const anonymousList = await request("/api/agent-sessions", { label: "anonymous GET /api/agent-sessions" });
  assert(anonymousList.response.status === 401, `anonymous list status=${anonymousList.response.status}, expected 401`);

  try {
    const admin = await login(adminEmail, adminPassword);
    assert(admin.user?.role === "admin", "admin login should have admin role");
    const userARecord = await createManagedUser(admin, userAEmail, "a");
    const userBRecord = await createManagedUser(admin, userBEmail, "b");
    const userA = await login(userAEmail, userARecord.password);
    const userB = await login(userBEmail, userBRecord.password);

    log("CSRF write protection");
    const noCsrf = await request("/api/agent-sessions", {
      method: "POST",
      jar: userA.jar,
      body: { title: "missing csrf should fail" },
      label: "POST /api/agent-sessions without csrf"
    });
    assert(noCsrf.response.status === 403, `missing CSRF status=${noCsrf.response.status}, expected 403`);

    log("create and list session");
    const created = await request("/api/agent-sessions", {
      method: "POST",
      jar: userA.jar,
      csrfToken: userA.csrfToken,
      expected: 201,
      label: "POST /api/agent-sessions",
      body: {
        title: `AIS-RLS-064 smoke ${runId}`,
        sourceType: "smoke",
        sourceId: runId,
        summary: "initial smoke summary",
        data: { intent: "session_crud", runId, apiKey: "should-be-redacted" }
      }
    });
    const sessionId = created.body?.session?.id || "";
    assert(sessionId, "created session id missing");
    if (sessionId) createdSessionIds.push(sessionId);
    assert(created.body?.session?.title?.includes(runId), "created session title mismatch");
    assert(created.body?.session?.userId === userA.user?.id, `created session owner=${created.body?.session?.userId}, expected ${userA.user?.id}`);
    assert(created.body?.session?.status === "active", `created session status=${created.body?.session?.status}, expected active`);
    assert(created.body?.session?.data?.apiKey === "[redacted]", "session data should be redacted before storage");

    const listA = await request("/api/agent-sessions?limit=10", {
      jar: userA.jar,
      expected: 200,
      label: "GET /api/agent-sessions as owner"
    });
    assert((listA.body?.sessions || []).some((session) => session.id === sessionId), "owner list should include created session");

    log("cross-user isolation");
    const listB = await request("/api/agent-sessions?limit=10", {
      jar: userB.jar,
      expected: 200,
      label: "GET /api/agent-sessions as other user"
    });
    assert(!(listB.body?.sessions || []).some((session) => session.id === sessionId), "other user list must not include session");
    const otherRead = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, {
      jar: userB.jar,
      label: "other user GET session"
    });
    assert(
      otherRead.response.status === 404,
      `other user read status=${otherRead.response.status}, expected 404; currentUser=${userB.user?.id}; returnedOwner=${otherRead.body?.session?.userId || ""}; returnedStatus=${otherRead.body?.session?.status || ""}`
    );
    const otherPatch = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      jar: userB.jar,
      csrfToken: userB.csrfToken,
      body: { title: "cross user patch" },
      label: "other user PATCH session"
    });
    assert(otherPatch.response.status === 404, `other user patch status=${otherPatch.response.status}, expected 404`);

    log("rename and append message with ordered steps");
    const patched = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      jar: userA.jar,
      csrfToken: userA.csrfToken,
      expected: 200,
      label: "PATCH own session",
      body: { title: `AIS-RLS-064 renamed ${runId}`, status: "active" }
    });
    assert(patched.body?.session?.title === `AIS-RLS-064 renamed ${runId}`, "patched session title mismatch");

    const withMessage = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      jar: userA.jar,
      csrfToken: userA.csrfToken,
      expected: 201,
      label: "POST session message",
      body: {
        role: "user",
        content: `Please plan a batch image route ${runId}`,
        attachments: [{ kind: "generation", id: "gen_smoke" }],
        steps: [
          {
            kind: "plan",
            status: "succeeded",
            input: { prompt: "A porcelain product poster", token: "should-be-redacted" },
            output: { tasks: 2 }
          },
          {
            kind: "generate_batch",
            status: "pending",
            requestId: `req_${runId}`,
            input: { count: 2 }
          }
        ]
      }
    });
    const messageSession = withMessage.body?.session || {};
    assert(messageSession.messageCount === 1, `messageCount=${messageSession.messageCount}, expected 1`);
    assert(messageSession.stepCount === 2, `stepCount=${messageSession.stepCount}, expected 2`);
    assert(messageSession.messages?.[0]?.content?.includes(runId), "message content should be returned");
    assert(messageSession.steps?.[0]?.kind === "plan", "first step should preserve insertion order");
    assert(messageSession.steps?.[1]?.kind === "generate_batch", "second step should preserve insertion order");
    assert(messageSession.steps?.[0]?.input?.token === "[redacted]", "step input should be redacted before storage");

    const detail = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, {
      jar: userA.jar,
      expected: 200,
      label: "GET own session detail"
    });
    assert(detail.body?.session?.messages?.length === 1, "detail should include one message");
    assert(detail.body?.session?.steps?.length === 2, "detail should include two steps");

    log("delete session");
    await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      jar: userA.jar,
      csrfToken: userA.csrfToken,
      expected: 200,
      label: "DELETE own session"
    });
    const afterDelete = await request(`/api/agent-sessions/${encodeURIComponent(sessionId)}`, {
      jar: userA.jar,
      label: "GET deleted session"
    });
    assert(
      afterDelete.response.status === 404,
      `deleted session read status=${afterDelete.response.status}, expected 404; returnedOwner=${afterDelete.body?.session?.userId || ""}; returnedStatus=${afterDelete.body?.session?.status || ""}`
    );

    if (failures.length) {
      throw new Error(`${failures.length} AIS-RLS-064 smoke assertion(s) failed`);
    }
    log("ok");
  } finally {
    await cleanup();
  }
}

main().catch(async (error) => {
  console.error("[agent-session-smoke] ERROR:", error?.stack || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
