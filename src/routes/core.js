"use strict";
// Core career routes: profile, CV upload/parse/review, readiness,
// job recommendations, matching, eligibility, skills finder, safety.

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const config = require("../config");
const mw = require("../middleware");
const u = require("../lib/utils");
const analysis = require("../services/analysis");
const aiService = require("../services/ai");
const emailService = require("../services/email");

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, "..", "..", "data", "uploads");

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: config.limits.uploadBytes },
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.mimetype)
      || /\.pdf$/i.test(file.originalname) || /\.docx$/i.test(file.originalname);
    cb(ok ? null : new Error("Only PDF and DOCX files are accepted."), ok);
  }
});

function getProfile(userId) {
  return db.findOne("profiles", { userId }) || null;
}

function requireProfile(req, res, next) {
  req.profile = getProfile(req.user.id);
  if (!req.profile) return res.status(404).json({ error: "Career profile not found. Please complete onboarding first.", code: "NO_PROFILE" });
  next();
}

// ---------- Onboarding / profile ----------
router.get("/profile", mw.requireVerified, (req, res) => {
  res.json({ profile: getProfile(req.user.id) });
});

router.post("/profile", mw.requireVerified, (req, res) => {
  const b = u.sanitizeDeep(req.body || {});
  const clean = {
    userId: req.user.id,
    fullName: String(b.fullName || req.user.name || "").slice(0, 80),
    country: String(b.country || "").slice(0, 60),
    targetCountries: (Array.isArray(b.targetCountries) ? b.targetCountries : []).map(String).slice(0, 10),
    experienceLevel: String(b.experienceLevel || "").slice(0, 30),
    yearsExperience: b.yearsExperience === "" || b.yearsExperience === null || b.yearsExperience === undefined ? null : Math.max(0, Math.min(60, Number(b.yearsExperience) || 0)),
    targetRoles: (Array.isArray(b.targetRoles) ? b.targetRoles : []).map((s) => String(s).slice(0, 80)).slice(0, 5),
    skills: (Array.isArray(b.skills) ? b.skills : []).map((s) => String(typeof s === "string" ? s : s.name || "").slice(0, 60)).filter(Boolean).slice(0, 40),
    education: Array.isArray(b.education) ? b.education.slice(0, 10) : [],
    experience: Array.isArray(b.experience) ? b.experience.slice(0, 15) : [],
    certifications: Array.isArray(b.certifications) ? b.certifications.slice(0, 15) : [],
    projects: Array.isArray(b.projects) ? b.projects.slice(0, 15) : [],
    workPreference: String(b.workPreference || "").slice(0, 20),
    arrangement: String(b.arrangement || "").slice(0, 20),
    salaryExpectation: String(b.salaryExpectation || "").slice(0, 80),
    workAuthorization: String(b.workAuthorization || "").slice(0, 200),
    summary: String(b.summary || "").slice(0, 2000),
    linkedin: String(b.linkedin || "").slice(0, 200),
    github: String(b.github || "").slice(0, 200),
    portfolio: String(b.portfolio || "").slice(0, 200),
    links: Array.isArray(b.links) ? b.links.map(String).slice(0, 10) : []
  };
  const existing = getProfile(req.user.id);
  const saved = existing ? db.update("profiles", existing.id, clean) : db.insert("profiles", clean);
  if (!req.user.onboardedAt) db.update("users", req.user.id, { onboardedAt: u.nowIso() });
  mw.audit("user", req.user.id, "profile.saved", {});
  res.json({ profile: saved });
});

// ---------- CV upload ----------
async function extractText(filePath, mimetype, originalname) {
  const buf = fs.readFileSync(filePath);
  // Integrity checks via magic bytes
  const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (/pdf$/i.test(originalname) || mimetype.includes("pdf")) {
    if (!isPdf) throw new Error("The uploaded file is not a valid PDF.");
    const mod = require("pdf-parse");
    if (typeof mod === "function") {
      const out = await mod(buf);
      return out.text || "";
    }
    if (mod.PDFParse) {
      const parser = new mod.PDFParse({ data: buf });
      try {
        const out = await parser.getText();
        return (out && out.text) || "";
      } finally {
        if (parser.destroy) await parser.destroy().catch(() => {});
      }
    }
    throw new Error("PDF reader is unavailable.");
  }
  if (!isZip) throw new Error("The uploaded file is not a valid DOCX.");
  const mammoth = require("mammoth");
  const out = await mammoth.extractRawText({ path: filePath });
  return out.value || "";
}

router.post("/cv/upload", mw.requireVerified, (req, res, next) => {
  upload.single("cv")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed. Only PDF and DOCX files up to 10 MB are accepted." });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please choose a PDF or DOCX file." });
    const text = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 40) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Could not read enough text from this file. If it is a scanned image, please upload a text based PDF or DOCX." });
    }
    const parsed = analysis.parseCvText(text, req.file.originalname);
    const rec = db.insert("cvs", {
      userId: req.user.id, fileName: u.sanitizeText(req.file.originalname),
      storedPath: req.file.path, mime: req.file.mimetype, size: req.file.size,
      parsed, textLength: text.length
    });
    mw.audit("user", req.user.id, "cv.uploaded", { file: req.file.originalname });
    db.insert("notifications", { userId: req.user.id, kind: "cv", title: "CV processed", body: "Your CV was parsed. Review the extracted profile and confirm details.", readAt: null, at: u.nowIso() });
    res.json({ cv: { id: rec.id, fileName: rec.fileName, parsed: rec.parsed } });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: e.message || "Could not process this file." });
  }
});

