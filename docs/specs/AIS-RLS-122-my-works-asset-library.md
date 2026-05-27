# AIS-RLS-122 Feature Spec: My-works Asset Library Upgrade

Status: ready for implementation planning after AIS-RLS-121  
Task: `AIS-RLS-122`  
Owner lane: Feature / Phase D  
Related docs: `docs/IMAGE_STUDIO_PRODUCTFLOW_GAP_ANALYSIS.md` §4.15; `docs/IMAGE_STUDIO_ADMIN_HOME_REDESIGN_PLAN.md` §10; `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` §5 P3-1

## 背景

My-works is the personal asset management surface. It currently provides a useful history/modal workflow with publish and tag actions, but Phase D needs it to become a library: searchable, filterable, batch-manageable, and aware of references, candidates, public state, and archive/delete semantics.

AIS-RLS-122 depends on AIS-RLS-121 because “has reference image” and reference thumbnails must read from a stable asset model. It should also consume the selected-candidate contract from AIS-RLS-120 when available.

## 现状

- My-works remains closer to a modal/list than a full asset library.
- Current filtering covers some basics from prior work, but the product spec still calls out missing type/date/tag filters and batch operations.
- Work cards show output/source context, but do not provide a full detail drawer with prompt, parameters, credits, reference assets, candidate group, public state, moderation/reward state, and route actions in one place.
- Delete, archive, unpublish, and hide semantics are not sufficiently separated for users.
- Batch export/download is required by the task card but should not block ordinary single-item actions.

## 影响

- Creators with many generations cannot quickly find assets by type, date, tag, reference presence, or public status.
- Users repeat manual actions one card at a time, increasing error risk for publish/unpublish/archive flows.
- Support and future moderation work lack a consistent personal asset state model.
- AIS-RLS-120 candidate groups and AIS-RLS-121 reference assets would have no durable user-facing management surface if my-works remains a simple modal.

## 用户故事

- As a creator, I can open My Works as a full library view or large workspace, not a cramped modal.
- As a creator, I can filter by all/private/public/archived, text-to-image/image-to-image, date range, tags, reference assets, and candidate groups.
- As a creator, I can select multiple works and export, archive, unarchive, unpublish, or delete/hide with clear confirmation.
- As a creator, I can open a detail drawer and see output image, source image, reference assets, candidate strip, prompt, model, size, cost, visibility, and publish status.
- As a mobile user, I can use the same actions through a bottom batch bar and full-screen detail drawer.

## 交互设计

### Library layout

```text
+ My Works ------------------------------------------------------+
| Search [prompt, title, tag...]  Date [last 30d v]  Sort [new] |
| Tabs: All | Private | Public | Archived | Text | Image | Ref |
| Filters: Tags [chips...]  Has candidates [ ]  Failed [ ]      |
| Bulk: [ ] Select all   0 selected                             |
+---------------------------------------------------------------+
| [card] [card] [card] [card]                                   |
| [card] [card] [card] [card]                                   |
+---------------------------------------------------------------+
```

### Batch action bar

Desktop batch bar appears below filters; mobile batch bar is fixed to the bottom.

```text
3 selected  |  [Export] [Archive] [Unpublish] [Add tags] [Delete...]
```

Rules:

- `Export` is safe and should be available first.
- `Archive` hides from default my-works but keeps history and public state rules explicit.
- `Unpublish` applies only to public items and requires a warning about gallery visibility/reward policy.
- `Delete` or `Hide` must explain whether files remain for audit and whether public entries are affected.

### Detail drawer

```text
+ Detail drawer -----------------------------------------------+
| Output image                                                  |
| Candidate strip: [1 selected] [2] [3]                         |
| Source / References: [source] [ref A] [ref B]                 |
| Prompt, revised prompt, model, size, quality, cost, duration  |
| Visibility: private/public/archived · reward/withdraw state   |
| Actions: Publish/Edit tags/Add to Canvas/Branch/Download      |
+---------------------------------------------------------------+
```

## API 草案

### List works

`GET /api/images/history`

Add query filters while preserving old defaults:

```text
?status=all|private|public|archived
&type=text-to-image|image-to-image
&tag=portrait
&dateFrom=2026-05-01
&dateTo=2026-05-27
&hasReference=1
&hasCandidates=1
&q=product
&limit=60
&cursor=...
```

Response adds library metadata:

```json
{
  "generations": [
    {
      "id": "gen_abc",
      "libraryStatus": "active",
      "isPublic": false,
      "generationType": "text-to-image",
      "referenceAssets": [],
      "candidateGroupId": "",
      "selectedCandidate": true,
      "tags": ["poster"],
      "createdAt": "2026-05-27T00:00:00.000Z"
    }
  ],
  "nextCursor": "..."
}
```

### Batch operations

`POST /api/images/bulk`

```json
{
  "generationIds": ["gen_1", "gen_2"],
  "action": "archive",
  "options": {}
}
```

Supported actions in first release:

- `archive`
- `unarchive`
- `unpublish`
- `export`

`delete` should be implemented only if the current data retention policy is explicit. Otherwise use `archive` and label the UI accordingly.

### Export

`POST /api/images/export`

```json
{
  "generationIds": ["gen_1", "gen_2"],
  "format": "zip",
  "includeMetadata": true
}
```

If server-side zip is deferred, the endpoint may return a download manifest. The UI must then run a visible download queue rather than showing a placeholder.

## DB 迁移草案

Minimal additive fields:

```sql
ALTER TABLE generations
  ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN archived_at DATETIME(3) NULL,
  ADD COLUMN deleted_at DATETIME(3) NULL,
  ADD COLUMN library_title VARCHAR(160) NOT NULL DEFAULT '',
  ADD INDEX idx_generations_user_archived_created (user_id, archived, created_at);
```

If existing `archived` already exists, implementation should reuse it and only add missing fields/indexes. AIS-RLS-122 should not duplicate reference asset tables from AIS-RLS-121; it should join `generation_reference_assets` and candidate metadata when present.

Optional batch audit:

```sql
CREATE TABLE generation_bulk_actions (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  action VARCHAR(32) NOT NULL,
  generation_ids_json LONGTEXT NOT NULL,
  result_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_generation_bulk_actions_user_created (user_id, created_at)
);
```

## 验收

- My-works opens as a full library surface or large workspace with stable desktop and mobile layouts.
- Filters work for type, date, tag, public/private/archived state, reference presence, and candidate presence.
- Batch selection supports at least archive/unarchive, unpublish, and export/download.
- Detail drawer shows prompt, output, source image, reference assets, candidate strip when available, public state, and primary actions.
- Existing single-item publish/edit/download flows still work.
- `npm run smoke:public` passes.
- Add a focused my-works smoke covering filters, selecting two items, running a safe batch action, and opening detail.

## 回滚

- Hide the library route/fullscreen entry and restore the previous my-works modal.
- Keep API filters additive; old `/api/images/history` default response remains compatible.
- If batch operations regress, disable batch action bar while retaining single-card actions.
- Leave archive fields in DB as additive no-op state.

## 风险

- Full asset-library UX can grow into a separate project; first release must cap scope to filters, detail drawer, and core batch actions.
- Batch unpublish touches reward/withdrawal policy; confirmation copy and server validation must match existing public rules.
- Export can stress file IO; start with limits and a manifest fallback if zip is not ready.
- Mobile layout needs fixed dimensions for cards and bottom bars to avoid overlap with navigation.
