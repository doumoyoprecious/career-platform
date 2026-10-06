"use strict";
// Premium routes. Every route enforces server side entitlements,
// generates documents, stores them securely and emails delivery notices.

const express = require("express");
const db = require("../db");
const config = require("../config");
const mw = require("../middleware");
const u = require("../lib/utils");
const payments = require("../services/payments");
const documents = require("../services/documents");
const premium = require("../services/premium");
const analysis = require("../services/analysis");
const aiService = require("../services/ai");
const emailService = require("../services/email");

const router = express.Router();

function needAccess(featureKey) {
  return (req, res, next) => {
    const check = payments.hasAccess(req.user.id, featureKey);
    if (!check.ok) {
      return res.status(402).json({ error: "This is a premium feature. Please subscribe or purchase it to continue.", code: "PAYMENT_REQUIRED", product: featureKey });
    }
    req.access = check;
    next();
  };
}

function getProfile(userId) {
  const p = db.findOne("profiles", { userId });
  return p;
}

async function deliver(user, productKey, title, sections, meta, kind, access) {
  const product = db.findOne("products", { key: productKey });
  // Link generated documents to the purchase/entitlement so refunds revoke access.
  let purchaseId = null, entitlementId = null;
  if (access && access.via === "purchase") {
    entitlementId = access.entitlementId || null;
    const ent = entitlementId ? db.get("entitlements", entitlementId) : null;
    purchaseId = ent && ent.purchaseId ? ent.purchaseId : null;
  }
  const docs = await documents.storeGenerated(user.id, {
    productKey, title, sections, meta, kind: kind || "both", version: 1,
    purchaseId, entitlementId
  });
  await emailService.sendDocumentDeliveryEmail(user.email, { name: user.name, product: product ? product.name : title, actionUrl: config.baseUrl + "/#/documents" }, user.id);
  db.insert("notifications", { userId: user.id, kind: "document", title: "Document ready", body: title + " is ready in your document library.", readAt: null, at: u.nowIso() });
  return docs;
}

