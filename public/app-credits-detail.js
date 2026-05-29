(function initCreditsDetail(global) {
  "use strict";

  function creditSourceLabel(source = "", lang = "zh") {
    const key = String(source || "");
    const zh = {
      daily_checkin: "每日签到",
      generation_charge: "文生图消耗",
      generation_refund: "生成退款",
      edit_charge: "图生图消耗",
      edit_refund: "编辑退款",
      canvas_generation_charge: "画布生成消耗",
      canvas_generation_refund: "画布生成退款",
      canvas_generation_error_refund: "画布生成退款",
      canvas_generation_cancel_refund: "画布取消退款",
      admin_adjustment: "管理员调整",
      credit_grant: "积分赠送",
      signup_bonus: "注册赠送",
      first_public_reward: "首次公开作品奖励"
    };
    const en = {
      daily_checkin: "Daily check-in",
      generation_charge: "Generation charge",
      generation_refund: "Generation refund",
      edit_charge: "Image edit charge",
      edit_refund: "Image edit refund",
      canvas_generation_charge: "Canvas generation charge",
      canvas_generation_refund: "Canvas generation refund",
      canvas_generation_error_refund: "Canvas generation refund",
      canvas_generation_cancel_refund: "Canvas cancel refund",
      admin_adjustment: "Admin adjustment",
      credit_grant: "Credit grant",
      signup_bonus: "Signup bonus",
      first_public_reward: "First public work reward"
    };
    return (lang === "zh" ? zh : en)[key] || key.replace(/_/g, " ") || "-";
  }

  function rewardStatusLabel(status = "", lang = "zh") {
    const labels = lang === "zh"
      ? { pending: "待入账", awarded: "已入账", cancelled: "已取消" }
      : { pending: "Pending", awarded: "Awarded", cancelled: "Cancelled" };
    return labels[String(status || "")] || status || "-";
  }

  function renderCreditLedgerRows(records = [], context) {
    const { escapeHtml, text, formatDate, lang } = context;
    if (!records.length) return `<div class="credits-empty">${escapeHtml(text("creditsLedgerEmpty"))}</div>`;
    return records.map((item) => {
      const delta = Number(item.delta || 0);
      const positive = delta >= 0;
      return `
        <article class="credit-ledger-row ${positive ? "positive" : "negative"}">
          <span class="credit-ledger-icon"><i class="${positive ? "ri-add-circle-line" : "ri-subtract-line"}"></i></span>
          <div class="credit-ledger-main">
            <strong>${escapeHtml(creditSourceLabel(item.source, lang))}</strong>
            <small>${escapeHtml(item.note || item.referenceId || formatDate(item.createdAt) || "")}</small>
          </div>
          <div class="credit-ledger-meta">
            <em>${positive ? "+" : ""}${delta}</em>
            <time>${escapeHtml(formatDate(item.createdAt) || "")}</time>
            <span>${escapeHtml(text("creditsBalance"))}: ${Number(item.balanceAfter || 0)}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderRewardLedgerRows(records = [], context) {
    const { escapeHtml, text, formatDate, lang } = context;
    if (!records.length) return "";
    return `
      <section class="credits-detail-section">
        <h3>${escapeHtml(text("creditsRewardTitle"))}</h3>
        <div class="reward-ledger-list">
          ${records.map((item) => `
            <article class="reward-ledger-row">
              <div>
                <strong>${escapeHtml(item.rewardType ? item.rewardType.replace(/_/g, " ") : "-")}</strong>
                <em>+${Number(item.amount || 0)}</em>
              </div>
              <div>
                <span>${escapeHtml(rewardStatusLabel(item.status, lang))}</span>
                <time>${escapeHtml(formatDate(item.awardedAt || item.createdAt) || "")}</time>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderModal({ details = {}, state = {}, helpers = {} } = {}) {
    const context = {
      escapeHtml: helpers.escapeHtml,
      text: helpers.text,
      formatDate: helpers.formatDate,
      lang: state.lang || "zh"
    };
    const credits = state.user?.credits ?? 0;
    const checkedIn = Boolean(state.checkin?.checkedInToday);
    const checkinCredit = Number(state.checkin?.credit || state.settings?.checkinCredit || 1);
    const generationCost = Number(state.settings?.generationCreditCost ?? 1);
    const rewardRows = renderRewardLedgerRows(details.rewards || [], context)
      || `<section class="credits-detail-section"><h3>${context.escapeHtml(context.text("creditsRewardTitle"))}</h3><div class="credits-empty">${context.escapeHtml(context.text("creditsLedgerEmpty"))}</div></section>`;
    return `
      <section class="modal credits-detail-modal">
        <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
        <div class="modal-title">
          <i class="ri-sparkling-2-fill"></i>
          <h2>${context.text("creditsDetailTitle")}</h2>
          <p>${context.text("creditsBalance")}: <strong>${credits}</strong> · ${context.text("oneCredit")}: <strong>${generationCost}</strong></p>
        </div>
        <div class="credits-detail-grid">
          <section class="credits-detail-section credit-ledger-panel">
            <h3>${context.escapeHtml(context.text("creditsLedgerTitle"))}</h3>
            <div class="credit-ledger-list">${renderCreditLedgerRows(details.ledger || [], context)}</div>
          </section>
          <aside class="credits-reward-panel">
            <div class="credits-detail-hero">
              <div class="checkin-card">
                <i class="ri-calendar-check-line"></i>
                <strong>+${checkinCredit}</strong>
                <span>${context.text("checkinReward")}</span>
              </div>
              <button class="modal-primary" type="button" data-checkin ${checkedIn ? "disabled" : ""}>
                ${checkedIn ? context.text("checkedIn") : context.text("checkinToday")}
              </button>
            </div>
            ${rewardRows}
          </aside>
          <div class="credits-detail-actions">
            <button class="modal-secondary" type="button" data-close-auth>${context.text("close")}</button>
          </div>
        </div>
      </section>
    `;
  }

  global.ImageStudioCreditsDetail = { renderModal };
})(window);
