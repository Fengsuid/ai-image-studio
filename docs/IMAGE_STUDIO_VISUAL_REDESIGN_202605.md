# AI Image Studio 视觉与体验重设计方案（2026-05）

更新日期：2026-05-25
对应任务：`AIS-RLS-133` ~ `AIS-RLS-146`（14 个新任务）
私密补充文档：`docs/private/VISUAL_REDESIGN_PLAN_202605.md`（host / 截图基线 / 移动端 QA 矩阵）
归档参考：`archive/codex-handoff-20260524/14-premium-polish.css`（设计草图，结构化吸收后归档）

---

## 0. 决策摘要（执行前共识）

| # | 决策 | 选定 |
| --- | --- | --- |
| D1 | 采用 **Token / Primitive / Page** 三层架构作为最终目标 | yes — `AIS-RLS-146` 强制收尾 |
| D2 | admin 与 public 共享 Layer 2 primitive（同一套 `.btn / .primitive-table / .primitive-drawer / .primitive-modal`），admin 用 `[data-density="compact"]` 修饰 | yes |
| D3 | ⌘K 命令面板纳入本期范围（`AIS-RLS-144`，约 120 行 JS） | yes |
| D4 | `archive/codex-handoff-20260524/14-premium-polish.css`（847 行）作为设计草图参考，其中 ambient drift / glass / hover 思路被新方案结构化吸收；`AIS-RLS-146` 完成后归档目录可删除 | yes |

---

## 1. 现状诊断（量化基线）

### 1.1 视觉层（public 端）

- `public/css/` 共 33 个文件按 `styles.css` import 顺序拼接，无 Layer 抽象，组件样式与页面样式混置
- `00-tokens.css` 定义了约 40 个 CSS 变量（`--brand`、`--shadow-soft`、`--radius-xl` 等），但 200+ 处硬编码 hex 旁路了 token：`#2563eb`、`#1d4ed8`、`#f9fafb`、`#667085` 等反复出现
- 按钮类未抽象：`.brand-btn`、`.nav-pill`、`.dark-pill`、`.icon-pill`、`.tool-button`、`.send-button`、`.composer-options-button`、`.ghost-button`、`.account-avatar`、`.tiny-button`、`.use-button` 共 11+ 种，无 `.btn` 语义层
- `12-animations.css` 仅含 2 行注释（实际为空），全站缺乏微交互（hover spotlight、spring 入场、shimmer 进度等）
- 字体：`Inter`、`Noto Sans SC`、`Instrument Serif` 三套已加载，但 `Instrument Serif` 在任何页面都未被引用
- Hero / Composer 区缺乏视觉锚点，与 leaderboard / gallery card 视觉权重相当

### 1.2 视觉层（admin 端）

- `09-admin.css` 497 行 + `09-admin-shell-polish.css` 353 行 + `09-admin-canvas.css` + `09-admin-settings.css` + `09-admin-prompt-library.css` 共 ~1740 行
- ~150 处硬编码 hex 与 public 端独立演化：`#d0d5dd #eaecf0 #f9fafb #667085 #182230 #475467 #ecfdf3 #027a48 #fef3f2 #b42318 #fff8db #9a6700 #eff6ff #1d4ed8` 全为 admin 独有色板
- admin 与 public 共用 `styles.css` 入口，但视觉语言（圆角、阴影、间距、状态色）平行演化，没有任何共享的 primitive 类
- `09-admin-shell-polish.css` 含 sticky table header、row hover inset border、status pill 等设计资产，但用 selector list + 复写而非 primitive 抽象实现

### 1.3 弹窗 / Drawer / Toast 现状

