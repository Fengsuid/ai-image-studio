# ai-image-studio Agent Playground 完善开发计划

日期：2026-05-22
状态：已拆分为 Trellis 任务 `AIS-RLS-061` 到 `AIS-RLS-069`，且这些任务已全部完成（2026-05-24 校准）。
范围：基于 `CookSleep/gpt_image_playground` 的架构参考，结合 `ai-image-studio` 现有多用户、积分、后台、画廊、画布和部署体系，规划下一阶段最值得投入的完善方向。
定位：本文件不记录私有服务器、域名、账号、密钥或部署命令；只记录可公开复用的产品、架构、接口、数据和验收标准。

> 当前完成状态见 `docs/PROJECT_PROGRESS_STATUS.md`。本文件保留 Agent Playground 阶段的设计依据和验收口径。

## 1. 判断结论

`gpt_image_playground` 的强项是个人创作工作台：

- React + TypeScript + Vite + Zustand 的现代前端工程结构。
- 浏览器 IndexedDB 保存生成历史、缩略图、原始响应和本地图片资产。
- 支持 OpenAI-compatible、fal.ai、自定义 provider 等多种前端配置。
- 有 Agent workspace、conversation、round、message、tool call 和批量生成概念。
- 重视实际参数、原始响应、错误信息和任务耗时的可追踪性。

`ai-image-studio` 的强项是平台化能力：

- Node 单体服务统一托管 API 和静态前端。
- MySQL 保存用户、作品、积分、provider、审核、通知、画布项目和生成请求。
- 已有用户系统、CSRF、CSP report-only、SSRF 防护、上传校验、公开广场、后台运营和 smoke 流程。
- 已有 Canvas v2 子应用边界，可继续作为前端工程化迁移样板。
- Provider Key 不暴露给浏览器，更适合多用户公开平台。

因此，本项目不应照搬 `gpt_image_playground` 的“浏览器直连 provider + 本地历史为主”模式。最佳完善方向是：保留 `ai-image-studio` 的服务端平台安全边界，吸收对方在 Agent 化创作、生成诊断、本地缓存、自定义 provider 映射和前端工程化上的优势。

## 2. 下一阶段总目标

把 `ai-image-studio` 从“生图 + 画廊 + 后台”升级为“可运营的 Agent 生图平台”。

核心结果：

- 用户可以通过 Agent 对话描述目标，系统自动拆解 prompt、参考图、批量生成、变体和下一步建议。
- 每次生成都有可解释的参数链路：用户输入、规范化参数、provider 实际参数、revised prompt、耗时、错误和结果文件。
- 服务端生成队列可恢复，不再依赖纯内存状态。
- Provider 配置可以表达同步生成、异步任务、polling、结果映射和能力差异。
- 前端逐步从大文件脚本迁移到模块化子应用，不影响当前线上功能。
- 浏览器侧缓存只作为性能优化，不取代 MySQL 和服务器文件存储。

## 3. 设计原则

### 3.1 服务端仍是唯一安全边界

- API Key、provider endpoint、积分扣减、图片下载、SSRF 校验、内容审核、公开发布都必须在服务端完成。
- 浏览器只保存短期 UI 状态、草稿、缩略图缓存和可丢弃的本地索引。
- 任何 provider 自定义配置都必须经过后台校验和服务端测试调用。

### 3.2 先稳定，再智能

Agent 化不能绕过现有生成队列、积分、审核和画廊发布流程。

正确顺序：

1. 先把生成请求状态、队列恢复、参数追踪补齐。
2. 再接入 Agent 对话和批量生成。
3. 最后做模板市场、自动推荐、多人协作等高级能力。

### 3.3 画布、会话、画廊共享同一条创作路线

同一张图不应该在不同页面有三套解释：

- 文生图会话展示它从哪个 prompt 来。
- 画布展示它从哪个节点和上游节点来。
- 画廊详情展示它的公开创作路线、参数、标签和可复制入口。

后续数据结构应尽量复用 `generation_requests`、`generations`、`canvas_generation_links`，再补 `agent_sessions` 和 `generation_trace`。

## 4. 目标架构

