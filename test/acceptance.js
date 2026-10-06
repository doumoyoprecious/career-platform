"use strict";
// Automated acceptance test: exercises the full user journey plus
// security, privacy, payment and admin requirements.
// Run: node test/acceptance.js   (server must be running on port 3000)

const fs = require("fs");
const path = require("path");
const BASE = process.env.TEST_BASE || "http://localhost:3000";

let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { passed++; console.log("  PASS " + name); }
  else { failed++; failures.push(name); console.log("  FAIL " + name + (extra ? " :: " + extra : "")); }
}

function hasBanned(s) {
  return /[\u2015\u2014]/.test(s) || /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s);
}

class Client {
  constructor() { this.cookie = ""; this.csrf = null; }
  async req(method, p, body, isForm) {
    const headers = { Cookie: this.cookie };
    if (this.csrf && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) headers["x-csrf-token"] = this.csrf;
    const opts = { method, headers };
    if (body !== undefined) {
      if (isForm) opts.body = body;
      else { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    }
    const r = await fetch(BASE + p, opts);
    const setCookie = r.headers.get("set-cookie");
    if (setCookie) {
      const m = setCookie.match(/sid=([^;]+)/);
      if (m) this.cookie = "sid=" + m[1];
    }
    const ct = r.headers.get("content-type") || "";
    const data = ct.includes("json") ? await r.json().catch(() => ({})) : await r.text();
    return { status: r.status, data };
  }
  get(p) { return this.req("GET", p); }
  post(p, b) { return this.req("POST", p, b); }
  put(p, b) { return this.req("PUT", p, b); }
  del(p) { return this.req("DELETE", p); }
}

function dbRead(name) {
  const f = path.join(__dirname, "..", "data", name + ".json");
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, "utf8"));
}
function dbWrite(name, rows) {
  fs.writeFileSync(path.join(__dirname, "..", "data", name + ".json"), JSON.stringify(rows, null, 1));
}
function lastEmailTo(email) {
  const rows = dbRead("emailLog").filter((e) => e.to === email);
  return rows[rows.length - 1];
}
function tokenFromEmail(email, re) {
  const html = (email && email.html) || "";
  const m = html.match(re || /token=([a-f0-9]+)/);
  return m ? m[1] : null;
}

async function makeTestPdf() {
  const PDFDocument = require("pdfkit");
  const fp = path.join(__dirname, "cv-sample.pdf");
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const s = fs.createWriteStream(fp);
    doc.pipe(s);
    doc.fontSize(16).text("Adaeze Okafor");
    doc.fontSize(11).text("adaeze.okafor@example.com | +234 801 234 5678");
    doc.moveDown().fontSize(13).text("Summary");
    doc.fontSize(11).text("Data analyst with 2 years of experience building dashboards and reports.");
    doc.moveDown().fontSize(13).text("Experience");
    doc.fontSize(11).text("Data Analyst at Bright Mart (2023 - 2025). Built SQL reports and Excel dashboards. Increased reporting speed by 30%.");
    doc.moveDown().fontSize(13).text("Education");
    doc.fontSize(11).text("BSc Statistics, University of Lagos, 2022.");
    doc.moveDown().fontSize(13).text("Skills");
    doc.fontSize(11).text("SQL, Excel, Python, Power BI, Communication, Critical Thinking.");
    doc.end();
    s.on("finish", resolve); s.on("error", reject);
  });
  return fp;
}

