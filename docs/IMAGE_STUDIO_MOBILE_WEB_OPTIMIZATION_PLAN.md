# AI Image Studio Mobile Web Optimization Plan

本文件用于规划手机端访问体验优化。它是可公开的开发文档，只记录产品、前端结构、实现准则、任务拆分和验收标准；真实域名、服务器路径、SSH、线上排障记录继续放在本地私有文档中。

## 1. 目标

当前前台已经具备基础响应式规则，但手机端仍需要一次系统化整理：首屏排版、顶部导航、生成输入框、对话工作台、画廊、图片编辑器、弹窗与抽屉在窄屏下要稳定、可读、可操作。

本轮目标不是重做视觉风格，而是在不破坏桌面端和现有业务链路的前提下，让手机端成为一套独立验收的一等体验。

### 1.1 成功标准

- 360px、390px、430px、768px 宽度下无横向溢出、无文本重叠、无按钮被遮挡。
- 首页首屏在手机端能立即看到品牌、核心生成输入、主要入口；不需要先滚动很长距离。
- 顶部导航不挤压正文，不因为按钮数量增加导致两行高度不可控。
- 生成中、生成完成、失败重试、公开到画廊、加入画布等核心操作在手机端可完整完成。
- 画廊列表、榜单、详情抽屉、标签筛选和搜索在手机端清晰可扫读。
- 图片编辑器在手机端不出现底部输入栏挡住生成按钮、发布设置挡住画布、工具栏遮挡图片等问题。
- 所有全屏弹窗、抽屉、菜单都遵守 safe-area，并可用关闭按钮或返回路径退出。

## 2. 当前结构

### 2.1 前台入口

- `public/index.html`
  - `#homeView`：首页 Hero、最近创作、灵感示例。
  - `#chatView`：文生图对话工作台、生成历史、底部 composer。
  - `#libraryView`：公开画廊、搜索、标签、卡片网格。
  - `#leaderboardView`：点赞排行榜。
  - `#editorView`：图生图/图片编辑器。
  - `#canvasView`：旧画布入口；新 Canvas v2 位于 `/canvas-v2`。
- `public/styles.css`
  - 主要手机端规则分散在 `@media (max-width: 860px)`、`560px`、`768px`、`760px`、`720px`、`640px` 等段落。
  - 当前存在同类 breakpoint 分散、组件局部覆盖较多的问题，后续应收敛为可维护的移动端层级。
- `public/app.js`
  - 管理路由、视图切换、首页 composer 挂载、对话列表、画廊渲染、编辑器状态。
  - 手机端优化应尽量先通过 CSS 和轻量状态类完成，只有导航、抽屉、底部栏确实需要交互状态时再改 JS。

### 2.2 已有验证基础

- `npm run smoke:public`
- `npm run smoke:gallery-images`
- `npm run smoke:gallery-leaderboard-sidebar`
- `npm run smoke:gallery-detail-media`
- `npm run smoke:generation-result-actions`
- `npm run smoke:generation-flicker`
- `npm run smoke:canvas-v2`
- `npm run smoke:canvas-v2:entry`

这些 smoke 主要覆盖接口和关键 DOM 状态，手机端布局仍需要补充截图级检查。

## 3. 设计原则

### 3.1 手机端信息架构

手机端优先按任务组织，而不是照搬桌面端横向导航：

1. 创作：打开首页即可输入 prompt 并生成。
2. 探索：画廊、排行榜、标签、搜索。
3. 编辑：上传图片或从作品继续编辑。
4. 资产：我的作品、生成历史、会话列表。
5. 账户：登录、积分、通知、联系管理员、后台入口。

顶部只保留当前任务最常用入口；低频入口进入菜单、底部 sheet 或账号菜单。

### 3.2 布局规则

- 手机端采用单列布局，除图片卡片外不强行保留桌面多列。
- 固定工具栏、底部 composer、浮层抽屉必须使用 `env(safe-area-inset-*)`。
- 任何固定底部元素都要给主内容增加对应 padding，避免遮挡最后一条内容或提交按钮。
- 不新增依赖视口宽度线性变化的字号；移动端字号使用明确 token 或 breakpoint 值。
- 文字 `letter-spacing` 默认为 `0`；已有夸张字距应在手机端收敛，避免英文标题被挤出容器。
- 卡片圆角维持 8px 或现有系统半径；工具和重复内容卡片可用卡片，页面大区块不再套卡片。
- 触控目标最小高度 40px，主要操作 44-48px。
- 水平滚动只用于标签、分段控件、缩略图条；主页面不允许横向滚动。

