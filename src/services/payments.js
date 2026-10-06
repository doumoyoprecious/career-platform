"use strict";
// Payment Provider Abstraction Layer.
// Adapters: dev (simulated, development only), stripe (real provider).
// Webhooks are the source of truth. Frontend claims are never trusted.

const db = require("../db");
const config = require("../config");
const crypto = require("crypto");
const { uid, nowIso, sanitizeText } = require("../lib/utils");
const { audit } = require("../middleware");
const emailService = require("./email");

function defaultProducts() {
  return [
    { key: "premium_monthly", kind: "subscription", name: "Premium Monthly", description: "Unlocks all premium features while active.", price: 20, currency: "USD", active: true },
    { key: "cv_upgrade", kind: "one_time", name: "CV Upgrade", description: "Professional rewrite of your existing CV. PDF and DOCX.", price: 3.99, currency: "USD", active: true },
    { key: "job_cv", kind: "one_time", name: "Job-Specific CV", description: "CV tailored to one target job description.", price: 2.99, currency: "USD", active: true },
    { key: "app_package", kind: "one_time", name: "Application Package", description: "Tailored CV, cover letter, answers and checklist.", price: 4.99, currency: "USD", active: true },
    { key: "portfolio", kind: "one_time", name: "Portfolio Intelligence", description: "Portfolio plan plus CV to portfolio gap analysis.", price: 3.99, currency: "USD", active: true },
    { key: "interview", kind: "one_time", name: "Interview Preparation", description: "Questions, answers, criteria and mock interview.", price: 4.99, currency: "USD", active: true },
    { key: "complete_package", kind: "one_time", name: "Complete Application Package", description: "Everything in the Application Package, plus portfolio and interview guides.", price: 5.99, currency: "USD", active: true }
  ];
}

function ensureProducts() {
  for (const p of defaultProducts()) {
    if (!db.findOne("products", { key: p.key })) db.insert("products", p);
  }
}

function providerStatus() {
  ensureProducts();
  const hasStripe = !!(config.payments.stripeSecretKey && config.payments.stripeWebhookSecret);
  if (hasStripe) return { provider: "stripe", mode: "live", ready: true, note: "Stripe is configured." };
  if (!config.isProd && config.payments.mode === "dev") {
    return { provider: "dev", mode: "test", ready: true, note: "Test payment mode. No real charge occurs." };
  }
  return { provider: "none", mode: "unconfigured", ready: false, note: "Payments are not configured yet. Connect a payment provider to accept real payments." };
}

// ---------- Stripe adapter (raw API, no SDK lock in) ----------
async function stripeRequest(path, params) {
  const r = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.payments.stripeSecretKey,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params).toString()
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Stripe error: " + (j.error ? j.error.message : r.status));
  return j;
}

