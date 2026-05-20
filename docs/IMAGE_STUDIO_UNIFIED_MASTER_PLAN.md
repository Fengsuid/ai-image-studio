# Image2Creat 统一设计与实施总路线

日期：2026-05-18
状态：合并版总文档，后续实施优先参考本文件。
范围：把 ProductFlow 对标、Exec4 设计、外部优化调研、前端/管理员后台设计合并为一份路线图；原文档保留为历史来源和详细附录。

## 0. 来源文档

本文件合并以下文档：

- [`IMAGE_STUDIO_PRODUCTFLOW_GAP_ANALYSIS.md`](IMAGE_STUDIO_PRODUCTFLOW_GAP_ANALYSIS.md)：ProductFlow / draw.devbin 对标、广场、会话、图生图、标签、任务状态、测试缺口。
- [`IMAGE_STUDIO_EXEC4_DESIGN.md`](IMAGE_STUDIO_EXEC4_DESIGN.md)：续图、路线展示、图生图原图弹窗、编辑器计时/取消/最近输出、标签库；核心 P0-P3 已落地，但有遗留项。
- [`IMAGE_STUDIO_EXTERNAL_OPTIMIZATION_RESEARCH.md`](IMAGE_STUDIO_EXTERNAL_OPTIMIZATION_RESEARCH.md)：安全响应头、CSRF、上传防护、响应式图片、RUM、可访问性、C2PA、Passkey、SEO。
- [`IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md`](IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md)：前台展示、管理员后台、首发公开奖励、12 小时撤回、提示词点赞、提示词重复治理和大模型审核。
- [`IMAGE_STUDIO_ADMIN_HOME_REDESIGN_PLAN.md`](IMAGE_STUDIO_ADMIN_HOME_REDESIGN_PLAN.md)：后台视觉重构、后台创建用户、多 API Provider 配置、首页 composer、图生图编辑器、我的作品资产库、批量下载、画廊命名、发布标签规则、默认公开/举报后审核、AI 提示词审计、图片点赞排行榜、联系邮箱、通知公告和返回闪屏修复。

## 0.1 当前新增最高优先级：后台与首页体验重构

2026-05-18 新增反馈：当前后台管理界面观感和能力不足，尤其是后台不能创建用户，API 地址只能配置一个，首页“延续前图”另起一行，首页 `Auto · Auto · PNG` 参数区按钮分两行太丑，“对话列表”位置突兀；联系管理员应去掉原二维码图片，直接显示后台可配置邮箱，默认 `support@example.com`；首页需要新增“通知”，后台可发布通知，用户登录后弹窗查看未读重要通知；图生图页面 `公开到画廊` / `公布原图` 位置挡住生成按钮且背景过黑；我的作品需要完整图片详情和批量下载；“提示词库”应升级为“画廊”，公开图必须自动带 `文生图` / `图生图` 标签，标签按图片数量排序，用户不能直接创建标签，作品发布后应默认立即公开，只有被举报后才下架进入管理员审核，审核没问题后重新出现在画廊；高重复 prompt 需 AI 审计拦截并转为基于已有画廊原图的图生图/变体发布，画廊需要图片点赞排行榜，返回闪 chat 属于导航 bug。

下一批实施应优先参考 [`IMAGE_STUDIO_ADMIN_HOME_REDESIGN_PLAN.md`](IMAGE_STUDIO_ADMIN_HOME_REDESIGN_PLAN.md)，并拆为：

- T016 Admin IA + Visual Shell
- T017 Admin User Creation
- T018 Multi Provider Config
- T019 Provider Router
- T020 Admin Resource Pages Polish
- T021 Home Composer Redesign
- T029 Contact Admin Email Setting
- T030 Announcements + Login Modal
- T028 Image Editor Publish Controls + Background
- T022 My Works Asset Library
- T023 Gallery Rename + Navigation State
- T024 Gallery Publish Tag Rules
- T025 Prompt Audit Gate
- T026 Gallery Derivative Publish Flow
- T027 Gallery Likes + Leaderboard

## 0.2 2026-05-20 新增用户反馈：文生图闪动、榜单、画廊详情与标签

本轮新增反馈来自实际界面使用和截图，作为下一批 P0/P1 修复入口：

