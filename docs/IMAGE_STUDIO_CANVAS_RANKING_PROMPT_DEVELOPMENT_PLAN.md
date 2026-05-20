# ai-image-studio 画布、排行榜、提示词库开发文档

状态：持续维护，已完成画布 MVP、画廊可靠性、提示词排序、AI 重复审核、小地图、历史、选择分组、JSON 导入导出和画布助手的多轮落地验证。
参考项目：https://github.com/basketikun/infinite-canvas
参考文档：

- https://github.com/basketikun/infinite-canvas/blob/main/docs/features.md
- https://github.com/basketikun/infinite-canvas/blob/main/docs/canvas-node-manual.md
- https://github.com/basketikun/infinite-canvas/blob/main/docs/canvas-shortcuts.md
- https://github.com/basketikun/infinite-canvas/blob/main/docs/backend-database.md
- https://github.com/basketikun/infinite-canvas/blob/main/docs/api-response.md

2026-05-20 补充说明：`infinite-canvas` 当前 README 标注技术栈为 Next.js、React、TypeScript、Tailwind CSS、Ant Design、Zustand、TanStack Query、Go、Gin、GORM 和 Docker；本项目当前是无构建静态前端、Node.js `server.js`、`src/mysql-store.js`、MySQL 和现有 OpenAI 兼容后端代理。后续只吸收其画布产品能力、交互模型、数据结构思路和局部实现经验，不直接整体迁移框架，也不把浏览器直连 API Key 的模式照搬到本项目。

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

### 1.3 2026-05-20 新增体验缺陷与数据接入反馈

本节记录用户最新发现，作为下一轮开发直接入口。

1. 文生图开始生成后界面闪动
   现象：点击生成后，文生图工作区出现一闪一闪的状态变化。
   可能根因：生成状态轮询或历史刷新时重复调用视图切换、重建 composer、清空并重绘历史列表、滚动到顶部，导致 DOM 和布局反复变化。
   修复方向：生成开始时只插入/更新当前生成占位卡、状态条和计时器；`renderAll()`、`setView()`、`renderComposers()`、历史列表刷新和路由 hash 更新必须做幂等保护；生成中不要反复切换 `home/chat/library/canvas` class。

2. 榜单排布和点赞按钮需要重做
   现象：榜单当前排布仍显得像附加内容块，不像画廊的长期导航能力；榜单图里的点赞按钮不好看。
   修复方向：桌面端做成画廊右侧栏，移动端做成底部抽屉或可折叠侧栏；榜单项用紧凑缩略图 + 排名 + 标题/作者 + 点赞 icon/数字。点赞按钮统一为小型 heart icon，不使用突兀大胶囊。

3. 文生图结果卡按钮多余
   现象：截图中结果卡展示 `再次生成 / 保存 / 加入画布 / 改提示词 / 更多`，密度过高，`更多` 按钮出现默认浏览器描边。
   修复方向：常驻最多 3 个操作：`再次生成`、`下载/保存`、`更多`。`加入画布`、`改提示词`、`图生图`、`复制提示词` 进入更多菜单或 icon-only 次级操作区；`更多` 必须沿用项目按钮样式和图标，不出现原生控件边框。

4. infinite-canvas 提示词数据库加入画廊
   现状：本项目已有 `prompt_sources`、`prompt_sync_runs`、后台同步入口和通用 GitHub parser，但默认来源没有 `basketikun/infinite-canvas`，也没有针对它提示词库结构的 parser。
   修复方向：把 `https://github.com/basketikun/infinite-canvas` 作为新的远程提示词源接入，解析其提示词库、分类、示例图、来源 URL 和标签，写入本项目 `prompts`，并进入画廊提示词分区、搜索、标签筛选、榜单和 `加入画布` 流程。同步结果必须保留 `sourceRepo = basketikun/infinite-canvas`、`githubUrl`、`remoteId` 和来源归属，方便后续更新、去重和审计。

5. 画廊详情主图联动失效
   现象：详情页点击 `创作路线` 条目后，左侧大图不变化；图生图详情里的 `输入图` / `结果图` 也需要点击后同步切换主展示图。
   可能根因：右侧路线列表只更新了 active class 或详情局部状态，没有把主图渲染来源统一到同一个 `selectedMedia`；输入图和结果图缩略卡可能只是普通展示卡，没有绑定切换行为。
   修复方向：详情页/弹窗维护唯一 `selectedMedia` 状态，形如 `{ kind: "result" | "source" | "route-step", id, generationId, imageUrl, title, prompt }`。主图、active 样式、复制/加入画布/图生图动作都读取它；点击创作路线、输入图、结果图只切换 `selectedMedia`，不重新请求整条作品、不重置滚动位置。

