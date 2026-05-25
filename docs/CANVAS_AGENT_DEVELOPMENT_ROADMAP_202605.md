# 画布 + Agent 功能开发优化路线图（2026-05）

更新日期：2026-05-25
范围：`apps/canvas-v2/` 子应用 + `packages/canvas-core/`（待抽取）+ `public/agent/` 子应用 + `src/agent-*` 后端
状态：规划草案，对应任务卡待建（建议编号 AIS-RLS-147 起顺延）
关联：
- `docs/IMAGE_STUDIO_VISUAL_REDESIGN_202605.md`（视觉重设计 133~146，token / primitive 体系）
- `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md`（项目级 P0~P3 优先级语境）
- `docs/private/DEVELOPMENT_GUIDE.md`（闭环流程）

---

## 1. 现状盘点

### 1.1 Canvas

**前端：**
- 子应用 `apps/canvas-v2/`（独立 workspace、AGPL-3.0、自带 `check / build` 脚本、`src/` + `scripts/build.mjs`）
- 构建产物 `public/canvas-v2/assets/main.dfa44a9d4a6f.js + styles.4a62d9692cb1.css`（hash 命名）
- 入口 `public/canvas-v2/index.html`，独立挂载点 `[data-canvas-v2-root]`
- 旧版 v1 残留：`public/canvas.js`(1216 行) + 16 个 `canvas-*.js`(总 ~1640 行) + `public/css/10-canvas*.css`(916 行)

**后端：**
- `src/canvas-service.js`(531 行) — 工厂函数 `createCanvasService({ store, httpError, callOpenAIImages, saveGeneratedImages, … })`，18 个依赖注入项
- `src/routes/canvases.js`(116 行) — 工厂函数 `createCanvasesRoute({ canvasService, … })`，9 个 HTTP 端点
- `src/canvas-assistant.js`(252 行) + `src/canvas-import-export.js`(187 行)
- `src/stores/canvas-store.js` — 独立 store domain

**数据：**
- `canvas_projects` 表（FK → users.id；含 `is_template` / `visibility` / `status` 索引）
- `canvas_generation_links` 表（FK → canvas_projects + generations）

**测试：** 已有 12 个专项 smoke（`smoke:canvas-v2:static / editor / generation / entry`、`canvas-history / assistant / gallery-link / template-market / import-export / module-boundaries / layout-edges / selection`）

**任务推进：**
- 30 个画布任务全部 done（`015~032` + `039 / 043 / 047 / 048~054` + `066 / 069 / 085 / 086`）
- 唯一 ready：`AIS-RLS-117` Lazy-load admin.js + canvas.js（被 107/108 阻塞）

### 1.2 Agent

**前端：**
- 子应用 `public/agent/index.html` + `public/agent/assets/styles.49b263749fba.css`（结构与 canvas-v2 类似）
- 源码目录待确认（可能在 `apps/agent/` 或主项目 build 流水线内）

**后端：**
- `src/agent-generation-service.js`(457 行)
- `src/agent-planner.js`(181 行)
- `src/routes/agent-sessions.js`(380 行)
- `src/stores/agent-session-store.js`(253 行)

**数据：**
- `agent_sessions` 表（会话级）
- `agent_messages` 表（消息流）
- `agent_steps` 表（执行步骤）

**测试：** 仅 1 个 `smoke:agent-workspace`，且 `AIS-RLS-123` vitest 单元测试覆盖 `agent-planner` 尚未做

**任务推进：**
- 3 任务 done：`064` 数据模型、`065` workspace MVP、`066` batch generation + canvas export
- 1 任务待做（间接）：`123` vitest（含 agent-planner 单测）

---

## 2. 总体目标

让画布与 agent 两个子系统达到三件事：

1. **结构上**：从主项目剥离为可独立开发的 slice（前端 `apps/<sub>/` + 后端 `packages/<sub>-core/`），通过冻结的 `INTERFACE.md` 与主项目对接
2. **功能上**：补齐当前未覆盖的边界场景与异常恢复，提升健壮性
3. **视觉上**：通过 token 桥接消费主站三层架构（133~146），保证 dark mode / 移动端 / primitive 协调感统一

---

## 3. 结构优化（任务 P-Structure）

### 3.1 Canvas backend slice 抽取

**目标产物：** `packages/canvas-core/`

```
packages/canvas-core/
├── package.json                # workspace 成员，semver 独立
├── INTERFACE.md                # 契约文档（必须，见 §6）
├── README.md
├── src/
│   ├── service.js              # 从 src/canvas-service.js 迁移
│   ├── routes.js               # 从 src/routes/canvases.js 迁移
│   ├── store.js                # 从 src/stores/canvas-store.js 迁移
│   ├── assistant.js            # 从 src/canvas-assistant.js 迁移
│   └── import-export.js        # 从 src/canvas-import-export.js 迁移
├── schema/
│   └── 001-canvas-base.sql     # canvas_projects + canvas_generation_links DDL
└── tests/                      # vitest 单测（service / planner / import-export 纯函数）
```