### 3.3 交互规则

- 顶部导航手机端应成为紧凑工具条：品牌、当前页主操作、菜单入口，而不是把所有桌面按钮压进同一行。
- 会话列表在手机端使用底部抽屉或全屏抽屉，打开后应有遮罩和清晰关闭入口。
- 画廊详情、我的作品详情、通知、登录、发布说明等弹窗在手机端优先全屏或近全屏 sheet。
- 生成期间不重建整个视图，不重置滚动，不让 composer 闪动。
- 错误、空状态、加载状态要占稳定高度，不能让列表在请求前后明显跳动。

## 4. 优化范围

### 4.1 首页 Hero

当前风险：

- 手机端 Hero 高度偏大，核心输入框可能被向下推。
- 主标题使用大字号与字距变化，窄屏容易出现压缩、溢出或视觉噪音。
- 顶部导航换行后会继续挤占 Hero 空间。

优化方向：

- 手机端首屏高度以 `100svh` 为基准，但必须露出下一段内容的一部分。
- 标题从桌面展示型排版切换为更紧凑的移动端排版，字号固定在有限阶梯，不用 `vw` 继续放大。
- `hero-meta-row` 保留一行或两行以内，超出的状态信息降级为短文案或隐藏次要装饰。
- `heroComposerMount` 在手机端优先展示 prompt 输入、图片参考入口、生成按钮；高级参数折叠。
- 最近创作和灵感示例在手机端不抢首屏，但首屏底部要能提示还有内容。

### 4.2 顶部导航

当前风险：

- `topbar` 在 `max-width: 860px` 下改为纵向，`top-actions` 横向滚动；入口数量增多后首屏高度不可控。
- 多个 `nav-pill` 隐藏文字后只剩图标，部分图标语义不够直接。

优化方向：

- 手机端 topbar 改为一行固定高度：品牌或返回、当前主入口、更多菜单。
- 画廊、排行榜、编辑器、画布、通知、联系、语言、登录按优先级收纳。
- 登录前显示登录按钮；登录后显示头像菜单，通知可作为图标带 badge。
- 在对话工作台中，会话列表入口固定为一个明确按钮，不与全站导航混在一起。

### 4.3 Composer

当前风险：

- 首页 composer、底部 sticky composer、编辑器 prompt bar 是不同布局，手机端容易出现按钮换行和遮挡。
- `send-button`、`tool-button` 在小屏下仍可能占过多宽度。

优化方向：

- 统一移动端 composer 结构：输入区一行或多行，工具区一行横向滚动，主按钮固定在右侧或底部。
- 高级设置折叠为 sheet，不占常态高度。
- 上传参考图、比例、格式、模型等次要控件用图标按钮和短标签，避免长文字撑开。
- sticky composer 使用 `bottom: calc(10px + env(safe-area-inset-bottom))`，并给 `chat-workspace` 预留底部空间。

### 4.4 对话工作台

当前风险：

- `chat-session-panel` 手机端固定在底部，和 sticky composer 都在底部区域，容易互相干扰。
- 生成历史、状态条和底部输入栏的垂直空间竞争明显。

优化方向：

- 会话列表打开时使用底部 sheet，占屏幕 60%-80%，并临时隐藏或下移 composer。
- 生成状态条固定在内容流顶部或 composer 上方，不遮挡历史图片。
- 历史卡片手机端只保留主要图片、状态、核心操作；二级操作进入更多菜单。
- 生成结果操作按钮必须可换行，长中文不挤出容器。

### 4.5 画廊与排行榜

当前风险：

- `gallery-main-grid` 在 560px 下单列，排行榜 `order: -1`，但筛选、搜索、榜单、卡片顺序需要重新审视。
- 标签很多时会拉高 `library-hero`，导致用户迟迟看不到内容。
- 详情弹窗在手机端虽切成上下布局，但按钮和元信息可能过长。

