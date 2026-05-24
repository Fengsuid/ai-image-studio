# ai-image-studio 代码维护优化方案

更新：2026-05-24
前端美化专项方案见：`docs/IMAGE_STUDIO_FRONTEND_BEAUTIFICATION.md`

**状态校准：`AIS-RLS-067` 已完成；`AIS-RLS-070` 到 `AIS-RLS-093` 已完成前端/后端边界、样式拆分、可访问性、性能预算和视觉回归 QA 治理。当前本地 Trellis 无 active 任务。**

当前完成状态见 `docs/PROJECT_PROGRESS_STATUS.md`。本文件保留维护优化设计和后续补充队列。

---

## 一、问题文件现状（2026-05-23）

| 文件 | 当前行数 | 核心问题 |
|------|---------|---------|
| `public/app.js` | 7062 | 前端唯一主文件，路由/状态/渲染/API 全部堆在一起 |
| `server.js` | 5612 | 后端主入口，仍含大量业务路由逻辑 |
| `src/mysql-store.js` | 4814 | 数据层，大部分表的 CRUD 未拆分 |
| `public/styles.css` | 9276 | 样式按批次追加，无组件边界 |
| `public/admin.js` | 2203 | 后台管理前端，所有面板单文件 |
| `public/canvas.js` | 1197 | 画布主控，已部分拆出但仍是接线中心 |

---

## 二、`server.js` 拆分方案

**目标：** 精简为启动入口 + 中间件链 + 路由挂载，目标 < 600 行。

```
server.js
src/
├── routes/
│   ├── health.js          ✅ 已完成（/api/health、/api/version、/api/csp-report、/api/rum）
│   ├── agent-sessions.js  ✅ 已完成（/api/agent-sessions/*）
│   ├── auth.js            ✅ 已完成（登录/注册/登出/当前用户路由）
│   ├── images.js          ☐ 待做（生成图 CRUD、公开、文件服务）
│   ├── prompts.js         ☐ 待做（提示词 CRUD、点赞、AI 审核）
│   ├── canvases.js        ☐ 待做（画布 CRUD、生成、导入导出、助手）
│   ├── gallery.js         ✅ 已完成（公开画廊、详情、排行榜、点赞）
│   └── admin.js           ☐ 待做（后台管理 API）
├── middleware/
│   ├── session.js         ✅ 已完成（cookie、session、密码哈希、当前用户）
│   ├── csrf.js            ✅ 已完成（CSRF token/cookie 与写接口保护）
│   └── static.js          ☐ 待做（静态文件服务配置）
│
│   以下服务模块已提取，server.js 通过 require 调用：
├── generation-queue-runner.js    ✅ 内存队列调度、并发控制
├── generation-queue-recovery.js  ✅ DB-backed 队列恢复
├── generation-trace-service.js   ✅ 生成链路追踪与诊断
├── provider-mapping.js           ✅ Provider 能力映射与 submit/poll
├── agent-generation-service.js   ✅ Agent 批量生成服务
├── agent-planner.js              ✅ Agent 计划生成
├── canvas-service.js             ✅ 画布业务逻辑
├── canvas-assistant.js           ✅ 画布助手
├── canvas-import-export.js       ✅ 画布导入导出
├── prompt-review-service.js      ✅ 提示词审核
└── prompt-source-sync.js         ✅ 提示词源同步
```

**下一步优先级：** `src/routes/images.js` 或 `src/routes/admin.js`，每次只迁移一个端点族，迁移后立即跑对应 smoke。

---

## 三、`src/mysql-store.js` 拆分方案

**目标：** 精简为连接池 + 迁移 + 公共 helper，目标 < 500 行。

