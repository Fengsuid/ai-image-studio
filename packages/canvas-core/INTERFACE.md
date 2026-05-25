# Canvas Core — Interface Contract

更新日期：2026-05-25
版本：v0.0.0（pre-extract）→ 抽取后从 v1.0.0 起算
路径：`packages/canvas-core/`
范围：画布功能后端切片（service + routes + store + assistant + import-export）

> 本文档是画布 agent 与主项目 agent 之间的**冻结接口**。任一字段变更必须遵守 §7 SemVer Major 流程，先由主控批准、再同步主项目 wiring。

---

## 1. 依赖注入清单（不可新增 direct require）

`createService({ ... })` 接收 18 项依赖。画布 agent 不允许在 `packages/canvas-core/` 内对主项目模块做 `require("../../src/...")`，所有外部能力必须经由注入。

| 名称 | 类型 | 可空 | 用途 |
| --- | --- | --- | --- |
| `store` | object | 否 | 数据访问对象，需提供 canvas / generation 相关方法（见 §3.2） |
| `httpError` | (msg, status) => Error | 否 | 抛业务错（带 status） |
| `randomId` | () => string | 否 | 生成 32 字符 ID |
| `choose` | (...candidates) => any | 否 | 首个非空候选 |
| `cleanPrompt` | (str) => string | 否 | 规范化用户 prompt |
| `sanitizePositiveInt` | (val, def, max) => number | 否 | 正整数清洗 |
| `normalizeImageSize` | (str) => string | 否 | 图像尺寸规范化 |
| `validateImageDataUrl` | (str) => boolean | 否 | data URL 校验 |
| `normalizeGenerationCost` | (val) => number | 否 | 积分规范化 |
| `enforceGenerationRate` | (ctx) => void/throw | 否 | 速率限制 |
| `attachRequestAbortController` | (req, ctrl) => void | 否 | 取消令牌绑定 |
| `callOpenAIImages` | (params) => Promise | 否 | 文生图 |
| `callOpenAIImageEdits` | (params) => Promise | 否 | 图生图 |
| `saveGeneratedImages` | (params) => Promise | 否 | 图床落地 |
| `getClientIp` | (req) => string | 否 | 审计 |
| `getUserAgent` | (req) => string | 否 | 审计 |
| `isPubliclyVisibleGeneration` | (gen) => boolean | 否 | 可见性判定 |
| `resolveCanvasImageData` | async ({ imageData }) => string | 是 | 引用图像解析（默认透传） |
| `defaultModel` | string | 否 | 缺省模型名 |

`createRoutes({ ... })` 接收 7 项依赖：

| 名称 | 用途 |
| --- | --- |
| `canvasService` | 由 `createService` 返回 |
| `sendJson(res, status, body)` | 响应工具 |
| `readJsonBody(req)` | 请求体解析 |
| `getCurrentUser(req)` | 鉴权读 user |
| `ensureAuthenticated(current)` | 已登录校验 |
| `ensureAdmin(current)` | 管理员校验 |
| `sanitizePositiveInt` | 同上 |

---

## 2. HTTP 端点表

前缀冻结 `/api/canvases/*`，共 11 路由匹配。新端点只能在此前缀下增加；新增也需 SemVer Minor + INTERFACE.md 同步。

