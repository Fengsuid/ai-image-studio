(function(l){"use strict";function o(r="",a="zh"){const t=String(r||"");return(a==="zh"?{daily_checkin:"每日签到",generation_charge:"文生图消耗",generation_refund:"生成退款",edit_charge:"图生图消耗",edit_refund:"编辑退款",canvas_generation_charge:"画布生成消耗",canvas_generation_refund:"画布生成退款",canvas_generation_error_refund:"画布生成退款",canvas_generation_cancel_refund:"画布取消退款",admin_adjustment:"管理员调整",credit_grant:"积分赠送",signup_bonus:"注册赠送",first_public_reward:"首次公开作品奖励"}:{daily_checkin:"Daily check-in",generation_charge:"Generation charge",generation_refund:"Generation refund",edit_charge:"Image edit charge",edit_refund:"Image edit refund",canvas_generation_charge:"Canvas generation charge",canvas_generation_refund:"Canvas generation refund",canvas_generation_error_refund:"Canvas generation refund",canvas_generation_cancel_refund:"Canvas cancel refund",admin_adjustment:"Admin adjustment",credit_grant:"Credit grant",signup_bonus:"Signup bonus",first_public_reward:"First public work reward"})[t]||t.replace(/_/g," ")||"-"}function g(r="",a="zh"){return(a==="zh"?{pending:"待入账",awarded:"已入账",cancelled:"已取消"}:{pending:"Pending",awarded:"Awarded",cancelled:"Cancelled"})[String(r||"")]||r||"-"}function u(r=[],a){const{escapeHtml:t,text:e,formatDate:i,lang:c}=a;return r.length?r.map(n=>{const d=Number(n.delta||0),s=d>=0;return`
        <article class="credit-ledger-row ${s?"positive":"negative"}">
          <span class="credit-ledger-icon"><i class="${s?"ri-add-circle-line":"ri-subtract-line"}"></i></span>
          <div>
            <strong>${t(o(n.source,c))}</strong>
            <small>${t(n.note||n.referenceId||i(n.createdAt)||"")}</small>
          </div>
          <em>${s?"+":""}${d}</em>
          <time>${t(i(n.createdAt)||"")}</time>
          <span>${t(e("creditsBalance"))}: ${Number(n.balanceAfter||0)}</span>
        </article>
      `}).join(""):`<div class="credits-empty">${t(e("creditsLedgerEmpty"))}</div>`}function p(r=[],a){const{escapeHtml:t,text:e,formatDate:i,lang:c}=a;return r.length?`
      <section class="credits-detail-section">
        <h3>${t(e("creditsRewardTitle"))}</h3>
        <div class="reward-ledger-list">
          ${r.map(n=>`
            <article class="reward-ledger-row">
              <strong>${t(n.rewardType?n.rewardType.replace(/_/g," "):"-")}</strong>
              <span>${t(g(n.status,c))}</span>
              <em>+${Number(n.amount||0)}</em>
              <time>${t(i(n.awardedAt||n.createdAt)||"")}</time>
            </article>
          `).join("")}
        </div>
      </section>
    `:""}function _({details:r={},state:a={},helpers:t={}}={}){const e={escapeHtml:t.escapeHtml,text:t.text,formatDate:t.formatDate,lang:a.lang||"zh"},i=a.user?.credits??0,c=!!a.checkin?.checkedInToday,n=Number(a.checkin?.credit||a.settings?.checkinCredit||1),d=Number(a.settings?.generationCreditCost??1),s=p(r.rewards||[],e)||`<section class="credits-detail-section"><h3>${e.escapeHtml(e.text("creditsRewardTitle"))}</h3><div class="credits-empty">${e.escapeHtml(e.text("creditsLedgerEmpty"))}</div></section>`;return`
      <section class="modal credits-detail-modal">
        <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
        <div class="modal-title">
          <i class="ri-sparkling-2-fill"></i>
          <h2>${e.text("creditsDetailTitle")}</h2>
          <p>${e.text("creditsBalance")}: <strong>${i}</strong> · ${e.text("oneCredit")}: <strong>${d}</strong></p>
        </div>
        <div class="credits-detail-grid">
          <section class="credits-detail-section credit-ledger-panel">
            <h3>${e.escapeHtml(e.text("creditsLedgerTitle"))}</h3>
            <div class="credit-ledger-list">${u(r.ledger||[],e)}</div>
          </section>
          <aside class="credits-reward-panel">
            <div class="credits-detail-hero">
              <div class="checkin-card">
                <i class="ri-calendar-check-line"></i>
                <strong>+${n}</strong>
                <span>${e.text("checkinReward")}</span>
              </div>
              <button class="modal-primary" type="button" data-checkin ${c?"disabled":""}>
                ${c?e.text("checkedIn"):e.text("checkinToday")}
              </button>
            </div>
            ${s}
          </aside>
          <div class="credits-detail-actions">
            <button class="modal-secondary" type="button" data-close-auth>${e.text("close")}</button>
          </div>
        </div>
      </section>
    `}l.ImageStudioCreditsDetail={renderModal:_}})(window);
