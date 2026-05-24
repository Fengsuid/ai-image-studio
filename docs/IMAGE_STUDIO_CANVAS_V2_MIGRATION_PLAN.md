# ai-image-studio Canvas v2 直接迁移开发文档

日期：2026-05-21
状态：实施入口文档。用于替代“继续修补当前不可用画布”的路线。
参考项目：`basketikun/infinite-canvas`
目标：把原画布项目作为独立前端子应用迁入本项目，通过 API 适配层接入现有 ai-image-studio 后端能力。

## 1. 当前结论

当前 `public/canvas*.js` 画布已经无法作为可靠生产基础继续演进。继续在旧无构建脚本里修拖拽、缩放、连线、节点、助手、生成链路，会持续堆出新的事件状态和渲染债务。

因此 Canvas v2 采用“独立子应用迁移”：

- 迁入上游画布前端体验和核心节点编辑能力。
- 不把上游 Go 后端、GORM 数据库、本地 API Key、浏览器直连模型接口带入本项目。
- 使用本项目已有 Node 后端接口承接登录、权限、额度、生成、图片落库、画布保存、公开线路。
- 先以 `/canvas-v2` 灰度上线，稳定后再把 `/canvas` 正式切换到 v2。

本路线允许直接迁移上游源码，但必须规范处理 AGPL-3.0：

- 保留上游 LICENSE、版权声明和来源说明。
- 在公开仓库中提供线上运行版本对应源码。
- 标明本项目对上游代码的修改。
- 私有 `.env`、密钥、服务器路径、`REMOTE_DEVELOPMENT_PRIVATE.md` 不公开。

## 2. 迁移原则

### 2.1 必须保留的本项目能力

Canvas v2 不能绕过以下现有能力：

| 能力 | 现有承载 | Canvas v2 要求 |
| --- | --- | --- |
| 登录态 | session cookie / `/api/health` | 进入画布前必须能识别当前用户 |
| CSRF | `csrf` cookie + `X-CSRF-Token` | 所有写接口继续带 token |
| 画布持久化 | `canvas_projects` / `/api/canvases` | 画布保存到 MySQL，不只存在浏览器 |
| 图片生成 | `/api/canvases/:id/generate` | 不允许浏览器直连 OpenAI 或代理 |
| 积分与限流 | 现有 generation 链路 | 生成失败、扣费、退款逻辑保持后端统一 |
| 图片落库 | `generations` + 文件存储 | 输出图必须进入现有作品体系 |
| 公开线路 | `canvas_generation_links` | 输出发布到画廊时保留线路 |
| 画廊复用 | 公开作品复制/加入画布 | 继续支持从画廊进入画布 |

### 2.2 明确不迁入的冗余能力

第一阶段不要迁入以下能力，避免把上游完整应用复杂度一次性带入：

| 上游能力 | 第一阶段处理 |
| --- | --- |
| Go / Gin / GORM 后端 | 不迁入 |
| 上游数据库 schema | 不迁入，仅写适配转换 |
| 浏览器保存生产 API Key | 删除或隐藏 |
| 浏览器直连 OpenAI 兼容接口 | 删除，统一走本项目后端 |
| 上游用户系统 | 不迁入 |
| 上游素材服务器 | 不迁入，先接本项目画廊、提示词、我的作品 |
| 多 provider 管理 UI | 不迁入，继续由本项目后台管理 |
| 与当前产品无关的示例页 | 删除 |
| 未被本项目使用的复杂模板市场 | 延后到 Canvas v2 稳定后再评估 |

### 2.3 可以迁入的核心能力

第一阶段只迁入与“画布可用”强相关的能力：

- 无限画布平移、缩放、缩放控件、视口重置。
- 节点创建、拖拽、缩放、删除、复制、粘贴。
- 文本节点、图片节点、提示词节点、生成配置节点、输出节点。
- 连线、上游依赖解析、选中高亮。
- 框选、多选、快捷键。
- 小地图。
- JSON 导入导出 UI，但数据格式必须转换为 `ai-image-studio.canvas.v1`。
- 生成按钮和生成状态，不直接接上游生成接口。