**主项目 server.js 退化为 wiring：**
```js
const canvasCore = require("@ai-image-studio/canvas-core");
const canvasService = canvasCore.createService({ store, httpError, callOpenAIImages, ... });
const canvasRoutes = canvasCore.createRoutes({ canvasService, ... });
```

**约束：** 迁移期间禁止任何业务逻辑改动；仅做 require 路径与目录位置变更，保证可单 commit revert。

### 3.2 Agent backend slice 抽取

**目标产物：** `packages/agent-core/`

```
packages/agent-core/
├── package.json
├── INTERFACE.md
├── src/
│   ├── generation-service.js
│   ├── planner.js
│   ├── routes.js
│   └── session-store.js
├── schema/
│   └── 001-agent-base.sql      # agent_sessions / messages / steps DDL
└── tests/
```

### 3.3 Agent 前端子应用规范化

**目标：** 把 `public/agent/` 升级为与 `apps/canvas-v2/` 平行的源码结构：

```
apps/agent/
├── package.json
├── src/
├── scripts/
│   └── build.mjs
└── ...
```

构建出口仍为 `public/agent/assets/`，保留现有 URL 不变。这样画布 agent 与 agent feature agent 都能在 `apps/<name>/` 目录独立开发，主项目只关心产物投递。

---

## 4. 功能完善（任务 P-Feature）

### 4.1 Canvas 功能缺口

| 项 | 现状 | 建议补完 |
| --- | --- | --- |
| 节点并发生成 | 单节点串行 | 同层节点并行（≤ 3）+ 显式队列指示 |
| 上游图像引用循环检测 | 仅依赖前端 | 后端二次校验，拒绝 cycle |
| 大图工程导出 | JSON 导出已有 | 增加 ZIP（JSON + 引用图像）打包 |
| 模板市场 | 已有 | 增加"我的模板"私有标签 + 复用统计 |
| 协作 | 单人 | 暂不引入实时协作，但增加"复制到我的画布" + "fork 链路追踪" |
| 离线编辑 | 在线必须 | 增加本地草稿 (IndexedDB) + 重连后冲突合并 |
| 键盘快捷键 | 部分 | 全套快捷键 + cheat sheet 浮层（⇧?） |

### 4.2 Agent 功能缺口

| 项 | 现状 | 建议补完 |
| --- | --- | --- |
| 步骤回放 | 无 | 列表 + 时间线 + 单步重跑 |
| 中断恢复 | 重启即丢 | session 持久化 + resume 接口（agent_steps 已有表，缺接口） |
| 失败重试 | 一次性 | 指数退避自动重试 ≤ 3 次 + 手动重试 |
| 步骤间产物链接 | 仅 prompt | 输出图像作为下一步上游 ref |
| 用量与积分 | 整 session 扣 | 每步骤独立扣费 + 失败回退 |
| 导出 | 文本 | 完整 session JSON + 关联图像 ZIP |
| 工具调用 | 仅生图 | 预留 tool 接口（搜索 / 翻译 / 风格分析），不一定本期实现 |

---

## 5. 测试加强（任务 P-Test）

### 5.1 Canvas

**已有 smoke 12 个，缺口：**

| 缺项 | 建议 smoke | 优先级 |
| --- | --- | --- |
| 并发编辑冲突 | `smoke:canvas-concurrent-save` | P1 |
| 大图工程性能（节点 ≥ 50） | `smoke:canvas-large-project` | P2 |
| 移动端触摸交互 | `smoke:canvas-touch-gestures` | P2 |
| AGPL 合规 | `smoke:canvas-license-headers` | P1 |
| Token 消费桥（见 §7） | `smoke:canvas-v2-token-bridge` | P1 |

**vitest 单测目标：**
- `service.js` 纯函数（`cleanCanvasProjectInput` / 引用路径解析）覆盖率 ≥ 80%
- `import-export.js` round-trip 不变量

### 5.2 Agent

**当前仅 1 个 smoke，必须立即扩展：**

| 缺项 | 建议 smoke | 优先级 |
| --- | --- | --- |
| 计划生成与确认流程 | `smoke:agent-planner-flow` | P0 |
| 步骤失败重试 | `smoke:agent-retry` | P1 |
| 中断 + resume | `smoke:agent-resume` | P1 |
| 批量生成 + canvas 导出 | `smoke:agent-batch-export` | P1 |
| 积分按步骤扣费 | `smoke:agent-credit-per-step` | P0 |

**vitest 单测：** `agent-planner.js` 已是 `AIS-RLS-123` 的目标，本路线图把它从 `ready` 拉到 P0 优先级。