// ---------- CV Upgrade ----------
router.post("/cv-upgrade", mw.requireVerified, needAccess("cv_upgrade"), async (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Career profile required." });
  try { await aiService.analyze("cv_upgrade", { skills: (profile.skills || []).length }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const cv = db.find("cvs", { userId: req.user.id }, { sort: "-createdAt" })[0];
  const parsed = cv ? cv.parsed : { skills: [], sections: {}, wordCount: 0, verbHits: [], quantifiedCount: 0, email: req.user.email, phone: "" };
  const review = analysis.reviewCv(parsed, profile, (profile.targetRoles || [])[0]);
  const result = premium.cvUpgrade(profile, review);
  const meta = profile.fullName + " | " + (profile.targetRoles || []).join(", ");
  const sections = result.sections.concat([{ heading: "Improvement Notes", bullets: result.changes.concat(["Before score: " + review.overall, "Estimated after score: " + result.afterScore]) }]);
  const docs = await deliver(req.user, "cv_upgrade", "Upgraded CV, " + profile.fullName, sections, meta, "both", req.access);
  res.json({ result, documents: docs.map((d) => d.id) });
});

// ---------- Job-specific CV ----------
router.post("/job-cv", mw.requireVerified, needAccess("job_cv"), async (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Career profile required." });
  const jobText = u.sanitizeText(String(req.body.jobText || ""));
  if (jobText.length < 100) return res.status(400).json({ error: "Please paste the target job description." });
  const confirmed = Array.isArray(req.body.confirmedSkills) ? req.body.confirmedSkills : [];
  try { await aiService.analyze("job_cv", { len: jobText.length }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const result = premium.jobSpecificCv(profile, jobText, confirmed);
  if (result.confirmationRequired.length && !req.body.skipConfirm) {
    // First pass: ask for confirmation before generating the final document.
    return res.json({ needsConfirmation: true, result });
  }
  const sections = result.base.sections.concat([
    { heading: "Target Role Alignment", paragraphs: [result.note, result.keywordGuidance] },
    { heading: "Skills to Develop", bullets: result.confirmationRequired.length ? result.confirmationRequired : ["No gaps detected."] }
  ]);
  const docs = await deliver(req.user, "job_cv", "Job-Specific CV, " + profile.fullName, sections, profile.fullName, "both", req.access);
  res.json({ result, documents: docs.map((d) => d.id) });
});

// ---------- Application package ----------
router.post("/app-package", mw.requireVerified, needAccess("app_package"), async (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Career profile required." });
  const job = { title: u.sanitizeText(String(req.body.jobTitle || "")).slice(0, 120), employer: u.sanitizeText(String(req.body.employer || "")).slice(0, 120) };
  try { await aiService.analyze("app_package", { job }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const result = premium.applicationPackage(profile, job, req.body.answers || []);
  const sections = [
    { heading: "Cover Letter", paragraphs: result.coverLetter },
    { heading: "Professional Summary", paragraphs: [result.professionalSummary] },
    { heading: "Why Interested", paragraphs: [result.whyInterested] },
    { heading: "Why Hire Me", paragraphs: [result.whyHireMe] },
    { heading: "Relevant Skills", bullets: result.relevantSkills },
    { heading: "Application Checklist", bullets: result.checklist }
  ];
  const docs = await deliver(req.user, "app_package", "Application Package, " + profile.fullName, sections, (job.title || "") + (job.employer ? " at " + job.employer : ""), "both", req.access);
  res.json({ result, documents: docs.map((d) => d.id) });
});

// ---------- Portfolio intelligence ----------
router.post("/portfolio", mw.requireVerified, needAccess("portfolio"), async (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Career profile required." });
  const role = u.sanitizeText(String(req.body.role || (profile.targetRoles || [])[0] || ""));
  try { await aiService.analyze("portfolio", { role }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const result = premium.portfolioPlan(profile, role);
  const sections = [
    { heading: "CV to Portfolio Gap Analysis", paragraphs: [result.cvToPortfolioGap.headline, result.cvToPortfolioGap.advice], bullets: result.cvToPortfolioGap.skills },
    { heading: "Recommended Projects", bullets: result.recommendedProjects },
    { heading: "Portfolio Structure", bullets: result.structure },
    { heading: "GitHub Improvements", bullets: result.github },
    { heading: "Personal Website", bullets: result.website }
  ];
  const docs = await deliver(req.user, "portfolio", "Portfolio Intelligence Report, " + profile.fullName, sections, role, "both", req.access);
  res.json({ result, documents: docs.map((d) => d.id) });
});

// ---------- Interview preparation ----------
router.post("/interview", mw.requireVerified, needAccess("interview"), async (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Career profile required." });
  const role = u.sanitizeText(String(req.body.role || (profile.targetRoles || [])[0] || ""));
  const jobText = u.sanitizeText(String(req.body.jobText || ""));
  try { await aiService.analyze("interview", { role }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const result = premium.interviewPrep(profile, jobText, role);
  const sections = [
    { heading: "Target Role: " + result.role, paragraphs: result.jobKeywords.length ? ["Key terms from the description: " + result.jobKeywords.join(", ")] : [] },
    { heading: "Questions and Guidance", paragraphs: [], bullets: result.questions.map((q) => "[" + q.type + "] " + q.question + " (Evaluate: " + q.criteria + ")") },
    { heading: "Evaluation Criteria", bullets: result.evaluationCriteria },
    { heading: "Preparation Tips", bullets: result.tips }
  ];
  const docs = await deliver(req.user, "interview", "Interview Preparation Report, " + profile.fullName, sections, role, "both", req.access);
  const session = db.insert("analyses", { userId: req.user.id, kind: "interview_prep", input: { role }, output: { questions: result.questions.length }, at: u.nowIso() });
  res.json({ result, sessionId: session.id, documents: docs.map((d) => d.id) });
});

// Mock interview scoring
router.post("/interview/mock", mw.requireVerified, needAccess("interview"), async (req, res) => {
  const question = u.sanitizeText(String(req.body.question || "")).slice(0, 500);
  const answer = u.sanitizeText(String(req.body.answer || "")).slice(0, 4000);
  if (!question || !answer) return res.status(400).json({ error: "Please provide a question and your answer." });
  res.json(premium.scoreMockAnswer(question, answer));
});

// Complete package: generates all premium documents at once
router.post("/complete", mw.requireVerified, needAccess("complete_package"), async (req, res) => {
  const profile = getProfile(req.user.id);
  if (!profile) return res.status(404).json({ error: "Career profile required." });
  const role = (profile.targetRoles || [])[0] || "";
  const jobText = u.sanitizeText(String(req.body.jobText || ""));
  const cv = db.find("cvs", { userId: req.user.id }, { sort: "-createdAt" })[0];
  const parsed = cv ? cv.parsed : { skills: [], sections: {}, wordCount: 0, verbHits: [], quantifiedCount: 0, email: req.user.email, phone: "" };
  const review = analysis.reviewCv(parsed, profile, role);
  const up = premium.cvUpgrade(profile, review);
  const app = premium.applicationPackage(profile, { title: role, employer: "" }, []);
  const port = premium.portfolioPlan(profile, role);
  const iv = premium.interviewPrep(profile, jobText, role);
  const sections = [
    { heading: "Part 1: Upgraded CV", paragraphs: [up.summary] },
    { heading: "Part 2: Cover Letter", paragraphs: app.coverLetter },
    { heading: "Part 3: Application Checklist", bullets: app.checklist },
    { heading: "Part 4: Portfolio Plan", bullets: port.recommendedProjects },
    { heading: "Part 5: Interview Questions", bullets: iv.questions.map((q) => "[" + q.type + "] " + q.question) }
  ];
  const docs = await deliver(req.user, "complete_package", "Complete Application Package, " + profile.fullName, sections, role, "both", req.access);
  res.json({ ok: true, documents: docs.map((d) => d.id) });
});

module.exports = router;
