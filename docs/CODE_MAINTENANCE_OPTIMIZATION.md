# ai-image-studio 代码维护优化方案

## 当前状况概述

项目经过密集迭代（AIS-RLS-013 到 AIS-RLS-037），功能快速堆叠导致若干文件体积膨胀、职责模糊。以下是需要关注的核心问题和分阶段优化建议。

**注意：当前仍有 agent 在项目中进行开发工作，所有重构操作必须与活跃开发协调，避免冲突。**

---

## 一、问题文件清单（按严重程度排序）

| 文件 | 行数 | 问题 |
|------|------|------|
| `public/app.js` | 7014 | 前端主入口，承载路由、状态、UI 渲染、API 调用、画廊逻辑等所有职责 |
| `server.js` | 5359 | 后端主入口，包含路由注册、中间件、业务逻辑、迁移、静态服务 |
| `src/mysql-store.js` | 5354 | 数据访问层，所有表的 CRUD 全部堆在一个文件 |
| `public/admin.js` | 2147 | 后台管理前端，单文件包含所有管理面板 |
| `public/canvas.js` | 1197 | 画布主控制器，虽已拆分但仍是接线中心 |
| `docs/REMOTE_DEVELOPMENT_PRIVATE.md` | 2194 | 开发文档，部署记录无限追加，已难以检索 |

---

## 二、`public/app.js`（7014 行）拆分方案

这是最紧迫的优化目标。建议按功能域拆分为独立模块文件：

```
public/
├── app.js                  → 精简为入口 + 路由分发 + 全局状态（目标 < 800 行）
├── app-auth.js             → 登录/注册/会话/CSRF
├── app-generation.js       → 文生图/图生图生成流程、参数面板
├── app-gallery.js          → 画廊列表、筛选、分页、详情弹窗
├── app-session.js          → 对话/会话列表、历史记录
├── app-prompt-library.js   → 提示词库浏览、排序、点赞
├── app-settings.js         → 用户设置、模型切换、偏好
├── gallery-normalize.js    → （已拆出，保持）
├── gallery-leaderboard.js  → （已拆出，保持）
└── ...canvas-*.js          → （已拆出，保持）
```

**拆分原则：**
- 每个模块通过 `window.AppModules.xxx = { init, bindEvents, ... }` 暴露接口
- `app.js` 只负责初始化顺序和模块间通信
- 拆分时保持 API 不变，不改变 HTML script 加载顺序的语义

---

## 三、`server.js`（5359 行）拆分方案

```
server.js                   → 精简为启动入口 + 中间件链 + 路由挂载（目标 < 600 行）
src/
├── mysql-store.js          → 继续拆分（见下方）
├── routes/
│   ├── auth.js             → 登录/注册/会话/CSRF 路由
│   ├── images.js           → 生成图 CRUD、公开列表、文件服务
│   ├── prompts.js          → 提示词 CRUD、排序、点赞、AI 审核
│   ├── canvases.js         → 画布 CRUD、生成、导入导出、助手
│   ├── gallery.js          → 画廊、排行榜、标签
│   ├── admin.js            → 后台管理 API
│   └── health.js           → 版本、健康检查
├── middleware/
│   ├── session.js          → 会话中间件
│   ├── csrf.js             → CSRF 保护
│   └── static.js           → 静态文件服务配置
├── canvas-assistant.js     → （已拆出，保持）
├── canvas-import-export.js → （已拆出，保持）
├── canvas-service.js       → （已拆出，保持）
├── prompt-review-service.js→ （已拆出，保持）
└── prompt-source-sync.js   → （已拆出，保持）
```

---

## 四、`src/mysql-store.js`（5354 行）拆分方案

按数据域拆分为多个 store 文件：

```
src/
├── mysql-store.js          → 精简为连接池 + 迁移 + 公共 helper（目标 < 500 行）
├── stores/
│   ├── user-store.js       → 用户、会话、积分
│   ├── generation-store.js → 生成记录、队列、文件关联
│   ├── prompt-store.js     → 提示词 CRUD、标签、点赞、重复候选
│   ├── canvas-store.js     → 画布 CRUD、节点、连线、生成关联
│   ├── gallery-store.js    → 公开列表、排行榜、举报
│   └── admin-store.js      → 审计日志、公告、审批
```

