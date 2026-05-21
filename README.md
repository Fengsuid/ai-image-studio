# ai-image-studio

`ai-image-studio` is a self-hosted AI image creation workspace. It combines text-to-image generation, image-to-image editing, prompt gallery discovery, public image sharing, user credits, moderation workflows, and an admin console in one lightweight Node.js application.

中文：`ai-image-studio` 是一个可自托管的 AI 生图工作台，覆盖文生图、图生图、提示词画廊、公开作品广场、积分、审核与后台运营管理。

## Demo

- Demo site: https://ai-image-studio.twisterfeng.com
- 演示地址：https://ai-image-studio.twisterfeng.com

## Authors

- Fengsuid
- Codex

## 作者

- Fengsuid
- Codex

## Version

Current release: `1.00`

The npm package metadata uses `1.0.0` for semantic-version compatibility, while the GitHub release tag for this snapshot is `v1.00`.

当前发布版本：`1.00`。npm 元数据使用 `1.0.0`，GitHub 标签使用 `v1.00`。

## Features

- Text-to-image generation with saved conversation history.
- Image-to-image editing with optional source image publishing metadata.
- Public gallery with prompt tags, author attribution, likes, and user-owned work management.
- Prompt library and imported prompt templates.
- User authentication, credits, check-in rewards, first-publication rewards, and withdrawal window rules.
- Admin console for users, providers, settings, announcements, audit logs, public images, reports, prompt audits, and duplicate prompt scans.
- Canvas v2 workspace for saved visual projects, nodes, edges, generation output routing, and JSON export.
- MySQL-backed persistence with local static assets served by the Node.js server.

## 功能

- 文生图对话与历史记录保存。
- 图生图编辑，并支持记录/展示输入原图相关信息。
- 公开画廊：提示词标签、作者署名、点赞、用户作品管理。
- 提示词库与外部提示词模板导入。
- 用户登录、积分、签到奖励、首次公开奖励与公开撤回窗口。
- 后台管理：用户、供应商、系统设置、通知、审计日志、公开图片、举报、提示词审核与重复提示词扫描。
- Canvas v2 工作台：保存可视化项目、节点、连线、生成输出路由与 JSON 导出。
- 基于 MySQL 的持久化存储，Node.js 服务直接提供静态前端与 API。

## Project Structure

```text
public/             Frontend pages, styles, and browser scripts
apps/canvas-v2/     Isolated Canvas v2 source app; builds into public/canvas-v2
src/                MySQL persistence layer
scripts/            Import, migration, and smoke-test scripts
docs/               Product, admin, execution, and deployment design notes
server.js           HTTP server and API routes
package.json        Node.js package metadata and scripts
```

## Requirements

- Node.js 20 or newer.
- MySQL 8 compatible database.
- An OpenAI-compatible image generation provider configured through environment variables or the admin provider panel.

## 环境要求

- Node.js 20 或更新版本。
- MySQL 8 兼容数据库。
- 一个 OpenAI 兼容的图片生成供应商，可通过环境变量或后台供应商面板配置。

## Quick Start

```bash
npm install
cp .env.example .env
npm start
```

If `.env.example` is not present in your deployment, create `.env` with the values used by your server environment.

Common environment variables:

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
```

Then open:

- Frontend: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`
- Canvas v2: `http://localhost:3000/canvas-v2`

## 快速启动

```bash
npm install
cp .env.example .env
npm start
```

启动后访问：

- 前台：`http://localhost:3000/`
- 后台：`http://localhost:3000/admin`

## Smoke Checks

```bash
npm run smoke:public -- http://localhost:3000
npm run smoke:auth-admin
npm run smoke:data
```

Some smoke checks require a running server and matching admin/database environment variables.

## Canvas v2

Canvas v2 is built from `apps/canvas-v2/src` into `public/canvas-v2`:

```bash
npm run canvas:v2:check
npm run canvas:v2:build
npm run smoke:canvas-v2:static
npm run smoke:canvas-v2:entry
```

The Canvas v2 source boundary records `basketikun/infinite-canvas` as an AGPL-3.0 upstream reference. Browser code must use the existing ai-image-studio APIs for login, CSRF, persistence, credits, provider routing, generation, and storage; it must not keep provider API keys or call OpenAI-compatible endpoints directly.

Set `CANVAS_ENTRY_MODE=legacy` to route primary Canvas entries back to the existing `#/canvas` workspace, or `CANVAS_ENTRY_MODE=hidden` to suppress public Canvas entry points during rollback.

## Deployment Notes

Self-hosted installations should keep generated images, uploaded source images, logs, database files, and `.env` outside the Git repository. This repository intentionally ignores local runtime data, historical archives, and server-specific validation notes.

## Documentation

The main planning document is:

- `docs/IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md`

Server-specific deployment records are intentionally kept out of version control.
