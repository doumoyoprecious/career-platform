"use strict";
// Central configuration. All secrets come from environment variables.
// Nothing secret is ever sent to the browser.

const env = process.env;

function required(name, fallback) {
  if (env[name]) return env[name];
  if (fallback !== undefined) return fallback;
  if (env.NODE_ENV === "production") throw new Error("Missing required env var: " + name);
  return "";
}

const config = {
  nodeEnv: env.NODE_ENV || "development",
  isProd: (env.NODE_ENV || "development") === "production",
  port: parseInt(env.PORT || "3000", 10),
  baseUrl: env.BASE_URL || "http://localhost:3000",
  authSecret: required("AUTH_SECRET", "dev-only-secret-change-me-please-0000"),
  adminEmail: (env.ADMIN_EMAIL || "").toLowerCase().trim(),

  brand: {
    name: env.BRAND_NAME || "CareerSignal",
    supportEmail: env.SUPPORT_EMAIL || "support@example.com",
    companyName: env.COMPANY_NAME || "CareerSignal Inc.",
    companyAddress: env.COMPANY_ADDRESS || "",
    defaultCurrency: env.DEFAULT_CURRENCY || "USD"
  },

  payments: {
    mode: env.PAYMENTS_MODE || "dev",
    stripeSecretKey: env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || "",
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || ""
  },

  email: {
    from: env.EMAIL_FROM || "no-reply@example.com",
    resendKey: env.RESEND_API_KEY || "",
    smtpHost: env.SMTP_HOST || "",
    smtpPort: parseInt(env.SMTP_PORT || "587", 10),
    smtpUser: env.SMTP_USER || "",
    smtpPass: env.SMTP_PASS || ""
  },

  ai: {
    provider: env.AI_PROVIDER || "local",
    apiKey: env.AI_API_KEY || "",
    baseUrl: env.AI_BASE_URL || "",
    model: env.AI_MODEL || ""
  },

  seedDemo: (env.SEED_DEMO || "false").toLowerCase() === "true",

  limits: {
    uploadBytes: 10 * 1024 * 1024,
    aiDailyPerUser: 100,
    aiMonthlyPerUser: 1500,
    verifyResendPerHour: 5,
    resetPerHour: 5,
    loginPerMinute: 20
  }
};

if (config.isProd && config.seedDemo) {
  throw new Error("SEED_DEMO must never be enabled in production.");
}

module.exports = config;
