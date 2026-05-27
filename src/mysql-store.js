let mysql;
try {
  mysql = require("mysql2/promise");
} catch {
  throw new Error("Missing dependency mysql2. Run: npm.cmd install");
}
const { normalizeTraceLevel, safeJsonSummary } = require("./generation-trace-service");
const agentCore = require("@ai-image-studio/agent-core");
const createAgentSessionStore = agentCore.createSessionStore;
const createAdminStore = require("./stores/admin-store");
const canvasCore = require("@ai-image-studio/canvas-core");
const { createCanvasStore } = canvasCore;
const createGalleryStore = require("./stores/gallery-store");
const createGenerationStore = require("./stores/generation-store");
const createPromptStore = require("./stores/prompt-store");
const createTagStore = require("./stores/tag-store");
const createUserStore = require("./stores/user-store");

function buildStoreFacade(exportGroups) {
  const store = {};
  const owners = new Map();
  for (const { label, source } of exportGroups) {
    for (const [name, value] of Object.entries(source)) {
      if (Object.hasOwn(store, name)) {
        throw new Error(`Store export collision: ${name} already provided by ${owners.get(name)} before ${label}`);
      }
      owners.set(name, label);
      store[name] = value;
    }
  }
  return store;
}

function createMySQLStore(_dbConfig = {}) {
let pool;
let defaultModel = "GPT-IMAGE-2";
const DEFAULT_CONTACT_ADMIN_EMAIL = "support@example.com";

function intEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(process.env[name]).toLowerCase());
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll("`", "``")}\``;
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: intEnv("MYSQL_PORT", 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio",
    connectionLimit: intEnv("MYSQL_CONNECTION_LIMIT", 10)
  };
}

function getPool() {
  if (!pool) {
    throw new Error("Database has not been initialized");
  }
  return pool;
}

