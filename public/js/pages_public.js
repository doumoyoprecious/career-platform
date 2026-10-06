"use strict";
/* Public pages: landing, pricing, auth, legal, marketplace, checkout. */

function pageLanding() {
  const feats = [
    ["file", "CV Review", "Structure, readability, keywords and ATS compatibility, scored with clear actions."],
    ["target", "Readiness Score", "One honest score that shows how prepared you are for your target role, with a full breakdown."],
    ["briefcase", "Job Matching", "Paste any job description to see strong matches, partial matches and missing requirements."],
    ["chart", "Required Skills Finder", "Discover the skills employers actually request for any role, compared against your profile."],
    ["layers", "Skill Gap Analysis", "See missing skills, weak skills and exactly which projects would close the gap."],
    ["shield", "Job Safety Advisor", "Spot potential risk indicators in job messages before you engage further."],
    ["folder", "Portfolio Intelligence", "Turn claimed skills into demonstrated proof with guided project plans."],
    ["mic", "Interview Preparation", "Role specific questions, evaluation criteria and mock interview scoring."],
    ["book", "Application Packages", "Tailored CVs, cover letters and checklists built only from your verified facts."]
  ];
  const html = '<div class="hero"><h1>Understand what it takes to get the job.</h1>'
    + '<p class="lead">Career intelligence for your next role. Review your CV, measure your readiness, analyze any job, close skill gaps and prepare with confidence.</p>'
    + '<div class="btn-row"><a class="btn btn-accent" href="#/signup">Create free account</a><a class="btn btn-light" href="#/pricing">See pricing</a></div></div>'
    + '<div class="section"><h2>One platform, from profile to offer</h2><p class="sub">Move through a clear loop: profile, job, requirements, eligibility, skill gap, evidence, CV, application and interview.</p>'
    + '<div class="feature-grid">' + feats.map((f) => '<div class="feature"><h3><span class="icon-badge">' + icon(f[0]) + "</span>" + esc(f[1]) + "</h3><p class=\"muted\">" + esc(f[2]) + "</p></div>").join("") + "</div></div>"
    + '<div class="section"><h2>How it works</h2><p class="sub">Start free. Upgrade only when you need premium documents and preparation.</p><div class="steps">'
    + '<div class="step"><span class="num">1</span><h3>Build your profile</h3><p class="muted">Create an account, verify your email and upload your CV. Your career profile becomes the center of everything.</p></div>'
    + '<div class="step"><span class="num">2</span><h3>Assess any opportunity</h3><p class="muted">Get your Readiness Score, analyze job descriptions, check eligibility signals and review safety indicators.</p></div>'
    + '<div class="step"><span class="num">3</span><h3>Improve and apply</h3><p class="muted">Close skill gaps, generate tailored documents and prepare for interviews with structured guidance.</p></div>'
    + "</div></div>"
    + '<div class="section"><div class="cta-band"><h2>Am I ready for this opportunity, and if not, what should I improve?</h2><p>This platform exists to answer that question honestly.</p><div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="#/signup">Get started free</a></div></div></div>';
  document.getElementById("app").innerHTML = publicLayout(html, "");
}