**拆分原则：**
- `mysql-store.js` 保留 `getPool()`、`runMigrations()`、事务 helper
- 各子 store 通过 `const { getPool } = require('./mysql-store')` 获取连接
- 对外暴露的函数签名不变，`server.js` 的 `require` 路径更新即可

---

## 五、`docs/REMOTE_DEVELOPMENT_PRIVATE.md`（2194 行）优化

文档已经变成部署日志的无限追加流，检索困难。建议：

1. **拆分结构：**
   ```
   docs/private/
   ├── REMOTE_DEVELOPMENT_PRIVATE.md   → 只保留 §1-§7（环境、流程、规则），约 250 行
   ├── DEPLOYMENT_LOG_202605.md        → §8-§37 所有部署记录归档
   └── DEPLOYMENT_TEMPLATE.md          → 标准化部署记录模板
   ```

2. **部署记录模板化：** 每次部署只记录差异和异常，通过的检查项用一行 `全部通过` 代替逐条列举。

3. **定期归档：** 每月或每 10 次部署后，将旧记录压缩归档到 `DEPLOYMENT_LOG_YYYYMM.md`。

---

## 六、工作区根目录清理

`D:\生图广场\` 根目录存在大量历史 `.tgz` 包（30+ 个）和多个参考/废弃目录：

- `reference-upload-fix/` — 旧版代码快照，与 `remote-edit/` 高度重复
- `Gen-Image-reference/` — 外部参考项目
- `image2creat/` — 可能是更早期版本
- `*.tgz` 文件 — 历史部署包

**建议：**
- 确认 `reference-upload-fix/` 不再需要后删除或归档到单独位置
- 历史 `.tgz` 移到专门的 `archive/` 目录或外部存储
- 保持工作区只有 `remote-edit/`（主开发）和必要的工具文件

---

## 七、`remote-edit/` 项目根目录清理

项目根目录存在大量不应提交的临时文件：

- `*.tgz`（6 个部署包）
- `*.log`（6 个日志文件）
- `*.png`（4 个截图）
- `data-smoke*/`（调试数据目录）

**建议：** 在 `.gitignore` 中确认排除，并定期清理本地副本。

---

## 八、执行优先级与风险控制

考虑到当前有 agent 在活跃开发，建议按以下顺序执行：

### Phase 1（低风险，可立即执行）
- [x] 文档拆分（`REMOTE_DEVELOPMENT_PRIVATE.md` → 环境文档 + 部署日志归档）
- [x] 工作区根目录 `.tgz` 归档
- [x] 项目根目录临时文件清理

执行记录（2026-05-22）：
- 私有文档已拆到 `docs/private/REMOTE_DEVELOPMENT_PRIVATE.md`、`docs/private/DEPLOYMENT_LOG_202605.md`、`docs/private/DEPLOYMENT_TEMPLATE.md`；旧路径保留本地跳转说明。
- 工作区根目录 `.tgz` 已移动到 `D:\生图广场\archive\workspace-artifacts\2026-05-22\`。
- 项目根目录 `.tgz`、`.tar`、`.log`、根部截图和 `data-smoke*` 已移动到 `remote-edit/archive/local-artifacts/2026-05-22/`。
- `.gitignore` 已补充 `docs/private/`、`/archive/`、项目根部 `/*.tar` 和 `/*.png`，避免本地归档和 QA 临时截图进入 Git。
- 当前存在其他 agent / 用户对 `server.js`、`src/mysql-store.js`、`src/generation-queue-runner.js`、`src/generation-trace-service.js` 的活跃改动，Phase 2/3 暂缓，避免重构冲突。

### Phase 2（中风险，需协调时间窗口）
- [ ] `server.js` 路由拆分 — 纯机械提取，不改逻辑
- [ ] `mysql-store.js` 按域拆分 — 纯机械提取，不改接口签名

执行记录（2026-05-22，增量拆分）：
- 已先完成一个低风险 `server.js` 增量拆分：将内存队列调度、并发控制、排队快照和 queued 取消逻辑抽到 `src/generation-queue-runner.js`。
- `server.js` 保留 DB-backed queue recovery、任务 payload 恢复和生成业务编排；队列 runner 通过 `onBeforeRun` hook 回写 `generation_requests` 锁定与 attempt 状态。
- `scripts/smoke/check-generation-queue-recovery.mjs` 已增加对独立 runner 模块、`onBeforeRun` 和 queued cancellation 的静态守护。
- 为修复服务器构建对 `registry.npmmirror.com` 的依赖，`package-lock.json` 的 `resolved` tarball 已切到 `registry.npmjs.org`，避免部署时因镜像源 502 阻断。
- 后续如果继续做路由拆分，优先抽 `src/routes/admin.js` 或 `src/routes/images.js`，每次只迁移一个端点族并立即跑对应 smoke。

执行记录（2026-05-23，维护边界增量拆分）：
- 当前已无其他开发者并行修改，完成一组低风险 Phase 2 拆分：将 `/api/csp-report`、`/api/rum`、`/api/version`、`/api/health` 抽到 `src/routes/health.js`，保留上报接口在 CSRF 前处理的旧行为。
- 将 `gallery_tags`、提示词分类种子和标签 CRUD/合并/迁移逻辑抽到 `src/stores/tag-store.js`，`src/mysql-store.js` 继续保持原有对外函数名和调用签名。
- 新增 `npm run smoke:maintenance-boundaries`，用纯函数和静态检查守护健康路由、标签 store 与主入口接线。

### Phase 3（较高风险，需完整测试）
- [ ] `public/app.js` 模块化拆分 — 前端无构建工具，需确保 script 加载顺序正确
- [ ] `public/admin.js` 拆分

### 每次拆分的验证清单
1. `node --check` 所有修改文件
2. `npm run smoke:public` 通过
3. 相关功能域的专项 smoke 通过
4. 部署到生产前在容器内完整回归

执行记录（2026-05-22，provider 能力与映射补强）：
- 新增 `src/provider-mapping.js`，实现安全 JSON path 子集、模板渲染、openai-compatible / async-task 的 submit + poll。
- `provider_configs` 已补 `provider_mapping_json` 持久化，后台 provider 表单已支持配置和校验 mapping JSON。
- `server.js` 已支持 provider capability 驱动的路由筛选、provider mapping submit/poll、以及 provider 返回 URL 的 SSRF 校验。
- `public/app.js` 已根据 provider capabilities 禁用不支持的尺寸、质量和输出格式。
- 新增 `npm run smoke:provider-capabilities` 与 `npm run smoke:provider-async-mock`；两项静态 smoke 已通过。
- `npm run smoke:generation-queue-recovery` 与 `npm run smoke:generation-trace` 也已通过。
- `npm run smoke:public` 当前受本地 MySQL 凭据影响，服务启动报 `Access denied for user 'root'@'localhost' (using password: NO)`，属于环境问题，不是本次代码改动引入的回归。

---

## 九、长期建议

1. **引入构建工具：** 前端目前是裸 JS 文件直接 serve，无法使用 ES modules import。中期可引入轻量打包（如 esbuild），让前端代码用标准 `import/export`，开发体验和可维护性会大幅提升。

2. **TypeScript 渐进迁移：** `canvas-v2` 已经在用现代架构（`apps/canvas-v2/src/`），可以作为新功能的标准。旧代码不必全部迁移，但新模块建议用 TS。

3. **测试覆盖：** 当前依赖 smoke 脚本做集成验证，缺少单元测试。拆分后的各 store/route 模块天然适合单元测试，可逐步补充。

4. **API 文档：** 路由拆分后，每个路由文件头部用简短注释列出该文件管理的端点，方便快速定位。

---

## 十、与活跃开发的协调规则

- 重构 PR 不与功能 PR 同时进行同一文件
- 拆分操作在功能部署间隙执行（两次 `docker compose up` 之间）
- 拆分后立即运行完整 smoke 套件，确认无回归
- 如果 agent 正在修改 `server.js` 或 `app.js`，等其完成并部署后再执行对应文件的拆分
- 拆分提交使用明确前缀：`refactor: extract xxx from server.js`
