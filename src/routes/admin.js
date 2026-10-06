"use strict";
// Admin API with role based access control. All actions are audit logged.

const express = require("express");
const multer = require("multer");
const path = require("path");
const db = require("../db");
const mw = require("../middleware");
const u = require("../lib/utils");
const payments = require("../services/payments");
const emailService = require("../services/email");
const aiService = require("../services/ai");
const documents = require("../services/documents");
const privacy = require("../services/privacy");

const router = express.Router();
documents.ensureDirs();

const templateUpload = multer({
  dest: documents.TEMPLATE_DIR,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(pdf|docx|html|txt)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only PDF, DOCX, HTML or TXT templates are accepted."), ok);
  }
});

// Overview
router.get("/overview", mw.requireAdmin("users.read"), (req, res) => {
  res.json({
    users: db.count("users", {}),
    verified: db.count("users", { emailVerifiedAt: { $ne: null } }),
    cvs: db.count("cvs", {}),
    purchases: db.count("purchases", {}),
    revenue: db.find("purchases", { status: "completed" }).reduce((t, p) => t + Number(p.amount || 0), 0),
    activeSubs: db.count("subscriptions", { status: "active" }),
    documents: db.count("documents", {}),
    openTickets: db.count("supportTickets", { status: "open" }),
    openPrivacy: db.count("privacyRequests", { status: "open" }),
    failedEmails: db.count("emailLog", { status: "failed" }),
    ai: aiService.usageSummary()
  });
});

// Users
router.get("/users", mw.requireAdmin("users.read"), (req, res) => {
  const q = String(req.query.q || "").trim();
  let rows = db.all("users").filter((x) => !x.deletedAt);
  if (q) rows = rows.filter((x) => (x.email + " " + x.name).toLowerCase().includes(q.toLowerCase()));
  rows.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  res.json({
    users: rows.slice(0, 100).map((x) => ({
      id: x.id, name: x.name, email: x.email, role: x.role,
      verified: !!x.emailVerifiedAt, suspended: !!x.suspendedAt,
      onboarded: !!x.onboardedAt, createdAt: x.createdAt
    }))
  });
});

router.get("/users/:id", mw.requireAdmin("users.read"), (req, res) => {
  const x = db.get("users", req.params.id);
  if (!x) return res.status(404).json({ error: "Not found." });
  res.json({
    user: { id: x.id, name: x.name, email: x.email, role: x.role, country: x.country, verified: !!x.emailVerifiedAt, suspended: !!x.suspendedAt, createdAt: x.createdAt },
    purchases: db.find("purchases", { userId: x.id }, { sort: "-createdAt" }),
    entitlements: payments.getEntitlementState(x.id),
    consents: db.find("consents", { userId: x.id }, { sort: "-createdAt", limit: 20 })
  });
});

router.post("/users/:id/suspend", mw.requireAdmin("*"), (req, res) => {
  const x = db.get("users", req.params.id);
  if (!x || x.id === req.user.id) return res.status(400).json({ error: "Cannot suspend this account." });
  db.update("users", x.id, { suspendedAt: u.nowIso() });
  db.removeWhere("sessions", { userId: x.id });
  mw.audit("admin", req.user.id, "admin.user_suspended", { target: x.id }, req);
  res.json({ ok: true });
});

router.post("/users/:id/restore", mw.requireAdmin("*"), (req, res) => {
  db.update("users", req.params.id, { suspendedAt: null });
  mw.audit("admin", req.user.id, "admin.user_restored", { target: req.params.id }, req);
  res.json({ ok: true });
});

