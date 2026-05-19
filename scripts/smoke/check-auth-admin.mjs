#!/usr/bin/env node
// Authenticated smoke test for GPT Image Studio.
// Runs low-risk admin/user API checks and removes the test user afterwards.
// Usage:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke/check-auth-admin.mjs http://127.0.0.1:3000

import mysql from "mysql2/promise";

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://127.0.0.1:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testEmail = `codex-smoke-${runId}@example.test`;
const testName = `codex-smoke-${runId}`;
const announcementTitle = `[smoke] auth-admin ${runId}`;
const createdIds = { announcementId: "", userId: "" };
const failures = [];

function log(...parts) {
  console.log("[auth-smoke]", ...parts);
}

function fail(message) {
  failures.push(message);
  console.error("[auth-smoke] FAIL:", message);
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
      assert(response.status === expected, `${label} status=${response.status}, expected ${expected}`);
    }
    return { response, body: json };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email, password) {
  const jar = new CookieJar();
  const me = await request("/api/auth/me", { jar, expected: 200, label: "GET /api/auth/me before login" });
  const csrfToken = csrfFrom(me.body, jar);
  assert(csrfToken, "csrf token should be available before login");
  const result = await request("/api/auth/login", {
    method: "POST",
    jar,
    csrfToken,
    body: { email, password },
    expected: 200,
    label: `POST /api/auth/login ${email}`
  });
  assert(result.body?.user?.email === email, `login user email mismatch for ${email}`);
  assert(Boolean(jar.get("session")), `session cookie missing for ${email}`);
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
    if (createdIds.announcementId) {
      await connection.execute("DELETE FROM announcements WHERE id = ? AND title = ?", [createdIds.announcementId, announcementTitle]);
    }
    await connection.execute("DELETE FROM announcements WHERE title = ? AND status = 'draft'", [announcementTitle]);
    await connection.execute("DELETE FROM users WHERE email = ?", [testEmail]);
  } catch (error) {
    fail(`cleanup failed: ${error.message || error}`);
  } finally {
    await connection?.end().catch(() => null);
  }
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for authenticated smoke");
  }
  log(`base = ${baseUrl}`);
  log(`test user = ${testEmail}`);

  try {
    const admin = await login(adminEmail, adminPassword);
    assert(admin.user?.role === "admin", "ADMIN_EMAIL login should be admin");

    log("GET admin readonly endpoints");
    const [settings, users, providers, announcements, reports, duplicates, rum] = await Promise.all([
      request("/api/admin/settings", { jar: admin.jar, expected: 200, label: "GET /api/admin/settings" }),
      request("/api/admin/users", { jar: admin.jar, expected: 200, label: "GET /api/admin/users" }),
      request("/api/admin/providers", { jar: admin.jar, expected: 200, label: "GET /api/admin/providers" }),
      request("/api/admin/announcements?limit=5", { jar: admin.jar, expected: 200, label: "GET /api/admin/announcements" }),
      request("/api/admin/reports?limit=5", { jar: admin.jar, expected: 200, label: "GET /api/admin/reports" }),
      request("/api/admin/prompt-duplicates?limit=5&status=all", { jar: admin.jar, expected: 200, label: "GET /api/admin/prompt-duplicates" }),
      request("/api/admin/rum", { jar: admin.jar, expected: 200, label: "GET /api/admin/rum" })
    ]);
    assert(settings.body?.providerCapabilities && typeof settings.body.providerCapabilities === "object", "admin settings providerCapabilities missing");
    assert(Array.isArray(users.body?.users), "admin users missing array");
    assert(Array.isArray(providers.body?.providers), "admin providers missing array");
    assert(Array.isArray(announcements.body?.announcements), "admin announcements missing array");
    assert(Array.isArray(reports.body?.reports), "admin reports missing array");
    assert(Array.isArray(duplicates.body?.candidates), "admin duplicate candidates missing array");
    assert(rum.body?.summary && typeof rum.body.summary === "object", "admin RUM summary missing");

    log("POST /api/admin/users");
    const createdUser = await request("/api/admin/users", {
      method: "POST",
      jar: admin.jar,
      csrfToken: admin.csrfToken,
      expected: 201,
      label: "POST /api/admin/users",
      body: {
        email: testEmail,
        name: testName,
        role: "user",
        status: "active",
        credits: 1,
        generatePassword: true,
        note: "authenticated smoke test"
      }
    });
    createdIds.userId = createdUser.body?.user?.id || "";
    const testPassword = String(createdUser.body?.temporaryPassword || "");
    assert(createdIds.userId, "created test user id missing");
    assert(testPassword.length >= 8, "temporary password missing or too short");

    log("POST /api/admin/announcements");
    const createdAnnouncement = await request("/api/admin/announcements", {
      method: "POST",
      jar: admin.jar,
      csrfToken: admin.csrfToken,
      expected: 201,
      label: "POST /api/admin/announcements",
      body: {
        title: announcementTitle,
        body: "Temporary authenticated smoke test announcement. It is deleted before the script exits.",
        level: "info",
        displayMode: "feed",
        audience: "admin",
        status: "draft",
        isImportant: false,
        requiresAck: false
      }
    });
    createdIds.announcementId = createdAnnouncement.body?.announcement?.id || "";
    assert(createdIds.announcementId, "created announcement id missing");

    const announcementDetail = await request(`/api/admin/announcements/${encodeURIComponent(createdIds.announcementId)}`, {
      jar: admin.jar,
      expected: 200,
      label: "GET created announcement"
    });
    assert(announcementDetail.body?.announcement?.title === announcementTitle, "announcement detail title mismatch");

    await request(`/api/admin/announcements/${encodeURIComponent(createdIds.announcementId)}`, {
      method: "DELETE",
      jar: admin.jar,
      csrfToken: admin.csrfToken,
      expected: 200,
      label: "DELETE created announcement"
    });
    createdIds.announcementId = "";

    log("login as created user and check user endpoints");
    const user = await login(testEmail, testPassword);
    assert(user.user?.role === "user", "created user login should have role=user");
    const unread = await request("/api/announcements/unread?limit=5", {
      jar: user.jar,
      expected: 200,
      label: "GET /api/announcements/unread as user"
    });
    assert(Array.isArray(unread.body?.announcements), "user unread announcements missing array");

    if (failures.length) {
      throw new Error(`${failures.length} authenticated smoke assertion(s) failed`);
    }
    log("OK: authenticated checks passed");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error("[auth-smoke] crashed:", error?.stack || error);
  process.exit(1);
});
