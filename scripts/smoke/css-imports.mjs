import fs from "node:fs";
import path from "node:path";

function cssPathFromImport(rootDir, fromFile, specifier) {
  const cleanSpecifier = specifier.split("#")[0].split("?")[0];
  if (!cleanSpecifier) {
    return "";
  }
  if (/^[a-z]+:/i.test(cleanSpecifier)) {
    return "";
  }
  if (cleanSpecifier.startsWith("/")) {
    return path.join(rootDir, "public", cleanSpecifier.slice(1));
  }
  return path.resolve(path.dirname(fromFile), cleanSpecifier);
}

function readCssFile(filePath, rootDir, seen) {
  const resolvedPath = path.resolve(filePath);
  if (seen.has(resolvedPath)) {
    return "";
  }
  seen.add(resolvedPath);

  const css = fs.readFileSync(resolvedPath, "utf8");
  return css.replace(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*;/g, (_match, specifier) => {
    const importedPath = cssPathFromImport(rootDir, resolvedPath, specifier);
    return importedPath ? readCssFile(importedPath, rootDir, seen) : "";
  });
}

export function readPublicCssWithImports(rootDir, publicPath = "/styles.css") {
  const entryPath = cssPathFromImport(rootDir, path.join(rootDir, "public/styles.css"), publicPath);
  return readCssFile(entryPath, rootDir, new Set());
}
