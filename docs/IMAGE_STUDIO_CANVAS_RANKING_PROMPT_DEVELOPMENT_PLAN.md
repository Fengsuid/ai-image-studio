# ai-image-studio 画布、排行榜、提示词库开发文档

状态：草案，已完成一次代码与线上数据审查。  
参考项目：https://github.com/basketikun/infinite-canvas  
参考文档：

- https://github.com/basketikun/infinite-canvas/blob/main/docs/features.md
- https://github.com/basketikun/infinite-canvas/blob/main/docs/canvas-data-structure.md
- https://github.com/basketikun/infinite-canvas/blob/main/docs/backend-database.md
- https://github.com/basketikun/infinite-canvas/blob/main/docs/third-party-prompt-repositories.md

## 1. 当前结论

### 1.1 画廊图片“有些不展示”的排查

已检查线上 `/api/images/public?limit=120` 返回的公开图片：

- 公开列表目前返回 6 条。
- 用 GET 请求访问每条 `/api/images/:id/file`，全部返回 `200 image/png`。
- 用 HEAD 请求访问同一图片接口，全部返回 `404 application/json`。

结论：

- 图片文件本身存在，不是磁盘文件丢失。
- 当前后端图片文件路由只处理 GET，不处理 HEAD，导致预检、外部监控、某些懒加载或代理判断容易误认为图片失效。
- 已在 `server.js` 中补充 `/api/images/:id/file` 和 `/api/images/:id/source-file` 的 HEAD 支持，并返回 `Content-Length`。

后续仍需要：

- 前端所有画廊图片增加统一 `onerror` 占位，不让破图撑坏瀑布流。
- 后端提供 `GET /api/gallery/integrity` 或后台巡检，定期检查数据库公开记录与文件是否一致。
- `/api/images/public` 可选 `includeBroken=1`，默认过滤确认为缺文件的公开记录。

### 1.2 提示词库数量少的原因

线上 `/api/prompts?limit=2000` 当前返回 371 条，来源只有：

- `EvoLinkAI`：251 条
- `Gen-Image/freestylefly`：120 条

这解释了“非用户发布的提示词为什么不在提示词库”的问题：系统目前只导入了两类来源，没有接入 `infinite-canvas` 已整理的提示词分类、远程仓库同步和 prompt category 结构。

需要补齐：

- 远程提示词源表。
- 提示词分类表。
- 提示词同步任务。
- 提示词 preview/cover/category/visibility 字段。
- 前台把“用户公开作品”和“系统/远程提示词”在同一个画廊中清晰分区展示，而不是混在一起导致用户误解。

## 2. 从 infinite-canvas 吸收的能力

`infinite-canvas` 的画布体系可以拆成四层：

1. 画布项目：支持多个项目、重命名、删除、批量删除、JSON 导入导出。
2. 无限画布：拖动画布、滚轮缩放、小地图、点阵/网格/空白背景、框选、多选、撤销重做、复制粘贴、快捷键。
3. 节点系统：图片节点、文本节点、生成配置节点；支持拖拽、缩放、连线、上下游高亮、查看 JSON。
4. AI 工作流：从上游文本/图片读取输入，生成配置节点统一设置模型、比例、数量，批量生成结果；助手可读取选中节点和上游节点。

数据结构上，核心是：

- `CanvasProject`
- `CanvasNodeData[]`
- `CanvasConnection[]`
- `CanvasAssistantSession[]`
- `viewport`
- 图片大文件不直接长期塞进画布 JSON，而是用 `storageKey` 或服务端 file id 引用。

对 ai-image-studio 的启发：

- 我们不能只做一个“放大版编辑器”，要做可保存、可继续、可复用的创作工作台。
- 画廊图片、提示词卡、用户生成历史都应该能一键送入画布。
- 画布里的输出也能发布到画廊，并保留节点线路作为创作路线。

## 3. P0 修复：画廊图片可靠展示

### 3.1 已完成的小修复

文件：`server.js`

- `/api/images/:id/file` 支持 `HEAD`。
- `/api/images/:id/source-file` 支持 `HEAD`。
- 返回 `Content-Length`，便于浏览器、代理、监控和前端预检判断图片存在。

