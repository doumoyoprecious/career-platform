"use strict";
/* Core: icons, API client, state, UI helpers, layouts. */

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.7c2.8.3 5 2 5 4.3"/>',
  file: '<path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/>',
  briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 13h19"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/>',
  mic: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  shield: '<path d="M12 2l8 3.5V11c0 5-3.4 8.7-8 11-4.6-2.3-8-6-8-11V5.5L12 2z"/><path d="M9 12l2 2 4-4.5"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95A7 7 0 0 0 14.1 4.1L13.75 1.7h-3.5L9.9 4.1a7 7 0 0 0-2.42 1.42l-2.35-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.35-.95a7 7 0 0 0 2.41 1.42l.36 2.4h3.5l.35-2.4a7 7 0 0 0 2.42-1.42l2.35.95 2-3.46-2-1.55c.1-.45.14-.92.14-1.4z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13"/>',
  download: '<path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16"/>',
  upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 20h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  filter: '<path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"/>',
  alert: '<path d="M12 3l10 17H2L12 3z"/><path d="M12 10v4m0 3.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8.5v.5"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 3z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6z"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 22l5-2.5L17 22l-1.5-8.5"/>',
  message: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2-2.4 3.3m0 3v.5"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.5 11.5L21 2m-3 3l2.5 2.5M16 6l2 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  tag: '<path d="M3 12V4h8l9 9-8 7-9-8z"/><circle cx="8" cy="9" r="1.4"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7l10-5z"/><path d="M2 12l10 5 10-5M2 17l10 5 10-5"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.5M7 16.5h.5"/>',
  flag: '<path d="M5 22V4"/><path d="M5 4h13l-2.5 4L18 12H5"/>',
  external: '<path d="M14 4h6v6M20 4L10 14"/><path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/>'
};

function icon(name, cls) {
  return '<svg class="' + (cls || "icon") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + "</svg>";
}

/* State + API */
const S = { user: null, csrf: null, brand: { name: "CareerSignal" }, products: [], payments: null };

async function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {});
  if (S.csrf && (opts.method === "POST" || opts.method === "PUT" || opts.method === "DELETE" || opts.method === "PATCH")) {
    headers["x-csrf-token"] = S.csrf;
  }
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const r = await fetch(path, Object.assign({ credentials: "same-origin" }, opts, { headers }));
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("json") ? await r.json().catch(() => ({})) : await r.text();
  if (!r.ok) {
    const err = new Error((data && data.error) || ("Request failed (" + r.status + ")"));
    err.status = r.status; err.code = data && data.code; err.product = data && data.product;
    throw err;
  }
  return data;
}

function esc(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function money(amount, currency) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(Number(amount));
  } catch (e) { return (currency || "USD") + " " + Number(amount).toFixed(2); }
}

function fmtDate(iso) {
  if (!iso) return "Not set";
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch (e) { return String(iso); }
}

function toast(msg, kind) {
  const box = document.getElementById("toasts");
  const d = document.createElement("div");
  d.className = "toast " + (kind || "");
  d.innerHTML = icon(kind === "error" ? "xCircle" : kind === "success" ? "checkCircle" : "info", "icon-sm") + "<span>" + esc(msg) + "</span>";
  box.appendChild(d);
  setTimeout(() => { d.style.opacity = "0"; setTimeout(() => d.remove(), 300); }, 4200);
}

function modal(html) {
  const root = document.getElementById("modal-root");
  root.innerHTML = '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">' + html + "</div></div>";
  root.querySelector(".modal-backdrop").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) closeModal();
  });
  document.addEventListener("keydown", escClose);
}
function escClose(e) { if (e.key === "Escape") closeModal(); }
function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  document.removeEventListener("keydown", escClose);
}

function scoreRing(score, size) {
  size = size || 110;
  const r = 46, c = 2 * Math.PI * r;
  const color = score >= 75 ? "#1f7a5c" : score >= 55 ? "#175cd3" : score >= 35 ? "#92690e" : "#b42318";
  return '<svg class="score-ring" width="' + size + '" height="' + size + '" viewBox="0 0 110 110" role="img" aria-label="Score ' + score + ' out of 100">'
    + '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="#e6ebf2" stroke-width="11"/>'
    + '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1)
    + '" stroke-dashoffset="' + (c * (1 - score / 100)).toFixed(1) + '" transform="rotate(-90 55 55)"/>'
    + '<text x="55" y="52" text-anchor="middle" font-size="26" font-weight="800" fill="#0f2a44">' + score + "</text>"
    + '<text x="55" y="70" text-anchor="middle" font-size="11" fill="#5b6b83">/ 100</text></svg>';
}

function badge(text, color) {
  return '<span class="badge b-' + (color || "gray") + '">' + esc(text) + "</span>";
}

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (["ready", "active", "succeeded", "completed", "delivered", "sent"].includes(s)) return badge(status, "green");
  if (["pending", "open", "in_review", "queued"].includes(s)) return badge(status, "amber");
  if (["failed", "revoked", "canceled", "refunded", "bounced", "complained"].includes(s)) return badge(status, "red");
  return badge(status || "Unknown", "gray");
}

function alertBox(kind, text) {
  const ic = kind === "danger" ? "alert" : kind === "warn" ? "alert" : kind === "success" ? "checkCircle" : "info";
  return '<div class="alert alert-' + kind + '">' + icon(ic, "icon-sm") + "<span>" + text + "</span></div>";
}

function emptyState(ic, title, text, actionHtml) {
  return '<div class="empty"><div class="icon-badge">' + icon(ic, "icon") + "</div><h3>" + esc(title) + "</h3><p>" + esc(text) + "</p>" + (actionHtml || "") + "</div>";
}

