(function(l){"use strict";function c({sessions:e=[],history:$=[],activeSessionId:g="",text:s,escapeHtml:n,truncate:d,imageVariantUrl:u,imageFallbackImgAttrs:p,imageFallbackContainerAttrs:m,lang:b="zh"}){const h=new Map($.map(i=>[String(i.id),i]));return e.length?e.map(i=>{const t=(i.generationIds||[]).map(o=>h.get(String(o))).filter(Boolean),a=[...t].reverse().find(o=>o.images?.[0]),y=t.at(-1)?.prompt||"",v=t.length,f=i.id===g?"active":"",r=b==="zh"?"编辑标题":"Edit title",S=a?`<img src="${n(u(a.images[0]))}" ${p()} loading="lazy" decoding="async" alt="${n(d(a.prompt,60))}">`:'<i class="ri-chat-3-line"></i>';return`
        <button class="chat-session-card ${f}" type="button" data-session-id="${n(i.id)}">
          <span class="session-thumb" ${m()}>${S}</span>
          <span class="session-copy">
            <strong>${n(i.title||s("sessionUntitled"))}</strong>
            <em>${v} ${s("roundCount")}</em>
            <small>${n(d(y||i.updatedAt||"",42))}</small>
          </span>
          <span class="session-actions">
            <span class="session-action" data-rename-session="${n(i.id)}" title="${n(r)}" aria-label="${n(r)}">
              <i class="ri-edit-2-line"></i>
            </span>
            <span class="session-action danger" data-delete-session="${n(i.id)}" title="${n(s("deleteConversation"))}" aria-label="${n(s("deleteConversation"))}">
              <i class="ri-delete-bin-line"></i>
            </span>
          </span>
        </button>
      `}).join(""):`<div class="session-empty">${s("emptyWorks")}</div>`}l.ImageStudioSessionList={render:c}})(window);