router.post("/users/:id/role", mw.requireAdmin("*"), (req, res) => {
  const role = String(req.body.role || "");
  if (!["user", "support", "editor", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role." });
  db.update("users", req.params.id, { role });
  mw.audit("admin", req.user.id, "admin.role_changed", { target: req.params.id, role }, req);
  res.json({ ok: true });
});

router.post("/users/:id/entitlement", mw.requireAdmin("*"), (req, res) => {
  const productKey = String(req.body.productKey || "");
  const product = db.findOne("products", { key: productKey });
  if (!product) return res.status(400).json({ error: "Unknown product." });
  const ent = db.insert("entitlements", { userId: req.params.id, productKey, purchaseId: null, status: "active", grantedBy: req.user.id, at: u.nowIso() });
  mw.audit("admin", req.user.id, "admin.entitlement_granted", { target: req.params.id, product: productKey }, req);
  res.json({ ok: true, entitlement: ent });
});

// Products and pricing
router.get("/products", mw.requireAdmin("products.read"), (req, res) => {
  res.json({ products: db.all("products") });
});

router.post("/products", mw.requireAdmin("*"), (req, res) => {
  const b = u.sanitizeDeep(req.body || {});
  const key = String(b.key || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  if (!key || db.findOne("products", { key })) return res.status(400).json({ error: "Product key invalid or already exists." });
  const p = db.insert("products", {
    key, kind: b.kind === "subscription" ? "subscription" : "one_time",
    name: String(b.name || "").slice(0, 80), description: String(b.description || "").slice(0, 300),
    price: Math.max(0, Number(b.price) || 0), currency: String(b.currency || "USD").slice(0, 5).toUpperCase(),
    active: b.active !== false
  });
  mw.audit("admin", req.user.id, "admin.product_created", { key }, req);
  res.json({ ok: true, product: p });
});

router.put("/products/:id", mw.requireAdmin("*"), (req, res) => {
  const b = u.sanitizeDeep(req.body || {});
  const patch = {};
  if (b.name !== undefined) patch.name = String(b.name).slice(0, 80);
  if (b.description !== undefined) patch.description = String(b.description).slice(0, 300);
  if (b.price !== undefined) patch.price = Math.max(0, Number(b.price) || 0);
  if (b.currency !== undefined) patch.currency = String(b.currency).slice(0, 5).toUpperCase();
  if (b.active !== undefined) patch.active = !!b.active;
  const p = db.update("products", req.params.id, patch);
  mw.audit("admin", req.user.id, "admin.pricing_changed", { id: req.params.id, patch }, req);
  res.json({ ok: true, product: p });
});

// Document products (admin uploaded templates/deliverables)
router.get("/doc-products", mw.requireAdmin("docs.read"), (req, res) => {
  const items = db.all("documents").filter((d) => d.isTemplate).map((d) => Object.assign({}, d, {
    versions: db.find("docVersions", { docProductId: d.id }, { sort: "-createdAt" }),
    purchaseCount: db.count("purchases", { productKey: d.productKey })
  }));
  res.json({ items });
});

function handleUpload(req, res, next) {
  templateUpload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed." });
    next();
  });
}

router.post("/doc-products", mw.requireAdmin("docs.upload"), handleUpload, (req, res) => {
  const b = u.sanitizeDeep(req.body || {});
  const rec = db.insert("documents", {
    userId: null, isTemplate: true,
    productKey: String(b.productKey || "").slice(0, 40),
    title: String(b.title || "Untitled document").slice(0, 120),
    description: String(b.description || "").slice(0, 500),
    version: 1, active: b.active !== "false", status: "template",
    fileName: req.file ? req.file.originalname : null,
    storedPath: req.file ? req.file.path : null,
    at: u.nowIso()
  });
  if (req.file) db.insert("docVersions", { docProductId: rec.id, fileName: req.file.originalname, storedPath: req.file.path, mime: req.file.mimetype, size: req.file.size, notes: "Initial version", at: u.nowIso() });
  mw.audit("admin", req.user.id, "admin.document_uploaded", { id: rec.id, title: rec.title }, req);
  res.json({ ok: true, item: rec });
});

router.post("/doc-products/:id/version", mw.requireAdmin("docs.upload"), handleUpload, (req, res) => {
  const rec = db.get("documents", req.params.id);
  if (!rec || !rec.isTemplate) return res.status(404).json({ error: "Not found." });
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  db.insert("docVersions", { docProductId: rec.id, fileName: req.file.originalname, storedPath: req.file.path, mime: req.file.mimetype, size: req.file.size, notes: u.sanitizeText(String(req.body.notes || "")).slice(0, 300), at: u.nowIso() });
  db.update("documents", rec.id, { version: (rec.version || 1) + 1, fileName: req.file.originalname, storedPath: req.file.path });
  mw.audit("admin", req.user.id, "admin.document_version", { id: rec.id }, req);
  res.json({ ok: true });
});

router.post("/doc-products/:id/toggle", mw.requireAdmin("docs.toggle"), (req, res) => {
  const rec = db.get("documents", req.params.id);
  if (!rec || !rec.isTemplate) return res.status(404).json({ error: "Not found." });
  db.update("documents", rec.id, { active: !rec.active });
  mw.audit("admin", req.user.id, "admin.document_toggled", { id: rec.id }, req);
  res.json({ ok: true });
});

// Purchases, subscriptions, refunds
router.get("/purchases", mw.requireAdmin("purchases.read"), (req, res) => {
  const rows = db.all("purchases").sort((a, b) => (a.at > b.at ? -1 : 1)).slice(0, 200).map((p) => {
    const user = db.get("users", p.userId);
    return Object.assign({}, p, { email: user ? user.email : "(deleted)" });
  });
  res.json({ purchases: rows });
});

router.get("/subscriptions", mw.requireAdmin("purchases.read"), (req, res) => {
  const rows = db.all("subscriptions").sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)).slice(0, 200).map((p) => {
    const user = db.get("users", p.userId);
    return Object.assign({}, p, { email: user ? user.email : "(deleted)" });
  });
  res.json({ subscriptions: rows });
});