```text
Browser
  ├─ Home / Chat / Gallery / Admin
  ├─ Canvas v2 sub app
  ├─ Agent workspace sub app
  └─ IndexedDB cache
       ├─ recent images
       ├─ thumbnails
       ├─ unsynced drafts
       └─ local UI snapshots

Node server
  ├─ Auth / CSRF / rate limit
  ├─ Generation API
  ├─ Agent orchestration API
  ├─ Provider router
  ├─ Persistent generation queue runner
  ├─ Image download / validation / storage
  ├─ Gallery / moderation / credits
  └─ Admin diagnostics

MySQL
  ├─ users / sessions / credits
  ├─ provider_configs
  ├─ generation_requests
  ├─ generation_trace
  ├─ generations
  ├─ agent_sessions / agent_messages / agent_steps
  ├─ canvas_projects / canvas_generation_links
  └─ prompts / tags / public gallery
```

## 5. P0：生成队列持久化与诊断底座

优先级：最高。
原因：这是 Agent、批量生成、provider polling、后台运维的共同基础。

### 5.1 持久化队列

现状：

- 服务端已有 `generationQueue`、`generationJobs` 和 `generationQueueRunning`。
- `generation_requests` 已落库，但队列执行态仍主要依赖内存。
- 容器重启后，内存队列丢失，旧 `queued` 记录可能变成僵尸任务。

目标：

- `generation_requests` 成为队列事实来源。
- 进程启动时自动扫描 `queued`、超时 `running`、可重试 `failed_retryable`。
- 支持任务取消、重试、超时恢复、失败分类和后台查看。

建议字段：

```sql
ALTER TABLE generation_requests
  ADD COLUMN queue_status VARCHAR(32) NOT NULL DEFAULT 'queued',
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN max_attempts INT NOT NULL DEFAULT 1,
  ADD COLUMN locked_by VARCHAR(96) NULL,
  ADD COLUMN locked_at DATETIME NULL,
  ADD COLUMN started_at DATETIME NULL,
  ADD COLUMN finished_at DATETIME NULL,
  ADD COLUMN provider_task_id VARCHAR(191) NULL,
  ADD COLUMN next_poll_at DATETIME NULL,
  ADD COLUMN retry_after_at DATETIME NULL,
  ADD COLUMN latency_ms INT NULL;
```

状态建议：

| 状态 | 含义 |
| --- | --- |
| `queued` | 等待执行 |
| `running` | 已被当前 runner 锁定 |
| `polling` | provider 异步任务已提交，等待查询结果 |
| `succeeded` | 已生成并落地 |
| `failed` | 失败且不可自动重试 |
| `failed_retryable` | 失败但可重试 |
| `cancelled` | 用户取消或服务端取消 |
| `expired` | 长时间无结果，系统清理 |

验收：

- 重启服务后，10 分钟前的 `running` 任务不会永久卡住。
- 队列并发仍受 `GENERATION_QUEUE_CONCURRENCY` 控制。
- 失败任务能在后台看到失败阶段、provider 错误、是否扣积分、是否已退款。
- smoke 能构造 queued/running 超时记录并验证启动清理逻辑。

### 5.2 生成追踪表

新增 `generation_trace`，记录生成链路中的关键阶段。

```sql
CREATE TABLE generation_trace (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  generation_id VARCHAR(32) NULL,
  user_id VARCHAR(32) NULL,
  stage VARCHAR(64) NOT NULL,
  level VARCHAR(16) NOT NULL DEFAULT 'info',
  message VARCHAR(512) NOT NULL DEFAULT '',
  data_json JSON NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_generation_trace_request (request_id, created_at),
  INDEX idx_generation_trace_generation (generation_id, created_at),
  INDEX idx_generation_trace_user_created (user_id, created_at)
);
```

阶段建议：

- `request_received`
- `auth_checked`
- `credit_reserved`
- `provider_selected`
- `params_normalized`
- `provider_submitted`
- `provider_polled`
- `image_downloaded`
- `image_validated`
- `generation_saved`
- `gallery_published`
- `credit_charged`
- `credit_refunded`
- `failed`

验收：

- 后台可以打开一条生成请求详情，看到从提交到成功或失败的完整时间线。
- 用户侧失败提示仍保持简洁，但管理员能看到 provider 具体错误摘要。
- trace 中不保存完整 API Key、cookie、用户密码或过长原始响应。

### 5.3 实际参数记录

给 `generation_requests` 或关联表补充字段：

```sql
ALTER TABLE generation_requests
  ADD COLUMN requested_params_json JSON NULL,
  ADD COLUMN normalized_params_json JSON NULL,
  ADD COLUMN provider_params_json JSON NULL,
  ADD COLUMN provider_response_json JSON NULL,
  ADD COLUMN revised_prompt TEXT NULL,
  ADD COLUMN error_code VARCHAR(96) NULL,
  ADD COLUMN error_stage VARCHAR(64) NULL;
```