优化方向：

- 手机端画廊顺序：搜索栏、快捷标签横滑、排序/筛选、作品流；排行榜作为独立页或折叠模块。
- 标签筛选默认只显示一行，提供展开入口。
- 卡片图片使用稳定比例，标题和 prompt 摘要限定行数。
- 详情页手机端全屏：图片在上、操作栏吸底、详情信息滚动。
- 点赞、复制 prompt、使用生成、加入画布、查看路线等核心操作在底部操作区稳定出现。

### 4.6 图片编辑器

当前风险：

- 编辑器有顶部工具、发布面板、底部 prompt bar、缩放/快捷键浮层，手机端容易互相遮挡。
- 发布原图、公开到画廊等控件曾经出现挡住生成按钮的问题。

优化方向：

- 手机端编辑器使用三层结构：顶部模式栏、中央图片/画布、底部操作栏。
- 工具栏横向吸顶或吸底，不覆盖图片主体。
- 发布设置进入折叠面板，默认只显示当前公开状态和入口。
- 底部 prompt bar 单独承担输入和提交，不混入过多开关。
- 上传空状态、编辑中、生成中、失败重试都要在 360px 下截图验证。

### 4.7 我的作品与详情抽屉

优化方向：

- 我的作品列表手机端单列，批量操作改为底部栏。
- 详情抽屉全屏显示，图片区域和信息区域可独立滚动。
- 发布、撤回、下载、加入画布等操作放在底部固定操作区。

### 4.8 管理后台手机端

后台不是本轮最高优先级，但不能破版：

- 640px 下后台导航、表格、表单应可纵向使用。
- 表格类内容优先转为卡片列表或允许容器内横向滚动，不能撑出页面。
- 批量操作、筛选、抽屉、确认弹窗必须可关闭。

## 5. CSS 整理方案

### 5.0 文件体量约束

本轮必须把“避免单文件继续膨胀”作为开发约束，而不是事后重构项。当前 `public/styles.css` 和 `public/app.js` 已经承担了过多页面与组件职责，手机端优化如果继续把所有样式和交互追加到这两个文件，会让后续维护、回归和定位问题变得更困难。

硬规则：

- 新增移动端专用样式优先放入独立 CSS 文件，例如 `public/mobile.css`，再由 `public/index.html` 引入。
- 新增手机端菜单、sheet、抽屉等交互优先放入独立 JS 文件，例如 `public/mobile-ui.js`，只通过少量全局状态或 DOM 事件与 `app.js` 协作。
- `public/app.js` 只保留路由、业务状态和跨模块协调；不要把具体移动端 DOM 控制和动画细节继续写进去。
- `public/styles.css` 只保留基础设计系统、桌面端已有组件和少量共享变量；不要把大段新增 `@media` 继续堆到文件末尾。
- 单个新文件应围绕一个明确责任边界，例如 mobile shell、gallery mobile、editor mobile；如果一个文件开始同时管理多个页面的复杂逻辑，应继续拆分。
- 拆分文件时必须同步 `index.html` 的 cache-bust query，并补充对应 `node --check` 或静态资源 smoke。

建议的首批拆分：

- `public/mobile.css`：全站 mobile shell、topbar、safe-area、通用 sheet。
- `public/mobile-home.css`：首页 Hero、首页 composer、最近创作移动布局。
- `public/mobile-gallery.css`：画廊、排行榜、详情移动布局。
- `public/mobile-editor.css`：图片编辑器、我的作品移动布局。
- `public/mobile-ui.js`：移动端菜单、sheet、焦点回收、视图切换清理。

首批可以先建立 `mobile.css` 和 `mobile-ui.js`，等页面级规则变多后再继续拆成 page-level 文件。重点是新增代码从一开始就有可迁移边界。

### 5.1 Breakpoint

后续改造统一使用以下层级：

- `<= 1024px`：平板和窄桌面，减少列数。
- `<= 768px`：手机/小平板，进入单列和 sheet 模式。
- `<= 480px`：小手机，进一步压缩间距和操作文案。
- `<= 360px`：极窄兜底，只做必要修复，不新增复杂布局。

