"use strict";
// AI provider abstraction layer with cost management.
// Providers: local (built-in intelligence engine, default), openai-compatible.
// Only the minimum necessary data is sent to external providers, never
// payment data, passwords, tokens or full private documents by default.

const crypto = require("crypto");
const db = require("../db");
const config = require("../config");
const { privacyGate, audit } = require("../middleware");
const { sanitizeDeep, nowIso } = require("../lib/utils");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function checkBudget(userId) {
  const day = db.find("aiUsage", { userId, day: todayKey() }).length;
  const month = db.find("aiUsage", { userId, month: monthKey() }).length;
  if (day >= config.limits.aiDailyPerUser) return { ok: false, reason: "Daily analysis limit reached. Please try again tomorrow." };
  if (month >= config.limits.aiMonthlyPerUser) return { ok: false, reason: "Monthly analysis limit reached." };
  return { ok: true };
}

function logUsage(userId, provider, purpose, units, cached) {
  db.insert("aiUsage", {
    userId, provider, purpose, units: units || 1, cached: !!cached,
    day: todayKey(), month: monthKey(), at: nowIso()
  });
}

function minimize(payload, purpose) {
  // Data minimization: strip secrets, payment data and unnecessary fields.
  const banned = ["password", "passwordHash", "token", "csrf", "tokenHash", "card", "cardNumber", "cvv", "ssn", "passport", "bankAccount"];
  const clean = JSON.parse(JSON.stringify(payload || {}, (k, v) => (banned.includes(k) ? undefined : v)));
  if (purpose === "scoring" || purpose === "matching") {
    // External providers only need derived facts, not raw documents.
    delete clean.rawText;
  }
  return clean;
}

async function externalComplete(prompt, opts) {
  const base = (config.ai.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = config.ai.model || "gpt-4o-mini";
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + config.ai.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a career analysis assistant. Never invent employers, titles, dates, skills or achievements. If information is missing, say so. Never use emojis or em dashes. Use commas, periods or semicolons instead of em dashes." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1200
    })
  });
  if (!r.ok) throw new Error("AI provider error: " + r.status);
  const j = await r.json();
  return j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
}

const aiService = {
  providerInfo() {
    const override = db.getSetting("ai_provider", null);
    const name = override || config.ai.provider || "local";
    const externalReady = !!config.ai.apiKey;
    if (name !== "local" && !externalReady) return { active: "local", requested: name, externalReady: false, note: "External provider not configured. Using built-in engine." };
    return { active: name, requested: name, externalReady, note: name === "local" ? "Built-in intelligence engine." : "External provider with minimization." };
  },

  async analyze(purpose, payload, userId) {
    const gate = privacyGate(userId, "core");
    if (!gate.allowed) throw new Error(gate.reason);
    const budget = checkBudget(userId);
    if (!budget.ok) { const e = new Error(budget.reason); e.code = "BUDGET"; throw e; }

    const info = this.providerInfo();
    const minimized = minimize(payload, purpose);
    const cacheKey = crypto.createHash("sha256").update(info.active + ":" + purpose + ":" + JSON.stringify(minimized)).digest("hex");
    const cached = db.findOne("aiCache", { key: cacheKey });
    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      logUsage(userId, info.active, purpose, 0, true);
      return { result: cached.value, cached: true, provider: info.active };
    }

    let result;
    if (info.active === "local") {
      // Local engine executes in analysis.js; this path records usage only.
      result = { engine: "local", note: "Processed by built-in engine." };
      logUsage(userId, "local", purpose, 1, false);
    } else {
      const text = await externalComplete("Purpose: " + purpose + "\nData:\n" + JSON.stringify(minimized).slice(0, 6000), {});
      result = sanitizeDeep({ text });
      logUsage(userId, info.active, purpose, 2, false);
      audit("user", userId, "ai.external_call", { purpose, provider: info.active });
    }

    db.insert("aiCache", { key: cacheKey, value: result, expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() });
    return { result, cached: false, provider: info.active };
  },

  usageSummary() {
    const rows = db.all("aiUsage");
    const byProvider = {};
    const byPurpose = {};
    let cached = 0;
    for (const r of rows) {
      byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
      byPurpose[r.purpose] = (byPurpose[r.purpose] || 0) + 1;
      if (r.cached) cached++;
    }
    return { total: rows.length, cached, byProvider, byPurpose };
  }
};

module.exports = aiService;
