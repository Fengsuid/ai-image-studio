# AIS-RLS-120 Feature Spec: Multi-candidate / Branch Generation

Status: implemented lightweight release on 2026-05-31
Task: `AIS-RLS-120`  
Owner lane: Feature / Phase D  
Related docs: `docs/IMAGE_STUDIO_PRODUCTFLOW_GAP_ANALYSIS.md` §4.7, §4.11, §4.13; `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` §5 P3-1

## 背景

ProductFlow-style image work is not a single-shot flow. A user often wants several outputs from the same prompt, compares them, then chooses one image as the branch root for publish, edit, canvas insertion, or the next image-to-image step. The current Image Studio flow has queue recovery and generation request persistence, but the primary home generation experience still behaves as one request producing one chosen result.

AIS-RLS-120 originally defined the product and technical contract for `n > 1` candidate generation. The 2026-05-31 release implements the task-card scope with the existing `generation_requests` status model, multiple saved `generations`, and front-end `candidateIds` selection while keeping single-image generation as the default path.

## 现状

- The public composer exposes a candidate count selector (`1..4`) and sends the selected count as provider `n`.
- One `generation_request` tracks the queued/running request; successful provider results are saved as multiple `generations` and grouped in the front-end history entry through `images` and `candidateIds`.
- Candidate selection is represented by making the chosen candidate the current main image and current generation id for publish, image-to-image continuation, Canvas insertion, and detail actions.
- Credits are charged as `generationCreditCost * n`; missing provider results refund `costPerImage * missing`.
- `smoke:multi-candidate-generation` guards candidate UI, `n` routing, queue payload preservation, candidate selection, and credit accounting.

## 影响

- Users retry the same prompt manually, which fragments history and loses a clean comparison context.
- Future reference asset and my-works library work cannot reliably group sibling outputs.
- Partial success handling is ambiguous: a provider may return two candidates and fail the third, but the current UI only knows success or failure.
- Credits and refund policy are hard to explain if candidate count is hidden inside provider behavior.

## 用户故事

- As a creator, I can choose `1`, `2`, or `4` candidates before submitting so I can compare alternatives from one prompt.
- As a creator, I can see candidates arrive progressively and pick the preferred one as the active result.
- As a creator, I can branch from any completed candidate into image-to-image or Canvas, without losing the sibling candidates.
- As a publisher, I can publish only the selected candidate while the detail view still explains that it came from a candidate group.
- As support/admin, I can inspect request/candidate status and understand the credits charged for each candidate.

## UI 方案

### Composer controls

Candidate count belongs in the compact options row, near size/quality/provider controls. It should default to `1` and avoid making the first screen feel like a batch tool.

```text
+ Prompt composer --------------------------------------------------+
| [Reference +]  prompt text area................................. |
| Options:  Size [Auto]  Quality [Auto]  Candidates [1 v]          |
| Status:  1 credit per candidate · queue estimate shown on submit |
|                                                [Generate]        |
+------------------------------------------------------------------+
```

### Running state

The submitted card becomes a candidate group card. Each slot has stable dimensions so partial completion does not shift layout.

```text
+ Candidate group: "city product poster..." -----------------------+
| Running · 2 / 4 complete · 4 credits reserved                    |
| +---------+ +---------+ +---------+ +---------+                  |
| | image 1 | | image 2 | | loading | | failed  |                  |
| |Selected | | Choose  | | spinner | | Retry   |                  |
| +---------+ +---------+ +---------+ +---------+                  |
| [Use selected] [Publish] [Add to Canvas] [Generate branch]       |
+------------------------------------------------------------------+
```

### Detail state

Candidate strip appears in gallery detail, my-works detail, and Canvas insertion flows only when the selected generation belongs to a candidate group.

```text
Detail
| main selected image |
| Candidate strip: [1 selected] [2] [3 failed] [4] |
| Prompt / model / size / credits / created at     |
```

## API 草案

### Submit

`POST /api/images/generate`

```json
{
  "prompt": "product photo on a white desk",
  "candidateCount": 4,
  "size": "1024x1024",
  "quality": "auto",
  "isPublic": false
}
```

Response should preserve existing single-result compatibility. For `candidateCount > 1`, return a request id immediately if the queue path is active:

```json
{
  "requestId": "req_abc",
  "candidateGroupId": "cg_abc",
  "status": "queued",
  "candidateCount": 4,
  "creditsReserved": 4
}
```

### Poll

`GET /api/images/requests/:requestId`

```json
{
  "id": "req_abc",
  "status": "running",
  "candidateGroup": {
    "id": "cg_abc",
    "selectedGenerationId": "gen_1",
    "candidates": [
      { "index": 0, "status": "succeeded", "generationId": "gen_1", "imageUrl": "/api/images/gen_1/file" },
      { "index": 1, "status": "succeeded", "generationId": "gen_2", "imageUrl": "/api/images/gen_2/file" },
      { "index": 2, "status": "running" },
      { "index": 3, "status": "failed", "error": "provider_error" }
    ]
  }
}
```

### Select

`POST /api/candidate-groups/:id/select`

```json
{ "generationId": "gen_2" }
```

Returns the updated group and selected generation summary. Selecting a candidate must not republish automatically.

## DB 迁移草案

Minimum schema:

```sql
CREATE TABLE generation_candidate_groups (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  request_id VARCHAR(32) NOT NULL,
  prompt TEXT NOT NULL,
  candidate_count INT UNSIGNED NOT NULL,
  selected_generation_id VARCHAR(32) NULL,
  credits_reserved INT UNSIGNED NOT NULL DEFAULT 0,
  credits_final INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_candidate_groups_user_created (user_id, created_at)
);

ALTER TABLE generations
  ADD COLUMN candidate_group_id VARCHAR(32) NULL,
  ADD COLUMN candidate_index INT UNSIGNED NULL,
  ADD COLUMN branch_parent_generation_id VARCHAR(32) NULL,
  ADD INDEX idx_generations_candidate_group (candidate_group_id, candidate_index);
```

Compatibility rule: existing generations have `candidate_group_id = NULL` and behave exactly like single-result generations.

## Credits / queue policy

- Reserve credits equal to candidate count before dispatch.
- Final charge equals succeeded candidates unless product policy chooses charge-per-attempt. The UI must state the policy before submit.
- Failed candidate slots must show whether credit was refunded.
- Cancel should stop pending candidates and finalize credits for completed candidates.

## 验收

- Candidate count `1` preserves the current generation UX and API compatibility.
- Candidate count `2` or `4` creates one request and multiple generation records returned as one front-end candidate set.
- User can select a candidate; selected image is used for publish, edit, Canvas insertion, and my-works detail through the current main image/generation id.
- Credits are reserved, finalized, and displayed consistently for full success, partial success, failure, and cancel; missing candidates are refunded.
- `npm run smoke:public` passes in the release environment.
- `npm run smoke:multi-candidate-generation` covers candidate grouping, selected candidate behavior, queue payload preservation, and partial success accounting.

## 回滚

- Hide the candidate count control and force `candidateCount=1`.
- Keep nullable DB columns/tables in place for compatibility; stop writing candidate groups.
- Treat generations with candidate metadata as ordinary history entries if the feature flag is disabled.
- Revert UI candidate strip and selection endpoint routing if selection behavior regresses.

## 风险

- Provider APIs differ on multi-image support; implementation may need fan-out requests rather than one provider call.
- Partial success and refunds are high-risk and need tests before release.
- Candidate groups add complexity to publish and my-works flows; AIS-RLS-122 should consume the selected-candidate contract rather than invent a separate one.
