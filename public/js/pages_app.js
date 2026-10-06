"use strict";
/* App pages part 1: dashboard, onboarding, profile, CV, jobs, skills. */

function guardVerified() {
  if (!S.user) { location.hash = "#/signin"; return false; }
  if (!S.user.emailVerifiedAt) { location.hash = "#/verify-pending"; return false; }
  return true;
}

async function pageDashboard() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Dashboard", '<div class="card">Loading…</div>', "dashboard");
  bindShell();
  try {
    const d = await api("/api/me/dashboard");
    let html = "";
    if (!d.profile) {
      html += alertBox("info", 'Welcome. Complete <a href="#/onboarding">onboarding</a> and upload your CV to unlock your Readiness Score and recommendations.');
    }
    html += '<div class="grid grid-3">'
      + '<div class="stat"><div class="label">Readiness Score</div><div class="value">' + (d.readiness ? d.readiness.score : "N/A") + '</div><div class="sub">' + (d.readiness ? esc(d.readiness.band) : "Complete onboarding to score") + '</div><div style="margin-top:10px"><a class="btn btn-outline btn-sm" href="#/cv">View CV review</a></div></div>'
      + '<div class="stat"><div class="label">Premium status</div><div class="value" style="font-size:1.3rem">' + (d.premium ? "Active" : "Free plan") + '</div><div class="sub">' + (d.subscription && d.subscription.currentPeriodEnd ? "Renews " + fmtDate(d.subscription.currentPeriodEnd) : "Upgrade for premium features") + '</div><div style="margin-top:10px"><a class="btn btn-outline btn-sm" href="#/billing">Manage billing</a></div></div>'
      + '<div class="stat"><div class="label">Documents</div><div class="value">' + d.documents.length + '</div><div class="sub">Ready in your library</div><div style="margin-top:10px"><a class="btn btn-outline btn-sm" href="#/documents">Open library</a></div></div>'
      + "</div>";
    if (d.readiness && d.readiness.topActions && d.readiness.topActions.length) {
      html += '<div class="card"><h3>Recommended actions</h3><ul class="clean">' + d.readiness.topActions.map((a) => "<li>" + esc(a) + "</li>").join("") + "</ul></div>";
    }
    html += '<div class="grid grid-2"><div class="card"><h3>Recent analyses</h3>'
      + (d.recentAnalyses.length ? d.recentAnalyses.map((a) => '<div class="list-item"><strong>' + esc(a.kind.replace(/_/g, " ")) + "</strong><div class=\"small muted\">" + fmtDate(a.at || a.createdAt) + "</div></div>").join("") : '<p class="muted">No analyses yet. Start with a <a href="#/cv">CV review</a>.</p>')
      + '</div><div class="card"><h3>Latest notifications</h3>'
      + (d.notifications.length ? d.notifications.map((n) => '<div class="list-item"><strong>' + esc(n.title) + "</strong><div class=\"small muted\">" + esc(n.body) + "</div></div>").join("") : '<p class="muted">No notifications.</p>')
      + '<p><a href="#/notifications">View all</a></p></div></div>';
    app.innerHTML = appLayout("Dashboard", html, "dashboard");
    bindShell();
  } catch (e) {
    app.innerHTML = appLayout("Dashboard", alertBox("danger", esc(e.message)), "dashboard");
    bindShell();
  }
}