| Method | Path | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/canvases` | user / admin(`scope=all`) | 列表，支持 `scope=mine\|public\|templates\|all` + `limit` |
| POST | `/api/canvases` | user | 新建 |
| GET | `/api/canvases/templates` | user | 模板市场（公开模板列表） |
| GET | `/api/canvases/:id` | user | 详情 |
| PATCH | `/api/canvases/:id` | user（owner） | 更新 |
| DELETE | `/api/canvases/:id` | user（owner） | 删除 |
| GET | `/api/canvases/:id/export` | user（owner） | JSON 导出 |
| POST | `/api/canvases/:id/import` | user（owner） | JSON 导入 |
| POST | `/api/canvases/:id/assistant` | user（owner） | 助手指令 |
| POST | `/api/canvases/:id/duplicate` | user | 复制（公开模板可被非 owner 复制） |
| POST | `/api/canvases/:id/generate` | user（owner） | 触发生成 |

返回体使用 `sendJson` 写入；错误经 `httpError(msg, status)` 抛出，由主项目顶层拦截。

---

## 3. 数据库

### 3.1 拥有的表（DDL 归属 `packages/canvas-core/schema/`）

| 表 | DDL 文件 | 外键 | 索引 |
| --- | --- | --- | --- |
| `canvas_projects` | `schema/001-canvas-projects.sql` | `user_id → users.id ON DELETE CASCADE` | `(user_id, updated_at)`, `(visibility, updated_at)`, `(is_template, updated_at)`, `(status, updated_at)` |
| `canvas_generation_links` | `schema/002-canvas-generation-links.sql` | `canvas_id → canvas_projects.id`, `generation_id → generations.id` | `(canvas_id)`, `(generation_id)` |

未来如新增表，必须在 `schema/` 下新增编号文件，且在本节登记。

### 3.2 store 接口契约（由主项目 `src/stores/canvas-store.js` 提供，画布 agent 不直接持有 DB 连接）

最小集合（实际方法集见 service 内引用，扩充需 SemVer Minor 同步）：

- `listCanvasProjects(userId, options)`、`getCanvasProjectById(id)`、`getCanvasProjectForGeneration(generationId)`
- `createCanvasProject(data)`、`updateCanvasProject(id, patch)`、`deleteCanvasProject(id)`
- `linkCanvasGeneration(canvasId, generationId, nodeId)`、`unlinkCanvasGeneration(...)`
- `listCanvasTemplates(limit)`

### 3.3 schema 迁移策略

主项目 init 时按编号顺序执行 `packages/canvas-core/schema/*.sql`；幂等使用 `CREATE TABLE IF NOT EXISTS` + `SHOW COLUMNS LIKE` 模式。`mysql-store.js` 不再持有 canvas 表 DDL。

---

## 4. 静态资产路径

| 类目 | 路径 | 由谁产出 |
| --- | --- | --- |
| 子应用源码 | `apps/canvas-v2/src/` | 画布 agent |
| 构建产物（JS） | `public/canvas-v2/assets/main.<hash>.js` | 画布 agent (build) |
| 构建产物（CSS） | `public/canvas-v2/assets/styles.<hash>.css` | 画布 agent (build) |
| HTML 入口 | `public/canvas-v2/index.html` | 画布 agent (build) |
| 旧版 v1 | `public/canvas.js` 及 16 个 `canvas-*.js`、`public/css/10-canvas*.css` | 冻结，等待 159 任务归档 |

主项目静态文件中间件按 `public/canvas-v2/*` 整目录服务，不允许跨目录引用。

---

## 5. 事件契约

画布触发的副作用，全部经过依赖注入完成，不直接调主项目模块：

- 生成请求：`canvasService.generate(userId, canvasId, body, req, res)` → 内部使用注入的 `callOpenAIImages` / `callOpenAIImageEdits` + `saveGeneratedImages` → `store.linkCanvasGeneration`
- 速率与审计：通过 `enforceGenerationRate`、`getClientIp`、`getUserAgent`
- 取消：通过 `attachRequestAbortController`

主项目监听的事件（来自画布）：

- 生成结果落地后由 `saveGeneratedImages` 返回的 `generation` 记录，由主项目 creative-route 在响应增强（`canvasProject` 字段，已存在）

---

## 6. 配置项

不维护自有环境变量。主项目通过依赖注入传入：

- `defaultModel`（来自主项目 `DEFAULT_MODEL`）
- 速率限制阈值（由主项目 `enforceGenerationRate` 实现内部决定）
- 图床配置（由主项目 `saveGeneratedImages` 实现内部决定）

如未来必须新增 canvas 独有配置，通过 `config` 注入项（object）传入，不读取 `process.env`。

---

## 7. SemVer Major 触发条件（任一命中即 Major）

1. `createService` / `createRoutes` 任一依赖注入项**变更名称或类型签名**
2. 任一 HTTP 端点路径**变更或删除**（新增端点是 Minor）
3. 任一 DB 表**重命名 / 删除 / 外键变更**（新增表是 Minor，新增列是 Patch）
4. 静态资产**路径变更**
5. `package.json` 中 `main` / `exports` 字段调整
6. AGPL-3.0 license 变更（不允许）

Major 流程：画布 agent 在 INTERFACE.md 末尾 §13 登记变更草案 → 主控批准 → 主项目 agent 同步 wiring → 双方同 commit 合并。

---

## 8. 测试边界

画布 slice 自跑：

```
cd packages/canvas-core
npm run check          # syntax + lint
npm run test           # vitest 单测（service / import-export 纯函数）
```

主项目 CI 引用的 smoke（由画布 agent 维护脚本，但 runner 在主项目）：

- `npm run smoke:canvas-v2:static`
- `npm run smoke:canvas-v2:editor`
- `npm run smoke:canvas-v2:generation`
- `npm run smoke:canvas-v2:entry`
- `npm run smoke:canvas-history`
- `npm run smoke:canvas-assistant`
- `npm run smoke:canvas-assistant-api`
- `npm run smoke:canvas-gallery-link`
- `npm run smoke:canvas-template-market`
- `npm run smoke:canvas-import-export`
- `npm run smoke:canvas-import-export-api`
- `npm run smoke:canvas-module-boundaries`
- `npm run smoke:canvas-layout-edges`
- `npm run smoke:canvas-selection`
- 新增（任务 153）：`smoke:canvas-concurrent-save`、`smoke:canvas-large-project`、`smoke:canvas-touch-gestures`、`smoke:canvas-license-headers`、`smoke:canvas-v2-token-bridge`

主项目部署前必须全绿。

---

## 9. License

`packages/canvas-core/` 与 `apps/canvas-v2/` 均为 **AGPL-3.0-or-later**。每个 .js 顶部必须含 license header；`smoke:canvas-license-headers` 强制校验。

---

## 10. 变更日志

- 2026-05-25 v1.0.0（草案）：初版冻结草案，待 `AIS-RLS-147`（slice 抽取）完成后正式发布 v1.0.0

