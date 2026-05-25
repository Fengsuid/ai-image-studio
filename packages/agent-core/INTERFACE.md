# Agent Core — Interface Contract

更新日期：2026-05-25
版本：v1.0.0（首次发布，AIS-RLS-148 抽取完成）
路径：`packages/agent-core/`
范围：Agent 功能后端切片（generation-service + planner + routes + session-store）

> 本文档是 agent feature 开发 agent 与主项目 agent 之间的**冻结接口**。任一字段变更必须遵守 §7 SemVer Major 流程。

---

## 1. 依赖注入清单（不可新增 direct require）

`createGenerationService({ ... })` 接收 19 项依赖：

| 名称 | 可空 | 用途 |
| --- | --- | --- |
| `store` | 否 | 数据访问，需提供 agent session / message / step 方法（见 §3.2） |
| `httpError` | 否 | 业务错抛出 |
| `randomId` | 否 | 32 字符 ID |
| `nowIso` | 否 | 时间戳 |
| `choose` | 否 | 首个非空候选 |
| `cleanPrompt` | 否 | prompt 规范化 |
| `sanitizeGenerationTitle` | 否 | 标题清洗 |
| `normalizeImageSize` | 否 | 图像尺寸 |
| `normalizeGenerationCost` | 否 | 积分 |
| `sanitizeConversationRoute` | 否 | 路由清洗 |
| `getClientIp` | 否 | 审计 |
| `getUserAgent` | 否 | 审计 |
| `enforceGenerationRate` | 否 | 速率限制 |
| `queuePayloadForTextGeneration` | 否 | 队列负载构造 |
| `enqueueGenerationJob` | 否 | 入队 |
| `runQueuedTextGeneration` | 否 | 同步执行（非排队场景） |
| `traceGeneration` | 否 | 链路追踪 |
| `safeJsonSummary` | 否 | 日志摘要 |
| `defaultModel` | 否 | 缺省模型名 |

`createRoutes({ ... })` 接收 10 项依赖：

| 名称 | 用途 |
| --- | --- |
| `ensureAuthenticated` | 鉴权 |
| `getCurrentUser` | 当前用户 |
| `httpError` | 错误工厂 |
| `randomId` | ID 生成 |
| `readJsonBody` | 请求体解析 |
| `sanitizePositiveInt` | 整数清洗 |
| `sendJson` | 响应工具 |
| `decorateAgentSession` | 由 `createGenerationService` 暴露，对 session 注入派生字段 |
| `generateAgentBatch` | 同上，批量生成入口 |
| `exportAgentCanvas` | 同上，导出到画布入口 |
| `store` | 数据访问 |

---

## 2. HTTP 端点表

前缀冻结 `/api/agent-sessions/*`，共 7 路由匹配。