/* ---------- Onboarding ---------- */
function onboardFormHtml(p) {
  p = p || {};
  const v = (k) => esc(p[k] || "");
  const arr = (k) => esc((p[k] || []).join(", "));
  return '<form id="f-onboard">'
    + '<div class="form-2">'
    + fieldHtml("Full name", '<input class="input" name="fullName" value="' + v("fullName") + '" required>')
    + fieldHtml("Country", '<input class="input" name="country" value="' + v("country") + '">')
    + fieldHtml("Target countries (comma separated)", '<input class="input" name="targetCountries" value="' + arr("targetCountries") + '">')
    + fieldHtml("Experience level", '<select class="select" name="experienceLevel">' + ["", "Student", "Entry", "Junior", "Mid-level", "Senior", "Lead"].map((o) => '<option value="' + o + '"' + (p.experienceLevel === o ? " selected" : "") + ">" + (o || "Select…") + "</option>").join("") + "</select>")
    + fieldHtml("Years of experience", '<input class="input" name="yearsExperience" type="number" min="0" max="60" value="' + (p.yearsExperience === null || p.yearsExperience === undefined ? "" : p.yearsExperience) + '">')
    + fieldHtml("Work preference", '<select class="select" name="workPreference">' + ["", "remote", "hybrid", "on-site"].map((o) => '<option value="' + o + '"' + (p.workPreference === o ? " selected" : "") + ">" + (o || "Select…") + "</option>").join("") + "</select>")
    + "</div>"
    + fieldHtml("Target roles (comma separated)", '<input class="input" name="targetRoles" value="' + arr("targetRoles") + '" placeholder="Data Analyst, Product Manager">')
    + fieldHtml("Skills (comma separated)", '<input class="input" name="skills" value="' + arr("skills") + '" placeholder="SQL, Excel, Python">')
    + fieldHtml("Professional summary", '<textarea class="textarea" name="summary" style="min-height:90px">' + v("summary") + "</textarea>")
    + '<div class="form-2">'
    + fieldHtml("LinkedIn URL", '<input class="input" name="linkedin" value="' + v("linkedin") + '">')
    + fieldHtml("GitHub URL", '<input class="input" name="github" value="' + v("github") + '">')
    + fieldHtml("Portfolio URL", '<input class="input" name="portfolio" value="' + v("portfolio") + '">')
    + fieldHtml("Salary expectation", '<input class="input" name="salaryExpectation" value="' + v("salaryExpectation") + '" placeholder="e.g. $2,000 - $3,000 / month">')
    + "</div>"
    + fieldHtml("Work authorization", '<input class="input" name="workAuthorization" value="' + v("workAuthorization") + '" placeholder="e.g. Authorized to work in Nigeria; open to remote worldwide">')
    + '<div class="form-error" id="e-onboard"></div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Save career profile</button></div></form>';
}

async function pageOnboarding() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Career onboarding", '<div class="card">Loading…</div>', "profile");
  bindShell();
  let profile = null;
  try { const d = await api("/api/me/profile"); profile = d.profile; } catch (e) { /* ignore */ }
  const html = '<div class="card"><h3>Tell us about your career</h3><p class="muted">This profile powers your Readiness Score, matches and recommendations. You can edit everything later.</p>' + onboardFormHtml(profile) + "</div>"
    + '<div class="card"><h3>Next: upload your CV</h3><p class="muted">After saving, upload your CV so we can extract and verify your details.</p><a class="btn btn-outline" href="#/cv">Go to CV upload</a></div>';
  app.innerHTML = appLayout("Career onboarding", html, "profile");
  bindShell();
  document.getElementById("f-onboard").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const split = (k) => String(f.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
    const body = {
      fullName: f.get("fullName"), country: f.get("country"), targetCountries: split("targetCountries"),
      experienceLevel: f.get("experienceLevel"), yearsExperience: f.get("yearsExperience") === "" ? null : Number(f.get("yearsExperience")),
      targetRoles: split("targetRoles"), skills: split("skills"), summary: f.get("summary"),
      linkedin: f.get("linkedin"), github: f.get("github"), portfolio: f.get("portfolio"),
      salaryExpectation: f.get("salaryExpectation"), workAuthorization: f.get("workAuthorization"), workPreference: f.get("workPreference")
    };
    // Preserve structured arrays already stored
    if (profile) { body.education = profile.education; body.experience = profile.experience; body.certifications = profile.certifications; body.projects = profile.projects; }
    try {
      await api("/api/me/profile", { method: "POST", body: JSON.stringify(body) });
      toast("Career profile saved.", "success");
      location.hash = "#/cv";
    } catch (ex) { document.getElementById("e-onboard").textContent = ex.message; }
  });
}

