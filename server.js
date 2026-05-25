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

const { createMySQLStore } = require("./src/mysql-store");
const store = createMySQLStore();
const promptReview = require("./src/prompt-review-service");
const { createCanvasService } = require("./src/canvas-service");
const promptSourceSync = require("./src/prompt-source-sync");
const {
  buildStartupRecoveryPatch,
  parseQueuePayload,
  queuePayloadForImageEdit,
  queuePayloadForTextGeneration
} = require("./src/generation-queue-recovery");
const { createGenerationQueueRunner } = require("./src/generation-queue-runner");
const { errorSummary, safeJsonSummary } = require("./src/generation-trace-service");
const {
  normalizeProviderMapping,
  runProviderMappingRequest
} = require("./src/provider-mapping");
const agentCore = require("@ai-image-studio/agent-core");
const createAgentGenerationService = agentCore.createGenerationService;
const createAgentSessionRoute = agentCore.createRoutes;
const { createAuthRoute } = require("./src/routes/auth");
const { createHealthRoute } = require("./src/routes/health");
const { createImagesRoute } = require("./src/routes/images");
const { createGalleryRoute } = require("./src/routes/gallery");
const { createPromptsRoute } = require("./src/routes/prompts");
const { createCanvasesRoute } = require("./src/routes/canvases");
const { createAdminRoute } = require("./src/routes/admin");
const { createCreditsRoute } = require("./src/routes/credits");
const { createSettingsPublicRoute } = require("./src/routes/settings-public");
const { createAnnouncementsRoute } = require("./src/routes/announcements");
const { createImagesGenerateRoute } = require("./src/routes/images-generate");
const { createSessionMiddleware } = require("./src/middleware/session");
const { createCsrfMiddleware } = require("./src/middleware/csrf");
const { createAppAuth } = require("./src/middleware/app-auth");
const { buildCreativeRouteForGeneration, scrubRouteValue } = require("./src/creative-route");

const {
  PUBLIC_DIR,
  DATA_DIR,
  GENERATED_DIR,
  SOURCE_DIR,
  PORT,
  APP_VERSION,
  SERVER_STARTED_AT,
  SESSION_TTL_MS,
  MAX_BODY_BYTES,
  MAX_IMAGE_EDIT_INPUTS,
  DEFAULT_MODEL,
  CHECKIN_CREDIT,
  DEFAULT_CONTACT_ADMIN_EMAIL,
  FIRST_PUBLIC_REWARD_CREDIT,
  PUBLIC_WITHDRAWAL_WINDOW_HOURS,
  TAG_SLUG_PATTERN,
  OPENAI_FETCH_TIMEOUT_MS,
  IMAGE_DOWNLOAD_TIMEOUT_MS,
  ALLOWED_IMAGE_MIME
} = require("./src/config/app-settings");
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

const {
  ensureAuthenticated,
  ensureActiveAuthenticated,
  ensureAdmin,
  canTouchGeneration,
  canWithdrawDirectly,
  isPubliclyVisibleGeneration,
  enforceGenerationRate
} = createAppAuth({ httpError, PUBLIC_WITHDRAWAL_WINDOW_HOURS });

const canvasService = createCanvasService({
  store,
  httpError,
  randomId,
  choose,
  cleanPrompt,
  sanitizePositiveInt,
  normalizeImageSize,
  validateImageDataUrl,
  normalizeGenerationCost,
  enforceGenerationRate,
  attachRequestAbortController,
  callOpenAIImages,
  callOpenAIImageEdits,
  saveGeneratedImages,
  getClientIp,
  getUserAgent,
  isPubliclyVisibleGeneration,
  resolveCanvasImageData,
  defaultModel: DEFAULT_MODEL
});

