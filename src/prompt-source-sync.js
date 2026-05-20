const crypto = require("crypto");

const INFINITE_CANVAS_SOURCE_REPO = "basketikun/infinite-canvas";

const INFINITE_CANVAS_SOURCES = [
  {
    key: "gpt-image-2",
    category: "gpt-image-2-prompts",
    label: "GPT Image 2",
    repo: "EvoLinkAI/awesome-gpt-image-2-API-and-Prompts",
    files: ["README.md", "data/ingested_tweets.json"]
  },
  {
    key: "awesome-gpt-image",
    category: "awesome-gpt-image-prompts",
    label: "Awesome GPT Image",
    repo: "ZeroLu/awesome-gpt-image",
    files: ["README.zh-CN.md"]
  },
  {
    key: "awesome-gpt4o",
    category: "awesome-gpt4o-image-prompts",
    label: "GPT-4o Image Prompts",
    repo: "ImgEdify/Awesome-GPT4o-Image-Prompts",
    files: ["README.zh-CN.md"]
  },
  {
    key: "youmind-gpt-image-2",
    category: "youmind-gpt-image-2-prompts",
    label: "YouMind GPT Image 2",
    repo: "YouMind-OpenLab/awesome-gpt-image-2",
    files: ["README_zh.md"]
  },
  {
    key: "youmind-nano-banana-pro",
    category: "youmind-nano-banana-pro-prompts",
    label: "YouMind Nano Banana Pro",
    repo: "YouMind-OpenLab/awesome-nano-banana-pro-prompts",
    files: ["README_zh.md"]
  }
];

function githubRepoParts(repoUrl = "") {
  const match = String(repoUrl || "").match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

function promptCategoryFromPath(pathname = "") {
  const lower = String(pathname || "").toLowerCase();
  if (/portrait|character|avatar|people/.test(lower)) return "subject";
  if (/poster|banner|ui|logo|packaging|ad|product/.test(lower)) return "use_case";
  if (/light|photo|camera|shot|lens/.test(lower)) return "camera";
  if (/color|palette/.test(lower)) return "color";
  if (/mood|emotion/.test(lower)) return "mood";
  if (/technique|effect|composition/.test(lower)) return "technique";
  return "style";
}

function sourceTags(source) {
  return [source.category, source.key, "infinite-canvas"].filter(Boolean);
}

function normalizeRemotePromptItem(item = {}, fallback = {}, deps = {}) {
  const prompt = String(item.prompt || item.text || item.content || item.description || item.positive || "").trim();
  if (prompt.length < 8) return null;
  const title = String(item.title || item.name || fallback.title || prompt.slice(0, 80)).trim().slice(0, 200);
  const tags = deps.sanitizePromptTags(item.tags || item.labels || fallback.tags || []);
  const image = deps.sanitizeUrlField(item.image || item.cover || item.preview || item.imageUrl || "", 500);
  const remoteId = String(item.id || item.slug || item.remoteId || fallback.remoteId || "").trim()
    || crypto.createHash("sha1").update(`${fallback.sourceRepo || ""}\n${fallback.path || ""}\n${prompt}`).digest("hex");
  return {
    title,
    prompt,
    image,
    preview: image,
    tags,
    category: item.category || fallback.category || "general",
    sourceCategory: item.sourceCategory || fallback.sourceCategory || "",
    remoteId,
    promptType: item.promptType || "text-to-image",
    language: item.language || (/[\u4e00-\u9fff]/.test(prompt) ? "zh" : "en"),
    modelHint: item.modelHint || "",
    githubUrl: item.githubUrl || fallback.githubUrl || ""
  };
}

function collectJsonPromptItems(value, fallback = {}, output = [], deps = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonPromptItems(item, { ...fallback, remoteId: `${fallback.remoteId || fallback.path || "item"}:${index}` }, output, deps));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const item = normalizeRemotePromptItem(value, fallback, deps);
  if (item) output.push(item);
  for (const key of ["items", "prompts", "data", "examples", "cases"]) {
    if (value[key]) collectJsonPromptItems(value[key], fallback, output, deps);
  }
  return output;
}