---

## 6. 接口契约（INTERFACE.md 必须冻结）

每个 slice 的 `INTERFACE.md` 必须包含 8 个字段，缺一不可：

1. **依赖注入清单** — 接收的所有依赖名称 + 类型 + 不可为空标记
2. **HTTP 端点表** — method + path + auth 要求 + req / res schema 简述
3. **DB schema** — 拥有的表 + 索引 + 外键依赖（指向哪个外部表）
4. **静态资产路径** — 出口目录 + HTML 入口 URL
5. **事件契约** — 该 slice 触发或消费的事件（如 canvas 触发"生成请求"消费 OpenAI client）
6. **配置项** — 通过环境变量或注入参数读取的所有配置
7. **不可破坏变更（SemVer Major）触发条件**
8. **测试边界** — 该 slice 自跑的 smoke / vitest 列表，主项目 CI 必须引用

### 6.1 Canvas INTERFACE.md 关键约束（草案）

- HTTP 前缀冻结：`/api/canvases/*` 共 9 端点
- 依赖注入 18 项不允许新增对主项目模块的 direct require
- DB 表：`canvas_projects`、`canvas_generation_links`；外键到 `users.id` / `generations.id` 必须保留
- 资产出口：`public/canvas-v2/assets/`；HTML：`public/canvas-v2/index.html`
- AGPL-3.0 license header 必须在每个 .js 顶部

### 6.2 Agent INTERFACE.md 关键约束（草案）

- HTTP 前缀冻结：`/api/agent-sessions/*`
- DB 表：`agent_sessions`、`agent_messages`、`agent_steps`；外键到 `users.id`
- 资产出口：`public/agent/assets/`；HTML：`public/agent/index.html`
- 消费主项目的 OpenAI client + 队列；不允许自带 provider client

---

## 7. 前端美化与三层架构对接

### 7.1 Token 消费桥

主站 133~146 的 token 在 `:root` 上注入。canvas-v2 与 agent 子应用必须通过 CSS 变量消费这些 token，而不是自带色板。

**做法：**
- 子应用入口 HTML 的 `<head>` 加 `<link rel="stylesheet" href="/css/00-tokens.css">` 与 `00-tokens-typography.css / 00-tokens-motion.css`
- 子应用 build 产物中所有 color / radius / shadow / font 改写为 `var(--brand-600)` 等
- 在 `<body>` 上注入 `data-app="canvas-v2"` 或 `data-app="agent"`，允许主站为子应用定制密度（参考 admin 的 `[data-density="compact"]` 模式）

### 7.2 移动端 / 暗色统一

- 子应用 modal / drawer / toast 必须接管主站 primitive 行为（移动端 bottom-sheet、`100svh`、`env(safe-area-inset-*)`）
- 子应用 dark mode 自动跟随主站 `[data-theme="dark"]`，不维护自己的切换状态

### 7.3 视觉资产清理

- v1 残留：`public/canvas.js`(1216) + 16 个 `canvas-*.js` + `public/css/10-canvas*.css`(916) 在 v2 完全稳定后归档到 `archive/canvas-v1-legacy-202605/`
- 归档时机：`AIS-RLS-117` lazy-load 完成 + canvas-v2 30 天无回归

---

## 8. 后端存储优化

### 8.1 Canvas 表

**问题：** `canvas_projects.data`（节点图 JSON）随节点数增长可能达 1MB+。

| 优化项 | 方案 |
| --- | --- |
| JSON 体积 | 拆 `canvas_projects.data` → `canvas_projects.meta`（小，索引用） + `canvas_project_payloads.data`（大表，懒加载） |
| 历史快照 | 新增 `canvas_project_snapshots`（限留最近 20 版），落地撤销 / 版本回退 |
| 引用图像 | 单独表 `canvas_node_images` 记录 node_id → image_url，便于清理孤立图 |
| 模板复用统计 | `canvas_projects` 增加 `fork_count` + `last_forked_at` 列 |

### 8.2 Agent 表

**问题：** `agent_messages` 与 `agent_steps` 随时间无界增长。

| 优化项 | 方案 |
| --- | --- |
| 冷数据归档 | 90 天以上未访问的 session 整体迁到 `agent_sessions_archive`（保留只读） |
| 步骤产物外链 | `agent_steps.output_blob` 大字段拆到 `agent_step_outputs`，避免全表扫慢 |
| 索引补完 | `agent_messages (session_id, created_at)`、`agent_steps (session_id, step_no)` |
| 软删除 | 现状假设直删；改为 `deleted_at` 软删除 + 周期清理 job |

### 8.3 通用

- 引入 `migrations/` 目录由 `packages/<slice>-core/schema/` 的 DDL 自动汇编，主项目 init 时执行
- 不再让 `mysql-store.js` 持有 canvas / agent 表的 DDL（违反 slice 边界），现状是 `AIS-RLS-147` 抽取时一并处理