/* ---------- Profile ---------- */
async function pageProfile() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Career Profile", '<div class="card">Loading…</div>', "profile");
  bindShell();
  try {
    const d = await api("/api/me/profile");
    const p = d.profile;
    if (!p) { location.hash = "#/onboarding"; return; }
    const list = (arr, fn) => (arr && arr.length ? arr.map(fn).join("") : '<p class="muted">None added yet.</p>');
    const html = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div><h2 style="margin:0">' + esc(p.fullName) + "</h2><p class=\"muted\">" + esc((p.targetRoles || []).join(" · ")) + "</p></div>"
      + '<a class="btn btn-outline" href="#/onboarding">Edit profile</a></div>'
      + "<dl class=\"kv\" style=\"margin-top:14px\"><dt>Country</dt><dd>" + esc(p.country || "Not set") + "</dd>"
      + "<dt>Experience</dt><dd>" + esc(p.experienceLevel || "Not set") + (p.yearsExperience !== null && p.yearsExperience !== undefined ? " (" + p.yearsExperience + " years)" : "") + "</dd>"
      + "<dt>Work preference</dt><dd>" + esc(p.workPreference || "Not set") + "</dd>"
      + "<dt>Summary</dt><dd>" + esc(p.summary || "Not set") + "</dd></dl></div>"
      + '<div class="card"><h3>Skills</h3><p>' + ((p.skills || []).map((s) => badge(s, "blue")).join(" ") || '<span class="muted">None added yet.</span>') + "</p></div>"
      + '<div class="grid grid-2"><div class="card"><h3>Experience</h3>' + list(p.experience, (e) => '<div class="list-item"><strong>' + esc(e.title || "") + "</strong>" + (e.employer ? " <span class=\"muted\">at " + esc(e.employer) + "</span>" : "") + (e.dates ? '<div class="small muted">' + esc(e.dates) + "</div>" : "") + (e.description ? "<div>" + esc(e.description) + "</div>" : "") + "</div>") + "</div>"
      + '<div class="card"><h3>Education</h3>' + list(p.education, (e) => '<div class="list-item">' + esc(typeof e === "string" ? e : ((e.qualification || "") + (e.institution ? ", " + e.institution : "") + (e.year ? " (" + e.year + ")" : ""))) + "</div>") + "</div></div>"
      + '<div class="grid grid-2"><div class="card"><h3>Projects</h3>' + list(p.projects, (e) => '<div class="list-item"><strong>' + esc(e.name || "") + "</strong>" + (e.description ? "<div>" + esc(e.description) + "</div>" : "") + "</div>") + "</div>"
      + '<div class="card"><h3>Certifications</h3>' + list(p.certifications, (e) => '<div class="list-item">' + esc(typeof e === "string" ? e : (e.name || "")) + "</div>") + '<h3 style="margin-top:16px">Links</h3><p class="small">' + [p.linkedin, p.github, p.portfolio].filter(Boolean).map((l) => '<a href="' + esc(l) + '" target="_blank" rel="noopener">' + esc(l) + "</a>").join("<br>") + "</p></div></div>"
      + '<div class="card"><h3>Add structured entries</h3><p class="muted">Use simple one-line formats. Experience: Title | Employer | Dates | Description. Education: Qualification, Institution, Year. Project: Name: Description. Certification: Name.</p>'
      + '<div class="form-2">'
      + fieldHtml("Add experience", '<input class="input" id="add-exp" placeholder="Data Analyst | Acme | 2023 - 2025 | Built dashboards">')
      + fieldHtml("Add education", '<input class="input" id="add-edu" placeholder="BSc Statistics, University of Lagos, 2022">')
      + fieldHtml("Add project", '<input class="input" id="add-proj" placeholder="Sales dashboard: Power BI report for retail data">')
      + fieldHtml("Add certification", '<input class="input" id="add-cert" placeholder="Google Data Analytics">')
      + '</div><div class="btn-row"><button class="btn btn-primary" id="b-add-entries">Add entries</button></div><div class="form-error" id="e-add"></div></div>';
    app.innerHTML = appLayout("Career Profile", html, "profile");
    bindShell();
    document.getElementById("b-add-entries").addEventListener("click", async () => {
      const exp = document.getElementById("add-exp").value.trim();
      const edu = document.getElementById("add-edu").value.trim();
      const proj = document.getElementById("add-proj").value.trim();
      const cert = document.getElementById("add-cert").value.trim();
      const body = Object.assign({}, p);
      delete body.id; delete body.createdAt; delete body.updatedAt;
      if (exp) { const parts = exp.split("|").map((s) => s.trim()); body.experience = (body.experience || []).concat([{ title: parts[0] || "", employer: parts[1] || "", dates: parts[2] || "", description: parts[3] || "" }]); }
      if (edu) body.education = (body.education || []).concat([edu]);
      if (proj) { const i = proj.indexOf(":"); body.projects = (body.projects || []).concat([{ name: i > 0 ? proj.slice(0, i).trim() : proj, description: i > 0 ? proj.slice(i + 1).trim() : "" }]); }
      if (cert) body.certifications = (body.certifications || []).concat([cert]);
      try { await api("/api/me/profile", { method: "POST", body: JSON.stringify(body) }); toast("Entries added.", "success"); pageProfile(); }
      catch (e) { document.getElementById("e-add").textContent = e.message; }
    });
  } catch (e) {
    app.innerHTML = appLayout("Career Profile", alertBox("danger", esc(e.message)), "profile");
    bindShell();
  }
}