function verifyStripeSignature(rawBody, header) {
  try {
    const parts = String(header || "").split(",");
    const t = (parts.find((p) => p.startsWith("t=")) || "").slice(2);
    const v1 = (parts.find((p) => p.startsWith("v1=")) || "").slice(3);
    if (!t || !v1) return false;
    if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay window
    const expected = crypto.createHmac("sha256", config.payments.stripeWebhookSecret).update(t + "." + rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

const stripeAdapter = {
  async createCheckout(user, product, successUrl, cancelUrl) {
    const customer = db.findOne("transactions", { userId: user.id, provider: "stripe", kind: "customer" });
    const params = {
      mode: product.kind === "subscription" ? "subscription" : "payment",
      success_url: successUrl + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl,
      "line_items[0][price_data][currency]": product.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": product.name,
      "line_items[0][price_data][unit_amount]": String(Math.round(product.price * 100)),
      "line_items[0][quantity]": "1",
      client_reference_id: user.id,
      "metadata[userId]": user.id,
      "metadata[productKey]": product.key,
      customer_email: user.email
    };
    if (customer && customer.providerRef) params.customer = customer.providerRef;
    const session = await stripeRequest("/checkout/sessions", params);
    return { checkoutUrl: session.url, sessionId: session.id };
  }
};

// ---------- Dev adapter (development only) ----------
const devAdapter = {
  async createCheckout(user, product) {
    if (config.isProd) throw new Error("Test payments are unavailable in production.");
    const sessionId = uid("test");
    db.insert("transactions", {
      userId: user.id, kind: "checkout", provider: "dev",
      providerRef: sessionId, productKey: product.key,
      amount: product.price, currency: product.currency,
      status: "pending", at: nowIso()
    });
    return { checkoutUrl: config.baseUrl + "/#/checkout/" + sessionId, sessionId };
  }
};

// ---------- Core payment operations ----------
async function createCheckout(user, productKey) {
  ensureProducts();
  const product = db.findOne("products", { key: productKey, active: true });
  if (!product) throw new Error("Product not available.");
  const status = providerStatus();
  if (!status.ready) throw new Error("Payments are not configured yet.");
  const successUrl = config.baseUrl + "/#/billing/success";
  const cancelUrl = config.baseUrl + "/#/billing/cancelled";
  if (status.provider === "stripe") {
    const out = await stripeAdapter.createCheckout(user, product, successUrl, cancelUrl);
    db.insert("transactions", {
      userId: user.id, kind: "checkout", provider: "stripe", providerRef: out.sessionId,
      productKey: product.key, amount: product.price, currency: product.currency,
      status: "pending", at: nowIso()
    });
    audit("user", user.id, "payment.checkout_created", { product: product.key, provider: "stripe" });
    return { checkoutUrl: out.checkoutUrl, sessionId: out.sessionId, provider: "stripe", testMode: false };
  }
  const out = await devAdapter.createCheckout(user, product);
  audit("user", user.id, "payment.test_checkout_created", { product: product.key });
  return { checkoutUrl: out.checkoutUrl, sessionId: out.sessionId, provider: "dev", testMode: true };
}

function getEntitlementState(userId) {
  const now = Date.now();
  const sub = db.find("subscriptions", { userId, status: "active" })
    .filter((s) => !s.currentPeriodEnd || new Date(s.currentPeriodEnd).getTime() > now)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0] || null;
  const oneTime = db.find("entitlements", { userId, status: "active" });
  return { premium: !!sub, subscription: sub, oneTime };
}

function hasAccess(userId, featureKey) {
  // featureKey: cv_upgrade, job_cv, app_package, portfolio, interview, complete_package
  const state = getEntitlementState(userId);
  if (state.premium) return { ok: true, via: "subscription" };
  const ent = db.findOne("entitlements", { userId, productKey: featureKey, status: "active" });
  if (ent) return { ok: true, via: "purchase", entitlementId: ent.id };
  if (featureKey !== "complete_package") {
    const complete = db.findOne("entitlements", { userId, productKey: "complete_package", status: "active" });
    if (complete) return { ok: true, via: "purchase", entitlementId: complete.id };
  }
  return { ok: false };
}

// Called only from verified webhooks or verified provider callbacks.
async function fulfillCheckout(sessionId, provider, providerEventId, outcome) {
  // Idempotency: never process the same event twice.
  if (providerEventId && db.findOne("webhookEvents", { eventId: providerEventId })) {
    return { duplicate: true };
  }
  const txn = db.findOne("transactions", { providerRef: sessionId, provider });
  if (!txn) throw new Error("Checkout session not found.");
  if (txn.status === "succeeded" || txn.status === "failed") return { duplicate: true, status: txn.status };
  if (providerEventId) db.insert("webhookEvents", { eventId: providerEventId, provider, sessionId, at: nowIso() });

  const user = db.get("users", txn.userId);
  const product = db.findOne("products", { key: txn.productKey });
  if (outcome === "failed") {
    db.update("transactions", txn.id, { status: "failed" });
    audit("system", txn.userId, "payment.failed", { product: txn.productKey });
    if (user) {
      await emailService.sendPaymentFailure(user.email, { name: user.name, product: product ? product.name : txn.productKey, amount: txn.amount + " " + txn.currency, actionUrl: config.baseUrl + "/#/billing" }, user.id);
      db.insert("notifications", { userId: user.id, kind: "payment", title: "Payment failed", body: "A payment for " + (product ? product.name : txn.productKey) + " did not go through.", readAt: null, at: nowIso() });
    }
    return { status: "failed" };
  }

  // Success path: transaction -> purchase -> entitlement -> receipt, atomically ordered.
  db.update("transactions", txn.id, { status: "succeeded" });
  const purchase = db.insert("purchases", {
    userId: txn.userId, productKey: txn.productKey, transactionId: txn.id,
    amount: txn.amount, currency: txn.currency, provider,
    status: "completed", refundedAt: null, at: nowIso()
  });
  let entitlement = null;
  if (product && product.kind === "subscription") {
    const existing = db.findOne("subscriptions", { userId: txn.userId, status: "active" });
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    if (existing) {
      db.update("subscriptions", existing.id, { currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false });
    } else {
      db.insert("subscriptions", {
        userId: txn.userId, provider, providerRef: sessionId,
        plan: product.key, status: "active",
        currentPeriodStart: nowIso(), currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false, canceledAt: null
      });
    }
    entitlement = { kind: "subscription" };
    if (user) await emailService.sendSubscriptionConfirmation(user.email, { name: user.name, amount: txn.amount + " " + txn.currency, date: periodEnd.slice(0, 10), actionUrl: config.baseUrl + "/#/billing" }, user.id);
  } else {
    entitlement = db.insert("entitlements", {
      userId: txn.userId, productKey: txn.productKey, purchaseId: purchase.id,
      status: "active", revokedAt: null, at: nowIso()
    });
  }
  audit("system", txn.userId, "payment.succeeded", { product: txn.productKey, amount: txn.amount });
  if (user) {
    await emailService.sendPurchaseReceipt(user.email, { name: user.name, product: product ? product.name : txn.productKey, amount: txn.amount + " " + txn.currency, date: nowIso().slice(0, 10), txn: txn.id, actionUrl: config.baseUrl + "/#/billing" }, user.id);
    db.insert("notifications", { userId: user.id, kind: "payment", title: "Payment successful", body: (product ? product.name : txn.productKey) + " is now available.", readAt: null, at: nowIso() });
  }
  return { status: "succeeded", purchase, entitlement };
}

async function handleStripeEvent(rawBody, signature, parsed) {
  if (!verifyStripeSignature(rawBody, signature)) {
    const e = new Error("Invalid webhook signature.");
    e.code = "BAD_SIGNATURE";
    throw e;
  }
  const event = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  if (db.findOne("webhookEvents", { eventId: event.id })) return { duplicate: true };
  const type = event.type || "";
  const obj = event.data && event.data.object ? event.data.object : {};
  audit("system", null, "webhook.stripe", { type, id: event.id });

  if (type === "checkout.session.completed") {
    return fulfillCheckout(obj.id, "stripe", event.id, obj.payment_status === "paid" || obj.status === "complete" ? "succeeded" : "failed");
  }
  if (type === "invoice.payment_succeeded") {
    db.insert("webhookEvents", { eventId: event.id, provider: "stripe", at: nowIso() });
    const subId = obj.subscription;
    const sub = db.findOne("subscriptions", { providerRef: subId }) || (obj.customer_email ? db.find("subscriptions", {}).find((s) => { const u = db.get("users", s.userId); return u && u.email === obj.customer_email && s.provider === "stripe"; }) : null);
    if (sub) {
      const periodEnd = obj.lines && obj.lines.data && obj.lines.data[0] ? new Date(obj.lines.data[0].period.end * 1000).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
      db.update("subscriptions", sub.id, { status: "active", currentPeriodEnd: periodEnd });
      const user = db.get("users", sub.userId);
      if (user) {
        await emailService.sendSubscriptionRenewal(user.email, { name: user.name, amount: (obj.amount_paid / 100) + " " + String(obj.currency || "").toUpperCase(), date: periodEnd.slice(0, 10), actionUrl: config.baseUrl + "/#/billing" }, user.id);
        db.insert("notifications", { userId: user.id, kind: "payment", title: "Subscription renewed", body: "Your Premium subscription was renewed.", readAt: null, at: nowIso() });
      }
    }
    return { status: "renewed" };
  }
  if (type === "invoice.payment_failed") {
    db.insert("webhookEvents", { eventId: event.id, provider: "stripe", at: nowIso() });
    const email = obj.customer_email;
    if (email) {
      const user = db.findOne("users", { email: String(email).toLowerCase() });
      if (user) {
        await emailService.sendPaymentFailure(user.email, { name: user.name, product: "Premium subscription", amount: (obj.amount_due / 100) + " " + String(obj.currency || "").toUpperCase(), actionUrl: config.baseUrl + "/#/billing" }, user.id);
        db.insert("notifications", { userId: user.id, kind: "payment", title: "Renewal payment failed", body: "Your subscription renewal did not go through. Please update billing.", readAt: null, at: nowIso() });
      }
    }
    return { status: "failed_noted" };
  }
  if (type === "customer.subscription.deleted") {
    db.insert("webhookEvents", { eventId: event.id, provider: "stripe", at: nowIso() });
    const sub = db.findOne("subscriptions", { providerRef: obj.id });
    if (sub) {
      db.update("subscriptions", sub.id, { status: "canceled", canceledAt: nowIso() });
      const user = db.get("users", sub.userId);
      if (user) await emailService.sendSubscriptionCanceled(user.email, { name: user.name, date: (sub.currentPeriodEnd || "").slice(0, 10) }, user.id);
    }
    return { status: "canceled" };
  }
  if (type === "charge.refunded") {
    db.insert("webhookEvents", { eventId: event.id, provider: "stripe", at: nowIso() });
    await applyRefund({ providerRef: obj.payment_intent || obj.id }, "Refunded via provider.");
    return { status: "refunded" };
  }
  db.insert("webhookEvents", { eventId: event.id, provider: "stripe", unhandled: type, at: nowIso() });
  return { status: "ignored", type };
}

async function applyRefund(match, reason) {
  const txn = db.findOne("transactions", { providerRef: match.providerRef }) || db.findOne("transactions", { id: match.transactionId });
  if (!txn) throw new Error("Transaction not found.");
  db.update("transactions", txn.id, { status: "refunded" });
  const purchase = db.findOne("purchases", { transactionId: txn.id });
  if (purchase) db.update("purchases", purchase.id, { status: "refunded", refundedAt: nowIso() });
  const ents = db.find("entitlements", { userId: txn.userId }).filter((e) => purchase && e.purchaseId === purchase.id);
  for (const e of ents) db.update("entitlements", e.id, { status: "revoked", revokedAt: nowIso() });
  const docs = purchase ? db.find("documents", { purchaseId: purchase.id }) : [];
  for (const d of docs) db.update("documents", d.id, { accessRevoked: true });
  const product = db.findOne("products", { key: txn.productKey });
  const user = db.get("users", txn.userId);
  audit("system", txn.userId, "payment.refunded", { product: txn.productKey, reason: sanitizeText(reason || "") });
  if (user) {
    await emailService.sendRefundConfirmation(user.email, { name: user.name, product: product ? product.name : txn.productKey, amount: txn.amount + " " + txn.currency, txn: txn.id }, user.id);
    db.insert("notifications", { userId: user.id, kind: "payment", title: "Refund processed", body: "A refund for " + (product ? product.name : txn.productKey) + " was processed.", readAt: null, at: nowIso() });
  }
  return { ok: true };
}

async function cancelSubscription(userId) {
  const sub = db.find("subscriptions", { userId, status: "active" })[0];
  if (!sub) throw new Error("No active subscription.");
  db.update("subscriptions", sub.id, { cancelAtPeriodEnd: true, canceledAt: nowIso() });
  const user = db.get("users", userId);
  audit("user", userId, "subscription.canceled", { plan: sub.plan });
  if (user) await emailService.sendSubscriptionCanceled(user.email, { name: user.name, date: (sub.currentPeriodEnd || "").slice(0, 10) }, user.id);
  return db.get("subscriptions", sub.id);
}

module.exports = {
  ensureProducts, providerStatus, createCheckout, fulfillCheckout,
  getEntitlementState, hasAccess, handleStripeEvent, applyRefund,
  cancelSubscription, verifyStripeSignature
};