---

## 9. 与画布 agent 并行开发的协作流程

```
主项目 agent (主仓库) ─────────────────────┐
                                          │ 通过 INTERFACE.md
画布 agent (apps/canvas-v2 + packages/canvas-core)  │ 与主项目对接
                                          │
agent feature agent (apps/agent + packages/agent-core)  │
                                          │
                            git merge ────┘ → 跑双方 smoke → 部署
```

**规则：**

1. 三方 agent 共享同一 git 仓库，但各自工作目录互不重叠（路径白名单见 `docs/private/CANVAS_AGENT_PROMPT.md` 与 `docs/private/AGENT_FEATURE_AGENT_PROMPT.md`）
2. 主项目 agent 不允许直接修改 `apps/` 和 `packages/` 下的 slice 代码；只能调整 `server.js` wiring 与 INTERFACE.md（且需 slice owner 同意）
3. slice agent 不允许修改 INTERFACE.md 中冻结的接口；如需变更，先在文档里登记 SemVer Major 触发 → 主项目 agent 同步 wiring
4. 合并节奏：每完成一个 milestone（约 3~5 个任务）合并一次主线；slice 内部任务自己 push（参考闭环流程）

---

## 10. 任务规划建议（编号建议从 147 起顺延）

| 编号 | 标题 | Lane | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| 147 | Canvas backend slice 抽取到 `packages/canvas-core` | Canvas Structure | P0 | — |
| 148 | Agent backend slice 抽取到 `packages/agent-core` | Agent Structure | P0 | — |
| 149 | Agent 前端规范化到 `apps/agent/` | Agent Structure | P1 | 148 |
| 150 | Canvas INTERFACE.md + Agent INTERFACE.md + 双 AGENT_PROMPT | Docs / Process | P0 | 147, 148 |
| 151 | Token 消费桥 — canvas-v2 + agent 子应用 | Visual Bridge | P1 | 147, 149, 三层架构 134 |
| 152 | Agent vitest + 5 个新 smoke（planner-flow / retry / resume / batch-export / credit-per-step） | Test | P0 | 148 |
| 153 | Canvas 5 个新 smoke（concurrent-save / large-project / touch / license-headers / token-bridge） | Test | P1 | 147 |
| 154 | Canvas 功能补完：节点并行、cycle 校验、ZIP 导出、本地草稿 | Canvas Feature | P1 | 147 |
| 155 | Agent 功能补完：步骤回放、resume、重试、按步骤扣费 | Agent Feature | P0 | 148, 152 |
| 156 | Canvas 表存储优化：payload 拆表 + snapshots + node_images | DB | P1 | 147 |
| 157 | Agent 表存储优化：归档表 + step_outputs 拆表 + 索引补完 + 软删除 | DB | P1 | 148 |
| 158 | Migrations 目录化：由各 slice schema 汇编 | DB / Process | P2 | 156, 157 |
| 159 | Canvas v1 残留归档（v2 30 天无回归后） | Cleanup | P3 | 117（lazy-load）+ 154 |

总计 13 个任务，与 133~146 视觉重设计并行执行不冲突；147 / 148 / 150 是关卡，必须先做。

---

## 11. 风险与回滚

| 风险 | 缓解 | 回滚 |
| --- | --- | --- |
| slice 抽取破坏现有路由 | 抽取期不改业务，只搬目录；smoke 全量跑 | 单 commit revert |
| INTERFACE.md 冻结后需求变更 | SemVer Major 流程 + 主项目同步 wiring | INTERFACE.md 改回旧版 + 双向 revert |
| Token 桥导致子应用色错 | 子应用保留 fallback 色板（仅在 token CSS 未加载时使用） | 移除 `<link>` 引用 |
| 表拆分导致历史数据迁移失败 | 拆分前导出全表 + 双写期 ≥ 7 天 | 切回原表读取，停止写新表 |
| 三方 agent 同时改一处 wiring | 工作目录白名单 + INTERFACE.md change 流程 | 协调主控介入 |

---

## 12. 验收与节奏

- 关卡 1：147 + 148 + 150 完成 → 三方 agent 工作目录边界生效
- 关卡 2：152 + 153 完成 → 测试基线达标
- 关卡 3：151 + 三层架构（≥ 142）完成 → 视觉统一
- 关卡 4：154 + 155 完成 → 功能补完
- 关卡 5：156 + 157 + 158 完成 → 存储优化落地
- 关卡 6：159 完成 → v1 归档清理

每个关卡之间开一次独立审计会话（`docs/private/AUDIT_AGENT_PROMPT.md`），防止水分累积。

---

## 13. 变更日志

- 2026-05-25 v1：初版发布，13 任务建议、INTERFACE.md 8 字段规范、三方 agent 协作流程