6. 画廊卡片标签展示错误
   现象：未查看详情时，卡片展示两个 `图生图` / `文生图`，却没有展示用户设置的标签。
   可能根因：类型标签、公开标签、管理员徽标在渲染层被混用；`publicTags` 中的系统类型词没有去重；卡片和详情页使用了不同的标签归一逻辑。
   修复方向：新增统一的 gallery tag view model：`kindBadge` 只表示 `文生图` / `图生图` 且最多一个；`publicTags` 只展示用户/管理员设置的内容标签；`adminBadge` 独立展示，不占用标签位。渲染前过滤 `文生图`、`图生图`、`text-to-image`、`image-to-image` 等类型别名，并保留用户设置标签的顺序。

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

### 2.1 上游能力盘点与取舍

`infinite-canvas` 值得吸收的能力不是某一个单独组件，而是一套“视觉创作项目”的组织方式：

| 上游能力 | 上游做法 | 本项目吸收方式 | 不照搬的部分 |
| --- | --- | --- | --- |
| 多画布项目 | 支持项目创建、重命名、删除、批量删除、JSON 导入导出 | 已落到 `canvas_projects`、`GET/POST/PATCH/DELETE /api/canvases`、`canvas-io.js` | 不只放浏览器本地，必须按登录用户保存到 MySQL |
| 无限画布 | 平移、滚轮缩放、缩放控件、重置视图、小地图、点阵/网格/空白背景 | 已落到 `public/canvas.js`、`canvas-geometry.js`、`canvas-minimap.js` | 不迁移 React/Zustand 状态层，继续使用当前无构建脚本体系 |
| 编辑效率 | 框选、多选、全选、复制粘贴、撤销重做、删除、快捷键 | 已落到 `canvas-selection.js`、`canvas-history.js` 和 smoke | 后续不能继续往主文件堆快捷键逻辑 |
| 节点系统 | 图片节点、文本节点、生成配置节点，节点可拖拽、缩放、连线、查看 JSON | 本项目扩展为 `image/text/prompt/config/output/group`，并绑定 generation、prompt、gallery 和 asset 来源 | 不把所有节点字段自由散落，必须经过节点模板和导入校验 |
| AI 工作流 | 生成配置节点读取上游文本/图片，统一模型、比例、数量后生成 | 已通过 `/api/canvases/:id/generate` 复用现有文生图/图生图链路，写 `generations` 和 `canvas_generation_links` | 不允许浏览器直连模型 API，不在前端保存生产 API Key |
| 画布助手 | 读取选中节点和上游节点，生成文本、生图，并把结果插回画布 | 已落到 `src/canvas-assistant.js`、`public/canvas-assistant.js`、`POST /api/canvases/:id/assistant` | 不读取请求里伪造的大 payload，只基于服务端保存的 `dataJson` 和权限校验 |
| 提示词库与素材 | 提示词库、我的素材、服务器素材，支持加入画布 | 本项目已有提示词库、画廊、我的作品和 prompt 图片代理，应先把这些内容作为画布来源接好 | 素材库后续再做，不把本地素材逻辑和公开画廊混成同一数据表 |

取舍原则：

- 优先吸收“用户在画布上组织创作线路”的能力，而不是重做完整前端技术栈。
- 所有生成都继续走本项目后端：鉴权、CSRF、额度、速率限制、provider 设置、`generation_requests` 审计和 `generations` 落库必须保持。
- 图片大文件不写入画布 JSON。画布 JSON 只保存 `/api/images/:id/file`、`/api/prompt-images/:id/file`、`/prompt-thumbs/**`、上传文件 id 或公开 URL 引用。
- 上游文档提示该项目还处于开发阶段并不保证历史数据兼容，因此本项目要有自己的 `ai-image-studio.canvas.v1` 导入导出格式，不依赖上游内部字段稳定性。

### 2.2 与本项目已有功能的结合点

画布不是独立孤岛，它要把本项目已经完成的能力串起来：

