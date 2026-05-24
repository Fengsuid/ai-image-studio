# ai-image-studio

可自托管的 AI 生图工作台。覆盖文生图、图生图、提示词画廊、公开作品广场、无限画布、积分体系、审核与后台运营管理。

## 项目架构

```text
┌─────────────────────────────────────────────────────┐
│  浏览器                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ 前台页面  │  │ 后台管理  │  │ Canvas v2 子应用   │ │
│  │ public/   │  │ public/  │  │ public/canvas-v2/ │ │
│  └─────┬─────┘  └─────┬────┘  └────────┬──────────┘ │
└────────┼───────────────┼────────────────┼────────────┘
         │               │                │
         ▼               ▼                ▼
┌─────────────────────────────────────────────────────┐
│  Node.js HTTP 服务器 (server.js)                     │
│  ├─ src/routes/        路由分发                      │
│  ├─ src/middleware/    session + CSRF                │
│  ├─ src/stores/        数据访问层                    │
│  ├─ src/canvas-service.js   画布业务逻辑            │
│  └─ src/generation-queue-runner.js  生成队列        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  MySQL 8 + 文件存储 (data/)                          │
└─────────────────────────────────────────────────────┘
```

## 当前状态

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 文生图/图生图 | 可用 | 对话式生成，历史记录保存 |
| 公开画廊 | 可用 | 标签、点赞、作者署名、排行榜 |
| 提示词库 | 可用 | 多来源导入、标签筛选、封面图 |
| 用户体系 | 可用 | 登录、积分、签到、首发奖励 |
| 后台管理 | 可用 | 用户、供应商、设置、审核、日志 |
| 旧画布 (v1) | 不可靠 | `public/canvas-*.js`，已废弃，不再演进 |
| 新画布 (v2) | 开发中 | `apps/canvas-v2/`，Phase 0-4 基础已实现，Phase 5 入口切换未开始 |

## 功能

- 文生图对话与历史记录保存
- 图生图编辑，支持参考图元数据
- 公开画廊：提示词标签、作者署名、点赞、排行榜
- 提示词库与外部提示词模板导入
- 用户登录、积分、签到奖励、首次公开奖励
- 后台管理：用户、供应商、系统设置、通知、审计日志、举报、提示词审核
- Canvas v2 工作台：节点编辑、连线、生成输出路由、JSON 导出
- 基于 MySQL 的持久化存储

## 目录结构

```text
remote-edit/
├── server.js              HTTP 服务器和 API 路由（单体入口）
├── package.json           依赖和脚本
├── .env.example           环境变量模板
├── Dockerfile             生产镜像构建
├── public/                前台页面、样式、浏览器脚本
│   ├── index.html         主页面（含旧画布模板）
│   ├── app.js             前台主逻辑
│   ├── admin.js           后台主逻辑
│   ├── canvas-*.js        旧画布模块（14 个文件，已废弃）
│   └── canvas-v2/         新画布构建产物
├── apps/
│   └── canvas-v2/         新画布源码（零依赖纯 JS）
│       ├── src/           源码目录
│       └── scripts/       构建脚本
├── src/                   后端业务逻辑
│   ├── routes/            路由分发
│   ├── stores/            数据访问层
│   ├── middleware/        session、CSRF
│   ├── canvas-service.js  画布业务逻辑
│   └── mysql-store.js     数据库初始化
├── scripts/               导入、迁移、smoke 测试脚本
└── docs/                  设计文档
```

## 环境要求

- Node.js 20+
- MySQL 8 兼容数据库
- OpenAI 兼容的图片生成供应商（通过环境变量或后台供应商面板配置）

## 快速启动

```bash
npm install
cp .env.example .env
# 编辑 .env 填入 MySQL 连接和管理员信息
npm start
```

访问：

- 前台：`http://localhost:3000/`
- 后台：`http://localhost:3000/admin`
- 新画布：`http://localhost:3000/canvas-v2`

## 环境变量

```bash
PORT=3000
DATA_DIR=./data
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=ai_image_studio
MYSQL_PASSWORD=change-me
MYSQL_DATABASE=ai_image_studio
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
ADMIN_NAME=Admin
APP_VERSION=1.00
AI_API_BASE_URL=
AI_API_KEY=
```

## Canvas v2

Canvas v2 是画布功能的重构版本，从 `apps/canvas-v2/src` 构建到 `public/canvas-v2`。

构建和检查：

```bash
npm run canvas:v2:check        # 语法检查
npm run canvas:v2:build        # 构建产物
npm run smoke:canvas-v2:static # 静态资源 smoke
npm run smoke:canvas-v2:entry  # 入口可访问 smoke
```

入口模式控制：

- `CANVAS_ENTRY_MODE=v2` — 默认，画布入口指向 v2
- `CANVAS_ENTRY_MODE=legacy` — 回退到旧画布
- `CANVAS_ENTRY_MODE=hidden` — 隐藏画布入口

上游参考：`basketikun/infinite-canvas`（AGPL-3.0），详见 `apps/canvas-v2/UPSTREAM.md`。

## Smoke 测试

```bash
npm run smoke:public -- http://localhost:3000   # 公开页面
npm run smoke:auth-admin                        # 管理员认证
npm run smoke:data                              # 数据完整性
npm run smoke:canvas-v2:static                  # Canvas v2 静态资源
npm run smoke:canvas-v2:entry                   # Canvas v2 入口
```

部分 smoke 需要运行中的服务器和正确的环境变量。

## 文档索引

| 文档 | 说明 |
| --- | --- |
| `docs/IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md` | 产品总体规划 |
| `docs/IMAGE_STUDIO_CANVAS_V2_MIGRATION_PLAN.md` | Canvas v2 迁移开发文档 |
| `docs/CANVAS_V2_TESTING_GUIDE.md` | Canvas v2 功能测试指南 |
| `docs/IMAGE_STUDIO_FRONTEND_ADMIN_DESIGN.md` | 前端和后台设计 |
| `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md` | QA 和发布检查清单 |
| `docs/FRONTEND_BUILD_TOOLING.md` | 前端构建工具说明 |
| `docs/FRONTEND_MODULE_BOUNDARIES.md` | 前端模块边界 |
| `docs/CODE_MAINTENANCE_OPTIMIZATION.md` | 代码维护优化 |

## 开发流程

1. 本地启动服务确认能跑通。
2. 查看 `docs/IMAGE_STUDIO_CANVAS_V2_MIGRATION_PLAN.md` 了解画布迁移进度。
3. 画布开发在 `apps/canvas-v2/src/` 下进行，修改后执行 `npm run canvas:v2:build`。
4. 功能完成后运行对应 smoke 脚本验证。
5. 提交前确认不包含私有信息（域名、IP、API Key）。

## 部署说明

- 生成图片、上传原图、日志、数据库文件和 `.env` 不进入 Git。
- Docker 部署参考 `Dockerfile`。
- 服务器特定的部署记录保存在本地私有文档中，不上传。

## 作者

- Fengsuid
- Codex
