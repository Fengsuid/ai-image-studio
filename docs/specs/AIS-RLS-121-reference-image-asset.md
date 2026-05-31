# AIS-RLS-121 Feature Spec: Reference Image As First-class Asset

Status: implemented first slice on 2026-05-31
Task: `AIS-RLS-121`  
Owner lane: Feature / Phase D  
Related docs: `docs/IMAGE_STUDIO_PRODUCTFLOW_GAP_ANALYSIS.md` §4.10, §4.12, §4.13, §7.8; `docs/IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` §5 P3-1

## 背景

The product currently exposes reference-image affordances, but previous work deliberately clarified that uploaded reference images are inspiration records unless routed through an image-edit path. Phase D needs to turn reference images into durable assets: upload, store, associate, display, reuse, and audit them independently from prompt text or transient preview metadata.

AIS-RLS-121 defines that contract. It should be implemented before AIS-RLS-122 because my-works asset management needs a stable reference asset model.

Implementation note 2026-05-31: the first production slice is shipped in `18cccd8` with `APP_VERSION=20260531-reference-assets-v1`. It uses additive `reference_assets` and `generation_reference_assets` tables, `/api/reference-assets`, owner/admin/public-visible file authorization, generation link records, reference thumbnail strips in history/gallery/my-works, and `smoke:reference-assets`. Provider-specific conditioning remains capability-dependent and continues through the existing image-edit/reference payload path.

## 现状

- Reference images can appear in composer/editor UI, but the gap analysis records that homepage reference upload was historically only a preview/metadata expectation.
- `generations` already stores output image fields and source image fields for image-to-image, but reference images are not modeled as reusable records.
- Gallery and my-works detail can show generated output and source image, but cannot list multiple reference assets with type, order, hash, and reuse metadata.
- `MAX_BODY_BYTES` and large input images create pressure for future object storage or chunked upload.
- `src/stores/gallery-store.js` has gallery-oriented read/write responsibilities but no dedicated reference image CRUD contract.

## 影响

- Users cannot trust that an uploaded reference image will remain attached after refresh or across devices.
- Gallery detail cannot explain why a generation looks like a reference, which weakens public provenance.
- My-works cannot filter “has reference image” accurately.
- Future multi-candidate and Canvas flows cannot reuse reference images without copying data URLs through frontend state.

## 用户故事

- As a creator, I can upload 1-4 reference images and see them saved as durable assets before or during generation.
- As a creator, I can reuse a previous reference asset from my-works without re-uploading the same image.
- As a viewer, I can open a public work and see which reference assets were shared, when the publisher chose to expose them.
- As an admin, I can audit reference assets tied to a reported generation.
- As a developer, I can query and mutate reference assets through store methods rather than reading JSON metadata blobs.

## 方案

### Asset model

Reference assets are records separate from generations. A generation may have zero or more assets, each with a role:

- `reference`: user-uploaded visual guidance.
- `source`: image-to-image input.
- `mask`: editor mask or inpaint mask.
- `output`: optional future unification, not required in first slice.

Initial implementation should focus on `reference`, while keeping roles extensible.

### UI behavior

```text
Composer reference tray
+--------------------------------------------------------------+
| [ + Add reference ]  [thumb A] [thumb B] [thumb C]            |
| Saved as assets when submitted · visible only to you by default |
+--------------------------------------------------------------+

Generation detail
+ Output image ------------------------------------------------+
| Reference assets                                             |
| [thumb A · private] [thumb B · shared if published]          |
| Actions: reuse as reference · add to Canvas                  |
+--------------------------------------------------------------+
```

Visibility defaults:

- Private user history: show all reference assets to the owner.
- Public gallery: show only assets explicitly marked `public` or safe-to-display by publish settings.
- Admin moderation: show all assets needed for review.

## API 草案

### Create asset

`POST /api/reference-assets`

```json
{
  "filename": "moodboard.png",
  "mimeType": "image/png",
  "imageData": "data:image/png;base64,...",
  "role": "reference"
}
```

