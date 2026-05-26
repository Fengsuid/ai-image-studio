(function(p,y){"use strict";const b=p.ImageStudioCanvas||(p.ImageStudioCanvas={});function f({state:t,selectedNodes:n,selectedNode:e,labelFor:a,escapeHtml:o}){const r=y.querySelector("#canvasInspectorBody");if(!r)return;const d=n();if(d.length>1){r.innerHTML=`
        <div class="canvas-selection-summary">
          <strong>${d.length} nodes selected</strong>
          <span>Drag any selected node to move the group. Shift-drag on empty canvas to box select.</span>
        </div>
        <div class="canvas-inspector-actions">
          <button type="button" data-node-action="group"><i class="ri-folder-add-line"></i><span>Group</span></button>
          <button type="button" data-node-action="duplicate"><i class="ri-file-copy-line"></i><span>Copy</span></button>
          <button type="button" data-node-action="delete"><i class="ri-delete-bin-line"></i><span>Delete</span></button>
        </div>
      `;return}const i=e();if(!i){r.innerHTML="<p>Select a node to edit parameters.</p>";return}r.innerHTML=`
      <div class="canvas-inspector-actions">
        ${["config","output"].includes(i.type)?'<button type="button" data-node-action="run"><i class="ri-play-line"></i><span>Run</span></button>':""}
        ${i.type==="output"&&(i.data.generationIds||[]).length?'<button type="button" data-node-action="publish"><i class="ri-gallery-upload-line"></i><span>Publish</span></button>':""}
        <button type="button" data-node-action="duplicate"><i class="ri-file-copy-line"></i><span>Copy</span></button>
        <button type="button" data-node-action="lock"><i class="${i.locked?"ri-lock-unlock-line":"ri-lock-line"}"></i><span>${i.locked?"Unlock":"Lock"}</span></button>
        <button type="button" data-node-action="link"><i class="ri-link"></i><span>Start link</span></button>
        <button type="button" data-node-action="delete"><i class="ri-delete-bin-line"></i><span>Delete</span></button>
      </div>
      ${v({state:t,node:i,labelFor:a,escapeHtml:o})}
      ${u("title","Title",i.data.title||"",o)}
      ${$(i,o)}
    `}function v({state:t,node:n,labelFor:e,escapeHtml:a}){const o=t.edges.filter(s=>s.targetId===n.id),r=t.edges.filter(s=>s.sourceId===n.id),d=n.type==="config"?b.workflows.configInputSummary(t.nodes,t.edges,n.id):null,i=d?.hasConflict?'<div class="canvas-input-warning">Input conflict: keep one prompt and one image upstream.</div>':"",m=d?`<div class="canvas-upstream"><strong>${d.mode}</strong><span>${d.prompts.length} prompt · ${d.images.length} image</span></div>`:"",k=t.edgeError?`<div class="canvas-input-warning">${a(t.edgeError)}</div>`:"",I=t.pendingEdgeFrom?`<div class="canvas-linking">Linking from ${a(e(t.pendingEdgeFrom))}</div>`:"",g=[...o,...r].map(s=>{const h=s.sourceId===n.id?s.targetId:s.sourceId;return`<button type="button" data-edge-delete="${s.id}"><i class="ri-close-line"></i><span>${a(s.sourceId===n.id?"to":"from")} ${a(e(h))}</span></button>`}).join("");return`${k}${I}${m}${i}${g?`<div class="canvas-edge-list">${g}</div>`:""}`}function $(t,n){return t.type==="image"?u("imageUrl","Image URL",t.data.imageUrl||"",n)+l("body","Caption",t.data.body||"",n):t.type==="text"?l("body","Text",t.data.body||"",n):t.type==="prompt"?l("prompt","Prompt",t.data.prompt||t.data.body||"",n):t.type==="output"?c("status","Status",t.data.status||"idle",["idle","loading","success","error"])+l("body","Message",t.data.body||"",n):t.type==="group"?l("body","Description",t.data.body||"",n):u("model","Model",t.data.model||"GPT-IMAGE-2",n)+c("size","Size",t.data.size||"1024x1024",["1024x1024","1536x1024","1024x1536"])+c("quality","Quality",t.data.quality||"medium",["low","medium","high"])+c("candidateCount","Candidates",String(t.data.candidateCount||1),["1","2","3","4"])}function u(t,n,e,a){return`<label class="canvas-field"><span>${n}</span><input data-node-field="${t}" value="${a(e)}"></label>`}function l(t,n,e,a){return`<label class="canvas-field"><span>${n}</span><textarea data-node-field="${t}">${a(e)}</textarea></label>`}function c(t,n,e,a){return`<label class="canvas-field"><span>${n}</span><select data-node-field="${t}">${a.map(o=>`<option value="${o}"${String(e)===o?" selected":""}>${o}</option>`).join("")}</select></label>`}b.inspector={render:f}})(window,document);
