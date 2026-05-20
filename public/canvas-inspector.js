(function initCanvasInspector(global, document) {
  "use strict";

  const root = global.ImageStudioCanvas || (global.ImageStudioCanvas = {});

  function render({
    state,
    selectedNodes,
    selectedNode,
    labelFor,
    escapeHtml
  }) {
    const body = document.querySelector("#canvasInspectorBody");
    if (!body) return;
    const selected = selectedNodes();
    if (selected.length > 1) {
      body.innerHTML = `
        <div class="canvas-selection-summary">
          <strong>${selected.length} nodes selected</strong>
          <span>Drag any selected node to move the group. Shift-drag on empty canvas to box select.</span>
        </div>
        <div class="canvas-inspector-actions">
          <button type="button" data-node-action="group"><i class="ri-folder-add-line"></i><span>Group</span></button>
          <button type="button" data-node-action="duplicate"><i class="ri-file-copy-line"></i><span>Copy</span></button>
          <button type="button" data-node-action="delete"><i class="ri-delete-bin-line"></i><span>Delete</span></button>
        </div>
      `;
      return;
    }
    const node = selectedNode();
    if (!node) {
      body.innerHTML = `<p>Select a node to edit parameters.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="canvas-inspector-actions">
        ${["config", "output"].includes(node.type) ? `<button type="button" data-node-action="run"><i class="ri-play-line"></i><span>Run</span></button>` : ""}
        ${node.type === "output" && (node.data.generationIds || []).length ? `<button type="button" data-node-action="publish"><i class="ri-gallery-upload-line"></i><span>Publish</span></button>` : ""}
        <button type="button" data-node-action="duplicate"><i class="ri-file-copy-line"></i><span>Copy</span></button>
        <button type="button" data-node-action="lock"><i class="${node.locked ? "ri-lock-unlock-line" : "ri-lock-line"}"></i><span>${node.locked ? "Unlock" : "Lock"}</span></button>
        <button type="button" data-node-action="link"><i class="ri-link"></i><span>Start link</span></button>
        <button type="button" data-node-action="delete"><i class="ri-delete-bin-line"></i><span>Delete</span></button>
      </div>
      ${connectionPanel({ state, node, labelFor, escapeHtml })}
      ${field("title", "Title", node.data.title || "", escapeHtml)}
      ${nodeFields(node, escapeHtml)}
    `;
  }

  function connectionPanel({ state, node, labelFor, escapeHtml }) {
    const incoming = state.edges.filter((edge) => edge.targetId === node.id);
    const outgoing = state.edges.filter((edge) => edge.sourceId === node.id);
    const summary = node.type === "config" ? root.workflows.configInputSummary(state.nodes, state.edges, node.id) : null;
    const conflict = summary?.hasConflict
      ? `<div class="canvas-input-warning">Input conflict: keep one prompt and one image upstream.</div>`
      : "";
    const upstream = summary
      ? `<div class="canvas-upstream"><strong>${summary.mode}</strong><span>${summary.prompts.length} prompt · ${summary.images.length} image</span></div>`
      : "";
    const error = state.edgeError ? `<div class="canvas-input-warning">${escapeHtml(state.edgeError)}</div>` : "";
    const pending = state.pendingEdgeFrom ? `<div class="canvas-linking">Linking from ${escapeHtml(labelFor(state.pendingEdgeFrom))}</div>` : "";
    const rows = [...incoming, ...outgoing].map((edge) => {
      const other = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
      return `<button type="button" data-edge-delete="${edge.id}"><i class="ri-close-line"></i><span>${escapeHtml(edge.sourceId === node.id ? "to" : "from")} ${escapeHtml(labelFor(other))}</span></button>`;
    }).join("");
    return `${error}${pending}${upstream}${conflict}${rows ? `<div class="canvas-edge-list">${rows}</div>` : ""}`;
  }

  function nodeFields(node, escapeHtml) {
    if (node.type === "image") return field("imageUrl", "Image URL", node.data.imageUrl || "", escapeHtml) + area("body", "Caption", node.data.body || "", escapeHtml);
    if (node.type === "text") return area("body", "Text", node.data.body || "", escapeHtml);
    if (node.type === "prompt") return area("prompt", "Prompt", node.data.prompt || node.data.body || "", escapeHtml);
    if (node.type === "output") return select("status", "Status", node.data.status || "idle", ["idle", "loading", "success", "error"]) + area("body", "Message", node.data.body || "", escapeHtml);
    if (node.type === "group") return area("body", "Description", node.data.body || "", escapeHtml);
    return field("model", "Model", node.data.model || "GPT-IMAGE-2", escapeHtml)
      + select("size", "Size", node.data.size || "1024x1024", ["1024x1024", "1536x1024", "1024x1536"])
      + select("quality", "Quality", node.data.quality || "medium", ["low", "medium", "high"])
      + select("candidateCount", "Candidates", String(node.data.candidateCount || 1), ["1", "2", "3", "4"]);
  }

  function field(name, label, value, escapeHtml) {
    return `<label class="canvas-field"><span>${label}</span><input data-node-field="${name}" value="${escapeHtml(value)}"></label>`;
  }

  function area(name, label, value, escapeHtml) {
    return `<label class="canvas-field"><span>${label}</span><textarea data-node-field="${name}">${escapeHtml(value)}</textarea></label>`;
  }

  function select(name, label, value, options) {
    return `<label class="canvas-field"><span>${label}</span><select data-node-field="${name}">${
      options.map((option) => `<option value="${option}"${String(value) === option ? " selected" : ""}>${option}</option>`).join("")
    }</select></label>`;
  }

  root.inspector = { render };
})(window, document);
