# ai-image-studio 代码维护优化方案

更新：2026-05-24

前端美化专项方案见：`docs/IMAGE_STUDIO_FRONTEND_BEAUTIFICATION.md`

**当前状态**：该文件已重写，以反映第一阶段落地的成果。所有剩余任务已被转换到本地 Trellis `AIS-RLS-094` ~ `AIS-RLS-129` 中。

---

## 一、已落地成果 (Landed Work)

以下模块已经从以前的 God-file 中成功提取并落地运行：

### 1. 服务层与中间件落地
- `src/routes/health.js` (Line 1): 健康检查与基础诊断路由
- `src/routes/agent-sessions.js` (Line 1): Agent 会话通信相关
- `src/routes/auth.js` (Line 1): 认证、注册、用户状态
- `src/routes/gallery.js` (Line 1): 画廊核心公开路由
- `src/middleware/session.js` (Line 1): 会话校验中间件
- `src/middleware/csrf.js` (Line 1): CSRF 防御机制
- `src/generation-queue-runner.js` (Line 1): 核心内存生成队列
- `src/provider-mapping.js` (Line 1): 服务商能力映射

### 2. 数据层落地 (Store)
- `src/stores/tag-store.js` (Line 1): 标签检索与聚合
- `src/stores/agent-session-store.js` (Line 1): Agent 状态持久化
- `src/stores/generation-store.js` (Line 1): 生成状态与链路
- `src/stores/prompt-store.js` (Line 1): 提示词与审核

### 3. 前端逻辑边界落地
- `public/gallery-normalize.js` (Line 1): 画廊数据适配
- `public/gallery-leaderboard.js` (Line 1): 排行榜交互
- `public/generation-result-actions.js` (Line 1): 生成结果分享等操作
- `public/canvas-*.js` (多个文件): 画布 V2 全部拆分完成

---

## 二、真实剩余任务 (Remaining Queue)

后续的优化拆分工作已经在本地 Trellis 中注册为 P1/P2/P3 任务卡。以下是精简后的优先级队列（详见 Trellis 看板）。

### P1：核心架构拆解与安全护栏 (Phase B & C)
- **AIS-RLS-099**: Add ESLint 9 flat config + Prettier + npm run lint/check
- **AIS-RLS-100 ~ 104**: `server.js` 业务路由提取 (credits, settings, announcements, images)
- **AIS-RLS-105**: Split `src/routes/admin.js` into domains
- **AIS-RLS-106**: Convert mysql-store.js façade to programmatic re-export with collision check
- **AIS-RLS-107 ~ 108**: `public/app.js` 拆分提取 auth / settings
- **AIS-RLS-109**: Add GitHub Actions CI check workflow
- **AIS-RLS-110 ~ 111**: CSS 与 JS 构建流（合并、Content Hash、去掉手动 ?v=）
- **AIS-RLS-117**: Lazy-load admin.js and canvas.js on route entry
- **AIS-RLS-118**: Gradual enforce CSP via CSP_ENFORCE flag with hashed canary
- **AIS-RLS-123**: Add vitest with unit tests for pure domain functions
- **AIS-RLS-125**: Frontend JS error monitoring
- **AIS-RLS-126**: Lazy load module loading state machine with skeleton gate

### P2：前端打磨与产品特性拓展 (Phase C & D)
- **AIS-RLS-112 ~ 116**: 前端美化专项 (字体本地化、骨架屏、CSS 工具类、移动端 CSS 整合)
- **AIS-RLS-124**: Accessibility audit (aria coverage, keyboard nav, dark mode contrast)
- **AIS-RLS-127**: Database health check (slow query audit, pool config review)
- **AIS-RLS-120 ~ 122**: 多候选生成、参考图核心资产化、My-works 管理库升级

---

## 三、历史背景附录 (Appendix: Historical Context)

为保证阅读体验，原版 v1 的按模块 “拆分大纲” 以及老旧的历史统计数字已被归档。如果你需要参考初期的拆分解构思路和旧版的遗留列表，请查阅历史版本：

[历史版本存档：archive/CODE_MAINTENANCE_OPTIMIZATION_v1.md](file:///D:/生图广场/remote-edit/docs/archive/CODE_MAINTENANCE_OPTIMIZATION_v1.md)

请注意，后续所有的任务跟进以 `Trellis` 任务流以及 `PROJECT_PROGRESS_STATUS.md` 为唯一真实源。
