"use strict";
/* Admin dashboard with RBAC aware tabs. */

function guardAdmin() {
  if (!S.user) { location.hash = "#/signin"; return false; }
  if (!["admin", "support", "editor"].includes(S.user.role)) { location.hash = "#/dashboard"; return false; }
  return true;
}

const ADMIN_TABS = [
  ["overview", "Overview"], ["users", "Users"], ["products", "Products"],
  ["docproducts", "Documents"], ["purchases", "Purchases"], ["subs", "Subscriptions"],
  ["emails", "Emails"], ["jobs", "Jobs"], ["privacy", "Privacy"],
  ["support", "Support"], ["audit", "Audit"], ["flags", "Flags"],
  ["settings", "Settings"], ["legal", "Legal"], ["analytics", "Analytics"]
];

async function pageAdmin(tab) {
  if (!guardVerified() || !guardAdmin()) return;
  tab = tab || "overview";
  const app = document.getElementById("app");
  const tabs = '<div class="tabs">' + ADMIN_TABS.map((t) => '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? "active" : "") + '">' + esc(t[1]) + "</button>").join("") + "</div>";
  app.innerHTML = appLayout("Admin", tabs + '<div id="admin-body"><div class="card">Loading…</div></div>', "admin");
  bindShell();
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => pageAdmin(b.getAttribute("data-tab"))));
  const body = document.getElementById("admin-body");
  const render = {
    overview: async () => {
      const d = await api("/api/admin/overview");
      body.innerHTML = '<div class="grid grid-4">'
        + [["Users", d.users], ["Verified", d.verified], ["CV uploads", d.cvs], ["Purchases", d.purchases], ["Revenue", "$" + Number(d.revenue).toFixed(2)], ["Active subs", d.activeSubs], ["Documents", d.documents], ["Open tickets", d.openTickets], ["Privacy reqs", d.openPrivacy], ["Failed emails", d.failedEmails], ["AI calls", d.ai.total], ["AI cached", d.ai.cached]]
          .map((s) => '<div class="stat"><div class="label">' + s[0] + '</div><div class="value">' + s[1] + "</div></div>").join("") + "</div>";
    },
    users: async () => {
      const d = await api("/api/admin/users");
      body.innerHTML = '<div class="card"><h3>Users (' + d.users.length + ')</h3><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
        + d.users.map((x) => "<tr><td>" + esc(x.name) + "</td><td>" + esc(x.email) + "</td><td>" + esc(x.role) + "</td><td>" + (x.verified ? "Yes" : "No") + "</td><td>" + (x.suspended ? statusBadge("suspended") : statusBadge("active")) + "</td>"
          + "<td><button class=\"btn btn-ghost btn-sm\" data-view=\"" + x.id + "\">View</button> "
          + (x.suspended ? '<button class="btn btn-ghost btn-sm" data-restore="' + x.id + '">Restore</button>' : '<button class="btn btn-ghost btn-sm" data-suspend="' + x.id + '">Suspend</button>') + "</td></tr>").join("")
        + "</tbody></table></div><div id=\"u-detail\"></div></div>";
      body.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", async () => {
        const u = await api("/api/admin/users/" + b.getAttribute("data-view"));
        document.getElementById("u-detail").innerHTML = '<div class="card"><h4>' + esc(u.user.name) + " (" + esc(u.user.email) + ")</h4><p>Purchases: " + u.purchases.length + " · Premium: " + (u.entitlements.premium ? "Yes" : "No") + "</p>"
          + '<div class="form-2">' + fieldHtml("Set role", '<select class="select" id="u-role"><option value="user">user</option><option value="support">support</option><option value="editor">editor</option><option value="admin">admin</option></select>')
          + fieldHtml("Grant entitlement (product key)", '<input class="input" id="u-ent" placeholder="cv_upgrade">') + "</div>"
          + '<div class="btn-row"><button class="btn btn-outline btn-sm" id="u-role-btn">Update role</button><button class="btn btn-outline btn-sm" id="u-ent-btn">Grant</button></div></div>';
        document.getElementById("u-role").value = u.user.role;
        document.getElementById("u-role-btn").addEventListener("click", async () => {
          await api("/api/admin/users/" + u.user.id + "/role", { method: "POST", body: JSON.stringify({ role: document.getElementById("u-role").value }) });
          toast("Role updated.", "success");
        });
        document.getElementById("u-ent-btn").addEventListener("click", async () => {
          await api("/api/admin/users/" + u.user.id + "/entitlement", { method: "POST", body: JSON.stringify({ productKey: document.getElementById("u-ent").value }) });
          toast("Entitlement granted.", "success");
        });
      }));
      body.querySelectorAll("[data-suspend]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Suspend this account?")) return;
        await api("/api/admin/users/" + b.getAttribute("data-suspend") + "/suspend", { method: "POST", body: "{}" });
        toast("Suspended.", "success"); render.users();
      }));
      body.querySelectorAll("[data-restore]").forEach((b) => b.addEventListener("click", async () => {
        await api("/api/admin/users/" + b.getAttribute("data-restore") + "/restore", { method: "POST", body: "{}" });
        toast("Restored.", "success"); render.users();
      }));
    },
    products: async () => {
      const d = await api("/api/admin/products");
      body.innerHTML = '<div class="card"><h3>Products and pricing</h3><div class="table-wrap"><table class="table"><thead><tr><th>Key</th><th>Name</th><th>Price</th><th>Currency</th><th>Active</th><th></th></tr></thead><tbody>'
        + d.products.map((p) => "<tr><td>" + esc(p.key) + '</td><td><input class="input" data-p="name" data-id="' + p.id + '" value="' + esc(p.name) + '"></td><td><input class="input" data-p="price" data-id="' + p.id + '" type="number" step="0.01" value="' + p.price + '"></td><td><input class="input" data-p="currency" data-id="' + p.id + '" value="' + esc(p.currency) + '"></td><td><input type="checkbox" data-p="active" data-id="' + p.id + '" ' + (p.active ? "checked" : "") + '></td><td><button class="btn btn-outline btn-sm" data-save="' + p.id + '">Save</button></td></tr>').join("")
        + "</tbody></table></div></div>";
      body.querySelectorAll("[data-save]").forEach((b) => b.addEventListener("click", async () => {
        const id = b.getAttribute("data-save");
        const get = (k) => body.querySelector('[data-p="' + k + '"][data-id="' + id + '"]');
        await api("/api/admin/products/" + id, { method: "PUT", body: JSON.stringify({ name: get("name").value, price: get("price").value, currency: get("currency").value, active: get("active").checked }) });
        toast("Product saved.", "success");
      }));
    },
    docproducts: async () => {
      const d = await api("/api/admin/doc-products");
      body.innerHTML = '<div class="card"><h3>Upload document product</h3><p class="muted">No code changes needed. Upload a template or deliverable and link it to a product key.</p><form id="f-doc">'
        + '<div class="form-2">' + fieldHtml("Product key", '<input class="input" name="productKey" required placeholder="cv_upgrade">') + fieldHtml("Title", '<input class="input" name="title" required>')
        + fieldHtml("Description", '<input class="input" name="description">') + fieldHtml("File", '<input class="input" type="file" name="file">') + "</div>"
        + '<div class="btn-row"><button class="btn btn-primary" type="submit">Upload</button></div></form></div>'
        + '<div class="card"><h3>Document products</h3>' + (d.items.length ? d.items.map((x) =>
          '<div class="list-item"><strong>' + esc(x.title) + "</strong> " + statusBadge(x.active ? "active" : "inactive") + '<div class="small muted">Product: ' + esc(x.productKey) + " · Version " + x.version + " · Purchases: " + x.purchaseCount + " · Versions kept: " + x.versions.length + "</div>"
          + '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-ver="' + x.id + '">Upload new version</button><button class="btn btn-ghost btn-sm" data-tg="' + x.id + '">Toggle active</button></div></div>'
        ).join("") : '<p class="muted">None yet.</p>') + "</div>";
      document.getElementById("f-doc").addEventListener("submit", async (e) => {
        e.preventDefault();
        await api("/api/admin/doc-products", { method: "POST", body: new FormData(e.target) });
        toast("Document uploaded.", "success"); render.docproducts();
      });
      body.querySelectorAll("[data-tg]").forEach((b) => b.addEventListener("click", async () => {
        await api("/api/admin/doc-products/" + b.getAttribute("data-tg") + "/toggle", { method: "POST", body: "{}" });
        render.docproducts();
      }));
      body.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => {
        modal("<h2>New version</h2><form id=\"f-ver\"><input class=\"input\" type=\"file\" name=\"file\" required><div class=\"btn-row\" style=\"margin-top:12px\"><button class=\"btn btn-primary\" type=\"submit\">Upload version</button></div></form>");
        document.getElementById("f-ver").addEventListener("submit", async (e) => {
          e.preventDefault();
          await api("/api/admin/doc-products/" + b.getAttribute("data-ver") + "/version", { method: "POST", body: new FormData(e.target) });
          closeModal(); toast("Version added.", "success"); render.docproducts();
        });
      }));
    },
    purchases: async () => {
      const d = await api("/api/admin/purchases");
      body.innerHTML = '<div class="card"><h3>Purchases</h3><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Email</th><th>Product</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>'
        + d.purchases.map((p) => "<tr><td>" + fmtDate(p.at) + "</td><td>" + esc(p.email) + "</td><td>" + esc(p.productKey) + "</td><td>" + money(p.amount, p.currency) + "</td><td>" + statusBadge(p.status) + "</td><td>"
          + (p.status === "completed" ? '<button class="btn btn-ghost btn-sm" data-ref="' + p.transactionId + '">Refund</button>' : "") + "</td></tr>").join("")
        + "</tbody></table></div></div>";
      body.querySelectorAll("[data-ref]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Process a refund for this transaction?")) return;
        await api("/api/admin/refund", { method: "POST", body: JSON.stringify({ transactionId: b.getAttribute("data-ref"), reason: "Admin refund" }) });
        toast("Refunded.", "success"); render.purchases();
      }));
    },
    subs: async () => {
      const d = await api("/api/admin/subscriptions");
      body.innerHTML = '<div class="card"><h3>Subscriptions</h3><div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Plan</th><th>Status</th><th>Period end</th><th>Provider</th></tr></thead><tbody>'
        + d.subscriptions.map((s) => "<tr><td>" + esc(s.email) + "</td><td>" + esc(s.plan) + "</td><td>" + statusBadge(s.status) + "</td><td>" + fmtDate(s.currentPeriodEnd) + "</td><td>" + esc(s.provider) + "</td></tr>").join("")
        + "</tbody></table></div></div>";
    },
    emails: async () => {
      const d = await api("/api/admin/emails");
      body.innerHTML = '<div class="card"><h3>Templates</h3>' + d.templates.map((t) =>
        '<div class="list-item"><strong>' + esc(t.name) + "</strong> <span class=\"small muted\">" + esc(t.key) + " · v" + t.version + "</span> " + statusBadge(t.active ? "active" : "inactive")
        + '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-et="' + t.key + '">Edit</button><button class="btn btn-ghost btn-sm" data-ep="' + t.key + '">Preview</button></div></div>'
      ).join("") + '</div><div class="card"><h3>Delivery log</h3><div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>To</th><th>Template</th><th>Status</th><th>Provider</th></tr></thead><tbody>'
        + d.log.map((l) => "<tr><td>" + fmtDate(l.at) + "</td><td>" + esc(l.to) + "</td><td>" + esc(l.templateKey) + "</td><td>" + statusBadge(l.status) + "</td><td>" + esc(l.provider) + "</td></tr>").join("")
        + "</tbody></table></div></div>";
      body.querySelectorAll("[data-ep]").forEach((b) => b.addEventListener("click", async () => {
        const p = await api("/api/admin/emails/" + b.getAttribute("data-ep") + "/preview");
        modal("<h2>" + esc(p.subject) + "</h2><div>" + p.html + '</div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">Close</button></div>');
      }));
      body.querySelectorAll("[data-et]").forEach((b) => b.addEventListener("click", async () => {
        const key = b.getAttribute("data-et");
        const t = d.templates.find((x) => x.key === key);
        modal("<h2>Edit: " + esc(t.name) + "</h2>"
          + fieldHtml("Subject", '<input class="input" id="et-sub" value="' + esc(t.subject) + '">')
          + fieldHtml("Body (HTML, supports {{name}}, {{product}}, {{amount}}, {{date}}, {{txn}}, {{actionUrl}}, {{message}})", '<textarea class="textarea" id="et-body">' + esc(t.body) + "</textarea>")
          + '<label class="check-row"><input type="checkbox" id="et-active" ' + (t.active ? "checked" : "") + "> <span>Active</span></label>"
          + '<div class="btn-row"><button class="btn btn-primary" id="et-save">Save</button></div>');
        document.getElementById("et-save").addEventListener("click", async () => {
          await api("/api/admin/emails/" + key, { method: "PUT", body: JSON.stringify({ subject: document.getElementById("et-sub").value, body: document.getElementById("et-body").value, active: document.getElementById("et-active").checked }) });
          closeModal(); toast("Template saved.", "success");
        });
      }));
    },
    jobs: async () => {
      const d = await api("/api/admin/jobs");
      body.innerHTML = '<div class="card"><h3>Add job</h3><form id="f-job"><div class="form-2">'
        + fieldHtml("Title", '<input class="input" name="title" required>') + fieldHtml("Employer", '<input class="input" name="employer">')
        + fieldHtml("Location", '<input class="input" name="location">') + fieldHtml("Arrangement", '<input class="input" name="workArrangement" placeholder="Remote">')
        + fieldHtml("Seniority", '<input class="input" name="seniority">') + fieldHtml("Salary", '<input class="input" name="salary">') + "</div>"
        + fieldHtml("Description", '<textarea class="textarea" name="description"></textarea>')
        + '<div class="btn-row"><button class="btn btn-primary" type="submit">Add job</button></div></form></div>'
        + '<div class="card"><h3>Jobs (' + d.jobs.length + ')</h3>' + d.jobs.map((j) =>
          '<div class="list-item"><strong>' + esc(j.title) + "</strong> <span class=\"muted\">at " + esc(j.employer) + "</span> " + statusBadge(j.active ? "active" : "inactive")
          + '<div class="small muted">' + esc(j.source || "") + "</div><button class=\"btn btn-ghost btn-sm\" data-jt=\"" + j.id + "\">Toggle</button></div>"
        ).join("") + "</div>";
      document.getElementById("f-job").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        await api("/api/admin/jobs", { method: "POST", body: JSON.stringify({ title: f.get("title"), employer: f.get("employer"), location: f.get("location"), workArrangement: f.get("workArrangement"), seniority: f.get("seniority"), salary: f.get("salary"), description: f.get("description") }) });
        toast("Job added.", "success"); render.jobs();
      });
      body.querySelectorAll("[data-jt]").forEach((b) => b.addEventListener("click", async () => {
        await api("/api/admin/jobs/" + b.getAttribute("data-jt") + "/toggle", { method: "POST", body: "{}" });
        render.jobs();
      }));
    },
    privacy: async () => {
      const d = await api("/api/admin/privacy");
      body.innerHTML = '<div class="card"><h3>Privacy requests (' + d.requests.length + ')</h3><div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Type</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>'
        + d.requests.map((r) => "<tr><td>" + esc(r.email) + "</td><td>" + esc(r.type) + "</td><td>" + statusBadge(r.status) + "</td><td>" + fmtDate(r.createdAt) + "</td><td>"
          + '<select class="select" data-pr="' + r.id + '"><option value="open">open</option><option value="in_review">in_review</option><option value="completed">completed</option><option value="rejected">rejected</option></select></td></tr>').join("")
        + "</tbody></table></div><p class=\"muted\">Visible marketplace profiles: " + d.marketplace + "</p></div>";
      body.querySelectorAll("[data-pr]").forEach((s) => {
        const row = d.requests.find((r) => r.id === s.getAttribute("data-pr"));
        s.value = row.status;
        s.addEventListener("change", async () => {
          await api("/api/admin/privacy/" + s.getAttribute("data-pr"), { method: "POST", body: JSON.stringify({ status: s.value }) });
          toast("Request updated.", "success");
        });
      });
    },
    support: async () => {
      const d = await api("/api/admin/support");
      body.innerHTML = '<div class="card"><h3>Support tickets</h3>' + (d.tickets.length ? d.tickets.map((t) =>
        '<div class="list-item"><strong>' + esc(t.subject) + "</strong> " + statusBadge(t.status) + '<div class="small muted">' + esc(t.email) + " · " + esc(t.category) + " · " + fmtDate(t.createdAt) + "</div><div>" + esc(t.message) + "</div>"
        + '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-tr="' + t.id + '">Reply / update</button></div></div>'
      ).join("") : '<p class="muted">No tickets.</p>') + "</div>";
      body.querySelectorAll("[data-tr]").forEach((b) => b.addEventListener("click", () => {
        const t = d.tickets.find((x) => x.id === b.getAttribute("data-tr"));
        modal("<h2>Ticket</h2><p><strong>" + esc(t.subject) + "</strong></p><p>" + esc(t.message) + "</p>"
          + fieldHtml("Status", '<select class="select" id="tk-status"><option value="open">open</option><option value="in_review">in_review</option><option value="resolved">resolved</option></select>')
          + fieldHtml("Reply", '<textarea class="textarea" id="tk-reply">' + esc(t.reply || "") + "</textarea>")
          + '<div class="btn-row"><button class="btn btn-primary" id="tk-save">Save</button></div>');
        document.getElementById("tk-status").value = t.status;
        document.getElementById("tk-save").addEventListener("click", async () => {
          await api("/api/admin/support/" + t.id, { method: "POST", body: JSON.stringify({ status: document.getElementById("tk-status").value, reply: document.getElementById("tk-reply").value }) });
          closeModal(); toast("Saved.", "success"); render.support();
        });
      }));
    },
    audit: async () => {
      const d = await api("/api/admin/audit");
      body.innerHTML = '<div class="card"><h3>Audit log</h3><div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody>'
        + d.log.map((l) => "<tr><td>" + fmtDate(l.createdAt) + "</td><td>" + esc(l.actorType) + "</td><td>" + esc(l.action) + "</td><td class=\"small\">" + esc((l.details || "").slice(0, 120)) + "</td></tr>").join("")
        + "</tbody></table></div></div>";
    },
    flags: async () => {
      const d = await api("/api/admin/flags");
      body.innerHTML = '<div class="card"><h3>Feature flags</h3>' + d.flags.map((f) =>
        '<div class="check-row"><input type="checkbox" data-flag="' + f.key + '" ' + (f.enabled ? "checked" : "") + ' id="f-' + f.key + '"> <span><label for="f-' + f.key + '"><strong>' + esc(f.key) + "</strong></label></span></div>"
      ).join("") + "</div>";
      body.querySelectorAll("[data-flag]").forEach((cb) => cb.addEventListener("change", async () => {
        await api("/api/admin/flags", { method: "POST", body: JSON.stringify({ key: cb.getAttribute("data-flag"), enabled: cb.checked }) });
        toast("Flag updated.", "success");
      }));
    },
    settings: async () => {
      const d = await api("/api/admin/settings");
      const b = d.branding || {};
      body.innerHTML = '<div class="card"><h3>Branding</h3><div class="form-2">'
        + fieldHtml("Product name", '<input class="input" id="s-name" value="' + esc(b.name || "") + '">')
        + fieldHtml("Support email", '<input class="input" id="s-email" value="' + esc(b.supportEmail || "") + '">')
        + fieldHtml("Company name", '<input class="input" id="s-company" value="' + esc(b.companyName || "") + '">')
        + fieldHtml("Company address", '<input class="input" id="s-addr" value="' + esc(b.companyAddress || "") + '">') + "</div>"
        + fieldHtml("Policy version", '<input class="input" id="s-policy" value="' + esc(d.policy_version) + '">')
        + fieldHtml("AI provider", '<select class="select" id="s-ai"><option value="local">local (built-in)</option><option value="openai">openai-compatible</option></select>')
        + '<div class="btn-row"><button class="btn btn-primary" id="s-save">Save settings</button></div></div>'
        + '<div class="card"><h3>Payments</h3><p class="muted">Provider: ' + esc(d.payments.provider) + " · Mode: " + esc(d.payments.mode) + " · Stripe configured: " + (d.payments.stripeConfigured ? "Yes" : "No") + '</p><p class="muted">Secrets are configured through environment variables and never displayed here.</p></div>'
        + '<div class="card"><h3>Subprocessors</h3><div class="table-wrap"><table class="table"><thead><tr><th>Provider</th><th>Purpose</th><th>Data</th><th>Location</th></tr></thead><tbody>'
        + d.subprocessors.map((s) => "<tr><td>" + esc(s.provider) + "</td><td>" + esc(s.purpose) + "</td><td>" + esc(s.data) + "</td><td>" + esc(s.location) + "</td></tr>").join("")
        + "</tbody></table></div></div>";
      document.getElementById("s-ai").value = d.ai_provider;
      document.getElementById("s-save").addEventListener("click", async () => {
        await api("/api/admin/settings", { method: "POST", body: JSON.stringify({ branding: { name: document.getElementById("s-name").value, supportEmail: document.getElementById("s-email").value, companyName: document.getElementById("s-company").value, companyAddress: document.getElementById("s-addr").value }, policy_version: document.getElementById("s-policy").value, ai_provider: document.getElementById("s-ai").value }) });
        toast("Settings saved.", "success");
      });
    },
    legal: async () => {
      const d = await api("/api/admin/legal");
      body.innerHTML = '<div class="card"><h3>Legal documents</h3><p class="muted">Drafts requiring review by qualified legal counsel before production launch.</p>'
        + d.docs.map((x) => '<div class="list-item"><strong>' + esc(x.title) + "</strong> <span class=\"small muted\">v" + x.version + '</span><div class="btn-row"><button class="btn btn-ghost btn-sm" data-le="' + x.key + '">Edit</button></div></div>').join("") + "</div>";
      body.querySelectorAll("[data-le]").forEach((b) => b.addEventListener("click", () => {
        const x = d.docs.find((y) => y.key === b.getAttribute("data-le"));
        modal("<h2>" + esc(x.title) + "</h2>" + fieldHtml("Title", '<input class="input" id="lg-title" value="' + esc(x.title) + '">')
          + fieldHtml("Body (HTML)", '<textarea class="textarea" id="lg-body">' + esc(x.body) + "</textarea>")
          + '<div class="btn-row"><button class="btn btn-primary" id="lg-save">Save new version</button></div>');
        document.getElementById("lg-save").addEventListener("click", async () => {
          await api("/api/admin/legal/" + x.key, { method: "PUT", body: JSON.stringify({ title: document.getElementById("lg-title").value, body: document.getElementById("lg-body").value }) });
          closeModal(); toast("Saved.", "success");
        });
      }));
    },
    analytics: async () => {
      const d = await api("/api/admin/analytics");
      body.innerHTML = '<div class="grid grid-4">'
        + [["Signups", d.signups], ["Verification %", d.verificationRate], ["CV uploads", d.cvUploads], ["Analyses", d.analyses], ["Job analyses", d.jobAnalyses], ["Purchases", d.purchases], ["Active subs", d.activeSubs], ["Documents", d.documents], ["Emails sent", d.emails.sent], ["Emails failed", d.emails.failed], ["Errors", d.errors], ["AI calls", d.ai.total]]
          .map((s) => '<div class="stat"><div class="label">' + s[0] + '</div><div class="value">' + s[1] + "</div></div>").join("") + "</div>";
    }
  };
  try {
    if (render[tab]) await render[tab]();
    else body.innerHTML = '<div class="card">Unknown section.</div>';
  } catch (e) {
    body.innerHTML = alertBox("danger", esc(e.message));
  }
}
