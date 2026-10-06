"use strict";
// Privacy engine: consent ledger, data export, deletion, retention,
// marketplace controls, data subject requests.

const db = require("../db");
const { nowIso, sanitizeText } = require("../lib/utils");
const { audit } = require("../middleware");
const emailService = require("./email");

const CONSENT_CATEGORIES = [
  { key: "terms", label: "Terms of Service", required: true, wording: "I agree to the Terms of Service." },
  { key: "privacy", label: "Privacy Policy", required: true, wording: "I have read the Privacy Policy." },
  { key: "personalization", label: "Personalization", required: false, wording: "Use my career activity to personalize recommendations." },
  { key: "analytics", label: "Product analytics", required: false, wording: "Include my usage in privacy-conscious product analytics." },
  { key: "research", label: "Aggregated research", required: false, wording: "Include my de-identified data in aggregated research with minimum group sizes." },
  { key: "marketplace", label: "Professional marketplace", required: false, wording: "Show my marketplace profile to approved viewers." },
  { key: "marketing", label: "Marketing messages", required: false, wording: "Send me occasional product news and tips." },
  { key: "do_not_sell", label: "Do Not Sell/Share", required: false, wording: "Do not sell or share my personal information." }
];

function recordConsent(userId, category, status, meta) {
  const cat = CONSENT_CATEGORIES.find((c) => c.key === category);
  if (!cat) throw new Error("Unknown consent category.");
  const existing = db.find("consents", { userId, category }).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0];
  if (existing && existing.status === status) return existing;
  const rec = db.insert("consents", {
    userId, category, status,
    wording: cat.wording,
    policyVersion: db.getSetting("policy_version", "1.0"),
    jurisdiction: (meta && meta.country) || "",
    method: (meta && meta.method) || "web",
    withdrawnAt: status === "withdrawn" ? nowIso() : null,
    at: nowIso()
  });
  audit("user", userId, "consent." + status, { category });
  return rec;
}

function consentState(userId) {
  const out = {};
  for (const c of CONSENT_CATEGORIES) {
    const rec = db.find("consents", { userId, category: c.key }).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0];
    out[c.key] = rec ? rec.status : (c.required ? "unknown" : "not_granted");
  }
  return out;
}

function exportUserData(userId) {
  const user = db.get("users", userId);
  if (!user) throw new Error("Account not found.");
  const strip = (o) => {
    if (!o) return o;
    const c = Object.assign({}, o);
    delete c.passwordHash;
    return c;
  };
  return {
    exportedAt: nowIso(),
    profile: strip(user),
    careerProfile: db.findOne("profiles", { userId }),
    cvs: db.find("cvs", { userId }).map((c) => ({ id: c.id, fileName: c.fileName, uploadedAt: c.createdAt, parsed: c.parsed })),
    analyses: db.find("analyses", { userId }),
    jobAnalyses: db.find("jobAnalyses", { userId }),
    purchases: db.find("purchases", { userId }),
    transactions: db.find("transactions", { userId }).map((t) => ({ id: t.id, product: t.productKey, amount: t.amount, currency: t.currency, status: t.status, at: t.at })),
    subscriptions: db.find("subscriptions", { userId }),
    entitlements: db.find("entitlements", { userId }),
    documents: db.find("documents", { userId }).map((d) => ({ id: d.id, title: d.title, product: d.productKey, at: d.at })),
    consents: db.find("consents", { userId }),
    marketplace: db.findOne("marketplace", { userId }),
    notifications: db.find("notifications", { userId })
  };
}

async function deleteAccount(userId, reason) {
  const user = db.get("users", userId);
  if (!user) throw new Error("Account not found.");
  const email = user.email;
  const name = user.name;
  // Revoke sessions and tokens
  db.removeWhere("sessions", { userId });
  db.removeWhere("tokens", { userId });
  db.removeWhere("downloadTokens", { userId });
  // Remove marketplace profile
  db.removeWhere("marketplace", { userId });
  // Withdraw optional consents
  for (const c of CONSENT_CATEGORIES) {
    if (!c.required) {
      try { recordConsent(userId, c.key, "withdrawn", { method: "account_deletion" }); } catch (e) { /* ignore */ }
    }
  }
  // Anonymize career data, keep legally required transaction records
  db.removeWhere("profiles", { userId });
  db.removeWhere("cvs", { userId });
  db.removeWhere("analyses", { userId });
  db.removeWhere("jobAnalyses", { userId });
  db.removeWhere("notifications", { userId });
  db.removeWhere("aiUsage", { userId });
  const docs = db.find("documents", { userId });
  for (const d of docs) db.update("documents", d.id, { accessRevoked: true });
  const subs = db.find("subscriptions", { userId });
  for (const s of subs) if (s.status === "active") db.update("subscriptions", s.id, { status: "canceled", canceledAt: nowIso() });
  db.update("users", userId, {
    name: "Deleted User", email: "deleted_" + userId + "@deleted.local",
    passwordHash: "deleted", deletedAt: nowIso(),
    originalEmailHash: require("crypto").createHash("sha256").update(email).digest("hex")
  });
  audit("user", userId, "account.deleted", { reason: sanitizeText(reason || "user request") });
  try { await emailService.sendAccountDeleted(email, name); } catch (e) { /* ignore */ }
  return { ok: true };
}

function retentionRules() {
  return db.getSetting("retention_rules", [
    { category: "Account data", period: "Until deletion requested", action: "Delete on request" },
    { category: "Career profile", period: "Until deletion requested", action: "Delete on request" },
    { category: "Original CV files", period: "Until deletion requested", action: "Delete on request" },
    { category: "Purchased documents", period: "Until deletion requested", action: "Revoke access, then delete" },
    { category: "Transaction records", period: "7 years", action: "Retain for legal compliance, then anonymize" },
    { category: "Consent records", period: "7 years after withdrawal", action: "Retain as proof, then delete" },
    { category: "Security logs", period: "2 years", action: "Delete" }
  ]);
}

module.exports = { CONSENT_CATEGORIES, recordConsent, consentState, exportUserData, deleteAccount, retentionRules };
