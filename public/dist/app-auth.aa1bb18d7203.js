(function(w){"use strict";const L=w.AppModules||(w.AppModules={}),u=(i,e=document)=>e.querySelector(i),h=(i,e=document)=>Array.from(e.querySelectorAll(i));function F(i){const e=document.cookie.split(";").map(n=>n.trim()).filter(Boolean).map(n=>n.split("=")).find(([n])=>decodeURIComponent(n)===i);return e?decodeURIComponent(e.slice(1).join("=")):""}function g(i,e){const n=i[e];if(n==null)throw new Error(`AppModules.auth missing context: ${e}`);return n}function G(i={}){const e=g(i,"state"),n=g(i,"elements"),r=g(i,"text"),l=g(i,"escapeHtml"),S=g(i,"formatDate"),C=g(i,"truncate"),V=g(i,"maskContactEmail"),I=g(i,"openModal"),b=g(i,"closeModal"),k=g(i,"showToast");async function f(s,t={}){const a=String(t.method||"GET").toUpperCase(),d={"Content-Type":"application/json",...t.headers||{}};["GET","HEAD","OPTIONS"].includes(a)||(d["X-CSRF-Token"]=e.csrfToken||F("csrf"));const c=await fetch(s,{...t,credentials:"same-origin",headers:d});if(c.status===204)return null;const o=await c.json().catch(()=>({}));if(o.csrfToken&&(e.csrfToken=o.csrfToken),!c.ok){const T=(o.details?.requiredMode||o.details?.audit?.requiredMode||"")==="image-to-image"?e.lang==="zh"?"提示词与已有公开内容高度相似，请改用图生图或含原图发布。":"This prompt is highly similar to existing public content. Publish it as image-to-image instead.":o.error||"Request failed",p=new Error(T);throw p.status=c.status,p.details=o.details||null,p}return o}function v(){n.accountMenu?.classList.add("hidden"),n.accountMenuBtn?.setAttribute("aria-expanded","false")}function E(s=e.authMode){e.authMode=s;const t=s==="register";I(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-sparkling-2-fill"></i>
            <h2>${r(t?"registerTitle":"loginTitle")}</h2>
            <p><i class="ri-gift-line"></i> ${r("authGift")}</p>
            <p class="auth-bonus"><i class="ri-flashlight-line"></i> ${r("authBonus")}</p>
          </div>
          <div class="auth-tabs">
            <button type="button" class="${t?"":"active"}" data-auth-mode="login">${r("submitLogin")}</button>
            <button type="button" class="${t?"active":""}" data-auth-mode="register">${r("submitRegister")}</button>
          </div>
          <form id="authForm" class="modal-form">
            ${t?`<label>${r("name")}<input id="authName" autocomplete="name"></label>`:""}
            <label>${r("email")}<input id="authEmail" type="email" autocomplete="email" required></label>
            <label>${r("password")}<input id="authPassword" type="password" autocomplete="${t?"new-password":"current-password"}" required></label>
            <button class="modal-primary" type="submit">${r(t?"submitRegister":"submitLogin")}</button>
            <button class="link-button" type="button" data-auth-mode="${t?"login":"register"}">
              ${r(t?"switchToLogin":"switchToRegister")}
            </button>
            <button class="link-button" type="button" data-close-auth>${r("skip")}</button>
          </form>
        </section>
      `),h("[data-auth-mode]",n.modalLayer).forEach(a=>{a.addEventListener("click",()=>E(a.dataset.authMode))}),u("[data-close-auth]",n.modalLayer).addEventListener("click",b),u("#authForm").addEventListener("submit",W)}async function W(s){s.preventDefault();const t=s.currentTarget.querySelector("button[type='submit']");t.disabled=!0;try{const a={email:u("#authEmail").value,password:u("#authPassword").value,name:u("#authName")?.value||""},d=await f(`/api/auth/${e.authMode}`,{method:"POST",body:JSON.stringify(a)});if(d.pendingApproval){k(e.lang==="zh"?"账号已创建，等待管理员启用":"Account created, waiting for approval","ri-time-line"),b();return}e.user=d.user,i.setCurrentCacheUser();const c=await f("/api/auth/me");e.settings=c.settings,e.firstRun=c.firstRun,e.checkin=c.checkin||e.checkin,await i.loadHistory(),i.ensureImageSessions(),await i.loadAnnouncements(),b();const o=e.pendingAuthView;e.pendingAuthView="",e.forceHero=!o,i.renderAll(),o==="canvas-v2"?w.location.assign(i.canvasV2ProjectUrl()):o&&i.navigate(o,{scrollTop:!0}),setTimeout(i.maybeOpenUnreadAnnouncementModal,300),w.scrollTo({top:0,behavior:"auto"}),i.restartHeroVideo()}catch(a){k(a.message,"ri-error-warning-line")}finally{t.disabled=!1}}async function R(){const s=e.user?.id||e.user?.email||"";await f("/api/auth/logout",{method:"POST"}).catch(()=>null),await i.cacheDb()?.clearUserCache?.(s),e.user=null,i.setCurrentCacheUser(null),e.history=[],e.imageSessions=[],e.activeImageSessionId="",e.announcements=[],e.unreadAnnouncements=[],e.notificationModalShown.clear(),e.checkin={checkedInToday:!1,credit:e.settings?.checkinCredit||1},e.forceHero=!0,i.renderAll(),w.scrollTo({top:0,behavior:"auto"}),i.restartHeroVideo()}async function B(){try{return await f("/api/credits/detail?limit=80")}catch(s){return console.warn("[credits]",s),{ledger:[],rewards:[]}}}async function M(){if(!e.user){E("login");return}const s=await B();I(w.ImageStudioCreditsDetail.renderModal({details:s,state:e,helpers:{escapeHtml:l,text:r,formatDate:S}})),u("[data-checkin]",n.modalLayer)?.addEventListener("click",H),u("[data-close-auth]",n.modalLayer).addEventListener("click",b)}async function H(s){const t=s.currentTarget;t.disabled=!0;try{const a=await f("/api/checkin",{method:"POST"});e.user=a.user||{...e.user,credits:a.credits},i.setCurrentCacheUser(),e.checkin=a.checkin||{checkedInToday:!0,credit:e.checkin?.credit||1},k(a.checkedIn?e.lang==="zh"?`签到成功，获得 ${a.awarded} 积分`:`Checked in, +${a.awarded} credit`:r("checkedIn"),"ri-calendar-check-line"),i.updateNav(),M()}catch(a){k(a.message,"ri-error-warning-line"),t.disabled=!1}}function P(){const s=String(e.settings?.contactEmail??e.settings?.contactAdminEmail??"").trim();if(!s)return;const t=`mailto:${s}?subject=${encodeURIComponent("ai-image-studio support")}`,a=V(s);I(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-customer-service-2-line" style="color:#1677ff"></i>
            <h2>${r("contactTitle")}</h2>
            <p>${r("contactDesc")}</p>
          </div>
          <div class="contact-card">
            <span>${l(r("contactEmailLabel"))}</span>
            <a class="contact-email" href="${l(t)}">${l(a)}</a>
            <button class="contact-copy" type="button" data-copy-contact-email>${l(r("contactCopy"))}</button>
          </div>
          <button class="modal-secondary" type="button" data-close-auth>${r("close")}</button>
        </section>
      `),u("[data-copy-contact-email]",n.modalLayer).addEventListener("click",async()=>{typeof i.copyText=="function"?await i.copyText(s):await navigator.clipboard?.writeText(s),k(r("contactCopied"),"ri-file-copy-line")}),u("[data-close-auth]",n.modalLayer).addEventListener("click",b)}function q(s={}){if(!e.user){E("login");return}i.syncThemeMobileNav("works");const t=s.replaceRoute!==!1;e.worksFilter=e.worksFilter||"all";const a=[{id:"all",label:r("worksFilterAll")},{id:"public",label:r("worksFilterPublic")},{id:"private",label:r("worksFilterPrivate")},{id:"text",label:r("worksFilterText")},{id:"image",label:r("worksFilterImage")},{id:"archived",label:r("worksFilterArchived")}];if(I(`
        <section class="modal works-modal works-workspace">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="works-head">
            <div>
              <h2>${r("myWorks")}</h2>
              <p>${e.lang==="zh"?"搜索、批量公开、撤回或归档历史作品。":"Search, publish, unpublish, or archive generated assets in bulk."}</p>
            </div>
            <button class="ghost-button works-refresh" type="button" data-works-refresh><i class="ri-refresh-line"></i></button>
          </div>
          <div class="works-toolbar">
            <label class="works-search"><i class="ri-search-line"></i><input id="worksSearchInput" value="${l(e.worksSearch||"")}" placeholder="${e.lang==="zh"?"搜索提示词、标签或时间":"Search prompt, tags, or date"}"></label>
            <div class="works-bulk-actions">
              <span data-works-selection>0 ${r("worksSelected")}</span>
              <button type="button" data-works-bulk="download"><i class="ri-download-2-line"></i>${r("worksBatchDownload")}</button>
              <button type="button" data-works-bulk="publish"><i class="ri-gallery-upload-line"></i>${r("publishImage")}</button>
              ${i.canUserUnpublishPublicWork()?`<button type="button" data-works-bulk="unpublish"><i class="ri-eye-off-line"></i>${r("unpublish")}</button>`:""}
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
      `),u("[data-works-refresh]",n.modalLayer).addEventListener("click",()=>$(!0)),u("#worksSearchInput",n.modalLayer).addEventListener("input",d=>{e.worksSearch=d.target.value,$(!1)}),h("[data-works-filter]",n.modalLayer).forEach(d=>{d.addEventListener("click",()=>{e.worksFilter=d.dataset.worksFilter||"all",h("[data-works-filter]",n.modalLayer).forEach(c=>{c.classList.toggle("active",c===d)}),$(!1)})}),h("[data-works-bulk]",n.modalLayer).forEach(d=>{d.addEventListener("click",()=>X(d.dataset.worksBulk))}),$(!1),t&&!e.routeSyncing){const d=i.routeState({modal:"works"});w.history?.pushState?.(d,"",i.routeUrl(d))}}async function $(s=!1){const t=u("#worksGrid",n.modalLayer);if(!t)return;t.innerHTML=`<div class="empty-message">${r("loadingPrompts")}</div>`,s&&await i.loadHistory();const a=e.worksFilter||"all",d=String(e.worksSearch||"").trim().toLowerCase(),c=[...e.history].filter(o=>o.status==="done"&&o.images?.[0]).filter(o=>{const m=i.isImageToImageItem(o);switch(a){case"public":return!!o.isPublic&&!o.archived;case"private":return!o.isPublic&&!o.archived;case"text":return!m&&!o.archived;case"image":return m&&!o.archived;case"archived":return!!o.archived;default:return!o.archived}}).filter(o=>d?[o.prompt,S(o.time),...(o.publicTags||[]).map(i.displayTag)].some(m=>String(m||"").toLowerCase().includes(d)):!0).sort((o,m)=>new Date(m.time||0)-new Date(o.time||0));if(N(),!c.length){t.innerHTML=`<div class="empty-message">${r(a==="all"?"emptyWorks":"worksFilterEmpty")}</div>`;return}t.innerHTML=c.map(o=>{const m=!!(o.sourceImageData||o.sourceImageUrl),T=i.isImageToImageItem(o),p=o.publicTags?.length?` · ${o.publicTags.map(i.displayTag).join(" / ")}`:"",y=o.isPublic?i.publicRewardLabel(o):"",Y=`
          <div class="work-image-tools">
            <button type="button" data-work-publish="${l(o.id)}">
              <i class="${o.isPublic?"ri-price-tag-3-line":"ri-gallery-upload-line"}"></i>
              ${o.isPublic?r("editPublicTags"):r("publishImage")}
            </button>
            ${m&&!o.publishOriginal?`<button type="button" data-work-publish-original="${l(o.id)}"><i class="ri-image-add-line"></i>${r("publishWithOriginal")}</button>`:""}
          </div>
        `;return`
        <article class="work-card${o.archived?" archived":""}" data-work-id="${l(o.id)}" tabindex="0" role="button" aria-label="${l(r("worksOpenDetail"))}">
          <div class="work-visual" data-work-detail="${l(o.id)}" ${i.imageFallbackContainerAttrs()}>
            <label class="work-select"><input type="checkbox" data-work-select="${l(o.id)}"${e.worksSelected.has(String(o.id))?" checked":""}></label>
            <img src="${l(i.imageVariantUrl(o.images[0]))}" ${i.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${l(C(o.prompt,80))}">
            <span class="work-type-badge ${T?"image":"text"}">${l(r(T?"imageToImage":"textToImage"))}</span>
            ${o.isPublic?`<span class="work-visibility-badge published">${l(r("publishedImage"))}</span>`:""}
            ${o.archived?`<span class="work-visibility-badge archived">${e.lang==="zh"?"已归档":"Archived"}</span>`:""}
            ${Y}
          </div>
          <div class="work-body">
            <p>${l(C(o.prompt,92))}</p>
            <span>${l(S(o.time))}${o.isPublic?` · ${r("publishToSquare")}${l(p)}${y?` · ${l(y)}`:""}`:""}</span>
            <div class="work-actions">
              <a href="${l(o.images[0])}" download="${l(o.id)}.png"><i class="ri-download-line"></i>${r("download")}</a>
              <button type="button" data-work-detail="${l(o.id)}"><i class="ri-eye-line"></i>${r("worksOpenDetail")}</button>
              <button type="button" data-work-retry="${l(o.id)}"><i class="ri-refresh-line"></i>${r("retry")}</button>
              <button type="button" data-work-editor="${l(o.id)}"><i class="ri-magic-line"></i>${r("openEditor")}</button>
              ${o.isPublic&&i.canUserUnpublishPublicWork()?`<button type="button" data-work-withdraw="${l(o.id)}"><i class="ri-eye-off-line"></i>${r("unpublish")}</button>`:""}
            </div>
          </div>
        </article>
      `}).join(""),J(t)}function J(s){h("[data-work-select]",s).forEach(t=>{t.addEventListener("click",a=>a.stopPropagation()),t.addEventListener("change",()=>{t.checked?e.worksSelected.add(String(t.dataset.workSelect)):e.worksSelected.delete(String(t.dataset.workSelect)),N()})}),h("[data-work-detail]",s).forEach(t=>{t.addEventListener("click",a=>{a.stopPropagation(),z(t.dataset.workDetail)})}),h(".work-card",s).forEach(t=>{const a=()=>z(t.dataset.workId);t.addEventListener("click",a),t.addEventListener("keydown",d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),a())})}),h("a, button",s).forEach(t=>{t.hasAttribute("data-work-detail")||t.addEventListener("click",a=>a.stopPropagation())}),h("[data-work-retry]",s).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===t.dataset.workRetry);a&&(b(),e.forceHero=!0,e.draftPrompt=a.prompt,i.setView("home"),i.syncComposers(),setTimeout(()=>i.submitGeneration(u(".composer",n.heroComposerMount)),80))})}),h("[data-work-editor]",s).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===t.dataset.workEditor);a?.images?.[0]&&(b(),i.openImageEditor(a.images[0],a.prompt))})}),h("[data-work-publish]",s).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===t.dataset.workPublish);a&&i.openPublishModal(a,!1)})}),h("[data-work-publish-original]",s).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(d=>String(d.id)===t.dataset.workPublishOriginal);a&&i.openPublishModal(a,!0)})}),h("[data-work-withdraw]",s).forEach(t=>{t.addEventListener("click",()=>j(t.dataset.workWithdraw))})}function K(){return Math.max(1,Number(e.settings?.publicWithdrawalWindowHours||12))}function O(s){const t=K(),a=!s.publishedAt||Date.now()-new Date(s.publishedAt).getTime()<=t*60*60*1e3,d=e.lang==="zh"?`${t} 小时`:`${t} hour${t===1?"":"s"}`;return{withinWindow:a,message:a?e.lang==="zh"?`确认撤回公开？${d}内撤回会取消未入账奖励。`:`Unpublish this work? Pending reward will be cancelled within ${d}.`:e.lang==="zh"?`已超过 ${d}，将提交撤回申请。`:`More than ${d} passed. This will submit a withdrawal request.`}}async function j(s){if(!i.canUserUnpublishPublicWork()){k(e.lang==="zh"?"已关闭用户取消公开功能，请联系管理员处理。":"User unpublish is disabled; contact an admin.","ri-lock-line");return}const t=e.history.find(c=>String(c.id)===String(s));if(!t)return;const{withinWindow:a,message:d}=O(t);if(confirm(d))try{await f(`/api/images/${encodeURIComponent(s)}/withdrawal`,{method:"POST",body:JSON.stringify({reason:"user_request"})}),await i.loadHistory(),await i.loadPublicGallery(),$(!1),k(a?r("unpublishDone"):e.lang==="zh"?"撤回申请已提交":"Withdrawal request submitted","ri-checkbox-circle-line")}catch(c){k(c.message,"ri-error-warning-line")}}function N(){const s=u("[data-works-selection]",n.modalLayer);s&&(s.textContent=`${e.worksSelected.size} ${r("worksSelected")}`)}async function X(s){const t=Array.from(e.worksSelected);if(!t.length)return;if(s==="download"){_(t);return}const a=s==="unpublish"||s==="archive",d={publish:e.lang==="zh"?"公开":"publish",unpublish:e.lang==="zh"?"撤回公开":"unpublish",archive:e.lang==="zh"?"归档":"archive",unarchive:e.lang==="zh"?"取消归档":"unarchive"}[s]||s;if(!(a&&!confirm(`${e.lang==="zh"?"确认":"Confirm"}${d} ${t.length} ${e.lang==="zh"?"个作品？":"works?"}`)))try{const c=t.map(A).filter(Boolean),o=[...new Set(c.map(i.publicKindTagForItem))],m=o.length===1?i.publicTagsForKind(o[0],[]):[],p=((await f("/api/images/bulk",{method:"POST",body:JSON.stringify({generationIds:t,action:s,publicTags:m})})).results||[]).filter(y=>y.ok).length;e.worksSelected.clear(),await i.loadHistory(),await i.loadPublicGallery(),k(`${d}: ${p}/${t.length}`,"ri-checkbox-circle-line"),$(!1)}catch(c){k(c.message,"ri-error-warning-line")}}function A(s){return e.history.find(t=>String(t.id)===String(s))}function _(s){const t=s.map(A).filter(a=>a?.images?.[0]);t.forEach((a,d)=>{setTimeout(()=>{const c=document.createElement("a");c.href=a.images[0],c.download=`${a.id}.png`,c.rel="noreferrer",document.body.appendChild(c),c.click(),c.remove()},d*220)}),k(`${r("worksDownloadStarted")}: ${t.length}`,"ri-download-2-line")}function z(s,t={}){const a=A(s);if(!a?.images?.[0])return;const d=t.replaceRoute!==!1;D();const c=(a.publicTags||[]).map(i.displayTag).filter(Boolean),o=i.isImageToImageItem(a),m=a.creativeRoute?.length?a.creativeRoute:a.conversation?.length?a.conversation:i.conversationRouteForItem(a),T=[[r("model"),a.model||"-"],[r("size"),a.options?.size||"-"],[r("quality"),a.options?.quality||"-"],[r("background"),a.options?.background||"-"],[r("format"),a.options?.outputFormat||"-"],[r("elapsed"),a.elapsedMs?i.formatElapsed(a.elapsedMs):"-"]];if(n.modalLayer.insertAdjacentHTML("beforeend",`
        <div class="works-detail-backdrop" data-work-detail-close></div>
        <aside class="works-detail-drawer" role="dialog" aria-modal="true" aria-label="${l(r("worksDetailTitle"))}" data-work-id="${l(a.id)}">
          <button class="works-detail-close" type="button" data-work-detail-close><i class="ri-close-line"></i></button>
          <div class="works-detail-stage" ${i.imageFallbackContainerAttrs()}>
            <img src="${l(a.images[0])}" ${i.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${l(C(a.prompt,100))}">
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
              ${i.isCanvasEntryHidden()?"":`<button type="button" data-work-detail-canvas><i class="ri-node-tree"></i>${r("addToCanvas")}</button>`}
            </div>
            <dl class="works-detail-meta">
              <dt>ID</dt><dd>${l(String(a.id))}</dd>
              <dt>${l(r("status"))}</dt><dd>${l(a.isPublic?r("publishedImage"):a.archived?e.lang==="zh"?"已归档":"Archived":r("worksFilterPrivate"))}</dd>
              <dt>${l(r("publicTags"))}</dt><dd>${c.length?c.map(l).join(" / "):"-"}</dd>
              <dt>${l(e.lang==="zh"?"创建时间":"Created")}</dt><dd>${l(S(a.time)||"-")}</dd>
              ${T.map(([p,y])=>`<dt>${l(p)}</dt><dd>${l(String(y||"-"))}</dd>`).join("")}
            </dl>
            ${a.sourceImageUrl?`<section class="works-detail-source" ${i.imageFallbackContainerAttrs()}><h4>${l(r("sourceImage"))}</h4><img src="${l(a.sourceImageUrl)}" ${i.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${l(r("sourceImage"))}"></section>`:""}
            ${m?.length?`
              <section class="works-detail-route">
                <h4>${l(r("routeTitle"))}</h4>
                ${m.map((p,y)=>`
                  <article>
                    <strong>${y+1}</strong>
                    <p>${l(p.prompt||a.prompt||"")}</p>
                  </article>
                `).join("")}
              </section>
            `:""}
          </div>
        </aside>
      `),h("[data-work-detail-close]",n.modalLayer).forEach(p=>p.addEventListener("click",D)),u("[data-work-detail-copy]",n.modalLayer)?.addEventListener("click",async()=>{await i.copyText(a.prompt||""),k(e.lang==="zh"?"提示词已复制":"Prompt copied","ri-file-copy-line")}),u("[data-work-detail-editor]",n.modalLayer)?.addEventListener("click",()=>{b(),i.openImageEditor(a.images[0],a.prompt)}),u("[data-work-detail-continue]",n.modalLayer)?.addEventListener("click",()=>{b(),e.forceHero=!0,e.draftPrompt=a.prompt,i.navigate("home"),i.syncComposers(),setTimeout(()=>u(".prompt-box",n.heroComposerMount)?.focus(),100)}),u("[data-work-detail-canvas]",n.modalLayer)?.addEventListener("click",()=>{i.openCanvasTargetModal(i.canvasPayloadFromGeneration(a,r("worksDetailTitle")))}),d&&!e.routeSyncing){const p=i.routeState({modal:"works",workDetailId:a.id});w.history?.pushState?.(p,"",i.routeUrl(p))}}function D(){if(u(".works-detail-drawer",n.modalLayer)?.remove(),u(".works-detail-backdrop",n.modalLayer)?.remove(),!e.routeSyncing&&u(".works-modal",n.modalLayer)&&w.history?.pushState){const s=i.routeState({modal:"works",workDetailId:""});w.history.replaceState(s,"",i.routeUrl(s))}}function Q(){n.contactBtn.addEventListener("click",P),n.accountEmailText?.addEventListener("click",async()=>{const s=String(e.user?.email||"").trim();s&&(typeof i.copyText=="function"?await i.copyText(s):await navigator.clipboard?.writeText(s),k(r("contactCopied"),"ri-file-copy-line"))}),n.accountEmailText?.addEventListener("keydown",s=>{["Enter"," "].includes(s.key)&&(s.preventDefault(),n.accountEmailText.click())}),n.accountContactBtn?.addEventListener("click",()=>{v(),P()}),n.accountMenuBtn?.addEventListener("click",s=>{s.stopPropagation();const t=n.accountMenu?.classList.contains("hidden");n.accountMenu?.classList.toggle("hidden",!t),n.accountMenuBtn?.setAttribute("aria-expanded",t?"true":"false")}),document.addEventListener("click",s=>{!n.accountMenuWrap||n.accountMenuWrap.contains(s.target)||v()}),n.loginBtn.addEventListener("click",()=>E("login")),n.logoutBtn.addEventListener("click",()=>{v(),R()}),n.creditsBtn.addEventListener("click",()=>{v(),M()}),n.myWorksBtn.addEventListener("click",()=>{v(),e.sessionDrawerLocked=!1,q()}),n.adminBtn.addEventListener("click",()=>{v(),w.location.href="/admin"})}return{api:f,closeAccountMenu:v,openAuthModal:E,submitAuth:W,logout:R,loadCreditDetails:B,openCreditsModal:M,submitCheckin:H,openContactModal:P,openMyWorksModal:q,loadMyWorks:$,openWorkDetail:z,closeWorkDetail:D,withdrawalPromptForItem:O,requestWorkWithdrawal:j,bindAccountEvents:Q}}const U={create:G,readCookie:F};typeof L.register=="function"?L.register("auth",U):L.auth=Object.freeze({...L.auth||{},...U})})(window);
