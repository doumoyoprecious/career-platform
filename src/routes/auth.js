"use strict";
// Authentication routes: signup, verification, signin, password reset,
// password/email change, sessions, account data.

const express = require("express");
const db = require("../db");
const config = require("../config");
const emailService = require("../services/email");
const { recordConsent } = require("../services/privacy");
const mw = require("../middleware");
const u = require("../lib/utils");

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id, name: user.name, email: user.email,
    emailVerifiedAt: user.emailVerifiedAt || null,
    role: user.role || "user", country: user.country || "",
    onboardedAt: user.onboardedAt || null, createdAt: user.createdAt
  };
}

function issueToken(userId, type, ttlHours) {
  const token = u.randomToken(32);
  db.insert("tokens", {
    userId, type, tokenHash: u.hashToken(token),
    expiresAt: new Date(Date.now() + ttlHours * 3600000).toISOString(),
    usedAt: null
  });
  return token;
}

function consumeToken(type, token) {
  const rec = db.findOne("tokens", { type, tokenHash: u.hashToken(token) });
  if (!rec || rec.usedAt) return null;
  if (u.isExpired(rec.expiresAt)) return null;
  db.update("tokens", rec.id, { usedAt: u.nowIso() });
  return rec;
}

// Signup
router.post("/signup", mw.rateLimitMw(10, 3600000, (r) => r.ip), async (req, res) => {
  const name = u.sanitizeText(String(req.body.name || "").trim()).slice(0, 80);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const country = u.sanitizeText(String(req.body.country || "").trim()).slice(0, 60);
  if (!name) return res.status(400).json({ error: "Please enter your full name." });
  if (!u.isEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (!u.isStrongPassword(password)) return res.status(400).json({ error: "Password must be at least 8 characters and include letters and numbers." });
  if (db.findOne("users", { email })) {
    // Anti enumeration: same flow, generic message handled on frontend by asking to sign in.
    return res.status(400).json({ error: "An account with this email already exists. Please sign in." });
  }
  const role = (config.adminEmail && email === config.adminEmail && db.count("users", { role: "admin" }) === 0) ? "admin" : "user";
  const user = db.insert("users", {
    name, email, passwordHash: u.hashPassword(password), role, country,
    emailVerifiedAt: null, onboardedAt: null, suspendedAt: null, deletedAt: null,
    notifyProduct: true, notifySecurity: true
  });
  recordConsent(user.id, "terms", "granted", { method: "signup", country });
  recordConsent(user.id, "privacy", "granted", { method: "signup", country });
  const token = issueToken(user.id, "verify", 24);
  const url = config.baseUrl + "/#/verify?token=" + token;
  await emailService.sendVerificationEmail(email, name, url, user.id);
  const session = mw.createSession(user.id, { ua: req.headers["user-agent"], ip: req.ip });
  mw.setSessionCookie(res, session.token);
  mw.audit("user", user.id, "auth.signup", { email });
  res.json({ ok: true, csrf: session.csrf, user: publicUser(user), verifyRequired: true });
});

// Resend verification
router.post("/verify/resend", mw.requireAuth, mw.rateLimitMw(5, 3600000, (r) => r.user.id), async (req, res) => {
  if (req.user.emailVerifiedAt) return res.json({ ok: true, already: true });
  const token = issueToken(req.user.id, "verify", 24);
  const url = config.baseUrl + "/#/verify?token=" + token;
  await emailService.sendVerificationEmail(req.user.email, req.user.name, url, req.user.id);
  mw.audit("user", req.user.id, "auth.verify_resent", {});
  res.json({ ok: true });
});

// Verify email
router.post("/verify", async (req, res) => {
  const token = String(req.body.token || "");
  const rec = consumeToken("verify", token);
  if (!rec) return res.status(400).json({ error: "This verification link is invalid or expired. Please request a new one." });
  const user = db.get("users", rec.userId);
  if (!user || user.deletedAt) return res.status(400).json({ error: "Account not found." });
  db.update("users", user.id, { emailVerifiedAt: u.nowIso() });
  await emailService.sendWelcomeEmail(user.email, user.name, config.baseUrl + "/#/onboarding", user.id);
  mw.audit("user", user.id, "auth.verified", {});
  res.json({ ok: true });
});

// Sign in
router.post("/signin", mw.rateLimitMw(20, 60000, (r) => r.ip), async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.findOne("users", { email });
  if (!user || user.deletedAt || !u.checkPassword(password, user.passwordHash || "")) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (user.suspendedAt) return res.status(403).json({ error: "This account is suspended. Please contact support." });
  db.removeWhere("sessions", { userId: user.id });
  const session = mw.createSession(user.id, { ua: req.headers["user-agent"], ip: req.ip });
  mw.setSessionCookie(res, session.token);
  mw.audit("user", user.id, "auth.login", {});
  res.json({ ok: true, csrf: session.csrf, user: publicUser(user) });
});

