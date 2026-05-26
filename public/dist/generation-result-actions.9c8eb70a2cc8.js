(function(s){"use strict";function e({item:i,text:n,escapeHtml:r,state:a={}}){if(!i||!i.images?.[0])return"";const t=!!(i.sourceImageData||i.sourceImageUrl),d=String(a.settings?.canvasEntryMode||"v2").trim().toLowerCase()!=="hidden",c=i.isPublic?n("editPublicTags"):n("publishImage"),b=i.isPublic?"ri-price-tag-3-line":"ri-gallery-upload-line";return`
      <div class="message-actions result-action-bar" data-result-actions>
        <button type="button" class="result-action-primary" data-retry="${r(i.prompt)}"><i class="ri-refresh-line"></i>${n("retry")}</button>
        <a class="result-action-primary" href="${r(i.images[0])}" download="${r(i.id)}.png"><i class="ri-download-line"></i>${n("download")}</a>
        <details class="message-more">
          <summary><i class="ri-more-2-line"></i><span>${n("more")}</span></summary>
          <div class="message-more-menu">
            ${d?`<button type="button" data-add-generation-canvas="${r(i.id)}"><i class="ri-node-tree"></i>${n("addToCanvas")}</button>`:""}
            <button type="button" data-edit="${r(i.prompt)}"><i class="ri-edit-line"></i>${n("editPrompt")}</button>
            <button type="button" data-edit-image="${r(i.id)}"><i class="ri-image-edit-line"></i>${n("imageToImageShort")}</button>
            <button type="button" data-copy-history-prompt="${r(i.id)}"><i class="ri-file-copy-line"></i>${n("copy")}</button>
            <button type="button" data-publish-image="${r(i.id)}"><i class="${b}"></i>${c}</button>
            ${t&&!i.publishOriginal?`<button type="button" data-publish-original="${r(i.id)}"><i class="ri-image-add-line"></i>${n("publishWithOriginal")}</button>`:""}
            ${i.sourceImageUrl&&i.publishOriginal?`<a href="${r(i.sourceImageUrl)}" target="_blank" rel="noreferrer"><i class="ri-image-line"></i>${n("sourceImage")}</a>`:""}
          </div>
        </details>
      </div>
    `}function o({item:i,text:n,escapeHtml:r}){return`
      <div class="message-actions">
        <button type="button" data-retry="${r(i.prompt)}"><i class="ri-refresh-line"></i>${n("retry")}</button>
        <button type="button" data-edit="${r(i.prompt)}"><i class="ri-edit-line"></i>${n("editPrompt")}</button>
      </div>
    `}function u({item:i,state:n,text:r,escapeHtml:a,generatingActionText:t}){return`
      <div class="message-actions generating-actions">
        <span data-generation-progress>${t(i)}</span>
        <button type="button" data-generate-cancel="${a(i.requestId||n.currentGenerationRequestId||"")}"><i class="ri-stop-circle-line"></i>${r("editorCancel")}</button>
      </div>
    `}function l(i){const n=i.item||{};return n.status==="done"?e(i):n.status==="error"?o(i):n.status==="generating"?u(i):""}s.ImageStudioGenerationResultActions={render:l}})(window);
