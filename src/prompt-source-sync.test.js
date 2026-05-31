const {
  firstContentImage,
  githubRepoParts,
  normalizeRemotePromptItem,
  parseAwesomeGpt4oReadme,
  parseMarkdownPromptItems,
  promptFingerprint
} = require("./prompt-source-sync");

const deps = {
  sanitizePromptTags: (tags) => [...new Set([...(Array.isArray(tags) ? tags : [tags])].filter(Boolean).map(String))],
  sanitizeUrlField: (value) => String(value || "").trim()
};

describe("prompt source sync pure parsers", () => {
  it("normalizes remote prompt items with fallback fields and generated IDs", () => {
    const item = normalizeRemotePromptItem(
      { text: "Create a porcelain tea poster with soft light.", labels: ["tea", "poster"], image: "https://img.test/a.png" },
      { title: "Fallback", sourceRepo: "owner/repo", path: "README.md", category: "style" },
      deps
    );

    expect(item).toMatchObject({
      title: "Fallback",
      prompt: "Create a porcelain tea poster with soft light.",
      image: "https://img.test/a.png",
      tags: ["tea", "poster"],
      category: "style",
      language: "en"
    });
    expect(item.remoteId).toHaveLength(40);
  });

  it("parses markdown prompt labels and fenced prompt blocks", () => {
    const items = parseMarkdownPromptItems(`
## Tea Campaign
- Prompt: A refined porcelain tea campaign poster with morning light

\`\`\`
cinematic jade porcelain still life with premium negative space
\`\`\`
`, { path: "README.md", category: "use_case" }, deps);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Tea Campaign");
    expect(items[0].prompt).toContain("porcelain tea campaign");
    expect(items[1].prompt).toContain("cinematic jade porcelain");
  });

  it("extracts non-decorative repository images from markdown and html", () => {
    expect(firstContentImage('<img src="./images/out.png">', "owner/repo")).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/images/out.png"
    );
    expect(firstContentImage("![badge](https://img.shields.io/badge/a-b.svg)\n![work](assets/work.jpg)", "owner/repo")).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/assets/work.jpg"
    );
  });

  it("parses GitHub repos and GPT-4o markdown cases", () => {
    expect(githubRepoParts("https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts.git")).toEqual({
      owner: "ImgEdify",
      repo: "Awesome-GPT4o-Image-Prompts"
    });

    const items = parseAwesomeGpt4oReadme(`
### 复古海报
![demo](assets/demo.png)
- **提示词文本：** \`Create a retro poster with grain and bold shape\`
`, { key: "gpt4o", category: "poster", repo: "owner/repo" });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "复古海报",
      prompt: "Create a retro poster with grain and bold shape",
      image: "https://raw.githubusercontent.com/owner/repo/main/assets/demo.png",
      remoteId: "gpt4o:复古海报"
    });
  });

  it("fingerprints prompts with whitespace-insensitive lowercase keys", () => {
    expect(promptFingerprint("  Hello\nWORLD  ")).toBe("hello world");
  });
});