router.post("/signout", mw.requireAuth, (req, res) => {
  if (req.session) db.update("sessions", req.session.id, { revokedAt: u.nowIso() });
  mw.clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(req.user), csrf: req.session ? req.session.csrf : null });
});

// Forgot password (generic response, anti enumeration)
router.post("/forgot", mw.rateLimitMw(5, 3600000, (r) => r.ip), async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const generic = "If an account exists for this email address, you will receive password reset instructions.";
  const user = db.findOne("users", { email });
  if (user && !user.deletedAt) {
    const token = issueToken(user.id, "reset", 1);
    const url = config.baseUrl + "/#/reset?token=" + token;
    await emailService.sendPasswordResetEmail(user.email, user.name, url, user.id);
    mw.audit("user", user.id, "auth.reset_requested", {});
  }
  res.json({ ok: true, message: generic });
});

// Reset password
router.post("/reset", mw.rateLimitMw(10, 3600000, (r) => r.ip), async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (!u.isStrongPassword(password)) return res.status(400).json({ error: "Password must be at least 8 characters and include letters and numbers." });
  const rec = consumeToken("reset", token);
  if (!rec) return res.status(400).json({ error: "This reset link is invalid or expired. Please request a new one." });
  const user = db.get("users", rec.userId);
  if (!user || user.deletedAt) return res.status(400).json({ error: "Account not found." });
  db.update("users", user.id, { passwordHash: u.hashPassword(password) });
  db.removeWhere("sessions", { userId: user.id });
  await emailService.sendPasswordChanged(user.email, user.name, user.id);
  mw.audit("user", user.id, "auth.reset_completed", {});
  res.json({ ok: true });
});

// Change password
router.post("/password", mw.requireVerified, async (req, res) => {
  const current = String(req.body.current || "");
  const next = String(req.body.next || "");
  if (!u.checkPassword(current, req.user.passwordHash || "")) return res.status(400).json({ error: "Current password is incorrect." });
  if (!u.isStrongPassword(next)) return res.status(400).json({ error: "New password must be at least 8 characters and include letters and numbers." });
  db.update("users", req.user.id, { passwordHash: u.hashPassword(next) });
  await emailService.sendPasswordChanged(req.user.email, req.user.name, req.user.id);
  mw.audit("user", req.user.id, "auth.password_changed", {});
  res.json({ ok: true });
});

// Change email
router.post("/email", mw.requireVerified, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!u.isEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (db.findOne("users", { email })) return res.status(400).json({ error: "This email address is already in use." });
  const old = req.user.email;
  db.update("users", req.user.id, { email, emailVerifiedAt: null });
  const token = issueToken(req.user.id, "verify", 24);
  await emailService.sendVerificationEmail(email, req.user.name, config.baseUrl + "/#/verify?token=" + token, req.user.id);
  await emailService.sendEmailChanged(old, req.user.name, req.user.id);
  mw.audit("user", req.user.id, "auth.email_changed", {});
  res.json({ ok: true, verifyRequired: true });
});

router.get("/sessions", mw.requireVerified, (req, res) => {
  const rows = db.find("sessions", { userId: req.user.id }, { sort: "-createdAt" }).map((s) => ({
    id: s.id, current: req.session && s.id === req.session.id,
    userAgent: s.userAgent, ip: s.ip, createdAt: s.createdAt, expiresAt: s.expiresAt
  }));
  res.json({ sessions: rows });
});

router.delete("/sessions/:id", mw.requireVerified, (req, res) => {
  const s = db.get("sessions", req.params.id);
  if (!s || s.userId !== req.user.id) return res.status(404).json({ error: "Session not found." });
  db.update("sessions", s.id, { revokedAt: u.nowIso() });
  res.json({ ok: true });
});

module.exports = router;
