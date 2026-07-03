// SPDX-License-Identifier: AGPL-3.0-or-later
"use strict";

const crypto = require("crypto");

const CANVAS_PAYLOAD_SPLIT_LANDED_AT = Date.parse("2026-07-02T00:00:00.000Z");
const CANVAS_PAYLOAD_READ_SWITCH_AT = CANVAS_PAYLOAD_SPLIT_LANDED_AT + 7 * 24 * 60 * 60 * 1000;
const CANVAS_SNAPSHOT_RETAIN = 20;
const CANVAS_NODE_IMAGE_KEYS = ["imageUrl", "sourceImage", "sourceImageUrl", "coverUrl", "thumbnailUrl"];

function createCanvasStore({ getPool, toIso, mapGeneration }) {
  function parseJsonObject(value, fallback = {}) {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function bufferToString(value) {
    if (!value) return "";
    if (Buffer.isBuffer(value)) return value.toString("utf8");
    if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
    return String(value || "");
  }

  function payloadTextForRow(row = {}) {
    const legacy = String(row.data_json || "");
    const payload = bufferToString(row.payload_data);
    if (Date.now() >= CANVAS_PAYLOAD_READ_SWITCH_AT) return payload || legacy;
    return legacy || payload;
  }

  function payloadTextForStorage(value = {}) {
    return JSON.stringify(value && typeof value === "object" && !Array.isArray(value) ? value : {});
  }

  function payloadChecksum(text) {
    return crypto.createHash("sha256").update(String(text || "")).digest("hex");
  }

  function mapCanvasProject(row = {}) {
    if (!row) return null;
    const payloadText = payloadTextForRow(row);
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
      forkCount: Number(row.fork_count || 0),
      lastForkedAt: toIso(row.last_forked_at),
      dataJson: parseJsonObject(payloadText, {}),
      nodeCount: Number(row.node_count || 0),
      edgeCount: Number(row.edge_count || 0),
      status: row.status || "active",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    };
  }

  function mapCanvasSnapshot(row = {}) {
    if (!row) return null;
    return {
      id: Number(row.id || 0),
      canvasId: row.canvas_id || "",
      versionNo: Number(row.version_no || 0),
      title: row.title || "",
      nodeCount: Number(row.node_count || 0),
      edgeCount: Number(row.edge_count || 0),
      dataJson: parseJsonObject(bufferToString(row.data), {}),
      meta: parseJsonObject(row.meta_json, {}),
      createdAt: toIso(row.created_at)
    };
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

  async function listCanvasProjectsForUser(user, { limit = 100, scope = "mine" } = {}) {
    const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    const params = [];
    const where = ["c.status = 'active'"];
    if (scope === "templates") {
      where.push("c.visibility = 'public'");
      where.push("c.is_template = 1");
    } else if (scope === "my-templates") {
      where.push("c.user_id = ?");
      where.push("c.is_template = 1");
      params.push(user.id);
    } else if (scope === "public" && user?.role === "admin") {
      where.push("c.visibility = 'public'");
    } else {
      where.push("c.user_id = ?");
      params.push(user.id);
    }
    const [rows] = await getPool().execute(
      `SELECT c.*, p.data AS payload_data, u.name AS user_name, u.email AS user_email
         FROM canvas_projects c
         LEFT JOIN canvas_project_payloads p ON p.canvas_id = c.id
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
      `SELECT c.*, p.data AS payload_data, u.name AS user_name, u.email AS user_email
         FROM canvas_projects c
         LEFT JOIN canvas_project_payloads p ON p.canvas_id = c.id
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
    const payloadText = payloadTextForStorage(values.dataJson);
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
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
          payloadText,
          values.nodeCount,
          values.edgeCount,
          now,
          now
        ]
      );
      await upsertCanvasPayload(connection, input.id, payloadText, now);
      await insertCanvasSnapshot(connection, input.id, values, payloadText, now);
      await syncCanvasNodeImages(connection, input.id, values.dataJson, now);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
      const payloadText = payloadTextForStorage(values.dataJson);
      columns.push("data_json = ?");
      params.push(payloadText);
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
    const now = new Date();
    params.push(now, String(id || ""));
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(`UPDATE canvas_projects SET ${columns.join(", ")} WHERE id = ?`, params);
      if (Object.hasOwn(patch, "dataJson") || Object.hasOwn(patch, "data")) {
        const payloadText = payloadTextForStorage(values.dataJson);
        await upsertCanvasPayload(connection, id, payloadText, now);
        await insertCanvasSnapshot(connection, id, values, payloadText, now);
        await syncCanvasNodeImages(connection, id, values.dataJson, now);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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

  async function upsertCanvasPayload(db, canvasId, payloadText, now) {
    await db.execute(
      `INSERT INTO canvas_project_payloads
          (canvas_id, data, checksum_sha256, byte_length, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
          data = VALUES(data),
          checksum_sha256 = VALUES(checksum_sha256),
          byte_length = VALUES(byte_length),
          updated_at = VALUES(updated_at)`,
      [
        String(canvasId || ""),
        Buffer.from(String(payloadText || "{}"), "utf8"),
        payloadChecksum(payloadText),
        Buffer.byteLength(String(payloadText || "{}"), "utf8"),
        now,
        now
      ]
    );
  }

  async function insertCanvasSnapshot(db, canvasId, values, payloadText, now) {
    const [versions] = await db.execute(
      "SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version FROM canvas_project_snapshots WHERE canvas_id = ?",
      [String(canvasId || "")]
    );
    const versionNo = Number(versions?.[0]?.next_version || 1);
    await db.execute(
      `INSERT INTO canvas_project_snapshots
          (canvas_id, version_no, title, node_count, edge_count, data, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(canvasId || ""),
        versionNo,
        values.title,
        values.nodeCount,
        values.edgeCount,
        Buffer.from(String(payloadText || "{}"), "utf8"),
        JSON.stringify({
          description: values.description,
          coverUrl: values.coverUrl,
          visibility: values.visibility,
          isTemplate: values.isTemplate
        }),
        now
      ]
    );
    await db.execute(
      `DELETE FROM canvas_project_snapshots
        WHERE canvas_id = ?
          AND id NOT IN (
            SELECT id FROM (
              SELECT id
                FROM canvas_project_snapshots
               WHERE canvas_id = ?
               ORDER BY version_no DESC, id DESC
               LIMIT ${CANVAS_SNAPSHOT_RETAIN}
            ) keep_rows
          )`,
      [String(canvasId || ""), String(canvasId || "")]
    );
  }

  function extractCanvasNodeImages(dataJson = {}) {
    const nodes = Array.isArray(dataJson.nodes) ? dataJson.nodes : [];
    const images = [];
    for (const node of nodes) {
      const data = node?.data && typeof node.data === "object" && !Array.isArray(node.data) ? node.data : {};
      for (const key of CANVAS_NODE_IMAGE_KEYS) {
        const imageUrl = String(data[key] ?? node?.[key] ?? "").trim();
        if (!imageUrl) continue;
        images.push({
          nodeId: String(node.id || "").slice(0, 160),
          nodeType: String(node.type || "").slice(0, 64),
          sourceKey: key,
          imageUrl: imageUrl.slice(0, 1000)
        });
      }
    }
    return images.filter((item) => item.nodeId && item.imageUrl);
  }

  async function syncCanvasNodeImages(db, canvasId, dataJson, now) {
    const images = extractCanvasNodeImages(dataJson);
    await db.execute("DELETE FROM canvas_node_images WHERE canvas_id = ?", [String(canvasId || "")]);
    for (const image of images) {
      await db.execute(
        `INSERT INTO canvas_node_images
            (canvas_id, node_id, node_type, source_key, image_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            node_type = VALUES(node_type),
            image_url = VALUES(image_url),
            updated_at = VALUES(updated_at)`,
        [
          String(canvasId || ""),
          image.nodeId,
          image.nodeType,
          image.sourceKey,
          image.imageUrl,
          now,
          now
        ]
      );
    }
  }

  async function listCanvasProjectSnapshots(id, { limit = CANVAS_SNAPSHOT_RETAIN } = {}) {
    const normalizedLimit = Math.max(1, Math.min(CANVAS_SNAPSHOT_RETAIN, Number(limit) || CANVAS_SNAPSHOT_RETAIN));
    const [rows] = await getPool().execute(
      `SELECT *
         FROM canvas_project_snapshots
        WHERE canvas_id = ?
        ORDER BY version_no DESC, id DESC
        LIMIT ${normalizedLimit}`,
      [String(id || "")]
    );
    return rows.map(mapCanvasSnapshot);
  }

  async function restoreCanvasProjectSnapshot(id, snapshotId) {
    const [rows] = await getPool().execute(
      "SELECT * FROM canvas_project_snapshots WHERE id = ? AND canvas_id = ? LIMIT 1",
      [Number(snapshotId || 0), String(id || "")]
    );
    const snapshot = mapCanvasSnapshot(rows[0]);
    if (!snapshot) return null;
    return updateCanvasProject(id, {
      title: snapshot.title,
      dataJson: snapshot.dataJson,
      nodeCount: snapshot.nodeCount,
      edgeCount: snapshot.edgeCount
    });
  }

  async function createCanvasGenerationLinks({
    canvasId,
    generationIds = [],
    outputNodeId = "",
    configNodeId = "",
    status = "succeeded",
    requestId = "",
    candidateCount = 1
  } = {}) {
    const ids = Array.from(new Set((generationIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
    if (!canvasId || !ids.length) return [];
    const now = new Date();
    for (const generationId of ids) {
      const params = [
        String(canvasId || ""),
        generationId,
        String(outputNodeId || "").slice(0, 160),
        String(configNodeId || "").slice(0, 160),
        String(requestId || "").slice(0, 32),
        normalizeLinkStatus(status),
        Math.max(1, Math.min(16, Math.floor(Number(candidateCount) || ids.length || 1))),
        now,
        now
      ];
      try {
        await getPool().execute(
          `INSERT INTO canvas_generation_links
            (canvas_id, generation_id, output_node_id, config_node_id, request_id, status, candidate_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             output_node_id = VALUES(output_node_id),
             config_node_id = VALUES(config_node_id),
             request_id = VALUES(request_id),
             status = VALUES(status),
             candidate_count = VALUES(candidate_count),
             updated_at = VALUES(updated_at)`,
          params
        );
      } catch (error) {
        if (!/unknown column|ER_BAD_FIELD_ERROR/i.test(String(error?.message || error))) throw error;
        await getPool().execute(
          `INSERT IGNORE INTO canvas_generation_links
            (canvas_id, generation_id, output_node_id, config_node_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          params.slice(0, 4).concat(now)
        );
      }
    }
    return ids;
  }

  function normalizeLinkStatus(value) {
    const statusValue = String(value || "").trim().toLowerCase();
    return ["queued", "running", "succeeded", "failed", "cancelled"].includes(statusValue) ? statusValue : "succeeded";
  }

  async function incrementCanvasForkStats(id) {
    await getPool().execute(
      "UPDATE canvas_projects SET fork_count = fork_count + 1, last_forked_at = ? WHERE id = ? AND status = 'active'",
      [new Date(), String(id || "")]
    );
  }

  return {
    getCanvasProjectForGeneration,
    getPublicGenerationForCanvas,
    listCanvasProjectsForUser,
    getCanvasProjectById,
    createCanvasProject,
    updateCanvasProject,
    deleteCanvasProject,
    listCanvasProjectSnapshots,
    restoreCanvasProjectSnapshot,
    createCanvasGenerationLinks,
    incrementCanvasForkStats
  };
}

module.exports = {
  createCanvasStore
};
