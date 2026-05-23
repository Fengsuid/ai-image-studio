import {
  ApiError,
  confirmAgentPlan,
  createAgentPlan,
  createAgentSession,
  exportAgentCanvas,
  generateAgentBatch,
  getAgentSession,
  getCurrentAuth,
  listAgentSessions
} from "../adapters/ai-image-studio-api.a4f6d22e306f.js";
import {
  getAgentSessionSnapshot,
  putAgentSessionSnapshot
} from "../adapters/cache-db.f58f78e8ef16.js";

const DEFAULT_PROMPT = "我想做一组赛博茶饮品牌海报，适合小红书，统一青绿色并带一点宋代瓷器质感。";

export function createAgentWorkspaceApp(root) {
  const state = {
    auth: null,
    sessions: [],
    currentSession: null,
    currentPlan: null,
    lastBatchResult: null,
    lastCanvas: null,
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
        globalThis.ImageStudioCurrentUser = state.auth;
        if (!state.auth) {
          state.sessions = [];
          state.currentSession = null;
          state.currentPlan = null;
          state.lastBatchResult = null;
          state.lastCanvas = null;
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
      const cachedSession = await getAgentSessionSnapshot(sessionId);
      if (cachedSession && !silent) {
        applySessionSnapshot(cachedSession);
        render();
      }
      const result = await getAgentSession(sessionId);
      state.currentSession = result.session || null;
      applySessionSnapshot(state.currentSession);
      await putAgentSessionSnapshot(state.currentSession, { userId: state.auth?.id });
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
            summary: "Agent workspace session",
            data: { source: "agent-workspace", confirmationRequired: true, batchGenerationEnabled: true }
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
        state.lastBatchResult = null;
        state.lastCanvas = null;
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
      const selectedVariantIds = [...state.selectedVariantIds];
      if (selectedVariantIds.length < 2 || selectedVariantIds.length > 4) {
        state.error = "请选择 2 到 4 个方案后再批量生成。";
        render();
        return;
      }
      state.status = "confirming";
      state.error = "";
      render();
      try {
        const confirmed = await confirmAgentPlan(state.currentSession.id, {
          plan: state.currentPlan,
          selectedVariantIds,
          note: "Agent workspace confirmation before batch generation."
        });
        state.currentSession = confirmed.session || state.currentSession;
        state.currentPlan = latestPlanFromSession(state.currentSession) || state.currentPlan;
        state.status = "generating";
        render();

        const batch = await generateAgentBatch(state.currentSession.id, {
          plan: state.currentPlan,
          selectedVariantIds
        });
        state.currentSession = batch.session || state.currentSession;
        state.currentPlan = latestPlanFromSession(state.currentSession) || state.currentPlan;
        state.lastBatchResult = batch;
        state.status = "submitted";
      } catch (error) {
        state.error = errorMessage(error);
        state.status = "error";
      }
      render();
    },

    async exportCanvas() {
      if (!state.currentSession?.id || !state.currentPlan) return;
      const selectedVariantIds = [...state.selectedVariantIds];
      state.status = "exporting";
      state.error = "";
      render();
      try {
        const result = await exportAgentCanvas(state.currentSession.id, {
          plan: state.currentPlan,
          selectedVariantIds,
          title: `Agent Canvas - ${state.currentSession.title || state.currentPlan.intent || "session"}`
        });
        state.currentSession = result.session || state.currentSession;
        state.currentPlan = latestPlanFromSession(state.currentSession) || state.currentPlan;
        state.lastCanvas = result.canvas || null;
        state.status = "exported";
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

  function applySessionSnapshot(session) {
    state.currentSession = session || null;
    state.currentPlan = latestPlanFromSession(state.currentSession);
    state.selectedVariantIds = new Set((state.currentPlan?.variants || []).map((item) => item.id));
    state.lastBatchResult = latestBatchResultFromSession(state.currentSession);
    state.lastCanvas = latestCanvasFromSession(state.currentSession);
  }

  function bindEvents() {
    root.querySelector("[data-agent-refresh]")?.addEventListener("click", () => actions.refresh());
    root.querySelector("[data-agent-new]")?.addEventListener("click", () => {
      state.currentSession = null;
      state.currentPlan = null;
      state.lastBatchResult = null;
      state.lastCanvas = null;
      state.selectedVariantIds = new Set();
      state.draft = DEFAULT_PROMPT;
      render();
      root.querySelector("[data-agent-draft]")?.focus();
    });
    root.querySelector("[data-agent-submit]")?.addEventListener("click", () => actions.submitPlan());
    root.querySelector("[data-agent-confirm]")?.addEventListener("click", () => actions.confirmPlan());
    root.querySelector("[data-agent-export-canvas]")?.addEventListener("click", () => actions.exportCanvas());
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
        render();
      });
    });
  }

  render();
  actions.refresh();
}

