import { mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(appDir, "..");
const repoRoot = join(workspaceRoot, "..", "..");
const srcDir = join(workspaceRoot, "src");
const publicDir = join(repoRoot, "public", "agent");
const assetsDir = join(publicDir, "assets");

await rm(publicDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

const cssSource = await readFile(join(srcDir, "styles.css"), "utf8");
const scripts = await collectJavaScriptFiles(srcDir);
const hashedScripts = resolveHashedScriptNames(scripts);
const cssHash = hashContent(cssSource);
const cssFile = `styles.${cssHash}.css`;
const mainFile = hashedScripts.get("main.js");

for (const script of scripts) {
  const outputName = hashedScripts.get(script.relativePath);
  const outputPath = join(assetsDir, ...outputName.split("/"));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rewriteRelativeImports(script.content, script.relativePath, hashedScripts), "utf8");
}
await writeFile(join(assetsDir, cssFile), cssSource, "utf8");
await writeFile(join(publicDir, "index.html"), renderIndex({ mainFile, cssFile }), "utf8");

console.log(`[agent-workspace-build] wrote public/agent with ${mainFile} and ${cssFile}`);

async function collectJavaScriptFiles(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(sourcePath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push({
        relativePath: toPosix(relative(srcDir, sourcePath)),
        content: await readFile(sourcePath, "utf8"),
      });
    }
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function resolveHashedScriptNames(scripts) {
  let names = new Map(scripts.map((script) => [script.relativePath, hashedPath(script.relativePath, script.content)]));

  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false;
    const nextNames = new Map();

    for (const script of scripts) {
      const rewritten = rewriteRelativeImports(script.content, script.relativePath, names);
      const nextName = hashedPath(script.relativePath, rewritten);
      nextNames.set(script.relativePath, nextName);
      if (nextName !== names.get(script.relativePath)) changed = true;
    }

    names = nextNames;
    if (!changed) return names;
  }

  return names;
}

function rewriteRelativeImports(content, relativePath, hashedScripts) {
  return content.replace(/(\bfrom\s*["']|\bimport\s*["'])(\.{1,2}\/[^"']+?\.js)(["'])/g, (match, prefix, specifier, suffix) => {
    const resolved = normalizeRelativeScriptPath(relativePath, specifier);
    const hashed = hashedScripts.get(resolved);
    if (!hashed) return match;
    return `${prefix}${relativeSpecifier(posix.dirname(relativePath), hashed)}${suffix}`;
  });
}

function normalizeRelativeScriptPath(fromPath, specifier) {
  return posix.normalize(posix.join(posix.dirname(fromPath), specifier));
}

function relativeSpecifier(fromDir, toPath) {
  const fromPath = fromDir === "." ? "" : fromDir;
  let specifier = posix.relative(fromPath, toPath);
  if (!specifier.startsWith(".")) specifier = `./${specifier}`;
  return specifier;
}

function hashedPath(relativePath, content) {
  const extension = extname(relativePath);
  const base = relativePath.slice(0, -extension.length);
  return `${base}.${hashContent(content)}${extension}`;
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function renderIndex({ mainFile, cssFile }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Agent Workspace | ai-image-studio</title>
    <link rel="stylesheet" href="/agent/assets/${cssFile}">
  </head>
  <body>
    <div data-agent-workspace-root>
      <main class="agent-shell" data-status="booting">
        <h1>Agent Workspace</h1>
        <p>正在初始化 Agent 创作工作台...</p>
      </main>
    </div>
    <script type="module" src="/agent/assets/${mainFile}"></script>
  </body>
</html>
`;
}
