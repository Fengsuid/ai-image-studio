# ai-image-studio 前端美化专项方案

日期：2026-05-23
状态：设计方案，待排入迭代批次落地
前提：`docs/CODE_MAINTENANCE_OPTIMIZATION.md §九` CSS 拆分完成后，本文件中的样式改动按模块文件写入；拆分前可在 `styles.css` 末尾追加，标注所属区块。
协调：当前仍有 agent 在项目中工作，CSS/JS 改动必须在活跃开发间隙执行，不要与 agent 批次冲突。

---

## 0. 现状诊断

| 维度 | 现状 | 问题 |
|------|------|------|
| 设计 Token | `:root` 有基础变量，但暗色模式变量、品牌色层、动效层均缺失 | 新增样式只能写死数值，无法响应主题切换 |
| CSS 体量 | `styles.css` 9276 行，按批次追加 | 无组件边界，同名 selector 散落多处，难以定位和修改 |
| 动效 | `transition` 单点补丁，无统一 `@keyframes` 库 | 不同组件动效节奏不一致 |
| 卡片 | hover 仅 `translateY(-2px)` + 阴影，无 overlay 层 | 缺乏图片内容的快速预览和操作浮现 |
| 首页 hero | 渐变背景已有，但 h1 纯文字无视觉层次 | 缺乏品牌感和进入冲击力 |
| 加载状态 | 骨架屏不统一，部分视图缺失 | 网络慢时 UI 闪跳 |
| 暗色模式 | 无 | 强光环境体验差，无法留住用户 |
| 移动端 | 顶部导航 + 抽屉，无底部导航 | 拇指区操作成本高 |

---

## 一、设计 Token 完整化

这是所有美化的基础，必须最先完成。目标文件：`public/css/00-tokens.css`。

### 1.1 颜色语义层

在现有 `:root` 基础上补充语义变量，所有组件只引用语义变量，不直接写颜色值：

```css
:root {
  /* ── 已有，保持 ── */
  --ink: #1a1a1a;
  --text: #373a46;
  --muted: #8c93a1;
  --line: #eceff3;
  --soft: #f7f8fa;
  --paper: rgba(255, 255, 255, 0.72);
  --paper-solid: #ffffff;
  --blue: #1677ff;
  --green: #52c41a;
  --red: #ff4d4f;

  /* ── 新增：品牌色 ── */
  --brand: #7c5cfc;          /* 主品牌紫 */
  --brand-light: #ede8ff;    /* 品牌底色 */
  --brand-dark: #5a3fd4;     /* hover/active 深品牌 */

  /* ── 新增：语义面板色 ── */
  --bg: #ffffff;              /* 页面底色 */
  --surface: #f7f8fa;        /* 卡片/面板底色 */
  --surface-raised: #ffffff; /* 弹窗/浮层底色 */
  --border: #eceff3;         /* 通用边框 */
  --border-subtle: rgba(148, 163, 184, 0.18); /* 极淡边框 */

  /* ── 新增：文字语义层 ── */
  --text-primary: #1a1a1a;
  --text-secondary: #5a6270;
  --text-tertiary: #9ba3b0;
  --text-on-brand: #ffffff;

  /* ── 新增：动效 token ── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-fast: 140ms;
  --dur-base: 220ms;
  --dur-slow: 380ms;

  /* ── 新增：圆角（已有部分，补全） ── */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* ── 新增：阴影语义层 ── */
  --shadow-xs: 0 1px 4px rgba(15, 23, 42, 0.06);
  --shadow-sm: 0 4px 12px rgba(15, 23, 42, 0.07);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.09);
  --shadow-lg: 0 20px 60px rgba(15, 23, 42, 0.12);
  --shadow-xl: 0 32px 96px rgba(15, 23, 42, 0.18);
  --shadow-brand: 0 8px 24px rgba(124, 92, 252, 0.28);
}
```

### 1.2 暗色模式变量覆盖

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1117;
    --surface: #181b24;
    --surface-raised: #1e2230;
    --border: #2a2f3d;
    --border-subtle: rgba(255, 255, 255, 0.07);
    --ink: #e8eaf0;
    --text-primary: #e8eaf0;
    --text-secondary: #9ba3b0;
    --text-tertiary: #5a6270;
    --muted: #6b7280;
    --line: #2a2f3d;
    --soft: #181b24;
    --paper: rgba(30, 34, 48, 0.85);
    --paper-solid: #1e2230;
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.25);
    --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.35);
    --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.45);
  }
}

