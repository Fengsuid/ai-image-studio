(function(w){"use strict";const E=w.AppModules||(w.AppModules={}),u=(i,e=document)=>e.querySelector(i),h=(i,e=document)=>Array.from(e.querySelectorAll(i));function F(i){const e=document.cookie.split(";").map(d=>d.trim()).filter(Boolean).map(d=>d.split("=")).find(([d])=>decodeURIComponent(d)===i);return e?decodeURIComponent(e.slice(1).join("=")):""}function g(i,e){const d=i[e];if(d==null)throw new Error(`AppModules.auth missing context: ${e}`);return d}function G(i={}){const e=g(i,"state"),d=g(i,"elements"),r=g(i,"text"),n=g(i,"escapeHtml"),S=g(i,"formatDate"),M=g(i,"truncate"),I=g(i,"openModal"),b=g(i,"closeModal"),k=g(i,"showToast");async function f(o,t={}){const a=String(t.method||"GET").toUpperCase(),l={"Content-Type":"application/json",...t.headers||{}};["GET","HEAD","OPTIONS"].includes(a)||(l["X-CSRF-Token"]=e.csrfToken||F("csrf"));const c=await fetch(o,{...t,credentials:"same-origin",headers:l});if(c.status===204)return null;const s=await c.json().catch(()=>({}));if(s.csrfToken&&(e.csrfToken=s.csrfToken),!c.ok){const T=(s.details?.requiredMode||s.details?.audit?.requiredMode||"")==="image-to-image"?e.lang==="zh"?"提示词与已有公开内容高度相似，请改用图生图或含原图发布。":"This prompt is highly similar to existing public content. Publish it as image-to-image instead.":s.error||"Request failed",p=new Error(T);throw p.status=c.status,p.details=s.details||null,p}return s}function v(){d.accountMenu?.classList.add("hidden"),d.accountMenuBtn?.setAttribute("aria-expanded","false")}function L(o=e.authMode){e.authMode=o;const t=o==="register";I(`
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
      `),h("[data-auth-mode]",d.modalLayer).forEach(a=>{a.addEventListener("click",()=>L(a.dataset.authMode))}),u("[data-close-auth]",d.modalLayer).addEventListener("click",b),u("#authForm").addEventListener("submit",W)}async function W(o){o.preventDefault();const t=o.currentTarget.querySelector("button[type='submit']");t.disabled=!0;try{const a={email:u("#authEmail").value,password:u("#authPassword").value,name:u("#authName")?.value||""},l=await f(`/api/auth/${e.authMode}`,{method:"POST",body:JSON.stringify(a)});if(l.pendingApproval){k(e.lang==="zh"?"账号已创建，等待管理员启用":"Account created, waiting for approval","ri-time-line"),b();return}e.user=l.user,i.setCurrentCacheUser();const c=await f("/api/auth/me");e.settings=c.settings,e.firstRun=c.firstRun,e.checkin=c.checkin||e.checkin,await i.loadHistory(),i.ensureImageSessions(),await i.loadAnnouncements(),b();const s=e.pendingAuthView;e.pendingAuthView="",e.forceHero=!s,i.renderAll(),s==="canvas-v2"?w.location.assign(i.canvasV2ProjectUrl()):s&&i.navigate(s,{scrollTop:!0}),setTimeout(i.maybeOpenUnreadAnnouncementModal,300),w.scrollTo({top:0,behavior:"auto"}),i.restartHeroVideo()}catch(a){k(a.message,"ri-error-warning-line")}finally{t.disabled=!1}}async function R(){const o=e.user?.id||e.user?.email||"";await f("/api/auth/logout",{method:"POST"}).catch(()=>null),await i.cacheDb()?.clearUserCache?.(o),e.user=null,i.setCurrentCacheUser(null),e.history=[],e.imageSessions=[],e.activeImageSessionId="",e.announcements=[],e.unreadAnnouncements=[],e.notificationModalShown.clear(),e.checkin={checkedInToday:!1,credit:e.settings?.checkinCredit||1},e.forceHero=!0,i.renderAll(),w.scrollTo({top:0,behavior:"auto"}),i.restartHeroVideo()}async function B(){try{return await f("/api/credits/detail?limit=80")}catch(o){return console.warn("[credits]",o),{ledger:[],rewards:[]}}}async function C(){if(!e.user){L("login");return}const o=await B();I(w.ImageStudioCreditsDetail.renderModal({details:o,state:e,helpers:{escapeHtml:n,text:r,formatDate:S}})),u("[data-checkin]",d.modalLayer)?.addEventListener("click",H),u("[data-close-auth]",d.modalLayer).addEventListener("click",b)}async function H(o){const t=o.currentTarget;t.disabled=!0;try{const a=await f("/api/checkin",{method:"POST"});e.user=a.user||{...e.user,credits:a.credits},i.setCurrentCacheUser(),e.checkin=a.checkin||{checkedInToday:!0,credit:e.checkin?.credit||1},k(a.checkedIn?e.lang==="zh"?`签到成功，获得 ${a.awarded} 积分`:`Checked in, +${a.awarded} credit`:r("checkedIn"),"ri-calendar-check-line"),i.updateNav(),C()}catch(a){k(a.message,"ri-error-warning-line"),t.disabled=!1}}function P(){const o=String(e.settings?.contactEmail??e.settings?.contactAdminEmail??"").trim();if(!o)return;const t=`mailto:${o}?subject=${encodeURIComponent("ai-image-studio support")}`;I(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-customer-service-2-line" style="color:#1677ff"></i>
            <h2>${r("contactTitle")}</h2>
            <p>${r("contactDesc")}</p>
          </div>
          <div class="contact-card">
            <span>${n(r("contactEmailLabel"))}</span>
            <a class="contact-email" href="${n(t)}">${n(o)}</a>
            <button class="contact-copy" type="button" data-copy-contact-email>${n(r("contactCopy"))}</button>
          </div>
          <button class="modal-secondary" type="button" data-close-auth>${r("close")}</button>
        </section>
      `),u("[data-copy-contact-email]",d.modalLayer).addEventListener("click",async()=>{await navigator.clipboard?.writeText(o),k(r("contactCopied"),"ri-file-copy-line")}),u("[data-close-auth]",d.modalLayer).addEventListener("click",b)}function q(o={}){if(!e.user){L("login");return}i.syncThemeMobileNav("works");const t=o.replaceRoute!==!1;e.worksFilter=e.worksFilter||"all";const a=[{id:"all",label:r("worksFilterAll")},{id:"public",label:r("worksFilterPublic")},{id:"private",label:r("worksFilterPrivate")},{id:"text",label:r("worksFilterText")},{id:"image",label:r("worksFilterImage")},{id:"archived",label:r("worksFilterArchived")}];if(I(`
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
            <label class="works-search"><i class="ri-search-line"></i><input id="worksSearchInput" value="${n(e.worksSearch||"")}" placeholder="${e.lang==="zh"?"搜索提示词、标签或时间":"Search prompt, tags, or date"}"></label>
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
            ${a.map(l=>`<button type="button" data-works-filter="${l.id}" class="works-filter-btn${e.worksFilter===l.id?" active":""}">${n(l.label)}</button>`).join("")}
          </div>
          <p class="works-mobile-hint">${e.lang==="zh"?"左右滑动浏览作品，点击卡片打开详情。":"Swipe through works. Tap a card to open details."}</p>
          <div id="worksGrid" class="works-grid"><div class="empty-message">${r("loadingPrompts")}</div></div>
        </section>
      `),u("[data-works-refresh]",d.modalLayer).addEventListener("click",()=>$(!0)),u("#worksSearchInput",d.modalLayer).addEventListener("input",l=>{e.worksSearch=l.target.value,$(!1)}),h("[data-works-filter]",d.modalLayer).forEach(l=>{l.addEventListener("click",()=>{e.worksFilter=l.dataset.worksFilter||"all",h("[data-works-filter]",d.modalLayer).forEach(c=>{c.classList.toggle("active",c===l)}),$(!1)})}),h("[data-works-bulk]",d.modalLayer).forEach(l=>{l.addEventListener("click",()=>K(l.dataset.worksBulk))}),$(!1),t&&!e.routeSyncing){const l=i.routeState({modal:"works"});w.history?.pushState?.(l,"",i.routeUrl(l))}}async function $(o=!1){const t=u("#worksGrid",d.modalLayer);if(!t)return;t.innerHTML=`<div class="empty-message">${r("loadingPrompts")}</div>`,o&&await i.loadHistory();const a=e.worksFilter||"all",l=String(e.worksSearch||"").trim().toLowerCase(),c=[...e.history].filter(s=>s.status==="done"&&s.images?.[0]).filter(s=>{const m=i.isImageToImageItem(s);switch(a){case"public":return!!s.isPublic&&!s.archived;case"private":return!s.isPublic&&!s.archived;case"text":return!m&&!s.archived;case"image":return m&&!s.archived;case"archived":return!!s.archived;default:return!s.archived}}).filter(s=>l?[s.prompt,S(s.time),...(s.publicTags||[]).map(i.displayTag)].some(m=>String(m||"").toLowerCase().includes(l)):!0).sort((s,m)=>new Date(m.time||0)-new Date(s.time||0));if(N(),!c.length){t.innerHTML=`<div class="empty-message">${r(a==="all"?"emptyWorks":"worksFilterEmpty")}</div>`;return}t.innerHTML=c.map(s=>{const m=!!(s.sourceImageData||s.sourceImageUrl),T=i.isImageToImageItem(s),p=s.publicTags?.length?` · ${s.publicTags.map(i.displayTag).join(" / ")}`:"",y=s.isPublic?i.publicRewardLabel(s):"",Q=`
          <div class="work-image-tools">
            <button type="button" data-work-publish="${n(s.id)}">
              <i class="${s.isPublic?"ri-price-tag-3-line":"ri-gallery-upload-line"}"></i>
              ${s.isPublic?r("editPublicTags"):r("publishImage")}
            </button>
            ${m&&!s.publishOriginal?`<button type="button" data-work-publish-original="${n(s.id)}"><i class="ri-image-add-line"></i>${r("publishWithOriginal")}</button>`:""}
          </div>
        `;return`
        <article class="work-card${s.archived?" archived":""}" data-work-id="${n(s.id)}" tabindex="0" role="button" aria-label="${n(r("worksOpenDetail"))}">
          <div class="work-visual" data-work-detail="${n(s.id)}" ${i.imageFallbackContainerAttrs()}>
            <label class="work-select"><input type="checkbox" data-work-select="${n(s.id)}"${e.worksSelected.has(String(s.id))?" checked":""}></label>
            <img src="${n(i.imageVariantUrl(s.images[0]))}" ${i.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${n(M(s.prompt,80))}">
            <span class="work-type-badge ${T?"image":"text"}">${n(r(T?"imageToImage":"textToImage"))}</span>
            ${s.isPublic?`<span class="work-visibility-badge published">${n(r("publishedImage"))}</span>`:""}
            ${s.archived?`<span class="work-visibility-badge archived">${e.lang==="zh"?"已归档":"Archived"}</span>`:""}
            ${Q}
          </div>
          <div class="work-body">
            <p>${n(M(s.prompt,92))}</p>
            <span>${n(S(s.time))}${s.isPublic?` · ${r("publishToSquare")}${n(p)}${y?` · ${n(y)}`:""}`:""}</span>
            <div class="work-actions">
              <a href="${n(s.images[0])}" download="${n(s.id)}.png"><i class="ri-download-line"></i>${r("download")}</a>
              <button type="button" data-work-detail="${n(s.id)}"><i class="ri-eye-line"></i>${r("worksOpenDetail")}</button>
              <button type="button" data-work-retry="${n(s.id)}"><i class="ri-refresh-line"></i>${r("retry")}</button>
              <button type="button" data-work-editor="${n(s.id)}"><i class="ri-magic-line"></i>${r("openEditor")}</button>
              ${s.isPublic&&i.canUserUnpublishPublicWork()?`<button type="button" data-work-withdraw="${n(s.id)}"><i class="ri-eye-off-line"></i>${r("unpublish")}</button>`:""}
            </div>
          </div>
        </article>
      `}).join(""),V(t)}function V(o){h("[data-work-select]",o).forEach(t=>{t.addEventListener("click",a=>a.stopPropagation()),t.addEventListener("change",()=>{t.checked?e.worksSelected.add(String(t.dataset.workSelect)):e.worksSelected.delete(String(t.dataset.workSelect)),N()})}),h("[data-work-detail]",o).forEach(t=>{t.addEventListener("click",a=>{a.stopPropagation(),z(t.dataset.workDetail)})}),h(".work-card",o).forEach(t=>{const a=()=>z(t.dataset.workId);t.addEventListener("click",a),t.addEventListener("keydown",l=>{(l.key==="Enter"||l.key===" ")&&(l.preventDefault(),a())})}),h("a, button",o).forEach(t=>{t.hasAttribute("data-work-detail")||t.addEventListener("click",a=>a.stopPropagation())}),h("[data-work-retry]",o).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(l=>String(l.id)===t.dataset.workRetry);a&&(b(),e.forceHero=!0,e.draftPrompt=a.prompt,i.setView("home"),i.syncComposers(),setTimeout(()=>i.submitGeneration(u(".composer",d.heroComposerMount)),80))})}),h("[data-work-editor]",o).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(l=>String(l.id)===t.dataset.workEditor);a?.images?.[0]&&(b(),i.openImageEditor(a.images[0],a.prompt))})}),h("[data-work-publish]",o).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(l=>String(l.id)===t.dataset.workPublish);a&&i.openPublishModal(a,!1)})}),h("[data-work-publish-original]",o).forEach(t=>{t.addEventListener("click",()=>{const a=e.history.find(l=>String(l.id)===t.dataset.workPublishOriginal);a&&i.openPublishModal(a,!0)})}),h("[data-work-withdraw]",o).forEach(t=>{t.addEventListener("click",()=>j(t.dataset.workWithdraw))})}function J(){return Math.max(1,Number(e.settings?.publicWithdrawalWindowHours||12))}function O(o){const t=J(),a=!o.publishedAt||Date.now()-new Date(o.publishedAt).getTime()<=t*60*60*1e3,l=e.lang==="zh"?`${t} 小时`:`${t} hour${t===1?"":"s"}`;return{withinWindow:a,message:a?e.lang==="zh"?`确认撤回公开？${l}内撤回会取消未入账奖励。`:`Unpublish this work? Pending reward will be cancelled within ${l}.`:e.lang==="zh"?`已超过 ${l}，将提交撤回申请。`:`More than ${l} passed. This will submit a withdrawal request.`}}async function j(o){if(!i.canUserUnpublishPublicWork()){k(e.lang==="zh"?"已关闭用户取消公开功能，请联系管理员处理。":"User unpublish is disabled; contact an admin.","ri-lock-line");return}const t=e.history.find(c=>String(c.id)===String(o));if(!t)return;const{withinWindow:a,message:l}=O(t);if(confirm(l))try{await f(`/api/images/${encodeURIComponent(o)}/withdrawal`,{method:"POST",body:JSON.stringify({reason:"user_request"})}),await i.loadHistory(),await i.loadPublicGallery(),$(!1),k(a?r("unpublishDone"):e.lang==="zh"?"撤回申请已提交":"Withdrawal request submitted","ri-checkbox-circle-line")}catch(c){k(c.message,"ri-error-warning-line")}}function N(){const o=u("[data-works-selection]",d.modalLayer);o&&(o.textContent=`${e.worksSelected.size} ${r("worksSelected")}`)}async function K(o){const t=Array.from(e.worksSelected);if(!t.length)return;if(o==="download"){X(t);return}const a=o==="unpublish"||o==="archive",l={publish:e.lang==="zh"?"公开":"publish",unpublish:e.lang==="zh"?"撤回公开":"unpublish",archive:e.lang==="zh"?"归档":"archive",unarchive:e.lang==="zh"?"取消归档":"unarchive"}[o]||o;if(!(a&&!confirm(`${e.lang==="zh"?"确认":"Confirm"}${l} ${t.length} ${e.lang==="zh"?"个作品？":"works?"}`)))try{const c=t.map(A).filter(Boolean),s=[...new Set(c.map(i.publicKindTagForItem))],m=s.length===1?i.publicTagsForKind(s[0],[]):[],p=((await f("/api/images/bulk",{method:"POST",body:JSON.stringify({generationIds:t,action:o,publicTags:m})})).results||[]).filter(y=>y.ok).length;e.worksSelected.clear(),await i.loadHistory(),await i.loadPublicGallery(),k(`${l}: ${p}/${t.length}`,"ri-checkbox-circle-line"),$(!1)}catch(c){k(c.message,"ri-error-warning-line")}}function A(o){return e.history.find(t=>String(t.id)===String(o))}function X(o){const t=o.map(A).filter(a=>a?.images?.[0]);t.forEach((a,l)=>{setTimeout(()=>{const c=document.createElement("a");c.href=a.images[0],c.download=`${a.id}.png`,c.rel="noreferrer",document.body.appendChild(c),c.click(),c.remove()},l*220)}),k(`${r("worksDownloadStarted")}: ${t.length}`,"ri-download-2-line")}function z(o,t={}){const a=A(o);if(!a?.images?.[0])return;const l=t.replaceRoute!==!1;D();const c=(a.publicTags||[]).map(i.displayTag).filter(Boolean),s=i.isImageToImageItem(a),m=a.creativeRoute?.length?a.creativeRoute:a.conversation?.length?a.conversation:i.conversationRouteForItem(a),T=[[r("model"),a.model||"-"],[r("size"),a.options?.size||"-"],[r("quality"),a.options?.quality||"-"],[r("background"),a.options?.background||"-"],[r("format"),a.options?.outputFormat||"-"],[r("elapsed"),a.elapsedMs?i.formatElapsed(a.elapsedMs):"-"]];if(d.modalLayer.insertAdjacentHTML("beforeend",`
        <div class="works-detail-backdrop" data-work-detail-close></div>
        <aside class="works-detail-drawer" role="dialog" aria-modal="true" aria-label="${n(r("worksDetailTitle"))}" data-work-id="${n(a.id)}">
          <button class="works-detail-close" type="button" data-work-detail-close><i class="ri-close-line"></i></button>
          <div class="works-detail-stage" ${i.imageFallbackContainerAttrs()}>
            <img src="${n(a.images[0])}" ${i.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${n(M(a.prompt,100))}">
          </div>
          <div class="works-detail-body">
            <div class="works-detail-title">
              <span class="work-type-badge ${s?"image":"text"}">${n(r(s?"imageToImage":"textToImage"))}</span>
              <h3>${n(r("worksDetailTitle"))}</h3>
              <p>${n(a.prompt||"")}</p>
            </div>
            <div class="works-detail-actions">
              <button type="button" data-work-detail-copy><i class="ri-file-copy-line"></i>${r("worksCopyPrompt")}</button>
              <a href="${n(a.images[0])}" download="${n(a.id)}.png"><i class="ri-download-line"></i>${r("download")}</a>
              <button type="button" data-work-detail-editor><i class="ri-magic-line"></i>${r("openEditor")}</button>
              <button type="button" data-work-detail-continue><i class="ri-refresh-line"></i>${r("worksContinue")}</button>
              ${i.isCanvasEntryHidden()?"":`<button type="button" data-work-detail-canvas><i class="ri-node-tree"></i>${r("addToCanvas")}</button>`}
            </div>
            <dl class="works-detail-meta">
              <dt>ID</dt><dd>${n(String(a.id))}</dd>
              <dt>${n(r("status"))}</dt><dd>${n(a.isPublic?r("publishedImage"):a.archived?e.lang==="zh"?"已归档":"Archived":r("worksFilterPrivate"))}</dd>
              <dt>${n(r("publicTags"))}</dt><dd>${c.length?c.map(n).join(" / "):"-"}</dd>
              <dt>${n(e.lang==="zh"?"创建时间":"Created")}</dt><dd>${n(S(a.time)||"-")}</dd>
              ${T.map(([p,y])=>`<dt>${n(p)}</dt><dd>${n(String(y||"-"))}</dd>`).join("")}
            </dl>
            ${a.sourceImageUrl?`<section class="works-detail-source" ${i.imageFallbackContainerAttrs()}><h4>${n(r("sourceImage"))}</h4><img src="${n(a.sourceImageUrl)}" ${i.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${n(r("sourceImage"))}"></section>`:""}
            ${m?.length?`
              <section class="works-detail-route">
                <h4>${n(r("routeTitle"))}</h4>
                ${m.map((p,y)=>`
                  <article>
                    <strong>${y+1}</strong>
                    <p>${n(p.prompt||a.prompt||"")}</p>
                  </article>
                `).join("")}
              </section>
            `:""}
          </div>
        </aside>
      `),h("[data-work-detail-close]",d.modalLayer).forEach(p=>p.addEventListener("click",D)),u("[data-work-detail-copy]",d.modalLayer)?.addEventListener("click",async()=>{await i.copyText(a.prompt||""),k(e.lang==="zh"?"提示词已复制":"Prompt copied","ri-file-copy-line")}),u("[data-work-detail-editor]",d.modalLayer)?.addEventListener("click",()=>{b(),i.openImageEditor(a.images[0],a.prompt)}),u("[data-work-detail-continue]",d.modalLayer)?.addEventListener("click",()=>{b(),e.forceHero=!0,e.draftPrompt=a.prompt,i.navigate("home"),i.syncComposers(),setTimeout(()=>u(".prompt-box",d.heroComposerMount)?.focus(),100)}),u("[data-work-detail-canvas]",d.modalLayer)?.addEventListener("click",()=>{i.openCanvasTargetModal(i.canvasPayloadFromGeneration(a,r("worksDetailTitle")))}),l&&!e.routeSyncing){const p=i.routeState({modal:"works",workDetailId:a.id});w.history?.pushState?.(p,"",i.routeUrl(p))}}function D(){if(u(".works-detail-drawer",d.modalLayer)?.remove(),u(".works-detail-backdrop",d.modalLayer)?.remove(),!e.routeSyncing&&u(".works-modal",d.modalLayer)&&w.history?.pushState){const o=i.routeState({modal:"works",workDetailId:""});w.history.replaceState(o,"",i.routeUrl(o))}}function _(){d.contactBtn.addEventListener("click",P),d.accountContactBtn?.addEventListener("click",()=>{v(),P()}),d.accountMenuBtn?.addEventListener("click",o=>{o.stopPropagation();const t=d.accountMenu?.classList.contains("hidden");d.accountMenu?.classList.toggle("hidden",!t),d.accountMenuBtn?.setAttribute("aria-expanded",t?"true":"false")}),document.addEventListener("click",o=>{!d.accountMenuWrap||d.accountMenuWrap.contains(o.target)||v()}),d.loginBtn.addEventListener("click",()=>L("login")),d.logoutBtn.addEventListener("click",()=>{v(),R()}),d.creditsBtn.addEventListener("click",()=>{v(),C()}),d.myWorksBtn.addEventListener("click",()=>{v(),e.sessionDrawerLocked=!1,q()}),d.adminBtn.addEventListener("click",()=>{v(),w.location.href="/admin"})}return{api:f,closeAccountMenu:v,openAuthModal:L,submitAuth:W,logout:R,loadCreditDetails:B,openCreditsModal:C,submitCheckin:H,openContactModal:P,openMyWorksModal:q,loadMyWorks:$,openWorkDetail:z,closeWorkDetail:D,withdrawalPromptForItem:O,requestWorkWithdrawal:j,bindAccountEvents:_}}const U={create:G,readCookie:F};typeof E.register=="function"?E.register("auth",U):E.auth=Object.freeze({...E.auth||{},...U})})(window);