1. 首页快速生成：生成结果卡保留 `加入画布`，生成图进入画布时写入 `generationId`、`imageUrl`、`prompt`、`sourceImage`，用户可继续整理线路。
2. 画廊与排行榜：公开作品详情提供 `加入画布`、`用此图新建画布`，画布输出发布到广场时继续使用现有公开作品、标签、点赞、排行榜和作者管理体系。
3. 提示词库：提示词详情和卡片可插入 `prompt` 节点，保留 `promptId`、来源仓库、标签和热度数据；使用提示词生成时继续累加 `use_count`。
4. 图生图编辑器：现有编辑器仍负责局部编辑、遮罩、原图确认；画布只负责把输入图、提示词、配置和输出组织为线路，不替代编辑器的细粒度涂抹体验。
5. 用户与额度：画布生成继续检查登录、账号状态、每日限制和积分余额；扣费、退款、取消、失败都写回现有信用流水和请求审计。
6. 后台运营：管理员后台后续应看到画布项目数量、公开线路、异常生成链接、文件缺失、热门画布模板和复制次数。
7. QA 与部署：每个新增画布模块必须同步 `scripts/smoke/*` 和 `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`，上线后记录静态脚本、API、权限和生产版本 smoke。

### 2.3 规避“所有代码都在同一个文件”的硬规则

画布功能天然会长得很快，必须把“反单文件膨胀”写成验收条件，而不是口头提醒。

不可接受的做法：

- 把新的画布渲染、事件、节点模板、历史、选择、导入导出、助手、生成流程继续塞进 `public/app.js`。
- 把新的画布业务规则全部塞进 `public/canvas.js`，导致它变成第二个主应用文件。
- 把服务端导入校验、助手上下文、生成计划、公开线路复制等大段逻辑直接写进 `server.js` 路由分支。
- 为了省文件，把 CSS、DOM 模板、数据归一化、API 请求和 smoke 断言混到同一个模块。

新增功能的拆分规则：

- `public/app.js` 只允许保留全站路由、导航、弹窗和“把首页/画廊/提示词 payload 交给画布”的薄接线。
- `public/canvas.js` 只做画布 orchestrator：加载项目、维护当前状态、调度渲染、把事件分发给专门模块。新增功能超过约 100 行、需要独立状态、或有独立 smoke 时，必须拆新文件。
- 节点定义、节点尺寸、节点菜单和节点字段默认进 `public/canvas-nodes.js`；坐标、碰撞、连线路径、小地图布局默认进 `public/canvas-geometry.js` 或专门 geometry 模块。
- 选择、多选、框选、批量移动、分组默认进 `public/canvas-selection.js`；撤销、重做、剪贴板默认进 `public/canvas-history.js`。
- 导入导出浏览器交互默认进 `public/canvas-io.js`；后端 schema、归一化和安全校验默认进 `src/canvas-import-export.js`。
- 画布助手浏览器控制器默认进 `public/canvas-assistant.js`；上下文裁剪、伪造节点过滤和建议生成默认进 `src/canvas-assistant.js`。
- 新增服务端画布能力时，路由只能做鉴权、读 body、调用 service、返回 JSON。复杂逻辑优先拆到 `src/canvas-service.js`、`src/canvas-publish-service.js`、`src/canvas-duplicate-service.js` 等文件。
- 每个新增 `public/canvas-*.js` 都要在 `public/index.html` 明确加载顺序，并在 `scripts/smoke/check-public-api.mjs` 验证引用、静态返回和模块注册。

当前职责边界：

| 文件 | 当前职责 | 后续边界 |
| --- | --- | --- |
| `public/canvas.js` | 画布 shell、状态、渲染调度、主事件接线、保存和生成接线 | 继续瘦身，优先拆出 render、keyboard |
| `public/canvas-toolbar.js` | 工具栏按钮状态、模板切换按钮、背景 toggle、保存状态和历史按钮可用性 | 继续只读渲染工具栏状态，不承载画布数据保存 |
| `public/canvas-inspector.js` | 右侧检查器、多选摘要、节点操作按钮、连接面板和字段模板 | 扩展素材/裁剪字段时继续保留纯渲染，不直接请求 API |
| `public/canvas-store.js` | 画布 API 与创建 payload 归一 | 扩展列表缓存、目标选择器、自动保存冲突处理 |
| `public/canvas-nodes.js` | 节点模板、尺寸、group 节点 helper | 扩展图片组、素材、模板节点，不写 DOM 事件 |
| `public/canvas-geometry.js` | 坐标、尺寸、连线、小地图布局 helper | 扩展自动排版、碰撞检测、视口适配 |
| `public/canvas-workflows.js` | 上游输入收集、生成摘要和冲突判断 | 扩展批量候选、线路摘要、生成计划 |
| `public/canvas-minimap.js` | 小地图渲染和点击定位 | 保持只读轻渲染，不承载主画布状态 |
| `public/canvas-selection.js` | 多选、框选、批量移动、分组 | 扩展锁定、折叠组、批量对齐 |
| `public/canvas-history.js` | undo/redo、复制粘贴 | 扩展 patch 压缩和跨画布复制 |
| `public/canvas-io.js` | JSON 文件选择、下载、导入上传 | 扩展 `.canvas` 互通和导入冲突 UI |
| `public/canvas-assistant.js` | 右栏助手、请求和建议插入 | 扩展会话列表，不做服务端上下文规则 |
| `src/canvas-service.js` | 画布权限、CRUD、导入导出、助手、复制清洗和生成执行 service | 后续公开线路、模板、发布规则优先在这里或更细 service 中扩展 |
| `src/canvas-import-export.js` | 导入导出 schema、安全校验 | 扩展版本迁移和第三方格式转换 |
| `src/canvas-assistant.js` | 服务端上下文收集和建议生成 | 接入真实模型时继续保持 JSON 输出和兜底 |

