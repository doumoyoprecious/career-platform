"use strict";
// Career intelligence platform. Single entry point.

const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const config = require("./src/config");
const mw = require("./src/middleware");
const seed = require("./src/seed");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(mw.secureHeaders);
app.use(cookieParser());

// Webhooks need raw bodies and are mounted before JSON parsing.
app.use("/api/webhooks", require("./src/routes/webhooks"));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(mw.attachUser);
app.use(mw.csrfMw);

// API
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/me", require("./src/routes/core"));
app.use("/api/premium", require("./src/routes/premium"));
app.use("/api/billing", require("./src/routes/billing"));
app.use("/api/documents", require("./src/routes/docs"));
app.use("/api/privacy", require("./src/routes/privacy"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api/public", require("./src/routes/public"));

// Static frontend (SPA)
app.use(express.static(path.join(__dirname, "public"), { maxAge: config.isProd ? "1h" : 0 }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return mw.notFound(req, res);
  if (req.method !== "GET") return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use(mw.errorHandler);

seed();

app.listen(config.port, "0.0.0.0", () => {
  console.log("Server running on port " + config.port + " (" + config.nodeEnv + ")");
});
