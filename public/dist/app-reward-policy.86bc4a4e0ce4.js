(function initRewardPolicy(global) {
  "use strict";

  function policy(settings = {}) {
    const holdMinutes = Math.max(1, Number(settings.publicRewardHoldMinutes || 720) || 720);
    return {
      credit: Math.max(0, Number(settings.firstPublicRewardCredit || 0) || 0),
      holdMinutes,
      unpublishAllowed: Boolean(settings.publicUnpublishAllowed)
    };
  }

  function holdLabel(settings, lang = "zh") {
    const minutes = policy(settings).holdMinutes;
    if (minutes < 60) return lang === "zh" ? `${minutes} 分钟` : `${minutes} min`;
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return lang === "zh" ? `${hours} 小时` : `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return lang === "zh" ? `${minutes} 分钟` : `${minutes} min`;
  }

  function pendingLabel(item = {}, settings = {}, lang = "zh") {
    const amount = Number(item.publicRewardAmount || policy(settings).credit || 0);
    const hold = holdLabel(settings, lang);
    return lang === "zh" ? `奖励锁定 ${amount} 分，公开满 ${hold} 入账` : `${amount} credits locked until ${hold}`;
  }

  function lockedToast(item = {}, settings = {}, lang = "zh") {
    const amount = Number(item.publicRewardAmount || policy(settings).credit || 0);
    const hold = holdLabel(settings, lang);
    return lang === "zh" ? `首次公开奖励已锁定 +${amount} 积分，公开满 ${hold} 入账` : `First public reward locked (+${amount}); awarded after ${hold}`;
  }

  function confirmPublish({ item = {}, settings = {}, lang = "zh" } = {}) {
    if (item.isPublic) return true;
    const current = policy(settings);
    const reward = current.credit > 0
      ? (lang === "zh" ? `首次公开可锁定 +${current.credit} 积分，公开满 ${holdLabel(settings, lang)} 后自动入账。` : `First public work locks +${current.credit} credits, awarded after ${holdLabel(settings, lang)}.`)
      : (lang === "zh" ? "当前首次公开奖励积分为 0。" : "Current first-public reward is 0 credits.");
    const lock = current.unpublishAllowed
      ? (lang === "zh" ? "管理员当前允许用户自行取消公开。" : "Admins currently allow users to unpublish.")
      : (lang === "zh" ? "公开后用户不能自行取消公开，只能由管理员处理。" : "After publishing, users cannot unpublish by themselves; admins must handle changes.");
    return global.confirm(`${lang === "zh" ? "确认公开到广场？" : "Publish to square?"}\n\n${reward}\n${lock}`);
  }

  global.ImageStudioRewardPolicy = { policy, holdLabel, pendingLabel, lockedToast, confirmPublish };
})(window);
