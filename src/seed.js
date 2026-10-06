"use strict";
// Seed: products, email templates, feature flags, subprocessors, legal drafts,
// default jobs source. Demo job listings are inserted ONLY when SEED_DEMO=true
// and NEVER in production.

const db = require("./db");
const config = require("./config");
const emailService = require("./services/email");
const payments = require("./services/payments");

const LEGAL = {
  terms: { title: "Terms of Service", body: "<p>These Terms govern your use of the platform. The service provides career analysis and guidance. It does not guarantee employment, interviews or offers. You are responsible for the accuracy of information you provide. Paid features are described on the Pricing page. Subscriptions renew monthly until canceled. Refunds follow the Refund Policy. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" },
  privacy: { title: "Privacy Policy", body: "<p>We collect account data, career data you provide, and limited payment metadata. We do not store raw card numbers. Data is used to operate the service, personalize with consent, and meet legal duties. You can access, correct, export and delete your data from the Privacy Center. Optional sharing (research, marketplace, marketing) requires separate consent. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" },
  cookies: { title: "Cookie Policy", body: "<p>Necessary cookies keep you signed in and protect forms. Optional analytics or marketing storage is only used with consent. You can change preferences in the Privacy Center. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" },
  data_sharing: { title: "Data Sharing and Monetization Policy", body: "<p>We never secretly sell personal data. Core service processing is separate from optional personalization, research, aggregated analytics, marketplace and marketing uses. Optional uses require granular consent, which you can withdraw at any time. Aggregated reports use minimum group sizes and never expose individuals. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" },
  ai_notice: { title: "AI and Automated Decision-Making Notice", body: "<p>Automated analysis reviews your career profile, CV and job descriptions to produce scores, matches and recommendations. Scores are advisory only. The platform does not make employment decisions. You control your profile and can correct any information. Only the minimum necessary data is sent to AI providers, never payment data. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" },
  refunds: { title: "Refund Policy", body: "<p>One-time digital products are refundable within 14 days of purchase if the document was not yet generated, and in cases of technical failure. Subscriptions can be canceled at any time and remain active until the end of the paid period. Refund requests are handled through Support. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" },
  subprocessors: { title: "Subprocessor Information", body: "<p>Infrastructure providers may include hosting, database, AI, email, payment, storage and analytics providers. The current register is maintained in Admin Settings and available on request. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" },
  data_request: { title: "Data Request", body: "<p>To exercise your privacy rights (access, correction, deletion, export, objection), use the Privacy Center in your account or contact support. Requests are tracked and answered within applicable legal timeframes. This is an implementation draft and must be reviewed by qualified legal counsel before production launch.</p>" }
};

