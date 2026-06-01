#!/usr/bin/env node
// Visual regression smoke using Chrome DevTools Protocol without browser deps.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = parseArgs(process.argv.slice(2));
let targetArg = cli.target || "";
const outputRoot = cli.outputRoot || path.join(rootDir, "docs/mobile-qa/visual-regression/runs");
const baselineRoot = process.env.VISUAL_REGRESSION_BASELINE_DIR
  || path.join(rootDir, "docs/mobile-qa/baseline-local");
const requireBaseline = process.env.VISUAL_REGRESSION_REQUIRE_BASELINE === "1";
const pixelDiffThreshold = Number(process.env.VISUAL_REGRESSION_PIXEL_DIFF_THRESHOLD || 0.012);
const channelTolerance = Number(process.env.VISUAL_REGRESSION_CHANNEL_TOLERANCE || 18);
const brandPrimaryShift = process.env.VISUAL_REGRESSION_BRAND_PRIMARY_SHIFT || "";
const chromePath = process.env.CHROME_PATH || findChromeExecutable();
const port = Number(process.env.VISUAL_REGRESSION_CDP_PORT || 9422);
const cdpTimeoutMs = Number(process.env.VISUAL_REGRESSION_CDP_TIMEOUT_MS || 30000);
const isExternalTarget = Boolean(targetArg);
let staticServer = null;

const viewports = {
  mobile: { name: "390x844", width: 390, height: 844, mobile: true },
  mobile375: { name: "375x812", width: 375, height: 812, mobile: true },
  tablet768: { name: "768x1024", width: 768, height: 1024, mobile: true },
  desktop: { name: "1280x720", width: 1280, height: 720, mobile: false },
  desktop1440: { name: "1440x900", width: 1440, height: 900, mobile: false }
};

const sampleIds = await discoverSampleIds(targetArg);

