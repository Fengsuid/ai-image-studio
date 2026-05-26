(function(v){"use strict";const S={zh:{noCover:"无封面",noCoverBody:"使用提示词摘要作为封面",remote:"远程来源",local:"内置来源",square:"广场作品",promptDb:"Prompt DB",heat:"热度",audit:"AI 审核中",duplicate:"重复候选",hidden:"已隐藏",loadingTitle:"正在整理提示词库",loadingBody:"正在同步分类、远程来源和点赞状态。",emptyTitle:"没有找到匹配的提示词",emptyBody:"换一个搜索词、分类或排序方式再试。",errorTitle:"提示词库加载失败",errorBody:"远程来源暂不可用，已保留可用的本地内容。",offlineTitle:"当前处于离线状态",offlineBody:"网络恢复后会继续同步远程提示词来源。",permissionTitle:"没有权限读取完整提示词库",permissionBody:"请登录或切换有权限的账号后重试。",fallbackTitle:"远程来源未完全同步",fallbackBody:"当前展示缓存或内置提示词，搜索、分类和使用功能保持可用。",likePending:"正在更新点赞",likeFailed:"点赞失败"},en:{noCover:"No cover",noCoverBody:"Using the prompt summary as its cover",remote:"Remote source",local:"Built-in source",square:"Gallery work",promptDb:"Prompt DB",heat:"Heat",audit:"AI audit",duplicate:"Duplicate candidate",hidden:"Hidden",loadingTitle:"Preparing prompt library",loadingBody:"Syncing categories, remote sources, and like states.",emptyTitle:"No matching prompts",emptyBody:"Try another search term, category, or sort.",errorTitle:"Prompt library failed to load",errorBody:"The remote source is unavailable; local content remains available.",offlineTitle:"You are offline",offlineBody:"Remote prompt sources will sync again when the network returns.",permissionTitle:"No permission for the full prompt library",permissionBody:"Sign in or switch to an account with access.",fallbackTitle:"Remote source is not fully synced",fallbackBody:"Cached or built-in prompts are shown; search, filters, and use still work.",likePending:"Updating like",likeFailed:"Like failed"}};function l(t={},e){const r=t.state?.lang==="en"||t.lang==="en"?"en":"zh";return S[r]?.[e]||S.en[e]||e}function a(t={},e=""){return t.escapeHtml?t.escapeHtml(e):String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function h(t={},e="",r=120){return t.truncate?t.truncate(e,r):String(e||"").slice(0,r)}function C(t={}){return Array.isArray(t.tags)?t.tags:[t.tag].filter(Boolean)}const P=[["product","ri-shopping-bag-3-line",["高端产品图","Premium Product Shot"],["一张高端无线充电器产品摄影，哑光黑色机身，柔和棚拍灯光，浅灰背景，精致阴影，商业广告质感，超清细节","A premium product photo of a matte black wireless charger, soft studio lighting, light gray background, refined shadows, commercial advertising style, ultra-detailed"],"linear-gradient(135deg, #0f172a, #64748b)"],["poster","ri-layout-4-line",["活动海报","Event Poster"],["未来感 AI 创作活动海报，干净排版，强烈视觉焦点，黑白主调点缀电光蓝，高级平面设计，适合社交媒体","A futuristic AI creativity event poster, clean typography, strong focal point, black and white palette with electric blue accents, premium graphic design"],"linear-gradient(135deg, #111827, #2563eb)"],["photo","ri-camera-lens-line",["生活方式摄影","Lifestyle Photo"],["清晨咖啡桌上的极简工作场景，笔记本电脑、手机和一束花，自然窗光，温暖但不过度复古，真实摄影质感","A minimal morning workspace on a coffee table with laptop, phone, and flowers, natural window light, warm but modern, realistic photography"],"linear-gradient(135deg, #0f766e, #f59e0b)"],["character","ri-user-smile-line",["角色设定","Character Design"],["一位未来城市中的年轻发明家角色设定，全身像，功能性服装，背包设备，清晰轮廓，电影概念艺术风格","A young inventor in a future city, full-body character design, functional clothing, backpack device, clean silhouette, cinematic concept art"],"linear-gradient(135deg, #7c3aed, #ec4899)"],["ui","ri-window-line",["应用界面概念","App Interface Concept"],["一款 AI 图片生成应用的移动端界面概念，白色玻璃拟态卡片，底部输入框，图片瀑布流，现代 iOS 风格，高级 UI 截图","A mobile interface concept for an AI image generation app, white glass cards, bottom composer, image feed, modern iOS style, polished UI screenshot"],"linear-gradient(135deg, #38bdf8, #6366f1)"],["illustration","ri-brush-line",["童书插画","Storybook Illustration"],["温柔的童书插画，一只纸船漂在星光河流上，柔软笔触，梦幻但清晰，留白充足，适合封面","A gentle storybook illustration of a paper boat floating on a starlit river, soft brushwork, dreamy but clear, generous negative space, cover art"],"linear-gradient(135deg, #8b5cf6, #fbbf24)"]];function U(t={}){const e=t.state?.lang==="en"||t.lang==="en"?1:0;return P.map(([r,i,n,s,d],o)=>({id:o+1,tag:r,tags:[r],icon:i,title:n[e],prompt:s[e],colors:d}))}function B(t=""){if(!t)return"";try{return new URL(t).hostname.replace(/^www\./,"")}catch{return String(t||"").replace(/^https?:\/\//,"").split("/")[0]}}function T(t={},e={}){if(t.status==="hidden")return{key:"hidden",icon:"ri-eye-off-line",label:l(e,"hidden")};const r=t.auditStatus||t.audit?.status||t.reviewStatus||"";if(["review","pending","blocked","needs_review"].includes(String(r)))return{key:"audit",icon:"ri-shield-check-line",label:l(e,"audit")};const i=t.duplicateStatus||t.duplicateReview||t.aiReview?.decision||"";return["duplicate","pending","needs_review","manual_review"].includes(String(i))?{key:"duplicate",icon:"ri-git-merge-line",label:l(e,"duplicate")}:null}function L(t={},e={}){const r=e.state||{},i=t.prompt||"",n=t.title||"",s=e.promptImageDisplayUrl?.(t)||"",d=t.kind==="square"?e.galleryTagViewModelForItem?.(t,t.publicTags||t.tags||[])||{publicTags:t.publicTags||t.tags||[]}:{publicTags:C(t)},o=(d.publicTags||[]).slice(0,4).map($=>{const f=e.tagInfo?.($)||{label:$,hue:210};return`<span class="tag-chip" style="--tag-hue:${a(e,f.hue)}">${a(e,f.label||$)}</span>`}).join(""),p=e.promptCoverFallbackSrc?.(t)||"",u=e.promptCardImageUrl?.(t,s)||s,b=t.kind!=="square"?' data-remove-on-image-error="1"':"",m=!!s,k=m?`<img src="${a(e,u)}" ${e.imageFallbackImgAttrs?.(p)||""}${b} loading="lazy" decoding="async" fetchpriority="low" alt="${a(e,n)}">`:v.ImageStudioPromptCoverFallback?.render?.(t,{escapeHtml:$=>a(e,$),truncate:($,f)=>h(e,$,f)})||`
        <div class="prompt-library-no-cover">
          <i class="${a(e,t.icon||"ri-quill-pen-line")}"></i>
          <strong>${a(e,l(e,"noCover"))}</strong>
          <span>${a(e,l(e,"noCoverBody"))}</span>
        </div>
      `,g=e.isCanvasRouteItem?.(t)?`<b class="canvas-route-badge"><i class="ri-node-tree"></i>${a(e,r.lang==="zh"?"画布线路":"Canvas route")}</b>`:"",c=t.kind==="square"?e.displayUserName?.(t)||t.author||l(e,"square"):t.sourceRepo||t.source||t.author||l(e,"promptDb"),q=t.sourceUrl||t.githubUrl||"",w=t.kind==="square"?l(e,"square"):t.sourceRepo||t.remoteId||q?l(e,"remote"):l(e,"local"),E=t.kind==="square"?`<em class="square-badge prompt-card-source" title="${a(e,c)}"><i class="ri-user-line"></i>${a(e,c)}</em><b>${a(e,e.text?.(d.kindBadge?.textKey||(e.isImageToImageItem?.(t)?"imageToImage":"textToImage"))||"")}</b>${g}`:`<em class="prompt-card-source" title="${a(e,[w,c,B(q)].filter(Boolean).join(" · "))}"><i class="ri-links-line"></i>${a(e,c)}</em>`,y=T(t,e),j=y?`<span class="prompt-status-badge ${a(e,y.key)}"><i class="${a(e,y.icon)}"></i>${a(e,y.label)}</span>`:"",_=t.kind==="square"?` data-open-square="${a(e,t.id)}" role="button" tabindex="0"`:` data-open-prompt="${a(e,t.id)}" role="button" tabindex="0"`,M=r.user?.role==="admin"&&t.kind!=="square"?`
        <button type="button" data-edit-prompt="${a(e,t.id)}" class="prompt-admin-edit"><i class="ri-pencil-line"></i>${a(e,e.text?.("promptEdit")||"Edit")}</button>
        <button type="button" data-delete-prompt="${a(e,t.id)}" class="prompt-admin-delete"><i class="ri-delete-bin-line"></i>${a(e,e.text?.("promptDelete")||"Hide")}</button>
      `:"",O=t.kind==="square"?`<button type="button" data-view-square="${a(e,t.id)}"><i class="ri-eye-line"></i>${a(e,e.text?.("viewDetail")||"Details")}</button>`:`<button type="button" data-view-prompt="${a(e,t.id)}"><i class="ri-eye-line"></i>${a(e,e.text?.("viewDetail")||"Details")}</button>`,K=t.kind==="square"?`
      <div class="prompt-engagement">
        <button type="button" data-like-gallery="${a(e,t.generationId||t.id)}" class="${t.likedByCurrentUser?"liked":""}" aria-label="${a(e,e.text?.("likeImage")||"Like")}">
          <i class="${t.likedByCurrentUser?"ri-heart-fill":"ri-heart-line"}"></i>${Number(t.likeCount||0)}
        </button>
      </div>
    `:`
      <div class="prompt-engagement">
        <button type="button" data-like-prompt="${a(e,t.id)}" class="${t.likedByCurrentUser?"liked":""}" aria-label="${a(e,e.text?.("likeImage")||"Like")}">
          <i class="${t.likedByCurrentUser?"ri-heart-fill":"ri-heart-line"}"></i>${Number(t.likeCount||0)}
        </button>
        <span title="${a(e,l(e,"heat"))}"><i class="ri-fire-line"></i>${Number(t.heatScore||0).toFixed(0)}</span>
      </div>
    `;return`
      <article class="${["prompt-card","prompt-library-card",m?"prompt-card-has-cover":"prompt-card-no-cover",t.kind==="square"?"prompt-card-square-source":"prompt-card-db-source",t.status==="hidden"?"prompt-hidden":"",y?`prompt-card-status-${y.key}`:""].filter(Boolean).join(" ")}" data-prompt-source="${a(e,w)}" data-prompt-status="${a(e,y?.key||"active")}" style="--art-bg:${t.colors||"linear-gradient(135deg,#64748b,#cbd5e1)"}">
        <div class="card-art card-art-clickable" ${e.imageFallbackContainerAttrs?.()||""}${_}>${k}${E}${j}</div>
        <div class="prompt-card-body">
          <div class="prompt-card-heading">
            <h3>${a(e,n)}</h3>
            ${K}
          </div>
          <div class="prompt-tags">${o||`<span class="tag-chip muted">${a(e,w)}</span>`}</div>
          <p>${a(e,i)}</p>
        </div>
        <div class="card-actions">
          <button type="button" data-copy-prompt="${a(e,t.id)}"><i class="ri-file-copy-line"></i>${a(e,e.text?.("copy")||"Copy")}</button>
          ${O}
          <button class="use-button" type="button" data-use-prompt="${a(e,t.id)}">${a(e,e.text?.("use")||"Use")} <i class="ri-arrow-right-line"></i></button>
          ${M}
        </div>
      </article>
    `}function F({sortOptions:t=[],activeSort:e="hot",ctx:r={}}={}){return`
      <div class="library-sort prompt-library-sort" role="tablist" aria-label="${a(r,r.text?.("promptSortLabel")||"Prompt sort")}">
        ${t.map(([i,n,s])=>`
          <button type="button" role="tab" aria-selected="${e===i?"true":"false"}" class="${e===i?"active":""}" data-prompt-sort="${a(r,i)}">
            <i class="${a(r,n)}"></i>${a(r,s)}
          </button>
        `).join("")}
      </div>
    `}function N({sourceLength:t=0,sourceCount:e=1,summary:r={},systemCount:i=0,ctx:n={}}={}){return`
      <div class="library-stats prompt-library-stats">
        <div><strong>${Number(t||0).toLocaleString()}+</strong><span>${a(n,n.text?.("totalPrompts")||"Prompts")}</span></div>
        <div class="stat-divider"></div>
        <div><strong>${Number(e||1)}</strong><span>${a(n,n.text?.("totalSources")||"Sources")}</span></div>
        <div class="stat-divider"></div>
        <div><strong>${Number(r.systemCount||i||0)}</strong><span>${a(n,n.text?.("tagStatsSystem")||"System tags")}</span></div>
        <div><strong>${Number(r.withContentCount||0)}</strong><span>${a(n,n.text?.("tagStatsWithContent")||"With content")}</span></div>
        <div><strong>${Number(r.emptyCount||0)}</strong><span>${a(n,n.text?.("tagStatsEmpty")||"Empty tags")}</span></div>
      </div>
    `}function D({filterTags:t=[],activeTag:e="all",sourceLength:r=0,counts:i={},ctx:n={}}={}){return t.map(s=>{const d=s.slug==="all"||s.isCategory?s:n.tagInfo?.(s.slug)||s,o=s.slug==="all"?r:i[s.slug]||d.contentCount||0,p=s.slug!=="all"&&o===0,u=!s.isCategory&&d.category&&d.category!=="core"?n.tagCategoryLabel?.(d.category):"",b=`${d.slug||s.slug}${d.aliases?.length?` · ${d.aliases.join(" · ")}`:""}`;return`
        <button type="button" class="${e===s.slug?"active":""} ${p?"empty":""}" data-tag="${a(n,s.slug)}" title="${a(n,b)}">
          ${u?`<em>${a(n,u)}</em>`:""}
          ${a(n,d.label||s.label||s.slug)}
          <span>${Number(o||0)}</span>
        </button>
      `}).join("")}function I({type:t="empty",title:e="",body:r="",actionLabel:i="",actionAttr:n="",icon:s="",compact:d=!1,ctx:o={}}={}){const p={loading:["ri-loader-4-line",l(o,"loadingTitle"),l(o,"loadingBody")],empty:["ri-search-eye-line",l(o,"emptyTitle"),l(o,"emptyBody")],error:["ri-error-warning-line",l(o,"errorTitle"),l(o,"errorBody")],offline:["ri-wifi-off-line",l(o,"offlineTitle"),l(o,"offlineBody")],permission:["ri-shield-keyhole-line",l(o,"permissionTitle"),l(o,"permissionBody")],warning:["ri-radar-line",l(o,"fallbackTitle"),l(o,"fallbackBody")]}[t]||["ri-information-line",e,r],u=s||p[0],b=e||p[1],m=r||p[2];return`
      <div class="prompt-library-state prompt-library-state-${a(o,t)}${d?" compact":""}" data-prompt-library-state="${a(o,t)}" role="${t==="loading"?"status":"note"}">
        <i class="${a(o,u)}"></i>
        <div>
          <strong>${a(o,b)}</strong>
          <span>${a(o,m)}</span>
        </div>
        ${i&&n?`<button type="button" ${n}>${a(o,i)}</button>`:""}
        ${t==="loading"?'<em class="prompt-library-loading-dots"><b></b><b></b><b></b></em>':""}
      </div>
    `}function H({tag:t={},related:e=[],isAdmin:r=!1,ctx:i={}}={}){const n=String(i.text?.("emptyTagTitle")||"No works for {tag} yet").replace("{tag}",t.label||t.slug||""),s=r?`<button type="button" data-empty-tag-admin-create><i class="ri-add-circle-line"></i>${a(i,i.text?.("emptyTagAdminCreate")||"Create example")}</button>`:"";return`
      <div class="empty-message empty-tag-state prompt-library-state prompt-library-state-empty-tag" data-prompt-library-state="empty-tag">
        <i class="ri-price-tag-3-line"></i>
        <strong>${a(i,n)}</strong>
        <span>${a(i,i.text?.("emptyTagBody")||"")}</span>
        <div class="empty-tag-actions">
          <button type="button" data-empty-tag-generate><i class="ri-sparkling-2-line"></i>${a(i,i.text?.("emptyTagGenerate")||"Create")}</button>
          ${s}
        </div>
        ${e.length?`
          <div class="empty-tag-related">
            <em>${a(i,i.text?.("emptyTagNearby")||"Nearby")}</em>
            ${e.map(d=>{const o=i.tagInfo?.(d.slug)||d;return`<button type="button" data-tag="${a(i,d.slug)}">${a(i,o.label||d.slug)}</button>`}).join("")}
          </div>
        `:""}
      </div>
    `}function R({fallbackUsed:t=!1,error:e="",offline:r=!1,permissionDenied:i=!1,ctx:n={}}={}){if(!t&&!e&&!r&&!i)return"";const s=i?"permission":r?"offline":t?"warning":"error";return I({type:s,body:e?`${l(n,s==="warning"?"fallbackBody":`${s}Body`)} ${e}`:"",compact:!0,ctx:n})}function z(t={},e={}){const r=e.state||{},i=e.promptImageDisplayUrl?.(t)||"",n=e.promptCoverFallbackSrc?.(t)||"",s=C(t),d=r.user?.role==="admin",o=t.author||(r.lang==="zh"?"公开来源":"Public source"),p=t.source||"-",u=t.sourceUrl||t.githubUrl||"",b=t.category?e.tagCategoryLabel?.(t.category)||t.category:"-",m=T(t,e),k=m?`<div><span>${a(e,e.text?.("promptFieldStatus")||"Status")}</span><strong>${a(e,m.label)}</strong></div>`:`<div><span>${a(e,e.text?.("promptFieldStatus")||"Status")}</span><strong>${a(e,t.status==="hidden"?e.text?.("promptStatusHidden"):e.text?.("promptStatusActive"))}</strong></div>`;return`
      <section class="modal square-preview-modal prompt-library-detail-modal">
        <button class="square-preview-close" type="button" aria-label="${a(e,e.text?.("close")||"Close")}"><i class="ri-close-line"></i></button>
        <div class="square-preview-stage" ${e.imageFallbackContainerAttrs?.()||""}>
          ${i?`<img class="square-preview-main" src="${a(e,i)}" ${e.imageFallbackImgAttrs?.(n)||""} loading="lazy" decoding="async" alt="${a(e,h(e,t.prompt||t.title||"",100))}">`:v.ImageStudioPromptCoverFallback?.render?.(t,{escapeHtml:g=>a(e,g),truncate:(g,c)=>h(e,g,c)})||`<div class="square-preview-main prompt-no-cover-detail"><i class="ri-quill-pen-line"></i><span>${a(e,t.title||e.text?.("promptLibrary")||"Prompt")}</span></div>`}
        </div>
        <aside class="square-preview-side">
          <div class="square-preview-head">
            <span>${a(e,e.text?.("promptLibrary")||"Prompt library")}</span>
            <strong>${a(e,t.title||"")}</strong>
          </div>
          <div class="square-preview-section">
            <h3>${r.lang==="zh"?"原提示词":"Prompt"}</h3>
            <p>${a(e,t.prompt||"")}</p>
          </div>
          <div class="square-preview-meta prompt-library-detail-meta">
            <div><span>${a(e,e.text?.("promptFieldAuthor")||"Author")}</span><strong>${a(e,o)}</strong></div>
            <div><span>${a(e,e.text?.("promptFieldSource")||"Source")}</span><strong>${a(e,p)}</strong></div>
            <div><span>${r.lang==="zh"?"分类":"Category"}</span><strong>${a(e,b)}</strong></div>
            <div><span>${r.lang==="zh"?"来源仓库":"Source repo"}</span><strong>${a(e,t.sourceRepo||B(u)||"-")}</strong></div>
            <div><span>ID</span><strong>${a(e,String(t.id||"-"))}</strong></div>
            ${k}
          </div>
          ${s.length?`
            <div class="square-preview-tags">
              ${s.map(g=>{const c=e.tagInfo?.(g)||{label:g,hue:210};return`<button type="button" class="tag-chip" style="--tag-hue:${a(e,c.hue)}" data-prompt-tag="${a(e,g)}">${a(e,c.label||g)}</button>`}).join("")}
            </div>
          `:""}
          ${u?`
            <div class="square-preview-section prompt-library-source-url">
              <h3>${a(e,e.text?.("promptFieldSourceUrl")||"Source URL")}</h3>
              <p><a href="${a(e,u)}" target="_blank" rel="noreferrer">${a(e,u)}</a></p>
            </div>
          `:""}
          <div class="square-preview-actions">
            <button type="button" data-prompt-text><i class="ri-sparkling-2-line"></i>${a(e,e.text?.("textToImageAction")||"Text to image")}</button>
            <button type="button" data-prompt-detail-like="${a(e,t.id)}" class="${t.likedByCurrentUser?"liked":""}">
              <i class="${t.likedByCurrentUser?"ri-heart-fill":"ri-heart-line"}"></i>${Number(t.likeCount||0)}
            </button>
            ${i?`<button type="button" data-prompt-edit><i class="ri-image-edit-line"></i>${a(e,e.text?.("imageToImageAction")||"Image to image")}</button>`:""}
            ${e.isCanvasEntryHidden?.()?"":`<button type="button" data-prompt-add-canvas><i class="ri-node-tree"></i>${a(e,e.text?.("addToCanvas")||"Add to canvas")}</button>`}
            <button type="button" data-prompt-copy><i class="ri-file-copy-line"></i>${a(e,e.text?.("copy")||"Copy")}</button>
            ${i?`<a href="${a(e,i)}" target="_blank" rel="noreferrer"><i class="ri-external-link-line"></i>${a(e,e.text?.("download")||"Open")}</a>`:""}
            ${d?`<button type="button" data-prompt-admin-edit><i class="ri-pencil-line"></i>${a(e,e.text?.("promptEdit")||"Edit")}</button>`:""}
            ${d?`<button type="button" data-prompt-admin-delete><i class="ri-delete-bin-line"></i>${a(e,e.text?.("promptDelete")||"Hide")}</button>`:""}
          </div>
        </aside>
      </section>
    `}const A={renderPromptCard:L,renderSortControl:F,renderStats:N,renderTagFilters:D,renderLibraryState:I,renderEmptyTagState:H,renderSourceNotice:R,renderPromptDetailModal:z,fallbackPrompts:U};v.ImageStudioPromptLibrary=Object.freeze(A),v.AppModules?.register?.("promptLibrary",A)})(window);