| 元素 | 文件 | 状态 |
| --- | --- | --- |
| `.modal-layer` | `04-components-modals.css:1` | ✓ 已用 `display: grid; place-items: center` 居中，桌面 OK |
| `.modal` 默认尺寸 | `04-components-modals.css` | `width: min(440px, 100%)`、`max-height: calc(100vh - 40px)`、`border-radius: 28px` |
| `@keyframes modalIn` | `06-gallery.css:156` | ✓ 存在但归类错误，应在 `12-animations.css` |
| `.square-preview-modal` 移动端 | `04-components-modals.css` | ✗ `grid-template-columns: minmax(0, 1fr) 380px` 移动端断裂，无 `@media` 单列降级 |
| `.toast-layer` 移动端 | `06-gallery-leaderboard.css` + `11-mobile.css:177` | △ 桌面 `top:80px;right:20px`；移动端被 `11-mobile.css` 改写为 `bottom: calc(82px + env(safe-area-inset-bottom))`，已存在但位置仅 `bottom` 未保证 `left/right` 居中 |
| `.admin-drawer` 移动端 | `09-admin.css` | △ `width: min(460px, 100vw)` 桌面 OK；移动端未提供 bottom-sheet 替代 |
| 100vh 兼容 | 全局 | ✗ 全部使用 `100vh`，移动端虚拟键盘弹出时 modal 高度错乱 |
| `prefers-reduced-motion` | 仅 `11-mobile.css` 部分 | △ 已禁用部分动画，但 `04-components-modals.css` 的 `modalIn` 未受控 |

### 1.4 god-file 现状

| 文件 | 行数 | 计划处理 |
| --- | --- | --- |
| `public/app.js` | 7,293 | `AIS-RLS-107/108` 待重做，本方案不直接处理 |
| `public/admin.js` | 2,052 | `AIS-RLS-145` 拆分（与 `AIS-RLS-105` 同模式：实体迁移、删除 god-file） |

---

## 2. 总体方案：Token / Primitive / Page 三层架构

```
Layer 1 — Tokens          (00-tokens.css + 00-tokens-typography.css + 00-tokens-motion.css)
   ↓ depends on
Layer 2 — Primitives      (primitives/_button.css, _modal.css, _drawer.css, _toast.css,
                           _table.css, _form.css, _card.css, _pill.css)
   ↓ depends on
Layer 3 — Pages           (pages/home.css, pages/gallery.css, pages/admin-shell.css, ...)
```

### 2.1 共享与差异

- **Token 层**完全共享。admin 端通过 `[data-app="admin"]` 选择器在 root 上注入紧凑变量覆盖（`--space-md: 12px` 替代 public 的 `16px` 等）
- **Primitive 层**完全共享。所有 primitive 接受 `[data-density="compact"]` 修饰，admin 默认开启
- **Page 层**完全独立。public 关注情绪感与节奏，admin 关注信息密度与可扫描性

### 2.2 文件结构（目标态）

```
public/css/
  00-tokens.css                 # Color / Spacing / Radius / Shadow / Z-index
  00-tokens-typography.css      # Font face, size scale, line-height, letter-spacing
  00-tokens-motion.css          # Ease curves, duration scale, animation keyframes
  00-theme.css                  # Light / Dark theme value mappings
  primitives/
    _button.css                 # .btn .btn--primary .btn--secondary .btn--ghost .btn--icon
    _modal.css                  # .primitive-modal .primitive-modal__panel .primitive-modal__header ...
    _drawer.css                 # .primitive-drawer (right / bottom-sheet variants)
    _toast.css                  # .primitive-toast .primitive-toast-layer
    _table.css                  # .primitive-table .primitive-table--bulk
    _form.css                   # .primitive-field .primitive-input .primitive-select
    _card.css                   # .primitive-card .primitive-card--hero .primitive-card--stat
    _pill.css                   # .primitive-pill (status variants)
  pages/
    home.css | gallery.css | gallery-detail.css | leaderboard.css | composer.css |
    editor.css | canvas.css | chat.css | credits-detail.css | prompt-library.css |
    admin-shell.css | admin-users.css | admin-prompts.css | admin-settings.css |
    admin-canvas.css
  mobile/
    _bottom-nav.css             # 与 primitives 协作的移动端壳层
    _safe-area.css              # env(safe-area-inset-*) + 100svh helpers
```

---

## 3. Layer 1 — Token v2 详细规范（`AIS-RLS-133`）

### 3.1 颜色

