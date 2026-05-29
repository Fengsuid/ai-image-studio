(function(l){"use strict";function c({sessions:e=[],history:u=[],activeSessionId:$="",text:n,escapeHtml:t,truncate:d,imageVariantUrl:g,imageFallbackImgAttrs:b,imageFallbackContainerAttrs:p,lang:m="zh"}){const h=new Map(u.map(i=>[String(i.id),i]));return e.length?e.map(i=>{const s=(i.generationIds||[]).map(o=>h.get(String(o))).filter(Boolean),a=[...s].reverse().find(o=>o.images?.[0]),v=s.at(-1)?.prompt||"",y=s.length,f=i.id===$?"active":"",r=m==="zh"?"编辑标题":"Edit title",S=a?`<img src="${t(g(a.images[0]))}" ${b()} loading="lazy" decoding="async" alt="${t(d(a.prompt,60))}">`:'<i class="ri-chat-3-line"></i>';return`
        <div class="chat-session-card ${f}" role="button" tabindex="0" data-session-id="${t(i.id)}">
          <span class="session-thumb" ${p()}>${S}</span>
          <span class="session-copy">
            <strong>${t(i.title||n("sessionUntitled"))}</strong>
            <em>${y} ${n("roundCount")}</em>
            <small>${t(d(v||i.updatedAt||"",42))}</small>
          </span>
          <span class="session-actions">
            <button class="session-action" type="button" data-session-action data-rename-session="${t(i.id)}" title="${t(r)}" aria-label="${t(r)}">
              <i class="ri-edit-2-line"></i>
            </button>
            <button class="session-action danger" type="button" data-session-action data-delete-session="${t(i.id)}" title="${t(n("deleteConversation"))}" aria-label="${t(n("deleteConversation"))}">
              <i class="ri-delete-bin-line"></i>
            </button>
          </span>
        </div>
      `}).join(""):`<div class="session-empty">${n("emptyWorks")}</div>`}l.ImageStudioSessionList={render:c}})(window);