const DEMO_JOBS = [
  { title: "Junior Data Analyst", employer: "Northwind Traders", location: "Lagos, Nigeria", workArrangement: "Hybrid", seniority: "Junior", salary: "NGN 250,000 - 400,000 / month", source: "Curated demo source", sourceTrust: "Aggregated source", description: "We are hiring a Junior Data Analyst to build dashboards and reports. You will write SQL queries, clean data in Excel, and create Power BI dashboards for the sales team. Requirements: 1+ years experience with SQL and Excel, strong attention to detail, good written communication. Bachelor's degree preferred. Experience with Power BI or Tableau is an advantage.", requirements: ["SQL", "Excel", "Power BI", "Communication"], active: true },
  { title: "AI Evaluation Specialist (Remote)", employer: "Helios Research", location: "Remote, worldwide", workArrangement: "Remote", seniority: "Junior", salary: "USD 8 - 15 / hour", source: "Curated demo source", sourceTrust: "Aggregated source", description: "Remote role evaluating AI responses. You will rate response quality, write evaluation guidelines, and flag ambiguous instructions. Requirements: excellent written English, strong attention to detail, critical thinking. Experience with data annotation is an advantage. Reliable internet required.", requirements: ["Written English", "Attention to Detail", "Critical Thinking"], active: true },
  { title: "Frontend Developer", employer: "Brightline Studio", location: "Remote, EMEA", workArrangement: "Remote", seniority: "Mid-level", salary: "USD 2,500 - 4,000 / month", source: "Curated demo source", sourceTrust: "Aggregated source", description: "Build responsive web interfaces with React and TypeScript. Requirements: 2+ years with JavaScript and React, Git, REST APIs, testing. Experience with Node.js and CI/CD is an advantage.", requirements: ["JavaScript", "React", "TypeScript", "Git"], active: true },
  { title: "Product Manager", employer: "Coralpay", location: "Lagos, Nigeria", workArrangement: "Hybrid", seniority: "Mid-level", salary: "NGN 700,000 - 1,100,000 / month", source: "Curated demo source", sourceTrust: "Aggregated source", description: "Own the roadmap for our merchant product. Requirements: 3+ years in product management, prioritization, stakeholder management, analytics. Agile experience required. SQL is an advantage.", requirements: ["Product Management", "Analytics", "Agile", "SQL"], active: true },
  { title: "Cybersecurity Analyst", employer: "Sentinel Grid", location: "Abuja, Nigeria", workArrangement: "On-site", seniority: "Junior", salary: "NGN 400,000 - 650,000 / month", source: "Curated demo source", sourceTrust: "Aggregated source", description: "Monitor SIEM alerts and triage incidents. Requirements: 1+ years in security operations, network security fundamentals, Linux. Security+ certification is an advantage.", requirements: ["Cybersecurity", "SIEM", "Linux", "Network Security"], active: true },
  { title: "UX Designer", employer: "Loopware", location: "Remote, worldwide", workArrangement: "Remote", seniority: "Mid-level", salary: "USD 2,000 - 3,500 / month", source: "Curated demo source", sourceTrust: "Aggregated source", description: "Design end to end experiences for our SaaS product. Requirements: portfolio of case studies, Figma, user research, prototyping. 2+ years experience.", requirements: ["UX Design", "Figma", "User Research"], active: true }
];

function seed() {
  payments.ensureProducts();
  emailService.ensureTemplates();
  if (!db.getSetting("policy_version", null)) db.setSetting("policy_version", "1.0");
  if (!db.getSetting("branding", null)) {
    db.setSetting("branding", {
      name: config.brand.name, supportEmail: config.brand.supportEmail,
      companyName: config.brand.companyName, companyAddress: config.brand.companyAddress,
      primaryColor: "#0f2a44", accentColor: "#1f7a5c"
    });
  }
  const flags = ["premium_features", "marketplace", "job_sources", "experimental"];
  for (const f of flags) {
    if (!db.findOne("featureFlags", { key: f })) db.insert("featureFlags", { key: f, enabled: true });
  }
  const subs = [
    { provider: "Hosting provider", purpose: "Application hosting", data: "Account, career", location: "Configured at deploy", status: "Active" },
    { provider: "Email provider", purpose: "Transactional email", data: "Account, email", location: "Configured at deploy", status: "Active" },
    { provider: "Payment provider", purpose: "Payment processing", data: "Payment metadata", location: "Configured at deploy", status: "Active" },
    { provider: "AI provider", purpose: "Analysis (optional)", data: "Minimized career facts", location: "Configured at deploy", status: "Active" }
  ];
  for (const s of subs) {
    if (!db.findOne("subprocessors", { provider: s.provider })) db.insert("subprocessors", s);
  }
  for (const key of Object.keys(LEGAL)) {
    if (!db.findOne("legalDocs", { key })) db.insert("legalDocs", { key, title: LEGAL[key].title, body: LEGAL[key].body, version: 1 });
  }
  if (config.seedDemo && !config.isProd) {
    if (db.count("jobs", {}) === 0) {
      for (const j of DEMO_JOBS) db.insert("jobs", j);
      console.log("Seeded demo jobs (development only).");
    }
  }
}

module.exports = seed;
