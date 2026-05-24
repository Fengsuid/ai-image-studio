# AI Image Studio 优化开发文档

**文档版本：** v1.0
**创建日期：** 2026-05-23
**项目状态：** 2026-05-24 校准：`AIS-RLS-001` 到 `AIS-RLS-093` 已完成，本地 Trellis 当前无 active 任务。
**当前版本：** 20260524-visual-regression-qa-handoff

> 当前完成状态以 `docs/PROJECT_PROGRESS_STATUS.md` 和 `D:\生图广场\.trelis\tasks` 为准。本文件保留历史方案、技术债务和后续提案；下方早期章节中出现的 Ready/Backlog 状态若与 Trellis 冲突，以 Trellis 和 `PROJECT_PROGRESS_STATUS.md` 为准。

## 0. 2026-05-24 状态校准

### 0.1 已完成范围

- `AIS-RLS-001` 到 `AIS-RLS-060`：画廊、提示词、Canvas v1/v2、后台运营、移动端体验和发布 QA 已完成。
- `AIS-RLS-061` 到 `AIS-RLS-069`：队列恢复、生成诊断、供应商能力、Agent workspace、批量生成和创作路线统一已完成。
- `AIS-RLS-070` 到 `AIS-RLS-079`：CSS tokens、样式拆分、暗色模式、前后台模块拆分、路由/存储边界、前端构建工具和视觉 polish 已完成。
- `AIS-RLS-080` 到 `AIS-RLS-092`：响应式 polish、模块 guardrails、路由/存储继续拆分、可访问性、首页 onboarding、提示词库、后台 shell 和性能预算已完成。

### 0.2 当前 active

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| `AIS-RLS-093` Visual regression QA harness for polished frontend | Done | 脚本、npm 命令、文档、截图输出和忽略策略已落地；最新本地运行 10 个场景全部通过。默认保持 baseline-free，截图基线仅在人工确认后显式提升。 |

### 0.3 文档使用规则

- 看当前进度：先读 `PROJECT_PROGRESS_STATUS.md`。
- 看发布验证：读 `IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`。
- 看历史方案和技术债：继续读本文档后续章节。
- 本文后续的 `AIS-RLS-040` 到 `AIS-RLS-060` Ready/Backlog 描述保留为历史设计记录，不再代表当前任务状态。

---

## 📋 目录

