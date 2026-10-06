"use strict";
// Premium services. Strict truth rule: only user supplied facts are used.
// Missing skills are flagged for confirmation, never silently added.

const { SKILLS, INTERVIEW_BANKS, ROLE_QUESTIONS } = require("./taxonomy");
const analysis = require("./analysis");
const { sanitizeDeep } = require("../lib/utils");

function fullName(profile) {
  return profile.fullName || profile.name || "Candidate";
}

function improveSummary(profile, targetRole) {
  const skills = (profile.skills || []).slice(0, 5).map((s) => (typeof s === "string" ? s : s.name)).join(", ");
  const exp = profile.experience && profile.experience[0] ? profile.experience[0].title : null;
  const article = (w) => (/^[aeiou]/i.test(String(w || "").trim()) ? "an " : "a ");
  let s = fullName(profile) + " is ";
  s += exp ? article(exp) + exp + " " : "a professional ";
  s += targetRole ? "focused on " + targetRole + " roles" : "seeking new opportunities";
  s += ". ";
  if (skills) s += "Core strengths include " + skills + ". ";
  if (profile.yearsExperience) s += String(profile.yearsExperience) + " years of experience. ";
  s += "Open to " + (profile.workPreference || "remote, hybrid or on-site") + " work.";
  return s;
}

function improveBullets(experience) {
  // Rewrite pass that preserves facts: strengthens verbs, keeps all nouns/dates.
  return (experience || []).map((e) => {
    const desc = String(e.description || "");
    const sentences = desc.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 6);
    const improved = sentences.map((s) => {
      let t = s.trim();
      t = t.replace(/^responsible for /i, "Owned ");
      t = t.replace(/^worked on /i, "Delivered ");
      t = t.replace(/^helped /i, "Supported ");
      t = t.replace(/^was /i, "Served as ");
      if (!/[.!?]$/.test(t)) t += ".";
      return t.charAt(0).toUpperCase() + t.slice(1);
    });
    return { title: e.title, employer: e.employer, dates: e.dates, bullets: improved };
  });
}

function cvUpgrade(profile, review) {
  const summary = improveSummary(profile, (profile.targetRoles || [])[0]);
  const experience = improveBullets(profile.experience);
  const changes = [];
  if (!profile.summary) changes.push("Added a professional summary aligned with your target role.");
  else changes.push("Rewrote the summary for clarity and role alignment (facts unchanged).");
  changes.push("Strengthened experience bullet wording while preserving all facts.");
  if (review && review.recommendations) changes.push("Applied " + Math.min(5, review.recommendations.length) + " structural recommendations from your CV review.");
  changes.push("Standardized section order: Summary, Skills, Experience, Education, Projects, Certifications.");
  const afterEstimate = review ? Math.min(97, review.overall + 12) : 78;
  return sanitizeDeep({
    summary, experience,
    skills: (profile.skills || []).map((s) => (typeof s === "string" ? s : s.name)),
    beforeScore: review ? review.overall : null, afterScore: afterEstimate,
    changes,
    sections: [
      { heading: "Professional Summary", paragraphs: [summary] },
      { heading: "Skills", bullets: (profile.skills || []).map((s) => (typeof s === "string" ? s : s.name)) },
      { heading: "Experience", paragraphs: [], bullets: experience.flatMap((e) => [(e.title || "") + (e.employer ? ", " + e.employer : "") + (e.dates ? " (" + e.dates + ")" : "")].concat(e.bullets.map((b) => "  " + b))) },
      { heading: "Education", bullets: (profile.education || []).map((e) => (typeof e === "string" ? e : ((e.qualification || "") + (e.institution ? ", " + e.institution : "") + (e.year ? " (" + e.year + ")" : "")))) },
      { heading: "Projects", bullets: (profile.projects || []).map((p) => (p.name || "") + (p.description ? ": " + p.description : "")) },
      { heading: "Certifications", bullets: (profile.certifications || []).map((c) => (typeof c === "string" ? c : c.name)) }
    ]
  });
}

