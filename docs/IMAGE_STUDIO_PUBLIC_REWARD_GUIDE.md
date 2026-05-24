# Public Work Reward Guide

Updated: 2026-05-24

This document is the implementation and operations guide for rewards tied to publishing generated images to the public square.

## Product Rule

- The active reward type is `first_public`: the first user work published to the square can receive a one-time credit reward.
- Publishing locks the reward first. Credits are awarded only after the work remains public for the configured hold time.
- By default, users cannot cancel public visibility after publishing. Admins can still hide, moderate, or remove public works from the admin console.
- Users must confirm before publishing. The confirmation explains the reward amount, hold time, and no-user-unpublish rule.

## Admin Settings

Admin path: `https://ai-image-studio.twisterfeng.com/admin`

Backend endpoint: `PATCH /api/admin/settings`

Configurable fields:

| Field | Meaning | Example |
| --- | --- | --- |
| `firstPublicRewardCredit` | Credits locked for the user's first public work. | `2` |
| `publicRewardHoldMinutes` | Required public duration before credits are awarded. | `30` for half an hour, `720` for 12 hours |
| `publicUnpublishAllowed` | Whether normal users can unpublish after publishing. Default is off. | `false` |
| `publicRewardNotificationsEnabled` | Whether reward lock/award notifications are sent. Default is on. | `true` |

Operational examples:

- Change "award after 12 hours" to "award after 30 minutes": set `publicRewardHoldMinutes = 30`.
- Disable the reward without removing the publishing flow: set `firstPublicRewardCredit = 0`.
- Temporarily allow users to cancel public works: enable `publicUnpublishAllowed`.

## Notification Flow

All public-reward user-facing events should be visible through the existing notification/announcement system.

- `first_public_reward_locked`: sent when the first public reward enters `pending`.
- `first_public_reward_awarded`: sent when the hold time has elapsed and credits are added.
- `generation_moderation`: sent when admin hides/restores/rejects reports on public works.
- `generation_report_submitted`: sent when a public work is reported.

Notifications use `announcements` with `audience = specific-users`, so they appear in the same unread notification flow as other product notices.

## Data Flow

1. User publishes a generated image through `PATCH /api/images/:id/public` or the bulk publish endpoint.
2. Server validates ownership, prompt audit, tags, and public source requirements.
3. `claimFirstPublicRewardForGeneration` checks whether the user already has any `first_public` reward.
4. If eligible, the generation is marked `public_reward_status = pending`, `public_reward_amount = firstPublicRewardCredit`, and a `reward_ledger` row is inserted.
5. Every API request runs a lightweight maturity sweep using `publicRewardHoldMinutes`.
6. Mature pending rewards increment `users.credits`, write `credit_ledger`, and mark both `generations.public_reward_status` and `reward_ledger.status` as `awarded`.

## Code Ownership

- Settings schema and migrations: `src/mysql-store.js`
- Settings persistence: `src/stores/admin-store.js`, `src/routes/admin.js`
- Reward claiming and awarding: `src/stores/user-store.js`
- Publish/unpublish policy enforcement: `server.js`
- Frontend reward copy and confirmation: `public/app-reward-policy.js`
- User credits/reward detail modal: `public/app-credits-detail.js`
- Admin visual settings and settings submit payload: `public/admin-settings.js`
- Static smoke: `scripts/smoke/check-public-reward-policy.mjs`

## Verification

Run these before release:

```bash
node --check server.js
node --check public/app.js
npm run smoke:public-reward-policy
npm run smoke:frontend-boundaries
npm run smoke:public -- http://127.0.0.1:3000
```

Authenticated full-path verification:

```bash
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run smoke:user-credits-reward -- http://127.0.0.1:3000
```

## External References

- Production site: `https://ai-image-studio.twisterfeng.com/`
- Production admin console: `https://ai-image-studio.twisterfeng.com/admin`
- GitHub repository: `https://github.com/Fengsuid/ai-image-studio`
- Release checklist: `docs/IMAGE_STUDIO_QA_RELEASE_CHECKLIST.md`
- Project progress entry: `docs/PROJECT_PROGRESS_STATUS.md`
