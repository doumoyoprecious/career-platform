"use strict";
// Public routes: branding, pricing, legal documents, marketplace browse.

const express = require("express");
const db = require("../db");
const config = require("../config");
const payments = require("../services/payments");

const router = express.Router();

router.get("/branding", (req, res) => {
  const b = db.getSetting("branding", {});
  res.json({
    name: b.name || config.brand.name,
    supportEmail: b.supportEmail || config.brand.supportEmail,
    companyName: b.companyName || config.brand.companyName,
    primaryColor: b.primaryColor || "#0f2a44",
    accentColor: b.accentColor || "#1f7a5c"
  });
});

router.get("/pricing", (req, res) => {
  payments.ensureProducts();
  res.json({ products: db.find("products", { active: true }), payments: payments.providerStatus() });
});

router.get("/legal/:key", (req, res) => {
  const d = db.findOne("legalDocs", { key: req.params.key });
  if (!d) return res.status(404).json({ error: "Not found." });
  res.json({ title: d.title, body: d.body, version: d.version });
});

router.get("/marketplace", (req, res) => {
  const flag = db.findOne("featureFlags", { key: "marketplace" });
  if (flag && !flag.enabled) return res.json({ profiles: [], disabled: true });
  const rows = db.find("marketplace", { visible: true }, { limit: 50 }).map((m) => ({
    displayName: m.displayName, headline: m.headline, skills: m.skills,
    location: m.location, workPreference: m.workPreference,
    portfolio: m.portfolio, linkedin: m.linkedin, github: m.github
  }));
  res.json({ profiles: rows });
});

router.get("/health", (req, res) => {
  res.json({ ok: true, env: config.isProd ? "production" : "development", time: new Date().toISOString() });
});

module.exports = router;
