# ai-image-studio Rellis / Trellis 任务拆分

状态：已同步真实 Trellis 看板目录 `D:\生图广场\.trelis\tasks`（2026-05-20）。
Trellis 分配总表：[`IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md`](IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md)。
来源文档：

- `IMAGE_STUDIO_CANVAS_RANKING_PROMPT_DEVELOPMENT_PLAN.md`
- `IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md`
- `IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md`

## 1. 看板列建议

建议列：

1. `Backlog`：已定义但暂不执行。
2. `Ready`：规格清晰，可以开工。
3. `In Progress`：正在实现。
4. `Review`：代码完成，等待自测、截图或代码审查。
5. `Deploy`：已合并，等待部署和线上验证。
6. `Done`：线上验证通过，并在对应开发文档记录完成。

## 2. 标签建议

- `P0`：影响当前核心可用性或主流程。
- `P1`：提升体验、管理效率或内容质量。
- `P2`：增强能力、模板化、长期扩展。
- `frontend`
- `backend`
- `database`
- `admin`
- `canvas`
- `gallery`
- `prompt`
- `ranking`
- `ops`
- `qa`

## 3. 里程碑建议

### 当前完成状态（2026-05-20）

已完成、提交并通过本轮线上 smoke：

- 画廊可靠性与榜单基础：`AIS-RLS-001` 到 `AIS-RLS-007`。
- 提示词分类、远程来源、无封面详情、点赞与排序：`AIS-RLS-008` 到 `AIS-RLS-013`。
- 大模型提示词重复审核：`AIS-RLS-014`。
- 画布 MVP 主链路：`AIS-RLS-015` 到 `AIS-RLS-025`。
- 画布增强第一批：`AIS-RLS-026` 小地图、`AIS-RLS-027` 撤销重做复制粘贴、`AIS-RLS-028` 框选多选分组、`AIS-RLS-029` JSON 导入导出、`AIS-RLS-030` 画布助手。
- 画布发布与复用：`AIS-RLS-031` 公开画布线路复制、`AIS-RLS-032` 画布模板市场。
- 后台运营主链路：`AIS-RLS-033` 管理员首页重构、`AIS-RLS-034` 用户管理与积分奖励、`AIS-RLS-036` 广场内容审核与撤回管理、`AIS-RLS-037` 公告与弹窗通知完善。
- 标签管理与合并：`AIS-RLS-035`。
- 开发与上线 QA 清单：`AIS-RLS-038`。

尚未完成，保持 Backlog：

- `AIS-RLS-039` 画布模块边界与反单文件治理。
- `AIS-RLS-040` 文生图生成中闪屏修复。
- `AIS-RLS-041` 画廊榜单侧栏化与点赞按钮优化。
- `AIS-RLS-042` 文生图结果按钮收口。
- `AIS-RLS-043` 接入 infinite-canvas 提示词源到画廊。
- `AIS-RLS-044` 画廊详情主图联动修复。
- `AIS-RLS-045` 画廊卡片标签去重与用户标签展示。

本轮部署覆盖提交：

- `fdad024` 画布生成接口。
- `526e67f` 画布自动保存与草稿恢复。
- `b435888` 画布生成结果发布到广场。
- `7de7aeb` 标签合并 JSON 迁移。
- `0698983` QA release checklist。
- `32d5475` 公开开发文档与 Rellis 任务清单更新。
- `78186df` 提示词排序补齐：`sort=hot|new|used|liked`、前台排序切换。

本轮线上检查结果：

- 正式站点首页返回 `200`。
- 旧站点返回 `410`。
- 公开接口 smoke 通过。
- 画布静态脚本返回 `200`。
- 未登录画布 API 返回鉴权错误，未出现 `500`。

### Milestone 1：画廊可靠性与榜单基础

目标：先修当前用户能看见的问题，让广场、榜单、详情页可信。

包含任务：

- `AIS-RLS-001`
- `AIS-RLS-002`
- `AIS-RLS-003`
- `AIS-RLS-004`
- `AIS-RLS-005`
- `AIS-RLS-006`
- `AIS-RLS-007`

### Milestone 2：提示词库与远程提示词数据

目标：解决提示词数量少、标签少、无封面提示词不可用、非用户提示词展示不清晰的问题。

包含任务：

- `AIS-RLS-008`
- `AIS-RLS-009`
- `AIS-RLS-010`
- `AIS-RLS-011`
- `AIS-RLS-012`
- `AIS-RLS-013`
- `AIS-RLS-014`

### Milestone 3：画布工作台 MVP

目标：主页增加画布入口，并完成可保存、可插入、可连线、可生成的基础画布。

包含任务：

- `AIS-RLS-015`
- `AIS-RLS-016`
- `AIS-RLS-017`
- `AIS-RLS-018`
- `AIS-RLS-019`
- `AIS-RLS-020`
- `AIS-RLS-021`
- `AIS-RLS-022`
- `AIS-RLS-023`
- `AIS-RLS-024`
- `AIS-RLS-025`

### Milestone 4：画布增强与广场线路

目标：让画布从“能用”变成“好用”，并能把创作线路发布到广场。

包含任务：

- `AIS-RLS-026`
- `AIS-RLS-027`
- `AIS-RLS-028`
- `AIS-RLS-029`
- `AIS-RLS-030`
- `AIS-RLS-031`
- `AIS-RLS-032`
- `AIS-RLS-039`

### Milestone 5：后台管理与运营能力

目标：让管理员能管用户、管标签、管提示词来源、管广场内容、看关键数据。

包含任务：