## 3. 推荐目录结构

新增独立子应用目录：

```text
remote-edit/
├─ apps/
│  └─ canvas-v2/
│     ├─ package.json
│     ├─ src/
│     │  ├─ app/
│     │  ├─ canvas/
│     │  ├─ adapters/
│     │  │  ├─ ai-image-studio-api.ts
│     │  │  ├─ canvas-schema.ts
│     │  │  ├─ csrf.ts
│     │  │  └─ image-url.ts
│     │  ├─ features/
│     │  │  ├─ project-list/
│     │  │  ├─ node-editor/
│     │  │  ├─ generation/
│     │  │  └─ imports/
│     │  └─ main.tsx
│     ├─ public/
│     ├─ index.html
│     └─ vite.config.ts
├─ public/
│  └─ canvas-v2/
│     └─ built assets copied here during build
├─ src/
│  └─ canvas-service.js
└─ server.js
```

说明：

- `apps/canvas-v2` 是源码目录，允许使用 React / TypeScript / Zustand 等上游栈。
- `public/canvas-v2` 是构建产物目录，由 build 脚本生成，不手写业务逻辑。
- 当前旧画布脚本继续保留，直到 `/canvas-v2` 验收通过。
- 上游源码迁入时放在 `apps/canvas-v2`，不要散落到 `public/`。

## 4. 路由接入

### 4.1 前端路由

新增访问入口：

```text
GET /canvas-v2
GET /canvas-v2/*
```

服务端返回 `public/canvas-v2/index.html`。

旧入口保留：

```text
GET /canvas
```

灰度期间：

- 导航栏新增“画布 v2”或只给管理员/开发者展示。
- `加入画布` 动作可通过 feature flag 决定进入旧画布还是 v2。
- 稳定后 `/canvas` 重定向到 `/canvas-v2`，再逐步删除旧画布入口。

### 4.2 静态资源

构建产物示例：

```text
public/canvas-v2/index.html
public/canvas-v2/assets/*.js
public/canvas-v2/assets/*.css
```

资源版本策略：

- 构建时使用内容 hash。
- 线上发布时继续通过 `/api/version` 验证当前部署版本。
- 不要把构建产物中的 sourcemap 上传到生产，除非明确需要调试。

## 5. API 适配层

Canvas v2 前端只能调用 `adapters/ai-image-studio-api.ts`，业务组件不要直接 `fetch`。

### 5.1 统一 fetch wrapper

要求：

- 自动带 `credentials: "same-origin"`。
- 写请求自动读取 `csrf` cookie 并加 `X-CSRF-Token`。
- 对 `401` 统一跳转登录或打开登录弹窗。
- 对 `403` 显示权限或 CSRF 错误。
- 对生成接口的排队状态统一解析。

伪代码：

```ts
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = readCsrfCookie();
  if (!["GET", "HEAD", "OPTIONS"].includes(options.method || "GET") && token) {
    headers.set("X-CSRF-Token", token);
  }
  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  return parseApiResponse<T>(res);
}
```

### 5.2 Canvas v2 使用的接口清单

MVP 只接这些接口：

| 场景 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 当前用户/初始化 CSRF | GET | `/api/health` | 获取登录态、csrf cookie、系统状态 |
| 画布列表 | GET | `/api/canvases?scope=mine&limit=50` | 当前用户画布 |
| 新建画布 | POST | `/api/canvases` | 创建空项目或从 payload 创建 |
| 读取画布 | GET | `/api/canvases/:id` | 读取 `dataJson` |
| 保存画布 | PATCH | `/api/canvases/:id` | 保存 `title`、`visibility`、`dataJson` |
| 删除画布 | DELETE | `/api/canvases/:id` | 删除项目 |
| 导出画布 | GET | `/api/canvases/:id/export` | 下载规范 JSON |
| 导入画布 | POST | `/api/canvases/:id/import` | 由服务端校验 |
| 画布生成 | POST | `/api/canvases/:id/generate` | 从 output/config 节点生成 |
| 模板列表 | GET | `/api/canvases/templates?limit=24` | 第二阶段可接 |

