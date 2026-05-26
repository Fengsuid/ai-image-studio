(function(){window.AdminModules=window.AdminModules||{},window.AdminModules.squareReview={render({state:n,helpers:o}){const{escapeHtml:a,fmtNumber:s,fmtDate:r,imageVariantUrl:l,toolbar:i,filtered:u,paged:c,pagination:d}=o,t=u(n.publicImages,["prompt","userName","id","moderationStatus"]);return`${i("搜索待审作品、作者或提示词",["reported","reviewing","requested","hidden","restored"])}
        <section class="admin-grid-list">
          ${c(t).map(e=>`
            <article class="admin-work-card">
              <img src="${a(l(e.imageUrl))}" alt="">
              <div>
                <strong>${a(e.userName||e.userId||"匿名")}</strong>
                <p>${a(e.prompt||"")}</p>
                <small>${r(e.createdAt)} · ${a(e.moderationStatus||"visible")} · 举报 ${s(e.reportCount||0)}</small>
                ${e.latestReportReason||e.moderationReason?`<small>${a(e.latestReportReason||e.moderationReason)}</small>`:""}
              </div>
              <div class="admin-card-actions">
                <button type="button" data-detail="work:${a(e.id)}">详情</button>
                ${e.moderationStatus==="hidden"?`<button type="button" data-moderation="restore:${a(e.id)}">恢复</button>`:Number(e.reportCount||0)>0?`<button type="button" data-moderation="hide:${a(e.id)}">确认隐藏</button><button type="button" data-moderation="reject:${a(e.id)}">驳回举报并恢复</button>`:`<button type="button" data-moderation="hide:${a(e.id)}">隐藏</button>`}
              </div>
            </article>
          `).join("")||'<div class="admin-empty-state">暂无待审核作品</div>'}
        </section>${d(t.length)}`}},window.AdminModules.galleryFiles={render({state:n,helpers:o}){const{escapeHtml:a,fmtNumber:s,fmtDate:r,toolbar:l,filtered:i,paged:u,pagination:c}=o,d=i(n.galleryFileChecks,["generationId","filename","relativePath","status","errorMessage","prompt","userName"]);return`${l("搜索作品 ID、文件名、作者或错误",["broken","ok","unknown"])}
        <section class="admin-panel">
          <div class="admin-panel-head">
            <div>
              <h2>画廊文件巡检</h2>
              <span>${s(n.galleryFileChecks.filter(t=>t.status==="broken").length)} 个异常文件</span>
            </div>
            <button type="button" data-gallery-file-check-run><i class="ri-loop-right-line"></i>运行巡检</button>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>作品</th><th>类型</th><th>文件</th><th>状态</th><th>大小</th><th>检查时间</th></tr></thead>
              <tbody>
                ${u(d).map(t=>`
                  <tr>
                    <td><strong>${a(t.generationId)}</strong><small class="admin-truncate">${a(t.prompt||t.userName||t.userEmail||"")}</small></td>
                    <td>${a(t.imageKind||"-")}</td>
                    <td><strong>${a(t.filename||"-")}</strong><small class="admin-truncate">${a(t.relativePath||"")}</small>${t.errorMessage?`<small class="admin-truncate">${a(t.errorMessage)}</small>`:""}</td>
                    <td><span class="admin-badge" data-status="${a(t.status)}">${a(t.status)}</span></td>
                    <td>${t.fileSize===null||t.fileSize===void 0?"-":s(t.fileSize)}</td>
                    <td>${r(t.checkedAt)}</td>
                  </tr>
                `).join("")||'<tr><td colspan="6">暂无文件巡检记录</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>${c(d.length)}`}}})();