/* 手动暗色切换：在 <html> 加 data-theme="dark" 时生效 */
[data-theme="dark"] {
  /* 同上覆盖 */
  color-scheme: dark;
  --bg: #0f1117;
  /* ... 同 @media 内容 */
}
```

**暗色切换开关（app.js 添加）：**

```js
function toggleDarkMode() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}
// 初始化时读取
const saved = localStorage.getItem('theme');
if (saved) document.documentElement.dataset.theme = saved;
```

---

## 二、动效库统一（`public/css/12-animations.css`）

当前 `@keyframes` 散落在 styles.css 多处。统一到一个文件：

```css
/* ── 进场 ── */
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes pop-in {
  from { opacity: 0; transform: scale(0.88); }
  60%  { transform: scale(1.03); }
  to   { opacity: 1; transform: scale(1); }
}

/* ── 骨架屏 shimmer ── */
@keyframes shimmer {
  from { background-position: -400px 0; }
  to   { background-position: 400px 0; }
}

/* ── 生成进度 pulse ── */
@keyframes gen-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}

/* ── 按钮 ripple ── */
@keyframes ripple {
  to { transform: scale(3); opacity: 0; }
}

/* ── 实用类 ── */
.animate-slide-up   { animation: slide-up var(--dur-base) var(--ease-out) both; }
.animate-scale-in   { animation: scale-in var(--dur-base) var(--ease-out) both; }
.animate-pop-in     { animation: pop-in var(--dur-slow) var(--ease-bounce) both; }
.animate-fade-in    { animation: fade-in var(--dur-base) ease both; }
```

---

## 三、通用组件美化（`public/css/04-components.css`）

### 3.1 按钮系统重构

现有按钮样式分散、inconsistent。统一为三级变体：

```css
/* Primary ── 品牌色实心 */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: var(--radius-full);
  background: var(--brand);
  color: var(--text-on-brand);
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: background var(--dur-fast) var(--ease-out),
              box-shadow var(--dur-fast) var(--ease-out),
              transform var(--dur-fast) var(--ease-out);
}
.btn-primary:hover {
  background: var(--brand-dark);
  box-shadow: var(--shadow-brand);
  transform: translateY(-1px);
}
.btn-primary:active { transform: translateY(0); }

/* Secondary ── 描边 */
.btn-secondary {
  /* 同结构，background: transparent; border: 1.5px solid var(--border); color: var(--text-primary); */
}

/* Ghost ── 无边框 */
.btn-ghost {
  /* background: transparent; color: var(--text-secondary); */
}