暂不接：

- `/api/canvases/:id/assistant`
- 画布模板市场完整编辑能力
- 素材库上传管理
- 批量生成候选
- 多人协作

这些能力等 v2 基础可用后再开任务。

## 6. 数据模型适配

### 6.1 后端持久化格式

本项目继续使用 `ai-image-studio.canvas.v1` 作为服务端画布格式：

```json
{
  "schema": "ai-image-studio.canvas.v1",
  "version": 1,
  "title": "Untitled canvas",
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "nodes": [],
  "edges": [],
  "meta": {
    "source": "canvas-v2",
    "updatedBy": "client"
  }
}
```

Canvas v2 可以在前端内部使用上游状态结构，但保存前必须转换成上述格式。

### 6.2 节点映射

| Canvas v2 内部节点 | 本项目保存类型 | 必填字段 |
| --- | --- | --- |
| image | `image` | `id`、`x`、`y`、`width`、`height`、`imageUrl` |
| text | `text` | `id`、`x`、`y`、`content` |
| prompt | `prompt` | `id`、`x`、`y`、`prompt`、可选 `promptId` |
| config | `config` | `id`、`x`、`y`、`model`、`size`、`quality` |
| output | `output` | `id`、`x`、`y`、可选 `generationId` |
| group | `group` | `id`、`x`、`y`、`width`、`height` |

保存规则：

- 节点 ID 由前端生成，但导入时服务端可重写非法 ID。
- 坐标、尺寸必须是有限数字。
- 图片 URL 不允许保存 `data:` 和 `blob:`。
- 图片节点优先保存本项目同源 URL，例如 `/api/images/:id/file`、`/api/prompt-images/:id/file`、`/prompt-thumbs/...`。
- 远程图片 URL 必须由后端在导入或使用时做 SSRF 校验。

### 6.3 边映射

边格式：

```json
{
  "id": "edge-1",
  "source": "node-a",
  "target": "node-b",
  "sourceHandle": "out",
  "targetHandle": "in"
}
```

规则：

- `source` 和 `target` 必须指向存在节点。
- 不允许自连接。
- 循环依赖第一阶段不硬禁止，但生成输入收集时必须防死循环。
- 生成时只读取 output 节点上游可解析内容。

## 7. 生成链路

Canvas v2 不自己生成图片，只提交生成计划给本项目后端。

### 7.1 前端触发

用户在 output 节点点击“生成”：

```json
{
  "outputNodeId": "output-1",
  "configNodeId": "config-1"
}
```

调用：

```text
POST /api/canvases/:id/generate
```

### 7.2 后端职责

继续由 `src/canvas-service.js` 完成：

- 权限校验。
- 读取服务端保存的画布 `dataJson`，不信任前端临时 payload。
- 从 output/config 上游收集 prompt、图片、参数。
- 复用现有文生图 / 图生图生成链路。
- 写入 `generation_requests`、`generations`、`canvas_generation_links`。
- 返回输出图信息。

### 7.3 前端回写

生成成功后：

- 把返回的 `generationId`、`imageUrl`、`prompt` 写回 output 节点。
- 标记画布 dirty。
- 立即触发保存。
- 保留生成失败错误，不删除 output 节点。

## 8. 与现有页面的连接

### 8.1 从首页结果加入 Canvas v2

输入 payload：

```json
{
  "kind": "generation",
  "generationId": 123,
  "imageUrl": "/api/images/123/file",
  "prompt": "..."
}
```

行为：