现有 `860px`、`760px`、`720px`、`640px`、`560px` 不要求一次全部删除，但新增规则应优先按上面层级组织，并逐步迁移旧规则。迁移时优先把手机端覆盖从 `styles.css` 搬到 mobile CSS 文件中，不继续扩大主样式文件。

### 5.2 Token

建议在 `:root` 中补充移动端相关变量：

```css
:root {
  --mobile-page-pad: 16px;
  --mobile-page-pad-sm: 12px;
  --mobile-topbar-h: 56px;
  --mobile-bottom-bar-h: 76px;
  --touch-target: 44px;
}
```

注意：变量是示例，实际落地前要结合现有 `--gap-*`、`--radius-*`、`--shadow-*`，避免重复 token。

### 5.3 文件组织

短期不引入构建流程，但也不等于继续集中到 `public/styles.css`。新增移动端样式应使用独立 CSS 文件，并按组件分组：

1. base/layout
2. topbar/navigation
3. home/hero/composer
4. chat workspace
5. gallery/leaderboard/detail
6. editor
7. works/account/modals
8. admin
9. responsive overrides

如果继续扩张，按页面继续拆分 CSS 文件；本轮不为拆文件引入构建流程，只使用浏览器原生多 `<link rel="stylesheet">` 引入。

## 6. JS 调整边界

优先不改业务逻辑。只有以下情况允许调整 `public/app.js`：

- 需要新增手机端菜单、底部 sheet、抽屉打开状态。
- 需要根据视图切换关闭 mobile sheet，避免跨页面残留。
- 需要将桌面上的多个按钮归并到更多菜单。
- 需要补充 `aria-expanded`、`aria-controls`、焦点回收和 Esc/返回关闭逻辑。

不应在本轮混入 provider、积分、生成 API、数据库、审核流程等无关改动。

新增移动端交互时，默认新建 `public/mobile-ui.js` 或更小的页面级模块，并在 `app.js` 暴露必要的轻量事件或状态钩子。不要把移动端菜单、sheet、手势、焦点管理等细节直接追加到 `app.js`。

## 7. 实施阶段

### Phase 0：基线截图与问题清单

产出：

- 本地或线上截图基线：`360x800`、`390x844`、`430x932`、`768x1024`、`1280x720`。
- 覆盖页面：首页、对话工作台、画廊、榜单、画廊详情、图片编辑器、我的作品、登录/通知弹窗。
- 记录横向溢出、遮挡、文本裁切、按钮不可点、滚动异常。

验收：

- 每个页面至少有一张手机截图和一条结论。
- 记录在 QA 文档或本开发文档的后续 release note 中。

### Phase 1：首页、导航、Composer

范围：

- `public/index.html`：必要时新增移动端菜单容器。
- `public/mobile.css` / `public/mobile-home.css`：topbar、hero、composer、sticky composer。
- `public/mobile-ui.js`：必要时管理移动端菜单状态。
- `public/styles.css` / `public/app.js`：只做共享变量、挂载点或兼容性小改。

验收：

- 360px 下无横向滚动。
- 首屏能直接看到输入框和生成按钮。
- 登录前后导航都不超过可控高度。
- 从首页生成后进入对话工作台，不闪回、不重置滚动。

### Phase 2：对话工作台与生成结果

范围：

- 会话列表 sheet。
- 生成状态条。
- 历史卡片和操作按钮。
- 生成失败/重试/取消状态。

验收：

- 打开会话列表时不遮挡关闭入口。
- sticky composer 不遮挡最后一条生成结果。
- 生成中 10 秒内视图稳定。
- 生成完成后的公开、下载、加入画布等操作可用。
- 新增交互代码不直接堆进 `app.js`；移动端 sheet 状态集中在独立模块。

### Phase 3：画廊、排行榜、详情

范围：

- `library-hero`、搜索、标签筛选。
- `prompt-grid`、`gallery-main-grid`。
- 排行榜页和榜单卡。
- 画廊详情弹窗/抽屉。

验收：

- 标签默认不把内容推到屏幕下方。
- 卡片单列下图片比例稳定。
- 详情全屏或近全屏，核心操作不被遮挡。
- prompt 数据库图片、公开生成图片、榜单图片都正常展示。
- 画廊移动端样式不继续追加到 `styles.css` 末尾，优先进入 `mobile-gallery.css`。