/* Ripple effect ── JS 动态添加 .ripple span */
.btn-primary .ripple-wave {
  position: absolute;
  border-radius: 50%;
  width: 20px; height: 20px;
  background: rgba(255,255,255,0.35);
  transform: scale(0);
  animation: ripple 500ms var(--ease-out) forwards;
  pointer-events: none;
}
```

**Ripple JS（约 15 行，加入 `app.js` 初始化段）：**

```js
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary, .btn-secondary');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const wave = document.createElement('span');
  wave.className = 'ripple-wave';
  wave.style.left = (e.clientX - rect.left - 10) + 'px';
  wave.style.top  = (e.clientY - rect.top - 10) + 'px';
  btn.appendChild(wave);
  wave.addEventListener('animationend', () => wave.remove());
});
```

### 3.2 弹窗/Modal 统一动效

```css
.modal-overlay {
  animation: fade-in var(--dur-base) ease both;
}
.modal-box {
  animation: scale-in var(--dur-base) var(--ease-out) both;
}
/* 关闭时反向 */
.modal-overlay.closing { animation: fade-in var(--dur-fast) ease reverse both; }
.modal-box.closing     { animation: scale-in var(--dur-fast) var(--ease-out) reverse both; }
```

### 3.3 Toast 通知美化

```css
.toast {
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  animation: slide-up var(--dur-base) var(--ease-out) both;
  max-width: 360px;
}
.toast.success { border-left: 3px solid var(--green); }
.toast.error   { border-left: 3px solid var(--red); }
.toast.info    { border-left: 3px solid var(--brand); }
/* 退出动效通过 JS 添加 .toast-exit 类触发 slide-down reverse */
```

### 3.4 骨架屏（Skeleton）统一

```css
.skeleton {
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--surface) 25%,
    var(--border) 50%,
    var(--surface) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.4s linear infinite;
}
/* 用法：<div class="skeleton" style="height:154px;border-radius:18px;"></div> */
```

---

## 四、首页（homeView）美化

目标文件：`public/css/05-home.css`

### 4.1 Hero 区域视觉升级

**现状：** 渐变背景 + 纯文字标题
**目标：** 渐变文字标题 + 品牌强调 + 更强动效节奏

```css
/* 渐变标题 */
.hero h1 {
  background: linear-gradient(135deg, var(--ink) 0%, var(--brand) 60%, #f472b6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

/* 副标题 */
.hero-desc {
  font-size: clamp(15px, 2vw, 18px);
  color: var(--text-secondary);
  max-width: 52ch;
  line-height: 1.65;
}

/* 环境光增强 */
.ambient {
  background:
    radial-gradient(ellipse at 15% 10%, rgba(124, 92, 252, 0.12), transparent 35%),
    radial-gradient(ellipse at 80% 15%, rgba(244, 114, 182, 0.10), transparent 35%),
    radial-gradient(ellipse at 50% 95%, rgba(251, 191, 36, 0.09), transparent 38%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}
```

### 4.2 今日生成数字动效

```css
.daily-metric-number {
  font-size: 48px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, var(--brand), #7dd3fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

```js
// 数字滚动进场（约 20 行，加到 homeView 渲染逻辑）
function animateCount(el, target, duration = 1200) {
  const start = performance.now();
  const update = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.floor(ease * target).toLocaleString();
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
```

### 4.3 灵感卡片 3D Tilt

```css
.example-card {
  transition: transform var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out);
  transform-style: preserve-3d;
  will-change: transform;
}
```

```js
// 卡片鼠标追踪 tilt（约 25 行）
document.querySelectorAll('.example-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(600px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) translateY(-4px)`;
    card.style.boxShadow = `${-x * 8}px ${y * 8}px 32px rgba(15,23,42,0.14)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.boxShadow = '';
  });
});
```

---

## 五、画廊与卡片美化

目标文件：`public/css/06-gallery.css`

### 5.1 Masonry 布局（无 JS 方案）

使用 CSS `columns` 实现瀑布流，无需 JS 计算：

```css
.gallery-grid {
  columns: 2;
  column-gap: var(--gap-md);
}
@media (min-width: 640px)  { .gallery-grid { columns: 3; } }
@media (min-width: 960px)  { .gallery-grid { columns: 4; } }
@media (min-width: 1280px) { .gallery-grid { columns: 5; } }

.gallery-grid .work-card {
  break-inside: avoid;
  margin-bottom: var(--gap-md);
}
```

> 注：如果当前布局用 flexbox/grid，切换到 columns 需确认卡片高度可变。若卡片目前强制等高，先去掉固定高度。

### 5.2 卡片 Hover Overlay

```css
.work-card,
.prompt-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  transition:
    transform var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}

.work-card:hover,
.prompt-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: var(--shadow-lg);
}

/* Overlay 渐变层 */
.work-card .card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(10, 10, 20, 0.72) 0%,
    rgba(10, 10, 20, 0.0) 55%
  );
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
  display: flex;
  align-items: flex-end;
  padding: 14px;
  gap: 8px;
}

.work-card:hover .card-overlay { opacity: 1; }

/* Overlay 内操作按钮 */
.card-overlay-actions {
  display: flex;
  gap: 6px;
  transform: translateY(6px);
  transition: transform var(--dur-base) var(--ease-out);
}
.work-card:hover .card-overlay-actions { transform: translateY(0); }

.card-action-btn {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.28);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 16px;
  cursor: pointer;
  transition: background var(--dur-fast) ease;
}
.card-action-btn:hover { background: rgba(255,255,255,0.32); }
```

**HTML 结构（每张 work-card 内插入）：**

```html
<div class="card-overlay">
  <div class="card-overlay-actions">
    <button class="card-action-btn" title="使用此提示词">
      <i class="ri-flashlight-line"></i>
    </button>
    <button class="card-action-btn" title="图生图">
      <i class="ri-image-edit-line"></i>
    </button>
    <button class="card-action-btn" title="下载">
      <i class="ri-download-2-line"></i>
    </button>
  </div>
</div>
```

### 5.3 懒加载进场动效

```css
.work-card {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-out);
}
.work-card.in-view {
  opacity: 1;
  transform: translateY(0);
}
```

```js
// IntersectionObserver 触发进场（约 12 行）
const cardObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      cardObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.work-card').forEach(c => cardObserver.observe(c));
```

### 5.4 提示词卡片点赞微交互

```css
.like-btn {
  transition: transform var(--dur-fast) var(--ease-bounce),
              color var(--dur-fast) ease;
}
.like-btn.liked {
  color: var(--red);
}
.like-btn.like-pop {
  animation: pop-in var(--dur-slow) var(--ease-bounce);
}
```

```js
likeBtn.addEventListener('click', () => {
  likeBtn.classList.add('like-pop');
  likeBtn.addEventListener('animationend', () => likeBtn.classList.remove('like-pop'), { once: true });
});
```

---

## 六、文生图对话（chatView）美化

目标文件：`public/css/08-chat.css`

### 6.1 消息气泡区分

```css
/* 用户消息 */
.chat-msg.user .msg-bubble {
  background: linear-gradient(135deg, var(--brand), var(--brand-dark));
  color: #fff;
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
  align-self: flex-end;
  box-shadow: var(--shadow-brand);
}

/* AI 消息 */
.chat-msg.assistant .msg-bubble {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm);
  color: var(--text-primary);
}

/* 进场动效 */
.chat-msg {
  animation: slide-up var(--dur-base) var(--ease-out) both;
}
```

### 6.2 生成进度条

```css
.gen-progress-bar {
  height: 3px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--brand), #7dd3fc, var(--brand));
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}

.gen-status-spinner {
  width: 20px; height: 20px;
  border: 2.5px solid var(--border);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

### 6.3 Composer 输入框聚焦扩展

```css
.composer {
  border: 1.5px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface-raised);
  transition:
    border-color var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);
}
.composer:focus-within {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(124, 92, 252, 0.15);
}
```

---

## 七、图生图工作台（editorView）美化

目标文件：`public/css/07-editor.css`

### 7.1 上传区域美化

```css
.upload-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  transition:
    border-color var(--dur-base) ease,
    background var(--dur-base) ease;
  display: grid;
  place-items: center;
  min-height: 200px;
  cursor: pointer;
}
.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--brand);
  border-style: solid;
  background: var(--brand-light);
}
```

### 7.2 工具栏图标按钮

```css
.tool-btn {
  width: 40px; height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition:
    background var(--dur-fast) ease,
    color var(--dur-fast) ease,
    border-color var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease;
}
.tool-btn:hover {
  background: var(--bg);
  color: var(--brand);
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(124, 92, 252, 0.12);
}
.tool-btn.active {
  background: var(--brand-light);
  color: var(--brand);
  border-color: rgba(124, 92, 252, 0.4);
}
```

---

## 八、移动端底部导航

目标文件：`public/css/11-mobile.css`

当前移动端无底部导航，常用操作全在顶部。拟在 ≤ 640px 增加固定底部 Tab Bar：

```css
@media (max-width: 640px) {
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0; right: 0;
    z-index: 100;
    display: flex;
    background: var(--surface-raised);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
    backdrop-filter: blur(16px);
  }

  .bottom-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 10px 0;
    font-size: 11px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: color var(--dur-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }
  .bottom-nav-item i { font-size: 22px; }
  .bottom-nav-item.active { color: var(--brand); }

  /* 生成按钮凸起 */
  .bottom-nav-generate {
    position: relative;
    top: -14px;
  }
  .bottom-nav-generate .nav-icon-wrap {
    width: 52px; height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--brand), var(--brand-dark));
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 24px;
    box-shadow: var(--shadow-brand);
  }

  /* 给页面底部留出导航高度 */
  .app-content { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
}
```

**HTML（加入 `index.html` body 底部，移动端可见）：**

```html
<nav class="bottom-nav" id="bottomNav">
  <div class="bottom-nav-item active" data-view="home">
    <i class="ri-home-4-line"></i>首页
  </div>
  <div class="bottom-nav-item" data-view="library">
    <i class="ri-compass-3-line"></i>广场
  </div>
  <div class="bottom-nav-item bottom-nav-generate" data-view="chat">
    <div class="nav-icon-wrap"><i class="ri-flashlight-line"></i></div>
    <span>生成</span>
  </div>
  <div class="bottom-nav-item" data-view="editor">
    <i class="ri-image-edit-2-line"></i>图生图
  </div>
  <div class="bottom-nav-item" data-view="myworks">
    <i class="ri-folder-image-line"></i>我的
  </div>