```css
:root {
  /* Brand scale */
  --brand-50:  #eff6ff;
  --brand-100: #dbeafe;
  --brand-200: #bfdbfe;
  --brand-300: #93c5fd;
  --brand-400: #60a5fa;
  --brand-500: #3b82f6;
  --brand-600: #2563eb;   /* default brand */
  --brand-700: #1d4ed8;
  --brand-800: #1e40af;
  --brand-900: #1e3a8a;

  /* Neutral scale */
  --neutral-0:  #ffffff;
  --neutral-50: #f8fafc;
  --neutral-100:#f1f5f9;
  --neutral-200:#e2e8f0;
  --neutral-300:#cbd5e1;
  --neutral-400:#94a3b8;
  --neutral-500:#64748b;
  --neutral-600:#475569;
  --neutral-700:#334155;
  --neutral-800:#1e293b;
  --neutral-900:#0f172a;

  /* Semantic */
  --color-success: #16a34a;
  --color-warn:    #d97706;
  --color-danger:  #dc2626;
  --color-info:    #0284c7;

  /* Surface (light) */
  --surface-canvas:  var(--neutral-50);
  --surface-card:    var(--neutral-0);
  --surface-elev-1:  var(--neutral-0);
  --surface-elev-2:  var(--neutral-50);
  --surface-glass:   color-mix(in srgb, var(--neutral-0) 76%, transparent);
  --surface-overlay: color-mix(in srgb, var(--neutral-900) 24%, transparent);
}

[data-theme="dark"] {
  --surface-canvas:  var(--neutral-900);
  --surface-card:    var(--neutral-800);
  --surface-glass:   color-mix(in srgb, var(--neutral-800) 78%, transparent);
  --surface-overlay: color-mix(in srgb, var(--neutral-900) 64%, transparent);
}
```

### 3.2 间距 / 圆角 / 阴影

```css
:root {
  --space-3xs: 2px;  --space-2xs: 4px;  --space-xs: 8px;
  --space-sm: 12px;  --space-md: 16px;  --space-lg: 24px;
  --space-xl: 32px;  --space-2xl: 48px; --space-3xl: 64px;

  --radius-sm: 6px;   --radius-md: 10px;  --radius-lg: 14px;
  --radius-xl: 20px;  --radius-2xl: 28px; --radius-pill: 999px;

  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-sm: 0 2px 6px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 6px 18px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 16px 40px rgba(15, 23, 42, 0.10);
  --shadow-xl: 0 28px 64px rgba(15, 23, 42, 0.14);
  --shadow-glow-brand: 0 0 0 1px color-mix(in srgb, var(--brand-600) 40%, transparent),
                       0 8px 24px color-mix(in srgb, var(--brand-600) 22%, transparent);
}

[data-app="admin"] {
  --space-md: 12px;
  --space-lg: 20px;
  --radius-xl: 14px;
  --radius-2xl: 18px;
}
```

### 3.3 字体（`00-tokens-typography.css`）

```css
:root {
  --font-display: "Instrument Serif", "Noto Serif SC", Georgia, serif;
  --font-body:    "Inter", "Noto Sans SC", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", "SFMono-Regular", Consolas, monospace;

  --fs-xs: 12px;  --fs-sm: 13px;  --fs-base: 14px;
  --fs-md: 15px;  --fs-lg: 17px;  --fs-xl: 20px;
  --fs-2xl: 24px; --fs-3xl: 30px; --fs-display: 48px;

  --lh-tight: 1.2;  --lh-snug: 1.35;  --lh-normal: 1.5;  --lh-relaxed: 1.65;
  --tracking-tight: -0.02em;  --tracking-normal: 0;  --tracking-wide: 0.04em;
}
```

### 3.4 动效（`00-tokens-motion.css`）

```css
:root {
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:     cubic-bezier(0.7, 0, 0.84, 0);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-soft:   cubic-bezier(0.4, 0, 0.2, 1);

  --dur-instant: 80ms;
  --dur-fast:    160ms;
  --dur-base:    220ms;
  --dur-slow:    320ms;
  --dur-slower:  480ms;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-instant: 0ms; --dur-fast: 0ms; --dur-base: 0ms;
    --dur-slow: 0ms; --dur-slower: 0ms;
  }
}
```

### 3.5 验收（AIS-RLS-133）

- 新 token 文件全部存在并被 `styles.css` 在首位 import
- 任意运行时执行 `getComputedStyle(document.documentElement).getPropertyValue('--brand-600')` 返回非空
- `00-tokens.css` 总行数 ≤ 90，`00-tokens-typography.css` ≤ 40，`00-tokens-motion.css` ≤ 60
- `npm run smoke:frontend-boundaries` 通过