- `AIS-RLS-033`
- `AIS-RLS-034`
- `AIS-RLS-035`
- `AIS-RLS-036`
- `AIS-RLS-037`
- `AIS-RLS-038`

### Milestone 6：新增体验回归与外部提示词源

目标：修复用户最新反馈的核心体验问题，并把 `basketikun/infinite-canvas` 的提示词源纳入画廊和画布工作流。

包含任务：

- `AIS-RLS-040`
- `AIS-RLS-041`
- `AIS-RLS-042`
- `AIS-RLS-043`
- `AIS-RLS-044`
- `AIS-RLS-045`

## 4. 任务卡

### AIS-RLS-001：画廊图片前端兜底

优先级：P0
标签：`frontend`, `gallery`, `qa`
依赖：无
建议状态：Ready

目标：

- 所有画廊、排行榜、详情弹窗、线路缩略图图片加载失败时不破版。

交付物：

- 新增统一图片错误兜底函数。
- 给画廊卡、榜单卡、详情图、路线图加固定比例占位。
- 破图时显示“图片暂不可用”，保留提示词和操作按钮。

验收：

- 手动把一条图片 URL 改坏后，卡片不塌陷。
- 控制台没有持续报错循环。
- 移动端和桌面端布局都不出现重叠。

回归记录：

- 2026-05-20 新增 `public/gallery-normalize.js`，将 prompt 数据库图片、生成作品图片和榜单图片统一归一为可渲染的图片模型，避免继续扩大 `public/app.js`。
- 公开生成作品列表和生成作品榜单默认过滤缺失本地文件的记录，管理员仍可用 `includeBroken=1` 巡检异常项。
- 新增 `npm run smoke:gallery-images`，覆盖 prompt 数据库图片可打开、prompt 图片进入点赞排行榜、榜单图片 HEAD 返回 `image/*`。

### AIS-RLS-002：后台图片文件巡检

优先级：P0
标签：`backend`, `database`, `admin`, `gallery`
依赖：`AIS-RLS-001`
建议状态：Ready

目标：

- 管理员能发现数据库公开记录与本地文件不一致的问题。

交付物：

- 新增 `gallery_file_checks` 表。
- 新增 `GET /api/admin/gallery-file-checks?status=broken`。
- 新增 `POST /api/admin/gallery-file-checks/run`。
- 管理员页面展示缺文件、文件大小、检查时间、错误原因。

验收：

- 手动制造缺文件记录后，巡检能识别。
- 默认公开接口不返回确认缺文件的作品。
- 管理员可用 `includeBroken=1` 查看异常项。

### AIS-RLS-003：画廊详情可分享路由

优先级：P0
标签：`frontend`, `backend`, `gallery`
依赖：无
建议状态：Ready

目标：

- 点击画廊图片进入类似 `/gallery/:id` 或 `#/gallery/:id` 的详情页，而不是只能打开一次性弹窗。

交付物：

- 前端路由支持画廊详情。
- 详情打开时自动请求单条作品。
- 复制链接后可直接访问同一作品。

验收：

- 刷新详情链接仍能打开作品。
- 不存在或被隐藏的作品显示友好空状态。
- 详情页保留点赞、复制提示词、文生图、图生图、举报、作者管理。

### AIS-RLS-004：排行榜 SQL 口径修正

优先级：P0
标签：`backend`, `database`, `ranking`, `gallery`
依赖：无
建议状态：Ready

目标：

- 日榜、周榜、月榜按周期内新增点赞统计，不再只按作品发布时间过滤。

交付物：

- 改造榜单查询，日/周/月使用 `generation_likes.created_at`。
- 总榜继续按总点赞排序。
- 支持 `type=text-to-image|image-to-image|all`。

验收：

- 老作品今天新增点赞后能进入日榜。
- 新作品没有点赞时不因发布时间自动压过高赞作品。
- SQL 在 1000+ 作品下响应稳定。

回归记录：

- 2026-05-20 验证 `/api/gallery/leaderboard?range=all` 返回 prompt 数据库图片榜单项，例如 `prompt_262`、`prompt_42`、`prompt_371`。
- `smoke:gallery-images` 会失败退出，如果 prompt 数据库图片未进入榜单，或榜单图片无法通过 HEAD 取得 `image/*`。

### AIS-RLS-005：排行榜前端布局重构

优先级：P0
标签：`frontend`, `ranking`, `gallery`
依赖：`AIS-RLS-004`
建议状态：Ready

目标：

- 榜单展示更丰富，支持日榜、周榜、月榜、总榜、文生图榜、图生图榜。

交付物：

- 新增榜单 Tabs。
- 每榜至少展示 24 条。
- Top 1-3 有更强视觉层级。
- 点击榜单卡进入详情页。

验收：

- 桌面端榜单不卡片挤压。
- 移动端榜单横向 Tabs 可用。
- 榜单切换不闪屏。

### AIS-RLS-006：图生图详情展示输入图

优先级：P0
标签：`frontend`, `gallery`
依赖：`AIS-RLS-003`
建议状态：Ready

目标：

- 图生图作品详情必须显示输入图和输出图对照。

交付物：

- 详情页识别 `sourceImageUrl`。
- 展示“输入图 / 输出图”对比区域。
- 如果作者未公开原图，显示“原图未公开”。

验收：

- 图生图作品详情能看到输入图。
- 未公开原图时不泄露原图 URL。
- 纯文生图不显示空的输入图区域。

### AIS-RLS-007：公开作品作者署名与管理入口

优先级：P0
标签：`frontend`, `backend`, `gallery`
依赖：`AIS-RLS-003`
建议状态：Ready

目标：

