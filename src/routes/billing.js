"use strict";
// Billing routes: pricing, checkout, dev confirmation, subscriptions,
// purchase history, receipts.

const express = require("express");
const db = require("../db");
const config = require("../config");
const mw = require("../middleware");
const u = require("../lib/utils");
const payments = require("../services/payments");

const router = express.Router();

router.get("/products", (req, res) => {
  payments.ensureProducts();
  const products = db.find("products", { active: true });
  res.json({ products, status: payments.providerStatus() });
});

router.get("/overview", mw.requireVerified, (req, res) => {
  const ent = payments.getEntitlementState(req.user.id);
  const purchases = db.find("purchases", { userId: req.user.id }, { sort: "-createdAt" });
  const transactions = db.find("transactions", { userId: req.user.id }, { sort: "-createdAt", limit: 50 });
  const subscriptions = db.find("subscriptions", { userId: req.user.id }, { sort: "-createdAt" });
  res.json({ entitlements: ent, purchases, transactions, subscriptions, provider: payments.providerStatus() });
});

router.post("/checkout", mw.requireVerified, async (req, res) => {
  const productKey = String(req.body.productKey || "");
  try {
    const out = await payments.createCheckout(req.user, productKey);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Development test checkout confirmation. Disabled in production.
router.post("/dev-confirm/:sessionId", mw.requireVerified, async (req, res) => {
  if (config.isProd) return res.status(403).json({ error: "Not available in production." });
  const outcome = req.body.outcome === "failed" ? "failed" : "succeeded";
  try {
    const result = await payments.fulfillCheckout(req.params.sessionId, "dev", "dev_" + req.params.sessionId + "_" + outcome, outcome);
    res.json({ ok: true, result, testMode: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/dev-checkout/:sessionId", mw.requireVerified, (req, res) => {
  if (config.isProd) return res.status(403).json({ error: "Not available in production." });
  const txn = db.findOne("transactions", { providerRef: req.params.sessionId, provider: "dev", userId: req.user.id });
  if (!txn) return res.status(404).json({ error: "Checkout session not found." });
  const product = db.findOne("products", { key: txn.productKey });
  res.json({ transaction: txn, product });
});

router.post("/subscription/cancel", mw.requireVerified, async (req, res) => {
  try {
    const sub = await payments.cancelSubscription(req.user.id);
    res.json({ ok: true, subscription: sub });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/receipt/:purchaseId", mw.requireVerified, (req, res) => {
  const p = db.get("purchases", req.params.purchaseId);
  if (!p || p.userId !== req.user.id) return res.status(404).json({ error: "Receipt not found." });
  const product = db.findOne("products", { key: p.productKey });
  const branding = db.getSetting("branding", {});
  res.json({
    receipt: {
      customerName: req.user.name, customerEmail: req.user.email,
      product: product ? product.name : p.productKey,
      amount: p.amount, currency: p.currency, date: p.at,
      transactionId: p.transactionId, provider: p.provider, status: p.status,
      company: branding.companyName || config.brand.companyName,
      support: branding.supportEmail || config.brand.supportEmail
    }
  });
});

module.exports = router;