```
src/
├── mysql-store.js               → 保留 getPool()、runMigrations()、事务 helper
├── stores/
│   ├── tag-store.js             ✅ 已完成（gallery_tags、提示词分类种子、标签 CRUD/合并）
│   ├── agent-session-store.js   ✅ 已完成（agent_sessions、消息、步骤）
│   ├── user-store.js            ☐ 待做（users、sessions、credits）
│   ├── generation-store.js      ✅ 已完成（generation_requests、队列状态、trace/诊断）
│   ├── prompt-store.js          ✅ 已完成（prompts、来源同步、点赞、审核、重复候选）
│   ├── canvas-store.js          ☐ 待做（canvases、节点、连线、生成关联）
│   ├── gallery-store.js         ☐ 待做（公开列表、排行榜、举报）
│   └── admin-store.js           ☐ 待做（审计日志、公告、审批）
```

**拆分原则：** 各子 store 通过 `const { getPool } = require('../mysql-store')` 获取连接；对外函数签名不变，调用方的 `require` 路径更新即可。

---

## 四、`public/app.js` 拆分方案

**目标：** 精简为入口 + 路由分发 + 全局状态，目标 < 800 行。
**风险：** 前端无构建工具，需保证 script 加载顺序正确。

```
public/
├── app.js                  → 入口 + 路由分发 + 全局状态
├── app-auth.js             ☐ 登录/注册/会话/CSRF
├── app-generation.js       ☐ 文生图/图生图生成流程、参数面板
├── app-gallery.js          ☐ 画廊列表、筛选、分页、详情弹窗
├── app-session.js          ☐ 对话/会话列表、历史记录
├── app-prompt-library.js   ☐ 提示词库浏览、排序、点赞
├── app-settings.js         ☐ 用户设置、模型切换、偏好
│
│   以下模块已提取：
├── gallery-normalize.js         ✅ 卡片数据归一化
├── gallery-leaderboard.js       ✅ 排行榜视图
├── gallery-tag-view-model.js    ✅ 标签视图模型
├── gallery-detail-media.js      ✅ 详情媒体组件
├── generation-result-actions.js ✅ 生成结果操作
├── image-session-list.js        ✅ 图生图会话列表
├── editor-image-import.js       ✅ 编辑器图片导入
├── reference-images.js          ✅ 参考图管理
├── render-stamp.js              ✅ 渲染水印
├── prompt-cover-fallback.js     ✅ 提示词封面 fallback
└── canvas-*.js（9 个）          ✅ 画布各功能模块
```

**拆分原则：** 每个模块通过 `window.AppModules.xxx = { init, bindEvents }` 暴露接口；`app.js` 只负责初始化顺序和模块间通信。

---

## 五、`public/admin.js` 拆分方案

**目标：** 精简为后台 shell 初始化 + 面板路由，目标 < 400 行。

```
public/
├── admin.js                → shell 初始化 + 面板路由分发
├── admin-users.js          ☐ 用户列表、积分调整、详情 drawer
├── admin-generations.js    ☐ 生成请求列表、筛选、失败诊断
├── admin-prompts.js        ☐ 提示词 CMS、重复治理、来源管理
├── admin-gallery.js        ☐ 广场审核、举报处理
├── admin-providers.js      ☐ Provider 配置、能力矩阵
├── admin-tags.js           ☐ 标签库管理（已有后端，前端仍在 admin.js）
└── admin-settings.js       ☐ 系统设置、公告、审计日志
```

**拆分原则：** 与 `app.js` 相同，通过 `window.AdminModules.xxx` 暴露接口；每个面板模块独立加载，不影响其他面板。

---

## 六、`public/styles.css` 拆分方案

**目标：** 按视图/组件拆成独立文件，每文件 < 500 行，便于按模块维护。

```
public/css/
├── 00-tokens.css      ☐ CSS 变量 + 暗色模式变量
├── 01-reset.css       ☐ box-sizing / body / 基础标签
├── 02-typography.css  ☐ 标题/正文字体规范
├── 03-layout.css      ☐ 顶栏/侧栏/页面骨架
├── 04-components.css  ☐ 按钮/表单/弹窗/标签/toast
├── 05-home.css        ☐ 首页 + hero + composer
├── 06-gallery.css     ☐ 画廊/提示词卡片/排行榜
├── 07-editor.css      ☐ 图生图工作台
├── 08-chat.css        ☐ 文生图对话视图
├── 09-admin.css       ☐ 后台管理 shell + 面板
├── 10-canvas.css      ☐ canvas 相关覆盖
├── 11-mobile.css      ☐ 移动端断点覆盖
└── 12-animations.css  ☐ @keyframes + 微交互过渡
```

