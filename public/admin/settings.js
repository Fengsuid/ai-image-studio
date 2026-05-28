(function initAdminSettingsDomain(global) {
  "use strict";

  const domains = global.AdminDomains || (global.AdminDomains = {});

  function bind(core) {
    const { $, api, recordAudit, refreshAndRender, confirmAction, setStatus } = core;
    $("#adminSettingsForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      let growthConfig = {};
      try {
        growthConfig = JSON.parse(form.get("growthConfig") || "{}");
      } catch {
        setStatus("Growth JSON 格式错误", "danger");
        return;
      }
      await api("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
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
          growthConfig
        })
      });
      recordAudit("update_settings", "system", "settings saved");
      await refreshAndRender();
    });
    $("[data-clear-key]")?.addEventListener("click", async () => {
      if (!(await confirmAction({ title: "清除 API Key", message: "确认清除 OpenAI API Key？", confirmText: "清除", danger: true }))) return;
      await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ clearApiKey: true }) });
      recordAudit("clear_api_key", "system", "API key cleared");
      await refreshAndRender();
    });
  }

  domains.settings = { bind };
})(window);
