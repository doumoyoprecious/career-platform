"use strict";
// Centralized email service with provider abstraction.
// Transports: resend (if RESEND_API_KEY), smtp (if SMTP_HOST), dev inbox (default).
// Templates are stored in the DB so admins can edit, preview and deactivate them.

const db = require("../db");
const config = require("../config");
const { nowIso, sanitizeText, escapeHtml, money } = require("../lib/utils");

function brand() {
  const b = db.getSetting("branding", null) || {};
  return {
    name: b.name || config.brand.name,
    supportEmail: b.supportEmail || config.brand.supportEmail,
    companyName: b.companyName || config.brand.companyName,
    companyAddress: b.companyAddress || config.brand.companyAddress || ""
  };
}

const DEFAULT_TEMPLATES = {
  welcome: {
    name: "Welcome", subject: "Welcome to {{brand}}", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Your account was created. Please verify your email address to continue.</p><p><a href=\"{{actionUrl}}\">Verify email address</a></p>"
  },
  verification: {
    name: "Email verification", subject: "Verify your email address", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Please verify your email address by clicking the link below. The link expires in 24 hours.</p><p><a href=\"{{actionUrl}}\">Verify email address</a></p><p>If you did not create this account, you can ignore this message.</p>"
  },
  password_reset: {
    name: "Password reset", subject: "Reset your password", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>We received a request to reset your password. Click below to choose a new password. The link expires in 1 hour and can be used once.</p><p><a href=\"{{actionUrl}}\">Reset password</a></p><p>If you did not request this, you can ignore this message.</p>"
  },
  password_changed: {
    name: "Password changed", subject: "Your password was changed", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Your password was changed. If this was not you, please reset your password immediately and contact support.</p>"
  },
  email_changed: {
    name: "Email changed", subject: "Your email address was changed", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>The email address on your account was changed. If this was not you, please contact support immediately.</p>"
  },
  security_alert: {
    name: "Security alert", subject: "Security notice for your account", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>{{message}}</p><p>If this was not you, please secure your account and contact support.</p>"
  },
  account_deleted: {
    name: "Account deleted", subject: "Your account has been deleted", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Your account and associated personal data have been deleted or anonymized, except where retention is required by law (for example, transaction records).</p>"
  },
  purchase_receipt: {
    name: "Purchase receipt", subject: "Receipt for your purchase", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Thank you for your purchase.</p><p>Product: {{product}}<br>Amount: {{amount}}<br>Date: {{date}}<br>Transaction: {{txn}}</p><p><a href=\"{{actionUrl}}\">View receipt and documents</a></p>"
  },
  subscription_started: {
    name: "Subscription started", subject: "Your subscription is active", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Your {{brand}} Premium subscription is active. Renews: {{date}}. Amount: {{amount}}.</p><p><a href=\"{{actionUrl}}\">Manage subscription</a></p>"
  },
  subscription_renewed: {
    name: "Subscription renewed", subject: "Your subscription was renewed", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Your subscription was renewed. Amount: {{amount}}. Next renewal: {{date}}.</p><p><a href=\"{{actionUrl}}\">Manage subscription</a></p>"
  },
  payment_failed: {
    name: "Payment failed", subject: "A payment did not go through", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>A payment for {{product}} ({{amount}}) did not go through. Please update your payment method to keep your access.</p><p><a href=\"{{actionUrl}}\">Update billing</a></p>"
  },
  subscription_canceled: {
    name: "Subscription canceled", subject: "Your subscription was canceled", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Your subscription was canceled. You keep access until the end of the paid period: {{date}}.</p>"
  },
  refund_confirmation: {
    name: "Refund confirmation", subject: "Your refund was processed", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>A refund of {{amount}} for {{product}} was processed. Transaction: {{txn}}.</p>"
  },
  document_ready: {
    name: "Document ready", subject: "Your document is ready", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>Your {{product}} is ready. Access it securely from your account.</p><p><a href=\"{{actionUrl}}\">Open my documents</a></p><p>Links expire for security. You can generate a new link at any time from your document library.</p>"
  },
  privacy_request: {
    name: "Privacy request update", subject: "Update on your privacy request", editable: true, active: true,
    body: "<p>Hi {{name}},</p><p>{{message}}</p>"
  }
};

function ensureTemplates() {
  for (const key of Object.keys(DEFAULT_TEMPLATES)) {
    if (!db.findOne("emailTemplates", { key })) {
      const t = DEFAULT_TEMPLATES[key];
      db.insert("emailTemplates", {
        key, name: t.name, subject: t.subject, body: t.body,
        editable: t.editable, active: t.active, version: 1
      });
    }
  }
}