- 公开图片右上角显示用户名，作者能管理自己的公开作品。

交付物：

- 卡片和详情页显示作者名。
- 作者本人看到编辑标签、撤回公开、公开原图等入口。
- 其他用户只看到点赞、复制、举报、再生成。

验收：

- 管理按钮只对作者或管理员可见。
- 作者撤回后广场不再展示。
- 12 小时撤回规则有弹窗提示。

### AIS-RLS-008：提示词分类表迁移

优先级：P0
标签：`database`, `prompt`
依赖：无
建议状态：Ready

目标：

- 建立稳定的提示词分类体系，支持即使没有对应提示词也展示分类。

交付物：

- 新增 `prompt_categories` 表。
- 初始化中文分类名称、描述、排序。
- 前端分类筛选不再用英文占位。

验收：

- 分类为空时仍展示分类入口和空状态。
- 分类名全部中文化。
- 管理员可新增、排序、禁用分类。

### AIS-RLS-009：prompts 表字段升级

优先级：P0
标签：`database`, `backend`, `prompt`
依赖：`AIS-RLS-008`
建议状态：Ready

目标：

- 提示词支持来源、分类、预览、语言、模型提示等字段。

交付物：

- 给 `prompts` 表补 `category/visibility/preview/github_url/remote_id/source_repo/source_category/prompt_type/language/model_hint/synced_at`。
- 保留旧字段兼容。
- 后端映射统一输出 `coverUrl`。

验收：

- 老数据不丢失。
- 前端旧提示词仍可搜索和复制。
- 新字段为空时有合理默认值。

### AIS-RLS-010：远程提示词来源表与同步记录

优先级：P0
标签：`database`, `backend`, `prompt`, `admin`
依赖：`AIS-RLS-009`
建议状态：Ready

目标：

- 提示词库不再依赖手工导入，支持多个远程仓库同步。

交付物：

- 新增 `prompt_sources` 表。
- 新增 `prompt_sync_runs` 表。
- 后台可查看同步来源、上次时间、成功/失败数量、错误日志。

验收：

- 关闭某个来源后不再同步。
- 同步失败有错误原因。
- 同步不会重复创建同一远程提示词。

### AIS-RLS-011：接入五个远程提示词仓库

优先级：P0
标签：`backend`, `prompt`
依赖：`AIS-RLS-010`
建议状态：Ready

目标：

- 接入开发文档列出的五个远程提示词源，提升系统提示词数量与类型覆盖。

交付物：

- 每个来源一个 parser。
- 统一去重规则：`source_repo + remote_id`，缺失时用 prompt hash。
- 同步结果写入分类、标签、来源 URL。

验收：

- 同步后提示词数量明显超过当前 371 条。
- 来源、分类、标签能在前台展示。
- 同步重复执行不会大量新增重复数据。

### AIS-RLS-012：提示词无封面卡片与详情页

优先级：P0
标签：`frontend`, `prompt`
依赖：`AIS-RLS-009`
建议状态：Ready

目标：

- 没有图片的提示词也能被搜索、打开、复制、生图。

交付物：

- 无封面提示词卡片占位。
- 移除详情函数里无图直接 return 的逻辑。
- 详情页展示 prompt、来源、分类、标签、复制、文生图。

验收：

- 无封面提示词点击可打开详情。
- 搜索结果里无封面提示词不破版。
- 可直接使用该提示词发起文生图。

### AIS-RLS-013：提示词点赞与热度排序

优先级：P1
标签：`frontend`, `backend`, `database`, `prompt`
依赖：`AIS-RLS-009`
建议状态：Done

目标：

- 提示词支持点赞量、使用量、热度排序。

交付物：

- 新增提示词点赞表或复用现有结构。
- 前端卡片和详情页显示点赞按钮。
- `/api/prompts` 支持 `sort=hot|new|used|liked`。

验收：

- 用户不能重复点赞同一提示词。
- 取消点赞后计数准确。
- 热度排序稳定。

完成记录：

- `prompt_likes` 表使用 `(prompt_id, user_id)` 主键防止重复点赞。
- 点赞和取消点赞后重新统计 `prompts.like_count`。
- 使用提示词时通过 `/api/prompts/:id/use` 累加 `prompts.use_count`。
- `/api/prompts` 支持 `sort=hot|new|used|liked`。
- 前台提示词库新增热门、最新、常用、最赞排序切换。

### AIS-RLS-014：大模型提示词重复审核接口

优先级：P1
标签：`backend`, `admin`, `prompt`
依赖：`AIS-RLS-010`
建议状态：Done

目标：

- 导入或用户提交提示词时，使用规则和大模型辅助判断语义重复。

交付物：

- 已新增 prompt review service，封装规则兜底、Responses 模型调用、JSON 解析、不可用降级和 mock smoke。
- 创建提示词、远程来源同步、导入脚本 apply 后先生成本地 hash/simhash 候选，再对待复核候选调用模型或 mock 复核。
- 后台重复候选表展示 AI decision、confidence、reason，并支持单条 AI 复核。

验收：

- 明显相同提示词会生成重复候选，mock/模型建议 `duplicate`，后台可确认重复、保留、隐藏或合并。
- 不确定项写入 `needs_review` / `variant` / `unavailable`，保持 pending 进入人工审核，不自动删除。
- AI 复核结果写入 `prompt_duplicate_candidates` 的 `ai_*` 字段，人工动作继续写 admin audit log，可追溯。

### AIS-RLS-015：主页和导航新增画布入口

优先级：P0
标签：`frontend`, `canvas`
依赖：无
建议状态：Ready

目标：

- 用户在首页能直接看到并进入画布工作台。

