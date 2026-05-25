"use strict";

const { requireAdmin } = require("./shared");

function cleanSettingsPatch(deps, body, existingSettings) {
  const patch = {};
  if (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) patch.openaiApiKey = body.openaiApiKey.trim();
  if (body.clearApiKey === true) patch.openaiApiKey = "";
  if (typeof body.apiBaseUrl === "string") patch.apiBaseUrl = body.apiBaseUrl.trim().replace(/\/+$/, "").slice(0, 255);
  if (typeof body.model === "string" && body.model.trim()) patch.model = body.model.trim().slice(0, 80);
  for (const field of ["defaultCredits", "generationCreditCost"]) {
    if (body[field] !== undefined) patch[field] = Math.max(0, Math.min(10000, Number.parseInt(body[field], 10) || 0));
  }
  if (body.maxImagesPerRequest !== undefined) patch.maxImagesPerRequest = Math.max(1, Math.min(4, Number.parseInt(body.maxImagesPerRequest, 10) || 1));
  if (body.maxReferenceImages !== undefined) patch.maxReferenceImages = deps.normalizeMaxReferenceImages(body.maxReferenceImages);
  if (body.firstPublicRewardCredit !== undefined) patch.firstPublicRewardCredit = Math.max(0, Math.min(10000, Number.parseInt(body.firstPublicRewardCredit, 10) || 0));
  if (body.publicRewardHoldMinutes !== undefined) patch.publicRewardHoldMinutes = Math.max(1, Math.min(43200, Number.parseInt(body.publicRewardHoldMinutes, 10) || 720));
  if (typeof body.publicUnpublishAllowed === "boolean") patch.publicUnpublishAllowed = body.publicUnpublishAllowed ? 1 : 0;
  if (typeof body.publicRewardNotificationsEnabled === "boolean") patch.publicRewardNotificationsEnabled = body.publicRewardNotificationsEnabled ? 1 : 0;
  const contactEmailInput = typeof body.contactEmail === "string" ? body.contactEmail : body.contactAdminEmail;
  if (typeof contactEmailInput === "string") {
    const email = deps.normalizeEmail(contactEmailInput);
    deps.requireOptionalEmail(email);
    patch.contactAdminEmail = email.slice(0, 255);
  }
  if (typeof body.allowRegistration === "boolean") patch.allowRegistration = body.allowRegistration ? 1 : 0;
  if (typeof body.requireApproval === "boolean") patch.requireApproval = body.requireApproval ? 1 : 0;
  if (body.growthConfig && typeof body.growthConfig === "object") patch.growthConfig = body.growthConfig;
  if (body.providerCapabilityConfig && typeof body.providerCapabilityConfig === "object") patch.providerCapabilityConfig = body.providerCapabilityConfig;
  if (typeof body.defaultProviderId === "string") patch.defaultProviderId = body.defaultProviderId.trim().slice(0, 40);
  return { patch, contactChanged: Object.hasOwn(patch, "contactAdminEmail") && patch.contactAdminEmail !== String(existingSettings.contactAdminEmail || "") };
}

async function testProvider(deps, provider, body) {
  const started = Date.now();
  if (provider.mapping && Object.keys(provider.mapping).length) {
    const mapping = deps.normalizeProviderMapping(provider.mapping);
    const result = await deps.runProviderMappingRequest({
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      fetchFn: (label, endpoint, init) => deps.fetchWithTimeout(label, endpoint, init, 20_000),
      mapping,
      payload: {
        model: provider.defaultModel || deps.DEFAULT_MODEL,
        prompt: String(body.prompt || "provider diagnostic test image").slice(0, 500),
        n: 1,
        size: String(body.size || "1024x1024"),
        quality: String(body.quality || "auto"),
        background: String(body.background || "auto"),
        output_format: String(body.outputFormat || "png")
      }
    });
    const imageItems = deps.extractImageItems(result);
    for (const item of imageItems) {
      if (item.url && !deps.isSafeRemoteImageUrl(item.url)) throw deps.httpError("Provider returned an unsafe image URL", 400);
    }
    const providerHealth = imageItems.length ? "ok" : "error";
    const updated = await deps.store.updateProviderHealth(provider.id, {
      healthStatus: providerHealth,
      lastError: imageItems.length ? "" : "mapping test returned no image"
    });
    return { provider: updated, ok: imageItems.length > 0, mappingMode: mapping.mode, imageCount: imageItems.length, providerTaskId: result.providerTaskId || "", durationMs: Date.now() - started };
  }
  const response = await deps.fetchWithTimeout("Provider test", provider.baseUrl, {
    method: "GET",
    headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}
  }, 8000);
  const healthStatus = response.status < 500 ? "ok" : "error";
  const updated = await deps.store.updateProviderHealth(provider.id, {
    healthStatus,
    lastError: healthStatus === "ok" ? "" : `HTTP ${response.status}`
  });
  return { provider: updated, ok: healthStatus === "ok", status: response.status, durationMs: Date.now() - started };
}