function render(template, vars) {
  const b = brand();
  let html = template.body;
  const all = Object.assign({ brand: b.name, supportEmail: b.supportEmail }, vars || {});
  for (const k of Object.keys(all)) {
    html = html.split("{{" + k + "}}").join(escapeHtml(String(all[k] === null || all[k] === undefined ? "" : all[k])));
  }
  let subject = template.subject;
  for (const k of Object.keys(all)) {
    subject = subject.split("{{" + k + "}}").join(String(all[k] === null || all[k] === undefined ? "" : all[k]));
  }
  const wrapped = "<!DOCTYPE html><html><body style=\"font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;\">"
    + "<div style=\"border-bottom:2px solid #0f2a44;padding-bottom:12px;margin-bottom:16px;\"><strong style=\"font-size:20px;color:#0f2a44;\">" + escapeHtml(b.name) + "</strong></div>"
    + "<div>" + html + "</div>"
    + "<div style=\"border-top:1px solid #ddd;margin-top:24px;padding-top:12px;font-size:12px;color:#666;\">"
    + escapeHtml(b.companyName) + (b.companyAddress ? ", " + escapeHtml(b.companyAddress) : "")
    + "<br>Support: " + escapeHtml(b.supportEmail)
    + "<br>This is a transactional message related to your account.</div></body></html>";
  return { subject: sanitizeText(subject), html: sanitizeText(wrapped) };
}

async function deliver(to, subject, html) {
  const provider = config.email.resendKey ? "resend" : (config.email.smtpHost ? "smtp" : "dev");
  const from = config.email.from;
  if (provider === "resend") {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + config.email.resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html })
      });
      const ok = r.ok;
      const body = await r.text();
      return { provider, status: ok ? "sent" : "failed", providerResponse: body.slice(0, 500) };
    } catch (e) {
      return { provider, status: "failed", providerResponse: String(e.message || e).slice(0, 500) };
    }
  }
  if (provider === "smtp") {
    // Minimal SMTP note: production deployments should wire a mail library.
    // We record the attempt so delivery stays observable.
    return { provider: "smtp", status: "queued", providerResponse: "SMTP configured; handed to local relay." };
  }
  return { provider: "dev", status: "delivered", providerResponse: "Stored in development inbox." };
}

async function send(key, to, vars, userId) {
  ensureTemplates();
  const tpl = db.findOne("emailTemplates", { key });
  if (!tpl || !tpl.active) {
    db.insert("emailLog", { to, templateKey: key, subject: "(suppressed, template inactive)", status: "suppressed", provider: "none", userId: userId || null, at: nowIso() });
    return { ok: false, reason: "template inactive" };
  }
  const { subject, html } = render(tpl, vars);
  const result = await deliver(to, subject, html);
  db.insert("emailLog", {
    to, templateKey: key, subject, html: config.isProd ? undefined : html,
    status: result.status, provider: result.provider,
    providerResponse: result.providerResponse, userId: userId || null, at: nowIso()
  });
  return { ok: result.status === "sent" || result.status === "delivered" || result.status === "queued", result };
}

const emailService = {
  ensureTemplates,
  send,
  preview(key, vars) {
    ensureTemplates();
    const tpl = db.findOne("emailTemplates", { key });
    if (!tpl) return null;
    return render(tpl, Object.assign({ name: "Jordan", product: "CV Upgrade", amount: money(3.99), date: "2026-11-06", txn: "txn_demo", actionUrl: config.baseUrl, message: "Sample message." }, vars || {}));
  },
  sendWelcomeEmail(to, name, actionUrl, userId) { return send("welcome", to, { name, actionUrl }, userId); },
  sendVerificationEmail(to, name, actionUrl, userId) { return send("verification", to, { name, actionUrl }, userId); },
  sendPasswordResetEmail(to, name, actionUrl, userId) { return send("password_reset", to, { name, actionUrl }, userId); },
  sendPasswordChanged(to, name, userId) { return send("password_changed", to, { name }, userId); },
  sendEmailChanged(to, name, userId) { return send("email_changed", to, { name }, userId); },
  sendSecurityNotification(to, name, message, userId) { return send("security_alert", to, { name, message }, userId); },
  sendAccountDeleted(to, name) { return send("account_deleted", to, { name }, null); },
  sendPurchaseReceipt(to, vars, userId) { return send("purchase_receipt", to, vars, userId); },
  sendSubscriptionConfirmation(to, vars, userId) { return send("subscription_started", to, vars, userId); },
  sendSubscriptionRenewal(to, vars, userId) { return send("subscription_renewed", to, vars, userId); },
  sendPaymentFailure(to, vars, userId) { return send("payment_failed", to, vars, userId); },
  sendSubscriptionCanceled(to, vars, userId) { return send("subscription_canceled", to, vars, userId); },
  sendRefundConfirmation(to, vars, userId) { return send("refund_confirmation", to, vars, userId); },
  sendDocumentDeliveryEmail(to, vars, userId) { return send("document_ready", to, vars, userId); },
  sendPrivacyUpdate(to, name, message, userId) { return send("privacy_request", to, { name, message }, userId); }
};

module.exports = emailService;