交付物：

- 顶部导航新增 `画布工作台` 按钮。
- 首页首屏输入框下方新增 `打开画布工作台`。
- 未登录点击时弹登录框，登录后继续进入。

验收：

- 桌面端按钮不挤压现有导航。
- 移动端按钮进入合适菜单或换行，不溢出。
- 点击后进入最近画布或自动创建新画布。

### AIS-RLS-016：画布路由和视图骨架

优先级：P0
标签：`frontend`, `canvas`
依赖：`AIS-RLS-015`
建议状态：Ready

目标：

- 建立 `canvas-list` 和 `canvas-workspace` 两个前端视图。

交付物：

- Hash 路由支持 `#/canvas`、`#/canvas/:id`、`#/canvas/new`。
- 画布列表空状态。
- 画布工作台三栏布局骨架。

验收：

- 刷新页面后仍能进入指定画布路由。
- 无画布时显示新建入口。
- 画布视图和首页、提示词库、图片编辑器互不污染状态。

### AIS-RLS-017：canvas_projects 数据表与基础 API

优先级：P0
标签：`backend`, `database`, `canvas`
依赖：无
建议状态：Ready

目标：

- 后端支持创建、读取、更新、删除画布项目。

交付物：

- 新增 `canvas_projects` 表。
- 新增 `GET/POST/PATCH/DELETE /api/canvases`。
- 支持标题、描述、封面、可见性、data_json、节点数、连线数。

验收：

- 用户只能访问自己的私有画布。
- 管理员可查看公开画布。
- 删除画布不会误删生成图片文件。

### AIS-RLS-018：画布前端文件拆分

优先级：P0
标签：`frontend`, `canvas`
依赖：`AIS-RLS-016`
建议状态：Ready

目标：

- 避免继续把画布代码堆进 `public/app.js`。

交付物：

- 新增 `public/canvas.js`。
- 新增 `public/canvas-store.js`。
- 新增 `public/canvas-nodes.js`。
- 新增 `public/canvas-geometry.js`。
- 新增 `public/canvas-workflows.js`。

验收：

- 首页原有功能不受影响。
- 新文件加载顺序明确。
- 没有全局变量命名冲突。

### AIS-RLS-019：画布基础交互

优先级：P0
标签：`frontend`, `canvas`
依赖：`AIS-RLS-016`, `AIS-RLS-018`
建议状态：Ready

目标：

- 实现无限画布的基本手感。

交付物：

- 平移。
- 滚轮缩放。
- 适配全部。
- 节点拖拽。
- 单选节点。
- 背景模式：点阵、网格、空白。

验收：

- 大画布拖动不卡顿。
- 缩放时节点位置不漂移。
- 移动端至少可查看和平移缩放。

### AIS-RLS-020：画布节点系统 MVP

优先级：P0
标签：`frontend`, `canvas`
依赖：`AIS-RLS-019`
建议状态：Ready

目标：

- 支持图片、文本、提示词、生成配置、输出节点。

交付物：

- 节点渲染模板。
- 节点配置面板。
- 节点删除、复制、锁定。
- 输出节点展示生成状态。

验收：

- 节点可拖拽、选中、编辑。
- 配置节点能保存模型、尺寸、质量、候选数。
- 输出节点能显示 loading/success/error。

### AIS-RLS-021：画布连线与上游输入收集

优先级：P0
标签：`frontend`, `canvas`
依赖：`AIS-RLS-020`
建议状态：Ready

目标：

- 生成配置节点能读取上游提示词和图片节点。

交付物：

- 连线创建与删除。
- 上游遍历函数。
- 线路高亮。
- 输入冲突提示。

验收：

- prompt 节点连到配置节点后能参与文生图。
- 图片节点连到配置节点后能参与图生图。
- 循环连线被阻止。

### AIS-RLS-022：从首页/画廊/提示词/作品加入画布

优先级：P0
标签：`frontend`, `backend`, `canvas`, `gallery`, `prompt`
依赖：`AIS-RLS-017`, `AIS-RLS-020`
建议状态：Ready

目标：

- 当前所有主要内容都能一键沉淀到画布。

交付物：

- 生图结果卡增加 `加入画布`。
- 画廊详情增加 `加入画布` 和 `用此图新建画布`。
- 提示词详情增加 `加入画布`。
- 我的作品详情增加 `加入画布`。
- 新增目标画布选择器。

验收：

- 插入图片时保留 generation id、prompt、source image。
- 插入提示词时保留 prompt id、来源、标签。
- 新建画布后自动跳转并选中新插入节点。

### AIS-RLS-023：画布生成接口

优先级：P0
标签：`backend`, `canvas`, `gallery`
依赖：`AIS-RLS-017`, `AIS-RLS-021`
建议状态：Ready

目标：

- 在画布中运行文生图和图生图。

交付物：

- 新增 `POST /api/canvases/:id/generate`。
- 复用现有 `/api/images/generate` 和 `/api/images/edit` 逻辑。
- 写入 `generations`。
- 写入 `canvas_generation_links`。

验收：

- 文生图节点线路可生成图片。
- 图生图节点线路可生成图片。
- 失败时返回明确错误，输出节点显示失败原因。

### AIS-RLS-024：画布自动保存与草稿恢复

优先级：P0
标签：`frontend`, `backend`, `canvas`
依赖：`AIS-RLS-017`, `AIS-RLS-019`
建议状态：Ready

目标：

- 避免画布操作丢失。

交付物：

- 800ms 防抖保存。
- `已保存/保存中/未保存/同步失败` 状态。
- 本地草稿恢复提示。
- 离开页面前的未保存确认。