---

## 4. Layer 2 — Primitive 详细规范

### 4.1 Button（`AIS-RLS-134` public 主导，admin 在 `141/142` 适配）

```html
<!-- 用法示例 -->
<button class="btn btn--primary">生成</button>
<button class="btn btn--secondary">保存草稿</button>
<button class="btn btn--ghost">取消</button>
<button class="btn btn--icon" aria-label="收藏"><svg/></button>
<button class="btn btn--primary" data-loading>提交中…</button>
```

```css
.btn {
  --btn-bg: var(--surface-card);
  --btn-fg: var(--neutral-700);
  --btn-border: var(--neutral-200);
  --btn-h: 40px;
  --btn-px: var(--space-md);
  --btn-radius: var(--radius-lg);

  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-xs);
  min-height: var(--btn-h);
  padding: 0 var(--btn-px);
  border-radius: var(--btn-radius);
  background: var(--btn-bg);
  color: var(--btn-fg);
  border: 1px solid var(--btn-border);
  font: 500 var(--fs-base)/1 var(--font-body);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out),
              transform var(--dur-fast) var(--ease-spring),
              box-shadow var(--dur-fast) var(--ease-out);
}
.btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.btn:active { transform: translateY(0); }
.btn:focus-visible { outline: 2px solid var(--brand-400); outline-offset: 2px; }
.btn[disabled], .btn[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; transform: none; }

.btn--primary { --btn-bg: var(--brand-600); --btn-fg: var(--neutral-0); --btn-border: transparent; }
.btn--primary:hover { --btn-bg: var(--brand-700); box-shadow: var(--shadow-glow-brand); }
.btn--secondary { --btn-bg: var(--brand-50); --btn-fg: var(--brand-700); --btn-border: transparent; }
.btn--ghost { --btn-bg: transparent; --btn-border: transparent; }
.btn--icon { --btn-h: 36px; --btn-px: 0; width: 36px; border-radius: var(--radius-pill); }

[data-density="compact"] .btn { --btn-h: 32px; --btn-px: var(--space-sm); font-size: var(--fs-sm); }

.btn[data-loading]::after {
  content: ""; width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: spin var(--dur-slower) linear infinite;
}
```

### 4.2 Modal（共享）

```css
.primitive-modal-layer {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: center;
  padding: clamp(12px, 4vw, 24px);
  padding-bottom: max(clamp(12px, 4vw, 24px), env(safe-area-inset-bottom));
  background: var(--surface-overlay);
  backdrop-filter: blur(14px) saturate(140%);
  animation: layerIn var(--dur-fast) var(--ease-out);
}

.primitive-modal {
  width: min(440px, 100%);
  max-height: calc(100svh - 40px);  /* svh 处理移动端虚拟键盘 */
  overflow: auto;
  border-radius: var(--radius-2xl);
  background: var(--surface-card);
  box-shadow: var(--shadow-xl);
  animation: modalIn var(--dur-base) var(--ease-spring);
}

/* 宽尺寸变体：桌面双栏，移动端单栏 */
.primitive-modal--wide { width: min(880px, 100%); }
.primitive-modal--split {
  width: min(1480px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
}

@media (max-width: 640px) {
  .primitive-modal,
  .primitive-modal--wide,
  .primitive-modal--split {
    width: 100%;
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    align-self: end;  /* bottom-sheet on mobile */
    max-height: calc(100svh - 56px);
  }
  .primitive-modal--split { grid-template-columns: minmax(0, 1fr); }
  .primitive-modal-layer { align-items: end; padding: 0; }
}

@keyframes modalIn {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes layerIn { from { opacity: 0; } to { opacity: 1; } }
```

**关键验收点（用户强调"弹窗在移动端必须居中"）：**