近期工程债：

- `public/canvas.js` 已经拆出 inspector 和 toolbar，下一轮继续优先拆 `public/canvas-render.js` 和 `public/canvas-keyboard.js`。
- `server.js` 已把画布 CRUD、导入导出、助手、复制和生成执行抽到 `src/canvas-service.js`；下一轮公开线路复制、模板市场或素材库接口应继续扩 service，而不是回填到主路由。
- `public/styles.css` 中的画布样式需要按 `.canvas-*` 命名空间继续聚合，后续可拆出构建前的 CSS 片段，但当前无构建体系下不要引入需要构建的新工具。

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

### 4.1 主页入口与按钮设计

最高优先级：主页必须新增一个清晰的“画布工作台”入口，而不是只藏在导航或二级弹窗里。

新增按钮位置：

1. 顶部导航：在 `提示词库` 与 `图片编辑` 之间新增 `画布工作台`。
2. 首页首屏输入框下方：新增一个次主按钮 `打开画布工作台`，与 `查看提示词库` 同级。
3. 生图结果卡片：增加 `加入画布` 图标按钮，把当前图片、提示词和原图关系写入当前画布。
4. 画廊详情弹窗：增加 `加入画布` 和 `用此图新建画布`。
5. 提示词详情弹窗：增加 `加入画布` 和 `用此提示词新建画布`。
6. 我的作品详情：增加 `加入画布`，用于把历史生成线路继续整理成工作流。

按钮文案与图标：

| 场景 | 文案 | 图标建议 | 行为 |
| --- | --- | --- | --- |
| 顶部导航 | 画布工作台 | `ri-layout-masonry-line` | 打开画布项目列表 |
| 首页首屏 | 打开画布工作台 | `ri-node-tree` | 打开最近画布；没有画布则创建空画布 |
| 图片卡片 | 加入画布 | `ri-drag-drop-line` | 选择目标画布并插入图片节点 |
| 提示词卡片 | 加入画布 | `ri-quill-pen-line` | 选择目标画布并插入提示词节点 |
| 画廊详情 | 用此图新建画布 | `ri-flow-chart` | 新建画布并插入作品线路 |

按钮视觉要求：

- 顶部导航按钮保持现有 `nav-pill` 风格，不单独做夸张渐变。
- 首页首屏按钮使用图标+文字，放在输入框下方的操作区，不能挤压生图输入框。
- 图片卡片上的 `加入画布` 使用轻量 ghost/icon 按钮，避免和 `去生成`、`复制提示词` 抢主操作。
- 移动端按钮进入更多菜单，避免一排按钮溢出。
- 所有入口都要在未登录时弹登录框，并说明“登录后可保存多个画布项目”。

路由建议：

- `/canvas`：画布项目列表。
- `/canvas/:id`：具体画布。
- `/canvas/new`：创建新画布，支持 query 参数带入来源。
- `/gallery/:id?sendToCanvas=1`：从画廊详情进入画布选择。
- `/prompts/:id?sendToCanvas=1`：从提示词详情进入画布选择。

当前项目是单页静态前端，可先用 hash/router 状态实现：

- `view = "canvas-list"`
- `view = "canvas-workspace"`
- `state.activeCanvasId`
- `state.canvasInsertDraft`
- `state.lastCanvasId`

Hash 示例：

```text
#/canvas
#/canvas/canv_123
#/canvas/new?source=generation&id=img_123
#/canvas/new?source=prompt&id=42
```

### 4.1.1 主页按钮点击流程

`画布工作台` 按钮点击后：

