(function(g){"use strict";const S=g.AppModules||(g.AppModules={}),u=(t,e=document)=>e.querySelector(t),p=(t,e=document)=>Array.from(e.querySelectorAll(t));function U(t){const e=document.cookie.split(";").map(n=>n.trim()).filter(Boolean).map(n=>n.split("=")).find(([n])=>decodeURIComponent(n)===t);return e?decodeURIComponent(e.slice(1).join("=")):""}function w(t,e){const n=t[e];if(n==null)throw new Error(`AppModules.auth missing context: ${e}`);return n}function V(t={}){const e=w(t,"state"),n=w(t,"elements"),r=w(t,"text"),l=w(t,"escapeHtml"),I=w(t,"formatDate"),A=w(t,"truncate"),J=w(t,"maskContactEmail"),C=w(t,"openModal"),b=w(t,"closeModal"),m=w(t,"showToast");async function y(s,i={}){const a=String(i.method||"GET").toUpperCase(),d={"Content-Type":"application/json",...i.headers||{}};["GET","HEAD","OPTIONS"].includes(a)||(d["X-CSRF-Token"]=e.csrfToken||U("csrf"));const c=await fetch(s,{...i,credentials:"same-origin",headers:d});if(c.status===204)return null;const o=await c.json().catch(()=>({}));if(o.csrfToken&&(e.csrfToken=o.csrfToken),!c.ok){const T=(o.details?.requiredMode||o.details?.audit?.requiredMode||"")==="image-to-image"?e.lang==="zh"?"提示词与已有公开内容高度相似，请改用图生图或含原图发布。":"This prompt is highly similar to existing public content. Publish it as image-to-image instead.":o.error||"Request failed",f=new Error(T);throw f.status=c.status,f.details=o.details||null,f}return o}function v(){n.accountMenu?.classList.add("hidden"),n.accountMenuBtn?.setAttribute("aria-expanded","false")}function E(s=e.authMode){e.authMode=s;const i=s==="register";C(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-sparkling-2-fill"></i>
            <h2>${r(i?"registerTitle":"loginTitle")}</h2>
            <p><i class="ri-gift-line"></i> ${r("authGift")}</p>
            <p class="auth-bonus"><i class="ri-flashlight-line"></i> ${r("authBonus")}</p>
          </div>
          <div class="auth-tabs">
            <button type="button" class="${i?"":"active"}" data-auth-mode="login">${r("submitLogin")}</button>
            <button type="button" class="${i?"active":""}" data-auth-mode="register">${r("submitRegister")}</button>
          </div>
          <form id="authForm" class="modal-form">
            ${i?`<label>${r("name")}<input id="authName" autocomplete="name"></label>`:""}
            <label>${r("email")}<input id="authEmail" type="email" autocomplete="email" required></label>
            <label>${r("password")}<input id="authPassword" type="password" autocomplete="${i?"new-password":"current-password"}" required></label>
            <button class="modal-primary" type="submit">${r(i?"submitRegister":"submitLogin")}</button>
            <button class="link-button" type="button" data-auth-mode="${i?"login":"register"}">
              ${r(i?"switchToLogin":"switchToRegister")}
            </button>
            <button class="link-button" type="button" data-close-auth>${r("skip")}</button>
          </form>
        </section>
      `),p("[data-auth-mode]",n.modalLayer).forEach(a=>{a.addEventListener("click",()=>E(a.dataset.authMode))}),u("[data-close-auth]",n.modalLayer).addEventListener("click",b),u("#authForm").addEventListener("submit",W)}async function W(s){s.preventDefault();const i=s.currentTarget.querySelector("button[type='submit']");i.disabled=!0;try{const a={email:u("#authEmail").value,password:u("#authPassword").value,name:u("#authName")?.value||""},d=await y(`/api/auth/${e.authMode}`,{method:"POST",body:JSON.stringify(a)});if(d.pendingApproval){m(e.lang==="zh"?"账号已创建，等待管理员启用":"Account created, waiting for approval","ri-time-line"),b();return}e.user=d.user,t.setCurrentCacheUser();const c=await y("/api/auth/me");e.settings=c.settings,e.firstRun=c.firstRun,e.checkin=c.checkin||e.checkin,await t.loadHistory(),t.ensureImageSessions(),await t.loadAnnouncements(),b();const o=e.pendingAuthView;e.pendingAuthView="",e.forceHero=!o,t.renderAll(),o==="canvas-v2"?g.location.assign(t.canvasV2ProjectUrl()):o&&t.navigate(o,{scrollTop:!0}),setTimeout(t.maybeOpenUnreadAnnouncementModal,300),g.scrollTo({top:0,behavior:"auto"}),t.restartHeroVideo()}catch(a){m(a.message,"ri-error-warning-line")}finally{i.disabled=!1}}async function H(){const s=e.user?.id||e.user?.email||"";await y("/api/auth/logout",{method:"POST"}).catch(()=>null),await t.cacheDb()?.clearUserCache?.(s),e.user=null,t.setCurrentCacheUser(null),e.history=[],e.imageSessions=[],e.activeImageSessionId="",e.announcements=[],e.unreadAnnouncements=[],e.notificationModalShown.clear(),e.checkin={checkedInToday:!1,credit:e.settings?.checkinCredit||1},e.forceHero=!0,t.renderAll(),g.scrollTo({top:0,behavior:"auto"}),t.restartHeroVideo()}async function B(){try{return await y("/api/credits/detail?limit=80")}catch(s){return console.warn("[credits]",s),{ledger:[],rewards:[]}}}async function M(){if(!e.user){E("login");return}const s=await B();C(g.ImageStudioCreditsDetail.renderModal({details:s,state:e,helpers:{escapeHtml:l,text:r,formatDate:I}})),u("[data-checkin]",n.modalLayer)?.addEventListener("click",q),u("[data-close-auth]",n.modalLayer).addEventListener("click",b)}async function q(s){const i=s.currentTarget;i.disabled=!0;try{const a=await y("/api/checkin",{method:"POST"});e.user=a.user||{...e.user,credits:a.credits},t.setCurrentCacheUser(),e.checkin=a.checkin||{checkedInToday:!0,credit:e.checkin?.credit||1},m(a.checkedIn?e.lang==="zh"?`签到成功，获得 ${a.awarded} 积分`:`Checked in, +${a.awarded} credit`:r("checkedIn"),"ri-calendar-check-line"),t.updateNav(),M()}catch(a){m(a.message,"ri-error-warning-line"),i.disabled=!1}}function P(){const s=String(e.settings?.contactEmail??e.settings?.contactAdminEmail??"").trim();if(!s)return;const i=`mailto:${s}?subject=${encodeURIComponent("ai-image-studio support")}`,a=J(s);C(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-customer-service-2-line" style="color:#1677ff"></i>
            <h2>${r("contactTitle")}</h2>
            <p>${r("contactDesc")}</p>
          </div>
          <div class="contact-card">
            <span>${l(r("contactEmailLabel"))}</span>
            <a class="contact-email" href="${l(i)}">${l(a)}</a>
            <button class="contact-copy" type="button" data-copy-contact-email>${l(r("contactCopy"))}</button>
          </div>
          <button class="modal-secondary" type="button" data-close-auth>${r("close")}</button>
        </section>
      `),u("[data-copy-contact-email]",n.modalLayer).addEventListener("click",async()=>{typeof t.copyText=="function"?await t.copyText(s):await navigator.clipboard?.writeText(s),m(r("contactCopied"),"ri-file-copy-line")}),u("[data-close-auth]",n.modalLayer).addEventListener("click",b)}function O(s={}){if(!e.user){E("login");return}t.syncThemeMobileNav("works");const i=s.replaceRoute!==!1;e.worksFilter=e.worksFilter||"all";const a=[{id:"all",label:r("worksFilterAll")},{id:"public",label:r("worksFilterPublic")},{id:"private",label:r("worksFilterPrivate")},{id:"text",label:r("worksFilterText")},{id:"image",label:r("worksFilterImage")},{id:"archived",label:r("worksFilterArchived")}];if(C(`
        <section class="modal works-modal works-workspace">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="works-head">
            <div>
              <h2>${r("myWorks")}</h2>
              <p>${e.lang==="zh"?"搜索、批量公开、撤回或归档历史作品。":"Search, publish, unpublish, or archive generated assets in bulk."}</p>
            </div>
            <button class="btn btn--ghost btn--icon ghost-button works-refresh" type="button" data-works-refresh><i class="ri-refresh-line"></i></button>
          </div>
          <div class="works-toolbar">
            <label class="works-search"><i class="ri-search-line"></i><input id="worksSearchInput" value="${l(e.worksSearch||"")}" placeholder="${e.lang==="zh"?"搜索提示词、标签或时间":"Search prompt, tags, or date"}"></label>
            <div class="works-bulk-actions">
              <span data-works-selection>0 ${r("worksSelected")}</span>
              <button type="button" data-works-bulk="download"><i class="ri-download-2-line"></i>${r("worksBatchDownload")}</button>
              <button type="button" data-works-bulk="publish"><i class="ri-gallery-upload-line"></i>${r("publishImage")}</button>
              ${t.canUserUnpublishPublicWork()?`<button type="button" data-works-bulk="unpublish"><i class="ri-eye-off-line"></i>${r("unpublish")}</button>`:""}
              <button type="button" data-works-bulk="archive"><i class="ri-archive-line"></i>${e.lang==="zh"?"归档":"Archive"}</button>
              <button type="button" data-works-bulk="unarchive"><i class="ri-inbox-unarchive-line"></i>${e.lang==="zh"?"取消归档":"Unarchive"}</button>
            </div>
          </div>
          <div class="works-filter-bar" role="tablist">
            ${a.map(d=>`<button type="button" data-works-filter="${d.id}" class="works-filter-btn${e.worksFilter===d.id?" active":""}">${l(d.label)}</button>`).join("")}
          </div>
          <p class="works-mobile-hint">${e.lang==="zh"?"左右滑动浏览作品，点击卡片打开详情。":"Swipe through works. Tap a card to open details."}</p>
          <div id="worksGrid" class="works-grid"><div class="empty-message">${r("loadingPrompts")}</div></div>
        </section>
      `),u("[data-works-refresh]",n.modalLayer).addEventListener("click",()=>$(!0)),u("#worksSearchInput",n.modalLayer).addEventListener("input",d=>{e.worksSearch=d.target.value,$(!1)}),p("[data-works-filter]",n.modalLayer).forEach(d=>{d.addEventListener("click",()=>{e.worksFilter=d.dataset.worksFilter||"all",p("[data-works-filter]",n.modalLayer).forEach(c=>{c.classList.toggle("active",c===d)}),$(!1)})}),p("[data-works-bulk]",n.modalLayer).forEach(d=>{d.addEventListener("click",()=>_(d.dataset.worksBulk))}),$(!1),i&&!e.routeSyncing){const d=t.routeState({modal:"works"});g.history?.pushState?.(d,"",t.routeUrl(d))}}async function $(s=!1){const i=u("#worksGrid",n.modalLayer);if(!i)return;i.innerHTML=`<div class="empty-message">${r("loadingPrompts")}</div>`,s&&await t.loadHistory();const a=e.worksFilter||"all",d=String(e.worksSearch||"").trim().toLowerCase(),c=[...e.history].filter(o=>o.status==="done"&&o.images?.[0]).filter(o=>{const h=t.isImageToImageItem(o);switch(a){case"public":return!!o.isPublic&&!o.archived;case"private":return!o.isPublic&&!o.archived;case"text":return!h&&!o.archived;case"image":return h&&!o.archived;case"archived":return!!o.archived;default:return!o.archived}}).filter(o=>d?[o.prompt,I(o.time),...(o.publicTags||[]).map(t.displayTag)].some(h=>String(h||"").toLowerCase().includes(d)):!0).sort((o,h)=>new Date(h.time||0)-new Date(o.time||0));if(G(),!c.length){i.innerHTML=`<div class="empty-message">${r(a==="all"?"emptyWorks":"worksFilterEmpty")}</div>`;return}i.innerHTML=c.map(o=>{const h=!!(o.sourceImageData||o.sourceImageUrl),T=t.isImageToImageItem(o),f=o.publicTags?.length?` · ${o.publicTags.map(t.displayTag).join(" / ")}`:"",k=o.isPublic?t.publicRewardLabel(o):"",L=`
          <div class="work-image-tools">
            <button type="button" data-work-publish="${l(o.id)}">
              <i class="${o.isPublic?"ri-price-tag-3-line":"ri-gallery-upload-line"}"></i>
              ${o.isPublic?r("editPublicTags"):r("publishImage")}
            </button>
            ${h&&!o.publishOriginal?`<button type="button" data-work-publish-original="${l(o.id)}"><i class="ri-image-add-line"></i>${r("publishWithOriginal")}</button>`:""}
          </div>
        `;return`
        <article class="work-card${o.archived?" archived":""}" data-work-id="${l(o.id)}" tabindex="0" role="button" aria-label="${l(r("worksOpenDetail"))}">
          <div class="work-visual" data-work-detail="${l(o.id)}" ${t.imageFallbackContainerAttrs()}>
            <label class="work-select"><input type="checkbox" data-work-select="${l(o.id)}"${e.worksSelected.has(String(o.id))?" checked":""}></label>
            <img src="${l(t.imageVariantUrl(o.images[0]))}" ${t.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${l(A(o.prompt,80))}">
            <span class="work-type-badge ${T?"image":"text"}">${l(r(T?"imageToImage":"textToImage"))}</span>
            ${o.isPublic?`<span class="work-visibility-badge published">${l(r("publishedImage"))}</span>`:""}
            ${o.archived?`<span class="work-visibility-badge archived">${e.lang==="zh"?"已归档":"Archived"}</span>`:""}
            ${L}
          </div>
          <div class="work-body">
            <p>${l(A(o.prompt,92))}</p>
            <span>${l(I(o.time))}${o.isPublic?` · ${r("publishToSquare")}${l(f)}${k?` · ${l(k)}`:""}`:""}</span>
            <div class="work-actions">
              <a href="${l(o.images[0])}" download="${l(o.id)}.png"><i class="ri-download-line"></i>${r("download")}</a>
              <button type="button" data-work-detail="${l(o.id)}"><i class="ri-eye-line"></i>${r("worksOpenDetail")}</button>
              <button type="button" data-work-retry="${l(o.id)}"><i class="ri-refresh-line"></i>${r("retry")}</button>
              <button type="button" data-work-editor="${l(o.id)}"><i class="ri-magic-line"></i>${r("openEditor")}</button>
              ${o.isPublic&&t.canUserUnpublishPublicWork()?`<button type="button" data-work-withdraw="${l(o.id)}"><i class="ri-eye-off-line"></i>${r("unpublish")}</button>`:""}
            </div>
          </div>
        </article>
      `}).join(""),K(i)}function K(s){p("[data-work-select]",s).forEach(i=>{i.addEventListener("click",a=>a.stopPropagation()),i.addEventListener("change",()=>{i.checked?e.worksSelected.add(String(i.dataset.workSelect)):e.worksSelected.delete(String(i.dataset.workSelect)),G()})}),p("[data-work-detail]",s).forEach(i=>{i.addEventListener("click",a=>{a.stopPropagation(),z(i.dataset.workDetail)})}),p(".work-card",s).forEach(i=>{const a=()=>z(i.dataset.workId);i.addEventListener("click",a),i.addEventListener("keydown",d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),a())})}),p("a, button",s).forEach(i=>{i.hasAttribute("data-work-detail")||i.addEventListener("click",a=>a.stopPropagation())}),p("[data-work-retry]",s).forEach(i=>{i.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===i.dataset.workRetry);a&&(b(),e.forceHero=!0,e.draftPrompt=a.prompt,t.setView("home"),t.syncComposers(),setTimeout(()=>t.submitGeneration(u(".composer",n.heroComposerMount)),80))})}),p("[data-work-editor]",s).forEach(i=>{i.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===i.dataset.workEditor);a?.images?.[0]&&(b(),t.openImageEditor(a.images[0],a.prompt))})}),p("[data-work-publish]",s).forEach(i=>{i.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===i.dataset.workPublish);a&&t.openPublishModal(a,!1)})}),p("[data-work-publish-original]",s).forEach(i=>{i.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===i.dataset.workPublishOriginal);a&&t.openPublishModal(a,!0)})}),p("[data-work-withdraw]",s).forEach(i=>{i.addEventListener("click",()=>N(i.dataset.workWithdraw))})}function X(){return Math.max(1,Number(e.settings?.publicWithdrawalWindowHours||12))}function j(s){const i=X(),a=!s.publishedAt||Date.now()-new Date(s.publishedAt).getTime()<=i*60*60*1e3,d=e.lang==="zh"?`${i} 小时`:`${i} hour${i===1?"":"s"}`;return{withinWindow:a,message:a?e.lang==="zh"?`确认撤回公开？${d}内撤回会取消未入账奖励。`:`Unpublish this work? Pending reward will be cancelled within ${d}.`:e.lang==="zh"?`已超过 ${d}，将提交撤回申请。`:`More than ${d} passed. This will submit a withdrawal request.`}}async function N(s){if(!t.canUserUnpublishPublicWork()){m(e.lang==="zh"?"已关闭用户取消公开功能，请联系管理员处理。":"User unpublish is disabled; contact an admin.","ri-lock-line");return}const i=e.history.find(c=>String(c.id)===String(s));if(!i)return;const{withinWindow:a,message:d}=j(i);if(confirm(d))try{await y(`/api/images/${encodeURIComponent(s)}/withdrawal`,{method:"POST",body:JSON.stringify({reason:"user_request"})}),await t.loadHistory(),await t.loadPublicGallery(),$(!1),m(a?r("unpublishDone"):e.lang==="zh"?"撤回申请已提交":"Withdrawal request submitted","ri-checkbox-circle-line")}catch(c){m(c.message,"ri-error-warning-line")}}function G(){const s=u("[data-works-selection]",n.modalLayer);s&&(s.textContent=`${e.worksSelected.size} ${r("worksSelected")}`)}async function _(s){const i=Array.from(e.worksSelected);if(!i.length)return;if(s==="download"){Q(i);return}const a=s==="unpublish"||s==="archive",d={publish:e.lang==="zh"?"公开":"publish",unpublish:e.lang==="zh"?"撤回公开":"unpublish",archive:e.lang==="zh"?"归档":"archive",unarchive:e.lang==="zh"?"取消归档":"unarchive"}[s]||s;if(!(a&&!confirm(`${e.lang==="zh"?"确认":"Confirm"}${d} ${i.length} ${e.lang==="zh"?"个作品？":"works?"}`)))try{const c=i.map(F).filter(Boolean),o=[...new Set(c.map(t.publicKindTagForItem))],h=o.length===1?t.publicTagsForKind(o[0],[]):[],f=((await y("/api/images/bulk",{method:"POST",body:JSON.stringify({generationIds:i,action:s,publicTags:h})})).results||[]).filter(k=>k.ok).length;e.worksSelected.clear(),await t.loadHistory(),await t.loadPublicGallery(),m(`${d}: ${f}/${i.length}`,"ri-checkbox-circle-line"),$(!1)}catch(c){m(c.message,"ri-error-warning-line")}}function F(s){return e.history.find(i=>String(i.id)===String(s))}function Q(s){const i=s.map(F).filter(a=>a?.images?.[0]);i.forEach((a,d)=>{setTimeout(()=>{const c=document.createElement("a");c.href=a.images[0],c.download=`${a.id}.png`,c.rel="noreferrer",document.body.appendChild(c),c.click(),c.remove()},d*220)}),m(`${r("worksDownloadStarted")}: ${i.length}`,"ri-download-2-line")}function z(s,i={}){const a=F(s);if(!a?.images?.[0])return;const d=i.replaceRoute!==!1;D();const c=(a.publicTags||[]).map(t.displayTag).filter(Boolean),o=t.isImageToImageItem(a),h=a.creativeRoute?.length?a.creativeRoute:a.conversation?.length?a.conversation:t.conversationRouteForItem(a),T=window.ImageStudioReferenceImages?.renderAssetStrip?.(a.referenceAssets||[],{className:"works-detail-reference-assets",label:r("reference"),escapeHtml:l,imageFallbackContainerAttrs:t.imageFallbackContainerAttrs,imageFallbackImgAttrs:t.imageFallbackImgAttrs})||"",f=[[r("model"),a.model||"-"],[r("size"),a.options?.size||"-"],[r("quality"),a.options?.quality||"-"],[r("background"),a.options?.background||"-"],[r("format"),a.options?.outputFormat||"-"],[r("elapsed"),a.elapsedMs?t.formatElapsed(a.elapsedMs):"-"]];if(n.modalLayer.insertAdjacentHTML("beforeend",`
        <div class="works-detail-backdrop" data-work-detail-close></div>
        <aside class="works-detail-drawer" role="dialog" aria-modal="true" aria-label="${l(r("worksDetailTitle"))}" data-work-id="${l(a.id)}">
          <button class="works-detail-close" type="button" data-work-detail-close><i class="ri-close-line"></i></button>
          <div class="works-detail-stage" ${t.imageFallbackContainerAttrs()}>
            <img src="${l(a.images[0])}" ${t.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${l(A(a.prompt,100))}">
          </div>
          <div class="works-detail-body">
            <div class="works-detail-title">
              <span class="work-type-badge ${o?"image":"text"}">${l(r(o?"imageToImage":"textToImage"))}</span>
              <h3>${l(r("worksDetailTitle"))}</h3>
              <p>${l(a.prompt||"")}</p>
            </div>
            <div class="works-detail-actions">
              <button type="button" data-work-detail-copy><i class="ri-file-copy-line"></i>${r("worksCopyPrompt")}</button>
              <a href="${l(a.images[0])}" download="${l(a.id)}.png"><i class="ri-download-line"></i>${r("download")}</a>
              <button type="button" data-work-detail-editor><i class="ri-magic-line"></i>${r("openEditor")}</button>
              <button type="button" data-work-detail-continue><i class="ri-refresh-line"></i>${r("worksContinue")}</button>
              ${t.isCanvasEntryHidden()?"":`<button type="button" data-work-detail-canvas><i class="ri-node-tree"></i>${r("addToCanvas")}</button>`}
            </div>
            <dl class="works-detail-meta">
              <dt>ID</dt><dd>${l(String(a.id))}</dd>
              <dt>${l(r("status"))}</dt><dd>${l(a.isPublic?r("publishedImage"):a.archived?e.lang==="zh"?"已归档":"Archived":r("worksFilterPrivate"))}</dd>
              <dt>${l(r("publicTags"))}</dt><dd>${c.length?c.map(l).join(" / "):"-"}</dd>
              <dt>${l(e.lang==="zh"?"创建时间":"Created")}</dt><dd>${l(I(a.time)||"-")}</dd>
              ${f.map(([k,L])=>`<dt>${l(k)}</dt><dd>${l(String(L||"-"))}</dd>`).join("")}
            </dl>
            ${a.sourceImageUrl?`<section class="works-detail-source" ${t.imageFallbackContainerAttrs()}><h4>${l(r("sourceImage"))}</h4><img src="${l(a.sourceImageUrl)}" ${t.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${l(r("sourceImage"))}"></section>`:""}
            ${T}
            ${h?.length?`
              <section class="works-detail-route">
                <h4>${l(r("routeTitle"))}</h4>
                ${h.map((k,L)=>`
                  <article>
                    <strong>${L+1}</strong>
                    <p>${l(k.prompt||a.prompt||"")}</p>
                  </article>
                `).join("")}
              </section>
            `:""}
          </div>
        </aside>
      `),p("[data-work-detail-close]",n.modalLayer).forEach(k=>k.addEventListener("click",D)),u("[data-work-detail-copy]",n.modalLayer)?.addEventListener("click",async()=>{await t.copyText(a.prompt||""),m(e.lang==="zh"?"提示词已复制":"Prompt copied","ri-file-copy-line")}),u("[data-work-detail-editor]",n.modalLayer)?.addEventListener("click",()=>{b(),t.openImageEditor(a.images[0],a.prompt)}),u("[data-work-detail-continue]",n.modalLayer)?.addEventListener("click",()=>{b(),e.forceHero=!0,e.draftPrompt=a.prompt,t.navigate("home"),t.syncComposers(),setTimeout(()=>u(".prompt-box",n.heroComposerMount)?.focus(),100)}),u("[data-work-detail-canvas]",n.modalLayer)?.addEventListener("click",()=>{t.openCanvasTargetModal(t.canvasPayloadFromGeneration(a,r("worksDetailTitle")))}),d&&!e.routeSyncing){const k=t.routeState({modal:"works",workDetailId:a.id});g.history?.pushState?.(k,"",t.routeUrl(k))}}function D(){if(u(".works-detail-drawer",n.modalLayer)?.remove(),u(".works-detail-backdrop",n.modalLayer)?.remove(),!e.routeSyncing&&u(".works-modal",n.modalLayer)&&g.history?.pushState){const s=t.routeState({modal:"works",workDetailId:""});g.history.replaceState(s,"",t.routeUrl(s))}}function Y(){n.contactBtn.addEventListener("click",P),n.accountEmailText?.addEventListener("click",async()=>{const s=String(e.user?.email||"").trim();s&&(typeof t.copyText=="function"?await t.copyText(s):await navigator.clipboard?.writeText(s),m(r("contactCopied"),"ri-file-copy-line"))}),n.accountEmailText?.addEventListener("keydown",s=>{["Enter"," "].includes(s.key)&&(s.preventDefault(),n.accountEmailText.click())}),n.accountContactBtn?.addEventListener("click",()=>{v(),P()}),n.accountMenuBtn?.addEventListener("click",s=>{s.stopPropagation();const i=n.accountMenu?.classList.contains("hidden");n.accountMenu?.classList.toggle("hidden",!i),n.accountMenuBtn?.setAttribute("aria-expanded",i?"true":"false")}),document.addEventListener("click",s=>{!n.accountMenuWrap||n.accountMenuWrap.contains(s.target)||v()}),n.loginBtn.addEventListener("click",()=>E("login")),n.logoutBtn.addEventListener("click",()=>{v(),H()}),n.creditsBtn.addEventListener("click",()=>{v(),M()}),n.myWorksBtn.addEventListener("click",()=>{v(),e.sessionDrawerLocked=!1,O()}),n.adminBtn.addEventListener("click",()=>{v(),g.location.href="/admin"})}return{api:y,closeAccountMenu:v,openAuthModal:E,submitAuth:W,logout:H,loadCreditDetails:B,openCreditsModal:M,submitCheckin:q,openContactModal:P,openMyWorksModal:O,loadMyWorks:$,openWorkDetail:z,closeWorkDetail:D,withdrawalPromptForItem:j,requestWorkWithdrawal:N,bindAccountEvents:Y}}const R={create:V,readCookie:U};typeof S.register=="function"?S.register("auth",R):S.auth=Object.freeze({...S.auth||{},...R})})(window);
