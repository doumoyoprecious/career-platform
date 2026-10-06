"use strict";
// Privacy center: consent management, data export, deletion requests,
// marketplace visibility, data subject requests.

const express = require("express");
const db = require("../db");
const mw = require("../middleware");
const u = require("../lib/utils");
const privacy = require("../services/privacy");
const emailService = require("../services/email");
const config = require("../config");

const router = express.Router();

router.get("/consents", mw.requireVerified, (req, res) => {
  res.json({ categories: privacy.CONSENT_CATEGORIES, state: privacy.consentState(req.user.id) });
});

router.post("/consents", mw.requireVerified, (req, res) => {
  const category = String(req.body.category || "");
  const status = String(req.body.status || "");
  if (!["granted", "withdrawn"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  const cat = privacy.CONSENT_CATEGORIES.find((c) => c.key === category);
  if (!cat || cat.required) return res.status(400).json({ error: "This consent cannot be changed here." });
  try {
    const rec = privacy.recordConsent(req.user.id, category, status, { method: "privacy_center", country: req.user.country });
    if (category === "marketplace" && status === "withdrawn") db.removeWhere("marketplace", { userId: req.user.id });
    res.json({ ok: true, consent: rec });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/export", mw.requireVerified, (req, res) => {
  const data = privacy.exportUserData(req.user.id);
  mw.audit("user", req.user.id, "privacy.exported", {});
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=\"career-data-export.json\"");
  res.send(JSON.stringify(data, null, 2));
});

router.get("/summary", mw.requireVerified, (req, res) => {
  const userId = req.user.id;
  res.json({
    held: {
      account: { name: req.user.name, email: req.user.email, country: req.user.country || "" },
      careerProfile: !!db.findOne("profiles", { userId }),
      cvs: db.count("cvs", { userId }),
      analyses: db.count("analyses", { userId }),
      purchases: db.count("purchases", { userId }),
      documents: db.count("documents", { userId }),
      consents: db.count("consents", { userId }),
      marketplace: !!db.findOne("marketplace", { userId })
    },
    retention: privacy.retentionRules(),
    subprocessors: db.all("subprocessors")
  });
});

// Marketplace
router.get("/marketplace", mw.requireVerified, (req, res) => {
  res.json({ profile: db.findOne("marketplace", { userId: req.user.id }) || null });
});

router.post("/marketplace", mw.requireVerified, (req, res) => {
  const state = privacy.consentState(req.user.id);
  const b = u.sanitizeDeep(req.body || {});
  if (b.enabled === false) {
    db.removeWhere("marketplace", { userId: req.user.id });
    privacy.recordConsent(req.user.id, "marketplace", "withdrawn", { method: "marketplace" });
    return res.json({ ok: true, profile: null });
  }
  privacy.recordConsent(req.user.id, "marketplace", "granted", { method: "marketplace" });
  const doc = {
    userId: req.user.id,
    displayName: String(b.displayName || req.user.name || "").slice(0, 80),
    headline: String(b.headline || "").slice(0, 140),
    skills: (Array.isArray(b.skills) ? b.skills : []).map(String).slice(0, 20),
    experience: String(b.experience || "").slice(0, 1000),
    education: String(b.education || "").slice(0, 500),
    interests: String(b.interests || "").slice(0, 500),
    location: String(b.location || "").slice(0, 80),
    workPreference: String(b.workPreference || "").slice(0, 20),
    portfolio: String(b.portfolio || "").slice(0, 200),
    linkedin: String(b.linkedin || "").slice(0, 200),
    github: String(b.github || "").slice(0, 200),
    visible: b.visible !== false
  };
  const existing = db.findOne("marketplace", { userId: req.user.id });
  const saved = existing ? db.update("marketplace", existing.id, doc) : db.insert("marketplace", doc);
  mw.audit("user", req.user.id, "marketplace.saved", { visible: saved.visible });
  res.json({ ok: true, profile: saved });
});

// Data subject requests
router.post("/requests", mw.requireVerified, async (req, res) => {
  const type = u.sanitizeText(String(req.body.type || "")).slice(0, 40);
  const detail = u.sanitizeText(String(req.body.detail || "")).slice(0, 2000);
  if (!["access", "correction", "deletion", "export", "objection", "other"].includes(type)) {
    return res.status(400).json({ error: "Invalid request type." });
  }
  const r = db.insert("privacyRequests", { userId: req.user.id, email: req.user.email, type, detail, status: "open" });
  await emailService.sendPrivacyUpdate(req.user.email, req.user.name, "We received your " + type + " request and will respond within applicable legal timeframes. Reference: " + r.id + ".", req.user.id);
  mw.audit("user", req.user.id, "privacy.requested", { type });
  res.json({ ok: true, id: r.id });
});

router.get("/requests", mw.requireVerified, (req, res) => {
  res.json({ requests: db.find("privacyRequests", { userId: req.user.id }, { sort: "-createdAt" }) });
});

// Delete account
router.post("/delete-account", mw.requireVerified, async (req, res) => {
  const confirm = String(req.body.confirm || "");
  const password = String(req.body.password || "");
  if (confirm !== "DELETE") return res.status(400).json({ error: "Please type DELETE to confirm." });
  if (!u.checkPassword(password, req.user.passwordHash || "")) return res.status(400).json({ error: "Password is incorrect." });
  await privacy.deleteAccount(req.user.id, "user confirmed");
  mw.clearSessionCookie(res);
  res.json({ ok: true });
});

module.exports = router;
