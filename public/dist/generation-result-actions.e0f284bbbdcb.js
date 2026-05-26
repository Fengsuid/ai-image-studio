(function initGenerationResultActions(global) {
  "use strict";

  function renderDone({ item, text, escapeHtml, state = {} }) {
    if (!item || !item.images?.[0]) return "";
    const canPublishOriginal = Boolean(item.sourceImageData || item.sourceImageUrl);
    const canShowCanvasEntry = String(state.settings?.canvasEntryMode || "v2").trim().toLowerCase() !== "hidden";
    const publishLabel = item.isPublic ? text("editPublicTags") : text("publishImage");
    const publishIcon = item.isPublic ? "ri-price-tag-3-line" : "ri-gallery-upload-line";
    return `
      <div class="message-actions result-action-bar" data-result-actions>
        <button type="button" class="result-action-primary" data-retry="${escapeHtml(item.prompt)}"><i class="ri-refresh-line"></i>${text("retry")}</button>
        <a class="result-action-primary" href="${escapeHtml(item.images[0])}" download="${escapeHtml(item.id)}.png"><i class="ri-download-line"></i>${text("download")}</a>
        <details class="message-more">
          <summary><i class="ri-more-2-line"></i><span>${text("more")}</span></summary>
          <div class="message-more-menu">
            ${canShowCanvasEntry ? `<button type="button" data-add-generation-canvas="${escapeHtml(item.id)}"><i class="ri-node-tree"></i>${text("addToCanvas")}</button>` : ""}
            <button type="button" data-edit="${escapeHtml(item.prompt)}"><i class="ri-edit-line"></i>${text("editPrompt")}</button>
            <button type="button" data-edit-image="${escapeHtml(item.id)}"><i class="ri-image-edit-line"></i>${text("imageToImageShort")}</button>
            <button type="button" data-copy-history-prompt="${escapeHtml(item.id)}"><i class="ri-file-copy-line"></i>${text("copy")}</button>
            <button type="button" data-publish-image="${escapeHtml(item.id)}"><i class="${publishIcon}"></i>${publishLabel}</button>
            ${canPublishOriginal && !item.publishOriginal ? `<button type="button" data-publish-original="${escapeHtml(item.id)}"><i class="ri-image-add-line"></i>${text("publishWithOriginal")}</button>` : ""}
            ${item.sourceImageUrl && item.publishOriginal ? `<a href="${escapeHtml(item.sourceImageUrl)}" target="_blank" rel="noreferrer"><i class="ri-image-line"></i>${text("sourceImage")}</a>` : ""}
          </div>
        </details>
      </div>
    `;
  }

  function renderError({ item, text, escapeHtml }) {
    return `
      <div class="message-actions">
        <button type="button" data-retry="${escapeHtml(item.prompt)}"><i class="ri-refresh-line"></i>${text("retry")}</button>
        <button type="button" data-edit="${escapeHtml(item.prompt)}"><i class="ri-edit-line"></i>${text("editPrompt")}</button>
      </div>
    `;
  }

  function renderGenerating({ item, state, text, escapeHtml, generatingActionText }) {
    return `
      <div class="message-actions generating-actions">
        <span data-generation-progress>${generatingActionText(item)}</span>
        <button type="button" data-generate-cancel="${escapeHtml(item.requestId || state.currentGenerationRequestId || "")}"><i class="ri-stop-circle-line"></i>${text("editorCancel")}</button>
      </div>
    `;
  }

  function render(options) {
    const item = options.item || {};
    if (item.status === "done") return renderDone(options);
    if (item.status === "error") return renderError(options);
    if (item.status === "generating") return renderGenerating(options);
    return "";
  }

  global.ImageStudioGenerationResultActions = { render };
})(window);
