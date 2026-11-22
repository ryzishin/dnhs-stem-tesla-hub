// src/server.js — STEM Tesla Hub entry point.
// Express + EJS + MongoDB (Mongoose) + Socket.IO. One process, one port.
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import morgan from "morgan";
import expressLayouts from "express-ejs-layouts";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import "./models/index.js";
import { attachRealtime } from "./services/realtime.js";
import { attachUser } from "./middleware/auth.js";
import { shareLocals } from "./middleware/shareLocals.js";
import routes from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "src", "views"));
app.set("view options", { root: path.join(ROOT, "src", "views") });
app.use(expressLayouts);
app.set("layout", "layouts/main");

if (config.isProd) app.set("trust proxy", 1); // Render terminates TLS — needed for secure cookies

// ===== security headers (everything is first-party: no CDNs) =====
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(morgan(config.isProd ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ===== static =====
app.use(express.static(path.join(ROOT, "public"), { maxAge: config.isProd ? "1h" : 0 }));

// ===== session (stored in MongoDB — survives deploys) =====
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: config.mongodb.uri,
    dbName: config.mongodb.dbName,
    collectionName: "sessions",
    ttl: 14 * 24 * 60 * 60,
  }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  },
}));

// ===== view helpers & current user =====
app.use(attachUser);
app.use(shareLocals);

// ===== routes =====
app.use(routes);

// ===== errors =====
app.use((err, req, res, _next) => {
  console.error("[error]", err);
  if (res.headersSent) return;
  res.status(500).render("error", {
    code: 500, title: "Something broke on our side",
    message: "The error was logged. Try again in a moment — if it keeps happening, tell your adviser what you clicked.",
  });
});

// ===== boot =====
async function boot() {
  await connectDB();
  const httpServer = app.listen(config.port, () => {
    console.log(`\n  STEM Tesla Hub · ${config.isProd ? "production" : "development"}`);
    console.log(`  Local:  http://localhost:${config.port}`);
    console.log(`  Public: ${config.publicUrl}\n`);
  });
  attachRealtime(httpServer);
}

boot().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
