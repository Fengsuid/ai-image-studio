const http = require("http");
const path = require("path");
const crypto = require("crypto");
const fsSync = require("fs");
const { promises: fs } = fsSync;

const ROOT_DIR = __dirname;

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return;
  const raw = fsSync.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT_DIR, ".env"));

const store = require("./src/mysql-store");

const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, "data"));
const GENERATED_DIR = path.join(DATA_DIR, "generated");
const SOURCE_DIR = path.join(DATA_DIR, "sources");
const PORT = Number(process.env.PORT || 3000);
const APP_VERSION = process.env.APP_VERSION || "1.00";
const SERVER_STARTED_AT = new Date().toISOString();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const DEFAULT_MODEL = "GPT-IMAGE-2";
const CHECKIN_CREDIT = Number.parseInt(process.env.CHECKIN_CREDIT || "1", 10) || 1;
const DEFAULT_CONTACT_ADMIN_EMAIL = "support@example.com";
const FIRST_PUBLIC_REWARD_CREDIT = Number.parseInt(process.env.FIRST_PUBLIC_REWARD_CREDIT || "2", 10) || 2;
const PUBLIC_WITHDRAWAL_WINDOW_HOURS = Number.parseInt(process.env.PUBLIC_WITHDRAWAL_WINDOW_HOURS || "12", 10) || 12;
const OPENAI_FETCH_TIMEOUT_MS = Math.max(
  10_000,
  Number.parseInt(process.env.OPENAI_FETCH_TIMEOUT_MS || "120000", 10) || 120_000
);
const IMAGE_DOWNLOAD_TIMEOUT_MS = Math.max(
  5_000,
  Number.parseInt(process.env.IMAGE_DOWNLOAD_TIMEOUT_MS || "30000", 10) || 30_000
);
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const generationWindows = new Map();
const generationQueue = [];
const generationJobs = new Map();
const rumEvents = [];
let generationQueueRunning = 0;
const GENERATION_QUEUE_CONCURRENCY = Math.max(1, Number.parseInt(process.env.GENERATION_QUEUE_CONCURRENCY || "1", 10) || 1);
const GENERATION_QUEUE_ESTIMATE_SECONDS = Math.max(20, Number.parseInt(process.env.GENERATION_QUEUE_ESTIMATE_SECONDS || "90", 10) || 90);

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const securityHeaders = {
  "Content-Security-Policy-Report-Only": [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "script-src 'self'",
    "connect-src 'self'",
    "report-uri /api/csp-report"
  ].join("; "),
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff"
};

function withSecurityHeaders(headers = {}) {
  return { ...securityHeaders, ...headers };
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"]
]);

function httpError(message, status = 400, details) {
  return Object.assign(new Error(message), { status, details });
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = "") {
  return `${prefix}${crypto.randomBytes(12).toString("hex")}`;
}

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
  const override = String(process.env.COOKIE_SECURE || "").trim().toLowerCase();
  if (["1", "true", "yes"].includes(override)) return true;
  if (["0", "false", "no"].includes(override)) return false;

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === "https") return true;

  const host = String(req.headers.host || "").toLowerCase();
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  return process.env.NODE_ENV === "production" && !isLocalHost;
}