### Phase 4：图片编辑器与我的作品

范围：

- 编辑器顶部栏、工具栏、发布设置、底部 prompt bar。
- 我的作品列表、批量操作、详情抽屉。

验收：

- 上传图片、编辑、输入 prompt、提交生成、失败重试可完整跑通。
- 公开到画廊/公布原图设置不挡住生成按钮。
- 我的作品详情在 360px 下可查看图片、元信息和操作按钮。
- 编辑器和我的作品移动端规则按页面文件隔离，避免污染首页和画廊。

### Phase 5：回归、文档、发布

范围：

- smoke、截图、隐私扫描、版本号/cache bust。
- 更新 QA release checklist。
- 如新增 Trellis 任务，按私有远程开发文档同步真实 `.trelis/tasks`。

验收：

- 本地语法检查通过。
- 核心 smoke 通过。
- 手机截图检查通过。
- 桌面端关键页面无明显回退。
- 新增代码文件责任边界清晰，没有把大段移动端样式/交互继续集中到既有大文件。

## 8. 验收清单

验收必须形成“可重复检测机制”，不能只写“手机端看起来正常”。每个阶段合并前都要留下命令输出、截图路径、失败项和修复结论；如果某项因本机环境阻断无法执行，必须写明阻断原因，并指定补跑环境。

### 8.1 视口矩阵

- `360x800`：小手机兜底。
- `390x844`：常见 iPhone 宽度。
- `430x932`：大屏手机。
- `768x1024`：竖屏平板。
- `1280x720`：桌面回归。

### 8.2 页面矩阵

- 首页 Hero，未登录。
- 首页 Hero，已登录。
- 对话工作台，空历史。
- 对话工作台，生成中。
- 对话工作台，生成完成且操作按钮展开。
- 画廊列表，标签较多。
- 画廊搜索结果为空。
- 排行榜。
- 画廊详情。
- 图片编辑器上传空状态。
- 图片编辑器已有图片状态。
- 我的作品列表与详情。
- 登录、通知、联系管理员、发布说明弹窗。

### 8.3 自动化门禁

自动化验收分三层：语法静态检查、接口/DOM smoke、移动端布局 smoke。

#### 8.3.1 语法静态检查

提交前至少运行：

```powershell
node --check server.js
node --check public\app.js
node --check public\admin.js
node --check public\gallery-normalize.js
node --check public\gallery-leaderboard.js
node --check public\gallery-detail-media.js
node --check public\generation-result-actions.js
git diff --check
```

如果新增文件，必须追加对应检查：

```powershell
node --check public\mobile-ui.js
node --check scripts\smoke\check-mobile-layout.mjs
```

CSS 没有当前专用 lint 工具时，至少通过浏览器加载和截图检查验证，不允许出现静态资源 404。

#### 8.3.2 既有业务 smoke

按改动范围补充：

```powershell
npm run smoke:public -- http://localhost:3000
npm run smoke:generation-flicker -- http://localhost:3000
npm run smoke:generation-result-actions -- http://localhost:3000
npm run smoke:gallery-images -- http://localhost:3000
npm run smoke:gallery-leaderboard-sidebar -- http://localhost:3000
npm run smoke:gallery-detail-media -- http://localhost:3000
```

本机 MySQL 不可用时，要记录阻断原因，并在容器或线上环境补跑。

#### 8.3.3 新增移动端布局 smoke

建议新增脚本：

```text
scripts/smoke/check-mobile-layout.mjs
```

脚本职责：

- 启动浏览器访问目标 origin，按 `360x800`、`390x844`、`430x932`、`768x1024` 设置 viewport。
- 覆盖 `home`、`chat`、`library`、`leaderboard`、`editor`、`works/modal` 等关键路径。
- 检查 `document.documentElement.scrollWidth <= window.innerWidth + 1`，发现横向溢出立即失败。
- 检查主要固定元素的 bounding box：topbar、composer、sheet、modal、editor prompt bar 不互相遮挡。
- 检查核心按钮可见且尺寸不小于 40px：生成、登录、画廊搜索、详情操作、编辑器提交、关闭弹窗。
- 检查页面中没有明显文本溢出：按钮、导航、卡片标题、操作栏的 `scrollWidth > clientWidth + 2` 记录为失败或 warning。
- 输出 JSON summary，并保存每个 viewport 的截图。

