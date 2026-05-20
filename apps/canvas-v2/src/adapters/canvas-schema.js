export const CANVAS_V1_SCHEMA = "ai-image-studio.canvas.v1";

export function createEmptyCanvasDocument(title) {
  return {
    schema: CANVAS_V1_SCHEMA,
    version: 1,
    title,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    nodes: [],
    edges: [],
    meta: {
      source: "canvas-v2",
      updatedBy: "client",
    },
  };
}

export function isPersistableImageUrl(value) {
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  return value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://");
}