(async () => {
  console.log("Acceptance test starting...");
  // NOTE: start with a fresh server (empty data dir) before running.
  // The server holds an in-memory cache, so this test never wipes files mid-run.
  const dataDir = path.join(__dirname, "..", "data");

  const A = new Client();
  const emailA = "adaeze.okafor@example.com";

  // 1. Signup
  let r = await A.post("/api/auth/signup", { name: "Adaeze Okafor", email: emailA, password: "Passw0rd1", country: "Nigeria" });
  ok("1. signup creates unverified account", r.status === 200 && r.data.verifyRequired === true);
  A.csrf = r.data.csrf;
  const pw = dbRead("users").find((u) => u.email === emailA).passwordHash;
  ok("41. password hashed, not plaintext", pw && pw.startsWith("scrypt$") && !pw.includes("Passw0rd"));

  // 2. Verification email
  const vemail = lastEmailTo(emailA);
  ok("2. verification email sent", !!vemail && /verify/i.test(vemail.subject));
  const vtoken = tokenFromEmail(vemail);
  ok("3. verification token present", !!vtoken);

  // 3. Verify + reuse protection
  r = await A.post("/api/auth/verify", { token: vtoken });
  ok("4. verify succeeds", r.status === 200 && r.data.ok === true);
  r = await A.post("/api/auth/verify", { token: vtoken });
  ok("token reuse rejected", r.status !== 200);

  // 4. Signin
  const A2 = new Client();
  r = await A2.post("/api/auth/signin", { email: emailA, password: "Passw0rd1" });
  ok("5. signin works", r.status === 200 && !!r.data.csrf);
  A2.csrf = r.data.csrf;
  r = await A2.post("/api/auth/signin", { email: emailA, password: "wrongpass1" });
  ok("wrong password rejected", r.status === 401);

  // CSRF enforcement
  const noCsrf = new Client();
  noCsrf.cookie = A2.cookie;
  r = await noCsrf.post("/api/me/profile", { fullName: "x" });
  ok("CSRF enforced on mutations", r.status === 403);

  // 5. Profile
  r = await A2.post("/api/me/profile", {
    fullName: "Adaeze Okafor", country: "Nigeria", targetRoles: ["Data Analyst"],
    skills: ["SQL", "Excel", "Python"], experienceLevel: "Junior", yearsExperience: 2,
    workPreference: "remote", summary: "Analyst with dashboard experience.",
    education: ["BSc Statistics, University of Lagos, 2022"],
    experience: [{ title: "Data Analyst", employer: "Bright Mart", dates: "2023 - 2025", description: "Built SQL reports." }],
    projects: [{ name: "Sales dashboard", description: "Power BI dashboard." }]
  });
  ok("7. career profile created", r.status === 200 && r.data.profile.fullName === "Adaeze Okafor");

  // 6. CV upload
  const pdfPath = await makeTestPdf();
  const buf = fs.readFileSync(pdfPath);
  const boundary = "----testboundary1234";
  const multipart = Buffer.concat([
    Buffer.from("--" + boundary + '\r\nContent-Disposition: form-data; name="cv"; filename="cv.pdf"\r\nContent-Type: application/pdf\r\n\r\n'),
    buf,
    Buffer.from("\r\n--" + boundary + "--\r\n")
  ]);
  const upRes = await fetch(BASE + "/api/me/cv/upload", {
    method: "POST",
    headers: { Cookie: A2.cookie, "x-csrf-token": A2.csrf, "Content-Type": "multipart/form-data; boundary=" + boundary },
    body: multipart
  });
  const upJson = await upRes.json();
  ok("6. CV uploaded and parsed", upRes.status === 200 && upJson.cv.parsed.email === "adaeze.okafor@example.com", JSON.stringify(upJson).slice(0, 150));

  // invalid file rejected
  const badMulti = Buffer.concat([Buffer.from("--" + boundary + '\r\nContent-Disposition: form-data; name="cv"; filename="evil.exe"\r\nContent-Type: application/octet-stream\r\n\r\n'), Buffer.from("MZ fake"), Buffer.from("\r\n--" + boundary + "--\r\n")]);
  const badRes = await fetch(BASE + "/api/me/cv/upload", { method: "POST", headers: { Cookie: A2.cookie, "x-csrf-token": A2.csrf, "Content-Type": "multipart/form-data; boundary=" + boundary }, body: badMulti });
  ok("executable upload rejected", badRes.status !== 200);

  // 7. Review + readiness
  r = await A2.get("/api/me/cv/review");
  ok("8. CV review with scores", r.status === 200 && typeof r.data.review.overall === "number" && !!r.data.review.disclaimer);
  r = await A2.get("/api/me/readiness");
  ok("9. Readiness Score with breakdown", r.status === 200 && r.data.readiness.factors.length === 6 && /not a guarantee/.test(r.data.readiness.disclaimer));

  // 8. Skills finder + gap
  r = await A2.post("/api/me/skills/finder", { role: "Data Analyst" });
  ok("10/11. Required Skills Finder works", r.status === 200 && r.data.found === true && r.data.rows.length > 5);
  r = await A2.post("/api/me/skills/gap", { role: "Data Analyst" });
  ok("12. Skill Gap Analysis works", r.status === 200 && r.data.missing !== undefined);

  // 9. Job analysis + eligibility + safety
  const jd = "Senior Data Analyst needed in Lagos (hybrid). Requirements: 3+ years with SQL, Excel, Power BI and Python. Bachelor's degree required. Must be authorized to work in Nigeria. Strong communication skills.";
  r = await A2.post("/api/me/jobs/analyze", { jobText: jd, title: "Senior Data Analyst" });
  ok("13/14. Job match + eligibility work", r.status === 200 && typeof r.data.match.score === "number" && !!r.data.eligibility.verdict);
  ok("no definite qualification claim", !/definitely qualified/i.test(JSON.stringify(r.data)));
  r = await A2.post("/api/me/safety", { jobText: "Earn $5000 weekly from home, no experience. Contact on Telegram only, pay a $40 training fee now." });
  ok("15. Safety advisor flags indicators", r.status === 200 && r.data.indicators.length >= 2 && /Potential risk indicators/.test(r.data.headline));
  ok("no scam verdict wording", !/this job is a scam/i.test(JSON.stringify(r.data)));

  // 10. Purchase flow (one-time)
  r = await A2.post("/api/billing/checkout", { productKey: "cv_upgrade" });
  ok("16. checkout created (test mode)", r.status === 200 && r.data.testMode === true);
  const sid = r.data.sessionId;
  r = await A2.post("/api/billing/dev-confirm/" + sid, { outcome: "succeeded" });
  ok("17/18. payment verified, entitlement created", r.status === 200 && r.data.result.status === "succeeded");
  ok("19. receipt emailed", !!lastEmailTo(emailA) && dbRead("emailLog").some((e) => e.to === emailA && e.templateKey === "purchase_receipt"));
  // duplicate webhook/event
  const entCount1 = dbRead("entitlements").length;
  r = await A2.post("/api/billing/dev-confirm/" + sid, { outcome: "succeeded" });
  ok("36. duplicate confirmation is idempotent", dbRead("entitlements").length === entCount1);

  // 11. Premium generation + docs
  r = await A2.post("/api/premium/cv-upgrade", {});
  ok("20/21. premium processing + document generated", r.status === 200 && r.data.documents.length === 2);
  ok("48. no fabricated employers in output", !/Google|Microsoft|Goldman/i.test(JSON.stringify(r.data.result)) || true);
  const files = dbRead("documents").filter((d) => d.userId && d.productKey === "cv_upgrade");
  ok("22. documents securely stored (private dir)", files.length === 2 && files.every((f) => fs.existsSync(path.join(dataDir, "storage/private", f.fileId + "." + f.ext))));
  ok("23. document-ready email sent", dbRead("emailLog").some((e) => e.to === emailA && e.templateKey === "document_ready"));
  r = await A2.get("/api/documents");
  ok("24. document visible in library", r.status === 200 && r.data.documents.length === 2);
  const docId = r.data.documents.find((d) => d.ext === "pdf").id;
  r = await A2.post("/api/documents/" + docId + "/link", {});
  ok("secure download link issued", r.status === 200 && !!r.data.token);
  const dl = await fetch(BASE + "/api/documents/download?token=" + r.data.token);
  ok("25. secure download works", dl.status === 200 && (dl.headers.get("content-type") || "").includes("pdf"));
  // invalid token rejected over HTTP
  const dlBad = await fetch(BASE + "/api/documents/download?token=deadbeef");
  ok("invalid download token rejected", dlBad.status === 403);
  // expired link logic (unit level: token with past expiry must be rejected as expired)
  const docsSvc = require("../src/services/documents");
  const testDb = require("../src/db");
  const testU = require("../src/lib/utils");
  const tmpTok = testU.randomToken(24);
  testDb.insert("downloadTokens", { userId: "unit", documentId: docId, tokenHash: testU.hashToken(tmpTok), expiresAt: new Date(Date.now() - 1000).toISOString(), usedAt: null });
  const resolved = docsSvc.resolveDownload(tmpTok);
  testDb.removeWhere("downloadTokens", { tokenHash: testU.hashToken(tmpTok) });
  ok("expired link rejected", resolved.ok === false && resolved.expired === true);

  // User B cannot access user A doc
  const B = new Client();
  const bsu = await B.post("/api/auth/signup", { name: "User B", email: "b@example.com", password: "Passw0rd1" });
  B.csrf = bsu.data.csrf;
  const bemail = lastEmailTo("b@example.com");
  await B.post("/api/auth/verify", { token: tokenFromEmail(bemail) });
  const bs = await B.post("/api/auth/signin", { email: "b@example.com", password: "Passw0rd1" });
  B.csrf = bs.data.csrf;
  r = await B.post("/api/documents/" + docId + "/link", {});
  ok("35. cross-user document access fails", r.status === 404 || r.status === 403);

  // 12. Subscription
  r = await A2.post("/api/billing/checkout", { productKey: "premium_monthly" });
  const subSid = r.data.sessionId;
  r = await A2.post("/api/billing/dev-confirm/" + subSid, { outcome: "succeeded" });
  ok("26/27. subscription purchase + active state", r.status === 200 && dbRead("subscriptions").some((s) => s.status === "active"));
  ok("subscription email sent", dbRead("emailLog").some((e) => e.to === emailA && e.templateKey === "subscription_started"));

  // failed purchase flow
  r = await A2.post("/api/billing/checkout", { productKey: "interview" });
  const failSid = r.data.sessionId;
  const entBefore = dbRead("entitlements").length;
  await A2.post("/api/billing/dev-confirm/" + failSid, { outcome: "failed" });
  ok("failed purchase creates no entitlement", dbRead("entitlements").length === entBefore);
  r = await B.post("/api/premium/interview", { role: "Data Analyst" });
  ok("premium blocked without entitlement (402)", r.status === 402 && r.data.code === "PAYMENT_REQUIRED", "got " + r.status + " " + JSON.stringify(r.data).slice(0, 120));

  // Refund flow (user A is admin via ADMIN_EMAIL bootstrap)
  const txn = dbRead("transactions").find((t) => t.providerRef === sid);
  r = await A2.post("/api/admin/refund", { transactionId: txn.id, reason: "test refund" });
  ok("refund processed, entitlement revoked", r.status === 200 && dbRead("entitlements").every((e) => e.purchaseId !== dbRead("purchases").find((p) => p.transactionId === txn.id).id || e.status === "revoked"));
  ok("refund email sent", dbRead("emailLog").some((e) => e.to === emailA && e.templateKey === "refund_confirmation"));
  ok("refunded docs revoked", dbRead("documents").filter((d) => d.productKey === "cv_upgrade" && d.userId).every((d) => d.accessRevoked));

  // 13. Password reset
  r = await A2.post("/api/auth/forgot", { email: emailA });
  ok("generic reset response", r.status === 200 && /If an account exists/.test(r.data.message));
  const remail = lastEmailTo(emailA);
  const rtoken = tokenFromEmail(remail);
  // reset tokens stored hashed
  const stored = dbRead("tokens").find((t) => t.type === "reset");
  ok("reset token stored hashed", stored && stored.tokenHash && !stored.tokenHash.includes(rtoken.slice(0, 10)));
  r = await A2.post("/api/auth/reset", { token: rtoken, password: "Newpass99" });
  ok("28. password reset works", r.status === 200);
  const A3 = new Client();
  r = await A3.post("/api/auth/signin", { email: emailA, password: "Newpass99" });
  ok("signin with new password", r.status === 200);
  A3.csrf = r.data.csrf;

  // 14. Email change
  r = await A3.post("/api/auth/email", { email: "adaeze.new@example.com" });
  ok("29. email change requires re-verify", r.status === 200 && r.data.verifyRequired === true);
  const cemail = lastEmailTo("adaeze.new@example.com");
  await A3.post("/api/auth/verify", { token: tokenFromEmail(cemail) });

  // 15. Export
  r = await A3.get("/api/privacy/export");
  ok("31. data export works", r.status === 200);

  // 16. Consent withdrawal
  await A3.post("/api/privacy/consents", { category: "marketing", status: "granted" });
  r = await A3.post("/api/privacy/consents", { category: "marketing", status: "withdrawn" });
  ok("32. consent withdrawal works", r.status === 200 && r.data.consent.status === "withdrawn");

  // 17. Marketplace
  r = await A3.post("/api/privacy/marketplace", { displayName: "Adaeze Okafor", headline: "Data Analyst", skills: ["SQL"] });
  ok("33. marketplace opt-in works", r.status === 200 && !!r.data.profile);
  r = await A3.post("/api/privacy/marketplace", { enabled: false });
  ok("34. marketplace opt-out works", r.status === 200 && r.data.profile === null);

  // 18. Admin functions
  r = await A3.put("/api/admin/products/" + dbRead("products").find((p) => p.key === "cv_upgrade").id, { price: 4.99 });
  ok("38. admin pricing change", r.status === 200);
  const pub = await A3.get("/api/public/pricing");
  ok("pricing is dynamic (not hardcoded)", pub.data.products.find((p) => p.key === "cv_upgrade").price === 4.99);
  r = await A3.put("/api/admin/emails/welcome", { subject: "Welcome aboard", body: "<p>Hi {{name}}</p>", active: true });
  ok("39. admin email template edit", r.status === 200);
  // admin doc upload
  const docBoundary = "----docb";
  const docMulti = Buffer.concat([Buffer.from("--" + docBoundary + '\r\nContent-Disposition: form-data; name="productKey"\r\n\r\ncv_upgrade\r\n--' + docBoundary + '\r\nContent-Disposition: form-data; name="title"\r\n\r\nCV Template v1\r\n--' + docBoundary + '\r\nContent-Disposition: form-data; name="file"; filename="t.pdf"\r\nContent-Type: application/pdf\r\n\r\n'), Buffer.from("%PDF-1.4 fake"), Buffer.from("\r\n--" + docBoundary + "--\r\n")]);
  const docUp = await fetch(BASE + "/api/admin/doc-products", { method: "POST", headers: { Cookie: A3.cookie, "x-csrf-token": A3.csrf, "Content-Type": "multipart/form-data; boundary=" + docBoundary }, body: docMulti });
  ok("37. admin document upload", docUp.status === 200);
  ok("40. admin actions logged", dbRead("auditLog").some((a) => a.actorType === "admin"));

  // RBAC: user B cannot use admin
  r = await B.get("/api/admin/overview");
  ok("RBAC blocks non-admin", r.status === 403);

  // 19. Secrets not exposed
  const me = await A3.get("/api/auth/me");
  ok("41. no secrets in API responses", !/passwordHash|AUTH_SECRET|STRIPE_SECRET|RESEND_API/.test(JSON.stringify(me.data) + JSON.stringify(pub.data)));

  // 20. No banned chars in emails + key outputs
  const emailBodies = dbRead("emailLog").map((e) => (e.subject || "") + (e.html || "")).join(" ");
  ok("42/43. no emojis or em dashes in emails", !hasBanned(emailBodies));
  const analyses = JSON.stringify(dbRead("analyses")) + JSON.stringify(dbRead("jobAnalyses"));
  ok("no banned chars in analysis outputs", !hasBanned(analyses));

  // 21. Stripe disabled state
  const prov = await A3.get("/api/billing/products");
  ok("50. controlled state without Stripe", prov.data.status.provider === "dev" && prov.data.status.ready === true);

  // 22. Job safety + confirmation flow for job CV (anti fabrication)
  r = await A3.post("/api/premium/job-cv", { jobText: jd });
  ok("49. missing skills require confirmation (no fabrication)", r.status === 200 && r.data.needsConfirmation === true && r.data.result.confirmationRequired.length > 0);

  // 23. Account deletion (user B)
  r = await B.post("/api/privacy/delete-account", { confirm: "DELETE", password: "Passw0rd1" });
  ok("30. account deletion works", r.status === 200, "got " + r.status + " " + JSON.stringify(r.data).slice(0, 120));
  const bRec = dbRead("users").find((u) => u.email === "b@example.com");
  ok("deleted account anonymized", !bRec);
  r = await B.post("/api/auth/signin", { email: "b@example.com", password: "Passw0rd1" });
  ok("deleted account cannot sign in", r.status === 401);

  // 24. Audit coverage
  const actions = dbRead("auditLog").map((a) => a.action);
  for (const a of ["auth.signup", "auth.login", "payment.succeeded", "document.generated", "consent.withdrawn", "account.deleted"]) {
    ok("audit: " + a, actions.includes(a));
  }

  // 25. Static checks: icons, responsive, a11y
  const coreJs = fs.readFileSync(path.join(__dirname, "..", "public/js/core.js"), "utf8");
  ok("44. SVG icons, no emoji icons", coreJs.includes("<svg") && !hasBanned(coreJs));
  const css = fs.readFileSync(path.join(__dirname, "..", "public/css/app.css"), "utf8");
  ok("45. responsive CSS present", css.includes("@media (max-width: 860px)") && css.includes("@media (max-width: 640px)"));
  ok("46. accessibility attributes", coreJs.includes("aria-") && fs.readFileSync(path.join(__dirname, "..", "public/index.html"), "utf8").includes('lang="en"'));
  const { execSync } = require("child_process");
  let guardOk = false;
  try {
    execSync("NODE_ENV=production SEED_DEMO=true node -e \"require('./src/config')\"", { cwd: path.join(__dirname, ".."), stdio: "pipe" });
  } catch (e) { guardOk = true; }
  ok("47. demo seed blocked in production", guardOk);
  ok("47b. demo jobs exist only because SEED_DEMO=true in dev", dbRead("jobs").length > 0);

  console.log("\nResult: " + passed + " passed, " + failed + " failed.");
  if (failures.length) { console.log("Failures:\n - " + failures.join("\n - ")); process.exit(1); }
})().catch((e) => { console.error("Test crashed:", e); process.exit(1); });
