let mysql;
try {
  mysql = require("mysql2/promise");
} catch (error) {
  throw new Error("Missing dependency mysql2. Run: npm.cmd install");
}
const { normalizeTraceLevel, safeJsonSummary } = require("./generation-trace-service");
const createAgentSessionStore = require("./stores/agent-session-store");
const createGenerationStore = require("./stores/generation-store");
const createPromptStore = require("./stores/prompt-store");
const createTagStore = require("./stores/tag-store");
const createUserStore = require("./stores/user-store");

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

function mapCanvasProject(row = {}) {
  if (!row) return null;
  return {
    id: row.id || "",
    userId: row.user_id || "",
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    title: row.title || "",
    description: row.description || "",
    coverUrl: row.cover_url || "",
    visibility: row.visibility || "private",
    isTemplate: Boolean(Number(row.is_template || 0)),
    dataJson: parseJsonObject(row.data_json, {}),
    nodeCount: Number(row.node_count || 0),
    edgeCount: Number(row.edge_count || 0),
    status: row.status || "active",
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS canvas_projects (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      title VARCHAR(160) NOT NULL,
      description VARCHAR(1000) NOT NULL DEFAULT '',
      cover_url VARCHAR(500) NOT NULL DEFAULT '',
      visibility VARCHAR(16) NOT NULL DEFAULT 'private',
      is_template TINYINT(1) NOT NULL DEFAULT 0,
      data_json LONGTEXT NOT NULL,
      node_count INT UNSIGNED NOT NULL DEFAULT 0,
      edge_count INT UNSIGNED NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_canvas_projects_user_updated (user_id, updated_at),
      INDEX idx_canvas_projects_visibility_updated (visibility, updated_at),
      INDEX idx_canvas_projects_template_updated (is_template, updated_at),
      INDEX idx_canvas_projects_status_updated (status, updated_at),
      CONSTRAINT fk_canvas_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [canvasTemplateColumns] = await db.execute("SHOW COLUMNS FROM canvas_projects LIKE 'is_template'");
  if (!canvasTemplateColumns.length) {
    await db.query("ALTER TABLE canvas_projects ADD COLUMN is_template TINYINT(1) NOT NULL DEFAULT 0 AFTER visibility");
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS canvas_generation_links (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      canvas_id VARCHAR(32) NOT NULL,
      generation_id VARCHAR(32) NOT NULL,
      output_node_id VARCHAR(160) NOT NULL DEFAULT '',
      config_node_id VARCHAR(160) NOT NULL DEFAULT '',
      created_at DATETIME(3) NOT NULL,
      UNIQUE KEY uniq_canvas_generation_link (canvas_id, generation_id),
      INDEX idx_canvas_generation_links_canvas (canvas_id),
      INDEX idx_canvas_generation_links_generation (generation_id),
      CONSTRAINT fk_canvas_generation_links_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_canvas_generation_links_generation FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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

  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      title VARCHAR(160) NOT NULL,
      source_type VARCHAR(32) NOT NULL DEFAULT 'agent',
      source_id VARCHAR(64) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      summary TEXT NULL,
      data_json LONGTEXT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_agent_sessions_user_updated (user_id, updated_at),
      INDEX idx_agent_sessions_status_updated (status, updated_at),
      CONSTRAINT fk_agent_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      session_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      role VARCHAR(32) NOT NULL,
      content TEXT NOT NULL,
      attachments_json LONGTEXT NULL,
      created_at DATETIME(3) NOT NULL,
      INDEX idx_agent_messages_session_created (session_id, created_at),
      INDEX idx_agent_messages_user_created (user_id, created_at),
      CONSTRAINT fk_agent_messages_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
      CONSTRAINT fk_agent_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_steps (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      session_id VARCHAR(32) NOT NULL,
      message_id VARCHAR(32) NULL,
      kind VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      input_json LONGTEXT NULL,
      output_json LONGTEXT NULL,
      request_id VARCHAR(64) NULL,
      generation_id VARCHAR(32) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_agent_steps_session_created (session_id, created_at),
      INDEX idx_agent_steps_message (message_id),
      INDEX idx_agent_steps_request (request_id),
      INDEX idx_agent_steps_generation (generation_id),
      CONSTRAINT fk_agent_steps_session FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
      CONSTRAINT fk_agent_steps_message FOREIGN KEY (message_id) REFERENCES agent_messages(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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

async function getSettings() {
  const [rows] = await getPool().execute("SELECT * FROM app_settings WHERE id = 1 LIMIT 1");
  return mapSettings(rows[0]);
}

async function updateSettings(patch) {
  const columns = [];
  const values = [];
  const mapping = {
    openaiApiKey: "openai_api_key",
    apiBaseUrl: "api_base_url",
    model: "model",
    defaultCredits: "default_credits",
    generationCreditCost: "generation_credit_cost",
    allowRegistration: "allow_registration",
    requireApproval: "require_approval",
    maxImagesPerRequest: "max_images_per_request",
    maxReferenceImages: "max_reference_images",
    contactAdminEmail: "contact_admin_email",
    growthConfig: "growth_config_json",
    providerCapabilityConfig: "provider_capability_json",
    defaultProviderId: "default_provider_id"
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (Object.hasOwn(patch, key)) {
      columns.push(`${column} = ?`);
      values.push(key === "growthConfig" || key === "providerCapabilityConfig" ? JSON.stringify(patch[key] || {}) : patch[key]);
    }
  }

  if (columns.length) {
    values.push(1);
    await getPool().execute(`UPDATE app_settings SET ${columns.join(", ")} WHERE id = ?`, values);
  }
  return getSettings();
}

async function countUsers() {
  const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM users");
  return Number(rows[0]?.count || 0);
}

async function countAdmins() {
  const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
  return Number(rows[0]?.count || 0);
}

async function getUserByEmail(email) {
  const [rows] = await getPool().execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return mapUser(rows[0]);
}

async function getUserById(id) {
  const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return mapUser(rows[0]);
}

async function createUser(user) {
  const createdAt = new Date();
  await getPool().execute(
    `INSERT INTO users
      (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.name,
      user.email,
      user.passwordHash.salt,
      user.passwordHash.iterations,
      user.passwordHash.hash,
      user.role,
      user.status,
      user.credits,
      createdAt,
      createdAt
    ]
  );
  if (Number(user.credits || 0) > 0) {
    await insertCreditLedger({
      userId: user.id,
      delta: Number(user.credits || 0),
      balanceAfter: Number(user.credits || 0),
      source: "signup_default",
      note: "Initial credits"
    });
  }
  return getUserById(user.id);
}

async function listUsers({ search = "", status = "", role = "", rewardStatus = "", limit = 500, offset = 0 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(1000, Number(limit) || 500));
  const normalizedOffset = Math.max(0, Number(offset) || 0);
  const where = [];
  const values = [];
  const query = String(search || "").trim().toLowerCase();
  if (query) {
    where.push("(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR u.id = ?)");
    values.push(`%${query}%`, `%${query}%`, query);
  }
  if (status && status !== "all") {
    where.push("u.status = ?");
    values.push(status);
  }
  if (role && role !== "all") {
    where.push("u.role = ?");
    values.push(role);
  }
  if (rewardStatus && rewardStatus !== "all") {
    if (rewardStatus === "none") {
      where.push("fpr.status IS NULL");
    } else {
      where.push("fpr.status = ?");
      values.push(rewardStatus);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await getPool().execute(
    `SELECT u.*,
            fpr.status AS first_public_reward_status,
            fpr.amount AS first_public_reward_amount,
            fpr.reference_id AS first_public_reward_reference_id,
            fpr.awarded_at AS first_public_reward_awarded_at,
            fpr.created_at AS first_public_reward_created_at
       FROM users u
       LEFT JOIN (
         SELECT rl.*
           FROM reward_ledger rl
           INNER JOIN (
             SELECT user_id, MAX(id) AS id
               FROM reward_ledger
              WHERE reward_type = 'first_public'
              GROUP BY user_id
           ) latest ON latest.id = rl.id
       ) fpr ON fpr.user_id = u.id
       ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT ${normalizedLimit} OFFSET ${normalizedOffset}`,
    values
  );
  return rows.map(mapUser);
}

async function updateUser(id, patch) {
  const columns = [];
  const values = [];
  const mapping = {
    name: "name",
    role: "role",
    status: "status"
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (Object.hasOwn(patch, key)) {
      columns.push(`${column} = ?`);
      values.push(patch[key]);
    }
  }

  if (columns.length) {
    columns.push("updated_at = ?");
    values.push(new Date(), id);
    await getPool().execute(`UPDATE users SET ${columns.join(", ")} WHERE id = ?`, values);
  }
  return getUserById(id);
}

async function updateUserPassword(id, passwordHash) {
  await getPool().execute(
    `UPDATE users
       SET password_salt = ?, password_iterations = ?, password_hash = ?, updated_at = ?
     WHERE id = ?`,
    [
      passwordHash.salt,
      passwordHash.iterations,
      passwordHash.hash,
      new Date(),
      id
    ]
  );
  return getUserById(id);
}

async function listProviderConfigs({ includeSecret = false } = {}) {
  const [rows] = await getPool().execute("SELECT * FROM provider_configs ORDER BY sort_order ASC, created_at ASC");
  return rows.map((row) => mapProviderConfig(row, { includeSecret }));
}

async function getProviderConfigById(id, { includeSecret = false } = {}) {
  const [rows] = await getPool().execute("SELECT * FROM provider_configs WHERE id = ? LIMIT 1", [id]);
  return mapProviderConfig(rows[0], { includeSecret });
}

async function getDefaultProviderConfig({ includeSecret = false } = {}) {
  const settings = await getSettings();
  const providers = await listProviderConfigs({ includeSecret });
  if (settings.defaultProviderId) {
    const provider = providers.find((item) => item.id === settings.defaultProviderId);
    if (provider?.status === "active") return provider;
  }
  return providers.find((provider) => provider.status === "active") || null;
}

function providerDbPayload(input = {}, existing = {}) {
  const apiKey = Object.hasOwn(input, "apiKey")
    ? String(input.apiKey || "").trim()
    : existing.apiKey || "";
  const capabilities = input.capabilities && typeof input.capabilities === "object" ? input.capabilities : existing.capabilities || {};
  const routing = input.routing && typeof input.routing === "object" ? input.routing : existing.routing || {};
  const mapping = input.mapping && typeof input.mapping === "object" ? input.mapping : existing.mapping || {};
  return {
    name: String(input.name || existing.name || "Provider").trim().slice(0, 120),
    providerType: String(input.providerType || existing.providerType || "openai-compatible").trim().slice(0, 40),
    baseUrl: String(input.baseUrl || existing.baseUrl || "").trim().replace(/\/+$/, ""),
    apiKey,
    apiKeyMask: maskSecret(apiKey),
    defaultModel: String(input.defaultModel || existing.defaultModel || defaultModel).trim().slice(0, 120),
    endpointImages: String(input.endpointImages || existing.endpointImages || "").trim(),
    endpointResponses: String(input.endpointResponses || existing.endpointResponses || "").trim(),
    endpointEdits: String(input.endpointEdits || existing.endpointEdits || "").trim(),
    capabilities,
    routing,
    mapping,
    status: ["active", "disabled"].includes(input.status) ? input.status : existing.status || "active",
    sortOrder: Number.parseInt(input.sortOrder, 10) || Number(existing.sortOrder || 0)
  };
}

async function createProviderConfig(input) {
  const now = new Date();
  const payload = providerDbPayload(input);
  await getPool().execute(
    `INSERT INTO provider_configs
      (id, name, provider_type, base_url, api_key_encrypted, api_key_mask, default_model, endpoint_images, endpoint_responses, endpoint_edits, capabilities_json, routing_json, provider_mapping_json, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      payload.name,
      payload.providerType,
      payload.baseUrl,
      payload.apiKey,
      payload.apiKeyMask,
      payload.defaultModel,
      payload.endpointImages,
      payload.endpointResponses,
      payload.endpointEdits,
      JSON.stringify(payload.capabilities),
      JSON.stringify(payload.routing),
      JSON.stringify(payload.mapping),
      payload.status,
      payload.sortOrder,
      now,
      now
    ]
  );
  return getProviderConfigById(input.id);
}

async function updateProviderConfig(id, input) {
  const existing = await getProviderConfigById(id, { includeSecret: true });
  if (!existing) return null;
  const payload = providerDbPayload(input, existing);
  await getPool().execute(
    `UPDATE provider_configs
       SET name = ?, provider_type = ?, base_url = ?, api_key_encrypted = ?, api_key_mask = ?, default_model = ?,
           endpoint_images = ?, endpoint_responses = ?, endpoint_edits = ?, capabilities_json = ?, routing_json = ?, provider_mapping_json = ?,
           status = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`,
    [
      payload.name,
      payload.providerType,
      payload.baseUrl,
      payload.apiKey,
      payload.apiKeyMask,
      payload.defaultModel,
      payload.endpointImages,
      payload.endpointResponses,
      payload.endpointEdits,
      JSON.stringify(payload.capabilities),
      JSON.stringify(payload.routing),
      JSON.stringify(payload.mapping),
      payload.status,
      payload.sortOrder,
      new Date(),
      id
    ]
  );
  return getProviderConfigById(id);
}

async function deleteProviderConfig(id) {
  const [result] = await getPool().execute("DELETE FROM provider_configs WHERE id = ? AND id <> 'prv_default'", [id]);
  return result.affectedRows > 0;
}

async function setDefaultProviderConfig(id) {
  const provider = await getProviderConfigById(id);
  if (!provider) return null;
  await updateSettings({ defaultProviderId: id });
  return provider;
}

async function updateProviderHealth(id, patch = {}) {
  await getPool().execute(
    "UPDATE provider_configs SET health_status = ?, last_checked_at = ?, last_error = ?, updated_at = ? WHERE id = ?",
    [
      patch.healthStatus || "unknown",
      new Date(),
      String(patch.lastError || "").slice(0, 2000),
      new Date(),
      id
    ]
  );
  return getProviderConfigById(id);
}

async function insertCreditLedger(entry, connection = getPool()) {
  await connection.execute(
    `INSERT INTO credit_ledger
      (user_id, delta, balance_after, source, reference_id, note, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      Number(entry.delta || 0),
      Math.max(0, Number(entry.balanceAfter || 0)),
      String(entry.source || "manual").slice(0, 40),
      String(entry.referenceId || "").slice(0, 64),
      String(entry.note || "").slice(0, 255),
      entry.actorUserId || null
    ]
  );
}

async function insertRewardLedger(entry, connection = getPool()) {
  await connection.execute(
    `INSERT INTO reward_ledger
      (user_id, reward_type, status, amount, reference_id, note, awarded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      String(entry.rewardType || "reward").slice(0, 40),
      String(entry.status || "awarded").slice(0, 24),
      Math.max(0, Number(entry.amount || 0)),
      String(entry.referenceId || "").slice(0, 64),
      String(entry.note || "").slice(0, 255),
      entry.awardedAt || null
    ]
  );
}

async function writeAdminAuditLog(entry) {
  await getPool().execute(
    `INSERT INTO admin_audit_logs
      (actor_user_id, action, target_type, target_id, detail_json, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.actorUserId || null,
      String(entry.action || "").slice(0, 80),
      String(entry.targetType || "").slice(0, 40),
      String(entry.targetId || "").slice(0, 80),
      entry.detail === undefined ? null : JSON.stringify(entry.detail).slice(0, 16000),
      String(entry.ipAddress || "").slice(0, 64),
      String(entry.userAgent || "").slice(0, 512)
    ]
  );
}

async function reserveCredits(userId, amount, meta = {}) {
  const [result] = await getPool().execute(
    "UPDATE users SET credits = credits - ?, updated_at = ? WHERE id = ? AND credits >= ?",
    [amount, new Date(), userId, amount]
  );
  if (result.affectedRows !== 1) return false;
  const balanceAfter = await getUserCredits(userId);
  await insertCreditLedger({
    userId,
    delta: -Math.abs(Number(amount) || 0),
    balanceAfter,
    source: meta.source || "generation_charge",
    referenceId: meta.referenceId,
    note: meta.note,
    actorUserId: meta.actorUserId
  });
  return true;
}

async function addCredits(userId, amount, meta = {}) {
  if (amount <= 0) return;
  await getPool().execute("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?", [
    amount,
    new Date(),
    userId
  ]);
  const balanceAfter = await getUserCredits(userId);
  await insertCreditLedger({
    userId,
    delta: Math.abs(Number(amount) || 0),
    balanceAfter,
    source: meta.source || "credit_grant",
    referenceId: meta.referenceId,
    note: meta.note,
    actorUserId: meta.actorUserId
  });
}

async function setUserCredits(userId, credits, meta = {}) {
  const nextCredits = Math.max(0, Math.min(100000, Number.parseInt(credits, 10) || 0));
  const before = await getUserById(userId);
  await getPool().execute("UPDATE users SET credits = ?, updated_at = ? WHERE id = ?", [
    nextCredits,
    new Date(),
    userId
  ]);
  const amount = nextCredits - Number(before?.credits || 0);
  if (amount) {
    await insertCreditLedger({
      userId,
      delta: amount,
      balanceAfter: nextCredits,
      source: meta.source || "admin_set",
      referenceId: meta.referenceId,
      note: meta.note,
      actorUserId: meta.actorUserId
    });
  }
  return getUserById(userId);
}

async function adjustCredits(userId, delta, meta = {}) {
  const amount = Number(delta) || 0;
  if (!amount) return getUserById(userId);
  if (amount > 0) {
    await addCredits(userId, amount, {
      source: meta.source || "admin_adjustment",
      referenceId: meta.referenceId,
      note: meta.note,
      actorUserId: meta.actorUserId
    });
  } else {
    const deduction = Math.abs(amount);
    await getPool().execute(
      "UPDATE users SET credits = IF(credits < ?, 0, credits - ?), updated_at = ? WHERE id = ?",
      [deduction, deduction, new Date(), userId]
    );
    const balanceAfter = await getUserCredits(userId);
    await insertCreditLedger({
      userId,
      delta: amount,
      balanceAfter,
      source: meta.source || "admin_adjustment",
      referenceId: meta.referenceId,
      note: meta.note,
      actorUserId: meta.actorUserId
    });
  }
  return getUserById(userId);
}

async function hasCheckedInToday(userId) {
  const [rows] = await getPool().execute(
    "SELECT user_id FROM user_checkins WHERE user_id = ? AND checkin_date = CURRENT_DATE() LIMIT 1",
    [userId]
  );
  return rows.length > 0;
}

async function checkInToday(userId, creditAmount = 1) {
  const amount = Math.max(1, Number(creditAmount) || 1);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [insertResult] = await connection.execute(
      "INSERT IGNORE INTO user_checkins (user_id, checkin_date, credits_awarded) VALUES (?, CURRENT_DATE(), ?)",
      [userId, amount]
    );
    if (insertResult.affectedRows === 0) {
      const [rows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
      await connection.rollback();
      return { checkedIn: false, credits: Number(rows[0]?.credits || 0) };
    }
    await connection.execute("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?", [
      amount,
      new Date(),
      userId
    ]);
    const [rows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
    const balanceAfter = Number(rows[0]?.credits || 0);
    await insertCreditLedger({
      userId,
      delta: amount,
      balanceAfter,
      source: "daily_checkin",
      referenceId: `checkin:${new Date().toISOString().slice(0, 10)}`,
      note: "Daily check-in reward"
    }, connection);
    await insertRewardLedger({
      userId,
      rewardType: "daily_checkin",
      status: "awarded",
      amount,
      referenceId: `checkin:${new Date().toISOString().slice(0, 10)}`,
      note: "Daily check-in reward",
      awardedAt: new Date()
    }, connection);
    await connection.commit();
    return { checkedIn: true, credits: balanceAfter };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function reserveDailyFreeGeneration(userId, freeLimit) {
  const limit = Math.max(0, Number(freeLimit) || 0);
  if (!limit) return false;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT free_used FROM user_daily_usage WHERE user_id = ? AND usage_date = CURRENT_DATE() FOR UPDATE",
      [userId]
    );
    const used = Number(rows[0]?.free_used || 0);
    if (!rows.length) {
      await connection.execute(
        "INSERT INTO user_daily_usage (user_id, usage_date, free_used) VALUES (?, CURRENT_DATE(), 1)",
        [userId]
      );
      await connection.commit();
      return true;
    }
    if (used >= limit) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      "UPDATE user_daily_usage SET free_used = free_used + 1 WHERE user_id = ? AND usage_date = CURRENT_DATE()",
      [userId]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function refundDailyFreeGeneration(userId) {
  await getPool().execute(
    "UPDATE user_daily_usage SET free_used = GREATEST(free_used - 1, 0) WHERE user_id = ? AND usage_date = CURRENT_DATE()",
    [userId]
  );
}

async function getDailyFreeUsed(userId) {
  const [rows] = await getPool().execute(
    "SELECT free_used FROM user_daily_usage WHERE user_id = ? AND usage_date = CURRENT_DATE() LIMIT 1",
    [userId]
  );
  return Number(rows[0]?.free_used || 0);
}

async function getUserCredits(userId) {
  const [rows] = await getPool().execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
  return Number(rows[0]?.credits || 0);
}

async function listCreditLedger({ userId = "", limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [];
  const where = userId ? "WHERE cl.user_id = ?" : "";
  if (userId) values.push(userId);
  const [rows] = await getPool().execute(
    `SELECT cl.*, u.name AS user_name, u.email AS user_email, au.name AS actor_name, au.email AS actor_email
       FROM credit_ledger cl
       LEFT JOIN users u ON u.id = cl.user_id
       LEFT JOIN users au ON au.id = cl.actor_user_id
       ${where}
      ORDER BY cl.created_at DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapCreditLedger);
}

async function listRewardLedger({ userId = "", limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [];
  const where = userId ? "WHERE rl.user_id = ?" : "";
  if (userId) values.push(userId);
  const [rows] = await getPool().execute(
    `SELECT rl.*, u.name AS user_name, u.email AS user_email
       FROM reward_ledger rl
       LEFT JOIN users u ON u.id = rl.user_id
       ${where}
      ORDER BY rl.created_at DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapRewardLedger);
}

async function hasFirstPublicReward(userId) {
  const [rewardRows] = await getPool().execute(
    "SELECT id FROM reward_ledger WHERE user_id = ? AND reward_type = 'first_public' LIMIT 1",
    [userId]
  );
  if (rewardRows.length) return true;
  const [pendingRows] = await getPool().execute(
    "SELECT id FROM generations WHERE user_id = ? AND public_reward_status IN ('pending', 'awarded', 'cancelled') LIMIT 1",
    [userId]
  );
  return pendingRows.length > 0;
}

async function claimFirstPublicReward(generationId, userId, amount = 0) {
  const rewardAmount = Math.max(0, Number(amount) || 0);
  if (!generationId || !userId || rewardAmount <= 0) return null;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!userRows.length) {
      await connection.rollback();
      return null;
    }
    const [existingRewards] = await connection.execute(
      "SELECT id FROM reward_ledger WHERE user_id = ? AND reward_type = 'first_public' LIMIT 1 FOR UPDATE",
      [userId]
    );
    if (existingRewards.length) {
      await connection.rollback();
      return null;
    }
    const [existingGenerationRewards] = await connection.execute(
      "SELECT id FROM generations WHERE user_id = ? AND public_reward_status IN ('pending', 'awarded', 'cancelled') LIMIT 1 FOR UPDATE",
      [userId]
    );
    if (existingGenerationRewards.length) {
      await connection.rollback();
      return null;
    }
    const [targetRows] = await connection.execute(
      "SELECT id, is_public, archived, moderation_status FROM generations WHERE id = ? AND user_id = ? FOR UPDATE",
      [generationId, userId]
    );
    const target = targetRows[0];
    if (!target || !target.is_public || target.archived || !["visible", "restored"].includes(target.moderation_status || "visible")) {
      await connection.rollback();
      return null;
    }
    await connection.execute(
      `UPDATE generations
          SET public_reward_status = 'pending',
              public_reward_amount = ?,
              withdrawal_status = 'none',
              published_at = IFNULL(published_at, NOW(3))
        WHERE id = ? AND user_id = ?`,
      [rewardAmount, generationId, userId]
    );
    await insertRewardLedger({
      userId,
      rewardType: "first_public",
      status: "pending",
      amount: rewardAmount,
      referenceId: generationId,
      note: "First public work reward pending"
    }, connection);
    await connection.commit();
    return getGenerationById(generationId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelFirstPublicReward(generationId, note = "First public reward cancelled", connection = getPool()) {
  if (!generationId) return;
  await connection.execute(
    `UPDATE reward_ledger
        SET status = 'cancelled',
            note = ?
      WHERE reward_type = 'first_public'
        AND reference_id = ?
        AND status = 'pending'`,
    [String(note || "First public reward cancelled").slice(0, 255), generationId]
  );
}

async function awardMaturePublicRewards({ minAgeHours = 12 } = {}) {
  const [rows] = await getPool().execute(
    `SELECT * FROM generations
      WHERE is_public = 1
        AND archived = 0
        AND public_reward_status = 'pending'
        AND moderation_status IN ('visible', 'restored')
        AND published_at IS NOT NULL
        AND published_at <= DATE_SUB(NOW(3), INTERVAL ? HOUR)
        AND withdrawal_status IN ('none', 'rejected')
      ORDER BY published_at ASC
      LIMIT 100`,
    [Math.max(1, Number(minAgeHours) || 12)]
  );
  let awarded = 0;
  for (const row of rows) {
    if (await awardMaturePublicReward(row.id, { minAgeHours })) awarded += 1;
  }
  return awarded;
}

async function awardMaturePublicReward(generationId, { minAgeHours = 12 } = {}) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT *
         FROM generations
        WHERE id = ?
          AND public_reward_status = 'pending'
        FOR UPDATE`,
      [generationId]
    );
    const generation = mapGeneration(rows[0]);
    if (
      !generation ||
      !generation.isPublic ||
      generation.archived ||
      !["visible", "restored"].includes(generation.moderationStatus || "visible") ||
      !generation.publishedAt ||
      Date.now() - new Date(generation.publishedAt).getTime() < Math.max(1, Number(minAgeHours) || 12) * 60 * 60 * 1000 ||
      !["none", "rejected"].includes(generation.withdrawalStatus || "none")
    ) {
      await connection.rollback();
      return false;
    }
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [generation.userId]);
    const [awardedRows] = await connection.execute(
      `SELECT id, reference_id
         FROM reward_ledger
        WHERE user_id = ?
          AND reward_type = 'first_public'
          AND status = 'awarded'
        LIMIT 1
        FOR UPDATE`,
      [generation.userId]
    );
    if (awardedRows.length && awardedRows[0].reference_id !== generation.id) {
      await connection.execute(
        "UPDATE generations SET public_reward_status = 'cancelled' WHERE id = ?",
        [generation.id]
      );
      await cancelFirstPublicReward(generation.id, "Superseded by existing first public reward", connection);
      await connection.commit();
      return false;
    }
    const amount = Number(generation.publicRewardAmount || 0);
    if (amount > 0) {
      await connection.execute("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?", [
        amount,
        new Date(),
        generation.userId
      ]);
      const [balanceRows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [generation.userId]);
      await insertCreditLedger({
        userId: generation.userId,
        delta: amount,
        balanceAfter: Number(balanceRows[0]?.credits || 0),
        source: "first_public_reward",
        referenceId: generation.id,
        note: "First public work reward"
      }, connection);
      const [rewardUpdate] = await connection.execute(
        `UPDATE reward_ledger
            SET status = 'awarded',
                amount = ?,
                note = 'Public for 12 hours',
                awarded_at = ?
          WHERE user_id = ?
            AND reward_type = 'first_public'
            AND reference_id = ?
            AND status = 'pending'`,
        [amount, new Date(), generation.userId, generation.id]
      );
      if (rewardUpdate.affectedRows === 0) {
        await insertRewardLedger({
          userId: generation.userId,
          rewardType: "first_public",
          status: "awarded",
          amount,
          referenceId: generation.id,
          note: "Public for 12 hours",
          awardedAt: new Date()
        }, connection);
      }
    }
    await connection.execute(
      "UPDATE generations SET public_reward_status = 'awarded' WHERE id = ?",
      [generation.id]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listWithdrawalRequests({ limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email
       FROM generations g
       LEFT JOIN users u ON u.id = g.user_id
      WHERE g.withdrawal_status IN ('requested', 'approved', 'rejected')
      ORDER BY COALESCE(g.withdrawal_requested_at, g.created_at) DESC
      LIMIT ${normalizedLimit}`
  );
  return rows.map(mapGeneration);
}

async function createGenerationReport({ generationId, reporterUserId = "", reason = "", description = "" }) {
  const [existing] = await getPool().execute(
    `SELECT id FROM generation_reports
      WHERE generation_id = ? AND reporter_user_id <=> ? AND status = 'pending'
      LIMIT 1`,
    [generationId, reporterUserId || null]
  );
  if (existing.length) {
    const report = await getGenerationReportById(existing[0].id);
    return report ? { ...report, alreadyPending: true } : report;
  }
  const [result] = await getPool().execute(
    `INSERT INTO generation_reports (generation_id, reporter_user_id, reason, description)
     VALUES (?, ?, ?, ?)`,
    [
      generationId,
      reporterUserId || null,
      String(reason || "other").slice(0, 80),
      String(description || "").slice(0, 500)
    ]
  );
  await getPool().execute(
    `UPDATE generations
        SET moderation_status = IF(moderation_status = 'hidden', 'hidden', 'reported'),
            moderation_reason = ?,
            report_count = report_count + 1
      WHERE id = ?`,
    [String(reason || "user_report").slice(0, 255), generationId]
  );
  const report = await getGenerationReportById(result.insertId);
  return report ? { ...report, created: true } : report;
}

async function getGenerationReportById(id) {
  const [rows] = await getPool().execute(
    `SELECT gr.*, ru.name AS reporter_name, ru.email AS reporter_email,
            hu.name AS handler_name, hu.email AS handler_email
       FROM generation_reports gr
       LEFT JOIN users ru ON ru.id = gr.reporter_user_id
       LEFT JOIN users hu ON hu.id = gr.handled_by
      WHERE gr.id = ? LIMIT 1`,
    [Number(id) || 0]
  );
  return mapGenerationReport(rows[0]);
}

async function listGenerationReports({ generationId = "", status = "", limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const where = [];
  const values = [];
  if (generationId) {
    where.push("gr.generation_id = ?");
    values.push(generationId);
  }
  if (status) {
    where.push("gr.status = ?");
    values.push(status);
  }
  const [rows] = await getPool().execute(
    `SELECT gr.*, ru.name AS reporter_name, ru.email AS reporter_email,
            hu.name AS handler_name, hu.email AS handler_email
       FROM generation_reports gr
       LEFT JOIN users ru ON ru.id = gr.reporter_user_id
       LEFT JOIN users hu ON hu.id = gr.handled_by
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY gr.created_at DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapGenerationReport);
}

async function markGenerationReportsHandled(generationId, { status = "resolved", handledBy = "" } = {}) {
  await getPool().execute(
    `UPDATE generation_reports
        SET status = ?, handled_by = ?, handled_at = ?
      WHERE generation_id = ? AND status = 'pending'`,
    [status, handledBy || null, new Date(), generationId]
  );
}

async function listGalleryModeration({ limit = 100, status = "", includeBroken = false } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [];
  let where = "WHERE (g.moderation_status IN ('reported', 'reviewing') OR g.withdrawal_status = 'requested')";
  if (status === "all") {
    where = "WHERE (g.is_public = 1 OR g.moderation_status IN ('reported', 'reviewing', 'hidden', 'restored') OR g.withdrawal_status = 'requested')";
  } else if (status === "withdrawal_requested") {
    where = "WHERE g.withdrawal_status = 'requested'";
  } else if (status && status !== "queue") {
    where += " AND g.moderation_status = ?";
    values.push(status);
  }
  const brokenWhere = includeBroken
    ? ""
    : "AND NOT EXISTS (SELECT 1 FROM gallery_file_checks gfc WHERE gfc.generation_id = g.id AND gfc.status = 'broken')";
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email,
            COALESCE(rc.report_count, 0) AS report_count,
            COALESCE(rc.pending_report_count, 0) AS pending_report_count,
            COALESCE(rc.latest_report_reason, '') AS latest_report_reason
       FROM generations g
       LEFT JOIN users u ON u.id = g.user_id
       LEFT JOIN (
         SELECT generation_id,
                COUNT(*) AS report_count,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_report_count,
                SUBSTRING_INDEX(GROUP_CONCAT(reason ORDER BY created_at DESC SEPARATOR '\\n'), '\\n', 1) AS latest_report_reason
           FROM generation_reports
          GROUP BY generation_id
       ) rc ON rc.generation_id = g.id
       ${where}
       ${brokenWhere}
      ORDER BY pending_report_count DESC, COALESCE(g.moderation_checked_at, g.published_at, g.created_at) DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapGeneration);
}

async function listGalleryFileCheckTargets({ limit = 1000 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(5000, Number(limit) || 1000));
  const [rows] = await getPool().execute(
    `SELECT id, filename, source_filename, publish_original, prompt, published_at, moderation_status
       FROM generations
      WHERE is_public = 1 AND archived = 0
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ${normalizedLimit}`
  );
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename || "",
    sourceFilename: row.source_filename || "",
    publishOriginal: Boolean(row.publish_original || 0),
    prompt: row.prompt || "",
    publishedAt: toIso(row.published_at),
    moderationStatus: row.moderation_status || "visible"
  }));
}

async function upsertGalleryFileCheck(check) {
  const generationId = String(check.generationId || "").trim();
  const imageKind = String(check.imageKind || "generated").trim() || "generated";
  const filename = String(check.filename || "").trim();
  if (!generationId || !filename) return null;
  const relativePath = String(check.relativePath || "").slice(0, 512);
  const status = ["ok", "broken", "unknown"].includes(check.status) ? check.status : "unknown";
  const fileSize = Number.isFinite(Number(check.fileSize)) && Number(check.fileSize) >= 0 ? Number(check.fileSize) : null;
  const errorMessage = String(check.errorMessage || "").slice(0, 255);
  await getPool().execute(
    `INSERT INTO gallery_file_checks
        (generation_id, image_kind, filename, relative_path, status, file_size, error_message, checked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))
      ON DUPLICATE KEY UPDATE
        filename = VALUES(filename),
        relative_path = VALUES(relative_path),
        status = VALUES(status),
        file_size = VALUES(file_size),
        error_message = VALUES(error_message),
        checked_at = VALUES(checked_at)`,
    [generationId, imageKind, filename, relativePath, status, fileSize, errorMessage]
  );
  return getGalleryFileCheck(generationId, imageKind);
}

async function getGalleryFileCheck(generationId, imageKind = "generated") {
  const [rows] = await getPool().execute(
    `SELECT gfc.*, g.prompt, g.published_at, g.moderation_status, u.name AS user_name, u.email AS user_email
       FROM gallery_file_checks gfc
       LEFT JOIN generations g ON g.id = gfc.generation_id
       LEFT JOIN users u ON u.id = g.user_id
      WHERE gfc.generation_id = ? AND gfc.image_kind = ? LIMIT 1`,
    [generationId, imageKind]
  );
  return mapGalleryFileCheck(rows[0]);
}

async function listGalleryFileChecks({ status = "", limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [];
  const where = [];
  const statusValue = String(status || "").trim();
  if (statusValue && statusValue !== "all") {
    where.push("gfc.status = ?");
    values.push(statusValue);
  }
  const [rows] = await getPool().execute(
    `SELECT gfc.*, g.prompt, g.published_at, g.moderation_status, u.name AS user_name, u.email AS user_email
       FROM gallery_file_checks gfc
       LEFT JOIN generations g ON g.id = gfc.generation_id
       LEFT JOIN users u ON u.id = g.user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY FIELD(gfc.status, 'broken', 'unknown', 'ok'), gfc.checked_at DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapGalleryFileCheck);
}

async function listAdminAuditLogs({ limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT aal.*, u.name AS actor_name, u.email AS actor_email
       FROM admin_audit_logs aal
       LEFT JOIN users u ON u.id = aal.actor_user_id
      ORDER BY aal.created_at DESC
      LIMIT ${normalizedLimit}`
  );
  return rows.map(mapAdminAuditLog);
}

async function listAnnouncements({ includeArchived = false, status = "", limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const where = [];
  const values = [];
  if (status) {
    where.push("a.status = ?");
    values.push(status);
  } else if (!includeArchived) {
    where.push("a.status <> 'archived'");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await getPool().execute(
    `SELECT a.*, u.name AS created_by_name, u.email AS created_by_email,
            COALESCE(stats.read_count, 0) AS read_count,
            COALESCE(stats.ack_count, 0) AS ack_count
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       LEFT JOIN (
         SELECT announcement_id,
                COUNT(*) AS read_count,
                SUM(CASE WHEN acked_at IS NOT NULL THEN 1 ELSE 0 END) AS ack_count
           FROM announcement_reads
          GROUP BY announcement_id
       ) stats ON stats.announcement_id = a.id
       ${whereSql}
      ORDER BY COALESCE(a.published_at, a.created_at) DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapAnnouncement);
}

async function getAnnouncementById(id, { userId = "" } = {}) {
  const [rows] = await getPool().execute(
    `SELECT a.*, u.name AS created_by_name, u.email AS created_by_email,
            COALESCE(stats.read_count, 0) AS read_count,
            COALESCE(stats.ack_count, 0) AS ack_count,
            ar.read_at AS user_read_at,
            ar.acked_at AS user_acked_at
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       LEFT JOIN (
         SELECT announcement_id,
                COUNT(*) AS read_count,
                SUM(CASE WHEN acked_at IS NOT NULL THEN 1 ELSE 0 END) AS ack_count
           FROM announcement_reads
          GROUP BY announcement_id
       ) stats ON stats.announcement_id = a.id
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
      WHERE a.id = ?
      LIMIT 1`,
    [userId || "", id]
  );
  return mapAnnouncement(rows[0]);
}

function announcementAudienceSql(user = null) {
  if (user?.role === "admin") {
    return "(a.audience IN ('all', 'logged-in', 'admin') OR (a.audience = 'specific-users' AND JSON_CONTAINS(JSON_EXTRACT(COALESCE(a.metadata_json, '{}'), '$.targetUserIds'), JSON_QUOTE(?))))";
  }
  if (user) {
    return "(a.audience IN ('all', 'logged-in') OR (a.audience = 'specific-users' AND JSON_CONTAINS(JSON_EXTRACT(COALESCE(a.metadata_json, '{}'), '$.targetUserIds'), JSON_QUOTE(?))))";
  }
  return "(a.audience = 'all')";
}

async function listPublishedAnnouncements({ user = null, unreadOnly = false, modalOnly = false, limit = 50 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const userId = user?.id || "";
  const where = [
    "a.status = 'published'",
    "(a.starts_at IS NULL OR a.starts_at <= NOW(3))",
    "(a.ends_at IS NULL OR a.ends_at > NOW(3))",
    announcementAudienceSql(user)
  ];
  if (unreadOnly) where.push("(ar.read_at IS NULL OR (a.requires_ack = 1 AND ar.acked_at IS NULL))");
  if (modalOnly) where.push("a.display_mode = 'modal'");
  const values = [userId];
  if (userId) values.push(userId);
  const [rows] = await getPool().execute(
    `SELECT a.*, u.name AS created_by_name, u.email AS created_by_email,
            ar.read_at AS user_read_at,
            ar.acked_at AS user_acked_at
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
      WHERE ${where.join(" AND ")}
      ORDER BY a.is_important DESC, COALESCE(a.published_at, a.created_at) DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapAnnouncement);
}

async function createAnnouncement(input) {
  const now = new Date();
  await getPool().execute(
    `INSERT INTO announcements
      (id, title, body, level, display_mode, audience, status, is_important, requires_ack, starts_at, ends_at, published_at, created_by, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.title,
      input.body,
      input.level,
      input.displayMode,
      input.audience,
      input.status || "draft",
      input.isImportant ? 1 : 0,
      input.requiresAck ? 1 : 0,
      input.startsAt || null,
      input.endsAt || null,
      input.status === "published" ? now : null,
      input.createdBy || null,
      JSON.stringify({
        ...(input.metadata || {}),
        targetUserIds: Array.isArray(input.targetUserIds) ? input.targetUserIds.map(String) : []
      }),
      now,
      now
    ]
  );
  return getAnnouncementById(input.id);
}

async function updateAnnouncement(id, patch) {
  const existing = await getAnnouncementById(id);
  if (!existing) return null;
  const nextStatus = Object.hasOwn(patch, "status") ? patch.status : existing.status;
  const columns = [];
  const values = [];
  const mapping = {
    title: "title",
    body: "body",
    level: "level",
    displayMode: "display_mode",
    audience: "audience",
    status: "status",
    isImportant: "is_important",
    requiresAck: "requires_ack",
    startsAt: "starts_at",
    endsAt: "ends_at"
  };
  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(patch, key)) continue;
    columns.push(`${column} = ?`);
    if (key === "metadata") values.push(JSON.stringify(patch[key] || {}));
    else if (key === "isImportant" || key === "requiresAck") values.push(patch[key] ? 1 : 0);
    else values.push(patch[key] || null);
  }
  if (nextStatus === "published" && !existing.publishedAt) {
    columns.push("published_at = ?");
    values.push(new Date());
  }
  if (Object.hasOwn(patch, "metadata") || Object.hasOwn(patch, "targetUserIds")) {
    const metadataPatch = patch.metadata && typeof patch.metadata === "object" ? patch.metadata : {};
    const targetUserIds = Object.hasOwn(patch, "targetUserIds")
      ? (Array.isArray(patch.targetUserIds) ? patch.targetUserIds.map(String) : [])
      : Array.isArray(metadataPatch.targetUserIds)
        ? metadataPatch.targetUserIds.map(String)
        : Array.isArray(existing.metadata?.targetUserIds)
          ? existing.metadata.targetUserIds.map(String)
          : [];
    columns.push("metadata_json = ?");
    values.push(JSON.stringify({
      ...(existing.metadata || {}),
      ...metadataPatch,
      targetUserIds
    }));
  }
  columns.push("updated_at = ?");
  values.push(new Date(), id);
  await getPool().execute(`UPDATE announcements SET ${columns.join(", ")} WHERE id = ?`, values);
  return getAnnouncementById(id);
}

async function deleteAnnouncement(id) {
  const [result] = await getPool().execute("DELETE FROM announcements WHERE id = ? AND status = 'draft'", [String(id || "")]);
  return result.affectedRows === 1;
}

async function publishAnnouncement(id) {
  await getPool().execute(
    "UPDATE announcements SET status = 'published', published_at = IFNULL(published_at, NOW(3)), updated_at = NOW(3) WHERE id = ?",
    [String(id || "")]
  );
  return getAnnouncementById(id);
}

async function archiveAnnouncement(id) {
  await getPool().execute(
    "UPDATE announcements SET status = 'archived', updated_at = NOW(3) WHERE id = ?",
    [String(id || "")]
  );
  return getAnnouncementById(id);
}

async function markAnnouncementRead(id, userId, { ack = false } = {}) {
  if (!id || !userId) return null;
  const now = new Date();
  await getPool().execute(
    `INSERT INTO announcement_reads (announcement_id, user_id, read_at, acked_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       read_at = IFNULL(read_at, VALUES(read_at)),
       acked_at = CASE
         WHEN VALUES(acked_at) IS NOT NULL THEN VALUES(acked_at)
         ELSE acked_at
       END`,
    [id, userId, now, ack ? now : null]
  );
  return getAnnouncementById(id, { userId });
}

async function countUnreadAnnouncements(user) {
  if (!user?.id) return 0;
  const where = [
    "a.status = 'published'",
    "(a.starts_at IS NULL OR a.starts_at <= NOW(3))",
    "(a.ends_at IS NULL OR a.ends_at > NOW(3))",
    announcementAudienceSql(user),
    "(ar.read_at IS NULL OR (a.requires_ack = 1 AND ar.acked_at IS NULL))"
  ];
  const [rows] = await getPool().execute(
    `SELECT COUNT(*) AS count
       FROM announcements a
       LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
      WHERE ${where.join(" AND ")}`,
    [user.id, user.id]
  );
  return Number(rows[0]?.count || 0);
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

async function listPublicGenerations(limit = 60, { includeModerated = false, includeBroken = false, currentUserId = "", sort = "recent" } = {}) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 60));
  const moderationWhere = includeModerated ? "" : "AND g.moderation_status IN ('visible', 'restored')";
  const brokenWhere = includeBroken
    ? ""
    : "AND NOT EXISTS (SELECT 1 FROM gallery_file_checks gfc WHERE gfc.generation_id = g.id AND gfc.status = 'broken')";
  const order = sort === "likes"
    ? "ORDER BY g.like_count DESC, COALESCE(g.published_at, g.created_at) DESC"
    : "ORDER BY g.created_at DESC";
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email,
            ${currentUserId ? "CASE WHEN gl.user_id IS NULL THEN 0 ELSE 1 END" : "0"} AS liked_by_current_user
      FROM generations g
      LEFT JOIN users u ON u.id = g.user_id
      ${currentUserId ? "LEFT JOIN generation_likes gl ON gl.generation_id = g.id AND gl.user_id = ?" : ""}
      WHERE g.is_public = 1 AND g.archived = 0 ${moderationWhere} ${brokenWhere}
      ${order} LIMIT ${normalizedLimit}`,
    currentUserId ? [currentUserId] : []
  );
  return rows.map(mapGeneration);
}

async function setGenerationLike(generationId, userId, liked) {
  const id = String(generationId || "").trim();
  if (!id || !userId) return null;
  if (liked) {
    await getPool().execute("INSERT IGNORE INTO generation_likes (generation_id, user_id) VALUES (?, ?)", [id, userId]);
  } else {
    await getPool().execute("DELETE FROM generation_likes WHERE generation_id = ? AND user_id = ?", [id, userId]);
  }
  await getPool().execute(
    "UPDATE generations SET like_count = (SELECT COUNT(*) FROM generation_likes WHERE generation_id = ?) WHERE id = ?",
    [id, id]
  );
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email,
            CASE WHEN gl.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_current_user
       FROM generations g
       LEFT JOIN users u ON u.id = g.user_id
       LEFT JOIN generation_likes gl ON gl.generation_id = g.id AND gl.user_id = ?
      WHERE g.id = ? LIMIT 1`,
    [userId, id]
  );
  return mapGeneration(rows[0]);
}

async function listGenerationLeaderboard({ range = "all", tag = "", type = "", limit = 50, currentUserId = "", includeBroken = false } = {}) {
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const values = [];
  const where = ["g.is_public = 1", "g.archived = 0", "g.moderation_status IN ('visible', 'restored')"];
  if (!includeBroken) {
    where.push("NOT EXISTS (SELECT 1 FROM gallery_file_checks gfc WHERE gfc.generation_id = g.id AND gfc.status = 'broken')");
  }
  const rangeDays = { day: 1, week: 7, month: 30 }[range] || 0;
  const periodLikeJoin = rangeDays
    ? `INNER JOIN (
         SELECT generation_id, COUNT(*) AS period_like_count, MAX(created_at) AS latest_like_at
           FROM generation_likes
          WHERE created_at >= DATE_SUB(NOW(3), INTERVAL ${rangeDays} DAY)
          GROUP BY generation_id
       ) period_likes ON period_likes.generation_id = g.id`
    : "";
  const leaderboardLikeExpr = rangeDays ? "period_likes.period_like_count" : "g.like_count";
  const leaderboardOrder = rangeDays
    ? "ORDER BY period_likes.period_like_count DESC, period_likes.latest_like_at DESC, COALESCE(g.published_at, g.created_at) DESC"
    : "ORDER BY g.like_count DESC, COALESCE(g.published_at, g.created_at) DESC";
  const tagValue = String(tag || "").trim();
  if (tagValue) {
    where.push("g.public_tags_json LIKE ?");
    values.push(`%${tagValue.replace(/[\\%_]/g, "\\$&")}%`);
  }
  const typeValue = String(type || "").trim();
  if (typeValue === "image-to-image") where.push("(g.source_filename IS NOT NULL OR g.source_image_id IS NOT NULL)");
  else if (typeValue === "text-to-image") where.push("(g.source_filename IS NULL AND g.source_image_id IS NULL)");
  const likedExpr = currentUserId ? "CASE WHEN gl.user_id IS NULL THEN 0 ELSE 1 END" : "0";
  const joinLike = currentUserId ? "LEFT JOIN generation_likes gl ON gl.generation_id = g.id AND gl.user_id = ?" : "";
  if (currentUserId) values.unshift(currentUserId);
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email,
            ${leaderboardLikeExpr} AS leaderboard_like_count,
            ${likedExpr} AS liked_by_current_user
       FROM generations g
       ${periodLikeJoin}
       LEFT JOIN users u ON u.id = g.user_id
       ${joinLike}
      WHERE ${where.join(" AND ")}
      ${leaderboardOrder}
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapGeneration);
}

async function listPromptImageLeaderboard({ range = "all", limit = 50, currentUserId = "", includeHidden = false } = {}) {
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const values = [];
  const where = ["(p.preview <> '' OR p.image <> '')"];
  if (!includeHidden) where.push("p.status = 'active'");
  const rangeDays = { day: 1, week: 7, month: 30 }[range] || 0;
  const periodLikeJoin = rangeDays
    ? `INNER JOIN (
         SELECT prompt_id, COUNT(*) AS period_like_count, MAX(created_at) AS latest_like_at
           FROM prompt_likes
          WHERE created_at >= DATE_SUB(NOW(3), INTERVAL ${rangeDays} DAY)
          GROUP BY prompt_id
       ) period_likes ON period_likes.prompt_id = p.id`
    : "";
  const leaderboardLikeExpr = rangeDays ? "period_likes.period_like_count" : "p.like_count";
  const leaderboardOrder = rangeDays
    ? "ORDER BY period_likes.period_like_count DESC, period_likes.latest_like_at DESC, p.created_at DESC, p.id DESC"
    : "ORDER BY p.like_count DESC, p.use_count DESC, p.created_at DESC, p.id DESC";
  const likedExpr = currentUserId ? "CASE WHEN pl.user_id IS NULL THEN 0 ELSE 1 END" : "0";
  const joinLike = currentUserId ? "LEFT JOIN prompt_likes pl ON pl.prompt_id = p.id AND pl.user_id = ?" : "";
  if (currentUserId) values.push(currentUserId);
  const [rows] = await getPool().execute(
    `SELECT p.*, ${leaderboardLikeExpr} AS leaderboard_like_count,
            ${likedExpr} AS liked_by_current_user
       FROM prompts p
       ${periodLikeJoin}
       ${joinLike}
      WHERE ${where.join(" AND ")}
      ${leaderboardOrder}
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map((row) => mapPrompt({ ...row, like_count: row.leaderboard_like_count ?? row.like_count }));
}

async function listGenerationLikeAnomalies({ limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT gl.user_id, u.name AS user_name, u.email AS user_email,
            COUNT(*) AS like_count,
            MIN(gl.created_at) AS first_like_at,
            MAX(gl.created_at) AS last_like_at
       FROM generation_likes gl
       LEFT JOIN users u ON u.id = gl.user_id
      WHERE gl.created_at >= DATE_SUB(NOW(3), INTERVAL 1 DAY)
      GROUP BY gl.user_id, u.name, u.email
     HAVING COUNT(*) >= 20
      ORDER BY like_count DESC, last_like_at DESC
      LIMIT ${normalizedLimit}`
  );
  return rows.map((row) => ({
    userId: row.user_id,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    likeCount: Number(row.like_count || 0),
    firstLikeAt: toIso(row.first_like_at),
    lastLikeAt: toIso(row.last_like_at)
  }));
}

async function listReportedGenerations(limit = 100) {
  return listGalleryModeration({ limit });
}

async function getGenerationById(id) {
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email
       FROM generations g
       LEFT JOIN users u ON u.id = g.user_id
      WHERE g.id = ? LIMIT 1`,
    [id]
  );
  return mapGeneration(rows[0]);
}

async function getCanvasProjectForGeneration(generationId) {
  const [rows] = await getPool().execute(
    `SELECT c.id AS canvas_project_id,
            c.user_id AS canvas_project_user_id,
            c.title AS canvas_project_title,
            c.visibility AS canvas_project_visibility,
            l.output_node_id AS canvas_output_node_id,
            l.config_node_id AS canvas_config_node_id,
            l.created_at AS canvas_link_created_at
       FROM canvas_generation_links l
       INNER JOIN canvas_projects c ON c.id = l.canvas_id AND c.status = 'active'
      WHERE l.generation_id = ?
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT 1`,
    [String(generationId || "")]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.canvas_project_id,
    userId: row.canvas_project_user_id || "",
    title: row.canvas_project_title || "Untitled canvas",
    visibility: row.canvas_project_visibility || "private",
    outputNodeId: row.canvas_output_node_id || "",
    configNodeId: row.canvas_config_node_id || ""
  };
}

async function getPublicGenerationForCanvas(canvasId) {
  const [rows] = await getPool().execute(
    `SELECT g.*, u.name AS user_name, u.email AS user_email
       FROM canvas_generation_links l
       INNER JOIN generations g ON g.id = l.generation_id
       LEFT JOIN users u ON u.id = g.user_id
      WHERE l.canvas_id = ?
        AND g.is_public = 1
        AND g.archived = 0
        AND g.moderation_status IN ('visible', 'restored')
      ORDER BY COALESCE(g.published_at, g.created_at) DESC, l.created_at DESC
      LIMIT 1`,
    [String(canvasId || "")]
  );
  return mapGeneration(rows[0]);
}

async function updateGenerationPublic(id, patch) {
  const existing = await getGenerationById(id);
  const columns = [];
  const values = [];
  let shouldCancelPublicReward = false;
  const setPublicRewardStatus = (status) => {
    const index = columns.findIndex((column) => column === "public_reward_status = ?");
    if (index >= 0) {
      values[index] = status;
      return;
    }
    columns.push("public_reward_status = ?");
    values.push(status);
  };
  if (Object.hasOwn(patch, "isPublic")) {
    columns.push("is_public = ?");
    values.push(patch.isPublic ? 1 : 0);
    if (patch.isPublic && !existing?.isPublic && !existing?.publishedAt) {
      columns.push("published_at = ?");
      values.push(new Date());
    }
    if (!patch.isPublic && existing?.publicRewardStatus === "pending" && !Object.hasOwn(patch, "publicRewardStatus")) {
      setPublicRewardStatus("cancelled");
      shouldCancelPublicReward = true;
    }
  }
  if (Object.hasOwn(patch, "title")) {
    columns.push("title = ?");
    values.push(String(patch.title || "").trim().slice(0, 160));
  }
  if (Object.hasOwn(patch, "sourceFilename")) {
    columns.push("source_filename = ?");
    values.push(patch.sourceFilename || null);
  }
  if (Object.hasOwn(patch, "sourceImageId")) {
    columns.push("source_image_id = ?");
    values.push(patch.sourceImageId || null);
  }
  if (Object.hasOwn(patch, "sourcePrompt")) {
    columns.push("source_prompt = ?");
    values.push(patch.sourcePrompt || null);
  }
  if (Object.hasOwn(patch, "originGalleryId")) {
    columns.push("origin_gallery_id = ?");
    values.push(patch.originGalleryId || null);
  }
  if (Object.hasOwn(patch, "publishOriginal")) {
    columns.push("publish_original = ?");
    values.push(patch.publishOriginal ? 1 : 0);
  }
  if (Object.hasOwn(patch, "archived")) {
    columns.push("archived = ?");
    values.push(patch.archived ? 1 : 0);
    if (patch.archived && existing?.publicRewardStatus === "pending" && !Object.hasOwn(patch, "publicRewardStatus")) {
      setPublicRewardStatus("cancelled");
      shouldCancelPublicReward = true;
    }
  }
  if (Object.hasOwn(patch, "moderationStatus")) {
    columns.push("moderation_status = ?");
    const moderationStatus = ["visible", "reported", "reviewing", "restored", "hidden", "resolved"].includes(patch.moderationStatus) ? patch.moderationStatus : "visible";
    values.push(moderationStatus);
    columns.push("moderation_checked_at = ?");
    values.push(new Date());
    if (moderationStatus === "hidden" && existing?.publicRewardStatus === "pending" && !Object.hasOwn(patch, "publicRewardStatus")) {
      setPublicRewardStatus("cancelled");
      shouldCancelPublicReward = true;
    }
  }
  if (Object.hasOwn(patch, "moderationReason")) {
    columns.push("moderation_reason = ?");
    values.push(String(patch.moderationReason || "").slice(0, 255));
  }
  if (Object.hasOwn(patch, "reportCount")) {
    columns.push("report_count = ?");
    values.push(Math.max(0, Number(patch.reportCount) || 0));
  }
  if (Object.hasOwn(patch, "publicRewardStatus")) {
    setPublicRewardStatus(patch.publicRewardStatus);
    if (patch.publicRewardStatus === "pending" && !existing?.publishedAt) {
      columns.push("published_at = ?");
      values.push(new Date());
    }
  }
  if (Object.hasOwn(patch, "publicRewardAmount")) {
    columns.push("public_reward_amount = ?");
    values.push(Math.max(0, Number(patch.publicRewardAmount) || 0));
  }
  if (Object.hasOwn(patch, "withdrawalStatus")) {
    columns.push("withdrawal_status = ?");
    values.push(patch.withdrawalStatus);
  }
  if (Object.hasOwn(patch, "withdrawalRequestedAt")) {
    columns.push("withdrawal_requested_at = ?");
    values.push(patch.withdrawalRequestedAt || null);
  }
  if (Object.hasOwn(patch, "withdrawalReason")) {
    columns.push("withdrawal_reason = ?");
    values.push(String(patch.withdrawalReason || "").slice(0, 255));
  }
  if (Object.hasOwn(patch, "conversation")) {
    columns.push("conversation_json = ?");
    values.push(patch.conversation ? JSON.stringify(patch.conversation) : null);
  }
  if (Object.hasOwn(patch, "publicTags")) {
    columns.push("public_tags_json = ?");
    values.push(patch.publicTags ? JSON.stringify(patch.publicTags) : null);
  }
  if (!columns.length) return getGenerationById(id);
  values.push(id);
  await getPool().execute(`UPDATE generations SET ${columns.join(", ")} WHERE id = ?`, values);
  if (shouldCancelPublicReward) {
    await cancelFirstPublicReward(id);
  }
  return getGenerationById(id);
}

async function countTodayGenerations() {
  const [rows] = await getPool().execute(
    "SELECT COUNT(*) AS count FROM generations WHERE created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)"
  );
  return Number(rows[0]?.count || 0);
}

function normalizeCanvasProjectInput(input = {}, existing = null) {
  const data = Object.hasOwn(input, "dataJson")
    ? input.dataJson
    : Object.hasOwn(input, "data")
      ? input.data
      : existing?.dataJson || {};
  const safeData = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const nodeCountInput = Object.hasOwn(input, "nodeCount") ? Number(input.nodeCount) : Number.NaN;
  const edgeCountInput = Object.hasOwn(input, "edgeCount") ? Number(input.edgeCount) : Number.NaN;
  const nodeCount = Number.isFinite(nodeCountInput)
    ? nodeCountInput
    : Array.isArray(safeData.nodes)
      ? safeData.nodes.length
      : Number(existing?.nodeCount || 0);
  const edgeCount = Number.isFinite(edgeCountInput)
    ? edgeCountInput
    : Array.isArray(safeData.edges)
      ? safeData.edges.length
      : Number(existing?.edgeCount || 0);
  return {
    title: String(input.title ?? existing?.title ?? "Untitled canvas").trim().slice(0, 160) || "Untitled canvas",
    description: String(input.description ?? existing?.description ?? "").trim().slice(0, 1000),
    coverUrl: String(input.coverUrl ?? input.cover ?? existing?.coverUrl ?? "").trim().slice(0, 500),
    visibility: ["private", "public", "unlisted"].includes(input.visibility) ? input.visibility : existing?.visibility || "private",
    isTemplate: Object.hasOwn(input, "isTemplate")
      ? Boolean(input.isTemplate)
      : Boolean(existing?.isTemplate),
    dataJson: safeData,
    nodeCount: Math.max(0, Math.min(10000, Math.floor(nodeCount || 0))),
    edgeCount: Math.max(0, Math.min(10000, Math.floor(edgeCount || 0)))
  };
}

async function listCanvasProjectsForUser(user, { limit = 100, scope = "mine" } = {}) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const params = [];
  const where = ["c.status = 'active'"];
  if (scope === "templates") {
    where.push("c.visibility = 'public'");
    where.push("c.is_template = 1");
  } else if (scope === "public" && user?.role === "admin") {
    where.push("c.visibility = 'public'");
  } else {
    where.push("c.user_id = ?");
    params.push(user.id);
  }
  const [rows] = await getPool().execute(
    `SELECT c.*, u.name AS user_name, u.email AS user_email
       FROM canvas_projects c
       LEFT JOIN users u ON u.id = c.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY c.updated_at DESC, c.created_at DESC
      LIMIT ${normalizedLimit}`,
    params
  );
  return rows.map(mapCanvasProject);
}

async function getCanvasProjectById(id) {
  const [rows] = await getPool().execute(
    `SELECT c.*, u.name AS user_name, u.email AS user_email
       FROM canvas_projects c
       LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ? AND c.status = 'active'
      LIMIT 1`,
    [String(id || "")]
  );
  return mapCanvasProject(rows[0]);
}

async function createCanvasProject(input = {}) {
  const values = normalizeCanvasProjectInput(input);
  const now = new Date();
  await getPool().execute(
    `INSERT INTO canvas_projects
        (id, user_id, title, description, cover_url, visibility, is_template, data_json, node_count, edge_count, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      input.id,
      input.userId,
      values.title,
      values.description,
      values.coverUrl,
      values.visibility,
      values.isTemplate ? 1 : 0,
      JSON.stringify(values.dataJson),
      values.nodeCount,
      values.edgeCount,
      now,
      now
    ]
  );
  return getCanvasProjectById(input.id);
}

async function updateCanvasProject(id, patch = {}) {
  const existing = await getCanvasProjectById(id);
  if (!existing) return null;
  const values = normalizeCanvasProjectInput(patch, existing);
  const columns = [];
  const params = [];
  if (Object.hasOwn(patch, "title")) {
    columns.push("title = ?");
    params.push(values.title);
  }
  if (Object.hasOwn(patch, "description")) {
    columns.push("description = ?");
    params.push(values.description);
  }
  if (Object.hasOwn(patch, "coverUrl") || Object.hasOwn(patch, "cover")) {
    columns.push("cover_url = ?");
    params.push(values.coverUrl);
  }
  if (Object.hasOwn(patch, "visibility")) {
    columns.push("visibility = ?");
    params.push(values.visibility);
  }
  if (Object.hasOwn(patch, "isTemplate")) {
    columns.push("is_template = ?");
    params.push(values.isTemplate ? 1 : 0);
  }
  if (Object.hasOwn(patch, "dataJson") || Object.hasOwn(patch, "data")) {
    columns.push("data_json = ?");
    params.push(JSON.stringify(values.dataJson));
    columns.push("node_count = ?");
    params.push(values.nodeCount);
    columns.push("edge_count = ?");
    params.push(values.edgeCount);
  }
  if (!Object.hasOwn(patch, "dataJson") && !Object.hasOwn(patch, "data") && Object.hasOwn(patch, "nodeCount")) {
    columns.push("node_count = ?");
    params.push(values.nodeCount);
  }
  if (!Object.hasOwn(patch, "dataJson") && !Object.hasOwn(patch, "data") && Object.hasOwn(patch, "edgeCount")) {
    columns.push("edge_count = ?");
    params.push(values.edgeCount);
  }
  if (!columns.length) return existing;
  columns.push("updated_at = ?");
  params.push(new Date(), String(id || ""));
  await getPool().execute(`UPDATE canvas_projects SET ${columns.join(", ")} WHERE id = ?`, params);
  return getCanvasProjectById(id);
}

async function deleteCanvasProject(id) {
  const existing = await getCanvasProjectById(id);
  if (!existing) return null;
  await getPool().execute(
    "UPDATE canvas_projects SET status = 'deleted', updated_at = ? WHERE id = ?",
    [new Date(), String(id || "")]
  );
  return { ...existing, status: "deleted" };
}

async function createCanvasGenerationLinks({ canvasId, generationIds = [], outputNodeId = "", configNodeId = "" } = {}) {
  const ids = Array.from(new Set((generationIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (!canvasId || !ids.length) return [];
  const now = new Date();
  for (const generationId of ids) {
    await getPool().execute(
      `INSERT IGNORE INTO canvas_generation_links
        (canvas_id, generation_id, output_node_id, config_node_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(canvasId || ""),
        generationId,
        String(outputNodeId || "").slice(0, 160),
        String(configNodeId || "").slice(0, 160),
        now
      ]
    );
  }
  return ids;
}

function mapPrompt(row) {
  if (!row) return null;
  let tags = [];
  if (row.tags_json) {
    try {
      const parsed = JSON.parse(row.tags_json);
      if (Array.isArray(parsed)) tags = parsed;
    } catch {
      tags = [];
    }
  }
  return {
    id: Number(row.id),
    title: row.title || "",
    prompt: row.prompt || "",
    image: row.image || "",
    coverUrl: row.preview || row.image || "",
    preview: row.preview || "",
    tags,
    category: row.category || "general",
    visibility: row.visibility || "public",
    author: row.author || "",
    source: row.source || "",
    sourceUrl: row.source_url || "",
    githubUrl: row.github_url || "",
    remoteId: row.remote_id || "",
    sourceRepo: row.source_repo || "",
    sourceCategory: row.source_category || "",
    promptType: row.prompt_type || "text-to-image",
    language: row.language || "zh",
    modelHint: row.model_hint || "",
    syncedAt: toIso(row.synced_at),
    status: row.status || "active",
    sortOrder: Number(row.sort_order || 0),
    normalizedHash: row.normalized_hash || "",
    simhash: row.simhash || "",
    likeCount: Number(row.like_count || 0),
    useCount: Number(row.use_count || 0),
    likedByCurrentUser: Boolean(row.liked_by_current_user || 0),
    heatScore: Number(row.heat_score || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

const agentSessionStore = createAgentSessionStore({ getPool, toIso, safeJsonSummary });
const generationStore = createGenerationStore({ getPool, toIso, safeJsonSummary, normalizeTraceLevel });
const promptStore = createPromptStore({ getPool, toIso });
const tagStore = createTagStore({ getPool, toIso, mapPromptCategory });
const userStore = createUserStore({ getPool, mapUser });

module.exports = {
  initializeDatabase,
  getSettings,
  updateSettings,
  countUsers,
  countAdmins,
  getUserByEmail,
  getUserById,
  createUser,
  listUsers,
  updateUser,
  updateUserPassword,
  listProviderConfigs,
  getProviderConfigById,
  getDefaultProviderConfig,
  createProviderConfig,
  updateProviderConfig,
  deleteProviderConfig,
  setDefaultProviderConfig,
  updateProviderHealth,
  setUserCredits,
  reserveCredits,
  addCredits,
  adjustCredits,
  listCreditLedger,
  listRewardLedger,
  hasFirstPublicReward,
  claimFirstPublicReward,
  awardMaturePublicRewards,
  listWithdrawalRequests,
  createGenerationReport,
  getGenerationReportById,
  listGenerationReports,
  markGenerationReportsHandled,
  listGalleryModeration,
  listGalleryFileCheckTargets,
  upsertGalleryFileCheck,
  listGalleryFileChecks,
  writeAdminAuditLog,
  listAdminAuditLogs,
  listAnnouncements,
  getAnnouncementById,
  listPublishedAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  markAnnouncementRead,
  countUnreadAnnouncements,
  hasCheckedInToday,
  checkInToday,
  reserveDailyFreeGeneration,
  refundDailyFreeGeneration,
  getDailyFreeUsed,
  getUserCredits,
  createSession: userStore.createSession,
  deleteSession: userStore.deleteSession,
  touchSession: userStore.touchSession,
  getSessionUser: userStore.getSessionUser,
  deleteExpiredSessions: userStore.deleteExpiredSessions,
  listAgentSessionsForUser: agentSessionStore.listAgentSessionsForUser,
  getAgentSessionForUser: agentSessionStore.getAgentSessionForUser,
  createAgentSession: agentSessionStore.createAgentSession,
  updateAgentSessionForUser: agentSessionStore.updateAgentSessionForUser,
  deleteAgentSessionForUser: agentSessionStore.deleteAgentSessionForUser,
  createAgentMessageForUser: agentSessionStore.createAgentMessageForUser,
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
  listGenerationsForUserId,
  listPublicGenerations,
  setGenerationLike,
  listGenerationLeaderboard,
  listPromptImageLeaderboard,
  listGenerationLikeAnomalies,
  listReportedGenerations,
  getGenerationById,
  getCanvasProjectForGeneration,
  getPublicGenerationForCanvas,
  updateGenerationPublic,
  countTodayGenerations,
  listCanvasProjectsForUser,
  getCanvasProjectById,
  createCanvasProject,
  updateCanvasProject,
  deleteCanvasProject,
  createCanvasGenerationLinks,
  listPrompts: promptStore.listPrompts,
  getPromptById: promptStore.getPromptById,
  setPromptLike: promptStore.setPromptLike,
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
  // gallery_tags
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
};