router.post("/refund", mw.requireAdmin("*"), async (req, res) => {
  try {
    const out = await payments.applyRefund({ transactionId: req.body.transactionId }, String(req.body.reason || "Admin refund"));
    mw.audit("admin", req.user.id, "admin.refund", { txn: req.body.transactionId }, req);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Emails
router.get("/emails", mw.requireAdmin("emails.read"), (req, res) => {
  res.json({
    templates: db.all("emailTemplates"),
    log: db.all("emailLog").sort((a, b) => ((a.at || a.createdAt) > (b.at || b.createdAt) ? -1 : 1)).slice(0, 100).map((e) => ({ id: e.id, to: e.to, templateKey: e.templateKey, subject: e.subject, status: e.status, provider: e.provider, at: e.at || e.createdAt }))
  });
});

router.put("/emails/:key", mw.requireAdmin("emails.edit"), (req, res) => {
  const t = db.findOne("emailTemplates", { key: req.params.key });
  if (!t || !t.editable) return res.status(400).json({ error: "Template cannot be edited." });
  db.update("emailTemplates", t.id, {
    subject: u.sanitizeText(String(req.body.subject || t.subject)).slice(0, 140),
    body: String(req.body.body || t.body).slice(0, 20000),
    active: req.body.active !== undefined ? !!req.body.active : t.active,
    version: (t.version || 1) + 1
  });
  mw.audit("admin", req.user.id, "admin.email_template", { key: t.key }, req);
  res.json({ ok: true });
});

router.get("/emails/:key/preview", mw.requireAdmin("emails.read"), (req, res) => {
  const p = emailService.preview(req.params.key, {});
  if (!p) return res.status(404).json({ error: "Not found." });
  res.json(p);
});

// Jobs
router.get("/jobs", mw.requireAdmin("jobs.read"), (req, res) => {
  res.json({ jobs: db.all("jobs").sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)).slice(0, 200) });
});

router.post("/jobs", mw.requireAdmin("jobs.edit"), (req, res) => {
  const b = u.sanitizeDeep(req.body || {});
  const j = db.insert("jobs", {
    title: String(b.title || "").slice(0, 140), employer: String(b.employer || "").slice(0, 120),
    location: String(b.location || "").slice(0, 120), workArrangement: String(b.workArrangement || "").slice(0, 30),
    seniority: String(b.seniority || "").slice(0, 30), salary: String(b.salary || "").slice(0, 120),
    description: String(b.description || "").slice(0, 8000),
    requirements: Array.isArray(b.requirements) ? b.requirements.map(String).slice(0, 20) : [],
    source: String(b.source || "Admin curated").slice(0, 120), sourceTrust: "Employer-provided",
    active: b.active !== false
  });
  mw.audit("admin", req.user.id, "admin.job_created", { id: j.id }, req);
  res.json({ ok: true, job: j });
});

router.post("/jobs/:id/toggle", mw.requireAdmin("jobs.edit"), (req, res) => {
  const j = db.get("jobs", req.params.id);
  if (!j) return res.status(404).json({ error: "Not found." });
  db.update("jobs", j.id, { active: !j.active });
  res.json({ ok: true });
});

// Privacy, marketplace, support, audit, flags, settings, legal
router.get("/privacy", mw.requireAdmin("users.read"), (req, res) => {
  res.json({
    requests: db.all("privacyRequests").sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)).slice(0, 100),
    retention: privacy.retentionRules(),
    marketplace: db.count("marketplace", { visible: true })
  });
});

router.post("/privacy/:id", mw.requireAdmin("*"), async (req, res) => {
  const r = db.get("privacyRequests", req.params.id);
  if (!r) return res.status(404).json({ error: "Not found." });
  const status = String(req.body.status || "");
  if (!["in_review", "completed", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  db.update("privacyRequests", r.id, { status });
  const user = db.get("users", r.userId);
  if (user) await emailService.sendPrivacyUpdate(user.email, user.name, "Your " + r.type + " request (" + r.id + ") is now: " + status + ".", user.id);
  mw.audit("admin", req.user.id, "admin.privacy_request", { id: r.id, status }, req);
  res.json({ ok: true });
});

router.get("/support", mw.requireAdmin("support.read"), (req, res) => {
  res.json({ tickets: db.all("supportTickets").sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)).slice(0, 200) });
});

