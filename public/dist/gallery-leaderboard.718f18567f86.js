(function(b){"use strict";function k({state:a,text:r,escapeHtml:l,truncate:n,displayUserName:g,imageVariantUrl:t,imageFallbackImgAttrs:y,imageFallbackContainerAttrs:c}){const o=(Array.isArray(a.galleryLeaderboard)?a.galleryLeaderboard:[]).slice(0,99),d=[["day",a.lang==="zh"?"日榜":"Day"],["week",a.lang==="zh"?"周榜":"Week"],["month",a.lang==="zh"?"月榜":"Month"],["all",a.lang==="zh"?"总榜":"All-time"]],s=[["all",a.lang==="zh"?"全部":"All"],["text-to-image",r("textToImage")],["image-to-image",r("imageToImage")]];return`
      <aside class="gallery-leaderboard${a.galleryLeaderboardLoading?" loading":""}" aria-label="${l(r("galleryLeaderboard"))}">
        <div class="gallery-leaderboard-head">
          <div>
            <strong>${l(r("galleryLeaderboard"))}</strong>
            <span>${l(r("galleryLeaderboardDesc"))}</span>
          </div>
          <i class="ri-trophy-line"></i>
        </div>
        <div class="gallery-rank-tabs" aria-label="${l(r("galleryLeaderboard"))}">
          <div>
            ${d.map(([e,i])=>`<button type="button" data-rank-range="${e}" class="${a.galleryLeaderboardRange===e?"active":""}">${l(i)}</button>`).join("")}
          </div>
          <div>
            ${s.map(([e,i])=>`<button type="button" data-rank-type="${e}" class="${a.galleryLeaderboardType===e?"active":""}">${l(i)}</button>`).join("")}
          </div>
        </div>
        <div class="gallery-leaderboard-list">
          ${o.length?o.map((e,i)=>u({item:e,index:i,text:r,escapeHtml:l,truncate:n,displayUserName:g,imageVariantUrl:t,imageFallbackImgAttrs:y,imageFallbackContainerAttrs:c})).join(""):`<div class="gallery-rank-empty">${a.galleryLeaderboardLoading?a.lang==="zh"?"榜单加载中...":"Loading leaderboard...":a.lang==="zh"?"当前榜单暂无作品，可切换总榜查看全部高赞作品":"No ranked works in this range. Try All-time."}</div>`}
        </div>
      </aside>
    `}function p(a={}){const r=Array.isArray(a.images)?a.images:[];return a.imageUrl||a.coverUrl||a.preview||a.image||r[0]||""}function u({item:a,index:r,text:l,escapeHtml:n,truncate:g,displayUserName:t,imageVariantUrl:y,imageFallbackImgAttrs:c,imageFallbackContainerAttrs:$}){const o=a.kind==="prompt",d=a.title||g(a.prompt,44),s=p(a),e=o?`data-open-prompt="${n(a.promptId||String(a.id).replace(/^prompt_/,""))}"`:`data-open-square="${n(`square_${a.id}`)}"`,i=t(a),v=o?a.promptId||String(a.id).replace(/^prompt_/,""):a.id,L=o?"data-like-prompt":"data-like-gallery",h=`<button type="button" class="rank-like ${a.likedByCurrentUser?"liked":""}" ${L}="${n(v)}" aria-label="${n(a.likedByCurrentUser?l("unlikeImage"):l("likeImage"))}">
      <i class="${a.likedByCurrentUser?"ri-heart-fill":"ri-heart-line"}"></i>${Number(a.likeCount||0)}
    </button>`;return`
      <article class="gallery-rank-card ${r<3?`top-${r+1}`:""}">
        <span class="gallery-rank-index">#${r+1}</span>
        <button type="button" class="gallery-rank-visual" ${e} ${$()}>
          ${s?`<img src="${n(y(s))}" ${c()} loading="lazy" decoding="async" alt="${n(d)}">`:'<span class="gallery-rank-missing"><i class="ri-image-line"></i></span>'}
        </button>
        <div class="gallery-rank-copy">
          <p>${n(d)}</p>
          <small>${n(i)}</small>
        </div>
        <div class="gallery-rank-actions">${h}</div>
      </article>
    `}b.ImageStudioGalleryLeaderboard={render:k}})(window);
