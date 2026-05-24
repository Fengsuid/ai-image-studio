# ai-image-studio Trellis 任务分配总表

日期：2026-05-20
状态：已与真实 Trellis 目录 `D:\生图广场\.trelis\tasks` 同步（最新校准：2026-05-24）。
主任务来源：`IMAGE_STUDIO_RELLIS_TASKS.md`
设计来源：`IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md`、`IMAGE_STUDIO_ADMIN_HOME_REDESIGN_PLAN.md`、`IMAGE_STUDIO_CANVAS_RANKING_PROMPT_DEVELOPMENT_PLAN.md`

## 1. 使用规则

Trellis 看板只使用 `AIS-RLS-*` 作为主任务号。历史设计稿里的 `T016` 到 `T031` 不再单独建重复卡，而是作为别名映射到对应 `AIS-RLS-*` 卡片。

建议看板列：

1. `Backlog`
2. `Ready`
3. `In Progress`
4. `Review`
5. `Deploy`
6. `Done`

建议泳道：

- `Experience`：首页、生成流、画廊详情、卡片交互。
- `Gallery`：公开作品、榜单、审核、点赞、文件可靠性。
- `Prompt`：提示词库、远程来源、标签、重复治理。
- `Canvas`：画布工作台、线路、模板、反单文件治理。
- `Admin`：后台、用户、Provider、公告、运营页。
- `Platform`：安全、性能、QA、部署、可观测性。

## 2. 当前优先执行

当前真实 Trellis 中没有 `backlog` 任务，只有 1 张 `active` 卡：

| 顺序 | Trellis 任务 | 泳道 | 原因 |
| --- | --- | --- | --- |
| 1 | `AIS-RLS-093` Visual regression QA harness for polished frontend | Platform/QA | 前端 polish 已完成，需要截图回归脚本、baseline 策略和发布前视觉检查闭环 |

## 3. 全量 Trellis 任务表

