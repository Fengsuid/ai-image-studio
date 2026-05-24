#!/usr/bin/env node
// Smoke test for the public surface of GPT Image Studio.
// Usage:
//   BASE_URL=http://127.0.0.1:3000 node scripts/smoke/check-public-api.mjs
//   node scripts/smoke/check-public-api.mjs http://localhost:3000
//
// The script exits with a non-zero code on the first failed assertion so that it
// can run as a deployment gate or a manual regression check.

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

async function checkHomeResources() {
  log("GET /");
  const home = await fetchText("/", "text/html,*/*");
  assert(home.status === 200, `/ status=${home.status}`);
  assert(home.headers.get("content-security-policy-report-only"), "/ missing CSP Report-Only header");
  assert(home.headers.get("x-content-type-options") === "nosniff", "/ missing nosniff header");
  assert(typeof home.body === "string" && home.body.includes("/styles.css"), "/ missing styles.css reference");
  assert(typeof home.body === "string" && home.body.includes("/app.js"), "/ missing app.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-layout.js"), "/ missing canvas-layout.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-edges.js"), "/ missing canvas-edges.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-minimap.js"), "/ missing canvas-minimap.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-history.js"), "/ missing canvas-history.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-selection.js"), "/ missing canvas-selection.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-io.js"), "/ missing canvas-io.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-assistant.js"), "/ missing canvas-assistant.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-toolbar.js"), "/ missing canvas-toolbar.js reference");
  assert(typeof home.body === "string" && home.body.includes("/canvas-inspector.js"), "/ missing canvas-inspector.js reference");
  assert(typeof home.body === "string" && home.body.includes("/gallery-normalize.js"), "/ missing gallery-normalize.js reference");
  assert(typeof home.body === "string" && home.body.includes("/gallery-leaderboard.js"), "/ missing gallery-leaderboard.js reference");
  assert(typeof home.body === "string" && home.body.includes("/gallery-detail-media.js"), "/ missing gallery-detail-media.js reference");
  assert(typeof home.body === "string" && home.body.includes("/gallery-tag-view-model.js"), "/ missing gallery-tag-view-model.js reference");
  assert(typeof home.body === "string" && home.body.includes("/generation-result-actions.js"), "/ missing generation-result-actions.js reference");
  assert(typeof home.body === "string" && home.body.includes("/reference-images.js"), "/ missing reference-images.js reference");
  assert(typeof home.body === "string" && home.body.includes("/home-onboarding.js"), "/ missing home-onboarding.js reference");
  assert(typeof home.body === "string" && home.body.includes("/frontend-performance.js"), "/ missing frontend-performance.js reference");
  assert(typeof home.body === "string" && home.body.includes("/app-prompt-library.js"), "/ missing app-prompt-library.js reference");
  assert(typeof home.body === "string" && home.body.includes("hero-pathway"), "/ missing home hero pathway");
  assert(typeof home.body === "string" && home.body.includes("homeDiscovery"), "/ missing home prompt discovery");
  assert(home.body.includes('property="og:title"'), "/ missing OG title metadata");
  assert(home.body.includes('name="twitter:card"'), "/ missing Twitter card metadata");

  const styleMatch = home.body.match(/href="([^"]*\/styles\.css[^"]*)"/);
  const appMatch = home.body.match(/src="([^"]*\/app\.js[^"]*)"/);
  const canvasLayoutMatch = home.body.match(/src="([^"]*\/canvas-layout\.js[^"]*)"/);
  const canvasEdgesMatch = home.body.match(/src="([^"]*\/canvas-edges\.js[^"]*)"/);
  const minimapMatch = home.body.match(/src="([^"]*\/canvas-minimap\.js[^"]*)"/);
  const canvasHistoryMatch = home.body.match(/src="([^"]*\/canvas-history\.js[^"]*)"/);
  const canvasSelectionMatch = home.body.match(/src="([^"]*\/canvas-selection\.js[^"]*)"/);
  const canvasIoMatch = home.body.match(/src="([^"]*\/canvas-io\.js[^"]*)"/);
  const canvasAssistantMatch = home.body.match(/src="([^"]*\/canvas-assistant\.js[^"]*)"/);
  const canvasToolbarMatch = home.body.match(/src="([^"]*\/canvas-toolbar\.js[^"]*)"/);
  const canvasInspectorMatch = home.body.match(/src="([^"]*\/canvas-inspector\.js[^"]*)"/);
  const galleryModelMatch = home.body.match(/src="([^"]*\/gallery-normalize\.js[^"]*)"/);
  const galleryLeaderboardMatch = home.body.match(/src="([^"]*\/gallery-leaderboard\.js[^"]*)"/);
  const galleryDetailMediaMatch = home.body.match(/src="([^"]*\/gallery-detail-media\.js[^"]*)"/);
  const galleryTagViewModelMatch = home.body.match(/src="([^"]*\/gallery-tag-view-model\.js[^"]*)"/);
  const generationResultActionsMatch = home.body.match(/src="([^"]*\/generation-result-actions\.js[^"]*)"/);
  const referenceImagesMatch = home.body.match(/src="([^"]*\/reference-images\.js[^"]*)"/);
  const homeOnboardingMatch = home.body.match(/src="([^"]*\/home-onboarding\.js[^"]*)"/);
  const frontendPerformanceMatch = home.body.match(/src="([^"]*\/frontend-performance\.js[^"]*)"/);
  const promptLibraryMatch = home.body.match(/src="([^"]*\/app-prompt-library\.js[^"]*)"/);
  const stylePath = styleMatch?.[1] || "/styles.css";
  const appPath = appMatch?.[1] || "/app.js";
  const canvasLayoutPath = canvasLayoutMatch?.[1] || "/canvas-layout.js";
  const canvasEdgesPath = canvasEdgesMatch?.[1] || "/canvas-edges.js";
  const minimapPath = minimapMatch?.[1] || "/canvas-minimap.js";
  const canvasHistoryPath = canvasHistoryMatch?.[1] || "/canvas-history.js";
  const canvasSelectionPath = canvasSelectionMatch?.[1] || "/canvas-selection.js";
  const canvasIoPath = canvasIoMatch?.[1] || "/canvas-io.js";
  const canvasAssistantPath = canvasAssistantMatch?.[1] || "/canvas-assistant.js";
  const canvasToolbarPath = canvasToolbarMatch?.[1] || "/canvas-toolbar.js";
  const canvasInspectorPath = canvasInspectorMatch?.[1] || "/canvas-inspector.js";
  const galleryModelPath = galleryModelMatch?.[1] || "/gallery-normalize.js";
  const galleryLeaderboardPath = galleryLeaderboardMatch?.[1] || "/gallery-leaderboard.js";
  const galleryDetailMediaPath = galleryDetailMediaMatch?.[1] || "/gallery-detail-media.js";
  const galleryTagViewModelPath = galleryTagViewModelMatch?.[1] || "/gallery-tag-view-model.js";
  const generationResultActionsPath = generationResultActionsMatch?.[1] || "/generation-result-actions.js";
  const referenceImagesPath = referenceImagesMatch?.[1] || "/reference-images.js";
  const homeOnboardingPath = homeOnboardingMatch?.[1] || "/home-onboarding.js";
  const frontendPerformancePath = frontendPerformanceMatch?.[1] || "/frontend-performance.js";
  const promptLibraryPath = promptLibraryMatch?.[1] || "/app-prompt-library.js";
  const styleVersion = new URL(stylePath, baseUrl).searchParams.get("v");
  const appVersion = new URL(appPath, baseUrl).searchParams.get("v");
  assert(styleVersion && styleVersion.length > 0, "/ styles.css should include cache-busting version");
  assert(appVersion && appVersion.length > 0, "/ app.js should include cache-busting version");
  if (styleVersion && appVersion) {
    assert(styleVersion === appVersion, `/ app.js/styles.css version mismatch (${appVersion} vs ${styleVersion})`);
  }

  log(`GET ${stylePath}`);
  const style = await fetchCssWithImports(stylePath);
  assert(style.status === 200, `${stylePath} status=${style.status}`);
  assert(style.body.length > 1000, `${stylePath} unexpectedly small`);
  assert(style.body.includes("admin-overview-hero"), `${stylePath} should style admin dashboard overview hero`);
  assert(style.body.includes("admin-quick-links"), `${stylePath} should style admin dashboard quick links`);
  assert(style.body.includes("admin-issue-list"), `${stylePath} should style admin dashboard issue list`);
  assert(style.body.includes("home-onboarding-card"), `${stylePath} should style home onboarding`);
  assert(style.body.includes("home-reduced-motion"), `${stylePath} should include home reduced motion fallback`);
  assert(style.body.includes("prompt-library-card"), `${stylePath} should style prompt library cards`);
  assert(style.body.includes("prompt-library-state"), `${stylePath} should style prompt library states`);

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

  log(`GET ${promptLibraryPath}`);
  const promptLibrary = await fetchText(promptLibraryPath, "application/javascript,*/*");
  assert(promptLibrary.status === 200, `${promptLibraryPath} status=${promptLibrary.status}`);
  assert(promptLibrary.body.includes("AppModules?.register?.(\"promptLibrary\""), `${promptLibraryPath} should register promptLibrary module`);
  assert(promptLibrary.body.includes("renderPromptCard"), `${promptLibraryPath} should render prompt cards`);
  assert(promptLibrary.body.includes("renderLibraryState"), `${promptLibraryPath} should render loading/empty/error states`);
  assert(promptLibrary.body.includes("renderPromptDetailModal"), `${promptLibraryPath} should render prompt detail modal`);

  log(`GET ${appPath}`);
  const app = await fetchText(appPath, "application/javascript,*/*");
  assert(app.status === 200, `${appPath} status=${app.status}`);
  assert(app.body.length > 1000, `${appPath} unexpectedly small`);
  assert(app.body.includes("/api/version"), `${appPath} should request /api/version`);
  assert(app.body.includes("/api/images/requests/active"), `${appPath} should resume active generation requests`);
  assert(app.body.includes("candidate-strip"), `${appPath} should expose multi-candidate selection UI`);
  assert(app.body.includes("/api/rum"), `${appPath} should report RUM metrics`);
  assert(app.body.includes("providerCapabilities"), `${appPath} should read provider capability flags`);
  assert(app.body.includes("function isImageToImageItem"), `${appPath} should classify image-to-image works from source metadata`);
  assert(app.body.includes("window.history.replaceState(route"), `${appPath} should close modal routes without adding history entries`);
  assert(app.body.includes("publicTagsForKind(selectedKinds[0]"), `${appPath} should preserve kind tags in bulk publish`);
  assert(app.body.includes("referenceRequestPayload"), `${appPath} should build reference image payloads`);
  assert(app.body.includes("referenceImages"), `${appPath} should send multi-reference images to image edit requests`);
  assert(app.body.includes("maxReferenceImages"), `${appPath} should read configurable reference image limits`);
  assert(app.body.includes("data-reference-row-input"), `${appPath} should let the reference row append more images`);
  assert(app.body.includes("handleEditorUpload(event.target.files"), `${appPath} should pass multiple editor upload files`);
  assert(app.body.includes("appendReferences: true"), `${appPath} should append bottom editor uploads as references`);
  assert(app.body.includes("promptLibraryModule()"), `${appPath} should delegate prompt library rendering to module`);
  assert(app.body.includes("promptLibraryMeta"), `${appPath} should track prompt library remote/fallback state`);
  assert(app.body.includes("setLikeFeedback"), `${appPath} should surface prompt like failure feedback`);

  log(`GET ${canvasLayoutPath}`);
  const canvasLayout = await fetchText(canvasLayoutPath, "application/javascript,*/*");
  assert(canvasLayout.status === 200, `${canvasLayoutPath} status=${canvasLayout.status}`);
  assert(canvasLayout.body.includes("root.layout"), `${canvasLayoutPath} should register canvas layout module`);
  assert(canvasLayout.body.includes("fitNodesInBoard"), `${canvasLayoutPath} should support centering canvas nodes in the board`);

  log(`GET ${canvasEdgesPath}`);
  const canvasEdges = await fetchText(canvasEdgesPath, "application/javascript,*/*");
  assert(canvasEdges.status === 200, `${canvasEdgesPath} status=${canvasEdges.status}`);
  assert(canvasEdges.body.includes("root.edges"), `${canvasEdgesPath} should register canvas edges module`);
  assert(canvasEdges.body.includes("edgeEndpoints"), `${canvasEdgesPath} should expose node edge endpoint geometry`);

  log(`GET ${minimapPath}`);
  const minimap = await fetchText(minimapPath, "application/javascript,*/*");
  assert(minimap.status === 200, `${minimapPath} status=${minimap.status}`);
  assert(minimap.body.includes("root.minimap"), `${minimapPath} should register canvas minimap module`);
  assert(minimap.body.includes("viewportFromEvent"), `${minimapPath} should support minimap viewport navigation`);

  log(`GET ${canvasHistoryPath}`);
  const canvasHistory = await fetchText(canvasHistoryPath, "application/javascript,*/*");
  assert(canvasHistory.status === 200, `${canvasHistoryPath} status=${canvasHistory.status}`);
  assert(canvasHistory.body.includes("root.history"), `${canvasHistoryPath} should register canvas history module`);
  assert(canvasHistory.body.includes("createController"), `${canvasHistoryPath} should expose history controller`);
  assert(canvasHistory.body.includes("paste"), `${canvasHistoryPath} should support paste operations`);
  assert(canvasHistory.body.includes("selectedNodeIds"), `${canvasHistoryPath} should preserve pasted selection ids`);

  log(`GET ${canvasSelectionPath}`);
  const canvasSelection = await fetchText(canvasSelectionPath, "application/javascript,*/*");
  assert(canvasSelection.status === 200, `${canvasSelectionPath} status=${canvasSelection.status}`);
  assert(canvasSelection.body.includes("root.selection"), `${canvasSelectionPath} should register canvas selection module`);
  assert(canvasSelection.body.includes("nodesInRect"), `${canvasSelectionPath} should support marquee selection`);
  assert(canvasSelection.body.includes("groupFromNodes"), `${canvasSelectionPath} should support grouping selected nodes`);

  log(`GET ${canvasIoPath}`);
  const canvasIo = await fetchText(canvasIoPath, "application/javascript,*/*");
  assert(canvasIo.status === 200, `${canvasIoPath} status=${canvasIo.status}`);
  assert(canvasIo.body.includes("root.io"), `${canvasIoPath} should register canvas IO module`);
  assert(canvasIo.body.includes("exportCanvas"), `${canvasIoPath} should support canvas JSON export`);
  assert(canvasIo.body.includes("importCanvas"), `${canvasIoPath} should support canvas JSON import`);

  log(`GET ${canvasAssistantPath}`);
  const canvasAssistant = await fetchText(canvasAssistantPath, "application/javascript,*/*");
  assert(canvasAssistant.status === 200, `${canvasAssistantPath} status=${canvasAssistant.status}`);
  assert(canvasAssistant.body.includes("root.assistant"), `${canvasAssistantPath} should register canvas assistant module`);
  assert(canvasAssistant.body.includes("createController"), `${canvasAssistantPath} should expose assistant controller`);
  assert(canvasAssistant.body.includes("suggestionToNodeInput"), `${canvasAssistantPath} should convert suggestions into nodes`);

  log(`GET ${canvasToolbarPath}`);
  const canvasToolbar = await fetchText(canvasToolbarPath, "application/javascript,*/*");
  assert(canvasToolbar.status === 200, `${canvasToolbarPath} status=${canvasToolbar.status}`);
  assert(canvasToolbar.body.includes("root.toolbar"), `${canvasToolbarPath} should register canvas toolbar module`);
  assert(canvasToolbar.body.includes("renderHistoryControls"), `${canvasToolbarPath} should expose toolbar control rendering`);

  log(`GET ${canvasInspectorPath}`);
  const canvasInspector = await fetchText(canvasInspectorPath, "application/javascript,*/*");
  assert(canvasInspector.status === 200, `${canvasInspectorPath} status=${canvasInspector.status}`);
  assert(canvasInspector.body.includes("root.inspector"), `${canvasInspectorPath} should register canvas inspector module`);
  assert(canvasInspector.body.includes("connectionPanel"), `${canvasInspectorPath} should render connection inspector controls`);

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
  log("/ resources ok:", "asset version", appVersion || "none");
}