约束：

- `provider_response_json` 只保存安全摘要，不保存临时下载 URL 的长期敏感签名，必要时截断。
- 图片 URL 如果来自 provider，应在下载落地后只保留 host、content-type、bytes、duration，不长期保存完整签名 URL。
- 后台详情需要明确标注“用户请求参数”和“provider 实际参数”。

## 6. P1：Agent 生图工作台

优先级：高。
原因：这是最能形成产品差异的功能，也是对 `gpt_image_playground` 最值得吸收的部分。

### 6.1 产品形态

新增 `Agent 创作` 入口，可以从三个地方进入：

- 首页：`让 AI 帮我设计一组图`
- 文生图结果：`继续让 Agent 优化`
- 画布输出节点：`用 Agent 扩展路线`

交互目标：

```text
用户：我想做一组赛博茶饮品牌海报，适合小红书。
Agent：
  1. 拆成 4 个方向：产品主视觉、人物饮用、包装细节、门店氛围。
  2. 给每个方向生成 prompt 和参数。
  3. 询问是否统一色调、比例、Logo 占位。
用户：统一成青绿色，加一点宋代瓷器质感。
Agent：
  1. 更新 4 个 prompt。
  2. 发起批量生成。
  3. 生成后总结哪两张适合公开，哪两张适合继续图生图。
```

### 6.2 数据模型

```sql
CREATE TABLE agent_sessions (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  title VARCHAR(160) NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'agent',
  source_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  summary TEXT NULL,
  data_json JSON NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_agent_sessions_user_updated (user_id, updated_at)
);

CREATE TABLE agent_messages (
  id VARCHAR(32) PRIMARY KEY,
  session_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  role VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  attachments_json JSON NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_agent_messages_session_created (session_id, created_at)
);

CREATE TABLE agent_steps (
  id VARCHAR(32) PRIMARY KEY,
  session_id VARCHAR(32) NOT NULL,
  message_id VARCHAR(32) NULL,
  kind VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  input_json JSON NULL,
  output_json JSON NULL,
  request_id VARCHAR(64) NULL,
  generation_id VARCHAR(32) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_agent_steps_session_created (session_id, created_at),
  INDEX idx_agent_steps_request (request_id)
);
```

`kind` 建议：

- `plan`
- `rewrite_prompt`
- `extract_style`
- `generate_batch`
- `edit_image`
- `rank_outputs`
- `publish_suggestion`
- `canvas_route_suggestion`

### 6.3 API 草案

```text
GET    /api/agent-sessions
POST   /api/agent-sessions
GET    /api/agent-sessions/:id
PATCH  /api/agent-sessions/:id
DELETE /api/agent-sessions/:id

POST   /api/agent-sessions/:id/messages
POST   /api/agent-sessions/:id/plan
POST   /api/agent-sessions/:id/generate
POST   /api/agent-sessions/:id/steps/:stepId/cancel
POST   /api/agent-sessions/:id/export-canvas
```

接口规则：

- 所有写操作走现有 CSRF。
- Agent 发起生成时复用现有生成队列、积分和 provider router。
- 批量生成必须先返回计划和预估积分，用户确认后才扣减。
- Agent 不能绕过公开审核和标签规则。
- 生成失败按单张图退款，不影响同批次其他图。

### 6.4 Agent 输出格式

服务端内部应使用结构化 JSON，不只保存自然语言。

```json
{
  "intent": "brand_poster_series",
  "style": {
    "palette": ["cyan green", "porcelain white"],
    "mood": "premium, quiet, futuristic"
  },
  "variants": [
    {
      "title": "Product hero poster",
      "prompt": "...",
      "size": "1024x1536",
      "quality": "high",
      "publicHint": true
    }
  ],
  "questions": [
    "是否需要加入品牌 Logo 占位？"
  ]
}
```

验收：

- 用户能从一句自然语言生成一组至少 2 到 4 个可执行生成方案。
- 用户确认前不扣积分。
- 每个 Agent step 能关联到具体 `generation_requests`。
- Agent 会话可以导出为 Canvas v2 项目，包含 prompt 节点、config 节点、output 节点和生成结果。

## 7. P1：Provider 能力矩阵与自定义映射

优先级：高。
原因：当前 provider endpoint 推导已经可用，但对异步 provider、特殊响应结构、能力差异表达不足。