1. 未登录：打开登录/注册弹窗，登录完成后继续原动作。
2. 已登录且存在最近画布：进入最近画布。
3. 已登录但没有画布：创建一张默认画布，标题为 `未命名画布`。
4. 如果用户从某张图片或提示词点击 `加入画布`：先弹出目标选择器，可选 `最近画布`、`新建画布`、`取消`。

目标选择器内容：

- 最近 5 张画布，显示封面、标题、更新时间、节点数。
- 固定按钮：`新建画布并加入`。
- 高级入口：`查看全部画布`。

### 4.1.2 首页与画布的关系

首页仍然是快速生图入口；画布是“整理、复用、继续创作”的工作台。

两者分工：

- 首页输入框：适合一次性文生图、图生图、快速尝试。
- 画布工作台：适合多图对比、提示词拆解、局部修改链路、灵感板、批量变体、项目交付。

首页生成后的推荐动作：

- `继续编辑`：沿用当前对话。
- `加入画布`：把当前结果沉淀到画布。
- `发布广场`：公开最终作品。
- `保存`：只保存文件。

### 4.2 画布布局

桌面端：

- 顶栏：返回首页、画布标题、保存状态、分享/发布、导入导出。
- 左栏：项目列表、素材库、提示词库、画廊引用、我的作品。
- 中间：无限画布主区域，支持平移、缩放、框选、多选。
- 右栏：节点配置、生成设置、画布助手、当前线路。
- 底部或右下：缩放控件、小地图、撤销重做、背景模式。

移动端：

- 默认只读/轻编辑，保留查看线路、插入节点、运行生成。
- 节点编辑、素材、助手用底部抽屉。
- 批量连接、框选、多选放到桌面优先级。

画布主区域交互：

- 空格+拖拽或鼠标中键：平移画布。
- 滚轮：缩放画布。
- 单击节点：选中节点。
- Shift+单击：多选节点。
- 拖拽节点边缘端口：创建连线。
- Delete/Backspace：删除选中节点或连线。
- Ctrl/Cmd+Z：撤销。
- Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y：重做。
- Ctrl/Cmd+C / V：复制粘贴节点。
- Ctrl/Cmd+S：保存画布。

背景模式：

- 点阵背景：默认，适合组织节点。
- 网格背景：适合排版和对齐。
- 空白背景：适合展示和截图。

画布状态提示：

- `已保存`
- `保存中`
- `未保存`
- `离线草稿`
- `同步失败，点击重试`

### 4.3 节点类型

第一阶段节点：

```ts
type CanvasNodeType =
  | "image"
  | "text"
  | "prompt"
  | "generation-config"
  | "gallery-work"
  | "asset"
  | "group"
  | "note"
  | "output";
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
    sourceType?: "upload" | "generation" | "gallery" | "prompt" | "asset";
    sourceId?: string;
    routeId?: string;
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

节点设计要求：

- 图片节点显示缩略图、来源、尺寸、是否公开、是否带原图。
- 提示词节点显示标题、标签、来源仓库、复制按钮。
- 文本节点用于用户补充需求、客户反馈、修改说明。
- 生成配置节点集中管理模型、比例、质量、候选数量、是否公开到广场。
- 输出节点显示生成进度、耗时、失败原因、重试按钮。
- 分组节点用于把同一轮方案、同一角色、同一产品图整理在一起。
- 备注节点用于项目说明，不参与生成。

节点右键菜单：

- 复制节点
- 删除节点
- 锁定/解锁
- 置顶/置底
- 适配到视图
- 导出当前节点
- 发布当前线路到广场
- 从此节点继续生成

### 4.3.1 画布工具栏

顶部工具栏：

- 返回
- 画布标题编辑
- 保存状态
- 新增节点
- 导入 JSON
- 导出 JSON
- 分享/发布

左侧工具栏：

- 选择工具
- 手型平移
- 文本节点
- 图片节点
- 提示词节点
- 生成配置节点
- 分组

右下角工具：

- 缩小
- 缩放百分比
- 放大
- 适配全部
- 小地图开关
- 背景模式切换

工具栏必须使用图标按钮为主，并给不熟悉的图标加 tooltip。文字按钮只保留在 `保存`、`发布`、`新建画布` 等明确命令上。

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
POST   /api/canvases/:id/nodes
PATCH  /api/canvases/:id/nodes/:nodeId
DELETE /api/canvases/:id/nodes/:nodeId
POST   /api/canvases/:id/edges
DELETE /api/canvases/:id/edges/:edgeId
POST   /api/canvases/:id/insert-generation
POST   /api/canvases/:id/insert-prompt
POST   /api/canvases/:id/insert-gallery-work
```

生成逻辑：