1. **文生图开始生成后界面一闪一闪**
   现象：用户发起文生图后，创作界面出现明显闪动，疑似生成状态、历史列表、composer、路由 class 或滚动状态被反复重渲染/切换。
   处理方向：生成开始后必须保持当前视图、composer 和历史列表 DOM 稳定；只更新生成状态条、计时器和当前占位卡，不反复 `setView()`、重建 composer 或清空/重排历史列表。

2. **画廊榜单排布和样式仍需优化**
   现象：榜单当前像普通内容块，缺少稳定的信息架构；榜单图片里的点赞按钮视觉突兀。
   处理方向：榜单改为画廊侧栏式信息架构，主画廊保留图片流，右侧或抽屉展示日榜/周榜/月榜/总榜；榜单卡片点赞按钮改成统一 icon-only 或紧凑 icon+数字样式，不再使用显眼的大胶囊按钮。

3. **文生图结果卡按钮多余**
   现象：截图中 `再次生成 / 保存 / 加入画布 / 改提示词 / 更多` 同时出现，操作密度过高，`更多` 按钮还出现原生边框感。
   处理方向：结果卡常驻动作最多 3 个；建议保留 `再次生成`、`下载/保存`、`更多`，把 `加入画布`、`改提示词`、`图生图`、`复制提示词` 收进更多菜单或图标区。`更多` 必须使用统一按钮样式，不能出现浏览器默认描边。

4. **把 `infinite-canvas` 提示词数据库加入本项目画廊**
   现状：本项目已有 `prompt_sources`、同步记录、后台同步入口和通用 GitHub parser，但没有把 `basketikun/infinite-canvas` 作为默认提示词源，也没有专门解析它的提示词库结构。
   处理方向：新增 `basketikun/infinite-canvas` prompt source，解析其提示词库、分组、封面/结果图、来源仓库信息，写入本项目 `prompts`，并在画廊提示词分区、搜索、标签筛选、榜单和 `加入画布` 流程中展示。

5. **画廊详情主图联动失效**
   现象：详情页右侧点击 `创作路线` 条目后，左侧大图不再跟随切换；图生图作品点击 `输入图` / `结果图` 也应该切换主展示图。
   处理方向：详情弹窗/详情页必须有唯一的 `selectedMedia` 状态，统一承载 `source`、`result`、`route-step` 三类媒体；点击路线、输入图、结果图只更新这个状态和 active 样式，不重新打开详情、不覆盖作品数据。

6. **画廊卡片标签展示错误**
   现象：未打开详情时，卡片上出现两个 `图生图` / `文生图`，没有展示用户设置的标签。
   处理方向：卡片标签要拆分为“类型徽标”和“用户/管理员标签”。`文生图` / `图生图` 只允许作为类型徽标出现一次；`publicTags` 中如果混入类型词要去重过滤；卡片应优先展示用户设置的公开标签，Admin 徽标继续独立展示。

## 1. 当前最高优先级：P0.0 按钮与 Composer 布局修复

用户反馈截图中，底部 composer 和操作按钮的视觉问题很明显：按钮分散、主次不清、续图开关过重、公开开关孤立、生成按钮和输入框关系松散，整体不像一个成熟工作台。

这项排在所有后续功能之前。原因：

- 它是用户每次生成都会看到的核心交互面。
- 当前布局会让用户误解“续图、上传、公开、生成”之间的关系。
- 后续加首发奖励、撤回、提示词点赞、队列状态时，如果底层布局不先收口，会继续变乱。

### 1.1 目标

- 一眼看清主操作：输入 prompt → 生成。
- 次操作收进稳定区域：上传参考、续图、公开、参数。
- 所有按钮按 8px grid 对齐，尺寸稳定，不因文案长度挤压输入区。
- 生成中、禁用、续图、公开这些状态不再用散乱按钮表达，而用统一状态条表达。

### 1.2 新 Composer 结构