- 如果用户没有打开过画布，创建新画布。
- 在当前视口中心插入 image 节点和 prompt 节点。
- 自动连到一个 output 节点或生成线路组。

### 8.2 从画廊详情复制线路

继续使用现有：

```text
POST /api/canvases/:id/duplicate
```

Canvas v2 只负责打开返回的新画布。

### 8.3 从提示词库加入画布

输入 payload：

```json
{
  "kind": "prompt",
  "promptId": 456,
  "title": "...",
  "prompt": "...",
  "tags": []
}
```

行为：

- 插入 prompt 节点。
- 如果有封面图，插入 image 节点作为参考，但不把图片二进制写入 JSON。

## 9. 构建与部署

### 9.1 package scripts

根目录新增脚本建议：

```json
{
  "scripts": {
    "canvas:v2:install": "npm install --prefix apps/canvas-v2",
    "canvas:v2:build": "npm run build --prefix apps/canvas-v2",
    "canvas:v2:check": "npm run typecheck --prefix apps/canvas-v2",
    "smoke:canvas-v2": "node scripts/smoke/check-canvas-v2.mjs"
  }
}
```

如果不想改变根项目依赖，Canvas v2 的依赖只放在 `apps/canvas-v2/package.json`。

### 9.2 Docker build

当前 Dockerfile 后续需要增加两段：

1. 安装并构建 `apps/canvas-v2`。
2. 把构建产物复制到 `/app/public/canvas-v2`。

要求：

- 生产镜像不携带 `apps/canvas-v2/node_modules`。
- 构建失败必须阻断部署。
- 如果临时不想改 Dockerfile，可以先本地构建产物随源码包上传，但这只是过渡方案。

### 9.3 版本与缓存

- Canvas v2 静态资源使用 hash。
- `APP_VERSION` 每次切入口时必须更新。
- `/api/version` smoke 需要确认线上不是旧包。

## 10. 分阶段实施

### Phase 0：许可证与代码引入

目标：把上游源码以可追踪方式放入项目。

任务：

- 新增 `apps/canvas-v2`。
- 保留上游 `LICENSE`。
- 新增 `apps/canvas-v2/UPSTREAM.md`，记录来源仓库、commit、迁入日期、修改说明。
- 根项目许可证从 `UNLICENSED` 调整为与实际发布策略一致，至少不能和 AGPL 代码冲突。

验收：

- 仓库能清楚看出哪些代码来自上游。
- 没有把私有配置、API Key、服务器路径放进公开源码。

### Phase 1：子应用能打开

目标：`/canvas-v2` 可访问。

任务：

- 接入构建工具。
- 服务端为 `/canvas-v2` 返回新前端。
- 新画布只显示 shell、项目列表、空画布。
- 能调用 `/api/health` 并识别未登录状态。

验收：

- `GET /canvas-v2` 返回 200。
- 刷新任意 `/canvas-v2/*` 子路径不 404。
- 未登录用户看到登录提示，不出现空白页。

### Phase 2：项目 CRUD 与保存

目标：v2 能替代旧画布最基础的持久化。

任务：

- 项目列表接 `/api/canvases`。
- 新建、打开、重命名、删除画布。
- 编辑节点后 debounce 保存。
- 保存失败保留本地 dirty 状态。
- 转换内部状态到 `ai-image-studio.canvas.v1`。

验收：

- 刷新后节点仍存在。
- 另一浏览器打开同一画布能看到服务端保存结果。
- 非作者不能打开私有画布。

### Phase 3：核心编辑可用

目标：用户能用 v2 组织创作线路。

任务：

- 节点拖拽、缩放、删除、复制、粘贴。
- 图片、文本、提示词、配置、输出节点。
- 连线和上游高亮。
- 小地图。
- 快捷键。

验收：

- 100 个节点拖动画布不卡死。
- 连线关系保存后能恢复。
- 删除节点能清理相关边。

