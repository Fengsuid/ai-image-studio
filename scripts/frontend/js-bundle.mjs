import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";

const LOCAL_SCRIPT_RE = /[ ]{4}<script src="([^"]+\.js(?:\?v=[^"]*)?)" defer><\/script>/g;
const HASHED_JS_RE = /^(.+)\.[a-f0-9]{12}\.js$/;
const COMPAT_MANIFEST_SCRIPT = "/frontend-build-manifest.js";

function publicPathFor(relativePath) {
  return `/${relativePath.replace(/\\/g, "/").replace(/^public\//, "")}`;
}

function cleanScriptPath(src) {
  return new URL(src, "https://example.invalid").pathname;
}

function sourceFileNameFromPath(publicPath) {
  const name = path.posix.basename(publicPath);
  const hashed = name.match(HASHED_JS_RE);
  return hashed ? `${hashed[1]}.js` : name;
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function bundledScript(content, sourceFileName) {
  const result = await esbuild.transform(content, {
    loader: "js",
    minify: true,
    legalComments: "none",
    target: "es2020",
    charset: "utf8",
    sourcefile: sourceFileName
  });
  return result.code;
}

async function publicIndexScripts(root) {
  const indexPath = path.join(root, "public", "index.html");
  const html = await readText(indexPath);
  const scripts = [];
  for (const match of html.matchAll(LOCAL_SCRIPT_RE)) {
    const publicPath = cleanScriptPath(match[1]);
    if (!publicPath.startsWith("/") || publicPath === COMPAT_MANIFEST_SCRIPT) continue;
    scripts.push(scriptDescriptor(root, publicPath, { originalSrc: match[1] }));
  }
  return { html, indexPath, scripts };
}

function scriptDescriptor(root, publicPath, { originalSrc = publicPath, lazy = false } = {}) {
  const cleanPath = cleanScriptPath(publicPath);
  const sourceFileName = sourceFileNameFromPath(cleanPath);
  return {
    sourceFileName,
    sourcePublicPath: `/${sourceFileName}`,
    sourceRelativePath: path.join("public", sourceFileName),
    sourceAbsolutePath: path.join(root, "public", sourceFileName),
    originalSrc,
    lazy
  };
}

function uniqueScripts(scripts) {
  const bySource = new Map();
  for (const script of scripts) {
    if (!bySource.has(script.sourcePublicPath)) {
      bySource.set(script.sourcePublicPath, script);
    }
  }
  return Array.from(bySource.values());
}

async function cleanPreviousJsAssets(distDir, currentFileNames) {
  const keep = new Set(currentFileNames);
  const entries = await fs.readdir(distDir, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && /^[a-z0-9-]+\.[a-f0-9]{12}\.js$/.test(entry.name) && !keep.has(entry.name))
    .map((entry) => fs.unlink(path.join(distDir, entry.name))));
}

function replaceScriptTags(html, assetsBySource) {
  return html.replace(LOCAL_SCRIPT_RE, (tag, src) => {
    const publicPath = cleanScriptPath(src);
    if (publicPath === COMPAT_MANIFEST_SCRIPT) {
      return tag.replace(src, COMPAT_MANIFEST_SCRIPT);
    }
    const sourceFileName = sourceFileNameFromPath(publicPath);
    const asset = assetsBySource.get(`/${sourceFileName}`);
    return asset ? tag.replace(src, asset.entry) : tag;
  });
}

export async function buildJsAssets({ root = process.cwd(), lazySources = [] } = {}) {
  const distDir = path.join(root, "public", "dist");
  await fs.mkdir(distDir, { recursive: true });

  const { html, indexPath, scripts: indexScripts } = await publicIndexScripts(root);
  const lazyScripts = lazySources.map((source) => scriptDescriptor(root, source, { lazy: true }));
  const scripts = uniqueScripts([...indexScripts, ...lazyScripts]);
  const assets = [];
  for (const script of scripts) {
    const content = await readText(script.sourceAbsolutePath);
    const bundled = await bundledScript(content, script.sourceFileName);
    const hash = createHash("sha256").update(bundled).digest("hex").slice(0, 12);
    const stem = path.basename(script.sourceFileName, ".js");
    const fileName = `${stem}.${hash}.js`;
    const relativePath = path.join("public", "dist", fileName);
    await fs.writeFile(path.join(root, relativePath), bundled, "utf8");
    assets.push({
      source: script.sourcePublicPath,
      entry: publicPathFor(relativePath),
      fileName,
      hash,
      bytes: Buffer.byteLength(bundled),
      lazy: Boolean(script.lazy)
    });
  }

  await cleanPreviousJsAssets(distDir, assets.map((asset) => asset.fileName));
  const nextHtml = replaceScriptTags(html, new Map(assets.map((asset) => [asset.source, asset])));
  if (nextHtml !== html) {
    await fs.writeFile(indexPath, nextHtml, "utf8");
  }

  return {
    compatibilityManifest: COMPAT_MANIFEST_SCRIPT,
    assets
  };
}