router.post("/support/:id", mw.requireAdmin("support.reply"), (req, res) => {
  const t = db.get("supportTickets", req.params.id);
  if (!t) return res.status(404).json({ error: "Not found." });
  db.update("supportTickets", t.id, {
    status: String(req.body.status || t.status).slice(0, 20),
    reply: u.sanitizeText(String(req.body.reply || t.reply || "")).slice(0, 4000)
  });
  mw.audit("admin", req.user.id, "admin.support_reply", { id: t.id }, req);
  res.json({ ok: true });
});

router.get("/audit", mw.requireAdmin("*"), (req, res) => {
  res.json({ log: db.all("auditLog").sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)).slice(0, 300) });
});

router.get("/flags", mw.requireAdmin("*"), (req, res) => {
  res.json({ flags: db.all("featureFlags") });
});

router.post("/flags", mw.requireAdmin("*"), (req, res) => {
  const f = db.findOne("featureFlags", { key: String(req.body.key || "") });
  if (!f) return res.status(404).json({ error: "Not found." });
  db.update("featureFlags", f.id, { enabled: !!req.body.enabled });
  mw.audit("admin", req.user.id, "admin.flag", { key: f.key, enabled: !!req.body.enabled }, req);
  res.json({ ok: true });
});

router.get("/settings", mw.requireAdmin("*"), (req, res) => {
  res.json({
    branding: db.getSetting("branding", {}),
    policy_version: db.getSetting("policy_version", "1.0"),
    ai_provider: db.getSetting("ai_provider", "local"),
    retention_rules: privacy.retentionRules(),
    subprocessors: db.all("subprocessors"),
    payments: { provider: payments.providerStatus().provider, mode: payments.providerStatus().mode, stripeConfigured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) }
  });
});

router.post("/settings", mw.requireAdmin("*"), (req, res) => {
  const b = u.sanitizeDeep(req.body || {});
  if (b.branding) db.setSetting("branding", Object.assign(db.getSetting("branding", {}), b.branding));
  if (b.policy_version) db.setSetting("policy_version", String(b.policy_version).slice(0, 20));
  if (b.ai_provider && ["local", "openai"].includes(String(b.ai_provider))) db.setSetting("ai_provider", String(b.ai_provider));
  if (b.retention_rules) db.setSetting("retention_rules", b.retention_rules);
  mw.audit("admin", req.user.id, "admin.settings", {}, req);
  res.json({ ok: true });
});

router.post("/subprocessors", mw.requireAdmin("*"), (req, res) => {
  const b = u.sanitizeDeep(req.body || {});
  const s = db.insert("subprocessors", {
    provider: String(b.provider || "").slice(0, 120), purpose: String(b.purpose || "").slice(0, 200),
    data: String(b.data || "").slice(0, 200), location: String(b.location || "").slice(0, 120),
    status: String(b.status || "Active").slice(0, 20)
  });
  mw.audit("admin", req.user.id, "admin.subprocessor", { id: s.id }, req);
  res.json({ ok: true });
});

router.get("/legal", mw.requireAdmin("legal.read"), (req, res) => {
  res.json({ docs: db.all("legalDocs") });
});

router.put("/legal/:key", mw.requireAdmin("legal.edit"), (req, res) => {
  const d = db.findOne("legalDocs", { key: req.params.key });
  if (!d) return res.status(404).json({ error: "Not found." });
  db.update("legalDocs", d.id, {
    title: u.sanitizeText(String(req.body.title || d.title)).slice(0, 120),
    body: String(req.body.body || "").slice(0, 60000),
    version: (d.version || 1) + 1
  });
  mw.audit("admin", req.user.id, "admin.legal", { key: d.key }, req);
  res.json({ ok: true });
});

router.get("/analytics", mw.requireAdmin("*"), (req, res) => {
  const signups = db.count("users", {});
  res.json({
    signups,
    verificationRate: signups ? Math.round((db.count("users", { emailVerifiedAt: { $ne: null } }) / signups) * 100) : 0,
    cvUploads: db.count("cvs", {}),
    analyses: db.count("analyses", {}),
    jobAnalyses: db.count("jobAnalyses", {}),
    purchases: db.count("purchases", { status: "completed" }),
    activeSubs: db.count("subscriptions", { status: "active" }),
    documents: db.count("documents", { status: "ready" }),
    emails: { sent: db.count("emailLog", { status: "sent" }) + db.count("emailLog", { status: "delivered" }), failed: db.count("emailLog", { status: "failed" }) },
    errors: db.count("analytics", { kind: "error" }),
    ai: aiService.usageSummary()
  });
});

module.exports = router;