const scenarios = [
  {
    name: "home-composer-light-desktop",
    url: "/",
    theme: "light",
    viewport: "desktop",
    readySelector: "#homeView",
    requiredVisible: ["#homeView", "#heroComposerMount", "#heroComposerMount .send-button"],
    coreButtons: ["#heroComposerMount .send-button", "#topbarSearchBtn", "#topbarGenerateBtn", "#promptLibraryBtn"],
    cardSelectors: [".example-card", ".recent-tile"],
    manualReview: "Home hero, composer hierarchy, prompt discovery cards."
  },
  {
    name: "home-composer-dark-mobile",
    url: "/",
    theme: "dark",
    viewport: "mobile",
    readySelector: "#homeView",
    requiredVisible: ["#homeView", "#heroComposerMount", "#heroComposerMount .send-button", ".bottom-nav"],
    coreButtons: ["#heroComposerMount .send-button", "[data-mobile-nav-action='generate']"],
    checkBottomNav: true,
    manualReview: "Dark home hero, mobile composer, bottom navigation spacing."
  },
  {
    name: "home-topbar-density-light-1440",
    url: "/",
    theme: "light",
    viewport: "desktop1440",
    readySelector: "#homeView",
    requiredVisible: ["#homeView", "#brandBtn", "#topbarSearchBtn", "#topbarGenerateBtn", "#promptLibraryBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    coreButtons: ["#topbarSearchBtn", "#topbarGenerateBtn", "#promptLibraryBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    topbarExpectation: { mode: "desktop", maxHeight: 60 },
    baseline: false,
    manualReview: "AIS-RLS-135 evidence: 1440 desktop compact topbar with visible workspace access."
  },
  {
    name: "home-topbar-density-light-768",
    url: "/",
    theme: "light",
    viewport: "tablet768",
    readySelector: "#homeView",
    requiredVisible: ["#homeView", "#brandBtn", "#topbarSearchBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    coreButtons: ["#topbarSearchBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    topbarExpectation: { mode: "tablet", maxHeight: 60 },
    baseline: false,
    manualReview: "AIS-RLS-135 evidence: 768 tablet topbar with overflow menu trigger."
  },
  {
    name: "home-topbar-density-light-375",
    url: "/",
    theme: "light",
    viewport: "mobile375",
    readySelector: "#homeView",
    requiredVisible: ["#homeView", "#brandBtn", "#topbarSearchBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    coreButtons: ["#topbarSearchBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    topbarExpectation: { mode: "mobile", maxHeight: 56 },
    baseline: false,
    manualReview: "AIS-RLS-135 evidence: 375 mobile topbar with logo, search, workspace menu, and avatar."
  },
  {
    name: "home-topbar-density-dark-1440",
    url: "/",
    theme: "dark",
    viewport: "desktop1440",
    readySelector: "#homeView",
    requiredVisible: ["#homeView", "#brandBtn", "#topbarSearchBtn", "#topbarGenerateBtn", "#promptLibraryBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    coreButtons: ["#topbarSearchBtn", "#topbarGenerateBtn", "#promptLibraryBtn", "#topbarOverflowBtn", "#accountMenuBtn"],
    topbarExpectation: { mode: "desktop", maxHeight: 60 },
    baseline: false,
    manualReview: "AIS-RLS-135 evidence: 1440 dark-mode compact topbar with visible workspace access."
  },
  {
    name: "gallery-library-light-desktop",
    url: "/?view=library",
    theme: "light",
    viewport: "desktop",
    readySelector: "#libraryView",
    requiredVisible: ["#libraryView", "#librarySearchInput", "#promptGrid", ".prompt-library-card"],
    coreButtons: ["#librarySearchForm button", "#topbarSearchBtn", "#promptLibraryBtn"],
    cardSelectors: [".prompt-library-card"],
    manualReview: "Prompt library cards, filter chips, sort and gallery density."
  },
  {
    name: "gallery-library-dark-mobile",
    url: "/?view=library",
    theme: "dark",
    viewport: "mobile",
    readySelector: "#libraryView",
    requiredVisible: ["#libraryView", "#promptGrid", ".prompt-library-card", ".bottom-nav"],
    coreButtons: ["#librarySearchForm button", "[data-mobile-nav-action='library']"],
    cardSelectors: [".prompt-library-card"],
    checkBottomNav: true,
    manualReview: "Dark gallery cards, mobile bottom nav, tag/filter wrapping."
  },
  {
    name: "gallery-detail-modal-light-mobile",
    url: `/?view=library&modal=square&gallery=${encodeURIComponent(sampleIds.galleryId)}`,
    theme: "light",
    viewport: "mobile",
    readySelector: ".square-preview-modal",
    requiredVisible: [".square-preview-modal", ".square-preview-stage", ".square-preview-actions"],
    coreButtons: [".square-preview-close"],
    allowMissingExternal: true,
    manualReview: "Gallery detail modal, sticky actions, media stage and route cards."
  },
  {
    name: "prompt-detail-dark-desktop",
    url: "/?view=library",
    theme: "dark",
    viewport: "desktop",
    readySelector: ".square-preview-modal",
    postReadyAction: "openPromptDetail",
    requiredVisible: [".square-preview-modal", ".square-preview-stage", ".square-preview-actions"],
    coreButtons: [".square-preview-close", ".square-preview-actions button"],
    manualReview: "Prompt detail modal in dark mode; no leftover white panels."
  },
  {
    name: "editor-light-mobile",
    url: "/?view=editor",
    theme: "light",
    viewport: "mobile",
    readySelector: "#editorView",
    postReadyAction: "seedEditorImage",
    requiredVisible: ["#editorView", "#editorPromptForm", "#editorImageFrame", "#editorSourceImage"],
    coreButtons: ["#editorPromptForm button", ".editor-publish-panel .square-toggle"],
    manualReview: "Editor image stage, prompt bar and publish controls."
  },
  {
    name: "my-works-dark-mobile",
    url: `/?view=library&modal=works&work=${encodeURIComponent(sampleIds.workId)}`,
    theme: "dark",
    viewport: "mobile",
    readySelector: ".works-detail-drawer",
    requiredVisible: [".works-modal", ".works-detail-drawer", ".works-detail-stage", ".works-detail-actions"],
    coreButtons: [".works-detail-close", ".works-detail-actions button", ".works-detail-actions a"],
    allowMissingExternal: true,
    manualReview: "My works drawer, action bar, detail image and dark-mode surfaces."
  },
  {
    name: "admin-shell-light-desktop",
    url: "/admin#overview",
    theme: "light",
    viewport: "desktop",
    readySelector: "#adminContent .admin-panel, #adminContent .admin-auth-required",
    requiredVisible: ["#adminApp", ".admin-sidebar", ".admin-topbar", "#adminContent"],
    coreButtons: ["#adminRefreshBtn", "#adminSidebarToggle"],
    cardSelectors: [".admin-panel", ".admin-stat"],
    manualReview: "Admin overview shell, status pills, dashboard panels."
  },
  {
    name: "admin-shell-dark-mobile",
    url: "/admin#overview",
    theme: "dark",
    viewport: "mobile",
    readySelector: "#adminContent .admin-panel, #adminContent .admin-auth-required",
    requiredVisible: ["#adminApp", ".admin-topbar", "#adminContent"],
    coreButtons: ["#adminRefreshBtn", "#adminSidebarToggle"],
    cardSelectors: [".admin-panel", ".admin-stat"],
    manualReview: "Admin mobile shell and dark-mode panel colors."
  }
];

function parseArgs(args) {
  const parsed = { target: "", outputRoot: "", filter: "" };
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--filter") {
      parsed.filter = args[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg.startsWith("--filter=")) {
      parsed.filter = arg.slice("--filter=".length);
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown visual regression option: ${arg}`);
    }
    positional.push(arg);
  }
  parsed.target = positional[0] || "";
  parsed.outputRoot = positional[1] || "";
  return parsed;
}

function filterScenarios(source, filter) {
  if (!filter) return source;
  const normalized = filter.toLowerCase();
  return source.filter((scenario) => scenario.name.toLowerCase().includes(normalized));
}

async function main() {
  if (!chromePath) {
    throw new Error("Chrome executable not found. Set CHROME_PATH to run visual regression smoke.");
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(outputRoot, runId);
  await fs.mkdir(outputDir, { recursive: true });

  if (!targetArg) {
    staticServer = await startVisualServer();
    targetArg = `http://127.0.0.1:${staticServer.port}`;
  }

  const summary = {
    target: targetArg,
    outputDir,
    baselineRoot,
    createdAt: new Date().toISOString(),
    pixelDiffThreshold,
    channelTolerance,
    scenarios: [],
    failures: [],
    warnings: [],
    comparisons: []
  };

  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-image-studio-visual-regression-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--use-gl=swiftshader",
    "--use-angle=swiftshader",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitForCdpVersion(port);
    const pageTarget = await waitForPageTarget(port);
    const cdp = await CdpClient.connect(pageTarget.webSocketDebuggerUrl);
    const sessionId = "";
    const browserWindow = await cdp.send("Browser.getWindowForTarget", { targetId: pageTarget.id }).catch(() => null);
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);

    const activeScenarios = filterScenarios(scenarios, cli.filter);
    if (!activeScenarios.length) {
      throw new Error(`No visual regression scenarios matched filter: ${cli.filter}`);
    }

    for (const scenario of activeScenarios) {
      const viewport = viewports[scenario.viewport] || viewports.desktop;
      if (browserWindow?.windowId) {
        await cdp.send("Browser.setWindowBounds", {
          windowId: browserWindow.windowId,
          bounds: { windowState: "normal", width: viewport.width, height: viewport.height, left: 0, top: 0 },
        }).catch(() => null);
      }
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
        scale: 1,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
        positionX: 0,
        positionY: 0,
      }, sessionId);
      await cdp.send("Emulation.setVisibleSize", { width: viewport.width, height: viewport.height }, sessionId).catch(() => null);
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile }, sessionId);

      const url = resolvePageUrl(targetArg, scenario.url);
      const initScript = await addStableVisualInitScript(cdp, sessionId, scenario.theme);
      await cdp.send("Page.navigate", { url }, sessionId);
      await delay(1600);
      await setStableVisualState(cdp, sessionId, scenario.theme);
      if (initScript?.identifier) {
        await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: initScript.identifier }, sessionId).catch(() => null);
      }
      await waitForReadySelector(cdp, sessionId, scenario.readySelector, 9000);
      if (scenario.postReadyAction) {
        await runPostReadyAction(cdp, sessionId, scenario.postReadyAction);
        await delay(500);
        await waitForReadySelector(cdp, sessionId, scenario.readySelector, 5000);
      }
      await cdp.send("Runtime.evaluate", {
        expression: "document.fonts?.ready ? document.fonts.ready.then(() => true) : true",
        awaitPromise: true,
      }, sessionId).catch(() => null);
      await delay(180);

      const result = await evaluateScenario(cdp, sessionId, scenario, viewport);
      const screenshotName = `${scenario.name}.png`;
      const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
      const screenshotPath = path.join(outputDir, screenshotName);
      await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
      result.screenshot = screenshotName;

      const comparison = scenario.baseline === false
        ? {
            screenshot: screenshotName,
            baseline: "",
            status: "manual-evidence",
            diffRatio: null,
            differentPixels: null,
            totalPixels: null
          }
        : await compareWithBaseline(screenshotName, screenshotPath);
      result.comparison = comparison;
      summary.comparisons.push(comparison);
      if (comparison.failure) result.failures.push(`${scenario.name}: ${comparison.failure}`);
      if (comparison.warning) result.warnings.push(`${scenario.name}: ${comparison.warning}`);

      summary.scenarios.push(result);
      if (result.failures.length) summary.failures.push(...result.failures);
      if (result.warnings.length) summary.warnings.push(...result.warnings);
    }

    cdp.close();
  } finally {
    chrome.kill();
    if (staticServer?.server) await new Promise((resolve) => staticServer.server.close(resolve));
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => null);
  }

  await writeSummaryFiles(summary, outputDir);

  if (summary.failures.length) {
    console.error(`[visual-regression-smoke] FAIL: ${summary.failures.length} failures. Summary: ${path.join(outputDir, "summary.json")}`);
    for (const failure of summary.failures.slice(0, 12)) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`[visual-regression-smoke] OK: ${summary.scenarios.length} scenarios. Output: ${outputDir}`);
  for (const item of summary.scenarios) {
    console.log(`[visual-regression-smoke] ${item.scenario} Baseline: ${item.comparison?.status || "not-run"}`);
  }
  if (summary.warnings.length) {
    console.log(`[visual-regression-smoke] warnings: ${summary.warnings.length}; see summary.json`);
  }
}

