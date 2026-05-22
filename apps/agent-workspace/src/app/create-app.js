import {
  ApiError,
  confirmAgentPlan,
  createAgentPlan,
  createAgentSession,
  getAgentSession,
  getCurrentAuth,
  listAgentSessions
} from "../adapters/ai-image-studio-api.js";

const DEFAULT_PROMPT = "我想做一组赛博茶饮品牌海报，适合小红书，统一青绿色并带一点宋代瓷器质感。";

export function createAgentWorkspaceApp(root) {
  const state = {
    auth: null,
    sessions: [],
    currentSession: null,
    currentPlan: null,
    selectedVariantIds: new Set(),
    draft: DEFAULT_PROMPT,
    status: "idle",
    error: ""
  };

  const actions = {
    async refresh() {
      state.error = "";
      state.status = "loading";
      render();
      try {
        const auth = await getCurrentAuth();
        state.auth = auth.user || null;
        if (!state.auth) {
          state.sessions = [];
          state.currentSession = null;
          state.currentPlan = null;
          state.status = "unauthenticated";
          render();
          return;
        }
        const result = await listAgentSessions({ limit: 30 });
        state.sessions = result.sessions || [];
        if (!state.currentSession && state.sessions[0]) {
          await actions.openSession(state.sessions[0].id, { silent: true });
        }
        state.status = "ready";
      } catch (error) {
        state.error = errorMessage(error);
        state.status = "error";
      }
      render();
    },

    async openSession(sessionId, { silent = false } = {}) {
      if (!silent) {
        state.status = "loading";
        state.error = "";
        render();
      }
      const result = await getAgentSession(sessionId);
      state.currentSession = result.session || null;
      state.currentPlan = latestPlanFromSession(state.currentSession);
      state.selectedVariantIds = new Set((state.currentPlan?.variants || []).map((item) => item.id));
      state.status = "ready";
    },

    async submitPlan() {
      const message = state.draft.trim();
      if (!message) return;
      state.status = "planning";
      state.error = "";
      render();
      try {
        let sessionId = state.currentSession?.id || "";
        if (!sessionId) {
          const created = await createAgentSession({
            title: titleFromMessage(message),
            summary: "Agent workspace MVP session",
            data: { source: "agent-workspace", confirmationRequired: true }
          });
          sessionId = created.session?.id || "";
        }
        const result = await createAgentPlan(sessionId, {
          message,
          variantCount: 4
        });
        state.currentSession = result.session || null;
        state.currentPlan = result.plan || latestPlanFromSession(state.currentSession);
        state.selectedVariantIds = new Set((state.currentPlan?.variants || []).map((item) => item.id));
        const sessions = await listAgentSessions({ limit: 30 });
        state.sessions = sessions.sessions || [];
        state.status = "ready";
      } catch (error) {
        state.error = errorMessage(error);
        state.status = "error";
      }
      render();
    },

    async confirmPlan() {
      if (!state.currentSession?.id || !state.currentPlan) return;
      state.status = "confirming";
      state.error = "";
      render();
      try {
        const selectedVariantIds = [...state.selectedVariantIds];
        const result = await confirmAgentPlan(state.currentSession.id, {
          plan: state.currentPlan,
          selectedVariantIds,
          note: "Agent workspace MVP confirmation. Batch generation is intentionally deferred."
        });
        state.currentSession = result.session || state.currentSession;
        state.currentPlan = latestPlanFromSession(state.currentSession) || state.currentPlan;
        state.status = "confirmed";
      } catch (error) {
        state.error = errorMessage(error);
        state.status = "error";
      }
      render();
    }
  };

  function render() {
    root.innerHTML = renderShell(state);
    bindEvents();
  }

  function bindEvents() {
    root.querySelector("[data-agent-refresh]")?.addEventListener("click", () => actions.refresh());
    root.querySelector("[data-agent-new]")?.addEventListener("click", () => {
      state.currentSession = null;
      state.currentPlan = null;
      state.selectedVariantIds = new Set();
      state.draft = DEFAULT_PROMPT;
      render();
      root.querySelector("[data-agent-draft]")?.focus();
    });
    root.querySelector("[data-agent-submit]")?.addEventListener("click", () => actions.submitPlan());
    root.querySelector("[data-agent-confirm]")?.addEventListener("click", () => actions.confirmPlan());
    root.querySelector("[data-agent-draft]")?.addEventListener("input", (event) => {
      state.draft = event.currentTarget.value;
    });
    root.querySelectorAll("[data-agent-session-id]").forEach((button) => {
      button.addEventListener("click", () => actions.openSession(button.dataset.agentSessionId).then(render).catch((error) => {
        state.error = errorMessage(error);
        state.status = "error";
        render();
      }));
    });
    root.querySelectorAll("[data-agent-variant-id]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) state.selectedVariantIds.add(input.dataset.agentVariantId);
        else state.selectedVariantIds.delete(input.dataset.agentVariantId);
      });
    });
  }

  render();
  actions.refresh();
}

