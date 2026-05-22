import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../src/", import.meta.url);
const files = await collectJavaScriptFiles(root);

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`[agent-workspace-check] OK: checked ${files.length} source files`);

async function collectJavaScriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(fileURLToPath(directoryUrl), entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(new URL(`${entry.name}/`, directoryUrl)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}