Response:

```json
{
  "asset": {
    "id": "asset_abc",
    "role": "reference",
    "url": "/api/reference-assets/asset_abc/file",
    "thumbUrl": "/api/reference-assets/asset_abc/file?variant=thumb",
    "mimeType": "image/png",
    "width": 1024,
    "height": 1024,
    "sha256": "..."
  }
}
```

### Use during generation

`POST /api/images/generate`

```json
{
  "prompt": "match the product shape",
  "referenceAssetIds": ["asset_abc", "asset_def"]
}
```

Generation response includes reference summaries:

```json
{
  "generation": {
    "id": "gen_abc",
    "referenceAssets": [
      { "id": "asset_abc", "role": "reference", "thumbUrl": "/api/reference-assets/asset_abc/file?variant=thumb" }
    ]
  }
}
```

### CRUD contract in store

`src/stores/gallery-store.js` should expose or delegate these operations:

- `createReferenceAsset(user, input)`
- `listReferenceAssetsForUser(user, filters)`
- `getReferenceAssetById(id)`
- `linkReferenceAssetToGeneration(generationId, assetId, options)`
- `listReferenceAssetsForGeneration(generationId, viewer)`
- `updateReferenceAssetVisibility(assetId, visibility)`
- `deleteReferenceAsset(assetId, user)`

## DB 迁移草案

```sql
CREATE TABLE reference_assets (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'reference',
  filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  file_size INT UNSIGNED NOT NULL DEFAULT 0,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  sha256 CHAR(64) NOT NULL,
  visibility VARCHAR(24) NOT NULL DEFAULT 'private',
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_reference_assets_user_created (user_id, created_at),
  INDEX idx_reference_assets_sha256 (sha256)
);

CREATE TABLE generation_reference_assets (
  generation_id VARCHAR(32) NOT NULL,
  asset_id VARCHAR(32) NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'reference',
  sort_order INT NOT NULL DEFAULT 0,
  public_visible TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (generation_id, asset_id),
  INDEX idx_generation_reference_assets_asset (asset_id)
);
```

Storage path should be separate from generated output paths, for example `data/reference-assets/<id>.<ext>`, with thumb generation deferred if not already available.

## 验收

- Uploading a reference image creates a `reference_assets` row and stores a file outside transient frontend state.
- Submitting generation with reference assets links rows in `generation_reference_assets`.
- My-works/history detail shows owner-visible reference thumbnails after page refresh.
- Gallery detail shows only public-visible reference assets.
- `src/stores/gallery-store.js` or its delegated domain store supports reference asset CRUD.
- `npm run smoke:public` and `npm run smoke:gallery-images` pass.
- Add a focused smoke that uploads a reference asset, links it to a generation-like fixture, refreshes the detail data, and verifies visibility filtering.

Implemented first-slice checks:

- `npm run smoke:reference-assets` statically verifies schema/index tokens, route/store exports, generation request wiring, frontend display/persist hooks, and hashed dist coverage.
- Deployment verification on 2026-05-31 confirmed `reference_assets`, `generation_reference_assets`, `idx_reference_assets_user_created`, `idx_reference_assets_sha256`, and `idx_generation_reference_assets_asset` exist after startup migration.

## 回滚

- Keep reference asset tables nullable and additive; do not remove existing generation/source image fields.
- Disable UI reference asset picker and fall back to existing preview-only/reference metadata behavior.
- Continue serving historical linked assets read-only if rows exist.
- Revert new CRUD routes while leaving stored files untouched for manual cleanup.

## 风险

- Large files can exceed current request body limits; implementation may need client compression before full object storage exists.
- Public visibility must be conservative to avoid exposing private reference photos.
- Deleting assets must not break generation history; prefer soft delete or `status=archived`.
- Provider support for reference images differs from image edit support; UI copy must distinguish “saved reference asset” from “provider used this reference.”
