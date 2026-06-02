#!/usr/bin/env node
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[frontend-a11y] FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const indexHtml = read("public/index.html");
const adminHtml = read("public/admin.html");
const appJs = read("public/app.js");
const appAuthJs = read("public/app-auth.js");
const appSettingsJs = read("public/app-settings.js");
const adminDashboard = read("public/admin/dashboard.js");
const themeNavJs = read("public/theme-mobile-nav.js");
const tokensCss = read("public/css/00-tokens.css");
const shellCss = read("public/css/pages/layout-shell.css");
const adminCss = read("public/css/pages/admin.css");
const frontendManifest = JSON.parse(read("public/frontend-build-manifest.json"));

function hashedJsSource(source) {
  const asset = frontendManifest.js?.assets?.find((item) => item.source === source);
  assert(asset?.entry, `frontend manifest must include ${source}`);
  return asset?.entry ? read(`public/${asset.entry.replace(/^\//, "")}`) : "";
}

const appJsDist = hashedJsSource("/app.js");
const appAuthJsDist = hashedJsSource("/app-auth.js");
const appSettingsJsDist = hashedJsSource("/app-settings.js");

function assertAll(content, tokens, label) {
  for (const token of tokens) {
    assert(content.includes(token), `${label} must include ${token}`);
  }
}

assert(indexHtml.includes('id="toastLayer"') && indexHtml.includes('role="status"') && indexHtml.includes('aria-live="polite"'), "public toast layer must announce status changes");
assert(adminHtml.includes('id="adminToastLayer"') && adminHtml.includes('role="status"') && adminHtml.includes('aria-live="polite"'), "admin toast layer must announce status changes");
assert(indexHtml.includes('id="modalLayer"') && indexHtml.includes('aria-hidden="true"'), "modal layer must expose hidden state");
assert(adminHtml.includes('id="adminConfirmLayer"') && adminHtml.includes('aria-hidden="true"'), "admin confirm layer must expose hidden state");

assert(appJs.includes("function onModalKeydown") && appJs.includes('event.key === "Escape"'), "frontend modal must support Escape close");
assert(appJs.includes("focusTarget?.focus") && appJs.includes('aria-modal", "true"'), "frontend modal must set dialog semantics and initial focus");
assert(appJs.includes('button.setAttribute("aria-label", text("close"))'), "dynamic close buttons must receive aria-label");
assert(appJs.includes('toast.setAttribute("role", "status")'), "dynamic toasts must expose status role");
assertAll(appJs, [
  'elements.accountEmailText.setAttribute("role"',
  'elements.accountEmailText.setAttribute("aria-label"'
], "app.js account email semantics");
assertAll(appJsDist, [
  "Click to copy full email",
  'setAttribute("role"',
  'setAttribute("aria-label"',
  "presentation"
], "hashed app.js account email semantics");

assertAll(appAuthJs, [
  'elements.accountEmailText?.addEventListener("click"',
  'elements.accountEmailText?.addEventListener("keydown"',
  '["Enter", " "].includes(event.key)',
  "elements.accountEmailText.click()",
  'class="auth-tabs" role="tablist"',
  'role="tab" aria-selected',
  'class="works-filter-bar" role="tablist"',
  'role="tab" aria-selected="${state.worksFilter',
  'other.setAttribute("aria-selected"',
  "data-works-refresh aria-label",
  "data-work-detail-close aria-label"
], "app-auth split a11y interactions");
assertAll(appAuthJsDist, [
  "accountEmailText",
  "addEventListener",
  "keydown",
  "Enter",
  'class="auth-tabs" role="tablist"',
  'role="tab" aria-selected',
  'class="works-filter-bar" role="tablist"',
  'setAttribute("aria-selected"',
  "data-works-refresh aria-label",
  "data-work-detail-close aria-label"
], "hashed app-auth split a11y interactions");

assertAll(appSettingsJs, [
  'elements.langBtn.setAttribute("aria-label", label)',
  'elements.langBtn.setAttribute("aria-pressed"',
  'const label = lang === "zh" ? "切换到 English" : "Switch to Chinese"'
], "app-settings language toggle a11y");
assertAll(appSettingsJsDist, [
  "Switch to Chinese",
  "切换到 English",
  'setAttribute("aria-label"',
  'setAttribute("aria-pressed"'
], "hashed app-settings language toggle a11y");

assert(adminDashboard.includes("onKeydown") && adminDashboard.includes('event.key === "Escape"'), "admin confirmation dialog must support Escape close");
assert(adminDashboard.includes('layer.setAttribute("aria-hidden", "false")') && adminDashboard.includes('layer.setAttribute("aria-hidden", "true")'), "admin confirmation layer must toggle aria-hidden");
assert(adminDashboard.includes("focus?.({ preventScroll: true })"), "admin confirmation dialog must focus an actionable control");

assert(themeNavJs.includes('button.setAttribute("aria-label", button.title)'), "theme toggle must maintain aria-label");
assert(themeNavJs.includes('aria-current", "page"'), "mobile nav must expose active page state");
assert((indexHtml.match(/data-mobile-nav-action=/g) || []).length >= 5, "mobile bottom nav must expose the main actions");

function unlabeledIconButtons(html) {
  return [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)]
    .map((match) => match[0])
    .filter((snippet) => /<i\b|ri-/.test(snippet))
    .filter((snippet) => !/aria-label=|title=|aria-labelledby=/.test(snippet))
    .filter((snippet) => !snippet.replace(/<[^>]+>/g, "").replace(/\s+/g, "").trim());
}

assert(unlabeledIconButtons(indexHtml).length === 0, "public static icon-only buttons must have an accessible name");
assert(unlabeledIconButtons(adminHtml).length === 0, "admin static icon-only buttons must have an accessible name");

function hexToRgb(hex) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255
  };
}

function channel(value) {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastRatio(foreground, background) {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return 0;
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function cssVariable(name) {
  const match = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  return match?.[1] || "";
}

function assertContrast(label, foreground, background, minimum = 4.5) {
  const ratio = contrastRatio(foreground, background);
  assert(ratio >= minimum, `${label} contrast ${ratio.toFixed(2)} below ${minimum}:1`);
}

assertContrast("primary text on surface", cssVariable("--text-primary"), cssVariable("--surface-raised"));
assertContrast("secondary text on surface", cssVariable("--text-secondary"), cssVariable("--surface-raised"));
assertContrast("brand button text", cssVariable("--text-on-brand"), cssVariable("--brand-strong"));
assertContrast("send disabled text", "#ffffff", "#6b7280");
assertContrast("admin success badge", "#027a48", "#ecfdf3");
assertContrast("admin danger badge", "#b42318", "#fef3f2");
assertContrast("admin warning badge", "#9a6700", "#fff8db");

assert(shellCss.includes(".send-button:disabled") && shellCss.includes("opacity: 1"), "disabled send button must keep readable contrast");
assert(adminCss.includes('.admin-badge[data-status="disabled"]'), "admin disabled status badge must have explicit contrast styling");
assert(adminCss.includes('.admin-badge[data-status="requested"]'), "admin requested status badge must have explicit contrast styling");

if (!process.exitCode) {
  console.log("[frontend-a11y] static accessibility checks passed");
}