建议 package script：

```json
"smoke:mobile-layout": "node scripts/smoke/check-mobile-layout.mjs"
```

合格标准：

- 所有 P0 页面没有横向溢出。
- P0 核心按钮全部可见可点。
- 固定底部 composer 不遮挡最后一条内容。
- 截图保存成功，失败时带页面、viewport、selector、bounding box。

### 8.4 截图视觉验收

截图检查不只保存图片，还要有人工判定记录。建议建立：

```text
docs/mobile-qa/YYYYMMDD-<version>/
```

每次验收保存：

- `home-360.png`
- `home-390.png`
- `chat-generating-390.png`
- `chat-result-actions-390.png`
- `gallery-390.png`
- `gallery-detail-390.png`
- `leaderboard-390.png`
- `editor-empty-390.png`
- `editor-image-390.png`
- `works-detail-390.png`
- `desktop-regression-1280.png`
- `summary.md`

`summary.md` 必须包含：

```markdown
## Mobile QA Summary

- Version:
- Commit:
- Origin:
- Date:
- Tester:

| Page | Viewport | Result | Notes | Screenshot |
| --- | --- | --- | --- | --- |
| Home | 390x844 | Pass/Fail |  | home-390.png |

## Failures

- [ ] selector/page:
  - viewport:
  - symptom:
  - fix commit:
  - retest:
```

截图判定标准：

- 首屏内容有明确主操作，不能只有大标题或空白背景。
- 所有文字在容器内完整可读，允许正常省略号，不允许截断到无法理解。
- 弹窗、sheet、菜单打开时有关闭路径。
- 固定栏不遮挡输入框、按钮、图片主体和底部内容。
- 页面背景、卡片、控件层级清晰，没有互相覆盖的半透明层。

### 8.5 交互验收

每次移动端改造至少手工或脚本覆盖以下交互：

- 打开首页，输入 prompt，提交生成。
- 生成过程中滚动页面，再返回 composer，确认页面不闪回首页。
- 打开会话列表 sheet，新建会话，关闭 sheet。
- 打开画廊，搜索关键词，切换标签，打开详情，点赞或复制 prompt。
- 在详情中执行“使用生成”或“加入画布”，确认入口可触达。
- 打开图片编辑器，上传图片，输入编辑 prompt，确认提交按钮未被发布设置遮挡。
- 打开登录、通知、联系管理员、发布说明等弹窗，确认小屏可关闭。
- 输入法弹起时检查 prompt 输入框和提交按钮仍可见。
- 横竖屏切换后检查抽屉或弹窗可关闭。

合格标准：

- P0 交互不能依赖桌面 hover。
- 操作按钮不能只在图片 hover 后出现。
- 触控误点风险低，主要按钮之间有足够间距。
- 返回首页、切换画廊、打开编辑器后，上一页 mobile sheet 不残留。

### 8.6 性能验收

手机端优化不能用更多首屏资源换布局稳定。每次改造检查：

- 新增 CSS/JS 文件只在需要页面加载，或文件足够小且职责清晰。
- 不新增自动播放大图/大视频资源；现有视频保持 `preload="metadata"`。
- 首屏图片有稳定尺寸，避免 CLS。
- 移动端新增动画不影响输入和滚动，避免长时间 filter/blur 动画。
- 截图 smoke 中记录 `performance.getEntriesByType("resource")`，若新增资源异常变大，需要说明原因。

建议阈值：

- 单个新增 mobile JS 文件初始目标小于 20KB 未压缩。
- 单个新增 mobile CSS 文件初始目标小于 30KB 未压缩。
- 首屏新增图片资源为 0，除非任务明确需要新视觉素材。

超过阈值不是自动禁止，但必须在 PR/发布记录中解释。

### 8.7 可访问性验收

移动端新增导航、菜单、sheet、弹窗时必须检查：