async function pagePricing() {
  const app = document.getElementById("app");
  app.innerHTML = publicLayout('<div class="container"><div class="card"><div class="boot" style="min-height:100px"><div class="spinner"></div></div></div></div>', "pricing");
  let products = [], pay = null;
  try {
    const d = await api("/api/public/pricing");
    products = d.products; pay = d.payments;
  } catch (e) { products = []; }
  const sub = products.find((p) => p.kind === "subscription");
  const ones = products.filter((p) => p.kind !== "subscription");
  const free = ["Career Profile", "CV Review", "Readiness Score", "Job Recommendations", "Job Match Analysis", "Eligibility Analysis", "Required Skills Finder", "Skill Gap Analysis", "Job Safety Advisor"];
  const html = '<div class="container"><h1>Pricing</h1><p class="muted">Start free. Subscribe for full access, or pay per feature when you need it.</p>'
    + '<div class="pricing-grid">'
    + '<div class="price-card"><h3>Free</h3><div class="price">$0</div><div class="per">forever</div><ul class="clean">'
    + free.map((f) => "<li>" + esc(f) + "</li>").join("") + '</ul><div class="btn-row"><a class="btn btn-outline btn-block" href="#/signup">Create free account</a></div></div>'
    + '<div class="price-card featured"><h3>Premium ' + badge("Most flexible", "navy") + "</h3>"
    + '<div class="price">' + (sub ? money(sub.price, sub.currency) : "$20.00") + '</div><div class="per">per month, renews monthly, cancel anytime</div>'
    + '<ul class="clean"><li>Everything in Free</li><li>CV Upgrade</li><li>Job-Specific CV</li><li>Application Package</li><li>Portfolio Intelligence</li><li>Interview Preparation</li><li>Complete Application Package</li></ul>'
    + '<div class="btn-row"><a class="btn btn-primary btn-block" href="#/signup">Start Premium</a></div></div>'
    + '<div class="price-card"><h3>Pay per feature</h3><div class="price">From ' + (ones.length ? money(Math.min.apply(null, ones.map((p) => p.price)), ones[0].currency) : "$2.99") + '</div><div class="per">one-time, yours to keep</div><ul class="clean">'
    + (ones.length ? ones.map((p) => "<li>" + esc(p.name) + ": <strong>" + money(p.price, p.currency) + "</strong></li>").join("") : "<li>CV Upgrade, Job-Specific CV, Application Package, Portfolio, Interview</li>") + "</ul>"
    + '<div class="btn-row"><a class="btn btn-outline btn-block" href="#/signup">Choose later</a></div></div>'
    + "</div>"
    + '<div class="card" style="margin-top:18px"><h3>Subscription terms</h3><p class="muted">Premium renews automatically each month until canceled. Cancel anytime from Billing; you keep access until the end of the paid period. Refunds follow our <a href="#/legal/refunds">Refund Policy</a>. Prices include no hidden fees; tax is shown at checkout where applicable.</p>'
    + (pay && !pay.ready ? alertBox("warn", "Online payments are being connected. " + esc(pay.note || "")) : "") + "</div></div>";
  app.innerHTML = publicLayout(html, "pricing");
}

function pageSignup() {
  if (S.user) { location.hash = "#/dashboard"; return; }
  const html = '<div class="container"><div class="auth-wrap"><div class="auth-card"><h2>Create your account</h2><p class="muted">Free to start. Verify your email to continue.</p>'
    + '<form id="f-signup">'
    + fieldHtml("Full name", '<input class="input" name="name" required maxlength="80" autocomplete="name">')
    + fieldHtml("Email address", '<input class="input" name="email" type="email" required autocomplete="email">')
    + fieldHtml("Country", '<input class="input" name="country" maxlength="60" autocomplete="country-name">')
    + fieldHtml("Password", '<input class="input" name="password" type="password" required minlength="8" autocomplete="new-password">', "At least 8 characters, with letters and numbers.")
    + '<div class="form-error" id="e-signup"></div>'
    + '<div class="btn-row"><button class="btn btn-primary btn-block" type="submit">Create account</button></div>'
    + '<p class="small muted" style="margin-top:12px">By creating an account you agree to the <a href="#/legal/terms">Terms</a> and <a href="#/legal/privacy">Privacy Policy</a>.</p>'
    + '<p class="small">Already have an account? <a href="#/signin">Sign in</a></p>'
    + "</form></div></div></div>";
  document.getElementById("app").innerHTML = publicLayout(html, "");
  document.getElementById("f-signup").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const err = document.getElementById("e-signup");
    err.textContent = "";
    try {
      const d = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ name: f.get("name"), email: f.get("email"), country: f.get("country"), password: f.get("password") }) });
      S.user = d.user; S.csrf = d.csrf;
      toast("Account created. Please verify your email.", "success");
      location.hash = "#/verify-pending";
    } catch (ex) { err.textContent = ex.message; }
  });
}