function renderShell(state) {
  const busy = ["loading", "planning", "confirming", "generating", "exporting"].includes(state.status);
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
            <p>先生成 2 到 4 个结构化方案，再确认入队。每个方案都会创建独立 generation request，并可导出为私有 Canvas v2 项目。</p>
          </section>
          <aside class="agent-safety-card">
            <strong>安全边界</strong>
            <span>同源 API</span>
            <span>CSRF 写保护</span>
            <span>独立队列追踪</span>
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
  const selectedCount = state.selectedVariantIds.size;
  const invalidSelection = selectedCount < 2 || selectedCount > 4;
  return `
    <div class="agent-plan-head">
      <div>
        <span>${escapeHtml(plan.format || "agent-plan")}</span>
        <h2>${escapeHtml(plan.intent || "Agent plan")}</h2>
      </div>
      <strong>${Number(plan.estimatedCredits || 0)} credits</strong>
    </div>
    <div class="agent-plan-notice">
      当前选中 ${selectedCount} 个方案。点击批量生成后才会进入队列并按现有生成规则扣积分。
    </div>
    <div class="agent-variant-list">
      ${(plan.variants || []).map((variant) => renderVariant(variant, state)).join("")}
    </div>
    ${renderQuestions(plan)}
    ${renderGenerationResults(state)}
    ${renderCanvasResult(state)}
    <div class="agent-plan-actions">
      <button type="button" class="agent-confirm" data-agent-confirm ${busy || invalidSelection ? "disabled" : ""}>确认并开始批量生成</button>
      <button type="button" class="agent-secondary-action" data-agent-export-canvas ${busy ? "disabled" : ""}>导出到 Canvas v2</button>
    </div>
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

function renderGenerationResults(state) {
  const requests = generationRequestsFromSession(state.currentSession);
  if (!requests.length) return "";
  return `
    <section class="agent-result-panel">
      <strong>生成请求</strong>
      <div class="agent-result-list">
        ${requests.map((request) => renderGenerationRequest(request)).join("")}
      </div>
    </section>
  `;
}

function renderGenerationRequest(request) {
  const image = request.imageUrl
    ? `<img class="agent-result-image" src="${escapeAttr(request.imageUrl)}" alt="Agent generated result">`
    : `<span class="agent-result-placeholder">等待生成结果</span>`;
  return `
    <article class="agent-request-card" data-request-status="${escapeAttr(request.status || "pending")}">
      <div>
        <strong>${escapeHtml(request.title || request.variantTitle || request.variantId || "Agent request")}</strong>
        <span>${escapeHtml(request.id || request.requestId || "")}</span>
      </div>
      ${image}
      <div class="agent-request-meta">
        <span>${escapeHtml(request.status || "pending")}</span>
        <span>${escapeHtml(request.queueStatus || "")}</span>
        ${request.errorMessage ? `<span>${escapeHtml(request.errorMessage)}</span>` : ""}
      </div>
    </article>
  `;
}

function renderCanvasResult(state) {
  const canvas = state.lastCanvas || latestCanvasFromSession(state.currentSession);
  if (!canvas?.id) return "";
  const url = canvas.url || `/canvas-v2?id=${encodeURIComponent(canvas.id)}`;
  return `
    <section class="agent-canvas-result">
      <strong>Canvas v2 已就绪</strong>
      <span>${escapeHtml(canvas.title || canvas.id)}</span>
      <a href="${escapeAttr(url)}">打开私有 Canvas</a>
    </section>
  `;
}

function generationRequestsFromSession(session) {
  return (session?.steps || [])
    .filter((step) => step?.kind === "generate_batch")
    .map((step) => {
      const request = step.output?.request || {};
      return {
        id: step.requestId || request.id || "",
        requestId: step.requestId || request.id || "",
        variantId: step.input?.id || request.variantId || "",
        title: step.input?.title || request.title || "",
        status: step.output?.requestStatus || request.status || step.status || "pending",
        queueStatus: step.output?.queueStatus || request.queueStatus || "",
        imageUrl: step.output?.imageUrl || request.imageUrl || "",
        errorMessage: step.output?.errorMessage || request.errorMessage || ""
      };
    });
}

function latestBatchResultFromSession(session) {
  const requests = generationRequestsFromSession(session);
  return requests.length ? { requests } : null;
}

function latestCanvasFromSession(session) {
  const steps = session?.steps || [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step?.kind !== "canvas_route_suggestion") continue;
    const canvasId = step.output?.canvasId || step.output?.id || "";
    if (!canvasId) continue;
    return {
      id: canvasId,
      title: step.output?.title || `Canvas ${canvasId}`,
      nodeCount: Number(step.output?.nodeCount || 0),
      edgeCount: Number(step.output?.edgeCount || 0),
      url: `/canvas-v2?id=${encodeURIComponent(canvasId)}`
    };
  }
  return null;
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
    generating: "正在提交独立生成请求...",
    submitted: "批量生成已提交，刷新可查看最新状态。",
    exporting: "正在导出 Canvas v2 项目...",
    exported: "Canvas v2 项目已导出。",
    confirmed: "方案已确认。",
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
