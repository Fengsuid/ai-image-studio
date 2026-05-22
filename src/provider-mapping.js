const ALLOWED_MODES = new Set(["openai-compatible", "async-task"]);
const ALLOWED_METHODS = new Set(["GET", "POST"]);
const TEMPLATE_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
const EXACT_TEMPLATE_RE = /^\s*\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}\s*$/;

function mappingError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMethod(value, fallback = "POST") {
  const method = String(value || fallback).trim().toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw mappingError(`Provider mapping method is not supported: ${method}`);
  }
  return method;
}

function validateRelativePath(path, label) {
  const value = String(path || "").trim();
  if (!value || !value.startsWith("/") || value.startsWith("//") || /^https?:\/\//i.test(value)) {
    throw mappingError(`${label} must be a relative HTTP path beginning with /`);
  }
  return value;
}

function parseJsonPath(path) {
  const value = String(path || "").trim();
  if (!value) return [];
  if (value[0] !== "$") throw mappingError(`JSON path must start with $: ${value}`);
  const tokens = [];
  let index = 1;
  while (index < value.length) {
    const char = value[index];
    if (char === ".") {
      index += 1;
      const start = index;
      while (index < value.length && /[A-Za-z0-9_$-]/.test(value[index])) index += 1;
      const key = value.slice(start, index);
      if (!key || !/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key)) {
        throw mappingError(`Unsupported JSON path property near: ${value.slice(start)}`);
      }
      tokens.push({ type: "property", key });
      continue;
    }
    if (char === "[") {
      const close = value.indexOf("]", index);
      if (close === -1) throw mappingError(`Unclosed JSON path bracket: ${value}`);
      const raw = value.slice(index + 1, close).trim();
      if (/^\d+$/.test(raw)) {
        tokens.push({ type: "index", index: Number(raw) });
      } else {
        const match = raw.match(/^["']([A-Za-z_$][A-Za-z0-9_$-]*)["']$/);
        if (!match) throw mappingError(`Unsupported JSON path bracket token: ${raw}`);
        tokens.push({ type: "property", key: match[1] });
      }
      index = close + 1;
      continue;
    }
    throw mappingError(`Unsupported JSON path syntax near: ${value.slice(index)}`);
  }
  return tokens;
}

function getJsonPathValue(source, path) {
  if (!path) return undefined;
  const tokens = parseJsonPath(path);
  let current = source;
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (token.type === "property") {
      if (typeof current !== "object" || !(token.key in current)) return undefined;
      current = current[token.key];
    } else if (token.type === "index") {
      if (!Array.isArray(current) || token.index >= current.length) return undefined;
      current = current[token.index];
    }
  }
  return current;
}

function validateJsonPath(path, label) {
  if (!path) return "";
  parseJsonPath(path);
  return String(path).trim();
}

function validateResultMapping(config = {}, label = "result") {
  if (!isPlainObject(config)) return {};
  return {
    imageUrlPath: validateJsonPath(config.imageUrlPath, `${label}.imageUrlPath`),
    b64JsonPath: validateJsonPath(config.b64JsonPath, `${label}.b64JsonPath`),
    revisedPromptPath: validateJsonPath(config.revisedPromptPath, `${label}.revisedPromptPath`)
  };
}

function validateTemplate(value, label = "bodyTemplate", depth = 0) {
  if (depth > 8) throw mappingError(`${label} is too deeply nested`);
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item, index) => validateTemplate(item, `${label}[${index}]`, depth + 1));
  if (!isPlainObject(value)) throw mappingError(`${label} must be JSON-compatible`);
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_$.-]{1,80}$/.test(key)) throw mappingError(`${label} contains an unsupported key: ${key}`);
    output[key] = validateTemplate(item, `${label}.${key}`, depth + 1);
  }
  return output;
}