1. 所有 `.primitive-modal-layer` 在视口宽度 ≥ 641px 时通过 `place-items: center` 居中
2. 视口宽度 ≤ 640px 时切换为 bottom-sheet（`align-items: end` + 顶部圆角），这是符合移动端交互直觉的标准模式；提供 `.primitive-modal--keep-centered` 修饰类用于强制 360px 以下也居中的极小弹窗（如 alert）
3. `max-height: calc(100svh - 40px)` 替代 `100vh` 确保键盘弹起时不被裁切
4. `padding-bottom: max(..., env(safe-area-inset-bottom))` 处理 iOS 安全区
5. `@keyframes modalIn` 唯一定义点在 `_modal.css`，删除 `06-gallery.css` 中的副本
6. `prefers-reduced-motion: reduce` 时 `animation-duration: 0ms`（通过 token 自动接管）

### 4.3 Drawer

```css
.primitive-drawer-layer {
  position: fixed; inset: 0; z-index: 90;
  background: var(--surface-overlay);
  display: grid; grid-template-columns: 1fr auto;
}

.primitive-drawer {
  width: min(460px, 100vw);
  height: 100svh;
  background: var(--surface-card);
  border-left: 1px solid var(--neutral-200);
  box-shadow: var(--shadow-xl);
  display: flex; flex-direction: column;
  animation: drawerIn var(--dur-base) var(--ease-out);
}

.primitive-drawer--bottom {
  grid-column: 1 / -1;
  width: 100%; height: auto; max-height: 85svh;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  border-left: none; border-top: 1px solid var(--neutral-200);
  align-self: end;
  animation: drawerBottomIn var(--dur-base) var(--ease-out);
}

@media (max-width: 640px) {
  .primitive-drawer:not(.primitive-drawer--bottom) {
    width: 100vw;
  }
}

@keyframes drawerIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes drawerBottomIn { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
```

### 4.4 Toast

