import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPublicCssWithImports } from "./css-imports.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`[theme-mobile-nav] ${message}`);
  process.exit(1);
};

const index = read("public/index.html");
const app = read("public/app.js");
const themeNav = read("public/theme-mobile-nav.js");
const css = readPublicCssWithImports(root);
const pkg = JSON.parse(read("package.json"));

function scriptPosition(html, scriptName) {
  const plainIndex = html.indexOf(`/${scriptName}`);
  if (plainIndex >= 0) return plainIndex;
  const stem = scriptName.replace(/\.js$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`/dist/${stem}\\.[a-f0-9]{12}\\.js`))?.index ?? -1;
}

const requiredIndexMarkers = [
  'id="themeToggle"',
  'id="bottomNav"',
  'imageStudio.theme',
  "document.documentElement",
  "dataset.theme",
  'data-mobile-nav-action="home"',
  'data-mobile-nav-action="ranking"',
  'data-mobile-nav-action="create"',
  'data-mobile-nav-action="notifications"',
  'data-mobile-nav-action="my"'
];

for (const marker of requiredIndexMarkers) {
  if (!index.includes(marker)) fail(`index.html missing ${marker}`);
}
if (scriptPosition(index, "theme-mobile-nav.js") < 0) fail("index.html missing theme-mobile-nav.js");

const requiredThemeMarkers = [
  "imageStudio.theme",
  'localStorage.setItem("theme", theme)',
  "prefers-color-scheme: dark",
  "theme-transitioning",
  "ImageStudioThemeNav",
  "ImageStudioAppActions",
  "focusGenerationComposer",
  "openNotificationsModal",
  "openMyWorksModal",
  'navigate?.("leaderboard"',
  'navigate?.("home"'
];

for (const marker of requiredThemeMarkers) {
  if (!themeNav.includes(marker) && !app.includes(marker) && !css.includes(marker)) {
    fail(`theme/mobile nav implementation missing ${marker}`);
  }
}

const requiredCssMarkers = [
  ':root[data-theme="dark"]',
  "@media (prefers-color-scheme: dark)",
  ".bottom-nav",
  "env(safe-area-inset-bottom)",
  ".bottom-nav-generate",
  ".toast-layer",
  "z-index: 180",
  ".modal-layer"
];

for (const marker of requiredCssMarkers) {
  if (!css.includes(marker)) fail(`CSS missing ${marker}`);
}

if (!app.includes("syncThemeMobileNav")) fail("app.js does not sync mobile nav state");
if (!app.includes("window.ImageStudioAppActions")) fail("app.js does not expose mobile nav actions");
if (pkg.scripts?.["smoke:theme-mobile-nav"] !== "node scripts/smoke/check-theme-mobile-nav.mjs") {
  fail("package.json missing smoke:theme-mobile-nav script");
}

console.log("[theme-mobile-nav] ok");
