# API Reference

This document provides a reference for the REST API endpoints, grouped by their corresponding route files in `src/routes/*`.

## `src/routes/admin/*`

The admin API is split by business domain under `src/routes/admin/`.

### `src/routes/admin/prompt-sources.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/prompt-sources` | List prompt sources and sync runs. |
| POST | `/api/admin/prompt-sources` | Create a new prompt source. |
| PATCH | `/api/admin/prompt-sources/:id` | Update an existing prompt source. |
| POST | `/api/admin/prompt-sources/:id/sync` | Run synchronization for a prompt source. |

### `src/routes/admin/settings.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/settings` | Get admin settings. |
| PATCH | `/api/admin/settings` | Update admin settings. |
| GET | `/api/admin/providers` | List model providers. |
| POST | `/api/admin/providers` | Create a new provider config. |
| GET | `/api/admin/providers/:id` | Get provider config details. |
| PATCH | `/api/admin/providers/:id` | Update provider config. |
| DELETE | `/api/admin/providers/:id` | Delete a provider config. |
| POST | `/api/admin/providers/:id/test` | Test a provider's connection and mapping. |
| POST | `/api/admin/providers/:id/set-default` | Set a provider as the default. |

### `src/routes/admin/diagnostics.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/rum` | Get Real User Monitoring (RUM) summary and events. |

### `src/routes/admin/announcements.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/announcements` | List announcements. |
| POST | `/api/admin/announcements` | Create an announcement. |
| POST | `/api/admin/announcements/:id/(publish\|archive\|withdraw)` | Perform an action on an announcement. |
| GET | `/api/admin/announcements/:id` | Get announcement details. |
| PATCH | `/api/admin/announcements/:id` | Update an announcement. |
| DELETE | `/api/admin/announcements/:id` | Delete a draft announcement. |

### `src/routes/admin/users.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List users. |
| POST | `/api/admin/users` | Create a user. |
| POST | `/api/admin/users/bulk` | Bulk update users' status or credits. |
| GET | `/api/admin/users/:id/credit-ledger` | View credit transactions for a user. |
| GET | `/api/admin/users/:id/reward-ledger` | View reward history for a user. |
| POST | `/api/admin/users/:id/reset-password` | Reset a user's password. |
| PATCH | `/api/admin/users/:id` | Update a user profile, role, status, or credits. |
| GET | `/api/admin/users/:id/generations` | View a user's generations. |

### `src/routes/admin/moderation.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/credit-ledger` | View credit transactions. |
| GET | `/api/admin/reward-ledger` | View reward history. |
| GET | `/api/admin/audit-logs` | View admin audit logs. |
| GET | `/api/admin/prompt-audits` | View prompt audits. |
| GET | `/api/admin/prompt-audits/:id` | Get a specific prompt audit record. |
| PATCH | `/api/admin/prompt-audits/:id` | Review a prompt audit record. |
| GET | `/api/admin/withdrawals` | View image withdrawal requests. |
| PATCH | `/api/admin/withdrawals/:id` | Approve or reject a withdrawal request. |
| GET | `/api/admin/reports` | View gallery image moderation reports. |
| PATCH | `/api/admin/public-images/:id/moderation` | Apply moderation action to a reported image. |
| GET | `/api/admin/prompt-duplicates` | List prompt duplicate candidates. |
| POST | `/api/admin/prompt-duplicates/scan` | Trigger a scan for prompt duplicates. |
| POST | `/api/admin/prompt-duplicates/:id/ai-review` | Trigger AI review for a duplicate candidate. |
| PATCH | `/api/admin/prompt-duplicates/:id` | Manually review/resolve a duplicate candidate. |

### `src/routes/admin/generations.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/generations` | List generation requests with filters. |
| GET | `/api/admin/generations/:id` | Get generation request diagnostics and trace events. |
| POST | `/api/admin/generations/:id/(retry\|cancel\|mark-failed\|copy-error)` | Apply an admin action to a generation request. |

### `src/routes/admin/public-images.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/public-images` | List public images for moderation review. |
| GET | `/api/admin/gallery-file-checks` | List gallery file health checks. |
| POST | `/api/admin/gallery-file-checks/run` | Run gallery file health checks. |
| GET | `/api/admin/gallery-like-anomalies` | List gallery like anomalies. |

## `src/routes/agent-sessions.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/agent-sessions` | List current user's agent sessions. |
| POST | `/api/agent-sessions` | Create a new agent session. |
| GET | `/api/agent-sessions/:id` | Get details of an agent session. |
| PATCH | `/api/agent-sessions/:id` | Update an agent session. |
| DELETE | `/api/agent-sessions/:id` | Delete an agent session. |
| POST | `/api/agent-sessions/:id/plan` | Request or confirm an agent plan within a session. |
| POST | `/api/agent-sessions/:id/generate` | Start a batch image generation from an agent plan. |
| POST | `/api/agent-sessions/:id/export-canvas` | Export the session data to a new Canvas v2 project. |
| POST | `/api/agent-sessions/:id/messages` | Append a new message/step to an agent session. |