### 3.2 下一步前端兜底

新增工具函数：

```js
function imageErrorFallback(event, label = "") {
  const img = event.currentTarget;
  img.classList.add("is-broken");
  const frame = img.closest("[data-image-frame]");
  if (frame) frame.dataset.imageBroken = "1";
}
```

所有画廊、排行榜、详情弹窗、路线缩略图统一：

```html
<img data-gallery-image onerror="..." loading="lazy" decoding="async">
```

视觉要求：

- 不显示浏览器默认破图图标。
- 卡片保留固定比例占位。
- 文案显示“图片暂不可用”，并保留提示词、作者、复制、重新生成入口。

### 3.3 后端巡检

新增表：

```sql
CREATE TABLE gallery_file_checks (
  generation_id VARCHAR(32) NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  file_exists TINYINT(1) NOT NULL DEFAULT 0,
  byte_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  mime_type VARCHAR(80) NOT NULL DEFAULT '',
  checked_at DATETIME(3) NOT NULL,
  last_error VARCHAR(255) NOT NULL DEFAULT ''
);
```

新增接口：

- `GET /api/admin/gallery-file-checks?status=broken`
- `POST /api/admin/gallery-file-checks/run`

公开接口策略：

- 默认不返回 `file_exists = 0` 的公开作品。
- 管理员可通过 `includeBroken=1` 查看并修复。

## 4. P0 画布工作台设计

### 4.1 页面入口

导航新增：

- `画布`
- `我的画布`
- `从画廊发送到画布`
- `从提示词发送到画布`

路由建议：

- `/canvas`：画布项目列表
- `/canvas/:id`：具体画布

当前项目是单页静态前端，可先用 hash/router 状态实现：

- `view = "canvas-list"`
- `view = "canvas-workspace"`
- `state.activeCanvasId`

### 4.2 画布布局

桌面端：

- 左栏：项目列表、素材、提示词、画廊引用。
- 中间：无限画布主区域。
- 右栏：节点配置、生成设置、画布助手。
- 底部或右下：缩放控件、小地图、撤销重做。

移动端：

- 默认只读/轻编辑。
- 节点编辑、素材、助手用底部抽屉。
- 批量连接、框选、多选放到桌面优先级。

### 4.3 节点类型

第一阶段节点：

```ts
type CanvasNodeType =
  | "image"
  | "text"
  | "prompt"
  | "generation-config"
  | "gallery-work"
  | "asset";
```

节点字段：

```ts
type CanvasNode = {
  id: string;
  type: CanvasNodeType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  metadata: {
    content?: string;
    prompt?: string;
    generationId?: string;
    promptId?: number | string;
    fileId?: string;
    imageUrl?: string;
    sourceImageUrl?: string;
    model?: string;
    size?: string;
    status?: "idle" | "loading" | "success" | "error";
    error?: string;
  };
};
```

连线字段：

```ts
type CanvasEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  role?: "prompt" | "image" | "reference" | "mask" | "output";
};
```

### 4.4 画布数据库

新增表：`canvas_projects`