### 7.1 Provider 能力模型

给 `provider_configs` 增加能力配置：

```json
{
  "capabilities": {
    "textToImage": true,
    "imageToImage": true,
    "responses": true,
    "asyncTasks": false,
    "batch": false,
    "revisedPrompt": true,
    "transparentBackground": false,
    "sizes": ["1024x1024", "1024x1536", "1536x1024"],
    "qualities": ["standard", "high"],
    "formats": ["png", "jpeg", "webp"]
  }
}
```

用途：

- 前端只展示当前 provider 支持的参数。
- Agent 规划时不生成 provider 不支持的组合。
- smoke 可以对 provider 能力做最小测试。
- 后台能展示“文生图可用、图生图不可用、Responses 不可用”等状态。

### 7.2 自定义 provider 映射

新增 `provider_mapping_json`：

```json
{
  "mode": "openai-compatible",
  "submit": {
    "method": "POST",
    "path": "/v1/images/generations",
    "bodyTemplate": {
      "model": "{{model}}",
      "prompt": "{{prompt}}",
      "size": "{{size}}",
      "n": "{{n}}"
    }
  },
  "result": {
    "imageUrlPath": "$.data[0].url",
    "b64JsonPath": "$.data[0].b64_json",
    "revisedPromptPath": "$.data[0].revised_prompt"
  }
}
```

异步 provider 示例：

```json
{
  "mode": "async-task",
  "submit": {
    "method": "POST",
    "path": "/generate",
    "taskIdPath": "$.id"
  },
  "poll": {
    "method": "GET",
    "path": "/tasks/{{providerTaskId}}",
    "statusPath": "$.status",
    "successValues": ["completed"],
    "failedValues": ["failed", "cancelled"],
    "imageUrlPath": "$.result.image_url"
  }
}
```

约束：

- 第一阶段只支持安全的 JSON path 子集，不支持任意 JavaScript 表达式。
- 后台保存前必须执行 schema 校验。
- 测试调用必须走服务端，不把 key 发给浏览器。
- 映射结果里的 URL 仍必须过 SSRF 校验。

验收：

- 后台可以新增一个 OpenAI-compatible provider，并通过测试生成。
- 后台可以配置一个异步 provider mock，通过 submit + poll 完成生成。
- 前端参数面板能根据 provider capabilities 自动禁用不支持参数。

## 8. P2：浏览器 IndexedDB 缓存

优先级：中。
原因：它能改善移动端和画廊性能，但不能替代服务端持久化。

### 8.1 缓存内容

建议缓存：

- 最近打开的作品详情 JSON。
- 最近 100 到 300 张缩略图 Blob。
- 画布本地草稿的大图引用和节点快照。
- Agent 会话最近消息的只读快照。
- 上传前的本地图片 SHA-256、尺寸、MIME 和预览图。

不缓存：

- API Key。
- 用户密码。
- 管理后台敏感数据。
- 未公开的他人原图。
- 长期有效的 provider 临时下载 URL。

### 8.2 缓存 API

前端新增 `public` 或子应用模块：

```text
cache-db
  ├─ openCacheDb()
  ├─ putImageBlob(key, blob, meta)
  ├─ getImageBlob(key)
  ├─ putJsonSnapshot(key, value, ttl)
  ├─ getJsonSnapshot(key)
  ├─ pruneCache(maxBytes)
  └─ clearUserCache(userId)
```

缓存 key 规则：

```text
image:generation:<generationId>:thumb
image:generation:<generationId>:full
image:prompt:<promptId>:thumb
canvas:<canvasId>:draft-snapshot
agent:<sessionId>:snapshot
```

验收：

- 第二次打开同一作品详情，缩略图可从本地缓存显示，再后台校验新版本。
- 用户退出登录时清理当前用户缓存索引。
- 缓存容量超限时按最近访问时间淘汰。
- IndexedDB 不可用时页面仍正常工作。

## 9. P2：前端工程化迁移

优先级：中。
原因：当前主前端和后台脚本已经较大，继续堆功能会显著增加回归风险。

### 9.1 迁移策略

不要一次性重写。采用“新功能子应用 + 老功能稳定迁移”的方式。

阶段：

1. 保持 `public/app.js`、`public/admin.js` 线上稳定。
2. 以 `apps/canvas-v2` 为模板新增 `apps/agent-workspace`。
3. 新功能先进入子应用，使用现有 `/api/*`。
4. 后续把后台独立页迁移到 `apps/admin-console`。
5. 最后再评估首页、画廊、我的作品是否迁移。