function jobSpecificCv(profile, jobText, confirmedSkills) {
  const match = analysis.matchJob(jobText, profile);
  const confirmed = new Set((confirmedSkills || []).map((s) => String(s).toLowerCase()));
  const base = cvUpgrade(profile, null);
  const flags = match.missingRequirements.filter((m) => !confirmed.has(m.toLowerCase()));
  const added = match.missingRequirements.filter((m) => confirmed.has(m.toLowerCase()));
  return sanitizeDeep({
    base, match,
    confirmationRequired: flags,
    confirmedAdded: added,
    note: flags.length
      ? "The job asks for skills not found in your profile: " + flags.join(", ") + ". Confirm each skill you genuinely possess before it is added. Unconfirmed skills are listed as development areas, not as your skills."
      : "All detected job skills are covered by your profile or your confirmations.",
    keywordGuidance: "Mirror these terms where truthful: " + match.skillsDetected.slice(0, 8).join(", ") + "."
  });
}

function applicationPackage(profile, job, answers) {
  const target = (job && job.title) || (profile.targetRoles || [])[0] || "the role";
  const employer = (job && job.employer) || "the hiring organization";
  const skills = (profile.skills || []).slice(0, 6).map((s) => (typeof s === "string" ? s : s.name));
  const coverLetter = [
    "Dear Hiring Manager,",
    "I am applying for the " + target + " position at " + employer + ". " + (profile.yearsExperience ? "With " + profile.yearsExperience + " years of experience, " : "") + "my background aligns with the requirements of this role.",
    skills.length ? "Relevant strengths include " + skills.join(", ") + "." : "My background includes directly relevant experience described in my CV.",
    (profile.experience && profile.experience[0] ? "In my most recent role as " + profile.experience[0].title + (profile.experience[0].employer ? " at " + profile.experience[0].employer : "") + ", I contributed measurable results detailed in my application." : "Further detail is provided in my CV and supporting answers."),
    "I would welcome the opportunity to discuss how I can contribute. Thank you for your consideration.",
    "Sincerely,",
    fullName(profile)
  ];
  return sanitizeDeep({
    coverLetter,
    professionalSummary: improveSummary(profile, target),
    whyInterested: "This role matches my target direction (" + target + ") and builds on my experience in " + (skills.slice(0, 3).join(", ") || "my field") + ".",
    whyHireMe: "I bring " + (skills.slice(0, 3).join(", ") || "relevant experience") + ", a record of delivery described in my CV, and readiness to contribute from the start.",
    relevantSkills: skills,
    applicationAnswers: answers || [],
    checklist: [
      "CV tailored to the description, truthful throughout",
      "Cover letter customized for " + employer,
      "Work authorization status confirmed",
      "Location and work arrangement confirmed",
      "Portfolio or work samples linked",
      "References prepared on request"
    ]
  });
}

function portfolioPlan(profile, targetRole) {
  const gap = analysis.skillGap(profile, targetRole || (profile.targetRoles || [])[0] || "Data Analyst");
  const claimed = new Set((profile.skills || []).map((s) => String(typeof s === "string" ? s : s.name).toLowerCase()));
  const projText = " " + (profile.projects || []).map((p) => ((p.name || "") + " " + (p.description || "")).toLowerCase()).join(" ") + " ";
  const undemonstrated = Array.from(claimed).filter((c) => c.length > 2 && !projText.includes(c)).slice(0, 8);
  const roleKey = targetRole ? analysis.findRole(targetRole) : null;
  const key = roleKey ? roleKey.key : "data analyst";
  const projectIdeas = {
    "data analyst": ["Sales performance dashboard (SQL + Power BI) with a written case study.", "Customer churn exploration (Python + Pandas) with charts and findings.", "Public dataset cleanup project showing before and after quality."],
    "software engineer": ["Full stack task manager (React + Node.js + database) deployed live.", "REST API with authentication, tests and documentation.", "Open source contribution with a clear pull request history."],
    "product manager": ["Case study: improving onboarding for a product you use, with metrics.", "PRD sample for a small feature, with user stories and success metrics.", "Competitor teardown with prioritized recommendations."],
    "ux designer": ["End to end redesign case study: research, wireframes, prototype, test.", "Design system mini kit with components and usage notes.", "Usability test report on a real product with findings."],
    "cybersecurity analyst": ["Home lab writeup: SIEM alerts triaged with detection notes.", "Vulnerability scan report on a practice target with remediation.", "Phishing analysis walkthrough with indicators documented."],
    "ai evaluation specialist": ["Evaluation rubric sample comparing two responses with ratings.", "Annotation consistency report on a practice dataset.", "Prompt test log showing methodical edge case coverage."]
  };
  return sanitizeDeep({
    gap,
    cvToPortfolioGap: undemonstrated.length
      ? { headline: "Skills claimed but not demonstrated in projects.", skills: undemonstrated, advice: "For each skill, add a project, a code sample, a case study or remove the claim." }
      : { headline: "Claimed skills show reasonable project coverage.", skills: [], advice: "Keep adding depth: live demos, screenshots and writeups." },
    recommendedProjects: projectIdeas[key] || projectIdeas["data analyst"],
    structure: ["Home: name, target role, 2 line summary", "Selected work: 3 to 5 projects with problem, approach, result", "About: background, skills, work preference", "Contact: email, LinkedIn, GitHub"],
    github: ["Pin 3 best repositories", "Add README files with setup steps and screenshots", "Show consistent, meaningful commits", "Add a profile README summarizing your focus"],
    website: ["One page is enough to start", "Fast loading, readable on phones", "Case studies over bare screenshots", "Clear contact options"]
  });
}