### Phase 4：生成链路

目标：v2 能真实生成图片。

任务：

- output 节点调用 `/api/canvases/:id/generate`。
- 生成中显示排队、运行、失败、成功状态。
- 成功后把生成图写回 output 节点。
- 不允许前端绕过积分和 provider 设置。

验收：

- 文本 prompt 上游能生成。
- 图片 + prompt 上游能走图生图。
- 积分不足、API 未配置、生成失败都有稳定错误显示。

### Phase 5：入口切换

目标：让真实用户默认进入 v2。

任务：

- 首页结果卡“加入画布”进入 v2。
- 画廊详情“用此线路新建画布”进入 v2。
- 提示词详情“加入画布”进入 v2。
- `/canvas` 重定向到 `/canvas-v2`。
- 旧 `public/canvas*.js` 标记 deprecated。

验收：

- 新用户不会再进入旧不可用画布。
- 已有旧画布数据可被 v2 打开。
- 回滚开关可把入口临时切回旧画布或隐藏画布入口。

## 11. Smoke 测试

新增：

```text
scripts/smoke/check-canvas-v2.mjs
```

最小覆盖：

- `/canvas-v2` 返回 200。
- 构建 JS/CSS 返回 200。
- 未登录访问 API 返回预期 401/403，不是 500。
- 登录后创建画布。
- 保存一个 text 节点和 output 节点。
- 刷新读取后节点存在。
- 导出 JSON schema 是 `ai-image-studio.canvas.v1`。

后续生成 smoke：

- 使用测试用户创建画布。
- 写入 prompt/config/output。
- 调 `/api/canvases/:id/generate`。
- 如果 provider 未配置，断言返回明确错误。
- 如果 provider 配置了 mock，断言生成结果写入 output。

## 12. 回滚策略

Canvas v2 必须可回滚：

- 灰度阶段只隐藏 `/canvas-v2` 入口，不删除代码。
- `/canvas` 切换时用 feature flag 控制目标。
- 数据保存仍使用 `ai-image-studio.canvas.v1`，旧服务端可以继续读取。
- 不在 Phase 1-5 修改现有 `canvas_projects` 表结构；如必须加字段，使用兼容默认值。
- 旧画布脚本在 v2 连续稳定至少两个发布周期后再删除。

## 13. 风险与处理

| 风险 | 处理 |
| --- | --- |
| AGPL 合规不完整 | 保留 LICENSE、UPSTREAM、源码链接，公开对应版本 |
| 子应用构建增加部署复杂度 | 构建产物进入 `public/canvas-v2`，Docker 构建失败即停止 |
| 上游状态结构和本项目 schema 不一致 | 只在 adapter 层转换，后端仍存 `ai-image-studio.canvas.v1` |
| 生成绕过额度 | 删除上游直连生成，所有生成只调 `/api/canvases/:id/generate` |
| 图片 data/blob 写入 JSON | 保存转换层过滤，后端导入再校验 |
| 一次迁入太多功能 | 第一阶段只做项目、编辑、保存、生成、入口切换 |
| 旧画布数据无法打开 | 写 v1 schema 兼容转换，不改变已有 `dataJson` 基本字段 |
| 打包体积过大 | 只保留画布必需依赖，删除上游无关页面和演示素材 |

## 14. 完成定义

Canvas v2 第一阶段完成必须同时满足：

- `/canvas-v2` 可登录访问。
- 可以创建、保存、刷新恢复画布。
- 可以添加图片、文本、提示词、配置、输出节点。
- 可以连线并从 output 节点触发生成。
- 生成继续走本项目后端、积分和图片落库。
- 首页、画廊、提示词至少一个入口能把内容插入 v2。
- smoke 覆盖静态资源、CRUD、保存恢复和生成接口。
- 线上可通过 feature flag 回滚。
- AGPL 来源和许可证说明已写入仓库。

## 15. 下一步执行顺序