| Trellis ID | 标题 | 状态 | 优先级 | 泳道 | 里程碑 | 依赖/别名 |
| --- | --- | --- | --- | --- | --- | --- |
| `AIS-RLS-001` | 画廊图片前端兜底 | Done | P0 | Gallery | M1 画廊可靠性 | 无 |
| `AIS-RLS-002` | 后台图片文件巡检 | Done | P0 | Gallery | M1 画廊可靠性 | `AIS-RLS-001` |
| `AIS-RLS-003` | 画廊详情可分享路由 | Done | P0 | Gallery | M1 画廊可靠性 | 无 |
| `AIS-RLS-004` | 排行榜 SQL 口径修正 | Done | P0 | Gallery | M1 画廊可靠性 | 无 |
| `AIS-RLS-005` | 排行榜前端布局重构 | Done | P0 | Gallery | M1 画廊可靠性 | `AIS-RLS-004` |
| `AIS-RLS-006` | 图生图详情展示输入图 | Done | P0 | Gallery | M1 画廊可靠性 | `AIS-RLS-003` |
| `AIS-RLS-007` | 公开作品作者署名与管理入口 | Done | P0 | Gallery | M1 画廊可靠性 | `AIS-RLS-003` |
| `AIS-RLS-008` | 提示词分类表迁移 | Done | P0 | Prompt | M2 提示词与远程数据 | 无 |
| `AIS-RLS-009` | prompts 表字段升级 | Done | P0 | Prompt | M2 提示词与远程数据 | `AIS-RLS-008` |
| `AIS-RLS-010` | 远程提示词来源表与同步记录 | Done | P0 | Prompt | M2 提示词与远程数据 | `AIS-RLS-009` |
| `AIS-RLS-011` | 接入五个远程提示词仓库 | Done | P0 | Prompt | M2 提示词与远程数据 | `AIS-RLS-010` |
| `AIS-RLS-012` | 提示词无封面卡片与详情页 | Done | P0 | Prompt | M2 提示词与远程数据 | `AIS-RLS-009` |
| `AIS-RLS-013` | 提示词点赞与热度排序 | Done | P1 | Prompt | M2 提示词与远程数据 | `AIS-RLS-009` |
| `AIS-RLS-014` | 大模型提示词重复审核接口 | Done | P1 | Prompt | M2 提示词与远程数据 | `AIS-RLS-010`; 后续真实审核见 P2 |
| `AIS-RLS-015` | 主页和导航新增画布入口 | Done | P0 | Canvas | M3 画布 MVP | 无 |
| `AIS-RLS-016` | 画布路由和视图骨架 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-015` |
| `AIS-RLS-017` | canvas_projects 数据表与基础 API | Done | P0 | Canvas | M3 画布 MVP | 无 |
| `AIS-RLS-018` | 画布前端文件拆分 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-016` |
| `AIS-RLS-019` | 画布基础交互 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-016`, `AIS-RLS-018` |
| `AIS-RLS-020` | 画布节点系统 MVP | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-019` |
| `AIS-RLS-021` | 画布连线与上游输入收集 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-020` |
| `AIS-RLS-022` | 从首页/画廊/提示词/作品加入画布 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-017`, `AIS-RLS-020` |
| `AIS-RLS-023` | 画布生成接口 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-017`, `AIS-RLS-021` |
| `AIS-RLS-024` | 画布自动保存与草稿恢复 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-017`, `AIS-RLS-019` |
| `AIS-RLS-025` | 画布生成结果发布到广场 | Done | P0 | Canvas | M3 画布 MVP | `AIS-RLS-023`, `AIS-RLS-006`, `AIS-RLS-007` |
| `AIS-RLS-026` | 小地图 | Done | P1 | Canvas | M4 画布增强 | `AIS-RLS-019` |
| `AIS-RLS-027` | 撤销、重做、复制粘贴 | Done | P1 | Canvas | M4 画布增强 | `AIS-RLS-020`, `AIS-RLS-021` |
| `AIS-RLS-028` | 框选、多选、分组 | Done | P1 | Canvas | M4 画布增强 | `AIS-RLS-020` |
| `AIS-RLS-029` | JSON 导入导出 | Done | P1 | Canvas | M4 画布增强 | `AIS-RLS-017`, `AIS-RLS-020` |
| `AIS-RLS-030` | 画布助手 | Done | P2 | Canvas | M4 画布增强 | `AIS-RLS-021`, `AIS-RLS-023` |
| `AIS-RLS-031` | 公开画布线路复制 | Done | P1 | Canvas | M4 画布增强 | `AIS-RLS-025` |
| `AIS-RLS-032` | 画布模板市场 | Done | P2 | Canvas | M4 画布增强 | `AIS-RLS-031` |
| `AIS-RLS-033` | 管理员首页重构 | Done | P1 | Admin | M5 后台运营 | 别名：`T016`, `T020` |
| `AIS-RLS-034` | 用户管理与积分奖励 | Done | P1 | Admin | M5 后台运营 | 别名：`T017`; 部分覆盖首发奖励 |
| `AIS-RLS-035` | 标签管理与合并 | Done | P0 | Prompt | M5 后台运营 | `AIS-RLS-008` |
| `AIS-RLS-036` | 广场内容审核与撤回管理 | Done | P1 | Gallery | M5 后台运营 | `AIS-RLS-007`; 覆盖举报、撤回、Provider 后台剩余项 |
| `AIS-RLS-037` | 公告与弹窗通知完善 | Done | P1 | Admin | M5 后台运营 | `AIS-RLS-034`, `AIS-RLS-036`; 别名：`T030` 后续增强 |
| `AIS-RLS-038` | 开发与上线 QA 清单 | Done | P0 | Platform | M5 后台运营 | 所有 P0 实现任务 |
| `AIS-RLS-039` | 画布模块边界与反单文件治理 | Done | P1 | Canvas | M4 画布增强 | `AIS-RLS-026` 到 `AIS-RLS-030` |
| `AIS-RLS-040` | 文生图生成中闪屏修复 | Done | P0 | Experience | M6 体验回归 | 无 |
| `AIS-RLS-041` | 画廊榜单侧栏化与点赞按钮优化 | Done | P1 | Gallery | M6 体验回归 | `AIS-RLS-004`, `AIS-RLS-005`; 别名：`T027` 剩余体验 |
| `AIS-RLS-042` | 文生图结果按钮收口 | Done | P0 | Experience | M6 体验回归 | `AIS-RLS-015`, `AIS-RLS-022`; 别名：`T021` 部分 |
| `AIS-RLS-043` | 接入 infinite-canvas 提示词源到画廊 | Done | P1 | Prompt | M6 体验回归 | `AIS-RLS-010`, `AIS-RLS-011`, `AIS-RLS-014` |
| `AIS-RLS-044` | 画廊详情主图联动修复 | Done | P0 | Gallery | M6 体验回归 | `AIS-RLS-003`, `AIS-RLS-006`, `AIS-RLS-025` |
| `AIS-RLS-045` | 画廊卡片标签去重与用户标签展示 | Done | P0 | Gallery | M6 体验回归 | `AIS-RLS-007`, `AIS-RLS-024`, `AIS-RLS-035` |
| `AIS-RLS-046` | 画廊展示与输入体验综合修复 | Done | P0 | Experience/Gallery/Prompt | M6 体验回归 | `AIS-RLS-041`, `AIS-RLS-043`, `AIS-RLS-044`, `AIS-RLS-045` |
| `AIS-RLS-047` | 画布工作台布局与连线系统重构 | Done | P0 | Canvas/Experience | M6 体验回归 | `AIS-RLS-039`, `AIS-RLS-046` |
| `AIS-RLS-048` | Canvas v2 源码引入与 AGPL 合规基线 | Done | P0 | Canvas/Platform | M7 Canvas v2 | 无 |
| `AIS-RLS-049` | Canvas v2 子应用 Shell、构建与 /canvas-v2 路由 | Done | P0 | Canvas/Platform | M7 Canvas v2 | `AIS-RLS-048` |
| `AIS-RLS-050` | Canvas v2 API 适配、项目 CRUD 与保存恢复 | Done | P0 | Canvas | M7 Canvas v2 | `AIS-RLS-049` |
| `AIS-RLS-051` | Canvas v2 核心编辑器交互与节点连线 | Done | P0 | Canvas/Experience | M7 Canvas v2 | `AIS-RLS-050` |
| `AIS-RLS-052` | Canvas v2 生成链路接入后端队列与积分 | Done | P0 | Canvas/Backend | M7 Canvas v2 | `AIS-RLS-051` |
| `AIS-RLS-053` | Canvas v2 首页、画廊、提示词入口与灰度切换 | Done | P0 | Canvas/Experience | M7 Canvas v2 | `AIS-RLS-052` |
| `AIS-RLS-054` | Canvas v2 QA、文档、服务器部署与发布闭环 | Done | P0 | Canvas/QA/Ops | M7 Canvas v2 | `AIS-RLS-053` |
| `AIS-RLS-055` | Mobile P0 基线截图与布局问题清单 | Done | P0 | Experience/QA | M8 Mobile Web | 无 |
| `AIS-RLS-056` | Mobile P1 首页、导航与 Composer | Done | P0 | Experience | M8 Mobile Web | `AIS-RLS-055` |
| `AIS-RLS-057` | Mobile P1 对话工作台与生成结果 | Done | P0 | Experience | M8 Mobile Web | `AIS-RLS-056` |
| `AIS-RLS-058` | Mobile P1 画廊、排行榜与详情 | Done | P0 | Gallery/Experience | M8 Mobile Web | `AIS-RLS-057` |
| `AIS-RLS-059` | Mobile P2 图片编辑器与我的作品 | Done | P1 | Experience/Gallery | M8 Mobile Web | `AIS-RLS-058` |
| `AIS-RLS-060` | Mobile QA、文档、部署与发布闭环 | Done | P0 | Platform/QA/Ops | M8 Mobile Web | `AIS-RLS-059` |
| `AIS-RLS-061` | DB-backed generation queue recovery | Done | P0 | Platform/Backend | M9 Agent/Queue | 无 |
| `AIS-RLS-062` | Generation trace and provider diagnostics | Done | P0 | Platform/Admin | M9 Agent/Queue | `AIS-RLS-061` |
| `AIS-RLS-063` | Provider capabilities and async mapping | Done | P1 | Platform/Backend | M9 Agent/Queue | `AIS-RLS-062` |
| `AIS-RLS-064` | Agent session data model and API | Done | P1 | Agent/Backend | M9 Agent/Queue | `AIS-RLS-061` |
| `AIS-RLS-065` | Agent workspace MVP | Done | P1 | Agent/Experience | M9 Agent/Queue | `AIS-RLS-064` |
| `AIS-RLS-066` | Agent batch generation and canvas export | Done | P1 | Agent/Canvas | M9 Agent/Queue | `AIS-RLS-063`, `AIS-RLS-065` |
| `AIS-RLS-067` | IndexedDB image and draft cache | Done | P2 | Experience/Frontend | M9 Agent/Queue | `AIS-RLS-065` |
| `AIS-RLS-068` | Admin generation request diagnostics page | Done | P1 | Admin/Platform | M9 Agent/Queue | `AIS-RLS-062` |
| `AIS-RLS-069` | Creative route unification for gallery/canvas/agent | Done | P2 | Experience/Platform | M9 Agent/Queue | `AIS-RLS-066` |
| `AIS-RLS-070` | CSS tokens, motion library and first visual polish | Done | P1 | Frontend | M10 Frontend Polish | `AIS-RLS-069` |
| `AIS-RLS-071` | Split public/styles.css into component CSS modules | Done | P1 | Frontend | M10 Frontend Polish | `AIS-RLS-070` |
| `AIS-RLS-072` | Dark mode and mobile bottom navigation polish | Done | P2 | Frontend/Mobile | M10 Frontend Polish | `AIS-RLS-071` |
| `AIS-RLS-073` | Split public/admin.js into admin panel modules | Done | P1 | Admin/Frontend | M10 Frontend Polish | `AIS-RLS-068` |
| `AIS-RLS-074` | Split public/app.js into public AppModules | Done | P1 | Frontend | M10 Frontend Polish | `AIS-RLS-072` |
| `AIS-RLS-075` | Continue server.js route and middleware boundary split | Done | P1 | Backend/Platform | M10 Frontend Polish | `AIS-RLS-069` |
| `AIS-RLS-076` | Split mysql-store.js into domain stores | Done | P1 | Backend/Platform | M10 Frontend Polish | `AIS-RLS-075` |
| `AIS-RLS-077` | Frontend build tooling foundation for modular app code | Done | P2 | Frontend/Platform | M10 Frontend Polish | `AIS-RLS-074`, `AIS-RLS-076` |
| `AIS-RLS-078` | Frontend visual system polish after CSS split | Done | P1 | Frontend | M10 Frontend Polish | `AIS-RLS-071`, `AIS-RLS-072` |
| `AIS-RLS-079` | Gallery and detail interaction polish | Done | P1 | Gallery/Frontend | M10 Frontend Polish | `AIS-RLS-069`, `AIS-RLS-078` |
| `AIS-RLS-080` | Composer, chat and editor responsive polish | Done | P1 | Experience/Frontend | M11 Frontend QA | `AIS-RLS-072`, `AIS-RLS-074` |
| `AIS-RLS-081` | Frontend module guardrails and file-size checks | Done | P1 | Frontend/Platform | M11 Frontend QA | `AIS-RLS-071`, `AIS-RLS-073`, `AIS-RLS-074` |
| `AIS-RLS-082` | Extract auth routes and session middleware | Done | P2 | Backend/Platform | M11 Frontend QA | `AIS-RLS-075` |
| `AIS-RLS-083` | Extract image and gallery route families | Done | P2 | Backend/Gallery | M11 Frontend QA | `AIS-RLS-075`, `AIS-RLS-079` |
| `AIS-RLS-084` | Extract generation request store domain | Done | P2 | Backend/Platform | M11 Frontend QA | `AIS-RLS-076` |
| `AIS-RLS-085` | Extract prompt and canvas store domains | Done | P2 | Backend/Prompt/Canvas | M11 Frontend QA | `AIS-RLS-076`, `AIS-RLS-084` |
| `AIS-RLS-086` | Extract prompts, canvas and admin route families | Done | P2 | Backend/Platform | M11 Frontend QA | `AIS-RLS-075`, `AIS-RLS-082`, `AIS-RLS-083` |
| `AIS-RLS-087` | Extract user, gallery and admin store domains | Done | P2 | Backend/Platform | M11 Frontend QA | `AIS-RLS-076`, `AIS-RLS-084`, `AIS-RLS-085` |
| `AIS-RLS-088` | Frontend accessibility, keyboard and contrast polish | Done | P1 | Frontend/QA | M11 Frontend QA | `AIS-RLS-072`, `AIS-RLS-078`, `AIS-RLS-080` |
| `AIS-RLS-089` | Home hero, onboarding and prompt discovery polish | Done | P2 | Experience/Frontend | M11 Frontend QA | `AIS-RLS-078`, `AIS-RLS-080`, `AIS-RLS-088` |
| `AIS-RLS-090` | Prompt library and marketplace visual polish | Done | P2 | Prompt/Frontend | M11 Frontend QA | `AIS-RLS-074`, `AIS-RLS-078`, `AIS-RLS-088` |
| `AIS-RLS-091` | Admin shell visual hierarchy and information polish | Done | P2 | Admin/Frontend | M11 Frontend QA | `AIS-RLS-073`, `AIS-RLS-078`, `AIS-RLS-088` |
| `AIS-RLS-092` | Frontend performance and bundle budget optimization | Done | P2 | Frontend/Performance | M11 Frontend QA | `AIS-RLS-077`, `AIS-RLS-081`, `AIS-RLS-088` |
| `AIS-RLS-093` | Visual regression QA harness for polished frontend | Done | P2 | Platform/QA | M11 Frontend QA | `AIS-RLS-088`, `AIS-RLS-089`, `AIS-RLS-090`, `AIS-RLS-091`, `AIS-RLS-092` |