function parseMarkdownPromptItems(text, fallback = {}, deps = {}) {
  const items = [];
  let heading = fallback.title || "";
  const lines = String(text || "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const headingMatch = line.match(/^#{1,4}\s+(.+)/);
    if (headingMatch) {
      heading = headingMatch[1].trim();
      continue;
    }
    const promptMatch = line.match(/^(?:[-*]\s*)?(?:prompt|提示词|正向提示词)\s*[:：]\s*(.+)$/i);
    if (promptMatch) {
      const prompt = promptMatch[1].trim();
      const item = normalizeRemotePromptItem({ title: heading, prompt }, { ...fallback, remoteId: `${fallback.path}:${index}` }, deps);
      if (item) items.push(item);
      continue;
    }
    if (/^```/.test(line)) {
      const block = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        block.push(lines[index]);
        index += 1;
      }
      const prompt = block.join("\n").trim();
      const item = normalizeRemotePromptItem({ title: heading, prompt }, { ...fallback, remoteId: `${fallback.path}:code:${index}` }, deps);
      if (item) items.push(item);
    }
  }
  return items;
}

async function fetchGithubText(url, label, deps) {
  const response = await deps.fetchWithTimeout(label, url, {
    headers: {
      "Accept": "application/vnd.github+json, text/plain;q=0.9",
      "User-Agent": "ai-image-studio-prompt-sync"
    }
  }, 30000);
  if (!response.ok) throw deps.httpError(`${label} HTTP ${response.status}`, response.status >= 500 ? 502 : 400);
  return response.text();
}

function rawUrl(repo, path, branch = "main") {
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}

function repoBlobUrl(repo, path, branch = "main") {
  return `https://github.com/${repo}/blob/${encodeURIComponent(branch)}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}

function absoluteRepoImage(repo, imagePath, branch = "main") {
  const image = String(imagePath || "").trim();
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  const cleaned = image.replace(/^\.?\//, "");
  return rawUrl(repo, cleaned, branch);
}

function firstMarkdownImage(block, repo, branch) {
  const match = String(block || "").match(/!\[[^\]]*]\(([^)]+)\)/);
  return match ? absoluteRepoImage(repo, match[1], branch) : "";
}

function titleFromMarkdownHeading(value) {
  return String(value || "")
    .replace(/\[[^\]]+]\([^)]+\)/g, "")
    .replace(/[`*_>#]/g, "")
    .trim();
}

function promptFingerprint(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function shortPromptHash(value = "", length = 12) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, length);
}

function awesomeGptImage2LegacyRemoteId(source, sourceNumber, title, prompt = "", seen = null) {
  const base = `${source.key || source.name}:${sourceNumber}:${title}`;
  if (!seen) return base;
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}:${shortPromptHash(prompt, 10)}`;
}

function parseGptImage2Readme(readme, recordsPayload, source) {
  const records = Array.isArray(recordsPayload)
    ? recordsPayload
    : Array.isArray(recordsPayload?.records) ? recordsPayload.records : [];
  const recordByTitle = new Map();
  const recordByImageDir = new Map();
  for (const record of records) {
    const title = String(record.title || "").trim();
    const imageDir = String(record.image_dir || "").trim();
    if (title) recordByTitle.set(title.toLowerCase(), record);
    if (imageDir) recordByImageDir.set(imageDir.toLowerCase(), record);
  }
  const items = [];
  const pattern = /###\s+Case\s+\d+:\s+\[([^\]]+)]\(([^)]+)\)[\s\S]*?\*\*Prompt:\*\*\s*\r?\n\s*```[^\n]*\r?\n([\s\S]*?)\r?\n```/gi;
  let match;
  while ((match = pattern.exec(readme))) {
    const title = titleFromMarkdownHeading(match[1]);
    const link = String(match[2] || "").trim();
    const prompt = String(match[3] || "").trim();
    const record = recordByTitle.get(title.toLowerCase()) || [...recordByImageDir.values()].find((item) => link.includes(String(item.image_dir || "")));
    const imageDir = String(record?.image_dir || "").trim();
    items.push({
      title,
      prompt,
      image: imageDir ? absoluteRepoImage(source.repo, `images/${imageDir}/output.jpg`) : firstMarkdownImage(match[0], source.repo),
      tags: sourceTags(source),
      category: promptCategoryFromPath(`${source.category}/${record?.category || ""}/${title}`),
      sourceCategory: record?.category || source.category,
      remoteId: `${source.key}:${record?.tweet_url || imageDir || title}`,
      githubUrl: link || repoBlobUrl(source.repo, "README.md")
    });
  }
  return items;
}

function parseAwesomeGptImageReadme(readme, source) {
  const items = [];
  const pattern = /###\s+([^\n]+)[\s\S]*?\*\*提示词[:：]\*\*\s*\r?\n\s*```[^\n]*\r?\n([\s\S]*?)\r?\n```/g;
  let match;
  while ((match = pattern.exec(readme))) {
    const blockEnd = readme.indexOf("\n### ", pattern.lastIndex);
    const block = readme.slice(match.index, blockEnd === -1 ? undefined : blockEnd);
    const title = titleFromMarkdownHeading(match[1]);
    items.push({
      title,
      prompt: String(match[2] || "").trim(),
      image: firstMarkdownImage(block, source.repo),
      tags: sourceTags(source),
      category: promptCategoryFromPath(`${source.category}/${title}`),
      sourceCategory: source.category,
      remoteId: `${source.key}:${title}`,
      githubUrl: repoBlobUrl(source.repo, "README.zh-CN.md")
    });
  }
  return items;
}

function parseAwesomeGpt4oReadme(readme, source) {
  const items = [];
  const pattern = /###\s+([^\n]+)[\s\S]*?[-*]\s+\*\*提示词文本[:：]\*\*\s*`([^`]+)`/g;
  let match;
  while ((match = pattern.exec(readme))) {
    const blockEnd = readme.indexOf("\n### ", pattern.lastIndex);
    const block = readme.slice(match.index, blockEnd === -1 ? undefined : blockEnd);
    const title = titleFromMarkdownHeading(match[1]);
    items.push({
      title,
      prompt: String(match[2] || "").trim(),
      image: firstMarkdownImage(block, source.repo),
      tags: sourceTags(source),
      category: promptCategoryFromPath(`${source.category}/${title}`),
      sourceCategory: source.category,
      remoteId: `${source.key}:${title}`,
      githubUrl: repoBlobUrl(source.repo, "README.zh-CN.md")
    });
  }
  return items;
}

function parseYouMindReadme(readme, source) {
  const items = [];
  const sections = String(readme || "").split(/\n(?=###\s+No\.\s*\d+:)/i);
  for (const section of sections) {
    const titleMatch = section.match(/^###\s+No\.\s*\d+:\s*(.+)$/im);
    if (!titleMatch) continue;
    const promptMatch = section.match(/####\s+.*?提示词[\s\S]*?```[^\n]*\r?\n([\s\S]*?)\r?\n```/i);
    if (!promptMatch) continue;
    const title = titleFromMarkdownHeading(titleMatch[1]);
    items.push({
      title,
      prompt: String(promptMatch[1] || "").trim(),
      image: firstMarkdownImage(section, source.repo),
      tags: sourceTags(source),
      category: promptCategoryFromPath(`${source.category}/${title}`),
      sourceCategory: source.category,
      remoteId: `${source.key}:${title}`,
      githubUrl: repoBlobUrl(source.repo, "README_zh.md")
    });
  }
  return items;
}

function parseAwesomeGptImage2PromptsBackup(markdown, source, options = {}) {
  const items = [];
  let currentCategory = "";
  const imageByPrompt = options instanceof Map ? options : options.imageByPrompt || new Map();
  const seenRemoteIds = new Map();
  const sections = String(markdown || "").split(/\n(?=###\s+#\d+\s+)/);
  for (const section of sections) {
    const titleMatch = section.match(/^###\s+#(\d+)\s+(.+)$/m);
    if (!titleMatch) continue;
    const categoryMatch = section.match(/\*\*分类\*\*[:：]\s*([^\n]+)/);
    const promptMatch = section.match(/\*\*提示词\*\*[:：]\s*\r?\n\s*```[^\n]*\r?\n([\s\S]*?)\r?\n```/);
    if (!promptMatch) continue;
    currentCategory = String(categoryMatch?.[1] || currentCategory || source.category || "general").trim();
    const author = String(section.match(/\*\*作者\*\*[:：]\s*([^\n]+)/)?.[1] || "").trim();
    const title = titleFromMarkdownHeading(titleMatch[2]);
    const prompt = String(promptMatch[1] || "").trim();
    const promptKey = promptFingerprint(prompt);
    const image = imageByPrompt.get(promptKey) || "";
    items.push({
      title,
      prompt,
      image,
      tags: depsSafeTags([source.category, "awesome-gpt-image2-prompts", currentCategory, author]),
      category: promptCategoryFromPath(`${currentCategory}/${title}`),
      sourceCategory: currentCategory,
      remoteId: awesomeGptImage2LegacyRemoteId(source, titleMatch[1], title, prompt, seenRemoteIds),
      author,
      githubUrl: repoBlobUrl(source.repo, "prompts_backup.md")
    });
  }
  return items;
}

function parseAwesomeGptImage2PromptsJson(payload, source, branch = "main", backupByPrompt = new Map()) {
  const records = typeof payload === "string" ? JSON.parse(payload) : payload;
  const list = Array.isArray(records)
    ? records
    : Array.isArray(records?.prompts) ? records.prompts
      : Array.isArray(records?.items) ? records.items
        : [];
  const seenRemoteIds = new Map();
  return list.map((record) => {
    const prompt = String(record?.prompt || record?.text || record?.content || "").trim();
    if (!prompt) return null;
    const promptKey = promptFingerprint(prompt);
    const backup = backupByPrompt.get(promptKey) || {};
    const sourceCategory = String(record.category_cn || backup.sourceCategory || record.category || source.category || "general").trim();
    const title = String(record.title_cn || record.title_en || record.title || backup.title || prompt.slice(0, 80)).trim();
    const image = absoluteRepoImage(source.repo, record.image || record.cover || record.preview || "", branch);
    const baseRemoteId = backup.remoteId || `${source.key || source.name}:json:${record.id || shortPromptHash(prompt, 14)}`;
    const seenCount = seenRemoteIds.get(baseRemoteId) || 0;
    seenRemoteIds.set(baseRemoteId, seenCount + 1);
    const remoteId = seenCount === 0
      ? baseRemoteId
      : `${baseRemoteId}:json:${record.id || shortPromptHash(`${prompt}\n${image}`, 10)}`;
    return {
      title,
      prompt,
      image,
      preview: image,
      tags: depsSafeTags([
        source.category,
        "awesome-gpt-image2-prompts",
        sourceCategory,
        record.author,
        record.source
      ]),
      category: promptCategoryFromPath(`${sourceCategory}/${record.category || ""}/${title}`),
      sourceCategory,
      remoteId,
      author: String(record.author || backup.author || "").trim(),
      githubUrl: repoBlobUrl(source.repo, "prompts.json", branch),
      promptType: record.needs_ref ? "image-to-image" : "text-to-image"
    };
  }).filter(Boolean);
}

function depsSafeTags(values) {
  return values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean);
}

async function upsertSyncedPrompt(item, source, deps, { sourceRepo, sourceUrl, githubUrl }) {
  const prompt = await deps.store.upsertRemotePrompt({
    ...item,
    source: source.name,
    sourceUrl,
    githubUrl: item.githubUrl || githubUrl,
    sourceRepo,
    syncedAt: new Date().toISOString(),
    status: "active"
  });
  await deps.store.scanPromptDuplicateCandidatesForPrompt(prompt.id, { limit: 2000, hammingThreshold: 6 });
  return prompt;
}

async function syncGithubGenericPromptSource(source, deps) {
  const repo = githubRepoParts(source.repoUrl);
  if (!repo) throw deps.httpError("Invalid GitHub repo URL", 400);
  const branch = source.branch || "main";
  const sourceRepo = `${repo.owner}/${repo.repo}`;
  const treeUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const tree = JSON.parse(await fetchGithubText(treeUrl, `prompt source tree ${sourceRepo}`, deps));
  const files = (tree.tree || [])
    .filter((item) => item.type === "blob" && /\.(json|md|markdown|txt)$/i.test(item.path || ""))
    .filter((item) => !/(node_modules|\.github|LICENSE|package-lock)/i.test(item.path || ""))
    .slice(0, 120);
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  const errors = [];
  for (const file of files) {
    try {
      const fileRawUrl = rawUrl(sourceRepo, file.path, branch);
      const text = await fetchGithubText(fileRawUrl, `prompt source file ${file.path}`, deps);
      const fallback = {
        sourceRepo,
        path: file.path,
        title: file.path.split("/").pop().replace(/\.(json|md|markdown|txt)$/i, ""),
        category: promptCategoryFromPath(file.path),
        sourceCategory: file.path.split("/").slice(0, -1).join("/"),
        githubUrl: fileRawUrl
      };
      const parsed = /\.json$/i.test(file.path)
        ? collectJsonPromptItems(JSON.parse(text), fallback, [], deps)
        : parseMarkdownPromptItems(text, fallback, deps);
      fetched += parsed.length;
      for (const item of parsed.slice(0, 200)) {
        await upsertSyncedPrompt(item, source, deps, { sourceRepo, sourceUrl: source.repoUrl, githubUrl: fileRawUrl });
        upserted += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push(`${file.path}: ${error.message || error}`);
      if (errors.length >= 20) break;
    }
  }
  return { fetched, upserted, skipped, errors };
}

async function syncInfiniteCanvasPromptSource(source, deps) {
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  const errors = [];
  for (const remote of INFINITE_CANVAS_SOURCES) {
    try {
      let parsed = [];
      if (remote.key === "gpt-image-2") {
        const [readme, recordsRaw] = await Promise.all([
          fetchGithubText(rawUrl(remote.repo, "README.md"), `${remote.label} README`, deps),
          fetchGithubText(rawUrl(remote.repo, "data/ingested_tweets.json"), `${remote.label} tweet data`, deps)
        ]);
        parsed = parseGptImage2Readme(readme, JSON.parse(recordsRaw), remote);
      } else if (remote.key === "awesome-gpt-image") {
        const readme = await fetchGithubText(rawUrl(remote.repo, "README.zh-CN.md"), `${remote.label} README`, deps);
        parsed = parseAwesomeGptImageReadme(readme, remote);
      } else if (remote.key === "awesome-gpt4o") {
        const readme = await fetchGithubText(rawUrl(remote.repo, "README.zh-CN.md"), `${remote.label} README`, deps);
        parsed = parseAwesomeGpt4oReadme(readme, remote);
      } else {
        const readme = await fetchGithubText(rawUrl(remote.repo, "README_zh.md"), `${remote.label} README`, deps);
        parsed = parseYouMindReadme(readme, remote);
      }
      const normalized = parsed
        .map((item) => normalizeRemotePromptItem(item, {
          sourceRepo: INFINITE_CANVAS_SOURCE_REPO,
          sourceCategory: remote.category,
          category: promptCategoryFromPath(remote.category),
          tags: sourceTags(remote)
        }, deps))
        .filter(Boolean)
        .slice(0, 200);
      fetched += normalized.length;
      for (const item of normalized) {
        await upsertSyncedPrompt(item, source, deps, {
          sourceRepo: INFINITE_CANVAS_SOURCE_REPO,
          sourceUrl: source.repoUrl,
          githubUrl: item.githubUrl || repoBlobUrl(remote.repo, remote.files[0])
        });
        upserted += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push(`${remote.repo}: ${error.message || error}`);
      if (errors.length >= 20) break;
    }
  }
  return { fetched, upserted, skipped, errors };
}

async function syncAwesomeGptImage2PromptSource(source, deps) {
  const repo = githubRepoParts(source.repoUrl);
  if (!repo) throw deps.httpError("Invalid GitHub repo URL", 400);
  const branch = source.branch || "main";
  const sourceRepo = `${repo.owner}/${repo.repo}`;
  const sourceInfo = {
    key: "awesome-gpt-image2-prompts",
    category: "gpt-image-2-prompts",
    repo: sourceRepo,
    name: source.name
  };
  const [backupRaw, jsonRaw] = await Promise.all([
    fetchGithubText(rawUrl(sourceRepo, "prompts_backup.md", branch), `${source.name} prompts_backup`, deps),
    fetchGithubText(rawUrl(sourceRepo, "prompts.json", branch), `${source.name} prompts_json`, deps)
  ]);
  const backupItems = parseAwesomeGptImage2PromptsBackup(backupRaw, sourceInfo);
  const backupByPrompt = new Map();
  for (const item of backupItems) {
    const key = promptFingerprint(item.prompt);
    if (key && !backupByPrompt.has(key)) backupByPrompt.set(key, item);
  }
  const jsonItems = parseAwesomeGptImage2PromptsJson(jsonRaw, sourceInfo, branch, backupByPrompt);
  const jsonPromptKeys = new Set(jsonItems.map((item) => promptFingerprint(item.prompt)).filter(Boolean));
  const backupOnlyItems = backupItems.filter((item) => !jsonPromptKeys.has(promptFingerprint(item.prompt)));
  const normalized = [...jsonItems, ...backupOnlyItems]
    .map((item) => normalizeRemotePromptItem(item, {
      sourceRepo,
      sourceCategory: item.sourceCategory || sourceInfo.category,
      category: promptCategoryFromPath(item.sourceCategory || sourceInfo.category),
      tags: item.tags || []
    }, deps))
    .filter(Boolean)
    .slice(0, 600);
  let upserted = 0;
  for (const item of normalized) {
    await upsertSyncedPrompt(item, source, {
      ...deps,
      sanitizePromptTags: deps.sanitizePromptTags
    }, {
      sourceRepo,
      sourceUrl: source.repoUrl,
      githubUrl: item.githubUrl || repoBlobUrl(sourceRepo, "prompts_backup.md", branch)
    });
    upserted += 1;
  }
  return { fetched: normalized.length, upserted, skipped: 0, errors: [] };
}

async function runPromptSourceSync(source, deps) {
  if (source.parser === "infinite-canvas") return syncInfiniteCanvasPromptSource(source, deps);
  if (source.parser === "awesome-gpt-image2-prompts") return syncAwesomeGptImage2PromptSource(source, deps);
  if (source.parser && source.parser !== "github-generic") {
    throw deps.httpError(`Unsupported parser '${source.parser}'`, 400);
  }
  return syncGithubGenericPromptSource(source, deps);
}

module.exports = {
  runPromptSourceSync,
  githubRepoParts,
  normalizeRemotePromptItem,
  parseMarkdownPromptItems,
  parseAwesomeGptImage2PromptsBackup,
  parseAwesomeGptImage2PromptsJson,
  promptFingerprint,
  INFINITE_CANVAS_SOURCE_REPO
};