function normalizeProviderMapping(mapping = {}) {
  if (!mapping || !isPlainObject(mapping) || !Object.keys(mapping).length) return {};
  const mode = String(mapping.mode || "openai-compatible").trim();
  if (!ALLOWED_MODES.has(mode)) throw mappingError(`Provider mapping mode is not supported: ${mode}`);
  if (!isPlainObject(mapping.submit)) throw mappingError("Provider mapping submit config is required");
  const submit = {
    method: normalizeMethod(mapping.submit.method, "POST"),
    path: validateRelativePath(mapping.submit.path, "submit.path")
  };
  if (Object.hasOwn(mapping.submit, "bodyTemplate")) {
    submit.bodyTemplate = validateTemplate(mapping.submit.bodyTemplate);
  }

  if (mode === "openai-compatible") {
    return {
      mode,
      submit,
      result: validateResultMapping(mapping.result || {}, "result")
    };
  }

  submit.taskIdPath = validateJsonPath(mapping.submit.taskIdPath, "submit.taskIdPath");
  if (!submit.taskIdPath) throw mappingError("Async provider mapping requires submit.taskIdPath");
  if (!isPlainObject(mapping.poll)) throw mappingError("Async provider mapping requires poll config");
  const poll = {
    method: normalizeMethod(mapping.poll.method, "GET"),
    path: validateRelativePath(mapping.poll.path, "poll.path"),
    statusPath: validateJsonPath(mapping.poll.statusPath, "poll.statusPath"),
    successValues: normalizeStatusValues(mapping.poll.successValues, ["succeeded", "success", "completed", "done"]),
    failedValues: normalizeStatusValues(mapping.poll.failedValues, ["failed", "error", "cancelled", "canceled"]),
    intervalMs: Math.max(10, Math.min(10000, Number(mapping.poll.intervalMs || 1000))),
    maxAttempts: Math.max(1, Math.min(120, Number(mapping.poll.maxAttempts || 30))),
    ...validateResultMapping(mapping.poll, "poll")
  };
  if (!poll.statusPath) throw mappingError("Async provider mapping requires poll.statusPath");
  if (Object.hasOwn(mapping.poll, "bodyTemplate")) {
    poll.bodyTemplate = validateTemplate(mapping.poll.bodyTemplate, "poll.bodyTemplate");
  }
  return { mode, submit, poll };
}

function normalizeStatusValues(values, fallback) {
  const source = Array.isArray(values) ? values : fallback;
  return source.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 20);
}

function renderTemplateValue(value, context = {}) {
  if (typeof value === "string") {
    const exact = value.match(EXACT_TEMPLATE_RE);
    if (exact) return context[exact[1]] ?? "";
    return value.replace(TEMPLATE_RE, (_, key) => String(context[key] ?? ""));
  }
  if (Array.isArray(value)) return value.map((item) => renderTemplateValue(item, context));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderTemplateValue(item, context)]));
  }
  return value;
}

function templateContext(payload = {}, extra = {}) {
  const outputFormat = payload.output_format ?? payload.outputFormat ?? "png";
  return {
    model: payload.model || "",
    prompt: payload.prompt || "",
    n: payload.n ?? 1,
    size: payload.size || "auto",
    quality: payload.quality || "auto",
    background: payload.background || "auto",
    output_format: outputFormat,
    outputFormat,
    ...extra
  };
}

function endpointFromPath(baseUrl, path, context = {}) {
  const cleanBase = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!cleanBase) throw mappingError("Provider base URL is required");
  const renderedPath = renderTemplateValue(path, context);
  validateRelativePath(renderedPath, "mapping path");
  return `${cleanBase}${renderedPath}`;
}

