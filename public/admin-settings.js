(function initAdminSettingsModule(global) {
  "use strict";

  global.AdminModules = global.AdminModules || {};

  function render({ state, helpers }) {
    const { escapeHtml } = helpers;
    const s = state.settings || {};
    return `
      <section class="admin-panel admin-settings-panel">
        <h2>系统设置</h2>
        <div class="admin-placeholder admin-settings-provider-note">
          <i class="ri-plug-line"></i>
          <h3>API 配置入口已迁移</h3>
          <p>API Key、Base URL、模型和单个 Provider 能力请到左侧「API 供应商」中维护；这里不再重复展示旧版单 Provider 字段，避免保存系统设置时误以为会切换生成供应商。</p>
        </div>
        <form id="adminSettingsForm" class="admin-form-grid">
          <label>默认积分<input name="defaultCredits" type="number" min="0" value="${escapeHtml(s.defaultCredits ?? 10)}"></label>
          <label>单图消耗<input name="generationCreditCost" type="number" min="0" value="${escapeHtml(s.generationCreditCost ?? 1)}"></label>
          <label>单次最大张数<input name="maxImagesPerRequest" type="number" min="1" max="4" value="${escapeHtml(s.maxImagesPerRequest ?? 1)}"></label>
          <label>参考图最大上传数<input name="maxReferenceImages" type="number" min="1" max="15" value="${escapeHtml(s.maxReferenceImages ?? 4)}"></label>
          <label>首次公开奖励积分<input name="firstPublicRewardCredit" type="number" min="0" max="10000" value="${escapeHtml(s.firstPublicRewardCredit ?? 2)}"></label>
          <label>公开奖励锁定分钟<input name="publicRewardHoldMinutes" type="number" min="1" max="43200" value="${escapeHtml(s.publicRewardHoldMinutes ?? 720)}"><small>30 = 满半小时入账，720 = 满 12 小时入账</small></label>
          <label>联系管理员邮箱<input name="contactEmail" type="email" value="${escapeHtml(s.contactEmail ?? s.contactAdminEmail ?? "")}" placeholder="support@example.com"></label>
          <label>运营增长配置<textarea name="growthConfig" rows="6">${escapeHtml(JSON.stringify(s.growthConfig || {}, null, 2))}</textarea><small>控制推荐位、榜单、徽章和活动开关；这是运营增长的高级 JSON 配置，不是 API 供应商配置。</small></label>
          <label class="admin-check"><input name="allowRegistration" type="checkbox"${s.allowRegistration ? " checked" : ""}>允许注册</label>
          <label class="admin-check"><input name="requireApproval" type="checkbox"${s.requireApproval ? " checked" : ""}>注册后需审批</label>
          <label class="admin-check"><input name="publicRewardNotificationsEnabled" type="checkbox"${s.publicRewardNotificationsEnabled !== false ? " checked" : ""}>公开奖励锁定/入账通知</label>
          <label class="admin-check"><input name="publicUnpublishAllowed" type="checkbox"${s.publicUnpublishAllowed ? " checked" : ""}>允许用户自行取消公开</label>
          <div class="admin-form-actions">
            <button type="submit">保存设置</button>
            <button type="button" data-clear-key>清除 Key</button>
          </div>
        </form>
      </section>`;
  }

  function buildPayload(form) {
    return {
      defaultCredits: form.get("defaultCredits"),
      generationCreditCost: form.get("generationCreditCost"),
      maxImagesPerRequest: form.get("maxImagesPerRequest"),
      maxReferenceImages: form.get("maxReferenceImages"),
      firstPublicRewardCredit: form.get("firstPublicRewardCredit"),
      publicRewardHoldMinutes: form.get("publicRewardHoldMinutes"),
      contactEmail: form.get("contactEmail"),
      allowRegistration: Boolean(form.get("allowRegistration")),
      requireApproval: Boolean(form.get("requireApproval")),
      publicUnpublishAllowed: Boolean(form.get("publicUnpublishAllowed")),
      publicRewardNotificationsEnabled: Boolean(form.get("publicRewardNotificationsEnabled")),
      growthConfig: JSON.parse(form.get("growthConfig") || "{}")
    };
  }

  global.AdminModules.settings = { render, buildPayload };
})(window);