class CdpClient {
  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const client = new CdpClient(socket);
      socket.addEventListener("open", () => resolve(client), { once: true });
      socket.addEventListener("error", (event) => reject(event.error || new Error("CDP WebSocket error")), { once: true });
    });
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.closedIntentionally = false;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message || "CDP error"} (${message.error.code || ""})`));
      else pending.resolve(message.result || {});
    });
    socket.addEventListener("close", () => {
      if (!this.closedIntentionally) this.rejectPending(new Error("CDP WebSocket closed"));
    });
    socket.addEventListener("error", () => {
      if (!this.closedIntentionally) this.rejectPending(new Error("CDP WebSocket error"));
    });
  }

  send(method, params = {}, sessionId = "") {
    const id = this.nextId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, cdpTimeoutMs);
      this.pending.set(id, {
        method,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
      try {
        this.socket.send(JSON.stringify(payload));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  rejectPending(error) {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      const method = pending.method ? ` during ${pending.method}` : "";
      pending.reject(new Error(`${error.message || error}${method}`));
    }
  }

  close() {
    this.closedIntentionally = true;
    this.socket.close();
  }
}

async function discoverSampleIds(base) {
  const fallback = { galleryId: "visual-smoke-1", workId: "visual-smoke-1" };
  if (!base) return fallback;
  try {
    const data = await fetch(new URL("/api/images/public?limit=1", ensureTrailingSlash(base))).then((response) => response.json());
    const generation = data.generations?.[0];
    const id = generation?.id || generation?.generationId || fallback.galleryId;
    return { galleryId: id, workId: id };
  } catch {
    return fallback;
  }
}

function findChromeExecutable() {
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ]
    : [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
      ];
  return candidates.find((candidate) => fsSync.existsSync(candidate)) || "";
}

async function waitForCdpVersion(cdpPort) {
  const url = `http://127.0.0.1:${cdpPort}/json/version`;
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      await delay(150);
    }
  }
  throw new Error(`Chrome CDP did not start on ${url}`);
}

async function waitForPageTarget(cdpPort) {
  const url = `http://127.0.0.1:${cdpPort}/json/list`;
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const targets = await response.json();
        const target = Array.isArray(targets)
          ? targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl)
          : null;
        if (target) return target;
      }
    } catch {
      await delay(150);
    }
  }
  throw new Error(`Chrome page target did not appear on ${url}`);
}

