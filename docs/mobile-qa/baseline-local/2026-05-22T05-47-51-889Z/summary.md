## Mobile QA Summary

- Version: baseline-local
- Commit: not recorded
- Origin: http://127.0.0.1:62598
- Date: 2026-05-22T05:47:51.920Z
- Tester: smoke:mobile-layout

| Page | Viewport | Result | Notes | Screenshot |
| --- | --- | --- | --- | --- |
| home | 360x800 | Pass | home 360x800: core control #loginBtn hidden | home-360x800.png |
| chat-workspace | 360x800 | Pass |  | chat-workspace-360x800.png |
| gallery | 360x800 | Fail | gallery 360x800: core control #librarySearchForm button touch target 62x35<br>gallery 360x800: core control #leaderboardBtn hidden | gallery-360x800.png |
| leaderboard | 360x800 | Pass |  | leaderboard-360x800.png |
| editor-empty | 360x800 | Pass | editor-empty 360x800: possible text overflow: editor-recent-thumb image-unavailable scroll=70 client=46 | editor-empty-360x800.png |
| home | 390x844 | Pass | home 390x844: core control #loginBtn hidden | home-390x844.png |
| chat-workspace | 390x844 | Pass |  | chat-workspace-390x844.png |
| gallery | 390x844 | Fail | gallery 390x844: core control #librarySearchForm button touch target 62x35<br>gallery 390x844: core control #leaderboardBtn hidden | gallery-390x844.png |
| leaderboard | 390x844 | Pass |  | leaderboard-390x844.png |
| editor-empty | 390x844 | Pass | editor-empty 390x844: possible text overflow: editor-recent-thumb image-unavailable scroll=76 client=46 | editor-empty-390x844.png |
| home | 430x932 | Pass | home 430x932: core control #loginBtn hidden | home-430x932.png |
| chat-workspace | 430x932 | Pass |  | chat-workspace-430x932.png |
| gallery | 430x932 | Fail | gallery 430x932: core control #librarySearchForm button touch target 62x35<br>gallery 430x932: core control #leaderboardBtn hidden | gallery-430x932.png |
| leaderboard | 430x932 | Pass |  | leaderboard-430x932.png |
| editor-empty | 430x932 | Pass | editor-empty 430x932: possible text overflow: editor-recent-thumb image-unavailable scroll=82 client=46 | editor-empty-430x932.png |
| home | 768x1024 | Pass | home 768x1024: core control #loginBtn hidden | home-768x1024.png |
| chat-workspace | 768x1024 | Pass |  | chat-workspace-768x1024.png |
| gallery | 768x1024 | Fail | gallery 768x1024: core control #librarySearchForm button touch target 62x35<br>gallery 768x1024: core control #leaderboardBtn hidden | gallery-768x1024.png |
| leaderboard | 768x1024 | Pass |  | leaderboard-768x1024.png |
| editor-empty | 768x1024 | Pass | editor-empty 768x1024: possible text overflow: editor-recent-thumb image-unavailable scroll=88 client=46 | editor-empty-768x1024.png |
| home | 1280x720 | Pass | home 1280x720: core control #loginBtn hidden | home-1280x720.png |
| chat-workspace | 1280x720 | Pass |  | chat-workspace-1280x720.png |
| gallery | 1280x720 | Pass |  | gallery-1280x720.png |
| leaderboard | 1280x720 | Pass |  | leaderboard-1280x720.png |
| editor-empty | 1280x720 | Pass | editor-empty 1280x720: possible text overflow: editor-recent-thumb image-unavailable scroll=88 client=54 | editor-empty-1280x720.png |

## Failures

- [ ] gallery 360x800: core control #librarySearchForm button touch target 62x35
- [ ] gallery 390x844: core control #librarySearchForm button touch target 62x35
- [ ] gallery 430x932: core control #librarySearchForm button touch target 62x35
- [ ] gallery 768x1024: core control #librarySearchForm button touch target 62x35

## Warnings

- home 360x800: core control #loginBtn hidden
- gallery 360x800: core control #leaderboardBtn hidden
- editor-empty 360x800: possible text overflow: editor-recent-thumb image-unavailable scroll=70 client=46
- home 390x844: core control #loginBtn hidden
- gallery 390x844: core control #leaderboardBtn hidden
- editor-empty 390x844: possible text overflow: editor-recent-thumb image-unavailable scroll=76 client=46
- home 430x932: core control #loginBtn hidden
- gallery 430x932: core control #leaderboardBtn hidden
- editor-empty 430x932: possible text overflow: editor-recent-thumb image-unavailable scroll=82 client=46
- home 768x1024: core control #loginBtn hidden
- gallery 768x1024: core control #leaderboardBtn hidden
- editor-empty 768x1024: possible text overflow: editor-recent-thumb image-unavailable scroll=88 client=46
- home 1280x720: core control #loginBtn hidden
- editor-empty 1280x720: possible text overflow: editor-recent-thumb image-unavailable scroll=88 client=54
