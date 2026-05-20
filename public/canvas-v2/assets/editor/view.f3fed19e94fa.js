import { documentBounds, edgePath, minimapNodeRect, nodeSize, viewportRect } from "./geometry.7c0d820380ff.js";
import { fieldSpecsForNode, nodeSummary, nodeTypeLabel, supportedNodeTypes, upstreamNodeIds } from "./model.387f332cea0f.js";

const MINIMAP_SIZE = { width: 180, height: 120 };

export function renderEditor(state, { hasProject }) {
  const canvasDocument = state.document;
  const selectedNodeIds = new Set(state.selectedNodeIds || []);
  const selectedEdgeIds = new Set(state.selectedEdgeIds || []);
  const upstreamIds = new Set(upstreamNodeIds(canvasDocument, state.selectedNodeIds || []));
  const nodesById = new Map(canvasDocument.nodes.map((node) => [node.id, node]));
  const bounds = documentBounds(canvasDocument);
  const viewport = canvasDocument.viewport || { x: 0, y: 0, zoom: 1 };
  const disabled = hasProject ? "" : "disabled";
  const toolbarNodes = supportedNodeTypes().map((type) => `
    <button type="button" data-canvas-editor-action="add-node" data-node-type="${escapeAttr(type)}" ${disabled}>+ ${escapeHtml(nodeTypeLabel(type))}</button>
  `).join("");
  const edgeMarkup = canvasDocument.edges.map((edge) => {
    const path = edgePath(edge, nodesById);
    if (!path) return "";
    const selected = selectedEdgeIds.has(edge.id);
    return `<path class="canvas-v2-edge ${selected ? "selected" : ""}" d="${escapeAttr(path)}" data-canvas-edge-id="${escapeAttr(edge.id)}" />`;
  }).join("");
  const nodeMarkup = canvasDocument.nodes.map((node) => renderNode(node, {
    selected: selectedNodeIds.has(node.id),
    upstream: upstreamIds.has(node.id),
    connectionSource: state.connectionSourceId === node.id,
  })).join("");

  return `
    <div class="canvas-v2-editor-shell" data-canvas-editor>
      <div class="canvas-v2-editor-toolbar" data-canvas-editor-toolbar>
        <div class="canvas-v2-toolbar-group">${toolbarNodes}</div>
        <div class="canvas-v2-toolbar-group">
          <button type="button" data-canvas-editor-action="zoom-out" ${disabled}>-</button>
          <span data-canvas-zoom-readout>${Math.round((viewport.zoom || 1) * 100)}%</span>
          <button type="button" data-canvas-editor-action="zoom-in" ${disabled}>+</button>
          <button type="button" data-canvas-editor-action="reset-viewport" ${disabled}>重置视口</button>
        </div>
        <div class="canvas-v2-toolbar-group">
          <button type="button" data-canvas-editor-action="tool-pan" class="${state.editorTool === "pan" ? "active" : ""}" ${disabled}>平移</button>
          <button type="button" data-canvas-editor-action="tool-box-select" class="${state.editorTool === "box-select" ? "active" : ""}" ${disabled}>框选</button>
          <button type="button" data-canvas-editor-action="connect-selected" ${disabled}>连接选中</button>
          <button type="button" data-canvas-editor-action="duplicate-selection" ${disabled}>复制粘贴</button>
          <button type="button" data-canvas-editor-action="delete-selection" ${disabled}>删除</button>
          <button type="button" data-canvas-editor-action="seed-100" ${disabled}>100 节点检查</button>
        </div>
      </div>
      <div
        class="canvas-v2-editor-stage"
        data-canvas-stage
        tabindex="0"
        aria-label="Canvas v2 editor stage"
        style="--canvas-v2-viewport-x:${Number(viewport.x || 0)}px; --canvas-v2-viewport-y:${Number(viewport.y || 0)}px; --canvas-v2-zoom:${Number(viewport.zoom || 1)};">
        <div class="canvas-v2-grid-plane" data-canvas-plane>
          <svg
            class="canvas-v2-edge-layer"
            data-canvas-edge-layer
            viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}"
            style="left:${bounds.minX}px; top:${bounds.minY}px; width:${bounds.width}px; height:${bounds.height}px;"
            aria-hidden="true">
            ${edgeMarkup}
          </svg>
          ${nodeMarkup || renderEmptyState(hasProject)}
          ${renderSelectionMarquee(state)}
        </div>
        ${renderMinimap(canvasDocument, bounds, viewport)}
      </div>
      <p class="canvas-v2-mobile-note">窄屏降级：保留节点编辑、缩放按钮和项目保存；复杂框选建议在桌面视口完成。</p>
    </div>
  `;
}