function renderShell(state) {
  const busy = ["loading", "planning", "confirming"].includes(state.status);
  return `
    <main class="agent-shell" data-status="${escapeAttr(state.status)}">
      <header class="agent-hero">
        <nav class="agent-nav" aria-label="Agent workspace navigation">
          <a href="/">首页</a>
          <a href="/canvas-v2">Canvas v2</a>
          <button type="button" data-agent-refresh ${busy ? "disabled" : ""}>刷新</button>
        </nav>
        <div class="agent-hero-grid">
          <section>
            <span class="agent-kicker">Agent 创作工作台</span>
            <h1>把一句需求拆成可执行的生图路线</h1>
            <p>当前 MVP 只生成计划和确认记录：确认前不会扣积分，也不会创建真实 generation。批量生成会在后续任务接入。</p>
          </section>
          <aside class="agent-safety-card">
            <strong>安全边界</strong>
            <span>同源 API</span>
            <span>CSRF 写保护</span>
            <span>Provider Key 不进浏览器</span>
          </aside>
        </div>
      </header>
      ${state.auth ? renderWorkspace(state, busy) : renderLoginRequired(state)}
    </main>
  `;
}

function renderLoginRequired(state) {
  return `
    <section class="agent-login-card">
      <h2>请先登录</h2>
      <p>Agent 会话会保存到你的账户，登录后才能创建计划。</p>
      <a href="/?login=1">返回首页登录</a>
      ${state.error ? `<p class="agent-error">${escapeHtml(state.error)}</p>` : ""}
    </section>
  `;
}

function renderWorkspace(state, busy) {
  return `
    <section class="agent-workspace">
      <aside class="agent-session-panel">
        <div class="agent-panel-head">
          <div>
            <span>会话</span>
            <strong>${escapeHtml(state.auth?.name || state.auth?.email || "Agent user")}</strong>
          </div>
          <button type="button" data-agent-new ${busy ? "disabled" : ""}>新建</button>
        </div>
        <div class="agent-session-list">
          ${renderSessions(state)}
        </div>
      </aside>
      <section class="agent-thread-panel">
        <div class="agent-compose">
          <label for="agentDraft">自然语言需求</label>
          <textarea id="agentDraft" data-agent-draft rows="5" placeholder="描述你想要的一组图...">${escapeHtml(state.draft)}</textarea>
          <div class="agent-compose-actions">
            <span>${statusText(state.status)}</span>
            <button type="button" data-agent-submit ${busy ? "disabled" : ""}>生成 4 个方案</button>
          </div>
          ${state.error ? `<p class="agent-error">${escapeHtml(state.error)}</p>` : ""}
        </div>
        <div class="agent-thread">
          ${renderMessages(state.currentSession)}
        </div>
      </section>
      <aside class="agent-plan-panel">
        ${renderPlan(state, busy)}
      </aside>
    </section>
  `;
}

