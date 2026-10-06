"use strict";
// Local intelligence engine: deterministic, explainable career analysis.
// Never invents facts. All text output is sanitized (no em dashes, no emojis).

const { SKILLS, ALIASES, ROLES, SAFETY_PATTERNS } = require("./taxonomy");
const { sanitizeDeep, unique, clamp, tokenize } = require("../lib/utils");

function normalizeSkill(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return null;
  if (SKILLS[s]) return s;
  if (ALIASES[s]) return ALIASES[s];
  return null;
}

function extractSkills(text) {
  const lower = " " + String(text || "").toLowerCase() + " ";
  const found = [];
  const keys = Object.keys(SKILLS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const pattern = new RegExp("(^|[^a-z0-9+#])" + k.replace(/[.+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9+#]|$)");
    if (pattern.test(lower)) found.push(k);
  }
  for (const a of Object.keys(ALIASES)) {
    const pattern = new RegExp("(^|[^a-z0-9+#])" + a.replace(/[.+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9+#]|$)");
    if (pattern.test(lower) && !found.includes(ALIASES[a])) found.push(ALIASES[a]);
  }
  return unique(found);
}

function profileSkillSet(profile) {
  const set = new Set();
  (profile.skills || []).forEach((s) => { const n = normalizeSkill(typeof s === "string" ? s : s.name); if (n) set.add(n); });
  const cvText = [profile.summary, (profile.experience || []).map((e) => (e.title || "") + " " + (e.description || "")).join(" "), (profile.projects || []).map((p) => (p.name || "") + " " + (p.description || "")).join(" ")].join(" ");
  extractSkills(cvText).forEach((s) => set.add(s));
  return set;
}

function findRole(label) {
  const s = String(label || "").toLowerCase().trim();
  if (ROLES[s]) return { key: s, def: ROLES[s] };
  for (const k of Object.keys(ROLES)) {
    if (s.includes(k) || k.includes(s)) return { key: k, def: ROLES[k] };
  }
  const words = tokenize(s);
  let best = null, bestScore = 0;
  for (const k of Object.keys(ROLES)) {
    const kw = tokenize(k);
    const score = kw.filter((w) => words.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  if (best && bestScore > 0) return { key: best, def: ROLES[best] };
  return null;
}

// ---------- CV text parsing ----------
function parseCvText(rawText, fileName) {
  const text = String(rawText || "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
  const phone = (text.match(/(\+\d[\d\s\-().]{6,}\d|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b)/) || [])[0] || "";
  const linkedin = (text.match(/(linkedin\.com\/[^\s)]+)/i) || [])[0] || "";
  const github = (text.match(/(github\.com\/[^\s)]+)/i) || [])[0] || "";
  const name = lines[0] ? lines[0].slice(0, 80) : "";
  const hasSection = (names) => lines.some((l) => names.some((n) => l.toLowerCase() === n || l.toLowerCase().startsWith(n + " ")));
  const sections = {
    summary: hasSection(["summary", "profile", "objective", "about"]),
    experience: hasSection(["experience", "work experience", "employment", "work history", "professional experience"]),
    education: hasSection(["education", "academic", "qualifications"]),
    skills: hasSection(["skills", "technical skills", "core skills", "competencies"]),
    projects: hasSection(["projects", "selected projects", "portfolio"]),
    certifications: hasSection(["certifications", "certificates", "licenses"])
  };
  const years = (text.match(/(19|20)\d{2}/g) || []).map(Number);
  const dateRange = years.length ? { earliest: Math.min(...years), latest: Math.max(...years) } : null;
  const skills = extractSkills(text).map((k) => ({ key: k, label: SKILLS[k].label, category: SKILLS[k].category, uncertain: false }));
  const actionVerbs = ["led", "built", "developed", "designed", "managed", "launched", "improved", "increased", "reduced", "created", "implemented", "analyzed", "delivered", "owned", "drove"];
  const verbHits = actionVerbs.filter((v) => new RegExp("\\b" + v + "\\b", "i").test(text));
  const quantified = (text.match(/\d+\s?(%|percent|\+|x\b|users|customers|projects|clients|\$|€|£|₦)/gi) || []).length;
  const wordCount = tokenize(text).length;
  return sanitizeDeep({
    fileName: fileName || "", name, email, phone, linkedin, github,
    sections, dateRange, skills, verbHits, quantifiedCount: quantified,
    wordCount, uncertain: wordCount < 60 ? ["The document contains very little text, so extraction confidence is low."] : []
  });
}

// ---------- CV review ----------
function reviewCv(parsed, profile, targetRole) {
  const strengths = [], weaknesses = [], recommendations = [], missing = [];
  const cats = {};
  const contact = [parsed.email, parsed.phone].filter(Boolean).length;
  cats.contact = contact >= 2 ? 90 : contact === 1 ? 60 : 30;
  if (contact >= 2) strengths.push("Contact details include email and phone.");
  else { weaknesses.push("Contact details are incomplete."); missing.push("Add a professional email address and phone number."); }
  cats.summary = parsed.sections.summary ? 80 : 35;
  if (parsed.sections.summary) strengths.push("A summary or profile section is present.");
  else { weaknesses.push("No professional summary found."); recommendations.push("Add a 3 to 4 line summary focused on your target role."); }
  cats.experience = parsed.sections.experience ? 80 : 30;
  if (!parsed.sections.experience) { weaknesses.push("No work experience section detected."); recommendations.push("Add an experience section with titles, employers and dates."); }
  else if (parsed.verbHits.length >= 4) { strengths.push("Experience language uses strong action verbs."); cats.experience = 88; }
  else { recommendations.push("Start bullet points with action verbs such as built, led, improved or delivered."); }
  if (parsed.quantifiedCount >= 3) { strengths.push("Achievements include measurable results."); }
  else { weaknesses.push("Few measurable results were found."); recommendations.push("Add numbers to achievements, for example users served, revenue influenced or time saved."); }
  cats.skills = parsed.skills.length >= 6 ? 85 : parsed.skills.length >= 3 ? 60 : 30;
  if (parsed.skills.length >= 6) strengths.push(parsed.skills.length + " recognizable skills detected.");
  else { weaknesses.push("Few recognizable skills detected."); recommendations.push("Add a dedicated skills section listing tools and methods by name."); }
  cats.education = parsed.sections.education ? 80 : 45;
  if (!parsed.sections.education) missing.push("Add your education history with institution, qualification and year.");
  cats.formatting = parsed.wordCount >= 250 && parsed.wordCount <= 1200 ? 85 : parsed.wordCount < 150 ? 40 : 65;
  if (parsed.wordCount < 150) { weaknesses.push("The CV appears very short, which suggests missing detail."); }
  if (parsed.wordCount > 1400) { weaknesses.push("The CV appears long. Consider concise wording."); recommendations.push("Keep the CV focused on the most relevant recent roles."); }
  // ATS checks
  const atsIssues = [];
  if (!parsed.sections.experience || !parsed.sections.education || !parsed.sections.skills) atsIssues.push("Use standard section headings: Experience, Education, Skills.");
  if (!parsed.email) atsIssues.push("Include a plain text email address so parsers can read it.");
  if (parsed.dateRange && parsed.dateRange.latest < new Date().getFullYear() - 2) atsIssues.push("Employment dates look dated. Confirm the CV is current.");
  cats.ats = atsIssues.length === 0 ? 88 : Math.max(40, 88 - atsIssues.length * 12);
  atsIssues.forEach((a) => recommendations.push(a));
  // Keyword alignment to target role
  let keywordNote = null;
  const role = targetRole ? findRole(targetRole) : null;
  if (role) {
    const have = new Set(parsed.skills.map((s) => s.key));
    const reqHit = role.def.required.filter((r) => have.has(r));
    cats.keywords = Math.round((reqHit.length / role.def.required.length) * 100);
    const missed = role.def.required.filter((r) => !have.has(r)).map((r) => SKILLS[r] ? SKILLS[r].label : r);
    if (missed.length) {
      keywordNote = "For " + role.def.label + ", consider evidencing: " + missed.slice(0, 5).join(", ") + ".";
      recommendations.push(keywordNote);
    } else strengths.push("Strong keyword alignment with " + role.def.label + " requirements.");
  } else {
    cats.keywords = 60;
    recommendations.push("Set a target role in your profile to receive keyword alignment analysis.");
  }
  const weights = { contact: 0.08, summary: 0.1, experience: 0.22, skills: 0.18, education: 0.08, formatting: 0.1, ats: 0.12, keywords: 0.12 };
  let overall = 0;
  for (const k of Object.keys(weights)) overall += (cats[k] || 50) * weights[k];
  overall = Math.round(overall);
  return sanitizeDeep({
    overall, categories: cats, strengths, weaknesses, recommendations, missing,
    skillsDetected: parsed.skills, wordCount: parsed.wordCount,
    disclaimer: "This review is an automated career assessment. It is not a guarantee of any employer's ATS result, interview invitation, employment or job offer."
  });
}

// ---------- Readiness score ----------
function readinessScore(parsed, profile, targetRole) {
  const review = reviewCv(parsed, profile, targetRole);
  const factors = [
    { name: "ATS compatibility", score: review.categories.ats, weight: "15%", why: "Standard headings, readable contact details and current dates." },
    { name: "Keyword alignment", score: review.categories.keywords, weight: "20%", why: "Coverage of skills commonly requested for the target role." },
    { name: "Experience evidence", score: review.categories.experience, weight: "20%", why: "Action verbs and measurable achievements in experience." },
    { name: "Skills depth", score: review.categories.skills, weight: "15%", why: "Number of recognizable, relevant skills detected." },
    { name: "Profile completeness", score: profileCompleteness(profile), weight: "15%", why: "Career profile fields completed by the user." },
    { name: "Portfolio evidence", score: (profile.projects || []).length >= 2 ? 80 : (profile.projects || []).length === 1 ? 55 : 30, weight: "15%", why: "Projects that demonstrate claimed skills." }
  ];
  const weights = [0.15, 0.2, 0.2, 0.15, 0.15, 0.15];
  const score = Math.round(factors.reduce((t, f, i) => t + f.score * weights[i], 0));
  const band = score >= 80 ? "Strong readiness" : score >= 60 ? "Developing readiness" : score >= 40 ? "Early readiness" : "Foundations needed";
  return sanitizeDeep({
    score, band, factors,
    topActions: review.recommendations.slice(0, 3),
    disclaimer: "The Readiness Score is an AI-generated career assessment and is not a guarantee of an employer's ATS result, interview invitation, employment or job offer."
  });
}

function profileCompleteness(profile) {
  const fields = ["fullName", "country", "experienceLevel", "targetRoles", "skills", "education", "workPreference", "summary"];
  let filled = 0;
  for (const f of fields) {
    const v = profile[f];
    if (Array.isArray(v) ? v.length > 0 : !!v) filled++;
  }
  return Math.round((filled / fields.length) * 100);
}

// ---------- Required skills finder ----------
function findRequiredSkills(roleLabel, profile) {
  const found = findRole(roleLabel);
  if (!found) {
    return sanitizeDeep({
      found: false, query: roleLabel,
      message: "No requirement profile found for this title yet. Try titles such as Data Analyst, Product Manager or Cybersecurity Analyst.",
      suggestions: Object.keys(ROLES).map((k) => ROLES[k].label)
    });
  }
  const have = profile ? profileSkillSet(profile) : new Set();
  const evidence = {};
  if (profile) {
    const projText = " " + (profile.projects || []).map((p) => (p.name || "") + " " + (p.description || "") + " " + (p.skills || []).join(" ")).join(" ").toLowerCase() + " ";
    const expText = " " + (profile.experience || []).map((e) => (e.title || "") + " " + (e.description || "")).join(" ").toLowerCase() + " ";
    for (const k of unique(found.def.required.concat(found.def.preferred))) {
      const label = SKILLS[k] ? SKILLS[k].label.toLowerCase() : k;
      const inProjects = projText.includes(label) || projText.includes(k);
      const inExp = expText.includes(label) || expText.includes(k);
      evidence[k] = have.has(k) ? (inProjects || inExp ? "Strong" : "Limited") : "None";
    }
  }
  const rows = unique(found.def.required.concat(found.def.preferred)).map((k) => {
    const req = found.def.required.includes(k);
    const ev = evidence[k] || (have.has(k) ? "Limited" : "None");
    return {
      skill: SKILLS[k] ? SKILLS[k].label : k,
      key: k,
      demand: SKILLS[k] ? SKILLS[k].demand : "Medium",
      category: SKILLS[k] ? SKILLS[k].category : "General",
      priority: req ? "Core" : "Advantageous",
      yourEvidence: profile ? ev : "Unknown",
      status: !profile ? "Check" : ev === "Strong" ? "Ready" : ev === "Limited" ? "Develop" : "Missing"
    };
  });
  return sanitizeDeep({
    found: true, role: found.def.label,
    education: found.def.education, experience: found.def.experience,
    tools: found.def.tools, certifications: found.def.certifications,
    rows, compared: !!profile
  });
}

// ---------- Skill gap ----------
function skillGap(profile, targetRole) {
  const finder = findRequiredSkills(targetRole, profile);
  if (!finder.found) return finder;
  const missing = finder.rows.filter((r) => r.status === "Missing");
  const weak = finder.rows.filter((r) => r.status === "Develop");
  const strong = finder.rows.filter((r) => r.status === "Ready");
  const needsEvidence = weak.filter((r) => r.priority === "Core");
  const learning = missing.slice(0, 4).map((r) => "Build working knowledge of " + r.skill + " through a small guided project.");
  const projects = missing.slice(0, 3).map((r) => "Create one portfolio project that demonstrates " + r.skill + " with a written case study.");
  if (needsEvidence.length) {
    projects.push("You list " + needsEvidence[0].skill + " as a skill, but your portfolio contains limited evidence of it. Consider building a project that demonstrates it.");
  }
  return sanitizeDeep({
    found: true, role: finder.role,
    missing, weak, strong,
    skillsNeedingEvidence: needsEvidence,
    recommendedLearning: learning, recommendedProjects: projects
  });
}

// ---------- Job description analysis ----------
function matchJob(jobText, profile) {
  const text = String(jobText || "");
  const jdSkills = extractSkills(text);
  const have = profile ? profileSkillSet(profile) : new Set();
  const strong = jdSkills.filter((s) => have.has(s));
  const missing = jdSkills.filter((s) => !have.has(s));
  const partial = [];
  // Seniority signals
  const seniority = /senior|lead|principal|staff/i.test(text) ? "Senior" : /junior|entry|graduate|intern/i.test(text) ? "Entry level" : /mid/i.test(text) ? "Mid level" : "Not specified";
  const yearsMatch = text.match(/(\d+)\s?(\+|plus)?\s?years?/i);
  const yearsRequired = yearsMatch ? parseInt(yearsMatch[1], 10) : null;
  const userYears = profile && profile.yearsExperience !== undefined && profile.yearsExperience !== null ? Number(profile.yearsExperience) : null;
  let expNote = "Experience requirement could not be determined from the description.";
  let expFit = 0.5;
  if (yearsRequired !== null && userYears !== null) {
    if (userYears >= yearsRequired) { expFit = 1; expNote = "Your stated experience (" + userYears + " years) meets the stated requirement (" + yearsRequired + " years)."; }
    else { expFit = Math.max(0, userYears / yearsRequired); expNote = "The description asks for " + yearsRequired + " years; your profile states " + userYears + " years. This is an area to strengthen."; }
  } else if (yearsRequired !== null) {
    expNote = "The description asks for " + yearsRequired + " years. Add your years of experience to your profile for a precise comparison.";
  }
  const skillFit = jdSkills.length ? strong.length / jdSkills.length : 0.5;
  const score = Math.round(clamp(skillFit * 75 + expFit * 25, 2, 98));
  const band = score >= 75 ? "Strong alignment" : score >= 55 ? "Potential fit" : score >= 35 ? "Partial fit" : "Weak alignment";
  const actions = [];
  if (missing.length) actions.push("Address missing skills: " + missing.slice(0, 4).map((m) => SKILLS[m].label).join(", ") + ". Only claim skills you genuinely possess.");
  if (yearsRequired !== null && (userYears === null || userYears < yearsRequired)) actions.push("Strengthen evidence of experience through projects, freelance work or detailed achievements.");
  actions.push("Mirror the description's language in your CV where it truthfully matches your background.");
  const concerns = [];
  if (/sponsorship|work authorization|must be authorized|eligible to work/i.test(text)) concerns.push("The description mentions work authorization. Confirm your authorization status matches before applying.");
  if (/on-site|onsite|in office|hybrid/i.test(text) && profile && profile.workPreference === "remote") concerns.push("The role mentions on-site or hybrid work, while your preference is remote.");
  if (!jdSkills.length) concerns.push("Few recognizable skills were detected in this description. Results are less reliable.");
  return sanitizeDeep({
    score, band, seniority, yearsRequired,
    skillsDetected: jdSkills.map((s) => SKILLS[s].label),
    strongMatches: strong.map((s) => SKILLS[s].label),
    partialMatches: partial,
    missingRequirements: missing.map((s) => SKILLS[s].label),
    experienceNote: expNote, potentialConcerns: concerns, recommendedActions: actions,
    disclaimer: "This is an informational fit assessment, not an employment decision or guarantee of qualification."
  });
}

function eligibility(jobText, profile) {
  const m = matchJob(jobText, profile);
  const text = String(jobText || "");
  const factors = [];
  factors.push({ name: "Skills", detail: m.strongMatches.length + " of " + m.skillsDetected.length + " detected skills appear in your profile.", level: m.strongMatches.length >= m.missingRequirements.length ? "positive" : "neutral" });
  factors.push({ name: "Experience", detail: m.experienceNote, level: /meets/.test(m.experienceNote) ? "positive" : "neutral" });
  if (/bachelor|master|degree|phd/i.test(text)) {
    const hasEdu = profile && profile.education && profile.education.length > 0;
    factors.push({ name: "Education", detail: hasEdu ? "Your profile lists education history. Confirm it matches the stated requirement." : "The description mentions education, but your profile lists none.", level: hasEdu ? "positive" : "negative" });
  }
  if (/certificat|license|pmp|cpa|cissp|security\+/i.test(text)) {
    const certs = (profile && profile.certifications) || [];
    factors.push({ name: "Certifications", detail: certs.length ? "Your profile lists " + certs.length + " certification(s). Confirm they match." : "Certifications are mentioned, but your profile lists none.", level: certs.length ? "neutral" : "negative" });
  }
  if (/sponsorship|authorized|eligible to work|work permit|visa/i.test(text)) {
    factors.push({ name: "Work authorization", detail: "Authorization is mentioned. Verify your status independently; this tool cannot confirm legal eligibility.", level: "neutral" });
  }
  const negatives = factors.filter((f) => f.level === "negative").length;
  const positives = factors.filter((f) => f.level === "positive").length;
  const verdict = negatives >= 2 || m.score < 35 ? "Weak apparent fit" : positives >= 2 && m.score >= 60 ? "Strong apparent fit" : "Possible fit";
  return sanitizeDeep({
    verdict, matchScore: m.score, factors,
    disclaimer: "This eligibility assessment is informational only and does not constitute legal, immigration, employment or professional advice."
  });
}

function safetyCheck(jobText) {
  const text = String(jobText || "");
  const hits = [];
  for (const p of SAFETY_PATTERNS) {
    if (p.test.test(text)) hits.push({ indicator: p.label, severity: p.severity, explanation: p.explain });
  }
  const high = hits.filter((h) => h.severity === "high").length;
  const level = high >= 2 ? "High caution" : hits.length >= 3 ? "Elevated caution" : hits.length >= 1 ? "Some caution" : "No common indicators found";
  return sanitizeDeep({
    level,
    headline: hits.length ? "Potential risk indicators identified." : "No common risk indicators found in this text.",
    indicators: hits,
    guidance: [
      "Verify the employer through its official website and independent sources.",
      "Never pay fees to secure a job offer.",
      "Never share bank logins, card numbers, passwords or one-time codes.",
      "Be cautious with roles that move all communication to chat apps.",
      "If in doubt, pause and seek advice from a trusted person or local authority."
    ],
    disclaimer: "This is a safety awareness aid, not a verdict about any employer. It cannot declare a job genuine or fraudulent."
  });
}

// ---------- Job recommendations ----------
function recommendJobs(profile, jobs) {
  const have = profileSkillSet(profile);
  const targets = (profile.targetRoles || []).map((t) => String(t).toLowerCase());
  const scored = jobs.map((job) => {
    const jdSkills = extractSkills((job.title || "") + " " + (job.description || "") + " " + (job.requirements || []).join(" "));
    const hit = jdSkills.filter((s) => have.has(s));
    const miss = jdSkills.filter((s) => !have.has(s));
    let score = jdSkills.length ? Math.round((hit.length / jdSkills.length) * 80) : 40;
    if (targets.some((t) => String(job.title || "").toLowerCase().includes(t) || t.includes(String(job.title || "").toLowerCase().split(" ")[0]))) score += 12;
    if (profile.workPreference && job.workArrangement && String(job.workArrangement).toLowerCase().includes(String(profile.workPreference).toLowerCase())) score += 5;
    score = clamp(score, 2, 98);
    return {
      job, matchScore: score,
      whyItMatches: hit.slice(0, 4).map((s) => SKILLS[s].label),
      potentialWeaknesses: miss.slice(0, 4).map((s) => SKILLS[s].label),
      requiredSkills: jdSkills.map((s) => SKILLS[s].label),
      missingSkills: miss.map((s) => SKILLS[s].label)
    };
  });
  scored.sort((a, b) => b.matchScore - a.matchScore);
  return sanitizeDeep(scored.slice(0, 12));
}

module.exports = {
  normalizeSkill, extractSkills, profileSkillSet, findRole,
  parseCvText, reviewCv, readinessScore, profileCompleteness,
  findRequiredSkills, skillGap, matchJob, eligibility, safetyCheck, recommendJobs
};
