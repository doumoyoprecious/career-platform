"use strict";
/* App pages part 2: premium, documents, billing, privacy, settings, support. */

function paywallHtml(productKey, title, text) {
  return '<div class="card" style="text-align:center"><div class="empty"><div class="icon-badge">' + icon("lock", "icon") + "</div>"
    + "<h3>" + esc(title) + "</h3><p>" + esc(text) + "</p>"
    + '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="#/billing">View plans and pricing</a></div>'
    + '<p class="small muted">Subscribe to Premium for full access, or purchase this feature once.</p></div></div>';
}

async function buyProduct(productKey) {
  try {
    const d = await api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ productKey }) });
    if (d.testMode) {
      const sid = d.sessionId;
      location.hash = "#/checkout/" + sid;
    } else if (d.checkoutUrl) {
      window.location.href = d.checkoutUrl;
    }
  } catch (e) { toast(e.message, "error"); }
}

/* ---------- Portfolio (premium) ---------- */
async function pagePortfolio() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  const html = '<div id="pf-gate"><div class="card">Checking access…</div></div>'
    + '<div id="pf-main" style="display:none"><div class="card"><h3>Portfolio Intelligence</h3><p class="muted">Project recommendations, portfolio structure and CV to portfolio gap analysis, delivered as PDF and DOCX.</p>'
    + fieldHtml("Target role", '<input class="input" id="pf-role" placeholder="Uses your profile target role if empty">')
    + '<div class="btn-row"><button class="btn btn-primary" id="b-pf">Generate portfolio plan</button></div><div id="pf-out" style="margin-top:14px"></div></div></div>';
  app.innerHTML = appLayout("Portfolio", html, "portfolio");
  bindShell();
  const gate = document.getElementById("pf-gate");
  try {
    const o = await api("/api/billing/overview");
    const has = o.entitlements.premium || (o.entitlements.oneTime || []).some((x) => ["portfolio", "complete_package"].includes(x.productKey));
    if (!has) {
      gate.innerHTML = paywallHtml("portfolio", "Portfolio Intelligence is a premium feature", "Get a guided portfolio plan plus a CV to portfolio gap analysis that shows which claimed skills lack proof.");
      const btn = document.createElement("div");
      btn.className = "btn-row"; btn.style.justifyContent = "center"; btn.style.marginTop = "0";
      gate.querySelector(".card").appendChild(btn);
      const b1 = document.createElement("button"); b1.className = "btn btn-accent"; b1.textContent = "Buy Portfolio Intelligence";
      b1.addEventListener("click", () => buyProduct("portfolio"));
      const b2 = document.createElement("button"); b2.className = "btn btn-outline"; b2.textContent = "Subscribe to Premium";
      b2.addEventListener("click", () => buyProduct("premium_monthly"));
      btn.appendChild(b1); btn.appendChild(b2);
      return;
    }
    gate.style.display = "none";
    document.getElementById("pf-main").style.display = "block";
  } catch (e) { gate.innerHTML = alertBox("danger", esc(e.message)); return; }

  document.getElementById("b-pf").addEventListener("click", async () => {
    const out = document.getElementById("pf-out");
    loadingInto(out, "Generating your portfolio plan…");
    try {
      const d = await api("/api/premium/portfolio", { method: "POST", body: JSON.stringify({ role: document.getElementById("pf-role").value }) });
      const r = d.result;
      out.innerHTML = alertBox("success", "Report generated. Download it from your <a href=\"#/documents\">document library</a>.")
        + "<h4>" + esc(r.cvToPortfolioGap.headline) + "</h4><p>" + (r.cvToPortfolioGap.skills.map((s) => badge(s, "amber")).join(" ") || "Good coverage.") + "</p><p class=\"muted\">" + esc(r.cvToPortfolioGap.advice) + "</p>"
        + "<h4>Recommended projects</h4><ul class=\"clean\">" + r.recommendedProjects.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>"
        + "<h4>Portfolio structure</h4><ul class=\"clean\">" + r.structure.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>"
        + "<h4>GitHub improvements</h4><ul class=\"clean\">" + r.github.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>";
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
}

/* ---------- Interview (premium) ---------- */
async function pageInterview() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  const html = '<div id="iv-gate"><div class="card">Checking access…</div></div>'
    + '<div id="iv-main" style="display:none"><div class="card"><h3>Interview Preparation</h3><p class="muted">Role specific questions, evaluation criteria and a mock interview with scoring. Delivered as PDF and DOCX.</p>'
    + fieldHtml("Target role", '<input class="input" id="iv-role" placeholder="Uses your profile target role if empty">')
    + fieldHtml("Job description (optional, improves relevance)", '<textarea class="textarea" id="iv-job" style="min-height:90px"></textarea>')
    + '<div class="btn-row"><button class="btn btn-primary" id="b-iv">Generate preparation pack</button></div><div id="iv-out" style="margin-top:14px"></div></div>'
    + '<div class="card"><h3>Mock interview</h3><p class="muted">Answer any question in writing to receive a score and feedback.</p>'
    + fieldHtml("Question", '<input class="input" id="mock-q" placeholder="e.g. Tell me about yourself">')
    + fieldHtml("Your answer", '<textarea class="textarea" id="mock-a"></textarea>')
    + '<div class="btn-row"><button class="btn btn-outline" id="b-mock">Score my answer</button></div><div id="mock-out" style="margin-top:14px"></div></div></div>';
  app.innerHTML = appLayout("Interview", html, "interview");
  bindShell();
  const gate = document.getElementById("iv-gate");
  try {
    const o = await api("/api/billing/overview");
    const has = o.entitlements.premium || (o.entitlements.oneTime || []).some((x) => ["interview", "complete_package"].includes(x.productKey));
    if (!has) {
      gate.innerHTML = paywallHtml("interview", "Interview Preparation is a premium feature", "Get tailored questions, suggested approaches, evaluation criteria and mock scoring.");
      const btn = document.createElement("div");
      btn.className = "btn-row"; btn.style.justifyContent = "center";
      gate.querySelector(".card").appendChild(btn);
      const b1 = document.createElement("button"); b1.className = "btn btn-accent"; b1.textContent = "Buy Interview Preparation";
      b1.addEventListener("click", () => buyProduct("interview"));
      btn.appendChild(b1);
      return;
    }
    gate.style.display = "none";
    document.getElementById("iv-main").style.display = "block";
  } catch (e) { gate.innerHTML = alertBox("danger", esc(e.message)); return; }

  document.getElementById("b-iv").addEventListener("click", async () => {
    const out = document.getElementById("iv-out");
    loadingInto(out, "Generating preparation pack…");
    try {
      const d = await api("/api/premium/interview", { method: "POST", body: JSON.stringify({ role: document.getElementById("iv-role").value, jobText: document.getElementById("iv-job").value }) });
      const r = d.result;
      out.innerHTML = alertBox("success", "Preparation pack generated for <strong>" + esc(r.role) + "</strong>. Download it from your <a href=\"#/documents\">document library</a>.")
        + r.questions.map((q) => '<div class="list-item">' + badge(q.type, "navy") + "<div style=\"margin-top:6px\"><strong>" + esc(q.question) + "</strong></div><div class=\"small muted\">Evaluate: " + esc(q.criteria) + "<br>" + esc(q.guidance) + "</div></div>").join("");
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
  document.getElementById("b-mock").addEventListener("click", async () => {
    const out = document.getElementById("mock-out");
    try {
      const d = await api("/api/premium/interview/mock", { method: "POST", body: JSON.stringify({ question: document.getElementById("mock-q").value, answer: document.getElementById("mock-a").value }) });
      out.innerHTML = '<div class="score-wrap">' + scoreRing(d.score, 90) + "<div><h4>Score: " + d.score + " (" + d.wordCount + " words)</h4><ul class=\"clean\">" + d.feedback.map((f) => "<li>" + esc(f) + "</li>").join("") + "</ul></div></div>";
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
}

/* ---------- Premium CV tools (inside CV page upsell + billing) ---------- */
async function pageUpgrade() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  const html = '<div class="card"><h3>CV Upgrade</h3><p class="muted">Professional rewrite preserving every fact. Before and after scores, PDF and DOCX delivery.</p>'
    + '<div class="btn-row"><button class="btn btn-primary" id="b-up">Generate CV Upgrade</button></div><div id="up-out" style="margin-top:14px"></div></div>'
    + '<div class="card"><h3>Job-Specific CV</h3><p class="muted">Tailored to one job description. Missing skills require your confirmation before anything is added.</p>'
    + fieldHtml("Target job description", '<textarea class="textarea" id="js-job"></textarea>')
    + '<div class="btn-row"><button class="btn btn-primary" id="b-js">Generate Job-Specific CV</button></div><div id="js-out" style="margin-top:14px"></div></div>'
    + '<div class="card"><h3>Application Package</h3><p class="muted">Tailored CV, cover letter, answers, summary and checklist.</p>'
    + '<div class="form-2">' + fieldHtml("Job title", '<input class="input" id="ap-title">') + fieldHtml("Employer", '<input class="input" id="ap-emp">') + "</div>"
    + '<div class="btn-row"><button class="btn btn-primary" id="b-ap">Generate Application Package</button><button class="btn btn-outline" id="b-full">Generate Complete Package</button></div><div id="ap-out" style="margin-top:14px"></div></div>';
  app.innerHTML = appLayout("Premium documents", html, "cv");
  bindShell();
  function paywallInto(out, product) {
    out.innerHTML = paywallHtml(product, "Premium feature", "Subscribe or purchase to generate this document.")
      + '<div class="btn-row"><button class="btn btn-accent" id="buy-' + product + '">Buy now</button></div>';
    const b = document.getElementById("buy-" + product);
    if (b) b.addEventListener("click", () => buyProduct(product));
  }
  document.getElementById("b-up").addEventListener("click", async () => {
    const out = document.getElementById("up-out");
    loadingInto(out, "Upgrading your CV…");
    try {
      const d = await api("/api/premium/cv-upgrade", { method: "POST", body: "{}" });
      out.innerHTML = alertBox("success", "Upgraded CV ready. Before: <strong>" + d.result.beforeScore + "</strong>, after: <strong>" + d.result.afterScore + "</strong>. Download from <a href=\"#/documents\">documents</a>.")
        + "<h4>Changes made</h4><ul class=\"clean\">" + d.result.changes.map((c) => "<li>" + esc(c) + "</li>").join("") + "</ul>";
    } catch (e) { if (e.code === "PAYMENT_REQUIRED") paywallInto(out, "cv_upgrade"); else out.innerHTML = alertBox("danger", esc(e.message)); }
  });
  document.getElementById("b-js").addEventListener("click", async () => {
    const out = document.getElementById("js-out");
    const job = document.getElementById("js-job").value;
    loadingInto(out, "Analyzing job and drafting CV…");
    try {
      const d = await api("/api/premium/job-cv", { method: "POST", body: JSON.stringify({ jobText: job }) });
      if (d.needsConfirmation) {
        out.innerHTML = "<h4>Confirmation required</h4><p>The job asks for skills not found in your profile. Tick each skill you genuinely possess:</p>"
          + d.result.confirmationRequired.map((s) => '<label class="check-row"><input type="checkbox" class="cf-skill" value="' + esc(s) + '"> <span><strong>' + esc(s) + "</strong></span></label>").join("")
          + '<div class="btn-row"><button class="btn btn-primary" id="b-js-confirm">Confirm and generate</button></div>';
        document.getElementById("b-js-confirm").addEventListener("click", async () => {
          const confirmed = Array.from(document.querySelectorAll(".cf-skill:checked")).map((c) => c.value);
          loadingInto(out, "Generating final CV…");
          try {
            const d2 = await api("/api/premium/job-cv", { method: "POST", body: JSON.stringify({ jobText: job, confirmedSkills: confirmed, skipConfirm: true }) });
            out.innerHTML = alertBox("success", "Job-specific CV ready. Download from <a href=\"#/documents\">documents</a>.") + "<p class=\"muted\">" + esc(d2.result.note) + "</p>";
          } catch (e2) { out.innerHTML = alertBox("danger", esc(e2.message)); }
        });
        return;
      }
      out.innerHTML = alertBox("success", "Job-specific CV ready. Download from <a href=\"#/documents\">documents</a>.");
    } catch (e) { if (e.code === "PAYMENT_REQUIRED") paywallInto(out, "job_cv"); else out.innerHTML = alertBox("danger", esc(e.message)); }
  });
  async function genApp(complete) {
    const out = document.getElementById("ap-out");
    loadingInto(out, "Generating package…");
    try {
      const d = await api(complete ? "/api/premium/complete" : "/api/premium/app-package", { method: "POST", body: JSON.stringify({ jobTitle: document.getElementById("ap-title").value, employer: document.getElementById("ap-emp").value }) });
      if (d.result && d.result.coverLetter) {
        out.innerHTML = alertBox("success", "Application package ready. Download from <a href=\"#/documents\">documents</a>.")
          + "<h4>Cover letter preview</h4>" + d.result.coverLetter.map((p) => "<p>" + esc(p) + "</p>").join("")
          + "<h4>Checklist</h4><ul class=\"clean\">" + d.result.checklist.map((c) => "<li>" + esc(c) + "</li>").join("") + "</ul>";
      } else out.innerHTML = alertBox("success", "Complete package ready. Download from <a href=\"#/documents\">documents</a>.");
    } catch (e) { if (e.code === "PAYMENT_REQUIRED") paywallInto(out, complete ? "complete_package" : "app_package"); else out.innerHTML = alertBox("danger", esc(e.message)); }
  }
  document.getElementById("b-ap").addEventListener("click", () => genApp(false));
  document.getElementById("b-full").addEventListener("click", () => genApp(true));
}

/* ---------- Documents ---------- */
async function pageDocuments() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Documents", '<div class="card">Loading…</div>', "documents");
  bindShell();
  try {
    const d = await api("/api/documents");
    const html = '<div class="card"><h3>Document library</h3><p class="muted">Secure downloads. Links expire after 30 minutes; generate a new link anytime.</p>'
      + (d.documents.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Document</th><th>Product</th><th>Format</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>'
        + d.documents.map((x) => "<tr><td><strong>" + esc(x.title) + "</strong></td><td>" + esc(x.product) + "</td><td>" + esc(x.ext.toUpperCase()) + "</td><td>" + fmtDate(x.at) + "</td><td>" + statusBadge(x.status) + "</td>"
          + "<td>" + (x.status === "revoked" ? "" : '<button class="btn btn-outline btn-sm" data-dl="' + x.id + '">Download</button>') + "</td></tr>").join("")
        + "</tbody></table></div>"
        : emptyState("book", "No documents yet", "Premium documents you generate will appear here.", '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="#/upgrade">Browse premium documents</a></div>'))
      + "</div>";
    app.innerHTML = appLayout("Documents", html, "documents");
    bindShell();
    document.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", async () => {
      try {
        const l = await api("/api/documents/" + b.getAttribute("data-dl") + "/link", { method: "POST", body: "{}" });
        window.location.href = "/api/documents/download?token=" + l.token;
      } catch (e) { toast(e.message, "error"); }
    }));
  } catch (e) {
    app.innerHTML = appLayout("Documents", alertBox("danger", esc(e.message)), "documents");
    bindShell();
  }
}

/* ---------- Billing ---------- */
async function pageBilling() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Billing", '<div class="card">Loading…</div>', "billing");
  bindShell();
  try {
    const o = await api("/api/billing/overview");
    const prods = (await api("/api/billing/products")).products;
    const sub = prods.find((p) => p.kind === "subscription");
    const ones = prods.filter((p) => p.kind !== "subscription");
    let html = "";
    if (!o.provider.ready) html += alertBox("warn", "Payments are not configured yet. " + esc(o.provider.note || ""));
    if (o.provider.provider === "dev") html += alertBox("info", "Test payment mode is active. No real charge occurs.");
    html += '<div class="grid grid-2"><div class="card"><h3>Current plan</h3>'
      + (o.entitlements.premium
        ? "<p>" + badge("Premium active", "green") + "</p><p class=\"muted\">Renews: " + fmtDate(o.entitlements.subscription.currentPeriodEnd) + "</p>"
          + (o.entitlements.subscription.cancelAtPeriodEnd ? "<p>Cancellation scheduled; access continues until period end.</p>" : '<div class="btn-row"><button class="btn btn-outline" id="b-cancel">Cancel subscription</button></div>')
        : "<p>" + badge("Free plan", "gray") + "</p><p class=\"muted\">Upgrade for full premium access.</p>"
          + (sub ? '<div class="btn-row"><button class="btn btn-primary" id="b-sub">Subscribe: ' + money(sub.price, sub.currency) + '/month</button></div>' : ""))
      + "</div><div class=\"card\"><h3>Your entitlements</h3>"
      + ((o.entitlements.oneTime || []).length ? "<ul class=\"clean\">" + o.entitlements.oneTime.map((e) => "<li>" + esc(e.productKey.replace(/_/g, " ")) + "</li>").join("") + "</ul>" : '<p class="muted">No one-time purchases yet.</p>')
      + "</div></div>";
    html += '<div class="card"><h3>Pay per feature</h3><div class="table-wrap"><table class="table"><thead><tr><th>Feature</th><th>Description</th><th>Price</th><th></th></tr></thead><tbody>'
      + ones.map((p) => "<tr><td><strong>" + esc(p.name) + "</strong></td><td>" + esc(p.description) + "</td><td>" + money(p.price, p.currency) + "</td><td><button class=\"btn btn-outline btn-sm\" data-buy=\"" + p.key + "\">Buy</button></td></tr>").join("")
      + "</tbody></table></div></div>";
    html += '<div class="card"><h3>Payment history</h3>'
      + (o.purchases.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Product</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>'
        + o.purchases.map((p) => "<tr><td>" + fmtDate(p.at) + "</td><td>" + esc(p.productKey.replace(/_/g, " ")) + "</td><td>" + money(p.amount, p.currency) + "</td><td>" + statusBadge(p.status) + "</td><td><button class=\"btn btn-ghost btn-sm\" data-receipt=\"" + p.id + "\">Receipt</button></td></tr>").join("")
        + "</tbody></table></div>" : '<p class="muted">No purchases yet.</p>') + "</div>";
    html += '<div id="receipt-out"></div>';
    app.innerHTML = appLayout("Billing", html, "billing");
    bindShell();
    const bs = document.getElementById("b-sub");
    if (bs) bs.addEventListener("click", () => buyProduct(sub.key));
    const bc = document.getElementById("b-cancel");
    if (bc) bc.addEventListener("click", async () => {
      if (!confirm("Cancel your subscription? You keep access until the end of the paid period.")) return;
      try { await api("/api/billing/subscription/cancel", { method: "POST", body: "{}" }); toast("Subscription canceled.", "success"); pageBilling(); }
      catch (e) { toast(e.message, "error"); }
    });
    document.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => buyProduct(b.getAttribute("data-buy"))));
    document.querySelectorAll("[data-receipt]").forEach((b) => b.addEventListener("click", async () => {
      try {
        const r = (await api("/api/billing/receipt/" + b.getAttribute("data-receipt"))).receipt;
        modal("<h2>Receipt</h2><dl class=\"kv\"><dt>Customer</dt><dd>" + esc(r.customerName) + " (" + esc(r.customerEmail) + ")</dd><dt>Product</dt><dd>" + esc(r.product) + "</dd><dt>Amount</dt><dd>" + money(r.amount, r.currency) + "</dd><dt>Date</dt><dd>" + fmtDate(r.date) + "</dd><dt>Transaction</dt><dd>" + esc(r.transactionId) + "</dd><dt>Provider</dt><dd>" + esc(r.provider) + "</dd><dt>Status</dt><dd>" + esc(r.status) + "</dd><dt>Seller</dt><dd>" + esc(r.company) + "</dd></dl><div class=\"btn-row\"><button class=\"btn btn-outline\" onclick=\"closeModal()\">Close</button></div>");
      } catch (e) { toast(e.message, "error"); }
    }));
  } catch (e) {
    app.innerHTML = appLayout("Billing", alertBox("danger", esc(e.message)), "billing");
    bindShell();
  }
}