router.get("/cv", mw.requireVerified, (req, res) => {
  const rows = db.find("cvs", { userId: req.user.id }, { sort: "-createdAt" }).map((c) => ({ id: c.id, fileName: c.fileName, size: c.size, createdAt: c.createdAt, parsed: c.parsed }));
  res.json({ cvs: rows });
});

// Merge parsed CV into career profile (user reviews and confirms)
router.post("/cv/:id/apply", mw.requireVerified, (req, res) => {
  const cv = db.get("cvs", req.params.id);
  if (!cv || cv.userId !== req.user.id) return res.status(404).json({ error: "CV not found." });
  const existing = getProfile(req.user.id) || { userId: req.user.id };
  const p = cv.parsed || {};
  const merged = Object.assign({}, existing, {
    userId: req.user.id,
    fullName: existing.fullName || p.name || req.user.name,
    linkedin: existing.linkedin || ("https://" + (p.linkedin || "")).replace("https://$", ""),
    github: existing.github || ("https://" + (p.github || "")).replace("https://$", ""),
    skills: u.unique((existing.skills || []).concat((p.skills || []).map((s) => s.label)))
  });
  if (merged.linkedin === "https://") merged.linkedin = "";
  if (merged.github === "https://") merged.github = "";
  const saved = existing.id ? db.update("profiles", existing.id, merged) : db.insert("profiles", merged);
  mw.audit("user", req.user.id, "profile.merged_cv", { cvId: cv.id });
  res.json({ profile: saved });
});

// ---------- CV review + readiness ----------
router.get("/cv/review", mw.requireVerified, requireProfile, async (req, res) => {
  try {
    await aiService.analyze("cv_review", { skills: (req.profile.skills || []).length }, req.user.id);
  } catch (e) {
    if (e.code === "BUDGET") return res.status(429).json({ error: e.message });
  }
  const cv = db.find("cvs", { userId: req.user.id }, { sort: "-createdAt" })[0];
  const parsed = cv ? cv.parsed : { skills: [], sections: {}, wordCount: 0, verbHits: [], quantifiedCount: 0, email: req.user.email, phone: "" };
  const review = analysis.reviewCv(parsed, req.profile, (req.profile.targetRoles || [])[0]);
  db.insert("analyses", { userId: req.user.id, kind: "cv_review", input: { cvId: cv ? cv.id : null }, output: review, at: u.nowIso() });
  res.json({ review, cvId: cv ? cv.id : null });
});

router.get("/readiness", mw.requireVerified, requireProfile, async (req, res) => {
  try {
    await aiService.analyze("readiness", { skills: (req.profile.skills || []).length }, req.user.id);
  } catch (e) {
    if (e.code === "BUDGET") return res.status(429).json({ error: e.message });
  }
  const cv = db.find("cvs", { userId: req.user.id }, { sort: "-createdAt" })[0];
  const parsed = cv ? cv.parsed : { skills: [], sections: {}, wordCount: 0, verbHits: [], quantifiedCount: 0, email: req.user.email, phone: "" };
  const readiness = analysis.readinessScore(parsed, req.profile, (req.profile.targetRoles || [])[0]);
  db.insert("analyses", { userId: req.user.id, kind: "readiness", input: {}, output: { score: readiness.score, band: readiness.band }, at: u.nowIso() });
  res.json({ readiness });
});

// ---------- Jobs ----------
router.get("/jobs", mw.requireVerified, (req, res) => {
  const jobs = db.find("jobs", { active: true }, { sort: "-createdAt", limit: 100 });
  res.json({ jobs });
});