- 按钮有可理解的文字、`aria-label` 或 `title`。
- sheet/modal 打开时设置 `aria-expanded` 或 `aria-modal` 的等价语义。
- 关闭按钮可通过键盘焦点访问。
- Esc 关闭或返回路径存在；移动浏览器没有 Esc 时必须有可见关闭按钮。
- 颜色对比不因半透明背景降低到不可读。
- 表单输入聚焦后不会被 fixed bottom bar 遮挡。

### 8.8 手工检查

- 触摸滚动没有页面和内层容器抢滚动。
- iOS Safari 地址栏收起/展开后底部 composer 不遮挡内容。
- Android Chrome 下 fixed 元素不抖动。
- 图片懒加载或失败 fallback 不导致卡片高度剧烈跳动。
- 输入法弹起时 prompt 输入框仍可见，生成按钮仍可触达。
- 横竖屏切换后菜单、抽屉、弹窗状态可恢复或可关闭。

### 8.9 发布门禁

移动端优化进入发布前必须满足：

- `node --check` 覆盖所有改动 JS。
- `git diff --check` 通过。
- `npm run smoke:public` 通过，或记录本机阻断并在容器/线上补跑通过。
- 新增 `smoke:mobile-layout` 后必须通过。
- 至少完成 `390x844` 和 `360x800` 的截图人工验收。
- 桌面 `1280x720` 回归截图无明显退化。
- 新增 mobile 文件已在 `index.html` 引入并带版本 query。
- 无私有域名、SSH、密钥、服务器路径写入公开文档或前端代码。

任何 P0 失败项不得带病发布。P1/P2 warning 可以发布，但必须在 release note 中记录原因、影响页面和后续修复任务。

## 9. 不做范围

本轮不处理：

- 重新设计品牌视觉。
- 重写 SPA 路由。
- 引入前端框架或构建流程。
- 改生成 API、积分、审核、provider 路由。
- 重构 Canvas v2 内部编辑器。
- 后台桌面端信息架构重做。

## 10. 风险与防护

- 风险：全局 CSS 覆盖导致桌面端回退。
  - 防护：手机端规则尽量包在明确 breakpoint 中，桌面截图回归。
- 风险：固定底部 composer 遮挡内容。
  - 防护：统一 bottom bar 高度 token，所有相关主内容加 padding-bottom。
- 风险：导航收纳后入口不可发现。
  - 防护：保留核心入口，更多菜单使用清晰图标和文字。
- 风险：移动端 sheet 状态跨页面残留。
  - 防护：视图切换时统一关闭 mobile-only 浮层。
- 风险：大图、视频和缩略图影响首屏性能。
  - 防护：移动端控制首屏媒体尺寸，保留 `preload="metadata"`，避免新增自动加载大资源。

## 11. 后续任务写入规则

如果后续把本计划拆为 Trellis/Rellis 任务，必须同步更新：

- `docs/IMAGE_STUDIO_RELLIS_TASKS.md`
- `docs/IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md`
- `D:\生图广场\.trelis\tasks\<task-dir>\task.json`

不要只改公开文档里的表格。真实任务状态以 `.trelis/tasks` 和 `task.py` 为准。

建议拆分为以下工作包，具体编号以后续 Trellis 状态为准：

- Mobile P0 Baseline Screenshots
- Mobile P1 Home Navigation Composer
- Mobile P1 Chat Workspace
- Mobile P1 Gallery Detail
- Mobile P2 Image Editor Works
- Mobile QA Screenshot Smoke

## 12. Release Note 模板

```markdown
### YYYY-MM-DD Mobile Web Optimization

- Scope:
- Changed files:
- Local checks:
- Screenshot matrix:
- Smoke checks:
- Known skipped checks:
- Rollback target:
```

## 13. Trellis 同步记录

2026-05-22 已同步为真实 Trellis 任务：

- `AIS-RLS-055` Mobile P0 基线截图与布局问题清单
- `AIS-RLS-056` Mobile P1 首页、导航与 Composer
- `AIS-RLS-057` Mobile P1 对话工作台与生成结果
- `AIS-RLS-058` Mobile P1 画廊、排行榜与详情
- `AIS-RLS-059` Mobile P2 图片编辑器与我的作品
- `AIS-RLS-060` Mobile QA、文档、部署与发布闭环

新增基线命令：

```powershell
npm run smoke:mobile-layout -- http://localhost:3000
```