1. [项目现状概览](#1-项目现状概览)
2. [已完成里程碑](#2-已完成里程碑)
3. [历史 Backlog 与后续提案](#3-历史-backlog-与后续提案已由-trellis-校准)
4. [代码结构优化](#4-代码结构优化)
5. [功能补充路线图](#5-功能补充路线图)
6. [性能优化](#6-性能优化)
7. [工程化改进](#7-工程化改进)
8. [移动端优化](#8-移动端优化)
9. [架构演进建议](#9-架构演进建议)

---

## 1. 项目现状概览

### 1.1 技术栈

**后端：**
- Node.js 20+
- MySQL 8 持久化存储
- 单服务器部署（Docker Compose）
- OpenAI 兼容 API 集成

**前端：**
- 原生 JavaScript（无框架）
- MySQL 直连存储
- Canvas v2（源自 basketikun/infinite-canvas，已模块化）
- IndexedDB 本地缓存（部分实现）

**关键文件规模：**
- `server.js`: 5,488 行（已拆分 routes 和 middleware）
- `public/app.js`: 7,268 行（需继续拆分）
- `public/admin.js`: 2,044 行

### 1.2 已有模块化成果

**后端已拆分：**
- ✅ `src/routes/` - 路由模块
  - `auth.js` - 认证路由
  - `images.js` - 图片生成路由
  - `gallery.js` - 画廊路由
  - `health.js` - 健康检查
  - `agent-sessions.js` - Agent 会话
- ✅ `src/middleware/` - 中间件
  - `session.js` - 会话管理
  - `csrf.js` - CSRF 保护
- ✅ `src/stores/` - 数据存储层
  - `user-store.js`
  - `generation-store.js`
  - `prompt-store.js`
  - `tag-store.js`
  - `agent-session-store.js`
- ✅ `src/` - 业务模块（`generation-*-*.js`、`provider-*.js`、`agent-*.js`、`creative-route.js` 等 10+ 个独立文件）
  - `prompt-review-service.js` - 提示词审核服务
  - `canvas-service.js` - 画布服务
  - `generation-queue-runner.js` - 生成队列
  - `prompt-source-sync.js` - 提示词源同步

**前端已拆分：**
- ✅ `public/canvas-*.js` - 画布模块（10+ 个独立文件）
- ✅ `public/admin-*.js` - 后台模块（5+ 个独立文件：`admin-overview.js`、`admin-users.js`、`admin-providers.js`、`admin-gallery.js`、`admin-generation-diagnostics.js` 等）
- ✅ `public/gallery-*.js` - 画廊模块（4+ 个独立文件：`gallery-normalize.js`、`gallery-leaderboard.js`、`gallery-detail-media.js`、`gallery-tag-view-model.js` 等）

### 1.3 已有质量保证

- ✅ 80+ smoke tests (`scripts/smoke/`)
- ✅ 语法检查工具
- ✅ Git diff 检查
- ✅ 本地和线上测试流程

---

## 2. 已完成里程碑

### Milestone 1：画廊可靠性与榜单基础 ✅

**完成时间：** 2026-05-19
**任务范围：** AIS-RLS-001 ~ AIS-RLS-007

**交付成果：**
- 画廊图片兜底处理
- 缺失文件检测与自动删除
- 图片 URL 归一化
- 榜单数据结构统一
- 画廊与榜单同步
- 代理图片访问
- 详情页路由修复

**验收状态：** ✅ 通过线上 smoke 验证

### Milestone 2：提示词库与远程提示词数据 ✅

**完成时间：** 2026-05-20
**任务范围：** AIS-RLS-008 ~ AIS-RLS-014

**交付成果：**
- 提示词分类系统
- 远程提示词源同步
- 无封面提示词处理
- 点赞系统
- 四种排序（热门/最新/常用/最赞）
- 提示词重复治理（规则 + 大模型 mock 审核）
- 人工保留动作

**验收状态：** ✅ 通过线上 smoke 验证

### Milestone 3：画布工作台 MVP ✅

**完成时间：** 2026-05-20
**任务范围：** AIS-RLS-015 ~ AIS-RLS-025

**交付成果：**
- 画布入口与导航
- 数据库表结构（`canvas_projects`、`canvas_generation_links`）
- 基础交互（平移、缩放、拖拽）
- 节点系统（图片、文本、提示词、生成配置、输出）
- 连线系统
- 全站画布集成
- 生成接口
- 自动保存与草稿恢复
- 广场发布

**验收状态：** ✅ 通过线上 smoke 验证

### Milestone 4：画布增强与广场线路 ⚠️ Partial

**完成时间：** 2026-05-20（部分完成）
**任务范围：** AIS-RLS-026 ~ AIS-RLS-032、AIS-RLS-039

**已完成：**
- ✅ AIS-RLS-026：小地图（`public/canvas-minimap.js`）
- ✅ AIS-RLS-027：撤销/重做/复制粘贴（`public/canvas-history.js`）
- ✅ AIS-RLS-028：框选/多选/分组（`public/canvas-selection.js`）
- ✅ AIS-RLS-029：JSON 导入导出（`src/canvas-import-export.js`）
- ✅ AIS-RLS-030：画布助手（`src/canvas-assistant.js`）
- ✅ AIS-RLS-031：公开画布线路复制（`POST /api/canvases/:id/duplicate`，广场详情按钮）
- ✅ AIS-RLS-032：画布模板市场（`is_template` 字段/模板列表页/一键从模板创建）

**未完成：**
- ⏳ AIS-RLS-039：画布模块边界与反单文件治理

### Milestone 5：后台管理与运营能力 ✅

**完成时间：** 2026-05-20
**任务范围：** AIS-RLS-033 ~ AIS-RLS-038

**已完成：**
- ✅ AIS-RLS-033：管理员首页重构（独立 shell + 左侧导航 + 总览/生成请求/广场审核/用户积分/提示词 CMS/标签库/举报撤回/通知公告/系统设置/审计日志 15 个导航项）
- ✅ AIS-RLS-034：用户管理与积分奖励（用户列表过滤/角色修改/积分调整/首次公开奖励逻辑/奖励弹窗通知）
- ✅ AIS-RLS-035：标签管理与合并（标签种子数据/中文名/别名/排序/颜色/合并 JSON 迁移）
- ✅ AIS-RLS-036：广场内容审核与撤回管理（撤回申请审批/作品下架恢复/审核日志记录）
- ✅ AIS-RLS-037：公告与弹窗通知完善（站内通知/登录弹窗/未读确认/公告预览）
- ✅ AIS-RLS-038：开发与上线 QA 清单（80+ smoke tests / 语法检查 / 部署验证流程）

**说明：** 后台核心功能已上线并通过线上 smoke，部分页面（如用户详情 drawer 点击行为、批量操作 UI）可在后续 P2 阶段继续打磨细节。

---

## 3. 历史 Backlog 与后续提案（已由 Trellis 校准）

本节保留早期 Ready/Backlog 拆分和技术方案，方便回看设计意图。当前任务完成状态以 `PROJECT_PROGRESS_STATUS.md`、`IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md` 和真实 Trellis 目录为准；不要从本节旧状态判断项目是否仍待开工。

### 3.1 Milestone 6：新增体验回归与外部提示词源

#### AIS-RLS-040：文生图生成中闪屏修复 🔥 P0

**优先级：** P0
**标签：** `frontend`, `qa`
**依赖：** 无
**状态：** Ready

**问题描述：**
用户发起文生图后，创作界面出现明显闪动，疑似生成状态、历史列表、composer 或路由 class 被反复重渲染/切换。

**处理方向：**
生成开始后必须保持当前视图、composer 和历史列表 DOM 稳定；只更新生成状态条、计时器和当前占位卡。

**技术方案：**
1. 在 `app.js` 中生成开始时不调用 `setView()` 切换视图
2. 保持历史列表容器稳定，只更新内容
3. Composer 组件保持挂载状态
4. 使用局部 DOM 更新而非重渲染

**交付物：**
- [ ] 识别闪屏触发的代码位置
- [ ] 重构生成状态更新逻辑
- [ ] 添加 smoke test 验证 DOM 稳定性

**验收标准：**
- 生成开始后 composer 位置不跳变
- 历史列表不重新渲染
- 页面滚动位置保持不变
- 轮询更新不影响视觉稳定性

---

#### AIS-RLS-042：文生图结果按钮收口 🔥 P0

**优先级：** P0
**标签：** `frontend`, `gallery`
**依赖：** AIS-RLS-040
**状态：** Ready

**问题描述：**
结果卡同时显示 `再次生成 / 保存 / 加入画布 / 改提示词 / 更多`，操作密度过高。

**处理方向：**
结果卡常驻动作最多 3 个；保留 `再次生成`、`下载/保存`、`更多`，把 `加入画布`、`改提示词`、`图生图`、`复制提示词` 收进更多菜单。

**技术方案：**
```javascript
// public/app.js 中生成结果卡片渲染
function renderResultActions(generation) {
  const primaryActions = [
    { label: text('retry'), action: () => retryGeneration(generation) },
    { label: text('download'), action: () => downloadImage(generation) }
  ];

  const moreActions = [
    { label: text('addToCanvas'), action: () => addToCanvas(generation) },
    { label: text('editPrompt'), action: () => editPrompt(generation) },
    { label: text('copyPrompt'), action: () => copyPrompt(generation) }
  ];

  // 渲染逻辑
}
```

**交付物：**
- [ ] 统一结果操作条组件
- [ ] 更多菜单 UI
- [ ] 烟雾测试

**验收标准：**
- 常驻按钮 ≤ 3 个
- 更多菜单统一样式
- 移动端适配良好

---

#### AIS-RLS-044：画廊详情主图联动修复 🔥 P0

**优先级：** P0
**标签：** `frontend`, `gallery`
**依赖：** AIS-RLS-007, AIS-RLS-024
**状态：** Ready

**问题描述：**
点击创作路线条目后，左侧大图不再跟随切换；图生图作品点击 `输入图` / `结果图` 也应该切换主展示图。

**技术方案：**
```javascript
// public/gallery-detail-media.js
const galleryDetailState = {
  selectedMedia: {
    kind: 'result', // 'source' | 'result' | 'route-step'
    id: '',
    imageUrl: '',
    label: '',
    generationId: ''
  },
  // ...其他状态
};

function selectMedia(kind, id, imageUrl, label, generationId) {
  galleryDetailState.selectedMedia = { kind, id, imageUrl, label, generationId };
  renderMainImage();
  updateActiveStyles();
}
```

**交付物：**
- [ ] 统一 `selectedMedia` 状态
- [ ] 路线点击切换主图
- [ ] 图生图输入/结果切换
- [ ] 状态样式同步

**验收标准：**
- 点击路线条目主图切换
- 点击输入图/结果图主图切换
- 选中状态样式一致
- 不触发详情页重新加载

---

#### AIS-RLS-045：画廊卡片标签去重与用户标签展示 🔥 P0

**优先级：** P0
**标签：** `frontend`, `gallery`
**依赖：** AIS-RLS-007, AIS-RLS-024, AIS-RLS-035
**状态：** Ready

**问题描述：**
未打开详情时，卡片上出现两个 `图生图` / `文生图`，没有展示用户设置的标签。

**技术方案：**
```javascript
// public/gallery-card-tags.js
function renderGalleryCardTags(item) {
  // 类型徽标（只显示一次）
  const kindBadge = item.kind === 'image-to-image' ? '图生图' : '文生图';

  // 用户/管理员标签
  const userTags = item.publicTags || [];

  // Admin 徽标
  const adminBadge = item.isAdmin ? '管理员' : '';

  return {
    kindBadge,
    userTags,
    adminBadge
  };
}
```

**交付物：**
- [ ] 分离类型徽章和用户标签
- [ ] 卡片标签去重逻辑
- [ ] 烟雾测试验证

**验收标准：**
- 类型徽标只显示一次
- 用户标签正确展示
- 与详情页标签一致

---

#### AIS-RLS-041：画廊榜单侧栏化与点赞按钮优化 📊 P1

**优先级：** P1
**标签：** `frontend`, `gallery`
**依赖：** 无
**状态：** Ready

**问题描述：**
榜单当前像普通内容块，缺少稳定信息架构；点赞按钮视觉突兀。

**技术方案：**
- 榜单改为画廊侧栏式信息架构
- 右侧或抽屉展示日榜/周榜/月榜/总榜
- 榜单卡片点赞按钮改成统一 icon-only 或紧凑 icon+数字样式

**交付物：**
- [ ] 侧栏布局组件
- [ ] 移动端抽屉适配
- [ ] 统一点赞按钮样式

**验收标准：**
- 桌面端右侧侧栏
- 移动端底部抽屉
- 四个榜单维度可切换
- 点赞按钮样式统一

---

#### AIS-RLS-043：接入 infinite-canvas 提示词源到画廊 🔗 P1

**优先级：** P1
**标签：`prompt`, `gallery`
**依赖：** 无
**状态：** Ready

**问题描述：**
当前已接入外部提示词源框架，但未接入 `basketikun/infinite-canvas` 作为默认提示词源。

**技术方案：**
1. 在 `prompt_sources` 表中新增记录
2. 实现 GitHub parser 适配
3. 解析提示词库、分组、封面/结果图
4. 写入 `prompts` 表

**交付物：**
- [ ] 新增 prompt source 记录
- [ ] GitHub 解析器
- [ ] 同步脚本
- [ ] 画廊展示集成

**验收标准：**
- 可成功同步 infinite-canvas 提示词
- 画廊中显示来源标识
- 画布可插入这些提示词

---

#### AIS-RLS-046：画廊展示与输入体验综合修复 🎨 P0

**优先级：** P0
**标签：** `frontend`, `gallery`
**依赖：** AIS-RLS-041, AIS-RLS-043, AIS-RLS-044, AIS-RLS-045
**状态：** Ready

**问题描述：**
综合修复画廊展示和输入体验，集成上述任务。

**交付物：**
- [ ] 统一画廊视觉规范
- [ ] 响应式布局优化
- [ ] 综合验收测试

---

### 3.2 后台功能后续增强项

以下模块已在 Milestone 5 中上线并通过 smoke 验证，本节仅列出后续 P2 阶段的细节打磨项。

#### AIS-RLS-033：管理员首页重构 ✅ 已上线

**状态：** Done
**当前实现：** 独立 `/admin` hash 路由 shell，左侧 15 项导航（总览/API 供应商/生成请求/广场审核/文件巡检/用户与积分/提示词 CMS/Prompt Audit/标签库/举报与撤回/增长配置/通知公告/系统设置/RUM性能/审计日志），顶部指标卡，快捷入口。

**后续打磨项：**
- [ ] 详情 drawer 点击行为优化（部分页面仍是内联展开）
- [ ] 移动端侧栏折叠体验优化

---

#### AIS-RLS-034：用户管理与积分奖励 ✅ 已上线

**状态：** Done
**当前实现：** 用户列表/角色修改/积分调整/首次公开奖励逻辑/奖励弹窗通知。

**后续打磨项：**
- [ ] 用户详情 drawer（积分流水/奖励状态集中展示）
- [ ] 批量操作（批量启用/禁用/加积分）

---

#### AIS-RLS-036：广场内容审核与撤回管理 ✅ 已上线

**状态：** Done
**当前实现：** 撤回申请审批/作品下架恢复/审核日志记录。

**后续打磨项：**
- [ ] 批量操作（批量通过/隐藏/批准撤回）
- [ ] 举报处理流程串联

---

#### AIS-RLS-037：公告与弹窗通知完善 ✅ 已上线

**状态：** Done
**当前实现：** 站内通知管理/登录弹窗通知/未读确认/公告编辑与发布。

**后续打磨项：**
- [ ] 通知历史与已读追踪优化

---

### 3.3 画布优化任务

#### AIS-RLS-039：画布模块边界与反单文件治理 🔧 P1

**优先级：** P1
**标签：** `frontend`, `canvas`, `ops`
**依赖：** AIS-RLS-026, AIS-RLS-027, AIS-RLS-028, AIS-RLS-029, AIS-RLS-030
**状态：** Ready

**当前状态：**
- `public/canvas.js` 继续承载较多逻辑
- 渲染、检查器、键盘、工具栏仍可继续拆分

**技术方案：**
```
public/
├─ canvas.js              (仅保留主渲染循环和状态管理)
├─ canvas-render.js       (新增：渲染逻辑)
├─ canvas-inspector.js    (已存在)
├─ canvas-toolbar.js      (已存在)
├─ canvas-keyboard.js     (新增：键盘快捷键)
└─ canvas-utils.js        (新增：通用工具函数)
```

**交付物：**
- [ ] 拆分渲染逻辑
- [ ] 拆分键盘处理
- [ ] 提取工具函数
- [ ] 更新模块边界文档
- [ ] 烟雾测试验证

**验收标准：**
- `canvas.js` < 800 行
- 每个模块职责单一
- 无循环依赖
- 功能不受影响

---

#### AIS-RLS-047：画布工作台布局与连线系统重构 🎨 P2

**优先级：** P2
**标签：** `frontend`, `canvas`
**依赖：** AIS-RLS-039, AIS-RLS-046
**状态：** Backlog

**目标：**
提升画布工作台的整体可用性和美观度。

**交付物：**
- [ ] 布局系统重构
- [ ] 连线视觉优化
- [ ] 节点样式统一
- [ ] 响应式适配

---

### 3.4 移动端优化任务

#### AIS-RLS-055 ~ AIS-RLS-060：移动端 Web 一等体验 📱 P1

**优先级：** P1
**标签：** `frontend`, `mobile`
**状态：** Backlog（参考 `IMAGE_STUDIO_MOBILE_WEB_OPTIMIZATION_PLAN.md`）

**待完成：**
- AIS-RLS-055：移动端首屏优化
- AIS-RLS-056：移动端导航优化
- AIS-RLS-057：移动端生成流优化
- AIS-RLS-058：移动端画廊优化
- AIS-RLS-059：移动端编辑器优化
- AIS-RLS-060：移动端弹窗优化

### 3.5 用户奖励与内容审核任务 🔥 P1（历史提案，待重新编号）

> 2026-05-24 校准：下方曾暂用 `AIS-RLS-061` 到 `AIS-RLS-065` 作为奖励/审核提案编号，但真实 Trellis 中这些编号已用于 Agent/Queue 批次并已完成。下方内容只保留为功能提案，后续若实施必须重新分配新的 Trellis 编号，不能复用 `AIS-RLS-061` 到 `AIS-RLS-065`。

#### 待重新编号：灵活积分奖励配置系统 💎 P1

**优先级：** P1
**标签：** `admin`, `backend`, `rewards`
**依赖：** AIS-RLS-033
**状态：** Ready

**问题描述：**
当前积分规则硬编码在代码中，管理员无法调整。需要建立完整的奖励配置系统，支持：
- 首次公开作品奖励
- 作品点赞阶梯奖励
- 签到积分可配置
- 提示词发布奖励

**数据库设计：**
```sql
CREATE TABLE reward_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) NOT NULL UNIQUE,
  config_value JSON NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  INDEX idx_config_key (config_key)
);

-- 预设配置
INSERT INTO reward_configs VALUES
(1, 'first_public_reward', '{"enabled": true, "credits": 10, "withdrawal_hours": 12}', '首次公开作品奖励'),
(2, 'like_reward_tiers', '{"tiers": [{"likes": 10, "credits": 5}, {"likes": 50, "credits": 20}, {"likes": 100, "credits": 50}]}', '点赞阶梯奖励'),
(3, 'daily_checkin', '{"enabled": true, "credits": 1, "bonus_streak": [7, 14, 30]}', '每日签到'),
(4, 'prompt_publish_reward', '{"enabled": true, "min_quality_score": 70, "base_credits": 5, "quality_bonus": true}', '提示词发布奖励');
```

**后台配置界面：**
```
[奖励配置]
├─ 首次公开奖励
│  ├─ 启用开关
│  ├─ 奖励积分
│  └─ 撤回时间窗
├─ 点赞阶梯奖励
│  ├─ 阶梯配置
│  │  ├─ 达到 10 赞 → 奖励 5 积分
│  │  ├─ 达到 50 赞 → 奖励 20 积分
│  │  └─ 达到 100 赞 → 奖励 50 积分
│  └─ 发放延迟（避免频繁发放）
├─ 每日签到
│  ├─ 基础积分
│  └─ 连续签到奖励
└─ 提示词发布
   ├─ 启用开关
   ├─ 最低质量要求
   └─ 基础奖励
```

**交付物：**
- [ ] `reward_configs` 表及迁移脚本
- [ ] 后台奖励配置页面
- [ ] 奖励计算服务
- [ ] 积分发放任务（定时触发）
- [ ] 前端奖励提示

**验收标准：**
- 管理员可调整所有奖励规则
- 修改后立即生效
- 积分发放有完整记录
- 用户可查看奖励来源

---

#### 待重新编号：生成后发布引导与奖励提示 🎯 P1

**优先级：** P1
**标签：** `frontend`, `rewards`
**依赖：** AIS-RLS-061
**状态：** Ready

**问题描述：**
用户生成图片后，没有明确的发布引导和奖励说明，导致广场内容少，用户不知道可以获得奖励。

**交互设计：**
```
生成完成后显示引导卡片：
┌────────────────────────────────┐
│ 🎉 生成完成！                   │
├────────────────────────────────┤
│ 这张图很不错，考虑分享到广场吗？  │
│                                │
│ [预览图]                       │
│                                │
│ ✨ 分享奖励                     │
│ • 首次公开奖励 +10 积分         │
│ • 每 10 个点赞 +5 积分          │
│                                │
│ [稍后决定]  [发布到广场]       │
└────────────────────────────────┘
```

**前置条件检查：**
```javascript
function showPublishRewardDialog(generation) {
  // 检查是否已公开
  if (generation.isPublic) return;

  // 检查用户首次公开状态
  const isFirstPublic = !user.hasFirstPublicReward;

  // 检查图片质量（可选）
  const qualityScore = calculateQualityScore(generation);

  // 显示引导
  showDialog({
    generation,
    isFirstPublic,
    qualityScore,
    rewards: getRewardPreview(isFirstPublic)
  });
}
```

**奖励预览计算：**
```javascript
function getRewardPreview(isFirstPublic) {
  const config = getRewardConfig('like_reward_tiers');
  const tiers = config.tiers;

  return {
    immediate: isFirstPublic ? config.first_public_reward.credits : 0,
    potential: tiers.map(t => ({
      likes: t.likes,
      credits: t.credits
    }))
  };
}
```

**交付物：**
- [ ] 生成后引导卡片组件
- [ ] 奖励预览逻辑
- [ ] 质量评分算法（可选）
- [ ] 用户首次公开标记

**验收标准：**
- 生成后 3 秒显示引导
- 点击发布直接跳转到发布流程
- 清晰展示奖励规则
- 用户可选择"稍后决定"

---

#### 待重新编号：我的作品数量限制与管理 📁 P1

**优先级：** P1
**标签：** `frontend`, `backend`
**依赖：** AIS-RLS-033
**状态：** Ready

**问题描述：**
用户的作品列表无限增长，影响性能和用户体验。需要设置合理的数量限制，但公布到广场的作品不应计入限制（因为这些作品有内容价值）。

**数据库设计：**
```sql
CREATE TABLE storage_quotas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_level VARCHAR(32) NOT NULL DEFAULT 'free',
  max_private_works INT NOT NULL DEFAULT 50,
  max_public_works INT NOT NULL DEFAULT 9999,
  max_storage_mb INT NOT NULL DEFAULT 100,
  UNIQUE KEY uk_level (user_level)
);

-- 预设配额
INSERT INTO storage_quotas VALUES
(1, 'free', 50, 9999, 100),
(2, 'pro', 500, 9999, 1000),
(3, 'premium', 9999, 9999, 10000);

ALTER TABLE users ADD COLUMN storage_quota_id INT;
ALTER TABLE users ADD FOREIGN KEY (storage_quota_id) REFERENCES storage_quotas(id);
```

**逻辑实现：**
```javascript
// src/services/quota-service.js
function checkUserQuota(userId) {
  const quota = getUserQuota(userId);

  // 统计私有作品数（公开的不计入）
  const privateCount = db.query(
    'SELECT COUNT(*) as count FROM generations WHERE user_id = ? AND is_public = 0',
    [userId]
  );

  const storageUsed = db.query(
    'SELECT SUM(file_size) as total FROM generations WHERE user_id = ?',
    [userId]
  );

  return {
    privateUsed: privateCount.count,
    privateLimit: quota.max_private_works,
    privateRemaining: quota.max_private_works - privateCount.count,
    storageUsed: storageUsed.total,
    storageLimit: quota.max_storage_mb * 1024 * 1024,
    storageRemaining: (quota.max_storage_mb * 1024 * 1024) - storageUsed.total
  };
}

function canCreateGeneration(userId) {
  const quota = checkUserQuota(userId);
  return quota.privateRemaining > 0;
}
```

**前端提示：**
```
我的作品页面顶部显示：
┌────────────────────────────────┐
│ 作品配额：35/50                │
│ ████████░░░░░░░░░░░░░░░░░░  │
│                                │
│ 💡 提示：发布到广场的作品    │
│    不占用配额，还能获得奖励   │
└────────────────────────────────┘
```

**配额超限处理：**
```
当用户尝试生成但配额已满时：
┌────────────────────────────────┐
│ 配额已满                        │
│                                │
│ 你的私有作品已达到上限 (50)   │
│                                │
│ 解决方案：                      │
│ • 删除不需要的作品              │
│ • 发布到广场（不占配额）        │
│ • 升级账户                      │
│                                │
│ [管理作品]  [发布到广场]       │
└────────────────────────────────┘
```

**交付物：**
- [ ] `storage_quotas` 表
- [ ] 配额检查服务
- [ ] 前端配额显示组件
- [ ] 配额超限提示
- [ ] 批量删除工具

**验收标准：**
- 私有作品有数量限制
- 公开作品不计入限制
- 配额实时显示
- 超限时有明确提示

---

#### 待重新编号：提示词 AI 质量审核与奖励 🤖 P1

**优先级：** P1
**标签：** `admin`, `backend`, `ai`
**依赖：** AIS-RLS-033, AIS-RLS-061
**状态：** Ready

**问题描述：**
当前提示词审核主要用于查重（AIS-RLS-014），缺少质量审核。需要建立 AI 质量审核系统，判断提示词是否值得发布到广场，并给予相应的积分奖励。

**数据库设计：**
```sql
CREATE TABLE prompt_quality_audits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prompt_id INT NOT NULL,
  user_id INT NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  audited_at TIMESTAMP NULL,
  audit_status ENUM('pending', 'approved', 'rejected', 'needs_review') DEFAULT 'pending',
  quality_score INT NULL,
  ai_analysis JSON NULL,
  ai_model VARCHAR(64) NULL,
  reward_credits INT NULL,
  reward_status ENUM('pending', 'granted', 'rejected') NULL,
  granted_at TIMESTAMP NULL,
  auditor_id INT NULL,
  INDEX idx_prompt_id (prompt_id),
  INDEX idx_status (audit_status),
  INDEX idx_user_id (user_id)
);

CREATE TABLE ai_audit_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) NOT NULL UNIQUE,
  api_endpoint VARCHAR(512) NOT NULL,
  api_key VARCHAR(512) NOT NULL,
  model_name VARCHAR(128) NOT NULL,
  prompt_template TEXT NOT NULL,
  quality_threshold INT NOT NULL DEFAULT 70,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**AI 审核接口设计：**
```javascript
// src/services/prompt-quality-audit.js
async function auditPromptQuality(prompt) {
  const config = getAuditConfig();

  const auditPrompt = `
你是一个专业 AI 提示词质量审核员。请对以下提示词进行评估：

提示词标题：${prompt.title}
提示词内容：${prompt.prompt}
分类标签：${prompt.tags.join(', ')}

请从以下维度评分（0-100）：
1. 原创性：是否具有独特的创意和视角
2. 实用性：是否能生成高质量、有用的图片
3. 描述清晰度：提示词描述是否清晰明确
4. 结构完整度：是否包含必要的参数和结构
5. 创新价值：是否对社区有价值

输出 JSON 格式：
{
  "originality": <分数>,
  "usability": <分数>,
  "clarity": <分数>,
  "completeness": <分数>,
  "innovation": <分数>,
  "overall_score": <加权总分>,
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["缺点1", "缺点2"],
  "suggestions": ["建议1", "建议2"],
  "recommendation": "approve|reject|needs_review",
  "reward_tier": "none|low|medium|high"
}
`;

  const response = await callAI(config.api_endpoint, config.api_key, config.model_name, auditPrompt);

  return parseAIResponse(response);
}
```

**后台 AI 审核配置：**
```
[AI 审核配置]
├─ 质量审核
│  ├─ 启用开关
│  ├─ API 端点
│  ├─ API Key
│  ├─ 模型名称
│  ├─ 质量阈值
│  └─ Prompt 模板
├─ 奖励配置
│  ├─ 高质量 (90+) → 15 积分
│  ├─ 中等质量 (70-89) → 8 积分
│  └─ 基础质量 (50-69) → 3 积分
└─ 自动审核
   ├─ 自动通过阈值
   ├─ 自动拒绝阈值
   └─ 人工审核范围
```

**审核流程：**
```
用户提交提示词
    ↓
创建待审核记录
    ↓
调用 AI 审核
    ↓
根据分数判断：
  - ≥90：自动通过 + 高奖励
  - 70-89：自动通过 + 中等奖励
  - 50-69：自动通过 + 基础奖励
  - <50：需要人工审核
  - <30：自动拒绝
    ↓
记录审核结果
    ↓
（自动通过时）发放奖励
    ↓
（需要人工时）进入管理员审核队列
    ↓
管理员最终决定
```

**管理员审核界面：**
```
[提示词审核队列]
┌─────────────────────────────────────┐
│ 提示词：赛博朋克城市夜景             │
│ 提交者：user@example.com             │
│                                     │
│ AI 评分：85/100                      │
│                                     │
│ 评分详情：                           │
│ 原创性：████████░░░░░ 80            │
│ 实用性：█████████░░░░ 90            │
│ 清晰度：████████░░░░░ 85            │
│ 完整度：██████████░░░ 85            │
│ 创新价值：███████░░░░░ 80            │
│                                     │
│ AI 分析：                           │
│ 优点：- 描述详细，包含多个风格词    │
│      - 光线和视角设定清晰           │
│ 缺点：- 可加入更多具体场景描述      │
│ 建议：- 建议添加时间段和天气细节    │
│                                     │
│ 奖励预估：中等 (8 积分)             │
│                                     │
│ [通过并奖励]  [通过无奖励]  [拒绝] │
└─────────────────────────────────────┘
```

**交付物：**
- [ ] `prompt_quality_audits` 表
- [ ] `ai_audit_configs` 表
- [ ] AI 审核服务
- [ ] 后台 AI 配置页面
- [ ] 后台审核队列界面
- [ ] 审核状态追踪
- [ ] 奖励自动发放

**验收标准：**
- AI 审核可用
- 管理员可配置 AI 参数
- 评分合理且有据可查
- 奖励发放准确
- 人工审核队列可用

---

#### 待重新编号：原创作品综合奖励机制优化 🏆 P1

**优先级：** P1
**标签：** `rewards`, `gameification`
**依赖：** AIS-RLS-061, AIS-RLS-062, AIS-RLS-064
**状态：** Ready

**问题描述：**
需要建立一个综合性的原创作品奖励机制，鼓励用户创作高质量内容。该机制应包含多种激励维度，既奖励创作行为，也奖励内容质量。

**奖励维度设计：**

**1. 基础创作奖励**
```
- 每日首次生成：+1 积分
- 完成连续创作：+5 积分（连续 3 天）
```

**2. 首次公开奖励**
```
- 首张公开作品：+10 积分
- 作品保留 12 小时未撤回：奖励正式到账
```

**3. 内容质量奖励**
```
- AI 审核评分 ≥90：+15 积分
- AI 审核评分 70-89：+8 积分
- AI 审核评分 50-69：+3 积分
```

**4. 社区认可奖励**
```
- 作品获 10 赞：+5 积分
- 作品获 50 赞：+20 积分
- 作品获 100 赞：+50 积分
- 提示词获 10 赞：+8 积分
- 提示词获 50 赞：+30 积分
```

**5. 原创度奖励**
```
- 提示词查重通过且原创性高：额外 +5 积分
- 画布线路首次公开：额外 +10 积分
```

**6. 特殊奖励**
```
- 本周最佳作品：+100 积分（管理员评选）
- 月度最佳创作者：+200 积分
- 年度最佳创作者：+500 积分
```

**防刷机制：**

**1. 同设备/IP 限制**
```javascript
function checkAbuse(userId, action) {
  const deviceId = getDeviceId();
  const ip = getClientIp();

  // 检查短时间内同 IP 的多个账号
  const recentAccounts = db.query(`
    SELECT COUNT(*) as count
    FROM users
    WHERE ip_address = ?
    AND created_at > NOW() - INTERVAL 1 HOUR
  `, [ip]);

  if (recentAccounts.count > 3) {
    return { allowed: false, reason: 'ip_limit' };
  }

  // 检查重复点赞行为
  const recentLikes = db.query(`
    SELECT COUNT(*) as count
    FROM prompt_likes
    WHERE user_id = ?
    AND created_at > NOW() - INTERVAL 1 MINUTE
  `, [userId]);

  if (recentLikes.count > 10) {
    return { allowed: false, reason: 'rate_limit' };
  }

  return { allowed: true };
}
```

**2. 异常检测**
```javascript
// 检测异常行为模式
function detectAnomalousBehavior(userId) {
  const patterns = [
    // 短时间内大量点赞
    checkSpamLikes(userId),
    // 重复发布相似内容
    checkDuplicateContent(userId),
    // 短时间内大量创建作品
    checkRapidGeneration(userId),
    // 疑似刷赞行为（互赞群）
    checkReciprocalLikes(userId)
  ];

  const suspicious = patterns.filter(p => p.isSuspicious);

  if (suspicious.length > 0) {
    flagUserForReview(userId, suspicious);
    return true;
  }

  return false;
}
```

**3. 奖励冷却期**
```javascript
// 防止短时间内重复获得奖励
function checkRewardCooldown(userId, rewardType) {
  const lastReward = db.query(`
    SELECT created_at FROM credit_ledger
    WHERE user_id = ?
    AND reason = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId, rewardType]);

  if (lastReward) {
    const elapsed = Date.now() - lastReward.created_at.getTime();
    const cooldown = getCooldownPeriod(rewardType); // 如 1 小时

    if (elapsed < cooldown) {
      return false;
    }
  }

  return true;
}
```

**用户激励界面：**

**作品详情奖励预览：**
```
┌─────────────────────────────────────┐
│ 当前奖励进度                        │
│                                     │
│ 点赞数：45/50                       │
│ █████████████████░░░░░░░░░ 90%     │
│ 奖励：20 积分（还差 5 赞解锁）     │
│                                     │
│ 质量评分：85/100                    │
│ 奖励：8 积分（已发放）              │
│                                     │
│ 已获得奖励：18 积分                 │
│ 预计可获得：28 积分                 │
└─────────────────────────────────────┘
```

**用户奖励仪表板：**
```
[我的奖励]
┌─────────────────────────────────────┐
│ 本周获得奖励：128 积分              │
│ 较上周：+35% 🔼                     │
│                                     │
│ 奖励来源：                          │
│ • 首次公开奖励：10 积分             │
│ • 点赞奖励：45 积分                 │
│ • 提示词奖励：20 积分               │
│ • 每日签到：7 积分                  │
│ • 质量奖励：30 积分                 │
│ • 其他：16 积分                     │
│                                     │
│ 待到账奖励：                        │
│ • 首次公开：10 积分（需保留 8 小时）│
│                                     │
│ [查看明细]  [获取更多奖励]         │
└─────────────────────────────────────┘
```

**数据库设计：**
```sql
CREATE TABLE reward_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  generation_id INT,
  prompt_id INT,
  reward_type VARCHAR(64) NOT NULL,
  current_milestone INT NOT NULL DEFAULT 0,
  next_milestone INT NOT NULL,
  next_reward INT NOT NULL,
  target_value INT NOT NULL,
  current_value INT NOT NULL DEFAULT 0,
  achieved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_target (user_id, generation_id)
);
```

**交付物：**
- [ ] 奖励维度完整实现
- [ ] 防刷机制
- [ ] 奖励进度追踪
- [ ] 用户激励界面
- [ ] 后台奖励监控
- [ ] 异常检测与风控

**验收标准：**
- 所有奖励维度可用
- 防刷机制有效
- 奖励发放准确及时
- 用户能清晰看到奖励来源
- 异常行为可被检测和拦截

---

### 3.6 部署与运维任务（🆕 新提案）

#### 待重新编号：Docker 部署增强 🐳 P2

**优先级：** P2
**标签：** `ops`, `deployment`
**依赖：** 无
**状态：** Ready

**问题描述：**
当前项目已有 Docker 配置，但文档不够详细，需要完善部署文档和配置。

**Dockerfile 优化：**
```dockerfile
# 多阶段构建优化镜像大小
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建 Canvas v2（如果需要）
RUN npm run canvas:v2:build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm ci --only=production --production

# 复制构建产物
COPY --from=builder /app ./public
COPY --from=builder /app ./src
COPY --from=builder /app ./server.js ./
COPY --from=builder /app/package.json ./

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 3000

CMD ["node", "server.js"]
```

**docker-compose.yml 优化：**
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ai-image-studio-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - APP_VERSION=${APP_VERSION:-latest}
      - MYSQL_HOST=mysql
      - MYSQL_PORT=3306
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
      - MYSQL_DATABASE=${MYSQL_DATABASE}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - ai-image-studio
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mysql:
    image: mysql:8.0
    container_name: ai-image-studio-mysql
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${MYSQL_DATABASE}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"
    networks:
      - ai-image-studio
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  nginx:
    image: nginx:alpine
    container_name: ai-image-studio-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - ai-image-studio

  redis:
    image: redis:alpine
    container_name: ai-image-studio-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - ai-image-studio
    command: redis-server --appendonly yes

volumes:
  mysql-data:
  redis-data:

networks:
  ai-image-studio:
    driver: bridge
```

**部署文档内容：**
```markdown
# AI Image Studio 部署指南

## 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 内存
- 10GB 可用磁盘空间

## 快速部署

### 1. 克隆项目
\`\`\`bash
git clone https://github.com/Fengsuid/ai-image-studio.git
cd ai-image-studio
\`\`\`

### 2. 配置环境变量
\`\`\`bash
cp .env.example .env
# 编辑 .env 文件，配置数据库、API 等信息
\`\`\`

### 3. 启动服务
\`\`\`bash
docker-compose up -d
\`\`\`

### 4. 初始化数据库
\`\`\`bash
docker-compose exec app npm run db:init
\`\`\`

### 5. 验证部署
\`\`\`bash
curl http://localhost/api/health
\`\`\`

## 高级配置

### SSL 证书配置
...

### 备份策略
...

### 监控配置
...
```

**交付物：**
- [ ] 优化的 Dockerfile
- [ ] 完善的 docker-compose.yml
- [ ] 详细的部署文档
- [ ] .env.example 更新
- [ ] 健康检查配置
- [ ] 日志配置

**验收标准：**
- Docker 部署可一键完成
- 所有服务健康检查通过
- 持久化数据正确挂载
- 日志可查看
- 文档清晰可操作

---

## 4. 代码结构优化

### 4.1 server.js 继续拆分

**当前状态：** 5,488 行，已拆分部分路由和中间件

**建议拆分方案：**
```
src/
├─ routes/
│  ├─ admin.js          (新增：管理员路由)
│  ├─ canvas.js         (新增：画布路由)
│  ├─ images.js         (已存在)
│  ├─ gallery.js        (已存在)
│  ├─ prompts.js        (新增：提示词路由)
│  ├─ tags.js           (新增：标签路由)
│  ├─ auth.js           (已存在)
│  └─ health.js         (已存在)
├─ middleware/
│  ├─ session.js        (已存在)
│  ├─ csrf.js           (已存在)
│  ├─ rate-limit.js     (新增：速率限制)
│  └─ error-handler.js  (新增：错误处理)
├─ upload/
│  ├─ upload-handler.js      (新增：上传处理)
│  └─ image-validator.js     (新增：图片验证)
├─ config/
│  ├─ constants.js           (新增：常量定义)
│  └── env-validator.js      (新增：环境变量验证)
└─ server.js           (仅保留启动和路由注册)
```

**拆分原则：**
- 每个路由文件 < 500 行
- 独立的功能模块独立文件
- 共享代码提取到 `src/utils/`

### 4.2 app.js 模块化

**当前状态：** 7,268 行，需要继续拆分

**建议拆分方案：**
```
public/
├─ app.js                   (主入口，路由和全局状态)
├─ modules/
│  ├─ generation.js         (新增：生成模块)
│  ├─ composer.js           (新增：Composer 组件)
│  ├─ history.js            (新增：历史记录)
│  ├─ image-sessions.js     (已存在)
│  ├─ gallery.js            (已存在)
│  ├─ library.js            (新增：提示词库)
│  └─ works.js              (新增：我的作品)
├─ components/
│  ├─ result-card.js        (新增：结果卡片)
│  ├─ modal.js              (新增：通用弹窗)
│  ├─ toast.js              (新增：通用通知)
│  └─ loading.js            (新增：加载状态)
└─ utils/
   ├─ i18n.js               (新增：国际化)
   ├─ dom.js                (新增：DOM 工具)
   └─ format.js             (新增：格式化工具)
```

**拆分原则：**
- 按功能域拆分
- 组件化复用 UI
- 工具函数提取

### 4.3 admin.js 优化

**当前状态：** 2,044 行，相对合理

**建议优化：**
- 继续拆分各页面模块
- 建立统一的表格组件
- 提取表单验证逻辑

---

## 5. 功能补充路线图

### 5.1 短期优化（2-4 周）：Milestone 6 体验回归

**优先级：** P0

| 任务 | 优先级 | 预估时间 | 依赖 | 状态 |
|------|--------|----------|------|------|
| AIS-RLS-040：文生图闪屏修复 | P0 | 1-2 天 | - | Done |
| AIS-RLS-042：结果按钮收口 | P0 | 1 天 | 040 | Done |
| AIS-RLS-044：详情主图联动 | P0 | 1-2 天 | - | Done |
| AIS-RLS-045：标签去重展示 | P0 | 1 天 | - | Done |
| AIS-RLS-041：榜单侧栏化 | P1 | 2-3 天 | - | Done |
| AIS-RLS-043：infinite-canvas 源 | P1 | 3-5 天 | - | Done |
| AIS-RLS-046：画廊综合修复 | P0 | 2-3 天 | 041,043,044,045 | Done |

### 5.2 中期优化（1-2 月）：工程治理 + 奖励系统

**优先级：** P1

| 任务 | 优先级 | 预估时间 | 依赖 | 状态 |
|------|--------|----------|------|------|
| AIS-RLS-039：画布模块拆分 | P1 | 2-3 天 | - | Done |
| AIS-RLS-047：画布布局重构 | P2 | 5-7 天 | 039,046 | Done |
| 移动端优化 (AIS-RLS-055~060) | P1 | 10-15 天 | - | Done |
| 奖励配置系统 | P1 | 3-4 天 | - | 历史提案，待重新编号 |
| 生成后发布引导 | P1 | 2-3 天 | 奖励配置系统 | 历史提案，待重新编号 |
| 作品数量限制 | P1 | 2-3 天 | - | 历史提案，待重新编号 |
| 提示词 AI 质量审核 | P1 | 5-7 天 | 奖励配置系统 | 历史提案，待重新编号 |
| 综合奖励机制优化 | P1 | 5-7 天 | 奖励配置系统/发布引导/质量审核 | 历史提案，待重新编号 |

### 5.3 长期优化（3-6 月）

**优先级：** P2

| 功能模块 | 预估时间 | 说明 | 状态 |
|----------|----------|------|------|
| 真正任务队列 | 7-10 天 | 持久化状态，刷新可恢复 | Done：由 `AIS-RLS-061` 覆盖 |
| 提示词 embedding 召回 | 7-10 天 | 语义查重提升 | Backlog |
| 缩略图系统 | 5-7 天 | 性能优化 | Backlog |
| Docker 部署增强 | 3-5 天 | 部署一键化 | 历史提案，待重新编号 |
| CSP 正式模式 + 安全加固 | 3-5 天 | 生产环境安全 | Backlog |

> 历史提案若继续推进，需先检查当前 Trellis 最大编号并重新分配，不要复用已经落地的 `AIS-RLS-061` 到 `AIS-RLS-093`。

---

## 6. 性能优化

### 6.1 图片处理优化

**当前问题：**
- 无自动缩略图生成
- 大图直接加载影响性能
- 无响应式图片

**优化方案：**

```javascript
// 新增图片处理服务
// src/services/image-processor.js
class ImageProcessor {
  async generateVariants(imagePath) {
    const variants = {
      thumb: { width: 200, quality: 80 },
      small: { width: 400, quality: 85 },
      medium: { width: 800, quality: 90 },
      large: { width: 1200, quality: 95 }
    };

    // 生成各尺寸变体
  }

  async stripMetadata(imagePath) {
    // 清理 EXIF 等元数据
  }
}
```

**实施步骤：**
1. 安装依赖：`sharp` 或 `jimp`
2. 新增图片上传处理中间件
3. 自动生成缩略图
4. 添加响应式图片路由

### 6.2 前端性能优化

**当前问题：**
- 无图片懒加载
- 大列表无虚拟滚动
- 无 RUM 指标收集

**优化方案：**

```javascript
// 图片懒加载
function observeImages(container) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        observer.unobserve(img);
      }
    });
  });

  container.querySelectorAll('img[data-src]').forEach(img => {
    observer.observe(img);
  });
}

// 虚拟滚动（对于大列表）
class VirtualScroll {
  constructor({ container, itemHeight, renderItem }) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
  }

  render(items, offset = 0) {
    // 虚拟滚动实现
  }
}
```

### 6.3 缓存策略

**静态资源缓存：**
```javascript
// server.js 添加静态资源缓存头
server.on('request', (req, res) => {
  if (isStaticResource(req.url)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
});
```

**API 响应缓存：**
```javascript
// src/middleware/cache.js
function cacheMiddleware(ttl = 60) {
  return (req, res, next) => {
    if (shouldCache(req)) {
      const cached = cache.get(req.url);
      if (cached) {
        return res.json(cached);
      }
    }
    next();
  };
}
```

### 6.4 数据库优化

**索引优化：**
```sql
-- 确保关键字段有索引
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX idx_prompts_like_count ON prompts(like_count DESC);
CREATE INDEX idx_gallery_public ON generations(public) WHERE public = 1;
```

**查询优化：**
- 使用预编译语句
- 避免 SELECT *
- 合理使用 JOIN 和子查询

---

## 7. 工程化改进

### 7.1 测试覆盖

**当前状态：**
- ✅ 80+ smoke tests
- ❌ 无单元测试
- ❌ 无集成测试

**改进方案：**

```bash
# 安装测试框架
npm install --save-dev jest @types/jest

# 配置 Jest
# jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    'public/*.js',
    '!public/*.min.js'
  ]
};
```

**建议测试优先级：**
1. 核心业务逻辑（生成、认证、存储）
2. 工具函数（格式化、验证）
3. 关键 API 路由

### 7.2 类型安全

**方案一：JSDoc 类型注释（推荐，渐进式）**

```javascript
/**
 * @typedef {Object} Generation
 * @property {string} id
 * @property {string} userId
 * @property {string} prompt
 * @property {string} imageUrl
 * @property {number} creditCost
 * @property {'success'|'failed'|'pending'} status
 */

/**
 * @param {string} prompt
 * @param {Object} options
 * @returns {Promise<Generation>}
 */
async function generateImage(prompt, options) {
  // ...
}
```

**方案二：TypeScript（长期目标）**

```typescript
interface Generation {
  id: string;
  userId: string;
  prompt: string;
  imageUrl: string;
  creditCost: number;
  status: 'success' | 'failed' | 'pending';
}

async function generateImage(
  prompt: string,
  options: GenerationOptions
): Promise<Generation> {
  // ...
}
```

### 7.3 CI/CD 流程

**GitHub Actions 示例：**

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run smoke:public

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          # 部署脚本
```

### 7.4 代码质量工具

```bash
# ESLint
npm install --save-dev eslint eslint-plugin-node

# Prettier
npm install --save-dev prettier

# Husky + lint-staged
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

---

## 8. 移动端优化

### 8.1 响应式布局

**断点策略：**
```css
/* 移动端优先 */
.content {
  padding: 12px;
}

/* 平板 */
@media (min-width: 768px) {
  .content {
    padding: 16px;
  }
}

/* 桌面 */
@media (min-width: 1024px) {
  .content {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

### 8.2 触摸优化

```css
/* 增加触摸目标尺寸 */
.button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}

/* 防止双击缩放 */
button {
  touch-action: manipulation;
}
```

### 8.3 移动端导航

**底部导航栏：**
```html
<nav class="mobile-nav">
  <a href="#home" class="active">
    <i class="ri-home-line"></i>
    <span>首页</span>
  </a>
  <a href="#gallery">
    <i class="ri-gallery-line"></i>
    <span>画廊</span>
  </a>
  <a href="#canvas">
    <i class="ri-layout-grid-line"></i>
    <span>画布</span>
  </a>
  <a href="#works">
    <i class="ri-folder-line"></i>
    <span>作品</span>
  </a>
  <a href="#profile">
    <i class="ri-user-line"></i>
    <span>我的</span>
  </a>
</nav>
```

---

## 9. 架构演进建议

### 9.1 短期架构（当前 → 3 月）

**保持现有架构，优化细节：**
- 继续单服务器部署
- 完善代码模块化
- 补充测试和监控

### 9.2 中期架构（3-6 月）

**引入缓存和任务队列：**

```
┌─────────────┐
│   Nginx     │
└──────┬──────┘
       │
┌──────▼──────┐
│ Node.js     │ ◄─────┐
│  App        │       │
└──────┬──────┘       │
       │              │
┌──────▼──────┐  ┌────▼────┐
│   MySQL     │  │  Redis  │
└─────────────┘  └─────────┘
```

**新增组件：**
- Redis：缓存、会话存储、任务队列
- 消息队列：异步处理生成任务

### 9.3 长期架构（6-12 月）

**微服务化（可选）：**

```
┌─────────────┐
│   CDN       │ ← 静态资源、图片
└──────┬──────┘
       │
┌──────▼──────┐
│   Nginx     │ ← 反向代理、负载均衡
└──────┬──────┘
       │
  ┌────┴────┬──────────┬──────────┐
  │         │          │          │
┌─▼──┐   ┌─▼──┐    ┌─▼──┐    ┌─▼────┐
│API │   │Web │    │Job │    │Image │
│Svc │   │App │    │Svc │    │Svc   │
└─┬──┘   └─┬──┘    └─┬──┘    └─┬────┘
  │        │          │          │
  └────────┴──────────┴──────────┘
              │
      ┌───────▼───────┐
      │     MySQL     │
      └───────────────┘
```

**服务拆分：**
- API Service：核心业务 API
- Web App：前端应用
- Job Service：后台任务处理
- Image Service：图片处理和存储

### 9.4 可观测性

**结构化日志：**
```javascript
// src/utils/logger.js
function log(level, message, meta = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  }));
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta)
};
```

**RUM 指标收集：**
```javascript
// public/app.js
function reportWebVitals() {
  if (!window.performance) return;

  const perfData = performance.getEntriesByType('navigation')[0];
  const metrics = {
    lcp: perfData.loadEventEnd - perfData.fetchStart,
    ttfb: perfData.responseStart - perfData.fetchStart
  };

  fetch('/api/rum', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics)
  });
}
```

---

## 10. 安全加固

### 10.1 已实现

- ✅ CSRF 保护
- ✅ CSP Report-Only
- ✅ 会话管理
- ✅ 密码加密存储

### 10.2 待实施

**CSP 正式模式：**
```javascript
// server.js
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self'"
].join('; ');

server.on('request', (req, res) => {
  res.setHeader('Content-Security-Policy', CSP_DIRECTIVES);
});
```

**上传文件校验：**
```javascript
// src/upload/image-validator.js
function validateImage(buffer, mimetype) {
  const magicBytes = {
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/jpeg': [0xFF, 0xD8, 0xFF]
  };

  const expected = magicBytes[mimetype];
  if (!expected) return false;

  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false;
  }

  return true;
}
```

**速率限制：**
```javascript
// src/middleware/rate-limit.js
const rateLimit = new Map();

function rateLimitMiddleware(maxRequests = 10, windowMs = 60000) {
  return (req, res, next) => {
    const key = `${getClientIp(req)}:${req.path}`;
    const now = Date.now();

    if (!rateLimit.has(key)) {
      rateLimit.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const data = rateLimit.get(key);
    if (now > data.resetAt) {
      rateLimit.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (data.count >= maxRequests) {
      return httpError(res, 429, 'Too Many Requests');
    }

    data.count++;
    next();
  };
}
```

---

## 11. 验收清单总结

### 11.1 P0 验收（Milestone 6 完成）

- [ ] 文生图开始生成后不再闪屏
- [ ] 历史列表和 composer 保持稳定
- [ ] 结果卡常驻按钮 ≤ 3 个
- [ ] 更多菜单统一样式
- [ ] 画廊详情主图联动正常
- [ ] 画廊卡片标签正确展示
- [ ] 类型徽标只显示一次

### 11.2 P1 验收（中期完成）

- [ ] 独立 `/admin` 后台可用
- [ ] 后台所有功能从弹窗迁移
- [ ] 用户管理支持搜索/筛选/分页
- [ ] 广场审核完整流程可用
- [ ] 通知系统完整
- [ ] 榜单侧栏化完成
- [ ] infinite-canvas 提示词源接入
- [ ] 画布模块拆分完成
- [ ] 移动端基本体验可用

### 11.3 P2 验收（长期完成）

- [ ] 首次公开奖励完整流程
- [ ] 真正任务队列可用
- [ ] 广场审核状态机
- [ ] 提示词 embedding 召回
- [ ] 缩略图系统
- [ ] RUM 指标完整
- [ ] CI/CD 流程完整
- [ ] 测试覆盖率 > 60%

---

## 12. 风险与注意事项

### 12.1 技术债务

**当前主要技术债务：**
1. `app.js` 和 `server.js` 仍较大
2. 缺少单元测试
3. 缺少类型系统
4. 缺少错误追踪

**建议：**
- 优先拆分核心模块
- 渐进式增加测试
- 使用 JSDoc 作为过渡

### 12.2 性能风险

**当前性能瓶颈：**
1. 大图直接加载
2. 无缓存策略
3. 数据库查询未优化

**建议：**
- 优先实施缩略图
- 添加基础缓存
- 优化关键查询索引

### 12.3 兼容性

**浏览器支持目标：**
- 现代浏览器（Chrome 90+, Firefox 88+, Safari 14+, Edge 90+）
- 移动端（iOS 14+, Android 10+）

**注意事项：**
- 避免使用过新 API
- 添加 polyfill 如有必要
- 测试跨浏览器兼容性

---

## 附录 A：文件清单

### A.1 当前关键文件

| 文件 | 行数 | 状态 | 说明 |
|------|------|------|------|
| server.js | 5,488 | 需拆分 | 主服务器文件 |
| public/app.js | 7,268 | 需拆分 | 前端主文件 |
| public/admin.js | 2,044 | 合理 | 后台文件 |
| public/canvas.js | ~1,000 | 需拆分 | 画布主文件 |
| src/mysql-store.js | ~1,500 | 合理 | 数据存储层 |

### A.2 已拆分模块

**后端：**
- src/routes/*.js (5 文件)
- src/middleware/*.js (2 文件)
- src/stores/*.js (5 文件)
- src/services/*.js (5 文件)

**前端：**
- public/canvas-*.js (12 文件)
- public/admin-*.js (4 文件)
- public/gallery-*.js (4 文件)

---

## 附录 B：环境变量

### B.1 必需环境变量

```bash
# 服务器配置
PORT=3000
APP_VERSION=20260523-mobile-route-modal-v2

# 数据库配置
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=ai_image_studio
MYSQL_PASSWORD=change-me
MYSQL_DATABASE=ai_image_studio

# API 配置
AI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=<your-openai-api-key>

# 管理员配置
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
ADMIN_NAME=Admin

# 数据目录
DATA_DIR=./data
```

### B.2 可选环境变量

```bash
# 性能配置
MYSQL_CONNECTION_LIMIT=10
MAX_BODY_BYTES=33554432
OPENAI_FETCH_TIMEOUT_MS=120000

# 积分配置
CHECKIN_CREDIT=1
DEFAULT_CREDIT_COST=1
FIRST_PUBLIC_REWARD_CREDIT=2

# 撤回配置
PUBLIC_WITHDRAWAL_WINDOW_HOURS=12

# 队列配置
GENERATION_QUEUE_CONCURRENCY=1
GENERATION_QUEUE_ESTIMATE_SECONDS=90

# Canvas 配置
CANVAS_ENTRY_MODE=legacy # legacy | hidden
```

---

**文档结束**

*如有疑问，请参考以下文档：*
- `docs/IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md` - 统一总计划
- `docs/IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md` - 前后台设计
- `docs/IMAGE_STUDIO_RELLIS_TASKS.md` - 任务分配详情
- `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md` - QA 清单