function pageSignin() {
  if (S.user) { location.hash = "#/dashboard"; return; }
  const html = '<div class="container"><div class="auth-wrap"><div class="auth-card"><h2>Sign in</h2>'
    + '<form id="f-signin">'
    + fieldHtml("Email address", '<input class="input" name="email" type="email" required autocomplete="email">')
    + fieldHtml("Password", '<input class="input" name="password" type="password" required autocomplete="current-password">')
    + '<div class="form-error" id="e-signin"></div>'
    + '<div class="btn-row"><button class="btn btn-primary btn-block" type="submit">Sign in</button></div>'
    + '<p class="small"><a href="#/forgot">Forgot password?</a> &nbsp;·&nbsp; New here? <a href="#/signup">Create account</a></p>'
    + "</form></div></div></div>";
  document.getElementById("app").innerHTML = publicLayout(html, "");
  document.getElementById("f-signin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const err = document.getElementById("e-signin");
    err.textContent = "";
    try {
      const d = await api("/api/auth/signin", { method: "POST", body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
      S.user = d.user; S.csrf = d.csrf;
      location.hash = d.user.emailVerifiedAt ? "#/dashboard" : "#/verify-pending";
    } catch (ex) { err.textContent = ex.message; }
  });
}

function pageVerifyPending() {
  const html = '<div class="container"><div class="narrow"><div class="card" style="text-align:center"><h2>Verify your email</h2>'
    + '<p class="muted">We sent a verification link to <strong>' + esc((S.user && S.user.email) || "your email") + '</strong>. Click the link to activate your account. The link expires in 24 hours.</p>'
    + '<div class="btn-row" style="justify-content:center"><button class="btn btn-outline" id="b-resend">Resend verification email</button><a class="btn btn-ghost" href="#/inbox">Open my inbox</a></div>'
    + '<div class="form-error" id="e-resend"></div>'
    + '<p class="small muted">Already verified? <a href="#/dashboard">Continue to dashboard</a></p></div></div></div>';
  document.getElementById("app").innerHTML = publicLayout(html, "");
  const b = document.getElementById("b-resend");
  if (b) b.addEventListener("click", async () => {
    try { await api("/api/auth/verify/resend", { method: "POST", body: "{}" }); toast("Verification email sent.", "success"); }
    catch (e) { document.getElementById("e-resend").textContent = e.message; }
  });
}

async function pageVerify(params) {
  const token = params.token || "";
  let ok = false, msg = "";
  try { await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) }); ok = true; await refreshSession(); }
  catch (e) { msg = e.message; }
  const html = '<div class="container"><div class="narrow"><div class="card" style="text-align:center">'
    + (ok
      ? "<h2>Email verified</h2><p class=\"muted\">Your account is active. Continue to set up your career profile.</p><div class=\"btn-row\" style=\"justify-content:center\"><a class=\"btn btn-primary\" href=\"#/onboarding\">Continue onboarding</a></div>"
      : "<h2>Verification failed</h2><p class=\"muted\">" + esc(msg) + "</p><div class=\"btn-row\" style=\"justify-content:center\"><a class=\"btn btn-outline\" href=\"#/verify-pending\">Request a new link</a></div>")
    + "</div></div></div>";
  document.getElementById("app").innerHTML = publicLayout(html, "");
}

function pageForgot() {
  const html = '<div class="container"><div class="auth-wrap"><div class="auth-card"><h2>Reset password</h2><p class="muted">Enter your account email. If it exists, you will receive reset instructions.</p>'
    + '<form id="f-forgot">' + fieldHtml("Email address", '<input class="input" name="email" type="email" required>')
    + '<div class="form-error" id="e-forgot"></div><div class="btn-row"><button class="btn btn-primary btn-block" type="submit">Send instructions</button></div></form>'
    + '<div id="forgot-done"></div></div></div></div>';
  document.getElementById("app").innerHTML = publicLayout(html, "");
  document.getElementById("f-forgot").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const d = await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email: f.get("email") }) });
      document.getElementById("forgot-done").innerHTML = alertBox("success", esc(d.message));
    } catch (ex) { document.getElementById("e-forgot").textContent = ex.message; }
  });
}

function pageReset(params) {
  const token = params.token || "";
  const html = '<div class="container"><div class="auth-wrap"><div class="auth-card"><h2>Choose a new password</h2>'
    + '<form id="f-reset">' + fieldHtml("New password", '<input class="input" name="password" type="password" required minlength="8">', "At least 8 characters, with letters and numbers.")
    + '<div class="form-error" id="e-reset"></div><div class="btn-row"><button class="btn btn-primary btn-block" type="submit">Set new password</button></div></form></div></div></div>';
  document.getElementById("app").innerHTML = publicLayout(html, "");
  document.getElementById("f-reset").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password: f.get("password") }) });
      toast("Password reset. Please sign in.", "success");
      location.hash = "#/signin";
    } catch (ex) { document.getElementById("e-reset").textContent = ex.message; }
  });
}