桌面端建议三层：

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶部设置行                                                     │
│ [GPT-IMAGE-2] [尺寸/质量/格式 ▾]          [公开到广场  ○]      │
├──────────────────────────────────────────────────────────────┤
│ 上下文条（仅有上下文时出现）                                   │
│ [续图] 基于上一张图继续  [缩略图]                    [关闭 ✕]  │
├──────────────────────────────────────────────────────────────┤
│ 输入行动行                                                     │
│ [+]  描述你想创作的图片...                         [生成 →]   │
└──────────────────────────────────────────────────────────────┘
```

移动端：

```text
┌────────────────────────────┐
│ [GPT-IMAGE-2]       [公开] │
│ [续图 基于上一张图  缩略图] │
│ [+] 描述你想创作的图片...  │
│                    [生成] │
└────────────────────────────┘
```

### 1.3 具体设计规则

顶部设置行：

- 模型 chip 放左侧，固定高度 44px。
- 参数入口合并为一个按钮：`尺寸/质量/格式`，不要把多个设置散在 composer 内。
- `公开到广场` 放右侧，使用标准 switch；不要和 prompt 输入混在同一行。
- 如果公开会触发首发奖励，在 switch 下方或 tooltip 中提示：`首次公开满 12 小时奖励 +N`。

上下文条：

- 只有在“续图可用 / 有参考图 / 有草稿源图”时出现。
- 背景用浅灰，不使用高饱和紫色大胶囊。
- 左侧是状态类型：`续图` / `参考图` / `编辑源图`。
- 中间是解释：`下一次生成会基于上一张完成图编辑`。
- 缩略图固定 40x40，放右侧。
- 关闭按钮只用 icon，tooltip 写 `本次不续图`。

输入行动行：

- `+` 上传按钮固定 48x48，icon-only，tooltip：`添加参考图 / 上传基底图`。
- prompt 输入区占满剩余空间。
- `生成` 是唯一主按钮，固定宽度 112-128px，贴近输入框右侧。
- 禁用时按钮文字不变，按钮旁或下方显示原因：`积分不足` / `API 未配置` / `正在生成`。

图片结果操作条：

当前历史卡片下方的 `再次生成 / 保存 / 重新编辑 / 图片编辑` 也要统一：

```text
┌─ 图片结果 ─────────────────────┐
│ image                           │
├─────────────────────────────────┤
│ [再次生成] [保存] [编辑] [更多] │
└─────────────────────────────────┘
```

规则：

- 常驻最多 3 个文字按钮，第四个进入 `更多`。
- `图片编辑` 和 `重新编辑` 容易混淆，建议改成：
  - `改提示词`：回到文生图/续图。
  - `图生图`：以当前图为基底编辑。
- 下载/保存按钮用同一个动词：`下载` 或 `保存`，全站统一。
- 生成中卡片不显示完整操作条，只显示状态、耗时、取消。

### 1.4 视觉规格

- composer 容器最大宽度与内容区一致，不要超宽漂浮。
- 外层圆角 24px，内层按钮圆角 12-14px。
- 避免多个强边框同时出现，重点只给主按钮。
- 续图条高度 56px，输入行高度 64px。
- 图标按钮统一 44/48px，不出现 36、42、48 混用。
- 文案最长时也不能把输入框挤到小于 360px；移动端则换行。

### 1.5 验收

- 截图中的 composer 不再出现“续图按钮、上传按钮、公开开关、生成按钮四处漂”的问题。
- 用户能在 3 秒内理解：是否公开、是否续图、在哪里输入、哪里生成。
- 禁用生成按钮时，页面明确说明为什么不能生成。
- 桌面和移动端都不遮挡当前生成卡片主体。

## 2. 当前最高优先级：P0.1 标签库数量与中文展示修复

用户反馈“提示词标签还很少、空标签也应该展示、界面上不应该用英文填充”。这项与 Composer 重排同级，属于首页/提示词库的第一眼质量问题。

### 2.1 当前问题

- 前端筛选区只展示“当前有提示词/作品命中的标签”，导致系统种子标签虽然存在，界面看起来仍然很少。
- `slug` 被直接拿来展示，例如 `photo`、`poster`、`landscape`，对中文用户不友好。
- 标签数量和分类没有被显式组织，用户不知道还有哪些可探索方向。
- 空标签没有展示，用户也就无法发现平台预设的标签体系。
- 管理员后台虽然有标签库，但前台标签筛选没有体现“系统标签完整目录”。

### 2.2 设计原则

- **展示标签 ≠ 只展示有内容的标签**。系统标签是导航能力，即使当前没有对应提示词，也应该展示。
- **前台默认中文显示**。slug/英文只用于数据、搜索、别名和后台，不直接作为中文界面的主 label。
- **空标签要可见但弱化**。没有内容的标签可以置灰、显示 `0`，点击后出现空状态和推荐操作。
- **系统标签优先，用户标签补充**。前台标签顺序应先显示系统/管理员标签，再显示高热度用户标签。
- **标签要有分类**。不要把 80+ 标签平铺成一长串。

### 2.3 标签展示规则

标签数据应统一来自 `/api/tags`，而不是从提示词列表里临时提取。

前台标签筛选展示：

```text
全部
推荐
风格：摄影 / 写实 / 插画 / 水彩 / 油画 / 像素 / 概念 / 动漫 / 中国风 / 极简
题材：人像 / 风景 / 城市 / 静物 / 美食 / 动物 / 建筑 / 海洋 / 太空 / 节日
用途：海报 / 头像 / 商品 / 广告 / 网站横幅 / 表情 / 头图 / 名片 / 票券 / 包装
镜头：特写 / 中景 / 全景 / 鸟瞰 / 鱼眼 / 微距 / 仰拍 / 俯拍 / 透视
灯光：自然光 / 黄金时段 / 工作室光 / 霓虹 / 烛光 / 体积光 / 逆光 / 柔光
情绪：治愈 / 神秘 / 怀旧 / 欢快 / 严肃 / 浪漫 / 冷淡 / 戏剧 / 温馨 / 史诗
颜色：莫兰迪 / 高饱和 / 黑白 / 复古 / 粉红 / 蓝调 / 暖色 / 冷色 / 渐变 / 撞色
技法：HDR / 长曝光 / 光绘 / 双重曝光 / 散景 / 移轴 / 反射 / 颗粒 / 镜头光晕
```

标签 chip 显示：

```text
[摄影 12] [写实 8] [水彩 0] [概念 0]
```

规则：

- `count > 0`：正常显示，可点击筛选。
- `count === 0`：置灰显示，仍可点击；点击后显示“暂无内容，可查看相近标签或去生成”。
- hover / tooltip 显示英文 slug 和别名：`photo · photography · 摄影`。
- 搜索框输入中文、英文、别名都应命中同一个 tag。
- 如果用户语言是中文，显示 `labelZh`；英文界面才显示 `labelEn`；两者缺失时才 fallback 到 slug。

### 2.4 标签数量要求

最低要求：

- 系统标签不少于 80 条，按 8 类 × 10 条展示。
- 前台默认至少展示每类前 8-10 条系统标签，不依赖提示词是否存在。
- 标签总数超过 80 时，默认展示系统标签 + 热门用户标签前 20，其他进入“更多标签”。
- 提示词库顶部显示“系统标签 / 用户标签 / 空标签”统计：
  - `系统标签 80`
  - `已有内容 36`
  - `待补内容 44`

### 2.5 空标签的用户体验

点击空标签时不要显示“没有找到”这么冷冰冰的状态，而是：

```text
暂无「水彩」提示词