function disclaimerBox(text) {
  return '<div class="alert alert-info">' + icon("info", "icon-sm") + "<span><strong>Please note:</strong> " + esc(text) + "</span></div>";
}

function loadingInto(el, text) {
  el.innerHTML = '<div class="card"><div class="boot" style="min-height:120px"><div class="spinner"></div><p>' + esc(text || "Working…") + "</p></div></div>";
}

function fieldHtml(label, inner, hint) {
  return '<div class="field"><label>' + esc(label) + "</label>" + inner + (hint ? '<div class="hint">' + esc(hint) + "</div>" : "") + "</div>";
}

/* Layouts */
function publicLayout(content, active) {
  const u = S.user;
  return '<header class="topbar"><div class="topbar-inner">'
    + '<a class="brand" href="#/"><span class="brand-mark">' + icon("chart", "icon-sm") + "</span>" + esc(S.brand.name) + "</a>"
    + '<nav class="nav-links" aria-label="Primary">'
    + '<a href="#/pricing" class="' + (active === "pricing" ? "active" : "") + '">Pricing</a>'
    + '<a href="#/marketplace" class="' + (active === "marketplace" ? "active" : "") + '">Talent</a>'
    + '<a href="#/support" class="' + (active === "support" ? "active" : "") + '">Support</a>'
    + "</nav>"
    + '<div class="topbar-right">'
    + (u
      ? '<a class="btn btn-light btn-sm" href="#/dashboard">Dashboard</a>'
      : '<a class="btn btn-ghost btn-sm" style="color:#fff" href="#/signin">Sign in</a><a class="btn btn-light btn-sm" href="#/signup">Create account</a>')
    + "</div></div></header>"
    + "<main>" + content + "</main>"
    + footerHtml();
}

function footerHtml() {
  const links = [["terms", "Terms"], ["privacy", "Privacy"], ["cookies", "Cookies"], ["data_sharing", "Data Sharing"], ["ai_notice", "AI Notice"], ["refunds", "Refunds"], ["subprocessors", "Subprocessors"], ["data_request", "Data Requests"]];
  return '<footer class="footer"><div class="footer-inner"><span>© 2026 ' + esc(S.brand.companyName || S.brand.name) + "</span>"
    + links.map((l) => '<a href="#/legal/' + l[0] + '">' + l[1] + "</a>").join("")
    + '<span style="margin-left:auto">Support: ' + esc(S.brand.supportEmail || "") + "</span></div></footer>";
}

const APP_NAV = [
  ["dashboard", "Dashboard", "dashboard", "#/dashboard"],
  ["profile", "Career Profile", "user", "#/profile"],
  ["cv", "CV", "file", "#/cv"],
  ["jobs", "Jobs", "briefcase", "#/jobs"],
  ["skills", "Skills", "chart", "#/skills"],
  ["portfolio", "Portfolio", "folder", "#/portfolio"],
  ["interview", "Interview", "mic", "#/interview"],
  ["documents", "Documents", "book", "#/documents"],
  ["billing", "Billing", "card", "#/billing"],
  ["privacy", "Privacy", "shield", "#/privacy"],
  ["settings", "Settings", "gear", "#/settings"],
  ["support", "Support", "help", "#/support"]
];

function appLayout(title, content, active) {
  const u = S.user || {};
  const isAdmin = ["admin", "support", "editor"].includes(u.role);
  return '<div class="app-shell"><aside class="sidebar" id="sidebar" aria-label="Application">'
    + '<a class="brand" href="#/dashboard"><span class="brand-mark">' + icon("chart", "icon-sm") + "</span>" + esc(S.brand.name) + "</a>"
    + '<nav class="side-nav">'
    + APP_NAV.map((n) => '<a href="' + n[3] + '" class="' + (active === n[0] ? "active" : "") + '">' + icon(n[2], "icon-sm") + esc(n[1]) + "</a>").join("")
    + (isAdmin ? '<div class="nav-section">Administration</div><a href="#/admin" class="' + (active === "admin" ? "active" : "") + '">' + icon("server", "icon-sm") + "Admin</a>" : "")
    + "</nav>"
    + '<div class="side-foot"><div style="color:#fff;font-weight:600">' + esc(u.name || "") + '</div><div style="font-size:0.8rem;color:#8fa1bb">' + esc(u.email || "") + '</div><a href="#/signin" id="signout-link" style="color:#c6d3e6;font-size:0.85rem">Sign out</a></div>'
    + "</aside>"
    + '<div class="main"><div class="main-top"><button class="hamburger" id="hamburger" aria-label="Open menu">' + icon("menu", "icon-sm") + "</button><h1>" + esc(title) + "</h1>"
    + '<div style="margin-left:auto;display:flex;gap:8px"><a class="btn btn-ghost btn-sm" href="#/notifications" aria-label="Notifications">' + icon("bell", "icon-sm") + '</a><a class="btn btn-ghost btn-sm" href="#/inbox" aria-label="Email inbox">' + icon("mail", "icon-sm") + "</a></div></div>"
    + '<div class="main-body">' + content + "</div></div></div>";
}

function bindShell() {
  const hb = document.getElementById("hamburger");
  if (hb) hb.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  const so = document.getElementById("signout-link");
  if (so) so.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await api("/api/auth/signout", { method: "POST", body: "{}" }); } catch (err) { /* ignore */ }
    S.user = null; S.csrf = null;
    location.hash = "#/";
  });
}

async function refreshSession() {
  try {
    const me = await api("/api/auth/me");
    S.user = me.user; S.csrf = me.csrf;
  } catch (e) { S.user = null; S.csrf = null; }
}

async function refreshBrand() {
  try { S.brand = await api("/api/public/branding"); }
  catch (e) { /* keep default */ }
  document.title = S.brand.name + ": Understand what it takes to get the job";
}
