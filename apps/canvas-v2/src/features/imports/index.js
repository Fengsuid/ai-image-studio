import { normalizeCanvasDocument, CANVAS_V1_SCHEMA } from "../../adapters/canvas-schema.js";

export function parseImportedJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { error: "JSON 解析失败：" + error.message, document: null };
  }

  if (!parsed || typeof parsed !== "object") {
    return { error: "导入数据格式无效：期望 JSON 对象。", document: null };
  }

  const dataJson = parsed.dataJson || parsed;

  if (dataJson.schema && dataJson.schema !== CANVAS_V1_SCHEMA) {
    return { error: `不支持的 schema：${dataJson.schema}，期望 ${CANVAS_V1_SCHEMA}。`, document: null };
  }

  const title = dataJson.title || parsed.title || "Imported canvas";
  const document = normalizeCanvasDocument(dataJson, title);

  if (!document.nodes.length && !document.edges.length) {
    return { error: "导入的画布为空：没有有效节点或连线。", document: null };
  }

  return { error: "", document };
}

export function triggerFileImport() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement("input"), {
      type: "file",
      accept: ".json,application/json",
    });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) { resolve({ error: "未选择文件。", document: null }); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(parseImportedJson(reader.result));
      reader.onerror = () => resolve({ error: "文件读取失败。", document: null });
      reader.readAsText(file);
    });
    input.click();
  });
}