验收：

- 移动节点后自动保存。
- 断网时保留本地草稿。
- 恢复草稿不会覆盖服务器新版本，需用户确认。

### AIS-RLS-025：画布生成结果发布到广场

优先级：P0
标签：`frontend`, `backend`, `canvas`, `gallery`
依赖：`AIS-RLS-023`, `AIS-RLS-006`, `AIS-RLS-007`
建议状态：Ready

目标：

- 画布输出节点可发布为广场作品，并保留线路摘要。

交付物：

- 选择输出节点作为封面。
- 收集上游 prompt/text/config 节点作为线路。
- 图生图发布时处理输入原图公开选项。
- 广场卡显示 `画布线路` 徽标。

验收：

- 发布后广场可见。
- 详情页可展开线路。
- 作者可管理标签和撤回。

### AIS-RLS-026：小地图

优先级：P1
标签：`frontend`, `canvas`
依赖：`AIS-RLS-019`
建议状态：Done

目标：

- 大画布中快速定位内容。

交付物：

- 已新增右下角小地图，独立在 `public/canvas-minimap.js` 中渲染节点、边和视口框。
- 当前视口框会随画布平移、缩放和节点移动更新。
- 点击/拖拽小地图会把画布视口中心跳转到对应内容位置。

验收：

- 小地图按节点边界自适应缩放，节点数量增加时仍只渲染轻量缩略矩形和线段。
- 小地图固定右下角并在移动端缩小，不遮挡左侧节点面板、顶部工具条和右侧检查器。

### AIS-RLS-027：撤销、重做、复制粘贴

优先级：P1
标签：`frontend`, `canvas`
依赖：`AIS-RLS-020`, `AIS-RLS-021`
建议状态：Done

目标：

- 提升画布编辑效率。

交付物：

- 已新增 `public/canvas-history.js`，独立管理 undo/redo 栈和节点剪贴板。
- 已接入 Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl/Cmd+Y、Ctrl/Cmd+C/V。
- 工具栏新增撤销、重做、复制、粘贴按钮。
- 复制节点时生成新 id，并以固定偏移粘贴，避免覆盖原节点。

验收：

- 移动、编辑、连线、删除都能撤销。
- 粘贴节点不覆盖原节点。

完成记录：

- `public/canvas.js` 在节点移动、字段编辑、连线创建/删除、节点删除/复制、粘贴、背景切换和视口操作前记录快照。
- `npm run smoke:canvas-history` 覆盖 undo、redo、copy、paste、新 id 和粘贴偏移。
- 线上版本 `20260520-canvas-history-v1` 已通过 public smoke 和 canvas history smoke。

### AIS-RLS-028：框选、多选、分组

优先级：P1
标签：`frontend`, `canvas`
依赖：`AIS-RLS-020`
建议状态：Done

目标：

- 支持复杂画布整理。

交付物：

- 框选。
- Shift 多选。
- group 节点。
- 批量移动和删除。

验收：

- 多选移动不打乱节点间相对位置。
- 分组可折叠或显示组标题。

完成记录：

- `public/canvas-selection.js` 独立承载框选矩形、选择归一化、批量移动、批量删除和 group 节点生成逻辑，避免把所有选择代码继续堆进 `public/canvas.js`。
- `public/canvas.js` 接入 Shift 点击多选、Shift 空白拖拽框选、工具栏分组/删除按钮、Delete/Backspace 批量删除、Ctrl/Cmd+G 分组和多选复制粘贴状态。
- `public/canvas-nodes.js` 新增 `group` 节点类型和节点尺寸 helper；`public/canvas-minimap.js` 读取多选状态和 group 实际尺寸。
- `npm run smoke:canvas-selection` 覆盖框选、toggle 多选、批量移动相对位置、批量删除连线清理和 group 标题/成员记录。
- 线上版本 `20260520-canvas-selection-v1` 已通过 public smoke、canvas selection smoke、canvas history smoke 和容器内 canvas 脚本语法检查。

### AIS-RLS-029：JSON 导入导出

优先级：P1
标签：`frontend`, `backend`, `canvas`
依赖：`AIS-RLS-017`, `AIS-RLS-020`
建议状态：Done

目标：

- 支持画布备份、迁移和调试。

交付物：

- `GET /api/canvases/:id/export`。
- `POST /api/canvases/:id/import`。
- 前端导入导出按钮。
- JSON schema 校验。

验收：

- 导出的画布可重新导入。
- 非法 JSON 有明确错误。
- 图片使用 file id/url 引用，不把大文件塞入 JSON。

完成记录：

- `src/canvas-import-export.js` 独立承载导出包生成、导入归一化和 schema 校验，避免把 JSON IO 规则塞进 `server.js`。
- 新增 `GET /api/canvases/:id/export` 和 `POST /api/canvases/:id/import`，分别使用画布读取权限和管理权限，导入后更新现有画布数据与节点/连线计数。
- `public/canvas-io.js` 独立承载前端 JSON 文件选择、解析、上传和下载；`public/canvas.js` 只负责工具栏接线、保存当前画布和应用导入结果。
- 导入校验覆盖包格式、节点/连线结构、连线引用节点存在性，并拒绝 `data:`/`blob:` 图片和过大的嵌入式图片字符串。
- `npm run smoke:canvas-import-export` 覆盖导出包、导入归一化、非法 JSON 错误和嵌入式图片拒绝；`npm run smoke:canvas-import-export-api` 覆盖生产容器中的认证导入导出 API。
- 线上版本 `20260520-canvas-json-io-v1` 已通过 public smoke、canvas import/export 模块 smoke、canvas import/export API smoke、canvas selection/history 回归 smoke 和容器内脚本语法检查。