1. 前端根据选中配置节点收集上游文本和图片节点。
2. 生成请求提交到 `/api/canvases/:id/generate`。
3. 后端复用现有 `/api/images/generate` 与 `/api/images/edit` 的 provider 调用。
4. 结果写入 `generations`。
5. 同步写入 `canvas_generation_links`。
6. 返回生成节点补丁，由前端落到画布中。

### 4.6 前端文件拆分

当前已经按无构建静态脚本拆出一批画布模块，`public/index.html` 按以下顺序加载：

```text
public/
  canvas-store.js        # API、创建/保存 payload、目标项目数据入口
  canvas-nodes.js        # 节点模板、节点尺寸、节点类型 helper
  canvas-geometry.js     # 坐标换算、缩放、连线路径、小地图布局 helper
  canvas-workflows.js    # 上游节点收集、生成模式判断、输入冲突
  canvas-minimap.js      # 小地图渲染、视口框和点击定位
  canvas-selection.js    # 框选、多选、批量移动、批量删除、分组
  canvas-history.js      # undo/redo、剪贴板、复制粘贴
  canvas-io.js           # JSON 导出下载、文件选择、导入上传
  canvas-assistant.js    # 右栏助手、建议展示、建议插入节点
  canvas-toolbar.js      # 工具栏按钮状态、保存状态、模板按钮和背景 toggle
  canvas-inspector.js    # 右侧检查器、多选摘要、连接面板和字段模板
  canvas.js              # 画布主 orchestrator，只负责接线和调度
```

下一轮拆分目标：

```text
public/
  canvas-render.js       # 节点、连线、选择框的 DOM 渲染字符串
  canvas-keyboard.js     # 快捷键映射、平台差异、输入框焦点保护
```

拆分验收：

- 新增画布功能不得直接修改 `public/app.js` 的核心渲染逻辑，除非只是新增入口按钮、payload 转换或路由接线。
- `public/canvas.js` 每轮新增净代码超过约 100 行时，必须先判断能否拆到现有 `canvas-*.js`；如果没有合适模块，就新增专门模块。
- `canvas.js` 目标是主调度层，不长期承载具体业务。当前文件已经偏大，公开线路复制、模板市场、图片裁剪、素材库接入之前必须先做一次瘦身。
- 后端同理：`server.js` 只保留薄路由，复杂规则必须在 `src/` 下有独立模块和 smoke。
- 本轮新增 `scripts/smoke/check-canvas-module-boundaries.mjs`，专门验证新增画布模块被 `index.html` 引用、加载顺序在 `canvas.js` 之前，并注册到 `window.ImageStudioCanvas`。

如果暂时不引入构建工具，继续在 `index.html` 中以普通 `<script defer>` 顺序加载。后续若项目迁移到 Vite，再把这些文件升级为 ES Module；迁移前不要混用局部打包方式，避免线上静态缓存和加载顺序变复杂。

前端状态建议：

```ts
type CanvasState = {
  canvases: CanvasSummary[];
  activeCanvasId: string;
  activeCanvas: CanvasProject | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  viewport: { x: number; y: number; zoom: number };
  tool: "select" | "pan" | "text" | "image" | "prompt" | "config" | "group";
  insertDraft: null | {
    source: "generation" | "gallery" | "prompt" | "asset" | "upload";
    id?: string;
    payload?: object;
  };
  saveStatus: "saved" | "saving" | "dirty" | "offline" | "error";
  undoStack: CanvasPatch[];
  redoStack: CanvasPatch[];
};
```

保存策略：

- 用户移动节点、编辑文本、改配置后标记 `dirty`。
- 800ms 防抖保存。
- 页面关闭前如果 `dirty`，弹出离开确认。
- 保存失败时保留本地草稿到 `localStorage` 或 `indexedDB`，下次打开提示恢复。

### 4.7 完整功能闭环

#### 4.7.1 从首页进入画布

1. 用户点击首页 `打开画布工作台`。
2. 系统创建或打开最近画布。
3. 用户从左侧素材面板选择提示词、历史图片、广场作品。
4. 拖入画布形成节点。
5. 用户连接提示词节点、图片节点、生成配置节点。
6. 点击配置节点上的 `运行`。
7. 生成结果以输出节点形式出现在画布右侧。
8. 用户选择最终图，发布到广场或回到首页继续单图编辑。

#### 4.7.2 从画廊进入画布

1. 用户打开画廊详情。
2. 点击 `用此图新建画布`。
3. 系统创建画布，并插入：
   - 原图节点，若作品为图生图且作者选择公开原图。
   - 提示词节点。
   - 生成结果节点。
   - 作品信息节点，包含作者、标签、点赞量、发布时间。