function pageBillingResult(kind) {
  if (!S.user) { location.hash = "#/signin"; return; }
  const ok = kind === "success";
  const html = '<div class="card" style="text-align:center"><h2>' + (ok ? "Payment successful" : "Payment not completed") + "</h2>"
    + '<p class="muted">' + (ok ? "Your purchase is confirmed. A receipt was emailed to you." : "No charge was made. You can retry from billing.") + "</p>"
    + '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary" href="#/' + (ok ? "documents" : "billing") + '">' + (ok ? "Open documents" : "Back to billing") + "</a></div></div>";
  document.getElementById("app").innerHTML = appLayout("Billing", html, "billing");
  bindShell();
}

/* ---------- Privacy ---------- */
async function pagePrivacy() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Privacy Center", '<div class="card">Loading…</div>', "privacy");
  bindShell();
  try {
    const c = await api("/api/privacy/consents");
    const s = await api("/api/privacy/summary");
    const m = await api("/api/privacy/marketplace");
    const reqs = await api("/api/privacy/requests");
    let html = '<div class="card"><h3>Your data</h3><dl class="kv">'
      + "<dt>Account</dt><dd>" + esc(s.held.account.name) + ", " + esc(s.held.account.email) + "</dd>"
      + "<dt>Career profile</dt><dd>" + (s.held.careerProfile ? "Stored" : "Not created") + "</dd>"
      + "<dt>CV uploads</dt><dd>" + s.held.cvs + "</dd><dt>Analyses</dt><dd>" + s.held.analyses + "</dd>"
      + "<dt>Purchases</dt><dd>" + s.held.purchases + "</dd><dt>Documents</dt><dd>" + s.held.documents + "</dd>"
      + "<dt>Marketplace</dt><dd>" + (s.held.marketplace ? "Profile exists" : "No profile") + "</dd></dl>"
      + '<div class="btn-row"><a class="btn btn-outline" href="/api/privacy/export">Download my data (JSON)</a></div></div>';
    html += '<div class="card"><h3>Consent preferences</h3><p class="muted">Optional uses are off unless you turn them on. Changes apply immediately.</p>'
      + c.categories.filter((x) => !x.required).map((x) => {
        const st = c.state[x.key];
        return '<div class="check-row"><input type="checkbox" data-consent="' + x.key + '" ' + (st === "granted" ? "checked" : "") + ' id="c-' + x.key + '"> <span><label for="c-' + x.key + '"><strong>' + esc(x.label) + "</strong></label><br><span class=\"small muted\">" + esc(x.wording) + "</span></span></div>";
      }).join("") + "</div>";
    html += '<div class="card"><h3>Professional marketplace</h3><p class="muted">Optional. Your original CV is never exposed; only the fields below are shown.</p>'
      + fieldHtml("Display name", '<input class="input" id="mp-name" value="' + esc((m.profile && m.profile.displayName) || "") + '">')
      + fieldHtml("Headline", '<input class="input" id="mp-head" value="' + esc((m.profile && m.profile.headline) || "") + '">')
      + fieldHtml("Skills (comma separated)", '<input class="input" id="mp-skills" value="' + esc(((m.profile && m.profile.skills) || []).join(", ")) + '">')
      + '<div class="btn-row"><button class="btn btn-primary" id="b-mp-save">Save and opt in</button>'
      + (m.profile ? '<button class="btn btn-outline" id="b-mp-off">Opt out and remove</button>' : "") + "</div></div>";
    html += '<div class="card"><h3>Privacy requests</h3><p class="muted">Access, correction, deletion, export or objection.</p>'
      + '<div class="form-2">' + fieldHtml("Type", '<select class="select" id="pr-type"><option value="access">Access</option><option value="correction">Correction</option><option value="deletion">Deletion</option><option value="export">Export</option><option value="objection">Objection</option><option value="other">Other</option></select>')
      + fieldHtml("Detail", '<input class="input" id="pr-detail" placeholder="Describe your request">') + "</div>"
      + '<div class="btn-row"><button class="btn btn-outline" id="b-pr">Submit request</button></div>'
      + (reqs.requests.length ? '<div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Type</th><th>Status</th><th>Date</th></tr></thead><tbody>' + reqs.requests.map((r) => "<tr><td>" + esc(r.type) + "</td><td>" + statusBadge(r.status) + "</td><td>" + fmtDate(r.createdAt) + "</td></tr>").join("") + "</tbody></table></div>" : "")
      + "</div>";
    html += '<div class="card"><h3>Retention schedule</h3><div class="table-wrap"><table class="table"><thead><tr><th>Category</th><th>Period</th><th>Action</th></tr></thead><tbody>'
      + s.retention.map((r) => "<tr><td>" + esc(r.category) + "</td><td>" + esc(r.period) + "</td><td>" + esc(r.action) + "</td></tr>").join("") + "</tbody></table></div></div>";
    html += '<div class="card"><h3>Delete account</h3><p class="muted">Deletes your profile, CVs and analyses, revokes sessions and marketplace profile, and cancels future optional processing. Transaction records are retained as required by law.</p><div class="btn-row"><a class="btn btn-danger" href="#/settings">Go to account deletion</a></div></div>';
    app.innerHTML = appLayout("Privacy Center", html, "privacy");
    bindShell();
    document.querySelectorAll("[data-consent]").forEach((cb) => cb.addEventListener("change", async () => {
      try {
        await api("/api/privacy/consents", { method: "POST", body: JSON.stringify({ category: cb.getAttribute("data-consent"), status: cb.checked ? "granted" : "withdrawn" }) });
        toast("Preference saved.", "success");
      } catch (e) { toast(e.message, "error"); cb.checked = !cb.checked; }
    }));
    document.getElementById("b-mp-save").addEventListener("click", async () => {
      try {
        await api("/api/privacy/marketplace", { method: "POST", body: JSON.stringify({ displayName: document.getElementById("mp-name").value, headline: document.getElementById("mp-head").value, skills: document.getElementById("mp-skills").value.split(",").map((x) => x.trim()).filter(Boolean) }) });
        toast("Marketplace profile saved.", "success"); pagePrivacy();
      } catch (e) { toast(e.message, "error"); }
    });
    const off = document.getElementById("b-mp-off");
    if (off) off.addEventListener("click", async () => {
      try { await api("/api/privacy/marketplace", { method: "POST", body: JSON.stringify({ enabled: false }) }); toast("Opted out.", "success"); pagePrivacy(); }
      catch (e) { toast(e.message, "error"); }
    });
    document.getElementById("b-pr").addEventListener("click", async () => {
      try {
        await api("/api/privacy/requests", { method: "POST", body: JSON.stringify({ type: document.getElementById("pr-type").value, detail: document.getElementById("pr-detail").value }) });
        toast("Request submitted.", "success"); pagePrivacy();
      } catch (e) { toast(e.message, "error"); }
    });
  } catch (e) {
    app.innerHTML = appLayout("Privacy Center", alertBox("danger", esc(e.message)), "privacy");
    bindShell();
  }
}

