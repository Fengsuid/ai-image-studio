#!/usr/bin/env node
// Mobile layout smoke using Chrome DevTools Protocol without project browser deps.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let targetArg = process.argv[2] || "";
const outputRoot = process.argv[3] || path.join(rootDir, "docs/mobile-qa/baseline-local");
const chromePath = process.env.CHROME_PATH || findChromeExecutable();
const port = Number(process.env.MOBILE_SMOKE_CDP_PORT || 9322);
let staticServer = null;

const viewports = [
  { name: "360x800", width: 360, height: 800, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "430x932", width: 430, height: 932, mobile: true },
  { name: "768x1024", width: 768, height: 1024, mobile: true },
  { name: "1280x720", width: 1280, height: 720, mobile: false },
];

const pages = [
  {
    name: "home",
    url: "/",
    requiredVisible: ["#homeView", "#heroComposerMount", ".send-button"],
    coreButtons: [".send-button", "#promptLibraryBtn", "#imageEditorBtn", "#loginBtn"],
  },
  {
    name: "chat-workspace",
    url: "/?workspace=1",
    requiredVisible: ["#chatView", "#stickyComposerMount", ".send-button"],
    coreButtons: [".send-button", "#sessionDrawerToggle"],
    allowMissing: true,
  },
  {
    name: "gallery",
    url: "/?view=library",
    requiredVisible: ["#libraryView", "#librarySearchInput", "#promptGrid"],
    coreButtons: ["#librarySearchForm button", "#leaderboardBtn"],
  },
  {
    name: "leaderboard",
    url: "/?view=leaderboard",
    requiredVisible: ["#leaderboardView", "#leaderboardPage"],
    coreButtons: ["#promptLibraryBtn"],
  },
  {
    name: "editor-empty",
    url: "/?view=editor",
    requiredVisible: ["#editorView", "#editorPromptForm", "#editorUploadCard"],
    coreButtons: ["#editorPromptForm button", "#editorUploadCard"],
  },
];

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
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message || "CDP error"} (${message.error.code || ""})`));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}, sessionId = "") {
    const id = this.nextId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }
}

if (!chromePath) {
  throw new Error("Chrome executable not found. Set CHROME_PATH to run mobile layout smoke.");
}

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(outputRoot, runId);
await fs.mkdir(outputDir, { recursive: true });

if (!targetArg) {
  staticServer = await startBaselineServer();
  targetArg = `http://127.0.0.1:${staticServer.port}`;
}

const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-image-studio-mobile-smoke-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: "ignore" });

const summary = {
  target: targetArg,
  outputDir,
  createdAt: new Date().toISOString(),
  viewports,
  pages: [],
  failures: [],
  warnings: [],
};

try {
  const version = await waitForCdpVersion(port);
  const cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const browserWindow = await cdp.send("Browser.getWindowForTarget", { targetId }).catch(() => null);
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);

  for (const viewport of viewports) {
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
    await cdp.send("Emulation.setVisibleSize", {
      width: viewport.width,
      height: viewport.height,
    }, sessionId).catch(() => null);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile }, sessionId);

    for (const page of pages) {
      const url = resolvePageUrl(targetArg, page.url);
      await cdp.send("Page.navigate", { url }, sessionId);
      await delay(1800);
      await cdp.send("Runtime.evaluate", {
        expression: "document.fonts?.ready ? document.fonts.ready.then(() => true) : true",
        awaitPromise: true,
      }, sessionId).catch(() => null);
      await delay(250);

      const result = await evaluateLayout(cdp, sessionId, page, viewport);
      const screenshotName = `${page.name}-${viewport.name}.png`;
      const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
      await fs.writeFile(path.join(outputDir, screenshotName), Buffer.from(screenshot.data, "base64"));

      result.screenshot = screenshotName;
      summary.pages.push(result);
      if (result.failures.length) summary.failures.push(...result.failures);
      if (result.warnings.length) summary.warnings.push(...result.warnings);
    }
  }

  await cdp.close();
} finally {
  chrome.kill();
  if (staticServer?.server) await new Promise((resolve) => staticServer.server.close(resolve));
  await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => null);
}

await writeSummaryFiles(summary, outputDir);

