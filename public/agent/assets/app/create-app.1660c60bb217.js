import {
  ApiError,
  confirmAgentPlan,
  createAgentPlan,
  createAgentSession,
  exportAgentCanvas,
  exportAgentSessionZip,
  generateAgentBatch,
  getAgentSession,
  getCurrentAuth,
  listAgentSessions,
  resumeAgentSession,
  retryAgentStepViaMessage
} from "../adapters/ai-image-studio-api.e5065af70ee6.js";
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
    exportSummary: "",
    resumeSummary: "",
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
    },

    async resumeSession() {
      if (!state.currentSession?.id) return;
      state.status = "resuming";
      state.error = "";
      state.resumeSummary = "";
      render();
      try {
        const result = await resumeAgentSession(state.currentSession.id);
        state.currentSession = result.session || state.currentSession;
        applySessionSnapshot(state.currentSession);
        state.resumeSummary = `恢复 ${result.resumedCount || 0} 个步骤，跳过 ${(result.skipped || []).length} 个。`;
        state.status = "ready";
      } catch (error) {
        state.error = errorMessage(error);
        state.status = "error";
      }
      render();
    },

    async retryStep(stepId) {
      if (!state.currentSession?.id || !stepId) return;
      state.status = "retrying";
      state.error = "";
      render();
      try {
        const result = await retryAgentStepViaMessage(state.currentSession.id, stepId, {
          content: `重试失败步骤 ${stepId}`
        });
        state.currentSession = result.session || state.currentSession;
        applySessionSnapshot(state.currentSession);
        state.resumeSummary = `已重新入队步骤 ${stepId}`;
        state.status = "ready";
      } catch (error) {
        state.error = errorMessage(error);
        state.status = "error";
      }
      render();
    },

    async exportSessionZip() {
      if (!state.currentSession?.id) return;
      state.status = "exporting";
      state.error = "";
      state.exportSummary = "";
      render();
      try {
        const zipped = await exportAgentSessionZip(state.currentSession.id);
        downloadBlob(zipped.blob, zipped.filename);
        state.exportSummary = `已下载 ${zipped.filename}`;
        state.status = "ready";
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
    root.querySelector("[data-agent-resume]")?.addEventListener("click", () => actions.resumeSession());
    root.querySelector("[data-agent-export-session]")?.addEventListener("click", () => actions.exportSessionZip());
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
    root.querySelectorAll("[data-agent-retry-step]").forEach((button) => {
      button.addEventListener("click", () => actions.retryStep(button.dataset.agentRetryStep));
    });
  }

  render();
  actions.refresh();
}

function renderShell(state) {
  const busy = ["loading", "planning", "confirming", "generating", "exporting", "resuming", "retrying"].includes(state.status);
  return `
    <main class="agent-shell" data-status="${escapeAttr(state.status)}">
      <header class="agent-topbar">
        <div class="agent-brand">
          <span class="agent-brand-mark" aria-hidden="true">AI</span>
          <span class="agent-brand-text">
            <strong>Agent 创作工作台</strong>
            <span>确认前不扣积分</span>
          </span>
        </div>
        <span class="agent-topbar-status primitive-pill ${state.status === "error" ? "primitive-pill--danger" : busy ? "primitive-pill--brand anim-pulse-soft" : "primitive-pill--success"}">${escapeHtml(statusChip(state.status))}</span>
        <nav class="agent-nav" aria-label="Agent workspace navigation">
          <a class="btn btn--ghost" href="/">首页</a>
          <a class="btn btn--ghost" href="/canvas-v2">画布</a>
          <button type="button" class="btn btn--ghost" data-agent-refresh ${busy ? "disabled" : ""}>刷新</button>
        </nav>
      </header>
      ${state.auth ? renderWorkspace(state, busy) : renderLoginRequired(state)}
    </main>
  `;
}