const generationWindows = new Map();
const rumEvents = [];
const GENERATION_RUNNER_ID = `${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
const PROVIDER_MAPPING_TRACE_STAGES = [
  "provider_mapping_submit",
  "provider_task_submitted",
  "provider_polled"
];
const GENERATION_QUEUE_CONCURRENCY = Math.max(1, Number.parseInt(process.env.GENERATION_QUEUE_CONCURRENCY || "1", 10) || 1);
const GENERATION_QUEUE_ESTIMATE_SECONDS = Math.max(20, Number.parseInt(process.env.GENERATION_QUEUE_ESTIMATE_SECONDS || "90", 10) || 90);
const GENERATION_QUEUE_STALE_RUNNING_MS = Math.max(
  60_000,
  Number.parseInt(process.env.GENERATION_QUEUE_STALE_RUNNING_MS || `${10 * 60 * 1000}`, 10) || 10 * 60 * 1000
);
const GENERATION_QUEUE_STALE_QUEUED_MS = Math.max(
  60_000,
  Number.parseInt(process.env.GENERATION_QUEUE_STALE_QUEUED_MS || `${60 * 60 * 1000}`, 10) || 60 * 60 * 1000
);
const GALLERY_LEADERBOARD_LIMIT_MAX = 99;
const generationQueueRunner = createGenerationQueueRunner({
  concurrency: GENERATION_QUEUE_CONCURRENCY,
  estimateSeconds: GENERATION_QUEUE_ESTIMATE_SECONDS,
  onBeforeRun: async (job) => {
    const attemptCount = Math.max(0, Number(job.attemptCount || 0)) + 1;
    job.attemptCount = attemptCount;
    await store.updateGenerationRequest(job.id, {
      status: "running",
      queueStatus: "running",
      attemptCount,
      lockedBy: GENERATION_RUNNER_ID,
      lockedAt: new Date(),
      startedAt: new Date()
    });
  },
  onError: (error) => console.error("[generation-queue]", error)
});

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

const sessionMiddleware = createSessionMiddleware({
  crypto,
  store,
  randomId,
  sessionTtlMs: SESSION_TTL_MS
});

const {
  clearSessionCookie,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  parseCookies,
  sessionCookie,
  shouldUseSecureCookie,
  timingSafeEqual,
  verifyPassword
} = sessionMiddleware;

const {
  csrfCookie,
  getOrCreateCsrfToken,
  verifyCsrf
} = createCsrfMiddleware({
  crypto,
  httpError,
  parseCookies,
  shouldUseSecureCookie,
  timingSafeEqual,
  sessionTtlMs: SESSION_TTL_MS
});

const handleHealthRoute = createHealthRoute({
  store,
  sendJson,
  sendNoContent,
  readJsonBody,
  publicSettings,
  nowIso,
  rumEvents,
  appVersion: APP_VERSION,
  serverStartedAt: SERVER_STARTED_AT,
  openaiFetchTimeoutMs: OPENAI_FETCH_TIMEOUT_MS,
  imageDownloadTimeoutMs: IMAGE_DOWNLOAD_TIMEOUT_MS
});

const {
  decorateAgentSession,
  generateAgentBatch,
  exportAgentCanvas
} = createAgentGenerationService({
  store,
  httpError,
  randomId,
  nowIso,
  choose,
  cleanPrompt,
  sanitizeGenerationTitle,
  normalizeImageSize,
  normalizeGenerationCost,
  sanitizeConversationRoute,
  getClientIp,
  getUserAgent,
  enforceGenerationRate,
  queuePayloadForTextGeneration,
  enqueueGenerationJob,
  runQueuedTextGeneration,
  traceGeneration,
  safeJsonSummary,
  defaultModel: DEFAULT_MODEL
});

const handleAgentSessionRoute = createAgentSessionRoute({
  ensureAuthenticated,
  getCurrentUser,
  httpError,
  randomId,
  readJsonBody,
  sanitizePositiveInt,
  sendJson,
  decorateAgentSession,
  generateAgentBatch,
  exportAgentCanvas,
  store
});

const handleAuthRoute = createAuthRoute({
  store,
  sendJson,
  sendNoContent,
  readJsonBody,
  publicSettings,
  httpError,
  randomId,
  parseCookies,
  normalizeEmail,
  requireEmail,
  requirePassword,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  sessionCookie,
  clearSessionCookie,
  csrfCookie,
  getOrCreateCsrfToken,
  getCurrentUser,
  serializeUser,
  CHECKIN_CREDIT
});

const handleImagesRoute = createImagesRoute({
  store,
  sendError,
  withSecurityHeaders,
  mimeTypes,
  getCurrentUser,
  ensureAuthenticated,
  canTouchGeneration,
  isPubliclyVisibleGeneration,
  generatedDir: GENERATED_DIR,
  sourceDir: SOURCE_DIR,
  httpError,
  sendJson,
  readJsonBody,
  sanitizePositiveInt,
  sourceImageUrlForGeneration,
  sourceImageAuditFields,
  ensureActiveAuthenticated,
  enforcePromptPublishAudit,
  publicKindTagForGeneration,
  normalizePublishPublicTags,
  canWithdrawDirectly,
  claimFirstPublicRewardForGeneration
});

const handleGalleryRoute = createGalleryRoute({
  store,
  sendJson,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  readJsonBody,
  cleanPrompt,
  auditPayload,
  isPubliclyVisibleGeneration,
  generationResponse,
  generationResponseForViewer,
  promptLeaderboardResponse,
  filterGenerationsWithImageFiles,
  imageFileExists,
  sanitizePositiveInt,
  writeAdminAudit,
  GALLERY_LEADERBOARD_LIMIT_MAX
});

const handlePromptsRoute = createPromptsRoute({
  store,
  sendJson,
  readJsonBody,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt,
  buildPromptPayload,
  buildTagPayload,
  buildPromptCategoryPayload,
  tagSummary,
  writeAdminAudit,
  reviewPendingPromptDuplicates,
  TAG_SLUG_PATTERN
});

const handleCanvasesRoute = createCanvasesRoute({
  canvasService,
  sendJson,
  readJsonBody,
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt
});


const handleAdminRoute = createAdminRoute({
  store,
  promptReview,
  sendJson,
  readJsonBody,
  httpError,
  randomId,
  getCurrentUser,
  ensureAuthenticated,
  ensureAdmin,
  sanitizePositiveInt,
  writeAdminAudit,
  cleanPromptSourceInput,
  runPromptSourceSync,
  reviewPendingPromptDuplicates,
  adminSettings,
  cleanProviderInput,
  normalizeProviderMapping,
  runProviderMappingRequest,
  fetchWithTimeout,
  DEFAULT_MODEL,
  extractImageItems,
  isSafeRemoteImageUrl,
  rumSummary,
  rumEvents,
  cleanAnnouncementInput,
  normalizeMaxReferenceImages,
  normalizeEmail,
  requireOptionalEmail,
  serializeUser,
  sourceImageUrlForGeneration,
  sourceImageAuditFields,
  generationResponse,
  callOpenAITextResponses,
  notifyWithdrawalDecision,
  notifyModerationOutcome,
  temporaryPassword,
  requireEmail,
  requirePassword,
  hashPassword,
  recoveredGenerationJobFromRequest,
  enqueueGenerationJob,
  cancelQueuedGenerationJob,
  traceGeneration,
  runGalleryFileChecks
});

const handleCreditsRoute = createCreditsRoute({
  store,
  sendJson,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  serializeUser,
  CHECKIN_CREDIT
});

const handleSettingsPublicRoute = createSettingsPublicRoute({
  store,
  sendJson,
  publicSettings
});

const handleAnnouncementsRoute = createAnnouncementsRoute({
  store,
  sendJson,
  httpError,
  getCurrentUser,
  ensureAuthenticated,
  sanitizePositiveInt
});

const handleImagesGenerateRoute = createImagesGenerateRoute({
  getCurrentUser, ensureAuthenticated, store, requestStatusPayload, sendJson,
  sendGenerationRequestStatus, httpError, cancelQueuedGenerationJob, traceGeneration,
  enforceGenerationRate, readJsonBody, cleanPrompt, sanitizePositiveInt,
  normalizeGenerationCost, DEFAULT_MODEL, sanitizeGenerationTitle, normalizeImageSize,
  choose, sanitizeConversationRoute, normalizePublishPublicTags, PUBLIC_KIND_TAGS,
  auditPayload, randomId, safeJsonSummary, getClientIp, getUserAgent,
  queuePayloadForTextGeneration, enqueueGenerationJob, runQueuedTextGeneration,
  attachRequestAbortController, callOpenAIImages, finalizeSuccessfulGenerations,
  errorSummary, editableImageSource, validateImageDataUrl, normalizedEditReferenceImages,
  normalizeMaxReferenceImages, saveSourceImageFromData, queuePayloadForImageEdit,
  runQueuedImageEdit, callOpenAIImageEdits
});


const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const securityHeaders = {
  "Content-Security-Policy-Report-Only": [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
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

function httpError(message, status = 400, details) {
  return Object.assign(new Error(message), { status, details });
}

function nowIso() {
  return new Date().toISOString();
}

async function traceGeneration(requestId, stage, { userId = "", generationId = "", level = "info", message = "", data = null } = {}) {
  if (!requestId) return null;
  return store.appendGenerationTrace({
    requestId,
    generationId,
    userId,
    stage,
    level,
    message,
    data
  }).catch((error) => {
    console.error("[generation-trace]", error);
    return null;
  });
}

function providerTraceSummary(route = {}, payload = {}, endpoint = "") {
  const provider = route.provider || {};
  return safeJsonSummary({
    provider: {
      id: provider.id || "legacy",
      name: provider.name || "Legacy settings",
      providerType: provider.providerType || "openai-compatible"
    },
    endpoint,
    mappingMode: route.settings?.providerMapping?.mode || "",
    model: payload.model || "",
    request: payload
  });
}

function generationProviderResponseSummary(data = {}, response = null) {
  return safeJsonSummary({
    status: response?.status || null,
    usage: data?.usage || null,
    itemCount: extractImageItems(data).length,
    revisedPrompt: firstRevisedPrompt(data),
    raw: data
  });
}

function firstRevisedPrompt(openaiResult = {}) {
  const direct = Array.isArray(openaiResult.data) ? openaiResult.data : [];
  for (const item of direct) {
    if (item?.revised_prompt) return String(item.revised_prompt).slice(0, 4000);
    if (item?.revisedPrompt) return String(item.revisedPrompt).slice(0, 4000);
  }
  const outputs = Array.isArray(openaiResult.output) ? openaiResult.output : [];
  for (const output of outputs) {
    if (output?.revised_prompt) return String(output.revised_prompt).slice(0, 4000);
    const content = Array.isArray(output?.content) ? output.content : [];
    for (const part of content) {
      if (part?.revised_prompt) return String(part.revised_prompt).slice(0, 4000);
    }
  }
  return "";
}

function randomId(prefix = "") {
  return `${prefix}${crypto.randomBytes(12).toString("hex")}`;
}

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    credits: user.credits,
    createdAt: user.createdAt,
    firstPublicRewardStatus: user.firstPublicRewardStatus || "none",
    firstPublicRewardAmount: Number(user.firstPublicRewardAmount || 0),
    firstPublicRewardGenerationId: user.firstPublicRewardGenerationId || "",
    firstPublicRewardAwardedAt: user.firstPublicRewardAwardedAt || null,
    firstPublicRewardCreatedAt: user.firstPublicRewardCreatedAt || null
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

function isSafeRemoteImageUrl(value = "") {
  try {
    const parsed = new URL(String(value || ""));
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeRemoteImageUrl(value = "") {
  const raw = String(value || "").trim();
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com") return raw;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const blobIndex = parts.indexOf("blob");
    if (parts.length < 5 || blobIndex !== 2) return raw;
    const [owner, repo] = parts;
    const branch = parts[blobIndex + 1];
    const filePath = parts.slice(blobIndex + 2).map(encodeURIComponent).join("/");
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${filePath}`;
  } catch {
    return raw;
  }
}

