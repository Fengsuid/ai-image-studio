let mysql;
try {
  mysql = require("mysql2/promise");
} catch (error) {
  throw new Error("Missing dependency mysql2. Run: npm.cmd install");
}
const crypto = require("crypto");

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
    updatedAt: toIso(row.updated_at)
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

function mapGenerationRequest(row) {
  if (!row) return null;
  let generationIds = [];
  if (row.generation_ids) {
    try {
      generationIds = JSON.parse(row.generation_ids);
    } catch {
      generationIds = [];
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    prompt: row.prompt,
    ipAddress: row.ip_address || "",
    userAgent: row.user_agent || "",
    isPublic: Boolean(row.is_public ?? 0),
    status: row.status,
    errorMessage: row.error_message || "",
    firstGenerationId: row.first_generation_id || "",
    generationIds,
    model: row.model || "",
    filename: row.filename || "",
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
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
  const [growthConfigColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'growth_config_json'");
  if (!growthConfigColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN growth_config_json LONGTEXT NULL AFTER max_images_per_request");
  }
  const [contactAdminEmailColumns] = await db.execute("SHOW COLUMNS FROM app_settings LIKE 'contact_admin_email'");
  if (!contactAdminEmailColumns.length) {
    await db.query("ALTER TABLE app_settings ADD COLUMN contact_admin_email VARCHAR(255) NOT NULL DEFAULT 'support@example.com' AFTER max_images_per_request");
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

  await db.execute(
    `INSERT IGNORE INTO app_settings
      (id, openai_api_key, api_base_url, model, default_credits, generation_credit_cost, allow_registration, require_approval, max_images_per_request, contact_admin_email)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "",
      process.env.AI_API_BASE_URL || process.env.OPENAI_BASE_URL || "",
      process.env.IMAGE_MODEL || defaultModel,
      intEnv("DEFAULT_CREDITS", 10),
      intEnv("GENERATION_CREDIT_COST", 1),
      boolEnv("ALLOW_REGISTRATION", true) ? 1 : 0,
      boolEnv("REQUIRE_APPROVAL", false) ? 1 : 0,
      intEnv("MAX_IMAGES_PER_REQUEST", 1),
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
  await seedPromptCategories();
  await seedPromptSources();
  await deleteExpiredSessions();
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

async function listUsers() {
  const [rows] = await getPool().execute("SELECT * FROM users ORDER BY created_at DESC");
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
    status: ["active", "disabled"].includes(input.status) ? input.status : existing.status || "active",
    sortOrder: Number.parseInt(input.sortOrder, 10) || Number(existing.sortOrder || 0)
  };
}

async function createProviderConfig(input) {
  const now = new Date();
  const payload = providerDbPayload(input);
  await getPool().execute(
    `INSERT INTO provider_configs
      (id, name, provider_type, base_url, api_key_encrypted, api_key_mask, default_model, endpoint_images, endpoint_responses, endpoint_edits, capabilities_json, routing_json, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
           endpoint_images = ?, endpoint_responses = ?, endpoint_edits = ?, capabilities_json = ?, routing_json = ?,
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
    "SELECT id FROM generations WHERE user_id = ? AND public_reward_status IN ('pending', 'awarded') LIMIT 1",
    [userId]
  );
  return pendingRows.length > 0;
}

async function awardMaturePublicRewards({ minAgeHours = 12 } = {}) {
  const [rows] = await getPool().execute(
    `SELECT * FROM generations
      WHERE is_public = 1
        AND archived = 0
        AND public_reward_status = 'pending'
        AND published_at IS NOT NULL
        AND published_at <= DATE_SUB(NOW(3), INTERVAL ? HOUR)
        AND withdrawal_status IN ('none', 'rejected')
      ORDER BY published_at ASC
      LIMIT 100`,
    [Math.max(1, Number(minAgeHours) || 12)]
  );
  for (const row of rows) {
    const generation = mapGeneration(row);
    const amount = Number(generation.publicRewardAmount || 0);
    if (amount > 0) {
      await addCredits(generation.userId, amount, {
        source: "first_public_reward",
        referenceId: generation.id,
        note: "First public work reward"
      });
      await insertRewardLedger({
        userId: generation.userId,
        rewardType: "first_public",
        status: "awarded",
        amount,
        referenceId: generation.id,
        note: "Public for 12 hours",
        awardedAt: new Date()
      });
    }
    await updateGenerationPublic(generation.id, { publicRewardStatus: "awarded" });
  }
  return rows.length;
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
    return getGenerationReportById(existing[0].id);
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
  return getGenerationReportById(result.insertId);
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

async function createSession(tokenHash, userId, expiresAt) {
  await getPool().execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [tokenHash, userId, expiresAt, new Date()]
  );
}

async function deleteSession(tokenHash) {
  if (!tokenHash) return;
  await getPool().execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

async function touchSession(tokenHash, expiresAt) {
  await getPool().execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", [expiresAt, tokenHash]);
}

async function getSessionUser(tokenHash) {
  const [rows] = await getPool().execute(
    `SELECT u.*
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
      LIMIT 1`,
    [tokenHash, new Date()]
  );
  return mapUser(rows[0]);
}

async function deleteExpiredSessions() {
  await getPool().execute("DELETE FROM sessions WHERE expires_at <= ?", [new Date()]);
}

async function insertGenerations(generations) {
  if (!generations.length) return;
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const generation of generations) {
      await connection.execute(
        `INSERT INTO generations
          (id, user_id, prompt, model, size, quality, background, output_format, filename, is_public, source_filename, source_image_id, source_prompt, origin_gallery_id, publish_original, conversation_json, public_tags_json, revised_prompt, usage_json, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generation.id,
          generation.userId,
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

async function insertGenerationRequest(request) {
  const createdAt = new Date();
  await getPool().execute(
    `INSERT INTO generation_requests
      (id, user_id, prompt, ip_address, user_agent, is_public, status, error_message, first_generation_id, generation_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.id,
      request.userId,
      request.prompt,
      request.ipAddress || "",
      request.userAgent || "",
      request.isPublic ? 1 : 0,
      request.status || "pending",
      request.errorMessage || null,
      request.firstGenerationId || null,
      request.generationIds ? JSON.stringify(request.generationIds) : null,
      createdAt,
      createdAt
    ]
  );
}

async function updateGenerationRequest(id, patch) {
  // 保护：success/succeeded 是终态，不允许被 cancelled 覆盖（避免 client 在 server 已经 commit 后 abort）。
  if (patch?.status === "cancelled") {
    const [existing] = await getPool().execute(
      "SELECT status FROM generation_requests WHERE id = ? LIMIT 1",
      [id]
    );
    const currentStatus = existing?.[0]?.status;
    if (currentStatus === "success" || currentStatus === "succeeded") {
      return;
    }
  }
  const columns = [];
  const values = [];
  const mapping = {
    status: "status",
    errorMessage: "error_message",
    firstGenerationId: "first_generation_id",
    durationMs: "duration_ms"
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (Object.hasOwn(patch, key)) {
      columns.push(`${column} = ?`);
      values.push(patch[key]);
    }
  }
  if (Object.hasOwn(patch, "generationIds")) {
    columns.push("generation_ids = ?");
    values.push(JSON.stringify(patch.generationIds || []));
  }
  if (!columns.length) return;
  columns.push("updated_at = ?");
  values.push(new Date(), id);
  await getPool().execute(`UPDATE generation_requests SET ${columns.join(", ")} WHERE id = ?`, values);
}

async function listGenerationRequests(limit = 100) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const [rows] = await getPool().execute(
    `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename
       FROM generation_requests gr
       LEFT JOIN users u ON u.id = gr.user_id
       LEFT JOIN generations g ON g.id = gr.first_generation_id
      ORDER BY gr.created_at DESC
      LIMIT ${normalizedLimit}`
  );
  return rows.map(mapGenerationRequest);
}

async function getGenerationRequestById(id) {
  const [rows] = await getPool().execute(
    `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename
       FROM generation_requests gr
       LEFT JOIN users u ON u.id = gr.user_id
       LEFT JOIN generations g ON g.id = gr.first_generation_id
      WHERE gr.id = ? LIMIT 1`,
    [id]
  );
  return mapGenerationRequest(rows[0]);
}

async function listActiveGenerationRequestsForUser(userId, limit = 20) {
  const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const [rows] = await getPool().execute(
    `SELECT gr.*, u.name AS user_name, u.email AS user_email, g.model, g.filename
       FROM generation_requests gr
       LEFT JOIN users u ON u.id = gr.user_id
       LEFT JOIN generations g ON g.id = gr.first_generation_id
      WHERE gr.user_id = ? AND gr.status IN ('pending', 'running')
      ORDER BY gr.created_at ASC
      LIMIT ${normalizedLimit}`,
    [userId]
  );
  return rows.map(mapGenerationRequest);
}

async function listGenerationsForUser(user, limit = 60, { includeArchived = false } = {}) {
  const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 60));
  const archivedWhere = includeArchived ? "" : "g.archived = 0";
  const sql =
    user.role === "admin"
      ? `SELECT g.*, u.name AS user_name, u.email AS user_email
           FROM generations g
           LEFT JOIN users u ON u.id = g.user_id
          ${archivedWhere ? `WHERE ${archivedWhere}` : ""}
          ORDER BY g.created_at DESC LIMIT ${normalizedLimit}`
      : `SELECT g.*, u.name AS user_name, u.email AS user_email
           FROM generations g
           LEFT JOIN users u ON u.id = g.user_id
          WHERE g.user_id = ?${archivedWhere ? ` AND ${archivedWhere}` : ""}
          ORDER BY g.created_at DESC LIMIT ${normalizedLimit}`;
  const params = user.role === "admin" ? [] : [user.id];
  const [rows] = await getPool().execute(sql, params);
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
  if (Object.hasOwn(patch, "isPublic")) {
    columns.push("is_public = ?");
    values.push(patch.isPublic ? 1 : 0);
    if (patch.isPublic && !existing?.isPublic && !existing?.publishedAt) {
      columns.push("published_at = ?");
      values.push(new Date());
    }
    if (!patch.isPublic && existing?.publicRewardStatus === "pending") {
      columns.push("public_reward_status = ?");
      values.push("cancelled");
    }
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
    if (patch.archived && existing?.publicRewardStatus === "pending") {
      columns.push("public_reward_status = ?");
      values.push("cancelled");
    }
  }
  if (Object.hasOwn(patch, "moderationStatus")) {
    columns.push("moderation_status = ?");
    values.push(["visible", "reported", "reviewing", "restored", "hidden", "resolved"].includes(patch.moderationStatus) ? patch.moderationStatus : "visible");
    columns.push("moderation_checked_at = ?");
    values.push(new Date());
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
    columns.push("public_reward_status = ?");
    values.push(patch.publicRewardStatus);
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

function mapPromptSource(row) {
  if (!row) return null;
  let config = {};
  if (row.config_json) {
    try {
      const parsed = JSON.parse(row.config_json);
      if (parsed && typeof parsed === "object") config = parsed;
    } catch {
      config = {};
    }
  }
  return {
    id: row.id || "",
    name: row.name || "",
    sourceType: row.source_type || "github",
    repoUrl: row.repo_url || "",
    branch: row.branch || "main",
    parser: row.parser || "",
    config,
    status: row.status || "active",
    lastSyncedAt: toIso(row.last_synced_at),
    lastStatus: row.last_status || "never",
    lastSuccessCount: Number(row.last_success_count || 0),
    lastFailureCount: Number(row.last_failure_count || 0),
    lastError: row.last_error || "",
    sortOrder: Number(row.sort_order || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapPromptSyncRun(row) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    sourceId: row.source_id || "",
    sourceName: row.source_name || "",
    status: row.status || "running",
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
    successCount: Number(row.success_count || 0),
    failureCount: Number(row.failure_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    errorLog: row.error_log || "",
    createdByUserId: row.created_by_user_id || "",
    createdByName: row.created_by_name || "",
    createdByEmail: row.created_by_email || ""
  };
}

function mapPromptDuplicateCandidate(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    promptId: Number(row.prompt_id),
    duplicatePromptId: Number(row.duplicate_prompt_id),
    method: row.method || "",
    score: Number(row.score || 0),
    embeddingRecall: row.method === "embedding" ? "matched" : "not_configured",
    llmReview: row.ai_decision || row.ai_status || "manual_required",
    aiReview: {
      status: row.ai_status || "not_reviewed",
      decision: row.ai_decision || "",
      confidence: Number(row.ai_confidence || 0),
      reason: row.ai_reason || "",
      recommendedAction: row.ai_recommended_action || "",
      model: row.ai_model || "",
      reviewedAt: toIso(row.ai_reviewed_at)
    },
    status: row.status || "pending",
    reviewNote: row.review_note || "",
    reviewerUserId: row.reviewer_user_id || "",
    reviewerName: row.reviewer_name || "",
    reviewerEmail: row.reviewer_email || "",
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    prompt: {
      id: Number(row.prompt_id),
      title: row.prompt_title || "",
      prompt: row.prompt_text || "",
      status: row.prompt_status || "",
      normalizedHash: row.prompt_normalized_hash || "",
      simhash: row.prompt_simhash || ""
    },
    duplicate: {
      id: Number(row.duplicate_prompt_id),
      title: row.duplicate_title || "",
      prompt: row.duplicate_text || "",
      status: row.duplicate_status || "",
      normalizedHash: row.duplicate_normalized_hash || "",
      simhash: row.duplicate_simhash || ""
    }
  };
}

function mapPromptAuditRecord(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    generationId: row.generation_id || "",
    userId: row.user_id || "",
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    prompt: row.prompt_text || "",
    promptHash: row.prompt_hash || "",
    requestedMode: row.requested_mode || "text-to-image",
    resultLevel: row.result_level || "low",
    resultAction: row.result_action || "allow",
    requiredMode: row.required_mode || "",
    status: row.status || "allowed",
    score: Number(row.score || 0),
    method: row.method || "",
    matchedPromptId: row.matched_prompt_id === null || row.matched_prompt_id === undefined ? null : Number(row.matched_prompt_id),
    matchedPromptTitle: row.matched_prompt_title || "",
    matchedPromptText: row.matched_prompt_text || "",
    matchedGenerationId: row.matched_generation_id || "",
    matchedGenerationPrompt: row.matched_generation_prompt || "",
    overrideAction: row.override_action || "",
    overrideNote: row.override_note || "",
    reviewerUserId: row.reviewer_user_id || "",
    reviewerName: row.reviewer_name || "",
    reviewerEmail: row.reviewer_email || "",
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function normalizePromptForQuality(prompt) {
  return String(prompt || "")
    .toLowerCase()
    .replace(/[\u3000\r\n\t]+/g, " ")
    .replace(/[，。、“”‘’！：；（）【】《》]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function promptQualityFingerprint(prompt) {
  const normalized = normalizePromptForQuality(prompt);
  const normalizedHash = normalized
    ? crypto.createHash("sha256").update(normalized).digest("hex")
    : "";
  const tokens = normalized.match(/[\p{L}\p{N}]{2,}/gu) || (normalized ? [normalized] : []);
  const buckets = Array.from({ length: 64 }, () => 0);
  for (const token of tokens) {
    const digest = crypto.createHash("sha256").update(token).digest();
    for (let bit = 0; bit < 64; bit += 1) {
      const byte = digest[Math.floor(bit / 8)];
      const mask = 1 << (bit % 8);
      buckets[bit] += byte & mask ? 1 : -1;
    }
  }
  let value = 0n;
  for (let bit = 0; bit < 64; bit += 1) {
    if (buckets[bit] >= 0) value |= 1n << BigInt(bit);
  }
  return {
    normalized,
    normalizedHash,
    simhash: normalized ? value.toString(16).padStart(16, "0") : ""
  };
}

function hammingDistanceHex(left, right) {
  if (!left || !right) return 64;
  let a;
  let b;
  try {
    a = BigInt(`0x${left}`);
    b = BigInt(`0x${right}`);
  } catch {
    return 64;
  }
  let value = a ^ b;
  let distance = 0;
  while (value) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

function promptAuditDecisionFromMatch(match) {
  const score = Number(match?.score || 0);
  if (!match) {
    return { resultLevel: "low", resultAction: "allow", requiredMode: "", status: "allowed" };
  }
  if (match.method === "normalized_hash" || score >= 0.9) {
    return {
      resultLevel: "high",
      resultAction: "require_image_to_image",
      requiredMode: "image-to-image",
      status: "blocked"
    };
  }
  if (score >= 0.78) {
    return { resultLevel: "medium", resultAction: "review", requiredMode: "", status: "review" };
  }
  return { resultLevel: "low", resultAction: "allow", requiredMode: "", status: "allowed" };
}

async function findLatestPromptAuditOverride({ generationId = "", promptHash = "" } = {}) {
  if (!generationId || !promptHash) return null;
  const [rows] = await getPool().execute(
    `SELECT par.*, u.name AS user_name, u.email AS user_email,
            mp.title AS matched_prompt_title, mp.prompt AS matched_prompt_text,
            mg.prompt AS matched_generation_prompt,
            ru.name AS reviewer_name, ru.email AS reviewer_email
       FROM prompt_audit_records par
       LEFT JOIN users u ON u.id = par.user_id
       LEFT JOIN prompts mp ON mp.id = par.matched_prompt_id
       LEFT JOIN generations mg ON mg.id = par.matched_generation_id
       LEFT JOIN users ru ON ru.id = par.reviewer_user_id
      WHERE par.generation_id = ?
        AND par.prompt_hash = ?
        AND par.override_action IN ('allow_text_to_image', 'require_image_to_image')
      ORDER BY par.reviewed_at DESC, par.updated_at DESC
      LIMIT 1`,
    [generationId, promptHash]
  );
  return mapPromptAuditRecord(rows[0]);
}

async function findBestPromptAuditMatch({ fingerprint, excludeGenerationId = "" }) {
  if (!fingerprint?.normalizedHash || !fingerprint?.simhash) return null;
  await refreshPromptFingerprints({ limit: 2000 });
  const [promptRows] = await getPool().execute(
    `SELECT id, title, prompt, normalized_hash, simhash
       FROM prompts
      WHERE status = 'active' AND normalized_hash <> '' AND simhash <> ''
      ORDER BY id ASC
      LIMIT 2000`
  );
  const [generationRows] = await getPool().execute(
    `SELECT id, prompt
       FROM generations
      WHERE is_public = 1 AND archived = 0 AND id <> ?
      ORDER BY created_at DESC
      LIMIT 500`,
    [excludeGenerationId || ""]
  ).catch(() => [[]]);
  let best = null;
  const inspect = (row, source) => {
    let method = "";
    let score = 0;
    if (row.normalized_hash && row.normalized_hash === fingerprint.normalizedHash) {
      method = "normalized_hash";
      score = 1;
    } else if (row.simhash) {
      const distance = hammingDistanceHex(fingerprint.simhash, row.simhash);
      score = Number(((64 - distance) / 64).toFixed(4));
      if (score >= 0.78) method = "simhash";
    }
    if (!method) return;
    if (!best || score > best.score) {
      best = {
        source,
        method,
        score,
        promptId: source === "prompt" ? Number(row.id) : null,
        generationId: source === "generation" ? row.id : ""
      };
    }
  };
  for (const row of promptRows) inspect(row, "prompt");
  for (const row of generationRows) {
    const rowFingerprint = promptQualityFingerprint(row.prompt);
    inspect({ ...row, normalized_hash: rowFingerprint.normalizedHash, simhash: rowFingerprint.simhash }, "generation");
  }
  return best;
}

async function createPromptAuditRecord(input = {}) {
  const fingerprint = promptQualityFingerprint(input.prompt);
  const [result] = await getPool().execute(
    `INSERT INTO prompt_audit_records
      (generation_id, user_id, prompt_text, prompt_hash, requested_mode, result_level, result_action, required_mode, status, score, method, matched_prompt_id, matched_generation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.generationId || null,
      input.userId || null,
      String(input.prompt || ""),
      fingerprint.normalizedHash,
      String(input.requestedMode || "text-to-image").slice(0, 24),
      String(input.resultLevel || "low").slice(0, 16),
      String(input.resultAction || "allow").slice(0, 40),
      String(input.requiredMode || "").slice(0, 24),
      String(input.status || "allowed").slice(0, 24),
      Math.max(0, Math.min(1, Number(input.score || 0))),
      String(input.method || "").slice(0, 40),
      input.matchedPromptId ? Number(input.matchedPromptId) : null,
      input.matchedGenerationId || null
    ]
  );
  return getPromptAuditRecordById(result.insertId);
}

async function auditPromptForPublish({
  prompt,
  generationId = "",
  userId = "",
  requestedMode = "text-to-image",
  persist = true
} = {}) {
  const fingerprint = promptQualityFingerprint(prompt);
  const override = await findLatestPromptAuditOverride({ generationId, promptHash: fingerprint.normalizedHash });
  if (override?.overrideAction === "allow_text_to_image") {
    return {
      ...override,
      resultLevel: "low",
      resultAction: "allow",
      requiredMode: "",
      status: "override_allowed",
      overridden: true
    };
  }
  if (override?.overrideAction === "require_image_to_image") {
    return {
      ...override,
      resultLevel: "high",
      resultAction: "require_image_to_image",
      requiredMode: "image-to-image",
      status: "blocked",
      overridden: true
    };
  }
  const match = await findBestPromptAuditMatch({ fingerprint, excludeGenerationId: generationId });
  const decision = promptAuditDecisionFromMatch(match);
  if (decision.requiredMode === "image-to-image" && requestedMode === "image-to-image") {
    decision.resultAction = "allow_image_to_image";
    decision.status = "allowed";
  }
  const audit = {
    generationId,
    userId,
    prompt,
    requestedMode,
    ...decision,
    score: Number(match?.score || 0),
    method: match?.method || "none",
    matchedPromptId: match?.promptId || null,
    matchedGenerationId: match?.generationId || ""
  };
  if (!persist) return audit;
  return createPromptAuditRecord(audit);
}

async function listPromptAuditRecords({ status = "", limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [];
  const where = status && status !== "all" ? "WHERE par.status = ?" : "";
  if (where) values.push(status);
  const [rows] = await getPool().execute(
    `SELECT par.*, u.name AS user_name, u.email AS user_email,
            mp.title AS matched_prompt_title, mp.prompt AS matched_prompt_text,
            mg.prompt AS matched_generation_prompt,
            ru.name AS reviewer_name, ru.email AS reviewer_email
       FROM prompt_audit_records par
       LEFT JOIN users u ON u.id = par.user_id
       LEFT JOIN prompts mp ON mp.id = par.matched_prompt_id
       LEFT JOIN generations mg ON mg.id = par.matched_generation_id
       LEFT JOIN users ru ON ru.id = par.reviewer_user_id
       ${where}
      ORDER BY par.status = 'blocked' DESC, par.status = 'review' DESC, par.created_at DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapPromptAuditRecord);
}

async function getPromptAuditRecordById(id) {
  const [rows] = await getPool().execute(
    `SELECT par.*, u.name AS user_name, u.email AS user_email,
            mp.title AS matched_prompt_title, mp.prompt AS matched_prompt_text,
            mg.prompt AS matched_generation_prompt,
            ru.name AS reviewer_name, ru.email AS reviewer_email
       FROM prompt_audit_records par
       LEFT JOIN users u ON u.id = par.user_id
       LEFT JOIN prompts mp ON mp.id = par.matched_prompt_id
       LEFT JOIN generations mg ON mg.id = par.matched_generation_id
       LEFT JOIN users ru ON ru.id = par.reviewer_user_id
      WHERE par.id = ? LIMIT 1`,
    [Number(id) || 0]
  );
  return mapPromptAuditRecord(rows[0]);
}

async function reviewPromptAuditRecord(id, { action = "", reviewerUserId = "", note = "" } = {}) {
  const allowed = new Set(["allow_text_to_image", "require_image_to_image", "mark_reviewed"]);
  const overrideAction = allowed.has(action) ? action : "mark_reviewed";
  const nextStatus = overrideAction === "allow_text_to_image"
    ? "override_allowed"
    : overrideAction === "require_image_to_image"
      ? "blocked"
      : "reviewed";
  await getPool().execute(
    `UPDATE prompt_audit_records
        SET status = ?, override_action = ?, override_note = ?, reviewer_user_id = ?, reviewed_at = ?
      WHERE id = ?`,
    [nextStatus, overrideAction, String(note || "").slice(0, 500), reviewerUserId || null, new Date(), Number(id) || 0]
  );
  return getPromptAuditRecordById(id);
}

async function listPrompts({ includeHidden = false, limit = 500, sort = "default", currentUserId = "" } = {}) {
  const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
  const where = includeHidden ? "" : "WHERE p.status = 'active'";
  const heatExpr = "(p.like_count * 3 + p.use_count + GREATEST(0, 30 - TIMESTAMPDIFF(DAY, p.created_at, NOW())) / 10)";
  const order = sort === "hot"
    ? "ORDER BY heat_score DESC, p.like_count DESC, p.use_count DESC, p.created_at DESC, p.id DESC"
    : sort === "new"
      ? "ORDER BY p.created_at DESC, p.id DESC"
      : sort === "used"
        ? "ORDER BY p.use_count DESC, p.like_count DESC, p.created_at DESC, p.id DESC"
        : sort === "liked"
          ? "ORDER BY p.like_count DESC, p.use_count DESC, p.created_at DESC, p.id DESC"
          : "ORDER BY p.sort_order DESC, p.id ASC";
  const [rows] = await getPool().execute(
    `SELECT p.*, ${heatExpr} AS heat_score,
            ${currentUserId ? "CASE WHEN pl.user_id IS NULL THEN 0 ELSE 1 END" : "0"} AS liked_by_current_user
       FROM prompts p
       ${currentUserId ? "LEFT JOIN prompt_likes pl ON pl.prompt_id = p.id AND pl.user_id = ?" : ""}
       ${where}
       ${order}
       LIMIT ${safeLimit}`,
    currentUserId ? [currentUserId] : []
  );
  return rows.map(mapPrompt);
}

async function getPromptById(id) {
  const [rows] = await getPool().execute("SELECT * FROM prompts WHERE id = ? LIMIT 1", [Number(id) || 0]);
  return mapPrompt(rows[0]);
}

async function setPromptLike(promptId, userId, liked) {
  const id = Number(promptId) || 0;
  if (liked) {
    await getPool().execute("INSERT IGNORE INTO prompt_likes (prompt_id, user_id) VALUES (?, ?)", [id, userId]);
  } else {
    await getPool().execute("DELETE FROM prompt_likes WHERE prompt_id = ? AND user_id = ?", [id, userId]);
  }
  await getPool().execute(
    "UPDATE prompts SET like_count = (SELECT COUNT(*) FROM prompt_likes WHERE prompt_id = ?), updated_at = ? WHERE id = ?",
    [id, new Date(), id]
  );
  const [rows] = await getPool().execute(
    `SELECT p.*, (p.like_count * 3 + p.use_count + GREATEST(0, 30 - TIMESTAMPDIFF(DAY, p.created_at, NOW())) / 10) AS heat_score,
            CASE WHEN pl.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_current_user
       FROM prompts p
       LEFT JOIN prompt_likes pl ON pl.prompt_id = p.id AND pl.user_id = ?
      WHERE p.id = ? LIMIT 1`,
    [userId, id]
  );
  return mapPrompt(rows[0]);
}

async function incrementPromptUse(promptId) {
  const id = Number(promptId) || 0;
  if (!id) return null;
  await getPool().execute("UPDATE prompts SET use_count = use_count + 1, updated_at = ? WHERE id = ?", [new Date(), id]);
  return getPromptById(id);
}

async function countPrompts() {
  const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM prompts");
  return Number(rows[0]?.count || 0);
}

function promptSchemaValues(input = {}) {
  const dateValue = input.syncedAt ? new Date(input.syncedAt) : null;
  const syncedAt = dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue : null;
  return {
    title: String(input.title || "").slice(0, 200),
    prompt: String(input.prompt || ""),
    image: String(input.image || input.imageUrl || input.coverUrl || "").slice(0, 500),
    tagsJson: JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
    category: String(input.category || "general").slice(0, 32),
    visibility: String(input.visibility || "public").slice(0, 16),
    preview: String(input.preview || input.coverUrl || "").slice(0, 500),
    author: String(input.author || "").slice(0, 120),
    source: String(input.source || "").slice(0, 120),
    sourceUrl: String(input.sourceUrl || "").slice(0, 500),
    githubUrl: String(input.githubUrl || "").slice(0, 500),
    remoteId: String(input.remoteId || "").slice(0, 160),
    sourceRepo: String(input.sourceRepo || "").slice(0, 160),
    sourceCategory: String(input.sourceCategory || "").slice(0, 120),
    promptType: String(input.promptType || "text-to-image").slice(0, 32),
    language: String(input.language || "zh").slice(0, 16),
    modelHint: String(input.modelHint || "").slice(0, 120),
    syncedAt,
    status: String(input.status || "active").slice(0, 16),
    sortOrder: Number(input.sortOrder || 0)
  };
}

async function createPrompt(input) {
  const values = promptSchemaValues(input);
  const fingerprint = promptQualityFingerprint(input.prompt);
  const desiredId = Number.isFinite(Number(input.id)) && Number(input.id) > 0 ? Number(input.id) : null;
  if (desiredId) {
    await getPool().execute(
      `INSERT INTO prompts
          (id, title, prompt, image, tags_json, category, visibility, preview, author, source, source_url,
           github_url, remote_id, source_repo, source_category, prompt_type, language, model_hint, synced_at,
           status, sort_order, normalized_hash, simhash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        desiredId,
        values.title,
        values.prompt,
        values.image,
        values.tagsJson,
        values.category,
        values.visibility,
        values.preview,
        values.author,
        values.source,
        values.sourceUrl,
        values.githubUrl,
        values.remoteId,
        values.sourceRepo,
        values.sourceCategory,
        values.promptType,
        values.language,
        values.modelHint,
        values.syncedAt,
        values.status,
        values.sortOrder,
        fingerprint.normalizedHash,
        fingerprint.simhash
      ]
    );
    return getPromptById(desiredId);
  }
  const [result] = await getPool().execute(
    `INSERT INTO prompts
        (title, prompt, image, tags_json, category, visibility, preview, author, source, source_url,
         github_url, remote_id, source_repo, source_category, prompt_type, language, model_hint, synced_at,
         status, sort_order, normalized_hash, simhash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.title,
      values.prompt,
      values.image,
      values.tagsJson,
      values.category,
      values.visibility,
      values.preview,
      values.author,
      values.source,
      values.sourceUrl,
      values.githubUrl,
      values.remoteId,
      values.sourceRepo,
      values.sourceCategory,
      values.promptType,
      values.language,
      values.modelHint,
      values.syncedAt,
      values.status,
      values.sortOrder,
      fingerprint.normalizedHash,
      fingerprint.simhash
    ]
  );
  return getPromptById(result.insertId);
}

async function updatePrompt(id, patch) {
  const columns = [];
  const values = [];
  if (Object.hasOwn(patch, "title")) {
    columns.push("title = ?");
    values.push(String(patch.title || "").slice(0, 200));
  }
  if (Object.hasOwn(patch, "prompt")) {
    const fingerprint = promptQualityFingerprint(patch.prompt);
    columns.push("prompt = ?");
    values.push(String(patch.prompt || ""));
    columns.push("normalized_hash = ?");
    values.push(fingerprint.normalizedHash);
    columns.push("simhash = ?");
    values.push(fingerprint.simhash);
  }
  if (Object.hasOwn(patch, "image")) {
    columns.push("image = ?");
    values.push(String(patch.image || "").slice(0, 500));
  }
  if (Object.hasOwn(patch, "imageUrl")) {
    columns.push("image = ?");
    values.push(String(patch.imageUrl || "").slice(0, 500));
  }
  if (Object.hasOwn(patch, "coverUrl")) {
    columns.push("preview = ?");
    values.push(String(patch.coverUrl || "").slice(0, 500));
  }
  if (Object.hasOwn(patch, "preview")) {
    columns.push("preview = ?");
    values.push(String(patch.preview || "").slice(0, 500));
  }
  if (Object.hasOwn(patch, "tags")) {
    columns.push("tags_json = ?");
    values.push(JSON.stringify(Array.isArray(patch.tags) ? patch.tags : []));
  }
  if (Object.hasOwn(patch, "category")) {
    columns.push("category = ?");
    values.push(String(patch.category || "general").slice(0, 32));
  }
  if (Object.hasOwn(patch, "visibility")) {
    columns.push("visibility = ?");
    values.push(String(patch.visibility || "public").slice(0, 16));
  }
  if (Object.hasOwn(patch, "author")) {
    columns.push("author = ?");
    values.push(String(patch.author || "").slice(0, 120));
  }
  if (Object.hasOwn(patch, "source")) {
    columns.push("source = ?");
    values.push(String(patch.source || "").slice(0, 120));
  }
  if (Object.hasOwn(patch, "sourceUrl")) {
    columns.push("source_url = ?");
    values.push(String(patch.sourceUrl || "").slice(0, 500));
  }
  if (Object.hasOwn(patch, "githubUrl")) {
    columns.push("github_url = ?");
    values.push(String(patch.githubUrl || "").slice(0, 500));
  }
  if (Object.hasOwn(patch, "remoteId")) {
    columns.push("remote_id = ?");
    values.push(String(patch.remoteId || "").slice(0, 160));
  }
  if (Object.hasOwn(patch, "sourceRepo")) {
    columns.push("source_repo = ?");
    values.push(String(patch.sourceRepo || "").slice(0, 160));
  }
  if (Object.hasOwn(patch, "sourceCategory")) {
    columns.push("source_category = ?");
    values.push(String(patch.sourceCategory || "").slice(0, 120));
  }
  if (Object.hasOwn(patch, "promptType")) {
    columns.push("prompt_type = ?");
    values.push(String(patch.promptType || "text-to-image").slice(0, 32));
  }
  if (Object.hasOwn(patch, "language")) {
    columns.push("language = ?");
    values.push(String(patch.language || "zh").slice(0, 16));
  }
  if (Object.hasOwn(patch, "modelHint")) {
    columns.push("model_hint = ?");
    values.push(String(patch.modelHint || "").slice(0, 120));
  }
  if (Object.hasOwn(patch, "syncedAt")) {
    const syncedAt = patch.syncedAt ? new Date(patch.syncedAt) : null;
    columns.push("synced_at = ?");
    values.push(syncedAt && !Number.isNaN(syncedAt.getTime()) ? syncedAt : null);
  }
  if (Object.hasOwn(patch, "status")) {
    columns.push("status = ?");
    values.push(String(patch.status || "active").slice(0, 16));
  }
  if (Object.hasOwn(patch, "sortOrder")) {
    columns.push("sort_order = ?");
    values.push(Number(patch.sortOrder || 0));
  }
  if (!columns.length) return getPromptById(id);
  values.push(Number(id) || 0);
  await getPool().execute(`UPDATE prompts SET ${columns.join(", ")} WHERE id = ?`, values);
  return getPromptById(id);
}

async function softDeletePrompt(id) {
  await getPool().execute("UPDATE prompts SET status = 'hidden' WHERE id = ?", [Number(id) || 0]);
  return getPromptById(id);
}

async function getPromptByRemoteKey(sourceRepo, remoteId) {
  const repo = String(sourceRepo || "").trim();
  const remote = String(remoteId || "").trim();
  if (!repo || !remote) return null;
  const [rows] = await getPool().execute(
    "SELECT * FROM prompts WHERE source_repo = ? AND remote_id = ? LIMIT 1",
    [repo, remote]
  );
  return mapPrompt(rows[0]);
}

async function upsertRemotePrompt(input = {}) {
  const existing = await getPromptByRemoteKey(input.sourceRepo, input.remoteId);
  if (existing) {
    return updatePrompt(existing.id, {
      ...input,
      status: input.status || existing.status
    });
  }
  return createPrompt(input);
}

async function listPromptSources({ includeDisabled = true } = {}) {
  const where = includeDisabled ? "" : "WHERE status = 'active'";
  const [rows] = await getPool().execute(
    `SELECT * FROM prompt_sources ${where} ORDER BY sort_order ASC, name ASC, id ASC`
  );
  return rows.map(mapPromptSource);
}

async function getPromptSourceById(id) {
  const [rows] = await getPool().execute("SELECT * FROM prompt_sources WHERE id = ? LIMIT 1", [String(id || "")]);
  return mapPromptSource(rows[0]);
}

async function createPromptSource(input = {}) {
  const id = String(input.id || "").trim();
  await getPool().execute(
    `INSERT INTO prompt_sources
        (id, name, source_type, repo_url, branch, parser, config_json, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      String(input.name || "").slice(0, 120),
      String(input.sourceType || "github").slice(0, 32),
      String(input.repoUrl || "").slice(0, 500),
      String(input.branch || "main").slice(0, 80),
      String(input.parser || "").slice(0, 80),
      JSON.stringify(input.config && typeof input.config === "object" ? input.config : {}),
      input.status === "disabled" ? "disabled" : "active",
      Number(input.sortOrder || 0)
    ]
  );
  return getPromptSourceById(id);
}

async function updatePromptSource(id, patch = {}) {
  const columns = [];
  const values = [];
  const set = (key, column, transform) => {
    if (Object.hasOwn(patch, key)) {
      columns.push(`${column} = ?`);
      values.push(transform(patch[key]));
    }
  };
  set("name", "name", (value) => String(value || "").slice(0, 120));
  set("sourceType", "source_type", (value) => String(value || "github").slice(0, 32));
  set("repoUrl", "repo_url", (value) => String(value || "").slice(0, 500));
  set("branch", "branch", (value) => String(value || "main").slice(0, 80));
  set("parser", "parser", (value) => String(value || "").slice(0, 80));
  set("config", "config_json", (value) => JSON.stringify(value && typeof value === "object" ? value : {}));
  set("status", "status", (value) => value === "disabled" ? "disabled" : "active");
  set("sortOrder", "sort_order", (value) => Number(value || 0));
  if (!columns.length) return getPromptSourceById(id);
  values.push(String(id || ""));
  await getPool().execute(`UPDATE prompt_sources SET ${columns.join(", ")} WHERE id = ?`, values);
  return getPromptSourceById(id);
}

async function createPromptSyncRun(input = {}) {
  const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
  const finishedAt = input.finishedAt ? new Date(input.finishedAt) : null;
  const [result] = await getPool().execute(
    `INSERT INTO prompt_sync_runs
        (source_id, status, started_at, finished_at, success_count, failure_count, skipped_count, error_log, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(input.sourceId || ""),
      String(input.status || "running").slice(0, 24),
      startedAt,
      finishedAt && !Number.isNaN(finishedAt.getTime()) ? finishedAt : null,
      Number(input.successCount || 0),
      Number(input.failureCount || 0),
      Number(input.skippedCount || 0),
      String(input.errorLog || "").slice(0, 20000),
      input.createdByUserId || null
    ]
  );
  await getPool().execute(
    `UPDATE prompt_sources
        SET last_synced_at = ?, last_status = ?, last_success_count = ?, last_failure_count = ?, last_error = ?
      WHERE id = ?`,
    [
      finishedAt && !Number.isNaN(finishedAt.getTime()) ? finishedAt : startedAt,
      String(input.status || "running").slice(0, 24),
      Number(input.successCount || 0),
      Number(input.failureCount || 0),
      String(input.errorLog || "").slice(0, 4000),
      String(input.sourceId || "")
    ]
  );
  return getPromptSyncRunById(result.insertId);
}

async function getPromptSyncRunById(id) {
  const [rows] = await getPool().execute(
    `SELECT r.*, s.name AS source_name, u.name AS created_by_name, u.email AS created_by_email
       FROM prompt_sync_runs r
       LEFT JOIN prompt_sources s ON s.id = r.source_id
       LEFT JOIN users u ON u.id = r.created_by_user_id
      WHERE r.id = ? LIMIT 1`,
    [Number(id) || 0]
  );
  return mapPromptSyncRun(rows[0]);
}

async function listPromptSyncRuns({ sourceId = "", limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [];
  const where = sourceId ? "WHERE r.source_id = ?" : "";
  if (sourceId) values.push(String(sourceId));
  const [rows] = await getPool().execute(
    `SELECT r.*, s.name AS source_name, u.name AS created_by_name, u.email AS created_by_email
       FROM prompt_sync_runs r
       LEFT JOIN prompt_sources s ON s.id = r.source_id
       LEFT JOIN users u ON u.id = r.created_by_user_id
       ${where}
      ORDER BY r.started_at DESC, r.id DESC
      LIMIT ${safeLimit}`,
    values
  );
  return rows.map(mapPromptSyncRun);
}

async function refreshPromptFingerprints({ limit = 2000 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(5000, Number(limit) || 2000));
  const [rows] = await getPool().execute(
    `SELECT id, prompt, normalized_hash, simhash
       FROM prompts
      WHERE normalized_hash = '' OR simhash = ''
      ORDER BY id ASC
      LIMIT ${normalizedLimit}`
  );
  for (const row of rows) {
    const fingerprint = promptQualityFingerprint(row.prompt);
    await getPool().execute(
      "UPDATE prompts SET normalized_hash = ?, simhash = ? WHERE id = ?",
      [fingerprint.normalizedHash, fingerprint.simhash, row.id]
    );
  }
  return rows.length;
}

async function scanPromptDuplicateCandidates({ limit = 2000, hammingThreshold = 6 } = {}) {
  await refreshPromptFingerprints({ limit });
  const normalizedLimit = Math.max(2, Math.min(5000, Number(limit) || 2000));
  const threshold = Math.max(0, Math.min(24, Number(hammingThreshold) || 6));
  const [rows] = await getPool().execute(
    `SELECT id, title, prompt, status, normalized_hash, simhash
       FROM prompts
      WHERE normalized_hash <> '' AND simhash <> ''
      ORDER BY id ASC
      LIMIT ${normalizedLimit}`
  );
  let inserted = 0;
  let scannedPairs = 0;
  const candidates = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      scannedPairs += 1;
      const left = rows[i];
      const right = rows[j];
      let method = "";
      let score = 0;
      if (left.normalized_hash && left.normalized_hash === right.normalized_hash) {
        method = "normalized_hash";
        score = 1;
      } else {
        const distance = hammingDistanceHex(left.simhash, right.simhash);
        if (distance <= threshold) {
          method = "simhash";
          score = Number(((64 - distance) / 64).toFixed(4));
        }
      }
      if (method) {
        candidates.push({
          promptId: Number(left.id),
          duplicatePromptId: Number(right.id),
          method,
          score
        });
      }
    }
  }
  for (const candidate of candidates) {
    const [result] = await getPool().execute(
      `INSERT IGNORE INTO prompt_duplicate_candidates
        (prompt_id, duplicate_prompt_id, method, score, ai_status)
       VALUES (?, ?, ?, ?, 'not_reviewed')`,
      [candidate.promptId, candidate.duplicatePromptId, candidate.method, candidate.score]
    );
    inserted += Number(result.affectedRows || 0);
  }
  return {
    scannedPrompts: rows.length,
    scannedPairs,
    candidates: candidates.length,
    inserted,
    hammingThreshold: threshold
  };
}

async function scanPromptDuplicateCandidatesForPrompt(promptId, { limit = 2000, hammingThreshold = 6 } = {}) {
  const id = Number(promptId) || 0;
  if (!id) return { promptId: id, comparedPrompts: 0, candidates: 0, inserted: 0, hammingThreshold: 0 };
  await refreshPromptFingerprints({ limit });
  const threshold = Math.max(0, Math.min(24, Number(hammingThreshold) || 6));
  const [targetRows] = await getPool().execute(
    "SELECT id, title, prompt, status, normalized_hash, simhash FROM prompts WHERE id = ? LIMIT 1",
    [id]
  );
  const target = targetRows[0];
  if (!target?.normalized_hash || !target?.simhash) {
    return { promptId: id, comparedPrompts: 0, candidates: 0, inserted: 0, hammingThreshold: threshold };
  }
  const normalizedLimit = Math.max(2, Math.min(5000, Number(limit) || 2000));
  const [rows] = await getPool().execute(
    `SELECT id, title, prompt, status, normalized_hash, simhash
       FROM prompts
      WHERE id <> ? AND normalized_hash <> '' AND simhash <> ''
      ORDER BY id ASC
      LIMIT ${normalizedLimit}`,
    [id]
  );
  let inserted = 0;
  let candidates = 0;
  for (const row of rows) {
    let method = "";
    let score = 0;
    if (target.normalized_hash === row.normalized_hash) {
      method = "normalized_hash";
      score = 1;
    } else {
      const distance = hammingDistanceHex(target.simhash, row.simhash);
      if (distance <= threshold) {
        method = "simhash";
        score = Number(((64 - distance) / 64).toFixed(4));
      }
    }
    if (!method) continue;
    candidates += 1;
    const leftId = Math.min(id, Number(row.id));
    const rightId = Math.max(id, Number(row.id));
    const [result] = await getPool().execute(
      `INSERT IGNORE INTO prompt_duplicate_candidates
        (prompt_id, duplicate_prompt_id, method, score, ai_status)
       VALUES (?, ?, ?, ?, 'not_reviewed')`,
      [leftId, rightId, method, score]
    );
    inserted += Number(result.affectedRows || 0);
  }
  return {
    promptId: id,
    comparedPrompts: rows.length,
    candidates,
    inserted,
    hammingThreshold: threshold
  };
}

async function listPromptDuplicateCandidates({ status = "pending", limit = 100 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const values = [];
  const where = status && status !== "all" ? "WHERE pdc.status = ?" : "";
  if (where) values.push(status);
  const [rows] = await getPool().execute(
    `SELECT pdc.*,
            p.title AS prompt_title, p.prompt AS prompt_text, p.status AS prompt_status,
            p.normalized_hash AS prompt_normalized_hash, p.simhash AS prompt_simhash,
            d.title AS duplicate_title, d.prompt AS duplicate_text, d.status AS duplicate_status,
            d.normalized_hash AS duplicate_normalized_hash, d.simhash AS duplicate_simhash,
            u.name AS reviewer_name, u.email AS reviewer_email
       FROM prompt_duplicate_candidates pdc
       INNER JOIN prompts p ON p.id = pdc.prompt_id
       INNER JOIN prompts d ON d.id = pdc.duplicate_prompt_id
       LEFT JOIN users u ON u.id = pdc.reviewer_user_id
       ${where}
      ORDER BY pdc.status = 'pending' DESC, pdc.score DESC, pdc.created_at DESC
      LIMIT ${normalizedLimit}`,
    values
  );
  return rows.map(mapPromptDuplicateCandidate);
}

async function getPromptDuplicateCandidateById(id) {
  const [rows] = await getPool().execute(
    `SELECT pdc.*,
            p.title AS prompt_title, p.prompt AS prompt_text, p.status AS prompt_status,
            p.normalized_hash AS prompt_normalized_hash, p.simhash AS prompt_simhash,
            d.title AS duplicate_title, d.prompt AS duplicate_text, d.status AS duplicate_status,
            d.normalized_hash AS duplicate_normalized_hash, d.simhash AS duplicate_simhash,
            u.name AS reviewer_name, u.email AS reviewer_email
       FROM prompt_duplicate_candidates pdc
       INNER JOIN prompts p ON p.id = pdc.prompt_id
       INNER JOIN prompts d ON d.id = pdc.duplicate_prompt_id
       LEFT JOIN users u ON u.id = pdc.reviewer_user_id
      WHERE pdc.id = ? LIMIT 1`,
    [Number(id) || 0]
  );
  return mapPromptDuplicateCandidate(rows[0]);
}

async function reviewPromptDuplicateCandidate(id, { status = "reviewed", reviewerUserId = "", reviewNote = "" } = {}) {
  const allowed = new Set(["pending", "confirmed_duplicate", "kept_distinct", "merged", "hidden", "ignored"]);
  const nextStatus = allowed.has(status) ? status : "ignored";
  await getPool().execute(
    `UPDATE prompt_duplicate_candidates
        SET status = ?, reviewer_user_id = ?, review_note = ?, reviewed_at = ?
      WHERE id = ?`,
    [nextStatus, reviewerUserId || null, String(reviewNote || "").slice(0, 500), new Date(), Number(id) || 0]
  );
  return getPromptDuplicateCandidateById(id);
}

async function updatePromptDuplicateAiReview(id, review = {}) {
  const safeRaw = review.raw === undefined ? null : JSON.stringify(review.raw).slice(0, 60000);
  await getPool().execute(
    `UPDATE prompt_duplicate_candidates
        SET ai_status = ?, ai_decision = ?, ai_confidence = ?, ai_reason = ?,
            ai_recommended_action = ?, ai_model = ?, ai_reviewed_at = ?, ai_raw_json = ?
      WHERE id = ?`,
    [
      String(review.status || "reviewed").slice(0, 24),
      String(review.decision || "needs_review").slice(0, 24),
      Math.max(0, Math.min(1, Number(review.confidence || 0))),
      String(review.reason || "").slice(0, 1000),
      String(review.recommendedAction || "manual_review").slice(0, 40),
      String(review.model || "").slice(0, 120),
      new Date(),
      safeRaw,
      Number(id) || 0
    ]
  );
  return getPromptDuplicateCandidateById(id);
}

async function seedPromptsIfEmpty(items = []) {
  if (!Array.isArray(items) || !items.length) return 0;
  const existing = await countPrompts();
  if (existing > 0) return 0;
  let inserted = 0;
  // Use individual INSERTs to keep memory low and tolerate occasional invalid rows.
  for (const item of items) {
    try {
      await createPrompt({
        id: item.id,
        title: item.title,
        prompt: item.prompt,
        image: item.image,
        tags: item.tags,
        author: item.author,
        source: item.source,
        sourceUrl: item.sourceUrl,
        status: "active",
        sortOrder: 0
      });
      inserted += 1;
    } catch (error) {
      console.warn(`seedPromptsIfEmpty failed for id=${item?.id}: ${error.message}`);
    }
  }
  return inserted;
}

// ============================================================================
// gallery_tags
// ============================================================================

// 80 条系统种子（8 大类 × 10）。slug 全小写、ASCII；label_zh / label_en 决定展示；
// aliases 用于把用户输入归一化到 slug，包含中英常见别名。
const SYSTEM_TAG_SEED = [
  { slug: "text-to-image", label_zh: "文生图", label_en: "Text-to-image", aliases: ["文生图", "text-to-image", "txt2img"], category: "core", sort_order: 1 },
  { slug: "image-to-image", label_zh: "图生图", label_en: "Image-to-image", aliases: ["图生图", "image-to-image", "img2img"], category: "core", sort_order: 2 },
  // ---- 风格 ----
  { slug: "photo", label_zh: "摄影", label_en: "Photo", aliases: ["摄影", "照片", "photo", "photography"] },
  { slug: "realistic", label_zh: "写实", label_en: "Realistic", aliases: ["写实", "真实", "realistic", "photorealistic"] },
  { slug: "illustration", label_zh: "插画", label_en: "Illustration", aliases: ["插画", "插图", "illustration"] },
  { slug: "watercolor", label_zh: "水彩", label_en: "Watercolor", aliases: ["水彩", "水墨", "watercolor"] },
  { slug: "oil-painting", label_zh: "油画", label_en: "Oil painting", aliases: ["油画", "oil-painting", "oil"] },
  { slug: "pixel-art", label_zh: "像素", label_en: "Pixel art", aliases: ["像素", "像素风", "pixel", "pixel-art"] },
  { slug: "concept-art", label_zh: "概念", label_en: "Concept art", aliases: ["概念", "概念图", "concept", "concept-art"] },
  { slug: "anime", label_zh: "日式动漫", label_en: "Anime", aliases: ["动漫", "动画", "anime", "manga"] },
  { slug: "chinese-style", label_zh: "中国风", label_en: "Chinese style", aliases: ["中国风", "国风", "guofeng", "chinese-style"] },
  { slug: "minimalism", label_zh: "极简", label_en: "Minimalism", aliases: ["极简", "minimalism", "minimal"] },
  // ---- 题材 ----
  { slug: "portrait", label_zh: "人像", label_en: "Portrait", aliases: ["人像", "肖像", "portrait"] },
  { slug: "landscape", label_zh: "风景", label_en: "Landscape", aliases: ["风景", "山水", "landscape"] },
  { slug: "cityscape", label_zh: "城市", label_en: "Cityscape", aliases: ["城市", "都市", "cityscape", "city"] },
  { slug: "still-life", label_zh: "静物", label_en: "Still life", aliases: ["静物", "still-life"] },
  { slug: "food", label_zh: "美食", label_en: "Food", aliases: ["美食", "食物", "food"] },
  { slug: "animal", label_zh: "动物", label_en: "Animal", aliases: ["动物", "宠物", "animal", "pet"] },
  { slug: "architecture", label_zh: "建筑", label_en: "Architecture", aliases: ["建筑", "architecture"] },
  { slug: "ocean", label_zh: "海洋", label_en: "Ocean", aliases: ["海洋", "大海", "ocean", "sea"] },
  { slug: "space", label_zh: "太空", label_en: "Space", aliases: ["太空", "宇宙", "space", "cosmos"] },
  { slug: "holiday", label_zh: "节日", label_en: "Holiday", aliases: ["节日", "节庆", "holiday", "festival"] },
  // ---- 用途 ----
  { slug: "poster", label_zh: "海报", label_en: "Poster", aliases: ["海报", "招贴", "poster"] },
  { slug: "avatar", label_zh: "头像", label_en: "Avatar", aliases: ["头像", "avatar"] },
  { slug: "product", label_zh: "商品", label_en: "Product", aliases: ["商品", "产品", "product"] },
  { slug: "advertisement", label_zh: "广告", label_en: "Advertisement", aliases: ["广告", "advertisement", "ad"] },
  { slug: "web-banner", label_zh: "网站", label_en: "Web banner", aliases: ["网站", "网页", "web", "web-banner"] },
  { slug: "emoji", label_zh: "表情", label_en: "Emoji", aliases: ["表情", "表情包", "emoji", "sticker"] },
  { slug: "cover", label_zh: "头图", label_en: "Cover", aliases: ["头图", "封面", "cover"] },
  { slug: "business-card", label_zh: "名片", label_en: "Business card", aliases: ["名片", "business-card"] },
  { slug: "ticket", label_zh: "票券", label_en: "Ticket", aliases: ["票券", "门票", "ticket"] },
  { slug: "packaging", label_zh: "包装", label_en: "Packaging", aliases: ["包装", "packaging"] },
  // ---- 镜头 ----
  { slug: "close-up", label_zh: "特写", label_en: "Close-up", aliases: ["特写", "close-up", "closeup"] },
  { slug: "medium-shot", label_zh: "中景", label_en: "Medium shot", aliases: ["中景", "medium-shot"] },
  { slug: "wide-shot", label_zh: "全景", label_en: "Wide shot", aliases: ["全景", "wide-shot"] },
  { slug: "aerial", label_zh: "鸟瞰", label_en: "Aerial", aliases: ["鸟瞰", "航拍", "aerial"] },
  { slug: "fisheye", label_zh: "鱼眼", label_en: "Fisheye", aliases: ["鱼眼", "fisheye"] },
  { slug: "macro", label_zh: "微距", label_en: "Macro", aliases: ["微距", "macro"] },
  { slug: "panorama", label_zh: "全景接片", label_en: "Panorama", aliases: ["全景接片", "panorama"] },
  { slug: "low-angle", label_zh: "仰拍", label_en: "Low angle", aliases: ["仰拍", "仰角", "low-angle"] },
  { slug: "top-down", label_zh: "俯拍", label_en: "Top-down", aliases: ["俯拍", "俯视", "top-down"] },
  { slug: "perspective", label_zh: "透视", label_en: "Perspective", aliases: ["透视", "perspective"] },
  // ---- 灯光 ----
  { slug: "natural-light", label_zh: "自然光", label_en: "Natural light", aliases: ["自然光", "natural-light"] },
  { slug: "golden-hour", label_zh: "黄金时段", label_en: "Golden hour", aliases: ["黄金时段", "golden-hour"] },
  { slug: "dark-background", label_zh: "黑色背景", label_en: "Dark background", aliases: ["黑色背景", "暗背景", "dark-background"] },
  { slug: "studio-light", label_zh: "工作室光", label_en: "Studio light", aliases: ["工作室光", "studio-light", "studio"] },
  { slug: "neon", label_zh: "霓虹", label_en: "Neon", aliases: ["霓虹", "neon"] },
  { slug: "candlelight", label_zh: "烛光", label_en: "Candlelight", aliases: ["烛光", "candlelight"] },
  { slug: "volumetric", label_zh: "体积光", label_en: "Volumetric", aliases: ["体积光", "volumetric"] },
  { slug: "backlight", label_zh: "逆光", label_en: "Backlight", aliases: ["逆光", "backlight"] },
  { slug: "high-contrast", label_zh: "强对比", label_en: "High contrast", aliases: ["强对比", "高对比", "high-contrast"] },
  { slug: "soft-light", label_zh: "柔光", label_en: "Soft light", aliases: ["柔光", "soft-light"] },
  // ---- 情绪 ----
  { slug: "healing", label_zh: "治愈", label_en: "Healing", aliases: ["治愈", "healing"] },
  { slug: "mystic", label_zh: "神秘", label_en: "Mystic", aliases: ["神秘", "mystic", "mysterious"] },
  { slug: "nostalgia", label_zh: "怀旧", label_en: "Nostalgia", aliases: ["怀旧", "nostalgia", "retro"] },
  { slug: "joyful", label_zh: "欢快", label_en: "Joyful", aliases: ["欢快", "joyful"] },
  { slug: "serious", label_zh: "严肃", label_en: "Serious", aliases: ["严肃", "serious"] },
  { slug: "romantic", label_zh: "浪漫", label_en: "Romantic", aliases: ["浪漫", "romantic"] },
  { slug: "calm", label_zh: "冷淡", label_en: "Calm", aliases: ["冷淡", "calm", "serene"] },
  { slug: "dramatic", label_zh: "戏剧", label_en: "Dramatic", aliases: ["戏剧", "dramatic"] },
  { slug: "cozy", label_zh: "温馨", label_en: "Cozy", aliases: ["温馨", "cozy"] },
  { slug: "epic", label_zh: "史诗", label_en: "Epic", aliases: ["史诗", "epic"] },
  // ---- 颜色 ----
  { slug: "morandi", label_zh: "莫兰迪", label_en: "Morandi", aliases: ["莫兰迪", "morandi"] },
  { slug: "saturated", label_zh: "高饱和", label_en: "Saturated", aliases: ["高饱和", "saturated"] },
  { slug: "monochrome", label_zh: "黑白", label_en: "Monochrome", aliases: ["黑白", "monochrome", "bw"] },
  { slug: "vintage", label_zh: "复古", label_en: "Vintage", aliases: ["复古", "vintage"] },
  { slug: "pink", label_zh: "粉红", label_en: "Pink", aliases: ["粉红", "粉色", "pink"] },
  { slug: "blue-tone", label_zh: "蓝调", label_en: "Blue tone", aliases: ["蓝调", "blue-tone"] },
  { slug: "warm-tone", label_zh: "暖色", label_en: "Warm tone", aliases: ["暖色", "warm-tone", "warm"] },
  { slug: "cool-tone", label_zh: "冷色", label_en: "Cool tone", aliases: ["冷色", "cool-tone", "cool"] },
  { slug: "gradient", label_zh: "渐变", label_en: "Gradient", aliases: ["渐变", "gradient"] },
  { slug: "contrast-colors", label_zh: "撞色", label_en: "Contrast colors", aliases: ["撞色", "contrast-colors"] },
  // ---- 技法 ----
  { slug: "hdr", label_zh: "HDR", label_en: "HDR", aliases: ["hdr"] },
  { slug: "long-exposure", label_zh: "长曝光", label_en: "Long exposure", aliases: ["长曝光", "long-exposure"] },
  { slug: "light-painting", label_zh: "光绘", label_en: "Light painting", aliases: ["光绘", "light-painting"] },
  { slug: "double-exposure", label_zh: "双重曝光", label_en: "Double exposure", aliases: ["双重曝光", "double-exposure"] },
  { slug: "bokeh", label_zh: "散景", label_en: "Bokeh", aliases: ["散景", "bokeh"] },
  { slug: "tilt-shift", label_zh: "倾斜移轴", label_en: "Tilt-shift", aliases: ["倾斜移轴", "tilt-shift"] },
  { slug: "reflection", label_zh: "反射", label_en: "Reflection", aliases: ["反射", "reflection"] },
  { slug: "silhouette", label_zh: "剪影", label_en: "Silhouette", aliases: ["剪影", "倒影", "silhouette"] },
  { slug: "film-grain", label_zh: "颗粒", label_en: "Film grain", aliases: ["颗粒", "胶片", "film-grain"] },
  { slug: "lens-flare", label_zh: "镜头光晕", label_en: "Lens flare", aliases: ["镜头光晕", "lens-flare"] }
];

const SYSTEM_TAG_CATEGORIES = [
  "style",
  "subject",
  "use_case",
  "camera",
  "lighting",
  "mood",
  "color",
  "technique"
];

const PROMPT_CATEGORY_SEED = [
  { slug: "style", labelZh: "风格", labelEn: "Style", descriptionZh: "视觉风格、艺术流派和画面质感", descriptionEn: "Visual styles, art directions, and rendering texture", sortOrder: 10 },
  { slug: "subject", labelZh: "题材", labelEn: "Subject", descriptionZh: "人物、产品、场景和核心主体", descriptionEn: "People, products, scenes, and main subjects", sortOrder: 20 },
  { slug: "use_case", labelZh: "用途", labelEn: "Use", descriptionZh: "海报、封面、头像、UI、电商等使用场景", descriptionEn: "Posters, covers, avatars, UI, ecommerce, and other uses", sortOrder: 30 },
  { slug: "camera", labelZh: "镜头", labelEn: "Camera", descriptionZh: "景别、镜头语言、构图和摄影参数", descriptionEn: "Shot type, lens language, composition, and camera settings", sortOrder: 40 },
  { slug: "lighting", labelZh: "灯光", labelEn: "Lighting", descriptionZh: "光线方向、氛围和影调控制", descriptionEn: "Light direction, atmosphere, and tonal control", sortOrder: 50 },
  { slug: "mood", labelZh: "情绪", labelEn: "Mood", descriptionZh: "画面情绪、叙事感和审美倾向", descriptionEn: "Mood, narrative feeling, and aesthetic tone", sortOrder: 60 },
  { slug: "color", labelZh: "颜色", labelEn: "Color", descriptionZh: "配色、色调和色彩关系", descriptionEn: "Palettes, tones, and color relationships", sortOrder: 70 },
  { slug: "technique", labelZh: "技法", labelEn: "Technique", descriptionZh: "摄影技法、渲染技法和后期效果", descriptionEn: "Photo techniques, rendering methods, and post effects", sortOrder: 80 },
  { slug: "general", labelZh: "其他", labelEn: "Other", descriptionZh: "暂未归类或跨分类提示词", descriptionEn: "Uncategorized or cross-category prompts", sortOrder: 999 }
];

const PROMPT_SOURCE_SEED = [
  { id: "ps_evolinkai_gpt_image_2", name: "EvoLinkAI GPT Image 2", repoUrl: "https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts", parser: "github-generic", sortOrder: 10 },
  { id: "ps_zerolu_gpt_image", name: "ZeroLu Awesome GPT Image", repoUrl: "https://github.com/ZeroLu/awesome-gpt-image", parser: "github-generic", sortOrder: 20 },
  { id: "ps_imgedify_gpt4o", name: "ImgEdify GPT-4o Image Prompts", repoUrl: "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts", parser: "github-generic", sortOrder: 30 },
  { id: "ps_youmind_gpt_image_2", name: "YouMind GPT Image 2", repoUrl: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2", parser: "github-generic", sortOrder: 40 },
  { id: "ps_youmind_nano_banana_pro", name: "YouMind Nano Banana Pro", repoUrl: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts", parser: "github-generic", sortOrder: 50 }
];

function systemTagMeta(index) {
  if (SYSTEM_TAG_SEED[index]?.category === "core") {
    return {
      category: "core",
      sortOrder: Number(SYSTEM_TAG_SEED[index].sort_order || index + 1),
      showInFilter: true
    };
  }
  return {
    category: SYSTEM_TAG_CATEGORIES[Math.floor((index - 2) / 10)] || "general",
    sortOrder: (index + 1) * 10,
    showInFilter: true
  };
}

function normalizeAliasInput(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidTagSlug(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(value);
}

function isValidCategorySlug(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/.test(value);
}

// 简单稳定 hash → 0..359 hue。crypto.createHash 已经在 server.js 导入；store 这里独立 require。
function deriveHueFromSlug(slug) {
  const crypto = require("crypto");
  const digest = crypto.createHash("sha1").update(String(slug || "")).digest();
  return digest.readUInt16BE(0) % 360;
}

function mapTag(row) {
  if (!row) return null;
  let aliases = [];
  if (row.aliases_json) {
    try {
      const parsed = JSON.parse(row.aliases_json);
      if (Array.isArray(parsed)) aliases = parsed.map((alias) => String(alias));
    } catch {
      aliases = [];
    }
  }
  return {
    slug: row.slug,
    labelZh: row.label_zh || "",
    labelEn: row.label_en || "",
    aliases,
    category: row.category || "",
    source: row.source || "user",
    status: row.status || "active",
    showInFilter: row.show_in_filter !== undefined ? Boolean(row.show_in_filter) : true,
    hue: Number(row.hue || 0),
    usageCount: Number(row.usage_count || 0),
    sortOrder: Number(row.sort_order || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function addJsonTagCounts(rows, column, target) {
  for (const row of rows) {
    if (!row[column]) continue;
    try {
      const parsed = JSON.parse(row[column]);
      if (!Array.isArray(parsed)) continue;
      const seen = new Set();
      for (const item of parsed) {
        const slug = String(item || "").trim().toLowerCase();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        target[slug] = (target[slug] || 0) + 1;
      }
    } catch {
      // Ignore malformed historical rows; tag lists remain usable.
    }
  }
}

async function loadTagCoverageCounts() {
  const promptCounts = {};
  const galleryCounts = {};
  const [promptRows] = await getPool().execute("SELECT tags_json FROM prompts WHERE status = 'active'");
  const [galleryRows] = await getPool().execute("SELECT public_tags_json FROM generations WHERE is_public = 1");
  addJsonTagCounts(promptRows, "tags_json", promptCounts);
  addJsonTagCounts(galleryRows, "public_tags_json", galleryCounts);
  return { promptCounts, galleryCounts };
}

async function seedPromptCategories() {
  for (const item of PROMPT_CATEGORY_SEED) {
    await getPool().execute(
      `INSERT INTO prompt_categories
          (slug, label_zh, label_en, description_zh, description_en, status, sort_order)
       VALUES (?, ?, ?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE
          label_zh = IF(label_zh = '', VALUES(label_zh), label_zh),
          label_en = IF(label_en = '', VALUES(label_en), label_en),
          description_zh = IF(description_zh = '', VALUES(description_zh), description_zh),
          description_en = IF(description_en = '', VALUES(description_en), description_en)`,
      [item.slug, item.labelZh, item.labelEn, item.descriptionZh, item.descriptionEn, item.sortOrder]
    );
  }
}

async function seedPromptSources() {
  for (const item of PROMPT_SOURCE_SEED) {
    await getPool().execute(
      `INSERT INTO prompt_sources
          (id, name, source_type, repo_url, branch, parser, config_json, status, sort_order)
       VALUES (?, ?, 'github', ?, 'main', ?, '{}', 'active', ?)
       ON DUPLICATE KEY UPDATE
          name = IF(name = '', VALUES(name), name),
          repo_url = IF(repo_url = '', VALUES(repo_url), repo_url),
          parser = IF(parser = '', VALUES(parser), parser)`,
      [item.id, item.name, item.repoUrl, item.parser, item.sortOrder]
    );
  }
}

async function listPromptCategories({ includeHidden = false } = {}) {
  const where = includeHidden ? "" : "WHERE status = 'active'";
  const [rows] = await getPool().execute(
    `SELECT * FROM prompt_categories ${where} ORDER BY sort_order ASC, slug ASC`
  );
  return rows.map(mapPromptCategory);
}

async function getPromptCategoryBySlug(slug) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return null;
  const [rows] = await getPool().execute("SELECT * FROM prompt_categories WHERE slug = ? LIMIT 1", [cleaned]);
  return mapPromptCategory(rows[0]);
}

async function upsertPromptCategory(payload) {
  const slug = String(payload.slug || "").trim().toLowerCase();
  if (!isValidCategorySlug(slug)) throw new Error("invalid category slug");
  const labelZh = String(payload.labelZh || "").trim().slice(0, 48);
  const labelEn = String(payload.labelEn || "").trim().slice(0, 48);
  const descriptionZh = String(payload.descriptionZh || "").trim().slice(0, 255);
  const descriptionEn = String(payload.descriptionEn || "").trim().slice(0, 255);
  const status = payload.status === "hidden" ? "hidden" : "active";
  const sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0;
  await getPool().execute(
    `INSERT INTO prompt_categories
        (slug, label_zh, label_en, description_zh, description_en, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        label_zh = VALUES(label_zh),
        label_en = VALUES(label_en),
        description_zh = VALUES(description_zh),
        description_en = VALUES(description_en),
        status = VALUES(status),
        sort_order = VALUES(sort_order)`,
    [slug, labelZh, labelEn, descriptionZh, descriptionEn, status, sortOrder]
  );
  return getPromptCategoryBySlug(slug);
}

async function listTags({ includeHidden = false, limit = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
  const where = includeHidden ? "" : "WHERE status = 'active'";
  const [rows] = await getPool().execute(
    `SELECT * FROM gallery_tags ${where} ORDER BY show_in_filter DESC, source = 'system' DESC, sort_order ASC, usage_count DESC, slug ASC LIMIT ${safeLimit}`
  );
  const tags = rows.map(mapTag);
  const { promptCounts, galleryCounts } = await loadTagCoverageCounts();
  return tags.map((tag) => {
    const promptCount = Number(promptCounts[tag.slug] || 0);
    const galleryCount = Number(galleryCounts[tag.slug] || 0);
    return {
      ...tag,
      promptCount,
      galleryCount,
      contentCount: promptCount + galleryCount
    };
  }).sort((left, right) => {
    const pinned = { "text-to-image": 1, "image-to-image": 2 };
    const leftPinned = pinned[left.slug] || 0;
    const rightPinned = pinned[right.slug] || 0;
    if (leftPinned || rightPinned) return (leftPinned || 99) - (rightPinned || 99);
    return Number(right.galleryCount || 0) - Number(left.galleryCount || 0)
      || Number(right.contentCount || 0) - Number(left.contentCount || 0)
      || Number(right.usageCount || 0) - Number(left.usageCount || 0)
      || Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
      || String(left.slug).localeCompare(String(right.slug));
  });
}

async function getTagBySlug(slug) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return null;
  const [rows] = await getPool().execute("SELECT * FROM gallery_tags WHERE slug = ? LIMIT 1", [cleaned]);
  return mapTag(rows[0]);
}

async function countTags() {
  const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM gallery_tags");
  return Number(rows[0]?.count || 0);
}

// 用归一化后的字符串去匹配 slug 或任意 alias；找到 active tag 时返回它，否则 null。
async function findTagByAlias(input) {
  const normalized = normalizeAliasInput(input);
  if (!normalized) return null;
  // slug 只能 ASCII；中文输入肯定不会命中 slug，需要走 aliases JSON 查询。
  if (isValidTagSlug(normalized)) {
    const direct = await getTagBySlug(normalized);
    if (direct && direct.status === "active") return direct;
  }
  const [rows] = await getPool().execute(
    "SELECT * FROM gallery_tags WHERE status = 'active' AND aliases_json LIKE ? LIMIT 50",
    [`%${normalized.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`]
  );
  for (const row of rows) {
    const tag = mapTag(row);
    const lowerAliases = tag.aliases.map((alias) => String(alias).trim().toLowerCase());
    if (lowerAliases.includes(normalized) || tag.slug === normalized) {
      return tag;
    }
  }
  return null;
}

async function createTag(payload) {
  const slug = String(payload.slug || "").trim().toLowerCase();
  if (!isValidTagSlug(slug)) {
    throw new Error("invalid tag slug");
  }
  const aliasesArray = Array.isArray(payload.aliases) ? payload.aliases.map(String) : [];
  const aliasesJson = JSON.stringify(aliasesArray);
  const hue = Number.isFinite(Number(payload.hue))
    ? Math.max(0, Math.min(359, Number(payload.hue)))
    : deriveHueFromSlug(slug);
  await getPool().execute(
    `INSERT INTO gallery_tags (slug, label_zh, label_en, aliases_json, category, source, status, show_in_filter, hue, usage_count, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      String(payload.labelZh || "").slice(0, 48),
      String(payload.labelEn || "").slice(0, 48),
      aliasesJson,
      String(payload.category || "").slice(0, 32),
      ["system", "admin", "user"].includes(payload.source) ? payload.source : "user",
      payload.status === "hidden" ? "hidden" : "active",
      payload.showInFilter === false ? 0 : 1,
      hue,
      Math.max(0, Number(payload.usageCount || 0) | 0),
      Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0
    ]
  );
  return getTagBySlug(slug);
}

async function updateTag(slug, patch) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return null;
  const columns = [];
  const values = [];
  if (Object.hasOwn(patch, "labelZh")) {
    columns.push("label_zh = ?");
    values.push(String(patch.labelZh || "").slice(0, 48));
  }
  if (Object.hasOwn(patch, "labelEn")) {
    columns.push("label_en = ?");
    values.push(String(patch.labelEn || "").slice(0, 48));
  }
  if (Object.hasOwn(patch, "aliases")) {
    columns.push("aliases_json = ?");
    values.push(JSON.stringify(Array.isArray(patch.aliases) ? patch.aliases.map(String) : []));
  }
  if (Object.hasOwn(patch, "category")) {
    columns.push("category = ?");
    values.push(String(patch.category || "").slice(0, 32));
  }
  if (Object.hasOwn(patch, "source")) {
    columns.push("source = ?");
    values.push(["system", "admin", "user"].includes(patch.source) ? patch.source : "user");
  }
  if (Object.hasOwn(patch, "status")) {
    columns.push("status = ?");
    values.push(patch.status === "hidden" ? "hidden" : "active");
  }
  if (Object.hasOwn(patch, "hue")) {
    const hue = Number(patch.hue);
    columns.push("hue = ?");
    values.push(Number.isFinite(hue) ? Math.max(0, Math.min(359, hue)) : deriveHueFromSlug(cleaned));
  }
  if (Object.hasOwn(patch, "showInFilter")) {
    columns.push("show_in_filter = ?");
    values.push(patch.showInFilter === false ? 0 : 1);
  }
  if (Object.hasOwn(patch, "sortOrder")) {
    columns.push("sort_order = ?");
    values.push(Number.isFinite(Number(patch.sortOrder)) ? Number(patch.sortOrder) : 0);
  }
  if (!columns.length) return getTagBySlug(cleaned);
  values.push(cleaned);
  await getPool().execute(`UPDATE gallery_tags SET ${columns.join(", ")} WHERE slug = ?`, values);
  return getTagBySlug(cleaned);
}

async function hideTag(slug) {
  return updateTag(slug, { status: "hidden" });
}

async function incrementTagUsage(slug) {
  const cleaned = String(slug || "").trim().toLowerCase();
  if (!cleaned) return;
  await getPool().execute(
    "UPDATE gallery_tags SET usage_count = usage_count + 1 WHERE slug = ?",
    [cleaned]
  );
}

// merge：把 sourceSlug 的 alias 列表全部并到 targetSlug，把 sourceSlug 标 hidden（不真删），
// 并迁移 prompts.tags_json / generations.public_tags_json 中的历史标签。
async function mergeTag(sourceSlug, targetSlug) {
  const fromSlug = String(sourceSlug || "").trim().toLowerCase();
  const toSlug = String(targetSlug || "").trim().toLowerCase();
  if (!fromSlug || !toSlug || fromSlug === toSlug) {
    throw new Error("invalid merge slugs");
  }
  const [from, to] = await Promise.all([getTagBySlug(fromSlug), getTagBySlug(toSlug)]);
  if (!from) throw new Error("source tag not found");
  if (!to) throw new Error("target tag not found");
  const merged = Array.from(new Set([
    ...(to.aliases || []).map(String),
    ...(from.aliases || []).map(String),
    from.slug,
    from.labelZh,
    from.labelEn
  ].filter(Boolean)));
  await updateTag(toSlug, {
    aliases: merged,
    status: "active"
  });
  const migration = await migrateTagJsonSlugs({ [fromSlug]: toSlug }, { dryRun: false });
  await updateTag(fromSlug, { status: "hidden" });
  return { source: await getTagBySlug(fromSlug), target: await getTagBySlug(toSlug), migration };
}

function normalizeTagRewriteMap(mapping = {}) {
  const normalized = {};
  for (const [from, to] of Object.entries(mapping || {})) {
    const source = String(from || "").trim().toLowerCase();
    const target = String(to || "").trim().toLowerCase();
    if (source && target && source !== target) normalized[source] = target;
  }
  return normalized;
}

function rewriteTagArray(rawValue, mapping) {
  let tags = [];
  try {
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    if (Array.isArray(parsed)) tags = parsed;
  } catch {
    return { changed: false, malformed: true, tags: [], nextJson: rawValue || null, replacements: [] };
  }
  const replacements = [];
  const seen = new Set();
  const next = [];
  let changed = false;
  for (const tag of tags) {
    const original = String(tag || "").trim();
    if (!original) continue;
    const key = original.toLowerCase();
    const rewritten = mapping[key] || original;
    if (rewritten !== original) {
      changed = true;
      replacements.push({ from: original, to: rewritten });
    }
    const dedupeKey = String(rewritten).toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      next.push(rewritten);
    } else {
      changed = true;
    }
  }
  const nextJson = JSON.stringify(next);
  if (nextJson !== (rawValue || "[]")) changed = true;
  return { changed, malformed: false, tags: next, nextJson, replacements };
}

async function migrateTagJsonSlugs(mappingInput = {}, { dryRun = true } = {}) {
  const mapping = normalizeTagRewriteMap(mappingInput);
  const report = {
    dryRun: Boolean(dryRun),
    mapping,
    prompts: { scanned: 0, changed: 0, malformed: 0 },
    generations: { scanned: 0, changed: 0, malformed: 0 },
    replacements: []
  };
  if (!Object.keys(mapping).length) return report;

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [promptRows] = await connection.execute("SELECT id, tags_json FROM prompts");
    for (const row of promptRows) {
      report.prompts.scanned += 1;
      const result = rewriteTagArray(row.tags_json, mapping);
      if (result.malformed) {
        report.prompts.malformed += 1;
        continue;
      }
      if (!result.changed) continue;
      report.prompts.changed += 1;
      report.replacements.push({ table: "prompts", id: row.id, replacements: result.replacements });
      if (!dryRun) {
        await connection.execute("UPDATE prompts SET tags_json = ? WHERE id = ?", [result.nextJson, row.id]);
      }
    }

    const [generationRows] = await connection.execute("SELECT id, public_tags_json FROM generations");
    for (const row of generationRows) {
      report.generations.scanned += 1;
      const result = rewriteTagArray(row.public_tags_json, mapping);
      if (result.malformed) {
        report.generations.malformed += 1;
        continue;
      }
      if (!result.changed) continue;
      report.generations.changed += 1;
      report.replacements.push({ table: "generations", id: row.id, replacements: result.replacements });
      if (!dryRun) {
        await connection.execute("UPDATE generations SET public_tags_json = ? WHERE id = ?", [result.nextJson, row.id]);
      }
    }

    if (dryRun) await connection.rollback();
    else await connection.commit();
    return report;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function seedTagsIfEmpty() {
  const existing = await countTags();
  let inserted = 0;
  for (const [index, item] of SYSTEM_TAG_SEED.entries()) {
    const meta = systemTagMeta(index);
    try {
      const existingTag = await getTagBySlug(item.slug);
      if (existingTag) {
        await updateTag(item.slug, {
          labelZh: item.label_zh || existingTag.labelZh,
          labelEn: item.label_en || existingTag.labelEn,
          aliases: Array.from(new Set([...(existingTag.aliases || []), ...(item.aliases || [])])),
          category: meta.category,
          source: "system",
          status: "active",
          showInFilter: true,
          sortOrder: meta.sortOrder
        });
      } else {
        await createTag({
          slug: item.slug,
          labelZh: item.label_zh,
          labelEn: item.label_en,
          aliases: item.aliases,
          category: meta.category,
          source: "system",
          status: "active",
          showInFilter: true,
          sortOrder: meta.sortOrder
        });
        inserted += 1;
      }
    } catch (error) {
      console.warn(`seedTagsIfEmpty failed for slug=${item?.slug}: ${error.message}`);
    }
  }
  return existing > 0 ? inserted : Math.max(inserted, SYSTEM_TAG_SEED.length);
}

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
  createSession,
  deleteSession,
  touchSession,
  getSessionUser,
  insertGenerations,
  insertGenerationRequest,
  updateGenerationRequest,
  listGenerationRequests,
  getGenerationRequestById,
  listActiveGenerationRequestsForUser,
  listGenerationsForUser,
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
  listPrompts,
  getPromptById,
  setPromptLike,
  incrementPromptUse,
  refreshPromptFingerprints,
  scanPromptDuplicateCandidates,
  scanPromptDuplicateCandidatesForPrompt,
  listPromptDuplicateCandidates,
  getPromptDuplicateCandidateById,
  reviewPromptDuplicateCandidate,
  updatePromptDuplicateAiReview,
  auditPromptForPublish,
  createPromptAuditRecord,
  listPromptAuditRecords,
  getPromptAuditRecordById,
  reviewPromptAuditRecord,
  countPrompts,
  createPrompt,
  updatePrompt,
  softDeletePrompt,
  getPromptByRemoteKey,
  upsertRemotePrompt,
  listPromptSources,
  getPromptSourceById,
  createPromptSource,
  updatePromptSource,
  createPromptSyncRun,
  getPromptSyncRunById,
  listPromptSyncRuns,
  seedPromptsIfEmpty,
  listPromptCategories,
  getPromptCategoryBySlug,
  upsertPromptCategory,
  // gallery_tags
  listTags,
  getTagBySlug,
  countTags,
  findTagByAlias,
  createTag,
  updateTag,
  hideTag,
  mergeTag,
  migrateTagJsonSlugs,
  incrementTagUsage,
  seedTagsIfEmpty
};