### 9.2 推荐目录

```text
apps/
  canvas-v2/
  agent-workspace/
    src/
      adapters/
        ai-image-studio-api.ts
        cache-db.ts
      app/
        create-agent-app.ts
        shell.ts
      features/
        session-list/
        message-thread/
        generation-plan/
        batch-results/
        export-canvas/
      styles.css
  admin-console/
    src/
      features/
        generation-requests/
        provider-diagnostics/
        users/
        gallery-moderation/
```

是否引入 React / TypeScript：

- 如果只做小子应用，可继续使用当前 Canvas v2 的零依赖构建策略。
- 如果 Agent 工作台进入复杂状态管理，建议引入 TypeScript 和轻量构建工具。
- React 不是必须，但 TypeScript 对 provider mapping、Agent step、generation trace 这类结构化数据收益更高。

### 9.3 模块边界

前端子应用不得：

- 直接调用 OpenAI-compatible provider。
- 保存 provider key。
- 绕过 `/api/canvases/:id/generate` 或 `/api/generations`。
- 自己计算积分扣减。

前端子应用必须：

- 使用现有登录态。
- 使用现有 CSRF cookie/header。
- 使用服务端返回的 provider capabilities。
- 所有图片显示优先走同源文件或同源代理。

## 10. P3：画廊、画布和 Agent 的创作路线统一

优先级：中低。
原因：这是产品高级体验，需要建立在 P0/P1 稳定后。

### 10.1 统一路线模型

新增 `creative_route_json`，可以保存在 `generations` 或单独 route 表中。

```json
{
  "source": {
    "type": "agent_session",
    "id": "agt_..."
  },
  "nodes": [
    {
      "id": "prompt_1",
      "type": "prompt",
      "label": "主视觉 prompt",
      "text": "..."
    },
    {
      "id": "config_1",
      "type": "config",
      "model": "GPT-IMAGE-2",
      "size": "1024x1536"
    },
    {
      "id": "output_1",
      "type": "generation",
      "generationId": "gen_..."
    }
  ],
  "edges": [
    { "source": "prompt_1", "target": "output_1" },
    { "source": "config_1", "target": "output_1" }
  ]
}
```

用途：

- 画廊详情页展示创作路线。
- 用户可以“一键复制路线到画布”。
- Agent 会话可以导出画布。
- 后台审核可以看到图片来自哪个 prompt、参考图和 provider。

### 10.2 UI 验收

- 画廊详情页左侧主图与右侧路线条目联动。
- 点击 `输入图`、`结果图`、`路线节点` 都只切换 selected media，不重开弹窗。
- 从画廊复制路线到画布后，未公开源图不泄露。
- 从 Agent 导出的 Canvas v2 能继续生成和保存。

## 11. 后台完善

### 11.1 生成请求详情页

新增或增强后台生成请求页面：

- 请求列表：状态、用户、provider、模型、耗时、积分、错误阶段。
- 请求详情：用户输入、规范化参数、provider 参数、trace 时间线、结果图。
- 操作：重试、取消、标记失败、复制错误摘要。
- 筛选：状态、provider、模型、用户、日期、错误阶段。

### 11.2 Provider 诊断页

能力：

- 测试 Responses endpoint。
- 测试 Images generation endpoint。
- 测试 Image edit endpoint。
- 测试异步 submit/poll。
- 展示最近 24 小时成功率、P50/P95 延迟、主要错误码。

### 11.3 Agent 运营页

能力：

- 查看 Agent 会话数量、生成转化率、平均生成张数。
- 查看失败最多的 Agent step 类型。
- 管理 Agent prompt 模板。
- 禁用异常模板或高失败模板。

## 12. Smoke 与 QA

### 12.1 新增 smoke 脚本

建议新增：

```text
npm run smoke:generation-queue-recovery
npm run smoke:generation-trace
npm run smoke:provider-capabilities
npm run smoke:provider-async-mock
npm run smoke:agent-session-api
npm run smoke:agent-batch-generation
npm run smoke:agent-export-canvas
npm run smoke:indexeddb-cache-static
```

### 12.2 必测场景

- 服务重启时，旧 `running` 任务被释放或标记失败。
- 用户取消任务后，积分正确退款。
- provider 返回 URL 时，SSRF 防护仍生效。
- provider 返回 base64 时，图片 MIME 和大小校验仍生效。
- Agent 批量生成中一张失败，不影响其他张。
- Agent 导出画布时，不包含未公开源图。
- IndexedDB 不可用时，页面降级为无缓存。
- 后台 trace 不泄露 API Key。

