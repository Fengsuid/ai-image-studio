import mysql from "mysql2/promise";
import crypto from "crypto";

const base = String(process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const promptIdArg = String(process.env.PROMPT_LIKE_SMOKE_PROMPT_ID || process.argv[3] || "").trim();
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `prompt-like-smoke-${runId}@example.invalid`;
const password = `PromptLike-${runId.slice(0, 8)}!`;
const name = "Prompt Like Smoke";
const jar = new Map();
let csrfToken = "";
let promptId = promptIdArg;

function log(...args) {
  console.log("[prompt-like-smoke]", ...args);
}

function storeCookies(headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  for (const header of values) {
    const [pair] = String(header).split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(path, { method = "GET", body, expected = 200 } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  const cookies = cookieHeader();
  if (cookies) headers.Cookie = cookies;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  storeCookies(response.headers);
  const data = await response.json().catch(() => ({}));
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (response.status !== expected) {
    throw new Error(`${method} ${path} expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function choosePromptId() {
  if (promptId) return promptId;
  const data = await request("/api/prompts?limit=1");
  promptId = String(data.prompts?.[0]?.id || "");
  if (!promptId) throw new Error("No prompt available for prompt like smoke");
  return promptId;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio"
  };
}

async function cleanup() {
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    const [users] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    const userId = users[0]?.id || "";
    if (userId) {
      await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
    }
    if (promptId) {
      await connection.execute(
        "UPDATE prompts SET like_count = (SELECT COUNT(*) FROM prompt_likes WHERE prompt_id = ?) WHERE id = ?",
        [promptId, promptId]
      );
    }
    log("cleanup ok");
  } catch (error) {
    log("cleanup skipped:", error.message);
  } finally {
    await connection?.end().catch(() => {});
  }
}

function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(value, salt, iterations, 32, "sha256").toString("hex");
  return { salt, iterations, hash };
}

async function createActiveSmokeUser() {
  const passwordHash = hashPassword(password);
  const id = `usr_${crypto.randomBytes(10).toString("hex")}`;
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig());
    const now = new Date();
    await connection.execute(
      `INSERT INTO users
        (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', 0, ?, ?)`,
      [id, name, email, passwordHash.salt, passwordHash.iterations, passwordHash.hash, now, now]
    );
    log("created active smoke user through database fallback");
  } finally {
    await connection?.end().catch(() => {});
  }
}

async function loginSmokeUser() {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
  assert(data.user?.email === email, "smoke user login email mismatch");
}

async function main() {
  log("base =", base);
  await request("/api/auth/me");
  try {
    const me = await request("/api/auth/register", {
      method: "POST",
      expected: 201,
      body: { email, password, name }
    });
    assert(me.user?.email === email, "registered user email mismatch");
    if (me.pendingApproval) {
      log("registration requires approval; switching to database fallback user");
      await cleanup();
      await createActiveSmokeUser();
      await loginSmokeUser();
    }
  } catch (error) {
    log(`registration unavailable (${error.message}); switching to database fallback user`);
    await cleanup();
    await createActiveSmokeUser();
    await loginSmokeUser();
  }

  const id = await choosePromptId();
  log("prompt =", id);

  const normalized = await request(`/api/prompts/${encodeURIComponent(id)}/like`, {
    method: "POST",
    body: { liked: false }
  });
  const baseline = Number(normalized.prompt?.likeCount || 0);

  const liked = await request(`/api/prompts/${encodeURIComponent(id)}/like`, {
    method: "POST",
    body: { liked: true }
  });
  assert(liked.prompt?.likedByCurrentUser === true, "likedByCurrentUser should be true after like");
  assert(Number(liked.prompt?.likeCount || 0) === baseline + 1, "like should increment count once");

  const likedAgain = await request(`/api/prompts/${encodeURIComponent(id)}/like`, {
    method: "POST",
    body: { liked: true }
  });
  assert(likedAgain.prompt?.likedByCurrentUser === true, "likedByCurrentUser should stay true after duplicate like");
  assert(Number(likedAgain.prompt?.likeCount || 0) === baseline + 1, "duplicate like should not increment count");

  const unliked = await request(`/api/prompts/${encodeURIComponent(id)}/like`, {
    method: "POST",
    body: { liked: false }
  });
  assert(unliked.prompt?.likedByCurrentUser === false, "likedByCurrentUser should be false after unlike");
  assert(Number(unliked.prompt?.likeCount || 0) === baseline, "unlike should restore baseline count");

  log("OK: like/unlike/idempotency passed");
}

main()
  .catch((error) => {
    console.error("[prompt-like-smoke] failed:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