function sessionCookie(token, req) {
  const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
  return `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

function clearSessionCookie(req) {
  const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
  return `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function csrfCookie(token, req) {
  const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
  return `csrf=${encodeURIComponent(token)}; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

function getOrCreateCsrfToken(req) {
  const current = String(parseCookies(req.headers.cookie).csrf || "").trim();
  return /^[A-Za-z0-9_-]{32,}$/.test(current) ? current : crypto.randomBytes(24).toString("base64url");
}

function verifyCsrf(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.url?.startsWith("/api/csp-report")) return;
  const cookieToken = String(parseCookies(req.headers.cookie).csrf || "");
  const headerToken = String(req.headers["x-csrf-token"] || "");
  if (!cookieToken || !headerToken || !timingSafeEqual(cookieToken, headerToken)) {
    throw httpError("Invalid CSRF token", 403);
  }
}

async function createSession(userId) {
  const token = randomId("sess_");
  await store.createSession(hashSessionToken(token), userId, new Date(Date.now() + SESSION_TTL_MS));
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

  await store.touchSession(tokenHash, new Date(Date.now() + SESSION_TTL_MS));
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

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    credits: user.credits,
    createdAt: user.createdAt
  };
}

function getOpenAIApiKey(settings) {
  return settings.openaiApiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
}

function getOpenAIBaseUrl(settings = {}) {
  return String(settings.apiBaseUrl || process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "").trim().replace(/\/+$/, "");
}

function getConfiguredEndpoint(settings = {}, key) {
  return String(settings[key] || "").trim().replace(/\/+$/, "");
}

function getOpenAIImageEndpoint(settings = {}) {
  const explicit = getConfiguredEndpoint(settings, "endpointImages");
  if (explicit) return explicit;
  const cleanBase = getOpenAIBaseUrl(settings);
  if (!cleanBase) throw httpError("AI API base URL is not configured", 400);
  if (cleanBase.endsWith("/images/generations")) return cleanBase;
  if (cleanBase.endsWith("/v1")) return `${cleanBase}/images/generations`;
  return `${cleanBase}/v1/images/generations`;
}

function getOpenAIResponsesEndpoint(settings = {}) {
  const explicit = getConfiguredEndpoint(settings, "endpointResponses");
  if (explicit) return explicit;
  const cleanBase = getOpenAIBaseUrl(settings);
  if (!cleanBase) throw httpError("AI API base URL is not configured", 400);
  if (cleanBase.endsWith("/responses")) return cleanBase;
  if (cleanBase.endsWith("/images/generations")) return cleanBase.replace(/\/images\/generations$/, "/responses");
  if (cleanBase.endsWith("/v1")) return `${cleanBase}/responses`;
  return `${cleanBase}/v1/responses`;
}

function getOpenAIEditEndpoint(settings = {}) {
  const explicit = getConfiguredEndpoint(settings, "endpointEdits");
  if (explicit) return explicit;
  const cleanBase = getOpenAIBaseUrl(settings);
  if (!cleanBase) throw httpError("AI API base URL is not configured", 400);
  if (cleanBase.endsWith("/images/edits")) return cleanBase;
  if (cleanBase.endsWith("/images/generations")) return cleanBase.replace(/\/images\/generations$/, "/images/edits");
  if (cleanBase.endsWith("/v1")) return `${cleanBase}/images/edits`;
  return `${cleanBase}/v1/images/edits`;
}

function providerCapabilities(settings = {}) {
  const model = String(settings.model || DEFAULT_MODEL).toLowerCase();
  const configured = settings.providerCapabilityConfig && typeof settings.providerCapabilityConfig === "object"
    ? settings.providerCapabilityConfig
    : {};
  const defaults = {
    textToImage: true,
    imageEdit: true,
    multiCandidate: true,
    transparentBackground: !/dall-e-2|legacy/.test(model),
    maxImagesPerRequest: Number(configured.maxImagesPerRequest || settings.maxImagesPerRequest || 1),
    sourceTransparency: true,
    privacyDownload: true,
    passkeyAdmin: false,
    c2pa: "planned"
  };
  return { ...defaults, ...configured };
}

function routeSettingsForProvider(settings = {}, provider = null) {
  if (!provider) return { ...settings, providerCapabilityConfig: providerCapabilities(settings) };
  const capabilities = { ...providerCapabilities(settings), ...(provider.capabilities || {}) };
  return {
    ...settings,
    openaiApiKey: provider.apiKey || settings.openaiApiKey || "",
    apiBaseUrl: provider.baseUrl || settings.apiBaseUrl || "",
    model: provider.defaultModel || settings.model || DEFAULT_MODEL,
    endpointImages: provider.endpointImages || "",
    endpointResponses: provider.endpointResponses || "",
    endpointEdits: provider.endpointEdits || "",
    providerCapabilityConfig: capabilities,
    maxImagesPerRequest: Number(capabilities.maxImagesPerRequest || settings.maxImagesPerRequest || 1),
    activeProviderId: provider.id,
    activeProviderName: provider.name
  };
}

function providerCapabilityValue(capabilities = {}, key, fallback = true) {
  if (!Object.hasOwn(capabilities, key)) return fallback;
  return capabilities[key] !== false;
}

function canProviderHandle(provider, settings, request = {}) {
  const routed = routeSettingsForProvider(settings, provider);
  const capabilities = providerCapabilities(routed);
  if (provider && provider.status !== "active") return false;
  if (!getOpenAIApiKey(routed) || !getOpenAIBaseUrl(routed)) return false;
  if (request.mode === "image-edit" && !providerCapabilityValue(capabilities, "imageEdit")) return false;
  if (request.mode === "text-to-image" && !providerCapabilityValue(capabilities, "textToImage")) return false;
  if (request.transparentBackground && !providerCapabilityValue(capabilities, "transparentBackground")) return false;
  const candidateCount = Math.max(1, Number(request.candidateCount || 1));
  if (candidateCount > 1 && !providerCapabilityValue(capabilities, "multiCandidate")) return false;
  const maxImages = Number(capabilities.maxImagesPerRequest || routed.maxImagesPerRequest || 1);
  if (candidateCount > maxImages) return false;
  return true;
}

async function resolveProviderRoutes(settings = {}, request = {}) {
  const providers = await store.listProviderConfigs({ includeSecret: true }).catch((error) => {
    console.error("[provider-router] list providers failed", error);
    return [];
  });
  const defaultId = settings.defaultProviderId || "";
  const defaultProvider = defaultId ? providers.find((provider) => provider.id === defaultId) : null;
  const orderedProviders = [
    defaultProvider,
    ...providers.filter((provider) => provider && provider.id !== defaultProvider?.id)
  ].filter(Boolean);
  const routes = orderedProviders
    .filter((provider) => canProviderHandle(provider, settings, request))
    .map((provider) => ({
      provider: {
        id: provider.id,
        name: provider.name,
        providerType: provider.providerType
      },
      settings: routeSettingsForProvider(settings, provider)
    }));

  if (!routes.length && canProviderHandle(null, settings, request)) {
    routes.push({
      provider: { id: "legacy", name: "Legacy settings", providerType: "openai-compatible" },
      settings: routeSettingsForProvider(settings, null)
    });
  }
  if (!routes.length) {
    const label = request.mode === "image-edit" ? "image edit" : "text-to-image";
    throw httpError(`No active Provider can handle ${label} requests`, 400);
  }
  return routes;
}

async function markProviderHealth(provider, patch) {
  if (!provider?.id || provider.id === "legacy") return;
  await store.updateProviderHealth(provider.id, patch).catch((error) => {
    console.error("[provider-health]", error);
  });
}

function withProviderFailure(error, provider) {
  if (!provider || provider.id === "legacy") return error;
  if (!String(error.message || "").includes(provider.name)) {
    error.message = `${error.message || "Provider request failed"} (${provider.name})`;
  }
  error.details = {
    ...(error.details && typeof error.details === "object" ? error.details : {}),
    provider: {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType
    }
  };
  return error;
}

function growthConfig(settings = {}) {
  const defaults = {
    promptCollections: true,
    variableTemplates: true,
    recommendationSlots: ["home_hero", "prompt_library", "square_sidebar"],
    leaderboards: ["liked_prompts", "contributors", "public_works"],
    badges: ["first_public", "daily_creator", "prompt_curator"],
    passkeyAdminRequired: false
  };
  return { ...defaults, ...(settings.growthConfig || {}) };
}

function contactAdminEmail(settings = {}) {
  if (settings.contactAdminEmail !== undefined && settings.contactAdminEmail !== null) {
    return String(settings.contactAdminEmail || "").trim();
  }
  const email = String(process.env.CONTACT_ADMIN_EMAIL || DEFAULT_CONTACT_ADMIN_EMAIL).trim();
  return email || DEFAULT_CONTACT_ADMIN_EMAIL;
}

function rumSummary() {
  const recent = rumEvents.slice(-500);
  const metric = (name) => recent.filter((item) => item.name === name).map((item) => Number(item.value || 0));
  const avg = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  return {
    total: recent.length,
    lcp: avg(metric("LCP")),
    inp: avg(metric("INP")),
    cls: Number((avg(metric("CLS").map((value) => value * 1000)) / 1000).toFixed(3)),
    imageFailures: recent.filter((item) => item.name === "image_error").length,
    updatedAt: recent.at(-1)?.createdAt || null
  };
}

function publicSettings(settings, activeProvider = null) {
  const capabilities = activeProvider?.capabilities && Object.keys(activeProvider.capabilities).length
    ? { ...providerCapabilities(settings), ...activeProvider.capabilities }
    : providerCapabilities(settings);
  const model = activeProvider?.defaultModel || settings.model || DEFAULT_MODEL;
  return {
    hasApiKey: Boolean((activeProvider?.apiKey && activeProvider?.baseUrl) || (getOpenAIApiKey(settings) && getOpenAIBaseUrl(settings))),
    model,
    allowRegistration: Boolean(settings.allowRegistration),
    requireApproval: Boolean(settings.requireApproval),
    defaultCredits: Number(settings.defaultCredits || 0),
    generationCreditCost: normalizeGenerationCost(settings.generationCreditCost ?? 1),
    contactEmail: contactAdminEmail(settings),
    contactAdminEmail: contactAdminEmail(settings),
    checkinCredit: CHECKIN_CREDIT,
    maxImagesPerRequest: Number(settings.maxImagesPerRequest || 1),
    providerCapabilities: capabilities,
    provider: activeProvider?.providerType || "openai-compatible",
    activeProvider: activeProvider ? {
      id: activeProvider.id,
      name: activeProvider.name,
      model: activeProvider.defaultModel,
      status: activeProvider.status,
      healthStatus: activeProvider.healthStatus
    } : null,
    growth: growthConfig(settings)
  };
}

function adminSettings(settings, activeProvider = null) {
  const key = getOpenAIApiKey(settings);
  return {
    ...publicSettings(settings, activeProvider),
    apiBaseUrl: getOpenAIBaseUrl(settings),
    apiKeyMask: key ? `${key.slice(0, 7)}...${key.slice(-4)}` : "",
    growthConfig: growthConfig(settings),
    providerCapabilityConfig: providerCapabilities(settings),
    defaultProviderId: settings.defaultProviderId || activeProvider?.id || ""
  };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, withSecurityHeaders({ ...jsonHeaders, ...extraHeaders }));
  res.end(JSON.stringify(payload));
}

function sendNoContent(res, extraHeaders = {}) {
  res.writeHead(204, withSecurityHeaders({ "Cache-Control": "no-store", ...extraHeaders }));
  res.end();
}

function sendError(res, status, message, details) {
  sendJson(res, status, { error: message, details });
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw httpError("Request body is too large", 413);
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError("Invalid JSON body", 400);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function requireEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError("Please enter a valid email", 400);
  }
}

function requireOptionalEmail(email) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError("Please enter a valid email", 400);
  }
}

function requirePassword(password) {
  if (String(password || "").length < 8) {
    throw httpError("Password must be at least 8 characters", 400);
  }
}

function temporaryPassword() {
  return `Tmp-${crypto.randomBytes(9).toString("base64url")}1`;
}

function cleanPrompt(prompt) {
  const value = String(prompt || "").trim();
  if (value.length < 3) {
    throw httpError("Prompt is too short", 400);
  }
  if (value.length > 4000) {
    throw httpError("Prompt cannot exceed 4000 characters", 400);
  }
  return value;
}

function choose(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sanitizePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeGenerationCost(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 10000);
}

function cleanProviderInput(body = {}, existing = null) {
  const capabilities = body.capabilities && typeof body.capabilities === "object" ? body.capabilities : existing?.capabilities || {};
  const routing = body.routing && typeof body.routing === "object" ? body.routing : existing?.routing || {};
  const baseUrl = String(body.baseUrl ?? existing?.baseUrl ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) throw httpError("Provider baseUrl is required", 400);
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw httpError("Provider baseUrl is invalid", 400);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw httpError("Provider baseUrl must use http or https", 400);
  }
  const hasApiKeyInput = Object.hasOwn(body, "apiKey");
  const apiKeyInput = hasApiKeyInput ? String(body.apiKey || "").trim() : "";
  return {
    name: String(body.name ?? existing?.name ?? "Provider").trim().slice(0, 120) || "Provider",
    providerType: ["openai", "openai-compatible", "custom-proxy"].includes(body.providerType)
      ? body.providerType
      : existing?.providerType || "openai-compatible",
    baseUrl,
    apiKey: hasApiKeyInput && (apiKeyInput || !existing) ? apiKeyInput : existing?.apiKey || "",
    defaultModel: String(body.defaultModel ?? existing?.defaultModel ?? DEFAULT_MODEL).trim().slice(0, 120) || DEFAULT_MODEL,
    endpointImages: String(body.endpointImages ?? existing?.endpointImages ?? "").trim(),
    endpointResponses: String(body.endpointResponses ?? existing?.endpointResponses ?? "").trim(),
    endpointEdits: String(body.endpointEdits ?? existing?.endpointEdits ?? "").trim(),
    capabilities,
    routing,
    status: ["active", "disabled"].includes(body.status) ? body.status : existing?.status || "active",
    sortOrder: Number.parseInt(body.sortOrder, 10) || Number(existing?.sortOrder || 0)
  };
}

function parseOptionalDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw httpError("Date is invalid", 400);
  return date;
}

function cleanAnnouncementInput(body = {}, existing = null, { partial = false } = {}) {
  const pick = (key, fallback) => Object.hasOwn(body, key) ? body[key] : fallback;
  const title = String(pick("title", existing?.title || "") || "").trim().slice(0, 160);
  const content = String(pick("body", existing?.body || "") || "").trim().slice(0, 12000);
  if (!partial || Object.hasOwn(body, "title")) {
    if (title.length < 2) throw httpError("Announcement title is too short", 400);
  }
  if (!partial || Object.hasOwn(body, "body")) {
    if (content.length < 2) throw httpError("Announcement body is too short", 400);
  }
  const payload = {};
  if (!partial || Object.hasOwn(body, "title")) payload.title = title;
  if (!partial || Object.hasOwn(body, "body")) payload.body = content;
  if (!partial || Object.hasOwn(body, "level")) payload.level = choose(String(pick("level", existing?.level || "info")), ["info", "success", "warning", "danger", "maintenance", "feature"], "info");
  if (!partial || Object.hasOwn(body, "displayMode")) payload.displayMode = choose(String(pick("displayMode", existing?.displayMode || "feed")), ["modal", "banner", "feed"], "feed");
  if (!partial || Object.hasOwn(body, "audience")) payload.audience = choose(String(pick("audience", existing?.audience || "all")), ["all", "logged-in", "admin", "specific-users"], "all");
  if (!partial || Object.hasOwn(body, "status")) payload.status = choose(String(pick("status", existing?.status || "draft")), ["draft", "published", "archived"], "draft");
  if (!partial || Object.hasOwn(body, "isImportant")) payload.isImportant = Boolean(pick("isImportant", existing?.isImportant || false));
  if (!partial || Object.hasOwn(body, "requiresAck")) payload.requiresAck = Boolean(pick("requiresAck", existing?.requiresAck || false));
  if (!partial || Object.hasOwn(body, "startsAt")) payload.startsAt = parseOptionalDate(pick("startsAt", existing?.startsAt || ""));
  if (!partial || Object.hasOwn(body, "endsAt")) payload.endsAt = parseOptionalDate(pick("endsAt", existing?.endsAt || ""));
  if (!partial || Object.hasOwn(body, "metadata")) payload.metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : existing?.metadata || {};
  if (!partial || Object.hasOwn(body, "targetUserIds")) {
    const values = Array.isArray(body.targetUserIds)
      ? body.targetUserIds
      : String(body.targetUserIds || "").split(/[,\s]+/);
    payload.targetUserIds = values.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 200);
  }
  return payload;
}

function normalizeImageSize(value) {
  const raw = String(value || "auto").trim().toLowerCase();
  if (raw === "auto") return "auto";
  const match = raw.match(/^(\d{3,4})x(\d{3,4})$/);
  if (!match) {
    throw httpError("Invalid image size. Use auto or WIDTHxHEIGHT, for example 2048x2048.", 400);
  }
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  const pixels = width * height;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  if (width > 3840 || height > 3840) {
    throw httpError("Image size cannot exceed 3840x3840.", 400);
  }
  if (width % 16 !== 0 || height % 16 !== 0) {
    throw httpError("Image width and height must be multiples of 16.", 400);
  }
  if (pixels < 655360 || pixels > 8294400) {
    throw httpError("Image pixels must be between 655,360 and 8,294,400.", 400);
  }
  if (longSide / shortSide > 3) {
    throw httpError("Image aspect ratio cannot exceed 3:1.", 400);
  }
  return `${width}x${height}`;
}

function ensureAdmin(current) {
  if (!current?.user || current.user.role !== "admin") {
    throw httpError("Admin permission required", 403);
  }
}

async function writeAdminAudit(current, req, action, targetType, targetId, detail = {}) {
  await store.writeAdminAuditLog({
    actorUserId: current?.user?.id || null,
    action,
    targetType,
    targetId,
    detail,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req)
  }).catch((error) => console.error("[admin-audit]", error));
}

function ensureAuthenticated(current) {
  if (!current?.user) {
    throw httpError("Please sign in first", 401);
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
  return Boolean(
    generation?.isPublic &&
    !generation.archived &&
    ["visible", "restored"].includes(generation.moderationStatus || "visible")
  );
}

function auditPayload(audit) {
  if (!audit) return null;
  return {
    id: audit.id,
    generationId: audit.generationId || "",
    requestedMode: audit.requestedMode || "text-to-image",
    resultLevel: audit.resultLevel || "low",
    resultAction: audit.resultAction || "allow",
    requiredMode: audit.requiredMode || "",
    status: audit.status || "allowed",
    score: Number(audit.score || 0),
    method: audit.method || "",
    matchedPromptId: audit.matchedPromptId || null,
    matchedPromptTitle: audit.matchedPromptTitle || "",
    matchedGenerationId: audit.matchedGenerationId || "",
    overrideAction: audit.overrideAction || "",
    overrideNote: audit.overrideNote || "",
    createdAt: audit.createdAt || null
  };
}

function isImageToImagePublish(generation, body = {}, patch = {}) {
  return Boolean(
    generation?.sourceFilename ||
    generation?.sourceImageId ||
    body.sourceImageData ||
    body.sourceImageUrl ||
    body.sourceImageId ||
    patch.sourceFilename ||
    patch.sourceImageId ||
    body.publishOriginal === true
  );
}

function sourceImageUrlForGeneration(generation, { includePrivateSource = false } = {}) {
  if (!generation) return "";
  if (generation.sourceFilename && (includePrivateSource || generation.publishOriginal)) return `/api/images/${generation.id}/source-file`;
  if (generation.sourceImageId) return `/api/images/${generation.sourceImageId}/file`;
  return "";
}

function sourceImageAuditFields(generation) {
  return {
    sourceImageId: generation?.sourceImageId || "",
    sourcePrompt: generation?.sourcePrompt || "",
    originGalleryId: generation?.originGalleryId || generation?.sourceImageId || ""
  };
}

function requestedSourceImageId(body = {}) {
  return String(body.sourceImageId || body.originGalleryId || "").trim();
}

async function resolvePublishSourceImage({ body = {}, generation }) {
  const sourceImageId = requestedSourceImageId(body);
  if (!sourceImageId) return null;
  if (String(sourceImageId) === String(generation?.id || "")) {
    throw httpError("Source image must be an existing public gallery image", 400);
  }
  const source = await store.getGenerationById(sourceImageId);
  if (!source || !isPubliclyVisibleGeneration(source)) {
    throw httpError("Source image must be an existing public gallery image", 404);
  }
  return source;
}

async function enforcePromptPublishAudit({ current, req, generation, body = {}, patch = {}, requestedMode = "" }) {
  const mode = requestedMode || (isImageToImagePublish(generation, body, patch) ? "image-to-image" : "text-to-image");
  const audit = await store.auditPromptForPublish({
    prompt: generation.prompt,
    generationId: generation.id,
    userId: generation.userId,
    requestedMode: mode,
    persist: true
  });
  const blocked = audit.requiredMode === "image-to-image" && mode !== "image-to-image";
  if (blocked) {
    await writeAdminAudit(current, req, "prompt_audit_block_publish", "generation", generation.id, {
      auditId: audit.id,
      score: audit.score,
      method: audit.method,
      requiredMode: audit.requiredMode,
      matchedPromptId: audit.matchedPromptId,
      matchedGenerationId: audit.matchedGenerationId
    });
    throw httpError("Prompt is too similar to existing public prompt; publish as image-to-image instead", 409, {
      requiredMode: "image-to-image",
      audit: auditPayload(audit)
    });
  }
  const hasSourceImage = Boolean(
    patch.sourceImageId ||
    generation.sourceImageId ||
    patch.sourceFilename ||
    generation.sourceFilename ||
    body.sourceImageData ||
    body.sourceImageUrl
  );
  if (audit.requiredMode === "image-to-image" && mode === "image-to-image" && !hasSourceImage) {
    await writeAdminAudit(current, req, "prompt_audit_missing_source_image", "generation", generation.id, {
      auditId: audit.id,
      score: audit.score,
      method: audit.method,
      requiredMode: audit.requiredMode,
      matchedPromptId: audit.matchedPromptId,
      matchedGenerationId: audit.matchedGenerationId
    });
    throw httpError("Prompt is too similar to existing public prompt; bind an existing gallery source image", 409, {
      requiredMode: "image-to-image",
      sourceImageRequired: true,
      audit: auditPayload(audit)
    });
  }
  return audit;
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "";
}

function getUserAgent(req) {
  return String(req.headers["user-agent"] || "").slice(0, 512);
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

// 把 HTTP 请求的"客户端关闭"信号转换成 AbortController，让 OpenAI fetch 能跟着断开。
// 调用方在最终 finally 里执行 detach()，避免残留 listener。
function attachRequestAbortController(req) {
  const controller = new AbortController();
  let aborted = false;
  const onAbort = () => {
    if (aborted) return;
    aborted = true;
    controller.abort(new Error("client aborted"));
  };
  // Node http: 'aborted' 是 client 中断；'close' 是连接关闭；任一都视为取消信号。
  req.on?.("aborted", onAbort);
  req.on?.("close", onAbort);
  return {
    signal: controller.signal,
    isAborted: () => aborted || controller.signal.aborted,
    detach: () => {
      req.off?.("aborted", onAbort);
      req.off?.("close", onAbort);
    }
  };
}

async function fetchWithTimeout(label, url, init = {}, timeoutMs = OPENAI_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${label} timeout`)), timeoutMs);
  // 把外部 signal（来自 HTTP request close 或前端 abort）链接进来：
  // 一旦外部 abort，就 propagate 给 fetch；调用方需要在 catch 中区分外部取消 vs 超时。
  const external = init.signal || null;
  const onExternalAbort = () => {
    controller.abort(external?.reason || new Error(`${label} aborted`));
  };
  if (external) {
    if (external.aborted) {
      controller.abort(external.reason || new Error(`${label} aborted`));
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      // 外部触发的取消：保留 AbortError，让上层根据 generation_requests 状态决定是否退积分。
      if (external?.aborted) throw error;
      throw httpError(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`, 504);
    }
    if (error?.code === "ECONNRESET" || /fetch failed|network/i.test(String(error?.message || ""))) {
      throw httpError(`${label} network error: ${error.message || error}`, 502);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (external) external.removeEventListener("abort", onExternalAbort);
  }
}

async function callOpenAIImages(settings, payload, { signal } = {}) {
  const routes = await resolveProviderRoutes(settings, {
    mode: "text-to-image",
    candidateCount: Number(payload.n || 1),
    transparentBackground: payload.background === "transparent"
  });
  let lastError = null;
  for (const route of routes) {
    try {
      const apiKey = getOpenAIApiKey(route.settings);
      const routedPayload = { ...payload, model: route.settings.model || payload.model || DEFAULT_MODEL };
      const response = await fetchWithTimeout("OpenAI image request", getOpenAIImageEndpoint(route.settings), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(routedPayload),
        signal
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const message = data?.error?.message || "OpenAI image request failed";
        throw httpError(message, response.status, data);
      }
      await markProviderHealth(route.provider, { healthStatus: "ok", lastError: "" });
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = withProviderFailure(error, route.provider);
      await markProviderHealth(route.provider, {
        healthStatus: "error",
        lastError: String(error.message || error).slice(0, 2000)
      });
    }
  }
  throw lastError || httpError("OpenAI image request failed", 502);
}

async function callOpenAIResponses(settings, payload, { signal } = {}) {
  const routes = await resolveProviderRoutes(settings, { mode: "image-edit", candidateCount: 1 });
  let lastError = null;
  for (const route of routes) {
    try {
      const apiKey = getOpenAIApiKey(route.settings);
      const routedPayload = { ...payload, model: route.settings.model || payload.model || DEFAULT_MODEL };
      const response = await fetchWithTimeout("OpenAI image edit (responses)", getOpenAIResponsesEndpoint(route.settings), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(routedPayload),
        signal
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const message = data?.error?.message || "OpenAI image edit request failed";
        throw httpError(message, response.status, data);
      }
      await markProviderHealth(route.provider, { healthStatus: "ok", lastError: "" });
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = withProviderFailure(error, route.provider);
      await markProviderHealth(route.provider, {
        healthStatus: "error",
        lastError: String(error.message || error).slice(0, 2000)
      });
    }
  }
  throw lastError || httpError("OpenAI image edit request failed", 502);
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw httpError("Invalid image data", 400);
  const mime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    throw httpError(`Unsupported image type: ${mime}. Allowed: PNG/JPEG/WebP.`, 400);
  }
  const buffer = Buffer.from(match[2], "base64");
  const detected = detectImageMime(buffer);
  if (!detected || detected !== normalizeImageMime(mime)) {
    throw httpError("Image content does not match the declared MIME type", 400);
  }
  return new Blob([buffer], { type: detected });
}

function normalizeImageMime(mime) {
  return String(mime || "").toLowerCase() === "image/jpg" ? "image/jpeg" : String(mime || "").toLowerCase();
}

function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  return "";
}

function validateImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw httpError("Invalid image data", 400);
  const declared = normalizeImageMime(match[1]);
  if (!ALLOWED_IMAGE_MIME.has(declared)) {
    throw httpError(`Unsupported image type: ${declared}. Allowed: PNG/JPEG/WebP.`, 400);
  }
  const buffer = Buffer.from(match[2], "base64");
  const detected = detectImageMime(buffer);
  if (!detected || detected !== declared) {
    throw httpError("Image content does not match the declared MIME type", 400);
  }
  return { buffer, mime: detected, base64: match[2] };
}

async function imageSourceToBlob(source) {
  const sourceValue = String(source || "").trim();
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(sourceValue)) {
    throw httpError(
      "Editable image must be uploaded as PNG/JPEG/WebP image data. Please re-upload or choose the image again.",
      400
    );
  }
  return dataUrlToBlob(sourceValue);
}

async function callOpenAIImageEdits(settings, payload, { signal } = {}) {
  const routes = await resolveProviderRoutes(settings, { mode: "image-edit", candidateCount: Number(payload.n || 1) });
  const imageBlob = await imageSourceToBlob(payload.imageData);
  const maskBlob = payload.maskData?.startsWith("data:image/") ? dataUrlToBlob(payload.maskData) : null;
  let lastError = null;
  for (const route of routes) {
    try {
      const apiKey = getOpenAIApiKey(route.settings);
      const form = new FormData();
      form.set("model", route.settings.model || payload.model || DEFAULT_MODEL);
      form.set("prompt", payload.prompt);
      form.set("n", String(payload.n || 1));
      form.set("size", payload.size || "auto");
      form.set("response_format", "url");
      form.set("image", imageBlob, "image.png");
      if (maskBlob) {
        form.set("mask", maskBlob, "mask.png");
      }

      const response = await fetchWithTimeout("OpenAI image edits", getOpenAIEditEndpoint(route.settings), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form,
        signal
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const message = data?.error?.message || "OpenAI image edit request failed";
        throw httpError(message, response.status, data);
      }
      await markProviderHealth(route.provider, { healthStatus: "ok", lastError: "" });
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = withProviderFailure(error, route.provider);
      await markProviderHealth(route.provider, {
        healthStatus: "error",
        lastError: String(error.message || error).slice(0, 2000)
      });
    }
  }
  throw lastError || httpError("OpenAI image edit request failed", 502);
}

function extractImageItems(openaiResult) {
  const directItems = Array.isArray(openaiResult.data) ? openaiResult.data : [];
  const items = directItems.filter((item) => item?.b64_json || item?.url);
  const outputs = Array.isArray(openaiResult.output) ? openaiResult.output : [];

  for (const output of outputs) {
    if (output?.type === "image_generation_call" && output.result) {
      const result = String(output.result);
      items.push(result.startsWith("http") ? { url: result } : { b64_json: result.replace(/^data:image\/\w+;base64,/, "") });
    }
    const content = Array.isArray(output?.content) ? output.content : [];
    for (const part of content) {
      if (part?.type === "output_image" && part.image_base64) {
        items.push({ b64_json: String(part.image_base64).replace(/^data:image\/\w+;base64,/, "") });
      }
      if (part?.type === "output_image" && part.image_url) {
        items.push({ url: String(part.image_url) });
      }
    }
  }

  const toolCalls = openaiResult.choices?.[0]?.message?.tool_calls || [];
  for (const call of toolCalls) {
    if (call?.result) items.push({ b64_json: String(call.result).replace(/^data:image\/\w+;base64,/, "") });
    try {
      const args = JSON.parse(call?.function?.arguments || "{}");
      if (args.result || args.image) {
        const result = String(args.result || args.image);
        items.push(result.startsWith("http") ? { url: result } : { b64_json: result.replace(/^data:image\/\w+;base64,/, "") });
      }
    } catch {
      // Ignore unknown proxy formats.
    }
  }

  return items;
}

function extensionFromContentType(contentType, fallback) {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("image/jpeg") || normalized.includes("image/jpg")) return "jpg";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/png")) return "png";
  return fallback === "jpeg" ? "jpg" : fallback;
}

async function imageItemToBuffer(item, request) {
  const fallbackExtension = request.output_format === "jpeg" ? "jpg" : request.output_format;
  if (item.b64_json) {
    const value = String(item.b64_json);
    const match = value.match(/^data:(image\/[^;]+);base64,(.+)$/);
    return {
      buffer: Buffer.from(match ? match[2] : value, "base64"),
      extension: match ? extensionFromContentType(match[1], fallbackExtension) : fallbackExtension
    };
  }
  if (item.url) {
    const response = await fetchWithTimeout(
      "Image URL download",
      item.url,
      {},
      IMAGE_DOWNLOAD_TIMEOUT_MS
    );
    if (!response.ok) {
      throw httpError(`Image URL download failed: ${response.status}`, 502);
    }
    const contentType = response.headers.get("content-type") || "";
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      extension: extensionFromContentType(contentType, fallbackExtension)
    };
  }
  return null;
}

function sanitizeConversationRoute(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((step, index) => ({
    index: index + 1,
    id: String(step?.id || "").slice(0, 64),
    prompt: String(step?.prompt || "").trim().slice(0, 1200),
    imageUrl: String(step?.imageUrl || step?.images?.[0] || "").slice(0, 500),
    type: String(step?.type || "image").slice(0, 32),
    createdAt: String(step?.createdAt || step?.time || "").slice(0, 64)
  })).filter((step) => step.prompt || step.imageUrl);
}

function sanitizePublicTags(value) {
  const input = Array.isArray(value)
    ? value
    : String(value || "").split(/[,，、#\s]+/);
  const seen = new Set();
  return input
    .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 24))
    .filter((tag) => /^[\p{L}\p{N}_\-\u4e00-\u9fff]+$/u.test(tag))
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

const PUBLIC_KIND_TAGS = {
  text: "text-to-image",
  image: "image-to-image"
};

const PUBLIC_KIND_TAG_META = {
  [PUBLIC_KIND_TAGS.text]: {
    labelZh: "文生图",
    labelEn: "Text-to-image",
    aliases: ["文生图", "text-to-image", "txt2img"],
    sortOrder: 1
  },
  [PUBLIC_KIND_TAGS.image]: {
    labelZh: "图生图",
    labelEn: "Image-to-image",
    aliases: ["图生图", "image-to-image", "img2img"],
    sortOrder: 2
  }
};

// 把 sanitizePublicTags 的结果再过一次 gallery_tags：
// - 命中 active slug / 别名 → 用 slug；
// - 未命中 → 如 autoCreate=true，仅用于后台或迁移场景自动创建 source='user' tag；
// - 如果 incrementUsage=true，对每个 slug bump 一次 usage_count。
function slugifyForUserTag(raw) {
  const ascii = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (TAG_SLUG_PATTERN.test(ascii)) return ascii;
  // 全是非 ASCII（如中文）：派生稳定 hash slug。
  const hash = crypto.createHash("sha1").update(String(raw || "")).digest("hex").slice(0, 6);
  return `user-${hash}`;
}

async function normalizePublicTagsToSlugs(rawTags, { autoCreate = true, incrementUsage = false } = {}) {
  const cleaned = sanitizePublicTags(rawTags);
  if (!cleaned.length) return [];
  const slugs = [];
  const seen = new Set();
  for (const raw of cleaned) {
    let tag = null;
    try {
      tag = await store.findTagByAlias(raw);
    } catch (error) {
      console.warn(`findTagByAlias failed for ${raw}: ${error.message}`);
    }
    let slug = tag?.slug;
    if (!slug && autoCreate) {
      const candidate = slugifyForUserTag(raw);
      const existing = await store.getTagBySlug(candidate).catch(() => null);
      if (existing) {
        slug = existing.slug;
        if (existing.status !== "active") {
          // 已存在但被隐藏：保留 slug 但不再激活（管理员决定）。
        }
      } else {
        try {
          const created = await store.createTag({
            slug: candidate,
            labelZh: /[\u4e00-\u9fff]/.test(raw) ? raw : "",
            labelEn: /[\u4e00-\u9fff]/.test(raw) ? "" : raw,
            aliases: [raw],
            source: "user",
            status: "active"
          });
          slug = created?.slug || candidate;
        } catch (error) {
          console.warn(`createTag failed for ${candidate}: ${error.message}`);
        }
      }
    }
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
    if (slugs.length >= 8) break;
  }
  if (incrementUsage) {
    for (const slug of slugs) {
      await store.incrementTagUsage(slug).catch((error) =>
        console.warn(`incrementTagUsage failed for ${slug}: ${error.message}`)
      );
    }
  }
  return slugs;
}

async function ensurePublicKindTag(slug) {
  const meta = PUBLIC_KIND_TAG_META[slug];
  if (!meta) return null;
  const existing = await store.getTagBySlug(slug).catch(() => null);
  if (existing) {
    if (existing.status === "active") return existing;
    return existing;
  }
  return store.createTag({
    slug,
    labelZh: meta.labelZh,
    labelEn: meta.labelEn,
    aliases: meta.aliases,
    category: "core",
    source: "system",
    status: "active",
    showInFilter: true,
    sortOrder: meta.sortOrder
  }).catch((error) => {
    console.warn(`ensurePublicKindTag failed for ${slug}: ${error.message}`);
    return null;
  });
}

function publicKindTagForGeneration(generation, fallback = PUBLIC_KIND_TAGS.text) {
  return generation?.sourceFilename || generation?.sourceImageId || generation?.sourceImageUrl || generation?.sourceImageData
    ? PUBLIC_KIND_TAGS.image
    : fallback;
}

async function normalizePublishPublicTags(rawTags, {
  kind = PUBLIC_KIND_TAGS.text,
  incrementUsage = false
} = {}) {
  const requiredKind = kind === PUBLIC_KIND_TAGS.image ? PUBLIC_KIND_TAGS.image : PUBLIC_KIND_TAGS.text;
  await ensurePublicKindTag(requiredKind);
  const userSelected = await normalizePublicTagsToSlugs(rawTags, {
    autoCreate: false,
    incrementUsage: false
  });
  const seen = new Set();
  const slugs = [];
  for (const slug of [requiredKind, ...userSelected]) {
    if (!slug || seen.has(slug)) continue;
    if ((slug === PUBLIC_KIND_TAGS.text || slug === PUBLIC_KIND_TAGS.image) && slug !== requiredKind) continue;
    seen.add(slug);
    slugs.push(slug);
    if (slugs.length >= 8) break;
  }
  if (incrementUsage) {
    for (const slug of slugs) {
      await store.incrementTagUsage(slug).catch((error) =>
        console.warn(`incrementTagUsage failed for ${slug}: ${error.message}`)
      );
    }
  }
  return slugs;
}

function sanitizePromptTags(value) {
  const input = Array.isArray(value)
    ? value
    : String(value || "").split(/[,，、#\s]+/);
  const seen = new Set();
  return input
    .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 32))
    .filter((tag) => /^[\p{L}\p{N}_\-\u4e00-\u9fff]+$/u.test(tag))
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function sanitizeUrlField(value, max = 500) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/")) return "";
  return raw.slice(0, max);
}

function buildPromptPayload(body, { partial } = { partial: false }) {
  const payload = {};
  const set = (key, transform) => {
    if (Object.hasOwn(body, key)) {
      payload[key] = transform(body[key]);
    } else if (!partial) {
      payload[key] = transform(undefined);
    }
  };
  set("title", (value) => String(value || "").trim().slice(0, 200));
  set("prompt", (value) => {
    const cleaned = String(value || "").trim();
    if (!partial && cleaned.length < 3) {
      throw httpError("Prompt content is too short", 400);
    }
    if (cleaned.length > 8000) {
      throw httpError("Prompt content is too long", 400);
    }
    return cleaned;
  });
  set("image", (value) => sanitizeUrlField(value, 500));
  set("tags", (value) => sanitizePromptTags(value));
  set("author", (value) => String(value || "").trim().slice(0, 120));
  set("source", (value) => String(value || "").trim().slice(0, 120));
  set("sourceUrl", (value) => sanitizeUrlField(value, 500));
  set("status", (value) => {
    const status = String(value || "active").trim().toLowerCase();
    return status === "hidden" ? "hidden" : "active";
  });
  set("sortOrder", (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(-1_000_000, Math.min(1_000_000, parsed));
  });
  return payload;
}

const TAG_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const CATEGORY_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/;

function sanitizeTagAliases(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[,\n]/);
  const seen = new Set();
  return list
    .map((alias) => String(alias || "").trim())
    .filter(Boolean)
    .map((alias) => alias.slice(0, 48))
    .filter((alias) => {
      const key = alias.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}

function buildTagPayload(body, { partial } = { partial: false }) {
  const payload = {};
  const set = (key, transform) => {
    if (Object.hasOwn(body, key)) {
      payload[key] = transform(body[key]);
    } else if (!partial) {
      payload[key] = transform(undefined);
    }
  };
  if (!partial) {
    const slugRaw = String(body?.slug || "").trim().toLowerCase();
    if (!TAG_SLUG_PATTERN.test(slugRaw)) {
      throw httpError("Tag slug must be 1-48 chars: a-z, 0-9, hyphen", 400);
    }
    payload.slug = slugRaw;
  }
  set("labelZh", (value) => String(value || "").trim().slice(0, 48));
  set("labelEn", (value) => String(value || "").trim().slice(0, 48));
  set("aliases", (value) => sanitizeTagAliases(value));
  set("category", (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32));
  set("source", (value) => {
    const source = String(value || "user").trim().toLowerCase();
    return ["system", "admin", "user"].includes(source) ? source : "user";
  });
  set("status", (value) => {
    const status = String(value || "active").trim().toLowerCase();
    return status === "hidden" ? "hidden" : "active";
  });
  set("hue", (value) => {
    const hue = Number.parseInt(value, 10);
    return Number.isFinite(hue) ? Math.max(0, Math.min(359, hue)) : undefined;
  });
  set("showInFilter", (value) => value !== false && value !== "false" && value !== "0");
  set("sortOrder", (value) => {
    const order = Number.parseInt(value, 10);
    return Number.isFinite(order) ? order : 0;
  });
  return payload;
}

function buildPromptCategoryPayload(body, { partial } = { partial: false }) {
  const payload = {};
  if (!partial) {
    const slug = String(body?.slug || "").trim().toLowerCase();
    if (!CATEGORY_SLUG_PATTERN.test(slug)) {
      throw httpError("Category slug must be 1-32 chars: a-z, 0-9, hyphen, underscore", 400);
    }
    payload.slug = slug;
  }
  const set = (key, transform) => {
    if (Object.hasOwn(body, key)) {
      payload[key] = transform(body[key]);
    } else if (!partial) {
      payload[key] = transform(undefined);
    }
  };
  set("labelZh", (value) => String(value || "").trim().slice(0, 48));
  set("labelEn", (value) => String(value || "").trim().slice(0, 48));
  set("descriptionZh", (value) => String(value || "").trim().slice(0, 255));
  set("descriptionEn", (value) => String(value || "").trim().slice(0, 255));
  set("status", (value) => String(value || "active").trim().toLowerCase() === "hidden" ? "hidden" : "active");
  set("sortOrder", (value) => {
    const order = Number.parseInt(value, 10);
    return Number.isFinite(order) ? order : 0;
  });
  return payload;
}

function tagSummary(tags = []) {
  const systemCount = tags.filter((tag) => tag.source === "system").length;
  const withContentCount = tags.filter((tag) => Number(tag.contentCount || 0) > 0).length;
  const emptyCount = tags.filter((tag) => Number(tag.contentCount || 0) === 0).length;
  const categoryCounts = {};
  for (const tag of tags) {
    const category = tag.category || "general";
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }
  return {
    systemCount,
    withContentCount,
    emptyCount,
    categoryCounts
  };
}

async function saveSourceImageFromData(sourceImageData) {
  const raw = String(sourceImageData || "").trim();
  if (!raw) return "";
  const validated = validateImageDataUrl(raw);
  const sourceFile = await imageItemToBuffer({ b64_json: validated.base64 }, { output_format: "png" });
  if (!sourceFile?.buffer?.length) return "";
  await fs.mkdir(SOURCE_DIR, { recursive: true });
  const id = randomId("src_");
  const extension = sourceFile.extension || "png";
  const filename = `${id}.${extension}`;
  await fs.writeFile(path.join(SOURCE_DIR, filename), sourceFile.buffer);
  return filename;
}

async function saveGeneratedImages(user, request, openaiResult) {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const items = extractImageItems(openaiResult);
  const saved = [];

  for (const item of items) {
    const imageFile = await imageItemToBuffer(item, request);
    if (!imageFile?.buffer?.length) continue;
    const id = randomId("img_");
    const extension = imageFile.extension;
    const filename = `${id}.${extension}`;
    const absolutePath = path.join(GENERATED_DIR, filename);
    await fs.writeFile(absolutePath, imageFile.buffer);

    const generation = {
      id,
      userId: user.id,
      prompt: request.prompt,
      model: request.model,
      size: request.size,
      quality: request.quality,
      background: request.background,
      outputFormat: request.output_format,
      filename,
      isPublic: Boolean(request.isPublic),
      sourceFilename: request.sourceFilename || "",
      sourceImageId: request.sourceImageId || "",
      sourcePrompt: request.sourcePrompt || "",
      originGalleryId: request.originGalleryId || "",
      publishOriginal: Boolean(request.publishOriginal && request.sourceFilename),
      conversation: sanitizeConversationRoute(request.conversation),
      publicTags: sanitizePublicTags(request.publicTags),
      revisedPrompt: item.revised_prompt || "",
      usage: openaiResult.usage || item.usage || null,
      createdAt: nowIso()
    };
    saved.push({
      ...generation,
      imageUrl: `/api/images/${id}/file`
    });
  }

  return saved;
}

function generationResponse(generation) {
  return {
    ...generation,
    imageUrl: `/api/images/${generation.id}/file`,
    sourceImageUrl: sourceImageUrlForGeneration(generation),
    ...sourceImageAuditFields(generation)
  };
}

function imageFileAbsolutePath(kind, filename) {
  const base = kind === "source" ? SOURCE_DIR : GENERATED_DIR;
  const safeName = path.basename(String(filename || ""));
  return path.join(base, safeName);
}

function imageFileRelativePath(kind, filename) {
  return `${kind === "source" ? "sources" : "generated"}/${path.basename(String(filename || ""))}`;
}

async function galleryFileCheckFor(target, kind, filename) {
  const absolutePath = imageFileAbsolutePath(kind, filename);
  const relativePath = imageFileRelativePath(kind, filename);
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      return {
        generationId: target.id,
        imageKind: kind,
        filename,
        relativePath,
        status: "broken",
        fileSize: null,
        errorMessage: "path is not a file"
      };
    }
    return {
      generationId: target.id,
      imageKind: kind,
      filename,
      relativePath,
      status: "ok",
      fileSize: stat.size,
      errorMessage: ""
    };
  } catch (error) {
    return {
      generationId: target.id,
      imageKind: kind,
      filename,
      relativePath,
      status: "broken",
      fileSize: null,
      errorMessage: error.code === "ENOENT" ? "file missing" : String(error.message || error.code || "file check failed").slice(0, 255)
    };
  }
}

async function runGalleryFileChecks({ limit = 1000 } = {}) {
  const targets = await store.listGalleryFileCheckTargets({ limit });
  const checks = [];
  for (const target of targets) {
    if (target.filename) {
      checks.push(await galleryFileCheckFor(target, "generated", target.filename));
    }
    if (target.publishOriginal && target.sourceFilename) {
      checks.push(await galleryFileCheckFor(target, "source", target.sourceFilename));
    }
  }
  const saved = [];
  for (const check of checks) {
    saved.push(await store.upsertGalleryFileCheck(check));
  }
  return {
    scanned: targets.length,
    checked: saved.length,
    broken: saved.filter((item) => item?.status === "broken").length,
    checks: saved
  };
}

function queueSnapshot(requestId) {
  const pendingIds = generationQueue.map((job) => job.id);
  const runningIds = [...generationJobs.values()]
    .filter((job) => job.status === "running")
    .map((job) => job.id);
  const queueTotal = pendingIds.length + runningIds.length;
  const pendingIndex = pendingIds.indexOf(requestId);
  const queuePosition = pendingIndex >= 0 ? pendingIndex + 1 : runningIds.includes(requestId) ? 0 : null;
  return {
    queuePosition,
    queueTotal,
    estimatedWaitSeconds: queuePosition && queuePosition > 0 ? queuePosition * GENERATION_QUEUE_ESTIMATE_SECONDS : 0
  };
}

function requestStatusPayload(request) {
  const queue = queueSnapshot(request.id);
  return {
    ...request,
    normalizedStatus: request.status === "success" ? "succeeded" : request.status,
    ...queue
  };
}

async function loadRequestGenerations(request) {
  const ids = Array.isArray(request?.generationIds) ? request.generationIds : [];
  const generations = [];
  for (const id of ids) {
    const generation = await store.getGenerationById(id).catch(() => null);
    if (generation) generations.push(generationResponse(generation));
  }
  return generations;
}

async function sendGenerationRequestStatus(req, res, requestId) {
  const current = await getCurrentUser(req);
  ensureAuthenticated(current);
  const request = await store.getGenerationRequestById(requestId);
  if (!request || (request.userId !== current.user.id && current.user.role !== "admin")) {
    throw httpError("Generation request not found", 404);
  }
  return sendJson(res, 200, {
    request: requestStatusPayload(request),
    generations: await loadRequestGenerations(request),
    credits: await store.getUserCredits(current.user.id)
  });
}

function enqueueGenerationJob(job) {
  generationJobs.set(job.id, { ...job, status: "pending" });
  generationQueue.push(generationJobs.get(job.id));
  drainGenerationQueue();
  return queueSnapshot(job.id);
}

function cancelQueuedGenerationJob(id) {
  const index = generationQueue.findIndex((job) => job.id === id);
  if (index === -1) return false;
  generationQueue.splice(index, 1);
  generationJobs.delete(id);
  return true;
}

function drainGenerationQueue() {
  while (generationQueueRunning < GENERATION_QUEUE_CONCURRENCY && generationQueue.length) {
    const job = generationQueue.shift();
    const current = generationJobs.get(job.id);
    if (!current) continue;
    current.status = "running";
    generationQueueRunning += 1;
    Promise.resolve()
      .then(() => current.run())
      .catch((error) => console.error("[generation-queue]", error))
      .finally(() => {
        generationQueueRunning = Math.max(0, generationQueueRunning - 1);
        generationJobs.delete(current.id);
        drainGenerationQueue();
      });
  }
}

async function finalizeSuccessfulGenerations({ auditId, user, request, openaiResult, requestStartedAt, expectedCount }) {
  const durationMs = Date.now() - requestStartedAt;
  const saved = (await saveGeneratedImages(user, request, openaiResult))
    .map((generation) => ({ ...generation, durationMs }));
  if (!saved.length) {
    throw httpError("OpenAI did not return a savable image", 502);
  }
  await store.insertGenerations(saved);
  if (request.isPublic && saved[0] && !(await store.hasFirstPublicReward(user.id))) {
    const rewarded = await store.updateGenerationPublic(saved[0].id, {
      publicRewardStatus: "pending",
      publicRewardAmount: FIRST_PUBLIC_REWARD_CREDIT,
      withdrawalStatus: "none"
    });
    saved[0] = { ...saved[0], ...rewarded, imageUrl: saved[0].imageUrl };
  }
  await store.updateGenerationRequest(auditId, {
    status: "succeeded",
    firstGenerationId: saved[0]?.id || "",
    generationIds: saved.map((generation) => generation.id),
    durationMs
  });
  const missing = Math.max(0, Number(expectedCount || saved.length) - saved.length);
  return { saved, durationMs, missing };
}

async function runQueuedTextGeneration({ auditId, user, settings, request, openaiRequest, totalCost, costPerImage, requestStartedAt }) {
  let reservedCredits = false;
  try {
    await store.updateGenerationRequest(auditId, { status: "running" });
    if (totalCost > 0) {
      reservedCredits = await store.reserveCredits(user.id, totalCost, {
        source: "generation_charge",
        referenceId: auditId,
        note: `${request.n} image(s)`
      });
      if (!reservedCredits) {
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          durationMs: Date.now() - requestStartedAt
        });
        return;
      }
    }
    const openaiResult = await callOpenAIImages(settings, openaiRequest);
    const { saved, missing } = await finalizeSuccessfulGenerations({
      auditId,
      user,
      request,
      openaiResult,
      requestStartedAt,
      expectedCount: request.n
    });
    reservedCredits = false;
    if (costPerImage > 0 && missing > 0) {
      await store.addCredits(user.id, costPerImage * missing, {
        source: "generation_refund",
        referenceId: auditId,
        note: "unused candidate refund"
      }).catch((error) => console.error(error));
    }
    return saved;
  } catch (error) {
    if (reservedCredits) await store.addCredits(user.id, totalCost, {
      source: "generation_error_refund",
      referenceId: auditId,
      note: "generation failed"
    }).catch((refundError) => console.error(refundError));
    await store.updateGenerationRequest(auditId, {
      status: "failed",
      errorMessage: String(error.message || error).slice(0, 2000),
      durationMs: Date.now() - requestStartedAt
    }).catch((auditError) => console.error(auditError));
  }
}

async function runQueuedImageEdit({ auditId, user, settings, request, payload, costPerImage, requestStartedAt }) {
  let reservedCredits = false;
  try {
    await store.updateGenerationRequest(auditId, { status: "running" });
    if (costPerImage > 0) {
      reservedCredits = await store.reserveCredits(user.id, costPerImage, {
        source: "generation_charge",
        referenceId: auditId,
        note: "image edit"
      });
      if (!reservedCredits) {
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          durationMs: Date.now() - requestStartedAt
        });
        return;
      }
    }
    const openaiResult = await callOpenAIImageEdits(settings, payload);
    await finalizeSuccessfulGenerations({
      auditId,
      user,
      request,
      openaiResult,
      requestStartedAt,
      expectedCount: 1
    });
    reservedCredits = false;
  } catch (error) {
    if (reservedCredits) await store.addCredits(user.id, costPerImage, {
      source: "generation_error_refund",
      referenceId: auditId,
      note: "image edit failed"
    }).catch((refundError) => console.error(refundError));
    await store.updateGenerationRequest(auditId, {
      status: "failed",
      errorMessage: String(error.message || error).slice(0, 2000),
      durationMs: Date.now() - requestStartedAt
    }).catch((auditError) => console.error(auditError));
  }
}

async function routeApi(req, res, url) {
  await store.awardMaturePublicRewards({ minAgeHours: PUBLIC_WITHDRAWAL_WINDOW_HOURS }).catch((error) => {
    console.error("[public-reward]", error);
  });

  if (req.method === "POST" && url.pathname === "/api/csp-report") {
    await readJsonBody(req).catch(() => ({}));
    return sendNoContent(res);
  }

  if (req.method === "POST" && url.pathname === "/api/rum") {
    const body = await readJsonBody(req).catch(() => ({}));
    const metric = {
      name: String(body.name || "").slice(0, 40),
      value: Number(body.value || 0),
      path: String(body.path || "").slice(0, 255),
      detail: body.detail && typeof body.detail === "object" ? body.detail : null,
      createdAt: nowIso()
    };
    if (metric.name) {
      rumEvents.push(metric);
      if (rumEvents.length > 1000) rumEvents.splice(0, rumEvents.length - 1000);
    }
    return sendNoContent(res);
  }

  verifyCsrf(req);

  if (req.method === "GET" && url.pathname === "/api/version") {
    return sendJson(res, 200, {
      ok: true,
      version: APP_VERSION,
      startedAt: SERVER_STARTED_AT,
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      timeoutMs: {
        openai: OPENAI_FETCH_TIMEOUT_MS,
        imageDownload: IMAGE_DOWNLOAD_TIMEOUT_MS
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    const settings = await store.getSettings();
    const activeProvider = await store.getDefaultProviderConfig({ includeSecret: true });
    return sendJson(res, 200, {
      ok: true,
      version: APP_VERSION,
      startedAt: SERVER_STARTED_AT,
      firstRun: (await store.countUsers()) === 0,
      settings: publicSettings(settings, activeProvider)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const current = await getCurrentUser(req);
    const settings = await store.getSettings();
    const activeProvider = await store.getDefaultProviderConfig({ includeSecret: true });
    const csrfToken = getOrCreateCsrfToken(req);
    return sendJson(res, 200, {
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
      return sendJson(res, 201, { user: serializeUser(user), pendingApproval: true });
    }

    const token = await createSession(user.id);
    return sendJson(res, 201, { user: serializeUser(user) }, {
      "Set-Cookie": sessionCookie(token, req)
    });
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
    return sendJson(res, 200, { user: serializeUser(user) }, {
      "Set-Cookie": sessionCookie(token, req)
    });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    await destroySession(parseCookies(req.headers.cookie).session);
    return sendNoContent(res, {
      "Set-Cookie": clearSessionCookie(req)
    });
  }

  if (req.method === "POST" && url.pathname === "/api/checkin") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const user = await store.getUserById(current.user.id);
    if (!user || user.status !== "active") {
      throw httpError("Account is not active", 403);
    }
    const result = await store.checkInToday(user.id, CHECKIN_CREDIT);
    const updatedUser = await store.getUserById(user.id);
    return sendJson(res, 200, {
      checkedIn: result.checkedIn,
      awarded: result.checkedIn ? CHECKIN_CREDIT : 0,
      credits: result.credits,
      user: serializeUser(updatedUser),
      checkin: {
        checkedInToday: true,
        credit: CHECKIN_CREDIT
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    const settings = await store.getSettings();
    return sendJson(res, 200, publicSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
  }

  if (req.method === "GET" && url.pathname === "/api/growth") {
    const settings = await store.getSettings();
    const settingsPayload = publicSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true }));
    return sendJson(res, 200, {
      growth: settingsPayload.growth,
      providerCapabilities: settingsPayload.providerCapabilities,
      activeProvider: settingsPayload.activeProvider
    });
  }

  if (req.method === "GET" && url.pathname === "/api/announcements") {
    const current = await getCurrentUser(req);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 50, 100);
    const announcements = await store.listPublishedAnnouncements({ user: current?.user || null, limit });
    return sendJson(res, 200, { announcements });
  }

  if (req.method === "GET" && url.pathname === "/api/announcements/unread") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 20, 100);
    const modalOnly = url.searchParams.get("modal") === "1";
    const announcements = await store.listPublishedAnnouncements({
      user: current.user,
      unreadOnly: true,
      modalOnly,
      limit
    });
    return sendJson(res, 200, { announcements, unreadCount: announcements.length });
  }

  const announcementPublicMatch = url.pathname.match(/^\/api\/announcements\/([^/]+)\/(read|ack)$/);
  if (announcementPublicMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const announcement = await store.getAnnouncementById(announcementPublicMatch[1], { userId: current.user.id });
    if (!announcement || announcement.status !== "published") throw httpError("Announcement not found", 404);
    const updated = await store.markAnnouncementRead(announcement.id, current.user.id, {
      ack: announcementPublicMatch[2] === "ack"
    });
    return sendJson(res, 200, { announcement: updated });
  }

  if (req.method === "GET" && url.pathname === "/api/stats/today") {
    const offset = Math.max(0, Number.parseInt(process.env.TODAY_GENERATED_OFFSET || "0", 10) || 0);
    const generatedToday = await store.countTodayGenerations();
    return sendJson(res, 200, {
      todayGenerated: offset + generatedToday
    });
  }

  if (req.method === "GET" && url.pathname === "/api/prompts") {
    const current = await getCurrentUser(req);
    const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 500, 2000);
    const sort = url.searchParams.get("sort") === "hot" ? "hot" : "default";
    const prompts = await store.listPrompts({ includeHidden, limit, sort, currentUserId: current?.user?.id || "" });
    return sendJson(res, 200, { prompts });
  }

  if (req.method === "POST" && url.pathname === "/api/prompts") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const payload = buildPromptPayload(body, { partial: false });
    const created = await store.createPrompt(payload);
    await writeAdminAudit(current, req, "create_prompt", "prompt", String(created.id), {
      title: created.title,
      normalizedHash: store.listPromptDuplicateCandidates ? "computed_on_scan" : ""
    });
    return sendJson(res, 201, { prompt: created });
  }

  const promptIdMatch = url.pathname.match(/^\/api\/prompts\/(\d+)$/);
  if (promptIdMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    const prompt = await store.getPromptById(promptIdMatch[1]);
    if (!prompt) throw httpError("Prompt not found", 404);
    if (prompt.status !== "active" && current?.user?.role !== "admin") {
      throw httpError("Prompt not found", 404);
    }
    return sendJson(res, 200, { prompt });
  }
  const promptLikeMatch = url.pathname.match(/^\/api\/prompts\/(\d+)\/like$/);
  if (promptLikeMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const body = await readJsonBody(req);
    const prompt = await store.getPromptById(promptLikeMatch[1]);
    if (!prompt || prompt.status !== "active") throw httpError("Prompt not found", 404);
    const updated = await store.setPromptLike(prompt.id, current.user.id, body.liked !== false);
    return sendJson(res, 200, { prompt: updated });
  }
  const promptUseMatch = url.pathname.match(/^\/api\/prompts\/(\d+)\/use$/);
  if (promptUseMatch && req.method === "POST") {
    const prompt = await store.getPromptById(promptUseMatch[1]);
    if (!prompt || prompt.status !== "active") throw httpError("Prompt not found", 404);
    const updated = await store.incrementPromptUse(prompt.id);
    return sendJson(res, 200, { prompt: updated });
  }
  if (promptIdMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getPromptById(promptIdMatch[1]);
    if (!existing) throw httpError("Prompt not found", 404);
    const body = await readJsonBody(req);
    const payload = buildPromptPayload(body, { partial: true });
    const updated = await store.updatePrompt(existing.id, payload);
    await writeAdminAudit(current, req, "update_prompt", "prompt", String(existing.id), {
      fields: Object.keys(payload),
      duplicateReview: body.duplicateReview || ""
    });
    return sendJson(res, 200, { prompt: updated });
  }
  if (promptIdMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getPromptById(promptIdMatch[1]);
    if (!existing) throw httpError("Prompt not found", 404);
    const updated = await store.softDeletePrompt(existing.id);
    await writeAdminAudit(current, req, "hide_prompt", "prompt", String(existing.id), {
      reason: "manual_duplicate_or_quality_review"
    });
    return sendJson(res, 200, { prompt: updated });
  }

  if (req.method === "GET" && url.pathname === "/api/tags") {
    const current = await getCurrentUser(req);
    const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 500, 2000);
    const [tags, categories] = await Promise.all([
      store.listTags({ includeHidden, limit }),
      store.listPromptCategories({ includeHidden })
    ]);
    return sendJson(res, 200, { tags, categories, summary: tagSummary(tags) });
  }

  if (req.method === "GET" && url.pathname === "/api/prompt-categories") {
    const current = await getCurrentUser(req);
    const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
    const categories = await store.listPromptCategories({ includeHidden });
    return sendJson(res, 200, { categories });
  }

  if (req.method === "POST" && url.pathname === "/api/prompt-categories") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const payload = buildPromptCategoryPayload(body, { partial: false });
    const existing = await store.getPromptCategoryBySlug(payload.slug);
    if (existing) throw httpError(`Category '${payload.slug}' already exists`, 409);
    const category = await store.upsertPromptCategory(payload);
    await writeAdminAudit(current, req, "create_prompt_category", "prompt_category", category.slug, {
      labelZh: category.labelZh,
      status: category.status
    });
    return sendJson(res, 201, { category });
  }

  const promptCategoryMatch = url.pathname.match(/^\/api\/prompt-categories\/([a-z0-9][a-z0-9_-]{0,30}[a-z0-9]|[a-z0-9])$/i);
  if (promptCategoryMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getPromptCategoryBySlug(promptCategoryMatch[1]);
    if (!existing) throw httpError("Category not found", 404);
    const body = await readJsonBody(req);
    const payload = buildPromptCategoryPayload({ ...existing, ...body, slug: existing.slug }, { partial: false });
    const category = await store.upsertPromptCategory(payload);
    await writeAdminAudit(current, req, "update_prompt_category", "prompt_category", category.slug, {
      fields: Object.keys(body)
    });
    return sendJson(res, 200, { category });
  }
  if (promptCategoryMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getPromptCategoryBySlug(promptCategoryMatch[1]);
    if (!existing) throw httpError("Category not found", 404);
    const category = await store.upsertPromptCategory({ ...existing, status: "hidden" });
    await writeAdminAudit(current, req, "hide_prompt_category", "prompt_category", category.slug, {});
    return sendJson(res, 200, { category });
  }

  if (req.method === "POST" && url.pathname === "/api/tags") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const payload = buildTagPayload(body, { partial: false });
    if (await store.getTagBySlug(payload.slug)) {
      throw httpError(`Tag '${payload.slug}' already exists`, 409);
    }
    const tag = await store.createTag(payload);
    return sendJson(res, 201, { tag });
  }

  const tagSlugMatch = url.pathname.match(/^\/api\/tags\/([a-z0-9][a-z0-9-]{0,46}[a-z0-9]|[a-z0-9])$/i);
  if (tagSlugMatch && req.method === "GET") {
    const tag = await store.getTagBySlug(tagSlugMatch[1]);
    if (!tag) throw httpError("Tag not found", 404);
    return sendJson(res, 200, { tag });
  }
  if (tagSlugMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getTagBySlug(tagSlugMatch[1]);
    if (!existing) throw httpError("Tag not found", 404);
    const body = await readJsonBody(req);
    const payload = buildTagPayload(body, { partial: true });
    const updated = await store.updateTag(existing.slug, payload);
    return sendJson(res, 200, { tag: updated });
  }
  if (tagSlugMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getTagBySlug(tagSlugMatch[1]);
    if (!existing) throw httpError("Tag not found", 404);
    const updated = await store.hideTag(existing.slug);
    return sendJson(res, 200, { tag: updated });
  }

  const tagMergeMatch = url.pathname.match(/^\/api\/tags\/([a-z0-9][a-z0-9-]{0,46}[a-z0-9]|[a-z0-9])\/merge$/i);
  if (tagMergeMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const targetSlug = String(body.targetSlug || "").trim().toLowerCase();
    if (!targetSlug || !TAG_SLUG_PATTERN.test(targetSlug)) {
      throw httpError("targetSlug is invalid", 400);
    }
    try {
      const result = await store.mergeTag(tagMergeMatch[1], targetSlug);
      return sendJson(res, 200, result);
    } catch (error) {
      throw httpError(error.message || "merge failed", 400);
    }
  }

  if (req.method === "GET" && url.pathname === "/api/admin/settings") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const settings = await store.getSettings();
    return sendJson(res, 200, adminSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
  }

  if (req.method === "GET" && url.pathname === "/api/admin/providers") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const settings = await store.getSettings();
    return sendJson(res, 200, {
      providers: await store.listProviderConfigs(),
      defaultProviderId: settings.defaultProviderId || ""
    });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/providers") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const input = cleanProviderInput(await readJsonBody(req));
    const provider = await store.createProviderConfig({ ...input, id: randomId("prv_") });
    await writeAdminAudit(current, req, "create_provider", "provider", provider.id, {
      name: provider.name,
      baseUrl: provider.baseUrl,
      status: provider.status
    });
    return sendJson(res, 201, { provider });
  }

  const providerMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)$/);
  if (providerMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const provider = await store.getProviderConfigById(providerMatch[1]);
    if (!provider) throw httpError("Provider not found", 404);
    return sendJson(res, 200, { provider });
  }

  if (providerMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getProviderConfigById(providerMatch[1], { includeSecret: true });
    if (!existing) throw httpError("Provider not found", 404);
    const input = cleanProviderInput(await readJsonBody(req), existing);
    const provider = await store.updateProviderConfig(existing.id, input);
    await writeAdminAudit(current, req, "update_provider", "provider", provider.id, {
      name: provider.name,
      baseUrl: provider.baseUrl,
      status: provider.status
    });
    return sendJson(res, 200, { provider });
  }

  if (providerMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const ok = await store.deleteProviderConfig(providerMatch[1]);
    if (!ok) throw httpError("Provider cannot be deleted", 400);
    await writeAdminAudit(current, req, "delete_provider", "provider", providerMatch[1], {});
    return sendJson(res, 200, { ok: true });
  }

  const providerTestMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/test$/);
  if (providerTestMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const provider = await store.getProviderConfigById(providerTestMatch[1], { includeSecret: true });
    if (!provider) throw httpError("Provider not found", 404);
    const started = Date.now();
    try {
      const response = await fetchWithTimeout("Provider test", provider.baseUrl, {
        method: "GET",
        headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}
      }, 8000);
      const healthStatus = response.status < 500 ? "ok" : "error";
      const updated = await store.updateProviderHealth(provider.id, {
        healthStatus,
        lastError: healthStatus === "ok" ? "" : `HTTP ${response.status}`
      });
      return sendJson(res, 200, { provider: updated, ok: healthStatus === "ok", status: response.status, durationMs: Date.now() - started });
    } catch (error) {
      const updated = await store.updateProviderHealth(provider.id, {
        healthStatus: "error",
        lastError: error.message || String(error)
      });
      return sendJson(res, 200, { provider: updated, ok: false, error: error.message || String(error), durationMs: Date.now() - started });
    }
  }

  const providerDefaultMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/set-default$/);
  if (providerDefaultMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const provider = await store.setDefaultProviderConfig(providerDefaultMatch[1]);
    if (!provider) throw httpError("Provider not found", 404);
    await writeAdminAudit(current, req, "set_default_provider", "provider", provider.id, { name: provider.name });
    return sendJson(res, 200, { provider, defaultProviderId: provider.id });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/rum") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    return sendJson(res, 200, { summary: rumSummary(), events: rumEvents.slice(-100).reverse() });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/announcements") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const status = url.searchParams.get("status") || "";
    return sendJson(res, 200, { announcements: await store.listAnnouncements({ includeArchived: true, status, limit }) });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/announcements") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const payload = cleanAnnouncementInput(body, null, { partial: false });
    const announcement = await store.createAnnouncement({
      ...payload,
      id: randomId("ann_"),
      createdBy: current.user.id
    });
    await writeAdminAudit(current, req, "create_announcement", "announcement", announcement.id, {
      title: announcement.title,
      status: announcement.status
    });
    return sendJson(res, 201, { announcement });
  }

  const adminAnnouncementActionMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)\/(publish|archive|withdraw)$/);
  if (adminAnnouncementActionMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementActionMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const action = adminAnnouncementActionMatch[2];
    const status = action === "publish" ? "published" : action === "archive" ? "archived" : "draft";
    const announcement = await store.updateAnnouncement(existing.id, { status });
    await writeAdminAudit(current, req, `${action}_announcement`, "announcement", announcement.id, {
      title: announcement.title,
      from: existing.status,
      to: announcement.status
    });
    return sendJson(res, 200, { announcement });
  }

  const adminAnnouncementMatch = url.pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (adminAnnouncementMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const announcement = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!announcement) throw httpError("Announcement not found", 404);
    return sendJson(res, 200, { announcement });
  }

  if (adminAnnouncementMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const patch = cleanAnnouncementInput(await readJsonBody(req), existing, { partial: true });
    const announcement = await store.updateAnnouncement(existing.id, patch);
    await writeAdminAudit(current, req, "update_announcement", "announcement", announcement.id, {
      title: announcement.title,
      status: announcement.status
    });
    return sendJson(res, 200, { announcement });
  }

  if (adminAnnouncementMatch && req.method === "DELETE") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getAnnouncementById(adminAnnouncementMatch[1]);
    if (!existing) throw httpError("Announcement not found", 404);
    const ok = await store.deleteAnnouncement(existing.id);
    if (!ok) throw httpError("Only draft announcements can be deleted", 400);
    await writeAdminAudit(current, req, "delete_announcement", "announcement", existing.id, {
      title: existing.title,
      status: existing.status
    });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "PATCH" && url.pathname === "/api/admin/settings") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const patch = {};

    if (typeof body.openaiApiKey === "string") {
      const key = body.openaiApiKey.trim();
      if (key) patch.openaiApiKey = key;
    }
    if (body.clearApiKey === true) patch.openaiApiKey = "";
    if (typeof body.apiBaseUrl === "string") {
      patch.apiBaseUrl = body.apiBaseUrl.trim().replace(/\/+$/, "").slice(0, 255);
    }
    if (typeof body.model === "string" && body.model.trim()) {
      patch.model = body.model.trim().slice(0, 80);
    }
    if (body.defaultCredits !== undefined) {
      patch.defaultCredits = Math.max(0, Math.min(10000, Number.parseInt(body.defaultCredits, 10) || 0));
    }
    if (body.generationCreditCost !== undefined) {
      patch.generationCreditCost = Math.max(0, Math.min(10000, Number.parseInt(body.generationCreditCost, 10) || 0));
    }
    if (body.maxImagesPerRequest !== undefined) {
      patch.maxImagesPerRequest = Math.max(1, Math.min(4, Number.parseInt(body.maxImagesPerRequest, 10) || 1));
    }
    const contactEmailInput = typeof body.contactEmail === "string" ? body.contactEmail : body.contactAdminEmail;
    if (typeof contactEmailInput === "string") {
      const email = normalizeEmail(contactEmailInput);
      requireOptionalEmail(email);
      patch.contactAdminEmail = email.slice(0, 255);
    }
    if (typeof body.allowRegistration === "boolean") patch.allowRegistration = body.allowRegistration ? 1 : 0;
    if (typeof body.requireApproval === "boolean") patch.requireApproval = body.requireApproval ? 1 : 0;
    if (body.growthConfig && typeof body.growthConfig === "object") patch.growthConfig = body.growthConfig;
    if (body.providerCapabilityConfig && typeof body.providerCapabilityConfig === "object") {
      patch.providerCapabilityConfig = body.providerCapabilityConfig;
    }
    if (typeof body.defaultProviderId === "string") {
      patch.defaultProviderId = body.defaultProviderId.trim().slice(0, 40);
    }

    const existingSettings = await store.getSettings();
    const settings = await store.updateSettings(patch);
    if (Object.hasOwn(patch, "contactAdminEmail") && patch.contactAdminEmail !== String(existingSettings.contactAdminEmail || "")) {
      await writeAdminAudit(current, req, "update_contact_email", "settings", "contactEmail", {
        from: existingSettings.contactAdminEmail || "",
        to: patch.contactAdminEmail
      });
    }
    return sendJson(res, 200, adminSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
  }

  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    return sendJson(res, 200, {
      users: (await store.listUsers()).map(serializeUser)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/credit-ledger") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    return sendJson(res, 200, { ledger: await store.listCreditLedger({ limit }) });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/reward-ledger") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    return sendJson(res, 200, { rewards: await store.listRewardLedger({ limit }) });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/audit-logs") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    return sendJson(res, 200, { logs: await store.listAdminAuditLogs({ limit }) });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/prompt-audits") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 500);
    const status = url.searchParams.get("status") || "all";
    return sendJson(res, 200, { audits: await store.listPromptAuditRecords({ status, limit }) });
  }

  const promptAuditAdminMatch = url.pathname.match(/^\/api\/admin\/prompt-audits\/(\d+)$/);
  if (promptAuditAdminMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const audit = await store.getPromptAuditRecordById(promptAuditAdminMatch[1]);
    if (!audit) throw httpError("Prompt audit not found", 404);
    return sendJson(res, 200, { audit });
  }

  if (promptAuditAdminMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const existing = await store.getPromptAuditRecordById(promptAuditAdminMatch[1]);
    if (!existing) throw httpError("Prompt audit not found", 404);
    const body = await readJsonBody(req);
    const action = String(body.action || "").trim();
    const note = String(body.note || "").trim().slice(0, 500);
    const updated = await store.reviewPromptAuditRecord(existing.id, {
      action,
      note,
      reviewerUserId: current.user.id
    });
    await writeAdminAudit(current, req, `prompt_audit_${updated.overrideAction || action || "review"}`, "prompt_audit", String(existing.id), {
      generationId: existing.generationId,
      resultLevel: existing.resultLevel,
      requiredMode: existing.requiredMode,
      note
    });
    return sendJson(res, 200, { audit: updated });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/withdrawals") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const requests = (await store.listWithdrawalRequests({ limit })).map((generation) => ({
      ...generation,
      imageUrl: `/api/images/${generation.id}/file`,
      sourceImageUrl: sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
      ...sourceImageAuditFields(generation)
    }));
    return sendJson(res, 200, { requests });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/reports") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 500);
    const reports = (await store.listGalleryModeration({ limit, status: url.searchParams.get("status") || "queue" })).map(generationResponse);
    return sendJson(res, 200, { reports });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/prompt-duplicates") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const status = url.searchParams.get("status") || "pending";
    return sendJson(res, 200, { candidates: await store.listPromptDuplicateCandidates({ status, limit }) });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/prompt-duplicates/scan") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req).catch(() => ({}));
    const result = await store.scanPromptDuplicateCandidates({
      limit: sanitizePositiveInt(body.limit, 2000, 5000),
      hammingThreshold: Math.max(0, Math.min(24, Number.parseInt(body.hammingThreshold, 10) || 6))
    });
    await writeAdminAudit(current, req, "scan_prompt_duplicates", "prompt", "duplicates", result);
    return sendJson(res, 200, result);
  }

  const promptDuplicateMatch = url.pathname.match(/^\/api\/admin\/prompt-duplicates\/(\d+)$/);
  if (promptDuplicateMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const candidate = await store.getPromptDuplicateCandidateById(promptDuplicateMatch[1]);
    if (!candidate) throw httpError("Duplicate candidate not found", 404);
    const body = await readJsonBody(req);
    const action = String(body.action || "").trim();
    const note = String(body.note || "").trim().slice(0, 500);
    let status = "ignored";
    if (action === "confirm") status = "confirmed_duplicate";
    else if (action === "keep") status = "kept_distinct";
    else if (action === "merge") {
      status = "merged";
      await store.updatePrompt(candidate.duplicatePromptId, { status: "hidden" });
    } else if (action === "hide_duplicate") {
      status = "hidden";
      await store.softDeletePrompt(candidate.duplicatePromptId);
    } else if (action === "ignore") {
      status = "ignored";
    } else {
      throw httpError("Invalid duplicate action", 400);
    }
    const updated = await store.reviewPromptDuplicateCandidate(candidate.id, {
      status,
      reviewerUserId: current.user.id,
      reviewNote: note
    });
    await writeAdminAudit(current, req, `prompt_duplicate_${action}`, "prompt_duplicate", candidate.id, {
      promptId: candidate.promptId,
      duplicatePromptId: candidate.duplicatePromptId,
      note
    });
    return sendJson(res, 200, { candidate: updated });
  }

  const adminWithdrawalMatch = url.pathname.match(/^\/api\/admin\/withdrawals\/([^/]+)$/);
  if (adminWithdrawalMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const generation = await store.getGenerationById(adminWithdrawalMatch[1]);
    if (!generation) throw httpError("Image not found", 404);
    const body = await readJsonBody(req);
    const decision = String(body.decision || "").trim();
    if (!["approved", "rejected"].includes(decision)) throw httpError("Invalid decision", 400);
    const patch = decision === "approved"
      ? { withdrawalStatus: "approved", isPublic: false, publishOriginal: false }
      : { withdrawalStatus: "rejected" };
    const updated = await store.updateGenerationPublic(generation.id, patch);
    await writeAdminAudit(current, req, `withdrawal_${decision}`, "generation", generation.id, { reason: body.reason || "" });
    return sendJson(res, 200, { generation: updated });
  }

  const adminModerationMatch = url.pathname.match(/^\/api\/admin\/public-images\/([^/]+)\/moderation$/);
  if (adminModerationMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const generation = await store.getGenerationById(adminModerationMatch[1]);
    if (!generation) throw httpError("Image not found", 404);
    const body = await readJsonBody(req);
    const action = String(body.action || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 255);
    const patch = {};
    if (action === "hide") {
      patch.moderationStatus = "hidden";
      patch.moderationReason = reason || "hidden by admin";
    } else if (action === "restore") {
      patch.moderationStatus = "restored";
      patch.moderationReason = reason || "restored by admin";
      patch.reportCount = 0;
    } else if (action === "reject") {
      patch.moderationStatus = "restored";
      patch.moderationReason = reason || "report rejected by admin";
      patch.reportCount = 0;
    } else {
      throw httpError("Invalid moderation action", 400);
    }
    const updated = await store.updateGenerationPublic(generation.id, patch);
    await store.markGenerationReportsHandled(generation.id, {
      status: action === "restore" || action === "reject" ? "rejected" : "resolved",
      handledBy: current.user.id
    });
    await writeAdminAudit(current, req, `moderation_${action}`, "generation", generation.id, {
      reason,
      before: {
        moderationStatus: generation.moderationStatus,
        reportCount: generation.reportCount
      },
      after: patch
    });
    return sendJson(res, 200, { generation: generationResponse(updated) });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users/bulk") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 200)
      : [];
    if (!userIds.length) throw httpError("No users selected", 400);
    const action = String(body.action || "").trim();
    const results = [];
    for (const userId of userIds) {
      const target = await store.getUserById(userId);
      if (!target) {
        results.push({ userId, ok: false, error: "not_found" });
        continue;
      }
      try {
        if (action === "status") {
          const status = ["active", "disabled"].includes(body.status) ? body.status : "";
          if (!status) throw new Error("invalid_status");
          if (target.id === current.user.id && status !== "active") throw new Error("cannot_disable_self");
          await store.updateUser(target.id, { status });
        } else if (action === "creditDelta") {
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
      action,
      count: userIds.length,
      ok: results.filter((item) => item.ok).length,
      note: body.note || ""
    });
    return sendJson(res, 200, { results });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/users") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    requireEmail(email);
    if (await store.getUserByEmail(email)) {
      throw httpError("Email is already registered", 409);
    }

    const generated = Boolean(body.generatePassword) || !String(body.password || "").trim();
    const password = generated ? temporaryPassword() : String(body.password || "");
    requirePassword(password);

    const role = ["admin", "user"].includes(body.role) ? body.role : "user";
    const status = ["active", "disabled"].includes(body.status) ? body.status : "active";
    const name = String(body.name || "").trim().slice(0, 60) || email.split("@")[0];
    const credits = Math.max(0, Math.min(100000, Number.parseInt(body.credits, 10) || 0));
    const note = String(body.note || "").slice(0, 255);

    const user = await store.createUser({
      id: randomId("usr_"),
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      status,
      credits
    });

    await writeAdminAudit(current, req, "create_user", "user", user.id, {
      email,
      role,
      status,
      credits,
      generatedPassword: generated,
      note
    });
    return sendJson(res, 201, {
      user: serializeUser(user),
      temporaryPassword: generated ? password : undefined
    });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/generations") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    const records = (await store.listGenerationRequests(limit)).map((record) => ({
      ...record,
      imageUrl: record.firstGenerationId ? `/api/images/${record.firstGenerationId}/file` : ""
    }));
    return sendJson(res, 200, { records });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/public-images") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 200);
    const status = url.searchParams.get("status") || "queue";
    const includeBroken = url.searchParams.get("includeBroken") === "1";
    const generations = status === "all"
      ? (await store.listPublicGenerations(limit, { includeModerated: true, includeBroken })).map(generationResponse)
      : (await store.listGalleryModeration({ limit, status, includeBroken })).map(generationResponse);
    return sendJson(res, 200, { generations });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/gallery-file-checks") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 500);
    const checks = await store.listGalleryFileChecks({
      status: url.searchParams.get("status") || "broken",
      limit
    });
    return sendJson(res, 200, { checks });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/gallery-file-checks/run") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const body = await readJsonBody(req).catch(() => ({}));
    const limit = sanitizePositiveInt(body.limit, 1000, 5000);
    const result = await runGalleryFileChecks({ limit });
    await writeAdminAudit(current, req, "gallery_file_check_run", "gallery", "public-images", {
      scanned: result.scanned,
      checked: result.checked,
      broken: result.broken
    });
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/admin/gallery-like-anomalies") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    return sendJson(res, 200, { anomalies: await store.listGenerationLikeAnomalies({ limit }) });
  }

  const userCreditLedgerMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/credit-ledger$/);
  if (userCreditLedgerMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userCreditLedgerMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    return sendJson(res, 200, { ledger: await store.listCreditLedger({ userId: target.id, limit }) });
  }

  const userRewardLedgerMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/reward-ledger$/);
  if (userRewardLedgerMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userRewardLedgerMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 100, 500);
    return sendJson(res, 200, { rewards: await store.listRewardLedger({ userId: target.id, limit }) });
  }

  const userResetPasswordMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/);
  if (userResetPasswordMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userResetPasswordMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const body = await readJsonBody(req);
    const generated = Boolean(body.generatePassword) || !String(body.password || "").trim();
    const password = generated ? temporaryPassword() : String(body.password || "");
    requirePassword(password);
    const user = await store.updateUserPassword(target.id, hashPassword(password));
    await writeAdminAudit(current, req, "reset_user_password", "user", target.id, {
      email: target.email,
      generatedPassword: generated,
      note: String(body.note || "").slice(0, 255)
    });
    return sendJson(res, 200, {
      user: serializeUser(user),
      temporaryPassword: generated ? password : undefined
    });
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    ensureAdmin(current);
    const target = await store.getUserById(userMatch[1]);
    if (!target) throw httpError("User not found", 404);
    const body = await readJsonBody(req);
    const patch = {};

    if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 60) || target.name;
    if (["admin", "user"].includes(body.role)) patch.role = body.role;
    if (["active", "disabled"].includes(body.status)) patch.status = body.status;
    if (target.id === current.user.id) {
      patch.role = "admin";
      patch.status = "active";
    }

    let user = await store.updateUser(target.id, patch);
    if (body.credits !== undefined) {
      user = await store.setUserCredits(target.id, body.credits, {
        source: "admin_set",
        note: String(body.note || "Admin set balance").slice(0, 255),
        actorUserId: current.user.id
      });
    }
    if (body.creditDelta !== undefined) {
      const delta = Math.max(-100000, Math.min(100000, Number.parseInt(body.creditDelta, 10) || 0));
      user = await store.adjustCredits(target.id, delta, {
        source: "admin_adjustment",
        note: String(body.note || "Admin adjustment").slice(0, 255),
        actorUserId: current.user.id
      });
    }
    await writeAdminAudit(current, req, "update_user", "user", target.id, {
      patch,
      credits: body.credits,
      creditDelta: body.creditDelta,
      note: body.note || ""
    });
    return sendJson(res, 200, { user: serializeUser(user) });
  }

  if (req.method === "GET" && url.pathname === "/api/images/history") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 120, 200);
    const generations = (await store.listGenerationsForUser(current.user, limit, { includeArchived })).map((generation) => ({
      ...generation,
      imageUrl: `/api/images/${generation.id}/file`,
      sourceImageUrl: sourceImageUrlForGeneration(generation, { includePrivateSource: true }),
      ...sourceImageAuditFields(generation)
    }));
    return sendJson(res, 200, { generations });
  }

  if (req.method === "GET" && url.pathname === "/api/images/public") {
    const current = await getCurrentUser(req);
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 60, 120);
    const sort = url.searchParams.get("sort") === "likes" ? "likes" : "recent";
    const includeBroken = current?.user?.role === "admin" && url.searchParams.get("includeBroken") === "1";
    const generations = (await store.listPublicGenerations(limit, { includeBroken, currentUserId: current?.user?.id || "", sort })).map((generation) => ({
      ...generation,
      imageUrl: `/api/images/${generation.id}/file`,
      sourceImageUrl: sourceImageUrlForGeneration(generation),
      ...sourceImageAuditFields(generation)
    }));
    return sendJson(res, 200, { generations });
  }

  const galleryLikeMatch = url.pathname.match(/^\/api\/gallery\/([^/]+)\/like$/);
  if (galleryLikeMatch && (req.method === "POST" || req.method === "DELETE")) {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const generation = await store.getGenerationById(galleryLikeMatch[1]);
    if (!generation || !isPubliclyVisibleGeneration(generation)) {
      throw httpError("Gallery image not found", 404);
    }
    const liked = req.method === "POST";
    const updated = await store.setGenerationLike(generation.id, current.user.id, liked);
    if (liked) {
      const anomalies = await store.listGenerationLikeAnomalies({ limit: 50 }).catch(() => []);
      const row = anomalies.find((item) => item.userId === current.user.id);
      if (row) {
        await writeAdminAudit(current, req, "gallery_like_anomaly", "user", current.user.id, {
          generationId: generation.id,
          likeCount24h: row.likeCount,
          firstLikeAt: row.firstLikeAt,
          lastLikeAt: row.lastLikeAt
        });
      }
    }
    return sendJson(res, 200, { generation: generationResponse(updated) });
  }

  if (req.method === "GET" && url.pathname === "/api/gallery/leaderboard") {
    const current = await getCurrentUser(req);
    const range = ["day", "week", "month", "all"].includes(url.searchParams.get("range"))
      ? url.searchParams.get("range")
      : "week";
    const limit = sanitizePositiveInt(url.searchParams.get("limit"), 30, 100);
    const generations = (await store.listGenerationLeaderboard({
      range,
      tag: url.searchParams.get("tag") || "",
      type: url.searchParams.get("type") || "",
      limit,
      currentUserId: current?.user?.id || "",
      includeBroken: current?.user?.role === "admin" && url.searchParams.get("includeBroken") === "1"
    })).map(generationResponse);
    return sendJson(res, 200, { generations, range });
  }

  const galleryDetailMatch = url.pathname.match(/^\/api\/gallery\/([^/]+)$/);
  if (galleryDetailMatch && req.method === "GET") {
    const current = await getCurrentUser(req);
    const generation = await store.getGenerationById(galleryDetailMatch[1]);
    const includeHidden = current?.user?.role === "admin" && url.searchParams.get("includeHidden") === "1";
    if (!generation || (!includeHidden && !isPubliclyVisibleGeneration(generation))) {
      throw httpError("Gallery image not found", 404);
    }
    return sendJson(res, 200, { generation: generationResponse(generation) });
  }

  if (req.method === "POST" && url.pathname === "/api/gallery/prompt-audit") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const body = await readJsonBody(req);
    const prompt = cleanPrompt(body.prompt);
    const requestedMode = body.requestedMode === "image-to-image" ? "image-to-image" : "text-to-image";
    const audit = await store.auditPromptForPublish({
      prompt,
      userId: current.user.id,
      requestedMode,
      persist: true
    });
    return sendJson(res, 200, { audit: auditPayload(audit) });
  }

  const publishAuditMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/publish-audit$/);
  if (publishAuditMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const generation = await store.getGenerationById(publishAuditMatch[1]);
    if (!generation || !canTouchGeneration(current.user, generation)) {
      throw httpError("Image not found", 404);
    }
    const body = await readJsonBody(req).catch(() => ({}));
    const requestedMode = body.requestedMode === "image-to-image" ? "image-to-image" : "text-to-image";
    const audit = await store.auditPromptForPublish({
      prompt: generation.prompt,
      generationId: generation.id,
      userId: generation.userId,
      requestedMode,
      persist: true
    });
    return sendJson(res, 200, { audit: auditPayload(audit) });
  }

  if (req.method === "POST" && url.pathname === "/api/images/bulk") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const body = await readJsonBody(req);
    const ids = Array.isArray(body.generationIds)
      ? body.generationIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 200)
      : [];
    if (!ids.length) throw httpError("No images selected", 400);
    const action = String(body.action || "").trim();
    const results = [];
    for (const id of ids) {
      try {
        const generation = await store.getGenerationById(id);
        if (!generation || !canTouchGeneration(current.user, generation)) {
          results.push({ id, ok: false, error: "not_found" });
          continue;
        }
        const patch = {};
        if (action === "publish") {
          await enforcePromptPublishAudit({ current, req, generation, body, patch });
          const kind = publicKindTagForGeneration(generation);
          patch.isPublic = true;
          patch.archived = false;
          patch.publicTags = await normalizePublishPublicTags(body.publicTags, {
            kind,
            incrementUsage: true
          });
          if (!generation.isPublic && !(await store.hasFirstPublicReward(generation.userId))) {
            patch.publicRewardStatus = "pending";
            patch.publicRewardAmount = FIRST_PUBLIC_REWARD_CREDIT;
            patch.withdrawalStatus = "none";
          }
        } else if (action === "unpublish") {
          if (generation.isPublic && !canWithdrawDirectly(generation) && current.user.role !== "admin") {
            throw new Error("withdrawal_request_required");
          }
          patch.isPublic = false;
          patch.publishOriginal = false;
        } else if (action === "archive") {
          if (generation.isPublic && !canWithdrawDirectly(generation) && current.user.role !== "admin") {
            throw new Error("withdrawal_request_required");
          }
          patch.archived = true;
          patch.isPublic = false;
          patch.publishOriginal = false;
        } else if (action === "unarchive") {
          patch.archived = false;
        } else {
          throw new Error("invalid_action");
        }
        const updated = await store.updateGenerationPublic(generation.id, patch);
        results.push({ id, ok: true, generation: updated });
      } catch (error) {
        results.push({ id, ok: false, error: error.message || String(error) });
      }
    }
    return sendJson(res, 200, { results });
  }

  if (req.method === "GET" && url.pathname === "/api/images/requests/active") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const requests = await store.listActiveGenerationRequestsForUser(current.user.id, 20);
    return sendJson(res, 200, {
      requests: requests.map(requestStatusPayload)
    });
  }

  const requestStatusMatch = url.pathname.match(/^\/api\/images\/requests\/([^/]+)$/);
  if (requestStatusMatch && req.method === "GET") {
    return sendGenerationRequestStatus(req, res, requestStatusMatch[1]);
  }

  if (requestStatusMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const request = await store.getGenerationRequestById(requestStatusMatch[1]);
    if (!request || (request.userId !== current.user.id && current.user.role !== "admin")) {
      throw httpError("Generation request not found", 404);
    }
    if (!["pending", "running"].includes(request.status)) {
      return sendGenerationRequestStatus(req, res, request.id);
    }
    const queued = cancelQueuedGenerationJob(request.id);
    if (queued) {
      await store.updateGenerationRequest(request.id, {
        status: "cancelled",
        errorMessage: "client cancelled"
      });
    }
    return sendGenerationRequestStatus(req, res, request.id);
  }

  if (req.method === "POST" && url.pathname === "/api/images/generate") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    enforceGenerationRate(current.user.id);

    const body = await readJsonBody(req);
    const prompt = cleanPrompt(body.prompt);
    const settings = await store.getSettings();

    const user = await store.getUserById(current.user.id);
    if (!user || user.status !== "active") {
      throw httpError("Account is not active", 403);
    }

    const maxImages = Number(settings.maxImagesPerRequest || 1);
    const n = sanitizePositiveInt(body.n, 1, maxImages);
    const costPerImage = normalizeGenerationCost(settings.generationCreditCost ?? 1);
    const totalCost = costPerImage * n;
    const request = {
      model: String(settings.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      prompt,
      n,
      size: normalizeImageSize(body.size),
      quality: choose(body.quality, ["auto", "low", "medium", "high"], "auto"),
      background: choose(body.background, ["auto", "opaque", "transparent"], "auto"),
      output_format: choose(body.outputFormat, ["png", "webp", "jpeg"], "png"),
      isPublic: body.isPublic === true,
      conversation: sanitizeConversationRoute(body.conversationRoute),
      publicTags: await normalizePublishPublicTags(body.publicTags, {
        kind: PUBLIC_KIND_TAGS.text,
        incrementUsage: body.isPublic === true
      })
    };
    if (request.isPublic) {
      const audit = await store.auditPromptForPublish({
        prompt: request.prompt,
        userId: user.id,
        requestedMode: "text-to-image",
        persist: true
      });
      if (audit.requiredMode === "image-to-image") {
        throw httpError("Prompt is too similar to existing public prompt; publish as image-to-image instead", 409, {
          requiredMode: "image-to-image",
          audit: auditPayload(audit)
        });
      }
    }
    const openaiRequest = {
      model: request.model,
      prompt: request.prompt,
      n: request.n,
      size: request.size,
      quality: request.quality,
      background: request.background,
      output_format: request.output_format
    };
    const auditId = randomId("req_");
    const requestStartedAt = Date.now();
    await store.insertGenerationRequest({
      id: auditId,
      userId: user.id,
      prompt,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      isPublic: request.isPublic,
      status: "pending"
    });

    if (body.async === true) {
      const queue = enqueueGenerationJob({
        id: auditId,
        userId: user.id,
        run: () => runQueuedTextGeneration({
          auditId,
          user,
          settings,
          request,
          openaiRequest,
          totalCost,
          costPerImage,
          requestStartedAt
        })
      });
      return sendJson(res, 202, {
        request: {
          id: auditId,
          status: "pending",
          normalizedStatus: "pending",
          ...queue
        },
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
    }

    let reservedCredits = false;
    if (totalCost > 0) {
      reservedCredits = await store.reserveCredits(user.id, totalCost, {
        source: "generation_charge",
        referenceId: auditId,
        note: `${n} image(s)`
      });
      if (!reservedCredits) {
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          durationMs: Date.now() - requestStartedAt
        });
        throw httpError("Not enough credits", 402);
      }
    }

    const aborter = attachRequestAbortController(req);
    try {
      const openaiResult = await callOpenAIImages(settings, openaiRequest, { signal: aborter.signal });
      const durationMs = Date.now() - requestStartedAt;
      const saved = (await saveGeneratedImages(user, request, openaiResult))
        .map((generation) => ({ ...generation, durationMs }));
      if (!saved.length) {
        throw httpError("OpenAI did not return a savable image", 502);
      }
      await store.insertGenerations(saved);
      if (request.isPublic && saved[0] && !(await store.hasFirstPublicReward(user.id))) {
        const rewarded = await store.updateGenerationPublic(saved[0].id, {
          publicRewardStatus: "pending",
          publicRewardAmount: FIRST_PUBLIC_REWARD_CREDIT,
          withdrawalStatus: "none"
        });
        saved[0] = { ...saved[0], ...rewarded, imageUrl: saved[0].imageUrl };
      }
      await store.updateGenerationRequest(auditId, {
          status: "succeeded",
        firstGenerationId: saved[0]?.id || "",
        generationIds: saved.map((generation) => generation.id),
        durationMs
      });
      reservedCredits = false;
      if (costPerImage > 0 && saved.length < n) {
        await store.addCredits(user.id, costPerImage * (n - saved.length), {
          source: "generation_refund",
          referenceId: auditId,
          note: "unused candidate refund"
        }).catch((error) => console.error(error));
      }

      return sendJson(res, 200, {
        generations: saved,
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
    } catch (error) {
      const cancelled = aborter.isAborted() || error?.name === "AbortError";
      const durationMs = Date.now() - requestStartedAt;
      if (reservedCredits) await store.addCredits(user.id, totalCost, {
        source: cancelled ? "generation_cancel_refund" : "generation_error_refund",
        referenceId: auditId,
        note: cancelled ? "client aborted" : "generation failed"
      }).catch((refundError) => console.error(refundError));
      await store.updateGenerationRequest(auditId, cancelled
        ? { status: "cancelled", errorMessage: "client aborted", durationMs }
        : { status: "failed", errorMessage: String(error.message || error).slice(0, 2000), durationMs }
      ).catch((auditError) => console.error(auditError));
      if (cancelled) {
        // 连接已断，无法/无需写入响应；调用方上层 try/catch 的 status>=500 抑制也不会触发。
        if (!res.writableEnded) {
          try { res.end(); } catch { /* ignore */ }
        }
        return;
      }
      throw error;
    } finally {
      aborter.detach();
    }
  }

  if (req.method === "POST" && url.pathname === "/api/images/edit") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    enforceGenerationRate(current.user.id);

    const body = await readJsonBody(req);
    const prompt = cleanPrompt(body.prompt);
    const imageData = String(body.imageData || "").trim();
    const maskData = String(body.maskData || "").trim();
    if (!imageData || (!imageData.startsWith("data:image/") && !/^https?:\/\//i.test(imageData))) {
      throw httpError("Please provide an editable image", 400);
    }
    if (imageData.startsWith("data:image/")) validateImageDataUrl(imageData);
    if (maskData.startsWith("data:image/")) validateImageDataUrl(maskData);

    const settings = await store.getSettings();

    const user = await store.getUserById(current.user.id);
    if (!user || user.status !== "active") {
      throw httpError("Account is not active", 403);
    }

    const costPerImage = normalizeGenerationCost(settings.generationCreditCost ?? 1);
    const sourceFilename = body.publishOriginal === true
      ? await saveSourceImageFromData(body.sourceImageData || imageData)
      : "";
    const request = {
      model: String(settings.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      prompt,
      n: 1,
      size: normalizeImageSize(body.size),
      quality: "auto",
      background: "auto",
      output_format: "png",
      isPublic: body.isPublic === true,
      sourceFilename,
      publishOriginal: body.publishOriginal === true,
      conversation: sanitizeConversationRoute(body.conversationRoute),
      publicTags: await normalizePublishPublicTags(body.publicTags, {
        kind: PUBLIC_KIND_TAGS.image,
        incrementUsage: body.isPublic === true
      })
    };
    if (request.isPublic) {
      await store.auditPromptForPublish({
        prompt: request.prompt,
        userId: user.id,
        requestedMode: "image-to-image",
        persist: true
      });
    }
    const auditId = randomId("req_");
    const requestStartedAt = Date.now();
    await store.insertGenerationRequest({
      id: auditId,
      userId: user.id,
      prompt: `[image-edit] ${prompt}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      isPublic: request.isPublic,
      status: "pending"
    });

    const payload = {
      model: request.model,
      prompt: maskData
        ? `${prompt}\nThe uploaded image contains a purple visual annotation. Only modify the purple boxed or purple painted area, keep all unmarked areas unchanged, and remove the purple annotation from the final image.`
        : prompt,
      n: 1,
      size: request.size,
      imageData,
      maskData
    };

    if (body.async === true) {
      const queue = enqueueGenerationJob({
        id: auditId,
        userId: user.id,
        run: () => runQueuedImageEdit({
          auditId,
          user,
          settings,
          request,
          payload,
          costPerImage,
          requestStartedAt
        })
      });
      return sendJson(res, 202, {
        request: {
          id: auditId,
          status: "pending",
          normalizedStatus: "pending",
          ...queue
        },
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
    }

    let reservedCredits = false;
    if (costPerImage > 0) {
      reservedCredits = await store.reserveCredits(user.id, costPerImage, {
        source: "generation_charge",
        referenceId: auditId,
        note: "image edit"
      });
      if (!reservedCredits) {
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          durationMs: Date.now() - requestStartedAt
        });
        throw httpError("Not enough credits", 402);
      }
    }

    const aborter = attachRequestAbortController(req);
    try {
      const openaiResult = await callOpenAIImageEdits(settings, payload, { signal: aborter.signal });
      const durationMs = Date.now() - requestStartedAt;
      const saved = (await saveGeneratedImages(user, request, openaiResult))
        .map((generation) => ({ ...generation, durationMs }));
      if (!saved.length) {
        throw httpError("OpenAI did not return a savable edited image", 502);
      }
      await store.insertGenerations(saved);
      if (request.isPublic && saved[0] && !(await store.hasFirstPublicReward(user.id))) {
        const rewarded = await store.updateGenerationPublic(saved[0].id, {
          publicRewardStatus: "pending",
          publicRewardAmount: FIRST_PUBLIC_REWARD_CREDIT,
          withdrawalStatus: "none"
        });
        saved[0] = { ...saved[0], ...rewarded, imageUrl: saved[0].imageUrl };
      }
      await store.updateGenerationRequest(auditId, {
        status: "succeeded",
        firstGenerationId: saved[0]?.id || "",
        generationIds: saved.map((generation) => generation.id),
        durationMs
      });
      reservedCredits = false;

      return sendJson(res, 200, {
        generations: saved,
        credits: await store.getUserCredits(user.id),
        generationCost: costPerImage
      });
    } catch (error) {
      const cancelled = aborter.isAborted() || error?.name === "AbortError";
      const durationMs = Date.now() - requestStartedAt;
      if (reservedCredits) await store.addCredits(user.id, costPerImage, {
        source: cancelled ? "generation_cancel_refund" : "generation_error_refund",
        referenceId: auditId,
        note: cancelled ? "client aborted" : "image edit failed"
      }).catch((refundError) => console.error(refundError));
      await store.updateGenerationRequest(auditId, cancelled
        ? { status: "cancelled", errorMessage: "client aborted", durationMs }
        : { status: "failed", errorMessage: String(error.message || error).slice(0, 2000), durationMs }
      ).catch((auditError) => console.error(auditError));
      if (cancelled) {
        if (!res.writableEnded) {
          try { res.end(); } catch { /* ignore */ }
        }
        return;
      }
      throw error;
    } finally {
      aborter.detach();
    }
  }

  const publicMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/public$/);
  if (publicMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const generation = await store.getGenerationById(publicMatch[1]);
    if (!generation || !canTouchGeneration(current.user, generation)) {
      throw httpError("Image not found", 404);
    }
    const body = await readJsonBody(req);
    const patch = {
      isPublic: body.isPublic === true
    };
    if (Object.hasOwn(body, "conversationRoute")) {
      patch.conversation = sanitizeConversationRoute(body.conversationRoute);
    }
    const boundSource = patch.isPublic === true ? await resolvePublishSourceImage({ body, generation }) : null;
    if (boundSource) {
      patch.sourceImageId = boundSource.id;
      patch.sourcePrompt = boundSource.prompt || "";
      patch.originGalleryId = boundSource.originGalleryId || boundSource.id;
      patch.publishOriginal = true;
    }
    if (Object.hasOwn(body, "publicTags") || patch.isPublic === true) {
      patch.publicTags = await normalizePublishPublicTags(
        Object.hasOwn(body, "publicTags") ? body.publicTags : generation.publicTags,
        {
        kind: publicKindTagForGeneration({
          ...generation,
          sourceImageId: patch.sourceImageId,
          sourceImageData: body.sourceImageData,
          sourceImageUrl: body.sourceImageUrl,
          sourceFilename: body.sourceImageData ? "__pending_source__" : generation.sourceFilename
        }),
        incrementUsage: body.isPublic !== false
        }
      );
    }
    if (Object.hasOwn(body, "publishOriginal")) {
      patch.publishOriginal = body.publishOriginal === true;
    }
    if (Object.hasOwn(body, "archived")) {
      patch.archived = body.archived === true;
      if (patch.archived) {
        patch.isPublic = false;
        patch.publishOriginal = false;
      }
    }
    if ((patch.isPublic === false || patch.archived === true) && generation.isPublic && !canWithdrawDirectly(generation) && current.user.role !== "admin") {
      throw httpError("Withdrawal request required after 12 hours", 409, {
        withdrawalRequired: true,
        withdrawalStatus: generation.withdrawalStatus
      });
    }
    if (patch.isPublic === true && !generation.isPublic && !(await store.hasFirstPublicReward(generation.userId))) {
      patch.publicRewardStatus = "pending";
      patch.publicRewardAmount = FIRST_PUBLIC_REWARD_CREDIT;
      patch.withdrawalStatus = "none";
    }
    if (body.publishOriginal === true && body.sourceImageData) {
      patch.sourceFilename = await saveSourceImageFromData(body.sourceImageData);
      patch.publishOriginal = Boolean(patch.sourceFilename);
    } else if (Object.hasOwn(body, "publishOriginal") && body.publishOriginal !== true) {
      patch.publishOriginal = false;
    }
    if (boundSource) {
      patch.publishOriginal = true;
    }
    if (patch.isPublic === true) {
      const audit = await enforcePromptPublishAudit({ current, req, generation, body, patch });
      if (boundSource) {
        await writeAdminAudit(current, req, "prompt_audit_bind_source_image", "generation", generation.id, {
          auditId: audit?.id,
          sourceImageId: patch.sourceImageId,
          originGalleryId: patch.originGalleryId,
          sourcePrompt: patch.sourcePrompt,
          requiredMode: audit?.requiredMode || "",
          score: audit?.score || 0
        });
      }
    }
    const updated = await store.updateGenerationPublic(generation.id, patch);
    return sendJson(res, 200, {
      generation: {
        ...updated,
        imageUrl: `/api/images/${updated.id}/file`,
        sourceImageUrl: sourceImageUrlForGeneration(updated, { includePrivateSource: true }),
        ...sourceImageAuditFields(updated)
      }
    });
  }

  const imageReportMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/report$/);
  if (imageReportMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const generation = await store.getGenerationById(imageReportMatch[1]);
    if (!generation || !isPubliclyVisibleGeneration(generation)) {
      throw httpError("Image not found", 404);
    }
    const body = await readJsonBody(req);
    const reason = String(body.reason || "user_report").trim().slice(0, 80);
    const description = String(body.description || "").trim().slice(0, 500);
    const report = await store.createGenerationReport({
      generationId: generation.id,
      reporterUserId: current.user.id,
      reason,
      description
    });
    const updated = await store.getGenerationById(generation.id);
    await writeAdminAudit(current, req, "report_generation", "generation", generation.id, {
      reason,
      description,
      reportId: report?.id,
      reportCount: updated.reportCount
    });
    return sendJson(res, 202, { generation: generationResponse(updated) });
  }

  const withdrawalMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/withdrawal$/);
  if (withdrawalMatch && req.method === "POST") {
    const current = await getCurrentUser(req);
    ensureAuthenticated(current);
    const generation = await store.getGenerationById(withdrawalMatch[1]);
    if (!generation || !canTouchGeneration(current.user, generation)) {
      throw httpError("Image not found", 404);
    }
    const body = await readJsonBody(req);
    if (!generation.isPublic) throw httpError("Image is not public", 400);
    if (canWithdrawDirectly(generation)) {
      const updated = await store.updateGenerationPublic(generation.id, {
        isPublic: false,
        publishOriginal: false,
        withdrawalStatus: "approved",
        withdrawalRequestedAt: new Date(),
        withdrawalReason: body.reason || "direct withdrawal"
      });
      return sendJson(res, 200, { generation: updated, direct: true });
    }
    const updated = await store.updateGenerationPublic(generation.id, {
      withdrawalStatus: "requested",
      withdrawalRequestedAt: new Date(),
      withdrawalReason: body.reason || ""
    });
    return sendJson(res, 202, { generation: updated, direct: false });
  }

  const sourceMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/source-file$/);
  if (sourceMatch && (req.method === "GET" || req.method === "HEAD")) {
    const current = await getCurrentUser(req);
    const generation = await store.getGenerationById(sourceMatch[1]);
    if (!generation?.sourceFilename) {
      throw httpError("Image not found", 404);
    }
    if (!isPubliclyVisibleGeneration(generation) || !generation.publishOriginal) {
      ensureAuthenticated(current);
      if (!canTouchGeneration(current.user, generation)) {
        throw httpError("Image not found", 404);
      }
    }
    const absolutePath = path.join(SOURCE_DIR, generation.sourceFilename);
    const extension = path.extname(generation.sourceFilename).toLowerCase();
    const bytes = await fs.readFile(absolutePath);
    const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "original";
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": bytes.length,
      "X-Image-Variant": variant,
      "X-AI-Content-Source": "user-provided-source-image",
      "X-Privacy-Download": url.searchParams.get("privacy") === "1" ? "metadata-minimized" : "standard",
      "Vary": "Accept"
    }));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(bytes);
    return;
  }

  const fileMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/file$/);
  if (fileMatch && (req.method === "GET" || req.method === "HEAD")) {
    const current = await getCurrentUser(req);
    const generation = await store.getGenerationById(fileMatch[1]);
    if (!generation) {
      throw httpError("Image not found", 404);
    }
    if (!isPubliclyVisibleGeneration(generation)) {
      ensureAuthenticated(current);
      if (!canTouchGeneration(current.user, generation)) {
        throw httpError("Image not found", 404);
      }
    }
    const absolutePath = path.join(GENERATED_DIR, generation.filename);
    const extension = path.extname(generation.filename).toLowerCase();
    const bytes = await fs.readFile(absolutePath);
    const variant = url.searchParams.get("variant") === "thumb" ? "thumb" : "original";
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": bytes.length,
      "X-Image-Variant": variant,
      "X-AI-Content-Source": "ai-generated",
      "X-Privacy-Download": url.searchParams.get("privacy") === "1" ? "metadata-minimized" : "standard",
      "Vary": "Accept"
    }));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(bytes);
    return;
  }

  sendError(res, 404, "API route not found");
}

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname === "/admin" ? "/admin.html" : pathname;
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (absolutePath !== PUBLIC_DIR && !absolutePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendError(res, 403, "Forbidden");
  }

  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) throw new Error("not a file");
    const extension = path.extname(absolutePath).toLowerCase();
    const bytes = await fs.readFile(absolutePath);
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=3600"
    }));
    res.end(bytes);
  } catch {
    const html = await fs.readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }));
    res.end(html);
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/robots.txt") {
      res.writeHead(200, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" }));
      res.end("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n");
      return;
    }
    if (req.method === "GET" && url.pathname === "/sitemap.xml") {
      const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
      const cfVisitor = String(req.headers["cf-visitor"] || "");
      const cfProto = cfVisitor.match(/"scheme"\s*:\s*"([^"]+)"/)?.[1] || "";
      const proto = forwardedProto || cfProto || url.protocol.replace(":", "") || "http";
      const origin = `${proto}://${url.host}`;
      res.writeHead(200, withSecurityHeaders({ "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" }));
      res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n  <url><loc>${origin}/admin</loc></url>\n</urlset>\n`);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await routeApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    const status = error.status || 500;
    const message = status >= 500 ? "Internal server error" : error.message;
    if (status >= 500) console.error(error);
    sendError(res, status, message, error.details);
  }
}

async function bootstrapAdminAccount() {
  const rawEmail = String(process.env.ADMIN_EMAIL || "").trim();
  const rawPassword = String(process.env.ADMIN_PASSWORD || "");
  if (!rawEmail && !rawPassword) {
    if ((await store.countAdmins()) === 0) {
      console.warn("No admin account found. Set ADMIN_EMAIL and ADMIN_PASSWORD, then restart to create one.");
    }
    return;
  }
  if (!rawEmail || !rawPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set together.");
  }

  const email = normalizeEmail(rawEmail);
  requireEmail(email);
  requirePassword(rawPassword);

  const existing = await store.getUserByEmail(email);
  if (existing) {
    if (existing.role !== "admin" || existing.status !== "active") {
      await store.updateUser(existing.id, { role: "admin", status: "active" });
      console.log(`Admin account activated for ${email}`);
    }
    return;
  }

  const settings = await store.getSettings();
  await store.createUser({
    id: randomId("usr_"),
    name: String(process.env.ADMIN_NAME || "Admin").trim().slice(0, 60) || "Admin",
    email,
    passwordHash: hashPassword(rawPassword),
    role: "admin",
    status: "active",
    credits: Math.max(0, Number(settings.defaultCredits ?? 10) || 0)
  });
  console.log(`Admin account created for ${email}`);
}

async function seedPromptsFromJsonIfEmpty() {
  try {
    const existing = await store.countPrompts();
    if (existing > 0) {
      return;
    }
  } catch (error) {
    console.error("[prompts] count failed:", error?.message || error);
    return;
  }

  const jsonPath = path.join(PUBLIC_DIR, "prompts.json");
  let raw;
  try {
    raw = await fs.readFile(jsonPath, "utf8");
  } catch (error) {
    console.warn(`[prompts] seed skipped: cannot read ${jsonPath} (${error?.message || error})`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(`[prompts] seed skipped: invalid JSON (${error?.message || error})`);
    return;
  }
  const items = Array.isArray(parsed?.prompts) ? parsed.prompts : [];
  if (!items.length) {
    console.warn("[prompts] seed skipped: prompts.json contains zero entries");
    return;
  }
  const inserted = await store.seedPromptsIfEmpty(items);
  console.log(`[prompts] seeded ${inserted}/${items.length} prompts from prompts.json`);
}

async function start() {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(SOURCE_DIR, { recursive: true });
  await store.initializeDatabase({ defaultModel: DEFAULT_MODEL });
  await bootstrapAdminAccount();
  await seedPromptsFromJsonIfEmpty();
  // gallery_tags：表为空时灌 80 条系统种子。失败仅 console.warn 不阻塞。
  try {
    const inserted = await store.seedTagsIfEmpty();
    if (inserted) console.log(`[tags] seeded ${inserted} system tags`);
  } catch (error) {
    console.warn(`[tags] seed failed: ${error?.message || error}`);
  }
  const server = http.createServer((req, res) => {
    handleRequest(req, res);
  });
  server.listen(PORT, () => {
    console.log(`ai-image-studio running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