function requestBodyFromTemplate(config = {}, payload = {}, context = {}) {
  if (!Object.hasOwn(config, "bodyTemplate")) return payload;
  return renderTemplateValue(config.bodyTemplate, context);
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function defaultFetchJson(_label, endpoint, init) {
  return fetch(endpoint, init);
}

async function fetchJson({
  apiKey = "",
  body,
  endpoint,
  fetchFn = defaultFetchJson,
  label = "Provider mapping request",
  method = "POST",
  signal
}) {
  const headers = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const init = { method, headers, signal };
  if (method !== "GET" && body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetchFn(label, endpoint, init);
  const data = await readJsonResponse(response);
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `${label} failed with HTTP ${response.status}`;
    const error = mappingError(message, response.status || 502);
    error.details = data;
    throw error;
  }
  return { data, response };
}

function mappedImageItem(config = {}, data = {}) {
  const url = config.imageUrlPath ? getJsonPathValue(data, config.imageUrlPath) : undefined;
  const b64 = config.b64JsonPath ? getJsonPathValue(data, config.b64JsonPath) : undefined;
  const revised = config.revisedPromptPath ? getJsonPathValue(data, config.revisedPromptPath) : undefined;
  const item = {};
  if (url !== undefined && url !== null && String(url || "").trim()) item.url = String(url);
  if (b64 !== undefined && b64 !== null && String(b64 || "").trim()) item.b64_json = String(b64).replace(/^data:image\/\w+;base64,/, "");
  if (revised !== undefined && revised !== null && String(revised || "").trim()) item.revised_prompt = String(revised).slice(0, 4000);
  return item;
}

function normalizeMappedResult(config = {}, data = {}, response = null) {
  const item = mappedImageItem(config, data);
  if (item.url || item.b64_json) {
    return {
      data: [item],
      usage: data?.usage || null,
      providerRaw: data,
      providerStatus: response?.status || null
    };
  }
  if (Array.isArray(data?.data)) return data;
  return {
    data: [],
    usage: data?.usage || null,
    providerRaw: data,
    providerStatus: response?.status || null
  };
}

async function runProviderMappingRequest({
  apiKey = "",
  baseUrl = "",
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  fetchFn = defaultFetchJson,
  mapping = {},
  onTrace = null,
  payload = {},
  signal
} = {}) {
  const normalized = normalizeProviderMapping(mapping);
  if (!Object.keys(normalized).length) throw mappingError("Provider mapping is empty");
  const context = templateContext(payload);
  const submitEndpoint = endpointFromPath(baseUrl, normalized.submit.path, context);
  const submitBody = requestBodyFromTemplate(normalized.submit, payload, context);
  await onTrace?.("provider_mapping_submit", { endpoint: submitEndpoint, method: normalized.submit.method });
  const submitted = await fetchJson({
    apiKey,
    body: submitBody,
    endpoint: submitEndpoint,
    fetchFn,
    label: "Provider mapping submit",
    method: normalized.submit.method,
    signal
  });

  if (normalized.mode === "openai-compatible") {
    return normalizeMappedResult(normalized.result, submitted.data, submitted.response);
  }

  const providerTaskId = getJsonPathValue(submitted.data, normalized.submit.taskIdPath);
  if (!providerTaskId) throw mappingError("Async provider did not return a task id", 502);
  await onTrace?.("provider_task_submitted", { providerTaskId: String(providerTaskId) });

  for (let attempt = 1; attempt <= normalized.poll.maxAttempts; attempt += 1) {
    const pollContext = templateContext(payload, { providerTaskId: String(providerTaskId) });
    const pollEndpoint = endpointFromPath(baseUrl, normalized.poll.path, pollContext);
    const pollBody = requestBodyFromTemplate(normalized.poll, payload, pollContext);
    const polled = await fetchJson({
      apiKey,
      body: pollBody,
      endpoint: pollEndpoint,
      fetchFn,
      label: "Provider mapping poll",
      method: normalized.poll.method,
      signal
    });
    const status = String(getJsonPathValue(polled.data, normalized.poll.statusPath) || "").trim();
    await onTrace?.("provider_polled", { attempt, status, providerTaskId: String(providerTaskId) });
    if (normalized.poll.successValues.includes(status)) {
      const result = normalizeMappedResult(normalized.poll, polled.data, polled.response);
      result.providerTaskId = String(providerTaskId);
      return result;
    }
    if (normalized.poll.failedValues.includes(status)) {
      throw mappingError(`Async provider task failed with status: ${status}`, 502);
    }
    if (attempt < normalized.poll.maxAttempts) await delay(normalized.poll.intervalMs);
  }
  throw mappingError("Async provider task polling timed out", 504);
}

module.exports = {
  getJsonPathValue,
  normalizeProviderMapping,
  parseJsonPath,
  renderTemplateValue,
  runProviderMappingRequest,
  templateContext,
  validateProviderMapping: normalizeProviderMapping
};
