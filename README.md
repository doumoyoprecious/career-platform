# CareerSignal: Global AI Career Intelligence Platform

A production-oriented SaaS application that helps people understand their career
readiness, analyze jobs, close skill gaps, improve their CV, build stronger
portfolios and prepare for interviews.

Product loop: Career Profile, Job, Requirements, Eligibility, Skill Gap,
Evidence/Portfolio, CV, Application Preparation, Interview Preparation.

## Quick start (development)

Requirements: Node.js 20+.

```bash
cd career-platform
npm install
cp .env.example .env
# Optional: set ADMIN_EMAIL in .env so your first account becomes admin.
# Optional: set SEED_DEMO=true to load sample job listings (dev only).
node server.js
```

Open http://localhost:3000

Run the acceptance suite (server must be running, start from an empty data dir):

```bash
npm test
```

## What is included

**Accounts and security**

- Signup, signin, signout, email verification with expiring single-use tokens,
  resend limits, password reset with hashed tokens, password/email change,
  session management, CSRF protection, rate limiting, secure headers, RBAC.
- Audit logging for auth, payments, consent, documents and admin actions.

**Career intelligence (free)**

- Onboarding and structured career profile, CV upload (PDF/DOCX) with
  validation and parsing, free CV review, proprietary Readiness Score with
  breakdown, job recommendations, job match analysis, eligibility signals,
  Required Skills Finder, skill gap analysis, Job Safety Advisor.

**Premium (subscription $20/mo or pay per feature)**

- CV Upgrade, Job-Specific CV (with skill confirmation step, never fabricates),
  Application Package, Portfolio Intelligence, Interview Preparation with mock
  scoring, Complete Application Package.
- Documents generated as PDF and DOCX, stored privately, delivered through
  signed expiring links plus email notification.

**Payments**

- Provider abstraction with Stripe adapter and development test mode.
- Webhooks are the source of truth, signatures verified, replay window
  enforced, idempotent fulfillment, server-side entitlements, receipts,
  refunds, subscription lifecycle emails.

**Email**

- Central service with Resend/SMTP/dev-inbox transports, editable templates,
  delivery log, test preview, event webhook endpoint.

**Privacy**

- Consent ledger with versioning, Privacy Center, data export, account
  deletion with legal retention handling, opt-in professional marketplace,
  Do Not Sell/Share preference, retention schedule, subprocessor register,
  data subject request workflow, privacy gate between user data and AI,
  analytics, marketplace and third parties.

**Admin**

- Dashboard, users (suspend, restore, roles, entitlements), products and
  pricing, document products with versioning, purchases, subscriptions,
  refunds, emails, jobs, privacy requests, support, audit log, feature flags,
  branding and system settings, legal documents, analytics.

## Configuration

All secrets are environment variables (see `.env.example`). Never commit `.env`.

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Session and token signing (required, min 32 chars) |
| `ADMIN_EMAIL` | First account with this email becomes admin |
| `BASE_URL` | Public URL used in email links |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Live payments (optional until configured) |
| `RESEND_API_KEY` or `SMTP_*` | Real email delivery (optional in dev) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | External AI (optional; built-in engine is default) |
| `SEED_DEMO` | Demo jobs; hard blocked in production |

Without Stripe keys the app runs in a controlled state: billing shows a
configuration notice, and development test checkout is available outside
production only. Test payments never exist in production.

## Production checklist

- Set `NODE_ENV=production`, strong `AUTH_SECRET`, real `BASE_URL` with HTTPS.
- Configure Resend or SMTP, Stripe keys and webhook secret.
- Point Stripe webhooks at `/api/webhooks/stripe`.
- Keep `SEED_DEMO` unset (the app refuses to boot otherwise in production).
- Put the app behind TLS, backups, log retention and error monitoring.
- Have legal counsel review Terms, Privacy, Cookie, Data Sharing, AI Notice,
  Refund, Subprocessor and Data Request documents (editable in Admin, Legal).
- Complete DPIA, records of processing, retention schedule and incident
  workflows before launch.

## Architecture

```
server.js            Express entry, mounts API + SPA
src/config.js        Environment configuration
src/db.js            Data access layer (file backed; swappable)
src/middleware.js    Auth, CSRF, rate limit, audit, privacy gate
src/routes/          auth, core, premium, billing, docs, privacy, admin, public, webhooks
src/services/        email, payments, documents, analysis, taxonomy, ai, premium, privacy
src/seed.js          Products, templates, flags, legal drafts (demo jobs dev only)
public/              Responsive SPA, SVG icon set, no external dependencies
test/acceptance.js   75 check end to end suite
data/                Runtime data (JSON collections, uploads, private storage)
```

## Design rules enforced

- No emojis and no em dashes anywhere (sanitizer + tests enforce this).
- Professional SVG icons only, consistent stroke set.
- Responsive layouts for phones, tablets and desktops.
- No fake testimonials, counts, reviews, employers or placement statistics.
- AI safety: the platform never invents employers, titles, dates, skills or
  achievements. Missing skills require explicit user confirmation.
