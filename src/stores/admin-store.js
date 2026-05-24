"use strict";

function createAdminStore({
  getPool,
  mapSettings,
  mapProviderConfig,
  mapAdminAuditLog,
  mapAnnouncement,
  maskSecret,
  getDefaultModel
}) {
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
      firstPublicRewardCredit: "first_public_reward_credit",
      publicRewardHoldMinutes: "public_reward_hold_minutes",
      publicUnpublishAllowed: "public_unpublish_allowed",
      publicRewardNotificationsEnabled: "public_reward_notifications_enabled",
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
      defaultModel: String(input.defaultModel || existing.defaultModel || getDefaultModel()).trim().slice(0, 120),
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
      if (key === "isImportant" || key === "requiresAck") values.push(patch[key] ? 1 : 0);
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

  return {
    getSettings,
    updateSettings,
    listProviderConfigs,
    getProviderConfigById,
    getDefaultProviderConfig,
    createProviderConfig,
    updateProviderConfig,
    deleteProviderConfig,
    setDefaultProviderConfig,
    updateProviderHealth,
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
    countUnreadAnnouncements
  };
}

module.exports = createAdminStore;
