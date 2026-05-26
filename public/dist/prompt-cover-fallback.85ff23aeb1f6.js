(function(g){"use strict";function u(i=""){let e=2166136261;const n=String(i||"");for(let t=0;t<n.length;t+=1)e^=n.charCodeAt(t),e=Math.imul(e,16777619);return e>>>0}function a(i={}){const e=`${i.title||""}
${i.prompt||""}
${i.sourceRepo||i.source||""}`,n=u(e),t=n%360,o=(t+38+n%44)%360,l=/视频|video|shot|camera|film|cinematic/i.test(e)?"ri-movie-2-line":/UI|界面|app|web|dashboard|interface/i.test(e)?"ri-layout-4-line":/海报|poster|logo|brand|广告/i.test(e)?"ri-advertisement-line":/photo|摄影|portrait|人像/i.test(e)?"ri-camera-lens-line":"ri-image-edit-line";return{hue:t,hue2:o,icon:l,background:`linear-gradient(135deg, hsl(${t} 72% 24%), hsl(${o} 84% 46%))`,accent:`hsl(${(t+120)%360} 86% 72%)`}}function h(i=""){return String(i||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function p(i="",e=22,n=3){const t=String(i||"").replace(/\s+/g," ").trim();if(!t)return[];if(!/\s/.test(t))return Array.from({length:Math.min(n,Math.ceil(t.length/e))},(r,s)=>t.slice(s*e,(s+1)*e)).filter(Boolean);const o=[];let l="";for(const r of t.split(" ")){const s=l?`${l} ${r}`:r;if(s.length>e&&l?(o.push(l),l=r):l=s,o.length>=n)break}return l&&o.length<n&&o.push(l),o}function d(i={},{truncate:e}={}){const n=typeof e=="function"?e:(c="",f=80)=>String(c).slice(0,f),t=a(i),o=i.title||n(i.prompt||"",36)||"Prompt",l=n(i.prompt||o,110),r=p(o,24,3).map((c,f)=>`<tspan x="92" dy="${f===0?0:54}">${h(c)}</tspan>`).join(""),s=p(l,38,3).map((c,f)=>`<tspan x="92" dy="${f===0?0:31}">${h(c)}</tspan>`).join(""),$=/video|视频|film|movie|trailer/i.test(`${o} ${l}`)?"VIDEO":/ui|web|app|界面|dashboard/i.test(`${o} ${l}`)?"UI":/photo|摄影|portrait|人像/i.test(`${o} ${l}`)?"PHOTO":"PROMPT",x=`
      <svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="hsl(${t.hue} 72% 24%)"/>
            <stop offset="1" stop-color="hsl(${t.hue2} 84% 46%)"/>
          </linearGradient>
          <radialGradient id="glow" cx="72%" cy="16%" r="60%">
            <stop offset="0" stop-color="hsl(${(t.hue+120)%360} 92% 76%)" stop-opacity=".78"/>
            <stop offset=".52" stop-color="hsl(${(t.hue+72)%360} 88% 58%)" stop-opacity=".28"/>
            <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
          </radialGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#020617" flood-opacity=".28"/>
          </filter>
        </defs>
        <rect width="960" height="960" fill="url(#bg)"/>
        <rect width="960" height="960" fill="url(#glow)"/>
        <circle cx="778" cy="96" r="210" fill="#fff" opacity=".09"/>
        <circle cx="820" cy="138" r="118" fill="#fff" opacity=".12"/>
        <path d="M0 704 C180 606 330 698 504 628 C690 553 770 390 960 450 L960 960 L0 960 Z" fill="#020617" opacity=".22"/>
        <path d="M88 102 L872 102 L872 858 L88 858 Z" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>
        <g filter="url(#shadow)">
          <rect x="92" y="92" width="176" height="72" rx="36" fill="#fff" fill-opacity=".18"/>
          <text x="180" y="139" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="26" font-weight="800" letter-spacing="4">${$}</text>
        </g>
        <text x="92" y="544" fill="#fff" font-family="Georgia, serif" font-size="48" font-weight="700">${r}</text>
        <text x="92" y="738" fill="#fff" fill-opacity=".72" font-family="Arial, sans-serif" font-size="26" font-weight="600">${s}</text>
      </svg>
    `.replace(/\s{2,}/g," ").trim();return`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(x)}`}function y(i={},{escapeHtml:e,truncate:n}={}){const t=typeof e=="function"?e:(r="")=>String(r),o=typeof n=="function"?n:(r="",s=80)=>String(r).slice(0,s),l=i.title||o(i.prompt||"",30);return`<img class="prompt-cover-fallback-image" src="${t(d(i,{truncate:o}))}" loading="lazy" decoding="async" alt="${t(l)}">`}g.ImageStudioPromptCoverFallback={render:y,fallbackMeta:a,dataUrl:d}})(window);