/* ---------- Settings ---------- */
async function pageSettings() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  const html = '<div class="card"><h3>Change password</h3><form id="f-pw">'
    + fieldHtml("Current password", '<input class="input" name="current" type="password" required>')
    + fieldHtml("New password", '<input class="input" name="next" type="password" required minlength="8">')
    + '<div class="form-error" id="e-pw"></div><div class="btn-row"><button class="btn btn-primary" type="submit">Update password</button></div></form></div>'
    + '<div class="card"><h3>Change email</h3><p class="muted">You will need to verify the new address.</p><form id="f-em">'
    + fieldHtml("New email", '<input class="input" name="email" type="email" required>')
    + '<div class="form-error" id="e-em"></div><div class="btn-row"><button class="btn btn-outline" type="submit">Update email</button></div></form></div>'
    + '<div class="card"><h3>Active sessions</h3><div id="sess-list">Loading…</div></div>'
    + '<div class="card"><h3>Delete account</h3><p class="muted">Type DELETE and enter your password to confirm. This cannot be undone.</p><form id="f-del">'
    + '<div class="form-2">' + fieldHtml("Confirmation", '<input class="input" name="confirm" placeholder="DELETE" required>') + fieldHtml("Password", '<input class="input" name="password" type="password" required>') + "</div>"
    + '<div class="form-error" id="e-del"></div><div class="btn-row"><button class="btn btn-danger" type="submit">Delete my account</button></div></form></div>';
  app.innerHTML = appLayout("Settings", html, "settings");
  bindShell();
  try {
    const d = await api("/api/auth/sessions");
    document.getElementById("sess-list").innerHTML = d.sessions.map((s) => '<div class="list-item"><strong>' + esc(s.userAgent || "Unknown device") + "</strong> " + (s.current ? badge("Current", "green") : "")
      + '<div class="small muted">' + esc(s.ip || "") + " · since " + fmtDate(s.createdAt) + "</div>"
      + (s.current ? "" : '<button class="btn btn-ghost btn-sm" data-revoke="' + s.id + '">Revoke</button>') + "</div>").join("");
    document.querySelectorAll("[data-revoke]").forEach((b) => b.addEventListener("click", async () => {
      await api("/api/auth/sessions/" + b.getAttribute("data-revoke"), { method: "DELETE" });
      toast("Session revoked.", "success"); pageSettings();
    }));
  } catch (e) { document.getElementById("sess-list").innerHTML = alertBox("danger", esc(e.message)); }
  document.getElementById("f-pw").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await api("/api/auth/password", { method: "POST", body: JSON.stringify({ current: f.get("current"), next: f.get("next") }) }); toast("Password updated.", "success"); e.target.reset(); }
    catch (ex) { document.getElementById("e-pw").textContent = ex.message; }
  });
  document.getElementById("f-em").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api("/api/auth/email", { method: "POST", body: JSON.stringify({ email: f.get("email") }) });
      toast("Email updated. Please verify the new address.", "success");
      await refreshSession();
      location.hash = "#/verify-pending";
    } catch (ex) { document.getElementById("e-em").textContent = ex.message; }
  });
  document.getElementById("f-del").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api("/api/privacy/delete-account", { method: "POST", body: JSON.stringify({ confirm: f.get("confirm"), password: f.get("password") }) });
      S.user = null; S.csrf = null;
      toast("Account deleted.", "success");
      location.hash = "#/";
    } catch (ex) { document.getElementById("e-del").textContent = ex.message; }
  });
}

