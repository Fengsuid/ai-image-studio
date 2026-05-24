"use strict";

const crypto = require("crypto");

function createPromptStore({ getPool, toIso }) {
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

  function promptDisplayDedupeKey(prompt = {}) {
    const normalizedHash = String(prompt.normalizedHash || prompt.normalized_hash || "").trim().toLowerCase();
    if (normalizedHash) return `hash:${normalizedHash}`;
    const promptText = normalizePromptForQuality(prompt.prompt || "");
    if (promptText) {
      return `prompt:${crypto.createHash("sha256").update(promptText).digest("hex")}`;
    }
    const sourceRepo = String(prompt.sourceRepo || prompt.source_repo || "").trim().toLowerCase();
    const remoteId = String(prompt.remoteId || prompt.remote_id || "").trim().toLowerCase();
    if (sourceRepo && remoteId) return `remote:${sourceRepo}:${remoteId}`;
    const image = String(prompt.preview || prompt.image || prompt.coverUrl || "").trim().toLowerCase();
    if (image && sourceRepo) return `image:${sourceRepo}:${image}`;
    return `id:${prompt.id || ""}`;
  }

  function promptHasDisplayImage(prompt = {}) {
    return Boolean(String(prompt.preview || prompt.image || prompt.coverUrl || prompt.imageUrl || "").trim());
  }

  function uniquePromptsForDisplay(prompts = [], limit = 500) {
    const seen = new Map();
    const unique = [];
    for (const prompt of prompts) {
      const key = promptDisplayDedupeKey(prompt);
      if (seen.has(key)) {
        const existingIndex = seen.get(key);
        if (promptHasDisplayImage(prompt) && !promptHasDisplayImage(unique[existingIndex])) {
          unique[existingIndex] = prompt;
        }
        continue;
      }
      if (unique.length >= limit) continue;
      seen.set(key, unique.length);
      unique.push(prompt);
    }
    return unique;
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

  async function listPrompts({ includeHidden = false, limit = 500, sort = "default", currentUserId = "", requireImage = false } = {}) {
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    const selectLimit = Math.min(8000, Math.max(safeLimit, safeLimit * 4));
    const where = [];
    if (!includeHidden) where.push("p.status = 'active'");
    if (requireImage) where.push("(p.preview <> '' OR p.image <> '')");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
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
         ${whereSql}
         ${order}
         LIMIT ${selectLimit}`,
      currentUserId ? [currentUserId] : []
    );
    return uniquePromptsForDisplay(rows.map(mapPrompt), safeLimit);
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

  async function listPromptImageLeaderboard({ range = "all", limit = 50, currentUserId = "", includeHidden = false } = {}) {
    const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const selectLimit = Math.min(400, Math.max(normalizedLimit, normalizedLimit * 4));
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
        LIMIT ${selectLimit}`,
      values
    );
    return uniquePromptsForDisplay(
      rows.map((row) => mapPrompt({ ...row, like_count: row.leaderboard_like_count ?? row.like_count })),
      normalizedLimit
    );
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

  return {
    listPrompts,
    getPromptById,
    setPromptLike,
    incrementPromptUse,
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
    refreshPromptFingerprints,
    scanPromptDuplicateCandidates,
    scanPromptDuplicateCandidatesForPrompt,
    listPromptImageLeaderboard,
    listPromptDuplicateCandidates,
    getPromptDuplicateCandidateById,
    reviewPromptDuplicateCandidate,
    updatePromptDuplicateAiReview,
    auditPromptForPublish,
    createPromptAuditRecord,
    listPromptAuditRecords,
    getPromptAuditRecordById,
    reviewPromptAuditRecord,
    seedPromptsIfEmpty
  };
}

module.exports = createPromptStore;
