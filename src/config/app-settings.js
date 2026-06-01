const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "../../");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, "data"));
const GENERATED_DIR = path.join(DATA_DIR, "generated");
const SOURCE_DIR = path.join(DATA_DIR, "sources");
const REFERENCE_ASSET_DIR = path.join(DATA_DIR, "reference-assets");

const PORT = Number(process.env.PORT || 3000);
const APP_VERSION = process.env.APP_VERSION || "20260601-premium-polish-split-v1";
const SERVER_STARTED_AT = new Date().toISOString();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BODY_BYTES = Math.max(
  16 * 1024 * 1024,
  Number.parseInt(process.env.MAX_BODY_BYTES || `${32 * 1024 * 1024}`, 10) || 32 * 1024 * 1024
);
const MAX_IMAGE_EDIT_INPUTS = 16;
const DEFAULT_MODEL = "GPT-IMAGE-2";
const CHECKIN_CREDIT = Number.parseInt(process.env.CHECKIN_CREDIT || "1", 10) || 1;
const DEFAULT_CONTACT_ADMIN_EMAIL = "support@example.com";
const FIRST_PUBLIC_REWARD_CREDIT = Number.parseInt(process.env.FIRST_PUBLIC_REWARD_CREDIT || "2", 10) || 2;
const PUBLIC_WITHDRAWAL_WINDOW_HOURS = Number.parseInt(process.env.PUBLIC_WITHDRAWAL_WINDOW_HOURS || "12", 10) || 12;
const TAG_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const OPENAI_FETCH_TIMEOUT_MS = Math.max(
  10_000,
  Number.parseInt(process.env.OPENAI_FETCH_TIMEOUT_MS || "120000", 10) || 120_000
);
const IMAGE_DOWNLOAD_TIMEOUT_MS = Math.max(
  5_000,
  Number.parseInt(process.env.IMAGE_DOWNLOAD_TIMEOUT_MS || "30000", 10) || 30_000
);
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

module.exports = {
  ROOT_DIR,
  PUBLIC_DIR,
  DATA_DIR,
  GENERATED_DIR,
  SOURCE_DIR,
  REFERENCE_ASSET_DIR,
  PORT,
  APP_VERSION,
  SERVER_STARTED_AT,
  SESSION_TTL_MS,
  MAX_BODY_BYTES,
  MAX_IMAGE_EDIT_INPUTS,
  DEFAULT_MODEL,
  CHECKIN_CREDIT,
  DEFAULT_CONTACT_ADMIN_EMAIL,
  FIRST_PUBLIC_REWARD_CREDIT,
  PUBLIC_WITHDRAWAL_WINDOW_HOURS,
  TAG_SLUG_PATTERN,
  OPENAI_FETCH_TIMEOUT_MS,
  IMAGE_DOWNLOAD_TIMEOUT_MS,
  ALLOWED_IMAGE_MIME
};