function providerCapabilities(settings = {}) {
  const model = String(settings.model || DEFAULT_MODEL).toLowerCase();
  const configured = settings.providerCapabilityConfig && typeof settings.providerCapabilityConfig === "object"
    ? settings.providerCapabilityConfig
    : {};
  const defaults = {
    textToImage: true,
    imageEdit: true,
    imageToImage: true,
    multiCandidate: true,
    asyncTasks: false,
    batch: false,
    responses: true,
    revisedPrompt: true,
    sizes: [],
    qualities: [],
    formats: [],
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
    providerMapping: provider.mapping || {},
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

function providerCapabilityListIncludes(capabilities = {}, key, value) {
  if (!Array.isArray(capabilities[key]) || !capabilities[key].length) return true;
  return capabilities[key].map((item) => String(item)).includes(String(value));
}

function canProviderHandle(provider, settings, request = {}) {
  const routed = routeSettingsForProvider(settings, provider);
  const capabilities = providerCapabilities(routed);
  if (provider && provider.status !== "active") return false;
  if (!getOpenAIApiKey(routed) || !getOpenAIBaseUrl(routed)) return false;
  if (request.mode === "image-edit" && !providerCapabilityValue(capabilities, "imageEdit", providerCapabilityValue(capabilities, "imageToImage"))) return false;
  if (request.mode === "text-to-image" && !providerCapabilityValue(capabilities, "textToImage")) return false;
  if (request.transparentBackground && !providerCapabilityValue(capabilities, "transparentBackground")) return false;
  const candidateCount = Math.max(1, Number(request.candidateCount || 1));
  if (candidateCount > 1 && !providerCapabilityValue(capabilities, "multiCandidate")) return false;
  const maxImages = Number(capabilities.maxImagesPerRequest || routed.maxImagesPerRequest || 1);
  if (candidateCount > maxImages) return false;
  if (request.size && !providerCapabilityListIncludes(capabilities, "sizes", request.size)) return false;
  if (request.quality && !providerCapabilityListIncludes(capabilities, "qualities", request.quality)) return false;
  if ((request.outputFormat || request.output_format) && !providerCapabilityListIncludes(capabilities, "formats", request.outputFormat || request.output_format)) return false;
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
        providerType: provider.providerType,
        mapping: provider.mapping || {}
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

function firstPublicRewardCredit(settings = {}) {
  const value = Number(settings.firstPublicRewardCredit ?? FIRST_PUBLIC_REWARD_CREDIT);
  return Number.isFinite(value) ? Math.max(0, value) : FIRST_PUBLIC_REWARD_CREDIT;
}

function publicRewardHoldMinutes(settings = {}) {
  const value = Number(settings.publicRewardHoldMinutes ?? PUBLIC_WITHDRAWAL_WINDOW_HOURS * 60);
  return Number.isFinite(value) ? Math.max(1, value) : PUBLIC_WITHDRAWAL_WINDOW_HOURS * 60;
}

function canvasEntryMode() {
  return choose(
    String(process.env.CANVAS_ENTRY_MODE || process.env.CANVAS_V2_ENTRY_MODE || "v2").trim().toLowerCase(),
    ["v2", "legacy", "hidden"],
    "v2"
  );
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
  const rewardHoldMinutes = publicRewardHoldMinutes(settings);
  const model = activeProvider?.defaultModel || settings.model || DEFAULT_MODEL;
  return {
    hasApiKey: Boolean((activeProvider?.apiKey && activeProvider?.baseUrl) || (getOpenAIApiKey(settings) && getOpenAIBaseUrl(settings))),
    model,
    allowRegistration: Boolean(settings.allowRegistration),
    requireApproval: Boolean(settings.requireApproval),
    defaultCredits: Number(settings.defaultCredits || 0),
    generationCreditCost: normalizeGenerationCost(settings.generationCreditCost ?? 1),
    firstPublicRewardCredit: firstPublicRewardCredit(settings),
    publicRewardHoldMinutes: rewardHoldMinutes,
    publicUnpublishAllowed: Boolean(settings.publicUnpublishAllowed),
    publicRewardNotificationsEnabled: settings.publicRewardNotificationsEnabled !== false,
    contactEmail: contactAdminEmail(settings),
    contactAdminEmail: contactAdminEmail(settings),
    checkinCredit: CHECKIN_CREDIT,
    canvasEntryMode: canvasEntryMode(),
    maxImagesPerRequest: Number(settings.maxImagesPerRequest || 1),
    maxReferenceImages: normalizeMaxReferenceImages(settings.maxReferenceImages),
    publicWithdrawalWindowHours: Math.max(1, Math.ceil(rewardHoldMinutes / 60)),
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
    defaultProviderId: settings.defaultProviderId || activeProvider?.id || "",
    firstPublicRewardCredit: firstPublicRewardCredit(settings),
    publicRewardHoldMinutes: publicRewardHoldMinutes(settings),
    publicUnpublishAllowed: Boolean(settings.publicUnpublishAllowed),
    publicRewardNotificationsEnabled: settings.publicRewardNotificationsEnabled !== false
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

function sanitizeGenerationTitle(value = "", prompt = "") {
  const explicit = String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (explicit) return explicit;
  return String(prompt || "").trim().replace(/\s+/g, " ").slice(0, 42);
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

function normalizeMaxReferenceImages(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 4;
  return Math.min(parsed, MAX_IMAGE_EDIT_INPUTS - 1);
}

function cleanProviderInput(body = {}, existing = null) {
  const capabilities = body.capabilities && typeof body.capabilities === "object" ? body.capabilities : existing?.capabilities || {};
  const routing = body.routing && typeof body.routing === "object" ? body.routing : existing?.routing || {};
  let mapping = body.mapping && typeof body.mapping === "object" ? body.mapping : existing?.mapping || {};
  try {
    mapping = normalizeProviderMapping(mapping);
  } catch (error) {
    throw httpError(error.message || "Provider mapping is invalid", error.status || 400);
  }
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
    mapping,
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

function generationNoticeName(generation) {
  const prompt = String(generation?.prompt || "").replace(/\s+/g, " ").trim();
  if (!prompt) return String(generation?.id || "公开作品");
  return prompt.length > 36 ? `${prompt.slice(0, 36)}...` : prompt;
}

async function sendUserNotification({
  userIds = [],
  title = "系统通知",
  body = "",
  level = "info",
  displayMode = "feed",
  isImportant = false,
  requiresAck = false,
  createdBy = null,
  metadata = {}
} = {}) {
  const targetUserIds = [...new Set((Array.isArray(userIds) ? userIds : [userIds])
    .map((id) => String(id || "").trim())
    .filter(Boolean))];
  if (!targetUserIds.length) return null;
  try {
    return await store.createAnnouncement({
      id: randomId("ntf_"),
      title: String(title || "系统通知").trim().slice(0, 160) || "系统通知",
      body: String(body || title || "系统通知").trim().slice(0, 12000) || "系统通知",
      level: choose(String(level || "info"), ["info", "success", "warning", "danger", "maintenance", "feature"], "info"),
      displayMode: choose(String(displayMode || "feed"), ["modal", "banner", "feed"], "feed"),
      audience: "specific-users",
      status: "published",
      isImportant,
      requiresAck,
      createdBy,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      targetUserIds
    });
  } catch (error) {
    console.error("[notification]", error);
    return null;
  }
}

async function notifyReportSubmitted({ generation, reporterUserId, report }) {
  if (!report || report.alreadyPending) return;
  const name = generationNoticeName(generation);
  const metadata = {
    type: "generation_report_submitted",
    generationId: generation.id,
    reportId: report.id,
    reason: report.reason || ""
  };
  if (generation.userId && generation.userId !== reporterUserId) {
    await sendUserNotification({
      userIds: [generation.userId],
      title: "公开作品收到举报",
      body: `你的公开作品「${name}」收到举报，已进入人工审核。审核期间作品会保持当前可见状态，处理结果会通过通知告知。`,
      level: "warning",
      metadata
    });
  }
  if (reporterUserId) {
    await sendUserNotification({
      userIds: [reporterUserId],
      title: "举报已提交",
      body: `你对公开作品「${name}」的举报已提交，管理员处理后会通过通知告知结果。`,
      level: "info",
      metadata
    });
  }
}

async function notifyModerationOutcome({ generation, action, reason = "", reports = [], actorUserId = null }) {
  const name = generationNoticeName(generation);
  const reasonText = reason ? `处理原因：${reason}` : "管理员已完成审核。";
  const reporterIds = [...new Set(reports.map((report) => report.reporterUserId).filter(Boolean))];
  const metadata = {
    type: "generation_moderation",
    generationId: generation.id,
    action,
    reason
  };
  if (action === "hide") {
    await sendUserNotification({
      userIds: [generation.userId],
      title: "公开作品已隐藏",
      body: `你的公开作品「${name}」已被管理员隐藏，前台广场不再展示。${reasonText}`,
      level: "danger",
      isImportant: true,
      createdBy: actorUserId,
      metadata
    });
    await sendUserNotification({
      userIds: reporterIds,
      title: "举报已处理",
      body: `你举报的公开作品「${name}」已被管理员隐藏。感谢反馈。`,
      level: "success",
      createdBy: actorUserId,
      metadata
    });
  } else if (action === "reject") {
    await sendUserNotification({
      userIds: [generation.userId],
      title: "举报审核已结束",
      body: `你的公开作品「${name}」的举报审核已结束，管理员未隐藏该作品。${reasonText}`,
      level: "success",
      createdBy: actorUserId,
      metadata
    });
    await sendUserNotification({
      userIds: reporterIds,
      title: "举报已审核",
      body: `你提交的公开作品「${name}」举报已审核，管理员未隐藏该作品。${reasonText}`,
      level: "info",
      createdBy: actorUserId,
      metadata
    });
  } else if (action === "restore") {
    await sendUserNotification({
      userIds: [generation.userId],
      title: "公开作品已恢复",
      body: `你的公开作品「${name}」已由管理员恢复展示。${reasonText}`,
      level: "success",
      createdBy: actorUserId,
      metadata
    });
    await sendUserNotification({
      userIds: reporterIds,
      title: "举报已审核",
      body: `你提交的公开作品「${name}」举报已审核，管理员恢复了该作品。${reasonText}`,
      level: "info",
      createdBy: actorUserId,
      metadata
    });
  }
}

async function notifyWithdrawalRequest({ generation, direct = false }) {
  const name = generationNoticeName(generation);
  await sendUserNotification({
    userIds: [generation.userId],
    title: direct ? "公开作品已撤回" : "撤回申请已提交",
    body: direct
      ? `你的公开作品「${name}」已在 ${PUBLIC_WITHDRAWAL_WINDOW_HOURS} 小时窗口内撤回，前台广场不再展示。`
      : `你的公开作品「${name}」已超过 ${PUBLIC_WITHDRAWAL_WINDOW_HOURS} 小时撤回窗口，撤回申请已提交给管理员审核。`,
    level: direct ? "success" : "warning",
    metadata: {
      type: "generation_withdrawal",
      generationId: generation.id,
      direct
    }
  });
}

async function notifyWithdrawalDecision({ generation, decision, reason = "", actorUserId = null }) {
  const name = generationNoticeName(generation);
  const approved = decision === "approved";
  await sendUserNotification({
    userIds: [generation.userId],
    title: approved ? "撤回申请已批准" : "撤回申请被拒绝",
    body: approved
      ? `你的公开作品「${name}」撤回申请已批准，前台广场不再展示。`
      : `你的公开作品「${name}」撤回申请被拒绝，作品会继续保持公开。${reason ? `原因：${reason}` : ""}`,
    level: approved ? "success" : "warning",
    createdBy: actorUserId,
    metadata: {
      type: "generation_withdrawal_decision",
      generationId: generation.id,
      decision,
      reason
    }
  });
}

async function notifyPublicRewardLocked({ generation, amount, holdMinutes, settings }) {
  if (settings?.publicRewardNotificationsEnabled === false || !generation?.userId || amount <= 0) return;
  const name = generationNoticeName(generation);
  await sendUserNotification({
    userIds: [generation.userId],
    title: "公开奖励已锁定",
    body: `你的公开作品「${name}」已锁定首次公开奖励 +${amount} 积分。作品公开满 ${holdMinutes} 分钟后自动入账；公开后用户不可自行取消公开。`,
    level: "success",
    metadata: { type: "first_public_reward_locked", generationId: generation.id, amount, holdMinutes }
  });
}

async function notifyPublicRewardAwarded({ generation, amount, settings }) {
  if (settings?.publicRewardNotificationsEnabled === false || !generation?.userId || amount <= 0) return;
  const name = generationNoticeName(generation);
  await sendUserNotification({
    userIds: [generation.userId],
    title: "公开奖励已入账",
    body: `你的公开作品「${name}」已满足公开时长要求，首次公开奖励 +${amount} 积分已入账。`,
    level: "success",
    metadata: { type: "first_public_reward_awarded", generationId: generation.id, amount }
  });
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

function canvasImageRouteReference(value = "") {
  const match = String(value || "").trim().match(/^\/api\/images\/([^/]+)\/(file|source-file)(?:[?#].*)?$/);
  return match ? { id: match[1], kind: match[2] } : { id: "", kind: "" };
}

async function localImageFileDataUrl(kind, filename) {
  const absolutePath = imageFileAbsolutePath(kind, filename);
  const buffer = await fs.readFile(absolutePath).catch((error) => {
    if (error?.code === "ENOENT") throw httpError("Image file not found", 404);
    throw error;
  });
  const mime = detectImageMime(buffer);
  if (!mime || !ALLOWED_IMAGE_MIME.has(mime)) {
    throw httpError("Canvas image node is missing an editable PNG/JPEG/WebP image", 400);
  }
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function resolveCanvasImageData({ imageData = "", user = null } = {}) {
  const source = String(imageData || "").trim();
  const reference = canvasImageRouteReference(source);
  if (!reference.id) return source;
  const generation = await store.getGenerationById(reference.id);
  if (!generation) throw httpError("Image not found", 404);

  if (reference.kind === "source-file") {
    if (!generation.sourceFilename) throw httpError("Image not found", 404);
    if (!isPubliclyVisibleGeneration(generation) || !generation.publishOriginal) {
      if (!user || !canTouchGeneration(user, generation)) throw httpError("Image not found", 404);
    }
    return localImageFileDataUrl("source", generation.sourceFilename);
  }

  if (!isPubliclyVisibleGeneration(generation)) {
    if (!user || !canTouchGeneration(user, generation)) throw httpError("Image not found", 404);
  }
  return localImageFileDataUrl("generated", generation.filename);
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
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`${label} timeout`));
  }, timeoutMs);
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
    if (external?.aborted) {
      // 外部触发的取消：保留原错误，让上层根据 generation_requests 状态决定是否退积分。
      throw error;
    }
    if (timedOut || error?.name === "AbortError" || String(error?.message || "").includes(`${label} timeout`)) {
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

async function callOpenAIImages(settings, payload, { signal, trace = null } = {}) {
  const routes = await resolveProviderRoutes(settings, {
    mode: "text-to-image",
    candidateCount: Number(payload.n || 1),
    transparentBackground: payload.background === "transparent",
    size: payload.size,
    quality: payload.quality,
    outputFormat: payload.output_format
  });
  let lastError = null;
  for (const route of routes) {
    try {
      const apiKey = getOpenAIApiKey(route.settings);
      const routedPayload = { ...payload, model: route.settings.model || payload.model || DEFAULT_MODEL };
      const mapping = route.settings.providerMapping && Object.keys(route.settings.providerMapping).length
        ? normalizeProviderMapping(route.settings.providerMapping)
        : null;
      const endpoint = mapping ? `provider-mapping:${mapping.mode}` : getOpenAIImageEndpoint(route.settings);
      const providerParams = providerTraceSummary(route, routedPayload, endpoint);
      if (trace?.requestId) {
        await store.updateGenerationRequest(trace.requestId, { providerParams }).catch((error) => console.error(error));
        await traceGeneration(trace.requestId, "provider_selected", {
          userId: trace.userId,
          data: providerParams
        });
        await traceGeneration(trace.requestId, "provider_submitted", {
          userId: trace.userId,
          data: { provider: providerParams.provider, endpoint: providerParams.endpoint, model: providerParams.model }
        });
      }
      if (mapping) {
        const data = await runProviderMappingRequest({
          apiKey,
          baseUrl: getOpenAIBaseUrl(route.settings),
          fetchFn: (label, url, init) => fetchWithTimeout(label, url, init, OPENAI_FETCH_TIMEOUT_MS),
          mapping,
          payload: routedPayload,
          signal,
          onTrace: async (stage, data) => {
            if (!trace?.requestId) return;
            if (data?.providerTaskId) {
              const patch = { providerTaskId: data.providerTaskId };
              if (stage === "provider_task_submitted") patch.queueStatus = "polling";
              await store.updateGenerationRequest(trace.requestId, patch).catch((error) => console.error(error));
            }
            await traceGeneration(trace.requestId, stage, {
              userId: trace.userId,
              data
            });
          }
        });
        if (trace?.requestId) {
          const providerResponse = generationProviderResponseSummary(data, { status: data.providerStatus || 200 });
          await store.updateGenerationRequest(trace.requestId, {
            providerResponse,
            revisedPrompt: providerResponse.revisedPrompt || ""
          }).catch((error) => console.error(error));
          await traceGeneration(trace.requestId, "provider_response", {
            userId: trace.userId,
            data: providerResponse
          });
        }
        await markProviderHealth(route.provider, { healthStatus: "ok", lastError: "" });
        return data;
      }
      const response = await fetchWithTimeout("OpenAI image request", endpoint, {
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
      if (trace?.requestId) {
        const providerResponse = generationProviderResponseSummary(data, response);
        await store.updateGenerationRequest(trace.requestId, {
          providerResponse,
          revisedPrompt: providerResponse.revisedPrompt || ""
        }).catch((error) => console.error(error));
        await traceGeneration(trace.requestId, "provider_response", {
          userId: trace.userId,
          data: providerResponse
        });
      }
      await markProviderHealth(route.provider, { healthStatus: "ok", lastError: "" });
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = withProviderFailure(error, route.provider);
      if (trace?.requestId) {
        await traceGeneration(trace.requestId, "provider_failed", {
          userId: trace.userId,
          level: "warn",
          data: {
            provider: route.provider,
            error: errorSummary(error)
          }
        });
      }
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

async function callOpenAITextResponses(settings, payload, { signal } = {}) {
  const routes = await resolveProviderRoutes(settings, { mode: "text-to-image", candidateCount: 1 });
  let lastError = null;
  for (const route of routes) {
    try {
      const apiKey = getOpenAIApiKey(route.settings);
      const routedPayload = { ...payload, model: route.settings.model || payload.model || DEFAULT_MODEL };
      const response = await fetchWithTimeout("OpenAI prompt review", getOpenAIResponsesEndpoint(route.settings), {
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
        const message = data?.error?.message || "OpenAI prompt review failed";
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
  throw lastError || httpError("OpenAI prompt review failed", 502);
}

async function reviewPendingPromptDuplicates({ limit = 12, mock = false } = {}) {
  const candidates = await store.listPromptDuplicateCandidates({
    status: "pending",
    limit: sanitizePositiveInt(limit, 12, 50)
  });
  const targets = candidates.filter((item) => item.aiReview?.status === "not_reviewed");
  if (!targets.length) return 0;
  const settings = await store.getSettings();
  let reviewed = 0;
  for (const candidate of targets) {
    const review = await promptReview.reviewPromptDuplicateCandidate(candidate, {
      mock: mock || process.env.PROMPT_REVIEW_MOCK === "1",
      callModel: (payload) => callOpenAITextResponses(settings, payload)
    });
    await store.updatePromptDuplicateAiReview(candidate.id, review);
    reviewed += 1;
  }
  return reviewed;
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

function editableImageSource(value, label = "Editable image") {
  const source = String(value || "").trim();
  if (!source) return "";
  if (source.startsWith("data:image/")) {
    validateImageDataUrl(source);
    return source;
  }
  if (/^https?:\/\//i.test(source)) {
    if (!isSafeRemoteImageUrl(source)) throw httpError(`${label} URL is not allowed`, 400);
    return source;
  }
  throw httpError(`${label} must be PNG/JPEG/WebP image data or a safe HTTPS image URL`, 400);
}

function imageReferenceSource(input) {
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "";
  return input.imageData || input.dataUrl || input.url || input.imageUrl || "";
}

function normalizedEditReferenceImages(body = {}, { limit = MAX_IMAGE_EDIT_INPUTS - 1 } = {}) {
  const rawItems = Array.isArray(body.referenceImages)
    ? body.referenceImages
    : Array.isArray(body.referenceImageData)
      ? body.referenceImageData
      : [];
  const references = [];
  const maxReferences = Math.max(0, Math.min(MAX_IMAGE_EDIT_INPUTS - 1, Number.parseInt(limit, 10) || 0));
  if (maxReferences < 1) return references;
  for (const item of rawItems) {
    const source = imageReferenceSource(item);
    if (!String(source || "").trim()) continue;
    references.push(editableImageSource(source, "Reference image"));
    if (references.length >= maxReferences) break;
  }
  return references;
}

async function remoteImageSourceToBlob(source) {
  if (!isSafeRemoteImageUrl(source)) throw httpError("Image URL is not allowed", 400);
  const response = await fetchWithTimeout("Image reference download", source, {}, IMAGE_DOWNLOAD_TIMEOUT_MS);
  if (!response.ok) throw httpError(`Image reference download failed: ${response.status}`, 502);
  const declared = normalizeImageMime(String(response.headers.get("content-type") || "").split(";")[0]);
  if (declared && !ALLOWED_IMAGE_MIME.has(declared)) {
    throw httpError(`Unsupported image type: ${declared}. Allowed: PNG/JPEG/WebP.`, 400);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const detected = detectImageMime(buffer);
  if (!detected || (declared && detected !== declared)) {
    throw httpError("Image content does not match the declared MIME type", 400);
  }
  return new Blob([buffer], { type: detected });
}

async function imageSourceToBlob(source) {
  const sourceValue = String(source || "").trim();
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(sourceValue)) {
    return dataUrlToBlob(sourceValue);
  }
  if (/^https?:\/\//i.test(sourceValue)) {
    return remoteImageSourceToBlob(sourceValue);
  }
  if (!sourceValue) {
    throw httpError(
      "Editable image must be uploaded as PNG/JPEG/WebP image data. Please re-upload or choose the image again.",
      400
    );
  }
  throw httpError("Editable image must be PNG/JPEG/WebP image data or a safe HTTPS image URL.", 400);
}

async function callOpenAIImageEdits(settings, payload, { signal, trace = null } = {}) {
  const routes = await resolveProviderRoutes(settings, { mode: "image-edit", candidateCount: Number(payload.n || 1) });
  const imageSources = [
    payload.imageData,
    ...(Array.isArray(payload.referenceImages) ? payload.referenceImages : [])
  ].filter(Boolean).slice(0, MAX_IMAGE_EDIT_INPUTS);
  const imageBlobs = [];
  for (const source of imageSources) {
    imageBlobs.push(await imageSourceToBlob(source));
  }
  if (!imageBlobs.length) throw httpError("Please provide an editable image", 400);
  const maskBlob = payload.maskData?.startsWith("data:image/") ? dataUrlToBlob(payload.maskData) : null;
  let lastError = null;
  for (const route of routes) {
    try {
      const apiKey = getOpenAIApiKey(route.settings);
      const endpoint = getOpenAIEditEndpoint(route.settings);
      const providerPayload = {
        model: route.settings.model || payload.model || DEFAULT_MODEL,
        prompt: payload.prompt,
        n: payload.n || 1,
        size: payload.size || "auto",
        response_format: "url",
        imageCount: imageBlobs.length,
        hasMask: Boolean(maskBlob)
      };
      const providerParams = providerTraceSummary(route, providerPayload, endpoint);
      if (trace?.requestId) {
        await store.updateGenerationRequest(trace.requestId, { providerParams }).catch((error) => console.error(error));
        await traceGeneration(trace.requestId, "provider_selected", {
          userId: trace.userId,
          data: providerParams
        });
        await traceGeneration(trace.requestId, "provider_submitted", {
          userId: trace.userId,
          data: { provider: providerParams.provider, endpoint: providerParams.endpoint, model: providerParams.model }
        });
      }
      const form = new FormData();
      form.set("model", route.settings.model || payload.model || DEFAULT_MODEL);
      form.set("prompt", payload.prompt);
      form.set("n", String(payload.n || 1));
      form.set("size", payload.size || "auto");
      form.set("response_format", "url");
      const imageField = imageBlobs.length > 1 ? "image[]" : "image";
      imageBlobs.forEach((imageBlob, index) => {
        const extension = extensionFromContentType(imageBlob.type, "png");
        form.append(imageField, imageBlob, `image-${index + 1}.${extension}`);
      });
      if (maskBlob) {
        form.set("mask", maskBlob, "mask.png");
      }

      const response = await fetchWithTimeout("OpenAI image edits", endpoint, {
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
      if (trace?.requestId) {
        const providerResponse = generationProviderResponseSummary(data, response);
        await store.updateGenerationRequest(trace.requestId, {
          providerResponse,
          revisedPrompt: providerResponse.revisedPrompt || ""
        }).catch((error) => console.error(error));
        await traceGeneration(trace.requestId, "provider_response", {
          userId: trace.userId,
          data: providerResponse
        });
      }
      await markProviderHealth(route.provider, { healthStatus: "ok", lastError: "" });
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = withProviderFailure(error, route.provider);
      if (trace?.requestId) {
        await traceGeneration(trace.requestId, "provider_failed", {
          userId: trace.userId,
          level: "warn",
          data: {
            provider: route.provider,
            error: errorSummary(error)
          }
        });
      }
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
    if (!isSafeRemoteImageUrl(item.url)) throw httpError("Image URL is not allowed", 400);
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
    nodeId: String(step?.nodeId || "").slice(0, 64),
    type: String(step?.type || "image").slice(0, 32),
    label: String(step?.label || step?.title || "").trim().slice(0, 160),
    prompt: String(step?.prompt || step?.body || "").trim().slice(0, 1200),
    imageUrl: publicRouteImageRef(step?.imageUrl || step?.images?.[0] || ""),
    generationId: String(step?.generationId || "").trim().slice(0, 64),
    sourceImageId: String(step?.sourceImageId || "").trim().slice(0, 64),
    sourceImageUrl: publicRouteImageRef(step?.sourceImageUrl || ""),
    model: String(step?.model || "").trim().slice(0, 120),
    size: String(step?.size || "").trim().slice(0, 32),
    quality: String(step?.quality || "").trim().slice(0, 32),
    createdAt: String(step?.createdAt || step?.time || "").slice(0, 64),
    data: scrubRouteValue(step?.data || {})
  })).filter((step) => step.prompt || step.imageUrl || step.generationId);
}

function publicRouteImageRef(value) {
  const text = String(value || "").trim();
  if (!text || /^(data:|blob:)/i.test(text)) return "";
  if (/^\/api\/images\/[^/]+\/source-file(?:[?#].*)?$/i.test(text)) return "";
  return text.slice(0, 500);
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
  const hasAny = (...keys) => keys.some((key) => Object.hasOwn(body, key));
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
  if (hasAny("image", "imageUrl", "coverUrl") || !partial) {
    payload.image = sanitizeUrlField(body.image ?? body.imageUrl ?? body.coverUrl, 500);
  }
  if (hasAny("preview", "coverUrl") || !partial) {
    payload.preview = sanitizeUrlField(body.preview ?? body.coverUrl ?? "", 500);
  }
  set("tags", (value) => sanitizePromptTags(value));
  set("category", (value) => String(value || "general").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "general");
  set("visibility", (value) => {
    const visibility = String(value || "public").trim().toLowerCase();
    return ["public", "private", "internal"].includes(visibility) ? visibility : "public";
  });
  set("author", (value) => String(value || "").trim().slice(0, 120));
  set("source", (value) => String(value || "").trim().slice(0, 120));
  set("sourceUrl", (value) => sanitizeUrlField(value, 500));
  set("githubUrl", (value) => sanitizeUrlField(value, 500));
  set("remoteId", (value) => String(value || "").trim().slice(0, 160));
  set("sourceRepo", (value) => String(value || "").trim().slice(0, 160));
  set("sourceCategory", (value) => String(value || "").trim().slice(0, 120));
  set("promptType", (value) => {
    const promptType = String(value || "text-to-image").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return promptType || "text-to-image";
  });
  set("language", (value) => String(value || "zh").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16) || "zh");
  set("modelHint", (value) => String(value || "").trim().slice(0, 120));
  set("syncedAt", (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  });
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

function cleanPromptSourceInput(body = {}, existing = {}) {
  const payload = {};
  const set = (key, transform) => {
    if (Object.hasOwn(body, key)) payload[key] = transform(body[key]);
  };
  set("name", (value) => String(value || "").trim().slice(0, 120));
  set("sourceType", (value) => String(value || "github").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "github");
  set("repoUrl", (value) => sanitizeUrlField(value, 500));
  set("branch", (value) => String(value || "main").trim().slice(0, 80));
  set("parser", (value) => String(value || "").trim().slice(0, 80));
  set("status", (value) => String(value || "active").trim().toLowerCase() === "disabled" ? "disabled" : "active");
  set("sortOrder", (value) => {
    const order = Number.parseInt(value, 10);
    return Number.isFinite(order) ? order : 0;
  });
  set("config", (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {});
  if (!existing.id) {
    if (!payload.name) throw httpError("Source name is required", 400);
    if (!payload.repoUrl) throw httpError("Source repo URL is required", 400);
    if (!Object.hasOwn(payload, "sourceType")) payload.sourceType = "github";
    if (!Object.hasOwn(payload, "branch")) payload.branch = "main";
    if (!Object.hasOwn(payload, "status")) payload.status = "active";
    if (!Object.hasOwn(payload, "sortOrder")) payload.sortOrder = 0;
    if (!Object.hasOwn(payload, "config")) payload.config = {};
  }
  return payload;
}

async function runPromptSourceSync(source) {
  return promptSourceSync.runPromptSourceSync(source, {
    store,
    fetchWithTimeout,
    httpError,
    sanitizePromptTags,
    sanitizeUrlField
  });
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
  let sourceFile = null;
  if (raw.startsWith("data:image/")) {
    const validated = validateImageDataUrl(raw);
    sourceFile = await imageItemToBuffer({ b64_json: validated.base64 }, { output_format: "png" });
  } else if (/^https?:\/\//i.test(raw)) {
    const blob = await imageSourceToBlob(raw);
    sourceFile = {
      buffer: Buffer.from(await blob.arrayBuffer()),
      extension: extensionFromContentType(blob.type, "png")
    };
  } else {
    throw httpError("Invalid source image data", 400);
  }
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
      title: sanitizeGenerationTitle(request.title, request.prompt),
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
  const imageUrl = `/api/images/${generation.id}/file`;
  const sourceImageUrl = sourceImageUrlForGeneration(generation);
  const creativeRoute = buildCreativeRouteForGeneration(generation, {
    resultImageUrl: imageUrl,
    sourceImageUrl
  });
  return {
    ...generation,
    imageUrl,
    sourceImageUrl,
    creativeRoute,
    ...sourceImageAuditFields(generation)
  };
}

async function generationResponseForViewer(generation, current) {
  const response = generationResponse(generation);
  const canvasProject = await store.getCanvasProjectForGeneration(generation.id);
  if (canvasProject) {
    const sourceCanvasProject = await store.getCanvasProjectById(canvasProject.id).catch((error) => {
      console.warn("[creative-route] failed to load source canvas", error?.message || error);
      return null;
    });
    response.creativeRoute = buildCreativeRouteForGeneration(generation, {
      resultImageUrl: response.imageUrl,
      sourceImageUrl: response.sourceImageUrl,
      canvasProject: {
        ...canvasProject,
        dataJson: sourceCanvasProject?.dataJson || {}
      }
    });
  }
  if (!canvasProject || !current?.user) return response;
  const canOpenOriginal = canvasService.canReadCanvas(current.user, canvasProject);
  if (canOpenOriginal) {
    response.canvasProject = {
      ...canvasProject,
      canDuplicate: true,
      canOpenOriginal: true
    };
  } else if (isPubliclyVisibleGeneration(generation)) {
    response.canvasProject = {
      id: canvasProject.id,
      outputNodeId: canvasProject.outputNodeId || "",
      configNodeId: canvasProject.configNodeId || "",
      canDuplicate: true,
      canOpenOriginal: false
    };
  }
  return response;
}

function promptLeaderboardResponse(prompt) {
  return {
    id: `prompt_${prompt.id}`,
    kind: "prompt",
    promptId: prompt.id,
    title: prompt.title || "",
    prompt: prompt.prompt || "",
    imageUrl: `/api/prompt-images/${prompt.id}/file`,
    sourceImageUrl: "",
    sourceImageId: "",
    sourcePrompt: "",
    originGalleryId: "",
    publishOriginal: false,
    conversation: [],
    publicTags: prompt.tags || [],
    userId: "",
    userName: prompt.author || prompt.sourceRepo || prompt.source || "Prompt DB",
    model: prompt.modelHint || "",
    isPublic: prompt.status === "active",
    archived: false,
    createdAt: prompt.createdAt,
    publishedAt: prompt.createdAt,
    likeCount: Number(prompt.likeCount || 0),
    likedByCurrentUser: Boolean(prompt.likedByCurrentUser),
    promptType: prompt.promptType || "text-to-image",
    source: prompt.source || "",
    sourceRepo: prompt.sourceRepo || ""
  };
}

function imageFileAbsolutePath(kind, filename) {
  const base = kind === "source" ? SOURCE_DIR : GENERATED_DIR;
  const safeName = path.basename(String(filename || ""));
  return path.join(base, safeName);
}

async function imageFileExists(kind, filename) {
  if (!filename) return false;
  const absolutePath = imageFileAbsolutePath(kind, filename);
  try {
    const stat = await fs.stat(absolutePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function filterGenerationsWithImageFiles(generations = []) {
  const visible = [];
  for (const generation of generations) {
    if (await imageFileExists("generated", generation?.filename)) {
      visible.push(generation);
    }
  }
  return visible;
}

function imageFileRelativePath(kind, filename) {
  return `${kind === "source" ? "sources" : "generated"}/${path.basename(String(filename || ""))}`;
}

function promptLocalImageAbsolutePath(sourceUrl = "") {
  let pathname = "";
  try {
    pathname = new URL(sourceUrl, "http://local").pathname;
  } catch {
    return "";
  }
  let decodedPathname = "";
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return "";
  }
  if (!decodedPathname.startsWith("/prompt-thumbs/")) return "";
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, decodedPathname));
  if (absolutePath !== PUBLIC_DIR && !absolutePath.startsWith(PUBLIC_DIR + path.sep)) return "";
  return absolutePath;
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
  return generationQueueRunner.snapshot(requestId);
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

function enqueueGenerationJob(job, { persistQueued = true } = {}) {
  if (persistQueued) {
    store.updateGenerationRequest(job.id, {
      status: "pending",
      queueStatus: "queued",
      lockedBy: null,
      lockedAt: null,
      retryAfterAt: null
    }).catch((error) => console.error("[generation-queue] queue status update failed", error));
  }
  return generationQueueRunner.enqueue(job);
}

function cancelQueuedGenerationJob(id) {
  return generationQueueRunner.cancelQueued(id);
}

async function recoveredGenerationJobFromRequest(request) {
  const payload = parseQueuePayload(request.queuePayloadJson);
  if (!payload?.kind) return null;
  const user = await store.getUserById(payload.userId || request.userId);
  if (!user || user.status !== "active") {
    await store.updateGenerationRequest(request.id, {
      status: "failed",
      queueStatus: "failed",
      errorMessage: "generation queue recovery skipped inactive user",
      failureStage: "queue_recovery"
    });
    return null;
  }
  const settings = await store.getSettings();
  const requestStartedAt = Number(payload.requestStartedAt || Date.parse(request.createdAt) || Date.now());
  if (payload.kind === "text-generation") {
    return {
      id: request.id,
      userId: user.id,
      attemptCount: request.attemptCount,
      run: () => runQueuedTextGeneration({
        auditId: request.id,
        user,
        settings,
        request: payload.request,
        openaiRequest: payload.openaiRequest,
        totalCost: Number(payload.totalCost || 0),
        costPerImage: Number(payload.costPerImage || 0),
        requestStartedAt
      })
    };
  }
  if (payload.kind === "image-edit") {
    return {
      id: request.id,
      userId: user.id,
      attemptCount: request.attemptCount,
      run: () => runQueuedImageEdit({
        auditId: request.id,
        user,
        settings,
        request: payload.request,
        payload: payload.payload,
        totalCost: Number(payload.totalCost || 0),
        costPerImage: Number(payload.costPerImage || 0),
        requestStartedAt
      })
    };
  }
  return null;
}

async function recoverGenerationQueueOnStartup() {
  const candidates = await store.listRecoverableGenerationRequests(500);
  let patched = 0;
  for (const request of candidates) {
    const patch = buildStartupRecoveryPatch(request, {
      staleRunningMs: GENERATION_QUEUE_STALE_RUNNING_MS,
      staleQueuedMs: GENERATION_QUEUE_STALE_QUEUED_MS
    });
    if (patch) {
      await store.updateGenerationRequest(request.id, patch);
      patched += 1;
    }
  }

  const resumable = await store.listRecoverableGenerationRequests(500);
  let queued = 0;
  for (const request of resumable) {
    if (!request.queuePayloadJson || generationQueueRunner.has(request.id)) continue;
    const job = await recoveredGenerationJobFromRequest(request);
    if (!job) continue;
    enqueueGenerationJob(job, { persistQueued: false });
    queued += 1;
  }
  if (candidates.length || patched || queued) {
    console.log(`[generation-queue] startup recovery scanned=${candidates.length} patched=${patched} requeued=${queued}`);
  }
}

async function claimFirstPublicRewardForGeneration(generation) {
  if (!generation?.id || !generation.userId || !generation.isPublic) return generation;
  const settings = await store.getSettings();
  const amount = firstPublicRewardCredit(settings);
  const rewarded = await store.claimFirstPublicReward(
    generation.id,
    generation.userId,
    amount
  );
  if (!rewarded) return generation;
  const holdMinutes = publicRewardHoldMinutes(settings);
  await notifyPublicRewardLocked({ generation: rewarded, amount, holdMinutes, settings });
  return { ...generation, ...rewarded, imageUrl: generation.imageUrl };
}

async function finalizeSuccessfulGenerations({ auditId, user, request, openaiResult, requestStartedAt, expectedCount }) {
  const durationMs = Date.now() - requestStartedAt;
  const saved = (await saveGeneratedImages(user, request, openaiResult))
    .map((generation) => ({ ...generation, durationMs }));
  if (!saved.length) {
    throw httpError("OpenAI did not return a savable image", 502);
  }
  await traceGeneration(auditId, "image_validated", {
    userId: user.id,
    message: `${saved.length} image(s) validated`,
    data: { count: saved.length, filenames: saved.map((generation) => generation.filename) }
  });
  await store.insertGenerations(saved);
  await traceGeneration(auditId, "generation_saved", {
    userId: user.id,
    message: `${saved.length} generation row(s) saved`,
    data: { generationIds: saved.map((generation) => generation.id), durationMs }
  });
  if (request.isPublic && saved[0]) {
    saved[0] = await claimFirstPublicRewardForGeneration(saved[0]);
    await traceGeneration(auditId, "gallery_published", {
      userId: user.id,
      generationId: saved[0].id,
      message: "first generated image published to gallery",
      data: { isPublic: true, publicTags: saved[0].publicTags || [] }
    });
  }
  await store.updateGenerationRequest(auditId, {
    status: "succeeded",
    queueStatus: "succeeded",
    lockedBy: null,
    lockedAt: null,
    firstGenerationId: saved[0]?.id || "",
    generationIds: saved.map((generation) => generation.id),
    providerResponse: {
      imageCount: saved.length,
      revisedPrompts: saved.map((generation) => generation.revisedPrompt).filter(Boolean),
      usage: openaiResult?.usage || null
    },
    revisedPrompt: saved.map((generation) => generation.revisedPrompt).filter(Boolean)[0] || "",
    durationMs
  });
  const missing = Math.max(0, Number(expectedCount || saved.length) - saved.length);
  return { saved, durationMs, missing };
}

function isRetryableGenerationError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || error || "").toLowerCase();
  return status === 502 ||
    status === 503 ||
    status === 504 ||
    code === "econnreset" ||
    code === "etimedout" ||
    /timed out|timeout|network error|fetch failed|econnreset|socket hang up/.test(message);
}

async function maybeRequeueTransientGenerationFailure({ auditId, user, error, stage = "provider_generation" }) {
  if (!isRetryableGenerationError(error)) return false;
  const latest = await store.getGenerationRequestById(auditId).catch(() => null);
  if (!latest?.queuePayloadJson) return false;
  const attemptCount = Math.max(0, Number(latest.attemptCount || 0));
  const maxAttempts = Math.max(1, Number(latest.maxAttempts || 1));
  if (attemptCount >= maxAttempts) return false;

  await store.updateGenerationRequest(auditId, {
    status: "pending",
    queueStatus: "queued",
    errorMessage: String(error.message || error).slice(0, 2000),
    errorCode: String(error.code || error.status || "transient_generation_failure").slice(0, 96),
    errorStage: stage,
    failureStage: stage,
    lockedBy: null,
    lockedAt: null,
    retryAfterAt: new Date()
  });
  await traceGeneration(auditId, "retry_queued", {
    userId: user.id,
    level: "warn",
    message: "transient provider failure queued for retry",
    data: {
      stage,
      attemptCount,
      maxAttempts,
      error: errorSummary(error)
    }
  });

  const retryRequest = await store.getGenerationRequestById(auditId);
  const job = await recoveredGenerationJobFromRequest(retryRequest);
  if (!job) return false;
  setTimeout(() => enqueueGenerationJob(job, { persistQueued: false }), 0);
  return true;
}

async function runQueuedTextGeneration({ auditId, user, settings, request, openaiRequest, totalCost, costPerImage, requestStartedAt }) {
  let reservedCredits = false;
  try {
    await store.updateGenerationRequest(auditId, {
      status: "running",
      queueStatus: "running",
      lockedBy: GENERATION_RUNNER_ID,
      lockedAt: new Date()
    });
    await traceGeneration(auditId, "provider_selected", {
      userId: user.id,
      data: { model: openaiRequest.model, mode: "text-to-image" }
    });
    await traceGeneration(auditId, "params_normalized", {
      userId: user.id,
      data: { request, providerParams: openaiRequest }
    });
    if (totalCost > 0) {
      reservedCredits = await store.reserveCredits(user.id, totalCost, {
        source: "generation_charge",
        referenceId: auditId,
        note: `${request.n} image(s)`
      });
      if (!reservedCredits) {
        await traceGeneration(auditId, "failed", {
          userId: user.id,
          level: "warn",
          message: "not enough credits",
          data: { stage: "credit_reserved", totalCost }
        });
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          failureStage: "credit_reserved",
          errorCode: "not_enough_credits",
          errorStage: "credit_reserved",
          durationMs: Date.now() - requestStartedAt
        });
        return;
      }
      await traceGeneration(auditId, "credit_reserved", {
        userId: user.id,
        data: { totalCost, costPerImage }
      });
    }
    await traceGeneration(auditId, "provider_submitted", {
      userId: user.id,
      data: { endpoint: "images/generations", providerParams: openaiRequest }
    });
    const openaiResult = await callOpenAIImages(settings, openaiRequest, { trace: { requestId: auditId, userId: user.id } });
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
      await traceGeneration(auditId, "credit_refunded", {
        userId: user.id,
        data: { amount: costPerImage * missing, reason: "unused candidate refund" }
      });
    }
    await traceGeneration(auditId, "credit_charged", {
      userId: user.id,
      data: { totalCost, saved: saved.length }
    });
    return saved;
  } catch (error) {
    if (reservedCredits) await store.addCredits(user.id, totalCost, {
      source: "generation_error_refund",
      referenceId: auditId,
      note: "generation failed"
    }).catch((refundError) => console.error(refundError));
    if (reservedCredits) {
      await traceGeneration(auditId, "credit_refunded", {
        userId: user.id,
        data: { amount: totalCost, reason: "generation failed" }
      });
    }
    const retryQueued = await maybeRequeueTransientGenerationFailure({
      auditId,
      user,
      error,
      stage: "provider_generation"
    });
    if (retryQueued) return;
    await traceGeneration(auditId, "failed", {
      userId: user.id,
      level: "error",
      message: String(error.message || error).slice(0, 512),
      data: errorSummary(error)
    });
    await store.updateGenerationRequest(auditId, {
      status: "failed",
      errorMessage: String(error.message || error).slice(0, 2000),
      failureStage: "provider_generation",
      errorCode: String(error.code || error.status || "generation_failed").slice(0, 96),
      errorStage: "provider_generation",
      durationMs: Date.now() - requestStartedAt
    }).catch((auditError) => console.error(auditError));
  }
}

async function runQueuedImageEdit({ auditId, user, settings, request, payload, totalCost, costPerImage, requestStartedAt }) {
  let reservedCredits = false;
  try {
    await store.updateGenerationRequest(auditId, {
      status: "running",
      queueStatus: "running",
      lockedBy: GENERATION_RUNNER_ID,
      lockedAt: new Date()
    });
    await traceGeneration(auditId, "provider_selected", {
      userId: user.id,
      data: { model: payload.model, mode: "image-to-image" }
    });
    await traceGeneration(auditId, "params_normalized", {
      userId: user.id,
      data: { request, providerParams: { ...payload, imageData: "[image-data]", referenceImages: "[reference-images]", maskData: payload.maskData ? "[edit-mask]" : "" } }
    });
    if (totalCost > 0) {
      reservedCredits = await store.reserveCredits(user.id, totalCost, {
        source: "generation_charge",
        referenceId: auditId,
        note: request.n > 1 ? `image edit ${request.n} image(s)` : "image edit"
      });
      if (!reservedCredits) {
        await traceGeneration(auditId, "failed", {
          userId: user.id,
          level: "warn",
          message: "not enough credits",
          data: { stage: "credit_reserved", totalCost }
        });
        await store.updateGenerationRequest(auditId, {
          status: "failed",
          errorMessage: "Not enough credits",
          failureStage: "credit_reserved",
          errorCode: "not_enough_credits",
          errorStage: "credit_reserved",
          durationMs: Date.now() - requestStartedAt
        });
        return;
      }
      await traceGeneration(auditId, "credit_reserved", {
        userId: user.id,
        data: { totalCost, costPerImage }
      });
    }
    await traceGeneration(auditId, "provider_submitted", {
      userId: user.id,
      data: { endpoint: "images/edits", providerParams: { ...payload, imageData: "[image-data]", referenceImages: "[reference-images]", maskData: payload.maskData ? "[edit-mask]" : "" } }
    });
    const openaiResult = await callOpenAIImageEdits(settings, payload, { trace: { requestId: auditId, userId: user.id } });
    const { missing } = await finalizeSuccessfulGenerations({
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
        note: "unused image edit candidate refund"
      }).catch((error) => console.error(error));
      await traceGeneration(auditId, "credit_refunded", {
        userId: user.id,
        data: { amount: costPerImage * missing, reason: "unused image edit candidate refund" }
      });
    }
    await traceGeneration(auditId, "credit_charged", {
      userId: user.id,
      data: { totalCost }
    });
  } catch (error) {
    if (reservedCredits) await store.addCredits(user.id, totalCost, {
      source: "generation_error_refund",
      referenceId: auditId,
      note: "image edit failed"
    }).catch((refundError) => console.error(refundError));
    if (reservedCredits) {
      await traceGeneration(auditId, "credit_refunded", {
        userId: user.id,
        data: { amount: totalCost, reason: "image edit failed" }
      });
    }
    const retryQueued = await maybeRequeueTransientGenerationFailure({
      auditId,
      user,
      error,
      stage: "provider_edit"
    });
    if (retryQueued) return;
    await traceGeneration(auditId, "failed", {
      userId: user.id,
      level: "error",
      message: String(error.message || error).slice(0, 512),
      data: errorSummary(error)
    });
    await store.updateGenerationRequest(auditId, {
      status: "failed",
      errorMessage: String(error.message || error).slice(0, 2000),
      failureStage: "provider_edit",
      errorCode: String(error.code || error.status || "image_edit_failed").slice(0, 96),
      errorStage: "provider_edit",
      durationMs: Date.now() - requestStartedAt
    }).catch((auditError) => console.error(auditError));
  }
}

async function routeApi(req, res, url) {
  const rewardSettings = await store.getSettings().catch(() => ({}));
  const rewardResult = await store.awardMaturePublicRewards({
    minAgeMinutes: publicRewardHoldMinutes(rewardSettings)
  }).catch((error) => {
    console.error("[public-reward]", error);
    return null;
  });
  for (const item of rewardResult?.awardedItems || []) {
    const generation = await store.getGenerationById(item.id).catch(() => null);
    await notifyPublicRewardAwarded({ generation, amount: item.amount, settings: rewardSettings });
  }

  if (await handleHealthRoute(req, res, url)) return;

  verifyCsrf(req);

  if (await handleAgentSessionRoute(req, res, url)) return;

  if (await handleAuthRoute(req, res, url)) return;

  if (await handleImagesRoute(req, res, url)) return;

  if (await handleGalleryRoute(req, res, url)) return;

  if (await handlePromptsRoute(req, res, url)) return;

  if (await handleCanvasesRoute(req, res, url)) return;

  if (await handleAdminRoute(req, res, url)) return;
  if (await handleCreditsRoute(req, res, url)) return;
  if (await handleSettingsPublicRoute(req, res, url)) return;
  if (await handleAnnouncementsRoute(req, res, url)) return;
  if (await handleImagesGenerateRoute(req, res, url)) return;

  const promptImageMatch = url.pathname.match(/^\/api\/prompt-images\/(\d+)\/file$/);
  if (promptImageMatch && (req.method === "GET" || req.method === "HEAD")) {
    const current = await getCurrentUser(req);
    const prompt = await store.getPromptById(promptImageMatch[1]);
    if (!prompt || (prompt.status !== "active" && current?.user?.role !== "admin")) {
      throw httpError("Prompt image not found", 404);
    }
    const sourceUrl = prompt.coverUrl || prompt.preview || prompt.image || "";
    if (sourceUrl.startsWith("/")) {
      const absolutePath = promptLocalImageAbsolutePath(sourceUrl);
      if (!absolutePath) {
        throw httpError("Prompt local image is not allowed", 404);
      }
      const stat = await fs.stat(absolutePath).catch(() => null);
      if (!stat?.isFile()) {
        throw httpError("Prompt local image not found", 404);
      }
      const extension = path.extname(absolutePath).toLowerCase();
      const contentType = mimeTypes.get(extension) || "application/octet-stream";
      if (!contentType.toLowerCase().startsWith("image/")) {
        throw httpError("Prompt local image is not an image", 404);
      }
      res.writeHead(200, withSecurityHeaders({
        "Content-Type": contentType,
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=3600",
        "X-Image-Variant": url.searchParams.get("variant") === "thumb" ? "thumb" : "original",
        "X-AI-Content-Source": "prompt-database-image",
        "Vary": "Accept"
      }));
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(await fs.readFile(absolutePath));
      return;
    }
    const proxyUrl = normalizeRemoteImageUrl(sourceUrl);
    if (!isSafeRemoteImageUrl(proxyUrl)) {
      throw httpError("Prompt image is not proxyable", 404);
    }
    const upstream = await fetchWithTimeout("Prompt image proxy", proxyUrl, {
      method: "GET",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" }
    }, 20_000);
    if (!upstream.ok) {
      throw httpError(`Prompt image upstream returned ${upstream.status}`, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
    }
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw httpError("Prompt image upstream is not an image", 502);
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": contentType,
      "Content-Length": bytes.length,
      "Cache-Control": "public, max-age=3600",
      "X-Image-Variant": url.searchParams.get("variant") === "thumb" ? "thumb" : "original",
      "X-AI-Content-Source": "prompt-database-image",
      "Vary": "Accept"
    }));
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(bytes);
    return;
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



  const publicMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/public$/);
  if (publicMatch && req.method === "PATCH") {
    const current = await getCurrentUser(req);
    ensureActiveAuthenticated(current);
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
    if (Object.hasOwn(body, "title")) {
      patch.title = sanitizeGenerationTitle(body.title, generation.prompt);
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
    const publishSettings = await store.getSettings();
    if ((patch.isPublic === false || patch.archived === true) && generation.isPublic && current.user.role !== "admin" && !publishSettings.publicUnpublishAllowed) {
      throw httpError("Published works cannot be unpublished by users", 409, { publicUnpublishDisabled: true });
    }
    if ((patch.isPublic === false || patch.archived === true) && generation.isPublic && !canWithdrawDirectly(generation) && current.user.role !== "admin") {
      throw httpError("Withdrawal request required after 12 hours", 409, {
        withdrawalRequired: true,
        withdrawalStatus: generation.withdrawalStatus
      });
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
    let updated = await store.updateGenerationPublic(generation.id, patch);
    if (patch.isPublic === true && !generation.isPublic) {
      updated = await claimFirstPublicRewardForGeneration(updated);
    }
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
    await notifyReportSubmitted({
      generation: updated,
      reporterUserId: current.user.id,
      report
    });
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
    const publishSettings = await store.getSettings();
    if (current.user.role !== "admin" && !publishSettings.publicUnpublishAllowed) {
      throw httpError("Published works cannot be withdrawn by users", 409, { publicUnpublishDisabled: true });
    }
    if (canWithdrawDirectly(generation)) {
      const updated = await store.updateGenerationPublic(generation.id, {
        isPublic: false,
        publishOriginal: false,
        withdrawalStatus: "approved",
        withdrawalRequestedAt: new Date(),
        withdrawalReason: body.reason || "direct withdrawal"
      });
      await notifyWithdrawalRequest({ generation: updated, direct: true });
      return sendJson(res, 200, { generation: updated, direct: true });
    }
    if (generation.withdrawalStatus === "requested") {
      return sendJson(res, 200, { generation, direct: false, pending: true });
    }
    const updated = await store.updateGenerationPublic(generation.id, {
      withdrawalStatus: "requested",
      withdrawalRequestedAt: new Date(),
      withdrawalReason: body.reason || ""
    });
    await notifyWithdrawalRequest({ generation: updated, direct: false });
    return sendJson(res, 202, { generation: updated, direct: false });
  }

  sendError(res, 404, "API route not found");
}

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const isCanvasV2Path = pathname === "/canvas-v2" || pathname.startsWith("/canvas-v2/");
  const isCanvasV2AssetPath = pathname.startsWith("/canvas-v2/assets/");
  const isAgentPath = pathname === "/agent" || pathname.startsWith("/agent/");
  const isAgentAssetPath = pathname.startsWith("/agent/assets/");
  const requestedPath = pathname === "/"
    ? "/index.html"
    : pathname === "/admin"
      ? "/admin.html"
      : isAgentPath && !isAgentAssetPath
        ? "/agent/index.html"
        : isCanvasV2Path && !isCanvasV2AssetPath
          ? "/canvas-v2/index.html"
        : pathname;
  const absolutePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (absolutePath !== PUBLIC_DIR && !absolutePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendError(res, 403, "Forbidden");
  }

  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) throw new Error("not a file");
    const extension = path.extname(absolutePath).toLowerCase();
    const bytes = await fs.readFile(absolutePath);
    const immutableAsset = (pathname.startsWith("/dist/")
      && /\.[a-f0-9]{12}\.(?:css|js)$/i.test(path.basename(pathname)))
      || (pathname.startsWith("/vendor/") && /\.(?:css|woff2)$/i.test(path.basename(pathname)));
    res.writeHead(200, withSecurityHeaders({
      "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
      "Cache-Control": extension === ".html"
        ? "no-store"
        : immutableAsset
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600"
    }));
    res.end(bytes);
  } catch {
    if (isAgentPath) {
      if (isAgentAssetPath) {
        return sendError(res, 404, "Static asset not found");
      }
      const html = await fs.readFile(path.join(PUBLIC_DIR, "agent", "index.html"), "utf8");
      res.writeHead(200, withSecurityHeaders({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }));
      res.end(html);
      return;
    }
    if (isCanvasV2Path) {
      if (isCanvasV2AssetPath) {
        return sendError(res, 404, "Static asset not found");
      }
      const html = await fs.readFile(path.join(PUBLIC_DIR, "canvas-v2", "index.html"), "utf8");
      res.writeHead(200, withSecurityHeaders({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }));
      res.end(html);
      return;
    }
    if (
      pathname.startsWith("/prompt-thumbs/") ||
      /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(pathname)
    ) {
      return sendError(res, 404, "Static asset not found");
    }
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
      res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n  <url><loc>${origin}/agent</loc></url>\n  <url><loc>${origin}/admin</loc></url>\n</urlset>\n`);
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
  await recoverGenerationQueueOnStartup().catch((error) => {
    console.warn(`[generation-queue] startup recovery failed: ${error?.message || error}`);
  });
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