```sql
CREATE TABLE canvas_projects (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  cover_generation_id VARCHAR(32) NULL,
  cover_url VARCHAR(500) NOT NULL DEFAULT '',
  visibility VARCHAR(24) NOT NULL DEFAULT 'private',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  is_template TINYINT(1) NOT NULL DEFAULT 0,
  data_json LONGTEXT NOT NULL,
  node_count INT UNSIGNED NOT NULL DEFAULT 0,
  edge_count INT UNSIGNED NOT NULL DEFAULT 0,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  like_count INT UNSIGNED NOT NULL DEFAULT 0,
  favorite_count INT UNSIGNED NOT NULL DEFAULT 0,
  copy_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_canvas_user_updated (user_id, updated_at),
  INDEX idx_canvas_public (visibility, status, updated_at),
  CONSTRAINT fk_canvas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

新增表：`canvas_project_likes`

```sql
CREATE TABLE canvas_project_likes (
  canvas_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (canvas_id, user_id),
  INDEX idx_canvas_likes_created (created_at),
  CONSTRAINT fk_canvas_likes_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_canvas_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

新增表：`canvas_generation_links`

```sql
CREATE TABLE canvas_generation_links (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  canvas_id VARCHAR(32) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  generation_id VARCHAR(32) NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'output',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_canvas_node_generation (canvas_id, node_id, generation_id),
  INDEX idx_canvas_generation (generation_id),
  CONSTRAINT fk_canvas_link_canvas FOREIGN KEY (canvas_id) REFERENCES canvas_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_canvas_link_generation FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
);
```

### 4.5 画布 API

```http
GET    /api/canvases
POST   /api/canvases
GET    /api/canvases/:id
PATCH  /api/canvases/:id
DELETE /api/canvases/:id
POST   /api/canvases/:id/duplicate
POST   /api/canvases/:id/import
GET    /api/canvases/:id/export
POST   /api/canvases/:id/generate
POST   /api/canvases/:id/publish
POST   /api/canvases/:id/like
DELETE /api/canvases/:id/like
```

生成逻辑：

1. 前端根据选中配置节点收集上游文本和图片节点。
2. 生成请求提交到 `/api/canvases/:id/generate`。
3. 后端复用现有 `/api/images/generate` 与 `/api/images/edit` 的 provider 调用。
4. 结果写入 `generations`。
5. 同步写入 `canvas_generation_links`。
6. 返回生成节点补丁，由前端落到画布中。

## 5. P0 排行榜重构

### 5.1 当前问题

当前接口已有：

```http
GET /api/gallery/leaderboard?range=day|week|month|all&limit=...
```

但当前 SQL 逻辑主要是按作品发布时间过滤，再按 `g.like_count` 排序。这会导致：

- 日榜不是“今天获得最多点赞”，而是“今天发布且总点赞最多”。
- 老作品在周榜/月榜不够准确。
- 榜单展示量少，前端只取前 8 个展示。
- 榜单卡片点击只是弹窗，缺少可分享的详情页面/路由。

### 5.2 新榜单口径

榜单按点赞行为发生时间统计，而不是只按作品发布时间统计。

榜单类型：

- 日榜：过去 24 小时新增点赞数。
- 周榜：过去 7 天新增点赞数。
- 月榜：过去 30 天新增点赞数。
- 总榜：总点赞数。
- 新作榜：发布时间最近且质量合格。
- 图生图榜：只看带输入原图的作品。
- 文生图榜：只看纯文生图作品。
- 标签榜：按标签筛选后的榜单。

### 5.3 API 设计

```http
GET /api/gallery/leaderboards?limit=24
```

返回：

```json
{
  "boards": {
    "day": [],
    "week": [],
    "month": [],
    "all": [],
    "textToImage": [],
    "imageToImage": []
  },
  "generatedAt": "2026-05-19T00:00:00.000Z"
}
```

详情：

```http
GET /api/gallery/:id
```

返回完整：

- 图片信息
- 作者
- 标签
- 点赞数
- 当前用户是否点赞
- 创作路线
- 图生图输入图
- 原提示词/当前提示词
- 可用操作权限

### 5.4 SQL 口径

日/周/月榜：

```sql
SELECT
  g.*,
  COUNT(gl.user_id) AS range_like_count
FROM generations g
JOIN generation_likes gl ON gl.generation_id = g.id
WHERE g.is_public = 1
  AND g.archived = 0
  AND g.moderation_status IN ('visible', 'restored')
  AND gl.created_at >= DATE_SUB(NOW(3), INTERVAL ? DAY)
GROUP BY g.id
ORDER BY range_like_count DESC, g.like_count DESC, COALESCE(g.published_at, g.created_at) DESC
LIMIT ?;
```

总榜：

```sql
ORDER BY g.like_count DESC, COALESCE(g.published_at, g.created_at) DESC
```

### 5.5 前端布局

画廊顶部：

- 大榜单横幅：Top 1-3。
- 榜单 Tabs：日榜 / 周榜 / 月榜 / 总榜 / 文生图 / 图生图。
- 榜单网格：展示 24 条，支持“查看更多”到完整榜单页。
- 每张榜单卡点击进入 `/gallery/:id` 或 hash route `#gallery/:id`。

详情页：

- 左侧大图。
- 右侧信息栏。
- 底部创作路线。
- 图生图作品必须显示输入图和输出图对照。
- 按钮：复制提示词、提示词文生图、图生图、下载、点赞、举报、作者管理。

## 6. P0 提示词数据库升级

### 6.1 当前 prompts 表不足

现有表有：

- `title`
- `prompt`
- `image`
- `tags_json`
- `author`
- `source`
- `source_url`
- `status`
- `like_count`
- `use_count`

缺少：

- `category`
- `visibility`
- `cover_url` 与 `image` 的统一命名
- `preview`
- `github_url`
- `remote_id`
- `source_repo`
- `source_category`
- `synced_at`
- `prompt_type`
- `language`
- `model_hint`

### 6.2 新增 prompt_categories

```sql
CREATE TABLE prompt_categories (
  code VARCHAR(80) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  source_repo VARCHAR(255) NOT NULL DEFAULT '',
  github_url VARCHAR(500) NOT NULL DEFAULT '',
  remote TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  synced_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
```

### 6.3 prompts 表迁移

```sql
ALTER TABLE prompts
  ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT '' AFTER tags_json,
  ADD COLUMN visibility VARCHAR(24) NOT NULL DEFAULT 'public' AFTER category,
  ADD COLUMN preview MEDIUMTEXT NULL AFTER prompt,
  ADD COLUMN github_url VARCHAR(500) NOT NULL DEFAULT '' AFTER source_url,
  ADD COLUMN remote_id VARCHAR(160) NOT NULL DEFAULT '' AFTER github_url,
  ADD COLUMN source_repo VARCHAR(255) NOT NULL DEFAULT '' AFTER remote_id,
  ADD COLUMN source_category VARCHAR(120) NOT NULL DEFAULT '' AFTER source_repo,
  ADD COLUMN prompt_type VARCHAR(40) NOT NULL DEFAULT 'text-to-image' AFTER source_category,
  ADD COLUMN language VARCHAR(24) NOT NULL DEFAULT 'zh' AFTER prompt_type,
  ADD COLUMN model_hint VARCHAR(120) NOT NULL DEFAULT '' AFTER language,
  ADD COLUMN synced_at DATETIME(3) NULL AFTER model_hint;
```

兼容策略：

- 继续保留 `image` 字段，前端统一映射为 `coverUrl`。
- 新数据写 `category/preview/github_url`。
- 旧数据的 `source` 迁移到 `source_repo` 或 `source_category`。

### 6.4 prompt_sources

```sql
CREATE TABLE prompt_sources (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  github_url VARCHAR(500) NOT NULL,
  raw_base_url VARCHAR(500) NOT NULL,
  parser VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  last_sync_status VARCHAR(24) NOT NULL DEFAULT 'never',
  last_sync_at DATETIME(3) NULL,
  last_error TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
```

内置来源参考：

- `EvoLinkAI/awesome-gpt-image-2-API-and-Prompts`
- `ZeroLu/awesome-gpt-image`
- `ImgEdify/Awesome-GPT4o-Image-Prompts`
- `YouMind-OpenLab/awesome-gpt-image-2`
- `YouMind-OpenLab/awesome-nano-banana-pro-prompts`

### 6.5 prompt_sync_runs

```sql
CREATE TABLE prompt_sync_runs (
  id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  source_id VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL,
  fetched_count INT UNSIGNED NOT NULL DEFAULT 0,
  inserted_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_count INT UNSIGNED NOT NULL DEFAULT 0,
  hidden_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  INDEX idx_prompt_sync_source_started (source_id, started_at)
);
```

### 6.6 后端接口

```http
GET  /api/prompt-categories
GET  /api/prompt-sources
POST /api/admin/prompt-sources/:id/sync
POST /api/admin/prompt-sources/sync-all
GET  /api/admin/prompt-sync-runs
```

`GET /api/prompts` 增加参数：

- `category`
- `source`
- `visibility`
- `type`
- `q`
- `hasImage`
- `sort=hot|new|used|liked`

### 6.7 前台展示修复

画廊拆分为三个分区：

1. 公开作品：用户发布的生成图。
2. 提示词：系统/远程/管理员录入的 prompt。
3. 素材：后续接入素材库。

提示词卡即使没有封面也必须展示：

- 使用渐变占位图。
- 标明“无预览图”。
- 详情页仍可打开，不能因为 `imageUrl` 为空直接 return。

## 7. P1 素材库

参考 `infinite-canvas` 的 assets 能力，新增服务器素材库：

```sql
CREATE TABLE assets (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  user_id VARCHAR(32) NULL,
  title VARCHAR(160) NOT NULL,
  type VARCHAR(40) NOT NULL,
  visibility VARCHAR(24) NOT NULL DEFAULT 'private',
  cover_url VARCHAR(500) NOT NULL DEFAULT '',
  tags_json LONGTEXT NULL,
  category VARCHAR(80) NOT NULL DEFAULT '',
  description VARCHAR(500) NOT NULL DEFAULT '',
  content MEDIUMTEXT NULL,
  url VARCHAR(500) NOT NULL DEFAULT '',
  like_count INT UNSIGNED NOT NULL DEFAULT 0,
  favorite_count INT UNSIGNED NOT NULL DEFAULT 0,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  extra_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_assets_user_updated (user_id, updated_at),
  INDEX idx_assets_public (visibility, type, updated_at)
);
```

素材来源：

- 用户上传图片。
- 画布节点保存。
- 提示词保存为文本素材。
- 公开画廊作品保存为引用素材。

## 8. 实施顺序

### Sprint A：画廊可靠性与榜单改造

- [x] 图片文件接口补 HEAD 支持。
- [ ] 图片卡统一 onerror 占位。
- [ ] 后台图片文件巡检表和接口。
- [ ] 榜单 SQL 改为按 `generation_likes.created_at` 统计日/周/月。
- [ ] 画廊详情增加可分享路由。
- [ ] 前台展示日榜/周榜/月榜/总榜，每榜至少展示 24 条。

### Sprint B：提示词数据库与同步

- [ ] 迁移 `prompt_categories`。
- [ ] 迁移 `prompt_sources`。
- [ ] 迁移 `prompt_sync_runs`。
- [ ] `prompts` 表补 `category/visibility/preview/github_url/remote_id`。
- [ ] 实现五个远程来源 parser。
- [ ] 后台增加“提示词来源”页面。
- [ ] 前台提示词区支持无封面卡片和详情页。

### Sprint C：画布 MVP

- [ ] 新增 `canvas_projects`。
- [ ] 新增 `canvas_project_likes`。
- [ ] 新增 `canvas_generation_links`。
- [ ] 新增画布项目列表页。
- [ ] 新增无限画布基础组件：拖拽、缩放、背景、小地图。
- [ ] 实现图片/文本/提示词/生成配置节点。
- [ ] 实现节点连线和上游输入收集。
- [ ] 画廊/提示词/历史作品一键发送到画布。
- [ ] 画布生成结果写回 `generations` 并可发布。

### Sprint D：画布增强

- [ ] 撤销/重做。
- [ ] 框选、多选、复制粘贴。
- [ ] JSON 导入导出。
- [ ] 图片裁剪和角度变换。
- [ ] 画布助手。
- [ ] 画布模板和公开画布。

## 9. 验收标准

画廊：

- 图片 GET 和 HEAD 都返回正确状态。
- 文件缺失时前台不破版。
- 公开作品详情页可直接打开。

排行榜：

- 日榜、周榜、月榜、总榜都可切换。
- 日/周/月榜按周期内新增点赞统计。
- 每个榜单至少可展示 24 条。
- 点击榜单作品进入详情。

提示词：

- 提示词库数量不再只依赖用户公开作品。
- 五个远程提示词来源可在后台同步。
- 提示词有分类、来源、标签、预览。
- 没有封面的提示词也可搜索、展示、打开详情、复制和生图。

画布：

- 用户可创建多个画布项目。
- 画廊作品、提示词、历史生成图可插入画布。
- 画布节点可连线，生成配置节点能读取上游输入。
- 画布生成结果保存到历史，并能发布到画廊。