## 4. 历史 T 编号映射

| 历史编号 | 设计任务 | Trellis 主卡 | 看板处理 |
| --- | --- | --- | --- |
| `T016` | Admin IA + Visual Shell | `AIS-RLS-033` | 不新建重复卡，作为管理员首页重构子范围 |
| `T017` | Admin User Creation | `AIS-RLS-034` | 不新建重复卡，作为用户管理与积分奖励子范围 |
| `T018` | Multi Provider Config | `AIS-RLS-036` | 放入后台运营 backlog，实施时可拆子卡 |
| `T019` | Provider Router | `AIS-RLS-036` | 运行时已有基础能力，后台完整配置随 `AIS-RLS-036` |
| `T020` | Admin Resource Pages Polish | `AIS-RLS-033` | 作为后台 shell 和资源页统一子范围 |
| `T021` | Home Composer Redesign | `AIS-RLS-040`, `AIS-RLS-042` | 拆到闪屏修复与结果按钮收口，后续 composer 全量重排可在 `AIS-RLS-042` 下拆子卡 |
| `T022` | My Works Asset Library | `AIS-RLS-034`, `AIS-RLS-036` | 我的作品批量管理随用户资产与审核撤回推进 |
| `T023` | Gallery Rename + Navigation State | `AIS-RLS-001` 到 `AIS-RLS-007` | 已基本完成，剩余问题看 `AIS-RLS-044`, `AIS-RLS-045` |
| `T024` | Gallery Publish Tag Rules | `AIS-RLS-035`, `AIS-RLS-045` | 标签规则已部分完成，卡片展示修复进 `AIS-RLS-045` |
| `T025` | Prompt Audit Gate | `AIS-RLS-014` | 已有 mock 审核，真实模型/embedding 后续在 P2 单独拆 |
| `T026` | Gallery Derivative Publish Flow | `AIS-RLS-036` | 图生图/变体发布与审核撤回同批推进 |
| `T027` | Gallery Likes + Leaderboard | `AIS-RLS-004`, `AIS-RLS-005`, `AIS-RLS-041` | 基础 Done，侧栏和点赞按钮体验进 `AIS-RLS-041` |
| `T028` | Image Editor Publish Controls + Background | `AIS-RLS-036` | 图生图发布控制和审核规则同批推进，必要时拆子卡 |
| `T029` | Contact Admin Email Setting | `AIS-RLS-033` | 已有历史完成记录；后续纳入后台设置资源页回归 |
| `T030` | Announcements + Login Modal | `AIS-RLS-037` | 已有基础记录，后续通知完善归 `AIS-RLS-037` |
| `T031` | 部署更新到服务器并完成服务器验证 | `AIS-RLS-038` | QA/部署流程归 `AIS-RLS-038` |