function resolvePageUrl(base, pagePath) {
  return new URL(pagePath, ensureTrailingSlash(base)).href;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

async function setStableVisualState(cdp, sessionId, theme) {
  const expression = `(${stableVisualStateProbe.toString()})(${JSON.stringify(theme)}, ${JSON.stringify(brandPrimaryShift)})`;
  await cdp.send("Runtime.evaluate", { expression, awaitPromise: true }, sessionId).catch(() => null);
}

async function addStableVisualInitScript(cdp, sessionId, theme) {
  const source = `(${stableVisualInitProbe.toString()})(${JSON.stringify(theme)})`;
  return cdp.send("Page.addScriptToEvaluateOnNewDocument", { source }, sessionId).catch(() => null);
}

function stableVisualInitProbe(theme) {
  try {
    localStorage.setItem("imageStudio.theme", theme);
    localStorage.setItem("imageStudioComplianceNoticeV1", "seen");
  } catch {
    // localStorage may be unavailable in hardened browser contexts.
  }
}

function stableVisualStateProbe(theme, primaryShift) {
  try {
    localStorage.setItem("imageStudio.theme", theme);
    localStorage.setItem("imageStudioComplianceNoticeV1", "seen");
  } catch {
    // localStorage may be unavailable in hardened browser contexts.
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (!document.getElementById("visualRegressionFreezeStyle")) {
    const style = document.createElement("style");
    style.id = "visualRegressionFreezeStyle";
    style.textContent = `
      *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; scroll-behavior: auto !important; }
      .inspiration-band, .example-grid, .prompt-grid, .works-grid, #adminContent { content-visibility: visible !important; contain-intrinsic-size: auto !important; }
      video { opacity: 0 !important; }
    `;
    document.head.appendChild(style);
  }
  if (primaryShift) {
    document.documentElement.style.setProperty("--brand-primary", primaryShift);
    document.documentElement.style.setProperty("--brand", primaryShift);
    document.documentElement.style.setProperty("--brand-strong", primaryShift);
    document.documentElement.style.setProperty("--brand-soft", `color-mix(in srgb, ${primaryShift} 18%, transparent)`);
  }
  const layer = document.querySelector("#modalLayer");
  const blockingNotice = document.querySelector(".compliance-modal, .announcement-modal-single");
  if (layer && blockingNotice?.closest("#modalLayer")) {
    layer.classList.add("hidden");
    layer.classList.remove("square-preview-layer", "image-zoom-layer");
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = "";
  }
  window.ImageStudioThemeNav?.sync?.({});
}

async function runPostReadyAction(cdp, sessionId, action) {
  const expression = `(${postReadyProbe.toString()})(${JSON.stringify(action)})`;
  await cdp.send("Runtime.evaluate", { expression, awaitPromise: true }, sessionId);
}

function postReadyProbe(action) {
  if (action === "openPromptDetail") {
    const trigger = document.querySelector("[data-view-prompt], [data-open-prompt]");
    trigger?.click();
    return Boolean(trigger);
  }
  if (action === "seedEditorImage") {
    const sampleImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%232563eb'/%3E%3Cstop offset='1' stop-color='%230f766e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='420' rx='36' fill='url(%23g)'/%3E%3Ccircle cx='500' cy='120' r='78' fill='rgba(255,255,255,.32)'/%3E%3Cpath d='M72 326 212 194l98 84 74-62 184 110z' fill='rgba(255,255,255,.72)'/%3E%3C/svg%3E";
    document.querySelector("#editorUploadCard")?.classList.add("hidden");
    const frame = document.querySelector("#editorImageFrame");
    frame?.classList.remove("hidden");
    if (frame) {
      frame.style.width = "320px";
      frame.style.height = "210px";
      frame.style.maxWidth = "calc(100vw - 42px)";
      frame.style.maxHeight = "260px";
    }
    const scaler = document.querySelector("#editorImageScaler");
    if (scaler) {
      scaler.style.width = "100%";
      scaler.style.height = "100%";
    }
    const sourceImage = document.querySelector("#editorSourceImage");
    if (sourceImage) {
      sourceImage.src = sampleImage;
      sourceImage.style.display = "block";
      sourceImage.style.width = "100%";
      sourceImage.style.height = "100%";
      sourceImage.style.objectFit = "contain";
    }
    const promptInput = document.querySelector("#editorPromptInput");
    if (promptInput) promptInput.value = "Visual regression edit prompt";
    return true;
  }
  return false;
}

async function waitForReadySelector(cdp, sessionId, selector, timeoutMs = 9000) {
  if (!selector) return;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await cdp.send("Runtime.evaluate", {
      expression: `(${readySelectorProbe.toString()})(${JSON.stringify(selector)})`,
      returnByValue: true,
    }, sessionId).catch(() => null);
    if (response?.result?.value === true) return;
    await delay(180);
  }
}

function readySelectorProbe(selector) {
  const candidates = [...document.querySelectorAll(selector)];
  return candidates.some((el) => {
    if (el.closest(".hidden")) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  });
}

async function evaluateScenario(cdp, sessionId, scenario, viewport) {
  const response = await cdp.send("Runtime.evaluate", {
    expression: `(${visualProbe.toString()})(${JSON.stringify(scenario)}, ${JSON.stringify(viewport)}, ${JSON.stringify(isExternalTarget)})`,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  assert(!response.exceptionDetails, response.exceptionDetails?.text || "visual probe failed");
  return response.result.value;
}

async function visualProbe(scenario, viewport, externalTarget) {
  const failures = [];
  const warnings = [];
  const pageLabel = scenario.name;
  const doc = document.documentElement;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const overflow = Math.max(doc.scrollWidth, document.body?.scrollWidth || 0) - viewportWidth;
  if (overflow > 1) failures.push(`${pageLabel}: horizontal overflow ${Math.round(overflow)}px`);

  const isElementVisible = (el) => {
    if (!el) return { ok: false, reason: "missing" };
    if (el.closest(".hidden")) return { ok: false, reason: "hidden ancestor" };
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const ok = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    return { ok, reason: ok ? "" : `hidden ${Math.round(rect.width)}x${Math.round(rect.height)}`, rect, style };
  };
  const visible = (selector) => {
    const candidates = [...document.querySelectorAll(selector)];
    if (!candidates.length) return { ok: false, reason: "missing" };
    const firstVisible = candidates.find((el) => isElementVisible(el).ok);
    return firstVisible ? { ok: true, reason: "", el: firstVisible, rect: firstVisible.getBoundingClientRect(), style: getComputedStyle(firstVisible) } : isElementVisible(candidates[0]);
  };
  const recordVisibility = (selector, level = "failure") => {
    const result = visible(selector);
    if (result.ok) return result;
    const message = `${pageLabel}: required selector ${selector} ${result.reason}`;
    if (level === "warning") warnings.push(message);
    else failures.push(message);
    return result;
  };

  const missingLevel = externalTarget && scenario.allowMissingExternal ? "warning" : "failure";
  for (const selector of scenario.requiredVisible || []) recordVisibility(selector, missingLevel);

  for (const selector of scenario.coreButtons || []) {
    const result = visible(selector);
    if (!result.ok) {
      warnings.push(`${pageLabel}: core control ${selector} ${result.reason}`);
      continue;
    }
    const rect = result.rect;
    if (viewport.mobile && (rect.height < 40 || rect.width < 40)) {
      failures.push(`${pageLabel}: core control ${selector} touch target ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
      const mustBeInViewport = isFixedLike(result.el) || result.el.closest(".topbar, .bottom-nav, .sticky-composer, .editor-prompt-bar");
    if (mustBeInViewport && (rect.right > viewportWidth + 1 || rect.left < -1 || rect.top < -1 || rect.bottom > viewportHeight + 1)) {
      failures.push(`${pageLabel}: core control ${selector} outside viewport (${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.right)}x${Math.round(rect.bottom)} / ${viewportWidth}x${viewportHeight})`);
    }
  }

  const modalSelectors = [".square-preview-modal", ".works-modal", ".works-detail-drawer", ".admin-drawer", ".modal:not(.hidden)"];
  for (const selector of modalSelectors) {
    for (const el of [...document.querySelectorAll(selector)]) {
      const result = isElementVisible(el);
      if (!result.ok) continue;
      const rect = result.rect;
      if (rect.left < -1 || rect.right > viewportWidth + 1 || rect.top < -24 || rect.bottom > viewportHeight + 24) {
        failures.push(`${pageLabel}: modal ${selector} overflows viewport (${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.right)}x${Math.round(rect.bottom)} / ${viewportWidth}x${viewportHeight})`);
      }
    }
  }

  if (scenario.checkBottomNav) {
    const navResult = visible(".bottom-nav");
    if (navResult.ok) {
      const navRect = navResult.rect;
      if (Math.abs(navRect.bottom - viewportHeight) > 2 || navRect.top < viewportHeight - 160) {
        failures.push(`${pageLabel}: bottom nav unexpected position (${Math.round(navRect.top)}..${Math.round(navRect.bottom)} / ${viewportHeight})`);
      }
      const actionSelectors = ["#heroComposerMount .send-button", "#stickyComposerMount .send-button", ".square-preview-actions button", ".works-detail-actions button", "#editorPromptForm button"];
      for (const selector of actionSelectors) {
        for (const el of [...document.querySelectorAll(selector)]) {
          if (el.closest(".bottom-nav")) continue;
          const result = isElementVisible(el);
          if (!result.ok) continue;
          const rect = result.rect;
          const overlaps = rect.bottom > navRect.top + 2 && rect.top < navRect.bottom - 2;
          if (overlaps) failures.push(`${pageLabel}: bottom nav overlaps ${selector}`);
        }
      }
    }
  }

  if (scenario.topbarExpectation) {
    const topbar = document.querySelector(".topbar");
    const topbarResult = isElementVisible(topbar);
    if (!topbarResult.ok) {
      failures.push(`${pageLabel}: topbar ${topbarResult.reason}`);
    } else {
      const topbarHeight = Math.round(topbarResult.rect.height);
      if (topbarHeight > scenario.topbarExpectation.maxHeight + 1) {
        failures.push(`${pageLabel}: topbar height ${topbarHeight}px exceeds ${scenario.topbarExpectation.maxHeight}px`);
      }
    }
    const visibleIds = (selector) => [...document.querySelectorAll(selector)]
      .filter((el) => isElementVisible(el).ok)
      .map((el) => el.id || String(el.className || el.tagName));
    const mainVisible = visibleIds("[data-topbar-main]");
    const overflowVisible = visibleIds("#topbarOverflowBtn");
    const legacyVisible = visibleIds(".brand-btn, .nav-pill, .icon-pill, .dark-pill");
    if (legacyVisible.length) failures.push(`${pageLabel}: legacy topbar classes visible: ${legacyVisible.join(", ")}`);
    if (!overflowVisible.includes("topbarOverflowBtn")) {
      failures.push(`${pageLabel}: workspace overflow trigger missing`);
    } else {
      const overflowButton = document.querySelector("#topbarOverflowBtn");
      overflowButton?.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const menuResult = visible("#topbarOverflowMenu");
      if (!menuResult.ok) failures.push(`${pageLabel}: workspace overflow menu ${menuResult.reason}`);
      for (const selector of ["#canvasWorkspaceBtn", "#agentWorkspaceBtn", "#topbarGithubLink"]) {
        const entryResult = visible(selector);
        if (!entryResult.ok) failures.push(`${pageLabel}: core workspace entry ${selector} ${entryResult.reason}`);
      }
    }
    if (scenario.topbarExpectation.mode === "desktop") {
      for (const id of ["topbarSearchBtn", "topbarGenerateBtn", "promptLibraryBtn", "topbarCheckinBtn", "topbarCreditsBtn", "themeToggle"]) {
        if (!mainVisible.includes(id)) failures.push(`${pageLabel}: desktop topbar control ${id} missing`);
      }
    } else if (scenario.topbarExpectation.mode === "tablet") {
      if (!mainVisible.includes("topbarSearchBtn")) failures.push(`${pageLabel}: tablet search control missing`);
    } else if (scenario.topbarExpectation.mode === "mobile") {
      const allowed = new Set(["topbarSearchBtn"]);
      const unexpected = mainVisible.filter((id) => !allowed.has(id));
      if (!mainVisible.includes("topbarSearchBtn")) failures.push(`${pageLabel}: mobile search control missing`);
      if (unexpected.length) failures.push(`${pageLabel}: mobile topbar shows extra main controls: ${unexpected.join(", ")}`);
    }
  }

  for (const selector of scenario.cardSelectors || []) {
    let cards = [...document.querySelectorAll(selector)].filter((el) => isElementVisible(el).ok);
    if (!cards.length) {
      const candidates = [...document.querySelectorAll(selector)];
      if (candidates.length) {
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        candidates[0].scrollIntoView({ block: "center", inline: "nearest" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        cards = candidates.filter((el) => isElementVisible(el).ok);
        window.scrollTo(scrollX, scrollY);
      }
    }
    if (!cards.length) {
      warnings.push(`${pageLabel}: no visible cards for ${selector}`);
      continue;
    }
    const first = cards[0].getBoundingClientRect();
    if (first.width < (viewport.mobile ? 240 : 220) || first.height < 80) {
      failures.push(`${pageLabel}: key card ${selector} collapsed to ${Math.round(first.width)}x${Math.round(first.height)}`);
    }
  }

  if (scenario.theme === "dark") {
    const whiteSurfaces = [...document.querySelectorAll(".app, .topbar, .composer, .modal, .square-preview-modal, .works-modal, .works-detail-drawer, .prompt-card, .admin-panel, .admin-stat, .admin-topbar")]
      .filter((el) => isElementVisible(el).ok)
      .map((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const color = parseRgb(style.backgroundColor);
        const area = rect.width * rect.height;
        return { el, color, area };
      })
      .filter((item) => item.area > 2000 && item.color && item.color.a > 0.85 && item.color.r > 245 && item.color.g > 245 && item.color.b > 245)
      .slice(0, 6)
      .map((item) => item.el.id ? `#${item.el.id}` : `.${String(item.el.className || item.el.tagName).trim().split(/\s+/).slice(0, 2).join(".")}`);
    if (whiteSurfaces.length) failures.push(`${pageLabel}: possible white surface in dark mode: ${whiteSurfaces.join(", ")}`);
  }

  const textOverflow = [...document.querySelectorAll("button, .topbar-tab, .topbar-chip, .topbar-login, .topbar-menu-item, .bottom-nav-item, .account-menu-item, .library-search button, .card-actions button, .admin-nav button")]
    .filter((el) => {
      const result = isElementVisible(el);
      if (!result.ok) return false;
      return el.scrollWidth > el.clientWidth + 2;
    })
    .slice(0, 10)
    .map((el) => `${el.id ? `#${el.id}` : el.className || el.tagName} scroll=${el.scrollWidth} client=${el.clientWidth}`);
  if (textOverflow.length) warnings.push(`${pageLabel}: possible text overflow: ${textOverflow.join("; ")}`);

  return {
    scenario: scenario.name,
    theme: scenario.theme,
    viewport: viewport.name,
    url: window.location.href,
    manualReview: scenario.manualReview || "",
    scrollWidth: doc.scrollWidth,
    innerWidth: viewportWidth,
    failures,
    warnings
  };

  function isFixedLike(el) {
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const position = getComputedStyle(node).position;
      if (position === "fixed" || position === "sticky") return true;
    }
    return false;
  }

  function parseRgb(value) {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => Number(part.trim()));
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
  }
}

async function compareWithBaseline(screenshotName, screenshotPath) {
  const baselinePath = path.join(baselineRoot, screenshotName);
  const result = {
    screenshot: screenshotName,
    baseline: baselinePath,
    status: "missing-baseline",
    diffRatio: null,
    differentPixels: null,
    totalPixels: null
  };
  if (!fsSync.existsSync(baselinePath)) {
    if (requireBaseline) result.failure = `missing visual baseline ${baselinePath}`;
    else result.warning = `baseline missing; promote this screenshot only after manual approval`;
    return result;
  }
  try {
    const current = decodePng(await fs.readFile(screenshotPath));
    const baseline = decodePng(await fs.readFile(baselinePath));
    const diff = diffPng(baseline, current);
    result.status = diff.ratio <= pixelDiffThreshold ? "matched" : "diff";
    result.diffRatio = diff.ratio;
    result.differentPixels = diff.differentPixels;
    result.totalPixels = diff.totalPixels;
    if (result.status === "diff") {
      result.failure = `visual diff ${(diff.ratio * 100).toFixed(2)}% exceeds ${(pixelDiffThreshold * 100).toFixed(2)}%`;
    }
  } catch (error) {
    result.status = "compare-error";
    result.failure = `baseline comparison failed: ${error.message || error}`;
  }
  return result;
}

function decodePng(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error(`unsupported PNG format bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  let inOffset = 0;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = inflated[inOffset++];
    const row = new Uint8Array(inflated.subarray(inOffset, inOffset + stride));
    inOffset += stride;
    unfilterRow(row, prev, filter, bytesPerPixel);
    for (let x = 0; x < width; x++) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      rgba[target] = row[source];
      rgba[target + 1] = row[source + 1];
      rgba[target + 2] = row[source + 2];
      rgba[target + 3] = channels === 4 ? row[source + 3] : 255;
    }
    prev = row;
  }
  return { width, height, rgba };
}

function unfilterRow(row, prev, filter, bpp) {
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev[i] || 0;
    const upLeft = i >= bpp ? prev[i - bpp] || 0 : 0;
    let value = row[i];
    if (filter === 1) value += left;
    else if (filter === 2) value += up;
    else if (filter === 3) value += Math.floor((left + up) / 2);
    else if (filter === 4) value += paeth(left, up, upLeft);
    else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
    row[i] = value & 255;
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function diffPng(left, right) {
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(`dimension mismatch ${left.width}x${left.height} vs ${right.width}x${right.height}`);
  }
  let differentPixels = 0;
  const totalPixels = left.width * left.height;
  for (let i = 0; i < left.rgba.length; i += 4) {
    const dr = Math.abs(left.rgba[i] - right.rgba[i]);
    const dg = Math.abs(left.rgba[i + 1] - right.rgba[i + 1]);
    const db = Math.abs(left.rgba[i + 2] - right.rgba[i + 2]);
    const da = Math.abs(left.rgba[i + 3] - right.rgba[i + 3]);
    if (Math.max(dr, dg, db, da) > channelTolerance) differentPixels++;
  }
  return { differentPixels, totalPixels, ratio: differentPixels / Math.max(1, totalPixels) };
}

async function startVisualServer() {
  const publicDir = path.join(rootDir, "public");
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const promptImagePath = promptImageFixturePath(url);
      if (promptImagePath) {
        response.writeHead(200, { "content-type": contentType(promptImagePath), "cache-control": "no-store" });
        fsSync.createReadStream(promptImagePath).pipe(response);
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        writeJson(response, mockApiResponse(url));
        return;
      }
      const relativePath = url.pathname === "/"
        ? "index.html"
        : url.pathname === "/admin"
          ? "admin.html"
          : decodeURIComponent(url.pathname.slice(1));
      const filePath = path.resolve(publicDir, relativePath);
      if (!filePath.startsWith(publicDir) || !fsSync.existsSync(filePath) || fsSync.statSync(filePath).isDirectory()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
        return;
      }
      response.writeHead(200, { "content-type": contentType(filePath) });
      fsSync.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: server.address().port };
}

function promptImageFixturePath(url) {
  const match = String(url.pathname || "").match(/^\/api\/prompt-images\/([^/]+)\/file$/);
  if (!match) return "";
  const fixture = {
    101: "/prompt-thumbs/evolink/logo.png",
    102: "/prompt-thumbs/freestylefly/case-128.jpg"
  }[decodeURIComponent(match[1])];
  if (!fixture) return "";
  const filePath = path.resolve(rootDir, "public", fixture.replace(/^\//, ""));
  const publicDir = path.join(rootDir, "public");
  return filePath.startsWith(publicDir) && fsSync.existsSync(filePath) ? filePath : "";
}

function writeJson(response, body) {
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "set-cookie": "csrf=visual-smoke; SameSite=Lax; Path=/",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function mockApiResponse(url) {
  const sampleImage = "/prompt-thumbs/evolink/logo.png";
  const sampleImage2 = "/prompt-thumbs/freestylefly/case-128.jpg";
  const now = new Date("2026-05-24T00:00:00.000Z").toISOString();
  const sampleGeneration = {
    id: "visual-smoke-1",
    title: "Visual regression sample",
    prompt: "A polished AI image studio interface with balanced cards, calm surfaces, and stable mobile controls.",
    image: sampleImage,
    imageUrl: sampleImage,
    image_url: sampleImage,
    images: [sampleImage],
    sourceImageUrl: sampleImage2,
    source_image_url: sampleImage2,
    createdAt: now,
    created_at: now,
    durationMs: 4200,
    status: "succeeded",
    likeCount: 12,
    like_count: 12,
    useCount: 5,
    publicTags: ["visual", "baseline", "mobile"],
    tags: ["visual", "baseline"],
    userName: "Visual QA",
    userEmail: "visual@example.com",
    isPublic: true,
    model: "GPT-IMAGE-2",
    size: "1024x1024",
    quality: "auto",
    background: "auto",
    outputFormat: "png",
    conversation: [
      { id: "route-1", prompt: "Build a balanced image studio composition", imageUrl: sampleImage, type: "text-to-image", createdAt: now },
      { id: "route-2", prompt: "Refine contrast and action hierarchy", imageUrl: sampleImage2, type: "image-to-image", createdAt: now }
    ]
  };
  const prompts = [
    {
      id: 101,
      title: "Editorial campaign hero",
      prompt: "A premium editorial campaign hero image with precise typography-safe negative space and warm studio lighting.",
      tag: "product",
      tags: ["product", "poster", "visual"],
      imageUrl: sampleImage,
      sourceRepo: "visual-regression",
      source: "QA seed",
      status: "active",
      likeCount: 8,
      useCount: 17,
      heatScore: 84
    },
    {
      id: 102,
      title: "Mobile gallery card",
      prompt: "A compact mobile gallery card with readable chips, soft contrast, and accessible action buttons.",
      tag: "mobile",
      tags: ["mobile", "ui"],
      imageUrl: sampleImage2,
      sourceRepo: "visual-regression",
      status: "active",
      likeCount: 5,
      useCount: 9,
      heatScore: 52
    }
  ];
  const tags = [
    { slug: "visual", labelZh: "视觉", labelEn: "Visual", name: "视觉", category: "style", count: 2, contentCount: 2, status: "active", hue: 210 },
    { slug: "baseline", labelZh: "基线", labelEn: "Baseline", name: "基线", category: "use_case", count: 2, contentCount: 2, status: "active", hue: 170 },
    { slug: "mobile", labelZh: "移动端", labelEn: "Mobile", name: "移动端", category: "use_case", count: 1, contentCount: 1, status: "active", hue: 35 },
    { slug: "product", labelZh: "产品", labelEn: "Product", name: "产品", category: "subject", count: 1, contentCount: 1, status: "active", hue: 300 }
  ];
  const adminUser = { id: "visual-admin", name: "Visual Admin", email: "visual-admin@example.com", role: "admin", credits: 99 };

  if (url.pathname === "/api/auth/me") {
    return {
      user: adminUser,
      settings: {
        model: "GPT-IMAGE-2",
        hasApiKey: true,
        providerCapabilities: { imageEdit: true, transparentBackground: true },
        generationCreditCost: 1,
        maxImagesPerRequest: 2,
        maxReferenceImages: 3,
        publicWithdrawalWindowHours: 12,
        canvasEntryMode: "v2"
      },
      firstRun: false,
      checkin: {},
      csrfToken: "visual-smoke"
    };
  }
  if (url.pathname === "/api/version") return { version: "visual-regression-local", node: process.version, startedAt: now };
  if (url.pathname === "/api/health") return { ok: true, firstRun: false, version: "visual-regression-local" };
  if (url.pathname === "/api/settings") return { model: "GPT-IMAGE-2", canvasEntryMode: "v2" };
  if (url.pathname === "/api/stats/today") return { todayGenerated: 4200 };
  if (url.pathname === "/api/images/history") return { generations: [sampleGeneration] };
  if (url.pathname === "/api/images/requests/active") return { requests: [] };
  if (url.pathname === "/api/images/public" || url.pathname === "/api/gallery/leaderboard") {
    return { generations: [sampleGeneration, { ...sampleGeneration, id: "visual-smoke-2", imageUrl: sampleImage2, image_url: sampleImage2, images: [sampleImage2], likeCount: 7, like_count: 7 }] };
  }
  if (url.pathname.startsWith("/api/gallery/")) return { generation: sampleGeneration };
  if (url.pathname === "/api/prompts") return { prompts };
  if (url.pathname === "/api/tags") {
    return { tags, categories: [{ slug: "style", labelZh: "风格", labelEn: "Style" }], summary: { total: tags.length, systemCount: tags.length, withContentCount: tags.length, emptyCount: 0 } };
  }
  if (url.pathname === "/api/prompt-categories") return { categories: [{ slug: "style", labelZh: "风格", labelEn: "Style", status: "active" }] };
  if (url.pathname === "/api/announcements" || url.pathname === "/api/announcements/unread") return { announcements: [] };
  if (url.pathname === "/api/admin/settings") return { allowRegistration: true, defaultProviderId: "visual-provider", contactEmail: "support@example.com" };
  if (url.pathname === "/api/admin/users") return { users: [adminUser, { id: "user-2", name: "Creator", email: "creator@example.com", role: "user", credits: 24, createdAt: now }] };
  if (url.pathname === "/api/admin/generations") return { records: [sampleGeneration] };
  if (url.pathname === "/api/admin/prompt-sources") return { sources: [{ id: 1, name: "Visual QA", status: "active", repo: "visual/regression" }], runs: [{ id: 1, status: "success", startedAt: now }] };
  if (url.pathname === "/api/admin/public-images") return { generations: [sampleGeneration] };
  if (url.pathname === "/api/admin/gallery-file-checks") return { checks: [] };
  if (url.pathname === "/api/admin/credit-ledger") return { ledger: [] };
  if (url.pathname === "/api/admin/reward-ledger") return { rewards: [] };
  if (url.pathname === "/api/admin/audit-logs") return { logs: [] };
  if (url.pathname === "/api/admin/withdrawals") return { requests: [] };
  if (url.pathname === "/api/admin/reports") return { reports: [] };
  if (url.pathname === "/api/admin/prompt-duplicates") return { candidates: [] };
  if (url.pathname === "/api/admin/prompt-audits") return { audits: [] };
  if (url.pathname === "/api/admin/rum") return { summary: { lcpP75: 1200, clsP75: 0.02, inpP75: 80 }, events: [] };
  if (url.pathname === "/api/admin/providers") return { providers: [{ id: "visual-provider", name: "Visual Provider", healthStatus: "ok", status: "active" }], defaultProviderId: "visual-provider" };
  if (url.pathname === "/api/admin/gallery-like-anomalies") return { anomalies: [] };
  if (url.pathname === "/api/admin/announcements") return { announcements: [] };
  return {};
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  return "application/octet-stream";
}

async function writeSummaryFiles(data, dir) {
  await fs.writeFile(path.join(dir, "summary.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  const rows = data.scenarios.map((item) => {
    const result = item.failures.length ? "Fail" : "Pass";
    const comparisonStatus = item.comparison?.status || "not-run";
    const comparison = item.comparison?.status === "matched"
      ? `matched (${((item.comparison.diffRatio || 0) * 100).toFixed(2)}%)`
      : comparisonStatus;
    const notes = [...item.failures, ...item.warnings].join("<br>");
    return `| ${item.scenario} | ${item.theme} | ${item.viewport} | ${result} | ${comparison} | ${notes.replaceAll("|", "\\|")} | ${item.screenshot} |`;
  });
  const markdown = [
    "## Visual Regression QA Summary",
    "",
    `- Version: visual-regression-local`,
    `- Commit: ${process.env.GIT_COMMIT || "not recorded"}`,
    `- Origin: ${data.target}`,
    `- Date: ${data.createdAt}`,
    `- Tester: smoke:visual-regression`,
    `- Baseline: ${data.baselineRoot}`,
    `- Pixel diff threshold: ${(data.pixelDiffThreshold * 100).toFixed(2)}% with channel tolerance ${data.channelTolerance}`,
    "",
    "| Scenario | Theme | Viewport | Result | Baseline | Notes | Screenshot |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Manual Review Required",
    "",
    ...data.scenarios.map((item) => `- [ ] ${item.scenario}: ${item.manualReview || "Review screenshot for visual polish regressions."} (${item.screenshot})`),
    "",
    "## Failures",
    "",
    ...(data.failures.length ? data.failures.map((item) => `- [ ] ${item}`) : ["- None"]),
    "",
    "## Warnings",
    "",
    ...(data.warnings.length ? data.warnings.map((item) => `- ${item}`) : ["- None"]),
    "",
  ].join("\n");
  await fs.writeFile(path.join(dir, "summary.md"), markdown, "utf8");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