if (summary.failures.length) {
  console.error(`[mobile-layout-smoke] FAIL: ${summary.failures.length} failures. Summary: ${path.join(outputDir, "summary.json")}`);
  for (const failure of summary.failures.slice(0, 12)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[mobile-layout-smoke] OK: ${summary.pages.length} page/viewport checks. Output: ${outputDir}`);
if (summary.warnings.length) {
  console.log(`[mobile-layout-smoke] warnings: ${summary.warnings.length}; see summary.json`);
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
  return candidates.find((candidate) => fsSyncExists(candidate)) || "";
}

function fsSyncExists(value) {
  try {
    return Boolean(value) && fsSync.existsSync(value);
  } catch {
    return false;
  }
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

function resolvePageUrl(base, pagePath) {
  if (base.startsWith("file:")) {
    const url = new URL(base);
    url.search = new URLSearchParams(pagePath.split("?")[1] || "").toString();
    return url.href;
  }
  return new URL(pagePath, ensureTrailingSlash(base)).href;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

async function startBaselineServer() {
  const publicDir = path.join(rootDir, "public");
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        writeJson(response, mockApiResponse(url));
        return;
      }
      const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
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

function writeJson(response, body) {
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "set-cookie": "csrf=mobile-smoke; SameSite=Lax; Path=/",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function mockApiResponse(url) {
  const sampleImage = "/prompt-thumbs/freestylefly/case-001.jpg";
  const sampleGeneration = {
    id: "mobile-smoke-1",
    title: "Mobile smoke sample",
    prompt: "A clean mobile AI image studio layout baseline sample",
    imageUrl: sampleImage,
    image_url: sampleImage,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    likeCount: 8,
    like_count: 8,
    useCount: 3,
    publicTags: ["mobile", "baseline"],
    tags: ["mobile", "baseline"],
    userName: "Smoke",
    isPublic: true,
  };
  if (url.pathname === "/api/auth/me") {
    return {
      user: null,
      settings: { model: "GPT-IMAGE-2", capabilities: { imageEdit: true } },
      firstRun: false,
      checkin: {},
    };
  }
  if (url.pathname === "/api/images/history") return { generations: [] };
  if (url.pathname === "/api/images/requests/active") return { requests: [] };
  if (url.pathname === "/api/stats/today") return { todayGenerated: 4200 };
  if (url.pathname === "/api/version") return { version: "mobile-baseline-local", node: process.version, startedAt: new Date().toISOString() };
  if (url.pathname === "/api/tags") {
    return {
      tags: [
        { slug: "mobile", name: "移动端", count: 12 },
        { slug: "portrait", name: "人像", count: 8 },
        { slug: "product", name: "产品", count: 6 },
      ],
      categories: [],
      summary: { total: 3 },
    };
  }
  if (url.pathname === "/api/images/public" || url.pathname === "/api/gallery/leaderboard") {
    return { generations: [sampleGeneration, { ...sampleGeneration, id: "mobile-smoke-2", likeCount: 5 }] };
  }
  if (url.pathname === "/api/prompts") {
    return {
      prompts: [
        {
          id: 1,
          title: "Mobile baseline prompt",
          prompt: "A refined mobile UI with stable composer and gallery cards",
          tag: "mobile",
          tags: ["mobile", "baseline"],
          imageUrl: sampleImage,
          likeCount: 4,
          useCount: 9,
        },
      ],
    };
  }
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

async function evaluateLayout(cdp, sessionId, page, viewport) {
  const expression = `(${layoutProbe.toString()})(${JSON.stringify(page)}, ${JSON.stringify(viewport)})`;
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  assert(!response.exceptionDetails, response.exceptionDetails?.text || "layout probe failed");
  return response.result.value;
}

function layoutProbe(page, viewport) {
  const failures = [];
  const warnings = [];
  const pageLabel = `${page.name} ${viewport.name}`;
  const viewportWidth = window.innerWidth;
  const doc = document.documentElement;
  const overflow = Math.max(doc.scrollWidth, document.body?.scrollWidth || 0) - viewportWidth;
  if (overflow > 1) failures.push(`${pageLabel}: horizontal overflow ${overflow}px`);

  const visible = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return { ok: false, reason: "missing" };
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const ok = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    return { ok, reason: ok ? "" : `hidden ${Math.round(rect.width)}x${Math.round(rect.height)}` };
  };

  for (const selector of page.requiredVisible || []) {
    const result = visible(selector);
    if (!result.ok) {
      const message = `${pageLabel}: required selector ${selector} ${result.reason}`;
      if (page.allowMissing) warnings.push(message);
      else failures.push(message);
    }
  }

  for (const selector of page.coreButtons || []) {
    const el = document.querySelector(selector);
    if (!el) {
      warnings.push(`${pageLabel}: core control ${selector} missing`);
      continue;
    }
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const isVisible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    if (!isVisible) {
      warnings.push(`${pageLabel}: core control ${selector} hidden`);
      continue;
    }
    if (rect.height < 40 || rect.width < 40) {
      failures.push(`${pageLabel}: core control ${selector} touch target ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    if (rect.right > viewportWidth + 1 || rect.left < -1) {
      failures.push(`${pageLabel}: core control ${selector} outside viewport`);
    }
  }

  const textOverflow = [...document.querySelectorAll("button, .nav-pill, .dark-pill, .account-menu-item, .message-actions button, .library-search button")]
    .filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      return el.scrollWidth > el.clientWidth + 2;
    })
    .slice(0, 12)
    .map((el) => `${el.id ? `#${el.id}` : el.className || el.tagName} scroll=${el.scrollWidth} client=${el.clientWidth}`);
  if (textOverflow.length) warnings.push(`${pageLabel}: possible text overflow: ${textOverflow.join("; ")}`);

  const fixed = [...document.querySelectorAll(".topbar, .sticky-composer, .chat-session-panel, .editor-prompt-bar, .modal, .square-preview-modal, .works-modal")]
    .filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    })
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        selector: el.id ? `#${el.id}` : `.${String(el.className).trim().split(/\\s+/).slice(0, 2).join(".")}`,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });

  return {
    page: page.name,
    viewport: viewport.name,
    url: window.location.href,
    scrollWidth: doc.scrollWidth,
    innerWidth: viewportWidth,
    failures,
    warnings,
    fixed,
  };
}

async function writeSummaryFiles(data, dir) {
  await fs.writeFile(path.join(dir, "summary.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  const rows = data.pages.map((item) => {
    const result = item.failures.length ? "Fail" : "Pass";
    const notes = [...item.failures, ...item.warnings].join("<br>");
    return `| ${item.page} | ${item.viewport} | ${result} | ${notes.replaceAll("|", "\\|")} | ${item.screenshot} |`;
  });
  const markdown = [
    "## Mobile QA Summary",
    "",
    `- Version: baseline-local`,
    `- Commit: ${process.env.GIT_COMMIT || "not recorded"}`,
    `- Origin: ${data.target}`,
    `- Date: ${data.createdAt}`,
    `- Tester: smoke:mobile-layout`,
    "",
    "| Page | Viewport | Result | Notes | Screenshot |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
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