不传 origin 时脚本会启动一个临时本地静态基线服务，并为前台所需的只读 API 返回 mock 数据；正式验收仍应使用本地服务、容器或线上 origin。输出默认写入 `docs/mobile-qa/baseline-local/<timestamp>/summary.md`、`summary.json` 和截图文件。

AIS-RLS-055 基线首次运行：

- 命令：`npm run smoke:mobile-layout`
- 输出：`docs/mobile-qa/baseline-local/2026-05-22T05-05-28-203Z/summary.md`
- 结果：脚本成功生成 5 个视口 x 5 个页面的截图和 JSON summary；当前移动端基线仍有 36 个失败项，主要集中在顶部导航、登录按钮、会话入口、画廊搜索按钮和编辑器上传卡触控高度，后续由 `AIS-RLS-056` 到 `AIS-RLS-059` 修复。

AIS-RLS-056 首页、导航与 Composer 首轮运行：

- 命令：`npm run smoke:mobile-layout`
- 输出：`docs/mobile-qa/baseline-local/2026-05-22T05-32-19-586Z/summary.md`
- 结果：新增 `public/mobile.css` 与 `public/mobile-home.css`，`public/index.html` 已引入带版本 query 的 mobile 样式。首页、顶部导航、登录按钮、Hero composer 和桌面导航触控基线通过；剩余 4 个失败项全部是画廊搜索按钮 35px 高度，归入 `AIS-RLS-058` 范围。

AIS-RLS-057 对话工作台与生成结果首轮运行：

- 命令：`npm run smoke:generation-flicker`、`npm run smoke:generation-result-actions`、`npm run smoke:mobile-layout`
- 输出：`docs/mobile-qa/baseline-local/2026-05-22T05-47-51-889Z/summary.md`
- 结果：移动端会话列表按底部 sheet 处理，打开时有遮罩；sticky composer、生成状态条、历史卡片、图片工具和结果操作区增加手机端布局保护。`smoke:mobile-layout` 的本地 mock 已补充登录用户和一条历史结果，确保 chat workspace 被真实渲染检查。生成闪屏与结果按钮收口 smoke 均通过；mobile layout 仍只剩 4 个画廊搜索按钮高度失败，归入 `AIS-RLS-058` 范围。

AIS-RLS-058 画廊、排行榜与详情首轮运行：

- 命令：`npm run smoke:gallery-detail-media`、`npm run smoke:gallery-leaderboard-sidebar`、`npm run smoke:gallery-images -- <production-origin>`、`npm run smoke:mobile-layout`
- 输出：`docs/mobile-qa/baseline-local/2026-05-22T05-58-54-261Z/summary.md`
- 结果：新增 `public/mobile-gallery.css`，`public/index.html` 已引入带版本 query 的 gallery mobile 样式。画廊搜索按钮触控高度、标签横滑、单列卡片、排行榜移动布局和详情全屏/吸底操作区完成首轮收口；`smoke:mobile-layout` 25 个页面/视口全部通过，剩余仅为非阻断 warning。

AIS-RLS-059 图片编辑器与我的作品首轮运行：

- 命令：`node --check public/app.js`、`node --check scripts/smoke/check-mobile-layout.mjs`、`git diff --check -- public/index.html public/mobile-editor.css scripts/smoke/check-mobile-layout.mjs`、`npm run smoke:mobile-layout`
- 输出：`docs/mobile-qa/baseline-local/2026-05-22T06-13-29-599Z/summary.md`
- 结果：新增 `public/mobile-editor.css`，`public/index.html` 已引入带版本 query 的 editor mobile 样式。图片编辑器手机端改为顶部模式栏、中央画布/图片、底部 prompt bar 与发布设置区的稳定三层结构；我的作品列表改为手机单列、底部批量操作栏，作品详情改为全屏抽屉和吸底核心操作区。`smoke:mobile-layout` 已扩展 `editor-image` 与 `works-detail` 页面，35 个页面/视口检查全部通过，剩余仅为登录态下登录按钮隐藏、手机端排行榜入口收纳的非阻断 warning。`npm run smoke:public` 本地未启动应用服务时返回 `fetch failed`，完整 public smoke 归入 `AIS-RLS-060` 发布闭环补跑。