function createAdminSettingsRoute(deps) {
  const { store, sendJson, readJsonBody, httpError, randomId, writeAdminAudit, adminSettings } = deps;

  return async function handleAdminSettingsRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/admin/settings") {
      await requireAdmin(deps, req);
      const settings = await store.getSettings();
      sendJson(res, 200, adminSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
      return true;
    }

    if (req.method === "PATCH" && url.pathname === "/api/admin/settings") {
      const current = await requireAdmin(deps, req);
      const existingSettings = await store.getSettings();
      const { patch, contactChanged } = cleanSettingsPatch(deps, await readJsonBody(req), existingSettings);
      const settings = await store.updateSettings(patch);
      if (contactChanged) {
        await writeAdminAudit(current, req, "update_contact_email", "settings", "contactEmail", {
          from: existingSettings.contactAdminEmail || "",
          to: patch.contactAdminEmail
        });
      }
      sendJson(res, 200, adminSettings(settings, await store.getDefaultProviderConfig({ includeSecret: true })));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/providers") {
      await requireAdmin(deps, req);
      const settings = await store.getSettings();
      sendJson(res, 200, { providers: await store.listProviderConfigs(), defaultProviderId: settings.defaultProviderId || "" });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/providers") {
      const current = await requireAdmin(deps, req);
      const provider = await store.createProviderConfig({ ...deps.cleanProviderInput(await readJsonBody(req)), id: randomId("prv_") });
      await writeAdminAudit(current, req, "create_provider", "provider", provider.id, { name: provider.name, baseUrl: provider.baseUrl, status: provider.status });
      sendJson(res, 201, { provider });
      return true;
    }

    const providerMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)$/);
    if (providerMatch && req.method === "GET") {
      await requireAdmin(deps, req);
      const provider = await store.getProviderConfigById(providerMatch[1]);
      if (!provider) throw httpError("Provider not found", 404);
      sendJson(res, 200, { provider });
      return true;
    }

    if (providerMatch && req.method === "PATCH") {
      const current = await requireAdmin(deps, req);
      const existing = await store.getProviderConfigById(providerMatch[1], { includeSecret: true });
      if (!existing) throw httpError("Provider not found", 404);
      const provider = await store.updateProviderConfig(existing.id, deps.cleanProviderInput(await readJsonBody(req), existing));
      await writeAdminAudit(current, req, "update_provider", "provider", provider.id, { name: provider.name, baseUrl: provider.baseUrl, status: provider.status });
      sendJson(res, 200, { provider });
      return true;
    }

    if (providerMatch && req.method === "DELETE") {
      const current = await requireAdmin(deps, req);
      const ok = await store.deleteProviderConfig(providerMatch[1]);
      if (!ok) throw httpError("Provider cannot be deleted", 400);
      await writeAdminAudit(current, req, "delete_provider", "provider", providerMatch[1], {});
      sendJson(res, 200, { ok: true });
      return true;
    }

    const testMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/test$/);
    if (testMatch && req.method === "POST") {
      await requireAdmin(deps, req);
      const provider = await store.getProviderConfigById(testMatch[1], { includeSecret: true });
      if (!provider) throw httpError("Provider not found", 404);
      const body = await readJsonBody(req).catch(() => ({}));
      try {
        sendJson(res, 200, await testProvider(deps, provider, body));
      } catch (error) {
        const updated = await store.updateProviderHealth(provider.id, { healthStatus: "error", lastError: error.message || String(error) });
        sendJson(res, 200, { provider: updated, ok: false, error: error.message || String(error), durationMs: 0 });
      }
      return true;
    }

    const defaultMatch = url.pathname.match(/^\/api\/admin\/providers\/([^/]+)\/set-default$/);
    if (defaultMatch && req.method === "POST") {
      const current = await requireAdmin(deps, req);
      const provider = await store.setDefaultProviderConfig(defaultMatch[1]);
      if (!provider) throw httpError("Provider not found", 404);
      await writeAdminAudit(current, req, "set_default_provider", "provider", provider.id, { name: provider.name });
      sendJson(res, 200, { provider, defaultProviderId: provider.id });
      return true;
    }

    return false;
  };
}

module.exports = { createAdminSettingsRoute };
