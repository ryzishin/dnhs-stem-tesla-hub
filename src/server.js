// src/server.js — Express + EJS + MongoDB (Mongoose) + Socket.IO entry point.
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import expressLayouts from "express-ejs-layouts";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import "./models/index.js"; // register all Mongoose models
import { attachRealtime } from "./services/realtime.js";
import { shareLocals } from "./middleware/shareLocals.js";
import { attachUser } from "./middleware/auth.js"; // v3-fix: mount before shareLocals so res.locals.user is populated
import { csrfToken, csrfVerify } from "./middleware/csrf.js";
import routes from "./routes/index.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const app = express();
const PORT = config.port;

// ===== View engine (EJS + layouts) =====
app.set("view engine", "ejs");
app.set("views", path.join(ROOT, "src", "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// ===== Security & middleware =====
// v3-P3-5: Generate a per-request nonce for inline scripts.
// Helmet's CSP consumes this via the function-form of scriptSrc below.
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // v3-P3-5: Replace 'unsafe-inline' with per-request nonce.
      // The function form is called by Helmet on every request to inject the
      // current nonce. External scripts (lucide.min.js, socket.io CDN, etc.)
      // are allowed by 'self' or the explicit CDN origin — they don't need a nonce.
      scriptSrc: [
        "'self'",
        "https://cdn.socket.io",
        (req, res) => `'nonce-${res.locals.nonce}'`,
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
    },
  },
}));
app.use(morgan(config.env === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ===== Static =====
app.use(express.static(path.join(ROOT, "public")));
// v3-P2-1: /uploads is now auth-gated via a route in routes/index.js
// (router.get("/uploads/:filename", requireAuth, uploads.serveUpload)).
// Old code mounted `app.use("/uploads", express.static(...))` which let anyone
// scrape student avatar photos by guessing MongoDB ObjectIds.

// ===== File upload (profile pictures) =====
// v2-P0-2: Whitelist MIME types AND use a fixed extension from the whitelist,
// not the attacker-controlled original filename. Old code accepted any
// Content-Type starting with "image/" and used path.extname(file.originalname)
// for the saved filename — so an attacker could upload evil.html with
// Content-Type: image/jpeg and get a stored XSS via /uploads/.
const ALLOWED_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(ROOT, "uploads")),
    filename: (req, file, cb) => {
      // v2-P0-2: Use the whitelist-mapped extension, never the user-supplied one.
      const ext = ALLOWED_MIME[file.mimetype] || ".bin";
      cb(null, `${req.user?.id || "anon"}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // v2-P0-2: Reject any MIME not in the explicit whitelist.
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME, file.mimetype)) {
      return cb(new Error("Only JPG, PNG, GIF, and WebP images are allowed"));
    }
    cb(null, true);
  },
});
app.use((req, _res, next) => { req.upload = upload; next(); });

// v3-P0-1: Multer error handler moved below app.use(routes) — see below.
// (4-arg error middleware only catches errors from middleware mounted AFTER it.)
// The block used to live here (between the upload setup and the session middleware),
// which meant it never fired — route-handler Multer errors fell through to the 500 handler.

// ===== Session (MongoDB-backed) =====
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: config.mongodb.uri,
    dbName: config.mongodb.dbName,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60, // 7 days
  }),
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// ===== Locals =====
app.use((req, res, next) => {
  res.locals.appName = "STEM Tesla BioHub";
  res.locals.tagline = "Explore. Practice. Apply. Discover Biology.";
  res.locals.publicUrl = config.publicUrl;
  next();
});
// v3-fix: Mount attachUser BEFORE shareLocals so that res.locals.user is
// populated when shareLocals reads req.user. (Previously attachUser only ran
// inside routes, after shareLocals had already set res.locals.user = null.)
app.use(attachUser);
app.use(shareLocals);

// v2-P1-1: CSRF protection — issue a token on every GET, verify on every non-safe method.
app.use(csrfToken);
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return csrfVerify(req, res, next);
  }
  next();
});

// ===== Routes =====
app.use(routes);

// v3-P0-1: Multer error handler. MUST be after routes (so it catches errors
// from route handlers that call req.upload.single/array) and before the
// generic 500 handler (so MulterErrors get a clean 400 instead of leaking
// a 500 to the user).
app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    return res.status(400).json({ ok: false, error: err.message, code: err.code });
  }
  if (err.message === "Only JPG, PNG, GIF, and WebP images are allowed") {
    return res.status(400).json({ ok: false, error: err.message });
  }
  next(err);
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).render("error/404", { title: "Not Found" });
});

// ===== 500 =====
app.use((err, req, res, _next) => {
  console.error("[unhandled error]", err);
  // v2-P1-3: Don't leak err.message to the client — it can include DB URIs, file paths, etc.
  // In development, show the message for debugging; in production, hide it.
  const message = config.env === "production"
    ? "Something went wrong. The admin has been notified."
    : err.message;
  res.status(500).render("error/500", { title: "Server Error", message });
});

// ===== Boot =====
async function boot() {
  await connectDB();

  const httpServer = app.listen(PORT, () => {
    console.log(`\n  STEM Tesla BioHub running at:`);
    console.log(`    Local:    http://localhost:${PORT}`);
    console.log(`    Public:   ${config.publicUrl}`);
    console.log(`    Env:      ${config.env}\n`);
  });

  attachRealtime(httpServer);
}

// v3-P1-6: Export app for testing. Don't boot unless this is the entry point.
export { app };

// Only boot if run directly (not imported by a test or a smoke-test harness).
// `import.meta.url === \`file://${process.argv[1]}\`` is the standard ESM
// equivalent of CommonJS's `require.main === module`.
if (import.meta.url === `file://${process.argv[1]}`) {
  boot().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;