async function pageLegal(key) {
  const app = document.getElementById("app");
  app.innerHTML = publicLayout('<div class="container"><div class="card">Loading…</div></div>', "");
  try {
    const d = await api("/api/public/legal/" + key);
    app.innerHTML = publicLayout('<div class="container"><div class="narrow"><div class="card"><h1>' + esc(d.title) + "</h1><p class=\"small muted\">Version " + esc(String(d.version)) + "</p><div>" + d.body + "</div></div></div></div>", "");
  } catch (e) {
    app.innerHTML = publicLayout('<div class="container"><div class="card">Document not found.</div></div>', "");
  }
}

async function pageMarketplace() {
  const app = document.getElementById("app");
  app.innerHTML = publicLayout('<div class="container"><h1>Professional talent</h1><p class="muted">Opt-in profiles shared by members. <a href="#/privacy">Manage your visibility</a>.</p><div id="mp-list"><div class="card">Loading…</div></div></div>', "marketplace");
  try {
    const d = await api("/api/public/marketplace");
    const list = document.getElementById("mp-list");
    if (!d.profiles.length) { list.innerHTML = emptyState("users", "No public profiles yet", "Members can opt in from the Privacy Center."); return; }
    list.innerHTML = '<div class="grid grid-3">' + d.profiles.map((p) =>
      '<div class="card"><h3>' + esc(p.displayName) + "</h3><p class=\"muted small\">" + esc(p.headline || "") + "</p>"
      + "<p>" + (p.skills || []).slice(0, 6).map((s) => badge(s, "blue")).join(" ") + "</p>"
      + '<p class="small muted">' + esc(p.location || "") + (p.workPreference ? " · " + esc(p.workPreference) : "") + "</p></div>"
    ).join("") + "</div>";
  } catch (e) { document.getElementById("mp-list").innerHTML = alertBox("danger", esc(e.message)); }
}

// Test checkout page (development test mode only)
async function pageCheckout(sessionId) {
  const app = document.getElementById("app");
  if (!S.user) { location.hash = "#/signin"; return; }
  app.innerHTML = publicLayout('<div class="container"><div class="narrow"><div class="card">Loading checkout…</div></div></div>', "");
  try {
    const d = await api("/api/billing/dev-checkout/" + sessionId);
    const t = d.transaction, p = d.product;
    const html = '<div class="container"><div class="narrow"><div class="card"><h2>Test checkout</h2>'
      + alertBox("warn", "Test payment mode. No real charge occurs. This screen never appears in production.")
      + "<dl class=\"kv\"><dt>Product</dt><dd><strong>" + esc(p ? p.name : t.productKey) + "</strong></dd>"
      + "<dt>Amount</dt><dd>" + money(t.amount, t.currency) + "</dd>"
      + "<dt>Billing</dt><dd>" + (p && p.kind === "subscription" ? "Monthly subscription, renews until canceled" : "One-time payment") + "</dd>"
      + "<dt>Refund policy</dt><dd><a href=\"#/legal/refunds\">Read refund policy</a></dd></dl>"
      + '<div class="btn-row"><button class="btn btn-accent" id="b-pay">Simulate successful payment</button><button class="btn btn-outline" id="b-fail">Simulate failure</button></div>'
      + '<div class="form-error" id="e-pay"></div></div></div></div>';
    app.innerHTML = publicLayout(html, "");
    async function confirm(outcome) {
      try {
        await api("/api/billing/dev-confirm/" + sessionId, { method: "POST", body: JSON.stringify({ outcome }) });
        location.hash = outcome === "failed" ? "#/billing/cancelled" : "#/billing/success";
      } catch (e) { document.getElementById("e-pay").textContent = e.message; }
    }
    document.getElementById("b-pay").addEventListener("click", () => confirm("succeeded"));
    document.getElementById("b-fail").addEventListener("click", () => confirm("failed"));
  } catch (e) {
    app.innerHTML = publicLayout('<div class="container"><div class="card">' + alertBox("danger", esc(e.message)) + "</div></div>", "");
  }
}
