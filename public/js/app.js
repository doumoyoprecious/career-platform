"use strict";
/* Router: hash based navigation with guards. */

function parseHash() {
  const h = (location.hash || "#/").replace(/^#/, "");
  const parts = h.split("?")[0].split("/").filter(Boolean);
  const params = {};
  const q = h.split("?")[1];
  if (q) q.split("&").forEach((kv) => { const i = kv.split("="); params[decodeURIComponent(i[0])] = decodeURIComponent(i[1] || ""); });
  return { parts, params };
}

async function route() {
  const { parts, params } = parseHash();
  const p0 = parts[0] || "";
  window.scrollTo(0, 0);
  try {
    if (p0 === "") return pageLanding();
    if (p0 === "pricing") return pagePricing();
    if (p0 === "signup") return pageSignup();
    if (p0 === "signin") return pageSignin();
    if (p0 === "verify-pending") return pageVerifyPending();
    if (p0 === "verify") return pageVerify(params);
    if (p0 === "forgot") return pageForgot();
    if (p0 === "reset") return pageReset(params);
    if (p0 === "legal") return pageLegal(parts[1] || "terms");
    if (p0 === "marketplace") return pageMarketplace();
    if (p0 === "checkout") return pageCheckout(parts[1] || "");
    if (p0 === "dashboard") return pageDashboard();
    if (p0 === "onboarding") return pageOnboarding();
    if (p0 === "profile") return pageProfile();
    if (p0 === "cv") return pageCv();
    if (p0 === "upgrade") return pageUpgrade();
    if (p0 === "jobs") return pageJobs();
    if (p0 === "skills") return pageSkills();
    if (p0 === "portfolio") return pagePortfolio();
    if (p0 === "interview") return pageInterview();
    if (p0 === "documents") return pageDocuments();
    if (p0 === "billing") {
      if (parts[1] === "success") return pageBillingResult("success");
      if (parts[1] === "cancelled") return pageBillingResult("cancelled");
      return pageBilling();
    }
    if (p0 === "privacy") return pagePrivacy();
    if (p0 === "settings") return pageSettings();
    if (p0 === "support") return pageSupport();
    if (p0 === "notifications") return pageNotifications();
    if (p0 === "inbox") return pageInbox();
    if (p0 === "admin") return pageAdmin(parts[1] || "overview");
    document.getElementById("app").innerHTML = publicLayout('<div class="container"><div class="card"><h2>Page not found</h2><p><a href="#/">Go home</a></p></div></div>', "");
  } catch (e) {
    console.error(e);
    toast("Something went wrong loading this page.", "error");
  }
}

window.addEventListener("hashchange", route);

(async function boot() {
  await refreshBrand();
  await refreshSession();
  // Require verification for app areas is enforced per page.
  route();
})();
