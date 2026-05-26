(function initCanvasAssistant(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function requestBodyFromState(state = {}) {
    return {
      selectedNodeId: String(state.selectedNodeId || ""),
      selectedNodeIds: Array.isArray(state.selectedNodeIds)
        ? state.selectedNodeIds.map((id) => String(id || "")).filter(Boolean).slice(0, 12)
        : []
    };
  }

  function suggestionToNodeInput(suggestion = {}) {
    const type = suggestion.type === "prompt" ? "prompt" : "text";
    const title = String(suggestion.title || (type === "prompt" ? "Assistant prompt" : "Assistant note")).trim().slice(0, 120);
    const body = String(suggestion.prompt || suggestion.body || "").trim();
    const sourceNodeIds = Array.isArray(suggestion.sourceNodeIds)
      ? suggestion.sourceNodeIds.map((id) => String(id || "")).filter(Boolean).slice(0, 20)
      : [];
    if (type === "prompt") {
      return {
        type: "prompt",
        data: {
          title,
          prompt: body,
          body,
          source: "canvas-assistant",
          assistantSuggestionId: String(suggestion.id || ""),
          sourceNodeIds
        }
      };
    }
    return {
      type: "text",
      data: {
        title,
        body,
        source: "canvas-assistant",
        assistantSuggestionId: String(suggestion.id || ""),
        sourceNodeIds
      }
    };
  }

  function createInsertPayload(suggestion = {}) {
    const draft = suggestionToNodeInput(suggestion);
    if (draft.type === "prompt") {
      return {
        kind: "prompt",
        title: draft.data.title,
        prompt: draft.data.prompt,
        source: draft.data.source,
        tags: ["assistant"]
      };
    }
    return {
      kind: "text",
      title: draft.data.title,
      body: draft.data.body,
      source: draft.data.source
    };
  }

  function insertSuggestion(suggestion = {}, insertItem = root.insertItem) {
    if (typeof insertItem !== "function") return null;
    const payload = createInsertPayload(suggestion);
    insertItem(payload);
    return payload;
  }

  function createController({ container, request, saveCanvas, getContext, insertSuggestion: onInsert } = {}) {
    const state = {
      loading: false,
      error: "",
      message: "",
      assistant: null
    };

    if (container && container.dataset.assistantBound !== "1") {
      container.dataset.assistantBound = "1";
      container.addEventListener("click", (event) => {
        const refresh = event.target.closest?.("[data-canvas-assistant-run]");
        if (refresh) {
          ask();
          return;
        }
        const insert = event.target.closest?.("[data-assistant-insert]");
        if (insert) insertById(insert.dataset.assistantInsert || "");
      });
    }

    async function ask() {
      if (state.loading || typeof request !== "function") return;
      let context = typeof getContext === "function" ? getContext() : {};
      if (!context.projectId) {
        state.error = "Open a canvas before asking the assistant.";
        render();
        return;
      }
      state.loading = true;
      state.error = "";
      state.message = "";
      render();
      try {
        const saved = typeof saveCanvas === "function" ? await saveCanvas() : true;
        if (saved === false) {
          throw new Error("Save failed. Fix sync errors before asking the assistant.");
        }
        context = typeof getContext === "function" ? getContext() : context;
        if (!context.projectId || context.projectId === "new") {
          throw new Error("Save this canvas before asking the assistant.");
        }
        const result = await request(`/api/canvases/${encodeURIComponent(context.projectId)}/assistant`, {
          method: "POST",
          body: JSON.stringify(requestBodyFromState(context))
        });
        state.assistant = normalizeAssistant(result.assistant || result);
        state.message = "Suggestions refreshed.";
      } catch (error) {
        state.error = error?.message || "Assistant request failed.";
      } finally {
        state.loading = false;
        render();
      }
    }

    function insertById(id) {
      const suggestion = (state.assistant?.suggestions || []).find((item) => item.id === id);
      if (!suggestion || typeof onInsert !== "function") return;
      const node = onInsert(suggestion);
      state.message = node?.id ? `Inserted ${node.type} node.` : "Suggestion was not inserted.";
      render();
    }

    function render() {
      if (!container) return;
      const context = typeof getContext === "function" ? getContext() : {};
      const suggestions = Array.isArray(state.assistant?.suggestions) ? state.assistant.suggestions : [];
      const assistantContext = state.assistant?.context || {};
      const mode = assistantContext.mode || "select a node";
      const selectedCount = Number(context.selectedNodeIds?.length || assistantContext.counts?.selected || 0);
      const upstreamCount = Number(assistantContext.counts?.upstream || 0);
      container.innerHTML = `
        <div class="canvas-assistant-panel" data-status="${state.loading ? "loading" : state.error ? "error" : suggestions.length ? "ready" : "idle"}">
          <div class="canvas-assistant-head">
            <span><i class="ri-sparkling-2-line"></i> Assistant</span>
            <button type="button" data-canvas-assistant-run${state.loading || !context.projectId ? " disabled" : ""}>${state.loading ? "Thinking" : "Refresh"}</button>
          </div>
          <div class="canvas-assistant-context">
            <strong>${escapeHtml(mode)}</strong>
            <span>${selectedCount} selected / ${upstreamCount} upstream</span>
          </div>
          ${state.error ? `<div class="canvas-input-warning">${escapeHtml(state.error)}</div>` : ""}
          ${state.message ? `<div class="canvas-assistant-message">${escapeHtml(state.message)}</div>` : ""}
          ${state.loading ? `<div class="canvas-assistant-empty">Reading saved canvas context...</div>` : ""}
          ${suggestions.length ? suggestionList(suggestions) : emptyState(context)}
        </div>
      `;
    }

    function reset() {
      state.loading = false;
      state.error = "";
      state.message = "";
      state.assistant = null;
      render();
    }

    return {
      ask,
      render,
      refresh: ask,
      reset,
      state: () => ({ ...state })
    };
  }

  function normalizeAssistant(assistant = {}) {
    return {
      ...assistant,
      suggestions: Array.isArray(assistant.suggestions)
        ? assistant.suggestions.map((suggestion) => ({
            ...suggestion,
            id: String(suggestion.id || ""),
            title: String(suggestion.title || "Assistant suggestion"),
            type: suggestion.type === "prompt" ? "prompt" : "text",
            body: String(suggestion.body || suggestion.prompt || ""),
            actionLabel: String(suggestion.actionLabel || (suggestion.type === "prompt" ? "Insert Prompt node" : "Insert Text node"))
          }))
        : []
    };
  }

  function suggestionList(suggestions = []) {
    return `<div class="canvas-assistant-suggestions">${
      suggestions.map((item) => `
        <article class="canvas-assistant-suggestion">
          <strong>${escapeHtml(item.title || "Assistant suggestion")}</strong>
          <p>${escapeHtml(item.body || item.prompt || "")}</p>
          <button type="button" data-assistant-insert="${escapeHtml(item.id || "")}">
            <i class="${item.type === "prompt" ? "ri-chat-quote-line" : "ri-text"}"></i>
            <span>${escapeHtml(item.actionLabel || "Insert node")}</span>
          </button>
        </article>
      `).join("")
    }</div>`;
  }

  function emptyState(context = {}) {
    if (!context.projectId) return `<div class="canvas-assistant-empty">Open a canvas to get assistant suggestions.</div>`;
    return `<div class="canvas-assistant-empty">Refresh to rewrite prompts, suggest style direction, and create a generation plan.</div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  root.assistant = {
    requestBodyFromState,
    nodeDraftFromSuggestion: suggestionToNodeInput,
    suggestionToNodeInput,
    createInsertPayload,
    insertSuggestion,
    createController,
    normalizeAssistant
  };
})(window, typeof document === "undefined" ? null : document);
