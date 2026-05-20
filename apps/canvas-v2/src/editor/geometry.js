export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

export function clampZoom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(number * 100) / 100));
}

export function screenToCanvas(point, viewport) {
  const zoom = clampZoom(viewport.zoom);
  return {
    x: (point.x - viewport.x) / zoom,
    y: (point.y - viewport.y) / zoom,
  };
}

export function zoomViewportAt(viewport, zoom, origin) {
  const currentZoom = clampZoom(viewport.zoom);
  const nextZoom = clampZoom(zoom);
  const canvasPoint = {
    x: (origin.x - viewport.x) / currentZoom,
    y: (origin.y - viewport.y) / currentZoom,
  };
  return {
    x: round(origin.x - canvasPoint.x * nextZoom),
    y: round(origin.y - canvasPoint.y * nextZoom),
    zoom: nextZoom,
  };
}

export function nodeSize(node) {
  return {
    width: finiteNumber(node?.width, 240),
    height: finiteNumber(node?.height, 150),
  };
}

export function portPosition(node, kind) {
  const size = nodeSize(node);
  return {
    x: kind === "input" ? finiteNumber(node.x, 0) : finiteNumber(node.x, 0) + size.width,
    y: finiteNumber(node.y, 0) + size.height / 2,
  };
}

export function edgePath(edge, nodesById) {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return "";
  const start = portPosition(source, "output");
  const end = portPosition(target, "input");
  const distance = Math.max(80, Math.abs(end.x - start.x) * 0.45);
  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `C ${round(start.x + distance)} ${round(start.y)}`,
    `${round(end.x - distance)} ${round(end.y)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

export function documentBounds(canvasDocument) {
  const nodes = Array.isArray(canvasDocument?.nodes) ? canvasDocument.nodes : [];
  if (!nodes.length) return { minX: -240, minY: -180, maxX: 960, maxY: 720, width: 1200, height: 900 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const size = nodeSize(node);
    minX = Math.min(minX, finiteNumber(node.x, 0));
    minY = Math.min(minY, finiteNumber(node.y, 0));
    maxX = Math.max(maxX, finiteNumber(node.x, 0) + size.width);
    maxY = Math.max(maxY, finiteNumber(node.y, 0) + size.height);
  }
  minX -= 180;
  minY -= 140;
  maxX += 180;
  maxY += 140;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function minimapProject(point, bounds, size = { width: 180, height: 120 }) {
  return {
    x: round(((point.x - bounds.minX) / Math.max(1, bounds.width)) * size.width),
    y: round(((point.y - bounds.minY) / Math.max(1, bounds.height)) * size.height),
  };
}

export function minimapNodeRect(node, bounds, size = { width: 180, height: 120 }) {
  const start = minimapProject({ x: node.x, y: node.y }, bounds, size);
  const nodeBox = nodeSize(node);
  return {
    x: start.x,
    y: start.y,
    width: Math.max(3, round((nodeBox.width / Math.max(1, bounds.width)) * size.width)),
    height: Math.max(3, round((nodeBox.height / Math.max(1, bounds.height)) * size.height)),
  };
}

export function viewportRect(viewport, stageSize, bounds, minimapSize = { width: 180, height: 120 }) {
  const zoom = clampZoom(viewport.zoom);
  const topLeft = screenToCanvas({ x: 0, y: 0 }, viewport);
  const bottomRight = screenToCanvas({ x: stageSize.width, y: stageSize.height }, viewport);
  const start = minimapProject(topLeft, bounds, minimapSize);
  const end = minimapProject(bottomRight, bounds, minimapSize);
  return {
    x: Math.max(0, Math.min(start.x, end.x)),
    y: Math.max(0, Math.min(start.y, end.y)),
    width: Math.min(minimapSize.width, Math.max(8, Math.abs(end.x - start.x))),
    height: Math.min(minimapSize.height, Math.max(8, Math.abs(end.y - start.y))),
    zoom,
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
