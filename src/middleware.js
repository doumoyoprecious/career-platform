"use strict";
// Auth, CSRF, rate limiting, audit logging, privacy gate, secure headers.

const db = require("./db");
const config = require("./config");
const { verifySignature, randomToken, hashToken, nowIso, sanitizeText } = require("./lib/utils");

const SESSION_DAYS = 30;
const hits = new Map();

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= max;
}

function rateLimitMw(max, windowMs, keyFn) {
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : req.ip) + ":" + req.path;
    if (!rateLimit(key, max, windowMs)) {
      return res.status(429).json({ error: "Too many requests. Please wait and try again." });
    }
    next();
  };
}

function setSessionCookie(res, token) {
  res.cookie("sid", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: SESSION_DAYS * 86400000,
    path: "/"
  });
}

function clearSessionCookie(res) {
  res.clearCookie("sid", { path: "/" });
}

function createSession(userId, meta) {
  const token = randomToken(32);
  const csrf = randomToken(16);
  db.insert("sessions", {
    userId,
    tokenHash: hashToken(token),
    csrf,
    userAgent: sanitizeText((meta && meta.ua) || "").slice(0, 200),
    ip: (meta && meta.ip) || "",
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(),
    revokedAt: null
  });
  return { token, csrf };
}

function getSession(req) {
  const token = req.cookies && req.cookies.sid;
  if (!token) return null;
  const s = db.findOne("sessions", { tokenHash: hashToken(token) });
  if (!s || s.revokedAt) return null;
  if (new Date(s.expiresAt).getTime() <= Date.now()) return null;
  return s;
}

function attachUser(req, res, next) {
  req.session = getSession(req);
  req.user = null;
  if (req.session) {
    const u = db.get("users", req.session.userId);
    if (u && !u.deletedAt && !u.suspendedAt) req.user = u;
    else req.session = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in required.", code: "AUTH_REQUIRED" });
  next();
}

function requireVerified(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in required.", code: "AUTH_REQUIRED" });
  if (!req.user.emailVerifiedAt) {
    return res.status(403).json({ error: "Email verification required.", code: "VERIFY_REQUIRED" });
  }
  next();
}

function csrfMw(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path.startsWith("/api/webhooks/")) return next();
  if (!req.session) return next();
  const sent = req.headers["x-csrf-token"] || (req.body && req.body._csrf);
  if (!sent || sent !== req.session.csrf) {
    return res.status(403).json({ error: "Security token mismatch. Please refresh and try again." });
  }
  next();
}

function requireAdmin(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required." });
    if (!["admin", "support", "editor"].includes(req.user.role)) {
      return res.status(403).json({ error: "Administrator access required." });
    }
    const perms = {
      admin: ["*"],
      support: ["users.read", "support.*", "purchases.read", "emails.read"],
      editor: ["docs.*", "emails.*", "legal.*", "products.read", "jobs.*"]
    };
    const allowed = perms[req.user.role] || [];
    const ok = allowed.includes("*") || allowed.some((p) => {
      if (p === permission) return true;
      if (p.endsWith(".*") && permission.startsWith(p.slice(0, -1))) return true;
      return false;
    });
    if (permission && !ok) return res.status(403).json({ error: "Insufficient admin permission." });
    next();
  };
}

function audit(actorType, actorId, action, details, req) {
  try {
    db.insert("auditLog", {
      actorType: actorType || "system",
      actorId: actorId || null,
      action: sanitizeText(action),
      details: sanitizeText(JSON.stringify(details || {})).slice(0, 4000),
      ip: req ? (req.ip || "") : "",
      userAgent: req ? sanitizeText(String(req.headers["user-agent"] || "")).slice(0, 200) : ""
    });
  } catch (e) { /* audit must never crash requests */ }
}

// Privacy middleware: evaluates purpose, consent and minimization before
// data flows to AI, analytics, marketplace or third parties.
function privacyGate(userId, purpose) {
  const user = db.get("users", userId);
  if (!user || user.deletedAt) return { allowed: false, reason: "No active account." };
  const purposes = {
    core: { consentKey: null, alwaysAllowed: true },
    personalization: { consentKey: "personalization" },
    analytics: { consentKey: "analytics" },
    research: { consentKey: "research" },
    marketplace: { consentKey: "marketplace" },
    marketing: { consentKey: "marketing" }
  };
  const p = purposes[purpose] || purposes.core;
  if (p.alwaysAllowed) return { allowed: true };
  const consent = db.findOne("consents", { userId, category: p.consentKey, status: "granted" });
  if (!consent) return { allowed: false, reason: "Consent not granted for " + purpose + "." };
  const dns = db.findOne("consents", { userId, category: "do_not_sell", status: "granted" });
  if (dns && ["research", "marketplace", "marketing"].includes(purpose)) {
    return { allowed: false, reason: "Do Not Sell/Share preference is enabled." };
  }
  return { allowed: true };
}

function secureHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (config.isProd) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

function notFound(req, res) {
  res.status(404).json({ error: "Not found." });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const ref = "ERR-" + Date.now().toString(36).toUpperCase();
  try {
    db.insert("analytics", { kind: "error", ref, route: req.path, message: String(err && err.message || err).slice(0, 500), at: nowIso() });
  } catch (e) { /* ignore */ }
  if (!config.isProd) console.error(ref, err);
  res.status(500).json({ error: "Something went wrong. Reference: " + ref });
}

module.exports = {
  rateLimit, rateLimitMw, setSessionCookie, clearSessionCookie,
  createSession, getSession, attachUser, requireAuth, requireVerified,
  csrfMw, requireAdmin, audit, privacyGate, secureHeaders, notFound, errorHandler
};