/* ---------- CV ---------- */
async function pageCv() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("CV", '<div class="card">Loading…</div>', "cv");
  bindShell();
  let cvs = [];
  try { cvs = (await api("/api/me/cv")).cvs; } catch (e) { /* ignore */ }
  let html = '<div class="card"><h3>Upload your CV</h3><p class="muted">PDF or DOCX, up to 10 MB. We extract your details into a structured profile for your review.</p>'
    + '<form id="f-cv"><label class="drop" for="cv-file">' + icon("upload") + '<div><strong>Choose a file</strong> or drag it here</div><div class="small muted">PDF, DOCX</div></label>'
    + '<input type="file" id="cv-file" name="cv" accept=".pdf,.docx" style="display:none"><div class="form-error" id="e-cv"></div>'
    + '<div class="btn-row"><button class="btn btn-primary" type="submit">Upload and parse</button></div></form></div>';
  if (cvs.length) {
    const latest = cvs[0];
    html += '<div class="card"><h3>Extracted profile (latest upload)</h3><p class="muted">Review carefully. Nothing is changed silently; confirm to merge into your career profile.</p>'
      + "<dl class=\"kv\"><dt>Name</dt><dd>" + esc(latest.parsed.name || "Not detected") + "</dd><dt>Email</dt><dd>" + esc(latest.parsed.email || "Not detected") + "</dd>"
      + "<dt>Phone</dt><dd>" + esc(latest.parsed.phone || "Not detected") + "</dd><dt>Word count</dt><dd>" + esc(String(latest.parsed.wordCount)) + "</dd>"
      + "<dt>Skills detected</dt><dd>" + (latest.parsed.skills || []).map((s) => badge(s.label, "blue")).join(" ") + "</dd></dl>"
      + ((latest.parsed.uncertain || []).length ? alertBox("warn", esc(latest.parsed.uncertain.join(" "))) : "")
      + '<div class="btn-row"><button class="btn btn-accent" id="b-merge">Confirm and merge into profile</button></div></div>';
  }
  html += '<div class="card"><h3>CV review and Readiness Score</h3><p class="muted">Free analysis with category scores, strengths, weaknesses and recommendations.</p>'
    + '<div class="btn-row"><button class="btn btn-outline" id="b-review">Run CV review</button><button class="btn btn-outline" id="b-ready">Get Readiness Score</button></div><div id="review-out" style="margin-top:16px"></div></div>';
  app.innerHTML = appLayout("CV", html, "cv");
  bindShell();

  document.getElementById("f-cv").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("cv-file").files[0];
    if (!file) { document.getElementById("e-cv").textContent = "Please choose a file first."; return; }
    const fd = new FormData();
    fd.append("cv", file);
    document.getElementById("e-cv").textContent = "";
    try {
      await api("/api/me/cv/upload", { method: "POST", body: fd });
      toast("CV uploaded and parsed.", "success");
      pageCv();
    } catch (ex) { document.getElementById("e-cv").textContent = ex.message; }
  });
  const merge = document.getElementById("b-merge");
  if (merge) merge.addEventListener("click", async () => {
    try { await api("/api/me/cv/" + cvs[0].id + "/apply", { method: "POST", body: "{}" }); toast("Profile updated from CV.", "success"); location.hash = "#/profile"; }
    catch (e) { toast(e.message, "error"); }
  });
  document.getElementById("b-review").addEventListener("click", async () => {
    const out = document.getElementById("review-out");
    loadingInto(out, "Reviewing your CV…");
    try {
      const d = await api("/api/me/cv/review");
      const r = d.review;
      out.innerHTML = '<div class="score-wrap">' + scoreRing(r.overall) + "<div><h3>Overall: " + r.overall + " / 100</h3><p class=\"muted\">Category scores and actions below.</p></div></div>"
        + '<h4>Category scores</h4>' + Object.keys(r.categories).map((k) => '<div style="margin-bottom:8px"><div class="small"><strong>' + esc(k) + "</strong>: " + r.categories[k] + '</div><div class="progress"><div style="width:' + r.categories[k] + '%"></div></div></div>').join("")
        + '<div class="grid grid-2" style="margin-top:12px"><div><h4>Strengths</h4><ul class="clean">' + (r.strengths.map((s) => "<li>" + esc(s) + "</li>").join("") || "<li>Keep building; run the review again after improvements.</li>") + "</ul></div>"
        + "<div><h4>Areas to strengthen</h4><ul class=\"clean\">" + (r.weaknesses.map((s) => "<li>" + esc(s) + "</li>").join("") || "<li>None flagged.</li>") + "</ul></div></div>"
        + "<h4>Recommendations</h4><ul class=\"clean\">" + r.recommendations.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>"
        + (r.missing.length ? "<h4>Missing information</h4><ul class=\"clean\">" + r.missing.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>" : "")
        + disclaimerBox(r.disclaimer);
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
  document.getElementById("b-ready").addEventListener("click", async () => {
    const out = document.getElementById("review-out");
    loadingInto(out, "Computing your Readiness Score…");
    try {
      const d = await api("/api/me/readiness");
      const r = d.readiness;
      out.innerHTML = '<div class="score-wrap">' + scoreRing(r.score) + "<div><h3>Readiness Score: " + r.score + "</h3><p>" + badge(r.band, "navy") + "</p></div></div>"
        + '<h4>Why this score</h4><div class="table-wrap"><table class="table"><thead><tr><th>Factor</th><th>Weight</th><th>Score</th><th>Explanation</th></tr></thead><tbody>'
        + r.factors.map((f) => "<tr><td><strong>" + esc(f.name) + "</strong></td><td>" + esc(f.weight) + "</td><td>" + f.score + "</td><td>" + esc(f.why) + "</td></tr>").join("") + "</tbody></table></div>"
        + "<h4>Top actions</h4><ul class=\"clean\">" + r.topActions.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>"
        + disclaimerBox(r.disclaimer);
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
}

/* ---------- Jobs ---------- */
async function pageJobs() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  app.innerHTML = appLayout("Jobs", '<div class="card">Loading…</div>', "jobs");
  bindShell();
  let recs = [], jobs = [];
  try {
    const d = await api("/api/me/jobs/recommended");
    recs = d.recommendations;
    jobs = (await api("/api/me/jobs")).jobs;
  } catch (e) {
    app.innerHTML = appLayout("Jobs", alertBox("danger", esc(e.message)) + '<p><a href="#/onboarding">Complete your profile</a> to unlock recommendations.</p>', "jobs");
    bindShell();
    return;
  }
  const html = '<div class="card"><h3>Recommended for you</h3><p class="muted">Based on your profile, CV, target roles and preferences. Match scores are advisory, not eligibility guarantees.</p>'
    + (recs.length ? recs.map((r) =>
      '<div class="list-item"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong>' + esc(r.job.title) + "</strong> <span class=\"muted\">at " + esc(r.job.employer) + "</span><div class=\"small muted\">" + esc(r.job.location || "") + (r.job.workArrangement ? " · " + esc(r.job.workArrangement) : "") + (r.job.seniority ? " · " + esc(r.job.seniority) : "") + '</div><div class="small muted">Source: ' + esc(r.job.source || "Platform") + " (" + esc(r.job.sourceTrust || "Unknown source") + ")</div></div>"
      + "<div>" + badge(r.matchScore + " / 100", r.matchScore >= 70 ? "green" : r.matchScore >= 45 ? "blue" : "gray") + "</div></div>"
      + '<div class="small" style="margin-top:8px"><strong>Why it matches:</strong> ' + (r.whyItMatches.map(esc).join(", ") || "General alignment") + "</div>"
      + '<div class="small"><strong>Potential weaknesses:</strong> ' + (r.potentialWeaknesses.map(esc).join(", ") || "None flagged") + "</div>"
      + '<details class="small" style="margin-top:6px"><summary>View description</summary><p>' + esc(r.job.description || "") + "</p></details></div>"
    ).join("") : emptyState("briefcase", "No jobs available", "Job listings will appear here as sources are connected. You can still analyze any job description below."))
    + "</div>"
    + '<div class="card"><h3>Analyze a job description</h3><p class="muted">Paste any description for match analysis, eligibility signals and recommended actions.</p>'
    + fieldHtml("Job description", '<textarea class="textarea" id="job-text" placeholder="Paste the full job description here…"></textarea>')
    + '<div class="btn-row"><button class="btn btn-primary" id="b-analyze">Analyze this job</button></div><div id="job-out" style="margin-top:14px"></div></div>'
    + '<div class="card"><h3>Job Safety Advisor</h3><p class="muted">Paste a job message or description to check for common risk indicators.</p>'
    + fieldHtml("Message to review", '<textarea class="textarea" id="safe-text" style="min-height:90px" placeholder="Paste the message here…"></textarea>')
    + '<div class="btn-row"><button class="btn btn-outline" id="b-safe">Check for risk indicators</button></div><div id="safe-out" style="margin-top:14px"></div></div>';
  app.innerHTML = appLayout("Jobs", html, "jobs");
  bindShell();
  document.getElementById("b-analyze").addEventListener("click", async () => {
    const out = document.getElementById("job-out");
    const text = document.getElementById("job-text").value;
    loadingInto(out, "Analyzing job…");
    try {
      const d = await api("/api/me/jobs/analyze", { method: "POST", body: JSON.stringify({ jobText: text }) });
      const m = d.match, el = d.eligibility;
      out.innerHTML = '<div class="score-wrap">' + scoreRing(m.score, 90) + "<div><h3>" + esc(m.band) + "</h3><p class=\"muted\">" + esc(el.verdict) + (m.seniority ? " · " + esc(m.seniority) : "") + "</p></div></div>"
        + '<div class="grid grid-2" style="margin-top:10px"><div><h4>Strong matches</h4><p>' + (m.strongMatches.map((s) => badge(s, "green")).join(" ") || "None") + "</p></div>"
        + "<div><h4>Missing requirements</h4><p>" + (m.missingRequirements.map((s) => badge(s, "red")).join(" ") || "None") + "</p></div></div>"
        + "<p><strong>Experience:</strong> " + esc(m.experienceNote) + "</p>"
        + (m.potentialConcerns.length ? "<h4>Potential concerns</h4><ul class=\"clean\">" + m.potentialConcerns.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>" : "")
        + "<h4>Recommended actions</h4><ul class=\"clean\">" + m.recommendedActions.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>"
        + "<h4>Eligibility signals</h4><ul class=\"clean\">" + el.factors.map((f) => "<li><strong>" + esc(f.name) + ":</strong> " + esc(f.detail) + "</li>").join("") + "</ul>"
        + disclaimerBox(m.disclaimer) + disclaimerBox(el.disclaimer);
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
  document.getElementById("b-safe").addEventListener("click", async () => {
    const out = document.getElementById("safe-out");
    const text = document.getElementById("safe-text").value;
    loadingInto(out, "Checking…");
    try {
      const d = await api("/api/me/safety", { method: "POST", body: JSON.stringify({ jobText: text }) });
      out.innerHTML = "<h3>" + badge(d.level, d.indicators.length ? "red" : "green") + " " + esc(d.headline) + "</h3>"
        + (d.indicators.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Indicator</th><th>Severity</th><th>Explanation</th></tr></thead><tbody>'
          + d.indicators.map((i) => "<tr><td><strong>" + esc(i.indicator) + "</strong></td><td>" + statusBadge(i.severity) + "</td><td>" + esc(i.explanation) + "</td></tr>").join("") + "</tbody></table></div>" : "")
        + "<h4>Stay safe</h4><ul class=\"clean\">" + d.guidance.map((g) => "<li>" + esc(g) + "</li>").join("") + "</ul>"
        + disclaimerBox(d.disclaimer);
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
}

/* ---------- Skills ---------- */
async function pageSkills() {
  if (!guardVerified()) return;
  const app = document.getElementById("app");
  const html = '<div class="card"><h3>Required Skills Finder</h3><p class="muted">Enter any role to see the skills employers commonly request, compared against your evidence.</p>'
    + fieldHtml("Role title", '<input class="input" id="skill-role" placeholder="Data Analyst" list="role-list"><datalist id="role-list"></datalist>')
    + '<div class="btn-row"><button class="btn btn-primary" id="b-finder">Find required skills</button><button class="btn btn-outline" id="b-gap">Run skill gap analysis</button></div><div id="skills-out" style="margin-top:14px"></div></div>';
  app.innerHTML = appLayout("Skills", html, "skills");
  bindShell();
  document.getElementById("b-finder").addEventListener("click", async () => {
    const out = document.getElementById("skills-out");
    const role = document.getElementById("skill-role").value;
    loadingInto(out, "Finding required skills…");
    try {
      const d = await api("/api/me/skills/finder", { method: "POST", body: JSON.stringify({ role }) });
      if (!d.found) { out.innerHTML = alertBox("warn", esc(d.message)) + "<p>Try: " + d.suggestions.map(esc).join(", ") + "</p>"; return; }
      out.innerHTML = "<h3>" + esc(d.role) + "</h3><p class=\"muted\">" + esc(d.education) + " " + esc(d.experience) + "</p>"
        + '<div class="table-wrap"><table class="table"><thead><tr><th>Skill</th><th>Demand</th><th>Priority</th><th>Your evidence</th><th>Status</th></tr></thead><tbody>'
        + d.rows.map((r) => "<tr><td><strong>" + esc(r.skill) + "</strong><div class=\"small muted\">" + esc(r.category) + "</div></td><td>" + esc(r.demand) + "</td><td>" + esc(r.priority) + "</td><td>" + esc(r.yourEvidence) + "</td><td>" + statusBadge(r.status) + "</td></tr>").join("")
        + "</tbody></table></div>"
        + "<p><strong>Common tools:</strong> " + d.tools.map(esc).join(", ") + "</p>"
        + (d.certifications.length ? "<p><strong>Valued certifications:</strong> " + d.certifications.map(esc).join(", ") + "</p>" : "");
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
  document.getElementById("b-gap").addEventListener("click", async () => {
    const out = document.getElementById("skills-out");
    const role = document.getElementById("skill-role").value;
    loadingInto(out, "Analyzing skill gaps…");
    try {
      const d = await api("/api/me/skills/gap", { method: "POST", body: JSON.stringify({ role }) });
      if (!d.found) { out.innerHTML = alertBox("warn", esc(d.message || "Role not found.")); return; }
      out.innerHTML = "<h3>Skill gap: " + esc(d.role) + "</h3>"
        + '<div class="grid grid-3">'
        + '<div class="stat"><div class="label">Strong</div><div class="value" style="color:var(--accent)">' + d.strong.length + "</div></div>"
        + '<div class="stat"><div class="label">Weak</div><div class="value" style="color:var(--warn)">' + d.weak.length + "</div></div>"
        + '<div class="stat"><div class="label">Missing</div><div class="value" style="color:var(--danger)">' + d.missing.length + "</div></div></div>"
        + '<div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Skill</th><th>Status</th><th>Evidence</th></tr></thead><tbody>'
        + d.missing.concat(d.weak).map((r) => "<tr><td><strong>" + esc(r.skill) + "</strong></td><td>" + statusBadge(r.status) + "</td><td>" + esc(r.yourEvidence) + "</td></tr>").join("") + "</tbody></table></div>"
        + "<h4>Recommended learning</h4><ul class=\"clean\">" + d.recommendedLearning.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>"
        + "<h4>Recommended projects</h4><ul class=\"clean\">" + d.recommendedProjects.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ul>";
    } catch (e) { out.innerHTML = alertBox("danger", esc(e.message)); }
  });
}
