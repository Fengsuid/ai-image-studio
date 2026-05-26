(function(t){"use strict";t.AdminModules=t.AdminModules||{};function i({state:e,helpers:s}){const{escapeHtml:l}=s,a=e.settings||{};return`
      <section class="admin-panel admin-settings-panel">
        <h2>系统设置</h2>
        <div class="admin-placeholder admin-settings-provider-note">
          <i class="ri-plug-line"></i>
          <h3>API 配置入口已迁移</h3>
          <p>API Key、Base URL、模型和单个 Provider 能力请到左侧「API 供应商」中维护；这里不再重复展示旧版单 Provider 字段，避免保存系统设置时误以为会切换生成供应商。</p>
        </div>
        <form id="adminSettingsForm" class="admin-form-grid">
          <label>默认积分<input name="defaultCredits" type="number" min="0" value="${l(a.defaultCredits??10)}"></label>
          <label>单图消耗<input name="generationCreditCost" type="number" min="0" value="${l(a.generationCreditCost??1)}"></label>
          <label>单次最大张数<input name="maxImagesPerRequest" type="number" min="1" max="4" value="${l(a.maxImagesPerRequest??1)}"></label>
          <label>参考图最大上传数<input name="maxReferenceImages" type="number" min="1" max="15" value="${l(a.maxReferenceImages??4)}"></label>
          <label>首次公开奖励积分<input name="firstPublicRewardCredit" type="number" min="0" max="10000" value="${l(a.firstPublicRewardCredit??2)}"></label>
          <label>公开奖励锁定分钟<input name="publicRewardHoldMinutes" type="number" min="1" max="43200" value="${l(a.publicRewardHoldMinutes??720)}"><small>30 = 满半小时入账，720 = 满 12 小时入账</small></label>
          <label>联系管理员邮箱<input name="contactEmail" type="email" value="${l(a.contactEmail??a.contactAdminEmail??"")}" placeholder="support@example.com"></label>
          <label>运营增长配置<textarea name="growthConfig" rows="6">${l(JSON.stringify(a.growthConfig||{},null,2))}</textarea><small>控制推荐位、榜单、徽章和活动开关；这是运营增长的高级 JSON 配置，不是 API 供应商配置。</small></label>
          <label class="admin-check"><input name="allowRegistration" type="checkbox"${a.allowRegistration?" checked":""}>允许注册</label>
          <label class="admin-check"><input name="requireApproval" type="checkbox"${a.requireApproval?" checked":""}>注册后需审批</label>
          <label class="admin-check"><input name="publicRewardNotificationsEnabled" type="checkbox"${a.publicRewardNotificationsEnabled!==!1?" checked":""}>公开奖励锁定/入账通知</label>
          <label class="admin-check"><input name="publicUnpublishAllowed" type="checkbox"${a.publicUnpublishAllowed?" checked":""}>允许用户自行取消公开</label>
          <div class="admin-form-actions">
            <button type="submit">保存设置</button>
            <button type="button" data-clear-key>清除 Key</button>
          </div>
        </form>
      </section>`}function n(e){return{defaultCredits:e.get("defaultCredits"),generationCreditCost:e.get("generationCreditCost"),maxImagesPerRequest:e.get("maxImagesPerRequest"),maxReferenceImages:e.get("maxReferenceImages"),firstPublicRewardCredit:e.get("firstPublicRewardCredit"),publicRewardHoldMinutes:e.get("publicRewardHoldMinutes"),contactEmail:e.get("contactEmail"),allowRegistration:!!e.get("allowRegistration"),requireApproval:!!e.get("requireApproval"),publicUnpublishAllowed:!!e.get("publicUnpublishAllowed"),publicRewardNotificationsEnabled:!!e.get("publicRewardNotificationsEnabled"),growthConfig:JSON.parse(e.get("growthConfig")||"{}")}}t.AdminModules.settings={render:i,buildPayload:n}})(window);
