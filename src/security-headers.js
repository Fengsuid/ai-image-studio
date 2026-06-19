const CSP_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "script-src 'self' 'sha256-Uo+5wss4OrAt98qVKAzkKoEC3P0AJe7a/g6/8hOhVUw='",
  "connect-src 'self'",
  "report-uri /api/csp-report"
].join("; ");

const BASE_SECURITY_HEADERS = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff"
};

function envFlagEnabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function cspHeaderName(env = process.env) {
  return envFlagEnabled(env.CSP_ENFORCE)
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

function cspSecurityHeader(env = process.env) {
  return { [cspHeaderName(env)]: CSP_POLICY };
}

function securityHeaders(env = process.env) {
  return { ...cspSecurityHeader(env), ...BASE_SECURITY_HEADERS };
}

function withSecurityHeaders(headers = {}, env = process.env) {
  return { ...securityHeaders(env), ...headers };
}

module.exports = {
  BASE_SECURITY_HEADERS,
  CSP_POLICY,
  cspHeaderName,
  cspSecurityHeader,
  envFlagEnabled,
  securityHeaders,
  withSecurityHeaders
};
