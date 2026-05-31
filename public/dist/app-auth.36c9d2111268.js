(function(k){"use strict";const S=k.AppModules||(k.AppModules={}),p=(r,e=document)=>e.querySelector(r),m=(r,e=document)=>Array.from(e.querySelectorAll(r));function U(r){const e=document.cookie.split(";").map(l=>l.trim()).filter(Boolean).map(l=>l.split("=")).find(([l])=>decodeURIComponent(l)===r);return e?decodeURIComponent(e.slice(1).join("=")):""}function w(r,e){const l=r[e];if(l==null)throw new Error(`AppModules.auth missing context: ${e}`);return l}function K(r={}){const e=w(r,"state"),l=w(r,"elements"),s=w(r,"text"),n=w(r,"escapeHtml"),I=w(r,"formatDate"),A=w(r,"truncate"),X=w(r,"maskContactEmail"),C=w(r,"openModal"),b=w(r,"closeModal"),g=w(r,"showToast");async function f(i,a={}){const t=String(a.method||"GET").toUpperCase(),c={"Content-Type":"application/json",...a.headers||{}};["GET","HEAD","OPTIONS"].includes(t)||(c["X-CSRF-Token"]=e.csrfToken||U("csrf"));const d=await fetch(i,{...a,credentials:"same-origin",headers:c});if(d.status===204)return null;const u=await d.json().catch(()=>({}));if(u.csrfToken&&(e.csrfToken=u.csrfToken),!d.ok){const $=(u.details?.requiredMode||u.details?.audit?.requiredMode||"")==="image-to-image"?e.lang==="zh"?"提示词与已有公开内容高度相似，请改用图生图或含原图发布。":"This prompt is highly similar to existing public content. Publish it as image-to-image instead.":u.error||"Request failed",o=new Error($);throw o.status=d.status,o.details=u.details||null,o}return u}function E(){l.accountMenu?.classList.add("hidden"),l.accountMenuBtn?.setAttribute("aria-expanded","false")}function L(i=e.authMode){e.authMode=i;const a=i==="register";C(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-sparkling-2-fill"></i>
            <h2>${s(a?"registerTitle":"loginTitle")}</h2>
            <p><i class="ri-gift-line"></i> ${s("authGift")}</p>
            <p class="auth-bonus"><i class="ri-flashlight-line"></i> ${s("authBonus")}</p>
          </div>
          <div class="auth-tabs">
            <button type="button" class="${a?"":"active"}" data-auth-mode="login">${s("submitLogin")}</button>
            <button type="button" class="${a?"active":""}" data-auth-mode="register">${s("submitRegister")}</button>
          </div>
          <form id="authForm" class="modal-form">
            ${a?`<label>${s("name")}<input id="authName" autocomplete="name"></label>`:""}
            <label>${s("email")}<input id="authEmail" type="email" autocomplete="email" required></label>
            <label>${s("password")}<input id="authPassword" type="password" autocomplete="${a?"new-password":"current-password"}" required></label>
            <button class="modal-primary" type="submit">${s(a?"submitRegister":"submitLogin")}</button>
            <button class="link-button" type="button" data-auth-mode="${a?"login":"register"}">
              ${s(a?"switchToLogin":"switchToRegister")}
            </button>
            <button class="link-button" type="button" data-close-auth>${s("skip")}</button>
          </form>
        </section>
      `),m("[data-auth-mode]",l.modalLayer).forEach(t=>{t.addEventListener("click",()=>L(t.dataset.authMode))}),p("[data-close-auth]",l.modalLayer).addEventListener("click",b),p("#authForm").addEventListener("submit",R)}async function R(i){i.preventDefault();const a=i.currentTarget.querySelector("button[type='submit']");a.disabled=!0;try{const t={email:p("#authEmail").value,password:p("#authPassword").value,name:p("#authName")?.value||""},c=await f(`/api/auth/${e.authMode}`,{method:"POST",body:JSON.stringify(t)});if(c.pendingApproval){g(e.lang==="zh"?"账号已创建，等待管理员启用":"Account created, waiting for approval","ri-time-line"),b();return}e.user=c.user,r.setCurrentCacheUser();const d=await f("/api/auth/me");e.settings=d.settings,e.firstRun=d.firstRun,e.checkin=d.checkin||e.checkin,await r.loadHistory(),r.ensureImageSessions(),await r.loadAnnouncements(),b();const u=e.pendingAuthView;e.pendingAuthView="",e.forceHero=!u,r.renderAll(),u==="canvas-v2"?k.location.assign(r.canvasV2ProjectUrl()):u&&r.navigate(u,{scrollTop:!0}),setTimeout(r.maybeOpenUnreadAnnouncementModal,300),k.scrollTo({top:0,behavior:"auto"}),r.restartHeroVideo()}catch(t){g(t.message,"ri-error-warning-line")}finally{a.disabled=!1}}async function H(){const i=e.user?.id||e.user?.email||"";await f("/api/auth/logout",{method:"POST"}).catch(()=>null),await r.cacheDb()?.clearUserCache?.(i),e.user=null,r.setCurrentCacheUser(null),e.history=[],e.imageSessions=[],e.activeImageSessionId="",e.announcements=[],e.unreadAnnouncements=[],e.notificationModalShown.clear(),e.checkin={checkedInToday:!1,credit:e.settings?.checkinCredit||1},e.forceHero=!0,r.renderAll(),k.scrollTo({top:0,behavior:"auto"}),r.restartHeroVideo()}async function O(){try{return await f("/api/credits/detail?limit=80")}catch(i){return console.warn("[credits]",i),{ledger:[],rewards:[]}}}async function M(){if(!e.user){L("login");return}const i=await O();C(k.ImageStudioCreditsDetail.renderModal({details:i,state:e,helpers:{escapeHtml:n,text:s,formatDate:I}})),p("[data-checkin]",l.modalLayer)?.addEventListener("click",B),p("[data-close-auth]",l.modalLayer).addEventListener("click",b)}async function B(i){const a=i.currentTarget;a.disabled=!0;try{const t=await f("/api/checkin",{method:"POST"});e.user=t.user||{...e.user,credits:t.credits},r.setCurrentCacheUser(),e.checkin=t.checkin||{checkedInToday:!0,credit:e.checkin?.credit||1},g(t.checkedIn?e.lang==="zh"?`签到成功，获得 ${t.awarded} 积分`:`Checked in, +${t.awarded} credit`:s("checkedIn"),"ri-calendar-check-line"),r.updateNav(),M()}catch(t){g(t.message,"ri-error-warning-line"),a.disabled=!1}}function F(){const i=String(e.settings?.contactEmail??e.settings?.contactAdminEmail??"").trim();if(!i)return;const a=`mailto:${i}?subject=${encodeURIComponent("ai-image-studio support")}`,t=X(i);C(`
        <section class="modal">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="modal-title">
            <i class="ri-customer-service-2-line" style="color:#1677ff"></i>
            <h2>${s("contactTitle")}</h2>
            <p>${s("contactDesc")}</p>
          </div>
          <div class="contact-card">
            <span>${n(s("contactEmailLabel"))}</span>
            <a class="contact-email" href="${n(a)}">${n(t)}</a>
            <button class="contact-copy" type="button" data-copy-contact-email>${n(s("contactCopy"))}</button>
          </div>
          <button class="modal-secondary" type="button" data-close-auth>${s("close")}</button>
        </section>
      `),p("[data-copy-contact-email]",l.modalLayer).addEventListener("click",async()=>{typeof r.copyText=="function"?await r.copyText(i):await navigator.clipboard?.writeText(i),g(s("contactCopied"),"ri-file-copy-line")}),p("[data-close-auth]",l.modalLayer).addEventListener("click",b)}function q(i={}){if(!e.user){L("login");return}r.syncThemeMobileNav("works");const a=i.replaceRoute!==!1;e.worksFilter=e.worksFilter||"all",e.worksDateFilter=e.worksDateFilter||"all",e.worksTagFilter=e.worksTagFilter||"all";const t=[{id:"all",label:s("worksFilterAll")},{id:"public",label:s("worksFilterPublic")},{id:"private",label:s("worksFilterPrivate")},{id:"text",label:s("worksFilterText")},{id:"image",label:s("worksFilterImage")},{id:"archived",label:s("worksFilterArchived")}],c=Q();if(C(`
        <section class="modal works-modal works-workspace">
          <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
          <div class="works-head">
            <div>
              <h2>${s("myWorks")}</h2>
              <p>${e.lang==="zh"?"按类型、日期、标签管理作品，批量导出或删除私有历史。":"Manage works by type, date, and tag, then export or delete private history in bulk."}</p>
            </div>
            <button class="btn btn--ghost btn--icon ghost-button works-refresh" type="button" data-works-refresh><i class="ri-refresh-line"></i></button>
          </div>
          <div class="works-toolbar">
            <label class="works-search"><i class="ri-search-line"></i><input id="worksSearchInput" value="${n(e.worksSearch||"")}" placeholder="${e.lang==="zh"?"搜索提示词、标签或时间":"Search prompt, tags, or date"}"></label>
            <div class="works-library-filters" aria-label="${n(e.lang==="zh"?"资产库筛选":"Library filters")}">
              <label>${e.lang==="zh"?"日期":"Date"}<select id="worksDateFilter">
                ${[["all",e.lang==="zh"?"全部日期":"All dates"],["today",e.lang==="zh"?"今天":"Today"],["7d",e.lang==="zh"?"近 7 天":"Last 7 days"],["30d",e.lang==="zh"?"近 30 天":"Last 30 days"]].map(([d,u])=>`<option value="${d}"${e.worksDateFilter===d?" selected":""}>${n(u)}</option>`).join("")}
              </select></label>
              <label>${e.lang==="zh"?"标签":"Tag"}<select id="worksTagFilter">
                <option value="all"${e.worksTagFilter==="all"?" selected":""}>${e.lang==="zh"?"全部标签":"All tags"}</option>
                ${c.map(d=>`<option value="${n(d.value)}"${e.worksTagFilter===d.value?" selected":""}>${n(d.label)}</option>`).join("")}
              </select></label>
            </div>
            <div class="works-bulk-actions">
              <span data-works-selection>0 ${s("worksSelected")}</span>
              <button type="button" data-works-bulk="export"><i class="ri-download-2-line"></i>${s("worksBatchExport")}</button>
              <button type="button" data-works-bulk="publish"><i class="ri-gallery-upload-line"></i>${s("publishImage")}</button>
              ${r.canUserUnpublishPublicWork()?`<button type="button" data-works-bulk="unpublish"><i class="ri-eye-off-line"></i>${s("unpublish")}</button>`:""}
              <button type="button" data-works-bulk="archive"><i class="ri-archive-line"></i>${e.lang==="zh"?"归档":"Archive"}</button>
              <button type="button" data-works-bulk="unarchive"><i class="ri-inbox-unarchive-line"></i>${e.lang==="zh"?"取消归档":"Unarchive"}</button>
              <button type="button" data-works-bulk="delete" class="works-danger-action"><i class="ri-delete-bin-6-line"></i>${s("worksBatchDelete")}</button>
            </div>
          </div>
          <div class="works-filter-bar" role="tablist">
            ${t.map(d=>`<button type="button" data-works-filter="${d.id}" class="works-filter-btn${e.worksFilter===d.id?" active":""}">${n(d.label)}</button>`).join("")}
          </div>
          <p class="works-mobile-hint">${e.lang==="zh"?"左右滑动浏览作品，点击卡片打开详情。":"Swipe through works. Tap a card to open details."}</p>
          <div id="worksGrid" class="works-grid"><div class="empty-message">${s("loadingPrompts")}</div></div>
        </section>
      `),p("[data-works-refresh]",l.modalLayer).addEventListener("click",()=>y(!0)),p("#worksSearchInput",l.modalLayer).addEventListener("input",d=>{e.worksSearch=d.target.value,y(!1)}),p("#worksDateFilter",l.modalLayer).addEventListener("change",d=>{e.worksDateFilter=d.target.value||"all",e.worksSelected.clear(),y(!1)}),p("#worksTagFilter",l.modalLayer).addEventListener("change",d=>{e.worksTagFilter=d.target.value||"all",e.worksSelected.clear(),y(!1)}),m("[data-works-filter]",l.modalLayer).forEach(d=>{d.addEventListener("click",()=>{e.worksFilter=d.dataset.worksFilter||"all",m("[data-works-filter]",l.modalLayer).forEach(u=>{u.classList.toggle("active",u===d)}),y(!1)})}),m("[data-works-bulk]",l.modalLayer).forEach(d=>{d.addEventListener("click",()=>x(d.dataset.worksBulk))}),y(!1),a&&!e.routeSyncing){const d=r.routeState({modal:"works"});k.history?.pushState?.(d,"",r.routeUrl(d))}}async function y(i=!1){const a=p("#worksGrid",l.modalLayer);if(!a)return;a.innerHTML=`<div class="empty-message">${s("loadingPrompts")}</div>`,i&&await r.loadHistory();const t=e.worksFilter||"all",c=String(e.worksSearch||"").trim().toLowerCase(),d=e.worksDateFilter||"all",u=String(e.worksTagFilter||"all"),v=_(d),$=[...e.history].filter(o=>o.status==="done"&&o.images?.[0]).filter(o=>{const h=r.isImageToImageItem(o);switch(t){case"public":return!!o.isPublic&&!o.archived;case"private":return!o.isPublic&&!o.archived;case"text":return!h&&!o.archived;case"image":return h&&!o.archived;case"archived":return!!o.archived;default:return!o.archived}}).filter(o=>{if(!v)return!0;const h=new Date(o.time||0).getTime();return Number.isFinite(h)&&h>=v}).filter(o=>u==="all"?!0:(o.publicTags||[]).some(h=>j(h)===u)).filter(o=>c?[o.prompt,I(o.time),...(o.publicTags||[]).map(r.displayTag)].some(h=>String(h||"").toLowerCase().includes(c)):!0).sort((o,h)=>new Date(h.time||0)-new Date(o.time||0));if(V(),!$.length){a.innerHTML=`<div class="empty-message">${s(t==="all"?"emptyWorks":"worksFilterEmpty")}</div>`;return}a.innerHTML=$.map(o=>{const h=!!(o.sourceImageData||o.sourceImageUrl),T=r.isImageToImageItem(o),ie=o.publicTags?.length?` · ${o.publicTags.map(r.displayTag).join(" / ")}`:"",J=o.isPublic?r.publicRewardLabel(o):"",re=`
          <div class="work-image-tools">
            <button type="button" data-work-publish="${n(o.id)}">
              <i class="${o.isPublic?"ri-price-tag-3-line":"ri-gallery-upload-line"}"></i>
              ${o.isPublic?s("editPublicTags"):s("publishImage")}
            </button>
            ${h&&!o.publishOriginal?`<button type="button" data-work-publish-original="${n(o.id)}"><i class="ri-image-add-line"></i>${s("publishWithOriginal")}</button>`:""}
          </div>
        `;return`
        <article class="work-card${o.archived?" archived":""}" data-work-id="${n(o.id)}" tabindex="0" role="button" aria-label="${n(s("worksOpenDetail"))}">
          <div class="work-visual" data-work-detail="${n(o.id)}" ${r.imageFallbackContainerAttrs()}>
            <label class="work-select"><input type="checkbox" data-work-select="${n(o.id)}"${e.worksSelected.has(String(o.id))?" checked":""}></label>
            <img src="${n(r.imageVariantUrl(o.images[0]))}" ${r.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${n(A(o.prompt,80))}">
            <span class="work-type-badge ${T?"image":"text"}">${n(s(T?"imageToImage":"textToImage"))}</span>
            ${o.isPublic?`<span class="work-visibility-badge published">${n(s("publishedImage"))}</span>`:""}
            ${o.archived?`<span class="work-visibility-badge archived">${e.lang==="zh"?"已归档":"Archived"}</span>`:""}
            ${re}
          </div>
          <div class="work-body">
            <p>${n(A(o.prompt,92))}</p>
            <span>${n(I(o.time))}${o.isPublic?` · ${s("publishToSquare")}${n(ie)}${J?` · ${n(J)}`:""}`:""}</span>
            <div class="work-actions">
              <a href="${n(o.images[0])}" download="${n(o.id)}.png"><i class="ri-download-line"></i>${s("download")}</a>
              <button type="button" data-work-detail="${n(o.id)}"><i class="ri-eye-line"></i>${s("worksOpenDetail")}</button>
              <button type="button" data-work-retry="${n(o.id)}"><i class="ri-refresh-line"></i>${s("retry")}</button>
              <button type="button" data-work-editor="${n(o.id)}"><i class="ri-magic-line"></i>${s("openEditor")}</button>
              ${o.isPublic&&r.canUserUnpublishPublicWork()?`<button type="button" data-work-withdraw="${n(o.id)}"><i class="ri-eye-off-line"></i>${s("unpublish")}</button>`:""}
            </div>
          </div>
        </article>
      `}).join(""),Y(a)}function _(i){const a=Date.now();if(i==="today"){const t=new Date;return t.setHours(0,0,0,0),t.getTime()}return i==="7d"?a-7*24*60*60*1e3:i==="30d"?a-30*24*60*60*1e3:0}function j(i){return i&&typeof i=="object"?String(i.slug||i.id||i.label||i.name||"").trim():String(i||"").trim()}function Q(){const i=new Map;for(const a of e.history||[])for(const t of a.publicTags||[]){const c=j(t);c&&i.set(c,r.displayTag(t))}return[...i.entries()].map(([a,t])=>({value:a,label:t||a})).sort((a,t)=>a.label.localeCompare(t.label,e.lang==="zh"?"zh-Hans-CN":"en"))}function Y(i){m("[data-work-select]",i).forEach(a=>{a.addEventListener("click",t=>t.stopPropagation()),a.addEventListener("change",()=>{a.checked?e.worksSelected.add(String(a.dataset.workSelect)):e.worksSelected.delete(String(a.dataset.workSelect)),V()})}),m("[data-work-detail]",i).forEach(a=>{a.addEventListener("click",t=>{t.stopPropagation(),D(a.dataset.workDetail)})}),m(".work-card",i).forEach(a=>{const t=()=>D(a.dataset.workId);a.addEventListener("click",t),a.addEventListener("keydown",c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),t())})}),m("a, button",i).forEach(a=>{a.hasAttribute("data-work-detail")||a.addEventListener("click",t=>t.stopPropagation())}),m("[data-work-retry]",i).forEach(a=>{a.addEventListener("click",()=>{const t=e.history.find(c=>String(c.id)===a.dataset.workRetry);t&&(b(),e.forceHero=!0,e.draftPrompt=t.prompt,r.setView("home"),r.syncComposers(),setTimeout(()=>r.submitGeneration(p(".composer",l.heroComposerMount)),80))})}),m("[data-work-editor]",i).forEach(a=>{a.addEventListener("click",()=>{const t=e.history.find(c=>String(c.id)===a.dataset.workEditor);t?.images?.[0]&&(b(),r.openImageEditor(t.images[0],t.prompt))})}),m("[data-work-publish]",i).forEach(a=>{a.addEventListener("click",()=>{const t=e.history.find(c=>String(c.id)===a.dataset.workPublish);t&&r.openPublishModal(t,!1)})}),m("[data-work-publish-original]",i).forEach(a=>{a.addEventListener("click",()=>{const t=e.history.find(c=>String(c.id)===a.dataset.workPublishOriginal);t&&r.openPublishModal(t,!0)})}),m("[data-work-withdraw]",i).forEach(a=>{a.addEventListener("click",()=>G(a.dataset.workWithdraw))})}function Z(){return Math.max(1,Number(e.settings?.publicWithdrawalWindowHours||12))}function N(i){const a=Z(),t=!i.publishedAt||Date.now()-new Date(i.publishedAt).getTime()<=a*60*60*1e3,c=e.lang==="zh"?`${a} 小时`:`${a} hour${a===1?"":"s"}`;return{withinWindow:t,message:t?e.lang==="zh"?`确认撤回公开？${c}内撤回会取消未入账奖励。`:`Unpublish this work? Pending reward will be cancelled within ${c}.`:e.lang==="zh"?`已超过 ${c}，将提交撤回申请。`:`More than ${c} passed. This will submit a withdrawal request.`}}async function G(i){if(!r.canUserUnpublishPublicWork()){g(e.lang==="zh"?"已关闭用户取消公开功能，请联系管理员处理。":"User unpublish is disabled; contact an admin.","ri-lock-line");return}const a=e.history.find(d=>String(d.id)===String(i));if(!a)return;const{withinWindow:t,message:c}=N(a);if(confirm(c))try{await f(`/api/images/${encodeURIComponent(i)}/withdrawal`,{method:"POST",body:JSON.stringify({reason:"user_request"})}),await r.loadHistory(),await r.loadPublicGallery(),y(!1),g(t?s("unpublishDone"):e.lang==="zh"?"撤回申请已提交":"Withdrawal request submitted","ri-checkbox-circle-line")}catch(d){g(d.message,"ri-error-warning-line")}}function V(){const i=p("[data-works-selection]",l.modalLayer);i&&(i.textContent=`${e.worksSelected.size} ${s("worksSelected")}`)}async function x(i){const a=Array.from(e.worksSelected);if(!a.length)return;if(i==="export"){await te(a);return}const t=i==="unpublish"||i==="archive"||i==="delete",c={publish:e.lang==="zh"?"公开":"publish",unpublish:e.lang==="zh"?"撤回公开":"unpublish",archive:e.lang==="zh"?"归档":"archive",unarchive:e.lang==="zh"?"取消归档":"unarchive",delete:e.lang==="zh"?"删除私有历史":"delete private history"}[i]||i,d=i==="delete"?e.lang==="zh"?`删除会把 ${a.length} 个作品移入已归档，不会清除审计文件；已公开作品会按撤回规则处理。继续？`:`Delete moves ${a.length} works to archived history and keeps audit files. Published works follow unpublish policy. Continue?`:`${e.lang==="zh"?"确认":"Confirm"}${c} ${a.length} ${e.lang==="zh"?"个作品？":"works?"}`;if(!(t&&!confirm(d)))try{const u=a.map(P).filter(Boolean),v=[...new Set(u.map(r.publicKindTagForItem))],$=v.length===1?r.publicTagsForKind(v[0],[]):[],h=((await f("/api/images/bulk",{method:"POST",body:JSON.stringify({generationIds:a,action:i,publicTags:$})})).results||[]).filter(T=>T.ok).length;e.worksSelected.clear(),await r.loadHistory(),await r.loadPublicGallery(),g(`${c}: ${h}/${a.length}`,"ri-checkbox-circle-line"),y(!1)}catch(u){g(u.message,"ri-error-warning-line")}}function P(i){return e.history.find(a=>String(a.id)===String(i))}function ee(i){const a=i.map(P).filter(t=>t?.images?.[0]);a.forEach((t,c)=>{setTimeout(()=>{const d=document.createElement("a");d.href=t.images[0],d.download=`${t.id}.png`,d.rel="noreferrer",document.body.appendChild(d),d.click(),d.remove()},c*220)}),g(`${s("worksDownloadStarted")}: ${a.length}`,"ri-download-2-line")}async function te(i){try{const t=((await f("/api/images/bulk",{method:"POST",body:JSON.stringify({generationIds:i,action:"export"})})).export?.items||[]).map(c=>c.id);ee(t.length?t:i)}catch(a){g(a.message,"ri-error-warning-line")}}function D(i,a={}){const t=P(i);if(!t?.images?.[0])return;const c=a.replaceRoute!==!1;z();const d=(t.publicTags||[]).map(r.displayTag).filter(Boolean),u=r.isImageToImageItem(t),v=t.creativeRoute?.length?t.creativeRoute:t.conversation?.length?t.conversation:r.conversationRouteForItem(t),$=window.ImageStudioReferenceImages?.renderAssetStrip?.(t.referenceAssets||[],{className:"works-detail-reference-assets",label:s("reference"),escapeHtml:n,imageFallbackContainerAttrs:r.imageFallbackContainerAttrs,imageFallbackImgAttrs:r.imageFallbackImgAttrs})||"",o=[[s("model"),t.model||"-"],[s("size"),t.options?.size||"-"],[s("quality"),t.options?.quality||"-"],[s("background"),t.options?.background||"-"],[s("format"),t.options?.outputFormat||"-"],[s("elapsed"),t.elapsedMs?r.formatElapsed(t.elapsedMs):"-"]];if(l.modalLayer.insertAdjacentHTML("beforeend",`
        <div class="works-detail-backdrop" data-work-detail-close></div>
        <aside class="works-detail-drawer" role="dialog" aria-modal="true" aria-label="${n(s("worksDetailTitle"))}" data-work-id="${n(t.id)}">
          <button class="works-detail-close" type="button" data-work-detail-close><i class="ri-close-line"></i></button>
          <div class="works-detail-stage" ${r.imageFallbackContainerAttrs()}>
            <img src="${n(t.images[0])}" ${r.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${n(A(t.prompt,100))}">
          </div>
          <div class="works-detail-body">
            <div class="works-detail-title">
              <span class="work-type-badge ${u?"image":"text"}">${n(s(u?"imageToImage":"textToImage"))}</span>
              <h3>${n(s("worksDetailTitle"))}</h3>
              <p>${n(t.prompt||"")}</p>
            </div>
            <div class="works-detail-actions">
              <button type="button" data-work-detail-copy><i class="ri-file-copy-line"></i>${s("worksCopyPrompt")}</button>
              <a href="${n(t.images[0])}" download="${n(t.id)}.png"><i class="ri-download-line"></i>${s("download")}</a>
              <button type="button" data-work-detail-editor><i class="ri-magic-line"></i>${s("openEditor")}</button>
              <button type="button" data-work-detail-continue><i class="ri-refresh-line"></i>${s("worksContinue")}</button>
              ${r.isCanvasEntryHidden()?"":`<button type="button" data-work-detail-canvas><i class="ri-node-tree"></i>${s("addToCanvas")}</button>`}
            </div>
            <dl class="works-detail-meta">
              <dt>ID</dt><dd>${n(String(t.id))}</dd>
              <dt>${n(s("status"))}</dt><dd>${n(t.isPublic?s("publishedImage"):t.archived?e.lang==="zh"?"已归档":"Archived":s("worksFilterPrivate"))}</dd>
              <dt>${n(s("publicTags"))}</dt><dd>${d.length?d.map(n).join(" / "):"-"}</dd>
              <dt>${n(e.lang==="zh"?"创建时间":"Created")}</dt><dd>${n(I(t.time)||"-")}</dd>
              ${o.map(([h,T])=>`<dt>${n(h)}</dt><dd>${n(String(T||"-"))}</dd>`).join("")}
            </dl>
            ${t.sourceImageUrl?`<section class="works-detail-source" ${r.imageFallbackContainerAttrs()}><h4>${n(s("sourceImage"))}</h4><img src="${n(t.sourceImageUrl)}" ${r.imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${n(s("sourceImage"))}"></section>`:""}
            ${$}
            ${v?.length?`
              <section class="works-detail-route">
                <h4>${n(s("routeTitle"))}</h4>
                ${v.map((h,T)=>`
                  <article>
                    <strong>${T+1}</strong>
                    <p>${n(h.prompt||t.prompt||"")}</p>
                  </article>
                `).join("")}
              </section>
            `:""}
          </div>
        </aside>
      `),m("[data-work-detail-close]",l.modalLayer).forEach(h=>h.addEventListener("click",z)),p("[data-work-detail-copy]",l.modalLayer)?.addEventListener("click",async()=>{await r.copyText(t.prompt||""),g(e.lang==="zh"?"提示词已复制":"Prompt copied","ri-file-copy-line")}),p("[data-work-detail-editor]",l.modalLayer)?.addEventListener("click",()=>{b(),r.openImageEditor(t.images[0],t.prompt)}),p("[data-work-detail-continue]",l.modalLayer)?.addEventListener("click",()=>{b(),e.forceHero=!0,e.draftPrompt=t.prompt,r.navigate("home"),r.syncComposers(),setTimeout(()=>p(".prompt-box",l.heroComposerMount)?.focus(),100)}),p("[data-work-detail-canvas]",l.modalLayer)?.addEventListener("click",()=>{r.openCanvasTargetModal(r.canvasPayloadFromGeneration(t,s("worksDetailTitle")))}),c&&!e.routeSyncing){const h=r.routeState({modal:"works",workDetailId:t.id});k.history?.pushState?.(h,"",r.routeUrl(h))}}function z(){if(p(".works-detail-drawer",l.modalLayer)?.remove(),p(".works-detail-backdrop",l.modalLayer)?.remove(),!e.routeSyncing&&p(".works-modal",l.modalLayer)&&k.history?.pushState){const i=r.routeState({modal:"works",workDetailId:""});k.history.replaceState(i,"",r.routeUrl(i))}}function ae(){l.contactBtn.addEventListener("click",F),l.accountEmailText?.addEventListener("click",async()=>{const i=String(e.user?.email||"").trim();i&&(typeof r.copyText=="function"?await r.copyText(i):await navigator.clipboard?.writeText(i),g(s("contactCopied"),"ri-file-copy-line"))}),l.accountEmailText?.addEventListener("keydown",i=>{["Enter"," "].includes(i.key)&&(i.preventDefault(),l.accountEmailText.click())}),l.accountContactBtn?.addEventListener("click",()=>{E(),F()}),l.accountMenuBtn?.addEventListener("click",i=>{i.stopPropagation();const a=l.accountMenu?.classList.contains("hidden");l.accountMenu?.classList.toggle("hidden",!a),l.accountMenuBtn?.setAttribute("aria-expanded",a?"true":"false")}),document.addEventListener("click",i=>{!l.accountMenuWrap||l.accountMenuWrap.contains(i.target)||E()}),l.loginBtn.addEventListener("click",()=>L("login")),l.logoutBtn.addEventListener("click",()=>{E(),H()}),l.creditsBtn.addEventListener("click",()=>{E(),M()}),l.myWorksBtn.addEventListener("click",()=>{E(),e.sessionDrawerLocked=!1,q()}),l.adminBtn.addEventListener("click",()=>{E(),k.location.href="/admin"})}return{api:f,closeAccountMenu:E,openAuthModal:L,submitAuth:R,logout:H,loadCreditDetails:O,openCreditsModal:M,submitCheckin:B,openContactModal:F,openMyWorksModal:q,loadMyWorks:y,openWorkDetail:D,closeWorkDetail:z,withdrawalPromptForItem:N,requestWorkWithdrawal:G,bindAccountEvents:ae}}const W={create:K,readCookie:U};typeof S.register=="function"?S.register("auth",W):S.auth=Object.freeze({...S.auth||{},...W})})(window);
