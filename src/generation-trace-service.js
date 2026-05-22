const SECRET_KEY_RE = /(api[_-]?key|authorization|bearer|token|cookie|password|secret|signature|sig|x-api-key)/i;
const SIGNED_QUERY_RE = /(sig|signature|token|x-amz-signature|x-amz-credential|x-amz-security-token|expires|se|sp|sv|x-goog-signature|x-goog-credential)/i;
const MAX_STRING_LENGTH = 600;
const MAX_ARRAY_ITEMS = 12;
const MAX_OBJECT_KEYS = 32;
const MAX_DEPTH = 5;

function redactString(value) {
  const text = String(value || "");
  if (/bearer\s+[a-z0-9._~+/=-]+/i.test(text)) return "[redacted]";
  if (/sk-[A-Za-z0-9_-]{12,}/.test(text)) return "[redacted]";
  if (/session=|csrf=|password=/i.test(text)) return "[redacted]";
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      for (const key of [...url.searchParams.keys()]) {
        if (SIGNED_QUERY_RE.test(key)) url.searchParams.set(key, "[redacted]");
      }
      return url.toString().slice(0, MAX_STRING_LENGTH);
    } catch {
      return text.slice(0, MAX_STRING_LENGTH);
    }
  }
  return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}...` : text;
}

function sanitizeTraceData(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeTraceData(item, depth + 1));
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      output[key] = SECRET_KEY_RE.test(key) ? "[redacted]" : sanitizeTraceData(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

function safeJsonSummary(value) {
  const sanitized = sanitizeTraceData(value);
  const json = JSON.stringify(sanitized);
  if (!json || json.length <= 8000) return sanitized;
  return {
    truncated: true,
    preview: json.slice(0, 8000)
  };
}

function normalizeTraceLevel(level) {
  return ["debug", "info", "warn", "error"].includes(level) ? level : "info";
}

function errorSummary(error) {
  if (!error) return {};
  return sanitizeTraceData({
    name: error.name || "Error",
    code: error.code || error.status || "",
    message: String(error.message || error).slice(0, 1000),
    status: error.status || ""
  });
}

module.exports = {
  errorSummary,
  normalizeTraceLevel,
  safeJsonSummary,
  sanitizeTraceData
};