```css
.primitive-toast-layer {
  position: fixed; z-index: 100;
  top: 80px; right: 20px;
  display: flex; flex-direction: column; gap: var(--space-xs);
}

@media (max-width: 640px) {
  .primitive-toast-layer {
    top: auto; right: auto;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(82px + env(safe-area-inset-bottom));
    align-items: center;
    width: calc(100vw - 32px);
    max-width: 360px;
  }
}

.primitive-toast {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-pill);
  background: var(--surface-glass);
  backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid color-mix(in srgb, var(--neutral-200) 70%, transparent);
  box-shadow: var(--shadow-md);
  animation: toastIn var(--dur-base) var(--ease-spring);
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(-10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

### 4.5 共享通用约束（所有 primitive）

- 触摸目标最小 44×44（iOS HIG / WCAG）
- 文本类 primitive 强制最小 12px、最大 60ch 行宽
- 任何包含动画的 primitive 必须在 keyframe 中使用 `transform` + `opacity`，禁用 `width/height/top/left` 动画
- 任何 surface 类 primitive 提供 `--surface-tint`（仅 hue）变量插槽，供 page 层在不破坏 token 体系下做细调
- 所有交互态严格走 `:hover` / `:active` / `:focus-visible` / `[aria-pressed]` / `[aria-expanded]`，不使用 JS 切类

---

## 5. Layer 3 — Page 重构（public）

### 5.1 `AIS-RLS-135` Topbar 密度治理

- 当前桌面 topbar 显示 14 个控件（搜索、tab、用户菜单、新建、模式切换、签到、积分、提示、收藏、夜间模式、社区、规则、统计、设置）
- 重构目标：保留 8 个主控件，其余移入用户菜单 / overflow `…` 菜单
- 在 ≥ 1280px 显示全部 8 控件，在 [641, 1279] 折叠 3 个低频项到 overflow，在 ≤ 640px 仅保留 logo + 搜索 + 用户头像，其余由底部导航与命令面板（⌘K）承担
- 验收：DOM 节点数下降 ≥ 30%；topbar 高度 ≤ 60px

### 5.2 `AIS-RLS-136` Hero / Composer 区

- Hero 标题升级为 `font-family: var(--font-display)` (Instrument Serif) + 颜色渐变 `background: linear-gradient(120deg, var(--brand-700), var(--brand-500), #8b5cf6)`，`-webkit-background-clip: text` 实现金属色
- 副标题保留 Inter 体，颜色 `var(--neutral-500)`，行距 1.5
- Composer mount 改为 `.primitive-card--hero` 玻璃卡：`background: var(--surface-glass)`、`backdrop-filter: blur(20px)`、`border: 1px solid color-mix(in srgb, var(--neutral-200) 60%, transparent)`、`box-shadow: var(--shadow-lg)`
- 在 hero 背景层加入 ambient drift（CSS-only，2 个 `radial-gradient` blob + 30s 慢动画，`@media (prefers-reduced-motion: reduce)` 时禁用）

### 5.3 `AIS-RLS-137` 微交互与卡片悬停

- 在 `00-tokens-motion.css` 之外新建 `01-motion-library.css` 实现 5 个通用 keyframe：`shimmer`、`fade-up`、`spring-in`、`pulse-soft`、`floating-blob`
- Gallery card / Recent tile 悬停效果：
  ```css
  .gallery-card { position: relative; isolation: isolate; transition: transform var(--dur-base) var(--ease-spring); }
  .gallery-card::before {
    content: ""; position: absolute; inset: 0; z-index: -1;
    background: radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%),
                color-mix(in srgb, var(--brand-500) 18%, transparent), transparent 50%);
    opacity: 0; transition: opacity var(--dur-base) var(--ease-out);
  }
  .gallery-card:hover { transform: translateY(-2px); }
  .gallery-card:hover::before { opacity: 1; }
  ```
  JS 仅一行：`card.style.setProperty('--mx', e.offsetX + 'px')`
- Leaderboard / 提示词 / 历史记录 列表项滚入视口时使用 `IntersectionObserver` 触发 `fade-up`，stagger 60ms

### 5.4 `AIS-RLS-138` Dark mode + Ambient drift

- 当前 `00-theme.css` 仅切换部分变量，需要补齐所有 surface / text / border token 在 dark mode 下的值
- 在 dark mode 下 hero blob 使用 `color-mix(in srgb, var(--brand-400) 40%, transparent)` 让光斑更可见
- 系统层：监听 `prefers-color-scheme` 仅作初始值，用户切换后写入 `localStorage` 持久化

### 5.5 `AIS-RLS-139` 移动端 4 文件合并 + 底部导航

- 现有 `mobile.css` / `mobile-editor.css` / `mobile-gallery.css` / `css/11-mobile.css` 4 个文件合并为 `mobile/` 目录下 4 个文件（`_safe-area.css` / `_bottom-nav.css` / `_mobile-overrides.css` / `_mobile-editor.css`）
- 底部导航强制 FAB（中央生成按钮悬浮 +12px）样式，使用 primitive button + 自定义修饰
- 全部 100vh 替换为 100svh
- 所有移动端弹窗自动接管 §4.2 中定义的 bottom-sheet 模式

---

## 6. Layer 3 — Page 重构（admin）

### 6.1 `AIS-RLS-140` Admin token 替换

- 把 `09-admin*.css` 中全部 ~150 处硬编码 hex 改为 `var(--neutral-*)` / `var(--brand-*)` / `var(--color-success)` 等
- 不允许新增 admin 专属 token；如需差异化使用 `[data-app="admin"]` 覆盖
- 验收：`grep -E '#[0-9a-fA-F]{3,6}' public/css/09-admin*.css | wc -l ≤ 5`（仅允许极少数 inline SVG fill）

### 6.2 `AIS-RLS-141` Admin shell 重构

- Sidebar 三态：展开 (240px) / 折叠 (64px) / 移动端抽屉
- Topbar 分两层：上层全局（搜索 + 通知 + 用户）+ 下层页面（面包屑 + 主操作 + 视图切换）
- 全部使用 primitive button + primitive pill；admin 标识通过 `<html data-app="admin" data-density="compact">` 注入

### 6.3 `AIS-RLS-142` Admin 数据 primitive

- `.primitive-table` 必须支持：sticky header、行选中态、批量操作工具栏、密度切换、空态卡
- `.primitive-table--bulk` 修饰类启用左侧 checkbox 列与浮动批量栏（底部贴边、`box-shadow: var(--shadow-lg)`、宽度跟随表格）
- `.primitive-drawer` 在 admin 详情场景必须支持 tab + 内部滚动（外部不滚动）

### 6.4 `AIS-RLS-143` Admin stat / hero / empty card

- Stat 卡升级为 `.primitive-card--stat`：大数字 + 趋势 chip + sparkline mount
- 空态使用 `.primitive-card--empty` 居中插图（SVG）+ 主操作 + 提示链接
- Hero（管理员欢迎区）使用 `.primitive-card--hero` + 4 个 quick action

### 6.5 `AIS-RLS-144` Admin 微交互 + ⌘K 命令面板

- 表格行 hover：左侧 3px brand inset border + 行背景轻染
- ⌘K（macOS）/ Ctrl+K（Windows）弹起命令面板：
  - 索引数据：路由表（管理员菜单项）+ 最近访问的用户/订单/提示词 ID
  - 命令面板使用 `.primitive-modal--wide` + 自定义 `data-flavor="palette"`
  - 键盘导航：↑↓ 切换、Enter 执行、Esc 关闭
  - 实现：约 120 行 JS，挂在 `public/admin-command-palette.js`（与 admin god-file 拆分协调）

### 6.6 `AIS-RLS-145` admin.js god-file 拆分

- 按业务域拆为 `public/admin/users.js`、`admin/prompts.js`、`admin/announcements.js`、`admin/settings.js`、`admin/canvas.js`、`admin/dashboard.js`、`admin/command-palette.js`
- 每个 ≤ 400 行实体业务代码，禁止 wrapper-only 反模式（参见 `AIS-RLS-105` 实施模式）
- 完成后 `public/admin.js` 删除，`public/admin.html` 改为模块入口

---

## 7. Layer 3 — `AIS-RLS-146` Primitive 层架构收尾

- 将 §2.2 文件结构落地：
  - 新建 `public/css/primitives/` 目录与 8 个 `_*.css`
  - 新建 `public/css/pages/` 目录，把原 `04-components-*.css` / `05-*.css` / `06-*.css` / `07-*.css` / `08-*.css` / `09-*.css` 内容按 page 归位
  - `styles.css` 重写为 `@import` 顺序：tokens → primitives → pages → mobile
- 删除：`12-animations.css`（内容并入 `00-tokens-motion.css` + `01-motion-library.css`）、原 `04-components-modals.css` / `04-components-forms.css` / `04-components.css`（实质内容已被 primitive 吸收）
- 验收：
  - `find public/css -name '04-components*' | wc -l == 0`
  - `npm run smoke:frontend-boundaries` 通过
  - `wc -l public/css/styles.css` 仅含 import 与极少全局 reset
  - 全站任意 page CSS 文件 ≤ 600 行
  - `archive/codex-handoff-20260524/` 归档删除（其中 ambient drift / glass / hover 设计资产已结构化吸收）

---

## 8. 任务总览与依赖

| Task | 标题 | 依赖 | 行数预算（新增） |
| --- | --- | --- | --- |
| `AIS-RLS-133` | Token v2: 颜色/字号/动效三组 token | — | +180 / -0 |
| `AIS-RLS-134` | Primitive: `.btn` 五变体 + loading | 133 | +220 / -260（替换 11 类按钮散落定义） |
| `AIS-RLS-135` | Public topbar 密度治理 | 134 | -120 |
| `AIS-RLS-136` | Hero / Composer 玻璃卡升级 | 133, 134 | +180 |
| `AIS-RLS-137` | 微交互库 + 卡片悬停 spotlight | 133 | +220 |
| `AIS-RLS-138` | Dark mode + Ambient drift | 133, 136 | +120 |
| `AIS-RLS-139` | 移动端 4 文件合并 + 底部导航 + svh | 134 | -200 / +260 |
| `AIS-RLS-140` | Admin 硬编码 hex → token | 133 | -150 hex |
| `AIS-RLS-141` | Admin shell 重构（sidebar 三态 + topbar 分层） | 134, 140 | +280 |
| `AIS-RLS-142` | Admin primitive table / bulk / drawer | 134, 140 | +320 |
| `AIS-RLS-143` | Admin stat / hero / empty card | 142 | +180 |
| `AIS-RLS-144` | Admin 微交互 + ⌘K 命令面板 | 142, 145 | +220 |
| `AIS-RLS-145` | `public/admin.js` god-file 拆分 | (并行 140 之后启动) | -2052 god / +新业务文件 |
| `AIS-RLS-146` | Primitive 层架构收尾 | 134, 141, 142 | 大重组（净行数下降） |

**并行机会：**
- 133 完成后 →（134, 137, 140）三条并行
- 134 完成后 →（135, 136, 139）并行
- 140 完成后 →（141, 145）并行
- 142 完成后 →（143, 144）并行
- 146 必须在 134/141/142 全部完成后启动

**关键路径：** 133 → 134 → 141 → 142 → 146

---

## 9. 验收命令与质量门禁

每个任务在 `task.py finish` 前必须通过：

```
npm run check                              # 含 lint + format check
node --check public/<改动文件>.js
npm run smoke:frontend-boundaries
npm run smoke:public-app-module-split      # 涉及 public js 时
npm run smoke:admin-module-split           # 涉及 admin js 时
npm run smoke:visual-regression -- --filter <相关页面>
```

新增专项 smoke（在 `AIS-RLS-146` 实现）：

```
npm run smoke:css-primitive-boundaries
# 检查：
#   1. public/css/pages/*.css 中无 .btn / .primitive-* 类的定义（只允许使用）
#   2. public/css/primitives/_*.css 中无 page-scope 选择器
#   3. 全站 CSS 中硬编码 hex（#xxx / #xxxxxx）数量 ≤ 20
#   4. styles.css 仅含 @import 与 :root reset
```

---

## 10. 移动端 QA 矩阵（关键交互保障）

每个改动到 primitive 的任务必须在以下视口逐项验证：

| 视口 | 重点 |
| --- | --- |
| 320×568 (iPhone SE 1) | modal bottom-sheet、toast 居中、底部导航不遮挡 |
| 375×812 (iPhone 12) | 安全区、键盘弹起后输入框可见、`100svh` 生效 |
| 414×896 (iPhone 11 Pro Max) | hero / composer 视觉权重、卡片间距 |
| 768×1024 (iPad portrait) | topbar 折叠点、sidebar 状态 |
| 横屏 812×375 | modal 高度不超出、toast 不遮挡 |

每次 PR 必须附带至少 3 个视口的截图对比，存入 `docs/mobile-qa/visual-regression/runs/<timestamp>/`。

---

## 11. 风险与回滚

| 风险 | 缓解 | 回滚 |
| --- | --- | --- |
| Token 替换导致夜间模式色错 | 任务 138 在 133 之后立即收口 | revert 单 commit |
| Primitive 类名与现有冲突 | 全部 primitive 使用 `.primitive-*` 或 `.btn` 命名空间；旧类保留至 146 | 旧文件保留至 146 完成 |
| `admin.js` 拆分回归 | 严格按 `AIS-RLS-105` 模式（实体迁移 + 删除 god-file，不留 wrapper） | 单任务粒度可独立 revert |
| ⌘K 命令面板键盘冲突 | 仅在 admin 注册全局快捷键（`document.documentElement.dataset.app === 'admin'`） | 移除 `command-palette.js` 引用 |
| 移动端 bottom-sheet 与现有滚动锁冲突 | 在 `_modal.css` 内附 `body[data-modal-open]` 锁定逻辑 | 单 keyframe / 媒体查询粒度 revert |
| `archive/codex-handoff-20260524/` 删除遗漏可复用资产 | 删除前由 146 任务 owner 比对原文件与新 primitive，确认资产已吸收 | 从 git 历史恢复 |

---

## 12. 与既有方案的关系

- 本方案延续 `IMAGE_STUDIO_FOLLOWUP_OPTIMIZATION_PLAN_202605.md` 的 P0~P3 优先级与 30-PR 序列号语义，新增的 14 个任务（133~146）落在原计划之后的"视觉与体验" lane，不替代任何 ready 状态的既有任务
- `AIS-RLS-105` admin 路由拆分（已完成，删除 god-file）是本方案 `AIS-RLS-145` admin.js 拆分的方法论参考
- 私密补充见 `docs/private/VISUAL_REDESIGN_PLAN_202605.md`（host 真值、QA 截图基线、内部沟通记录）

---

## 13. 变更日志

- 2026-05-25 v1：初版发布，包含 D1~D4 四项执行前共识、Token v2 + 三层架构定义、14 个 Trellis 任务规划