## `src/routes/auth.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/auth/me` | Get current user profile and session settings. |
| POST | `/api/auth/register` | Register a new user account. |
| POST | `/api/auth/login` | Authenticate a user and create a session. |
| POST | `/api/auth/logout` | Terminate the current session. |

## `src/routes/credits.js`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/checkin` | Claim the daily check-in reward. |
| GET | `/api/credits/detail` | Get credit ledger and reward history. |

## `src/routes/settings-public.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | Get public settings and provider visibility. |
| GET | `/api/growth` | Get growth-related public settings. |

## `src/routes/announcements.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/announcements` | List published announcements. |
| GET | `/api/announcements/unread` | List unread announcements for the current user. |
| POST | `/api/announcements/:id/read` | Mark an announcement as read. |
| POST | `/api/announcements/:id/ack` | Mark an announcement as acknowledged. |
| GET | `/api/stats/today` | Get the public "today generated" metric. |

## `src/routes/canvases.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/canvases` | List workspaces (canvases). |
| POST | `/api/canvases` | Create a new workspace. |
| GET | `/api/canvases/templates` | List canvas templates. |
| GET | `/api/canvases/:id` | Get details of a workspace. |
| PATCH | `/api/canvases/:id` | Update a workspace's properties. |
| DELETE | `/api/canvases/:id` | Delete a workspace. |
| GET | `/api/canvases/:id/export` | Export a workspace. |
| POST | `/api/canvases/:id/import` | Import data into a workspace. |
| POST | `/api/canvases/:id/assistant` | Invoke the canvas assistant. |
| POST | `/api/canvases/:id/duplicate` | Duplicate an existing workspace. |
| POST | `/api/canvases/:id/generate` | Generate content within a workspace context. |

## `src/routes/gallery.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/images/public` | List recent or top public images. |
| GET | `/api/gallery/leaderboard` | Get leaderboard for generations or prompts. |
| GET | `/api/gallery/:id` | Get public details for an image. |
| POST | `/api/gallery/prompt-audit` | Audit a prompt for publishing. |
| POST | `/api/gallery/:id/like` | Like an image. |
| DELETE | `/api/gallery/:id/like` | Remove a like from an image. |

## `src/routes/images-generate.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/images/requests/active` | List active generation requests for the current user. |
| GET | `/api/images/requests/:id` | Get generation request status. |
| POST | `/api/images/requests/:id` | Retry or stop a generation request. |
| POST | `/api/images/generate` | Start a text-to-image generation request. |
| POST | `/api/images/edit` | Start an image edit request. |

## `src/routes/health.js`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/csp-report` | Receive Content Security Policy violation reports. |
| POST | `/api/rum` | Receive Real User Monitoring metrics. |
| GET | `/api/version` | Get server version and platform details. |
| GET | `/api/health` | Check overall system health and base settings. |

## `src/routes/images.js`

| Method | Endpoint | Description |
|---|---|---|
| GET/HEAD | `/api/images/:id/file` | Download or view a generated image file. |
| GET/HEAD | `/api/images/:id/source-file` | Download or view the source reference image file. |
| GET | `/api/images/history` | List the current user's generated images. |
| POST | `/api/images/bulk` | Apply bulk publish, archive, or unarchive actions to images. |

## `src/routes/prompts.js`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/prompts` | List prompt library entries. |
| POST | `/api/prompts` | Create a new prompt entry. |
| GET | `/api/prompts/:id` | Get a specific prompt's details. |
| PATCH | `/api/prompts/:id` | Update a prompt entry. |
| DELETE | `/api/prompts/:id` | Hide or delete a prompt entry. |
| POST | `/api/prompts/:id/like` | Like or unlike a prompt. |
| POST | `/api/prompts/:id/use` | Increment the usage counter for a prompt. |
| GET | `/api/tags` | List all tags and their summary. |
| POST | `/api/tags` | Create a new tag. |
| GET | `/api/tags/:slug` | Get details for a tag. |
| PATCH | `/api/tags/:slug` | Update a tag. |
| DELETE | `/api/tags/:slug` | Hide or delete a tag. |
| POST | `/api/tags/:slug/merge` | Merge a tag into another target tag. |
| GET | `/api/prompt-categories` | List prompt categories. |
| POST | `/api/prompt-categories` | Create a new prompt category. |
| PATCH | `/api/prompt-categories/:slug` | Update a prompt category. |
| DELETE | `/api/prompt-categories/:slug` | Hide or delete a prompt category. |