| Method | Path | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/agent-sessions` | user | 列表，支持 `status=active\|archived` + `limit` |
| POST | `/api/agent-sessions` | user | 新建 session |
| GET | `/api/agent-sessions/:id` | user（owner） | 详情，含 messages + steps |
| PATCH | `/api/agent-sessions/:id` | user（owner） | 更新元数据 |
| DELETE | `/api/agent-sessions/:id` | user（owner） | 删除 |
| POST | `/api/agent-sessions/:id/plan` | user（owner） | 生成计划（含确认流程） |
| POST | `/api/agent-sessions/:id/generate` | user（owner） | 按计划批量生成 |
| POST | `/api/agent-sessions/:id/export-canvas` | user（owner） | 导出为画布工程 |
| POST | `/api/agent-sessions/:id/messages` | user（owner） | 追加消息（含 steps 内嵌） |

---

## 3. 数据库

### 3.1 拥有的表（DDL 归属 `packages/agent-core/schema/`）

| 表 | DDL 文件 | 外键 | 索引（建议） |
| --- | --- | --- | --- |
| `agent_sessions` | `schema/001-agent-sessions.sql` | `user_id → users.id` | `(user_id, updated_at)`, `(status, updated_at)` |
| `agent_messages` | `schema/002-agent-messages.sql` | `session_id → agent_sessions.id` | `(session_id, created_at)` |
| `agent_steps` | `schema/003-agent-steps.sql` | `session_id → agent_sessions.id`、`message_id → agent_messages.id`、`generation_id → generations.id` | `(session_id, step_no)`, `(generation_id)` |

任务 157 计划新增表：

| 表 | 用途 |
| --- | --- |
| `agent_sessions_archive` | 冷数据归档（≥90 天未访问） |
| `agent_step_outputs` | 大字段外置（拆 `agent_steps.output_blob`） |

### 3.2 store 接口契约（最小集合）

- `listAgentSessions(userId, options)`、`getAgentSessionById(id)`、`getAgentSessionDetail(id)`（含 messages + steps）
- `createAgentSession(data)`、`updateAgentSession(id, patch)`、`deleteAgentSession(id)`
- `appendAgentMessage(sessionId, message)`、`appendAgentSteps(messageId, steps)`
- `updateAgentStep(id, patch)`

---

## 4. 静态资产路径

| 类目 | 路径 | 产出 |
| --- | --- | --- |
| 子应用源码 | `apps/agent-workspace/src/`（已存在） | agent feature agent |
| 构建产物（JS） | `public/agent/assets/main.<hash>.js` | build |
| 构建产物（CSS） | `public/agent/assets/styles.<hash>.css` | build |
| HTML 入口 | `public/agent/index.html` | build |
| 子应用 license | `apps/agent-workspace/package.json` 当前为 `UNLICENSED` | — |

> **注意**：与画布 slice 不同，agent 子应用 `apps/agent-workspace/` 当前 license 为 `UNLICENSED`（可能是闭源 add-on 预留）。`packages/agent-core/` 后端 slice 抽取时**不强制 AGPL header**，沿用主项目现行约定。任务 149 不是"创建子应用"，而是"规范化已存在的 apps/agent-workspace/ 与 packages/agent-core/ 后端的对接"。

---

## 5. 事件契约

- 计划生成：`POST /plan` → 内部使用 `buildAgentPlan` / `summarizeAgentPlan`（位于 `packages/agent-core/src/planner.js`）
- 批量执行：`POST /generate` → 内部走 `generateAgentBatch` → `enqueueGenerationJob` → `runQueuedTextGeneration`
- 导出画布：`POST /export-canvas` → 内部走 `exportAgentCanvas`，最终写入 `canvas_projects` 表（**跨 slice**：调用主项目 store 的 canvas 写入方法）

> **重要**：agent → canvas 的写入是已存在的跨 slice 依赖。我们不通过画布 slice 的 HTTP API 写，而是直接通过共享 store。这违反了"slice 完全独立"的纯粹原则，但保留这种设计是因为：(1) 事务边界要求一致性，(2) HTTP 自调用增加延迟与失败模式。该耦合在 `packages/canvas-core/INTERFACE.md §3.2` 中以 store 方法形式承认。

---

## 6. 配置项

不维护自有环境变量。所有配置通过 DI 传入。

---

## 7. SemVer Major 触发条件（同 canvas INTERFACE.md §7）

特别注意：

- `decorateAgentSession`、`generateAgentBatch`、`exportAgentCanvas` 三个由 service 返回给 routes 的函数，签名变更视为 Major
- agent session JSON schema（包含 `data` / `steps` / `plan.format=ai-image-studio.agent-plan.v1`）的不向后兼容变更视为 Major

---

## 8. 测试边界

agent slice 自跑：

```
cd packages/agent-core
npm run check          # node --check 全量源文件语法
npm run test           # node:test planner 单测（5 用例 P0）
```

主项目 CI 引用：

- 现有（已注册）：`smoke:agent-workspace`、`smoke:agent-session-api`、`smoke:agent-batch-generation`、`smoke:agent-export-canvas`
- 新增（任务 152）：
  - `smoke:agent-planner-flow`（P0）
  - `smoke:agent-credit-per-step`（P0）
  - `smoke:agent-retry`
  - `smoke:agent-resume`
  - `smoke:agent-batch-export`（注：与现有 `smoke:agent-batch-generation` 区分；新 smoke 测端到端 + canvas 导出闭环）

---

## 9. 变更日志

- 2026-05-25 v1.0.0（首次发布，AIS-RLS-148）：从 `src/agent-*` 与 `src/routes/agent-sessions.js`、`src/stores/agent-session-store.js` 抽取实体到 `packages/agent-core/`；DDL 迁至 `schema/001-003`；`server.js` 与 `src/mysql-store.js` 通过 `@ai-image-studio/agent-core` 消费；`createGenerationService` / `createRoutes` / `createSessionStore` / `applySchema` / `buildAgentPlan` / `summarizeAgentPlan` 为公开导出；HTTP 前缀与 store 契约保持不变
- 2026-05-25 v1.0.1（草案，已并入 v1.0.0）：修正子应用路径为 `apps/agent-workspace/`（已存在）；license 为 `UNLICENSED`，不强制 AGPL；补完现有 agent smokes 清单

