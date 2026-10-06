"use strict";
// User document library and secure downloads.

const express = require("express");
const fs = require("fs");
const db = require("../db");
const mw = require("../middleware");
const documents = require("../services/documents");

const router = express.Router();

router.get("/", mw.requireVerified, (req, res) => {
  const docs = db.find("documents", { userId: req.user.id }, { sort: "-createdAt" }).map((d) => {
    const product = db.findOne("products", { key: d.productKey });
    return {
      id: d.id, title: d.title, product: product ? product.name : d.productKey,
      ext: d.ext, version: d.version, status: d.accessRevoked ? "revoked" : d.status, at: d.at || d.createdAt
    };
  });
  res.json({ documents: docs });
});

router.post("/:id/link", mw.requireVerified, (req, res) => {
  const d = db.get("documents", req.params.id);
  if (!d || d.userId !== req.user.id || d.accessRevoked) {
    return res.status(404).json({ error: "Document not found or no longer available." });
  }
  const token = documents.createDownloadToken(req.user.id, d.id, 30);
  mw.audit("user", req.user.id, "document.link_created", { id: d.id });
  res.json({ ok: true, token, expiresInMinutes: 30 });
});

router.get("/download", async (req, res) => {
  const token = String(req.query.token || "");
  const resolved = documents.resolveDownload(token);
  if (!resolved.ok) return res.status(resolved.expired ? 410 : 403).send(resolved.reason);
  const filePath = require("path").join(documents.PRIVATE_DIR, resolved.docRec.fileId + "." + resolved.docRec.ext);
  if (!fs.existsSync(filePath)) return res.status(404).send("File not found.");
  mw.audit("user", resolved.rec.userId, "document.downloaded", { id: resolved.docRec.id });
  res.setHeader("Content-Type", resolved.docRec.mime);
  res.setHeader("Content-Disposition", "attachment; filename=\"" + resolved.docRec.title.replace(/[^a-zA-Z0-9 ._-]/g, "") + "." + resolved.docRec.ext + "\"");
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