/* ---------- Support ---------- */
async function pageSupport() {
  const inApp = !!S.user;
  const wrap = (content) => inApp ? appLayout("Support", content, "support") : publicLayout('<div class="container">' + content + "</div>", "support");
  const app = document.getElementById("app");
  let tickets = [];
  if (inApp) { try { tickets = (await api("/api/me/support")).tickets; } catch (e) { /* ignore */ } }
  const html = '<div class="card"><h3>Contact support</h3>' + (inApp
    ? fieldHtml("Category", '<select class="select" id="sp-cat"><option value="general">General</option><option value="career">Career analysis</option><option value="payment">Payment</option><option value="document">Document</option><option value="privacy">Privacy</option><option value="bug">Report a problem</option></select>')
      + fieldHtml("Subject", '<input class="input" id="sp-sub">')
      + fieldHtml("Message", '<textarea class="textarea" id="sp-msg"></textarea>')
      + '<div class="btn-row"><button class="btn btn-primary" id="b-sp">Send message</button></div>'
    : '<p class="muted">Sign in to message support, or email ' + esc(S.brand.supportEmail) + ".</p>") + "</div>"
    + (inApp && tickets.length ? '<div class="card"><h3>Your tickets</h3>' + tickets.map((t) => '<div class="list-item"><strong>' + esc(t.subject) + "</strong> " + statusBadge(t.status) + '<div class="small muted">' + esc(t.category) + " · " + fmtDate(t.createdAt) + "</div><div>" + esc(t.message) + "</div>" + (t.reply ? '<div class="alert alert-info" style="margin-top:8px"><span><strong>Support reply:</strong> ' + esc(t.reply) + "</span></div>" : "") + "</div>").join("") + "</div>" : "");
  app.innerHTML = wrap(html);
  if (inApp) bindShell();
  const b = document.getElementById("b-sp");
  if (b) b.addEventListener("click", async () => {
    try {
      await api("/api/me/support", { method: "POST", body: JSON.stringify({ category: document.getElementById("sp-cat").value, subject: document.getElementById("sp-sub").value, message: document.getElementById("sp-msg").value }) });
      toast("Message sent.", "success"); pageSupport();
    } catch (e) { toast(e.message, "error"); }
  });
}