function renderThreadHead(state, busy) {
  const steps = state.currentSession?.steps || [];
  const doneCount = steps.filter((step) => ["succeeded", "completed", "done"].includes(step.status)).length;
  const failedCount = steps.filter((step) => ["failed", "cancelled", "expired"].includes(step.status)).length;
  const credits = Number(state.currentPlan?.estimatedCredits || 0);
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const chipClass = state.status === "error"
    ? "primitive-pill--danger"
    : busy ? "primitive-pill--brand" : "primitive-pill--success";
  return `
    <div class="agent-thread-head">
      <div class="agent-thread-head-main">
        <strong>${escapeHtml(state.currentSession?.title || "新的创作")}</strong>
        <span class="primitive-pill ${chipClass} ${busy ? "anim-pulse-soft" : ""}">${escapeHtml(statusChip(state.status))}</span>
      </div>
      ${steps.length ? `
        <div class="agent-thread-head-meta">
          <div class="agent-thread-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
            <i style="width:${progress}%"></i>
          </div>
          <span>步骤 ${doneCount}/${steps.length}</span>
          ${failedCount ? `<span data-tone="danger">失败 ${failedCount}</span>` : ""}
          ${credits ? `<span>预估 ${credits} 积分</span>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function renderLoginRequired(state) {
  return `
    <section class="agent-login-card">
      <h2>请先登录</h2>
      <p>Agent 会话会保存到你的账户，登录后才能创建计划。</p>
      <a class="btn btn--primary" href="/?login=1">返回首页登录</a>
      ${state.error ? `<p class="agent-error">${escapeHtml(state.error)}</p>` : ""}
    </section>
  `;
}

function renderWorkspace(state, busy) {
  return `
    <section class="agent-workspace">
      <aside class="agent-session-panel">
        <button type="button" class="btn btn--primary agent-new-btn" data-agent-new ${busy ? "disabled" : ""}>＋ 新建创作</button>
        <div class="agent-panel-head">
          <div>
            <span>会话</span>
            <strong>${escapeHtml(state.auth?.name || state.auth?.email || "Agent user")}</strong>
          </div>
          <span class="primitive-pill">${(state.sessions || []).length}</span>
        </div>
        <div class="agent-session-list">
          ${renderSessions(state)}
        </div>
      </aside>
      <section class="agent-thread-panel">
        ${renderThreadHead(state, busy)}
        <div class="agent-thread-scroll">
          <div class="agent-thread">
            ${renderMessages(state.currentSession)}
          </div>
          ${renderStepTimeline(state, busy)}
        </div>
        <div class="agent-compose">
          <textarea id="agentDraft" data-agent-draft rows="3" aria-label="自然语言需求" placeholder="描述你想要的一组图，例如：给我的咖啡品牌做一组早秋主题海报...">${escapeHtml(state.draft)}</textarea>
          <div class="agent-compose-actions">
            <span>${statusText(state.status)}</span>
            <button type="button" class="btn btn--primary" data-agent-submit ${busy ? "disabled" : ""}>生成方案</button>
          </div>
          ${state.error ? `<p class="agent-error">${escapeHtml(state.error)}</p>` : ""}
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
  return items.map((session, index) => `
    <button type="button" class="agent-session-card ${session.id === state.currentSession?.id ? "active" : ""}" data-agent-session-id="${escapeAttr(session.id)}">
      <span class="agent-badge agent-badge--${index % 3}" aria-hidden="true">${escapeHtml(sessionInitial(session.title))}</span>
      <span class="agent-session-card-body">
        <strong>${escapeHtml(session.title || "Agent session")}</strong>
        <span>${escapeHtml(session.updatedAt || "")}</span>
      </span>
    </button>
  `).join("");
}

function sessionInitial(title) {
  const clean = String(title || "").trim();
  return clean ? clean.slice(0, 1).toUpperCase() : "A";
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

function renderStepTimeline(state, busy) {
  const steps = state.currentSession?.steps || [];
  if (!steps.length) return "";
  return `
    <section class="agent-step-timeline" aria-label="Agent step timeline">
      <div class="agent-step-head">
        <strong>步骤时间线</strong>
        <span>${steps.length} steps</span>
      </div>
      <div class="agent-step-list">
        ${steps.map((step, index) => renderStepItem(step, index, busy)).join("")}
      </div>
    </section>
  `;
}

function renderStepItem(step, index, busy) {
  const status = step.status || step.output?.requestStatus || "pending";
  const imageUrl = step.output?.image_url || step.output?.imageUrl || "";
  const retryable = ["failed", "cancelled", "expired"].includes(status);
  const tone = stepTone(status);
  return `
    <article class="agent-step-item" data-agent-step-status="${escapeAttr(status)}" data-step-tone="${tone}">
      <div class="agent-step-no-badge ${tone === "brand" ? "anim-pulse-soft" : ""}" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
      <div class="agent-step-body">
        <div class="agent-step-title">
          <strong>${escapeHtml(step.kind || "step")}</strong>
          <span class="primitive-pill ${stepPillClass(tone)}">${escapeHtml(status)}</span>
        </div>
        <div class="agent-step-meta">
          ${step.requestId ? `<span>request ${escapeHtml(step.requestId)}</span>` : ""}
          ${step.generationId ? `<span>generation ${escapeHtml(step.generationId)}</span>` : ""}
          ${imageUrl ? `<a href="${escapeAttr(imageUrl)}" target="_blank" rel="noreferrer">step[${index + 1}].output.image_url</a>` : ""}
        </div>
        ${step.output?.errorMessage ? `<p class="agent-step-error">${escapeHtml(step.output.errorMessage)}</p>` : ""}
      </div>
      ${retryable ? `<button type="button" class="btn btn--danger" data-agent-retry-step="${escapeAttr(step.id)}" ${busy ? "disabled" : ""}>重试</button>` : ""}
    </article>
  `;
}

function stepTone(status) {
  if (["succeeded", "completed", "done"].includes(status)) return "success";
  if (["failed", "cancelled", "expired"].includes(status)) return "danger";
  if (["running", "queued", "processing", "generating", "pending"].includes(status)) return "brand";
  return "muted";
}

function stepPillClass(tone) {
  return {
    success: "primitive-pill--success",
    danger: "primitive-pill--danger",
    brand: "primitive-pill--brand",
    muted: ""
  }[tone] || "";
}

function renderPlan(state, busy) {
  const plan = state.currentPlan;
  if (!plan) {
    return `
      <div class="agent-plan-empty">
        <span>Plan</span>
        <h2>等待生成方案</h2>
        <p>输入一句需求后，这里会显示 2 到 4 个结构化 prompt、尺寸、质量、风格和追问。</p>
        ${renderSessionActions(state, busy)}
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
        <span class="primitive-pill ${plan.source === "model-enriched-agent-plan" ? "primitive-pill--brand" : ""}">${plan.source === "model-enriched-agent-plan" ? "AI 增强方案" : "规则方案"}</span>
      </div>
      <strong class="agent-credit-pill">${Number(plan.estimatedCredits || 0)} credits</strong>
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
    ${renderSessionActions(state, busy)}
    <div class="agent-plan-actions">
      <button type="button" class="btn btn--primary agent-confirm" data-agent-confirm ${busy || invalidSelection ? "disabled" : ""}>确认并开始批量生成</button>
      <button type="button" class="btn btn--secondary agent-secondary-action" data-agent-export-canvas ${busy ? "disabled" : ""}>导出到 Canvas v2</button>
    </div>
  `;
}

function renderSessionActions(state, busy) {
  if (!state.currentSession?.id) return "";
  return `
    <div class="agent-session-actions">
      <button type="button" class="btn btn--secondary agent-secondary-action" data-agent-resume ${busy ? "disabled" : ""}>恢复未完成步骤</button>
      <button type="button" class="btn btn--secondary agent-secondary-action" data-agent-export-session ${busy ? "disabled" : ""}>下载 Session ZIP</button>
      ${state.resumeSummary ? `<span>${escapeHtml(state.resumeSummary)}</span>` : ""}
      ${state.exportSummary ? `<span>${escapeHtml(state.exportSummary)}</span>` : ""}
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
        <span class="primitive-pill">${escapeHtml(variant.size)}</span>
        <span class="primitive-pill">${escapeHtml(variant.quality)}</span>
        <span class="primitive-pill ${variant.publicHint ? "primitive-pill--success" : "primitive-pill--warn"}">${variant.publicHint ? "适合公开" : "内部探索"}</span>
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
        <span class="primitive-pill ${stepPillClass(stepTone(request.status || "pending"))}">${escapeHtml(request.status || "pending")}</span>
        ${request.queueStatus ? `<span class="primitive-pill">${escapeHtml(request.queueStatus)}</span>` : ""}
        ${request.errorMessage ? `<span class="primitive-pill primitive-pill--danger">${escapeHtml(request.errorMessage)}</span>` : ""}
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
      <a class="btn btn--secondary" href="${escapeAttr(url)}">打开私有 Canvas</a>
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
        imageUrl: step.output?.image_url || step.output?.imageUrl || request.image_url || request.imageUrl || "",
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

function statusChip(status) {
  return {
    loading: "加载中",
    planning: "规划中",
    confirming: "确认中",
    generating: "生成中",
    submitted: "已提交",
    exporting: "导出中",
    resuming: "恢复中",
    retrying: "重试中",
    exported: "已导出",
    confirmed: "已确认",
    ready: "就绪",
    error: "错误",
    idle: "就绪",
    unauthenticated: "未登录"
  }[status] || status;
}

function statusText(status) {
  return {
    loading: "加载会话中...",
    planning: "正在生成结构化方案...",
    confirming: "正在保存确认记录...",
    generating: "正在提交独立生成请求...",
    submitted: "批量生成已提交，刷新可查看最新状态。",
    exporting: "正在导出 Canvas v2 项目...",
    resuming: "正在恢复未完成步骤...",
    retrying: "正在重试单个步骤...",
    exported: "Canvas v2 项目已导出。",
    confirmed: "方案已确认。",
    ready: "准备就绪",
    error: "出现错误",
    idle: "准备就绪"
  }[status] || status;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "agent-session.zip";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