async function checkAdminResources() {
  log("GET /admin");
  const admin = await fetchText("/admin", "text/html,*/*");
  assert(admin.status === 200, `/admin status=${admin.status}`);
  assert(admin.body.includes("/admin.js"), "/admin missing admin.js reference");
  assert(admin.body.includes("admin-shell"), "/admin missing admin shell markup");

  const scriptMatch = admin.body.match(/src="([^"]*\/admin\.js[^"]*)"/);
  const styleMatch = admin.body.match(/href="([^"]*\/styles\.css[^"]*)"/);
  const scriptPath = scriptMatch?.[1] || "/admin.js";
  const stylePath = styleMatch?.[1] || "/styles.css";
  const scriptVersion = new URL(scriptPath, baseUrl).searchParams.get("v");
  const styleVersion = new URL(stylePath, baseUrl).searchParams.get("v");
  assert(scriptVersion && scriptVersion.length > 0, "/admin admin.js should include cache-busting version");
  assert(styleVersion && styleVersion.length > 0, "/admin styles.css should include cache-busting version");
  if (scriptVersion && styleVersion) {
    assert(scriptVersion === styleVersion, `/admin admin.js/styles.css version mismatch (${scriptVersion} vs ${styleVersion})`);
  }

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
  const adminModuleScripts = [...admin.body.matchAll(/src="([^"]*\/admin-(?:overview|users|providers|gallery|settings)\.js[^"]*)"/g)]
    .map((match) => match[1]);
  assert(adminModuleScripts.length >= 5, "/admin should load admin panel modules before admin.js");
  const moduleBodies = [];
  for (const modulePath of adminModuleScripts) {
    log(`GET ${modulePath}`);
    const module = await fetchText(modulePath, "application/javascript,*/*");
    assert(module.status === 200, `${modulePath} status=${module.status}`);
    assert(module.body.includes("window.AdminModules") || module.body.includes("AdminModules"), `${modulePath} should register an AdminModules entry`);
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
  assert(script.body.includes("if (isNew || apiKey) payload.apiKey = apiKey"), `${scriptPath} should not clear provider API keys when edit field is blank`);
  assert(script.body.includes("Provider JSON 格式错误"), `${scriptPath} should handle invalid provider JSON before saving`);
  log("/admin resources ok:", "asset version", scriptVersion || "none");
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
