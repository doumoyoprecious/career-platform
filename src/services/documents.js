"use strict";
// Document service: generation, private storage, secure delivery.
// Files live under data/storage/private (never served statically).
// Downloads use signed, expiring, entitlement checked tokens.

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");
const db = require("../db");
const config = require("../config");
const { uid, nowIso, randomToken, hashToken, sanitizeText } = require("../lib/utils");
const { audit } = require("../middleware");

const PRIVATE_DIR = path.join(__dirname, "..", "..", "data", "storage", "private");
const TEMPLATE_DIR = path.join(__dirname, "..", "..", "data", "storage", "templates");

function ensureDirs() {
  for (const d of [PRIVATE_DIR, TEMPLATE_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function brandName() {
  const b = db.getSetting("branding", null) || {};
  return b.name || config.brand.name;
}

function splitLines(text, max) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w);
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

// sections: [{ heading, paragraphs: [str], bullets: [str] }]
function generatePdf(title, meta, sections) {
  ensureDirs();
  return new Promise((resolve, reject) => {
    const fileId = uid("file");
    const filePath = path.join(PRIVATE_DIR, fileId + ".pdf");
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: sanitizeText(title), Author: brandName() } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fillColor("#0f2a44").fontSize(20).font("Helvetica-Bold").text(sanitizeText(title), { align: "left" });
    doc.moveDown(0.3);
    doc.fillColor("#555").fontSize(9).font("Helvetica").text(sanitizeText(meta || ""));
    doc.moveDown(0.5);
    doc.strokeColor("#0f2a44").lineWidth(1.5).moveTo(56, doc.y).lineTo(539, doc.y).stroke();
    doc.moveDown(0.8);
    for (const s of sections) {
      if (s.heading) {
        doc.fillColor("#0f2a44").fontSize(13).font("Helvetica-Bold").text(sanitizeText(s.heading));
        doc.moveDown(0.3);
      }
      for (const p of (s.paragraphs || [])) {
        doc.fillColor("#1a1a1a").fontSize(10.5).font("Helvetica").text(sanitizeText(p), { align: "left", lineGap: 2 });
        doc.moveDown(0.4);
      }
      for (const b of (s.bullets || [])) {
        doc.fillColor("#1a1a1a").fontSize(10.5).font("Helvetica").text("•  " + sanitizeText(b), { indent: 14, lineGap: 2 });
        doc.moveDown(0.2);
      }
      doc.moveDown(0.5);
    }
    doc.moveDown(0.5);
    doc.fillColor("#888").fontSize(8).font("Helvetica").text("Prepared by " + brandName() + " on " + nowIso().slice(0, 10) + ". Career guidance material, not an employment guarantee.", { align: "center" });
    doc.end();
    stream.on("finish", () => resolve({ fileId, filePath, mime: "application/pdf", ext: "pdf" }));
    stream.on("error", reject);
  });
}

function generateDocx(title, meta, sections) {
  ensureDirs();
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: sanitizeText(title), bold: true, size: 40 })] }),
    new Paragraph({ children: [new TextRun({ text: sanitizeText(meta || ""), size: 18, color: "555555" })] }),
    new Paragraph({ text: "" })
  ];
  for (const s of sections) {
    if (s.heading) children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: sanitizeText(s.heading), bold: true, size: 26 })] }));
    for (const p of (s.paragraphs || [])) children.push(new Paragraph({ children: [new TextRun({ text: sanitizeText(p), size: 21 })] }));
    for (const b of (s.bullets || [])) children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: sanitizeText(b), size: 21 })] }));
    children.push(new Paragraph({ text: "" }));
  }
  const fileId = uid("file");
  const filePath = path.join(PRIVATE_DIR, fileId + ".docx");
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc).then((buf) => {
    fs.writeFileSync(filePath, buf);
    return { fileId, filePath, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" };
  });
}

function createDownloadToken(userId, documentId, ttlMinutes) {
  const token = randomToken(24);
  db.insert("downloadTokens", {
    userId, documentId, tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + (ttlMinutes || 30) * 60000).toISOString(),
    usedAt: null
  });
  return token;
}

function resolveDownload(token) {
  const rec = db.findOne("downloadTokens", { tokenHash: hashToken(token) });
  if (!rec) return { ok: false, reason: "Invalid download link." };
  if (new Date(rec.expiresAt).getTime() <= Date.now()) return { ok: false, reason: "This download link has expired. Generate a new one from your document library.", expired: true, documentId: rec.documentId };
  const docRec = db.get("documents", rec.documentId);
  if (!docRec || docRec.accessRevoked) return { ok: false, reason: "This document is no longer available." };
  if (docRec.userId !== rec.userId) return { ok: false, reason: "Not authorized." };
  return { ok: true, rec, docRec };
}

async function storeGenerated(userId, opts) {
  // opts: productKey, title, kind(pdf|docx|both), sections, purchaseId, entitlementId
  ensureProductsDocs();
  const results = [];
  if (opts.kind === "pdf" || opts.kind === "both") {
    const pdf = await generatePdf(opts.title, opts.meta, opts.sections);
    results.push(pdf);
  }
  if (opts.kind === "docx" || opts.kind === "both") {
    const docx = await generateDocx(opts.title, opts.meta, opts.sections);
    results.push(docx);
  }
  const created = [];
  for (const r of results) {
    const rec = db.insert("documents", {
      userId, productKey: opts.productKey, title: opts.title,
      fileId: r.fileId, mime: r.mime, ext: r.ext,
      purchaseId: opts.purchaseId || null, entitlementId: opts.entitlementId || null,
      version: opts.version || 1, status: "ready", accessRevoked: false, at: nowIso()
    });
    created.push(rec);
  }
  audit("system", userId, "document.generated", { product: opts.productKey, title: opts.title });
  return created;
}

function ensureProductsDocs() {
  ensureDirs();
}

function adminCreateVersion(docProductId, fileInfo, notes) {
  const v = db.insert("docVersions", {
    docProductId, fileName: fileInfo.originalname, storedPath: fileInfo.path,
    mime: fileInfo.mimetype, size: fileInfo.size, notes: sanitizeText(notes || ""),
    at: nowIso()
  });
  const versions = db.find("docVersions", { docProductId });
  db.update("documents", docProductId, {});
  return v;
}

module.exports = {
  PRIVATE_DIR, TEMPLATE_DIR, ensureDirs,
  generatePdf, generateDocx, storeGenerated,
  createDownloadToken, resolveDownload, splitLines
};