这个标签已经在标签库中，当前还没有对应提示词。
你可以：
[用这个标签去生成] [查看相近标签] [提醒管理员补充]
```

相近标签来自同一分类，比如水彩空时推荐：插画、油画、概念、极简。

管理员登录时额外显示：

```text
[为这个标签新建提示词]
```

### 2.6 后台要求

标签后台需要补充：

- 分类字段：`category`，例如 `style / subject / use_case / camera / lighting / mood / color / technique`。
- 排序字段：`sort_order`。
- 前台可见开关：`show_in_filter`。
- 空标签统计：关联提示词数、关联公开作品数。
- 一键“为低覆盖标签补内容”：跳到提示词 CMS，并带入该标签。

### 2.7 API 要求

`GET /api/tags` 建议返回：

```json
{
  "tags": [
    {
      "slug": "photo",
      "labelZh": "摄影",
      "labelEn": "Photo",
      "category": "style",
      "aliases": ["photography", "照片"],
      "status": "active",
      "showInFilter": true,
      "promptCount": 12,
      "galleryCount": 4,
      "usageCount": 16,
      "hue": 210,
      "sortOrder": 10
    }
  ],
  "summary": {
    "systemCount": 80,
    "withContentCount": 36,
    "emptyCount": 44
  }
}
```

### 2.8 验收

- 中文界面不再把 `photo / poster / landscape` 作为主显示文案。
- 标签筛选区即使没有提示词，也能展示系统标签。
- 至少 80 个系统标签可在“更多标签”或分类标签面板中看到。
- 空标签点击后有友好的空状态和“去生成 / 相近标签 / 管理员补充”入口。
- 管理员能看到哪些标签没有提示词覆盖。
- 搜索“摄影 / photo / photography / 照片”都命中同一标签。

## 3. 统一产品方向

Image2Creat 的目标不只是“输入提示词生成图片”，而是一个轻量 AI 图片工作站：

- 用户可以从首页快速生成、续图、图生图。
- 用户有会话线路、我的作品资产库、公开广场。
- 广场作品保留作者、标签、提示词、原图/结果图、路线。
- 管理员可以运营提示词、标签、用户、积分、公开作品、审核与系统健康。
- 平台用首发奖励、提示词点赞、榜单、撤回规则引导用户公开优质内容。

## 4. 当前已完成能力

已完成或基本完成：

- 登录/注册/积分/签到/管理员设置。
- 文生图、图生图、生成历史。
- 文生图会话列表和续图开关。
- 图生图必须携带原图的解释弹窗。
- 图生图编辑器计时、取消、失败再试、最近输出缩略图。
- 广场公开、标签、作者署名、用户管理自己公开作品。
- 广场详情大图、文生图/图生图入口、下载、复制、取消公开。
- `gallery_tags` 标签库、80 条系统种子、admin 标签 CRUD、合并入口。
- `/api/version`、smoke test、部署版本可观测。

2026-05-19 / 2026-05-20 增量已落地（详见 `docs/IMAGE_STUDIO_RELLIS_TASKS.md` 与 `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md` release record）：

- 提示词点赞、四种排序（热门/最新/常用/最赞）、提示词详情点赞按钮：`AIS-RLS-013`。
- 提示词重复候选 + 大模型审核 mock + 人工保留动作：`AIS-RLS-014`。
- 标签合并时同步迁移历史 `tags_json` / `public_tags_json`：`AIS-RLS-035`。
- 公开 QA / release checklist 与提交-部署流程：`AIS-RLS-038`。
- 画廊提示词图片代理、本地缩略图静态资源、缺失图片显式 404、画廊图片归一与首页路由修复：与 `AIS-RLS-001`–`AIS-RLS-007` 同批闭环。

### 4.1 画布工作台当前落地状态

2026-05-20 已将 `basketikun/infinite-canvas` 的核心画布能力按本项目架构吸收为“画布工作台”，但没有迁移其 Next.js/React/Go 技术栈，也没有照搬浏览器直连模型 API 的模式。

当前已完成：

- 入口：顶部导航、首页首屏、生成结果、画廊详情、提示词详情均可进入或加入画布。
- 数据：`canvas_projects` 持久化用户私有画布，`canvas_generation_links` 关联画布输出和 `generations`。
- 交互：平移、缩放、背景模式、小地图、单选、多选、框选、分组、撤销、重做、复制、粘贴。
- 节点：图片、文本、提示词、生成配置、输出、分组节点；可连线并从上游节点收集生成输入。
- 工作流：`POST /api/canvases/:id/generate` 复用现有文生图/图生图后端链路，继续走登录、额度、速率限制、请求审计和图片落库。
- 交换：JSON 导出/导入使用 `ai-image-studio.canvas.v1`，服务端校验节点、连线和图片引用，拒绝 `data:`/`blob:` 大文件直接进入画布 JSON。
- 助手：`POST /api/canvases/:id/assistant` 只读取服务端保存的画布 `dataJson`，忽略伪造节点并省略嵌入式图片数据。

工程边界：

- `public/app.js` 只负责全站路由和把首页/画廊/提示词 payload 交给画布，不继续承载画布实现。
- 当前画布已拆为 `canvas-store.js`、`canvas-nodes.js`、`canvas-geometry.js`、`canvas-workflows.js`、`canvas-minimap.js`、`canvas-selection.js`、`canvas-history.js`、`canvas-io.js`、`canvas-assistant.js` 和 `canvas.js`。
- 后续新增画布功能必须优先拆入独立 `public/canvas-*.js` 或 `src/canvas-*.js`，禁止把所有代码继续堆进 `public/canvas.js` 或 `server.js`。
- 下一轮画布增强前，应先把 `public/canvas.js` 中的渲染、检查器、键盘和工具栏逻辑继续拆出，避免形成新的单文件巨石。

## 5. 关键遗留

这些是已在多份文档中出现、但仍应继续推进的核心遗留：

| 遗留项 | 为什么重要 | 归属优先级 |
|---|---|---|
| Composer / 操作按钮重排 | 当前最影响用户观感和理解成本 | P0.0 |
| 文生图生成中闪屏 | 生成开始后界面反复闪动会直接破坏核心创作体验 | P0 |
| 文生图结果按钮收口 | 结果卡操作过密，`更多` 按钮样式不统一 | P0 |
| 画廊详情主图联动 | 创作路线、输入图、结果图点击后主展示图不切换，影响查看路线和图生图对比 | P0 |
| 画廊卡片标签去重与用户标签展示 | 卡片重复显示类型标签且吞掉用户设置标签，影响内容筛选和作品表达 | P0 |
| 标签数量与中文展示 | 当前提示词库看起来标签少、英文 slug 暴露，直接影响内容探索 | P0.1 |
| 路线耗时 | 广场多轮作品应显示每轮耗时 | P0 |
| 队列位置 | 生成中状态需要真实排队信息 | P0/P2 |
| 多候选 | ProductFlow 式工作站的关键能力 | P2 |
| 真正任务队列 | 刷新恢复、取消、重试、队列位置都依赖它 | P2 |
| 独立 `/admin` 后台 | 当前后台仍过于分散 | P1 |
| 用户公开奖励与 12 小时撤回 | 内容增长和反刷机制基础 | P1 |
| 提示词重复治理（embedding / 召回） | 当前已落地规则 + 大模型 mock 复核，缺真正的语义召回与人工链路 | P2 |
| 榜单侧栏化与点赞按钮优化 | 榜单需要像画廊导航能力，而不是普通内容堆叠 | P1 |
| infinite-canvas 提示词源接入 | 扩充系统提示词库，并让外部提示词进入画廊和画布 | P1 |
| 公开画布线路复制 | 让广场作品变成可复用创作线路 | P1 |
| 画布模板市场 | 把高质量线路沉淀为可复制模板 | P2 |
| 画布模块继续拆分 | 防止 `canvas.js` / `server.js` 重新变成单文件巨石 | P1 工程治理 |
| 安全响应头、CSRF、上传防护 | 生产环境基础安全；CSP Report-Only 已上线，正式 CSP 与上传 magic-byte 仍待落实 | P1 |
| 响应式图片和缩略图 | 大图卡顿、CLS、LCP 的根源 | P1 |

## 6. 统一实施路线

### P0：先修当前最刺眼的体验和数据不一致

1. **P0.0 Composer / 按钮布局重排**
   按 §1 的三层结构重做底部 composer、续图条、图片结果操作条。

2. **P0.0a 文生图生成中闪屏修复**
   生成开始后保持 `chatView`、历史列表和 composer 稳定，只更新状态条、占位卡和计时器；禁止因为轮询或状态更新反复触发视图切换、滚动重置或 composer remount。

3. **P0.0b 文生图结果按钮收口**
   结果卡常驻按钮最多 3 个，`更多` 使用统一 ghost/icon 按钮样式；`加入画布`、`改提示词` 等次级动作放入更多菜单或紧凑图标区。

4. **P0.1 标签数量与中文展示修复**
   前台标签筛选改用 `/api/tags` 完整系统标签，不依赖提示词命中；默认中文 label；空标签也展示，并提供空状态和去生成入口。

5. **P0.1a 画廊详情主图联动修复**
   详情页维护 `selectedMedia = { kind, id, imageUrl, label, generationId }`；点击创作路线条目、图生图输入图、图生图结果图都必须更新左侧主图、右侧 active 状态和可访问标签，不能只改变选中框。

6. **P0.1b 画廊卡片标签去重与用户标签展示**
   渲染层把 `kindBadge`、`adminBadge`、`publicTags` 分开处理；类型词只显示一次，用户设置标签必须从 `public_tags_json` / API `publicTags` 展示出来，且和详情页保持一致。

7. 路线耗时
   给 `generation_requests` 或 `generations` 补 `duration_ms`，公开路线返回 `durationMs`。

8. 标签合并 JSON 迁移（已完成 `AIS-RLS-035`）
   后台合并标签时同步迁移历史 `prompts.tags_json` 与 `generations.public_tags_json`，并落 admin audit。

9. 参考图入口预期继续收口
   如果短期不支持真实参考图参与生成，UI 必须继续弱化"参考图"入口，避免误导。

10. 固定 smoke test（已完成 `AIS-RLS-038`）
   `npm run smoke:public`、`smoke:auth-admin`、`smoke:gallery-images`、画布纯逻辑 smoke、`smoke:prompt-review` 已落地，并在 `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md` 中纳入 release record。

### P1：前台资产库 + 独立管理员后台

1. `/admin` 独立后台 shell
   左侧导航、顶部状态、内容区，迁入现有设置、用户、标签、提示词管理。

2. 用户与积分管理
   搜索、筛选、分页、用户详情 drawer、积分流水、首发奖励状态。

3. 我的作品资产库
   从弹窗升级为正式页面或全屏抽屉：搜索、筛选、批量公开/撤回/归档。

4. 首次公开奖励 + 12 小时撤回
   首次公开锁定奖励，公开满 12 小时且未撤回/未下架后入账；超过 12 小时只允许提交撤回申请。

5. 提示词点赞（已完成 `AIS-RLS-013`）
   提示词卡和详情弹窗均已支持点赞、四种排序与稳定二级排序；榜单与卡片复用同一状态更新器。

6. 画廊榜单侧栏化
   榜单从普通网格区改成画廊侧栏/抽屉：桌面右侧固定，移动端底部抽屉；日榜/周榜/月榜/总榜用 tabs 或 segmented control；榜单点赞按钮使用统一小型 icon 样式。

7. 接入 infinite-canvas 提示词源
   在 `prompt_sources` 中新增 `basketikun/infinite-canvas`，实现适配 parser 或增强 generic parser，把其提示词库同步到本项目 `prompts`，进入画廊、搜索、标签、榜单和画布插入流程。

8. 基础安全与性能
   CSP Report-Only、CSRF token、上传 magic-byte 校验、图片重新编码、响应式缩略图。

### P2：任务队列、广场治理和提示词质量

1. 真正任务队列
   `pending/running/succeeded/failed/cancelled` 状态持久化，前端轮询，刷新可恢复。

2. 队列位置
   status API 返回 `queuePosition`、`queueTotal`、估计等待时间。

3. 多候选
   支持 `n > 1`，候选比较、选定当前结果、公开最终候选。

4. 广场审核与举报
   待审核、被举报、撤回申请、隐藏/恢复、审核日志。

5. 提示词重复治理（局部已落地，参考 `AIS-RLS-014`）
   规范化 hash、simhash、规则候选、Responses 模型 mock 复核、人工保留动作均已落地；待补 embedding 召回、真实大模型审核接入和管理员审核审计视图。

### P3：运营增长和长期架构

1. 提示词集合、变量模板、运营推荐位。
2. 用户等级、勋章、贡献榜、高赞提示词榜。
3. RUM 指标进后台：LCP/INP/CLS、生成耗时、图片失败率。
4. Provider capability layer：不同模型能力驱动前端入口显示。
5. SEO 分享卡片：`/gallery/:id`、OG image、sitemap。
6. Passkey 管理员强认证。
7. C2PA / AI 内容来源透明和隐私版下载。

## 7. 管理员后台统一信息架构

```text
/admin
├─ 总览
├─ 生成请求
├─ 广场审核
├─ 用户与积分
├─ 提示词 CMS
├─ 标签库
├─ 举报与撤回
├─ 系统设置
├─ RUM / 性能
└─ 审计日志
```

总览必须展示：

- 今日生成、成功率、失败率、平均耗时。
- 新增用户、公开作品、待审核、被举报。
- API Key 状态、版本、任务队列健康。
- 热门标签、热门提示词、积分发放/消耗。

每个列表页必须有：

- 搜索、筛选、排序、分页。
- 批量选择。
- 行点击打开详情 drawer。
- 危险动作二次确认。
- 操作写 audit log。

## 8. 数据与 API 总表

### 7.1 已有/可复用

- `GET /api/version`
- `GET /api/health`
- `GET /api/stats/today`
- `GET/PATCH /api/admin/settings`
- `GET/PATCH /api/admin/users`
- `GET /api/admin/generations`
- `GET/POST/PATCH/DELETE /api/prompts`
- `GET/POST/PATCH/DELETE /api/tags`
- `POST /api/tags/:slug/merge`
- `GET /api/images/public`
- `GET /api/images/history`
- `POST /api/images/generate`
- `POST /api/images/edit`

### 7.2 建议新增

```text
GET  /api/admin/overview
GET  /api/admin/generation-requests
GET  /api/admin/generation-requests/:id
POST /api/admin/generation-requests/:id/refund

