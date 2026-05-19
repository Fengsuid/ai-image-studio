# ai-image-studio

`ai-image-studio` is a self-hosted AI image creation workspace. It combines text-to-image generation, image-to-image editing, prompt gallery discovery, public image sharing, user credits, moderation workflows, and an admin console in one lightweight Node.js application.

## Version

Current release: `1.00`

The npm package metadata uses `1.0.0` for semantic-version compatibility, while the GitHub release tag for this snapshot is `v1.00`.

## Features

- Text-to-image generation with saved conversation history.
- Image-to-image editing with optional source image publishing metadata.
- Public gallery with prompt tags, author attribution, likes, and user-owned work management.
- Prompt library and imported prompt templates.
- User authentication, credits, check-in rewards, first-publication rewards, and withdrawal window rules.
- Admin console for users, providers, settings, announcements, audit logs, public images, reports, prompt audits, and duplicate prompt scans.
- MySQL-backed persistence with local static assets served by the Node.js server.

## Project Structure

```text
public/             Frontend pages, styles, and browser scripts
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

## Smoke Checks

```bash
npm run smoke:public -- http://localhost:3000
npm run smoke:auth-admin
npm run smoke:data
```

Some smoke checks require a running server and matching admin/database environment variables.

## Deployment Notes

Self-hosted installations should keep generated images, uploaded source images, logs, database files, and `.env` outside the Git repository. This repository intentionally ignores local runtime data, historical archives, and server-specific validation notes.

## Documentation

The main planning document is:

- `docs/IMAGE_STUDIO_UNIFIED_MASTER_PLAN.md`

Server-specific deployment records are intentionally kept out of version control.