### AIS-RLS-030：画布助手

优先级：P2
标签：`frontend`, `backend`, `canvas`
依赖：`AIS-RLS-021`, `AIS-RLS-023`
建议状态：Done

目标：

- 助手能读取选中节点和上游节点，辅助改写提示词、整理线路、生成变体。

交付物：

- 右栏助手面板。
- 上下文收集器。
- 提示词改写、风格建议、生成计划。

验收：

- 只读取当前用户有权限的节点内容。
- 输出建议可一键变成 text/prompt 节点。

完成记录：

- `src/canvas-assistant.js` 独立承载画布上下文收集、上游节点裁剪、敏感 `data:`/`blob:` 图片引用省略和三类建议生成，避免把助手规则塞进 `server.js`。
- 新增 `POST /api/canvases/:id/assistant`，先做登录和画布读取权限校验，再基于服务端保存的 `dataJson` 返回改写提示词、风格建议和生成计划。
- `public/canvas-assistant.js` 独立承载右栏助手控制器、请求体构造和建议转节点逻辑；`public/canvas.js` 只负责保存当前画布、提供选择上下文和插入节点。
- 前端刷新助手前会保存当前画布，保存失败时停止请求，避免助手读取旧的服务端上下文。
- 新增 `npm run smoke:canvas-assistant` 覆盖模块上下文、建议生成、图片数据省略和浏览器侧插入 payload；`npm run smoke:canvas-assistant-api` 覆盖认证 API、权限、上游节点、建议类型和非法 JSON。
- 线上版本 `20260520-canvas-assistant-v1` 已通过 public smoke、canvas assistant 模块 smoke、canvas assistant API smoke、canvas selection/history 回归 smoke 和容器内脚本语法检查。
- `AIS-RLS-031` 及后续 backlog 任务按当前指令未启动，等待后续明确恢复。

### AIS-RLS-031：公开画布线路复制

优先级：P1
标签：`frontend`, `backend`, `canvas`, `gallery`
依赖：`AIS-RLS-025`
建议状态：Done

目标：

- 用户能把公开作品线路复制为自己的私有画布继续创作。

交付物：

- `POST /api/canvases/:id/duplicate`。
- 广场详情按钮 `用此线路新建画布`。
- 复制时重写 user_id 和权限。

验收：

- 复制后的画布归当前用户所有。
- 原作者私有信息不泄露。
- 原图未公开时不复制原图文件。

### AIS-RLS-032：画布模板市场

优先级：P2
标签：`frontend`, `backend`, `canvas`
依赖：`AIS-RLS-031`
建议状态：Done

目标：

- 把高质量画布线路沉淀成可复用模板。

交付物：

- 画布 `is_template` 字段流程。
- 模板列表页。
- 一键从模板创建画布。

验收：

- 模板不会误暴露私有画布。
- 从模板创建后用户可独立编辑。

### AIS-RLS-039：画布模块边界与反单文件治理

优先级：P1
标签：`frontend`, `backend`, `canvas`, `qa`
依赖：`AIS-RLS-026`, `AIS-RLS-027`, `AIS-RLS-028`, `AIS-RLS-029`, `AIS-RLS-030`
建议状态：Backlog

目标：

- 在继续做公开线路复制、模板市场、素材库和裁剪变换前，先把画布代码边界固定下来，避免把所有画布代码重新堆到 `public/canvas.js` 或 `server.js`。

交付物：

- 从 `public/canvas.js` 拆出 `public/canvas-render.js`、`public/canvas-inspector.js`、`public/canvas-keyboard.js`、`public/canvas-toolbar.js` 中至少两个模块。
- 新增或更新 public smoke，验证新增脚本在 `index.html` 中被引用、可访问、并注册到 `window.ImageStudioCanvas`。
- 服务端新增 `src/canvas-service.js` 或等价模块，把后续公开线路复制/模板市场/发布规则的复杂逻辑从 `server.js` 中抽离。
- 更新 `docs/IMAGE_STUDIO_CANVAS_RANKING_PROMPT_DEVELOPMENT_PLAN.md` 的职责边界表和 QA 清单。

验收：

- `public/app.js` 不新增画布实现代码，只保留入口、payload 和路由薄接线。
- `public/canvas.js` 只做状态和调度，新增功能不在该文件中一次性堆超过约 100 行。
- `server.js` 中新增画布路由只做鉴权、读 body、调用 service、返回 JSON。
- `node --check` 覆盖所有新增模块，相关 canvas smoke 通过。

### AIS-RLS-040：文生图生成中闪屏修复

优先级：P0
标签：`frontend`, `qa`
依赖：无
建议状态：Backlog

目标：

- 修复文生图开始生成后工作区一闪一闪的问题，让生成状态、历史列表和 composer 保持稳定。

交付物：

- 排查生成开始、轮询、历史刷新、路由切换、composer 渲染和滚动重置之间的重复触发。
- 生成中只更新状态条、计时器和当前输出占位卡，不重复重建整个 `chatView`。
- 给 `setView()`、`renderComposers()`、`renderHistory()` 或相关状态更新增加幂等保护。
- 新增 smoke 或轻量浏览器检查，覆盖点击生成后不会反复切换 view class、不会重建 composer mount。

验收：

- 点击文生图生成后 10 秒内页面不闪动、不跳回首页、不重置滚动。
- 生成中状态条、耗时和取消/失败提示仍正常更新。
- 控制台没有因为重复渲染导致的事件绑定或 DOM 空引用错误。