function renderNode(node, flags) {
  const size = nodeSize(node);
  const specs = fieldSpecsForNode(node);
  const classes = [
    "canvas-v2-node",
    `type-${node.type}`,
    flags.selected ? "selected" : "",
    flags.upstream ? "upstream" : "",
    flags.connectionSource ? "connection-source" : "",
  ].filter(Boolean).join(" ");
  const fields = specs.map((spec) => `
    <label>
      <span>${escapeHtml(spec.label)}</span>
      <textarea
        data-canvas-node-field="${escapeAttr(spec.key)}"
        data-canvas-node-id="${escapeAttr(node.id)}"
        placeholder="${escapeAttr(spec.placeholder)}">${escapeHtml(node[spec.key] || "")}</textarea>
    </label>
  `).join("");
  return `
    <article
      class="${classes}"
      data-canvas-node-id="${escapeAttr(node.id)}"
      style="left:${Number(node.x || 0)}px; top:${Number(node.y || 0)}px; width:${size.width}px; height:${size.height}px;">
      <button type="button" class="canvas-v2-port input" data-canvas-port="input" data-canvas-node-id="${escapeAttr(node.id)}" aria-label="Input port"></button>
      <button type="button" class="canvas-v2-port output" data-canvas-port="output" data-canvas-node-id="${escapeAttr(node.id)}" aria-label="Output port"></button>
      <header data-canvas-drag-handle>
        <strong>${escapeHtml(nodeTypeLabel(node.type))}</strong>
        <small>${escapeHtml(node.id)}</small>
      </header>
      <div class="canvas-v2-node-body">
        ${fields}
        <p>${escapeHtml(nodeSummary(node))}</p>
      </div>
      <button type="button" class="canvas-v2-node-resize" data-canvas-node-resize data-canvas-node-id="${escapeAttr(node.id)}" aria-label="Resize node"></button>
    </article>
  `;
}

function renderEmptyState(hasProject) {
  return `
    <div class="canvas-v2-empty-editor">
      <h2>${hasProject ? "添加节点开始组织创作线路" : "新建或打开画布后开始编辑"}</h2>
      <p>Canvas v2 支持节点、连线、缩放、平移、框选、多选和小地图。</p>
    </div>
  `;
}

function renderSelectionMarquee(state) {
  const rect = state.selectionRect;
  if (!rect) return "";
  const left = Math.min(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);
  return `<div class="canvas-v2-selection-rect" data-canvas-selection-rect style="left:${left}px; top:${top}px; width:${width}px; height:${height}px;"></div>`;
}

function renderMinimap(canvasDocument, bounds, viewport) {
  const viewportBox = viewportRect(viewport, { width: 860, height: 520 }, bounds, MINIMAP_SIZE);
  const nodes = canvasDocument.nodes.map((node) => {
    const rect = minimapNodeRect(node, bounds, MINIMAP_SIZE);
    return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="2" />`;
  }).join("");
  return `
    <svg class="canvas-v2-minimap" data-canvas-minimap viewBox="0 0 ${MINIMAP_SIZE.width} ${MINIMAP_SIZE.height}" role="img" aria-label="Canvas minimap">
      <rect class="canvas-v2-minimap-bg" x="0" y="0" width="${MINIMAP_SIZE.width}" height="${MINIMAP_SIZE.height}" rx="12" />
      <g class="canvas-v2-minimap-nodes">${nodes}</g>
      <rect class="canvas-v2-minimap-viewport" x="${viewportBox.x}" y="${viewportBox.y}" width="${viewportBox.width}" height="${viewportBox.height}" rx="4" />
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