</nav>
```

---

## 九、暗色模式主题切换

### 9.1 主题切换按钮（顶栏）

在 `index.html` topbar 区域加入：

```html
<button class="icon-pill theme-toggle" id="themeToggle" title="切换深色模式">
  <i class="ri-moon-line"></i>
</button>
```

```css
.theme-toggle .ri-moon-line,
.theme-toggle .ri-sun-line {
  transition: opacity var(--dur-fast) ease, transform var(--dur-fast) ease;
}
[data-theme="dark"] .theme-toggle .ri-moon-line { display: none; }
[data-theme="light"] .theme-toggle .ri-sun-line  { display: none; }
```

```js
// app.js 初始化段
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', toggleDarkMode);
}
```

### 9.2 全局过渡保护

切换主题时，避免所有元素同时跳变：

```css
html.theme-transitioning *,
html.theme-transitioning *::before,
html.theme-transitioning *::after {
  transition:
    background-color 300ms var(--ease-out),
    border-color 300ms var(--ease-out),
    color 300ms var(--ease-out),
    box-shadow 300ms var(--ease-out) !important;
}
```

```js
function toggleDarkMode() {
  document.documentElement.classList.add('theme-transitioning');
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 320);
  localStorage.setItem('theme', document.documentElement.dataset.theme);
}
```

---

## 十、实施路线

### 阶段划分

| 阶段 | 内容 | 风险 | 前置条件 |
|------|------|------|----------|
| **P0** | 补充 Token 变量（§一）、动效库（§二）追加到 styles.css 末尾 | 低：只新增变量 | 无 |
| **P1** | 卡片 Hover Overlay + 懒加载动效（§五）| 中：改卡片 HTML 结构 | gallery-normalize.js 输出的 HTML 一致 |
| **P1** | Toast/Modal/Skeleton 统一（§三）| 低：替换现有样式 | 无 |
| **P1** | Composer 聚焦样式 + 生成进度条（§六）| 低：无 HTML 改动 | 无 |
| **P2** | CSS 拆分成 `public/css/` 目录（`CODE_MAINTENANCE_OPTIMIZATION.md §九`）| 中：需要更新 index.html 的 link 标签 | 无 agent 并行写 styles.css |
| **P2** | 暗色模式（§九）| 中：全局变量覆盖，需所有组件验证 | P0 Token 变量补充完成 |
| **P2** | 移动端底部导航（§八）| 中：新增 HTML + 修改 app.js 路由监听 | 无 agent 并行写 index.html |
| **P3** | Hero 渐变标题、数字动效（§四）| 低：视觉增强，不影响功能 | 无 |
| **P3** | Tilt 3D 卡片效果（§四）| 低：纯装饰，降级无影响 | 无 |
| **P3** | 按钮 Ripple（§三）| 低：纯装饰 | 无 |

### 执行原则

- **P0 可以立即执行**，仅追加 CSS 变量，无破坏性。
- **每个 P1/P2 子任务单独提交**，提交前 `node --check public/app.js` + 本地浏览验证首页/画廊/编辑器。
- **暗色模式单独一次完整 QA**：逐视图检查颜色对比度 ≥ 4.5:1（WCAG AA）。
- **移动端改动完成后**需在手机/DevTools 中验证 safe-area 间距和底部导航不遮挡内容。
- Trellis 任务：P0-P1 对应 `AIS-RLS-070`（建议，当前最新为 AIS-RLS-069），P2 暗色模式对应 `AIS-RLS-071`，P2 CSS 拆分对应 §九中的维护任务。实际排任务前需先在 `D:\生图广场\.trelis\tasks\` 新建对应 task.json。

---

## 十一、验收标准

1. **首页**：Hero h1 渐变文字可见；灵感卡片 hover tilt 效果不卡顿（≥ 60fps）。
2. **画廊**：卡片 overlay 在 hover 时正确出现，操作按钮可点击且功能正常；骨架屏在图片加载前显示。
3. **生成**：进度条在生成时循环播放；spinner 居中对齐；toast 从底部滑入。
4. **暗色模式**：所有视图背景色切换正常；文字对比度 ≥ 4.5:1；无遗漏的硬编码白色背景。
5. **移动端**：底部导航可见且不遮挡内容；safe-area 边距生效；tab 切换高亮正确。
6. **性能**：`will-change` 只用于实际动画元素；卡片 tilt 使用 `transform`，不触发 layout 重排。
