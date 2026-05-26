#!/usr/bin/env node
// Smoke test for the public surface of GPT Image Studio.
// Usage:
//   BASE_URL=http://127.0.0.1:3000 node scripts/smoke/check-public-api.mjs
//   node scripts/smoke/check-public-api.mjs http://localhost:3000
//
// The script exits with a non-zero code on the first failed assertion so that it
// can run as a deployment gate or a manual regression check.

import fs from "node:fs";
import path from "node:path";

const argBase = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
const baseUrl = (process.env.BASE_URL || argBase || "http://localhost:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20000;
const failures = [];

function log(...parts) {
  console.log("[smoke]", ...parts);
}

function failure(message) {
  failures.push(message);
  console.error("[smoke] FAIL:", message);
}

async function fetchJson(pathSuffix) {
  const url = `${baseUrl}${pathSuffix}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { _raw: text };
    }
    return { status: response.status, headers: response.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(pathSuffix, accept = "text/plain,*/*") {
  const url = `${baseUrl}${pathSuffix}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: accept },
      signal: controller.signal
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCssWithImports(pathSuffix, seen = new Set()) {
  const cssUrl = new URL(pathSuffix, baseUrl);
  const key = `${cssUrl.pathname}${cssUrl.search}`;
  if (seen.has(key)) return { status: 200, headers: new Headers(), body: "" };
  seen.add(key);

  const response = await fetchText(key, "text/css,*/*");
  const importBodies = [];
  for (const match of response.body.matchAll(/@import\s+url\(["']?([^"')]+)["']?\);/g)) {
    const importUrl = new URL(match[1], cssUrl);
    const imported = await fetchCssWithImports(`${importUrl.pathname}${importUrl.search}`, seen);
    if (imported.status !== 200) return imported;
    importBodies.push(imported.body);
  }
  return {
    ...response,
    body: [response.body, ...importBodies].join("\n")
  };
}

async function fetchHead(pathSuffix, accept = "*/*") {
  const url = `${baseUrl}${pathSuffix}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { Accept: accept },
      signal: controller.signal
    });
    return { status: response.status, headers: response.headers };
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) {
    failure(message);
    return false;
  }
  return true;
}

function publicScriptMatch(html, fileName) {
  const stem = fileName.replace(/\.js$/, "");
  const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`src="([^"]*(?:/dist/${escapedStem}\\.[a-f0-9]{12}\\.js|/${escapedStem}\\.js)[^"]*)"`));
}

function manifestAsset(manifest, source) {
  return (manifest?.js?.assets || []).find((asset) => asset.source === source) || null;
}

function readPublicSource(fileName) {
  return fs.readFileSync(path.join(process.cwd(), "public", fileName), "utf8");
}

function assertSourceIncludes(fileName, snippets) {
  const source = readPublicSource(fileName);
  for (const snippet of snippets) {
    assert(source.includes(snippet), `public/${fileName} source missing ${snippet}`);
  }
}

function assertBodyIncludesAny(body, snippets, message) {
  assert(snippets.some((snippet) => body.includes(snippet)), message);
}

async function checkHomeResources() {
  log("GET /");
  const home = await fetchText("/", "text/html,*/*");
  assert(home.status === 200, `/ status=${home.status}`);
  assert(home.headers.get("content-security-policy-report-only"), "/ missing CSP Report-Only header");
  assert(!home.headers.get("content-security-policy-report-only").includes("fonts.googleapis.com"), "/ CSP should not allow Google Fonts");
  assert(!home.headers.get("content-security-policy-report-only").includes("fonts.gstatic.com"), "/ CSP should not allow Google font assets");
  assert(!home.headers.get("content-security-policy-report-only").includes("cdn.jsdelivr.net"), "/ CSP should not allow jsDelivr font/icon assets");
  assert(home.headers.get("content-security-policy-report-only").includes("font-src 'self'"), "/ CSP font-src should be self-only");
  assert(home.headers.get("content-security-policy-report-only").includes("media-src 'self'"), "/ CSP media-src should be self-only");
  assert(!home.headers.get("content-security-policy-report-only").includes("media-src 'self' https:"), "/ CSP media-src must not allow remote HTTPS media");
  assert(home.headers.get("x-content-type-options") === "nosniff", "/ missing nosniff header");
  assert(home.headers.get("cache-control") === "no-store", "/ HTML must be no-store");
  assert(typeof home.body === "string" && /\/dist\/app\.[a-f0-9]{12}\.css/.test(home.body), "/ missing hashed CSS bundle reference");
  assert(typeof home.body === "string" && !home.body.includes("/styles.css"), "/ should not load styles.css directly");
  assert(typeof home.body === "string" && !/\/mobile(?:-[a-z]+)?\.css/.test(home.body), "/ should not load legacy mobile CSS directly");
  assert(typeof home.body === "string" && /\/dist\/app\.[a-f0-9]{12}\.js/.test(home.body), "/ missing hashed app.js reference");
  assert(typeof home.body === "string" && !home.body.includes("?v="), "/ should not use manual query-string cache busting");
  assert(typeof home.body === "string" && !/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/.test(home.body), "/ should not reference external font or icon CDNs");
  assert(typeof home.body === "string" && home.body.includes('src="/hero/hero.mp4"'), "/ should reference local hero video");
  assert(typeof home.body === "string" && home.body.includes('poster="/hero/hero-poster.webp"'), "/ should reference local hero poster");
  assert(typeof home.body === "string" && home.body.includes('preload="none"'), "/ hero video should not preload on static HTML");
  assert(typeof home.body === "string" && !/cloudfront\.net|https:\/\/[^"]+\.mp4/.test(home.body), "/ should not reference remote hero video");
  for (const fileName of [
    "gallery-normalize.js",
    "gallery-leaderboard.js",
    "gallery-detail-media.js",
    "gallery-tag-view-model.js",
    "generation-result-actions.js",
    "reference-images.js",
    "home-onboarding.js",
    "frontend-performance.js",
    "app-router.js",
    "app-prompt-library.js",
    "app-auth.js"
  ]) {
    assert(publicScriptMatch(home.body, fileName), `/ missing ${fileName} reference`);
  }
  for (const fileName of [
    "canvas-store.js",
    "canvas-nodes.js",
    "canvas-geometry.js",
    "canvas-layout.js",
    "canvas-edges.js",
    "canvas-workflows.js",
    "canvas-minimap.js",
    "canvas-selection.js",
    "canvas-history.js",
    "canvas-io.js",
    "canvas-assistant.js",
    "canvas-toolbar.js",
    "canvas-inspector.js",
    "canvas-market.js",
    "canvas.js"
  ]) {
    assert(!publicScriptMatch(home.body, fileName), `/ should lazy-load ${fileName} instead of including it in first-load HTML`);
  }
  assert(typeof home.body === "string" && home.body.includes("hero-pathway"), "/ missing home hero pathway");
  assert(typeof home.body === "string" && home.body.includes("homeDiscovery"), "/ missing home prompt discovery");
  assert(home.body.includes('property="og:title"'), "/ missing OG title metadata");
  assert(home.body.includes('name="twitter:card"'), "/ missing Twitter card metadata");

  const styleMatch = home.body.match(/href="([^"]*\/dist\/app\.[a-f0-9]{12}\.css)"/);
  const appMatch = publicScriptMatch(home.body, "app.js");
  const appRouterMatch = publicScriptMatch(home.body, "app-router.js");
  const galleryModelMatch = publicScriptMatch(home.body, "gallery-normalize.js");
  const galleryLeaderboardMatch = publicScriptMatch(home.body, "gallery-leaderboard.js");
  const galleryDetailMediaMatch = publicScriptMatch(home.body, "gallery-detail-media.js");
  const galleryTagViewModelMatch = publicScriptMatch(home.body, "gallery-tag-view-model.js");
  const generationResultActionsMatch = publicScriptMatch(home.body, "generation-result-actions.js");
  const referenceImagesMatch = publicScriptMatch(home.body, "reference-images.js");
  const homeOnboardingMatch = publicScriptMatch(home.body, "home-onboarding.js");
  const frontendPerformanceMatch = publicScriptMatch(home.body, "frontend-performance.js");
  const promptLibraryMatch = publicScriptMatch(home.body, "app-prompt-library.js");
  const appAuthMatch = publicScriptMatch(home.body, "app-auth.js");
  const appSettingsMatch = publicScriptMatch(home.body, "app-settings.js");
  const manifestResponse = await fetchJson("/frontend-build-manifest.json");
  assert(manifestResponse.status === 200, "/frontend-build-manifest.json status should be 200");
  const manifest = manifestResponse.body || {};
  const canvasLayoutPath = manifestAsset(manifest, "/canvas-layout.js")?.entry || "/canvas-layout.js";
  const canvasEdgesPath = manifestAsset(manifest, "/canvas-edges.js")?.entry || "/canvas-edges.js";
  const minimapPath = manifestAsset(manifest, "/canvas-minimap.js")?.entry || "/canvas-minimap.js";
  const canvasHistoryPath = manifestAsset(manifest, "/canvas-history.js")?.entry || "/canvas-history.js";
  const canvasSelectionPath = manifestAsset(manifest, "/canvas-selection.js")?.entry || "/canvas-selection.js";
  const canvasIoPath = manifestAsset(manifest, "/canvas-io.js")?.entry || "/canvas-io.js";
  const canvasAssistantPath = manifestAsset(manifest, "/canvas-assistant.js")?.entry || "/canvas-assistant.js";
  const canvasToolbarPath = manifestAsset(manifest, "/canvas-toolbar.js")?.entry || "/canvas-toolbar.js";
  const canvasInspectorPath = manifestAsset(manifest, "/canvas-inspector.js")?.entry || "/canvas-inspector.js";
  const lazyCanvasScripts = manifest.js?.lazyRoutes?.canvas?.scripts || [];
  assert(Array.isArray(lazyCanvasScripts), "manifest must expose canvas lazy route scripts");
  assert(lazyCanvasScripts.includes("/canvas.js"), "manifest canvas lazy route must include canvas.js");
  const stylePath = styleMatch?.[1] || "/dist/app.missing.css";
  const appPath = appMatch?.[1] || "/app.js";
  const appRouterPath = appRouterMatch?.[1] || "/app-router.js";
  const galleryModelPath = galleryModelMatch?.[1] || "/gallery-normalize.js";
  const galleryLeaderboardPath = galleryLeaderboardMatch?.[1] || "/gallery-leaderboard.js";
  const galleryDetailMediaPath = galleryDetailMediaMatch?.[1] || "/gallery-detail-media.js";
  const galleryTagViewModelPath = galleryTagViewModelMatch?.[1] || "/gallery-tag-view-model.js";
  const generationResultActionsPath = generationResultActionsMatch?.[1] || "/generation-result-actions.js";
  const referenceImagesPath = referenceImagesMatch?.[1] || "/reference-images.js";
  const homeOnboardingPath = homeOnboardingMatch?.[1] || "/home-onboarding.js";
  const frontendPerformancePath = frontendPerformanceMatch?.[1] || "/frontend-performance.js";
  const promptLibraryPath = promptLibraryMatch?.[1] || "/app-prompt-library.js";
  const appAuthPath = appAuthMatch?.[1] || "/app-auth.js";
  const appSettingsPath = appSettingsMatch?.[1] || "/app-settings.js";
  assert(/^\/dist\/app\.[a-f0-9]{12}\.js$/.test(new URL(appPath, baseUrl).pathname), "/ app.js should use content-hashed dist path");
  assert(/^\/dist\/app-router\.[a-f0-9]{12}\.js$/.test(new URL(appRouterPath, baseUrl).pathname), "/ app-router.js should use content-hashed dist path");
  assert(/^\/dist\/app-auth\.[a-f0-9]{12}\.js$/.test(new URL(appAuthPath, baseUrl).pathname), "/ app-auth.js should use content-hashed dist path");
  assert(/^\/dist\/app-settings\.[a-f0-9]{12}\.js$/.test(new URL(appSettingsPath, baseUrl).pathname), "/ app-settings.js should use content-hashed dist path");

  log(`GET ${stylePath}`);
  const style = await fetchCssWithImports(stylePath);
  assert(style.status === 200, `${stylePath} status=${style.status}`);
  assert((style.headers.get("cache-control") || "").includes("max-age=31536000"), `${stylePath} should use long-lived cache`);
  assert((style.headers.get("cache-control") || "").includes("immutable"), `${stylePath} should use immutable cache`);
  assert(style.body.length > 1000, `${stylePath} unexpectedly small`);
  assert(!/@import\s/.test(style.body), `${stylePath} should be a resolved CSS bundle without @import`);
  assert(style.body.includes("admin-overview-hero"), `${stylePath} should style admin dashboard overview hero`);
  assert(style.body.includes("admin-quick-links"), `${stylePath} should style admin dashboard quick links`);
  assert(style.body.includes("admin-issue-list"), `${stylePath} should style admin dashboard issue list`);
  assert(style.body.includes("home-onboarding-card"), `${stylePath} should style home onboarding`);
  assert(style.body.includes("home-reduced-motion"), `${stylePath} should include home reduced motion fallback`);
  assert(style.body.includes("prompt-library-card"), `${stylePath} should style prompt library cards`);
  assert(style.body.includes("prompt-library-state"), `${stylePath} should style prompt library states`);
  assert(style.body.includes("/vendor/fonts/geist-latin.woff2"), `${stylePath} should self-host Geist`);
  assert(style.body.includes("/vendor/fonts/instrument-serif-latin.woff2"), `${stylePath} should self-host Instrument Serif`);
  assert(style.body.includes("font-family:remixicon"), `${stylePath} should include local Remixicon icon rules`);

  for (const fontPath of [
    "/vendor/fonts/geist-latin.woff2",
    "/vendor/fonts/instrument-serif-latin.woff2",
    "/vendor/icons/remixicon.woff2"
  ]) {
    log(`HEAD ${fontPath}`);
    const font = await fetchHead(fontPath, "font/woff2,*/*");
    assert(font.status === 200, `${fontPath} status=${font.status}`);
    assert((font.headers.get("cache-control") || "").includes("max-age=31536000"), `${fontPath} should use long-lived cache`);
    assert((font.headers.get("cache-control") || "").includes("immutable"), `${fontPath} should use immutable cache`);
  }

  for (const [assetPath, contentType] of [
    ["/hero/hero.mp4", "video/mp4"],
    ["/hero/hero-poster.webp", "image/webp"]
  ]) {
    log(`HEAD ${assetPath}`);
    const asset = await fetchHead(assetPath, `${contentType},*/*`);
    assert(asset.status === 200, `${assetPath} status=${asset.status}`);
    assert((asset.headers.get("content-type") || "").includes(contentType), `${assetPath} content-type should be ${contentType}`);
    assert((asset.headers.get("cache-control") || "").includes("max-age=31536000"), `${assetPath} should use long-lived cache`);
    assert((asset.headers.get("cache-control") || "").includes("immutable"), `${assetPath} should use immutable cache`);
  }

  log(`GET ${homeOnboardingPath}`);
  const homeOnboarding = await fetchText(homeOnboardingPath, "application/javascript,*/*");
  assert(homeOnboarding.status === 200, `${homeOnboardingPath} status=${homeOnboarding.status}`);
  assert(homeOnboarding.body.includes("window.ImageStudioHomeOnboarding"), `${homeOnboardingPath} should register home onboarding helper`);
  assert(homeOnboarding.body.includes("imageStudio.homeOnboarding.v1"), `${homeOnboardingPath} should use isolated first-run storage key`);

  log(`GET ${frontendPerformancePath}`);
  const frontendPerformance = await fetchText(frontendPerformancePath, "application/javascript,*/*");
  assert(frontendPerformance.status === 200, `${frontendPerformancePath} status=${frontendPerformance.status}`);
  assert(frontendPerformance.body.includes("ImageStudioPerformance"), `${frontendPerformancePath} should register frontend performance helper`);
  assert(frontendPerformance.body.includes("IntersectionObserver"), `${frontendPerformancePath} should defer card/image work with IntersectionObserver`);
  assert(frontendPerformance.body.includes("shouldDisableHeroVideo"), `${frontendPerformancePath} should gate hero video for low-power devices`);
  assert(frontendPerformance.body.includes("slow-2g"), `${frontendPerformancePath} should disable hero video on slow-2g`);
  assert(frontendPerformance.body.includes('video.preload = "none"'), `${frontendPerformancePath} should avoid video loading when disabled`);

  log(`GET ${promptLibraryPath}`);
  const promptLibrary = await fetchText(promptLibraryPath, "application/javascript,*/*");
  assert(promptLibrary.status === 200, `${promptLibraryPath} status=${promptLibrary.status}`);
  assertBodyIncludesAny(promptLibrary.body, ["promptLibrary", "renderPromptCard"], `${promptLibraryPath} should include prompt library code`);
  assertSourceIncludes("app-prompt-library.js", [
    "AppModules?.register?.(\"promptLibrary\"",
    "renderPromptCard",
    "renderLibraryState",
    "renderPromptDetailModal"
  ]);

  log(`GET ${appAuthPath}`);
  const appAuth = await fetchText(appAuthPath, "application/javascript,*/*");
  assert(appAuth.status === 200, `${appAuthPath} status=${appAuth.status}`);
  assertBodyIncludesAny(appAuth.body, ["createAuthController", "publicTagsForKind"], `${appAuthPath} should include auth controller code`);
  assertSourceIncludes("app-auth.js", [
    "createAuthController",
    "publicTagsForKind(selectedKinds[0]"
  ]);

  log(`GET ${appSettingsPath}`);
  const appSettings = await fetchText(appSettingsPath, "application/javascript,*/*");
  assert(appSettings.status === 200, `${appSettingsPath} status=${appSettings.status}`);
  assertBodyIncludesAny(appSettings.body, ["createSettingsController", "bindLanguageToggle"], `${appSettingsPath} should include settings controller code`);
  assertSourceIncludes("app-settings.js", [
    "createSettingsController",
    "bindLanguageToggle",
    "safeStorageWrite(\"lang\""
  ]);

  log(`GET ${appRouterPath}`);
  const appRouter = await fetchText(appRouterPath, "application/javascript,*/*");
  assert(appRouter.status === 200, `${appRouterPath} status=${appRouter.status}`);
  assert(appRouter.body.includes("ImageStudioRouter"), `${appRouterPath} should expose route lazy loading`);
  assert(appRouter.body.includes("lazyRoutes"), `${appRouterPath} should read manifest lazy route configuration`);
  assert(appRouter.body.includes("routeSource"), `${appRouterPath} should annotate dynamically injected scripts`);
  assertSourceIncludes("app-router.js", [
    "ensureRoute",
    "ensureCanvas",
    "ensureAdmin",
    "script.dataset.routeSource",
    "imagestudio:route-loaded"
  ]);

  log(`GET ${appPath}`);
  const app = await fetchText(appPath, "application/javascript,*/*");
  assert(app.status === 200, `${appPath} status=${app.status}`);
  assert((app.headers.get("cache-control") || "").includes("max-age=31536000"), `${appPath} should use long-lived cache`);
  assert((app.headers.get("cache-control") || "").includes("immutable"), `${appPath} should use immutable cache`);
  assert(app.body.length > 1000, `${appPath} unexpectedly small`);
  assert(app.body.includes("/api/version"), `${appPath} should request /api/version`);
  assert(app.body.includes("/api/images/requests/active"), `${appPath} should resume active generation requests`);
  assert(app.body.includes("candidate-strip"), `${appPath} should expose multi-candidate selection UI`);
  assert(app.body.includes("/api/rum"), `${appPath} should report RUM metrics`);
  assert(app.body.includes("providerCapabilities"), `${appPath} should read provider capability flags`);
  assert(app.body.includes("isImageToImageItem"), `${appPath} should classify image-to-image works from source metadata`);
  assert(app.body.includes("window.history.replaceState("), `${appPath} should close modal routes without adding history entries`);
  assert(app.body.includes("referenceRequestPayload"), `${appPath} should build reference image payloads`);
  assert(app.body.includes("referenceImages"), `${appPath} should send multi-reference images to image edit requests`);
  assert(app.body.includes("maxReferenceImages"), `${appPath} should read configurable reference image limits`);
  assert(app.body.includes("data-reference-row-input"), `${appPath} should let the reference row append more images`);
  assert(app.body.includes("handleEditorUpload"), `${appPath} should pass multiple editor upload files`);
  assert(app.body.includes("appendReferences"), `${appPath} should append bottom editor uploads as references`);
  assert(app.body.includes("promptLibraryModule"), `${appPath} should delegate prompt library rendering to module`);
  assert(app.body.includes("promptLibraryMeta"), `${appPath} should track prompt library remote/fallback state`);
  assert(app.body.includes("setLikeFeedback"), `${appPath} should surface prompt like failure feedback`);
  assertSourceIncludes("app.js", [
    "function isImageToImageItem",
    "window.history.replaceState(route",
    "handleEditorUpload(event.target.files",
    "appendReferences: true",
    "promptLibraryModule()"
  ]);

  log(`GET ${canvasLayoutPath}`);
  const canvasLayout = await fetchText(canvasLayoutPath, "application/javascript,*/*");
  assert(canvasLayout.status === 200, `${canvasLayoutPath} status=${canvasLayout.status}`);
  assert(canvasLayout.body.includes(".layout"), `${canvasLayoutPath} should register canvas layout module`);
  assert(canvasLayout.body.includes("fitNodesInBoard"), `${canvasLayoutPath} should support centering canvas nodes in the board`);
  assertSourceIncludes("canvas-layout.js", ["root.layout", "fitNodesInBoard"]);

  log(`GET ${canvasEdgesPath}`);
  const canvasEdges = await fetchText(canvasEdgesPath, "application/javascript,*/*");
  assert(canvasEdges.status === 200, `${canvasEdgesPath} status=${canvasEdges.status}`);
  assert(canvasEdges.body.includes(".edges"), `${canvasEdgesPath} should register canvas edges module`);
  assert(canvasEdges.body.includes("edgeEndpoints"), `${canvasEdgesPath} should expose node edge endpoint geometry`);
  assertSourceIncludes("canvas-edges.js", ["root.edges", "edgeEndpoints"]);

  log(`GET ${minimapPath}`);
  const minimap = await fetchText(minimapPath, "application/javascript,*/*");
  assert(minimap.status === 200, `${minimapPath} status=${minimap.status}`);
  assert(minimap.body.includes(".minimap"), `${minimapPath} should register canvas minimap module`);
  assert(minimap.body.includes("viewportFromEvent"), `${minimapPath} should support minimap viewport navigation`);
  assertSourceIncludes("canvas-minimap.js", ["root.minimap", "viewportFromEvent"]);

  log(`GET ${canvasHistoryPath}`);
  const canvasHistory = await fetchText(canvasHistoryPath, "application/javascript,*/*");
  assert(canvasHistory.status === 200, `${canvasHistoryPath} status=${canvasHistory.status}`);
  assert(canvasHistory.body.includes(".history"), `${canvasHistoryPath} should register canvas history module`);
  assert(canvasHistory.body.includes("createController"), `${canvasHistoryPath} should expose history controller`);
  assert(canvasHistory.body.includes("paste"), `${canvasHistoryPath} should support paste operations`);
  assert(canvasHistory.body.includes("selectedNodeIds"), `${canvasHistoryPath} should preserve pasted selection ids`);
  assertSourceIncludes("canvas-history.js", ["root.history", "createController", "paste", "selectedNodeIds"]);

  log(`GET ${canvasSelectionPath}`);
  const canvasSelection = await fetchText(canvasSelectionPath, "application/javascript,*/*");
  assert(canvasSelection.status === 200, `${canvasSelectionPath} status=${canvasSelection.status}`);
  assert(canvasSelection.body.includes(".selection"), `${canvasSelectionPath} should register canvas selection module`);
  assert(canvasSelection.body.includes("nodesInRect"), `${canvasSelectionPath} should support marquee selection`);
  assert(canvasSelection.body.includes("groupFromNodes"), `${canvasSelectionPath} should support grouping selected nodes`);
  assertSourceIncludes("canvas-selection.js", ["root.selection", "nodesInRect", "groupFromNodes"]);

  log(`GET ${canvasIoPath}`);
  const canvasIo = await fetchText(canvasIoPath, "application/javascript,*/*");
  assert(canvasIo.status === 200, `${canvasIoPath} status=${canvasIo.status}`);
  assert(canvasIo.body.includes(".io"), `${canvasIoPath} should register canvas IO module`);
  assert(canvasIo.body.includes("exportCanvas"), `${canvasIoPath} should support canvas JSON export`);
  assert(canvasIo.body.includes("importCanvas"), `${canvasIoPath} should support canvas JSON import`);
  assertSourceIncludes("canvas-io.js", ["root.io", "exportCanvas", "importCanvas"]);

  log(`GET ${canvasAssistantPath}`);
  const canvasAssistant = await fetchText(canvasAssistantPath, "application/javascript,*/*");
  assert(canvasAssistant.status === 200, `${canvasAssistantPath} status=${canvasAssistant.status}`);
  assert(canvasAssistant.body.includes(".assistant"), `${canvasAssistantPath} should register canvas assistant module`);
  assert(canvasAssistant.body.includes("createController"), `${canvasAssistantPath} should expose assistant controller`);
  assert(canvasAssistant.body.includes("suggestionToNodeInput"), `${canvasAssistantPath} should convert suggestions into nodes`);
  assertSourceIncludes("canvas-assistant.js", ["root.assistant", "createController", "suggestionToNodeInput"]);

  log(`GET ${canvasToolbarPath}`);
  const canvasToolbar = await fetchText(canvasToolbarPath, "application/javascript,*/*");
  assert(canvasToolbar.status === 200, `${canvasToolbarPath} status=${canvasToolbar.status}`);
  assert(canvasToolbar.body.includes(".toolbar"), `${canvasToolbarPath} should register canvas toolbar module`);
  assert(canvasToolbar.body.includes("renderHistoryControls"), `${canvasToolbarPath} should expose toolbar control rendering`);
  assertSourceIncludes("canvas-toolbar.js", ["root.toolbar", "renderHistoryControls"]);

  log(`GET ${canvasInspectorPath}`);
  const canvasInspector = await fetchText(canvasInspectorPath, "application/javascript,*/*");
  assert(canvasInspector.status === 200, `${canvasInspectorPath} status=${canvasInspector.status}`);
  assert(canvasInspector.body.includes(".inspector"), `${canvasInspectorPath} should register canvas inspector module`);
  assert(canvasInspector.body.includes("connectionPanel"), `${canvasInspectorPath} should render connection inspector controls`);
  assertSourceIncludes("canvas-inspector.js", ["root.inspector", "connectionPanel"]);

  log(`GET ${galleryModelPath}`);
  const galleryModel = await fetchText(galleryModelPath, "application/javascript,*/*");
  assert(galleryModel.status === 200, `${galleryModelPath} status=${galleryModel.status}`);
  assert(galleryModel.body.includes("ImageStudioGalleryModel"), `${galleryModelPath} should register gallery model helpers`);
  assert(galleryModel.body.includes("promptImageDisplayUrl"), `${galleryModelPath} should normalize prompt image URLs`);
  assert(galleryModel.body.includes("generationEntryFromApi"), `${galleryModelPath} should normalize gallery API entries`);

  log(`GET ${galleryLeaderboardPath}`);
  const galleryLeaderboard = await fetchText(galleryLeaderboardPath, "application/javascript,*/*");
  assert(galleryLeaderboard.status === 200, `${galleryLeaderboardPath} status=${galleryLeaderboard.status}`);
  assert(galleryLeaderboard.body.includes("ImageStudioGalleryLeaderboard"), `${galleryLeaderboardPath} should register leaderboard helpers`);
  assert(galleryLeaderboard.body.includes("rank-like"), `${galleryLeaderboardPath} should render compact like controls`);

  log(`GET ${galleryDetailMediaPath}`);
  const galleryDetailMedia = await fetchText(galleryDetailMediaPath, "application/javascript,*/*");
  assert(galleryDetailMedia.status === 200, `${galleryDetailMediaPath} status=${galleryDetailMedia.status}`);
  assert(galleryDetailMedia.body.includes("ImageStudioGalleryDetailMedia"), `${galleryDetailMediaPath} should register detail selected media helpers`);
  assert(galleryDetailMedia.body.includes("selectedMediaType"), `${galleryDetailMediaPath} should preserve selected media context`);

  log(`GET ${galleryTagViewModelPath}`);
  const galleryTagViewModel = await fetchText(galleryTagViewModelPath, "application/javascript,*/*");
  assert(galleryTagViewModel.status === 200, `${galleryTagViewModelPath} status=${galleryTagViewModel.status}`);
  assert(galleryTagViewModel.body.includes("ImageStudioGalleryTagViewModel"), `${galleryTagViewModelPath} should register gallery tag view model helpers`);
  assert(galleryTagViewModel.body.includes("cleanPublicTags"), `${galleryTagViewModelPath} should filter public tags`);

  log(`GET ${generationResultActionsPath}`);
  const generationResultActions = await fetchText(generationResultActionsPath, "application/javascript,*/*");
  assert(generationResultActions.status === 200, `${generationResultActionsPath} status=${generationResultActions.status}`);
  assert(generationResultActions.body.includes("ImageStudioGenerationResultActions"), `${generationResultActionsPath} should register result action helpers`);
  assert(generationResultActions.body.includes("message-more-menu"), `${generationResultActionsPath} should collapse secondary result actions`);

  log(`GET ${referenceImagesPath}`);
  const referenceImages = await fetchText(referenceImagesPath, "application/javascript,*/*");
  assert(referenceImages.status === 200, `${referenceImagesPath} status=${referenceImages.status}`);
  assert(referenceImages.body.includes("ImageStudioReferenceImages"), `${referenceImagesPath} should register reference image helpers`);
  assert(referenceImages.body.includes("filesToReferences"), `${referenceImagesPath} should read multiple reference files`);
  assert(referenceImages.body.includes("revokeReferences"), `${referenceImagesPath} should release reference object URLs`);
  assert(referenceImages.body.includes("normalizeLimit"), `${referenceImagesPath} should clamp configurable reference limits`);
  log("/ resources ok:", "hashed app asset", appPath);
}

async function checkAdminResources() {
  log("GET /admin");
  const admin = await fetchText("/admin", "text/html,*/*");
  assert(admin.status === 200, `/admin status=${admin.status}`);
  assert(admin.body.includes("/app-router.js"), "/admin missing app-router.js reference");
  assert(!admin.body.includes("/admin.js"), "/admin should lazy-load admin.js through app-router");
  assert(admin.body.includes("admin-shell"), "/admin missing admin shell markup");

  const routerMatch = admin.body.match(/src="([^"]*\/app-router\.js[^"]*)"/);
  const styleMatch = admin.body.match(/href="([^"]*\/styles\.css[^"]*)"/);
  const manifestResponse = await fetchJson("/frontend-build-manifest.json");
  assert(manifestResponse.status === 200, "/frontend-build-manifest.json status should be 200 for admin lazy route");
  const manifest = manifestResponse.body || {};
  const lazyAdminScripts = manifest.js?.lazyRoutes?.admin?.scripts || [];
  assert(Array.isArray(lazyAdminScripts), "manifest must expose admin lazy route scripts");
  assert(lazyAdminScripts.includes("/admin.js"), "manifest admin lazy route must include admin.js");
  const scriptPath = manifestAsset(manifest, "/admin.js")?.entry || "/admin.js";
  const stylePath = styleMatch?.[1] || "/styles.css";
  const routerVersion = new URL(routerMatch?.[1] || "/app-router.js", baseUrl).searchParams.get("v");
  const styleVersion = new URL(stylePath, baseUrl).searchParams.get("v");
  assert(routerVersion && routerVersion.length > 0, "/admin app-router.js should include cache-busting version");
  assert(styleVersion && styleVersion.length > 0, "/admin styles.css should include cache-busting version");
  if (routerVersion && styleVersion) {
    assert(routerVersion === styleVersion, `/admin app-router.js/styles.css version mismatch (${routerVersion} vs ${styleVersion})`);
  }
  assert(/^\/dist\/admin\.[a-f0-9]{12}\.js$/.test(new URL(scriptPath, baseUrl).pathname), "/admin admin.js should use manifest hashed dist path");

  log(`GET ${stylePath}`);
  const style = await fetchCssWithImports(stylePath);
  assert(style.status === 200, `${stylePath} status=${style.status}`);
  assert(style.body.length > 1000, `${stylePath} unexpectedly small`);

  log(`GET ${scriptPath}`);
  const script = await fetchText(scriptPath, "application/javascript,*/*");
  assert(script.status === 200, `${scriptPath} status=${script.status}`);
  assert(script.body.length > 1000, `${scriptPath} unexpectedly small`);
  assert(script.body.includes("/api/admin/settings"), `${scriptPath} should request /api/admin/settings`);
  assert(script.body.includes("/api/admin/users"), `${scriptPath} should support admin user management`);
  assert(script.body.includes("/api/admin/providers"), `${scriptPath} should support provider management`);
  assert(script.body.includes("/api/admin/announcements"), `${scriptPath} should support announcement management`);
  assert(script.body.includes("generation-requests"), `${scriptPath} should include admin IA navigation`);
  assert(script.body.includes("/api/admin/reports"), `${scriptPath} should load moderation reports`);
  assert(script.body.includes("/api/admin/prompt-duplicates"), `${scriptPath} should load prompt duplicate candidates`);
  assert(script.body.includes("/api/admin/rum"), `${scriptPath} should load RUM metrics`);
  assert(script.body.includes("dashboardContext"), `${scriptPath} should build admin dashboard health context`);
  const adminModuleScripts = lazyAdminScripts
    .filter((source) => /\/admin-(?:overview|users|providers|gallery|settings)\.js$/.test(source))
    .map((source) => manifestAsset(manifest, source)?.entry || source);
  assert(adminModuleScripts.length >= 5, "/admin should load admin panel modules before admin.js");
  const moduleBodies = [];
  for (const modulePath of adminModuleScripts) {
    log(`GET ${modulePath}`);
    const module = await fetchText(modulePath, "application/javascript,*/*");
    assert(module.status === 200, `${modulePath} status=${module.status}`);
    assert(module.body.includes("AdminModules"), `${modulePath} should register an AdminModules entry`);
    moduleBodies.push(module.body);
  }
  const adminBundle = [script.body, ...moduleBodies].join("\n");
  assert(adminBundle.includes("快捷入口"), "/admin modules should render admin dashboard quick actions");
  assert(adminBundle.includes("最近异常"), "/admin modules should render admin dashboard recent issues");
  assert(adminBundle.includes("growthConfig"), "/admin settings module should expose growth configuration");
  assert(adminBundle.includes("API 配置入口已迁移"), "/admin settings module should explain API provider settings ownership");
  assert(!adminBundle.includes('name="providerCapabilityConfig"'), "/admin settings module should not duplicate provider capability configuration");
  assert(adminBundle.includes("contactEmail"), "/admin settings module should expose contact email settings");
  assert(adminBundle.includes("maxReferenceImages"), "/admin settings module should expose reference image upload limit settings");
  assert(script.body.includes("Provider JSON 格式错误"), `${scriptPath} should handle invalid provider JSON before saving`);
  assertSourceIncludes("admin.js", [
    "dashboardContext",
    "if (isNew || apiKey) payload.apiKey = apiKey",
    "Provider JSON 格式错误"
  ]);
  assertSourceIncludes("admin-overview.js", ["快捷入口", "最近异常"]);
  assertSourceIncludes("admin-settings.js", [
    "growthConfig",
    "API 配置入口已迁移",
    "contactEmail",
    "maxReferenceImages"
  ]);
  log("/admin resources ok:", "router version", routerVersion || "none");
}

async function checkVersion() {
  log("GET /api/version");
  const { status, headers, body } = await fetchJson("/api/version");
  assert(status === 200, `/api/version status=${status}`);
  assert(headers.get("content-security-policy-report-only"), "/api/version missing CSP Report-Only header");
  assert(headers.get("x-content-type-options") === "nosniff", "/api/version missing nosniff header");
  assert(body && typeof body === "object", "/api/version body is not an object");
  assert(typeof body?.version === "string" && body.version.length > 0, "/api/version missing version string");
  assert(typeof body?.startedAt === "string" && !Number.isNaN(Date.parse(body.startedAt)), "/api/version startedAt invalid");
  assert(Number.isFinite(Number(body?.uptimeSeconds)), "/api/version uptimeSeconds invalid");
  assert(typeof body?.node === "string" && body.node.startsWith("v"), "/api/version node missing");
  assert(body?.timeoutMs && Number(body.timeoutMs.openai) > 0, "/api/version timeoutMs.openai missing");
  log("/api/version ok:", body?.version, "node", body?.node);
}

async function checkHealth() {
  log("GET /api/health");
  const { status, body } = await fetchJson("/api/health");
  assert(status === 200, `/api/health status=${status}`);
  assert(body?.ok === true, "/api/health ok flag missing");
  assert(typeof body?.version === "string", "/api/health version missing");
  assert(typeof body?.startedAt === "string", "/api/health startedAt missing");
  assert(body?.settings && typeof body.settings === "object", "/api/health settings missing");
  assert(typeof body?.settings?.generationCreditCost === "number", "/api/health generationCreditCost missing");
  assert(typeof body?.settings?.maxImagesPerRequest === "number", "/api/health maxImagesPerRequest missing");
  assert(body?.settings?.providerCapabilities && typeof body.settings.providerCapabilities === "object", "/api/health providerCapabilities missing");
  assert(body?.settings?.growth && typeof body.settings.growth === "object", "/api/health growth config missing");
  log("/api/health ok:", body?.version, "firstRun=", body?.firstRun);
}

async function checkGrowth() {
  log("GET /api/growth");
  const { status, body } = await fetchJson("/api/growth");
  assert(status === 200, `/api/growth status=${status}`);
  assert(body?.growth && typeof body.growth === "object", "/api/growth missing growth object");
  assert(Array.isArray(body?.growth?.recommendationSlots), "/api/growth recommendationSlots must be array");
  assert(body?.providerCapabilities && typeof body.providerCapabilities === "object", "/api/growth missing providerCapabilities");
  assert(typeof body?.providerCapabilities?.imageEdit === "boolean", "/api/growth providerCapabilities.imageEdit missing");
}

async function checkSettings() {
  log("GET /api/settings");
  const { status, body } = await fetchJson("/api/settings");
  assert(status === 200, `/api/settings status=${status}`);
  assert(body && typeof body === "object", "/api/settings body is not an object");
  assert(typeof body?.hasApiKey === "boolean", "/api/settings hasApiKey missing");
  assert(typeof body?.contactEmail === "string", "/api/settings contactEmail missing");
  assert(typeof body?.firstPublicRewardCredit === "number", "/api/settings firstPublicRewardCredit missing");
  assert(typeof body?.publicRewardHoldMinutes === "number", "/api/settings publicRewardHoldMinutes missing");
  assert(typeof body?.publicUnpublishAllowed === "boolean", "/api/settings publicUnpublishAllowed missing");
  assert(typeof body?.publicRewardNotificationsEnabled === "boolean", "/api/settings publicRewardNotificationsEnabled missing");
  assert(body?.providerCapabilities && typeof body.providerCapabilities === "object", "/api/settings providerCapabilities missing");
  assert(typeof body?.providerCapabilities?.textToImage === "boolean", "/api/settings providerCapabilities.textToImage missing");
  assert(body?.growth && typeof body.growth === "object", "/api/settings growth config missing");
}

async function checkAnnouncements() {
  log("GET /api/announcements?limit=3");
  const { status, body } = await fetchJson("/api/announcements?limit=3");
  assert(status === 200, `/api/announcements status=${status}`);
  assert(body && Array.isArray(body.announcements), "/api/announcements missing announcements array");
}

async function checkPublicGallery() {
  log("GET /api/images/public?limit=3");
  const { status, body } = await fetchJson("/api/images/public?limit=3");
  assert(status === 200, `/api/images/public status=${status}`);
  assert(body && Array.isArray(body.generations), "/api/images/public missing generations array");
  if (!Array.isArray(body?.generations)) return;
  log(`/api/images/public returned ${body.generations.length} item(s)`);
  for (const item of body.generations) {
    assert(typeof item?.id === "string" && item.id.length > 0, "public item missing id");
    assert(typeof item?.prompt === "string" && item.prompt.length > 0, `public item ${item?.id} missing prompt`);
    assert(typeof item?.imageUrl === "string" && item.imageUrl.startsWith("/api/images/"), `public item ${item?.id} imageUrl invalid`);
    assert("publicTags" in item && Array.isArray(item.publicTags), `public item ${item?.id} publicTags must be array`);
    assert("isPublic" in item && Boolean(item.isPublic), `public item ${item?.id} isPublic must be true`);
    assert("userId" in item, `public item ${item?.id} missing userId`);
    assert("userName" in item, `public item ${item?.id} missing userName`);
    assert("conversation" in item && Array.isArray(item.conversation), `public item ${item?.id} conversation must be array`);
    if ("durationMs" in item && item.durationMs !== null) {
      assert(Number.isFinite(Number(item.durationMs)) && Number(item.durationMs) >= 0, `public item ${item?.id} durationMs invalid`);
    }
    if (item.publishOriginal) {
      assert(typeof item.sourceImageUrl === "string" && item.sourceImageUrl.startsWith("/api/images/"), `public item ${item.id} sourceImageUrl invalid when publishOriginal=true`);
    }
    const thumbPath = `${item.imageUrl}${item.imageUrl.includes("?") ? "&" : "?"}variant=thumb`;
    const image = await fetchHead(thumbPath, "image/*,*/*;q=0.8");
    assert(image.status === 200, `public item ${item.id} image HEAD ${thumbPath} status=${image.status}`);
    assert((image.headers.get("content-type") || "").toLowerCase().startsWith("image/"), `public item ${item.id} image content-type invalid`);
  }
}

async function checkPrompts() {
  log("GET /api/prompts?limit=3");
  const { status, body } = await fetchJson("/api/prompts?limit=3");
  assert(status === 200, `/api/prompts status=${status}`);
  assert(body && Array.isArray(body.prompts), "/api/prompts missing prompts array");
  if (!Array.isArray(body?.prompts)) return;
  log(`/api/prompts returned ${body.prompts.length} item(s)`);
  assert(body.prompts.length > 0, "/api/prompts returned zero entries (seed missing?)");
  for (const item of body.prompts) {
    assert(typeof item?.id === "number" && item.id > 0, "prompt id must be positive number");
    assert(typeof item?.title === "string", `prompt ${item?.id} missing title`);
    assert(typeof item?.prompt === "string" && item.prompt.length > 0, `prompt ${item?.id} missing prompt content`);
    assert("tags" in item && Array.isArray(item.tags), `prompt ${item?.id} tags must be array`);
    assert(item?.status === "active", `public list should not contain status=${item?.status}`);
  }
}

async function checkTags() {
  log("GET /api/tags?limit=200");
  const { status, body } = await fetchJson("/api/tags?limit=200");
  assert(status === 200, `/api/tags status=${status}`);
  assert(body && Array.isArray(body.tags), "/api/tags missing tags array");
  if (!Array.isArray(body?.tags)) return;
  log(`/api/tags returned ${body.tags.length} item(s)`);
  assert(body.summary && typeof body.summary === "object", "/api/tags missing summary object");
  assert(Number.isFinite(Number(body.summary?.systemCount)), "/api/tags summary.systemCount invalid");
  assert(Number.isFinite(Number(body.summary?.withContentCount)), "/api/tags summary.withContentCount invalid");
  assert(Number.isFinite(Number(body.summary?.emptyCount)), "/api/tags summary.emptyCount invalid");
  assert(body.summary?.categoryCounts && typeof body.summary.categoryCounts === "object", "/api/tags summary.categoryCounts missing");
  assert(body.tags.length >= 80, `/api/tags should expose >= 80 active tags after seed (got ${body.tags.length})`);
  let systemCount = 0;
  let emptyTagCount = 0;
  for (const tag of body.tags) {
    assert(typeof tag?.slug === "string" && tag.slug.length > 0, "tag missing slug");
    assert(tag?.status === "active", `public list should not contain status=${tag?.status}`);
    assert(Number.isFinite(Number(tag?.hue)) && Number(tag.hue) >= 0 && Number(tag.hue) < 360, `tag ${tag?.slug} hue invalid`);
    assert(typeof tag?.labelZh === "string" && typeof tag?.labelEn === "string", `tag ${tag?.slug} missing label_zh/en`);
    assert(Array.isArray(tag?.aliases), `tag ${tag?.slug} aliases must be array`);
    assert(typeof tag?.category === "string" && tag.category.length > 0, `tag ${tag?.slug} missing category`);
    assert(typeof tag?.showInFilter === "boolean", `tag ${tag?.slug} showInFilter must be boolean`);
    assert(Number.isFinite(Number(tag?.sortOrder)), `tag ${tag?.slug} sortOrder invalid`);
    assert(Number.isFinite(Number(tag?.promptCount)), `tag ${tag?.slug} promptCount invalid`);
    assert(Number.isFinite(Number(tag?.galleryCount)), `tag ${tag?.slug} galleryCount invalid`);
    if (Number(tag.promptCount || 0) + Number(tag.galleryCount || 0) === 0) emptyTagCount += 1;
    if (tag.source === "system") systemCount += 1;
  }
  assert(systemCount >= 80, `expected >= 80 system tags (got ${systemCount})`);
  assert(Number(body.summary.systemCount) >= 80, `/api/tags summary.systemCount should be >= 80 (got ${body.summary.systemCount})`);
  assert(Number(body.summary.emptyCount) === emptyTagCount, `/api/tags summary.emptyCount mismatch (${body.summary.emptyCount} vs ${emptyTagCount})`);
}

async function main() {
  log(`base = ${baseUrl} (timeout ${timeoutMs}ms)`);
  await checkHomeResources();
  await checkAdminResources();
  await checkVersion();
  await checkHealth();
  await checkGrowth();
  await checkSettings();
  await checkAnnouncements();
  await checkPublicGallery();
  await checkPrompts();
  await checkTags();
  if (failures.length) {
    console.error(`[smoke] FAILED: ${failures.length} assertion(s) failed`);
    process.exit(1);
  }
  console.log("[smoke] OK: all checks passed");
}

main().catch((error) => {
  console.error("[smoke] crashed:", error?.stack || error);
  process.exit(2);
});