## 5. Trellis 卡片字段模板

每张卡建议字段：

```text
标题：
[AIS-RLS-XXX] 任务名

状态：
Backlog / Ready / In Progress / Review / Deploy / Done

优先级：
P0 / P1 / P2

泳道：
Experience / Gallery / Prompt / Canvas / Admin / Platform

里程碑：
M1 / M2 / M3 / M4 / M5 / M6

依赖：
AIS-RLS-...

验收：
见 docs/IMAGE_STUDIO_RELLIS_TASKS.md 对应任务卡

相关文档：
docs/IMAGE_STUDIO_TRELLIS_TASK_ALLOCATION.md
docs/IMAGE_STUDIO_RELLIS_TASKS.md
docs/IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md
```

## 6. 拆分原则

- P0 bug 卡不再合并到大重构卡里，避免闪屏、按钮、详情主图、标签错误被后台重构拖住。
- 后台大任务先保留 `AIS-RLS-033` 到 `AIS-RLS-037` 五张主卡；实施时如果单卡超过 2 天，再在 Trellis 内拆子卡，不回到文档新增一堆临时编号。
- 画布新增功能必须先过 `AIS-RLS-039` 的反单文件治理检查，避免继续膨胀 `public/canvas.js`、`public/app.js` 或 `server.js`。
- 移动端优化任务来自 `docs/IMAGE_STUDIO_MOBILE_WEB_OPTIMIZATION_PLAN.md`，新增样式和交互优先进入 `mobile*.css` 与 `mobile-ui.js`，不要继续把大段移动端规则堆进 `styles.css` 或 `app.js`。
- 任何卡进入 `Done` 前，必须在相关开发文档或 QA release record 写完成记录。
