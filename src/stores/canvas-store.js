"use strict";

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

  return {
    getCanvasProjectForGeneration,
    getPublicGenerationForCanvas,
    listCanvasProjectsForUser,
    getCanvasProjectById,
    createCanvasProject,
    updateCanvasProject,
    deleteCanvasProject,
    createCanvasGenerationLinks
  };
}

module.exports = createCanvasStore;