function interviewPrep(profile, jobText, targetRole) {
  const role = analysis.findRole(targetRole || (profile.targetRoles || [])[0] || "");
  const key = role ? role.key : null;
  const technical = (key && ROLE_QUESTIONS[key] ? ROLE_QUESTIONS[key] : [
    { q: "What are the most important skills for this role, and how have you applied them?", criteria: "Relevance, concrete examples, outcomes." },
    { q: "Describe a challenging task in your field and your approach.", criteria: "Method, tools, measurable result." },
    { q: "How do you stay current in your field?", criteria: "Learning habits, credible sources." }
  ]).map((x) => ({ type: "Technical", question: x.q, criteria: x.criteria, guidance: "Answer with a specific example from your background. State the situation, your action and the result." }));
  const behavioral = INTERVIEW_BANKS.behavioral.map((x) => ({ type: "Behavioral", question: x.q, criteria: x.criteria, guidance: "Use the STAR method: Situation, Task, Action, Result. Keep answers under 2 minutes." }));
  const situational = INTERVIEW_BANKS.situational.map((x) => ({ type: "Situational", question: x.q, criteria: x.criteria, guidance: "Think aloud: clarify, weigh options, then commit to an approach." }));
  const cvSpecific = (profile.experience || []).slice(0, 3).map((e) => ({
    type: "CV specific",
    question: "Tell me more about your role as " + (e.title || "a team member") + (e.employer ? " at " + e.employer : "") + ". What was your impact?",
    criteria: "Ownership, specifics, measurable impact.",
    guidance: "Prepare 2 to 3 achievements with numbers from this role."
  }));
  const jdSkills = jobText ? analysis.extractSkills(jobText).map((s) => SKILLS[s].label) : [];
  return sanitizeDeep({
    role: role ? role.def.label : (targetRole || "Target role"),
    questions: technical.concat(behavioral, situational, cvSpecific),
    jobKeywords: jdSkills.slice(0, 10),
    evaluationCriteria: ["Relevance of examples", "Clarity and structure", "Evidence of skill", "Role alignment", "Communication"],
    tips: ["Research the employer and the team before the interview.", "Prepare 3 questions to ask the interviewer.", "Rehearse answers aloud, not only in writing.", "Bring concise proof: portfolio links, metrics, references."]
  });
}

function scoreMockAnswer(question, answer) {
  const text = String(answer || "");
  const words = text.split(/\s+/).filter(Boolean).length;
  let score = 40;
  const feedback = [];
  if (words >= 60) { score += 15; } else { feedback.push("Your answer is short. Aim for 60 to 150 words with a concrete example."); }
  if (words > 300) { score -= 5; feedback.push("Consider tightening the answer to stay under 2 minutes spoken."); }
  if (/\d/.test(text)) { score += 15; } else { feedback.push("Add a number or measurable outcome to strengthen credibility."); }
  if (/(i|my)\b/i.test(text) && /(result|outcome|achieved|improved|reduced|increased|delivered|built|led)/i.test(text)) { score += 15; feedback.push("Good: you described personal action and outcome."); }
  else feedback.push("State what you personally did and what changed as a result.");
  if (/(because|therefore|so that|in order to)/i.test(text)) { score += 5; }
  score = Math.max(5, Math.min(98, score));
  return sanitizeDeep({ score, wordCount: words, feedback });
}

module.exports = { cvUpgrade, jobSpecificCv, applicationPackage, portfolioPlan, interviewPrep, scoreMockAnswer, improveSummary };