GET  /api/admin/gallery
PATCH /api/admin/gallery/:id/moderation
POST /api/admin/gallery/batch
POST /api/admin/gallery/:id/approve-withdrawal
POST /api/admin/gallery/:id/reject-withdrawal

GET  /api/admin/credit-ledger?userId=
GET  /api/admin/reward-ledger?userId=
POST /api/admin/users/batch

POST /api/gallery/:id/withdraw
POST /api/gallery/:id/withdrawal-request

POST /api/prompts/:id/like
DELETE /api/prompts/:id/like
GET  /api/prompts/:id/engagement

POST /api/admin/prompts/audit-duplicate
GET  /api/admin/prompts/:id/duplicate-candidates
POST /api/admin/prompts/:id/resolve-duplicate

GET  /api/admin/audit-logs
GET  /api/admin/rum/summary
POST /api/admin/provider/test
```

## 9. 设计规范摘要

前台：

- 图片是主体，按钮围绕图片和输入，不要抢主视觉。
- 每个区域最多一个主按钮。
- icon-only 必须有 tooltip/aria-label。
- 文生图、图生图、续图、参考图要有清晰语义区分。
- 公开、奖励、撤回都是状态，不应塞进 prompt 输入行。

后台：

- 工作台风格，少装饰，多表格，多筛选。
- 不用大弹窗承载整个后台。
- 批量操作要明确“选中当前页还是全部结果”。
- 详情 drawer 保持列表上下文。
- 危险操作必须二次确认和审计。

## 10. 验收总清单

P0 完成时：

- 截图中的 composer 按钮布局已重排，不再凌乱。
- 文生图开始生成后不再闪屏，不重建 composer，不重置滚动位置。
- 续图、公开、上传、生成四类动作有清晰分区。
- 历史图片操作条统一，不再出现语义重复按钮。
- 文生图结果卡常驻按钮最多 3 个，`更多` 按钮样式统一。
- 画廊详情点击创作路线、输入图、结果图时，主展示图和选中状态同步变化。
- 画廊卡片只显示一个 `文生图` 或 `图生图` 类型徽标，并正确展示用户设置的公开标签。
- 标签筛选区展示完整系统标签，不因没有提示词而隐藏。
- 中文界面标签显示中文 label，不再以英文 slug 作为主文案。
- 空标签有友好空状态和“去生成 / 相近标签 / 管理员补充”入口。
- 路线能显示耗时或明确后端缺数据。
- 标签合并有 JSON 迁移方案或后台按钮。

P1 完成时：

- `/admin` 可以替代当前后台弹窗。
- 用户能在我的作品里搜索、批量管理公开作品。
- 首次公开奖励和 12 小时撤回有完整弹窗、状态和后台记录。
- 提示词点赞可用，热门排序可用。
- 画廊榜单以侧栏/抽屉呈现，榜单点赞按钮与画廊卡一致。
- `basketikun/infinite-canvas` 提示词源已接入画廊、搜索、标签、榜单和画布插入。
- 基础安全响应头、CSRF、上传校验和缩略图策略有实现。

P2 完成时：

- 生成任务可刷新恢复、取消、重试、展示队列位置。
- 多候选可比较和选择。
- 广场审核、举报、撤回申请闭环。
- 提示词重复治理能给出结构化报告。

P3 完成时：

- 平台具备运营增长能力：榜单、勋章、集合、推荐位。
- 管理员可看 RUM 性能数据。
- 公开作品具备 SEO 分享卡片和内容来源透明策略。

## 11. 旧文档保留策略

本文件是后续实施总入口。旧文档仍保留，因为它们包含详细背景、来源和历史执行记录：

- 查背景：看 ProductFlow gap analysis。
- 查 Exec4 具体落地：看 Exec4 design。
- 查安全/性能外部依据：看 external optimization research。
- 查前端/后台详细页面设计：看 frontend admin design。

后续新增需求应优先写入本文件，再按需要同步到具体专题文档。