router.get("/jobs/recommended", mw.requireVerified, requireProfile, async (req, res) => {
  try { await aiService.analyze("recommendations", { targets: req.profile.targetRoles }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const jobs = db.find("jobs", { active: true });
  const recs = analysis.recommendJobs(req.profile, jobs);
  res.json({ recommendations: recs, count: jobs.length });
});

router.post("/jobs/analyze", mw.requireVerified, requireProfile, async (req, res) => {
  const jobText = u.sanitizeText(String(req.body.jobText || ""));
  if (jobText.length < 100) return res.status(400).json({ error: "Please paste a complete job description (at least 100 characters)." });
  try { await aiService.analyze("job_match", { len: jobText.length }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const match = analysis.matchJob(jobText, req.profile);
  const eligibility = analysis.eligibility(jobText, req.profile);
  const rec = db.insert("jobAnalyses", {
    userId: req.user.id, title: u.sanitizeText(String(req.body.title || "Pasted job description")).slice(0, 120),
    match, eligibility, at: u.nowIso()
  });
  res.json({ id: rec.id, match, eligibility });
});

router.get("/jobs/history", mw.requireVerified, (req, res) => {
  res.json({ history: db.find("jobAnalyses", { userId: req.user.id }, { sort: "-createdAt", limit: 30 }) });
});

// ---------- Skills finder + gap ----------
router.post("/skills/finder", mw.requireVerified, async (req, res) => {
  const role = u.sanitizeText(String(req.body.role || ""));
  if (!role) return res.status(400).json({ error: "Please enter a role title." });
  try { await aiService.analyze("skills_finder", { role }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  const result = analysis.findRequiredSkills(role, getProfile(req.user.id));
  res.json(result);
});

router.post("/skills/gap", mw.requireVerified, requireProfile, async (req, res) => {
  const role = u.sanitizeText(String(req.body.role || (req.profile.targetRoles || [])[0] || ""));
  if (!role) return res.status(400).json({ error: "Please enter a target role." });
  try { await aiService.analyze("skill_gap", { role }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  res.json(analysis.skillGap(req.profile, role));
});

// ---------- Safety advisor ----------
router.post("/safety", mw.requireVerified, async (req, res) => {
  const jobText = u.sanitizeText(String(req.body.jobText || ""));
  if (jobText.length < 40) return res.status(400).json({ error: "Please paste the job message or description to review." });
  try { await aiService.analyze("safety", { len: jobText.length }, req.user.id); }
  catch (e) { if (e.code === "BUDGET") return res.status(429).json({ error: e.message }); }
  res.json(analysis.safetyCheck(jobText));
});

// ---------- Dashboard ----------
router.get("/dashboard", mw.requireVerified, (req, res) => {
  const profile = getProfile(req.user.id);
  const payments = require("../services/payments");
  const ent = payments.getEntitlementState(req.user.id);
  const analyses = db.find("analyses", { userId: req.user.id }, { sort: "-createdAt", limit: 5 });
  const docs = db.find("documents", { userId: req.user.id }, { sort: "-createdAt", limit: 5 });
  const notes = db.find("notifications", { userId: req.user.id }, { sort: "-createdAt", limit: 5 });
  let readiness = null;
  if (profile) {
    const cv = db.find("cvs", { userId: req.user.id }, { sort: "-createdAt" })[0];
    const parsed = cv ? cv.parsed : { skills: [], sections: {}, wordCount: 0, verbHits: [], quantifiedCount: 0, email: req.user.email, phone: "" };
    readiness = analysis.readinessScore(parsed, profile, (profile.targetRoles || [])[0]);
  }
  res.json({
    profile: !!profile, readiness: readiness ? { score: readiness.score, band: readiness.band, topActions: readiness.topActions } : null,
    premium: ent.premium, subscription: ent.subscription,
    recentAnalyses: analyses, documents: docs, notifications: notes
  });
});

// ---------- Notifications ----------
router.get("/notifications", mw.requireVerified, (req, res) => {
  res.json({ notifications: db.find("notifications", { userId: req.user.id }, { sort: "-createdAt", limit: 50 }) });
});

router.post("/notifications/read", mw.requireVerified, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  for (const id of ids) {
    const n = db.get("notifications", id);
    if (n && n.userId === req.user.id) db.update("notifications", id, { readAt: u.nowIso() });
  }
  res.json({ ok: true });
});

// ---------- Support ----------
router.post("/support", mw.requireVerified, (req, res) => {
  const subject = u.sanitizeText(String(req.body.subject || "")).slice(0, 140);
  const category = u.sanitizeText(String(req.body.category || "general")).slice(0, 40);
  const message = u.sanitizeText(String(req.body.message || "")).slice(0, 4000);
  if (!subject || !message) return res.status(400).json({ error: "Please provide a subject and message." });
  const t = db.insert("supportTickets", { userId: req.user.id, email: req.user.email, subject, category, message, status: "open" });
  mw.audit("user", req.user.id, "support.created", { id: t.id });
  res.json({ ok: true, id: t.id });
});

router.get("/support", mw.requireVerified, (req, res) => {
  res.json({ tickets: db.find("supportTickets", { userId: req.user.id }, { sort: "-createdAt" }) });
});

// ---------- Dev inbox (own emails; in production only metadata) ----------
router.get("/inbox", mw.requireVerified, (req, res) => {
  const rows = db.find("emailLog", { userId: req.user.id }, { sort: "-createdAt", limit: 30 }).map((e) => ({
    id: e.id, subject: e.subject, templateKey: e.templateKey, status: e.status, at: e.at || e.createdAt
  }));
  res.json({ emails: rows });
});

router.get("/inbox/:id", mw.requireVerified, (req, res) => {
  const e = db.get("emailLog", req.params.id);
  if (!e || e.userId !== req.user.id) return res.status(404).json({ error: "Not found." });
  if (config.isProd) return res.json({ subject: e.subject, status: e.status, at: e.at });
  res.json({ subject: e.subject, html: e.html || "", status: e.status, at: e.at });
});

module.exports = router;
