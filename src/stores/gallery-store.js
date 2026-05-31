"use strict";

function createGalleryStore({
  getPool,
  toIso,
  mapGeneration,
  mapGenerationReport,
  mapGalleryFileCheck,
  cancelFirstPublicReward
}) {
  function mapReferenceAsset(row) {
    if (!row) return null;
    return {
      id: row.id || "",
      userId: row.user_id || "",
      role: row.role || "reference",
      filename: row.filename || "",
      storedFilename: row.stored_filename || "",
      mimeType: row.mime_type || "",
      fileSize: Number(row.file_size || 0),
      width: row.width === null || row.width === undefined ? null : Number(row.width),
      height: row.height === null || row.height === undefined ? null : Number(row.height),
      sha256: row.sha256 || "",
      visibility: row.visibility || "private",
      status: row.status || "active",
      publicVisible: Boolean(row.public_visible || row.visibility === "public"),
      sortOrder: Number(row.sort_order || 0),
      generationId: row.generation_id || "",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    };
  }

  function normalizeAssetRole(value) {
    const role = String(value || "reference").trim();
    return ["reference", "source", "mask", "output"].includes(role) ? role : "reference";
  }

  function normalizeAssetVisibility(value) {
    const visibility = String(value || "private").trim();
    return ["private", "public"].includes(visibility) ? visibility : "private";
  }

  function normalizeAssetStatus(value) {
    const status = String(value || "active").trim();
    return ["active", "archived"].includes(status) ? status : "active";
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

  async function createReferenceAsset(user, input = {}) {
    if (!user?.id || !input.id || !input.storedFilename) return null;
    const now = input.createdAt ? new Date(input.createdAt) : new Date();
    await getPool().execute(
      `INSERT INTO reference_assets
        (id, user_id, role, filename, stored_filename, mime_type, file_size, width, height, sha256, visibility, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        user.id,
        normalizeAssetRole(input.role),
        String(input.filename || "reference-image").slice(0, 255),
        String(input.storedFilename || "").slice(0, 255),
        String(input.mimeType || "").slice(0, 80),
        Math.max(0, Number(input.fileSize || 0)),
        input.width === null || input.width === undefined ? null : Math.max(0, Number(input.width || 0)),
        input.height === null || input.height === undefined ? null : Math.max(0, Number(input.height || 0)),
        String(input.sha256 || "").slice(0, 64),
        normalizeAssetVisibility(input.visibility),
        normalizeAssetStatus(input.status),
        now,
        now
      ]
    );
    return getReferenceAssetById(input.id);
  }

  async function listReferenceAssetsForUser(user, filters = {}) {
    if (!user?.id) return [];
    const normalizedLimit = Math.max(1, Math.min(200, Number(filters.limit) || 60));
    const values = [user.id];
    const where = ["user_id = ?"];
    const role = String(filters.role || "").trim();
    if (role) {
      where.push("role = ?");
      values.push(normalizeAssetRole(role));
    }
    if (filters.includeArchived !== true) {
      where.push("status = 'active'");
    }
    const [rows] = await getPool().execute(
      `SELECT * FROM reference_assets
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT ${normalizedLimit}`,
      values
    );
    return rows.map(mapReferenceAsset);
  }

  async function getReferenceAssetById(id) {
    const assetId = String(id || "").trim();
    if (!assetId) return null;
    const [rows] = await getPool().execute(
      "SELECT * FROM reference_assets WHERE id = ? LIMIT 1",
      [assetId]
    );
    return mapReferenceAsset(rows[0]);
  }

  async function canReadReferenceAsset(assetOrId, viewer = {}) {
    const asset = typeof assetOrId === "object" && assetOrId
      ? assetOrId
      : await getReferenceAssetById(assetOrId);
    if (!asset || asset.status !== "active") return false;
    const viewerId = String(viewer.id || viewer.userId || "").trim();
    if (viewer.role === "admin" || asset.userId === viewerId || asset.visibility === "public") return true;
    const [rows] = await getPool().execute(
      `SELECT 1
         FROM generation_reference_assets gra
         INNER JOIN generations g ON g.id = gra.generation_id
        WHERE gra.asset_id = ?
          AND gra.public_visible = 1
          AND g.is_public = 1
          AND g.archived = 0
          AND g.moderation_status IN ('visible', 'restored')
        LIMIT 1`,
      [asset.id]
    );
    return rows.length > 0;
  }

  async function linkReferenceAssetToGeneration(generationId, assetId, options = {}) {
    const generation = String(generationId || "").trim();
    const asset = String(assetId || "").trim();
    if (!generation || !asset) return null;
    const role = normalizeAssetRole(options.role);
    const sortOrder = Math.max(0, Number(options.sortOrder || 0));
    const publicVisible = options.publicVisible === true ? 1 : 0;
    await getPool().execute(
      `INSERT INTO generation_reference_assets
          (generation_id, asset_id, role, sort_order, public_visible, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          role = VALUES(role),
          sort_order = VALUES(sort_order),
          public_visible = VALUES(public_visible)`,
      [generation, asset, role, sortOrder, publicVisible, new Date()]
    );
    const rows = await listReferenceAssetsForGeneration(generation, { role: "admin" });
    return rows.find((row) => row.id === asset) || null;
  }

  async function listReferenceAssetsForGeneration(generationId, viewer = {}) {
    const generation = String(generationId || "").trim();
    if (!generation) return [];
    const role = String(viewer.role || "").trim();
    const viewerId = String(viewer.id || viewer.userId || "").trim();
    const values = [generation];
    const where = ["gra.generation_id = ?", "ra.status = 'active'"];
    if (role !== "admin") {
      where.push("(gra.public_visible = 1 OR ra.visibility = 'public' OR ra.user_id = ?)");
      values.push(viewerId || "");
    }
    const [rows] = await getPool().execute(
      `SELECT ra.*, gra.generation_id, gra.role AS link_role, gra.sort_order, gra.public_visible
         FROM generation_reference_assets gra
         INNER JOIN reference_assets ra ON ra.id = gra.asset_id
        WHERE ${where.join(" AND ")}
        ORDER BY gra.sort_order ASC, gra.created_at ASC`,
      values
    );
    return rows.map((row) => mapReferenceAsset({
      ...row,
      role: row.link_role || row.role
    }));
  }

  async function updateReferenceAssetVisibility(assetId, visibility) {
    const id = String(assetId || "").trim();
    if (!id) return null;
    const normalized = normalizeAssetVisibility(visibility);
    await getPool().execute(
      "UPDATE reference_assets SET visibility = ?, updated_at = ? WHERE id = ?",
      [normalized, new Date(), id]
    );
    return getReferenceAssetById(id);
  }

  async function setReferenceAssetsPublicVisibleForGeneration(generationId, publicVisible) {
    const generation = String(generationId || "").trim();
    if (!generation) return [];
    await getPool().execute(
      "UPDATE generation_reference_assets SET public_visible = ? WHERE generation_id = ?",
      [publicVisible === true ? 1 : 0, generation]
    );
    return listReferenceAssetsForGeneration(generation, { role: "admin" });
  }

  async function deleteReferenceAsset(assetId, user = {}) {
    const id = String(assetId || "").trim();
    if (!id || !user?.id) return null;
    const existing = await getReferenceAssetById(id);
    if (!existing || (existing.userId !== user.id && user.role !== "admin")) return null;
    const values = user.role === "admin" ? [new Date(), id] : [new Date(), id, user.id];
    await getPool().execute(
      `UPDATE reference_assets SET status = 'archived', updated_at = ? WHERE id = ?
       ${user.role === "admin" ? "" : "AND user_id = ?"}`,
      values
    );
    return { ...existing, status: "archived" };
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

  return {
    listWithdrawalRequests,
    createGenerationReport,
    getGenerationReportById,
    listGenerationReports,
    markGenerationReportsHandled,
    listGalleryModeration,
    listGalleryFileCheckTargets,
    upsertGalleryFileCheck,
    getGalleryFileCheck,
    listGalleryFileChecks,
    listPublicGenerations,
    setGenerationLike,
    listGenerationLeaderboard,
    listGenerationLikeAnomalies,
    listReportedGenerations,
    getGenerationById,
    createReferenceAsset,
    listReferenceAssetsForUser,
    getReferenceAssetById,
    canReadReferenceAsset,
    linkReferenceAssetToGeneration,
    listReferenceAssetsForGeneration,
    updateReferenceAssetVisibility,
    setReferenceAssetsPublicVisibleForGeneration,
    deleteReferenceAsset,
    updateGenerationPublic,
    countTodayGenerations
  };
}

module.exports = createGalleryStore;