### AIS-RLS-041：画廊榜单侧栏化与点赞按钮优化

优先级：P1
标签：`frontend`, `gallery`, `ranking`
依赖：`AIS-RLS-004`, `AIS-RLS-005`
建议状态：Backlog

目标：

- 把榜单从普通内容块升级为画廊侧栏/抽屉，并统一榜单图片点赞按钮的视觉。

交付物：

- 桌面端画廊布局增加榜单侧栏，主区域继续展示图片流。
- 移动端榜单使用底部抽屉、折叠侧栏或顶部 tabs，不挤压图片卡。
- 榜单支持日榜、周榜、月榜、总榜、文生图、图生图切换。
- 榜单项使用紧凑结构：排名、缩略图、标题/作者、heart icon + 点赞数。
- 榜单点赞按钮复用画廊点赞状态，不出现大胶囊或浏览器默认按钮边框。

验收：

- 桌面端榜单像画廊导航侧栏，不再像堆在页面里的普通卡片区。
- 移动端榜单不会造成横向溢出或遮挡主图片。
- 在榜单内点赞/取消点赞后，榜单项、画廊卡和详情弹窗状态同步。

### AIS-RLS-042：文生图结果按钮收口

优先级：P0
标签：`frontend`, `gallery`, `canvas`
依赖：`AIS-RLS-015`, `AIS-RLS-022`
建议状态：Backlog

目标：

- 收口文生图结果卡的操作按钮，避免 `再次生成 / 保存 / 加入画布 / 改提示词 / 更多` 同时平铺造成拥挤。

交付物：

- 结果卡常驻最多 3 个操作，建议为 `再次生成`、`下载/保存`、`更多`。
- `加入画布`、`改提示词`、`图生图`、`复制提示词` 收进更多菜单或 icon-only 次级操作区。
- `更多` 使用项目统一按钮样式和 icon，不显示原生浏览器黑色描边。
- 桌面和移动端按钮尺寸、间距、换行规则统一。

验收：

- 截图中的按钮拥挤问题消失，结果卡操作区不超过一行或有明确折叠。
- `加入画布` 和 `改提示词` 功能仍可达，但不抢占主操作。
- 移动端不出现按钮文字溢出、重叠或默认控件边框。

### AIS-RLS-043：接入 infinite-canvas 提示词源到画廊

优先级：P1
标签：`backend`, `database`, `admin`, `prompt`, `gallery`, `canvas`
依赖：`AIS-RLS-010`, `AIS-RLS-011`, `AIS-RLS-014`
建议状态：Backlog

目标：

- 把 `https://github.com/basketikun/infinite-canvas` 的提示词库作为远程提示词源接入本项目，让其提示词进入画廊、搜索、标签、榜单和加入画布流程。

交付物：

- 在 `PROMPT_SOURCE_SEED` 或后台默认来源中新增 `basketikun/infinite-canvas`。
- 评估现有 `github-generic` parser 是否能稳定提取；如果不够，新增 `infinite-canvas` 专用 parser。
- 同步时保留 `sourceRepo = basketikun/infinite-canvas`、`remoteId`、`githubUrl`、`sourceCategory`、封面/示例图和标签。
- 同步后执行 hash/simhash 去重和 AI 重复审核，不自动覆盖已有优质提示词。
- 画廊提示词分区、提示词搜索、标签筛选、提示词榜单、提示词详情和 `加入画布` 能展示这些新来源。
- 后台提示词来源页显示同步结果、成功/失败数量、错误日志和最近更新时间。

验收：

- 后台可看到 `basketikun/infinite-canvas` 来源，并能手动触发同步。
- 同步后 `/api/prompts?includeHidden=1` 中可看到 `sourceRepo = basketikun/infinite-canvas` 的提示词。
- 画廊前台可搜索、打开详情、点赞、复制、使用和加入画布。
- 重复提示词进入候选审核，不造成画廊大面积重复卡片。

### AIS-RLS-044：画廊详情主图联动修复

优先级：P0
标签：`frontend`, `gallery`, `canvas`, `qa`
依赖：`AIS-RLS-003`, `AIS-RLS-006`, `AIS-RLS-025`
建议状态：Backlog

目标：

- 修复画廊详情中点击创作路线、输入图、结果图后左侧主展示图不变化的问题。

交付物：

- 新增或收口详情页的 `selectedMedia` 状态，统一表示 `result`、`source`、`route-step` 三类媒体。
- 点击创作路线条目时更新主图、active 样式、当前标题/提示词和后续操作上下文。
- 图生图详情的 `输入图` / `结果图` 缩略卡改为可点击按钮，点击后主图在原图和结果图之间切换。
- `复制提示词`、`图生图`、`加入画布` 等动作读取当前 `selectedMedia`，避免用户看着输入图却把结果图加入画布。
- 补充桌面和移动端手动验收记录，确认切换不重开详情、不重置滚动位置。

验收：

- 打开多轮作品详情后，点击不同创作路线条目，左侧大图与右侧 active 项同步变化。
- 打开图生图作品详情后，点击 `输入图` 显示原图，点击 `结果图` 显示结果图。
- 切换主图后点赞状态、作者信息、标签和关闭按钮不闪烁、不丢失。

### AIS-RLS-045：画廊卡片标签去重与用户标签展示

优先级：P0
标签：`frontend`, `gallery`, `prompt`, `qa`
依赖：`AIS-RLS-007`, `AIS-RLS-024`, `AIS-RLS-035`
建议状态：Backlog

目标：

- 修复画廊卡片未打开详情时重复显示 `图生图` / `文生图`，且不显示用户设置标签的问题。