function renderSessions(state) {
  const items = state.sessions || [];
  if (!items.length) return `<p class="agent-empty">暂无 Agent 会话，先从一句需求开始。</p>`;
  return items.map((session) => `
    <button type="button" class="agent-session-card ${session.id === state.currentSession?.id ? "active" : ""}" data-agent-session-id="${escapeAttr(session.id)}">
      <strong>${escapeHtml(session.title || "Agent session")}</strong>
      <span>${escapeHtml(session.updatedAt || "")}</span>
    </button>
  `).join("");
}

function renderMessages(session) {
  const messages = session?.messages || [];
  if (!messages.length) return `<p class="agent-empty">计划生成后，用户需求和 Agent 回复会保存到这里。</p>`;
  return messages.map((message) => `
    <article class="agent-message ${escapeAttr(message.role)}">
      <span>${escapeHtml(roleLabel(message.role))}</span>
      <p>${escapeHtml(message.content)}</p>
    </article>
  `).join("");
}

function renderPlan(state, busy) {
  const plan = state.currentPlan;
  if (!plan) {
    return `
      <div class="agent-plan-empty">
        <span>Plan</span>
        <h2>等待生成方案</h2>
        <p>输入一句需求后，这里会显示 2 到 4 个结构化 prompt、尺寸、质量、风格和追问。</p>
      </div>
    `;
  }
  return `
    <div class="agent-plan-head">
      <div>
        <span>${escapeHtml(plan.format || "agent-plan")}</span>
        <h2>${escapeHtml(plan.intent || "Agent plan")}</h2>
      </div>
      <strong>${Number(plan.estimatedCredits || 0)} credits</strong>
    </div>
    <div class="agent-plan-notice">
      确认前不扣积分，不创建真实 generation。当前计划共 ${Number(plan.variantCount || plan.variants?.length || 0)} 个方案。
    </div>
    <div class="agent-variant-list">
      ${(plan.variants || []).map((variant) => renderVariant(variant, state)).join("")}
    </div>
    ${renderQuestions(plan)}
    <button type="button" class="agent-confirm" data-agent-confirm ${busy ? "disabled" : ""}>确认方案，等待批量生成</button>
  `;
}

function renderVariant(variant, state) {
  const checked = state.selectedVariantIds.has(variant.id) ? "checked" : "";
  return `
    <article class="agent-variant-card">
      <label>
        <input type="checkbox" data-agent-variant-id="${escapeAttr(variant.id)}" ${checked}>
        <span>${escapeHtml(variant.title)}</span>
      </label>
      <p>${escapeHtml(variant.prompt)}</p>
      <div class="agent-variant-meta">
        <span>${escapeHtml(variant.size)}</span>
        <span>${escapeHtml(variant.quality)}</span>
        <span>${variant.publicHint ? "适合公开" : "内部探索"}</span>
      </div>
    </article>
  `;
}

function renderQuestions(plan) {
  const questions = plan.questions || [];
  if (!questions.length) return "";
  return `
    <div class="agent-questions">
      <strong>必要追问</strong>
      ${questions.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function latestPlanFromSession(session) {
  const steps = session?.steps || [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index]?.kind === "plan" && steps[index]?.output?.format === "ai-image-studio.agent-plan.v1") {
      return steps[index].output;
    }
  }
  return null;
}

function titleFromMessage(message) {
  return message.replace(/[。！？.!?].*$/, "").slice(0, 42) || "Agent session";
}

function roleLabel(role) {
  return {
    user: "你",
    assistant: "Agent",
    system: "System",
    tool: "Tool",
    agent: "Agent"
  }[role] || role || "Message";
}

function statusText(status) {
  return {
    loading: "加载会话中...",
    planning: "正在生成结构化方案...",
    confirming: "正在保存确认记录...",
    confirmed: "方案已确认，尚未触发生成。",
    ready: "准备就绪",
    error: "出现错误",
    idle: "准备就绪"
  }[status] || status;
}

function errorMessage(error) {
  if (error instanceof ApiError) return error.payload?.error || error.message;
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
