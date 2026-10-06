"use strict";
// File backed document database with a clean data access layer.
// Each collection is one JSON file under data/, written atomically.
// Swap this module for a SQL adapter later without changing services.

const fs = require("fs");
const path = require("path");
const { uid, nowIso } = require("./lib/utils");

const DATA_DIR = path.join(__dirname, "..", "data");

const COLLECTIONS = [
  "users", "sessions", "tokens", "profiles", "cvs", "analyses",
  "jobs", "jobAnalyses", "products", "purchases", "transactions",
  "entitlements", "subscriptions", "documents", "docVersions",
  "emailTemplates", "emailLog", "notifications", "consents",
  "privacyRequests", "marketplace", "auditLog", "featureFlags",
  "aiUsage", "aiCache", "subprocessors", "supportTickets",
  "legalDocs", "settings", "analytics", "webhookEvents", "downloadTokens"
];

const cache = {};

function fileFor(name) {
  return path.join(DATA_DIR, name + ".json");
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(name) {
  ensureDir();
  if (cache[name]) return cache[name];
  const f = fileFor(name);
  if (!fs.existsSync(f)) {
    cache[name] = [];
    fs.writeFileSync(f, "[]");
    return cache[name];
  }
  try {
    cache[name] = JSON.parse(fs.readFileSync(f, "utf8") || "[]");
    if (!Array.isArray(cache[name])) cache[name] = [];
  } catch (e) {
    cache[name] = [];
  }
  return cache[name];
}

function save(name) {
  ensureDir();
  const f = fileFor(name);
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache[name] || [], null, 1));
  fs.renameSync(tmp, f);
}

function match(doc, query) {
  for (const k of Object.keys(query)) {
    const q = query[k];
    if (q && typeof q === "object" && !Array.isArray(q)) {
      if (q.$in && !q.$in.includes(doc[k])) return false;
      else if (q.$ne !== undefined && doc[k] === q.$ne) return false;
      else if (q.$gt !== undefined && !(doc[k] > q.$gt)) return false;
      else if (q.$gte !== undefined && !(doc[k] >= q.$gte)) return false;
      else if (q.$exists !== undefined && ((doc[k] === undefined) === q.$exists)) return false;
      else if (q.$regex && !new RegExp(q.$regex, q.$flags || "i").test(String(doc[k] || ""))) return false;
    } else if (doc[k] !== q) return false;
  }
  return true;
}

const db = {
  all(name) { return load(name).slice(); },
  find(name, query, opts) {
    let rows = load(name).filter((d) => match(d, query || {}));
    opts = opts || {};
    if (opts.sort) {
      const key = opts.sort.replace(/^-/, "");
      const dir = opts.sort.startsWith("-") ? -1 : 1;
      rows.sort((a, b) => {
        if (a[key] < b[key]) return -1 * dir;
        if (a[key] > b[key]) return 1 * dir;
        return 0;
      });
    }
    if (opts.skip) rows = rows.slice(opts.skip);
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows;
  },
  get(name, id) { return load(name).find((d) => d.id === id) || null; },
  findOne(name, query) {
    const rows = load(name).filter((d) => match(d, query || {}));
    return rows.length ? rows[0] : null;
  },
  count(name, query) { return load(name).filter((d) => match(d, query || {})).length; },
  insert(name, doc) {
    const rows = load(name);
    const full = Object.assign({ id: uid(name.slice(0, 3)), createdAt: nowIso(), updatedAt: nowIso() }, doc);
    rows.push(full);
    save(name);
    return full;
  },
  update(name, id, patch) {
    const rows = load(name);
    const doc = rows.find((d) => d.id === id);
    if (!doc) return null;
    Object.assign(doc, patch, { updatedAt: nowIso() });
    save(name);
    return doc;
  },
  upsert(name, query, doc) {
    const existing = db.findOne(name, query);
    if (existing) return db.update(name, existing.id, doc);
    return db.insert(name, Object.assign({}, query, doc));
  },
  remove(name, id) {
    const rows = load(name);
    const i = rows.findIndex((d) => d.id === id);
    if (i < 0) return false;
    rows.splice(i, 1);
    save(name);
    return true;
  },
  removeWhere(name, query) {
    const rows = load(name);
    const keep = rows.filter((d) => !match(d, query || {}));
    const removed = rows.length - keep.length;
    cache[name] = keep;
    save(name);
    return removed;
  },
  getSetting(key, fallback) {
    const s = db.findOne("settings", { key });
    return s ? s.value : fallback;
  },
  setSetting(key, value) {
    return db.upsert("settings", { key }, { key, value });
  }
};

module.exports = db;
