#!/usr/bin/env node
// Smoke test for AIS-RLS-034 user management, credit ledger, and first-public reward.
// Requires a running server and admin credentials:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke/check-user-credits-reward.mjs http://127.0.0.1:3000

import mysql from "mysql2/promise";

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://127.0.0.1:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testEmail = `codex-rls034-${runId}@example.test`;
const testName = `codex-rls034-${runId}`;
const generationIds = [`g034a_${runId}`, `g034b_${runId}`, `g034c_${runId}`];
const fixturePrompts = [
  `ultraviolet crystal lighthouse above a quiet sea ${runId}`,
  `isometric brass robot cooking noodles in a market ${runId}`,
  `botanical postage stamp with glass lemons ${runId}`
];
const failures = [];
let createdUserId = "";

function log(...parts) {
  console.log("[rls034-smoke]", ...parts);
}

function fail(message) {
  failures.push(message);
  console.error("[rls034-smoke] FAIL:", message);
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

async function insertGenerationFixtures(userId) {
  const connection = await mysqlConnection();
  try {
    const now = new Date();
    for (const [index, id] of generationIds.entries()) {
      await connection.execute(
        `INSERT INTO generations
         (id, user_id, prompt, model, size, quality, background, output_format, filename, is_public, created_at)
         VALUES (?, ?, ?, 'smoke-model', '1024x1024', 'auto', 'auto', 'png', ?, 0, ?)`,
        [id, userId, fixturePrompts[index] || `rls034 smoke fixture ${runId} ${index}`, `${id}.png`, now]
      );
    }
  } finally {
    await connection.end().catch(() => null);
  }
}

async function cleanup() {
  const connection = await mysqlConnection().catch((error) => {
    fail(`cleanup connection failed: ${error.message || error}`);
    return null;
  });
  if (!connection) return;
  try {
    await connection.execute(
      `DELETE FROM generations WHERE id IN (${generationIds.map(() => "?").join(",")})`,
      generationIds
    );
    await connection.execute("DELETE FROM users WHERE email = ?", [testEmail]);
  } catch (error) {
    fail(`cleanup failed: ${error.message || error}`);
  } finally {
    await connection.end().catch(() => null);
  }
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for RLS-034 smoke");
  }

  log(`base = ${baseUrl}`);
  log(`test user = ${testEmail}`);

  try {
    const admin = await login(adminEmail, adminPassword);
    assert(admin.user?.role === "admin", "admin login should have admin role");

    log("create managed test user");
    const created = await request("/api/admin/users", {
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
        credits: 3,
        generatePassword: true,
        note: "AIS-RLS-034 smoke"
      }
    });
    createdUserId = created.body?.user?.id || "";
    const testPassword = String(created.body?.temporaryPassword || "");
    assert(createdUserId, "created user id missing");
    assert(testPassword.length >= 8, "temporary password missing");

    const user = await login(testEmail, testPassword);
    await insertGenerationFixtures(createdUserId);

    log("first public reward can be claimed once");
    const first = await request(`/api/images/${encodeURIComponent(generationIds[0])}/public`, {
      method: "PATCH",
      jar: user.jar,
      csrfToken: user.csrfToken,
      expected: 200,
      label: "PATCH first generation public",
      body: { isPublic: true, publicTags: ["text-to-image"] }
    });
    assert(first.body?.generation?.publicRewardStatus === "pending", "first public reward should be pending");
    assert(Number(first.body?.generation?.publicRewardAmount || 0) > 0, "first public reward amount should be positive");

    const second = await request(`/api/images/${encodeURIComponent(generationIds[1])}/public`, {
      method: "PATCH",
      jar: user.jar,
      csrfToken: user.csrfToken,
      expected: 200,
      label: "PATCH second generation public",
      body: { isPublic: true, publicTags: ["text-to-image"] }
    });
    assert(second.body?.generation?.publicRewardStatus !== "pending", "second public image should not get another pending reward");

    const rewardLedger = await request(`/api/admin/users/${encodeURIComponent(createdUserId)}/reward-ledger?limit=20`, {
      jar: admin.jar,
      expected: 200,
      label: "GET user reward ledger"
    });
    const firstPublicRewards = (rewardLedger.body?.rewards || []).filter((item) => item.rewardType === "first_public");
    assert(firstPublicRewards.length === 1, `expected exactly one first_public reward ledger row, got ${firstPublicRewards.length}`);
    assert(firstPublicRewards[0]?.status === "pending", "first public reward ledger should be pending");

    log("manual credit adjustment writes ledger");
    await request(`/api/admin/users/${encodeURIComponent(createdUserId)}`, {
      method: "PATCH",
      jar: admin.jar,
      csrfToken: admin.csrfToken,
      expected: 200,
      label: "PATCH user credit delta",
      body: { creditDelta: 7, note: "AIS-RLS-034 smoke adjustment" }
    });
    const creditLedger = await request(`/api/admin/users/${encodeURIComponent(createdUserId)}/credit-ledger?limit=20`, {
      jar: admin.jar,
      expected: 200,
      label: "GET user credit ledger"
    });
    const adjustment = (creditLedger.body?.ledger || []).find((item) =>
      item.source === "admin_adjustment" && Number(item.delta) === 7 && item.note === "AIS-RLS-034 smoke adjustment"
    );
    assert(Boolean(adjustment), "manual admin credit adjustment ledger row missing");
    assert(adjustment?.actorUserId === admin.user?.id, "credit adjustment actor should be admin user");

    log("disabled user cannot continue publishing");
    await request(`/api/admin/users/${encodeURIComponent(createdUserId)}`, {
      method: "PATCH",
      jar: admin.jar,
      csrfToken: admin.csrfToken,
      expected: 200,
      label: "PATCH user disabled",
      body: { status: "disabled", note: "AIS-RLS-034 smoke disable" }
    });
    const blocked = await request(`/api/images/${encodeURIComponent(generationIds[2])}/public`, {
      method: "PATCH",
      jar: user.jar,
      csrfToken: user.csrfToken,
      label: "disabled user PATCH public",
      body: { isPublic: true, publicTags: ["text-to-image"] }
    });
    assert([401, 403].includes(blocked.response.status), `disabled user publish status=${blocked.response.status}, expected 401/403`);

    const filteredUsers = await request(`/api/admin/users?search=${encodeURIComponent(testEmail)}&status=disabled&role=user&rewardStatus=pending&limit=20`, {
      jar: admin.jar,
      expected: 200,
      label: "GET filtered admin users"
    });
    const found = (filteredUsers.body?.users || []).find((item) => item.id === createdUserId);
    assert(Boolean(found), "filtered admin users should include disabled user with pending first-public reward");
    assert(found?.firstPublicRewardStatus === "pending", "filtered user should expose first public reward status");
  } finally {
    await cleanup();
  }

  if (failures.length) {
    throw new Error(`${failures.length} RLS-034 smoke assertion(s) failed`);
  }
  log("ok");
}

main().catch(async (error) => {
  console.error("[rls034-smoke] ERROR:", error.message || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