4. 如果作品有多轮对话，按时间顺序生成节点线路。
5. 用户可基于这条线路继续分支生成。

#### 4.7.3 从提示词库进入画布

1. 用户在提示词库点击 `加入画布`。
2. 提示词作为 prompt 节点落入画布。
3. 如果提示词有 preview/cover，额外插入参考图片节点。
4. 用户可连接生成配置节点，直接运行文生图。

#### 4.7.4 画布发布到广场

画布发布不是只发布一张图，而是发布“最终展示图 + 创作线路摘要”。

发布内容：

- 最终展示图：用户选择某个输出节点作为封面。
- 输入原图：如果最终图来自图生图，必须带上原图引用；是否公开原图由用户选择。
- 提示词线路：收集最终输出节点上游所有 prompt/text/config 节点。
- 节点缩略图：最多展示 8 个关键节点。
- 标签：沿用当前公开标签体系，允许用户补充。
- 作者：右上角署名用户名。

广场展示：

- 卡片上显示 `画布线路` 徽标。
- 详情页可以展开线路时间轴。
- 提供 `用此线路新建画布`，复制为自己的私有画布。

### 4.8 画布 MVP 实施清单

P0 必须完成：

- [x] 顶部导航新增 `画布工作台` 按钮。
- [x] 首页首屏新增 `打开画布工作台` 按钮。
- [x] 新增 `canvas-list` 和 `canvas-workspace` 两个视图。
- [x] 新增 `canvas_projects` 表。
- [x] 支持创建、重命名、删除、保存画布。
- [x] 支持图片、文本、提示词、生成配置、输出节点。
- [x] 支持拖拽节点、缩放、平移、适配全部。
- [x] 支持从首页生成结果、画廊作品、提示词卡加入画布。
- [x] 支持节点连线并从上游节点收集 prompt/image。
- [x] 支持运行一次文生图和图生图生成。
- [x] 生成结果写回 `generations`，并生成输出节点。

P1 完善：

- [x] 小地图。
- [x] 点阵/网格/空白背景切换。
- [x] 撤销/重做。
- [x] 复制/粘贴。
- [x] 框选/多选。
- [x] JSON 导入导出。
- [x] 画布发布到广场。
- [ ] 从广场线路复制为私有画布。

P2 增强：

- [x] 画布助手读取选中节点和上游节点。
- [ ] 批量候选生成。
- [ ] 画布模板市场。
- [ ] 协作查看链接。
- [ ] 节点版本对比。
- [ ] 自动排版线路。

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

- 桌面端采用画廊侧栏：主区域继续展示画廊瀑布流，右侧栏展示榜单。
- 移动端榜单进入底部抽屉或折叠侧栏，不挤占主图片流。
- 榜单 Tabs：日榜 / 周榜 / 月榜 / 总榜 / 文生图 / 图生图。
- 榜单侧栏默认展示 Top 12，完整榜单页或弹层展示 24+ 条。
- 榜单项样式：排名编号、48-64px 缩略图、标题/作者、紧凑点赞按钮。
- 榜单点赞按钮：统一 heart icon + 数字，hover/active 状态与画廊卡一致，不使用突兀大胶囊或浏览器默认按钮边框。
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
- `basketikun/infinite-canvas`

`basketikun/infinite-canvas` 接入要求：

- 新增默认 `prompt_sources` seed，例如 `ps_basketikun_infinite_canvas`。
- 如果通用 `github-generic` parser 无法稳定提取其提示词库，需要新增 `infinite-canvas` 专用 parser。
- 同步时优先读取上游提示词库/提示词源相关目录，而不是把整仓所有 Markdown 都当成提示词。
- 写入 `prompts` 时必须保留 `sourceRepo = "basketikun/infinite-canvas"`、`remoteId`、`githubUrl`、`sourceCategory`、封面或示例图引用。
- 同步结果进入画廊提示词分区、提示词搜索、标签筛选、提示词点赞榜和 `加入画布`。
- 同步前做 hash/simhash 去重和 AI 重复审核；重复项进入候选，不自动覆盖已有优质提示词。
- 公开展示需要保留来源署名和仓库链接，便于后续更新与归属追踪。

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

当前实现状态：

