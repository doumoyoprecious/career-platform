"use strict";
// Provider webhooks. Raw body is required for signature verification.

const express = require("express");
const payments = require("../services/payments");

const router = express.Router();

router.post("/stripe", express.raw({ type: "*/*" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const raw = req.body ? req.body.toString("utf8") : "";
  try {
    const out = await payments.handleStripeEvent(raw, sig, raw);
    res.json({ received: true, out });
  } catch (e) {
    res.status(e.code === "BAD_SIGNATURE" ? 400 : 500).json({ error: e.message });
  }
});

router.post("/email", express.json(), (req, res) => {
  // Generic email event webhook (delivered, bounced, complained).
  const db = require("../db");
  const event = String(req.body.event || req.body.type || "unknown");
  const to = String((req.body.email || req.body.to || "")).toLowerCase();
  if (to) {
    const last = db.find("emailLog", { to }, { sort: "-createdAt", limit: 1 })[0];
    if (last && ["bounced", "failed", "complained"].includes(event)) {
      db.update("emailLog", last.id, { status: event });
    }
  }
  res.json({ received: true });
});

module.exports = router;
