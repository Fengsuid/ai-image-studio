import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const PUBLIC_CSS_IMPORT_RE = /@import\s+url\("\/css\/([^"]+\.css)"\);/g;
const VENDOR_CSS = [
  "vendor/icons/remixicon.min.css",
  "vendor/icons/remixicon-compat.css"
];

function publicPathFor(relativePath) {
  return `/${relativePath.replace(/\\/g, "/").replace(/^public\//, "")}`;
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n?/g, "\n");
}

async function cssSources(root) {
  const publicDir = path.join(root, "public");
  const stylesPath = path.join(publicDir, "styles.css");
  const styles = normalizeLineEndings(await readText(stylesPath));
  const moduleFiles = [...styles.matchAll(PUBLIC_CSS_IMPORT_RE)].map((match) => match[1]);
  const sources = [
    ...VENDOR_CSS.map((fileName) => path.join("public", fileName)),
    ...moduleFiles.map((fileName) => path.join("public", "css", fileName))
  ];
  return sources.map((relativePath) => ({
    relativePath,
    publicPath: publicPathFor(relativePath),
    absolutePath: path.join(root, relativePath)
  }));
}

async function bundledCss(root, sources) {
  const chunks = [];
  for (const source of sources) {
    const content = normalizeLineEndings(await readText(source.absolutePath));
    chunks.push(`/* ${source.relativePath.replace(/\\/g, "/")} */\n${content.trimEnd()}\n`);
  }
  return `${chunks.join("\n")}\n`;
}

async function cleanPreviousBundles(distDir, currentFileName) {
  const entries = await fs.readdir(distDir, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && /^app\.[a-f0-9]{12}\.css$/.test(entry.name) && entry.name !== currentFileName)
    .map(async (entry) => {
      try {
        await fs.rm(path.join(distDir, entry.name), { force: true });
      } catch (error) {
        console.warn(`[frontend-build] could not remove stale CSS bundle ${entry.name}: ${error.message}`);
      }
    }));
}

async function updateIndexStyles(root, cssEntry) {
  const indexPath = path.join(root, "public", "index.html");
  const html = await readText(indexPath);
  const nextLink = `    <link rel="stylesheet" href="${cssEntry}">`;
  const localStylesheetBlock = /[ ]{4}<link rel="stylesheet" href="\/styles\.css\?v=[^"]+">\r?\n[ ]{4}<link rel="stylesheet" href="\/mobile-gallery\.css\?v=[^"]+">\r?\n[ ]{4}<link rel="stylesheet" href="\/mobile\.css\?v=[^"]+">\r?\n[ ]{4}<link rel="stylesheet" href="\/mobile-home\.css\?v=[^"]+">\r?\n[ ]{4}<link rel="stylesheet" href="\/mobile-editor\.css\?v=[^"]+">/;
  const bundledStylesheetLink = /[ ]{4}<link rel="stylesheet" href="\/dist\/app\.[a-f0-9]{12}\.css">/;
  if (!localStylesheetBlock.test(html) && !bundledStylesheetLink.test(html) && !html.includes(nextLink)) {
    throw new Error("Could not find the public index local stylesheet block");
  }
  const nextHtml = localStylesheetBlock.test(html)
    ? html.replace(localStylesheetBlock, nextLink)
    : html.replace(bundledStylesheetLink, nextLink);
  if (nextHtml !== html) {
    await fs.writeFile(indexPath, nextHtml, "utf8");
  }
}

export async function buildCssBundle({ root = process.cwd() } = {}) {
  const distDir = path.join(root, "public", "dist");
  await fs.mkdir(distDir, { recursive: true });

  const sources = await cssSources(root);
  const css = await bundledCss(root, sources);
  const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
  const fileName = `app.${hash}.css`;
  const relativePath = path.join("public", "dist", fileName);
  const absolutePath = path.join(root, relativePath);

  await fs.writeFile(absolutePath, css, "utf8");
  await cleanPreviousBundles(distDir, fileName);

  const entry = `/dist/${fileName}`;
  await updateIndexStyles(root, entry);

  return {
    entry,
    fileName,
    hash,
    bytes: Buffer.byteLength(css),
    sources
  };
}
