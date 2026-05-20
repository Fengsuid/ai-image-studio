#!/usr/bin/env node
// Smoke test for AIS-RLS-036 gallery moderation, reports, notifications, and withdrawal review.
// Requires a running server and admin credentials:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke/check-moderation-withdrawal.mjs http://127.0.0.1:3000

import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://127.0.0.1:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const ownerEmail = `codex-rls036-owner-${runId}@example.test`;
const reporterEmail = `codex-rls036-reporter-${runId}@example.test`;
const reportGenerationId = `g36r${runId}`;
const withdrawalGenerationId = `g36w${runId}`;
const generationIds = [reportGenerationId, withdrawalGenerationId];
const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);
const generatedDir = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "generated");
const failures = [];
const created = {
  ownerId: "",
  ownerPassword: "",
  reporterId: "",
  reporterPassword: ""
};

function log(...parts) {
  console.log("[rls036-smoke]", ...parts);
}

function fail(message) {
  failures.push(message);
  console.error("[rls036-smoke] FAIL:", message);
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

async function createManagedUser(admin, { email, name }) {
  const response = await request("/api/admin/users", {
    method: "POST",
    jar: admin.jar,
    csrfToken: admin.csrfToken,
    expected: 201,
    label: `POST /api/admin/users ${email}`,
    body: {
      email,
      name,
      role: "user",
      status: "active",
      credits: 2,
      generatePassword: true,
      note: "AIS-RLS-036 smoke"
    }
  });
  const userId = response.body?.user?.id || "";
  const password = String(response.body?.temporaryPassword || "");
  assert(userId, `created user id missing for ${email}`);
  assert(password.length >= 8, `temporary password missing for ${email}`);
  return { userId, password };
}

async function writeFixtureFiles() {
  await fs.mkdir(generatedDir, { recursive: true });
  await Promise.all(generationIds.map((id) => fs.writeFile(path.join(generatedDir, `${id}.png`), fixturePng)));
}

async function insertGenerationFixtures(ownerId, windowHours) {
  const connection = await mysqlConnection();
  try {
    const now = new Date();
    const olderThanWindow = new Date(Date.now() - (Math.max(1, Number(windowHours) || 12) + 2) * 60 * 60 * 1000);
    const rows = [
      {
        id: reportGenerationId,
        prompt: `AIS-RLS-036 reported image fixture ${runId}`,
        publishedAt: now,
        createdAt: now
      },
      {
        id: withdrawalGenerationId,
        prompt: `AIS-RLS-036 withdrawal image fixture ${runId}`,
        publishedAt: olderThanWindow,
        createdAt: olderThanWindow
      }
    ];
    for (const row of rows) {
      await connection.execute(
        `INSERT INTO generations
          (id, user_id, prompt, model, size, quality, background, output_format, filename, is_public, published_at, public_tags_json, created_at)
         VALUES (?, ?, ?, 'smoke-model', '1024x1024', 'auto', 'auto', 'png', ?, 1, ?, ?, ?)`,
        [
          row.id,
          ownerId,
          row.prompt,
          `${row.id}.png`,
          row.publishedAt,
          JSON.stringify(["text-to-image"]),
          row.createdAt
        ]
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
  try {
    if (connection) {
      await connection.execute(
        `DELETE FROM announcements
          WHERE metadata_json LIKE ?
             OR metadata_json LIKE ?
             OR title LIKE '[smoke] AIS-RLS-036%'`,
        [`%${reportGenerationId}%`, `%${withdrawalGenerationId}%`]
      );
      await connection.execute(
        `DELETE FROM admin_audit_logs
          WHERE target_id IN (${generationIds.map(() => "?").join(",")})
             OR details_json LIKE ?`,
        [...generationIds, `%${runId}%`]
      );
      await connection.execute(
        `DELETE FROM generations WHERE id IN (${generationIds.map(() => "?").join(",")})`,
        generationIds
      );
      await connection.execute("DELETE FROM users WHERE email IN (?, ?)", [ownerEmail, reporterEmail]);
    }
  } catch (error) {
    fail(`cleanup failed: ${error.message || error}`);
  } finally {
    await connection?.end().catch(() => null);
    await Promise.all(generationIds.map((id) => fs.rm(path.join(generatedDir, `${id}.png`), { force: true }).catch(() => null)));
  }
}

async function unreadFor(session, label) {
  const response = await request("/api/announcements/unread?limit=80", {
    jar: session.jar,
    expected: 200,
    label: `GET unread announcements ${label}`
  });
  return response.body?.announcements || [];
}

function hasNotice(announcements, { type, generationId, action, decision, title }) {
  return announcements.some((item) => {
    const metadata = item.metadata || {};
    if (type && metadata.type !== type) return false;
    if (generationId && String(metadata.generationId) !== String(generationId)) return false;
    if (action && metadata.action !== action) return false;
    if (decision && metadata.decision !== decision) return false;
    if (title && item.title !== title) return false;
    return true;
  });
}

async function generationRow(id) {
  const connection = await mysqlConnection();
  try {
    const [rows] = await connection.execute(
      "SELECT id, is_public, moderation_status, report_count, withdrawal_status FROM generations WHERE id = ? LIMIT 1",
      [id]
    );
    return rows[0] || null;
  } finally {
    await connection.end().catch(() => null);
  }
}

async function pendingReportRows(id) {
  const connection = await mysqlConnection();
  try {
    const [rows] = await connection.execute(
      "SELECT id, status, handled_by FROM generation_reports WHERE generation_id = ? ORDER BY id DESC",
      [id]
    );
    return rows;
  } finally {
    await connection.end().catch(() => null);
  }
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for AIS-RLS-036 smoke");
  }

  log(`base = ${baseUrl}`);
  log(`run = ${runId}`);

  try {
    await cleanup();
    const publicSettings = await request("/api/settings", { expected: 200, label: "GET /api/settings" });
    const windowHours = Number(publicSettings.body?.publicWithdrawalWindowHours || 12);
    assert(windowHours >= 1, "publicWithdrawalWindowHours should be exposed to clients");

    const admin = await login(adminEmail, adminPassword);
    assert(admin.user?.role === "admin", "admin login should have admin role");

    const owner = await createManagedUser(admin, { email: ownerEmail, name: `RLS036 owner ${runId}` });
    created.ownerId = owner.userId;
    created.ownerPassword = owner.password;
    const reporter = await createManagedUser(admin, { email: reporterEmail, name: `RLS036 reporter ${runId}` });
    created.reporterId = reporter.userId;
    created.reporterPassword = reporter.password;

    const ownerSession = await login(ownerEmail, created.ownerPassword);
    const reporterSession = await login(reporterEmail, created.reporterPassword);

    await writeFixtureFiles();
    await insertGenerationFixtures(created.ownerId, windowHours);

    log("public gallery detail is initially visible");
    await request(`/api/gallery/${encodeURIComponent(reportGenerationId)}`, {
      jar: reporterSession.jar,
      expected: 200,
      label: "GET report fixture before moderation"
    });

    log("report creates queue record and user notifications");
    const reported = await request(`/api/images/${encodeURIComponent(reportGenerationId)}/report`, {
      method: "POST",
      jar: reporterSession.jar,
      csrfToken: reporterSession.csrfToken,
      expected: 202,
      label: "POST image report",
      body: { reason: "policy_review", description: `AIS-RLS-036 smoke report ${runId}` }
    });
    assert(reported.body?.generation?.moderationStatus === "reported", "reported generation should enter reported status");
    assert(Number(reported.body?.generation?.reportCount || 0) >= 1, "reported generation should count reports");

    const ownerReportNotices = await unreadFor(ownerSession, "owner after report");
    const reporterReportNotices = await unreadFor(reporterSession, "reporter after report");
    assert(hasNotice(ownerReportNotices, { type: "generation_report_submitted", generationId: reportGenerationId }), "owner report notification missing");
    assert(hasNotice(reporterReportNotices, { type: "generation_report_submitted", generationId: reportGenerationId }), "reporter report confirmation missing");

    const reportQueue = await request("/api/admin/reports?status=queue&limit=50", {
      jar: admin.jar,
      expected: 200,
      label: "GET admin report queue"
    });
    const queueItem = (reportQueue.body?.reports || []).find((item) => item.id === reportGenerationId);
    assert(Boolean(queueItem), "admin report queue should include reported generation");
    assert(queueItem?.latestReportReason === "policy_review", "admin report queue should expose latest report reason");

    log("admin hide resolves report and removes public visibility");
    await request(`/api/admin/public-images/${encodeURIComponent(reportGenerationId)}/moderation`, {
      method: "PATCH",
      jar: admin.jar,
      csrfToken: admin.csrfToken,
      expected: 200,
      label: "PATCH admin hide reported generation",
      body: { action: "hide", reason: `AIS-RLS-036 hide ${runId}` }
    });
    const hiddenRow = await generationRow(reportGenerationId);
    assert(hiddenRow?.moderation_status === "hidden", "hidden generation should have moderation_status=hidden");
    const reportRows = await pendingReportRows(reportGenerationId);
    assert(reportRows.some((row) => row.status === "resolved" && row.handled_by === admin.user?.id), "report should be resolved by admin");
    await request(`/api/gallery/${encodeURIComponent(reportGenerationId)}`, {
      jar: reporterSession.jar,
      expected: 404,
      label: "GET hidden generation as public gallery detail"
    });
    const ownerModerationNotices = await unreadFor(ownerSession, "owner after hide");
    const reporterModerationNotices = await unreadFor(reporterSession, "reporter after hide");
    assert(hasNotice(ownerModerationNotices, { type: "generation_moderation", generationId: reportGenerationId, action: "hide" }), "owner hide notification missing");
    assert(hasNotice(reporterModerationNotices, { type: "generation_moderation", generationId: reportGenerationId, action: "hide" }), "reporter hide resolution notification missing");

    log("older public work submits withdrawal request");
    const withdrawal = await request(`/api/images/${encodeURIComponent(withdrawalGenerationId)}/withdrawal`, {
      method: "POST",
      jar: ownerSession.jar,
      csrfToken: ownerSession.csrfToken,
      expected: 202,
      label: "POST older image withdrawal request",
      body: { reason: `AIS-RLS-036 withdrawal ${runId}` }
    });
    assert(withdrawal.body?.direct === false, "older public image should require admin withdrawal review");
    assert(withdrawal.body?.generation?.withdrawalStatus === "requested", "withdrawal status should be requested");
    const ownerWithdrawalNotices = await unreadFor(ownerSession, "owner after withdrawal request");
    assert(hasNotice(ownerWithdrawalNotices, { type: "generation_withdrawal", generationId: withdrawalGenerationId }), "owner withdrawal request notification missing");

    const withdrawals = await request("/api/admin/withdrawals?limit=50", {
      jar: admin.jar,
      expected: 200,
      label: "GET admin withdrawals"
    });
    assert((withdrawals.body?.requests || []).some((item) => item.id === withdrawalGenerationId), "admin withdrawals should include requested generation");

    log("admin approval unpublishes work and notifies author");
    await request(`/api/admin/withdrawals/${encodeURIComponent(withdrawalGenerationId)}`, {
      method: "PATCH",
      jar: admin.jar,
      csrfToken: admin.csrfToken,
      expected: 200,
      label: "PATCH approve withdrawal",
      body: { decision: "approved", reason: `AIS-RLS-036 approve ${runId}` }
    });
    const approvedRow = await generationRow(withdrawalGenerationId);
    assert(Number(approvedRow?.is_public || 0) === 0, "approved withdrawal should set is_public=0");
    assert(approvedRow?.withdrawal_status === "approved", "withdrawal status should be approved");
    await request(`/api/gallery/${encodeURIComponent(withdrawalGenerationId)}`, {
      jar: reporterSession.jar,
      expected: 404,
      label: "GET approved withdrawal gallery detail"
    });
    const ownerDecisionNotices = await unreadFor(ownerSession, "owner after withdrawal approval");
    assert(hasNotice(ownerDecisionNotices, { type: "generation_withdrawal_decision", generationId: withdrawalGenerationId, decision: "approved" }), "owner withdrawal approval notification missing");
  } finally {
    await cleanup();
  }

  if (failures.length) {
    throw new Error(`${failures.length} AIS-RLS-036 smoke assertion(s) failed`);
  }
  log("ok");
}

main().catch(async (error) => {
  console.error("[rls036-smoke] ERROR:", error?.stack || error);
  await cleanup().catch(() => null);
  process.exit(1);
});