async function addColumnIfMissing(db, table, column, definition) {
  const [columns] = await db.query(`SHOW COLUMNS FROM ${quoteIdentifier(table)} LIKE ${mysql.escape(column)}`);
  if (!columns.length) {
    await db.query(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(column)} ${definition}`);
  }
}

async function addIndexIfMissing(db, table, index, definition) {
  const [indexes] = await db.query(`SHOW INDEX FROM ${quoteIdentifier(table)} WHERE Key_name = ${mysql.escape(index)}`);
  if (!indexes.length) {
    await db.query(`ALTER TABLE ${quoteIdentifier(table)} ADD INDEX ${quoteIdentifier(index)} ${definition}`);
  }
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapSettings(row = {}) {
  const parseJson = (value, fallback) => {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    openaiApiKey: row.openai_api_key || "",
    apiBaseUrl: row.api_base_url || process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "",
    model: row.model || defaultModel,
    defaultCredits: Number(row.default_credits ?? 10),
    generationCreditCost: Number(row.generation_credit_cost ?? 1),
    allowRegistration: Boolean(row.allow_registration ?? 1),
    requireApproval: Boolean(row.require_approval ?? 0),
    maxImagesPerRequest: Number(row.max_images_per_request ?? 1),
    maxReferenceImages: Number(row.max_reference_images ?? 4),
    firstPublicRewardCredit: Number(row.first_public_reward_credit ?? intEnv("FIRST_PUBLIC_REWARD_CREDIT", 2)),
    publicRewardHoldMinutes: Number(row.public_reward_hold_minutes ?? intEnv("PUBLIC_REWARD_HOLD_MINUTES", intEnv("PUBLIC_WITHDRAWAL_WINDOW_HOURS", 12) * 60)),
    publicUnpublishAllowed: Boolean(row.public_unpublish_allowed ?? 0),
    publicRewardNotificationsEnabled: Boolean(row.public_reward_notifications_enabled ?? 1),
    contactAdminEmail: Object.hasOwn(row, "contact_admin_email")
      ? String(row.contact_admin_email || "")
      : DEFAULT_CONTACT_ADMIN_EMAIL,
    growthConfig: parseJson(row.growth_config_json, {}),
    providerCapabilityConfig: parseJson(row.provider_capability_json, {}),
    defaultProviderId: row.default_provider_id || ""
  };
}

function maskSecret(value = "") {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 8) return "••••";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function parseProviderJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function mapProviderConfig(row = {}, { includeSecret = false } = {}) {
  if (!row) return null;
  const apiKey = row.api_key_encrypted || "";
  return {
    id: row.id,
    name: row.name || "",
    providerType: row.provider_type || "openai-compatible",
    baseUrl: row.base_url || "",
    apiKey: includeSecret ? apiKey : "",
    apiKeyMask: row.api_key_mask || maskSecret(apiKey),
    defaultModel: row.default_model || defaultModel,
    endpointImages: row.endpoint_images || "",
    endpointResponses: row.endpoint_responses || "",
    endpointEdits: row.endpoint_edits || "",
    capabilities: parseProviderJson(row.capabilities_json, {}),
    routing: parseProviderJson(row.routing_json, {}),
    mapping: parseProviderJson(row.provider_mapping_json, {}),
    status: row.status || "active",
    healthStatus: row.health_status || "unknown",
    lastCheckedAt: toIso(row.last_checked_at),
    lastError: row.last_error || "",
    sortOrder: Number(row.sort_order || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: {
      salt: row.password_salt,
      iterations: Number(row.password_iterations),
      hash: row.password_hash
    },
    role: row.role,
    status: row.status,
    credits: Number(row.credits || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    firstPublicRewardStatus: row.first_public_reward_status || "none",
    firstPublicRewardAmount: Number(row.first_public_reward_amount || 0),
    firstPublicRewardGenerationId: row.first_public_reward_reference_id || "",
    firstPublicRewardAwardedAt: toIso(row.first_public_reward_awarded_at),
    firstPublicRewardCreatedAt: toIso(row.first_public_reward_created_at)
  };
}

function mapCreditLedger(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: row.user_id,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    delta: Number(row.delta || 0),
    balanceAfter: Number(row.balance_after || 0),
    source: row.source || "",
    referenceId: row.reference_id || "",
    note: row.note || "",
    actorUserId: row.actor_user_id || "",
    actorName: row.actor_name || "",
    actorEmail: row.actor_email || "",
    createdAt: toIso(row.created_at)
  };
}

function mapRewardLedger(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: row.user_id,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    rewardType: row.reward_type || "",
    status: row.status || "",
    amount: Number(row.amount || 0),
    referenceId: row.reference_id || "",
    note: row.note || "",
    awardedAt: toIso(row.awarded_at),
    createdAt: toIso(row.created_at)
  };
}

function mapAdminAuditLog(row) {
  if (!row) return null;
  let detail = null;
  if (row.detail_json) {
    try {
      detail = JSON.parse(row.detail_json);
    } catch {
      detail = null;
    }
  }
  return {
    id: Number(row.id),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    actorUserId: row.actor_user_id || "",
    actorName: row.actor_name || "",
    actorEmail: row.actor_email || "",
    detail,
    ipAddress: row.ip_address || "",
    userAgent: row.user_agent || "",
    createdAt: toIso(row.created_at)
  };
}

function mapGenerationReport(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    generationId: row.generation_id,
    reporterUserId: row.reporter_user_id || "",
    reporterName: row.reporter_name || "",
    reporterEmail: row.reporter_email || "",
    reason: row.reason || "",
    description: row.description || "",
    status: row.status || "pending",
    handledBy: row.handled_by || "",
    handlerName: row.handler_name || "",
    handlerEmail: row.handler_email || "",
    handledAt: toIso(row.handled_at),
    createdAt: toIso(row.created_at)
  };
}

function mapGeneration(row) {
  if (!row) return null;
  let usage = null;
  let conversation = [];
  if (row.usage_json) {
    try {
      usage = JSON.parse(row.usage_json);
    } catch {
      usage = null;
    }
  }
  if (row.conversation_json) {
    try {
      conversation = JSON.parse(row.conversation_json);
    } catch {
      conversation = [];
    }
  }
  let publicTags = [];
  if (row.public_tags_json) {
    try {
      publicTags = JSON.parse(row.public_tags_json);
    } catch {
      publicTags = [];
    }
  }
  const generation = {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    title: row.title || "",
    prompt: row.prompt,
    model: row.model,
    size: row.size,
    quality: row.quality,
    background: row.background,
    outputFormat: row.output_format,
    filename: row.filename,
    isPublic: Boolean(row.is_public ?? 0),
    sourceFilename: row.source_filename || "",
    sourceImageId: row.source_image_id || "",
    sourcePrompt: row.source_prompt || "",
    originGalleryId: row.origin_gallery_id || "",
    publishOriginal: Boolean(row.publish_original ?? 0),
    archived: Boolean(row.archived ?? 0),
    moderationStatus: row.moderation_status || "visible",
    moderationReason: row.moderation_reason || "",
    moderationCheckedAt: toIso(row.moderation_checked_at),
    reportCount: Number(row.report_count || 0),
    likeCount: Number(row.leaderboard_like_count ?? row.like_count ?? 0),
    likedByCurrentUser: Boolean(row.liked_by_current_user || 0),
    publishedAt: toIso(row.published_at),
    publicRewardStatus: row.public_reward_status || "none",
    publicRewardAmount: Number(row.public_reward_amount || 0),
    withdrawalStatus: row.withdrawal_status || "none",
    withdrawalRequestedAt: toIso(row.withdrawal_requested_at),
    withdrawalReason: row.withdrawal_reason || "",
    pendingReportCount: Number(row.pending_report_count || 0),
    latestReportReason: row.latest_report_reason || "",
    conversation,
    publicTags: Array.isArray(publicTags) ? publicTags : [],
    revisedPrompt: row.revised_prompt || "",
    usage,
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    createdAt: toIso(row.created_at)
  };
  if (row.canvas_project_id) {
    generation.canvasProject = {
      id: row.canvas_project_id,
      userId: row.canvas_project_user_id || "",
      title: row.canvas_project_title || "Untitled canvas",
      visibility: row.canvas_project_visibility || "private",
      outputNodeId: row.canvas_output_node_id || "",
      configNodeId: row.canvas_config_node_id || ""
    };
  }
  return generation;
}

function mapGalleryFileCheck(row) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    generationId: row.generation_id || "",
    imageKind: row.image_kind || "generated",
    filename: row.filename || "",
    relativePath: row.relative_path || "",
    status: row.status || "unknown",
    fileSize: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    errorMessage: row.error_message || "",
    checkedAt: toIso(row.checked_at),
    prompt: row.prompt || "",
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    publishedAt: toIso(row.published_at),
    moderationStatus: row.moderation_status || ""
  };
}

function mapPromptCategory(row) {
  if (!row) return null;
  return {
    slug: row.slug || "",
    labelZh: row.label_zh || "",
    labelEn: row.label_en || "",
    descriptionZh: row.description_zh || "",
    descriptionEn: row.description_en || "",
    status: row.status || "active",
    sortOrder: Number(row.sort_order || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function mapAnnouncement(row = {}) {
  if (!row) return null;
  const readAt = toIso(row.user_read_at);
  const ackedAt = toIso(row.user_acked_at);
  const requiresAck = Boolean(row.requires_ack ?? 0);
  const metadata = parseJsonObject(row.metadata_json, {});
  return {
    id: row.id,
    title: row.title || "",
    body: row.body || "",
    level: row.level || "info",
    severity: row.level || "info",
    displayMode: row.display_mode || "feed",
    displayType: row.display_mode || "feed",
    audience: row.audience || "all",
    targetAudience: row.audience || "all",
    targetUserIds: Array.isArray(metadata.targetUserIds) ? metadata.targetUserIds.map(String) : [],
    status: row.status || "draft",
    isImportant: Boolean(row.is_important ?? 0),
    requiresAck,
    startsAt: toIso(row.starts_at),
    publishAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    expiresAt: toIso(row.ends_at),
    publishedAt: toIso(row.published_at),
    createdBy: row.created_by || "",
    createdByName: row.created_by_name || "",
    createdByEmail: row.created_by_email || "",
    readCount: Number(row.read_count || 0),
    ackCount: Number(row.ack_count || 0),
    userReadAt: readAt,
    userAckedAt: ackedAt,
    readAt,
    ackAt: ackedAt,
    isRead: Boolean(readAt),
    isAcked: Boolean(ackedAt),
    unread: requiresAck ? !ackedAt : !readAt,
    metadata,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function createDatabaseIfNeeded(config) {
  if (process.env.MYSQL_CREATE_DATABASE === "false") return;
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: false
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function runMigrations() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      openai_api_key TEXT NULL,
      api_base_url VARCHAR(255) NOT NULL DEFAULT '',
      model VARCHAR(80) NOT NULL,
      default_credits INT UNSIGNED NOT NULL DEFAULT 10,
      generation_credit_cost INT UNSIGNED NOT NULL DEFAULT 1,
      allow_registration TINYINT(1) NOT NULL DEFAULT 1,
      require_approval TINYINT(1) NOT NULL DEFAULT 0,
      max_images_per_request TINYINT UNSIGNED NOT NULL DEFAULT 1,
      max_reference_images TINYINT UNSIGNED NOT NULL DEFAULT 4,
      first_public_reward_credit INT UNSIGNED NOT NULL DEFAULT 2,
      public_reward_hold_minutes INT UNSIGNED NOT NULL DEFAULT 720,
      public_unpublish_allowed TINYINT(1) NOT NULL DEFAULT 0,
      public_reward_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
      contact_admin_email VARCHAR(255) NOT NULL DEFAULT 'support@example.com',
      growth_config_json LONGTEXT NULL,
      provider_capability_json LONGTEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [settingsApiBaseColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'api_base_url'");
  if (!settingsApiBaseColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN api_base_url VARCHAR(255) NOT NULL DEFAULT '' AFTER openai_api_key");
  }

  const [settingsCostColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'generation_credit_cost'");
  if (!settingsCostColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN generation_credit_cost INT UNSIGNED NOT NULL DEFAULT 1 AFTER default_credits");
  }
  const [settingsReferenceColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'max_reference_images'");
  if (!settingsReferenceColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN max_reference_images TINYINT UNSIGNED NOT NULL DEFAULT 4 AFTER max_images_per_request");
  }
  const [firstPublicRewardColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'first_public_reward_credit'");
  if (!firstPublicRewardColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN first_public_reward_credit INT UNSIGNED NOT NULL DEFAULT 2 AFTER max_reference_images");
  }
  const [publicRewardHoldColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'public_reward_hold_minutes'");
  if (!publicRewardHoldColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN public_reward_hold_minutes INT UNSIGNED NOT NULL DEFAULT 720 AFTER first_public_reward_credit");
  }
  const [publicUnpublishColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'public_unpublish_allowed'");
  if (!publicUnpublishColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN public_unpublish_allowed TINYINT(1) NOT NULL DEFAULT 0 AFTER public_reward_hold_minutes");
  }
  const [publicRewardNotifyColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'public_reward_notifications_enabled'");
  if (!publicRewardNotifyColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN public_reward_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER public_unpublish_allowed");
  }
  const [contactAdminEmailColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'contact_admin_email'");
  if (!contactAdminEmailColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN contact_admin_email VARCHAR(255) NOT NULL DEFAULT 'support@example.com' AFTER max_reference_images");
  }
  const [growthConfigColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'growth_config_json'");
  if (!growthConfigColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN growth_config_json LONGTEXT NULL AFTER contact_admin_email");
  }
  const [providerCapabilityColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'provider_capability_json'");
  if (!providerCapabilityColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN provider_capability_json LONGTEXT NULL AFTER growth_config_json");
  }
  const [defaultProviderColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'default_provider_id'");
  if (!defaultProviderColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN default_provider_id VARCHAR(40) NOT NULL DEFAULT '' AFTER provider_capability_json");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS provider_configs (
      id VARCHAR(40) NOT NULL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      provider_type VARCHAR(40) NOT NULL,
      base_url TEXT NOT NULL,
      api_key_encrypted LONGTEXT NULL,
      api_key_mask VARCHAR(40) NOT NULL DEFAULT '',
      default_model VARCHAR(120) NOT NULL DEFAULT 'gpt-image-2',
      endpoint_images TEXT NULL,
      endpoint_responses TEXT NULL,
      endpoint_edits TEXT NULL,
      capabilities_json LONGTEXT NULL,
      routing_json LONGTEXT NULL,
      provider_mapping_json LONGTEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      health_status VARCHAR(24) NOT NULL DEFAULT 'unknown',
      last_checked_at DATETIME(3) NULL,
      last_error TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_provider_status (status),
      INDEX idx_provider_sort (sort_order, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [providerEndpointImagesColumns] = await db.execute("SHOW COLUMNS FROM provider_configs LIKE 'endpoint_images'");
  if (!providerEndpointImagesColumns.length) {
    await db.query("ALTER TABLE provider_configs ADD COLUMN endpoint_images TEXT NULL AFTER default_model");
  }
  const [providerEndpointResponsesColumns] = await db.execute("SHOW COLUMNS FROM provider_configs LIKE 'endpoint_responses'");
  if (!providerEndpointResponsesColumns.length) {
    await db.query("ALTER TABLE provider_configs ADD COLUMN endpoint_responses TEXT NULL AFTER endpoint_images");
  }
  const [providerEndpointEditsColumns] = await db.execute("SHOW COLUMNS FROM provider_configs LIKE 'endpoint_edits'");
  if (!providerEndpointEditsColumns.length) {
    await db.query("ALTER TABLE provider_configs ADD COLUMN endpoint_edits TEXT NULL AFTER endpoint_responses");
  }
  const [providerMappingColumns] = await db.execute("SHOW COLUMNS FROM provider_configs LIKE 'provider_mapping_json'");
  if (!providerMappingColumns.length) {
    await db.query("ALTER TABLE provider_configs ADD COLUMN provider_mapping_json LONGTEXT NULL AFTER routing_json");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_salt VARCHAR(64) NOT NULL,
      password_iterations INT UNSIGNED NOT NULL,
      password_hash VARCHAR(128) NOT NULL,
      role VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL,
      credits INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_users_status (status),
      INDEX idx_users_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      INDEX idx_sessions_user_id (user_id),
      INDEX idx_sessions_expires_at (expires_at),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS generations (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      title VARCHAR(160) NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      model VARCHAR(80) NOT NULL,
      size VARCHAR(20) NOT NULL,
      quality VARCHAR(20) NOT NULL,
      background VARCHAR(20) NOT NULL,
      output_format VARCHAR(20) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      is_public TINYINT(1) NOT NULL DEFAULT 0,
      source_filename VARCHAR(255) NULL,
      source_image_id VARCHAR(32) NULL,
      source_prompt TEXT NULL,
      origin_gallery_id VARCHAR(32) NULL,
      publish_original TINYINT(1) NOT NULL DEFAULT 0,
      archived TINYINT(1) NOT NULL DEFAULT 0,
      moderation_status VARCHAR(24) NOT NULL DEFAULT 'visible',
      moderation_reason VARCHAR(255) NOT NULL DEFAULT '',
      report_count INT UNSIGNED NOT NULL DEFAULT 0,
      published_at DATETIME(3) NULL,
      public_reward_status VARCHAR(24) NOT NULL DEFAULT 'none',
      public_reward_amount INT UNSIGNED NOT NULL DEFAULT 0,
      withdrawal_status VARCHAR(24) NOT NULL DEFAULT 'none',
      withdrawal_requested_at DATETIME(3) NULL,
      withdrawal_reason VARCHAR(255) NOT NULL DEFAULT '',
      moderation_checked_at DATETIME(3) NULL,
      conversation_json LONGTEXT NULL,
      public_tags_json LONGTEXT NULL,
      revised_prompt TEXT NULL,
      usage_json LONGTEXT NULL,
      duration_ms INT UNSIGNED NULL,
      like_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      INDEX idx_generations_user_created (user_id, created_at),
      INDEX idx_generations_created_at (created_at),
      CONSTRAINT fk_generations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [generationColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'is_public'");
  if (!generationColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0 AFTER filename");
  }
  const [generationTitleColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'title'");
  if (!generationTitleColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN title VARCHAR(160) NOT NULL DEFAULT '' AFTER user_id");
  }
  const [sourceColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'source_filename'");
  if (!sourceColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN source_filename VARCHAR(255) NULL AFTER is_public");
  }
  const [publishOriginalColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'publish_original'");
  if (!publishOriginalColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN publish_original TINYINT(1) NOT NULL DEFAULT 0 AFTER source_filename");
  }
  const [sourceImageIdColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'source_image_id'");
  if (!sourceImageIdColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN source_image_id VARCHAR(32) NULL AFTER source_filename");
  }
  const [sourcePromptColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'source_prompt'");
  if (!sourcePromptColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN source_prompt TEXT NULL AFTER source_image_id");
  }
  const [originGalleryIdColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'origin_gallery_id'");
  if (!originGalleryIdColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN origin_gallery_id VARCHAR(32) NULL AFTER source_prompt");
  }
  const [sourceImageIndexRows] = await db.execute("SHOW INDEX FROM generations WHERE Key_name = 'idx_generations_source_image'");
  if (!sourceImageIndexRows.length) {
    await db.query("ALTER TABLE generations ADD INDEX idx_generations_source_image (source_image_id)");
  }
  const [conversationColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'conversation_json'");
  if (!conversationColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN conversation_json LONGTEXT NULL AFTER publish_original");
  }
  const [archivedColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'archived'");
  if (!archivedColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0 AFTER publish_original");
  }
  const [publishedAtColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'published_at'");
  if (!publishedAtColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN published_at DATETIME(3) NULL AFTER archived");
  }
  const [moderationStatusColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'moderation_status'");
  if (!moderationStatusColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN moderation_status VARCHAR(24) NOT NULL DEFAULT 'visible' AFTER archived");
  }
  const [moderationReasonColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'moderation_reason'");
  if (!moderationReasonColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN moderation_reason VARCHAR(255) NOT NULL DEFAULT '' AFTER moderation_status");
  }
  const [reportCountColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'report_count'");
  if (!reportCountColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN report_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER moderation_reason");
  }
  const [moderationCheckedColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'moderation_checked_at'");
  if (!moderationCheckedColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN moderation_checked_at DATETIME(3) NULL AFTER report_count");
  }
  const [rewardStatusColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'public_reward_status'");
  if (!rewardStatusColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN public_reward_status VARCHAR(24) NOT NULL DEFAULT 'none' AFTER published_at");
  }
  const [rewardAmountColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'public_reward_amount'");
  if (!rewardAmountColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN public_reward_amount INT UNSIGNED NOT NULL DEFAULT 0 AFTER public_reward_status");
  }
  const [withdrawalStatusColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'withdrawal_status'");
  if (!withdrawalStatusColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN withdrawal_status VARCHAR(24) NOT NULL DEFAULT 'none' AFTER public_reward_amount");
  }
  const [withdrawalRequestedColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'withdrawal_requested_at'");
  if (!withdrawalRequestedColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN withdrawal_requested_at DATETIME(3) NULL AFTER withdrawal_status");
  }
  const [withdrawalReasonColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'withdrawal_reason'");
  if (!withdrawalReasonColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN withdrawal_reason VARCHAR(255) NOT NULL DEFAULT '' AFTER withdrawal_requested_at");
  }
  const [publicTagColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'public_tags_json'");
  if (!publicTagColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN public_tags_json LONGTEXT NULL AFTER conversation_json");
  }
  const [generationRevisedPromptColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'revised_prompt'");
  if (!generationRevisedPromptColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN revised_prompt TEXT NULL AFTER public_tags_json");
  }
  const [generationUsageColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'usage_json'");
  if (!generationUsageColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN usage_json LONGTEXT NULL AFTER revised_prompt");
  }
  const [generationDurationColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'duration_ms'");
  if (!generationDurationColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN duration_ms INT UNSIGNED NULL AFTER usage_json");
  }
  const [generationLikeColumns] = await db.execute("SHOW COLUMNS FROM generations LIKE 'like_count'");
  if (!generationLikeColumns.length) {
    await db.query("ALTER TABLE generations ADD COLUMN like_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER duration_ms");
  }

  await canvasCore.applySchema(db);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_daily_usage (
      user_id VARCHAR(32) NOT NULL,
      usage_date DATE NOT NULL,
      free_used INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id, usage_date),
      CONSTRAINT fk_daily_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS generation_likes (
      generation_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (generation_id, user_id),
      INDEX idx_generation_likes_user (user_id),
      INDEX idx_generation_likes_created (created_at),
      CONSTRAINT fk_generation_likes_generation FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
      CONSTRAINT fk_generation_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS generation_reports (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      generation_id VARCHAR(32) NOT NULL,
      reporter_user_id VARCHAR(32) NULL,
      reason VARCHAR(80) NOT NULL,
      description VARCHAR(500) NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      handled_by VARCHAR(32) NULL,
      handled_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_generation_reports_generation (generation_id),
      INDEX idx_generation_reports_status_created (status, created_at),
      CONSTRAINT fk_generation_reports_generation FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
      CONSTRAINT fk_generation_reports_reporter FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_generation_reports_handler FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS gallery_file_checks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      generation_id VARCHAR(32) NOT NULL,
      image_kind VARCHAR(24) NOT NULL DEFAULT 'generated',
      filename VARCHAR(255) NOT NULL,
      relative_path VARCHAR(512) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'unknown',
      file_size BIGINT UNSIGNED NULL,
      error_message VARCHAR(255) NOT NULL DEFAULT '',
      checked_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uniq_gallery_file_check (generation_id, image_kind),
      INDEX idx_gallery_file_checks_status (status, checked_at),
      INDEX idx_gallery_file_checks_generation (generation_id),
      CONSTRAINT fk_gallery_file_checks_generation FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_checkins (
      user_id VARCHAR(32) NOT NULL,
      checkin_date DATE NOT NULL,
      credits_awarded INT UNSIGNED NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (user_id, checkin_date),
      CONSTRAINT fk_user_checkins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS credit_ledger (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      user_id VARCHAR(32) NOT NULL,
      delta INT NOT NULL,
      balance_after INT UNSIGNED NOT NULL,
      source VARCHAR(40) NOT NULL,
      reference_id VARCHAR(64) NOT NULL DEFAULT '',
      note VARCHAR(255) NOT NULL DEFAULT '',
      actor_user_id VARCHAR(32) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_credit_ledger_user_created (user_id, created_at),
      INDEX idx_credit_ledger_source (source),
      INDEX idx_credit_ledger_actor (actor_user_id),
      CONSTRAINT fk_credit_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_credit_ledger_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reward_ledger (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      user_id VARCHAR(32) NOT NULL,
      reward_type VARCHAR(40) NOT NULL,
      status VARCHAR(24) NOT NULL,
      amount INT UNSIGNED NOT NULL DEFAULT 0,
      reference_id VARCHAR(64) NOT NULL DEFAULT '',
      note VARCHAR(255) NOT NULL DEFAULT '',
      awarded_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_reward_ledger_user_created (user_id, created_at),
      INDEX idx_reward_ledger_type_status (reward_type, status),
      CONSTRAINT fk_reward_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      actor_user_id VARCHAR(32) NULL,
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(40) NOT NULL,
      target_id VARCHAR(80) NOT NULL DEFAULT '',
      detail_json LONGTEXT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_admin_audit_created (created_at),
      INDEX idx_admin_audit_actor (actor_user_id),
      INDEX idx_admin_audit_target (target_type, target_id),
      CONSTRAINT fk_admin_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      body TEXT NOT NULL,
      level VARCHAR(24) NOT NULL DEFAULT 'info',
      display_mode VARCHAR(24) NOT NULL DEFAULT 'feed',
      audience VARCHAR(24) NOT NULL DEFAULT 'all',
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      is_important TINYINT(1) NOT NULL DEFAULT 0,
      requires_ack TINYINT(1) NOT NULL DEFAULT 0,
      starts_at DATETIME(3) NULL,
      ends_at DATETIME(3) NULL,
      published_at DATETIME(3) NULL,
      created_by VARCHAR(32) NULL,
      metadata_json LONGTEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_announcements_status_time (status, starts_at, ends_at),
      INDEX idx_announcements_created (created_at),
      INDEX idx_announcements_audience (audience),
      CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS announcement_reads (
      announcement_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      read_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      acked_at DATETIME(3) NULL,
      PRIMARY KEY (announcement_id, user_id),
      INDEX idx_announcement_reads_user (user_id, read_at),
      CONSTRAINT fk_announcement_reads_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
      CONSTRAINT fk_announcement_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS generation_requests (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      prompt TEXT NOT NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      is_public TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(24) NOT NULL,
      error_message TEXT NULL,
      first_generation_id VARCHAR(32) NULL,
      generation_ids TEXT NULL,
      duration_ms INT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_generation_requests_created (created_at),
      INDEX idx_generation_requests_user_created (user_id, created_at),
      INDEX idx_generation_requests_status (status),
      CONSTRAINT fk_generation_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [requestDurationColumns] = await db.execute("SHOW COLUMNS FROM generation_requests LIKE 'duration_ms'");
  if (!requestDurationColumns.length) {
    await db.query("ALTER TABLE generation_requests ADD COLUMN duration_ms INT UNSIGNED NULL AFTER generation_ids");
  }
  await addColumnIfMissing(db, "generation_requests", "queue_status", "VARCHAR(32) NOT NULL DEFAULT 'queued' AFTER status");
  await addColumnIfMissing(db, "generation_requests", "attempt_count", "INT UNSIGNED NOT NULL DEFAULT 0 AFTER queue_status");
  await addColumnIfMissing(db, "generation_requests", "max_attempts", "INT UNSIGNED NOT NULL DEFAULT 1 AFTER attempt_count");
  await addColumnIfMissing(db, "generation_requests", "locked_by", "VARCHAR(96) NULL AFTER max_attempts");
  await addColumnIfMissing(db, "generation_requests", "locked_at", "DATETIME(3) NULL AFTER locked_by");
  await addColumnIfMissing(db, "generation_requests", "started_at", "DATETIME(3) NULL AFTER locked_at");
  await addColumnIfMissing(db, "generation_requests", "finished_at", "DATETIME(3) NULL AFTER started_at");
  await addColumnIfMissing(db, "generation_requests", "provider_task_id", "VARCHAR(191) NULL AFTER finished_at");
  await addColumnIfMissing(db, "generation_requests", "next_poll_at", "DATETIME(3) NULL AFTER provider_task_id");
  await addColumnIfMissing(db, "generation_requests", "retry_after_at", "DATETIME(3) NULL AFTER next_poll_at");
  await addColumnIfMissing(db, "generation_requests", "latency_ms", "INT UNSIGNED NULL AFTER retry_after_at");
  await addColumnIfMissing(db, "generation_requests", "failure_stage", "VARCHAR(64) NULL AFTER latency_ms");
  await addColumnIfMissing(db, "generation_requests", "job_type", "VARCHAR(32) NULL AFTER failure_stage");
  await addColumnIfMissing(db, "generation_requests", "queue_payload_json", "LONGTEXT NULL AFTER job_type");
  await addColumnIfMissing(db, "generation_requests", "requested_params_json", "LONGTEXT NULL AFTER queue_payload_json");
  await addColumnIfMissing(db, "generation_requests", "normalized_params_json", "LONGTEXT NULL AFTER requested_params_json");
  await addColumnIfMissing(db, "generation_requests", "provider_params_json", "LONGTEXT NULL AFTER normalized_params_json");
  await addColumnIfMissing(db, "generation_requests", "provider_response_json", "LONGTEXT NULL AFTER provider_params_json");
  await addColumnIfMissing(db, "generation_requests", "revised_prompt", "TEXT NULL AFTER provider_response_json");
  await addColumnIfMissing(db, "generation_requests", "error_code", "VARCHAR(96) NULL AFTER revised_prompt");
  await addColumnIfMissing(db, "generation_requests", "error_stage", "VARCHAR(64) NULL AFTER error_code");
  await db.query("UPDATE generation_requests SET queue_status = CASE WHEN status = 'succeeded' OR status = 'success' THEN 'succeeded' WHEN status = 'running' THEN 'running' WHEN status = 'failed' THEN 'failed' WHEN status = 'cancelled' THEN 'cancelled' WHEN status = 'expired' THEN 'expired' ELSE queue_status END WHERE queue_status = 'queued'");
  await addIndexIfMissing(db, "generation_requests", "idx_generation_requests_queue_status", "(queue_status, updated_at)");

  await db.query(`
    CREATE TABLE IF NOT EXISTS generation_trace (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      request_id VARCHAR(64) NOT NULL,
      generation_id VARCHAR(32) NULL,
      user_id VARCHAR(32) NULL,
      stage VARCHAR(64) NOT NULL,
      level VARCHAR(16) NOT NULL DEFAULT 'info',
      message VARCHAR(512) NOT NULL DEFAULT '',
      data_json LONGTEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_generation_trace_request (request_id, created_at),
      INDEX idx_generation_trace_generation (generation_id, created_at),
      INDEX idx_generation_trace_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await agentCore.applySchema(db);

  await db.execute(
    `INSERT IGNORE INTO app_settings
      (id, openai_api_key, api_base_url, model, default_credits, generation_credit_cost, allow_registration, require_approval, max_images_per_request, max_reference_images, contact_admin_email)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "",
      process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "",
      process.env.IMAGE_MODEL || defaultModel,
      intEnv("DEFAULT_CREDITS", 10),
      intEnv("GENERATION_CREDIT_COST", 1),
      boolEnv("ALLOW_REGISTRATION", true) ? 1 : 0,
      boolEnv("REQUIRE_APPROVAL", false) ? 1 : 0,
      intEnv("MAX_IMAGES_PER_REQUEST", 1),
      intEnv("MAX_REFERENCE_IMAGES", 4),
      process.env.CONTACT_ADMIN_EMAIL || DEFAULT_CONTACT_ADMIN_EMAIL
    ]
  );
  const envApiBaseUrl = process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "";
  if (envApiBaseUrl) {
    await db.execute(
      "UPDATE app_settings SET api_base_url = ? WHERE id = 1 AND api_base_url = ''",
      [envApiBaseUrl.replace(/\/+$/, "")]
    );
  }

  await db.query(`
    INSERT IGNORE INTO provider_configs
      (id, name, provider_type, base_url, api_key_encrypted, api_key_mask, default_model, capabilities_json, routing_json, status, health_status, sort_order, created_at, updated_at)
    SELECT
      'prv_default',
      'Default OpenAI',
      'openai-compatible',
      api_base_url,
      openai_api_key,
      CASE
        WHEN openai_api_key = '' THEN ''
        WHEN CHAR_LENGTH(openai_api_key) <= 8 THEN '••••'
        ELSE CONCAT(LEFT(openai_api_key, 4), '…', RIGHT(openai_api_key, 4))
      END,
      model,
      provider_capability_json,
      JSON_OBJECT('role', 'default'),
      'active',
      'unknown',
      0,
      NOW(3),
      NOW(3)
    FROM app_settings
    WHERE id = 1
  `);
  await db.execute("UPDATE app_settings SET default_provider_id = 'prv_default' WHERE id = 1 AND default_provider_id = ''");

  await db.query(`
    CREATE TABLE IF NOT EXISTS prompt_categories (
      slug VARCHAR(32) NOT NULL PRIMARY KEY,
      label_zh VARCHAR(48) NOT NULL DEFAULT '',
      label_en VARCHAR(48) NOT NULL DEFAULT '',
      description_zh VARCHAR(255) NOT NULL DEFAULT '',
      description_en VARCHAR(255) NOT NULL DEFAULT '',
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_prompt_categories_status_order (status, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(200) NOT NULL DEFAULT '',
      prompt MEDIUMTEXT NOT NULL,
      image VARCHAR(500) NOT NULL DEFAULT '',
      tags_json LONGTEXT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'general',
      visibility VARCHAR(16) NOT NULL DEFAULT 'public',
      preview VARCHAR(500) NOT NULL DEFAULT '',
      author VARCHAR(120) NOT NULL DEFAULT '',
      source VARCHAR(120) NOT NULL DEFAULT '',
      source_url VARCHAR(500) NOT NULL DEFAULT '',
      github_url VARCHAR(500) NOT NULL DEFAULT '',
      remote_id VARCHAR(160) NOT NULL DEFAULT '',
      source_repo VARCHAR(160) NOT NULL DEFAULT '',
      source_category VARCHAR(120) NOT NULL DEFAULT '',
      prompt_type VARCHAR(32) NOT NULL DEFAULT 'text-to-image',
      language VARCHAR(16) NOT NULL DEFAULT 'zh',
      model_hint VARCHAR(120) NOT NULL DEFAULT '',
      synced_at DATETIME(3) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      sort_order INT NOT NULL DEFAULT 0,
      normalized_hash CHAR(64) NOT NULL DEFAULT '',
      simhash CHAR(16) NOT NULL DEFAULT '',
      like_count INT UNSIGNED NOT NULL DEFAULT 0,
      use_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_prompts_status (status),
      INDEX idx_prompts_category_status (category, status),
      INDEX idx_prompts_remote (source_repo, remote_id),
      INDEX idx_prompts_sort (sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const promptColumnAdds = [
    ["category", "ALTER TABLE prompts ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'general' AFTER tags_json"],
    ["visibility", "ALTER TABLE prompts ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'public' AFTER category"],
    ["preview", "ALTER TABLE prompts ADD COLUMN preview VARCHAR(500) NOT NULL DEFAULT '' AFTER visibility"],
    ["github_url", "ALTER TABLE prompts ADD COLUMN github_url VARCHAR(500) NOT NULL DEFAULT '' AFTER source_url"],
    ["remote_id", "ALTER TABLE prompts ADD COLUMN remote_id VARCHAR(160) NOT NULL DEFAULT '' AFTER github_url"],
    ["source_repo", "ALTER TABLE prompts ADD COLUMN source_repo VARCHAR(160) NOT NULL DEFAULT '' AFTER remote_id"],
    ["source_category", "ALTER TABLE prompts ADD COLUMN source_category VARCHAR(120) NOT NULL DEFAULT '' AFTER source_repo"],
    ["prompt_type", "ALTER TABLE prompts ADD COLUMN prompt_type VARCHAR(32) NOT NULL DEFAULT 'text-to-image' AFTER source_category"],
    ["language", "ALTER TABLE prompts ADD COLUMN language VARCHAR(16) NOT NULL DEFAULT 'zh' AFTER prompt_type"],
    ["model_hint", "ALTER TABLE prompts ADD COLUMN model_hint VARCHAR(120) NOT NULL DEFAULT '' AFTER language"],
    ["synced_at", "ALTER TABLE prompts ADD COLUMN synced_at DATETIME(3) NULL AFTER model_hint"]
  ];
  for (const [column, sql] of promptColumnAdds) {
    const [rows] = await db.execute(`SHOW COLUMNS FROM prompts LIKE '${column}'`);
    if (!rows.length) await db.query(sql);
  }
  const [promptCategoryIndex] = await db.execute("SHOW INDEX FROM prompts WHERE Key_name = 'idx_prompts_category_status'");
  if (!promptCategoryIndex.length) {
    await db.query("ALTER TABLE prompts ADD INDEX idx_prompts_category_status (category, status)");
  }
  const [promptRemoteIndex] = await db.execute("SHOW INDEX FROM prompts WHERE Key_name = 'idx_prompts_remote'");
  if (!promptRemoteIndex.length) {
    await db.query("ALTER TABLE prompts ADD INDEX idx_prompts_remote (source_repo, remote_id)");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS prompt_sources (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(120) NOT NULL DEFAULT '',
      source_type VARCHAR(32) NOT NULL DEFAULT 'github',
      repo_url VARCHAR(500) NOT NULL DEFAULT '',
      branch VARCHAR(80) NOT NULL DEFAULT 'main',
      parser VARCHAR(80) NOT NULL DEFAULT '',
      config_json LONGTEXT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      last_synced_at DATETIME(3) NULL,
      last_status VARCHAR(24) NOT NULL DEFAULT 'never',
      last_success_count INT NOT NULL DEFAULT 0,
      last_failure_count INT NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_prompt_sources_status_order (status, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS prompt_sync_runs (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      source_id VARCHAR(32) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'running',
      started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      finished_at DATETIME(3) NULL,
      success_count INT NOT NULL DEFAULT 0,
      failure_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      error_log MEDIUMTEXT NULL,
      created_by_user_id VARCHAR(32) NULL,
      INDEX idx_prompt_sync_runs_source_started (source_id, started_at),
      INDEX idx_prompt_sync_runs_status_started (status, started_at),
      CONSTRAINT fk_prompt_sync_runs_source FOREIGN KEY (source_id) REFERENCES prompt_sources(id) ON DELETE CASCADE,
      CONSTRAINT fk_prompt_sync_runs_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [promptLikeColumns] = await db.execute("SHOW COLUMNS FROM prompts LIKE 'like_count'");
  if (!promptLikeColumns.length) {
    await db.query("ALTER TABLE prompts ADD COLUMN like_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER sort_order");
  }
  const [promptUseColumns] = await db.execute("SHOW COLUMNS FROM prompts LIKE 'use_count'");
  if (!promptUseColumns.length) {
    await db.query("ALTER TABLE prompts ADD COLUMN use_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER like_count");
  }
  const [promptHashColumns] = await db.execute("SHOW COLUMNS FROM prompts LIKE 'normalized_hash'");
  if (!promptHashColumns.length) {
    await db.query("ALTER TABLE prompts ADD COLUMN normalized_hash CHAR(64) NOT NULL DEFAULT '' AFTER sort_order");
  }
  const [promptSimhashColumns] = await db.execute("SHOW COLUMNS FROM prompts LIKE 'simhash'");
  if (!promptSimhashColumns.length) {
    await db.query("ALTER TABLE prompts ADD COLUMN simhash CHAR(16) NOT NULL DEFAULT '' AFTER normalized_hash");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS prompt_likes (
      prompt_id INT UNSIGNED NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (prompt_id, user_id),
      INDEX idx_prompt_likes_user (user_id),
      CONSTRAINT fk_prompt_likes_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      CONSTRAINT fk_prompt_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS prompt_duplicate_candidates (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      prompt_id INT UNSIGNED NOT NULL,
      duplicate_prompt_id INT UNSIGNED NOT NULL,
      method VARCHAR(40) NOT NULL,
      score DECIMAL(6,4) NOT NULL DEFAULT 0,
      ai_status VARCHAR(24) NOT NULL DEFAULT 'not_reviewed',
      ai_decision VARCHAR(24) NOT NULL DEFAULT '',
      ai_confidence DECIMAL(6,4) NOT NULL DEFAULT 0,
      ai_reason VARCHAR(1000) NOT NULL DEFAULT '',
      ai_recommended_action VARCHAR(40) NOT NULL DEFAULT '',
      ai_model VARCHAR(120) NOT NULL DEFAULT '',
      ai_reviewed_at DATETIME(3) NULL,
      ai_raw_json LONGTEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      reviewer_user_id VARCHAR(32) NULL,
      review_note VARCHAR(500) NOT NULL DEFAULT '',
      reviewed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uniq_prompt_duplicate_pair (prompt_id, duplicate_prompt_id),
      INDEX idx_prompt_duplicates_status (status, created_at),
      CONSTRAINT fk_prompt_duplicate_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      CONSTRAINT fk_prompt_duplicate_dupe FOREIGN KEY (duplicate_prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      CONSTRAINT fk_prompt_duplicate_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const promptDuplicateAiColumns = [
    ["ai_status", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_status VARCHAR(24) NOT NULL DEFAULT 'not_reviewed' AFTER score"],
    ["ai_decision", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_decision VARCHAR(24) NOT NULL DEFAULT '' AFTER ai_status"],
    ["ai_confidence", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_confidence DECIMAL(6,4) NOT NULL DEFAULT 0 AFTER ai_decision"],
    ["ai_reason", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_reason VARCHAR(1000) NOT NULL DEFAULT '' AFTER ai_confidence"],
    ["ai_recommended_action", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_recommended_action VARCHAR(40) NOT NULL DEFAULT '' AFTER ai_reason"],
    ["ai_model", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_model VARCHAR(120) NOT NULL DEFAULT '' AFTER ai_recommended_action"],
    ["ai_reviewed_at", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_reviewed_at DATETIME(3) NULL AFTER ai_model"],
    ["ai_raw_json", "ALTER TABLE prompt_duplicate_candidates ADD COLUMN ai_raw_json LONGTEXT NULL AFTER ai_reviewed_at"]
  ];
  for (const [column, statement] of promptDuplicateAiColumns) {
    const [columns] = await db.execute(`SHOW COLUMNS FROM prompt_duplicate_candidates LIKE '${column}'`);
    if (!columns.length) await db.query(statement);
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS prompt_audit_records (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
      generation_id VARCHAR(32) NULL,
      user_id VARCHAR(32) NULL,
      prompt_text MEDIUMTEXT NOT NULL,
      prompt_hash CHAR(64) NOT NULL DEFAULT '',
      requested_mode VARCHAR(24) NOT NULL DEFAULT 'text-to-image',
      result_level VARCHAR(16) NOT NULL DEFAULT 'low',
      result_action VARCHAR(40) NOT NULL DEFAULT 'allow',
      required_mode VARCHAR(24) NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'allowed',
      score DECIMAL(6,4) NOT NULL DEFAULT 0,
      method VARCHAR(40) NOT NULL DEFAULT '',
      matched_prompt_id INT UNSIGNED NULL,
      matched_generation_id VARCHAR(32) NULL,
      override_action VARCHAR(40) NOT NULL DEFAULT '',
      override_note VARCHAR(500) NOT NULL DEFAULT '',
      reviewer_user_id VARCHAR(32) NULL,
      reviewed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_prompt_audit_created (created_at),
      INDEX idx_prompt_audit_status (status, created_at),
      INDEX idx_prompt_audit_generation (generation_id),
      INDEX idx_prompt_audit_user (user_id),
      CONSTRAINT fk_prompt_audit_generation FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE SET NULL,
      CONSTRAINT fk_prompt_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_prompt_audit_match_prompt FOREIGN KEY (matched_prompt_id) REFERENCES prompts(id) ON DELETE SET NULL,
      CONSTRAINT fk_prompt_audit_match_generation FOREIGN KEY (matched_generation_id) REFERENCES generations(id) ON DELETE SET NULL,
      CONSTRAINT fk_prompt_audit_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS gallery_tags (
      slug VARCHAR(48) NOT NULL PRIMARY KEY,
      label_zh VARCHAR(48) NOT NULL DEFAULT '',
      label_en VARCHAR(48) NOT NULL DEFAULT '',
      aliases_json LONGTEXT NULL,
      category VARCHAR(32) NOT NULL DEFAULT '',
      source VARCHAR(16) NOT NULL DEFAULT 'user',
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      show_in_filter TINYINT(1) NOT NULL DEFAULT 1,
      hue SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      usage_count INT UNSIGNED NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_tags_status_usage (status, usage_count DESC),
      INDEX idx_tags_filter_order (status, show_in_filter, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [tagCategoryColumns] = await db.execute("SHOW COLUMNS FROM gallery_tags LIKE 'category'");
  if (!tagCategoryColumns.length) {
    await db.query("ALTER TABLE gallery_tags ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT '' AFTER aliases_json");
  }
  const [tagFilterColumns] = await db.execute("SHOW COLUMNS FROM gallery_tags LIKE 'show_in_filter'");
  if (!tagFilterColumns.length) {
    await db.query("ALTER TABLE gallery_tags ADD COLUMN show_in_filter TINYINT(1) NOT NULL DEFAULT 1 AFTER status");
  }
  const [tagSortColumns] = await db.execute("SHOW COLUMNS FROM gallery_tags LIKE 'sort_order'");
  if (!tagSortColumns.length) {
    await db.query("ALTER TABLE gallery_tags ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER usage_count");
  }
}

async function initializeDatabase(options = {}) {
  defaultModel = options.defaultModel || defaultModel;
  const config = mysqlConfig();
  await createDatabaseIfNeeded(config);
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    charset: "utf8mb4"
  });
  await runMigrations();
  await tagStore.seedPromptCategories();
  await tagStore.seedPromptSources();
  await userStore.deleteExpiredSessions();
}

async function insertGenerations(generations) {
  if (!generations.length) return;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const generation of generations) {
      await connection.execute(
        `INSERT INTO generations
          (id, user_id, title, prompt, model, size, quality, background, output_format, filename, is_public, source_filename, source_image_id, source_prompt, origin_gallery_id, publish_original, conversation_json, public_tags_json, revised_prompt, usage_json, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generation.id,
          generation.userId,
          String(generation.title || "").trim().slice(0, 160),
          generation.prompt,
          generation.model,
          generation.size,
          generation.quality,
          generation.background,
          generation.outputFormat,
          generation.filename,
          generation.isPublic ? 1 : 0,
          generation.sourceFilename || null,
          generation.sourceImageId || null,
          generation.sourcePrompt || null,
          generation.originGalleryId || null,
          generation.publishOriginal ? 1 : 0,
          generation.conversation ? JSON.stringify(generation.conversation) : null,
          generation.publicTags ? JSON.stringify(generation.publicTags) : null,
          generation.revisedPrompt || "",
          generation.usage ? JSON.stringify(generation.usage) : null,
          Number.isFinite(Number(generation.durationMs)) ? Math.max(0, Math.round(Number(generation.durationMs))) : null,
          new Date(generation.createdAt)
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listGenerationsForUser(user, limit = 60, { includeArchived = false } = {}) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 60));
  const archivedWhere = includeArchived ? "" : "g.archived = 0";
  const sql = `SELECT g.*, u.name AS user_name, u.email AS user_email
     FROM generations g
     LEFT JOIN users u ON u.id = g.user_id
    WHERE g.user_id = ?${archivedWhere ? ` AND ${archivedWhere}` : ""}
    ORDER BY g.created_at DESC LIMIT ${normalizedLimit}`;
  const params = [user.id];
  const [rows] = await getPool().execute(sql, params);
  return rows.map(mapGeneration);
}

async function listGenerationsForUserId(userId, limit = 60, { includeArchived = false } = {}) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 60));
  const archivedWhere = includeArchived ? "" : "AND g.archived = 0";
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email
       FROM generations g
       LEFT JOIN users u ON u.id = g.user_id
      WHERE g.user_id = ? ${archivedWhere}
      ORDER BY g.created_at DESC LIMIT ${normalizedLimit}`,
    [userId]
  );
  return rows.map(mapGeneration);
}

const agentSessionStore = createAgentSessionStore({ getPool, toIso, safeJsonSummary });
const adminStore = createAdminStore({
  getPool,
  mapSettings,
  mapProviderConfig,
  mapAdminAuditLog,
  mapAnnouncement,
  maskSecret,
  getDefaultModel: () => defaultModel
});
const canvasStore = createCanvasStore({ getPool, toIso, mapGeneration });
const galleryStore = createGalleryStore({
  getPool,
  toIso,
  mapGeneration,
  mapGenerationReport,
  mapGalleryFileCheck,
  cancelFirstPublicReward: (...args) => userStore.cancelFirstPublicReward(...args)
});
const generationStore = createGenerationStore({ getPool, toIso, safeJsonSummary, normalizeTraceLevel });
const promptStore = createPromptStore({ getPool, toIso });
const tagStore = createTagStore({ getPool, toIso, mapPromptCategory });
const userStore = createUserStore({
  getPool,
  mapUser,
  mapCreditLedger,
  mapRewardLedger,
  mapGeneration,
  getGenerationById: (...args) => galleryStore.getGenerationById(...args)
});

const storeExportGroups = [
  {
    label: "core",
    source: {
      initializeDatabase,
      getSettings: adminStore.getSettings,
      updateSettings: adminStore.updateSettings
    }
  },
  {
    label: "users",
    source: {
      countUsers: userStore.countUsers,
      countAdmins: userStore.countAdmins,
      getUserByEmail: userStore.getUserByEmail,
      getUserById: userStore.getUserById,
      createUser: userStore.createUser,
      listUsers: userStore.listUsers,
      updateUser: userStore.updateUser,
      updateUserPassword: userStore.updateUserPassword,
      hasCheckedInToday: userStore.hasCheckedInToday,
      checkInToday: userStore.checkInToday,
      reserveDailyFreeGeneration: userStore.reserveDailyFreeGeneration,
      refundDailyFreeGeneration: userStore.refundDailyFreeGeneration,
      getDailyFreeUsed: userStore.getDailyFreeUsed,
      getUserCredits: userStore.getUserCredits,
      createSession: userStore.createSession,
      deleteSession: userStore.deleteSession,
      touchSession: userStore.touchSession,
      getSessionUser: userStore.getSessionUser,
      deleteExpiredSessions: userStore.deleteExpiredSessions,
      setUserCredits: userStore.setUserCredits,
      reserveCredits: userStore.reserveCredits,
      addCredits: userStore.addCredits,
      adjustCredits: userStore.adjustCredits,
      listCreditLedger: userStore.listCreditLedger,
      listRewardLedger: userStore.listRewardLedger,
      hasFirstPublicReward: userStore.hasFirstPublicReward,
      claimFirstPublicReward: userStore.claimFirstPublicReward,
      awardMaturePublicRewards: userStore.awardMaturePublicRewards
    }
  },
  {
    label: "agents",
    source: {
      listAgentSessionsForUser: agentSessionStore.listAgentSessionsForUser,
      getAgentSessionForUser: agentSessionStore.getAgentSessionForUser,
      createAgentSession: agentSessionStore.createAgentSession,
      updateAgentSessionForUser: agentSessionStore.updateAgentSessionForUser,
      deleteAgentSessionForUser: agentSessionStore.deleteAgentSessionForUser,
      createAgentMessageForUser: agentSessionStore.createAgentMessageForUser
    }
  },
  {
    label: "generation",
    source: {
      insertGenerations,
      insertGenerationRequest: generationStore.insertGenerationRequest,
      updateGenerationRequest: generationStore.updateGenerationRequest,
      appendGenerationTrace: generationStore.appendGenerationTrace,
      listGenerationRequests: generationStore.listGenerationRequests,
      getGenerationRequestById: generationStore.getGenerationRequestById,
      getGenerationRequestDiagnostic: generationStore.getGenerationRequestDiagnostic,
      listGenerationTraceForRequest: generationStore.listGenerationTraceForRequest,
      listActiveGenerationRequestsForUser: generationStore.listActiveGenerationRequestsForUser,
      listRecoverableGenerationRequests: generationStore.listRecoverableGenerationRequests,
      listGenerationsForUser,
      listGenerationsForUserId
    }
  },
  {
    label: "gallery",
    source: {
      listWithdrawalRequests: galleryStore.listWithdrawalRequests,
      createGenerationReport: galleryStore.createGenerationReport,
      getGenerationReportById: galleryStore.getGenerationReportById,
      listGenerationReports: galleryStore.listGenerationReports,
      markGenerationReportsHandled: galleryStore.markGenerationReportsHandled,
      listGalleryModeration: galleryStore.listGalleryModeration,
      listGalleryFileCheckTargets: galleryStore.listGalleryFileCheckTargets,
      upsertGalleryFileCheck: galleryStore.upsertGalleryFileCheck,
      listGalleryFileChecks: galleryStore.listGalleryFileChecks,
      listPublicGenerations: galleryStore.listPublicGenerations,
      setGenerationLike: galleryStore.setGenerationLike,
      listGenerationLeaderboard: galleryStore.listGenerationLeaderboard,
      listGenerationLikeAnomalies: galleryStore.listGenerationLikeAnomalies,
      listReportedGenerations: galleryStore.listReportedGenerations,
      getGenerationById: galleryStore.getGenerationById,
      getCanvasProjectForGeneration: canvasStore.getCanvasProjectForGeneration,
      getPublicGenerationForCanvas: canvasStore.getPublicGenerationForCanvas,
      updateGenerationPublic: galleryStore.updateGenerationPublic,
      countTodayGenerations: galleryStore.countTodayGenerations,
      createCanvasGenerationLinks: canvasStore.createCanvasGenerationLinks
    }
  },
  {
    label: "canvas",
    source: {
      listCanvasProjectsForUser: canvasStore.listCanvasProjectsForUser,
      getCanvasProjectById: canvasStore.getCanvasProjectById,
      createCanvasProject: canvasStore.createCanvasProject,
      updateCanvasProject: canvasStore.updateCanvasProject,
      deleteCanvasProject: canvasStore.deleteCanvasProject
    }
  },
  {
    label: "prompts",
    source: {
      listPrompts: promptStore.listPrompts,
      getPromptById: promptStore.getPromptById,
      setPromptLike: promptStore.setPromptLike,
      listPromptImageLeaderboard: promptStore.listPromptImageLeaderboard,
      incrementPromptUse: promptStore.incrementPromptUse,
      refreshPromptFingerprints: promptStore.refreshPromptFingerprints,
      scanPromptDuplicateCandidates: promptStore.scanPromptDuplicateCandidates,
      scanPromptDuplicateCandidatesForPrompt: promptStore.scanPromptDuplicateCandidatesForPrompt,
      listPromptDuplicateCandidates: promptStore.listPromptDuplicateCandidates,
      getPromptDuplicateCandidateById: promptStore.getPromptDuplicateCandidateById,
      reviewPromptDuplicateCandidate: promptStore.reviewPromptDuplicateCandidate,
      updatePromptDuplicateAiReview: promptStore.updatePromptDuplicateAiReview,
      auditPromptForPublish: promptStore.auditPromptForPublish,
      createPromptAuditRecord: promptStore.createPromptAuditRecord,
      listPromptAuditRecords: promptStore.listPromptAuditRecords,
      getPromptAuditRecordById: promptStore.getPromptAuditRecordById,
      reviewPromptAuditRecord: promptStore.reviewPromptAuditRecord,
      countPrompts: promptStore.countPrompts,
      createPrompt: promptStore.createPrompt,
      updatePrompt: promptStore.updatePrompt,
      softDeletePrompt: promptStore.softDeletePrompt,
      getPromptByRemoteKey: promptStore.getPromptByRemoteKey,
      upsertRemotePrompt: promptStore.upsertRemotePrompt,
      listPromptSources: promptStore.listPromptSources,
      getPromptSourceById: promptStore.getPromptSourceById,
      createPromptSource: promptStore.createPromptSource,
      updatePromptSource: promptStore.updatePromptSource,
      createPromptSyncRun: promptStore.createPromptSyncRun,
      getPromptSyncRunById: promptStore.getPromptSyncRunById,
      listPromptSyncRuns: promptStore.listPromptSyncRuns,
      seedPromptsIfEmpty: promptStore.seedPromptsIfEmpty,
      listPromptCategories: tagStore.listPromptCategories,
      getPromptCategoryBySlug: tagStore.getPromptCategoryBySlug,
      upsertPromptCategory: tagStore.upsertPromptCategory,
      listTags: tagStore.listTags,
      getTagBySlug: tagStore.getTagBySlug,
      countTags: tagStore.countTags,
      findTagByAlias: tagStore.findTagByAlias,
      createTag: tagStore.createTag,
      updateTag: tagStore.updateTag,
      hideTag: tagStore.hideTag,
      mergeTag: tagStore.mergeTag,
      migrateTagJsonSlugs: tagStore.migrateTagJsonSlugs,
      incrementTagUsage: tagStore.incrementTagUsage,
      seedTagsIfEmpty: tagStore.seedTagsIfEmpty
    }
  },
  {
    label: "admin",
    source: {
      listProviderConfigs: adminStore.listProviderConfigs,
      getProviderConfigById: adminStore.getProviderConfigById,
      getDefaultProviderConfig: adminStore.getDefaultProviderConfig,
      createProviderConfig: adminStore.createProviderConfig,
      updateProviderConfig: adminStore.updateProviderConfig,
      deleteProviderConfig: adminStore.deleteProviderConfig,
      setDefaultProviderConfig: adminStore.setDefaultProviderConfig,
      updateProviderHealth: adminStore.updateProviderHealth,
      writeAdminAuditLog: adminStore.writeAdminAuditLog,
      listAdminAuditLogs: adminStore.listAdminAuditLogs,
      listAnnouncements: adminStore.listAnnouncements,
      getAnnouncementById: adminStore.getAnnouncementById,
      listPublishedAnnouncements: adminStore.listPublishedAnnouncements,
      createAnnouncement: adminStore.createAnnouncement,
      updateAnnouncement: adminStore.updateAnnouncement,
      deleteAnnouncement: adminStore.deleteAnnouncement,
      publishAnnouncement: adminStore.publishAnnouncement,
      archiveAnnouncement: adminStore.archiveAnnouncement,
      markAnnouncementRead: adminStore.markAnnouncementRead,
      countUnreadAnnouncements: adminStore.countUnreadAnnouncements
    }
  }
];

const store = buildStoreFacade(storeExportGroups);

return store;
}

Object.defineProperty(createMySQLStore, "_buildStoreFacadeForTest", {
  value: buildStoreFacade
});

module.exports = { createMySQLStore };