推荐立即执行：

1. 创建 `apps/canvas-v2` 并迁入上游前端源码。
2. 写 `UPSTREAM.md` 和许可证说明。
3. 删除或禁用上游本地 API Key、浏览器直连生成、Go 后端调用。
4. 实现 `adapters/ai-image-studio-api.ts`。
5. 接 `/canvas-v2` 静态路由。
6. 先打通 `/api/health`、`GET /api/canvases`、`POST /api/canvases`、`PATCH /api/canvases/:id`。
7. 再接 `/api/canvases/:id/generate`。
8. 最后切入口，不要一开始替换 `/canvas`。

## 16. 当前实施状态

本节记录 Canvas v2 迁移的实际进展，供后续接手者快速了解现状。

### 16.1 各 Phase 完成情况

| Phase | 目标 | 状态 | 说明 |
| --- | --- | --- | --- |
| Phase 0 | 许可证与代码引入 | 已完成 | `apps/canvas-v2/` 已建立，LICENSE 和 UPSTREAM.md 已写入 |
| Phase 1 | 子应用能打开 | 已完成 | `/canvas-v2` 可访问，shell 可渲染，登录态可识别 |
| Phase 2 | 项目 CRUD 与保存 | 已完成 | 列表、新建、打开、保存、删除均可用 |
| Phase 3 | 核心编辑可用 | 已完成第一阶段 | 节点拖拽、缩放、连线、小地图、框选、复制粘贴和基础导入均已有实现 |
| Phase 4 | 生成链路 | 已完成第一阶段 | output 节点可触发生成，队列状态、结果回写、错误保留和 smoke 验证已接入 |
| Phase 5 | 入口切换 | 已完成第一阶段 | 首页、画廊、提示词入口已切向 v2，并保留 `CANVAS_ENTRY_MODE` 回滚开关 |

### 16.2 已实现的技术能力

- 零依赖纯 JS 子应用，自带 content-hash 构建脚本。
- 完整的 API adapter 层（CSRF、错误处理、所有 CRUD + generate 接口）。
- Canvas schema 规范化层（节点/边校验、ephemeral URL 过滤）。
- 编辑器模型层（节点 CRUD、连线、框选、复制粘贴、上游依赖遍历）。
- 编辑器视图层（节点渲染、SVG 连线、小地图、工具栏、生成按钮）。
- 生成链路（BFS 查找 config、状态机、结果回写、失败保留）。
- Shell 三栏布局（项目列表、画布编辑器、状态面板）。

### 16.3 尚未实现或待完善

- Canvas v2 的大规模真实用户验证仍不足，后续需要继续收集节点编辑、连线和生成失败边界反馈。
- 导入、外部 payload、移动端和生成错误路径已有基础实现或 smoke 覆盖，但仍需要随产品反馈继续打磨交互细节。
- 视觉回归纳入 `AIS-RLS-093` 收口，避免后续 polish 回退。

### 16.4 当前已知问题

- 旧画布（v1）仍不应作为后续生产演进基线；需要保留回滚能力，但新功能应进入 Canvas v2。
- Canvas v2 的节点编辑交互尚未经过大规模用户验证。
- 生成链路的错误处理、积分退还和供应商异常仍需要更多真实环境边界测试。
- 前端视觉 QA 基线仍在 `AIS-RLS-093` 中收口。

### 16.5 下一步优先事项

1. 完成 `AIS-RLS-093` 的视觉回归截图人工确认和 baseline 策略。
2. 继续验证生成链路边界场景（积分不足、供应商未配置、超时、异步失败）。
3. 以 Canvas v2 为唯一新增功能承载面，旧画布只保留回滚和兼容处理。
4. 在每次入口、布局或节点交互改动后运行 Canvas v2 smoke 与视觉回归 smoke。

### 16.6 测试指南

详细的功能测试方法见：`docs/CANVAS_V2_TESTING_GUIDE.md`。