/* ---------- Notifications + inbox ---------- */
async function pageNotifications() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Notifications", '<div class="card">Loading…</div>', "");
  bindShell();
  try {
    const d = await api("/api/me/notifications");
    const html = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><h3>Notifications</h3><button class="btn btn-ghost btn-sm" id="b-read">Mark all read</button></div>'
      + (d.notifications.length ? d.notifications.map((n) => '<div class="list-item" style="' + (n.readAt ? "" : "border-left:3px solid var(--accent)") + '"><strong>' + esc(n.title) + "</strong><div>" + esc(n.body) + '</div><div class="small muted">' + fmtDate(n.at || n.createdAt) + "</div></div>").join("") : emptyState("bell", "No notifications", "Updates about analyses, documents and billing appear here."))
      + "</div>";
    app.innerHTML = appLayout("Notifications", html, "");
    bindShell();
    document.getElementById("b-read").addEventListener("click", async () => {
      await api("/api/me/notifications/read", { method: "POST", body: JSON.stringify({ ids: d.notifications.map((n) => n.id) }) });
      pageNotifications();
    });
  } catch (e) { app.innerHTML = appLayout("Notifications", alertBox("danger", esc(e.message)), ""); bindShell(); }
}

async function pageInbox() {
  if (!S.user) { location.hash = "#/signin"; return; }
  const app = document.getElementById("app");
  const shell = (c) => S.user.emailVerifiedAt ? appLayout("Email inbox", c, "") : publicLayout('<div class="container">' + c + "</div>", "");
  app.innerHTML = shell('<div class="card">Loading…</div>');
  if (S.user.emailVerifiedAt) bindShell();
  try {
    const d = await api("/api/me/inbox");
    const html = '<div class="card"><h3>Emails sent to you</h3><p class="muted">Your transactional email history. Verification and reset links arrive here.</p>'
      + (d.emails.length ? d.emails.map((m) => '<div class="list-item"><strong>' + esc(m.subject) + "</strong> " + statusBadge(m.status) + '<div class="small muted">' + fmtDate(m.at) + '</div><button class="btn btn-ghost btn-sm" data-mail="' + m.id + '">View</button><div id="mail-' + m.id + '"></div></div>').join("") : emptyState("mail", "No emails yet", "Emails about verification, receipts and documents will appear here."))
      + "</div>";
    app.innerHTML = shell(html);
    if (S.user.emailVerifiedAt) bindShell();
    document.querySelectorAll("[data-mail]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.getAttribute("data-mail");
      const box = document.getElementById("mail-" + id);
      try {
        const m = await api("/api/me/inbox/" + id);
        box.innerHTML = m.html ? '<div style="border:1px solid var(--border);border-radius:6px;padding:12px;margin-top:8px;background:#fff">' + m.html + "</div>" : '<p class="muted">Content available in your email client.</p>';
      } catch (e) { toast(e.message, "error"); }
    }));
  } catch (e) { app.innerHTML = shell(alertBox("danger", esc(e.message))); }
}