`styles.css` 保留为兼容入口（仅含 `@import`）；`index.html` 改为按顺序加载全部分片。
**注意：** 拆分前需确认无 agent 并行写 `styles.css`。

---

## 七、执行状态总览

| 文件 | 已完成 | 待完成 | 当前阶段 |
|------|--------|--------|---------|
| `server.js` | 服务模块全部提取；health、agent-sessions 路由提取 | auth/images/prompts/canvases/gallery/admin 路由；middleware | Phase 2 进行中 |
| `mysql-store.js` | tag-store、agent-session-store | user/generation/prompt/canvas/gallery/admin store | Phase 2 待启动 |
| `public/app.js` | canvas-*.js 及辅助模块提取 | app-auth/generation/gallery/session/prompt-library/settings | Phase 3 待启动 |
| `public/admin.js` | 无 | 全部面板模块 | Phase 3 待启动 |
| `public/styles.css` | 无 | 全部 CSS 模块 | Phase 2.5 待启动 |

---

## 八、执行原则

- **每次只迁移一个端点族或一个 store 域**，迁移后立即跑 smoke
- **验证清单：** `node --check` 所有修改文件 → `npm run smoke:public` → 相关功能域 smoke
- **提交前缀：** `refactor: extract <模块名> from <来源文件>`
- **不与功能 PR 同时进行同一文件**；若 agent 正在写某文件，等部署完成再拆

---

## 九、长期建议

1. **引入构建工具（esbuild）：** 让前端用标准 `import/export`，解除 script 加载顺序依赖，是 app.js/admin.js 拆分的根本出路。
2. **TypeScript 渐进迁移：** `canvas-v2` 已是现代架构，新模块建议用 TS，旧代码不强制迁移。
3. **单元测试：** 拆分后的各 store/route 天然适合单元测试，逐步补充。
4. **前端美化：** CSS 拆分（§六）是视觉升级的前提，详细方案见 `docs/IMAGE_STUDIO_FRONTEND_BEAUTIFICATION.md`。

---

## 十、建议追加任务（代码优化 + 前端美化）

> 下面任务可作为 `AIS-RLS-093` 之后的补充队列，按模块边界和视觉收益排序。

| 任务 ID | 任务标题 | 目标 |
|--------|----------|------|
| `ais-rls-094-frontend-token-system-polish` | 前端设计变量与组件边界统一 | 收敛颜色、间距、圆角、阴影变量，减少页面间视觉漂移 |
| `ais-rls-095-public-app-module-guardrails` | `public/app.js` 模块边界守卫 | 补齐 `AppModules` 初始化、加载顺序和 smoke 断言，降低后续拆分风险 |
| `ais-rls-096-public-css-shared-components-dedupe` | 公共样式组件抽取与去重 | 将按钮、卡片、表单、弹窗等重复样式收敛到共享分片 |
| `ais-rls-097-mobile-home-composer-polish` | 首页与创作区移动端体验优化 | 优化首屏层级、底部操作区、输入区和触控密度 |
| `ais-rls-098-gallery-detail-visual-density-polish` | 画廊详情页视觉密度优化 | 提升图片展示、信息层次、标签区和操作区的阅读效率 |
| `ais-rls-099-admin-shell-spacing-typography-polish` | 后台壳层间距与排版优化 | 统一后台标题、分组、表格、空状态和侧栏信息密度 |
| `ais-rls-100-frontend-performance-and-regression-budget` | 前端性能与回归预算 | 为首屏、脚本加载和关键页面建立性能预算与回归检查 |

**建议执行顺序：** `094 → 095 → 096 → 097 → 098 → 099 → 100`。
**执行原则：** 每次只做一个可验证的小步改动，先补 smoke，再补视觉基线，最后再扩展到下一项。
