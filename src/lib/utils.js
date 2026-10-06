"use strict";
// Shared utilities: ids, tokens, hashing, validation, text safety.
// Global rule: the em dash character must never appear in product output.
// sanitizeText() enforces this for every AI generated and user facing string.

const crypto = require("crypto");
const config = require("../config");

function uid(prefix) {
  return (prefix ? prefix + "_" : "") + crypto.randomBytes(12).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  // Replace em dashes and horizontal bars with a safe comma structure.
  return value.replace(/[\u2014\u2013\u2015]/g, ",").replace(/\uFE0F/g, "");
}

function sanitizeDeep(value) {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = sanitizeDeep(value[k]);
    return out;
  }
  return value;
}

function hasEmDash(value) {
  return typeof value === "string" && /[\u2014\u2015]/.test(value);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes || 32).toString("hex");
}

function sign(data) {
  return crypto.createHmac("sha256", config.authSecret).update(String(data)).digest("hex");
}

function verifySignature(data, signature) {
  const expected = sign(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}

function checkPassword(password, stored) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const hash = crypto.scryptSync(String(password), parts[1], 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(parts[2], "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

function isStrongPassword(value) {
  const v = String(value || "");
  return v.length >= 8 && /[A-Za-z]/.test(v) && /[0-9]/.test(v);
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(n, min, max) {
  n = Number(n);
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function money(amount, currency) {
  const cur = currency || config.brand.defaultCurrency || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(Number(amount));
  } catch (e) {
    return cur + " " + Number(amount).toFixed(2);
  }
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function minutesFromNow(min) {
  return new Date(Date.now() + min * 60000).toISOString();
}

function isExpired(iso) {
  return new Date(iso).getTime() <= Date.now();
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s,;|/()[\]{}]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function unique(arr) {
  return Array.from(new Set(arr));
}

module.exports = {
  uid, nowIso, sanitizeText, sanitizeDeep, hasEmDash,
  hashToken, randomToken, sign, verifySignature,
  hashPassword, checkPassword, isEmail, isStrongPassword,
  escapeHtml, clamp, money, daysFromNow, hoursFromNow, minutesFromNow,
  isExpired, tokenize, unique
};
