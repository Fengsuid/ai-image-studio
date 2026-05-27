#!/usr/bin/env node
// Static smoke for AIS-RLS-119 admin contact email masking.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const app = read("public/app.js");
const appAuth = read("public/app-auth.js");
const html = read("public/index.html");
const pkg = JSON.parse(read("package.json"));

assert(app.includes("function maskContactEmail(value)"), "app.js must define contact email masking");
assert(
  app.includes("state, elements, text, escapeHtml, formatDate, truncate, maskContactEmail"),
  "auth controller context must pass maskContactEmail"
);
assert(
  app.includes("const accountEmail = String(state.user?.email || \"\").trim()"),
  "app.js must keep the real account email in JS state only"
);
assert(
  app.includes("elements.accountEmailText.textContent = maskContactEmail(accountEmail)"),
  "current user email must be masked in the account menu"
);
assert(
  app.includes("elements.accountContactText.textContent = maskContactEmail(contactEmail) || text(\"contact\")"),
  "account menu admin contact label must use the masked email"
);
assert(
  appAuth.includes("await context.copyText(email)"),
  "masked account email click must copy the real account email"
);

assert(appAuth.includes("const maskContactEmail = requireContext(context, \"maskContactEmail\")"), "auth module must require maskContactEmail");
assert(appAuth.includes("const maskedAdminEmail = maskContactEmail(adminEmail)"), "contact modal must compute a masked admin email");
assert(
  appAuth.includes('<a class="contact-email" href="${escapeHtml(mailto)}">${escapeHtml(maskedAdminEmail)}</a>'),
  "contact modal visible email text must be masked"
);
assert(
  appAuth.includes("await context.copyText(adminEmail)"),
  "copy action must still copy the real admin email"
);
assert(
  appAuth.includes('const mailto = `mailto:${adminEmail}?subject=${encodeURIComponent("ai-image-studio support")}`'),
  "mailto action must still target the real admin email"
);
assert(html.includes('id="accountEmailText"'), "account menu must keep a current-user email field");
assert(html.includes('id="accountContactText"'), "account menu must keep a separate admin contact field");
assert(!html.includes("user@example.com"), "index HTML must not contain a static email placeholder");
assert(!html.includes("__cf_email__"), "index HTML must not rely on Cloudflare email obfuscation");
assert(
  pkg.scripts?.["smoke:mask-admin-email"] === "node scripts/smoke/check-mask-admin-email.mjs",
  "package.json must expose smoke:mask-admin-email"
);

console.log("[mask-admin-email] OK");