- 提示词点赞使用 `prompt_likes` 表，`PRIMARY KEY (prompt_id, user_id)` 防止重复点赞。
- `prompts.like_count` 和 `prompts.use_count` 已落库。
- `/api/prompts/:id/like` 支持点赞和取消点赞后重新统计数量。
- `/api/prompts/:id/use` 在提示词带入生成台时累加使用量。
- `/api/prompts` 已支持 `sort=hot|new|used|liked`，并使用稳定的二级排序。
- 前台提示词库提供热门、最新、常用、最赞排序切换。

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
- [x] 图片卡统一 onerror 占位。
- [x] 后台图片文件巡检表和接口。
- [x] 榜单 SQL 改为按 `generation_likes.created_at` 统计日/周/月。
- [x] 画廊详情增加可分享路由。
- [x] 前台展示日榜/周榜/月榜/总榜，每榜至少展示 24 条。

### Sprint B：提示词数据库与同步

- [x] 迁移 `prompt_categories`。
- [x] 迁移 `prompt_sources`。
- [x] 迁移 `prompt_sync_runs`。
- [x] `prompts` 表补 `category/visibility/preview/github_url/remote_id`。
- [x] 实现五个远程来源 parser。
- [ ] 接入 `basketikun/infinite-canvas` 提示词源，并让同步结果进入画廊、搜索、榜单和画布插入。
- [x] 后台增加“提示词来源”页面。
- [x] 前台提示词区支持无封面卡片和详情页。
- [x] 提示词点赞、使用量、热度排序与前台排序切换。

### Sprint C：画布 MVP

- [x] 顶部导航新增 `画布工作台` 按钮。
- [x] 首页首屏新增 `打开画布工作台` 按钮。
- [x] 生图结果、画廊详情、提示词详情、我的作品详情增加 `加入画布`。
- [x] 新增画布目标选择器：最近画布、新建画布、查看全部画布。
- [x] 新增 `canvas_projects`。
- [ ] 新增 `canvas_project_likes`。
- [x] 新增 `canvas_generation_links`。
- [x] 新增画布项目列表页。
- [x] 新增无限画布基础组件：拖拽、缩放、平移、适配全部、背景。
- [x] 实现图片/文本/提示词/生成配置/输出节点。
- [x] 实现节点连线和上游输入收集。
- [x] 画廊/提示词/历史作品一键发送到画布。
- [x] 首页生成结果一键发送到画布。
- [x] 画布生成结果写回 `generations` 并可发布。

### Sprint D：画布增强

- [x] 小地图。
- [x] 撤销/重做。
- [x] 框选、多选、复制粘贴。
- [x] JSON 导入导出。
- [ ] 图片裁剪和角度变换。
- [x] 画布助手。
- [ ] 画布模板和公开画布。
- [ ] 从广场公开线路复制为自己的私有画布。
- [ ] 自动排版创作线路。

## 9. 验收标准

画廊：

- 图片 GET 和 HEAD 都返回正确状态。
- 文件缺失时前台不破版。
- 公开作品详情页可直接打开。
- 详情页点击创作路线条目时，主展示图切换到对应路线图片，并同步 active 样式。
- 图生图详情点击输入图、结果图时，主展示图在原图和结果图之间切换；当前主图对应的复制、图生图、加入画布动作语义正确。
- 画廊卡片标签区域只出现一个类型徽标，用户设置的公开标签必须展示，且与详情页标签一致。
- 文生图开始生成后，工作区不闪屏、不反复重建 composer、不重置滚动位置。
- 文生图结果卡常驻按钮最多 3 个，`更多` 按钮样式统一，次级动作进入更多菜单或紧凑图标区。

排行榜：

- 日榜、周榜、月榜、总榜都可切换。
- 日/周/月榜按周期内新增点赞统计。
- 每个榜单至少可展示 24 条。
- 点击榜单作品进入详情。
- 桌面端榜单以画廊侧栏呈现，移动端以抽屉或折叠侧栏呈现。
- 榜单点赞按钮与画廊点赞按钮视觉一致，使用紧凑 heart icon + 数字。

提示词：

- 提示词库数量不再只依赖用户公开作品。
- 五个远程提示词来源可在后台同步。
- `basketikun/infinite-canvas` 提示词源可同步，且同步结果进入画廊提示词分区、搜索、标签筛选、点赞榜和加入画布流程。
- 提示词有分类、来源、标签、预览。
- 没有封面的提示词也可搜索、展示、打开详情、复制和生图。

画布：

- 首页、导航、图片卡、提示词卡都能进入画布工作台。
- 用户可创建多个画布项目。
- 画廊作品、提示词、历史生成图可插入画布。
- 画布节点可连线，生成配置节点能读取上游输入。
- 画布生成结果保存到历史，并能发布到画廊。
- 公开画布线路可被其他用户复制为私有画布继续创作。