## 13. 推荐实施批次

### Batch A：队列和诊断底座

目标：

- DB-backed queue runner。
- `generation_trace`。
- 实际参数记录。
- 后台生成请求详情。
- smoke 覆盖重启恢复、失败退款、trace 脱敏。

完成标准：

- 生成链路稳定性明显提升。
- 任何失败都能定位到阶段。
- Agent 批量生成有可靠底座。

### Batch B：Provider 能力矩阵

目标：

- `provider_configs` 增加 capabilities 和 mapping。
- 后台 provider 测试工具。
- 前端参数面板读取 capabilities。
- 异步 provider mock smoke。

完成标准：

- 后台能说明每个 provider 支持什么。
- 用户不会选择当前 provider 不支持的参数。
- 异步 provider 可以进入同一队列。

### Batch C：Agent MVP

目标：

- Agent session / message / step 数据表。
- Agent 对话页。
- 单轮计划生成。
- 用户确认后批量生成。
- 结果回写会话并可加入画布。

完成标准：

- 一句需求可以生成一组方案。
- 方案确认前不扣积分。
- 每张图都有 request trace。
- 可以从 Agent 导出 Canvas v2。

### Batch D：本地缓存与体验优化

目标：

- IndexedDB 缩略图缓存。
- 最近作品详情缓存。
- Agent 会话快照。
- 画廊详情二次打开加速。

完成标准：

- 缓存命中时首屏更快。
- 登出清理当前用户缓存。
- 缓存失败不影响主流程。

### Batch E：前端工程化扩展

目标：

- `apps/agent-workspace` 独立构建。
- 后台生成诊断页逐步从 `admin.js` 拆出。
- 子应用共享 API adapter、CSRF、错误处理和缓存模块。

完成标准：

- 新功能不继续扩大 `public/app.js` 和 `public/admin.js`。
- 子应用有独立 check/build/smoke。
- 旧入口可灰度或隐藏。

## 14. Trellis / Rellis 任务建议

建议新增任务：

| ID 建议 | 标题 | 优先级 | 依赖 |
| --- | --- | --- | --- |
| AIS-RLS-061 | DB-backed generation queue recovery | P0 | 无 |
| AIS-RLS-062 | Generation trace and provider diagnostics | P0 | AIS-RLS-061 |
| AIS-RLS-063 | Provider capabilities and async mapping | P1 | AIS-RLS-062 |
| AIS-RLS-064 | Agent session data model and API | P1 | AIS-RLS-061 |
| AIS-RLS-065 | Agent workspace MVP | P1 | AIS-RLS-064 |
| AIS-RLS-066 | Agent batch generation and canvas export | P1 | AIS-RLS-063, AIS-RLS-065 |
| AIS-RLS-067 | IndexedDB image and draft cache | P2 | AIS-RLS-065 |
| AIS-RLS-068 | Admin generation request diagnostics page | P1 | AIS-RLS-062 |
| AIS-RLS-069 | Creative route unification for gallery/canvas/agent | P2 | AIS-RLS-066 |

任务落盘提醒：

- 如果把以上任务写入公开任务文档，必须同步真实 `.trelis/tasks` 目录。
- `task.py` 当前状态值应以实际工具支持为准，不要只改 Markdown。
- worker 不应自行 finish 任务；主控在 smoke 和部署验证后收尾。

## 15. 不做事项

第一阶段不要做：

- 不把 provider API Key 存到浏览器。
- 不让浏览器直接调用 OpenAI-compatible provider。
- 不以 IndexedDB 作为唯一历史来源。
- 不在 Agent MVP 中做多人协同编辑。
- 不做任意 JavaScript provider mapping。
- 不把完整 provider 原始响应长期无脱敏保存。
- 不把未公开原图导出到公开画布或公开 Agent 分享。

## 16. 最小可交付定义

如果只选一个最小版本，应交付：

1. DB-backed queue recovery。
2. Generation trace。
3. Provider capabilities。
4. Agent session API。
5. Agent 生成计划 + 用户确认 + 批量生成。
6. Agent 结果加入 Canvas v2。
7. 后台能查看每个 Agent 生成请求的 trace。

这 7 项完成后，`ai-image-studio` 会从普通生图站升级为可运营、可诊断、可扩展的 Agent 生图工作台。
