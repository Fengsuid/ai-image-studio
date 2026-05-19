#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const store = require("../src/mysql-store");

function usage() {
  console.log(`Usage:
  node scripts/migrate-tags-json.mjs --dry-run --map old-slug=new-slug --map photo-real=photo
  node scripts/migrate-tags-json.mjs --apply --map-file tag-map.json

tag-map.json format:
  { "old-slug": "target-slug", "photo-real": "photo" }`);
}

async function readMapping(args) {
  const mapping = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--map") {
      const pair = args[index + 1] || "";
      index += 1;
      const split = pair.indexOf("=");
      if (split > 0) mapping[pair.slice(0, split)] = pair.slice(split + 1);
    } else if (arg === "--map-file") {
      const file = args[index + 1];
      index += 1;
      if (!file) throw new Error("--map-file requires a path");
      Object.assign(mapping, JSON.parse(await fs.readFile(file, "utf8")));
    }
  }
  return mapping;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }
  const dryRun = !args.includes("--apply");
  const mapping = await readMapping(args);
  if (!Object.keys(mapping).length) {
    usage();
    throw new Error("No tag mapping provided");
  }
  await store.initializeDatabase({ defaultModel: process.env.IMAGE_MODEL || "GPT-IMAGE-2" });
  const report = await store.migrateTagJsonSlugs(mapping, { dryRun });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