交付物：

- 建立统一 gallery tag view model：`kindBadge`、`adminBadge`、`publicTags` 分离。
- `文生图` / `图生图` 只作为类型徽标显示一次；从 `publicTags` 中过滤类型别名和重复项。
- 卡片标签区域优先展示用户设置的公开标签，并与详情页标签来源保持一致。
- Admin 徽标保持独立，不混入用户标签，也不占用 `publicTags` 展示数量。
- 为旧数据补兼容：如果历史记录把类型词写进 `public_tags_json`，前端渲染先过滤，后续可由数据迁移清理。

验收：

- 画廊卡片不会同时出现两个 `图生图` 或两个 `文生图`。
- 用户设置的标签在卡片上可见，且打开详情后标签一致。
- 没有用户标签的作品最多只显示一个类型徽标，不用类型词冒充用户标签。

### AIS-RLS-033：管理员首页重构

优先级：P1
标签：`frontend`, `admin`
依赖：无
建议状态：Done

目标：

- 管理员首页从简单入口变成运营控制台。

交付物：

- 关键指标卡：用户、生成量、公开作品、举报、提示词同步、文件异常。
- 快捷入口：用户管理、广场审核、标签管理、提示词来源、系统设置。
- 最近异常列表。

验收：

- 首屏能看出系统是否健康。
- 管理入口不拥挤，移动端可用。

### AIS-RLS-034：用户管理与积分奖励

优先级：P1
标签：`backend`, `database`, `admin`
依赖：无
建议状态：Done

目标：

- 支持用户管理，以及首次公开图片奖励积分。

交付物：

- 用户列表筛选、封禁、角色修改、积分调整。
- 首次公开奖励逻辑。
- 奖励弹窗通知。

验收：

- 同一用户首次公开只奖励一次。
- 管理员手动调整积分有记录。
- 被封禁用户不能继续公开作品。

### AIS-RLS-035：标签管理与合并

优先级：P0
标签：`backend`, `database`, `admin`, `prompt`, `gallery`
依赖：`AIS-RLS-008`
建议状态：Done

目标：

- 标签数量足够，中文展示稳定，支持合并和空标签展示。

交付物：

- 标签种子数据完善。
- 标签中文名、别名、排序、颜色。
- 标签合并 JSON 迁移。
- 管理员合并标签页面。

验收：

- 前端不再用英文标签填充。
- 没有对应提示词的标签也能展示。
- 合并后旧标签下作品和提示词归到新标签。

### AIS-RLS-036：广场内容审核与撤回管理

优先级：P1
标签：`backend`, `admin`, `gallery`
依赖：`AIS-RLS-007`
建议状态：Done

目标：

- 管理员能处理公开作品举报、隐藏、恢复和作者撤回请求。

交付物：

- 举报列表。
- 审核状态流转。
- 作者 12 小时内撤回提示。
- 超过 12 小时后的申请撤回流程。

验收：

- 被隐藏作品前台不可见。
- 举报处理有记录。
- 作者和举报人收到合适通知。

### AIS-RLS-037：公告与弹窗通知完善

优先级：P1
标签：`frontend`, `backend`, `admin`
依赖：`AIS-RLS-034`, `AIS-RLS-036`
建议状态：Done

目标：

- 重要动作用弹窗或通知明确反馈。

交付物：

- 首次公开奖励通知。
- 公开原图风险提示。
- 12 小时撤回规则提示。
- 审核结果通知。

验收：

- 通知可关闭、可标记已读。
- 同一通知不重复打扰。

### AIS-RLS-038：开发与上线 QA 清单

优先级：P0
标签：`qa`, `ops`
依赖：所有 P0 实现任务
建议状态：Ready

目标：

- 每轮功能上线前有固定检查步骤。

交付物：

- 本地 smoke 脚本清单。
- 线上 smoke 脚本清单。
- 核心页面截图检查项。
- 回滚步骤。
- 文档完成记录要求。

验收：

- 每个 P0 任务完成后，开发文档中对应条目被勾选或记录。
- 线上接口 smoke 通过。
- 出现问题时可快速回滚到上一备份。

## 5. 建议执行顺序

第一批：

1. `AIS-RLS-040`
2. `AIS-RLS-042`
3. `AIS-RLS-044`
4. `AIS-RLS-045`
5. `AIS-RLS-001`
6. `AIS-RLS-003`
7. `AIS-RLS-004`
8. `AIS-RLS-005`
9. `AIS-RLS-008`
10. `AIS-RLS-009`
11. `AIS-RLS-012`

第二批：

1. `AIS-RLS-010`
2. `AIS-RLS-011`
3. `AIS-RLS-015`
4. `AIS-RLS-016`
5. `AIS-RLS-017`
6. `AIS-RLS-018`

第三批：

1. `AIS-RLS-019`
2. `AIS-RLS-020`
3. `AIS-RLS-021`
4. `AIS-RLS-022`
5. `AIS-RLS-023`
6. `AIS-RLS-024`
7. `AIS-RLS-025`

持续并行：

- `AIS-RLS-035`
- `AIS-RLS-038`
- `AIS-RLS-039`
- `AIS-RLS-041`
- `AIS-RLS-043`

## 6. 每张 Rellis / Trellis 卡片建议模板

复制到 Rellis / Trellis 时可使用：

```text
标题：
[任务编号] 任务名

描述：
目标：

交付物：

验收：

依赖：

相关文档：
docs/IMAGE_STUDIO_CANVAS_RANKING_PROMPT_DEVELOPMENT_PLAN.md

标签：
P0 / frontend / backend / database / ...
```
