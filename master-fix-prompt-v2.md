# Master Fix Prompt v2 — DNHS STEM Tesla Hub (Biology 2)

**Repository:** `github.com/ryzishin/dnhs-stem-tesla-hub`
**Branch to work against:** `fix/p0-critical` (the v1 patch branch — already has P0-1 through P2-6 applied per `master-fix-prompt.md` v1)
**Base commit:** the tip of `fix/p0-critical`
**Stack:** Node.js 18+ · Express 4 · EJS · Mongoose 8 · Socket.IO 4 · Zod · bcryptjs · Helmet
**Project type:** ES module (`"type": "module"` in `package.json`)
**Target user:** A single class section (Tesla STEM — Biology 2 at Dangcagan National High School)

> **This is v2 of the master-fix-prompt.** v1 (saved as `master-fix-prompt.md` in the repo root) shipped P0-1 through P2-6. This v2 picks up everything v1 missed on second look — primarily security holes discovered during the security deep-dive, plus responsive design fixes the user noticed in production, plus emoji/icon polish to remove the "vibe-coded" aesthetic.

---

## 0. Agent Briefing

You are an autonomous code agent. Your job is to apply the fixes described in this prompt on top of the `fix/p0-critical` branch, working in priority order (P0 → P1 → P2 → P3). Treat this document as authoritative — it was generated from a focused security + design audit of the post-v1 codebase.

**Hard constraints — do NOT break these:**

1. Do NOT undo any v1 patch. The P0-1 through P2-6 fixes from `master-fix-prompt.md` are load-bearing — verify by reading `CHANGELOG.md` before starting.
2. Do NOT change the role system (`student` / `moderator` / `administrator`) or the "first registered account becomes admin" rule.
3. Do NOT change the EJS templating approach or introduce a SPA framework. The project is server-rendered and stays that way.
4. Do NOT change the Mongoose connection config or rename existing collections. New collections are fine; migrations to existing collections must be backward-compatible (add fields with defaults, never rename or remove).
5. Do NOT change the route paths in `src/routes/index.js` that the sidebar (`src/views/partials/sidebar.ejs`) depends on.
6. Do NOT switch authentication libraries. The custom `bcryptjs` + `express-session` + `connect-mongo` setup is intentional and stays.
7. Do NOT introduce TypeScript. The project is plain ESM JS. Type hints via JSDoc are acceptable; `.ts` files are not.
8. Preserve the existing visual design language — dark navy `#0a1228` + Biology green `#10b981`, Inter font, OKLCH avatars. Match new UI to existing `public/css/style.css` conventions.
9. Every change must keep `npm run dev` booting and `npm run db:seed` succeeding with zero manual steps.
10. **NEW in v2:** Do NOT remove an emoji without replacing it with a real icon or text label. The goal is polish, not austerity.

**Soft constraints — respect unless you have a good reason:**

1. One commit per task (e.g., `v2-P0-1: kill SESSION_SECRET fallback`). Tag the task ID in the commit subject so the worklog stays scannable.
2. If a task requires a new dependency, add it to `package.json` `dependencies` (or `devDependencies` for test-only) — never `npm install -g`.
3. If a task requires a schema migration, write a one-shot `scripts/migrate-<name>.js` that's idempotent. The seed script (`scripts/seed.js`) is your reference for how migration scripts are structured.
4. Don't touch `.env.example` without updating both it AND the README's env var table.

**Working directory conventions (this repo):**

- `/home/z/my-project/scripts/` — persisted generation scripts (Rule 9 — Script Persistence).
- `/home/z/my-project/download/` — final user-facing deliverables only.
- `/home/z/my-project/worklog.md` — shared multi-agent work log. Append, never overwrite.

**Self-verification is mandatory.** Before marking any task `done`, run through the Acceptance Criteria checklist for that task. Do not declare the whole project done until the final "Global Acceptance Checklist" at the end of this document passes.

---

## 1. Setup (run once at start)

```bash
git clone https://github.com/ryzishin/dnhs-stem-tesla-hub.git
cd dnhs-stem-tesla-hub
git checkout fix/p0-critical  # v1 patches are on this branch
git pull                      # make sure you're at tip
git checkout -b fix/v2-security-design  # your working branch
npm install
cp .env.example .env  # if not present
# Fill MONGODB_URI, MONGODB_DB_NAME, SESSION_SECRET (LONG random string), PUBLIC_URL in .env
npm run db:seed
npm run dev
# Confirm http://localhost:3000 loads and /register works.
```

If `npm install` fails on `bcryptjs`, ensure Node 18+. If `npm run db:seed` fails, the MongoDB connection string in `.env` is wrong — fix and re-run.

**Pre-flight verification of v1 state:**

Before applying any v2 patch, verify v1 is in place:
- `git log --oneline | head -5` should show the v1 commit (`fix(p0-critical): apply P0 + key P1 patches from master-fix-prompt spec`)
- `cat CHANGELOG.md` should list P0-1 through P2-6 as shipped
- `grep -n "password_hash" src/middleware/auth.js` should return nothing (P0-4 removed it)
- `grep -n "auth: { userId" src/views/live-test/take.ejs` should return nothing (P0-3 removed it)
- `grep -n "setInterval(loadSession" src/views/live-test/take.ejs` should return nothing (P1-4 removed it)

If any of those checks fail, STOP — v1 is not in place, do not proceed.

---

## 2. MIT-Licensed Library Recommendations (v2 additions)

All v1 libs (`ts-fsrs`, `csrf`, `express-rate-limit`, `marked`, `csv-parse`, `vitest`) remain recommended. v2 adds:

### Comparison table

| Concern | Recommended (MIT) | Why not the alternatives |
|---------|------------------|--------------------------|
| SVG icons (replaces emojis) | **`lucide`** (MIT, npm `lucide@^0.460`, GitHub `lucide-icons/lucide`) — vanilla JS bundle, 1500+ icons, call `lucide.createIcons()` once at page load | `feather-icons` (MIT) is smaller but abandoned. `heroicons` is React-only. Inline SVGs in a partial also work but lose the `data-lucide="name"` discoverability. Lucide is the modern standard. |
| File upload hardening | **No new package** — `multer@^2` (already MIT, just upgrade from 1.4.5-lts) | Don't add `formidable` or `busboy` directly; multer wraps busboy and is already wired. |
| Security headers | **No new package** — Helmet is already wired with custom CSP | Don't add `express-csp-header` etc.; Helmet handles it. |

### Install command (run once at start, after `npm install`):

```bash
npm install lucide@^0.460
npm install multer@^2  # upgrade from 1.4.5-lts to fix known vulns
# csrf and express-rate-limit already installed in v1
```

Add to `package.json` scripts (if not already there from v1):

```json
"test": "vitest run",
"test:watch": "vitest"
```

### What NOT to add

- **Passport / passport-local** — already met by custom auth; switching is disruptive.
- **`csurf`** — archived (this is the v1 recommendation; do not regress).
- **Tailwind CSS / DaisyUI / Bootstrap** — the project uses hand-written CSS in `public/css/style.css`. Do NOT introduce a CSS framework in v2 — it would force a full restyle and break the "preserve the visual design language" constraint.
- **Icon fonts (Font Awesome, Material Icons)** — Lucide is lighter and works offline; fonts require CDN or self-hosting.
- **TypeScript runtime checkers** — already using Zod; do not duplicate.

---

## 3. Task Catalog

Tasks are ordered by priority. P0 must all be done before P1. Within a priority tier, the order is the recommended execution order.

### P0 — CRITICAL (security / data integrity)

#### v2-P0-1 · Kill the `SESSION_SECRET` fallback (fail-closed)

**Severity:** CRITICAL — if `SESSION_SECRET` is unset, the app boots with `"dev-session-secret-change-me"`, a publicly-visible string. An attacker who reads the GitHub source can forge any session cookie and become admin. This single bug completely undermines the v1 P0-3 patch (session-based socket auth), because the socket auth reads the session that this weak secret signs.

**Files affected:** `src/config/env.js`.

**Current state (lines 5–24):**

```js
function required(name, fallback) {
  const v = process.env[name] || fallback;
  if (!v) {
    console.error(`[config] Missing required env var: ${name}`);
    console.error(`[config] Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  sessionSecret: required("SESSION_SECRET", "dev-session-secret-change-me"),
  // ...
};
```

The fallback parameter is the bug. The `required()` helper treats it as a default value, so the `if (!v)` check never fires when the env var is missing — it just uses the fallback string.

**Required change:**

1. Remove the fallback parameter from the `SESSION_SECRET` line:

```js
sessionSecret: required("SESSION_SECRET"),
```

2. Update the `required()` helper to make the fallback parameter truly optional and to distinguish "missing" from "empty string":

```js
function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    console.error(`[config] Missing required env var: ${name}`);
    console.error(`[config] Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }
  return v;
}
```

3. Sanity-check that other `required()` callers (`MONGODB_URI`) still behave correctly. `MONGODB_URI` has fallback `""` (empty string), which means "fail if unset" under the new logic — that's the intended behavior. Verify by intentionally leaving `MONGODB_URI` out of `.env` and confirming the app exits with the error message.

4. Update `.env.example` to add a comment that SESSION_SECRET must be set to a long random string and there is no default:

```
# Session secret — REQUIRED. No default. Generate with: openssl rand -hex 32
# If this leaks or is unset in production, sessions can be forged.
SESSION_SECRET=
```

**Acceptance criteria:**

- [ ] Removing `SESSION_SECRET=` line from `.env` causes `npm run dev` to exit with `[config] Missing required env var: SESSION_SECRET`.
- [ ] No occurrence of the literal string `dev-session-secret-change-me` anywhere in `src/`.
- [ ] The app still boots normally when `SESSION_SECRET` is set in `.env`.
- [ ] `.env.example` documents the requirement.

---

#### v2-P0-2 · File upload extension whitelist (kill stored-XSS via profile picture)

**Severity:** CRITICAL (HIGH if you only consider the class-of-30 threat model, but stored-XSS is stored-XSS).

**Files affected:** `src/server.js` (the Multer config).

**Current state (lines 59–72):**

```js
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(ROOT, "uploads")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);  // <-- attacker-controlled
      cb(null, `${req.user?.id || "anon"}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});
```

Two problems:
1. `fileFilter` trusts the client-supplied `Content-Type` header. An attacker can upload `evil.html` with `Content-Type: image/jpeg` and multer accepts it.
2. `filename` uses `path.extname(file.originalname)` — the original filename is attacker-controlled. So the file is saved as `<userId>-<timestamp>.html` and served from `/uploads/` with `Content-Type: text/html` (because `express.static` uses the file extension to set Content-Type).

Result: any logged-in student can upload an HTML file that executes JavaScript in every visitor's browser who clicks the link (e.g., the student's profile picture). Stored XSS.

**Required change:**

1. Whitelist the file extension AND validate the magic bytes (defensive). Use a fixed extension based on the detected MIME, not the user-supplied extension:

```js
import { fileTypeFromBuffer } from "file-type";  // optional — see note below

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
      // v2-P0-2: Use a whitelist-mapped extension, not the user-supplied one.
      // If the MIME is not in the whitelist, fileFilter already rejected it.
      const ext = ALLOWED_MIME[file.mimetype] || ".bin";
      cb(null, `${req.user?.id || "anon"}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // v2-P0-2: Reject any MIME not in the whitelist.
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME, file.mimetype)) {
      return cb(new Error("Only JPG, PNG, GIF, and WebP images are allowed"));
    }
    cb(null, true);
  },
});
```

2. **Optional hardening (defer if no network access for install):** add `file-type` (MIT, npm `file-type@^19`) to verify magic bytes server-side. This catches the case where an attacker spoofs the MIME header:

```js
import { fileTypeFromBuffer } from "file-type";

// Add to fileFilter — but note this is async, multer supports it:
fileFilter: async (req, file, cb) => {
  if (!ALLOWED_MIME[file.mimetype]) return cb(new Error("Only JPG/PNG/GIF/WebP allowed"));
  // Magic-byte check would require reading the file — Multer's fileFilter runs before
  // the file is buffered, so this is a TODO. For now, the MIME + extension whitelist
  // is sufficient defense against the original vector.
  cb(null, true);
},
```

3. **Defense in depth:** Add a `Content-Disposition: attachment` header to all `/uploads/` responses so browsers download rather than render. This is a 1-line change:

```js
app.use("/uploads", (req, res, next) => {
  res.setHeader("Content-Disposition", "attachment");
  next();
}, express.static(path.join(ROOT, "uploads")));
```

But this breaks `<img src="/uploads/...">` rendering — so DON'T do this. Instead, set `Content-Type` explicitly by extension on the way out, and only allow image types:

Actually, the cleanest defense is to put uploads OUTSIDE the web root and serve via a controller that validates the file exists, looks up the user's avatar record, and sets the right Content-Type. For now, the whitelist + fixed-extension save is sufficient.

**Acceptance criteria:**

- [ ] Uploading `evil.html` with `Content-Type: image/jpeg` is rejected with "Only JPG, PNG, GIF, and WebP images are allowed".
- [ ] Uploading a real `cat.jpg` succeeds and is saved as `<userId>-<timestamp>.jpg` (note: not `.jpeg` even if original was `.jpeg` — the whitelist maps both to `.jpg`).
- [ ] No file in `/uploads/` ever has a `.html`, `.svg` (SVG can carry JS), `.js`, or any non-image extension.
- [ ] Existing profile picture uploads still work.

---

#### v2-P0-3 · XSS in flashcard JSON injection

**Severity:** HIGH (requires moderator+ access to inject, but still a hole). Also affects any other `<%- JSON.stringify(...) %>` pattern.

**Files affected:** `src/views/flashcards/index.ejs` line 39, and audit any other view using the same pattern.

**Current state (`src/views/flashcards/index.ejs` lines 38–41):**

```ejs
<script>
  window.__FLASHCARDS__ = <%- JSON.stringify(cards) %>;
</script>
<script src="/js/flashcards.js"></script>
```

`<%-` is unescaped output. `JSON.stringify` does not escape `</script>`. If a moderator creates a flashcard with `front: '</script><script>alert(document.cookie)</script>'`, the inline script tag closes prematurely, the attacker's script runs in every student's browser when they view the flashcards page, and session cookies / leaderboard tampering / fake admin actions become possible.

The same pattern may exist elsewhere — grep for `<%- JSON.stringify` and `<%- .*\.stringify` in `src/views/`.

**Required change:**

1. In `src/views/flashcards/index.ejs`, replace line 39:

```ejs
<script>
  // v2-P0-3: Escape <, >, & and line separators so a malicious card
  // front/back can't close the script tag and inject markup.
  window.__FLASHCARDS__ = <%- JSON.stringify(cards).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') %>;
</script>
```

2. **Better — make this a helper.** Create `src/views/partials/safe-json.ejs`:

```ejs
<%
  // Outputs a JSON-encoded value with characters that can break out of a <script> tag escaped.
  // Use: <%- include('./partials/safe-json', { value: someObject }) %>
  function safeJson(v) {
    return JSON.stringify(v)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }
%>
```

Then in any view that needs to inject server data into a `<script>` block:

```ejs
<script>
  window.__FLASHCARDS__ = <%- safeJson(cards) %>;
</script>
```

Actually, since `safeJson` is a function, you can't `include()` it cleanly in EJS. Better approach: register it as an EJS local via `shareLocals.js` middleware:

```js
// src/middleware/shareLocals.js — add:
res.locals.safeJson = (v) => JSON.stringify(v)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
```

Then in any view:

```ejs
<script>
  window.__FLASHCARDS__ = <%- safeJson(cards) %>;
</script>
```

3. Grep the entire `src/views/` tree for `<%- JSON.stringify` and replace every occurrence with `<%- safeJson(...) %>` (after registering the helper in `shareLocals.js`). Likely places:

   - `src/views/flashcards/index.ejs` line 39 (confirmed)
   - `src/views/notes/editor.ejs` line 22 — uses `<%- JSON.stringify({ id: u.id, ... }) %>` inside a `data-unit='...'` attribute. This is XSS if a unit title contains `'` or `"`. Fix with `safeJson` or escape quotes properly.
   - `src/views/quizzes/editor.ejs` — likely has the same pattern for quiz items.
   - Any other view that injects a server-side object into a `data-*` attribute or `<script>` block.

**Acceptance criteria:**

- [ ] A moderator creates a flashcard with `front: '</script><script>alert(1)</script>'`. A student viewing `/flashcards` does NOT see an alert.
- [ ] The page still loads and the flashcard deck renders normally.
- [ ] `grep -r "<%- JSON.stringify" src/views/` returns zero matches (all migrated to `safeJson`).
- [ ] `safeJson` helper is registered in `shareLocals.js` and available in every EJS view.
- [ ] Notes editor "Edit unit" button still works after the `data-unit` attribute is hardened.

---

### P1 — HIGH (security + design consistency)

#### v2-P1-1 · CSRF protection (csrf package — finally ship it)

**Severity:** HIGH — any logged-in user visiting a malicious page can have POSTs submitted on their behalf (`/api/admin/promote`, `/api/admin/settings`, `/practice/:id/submit`, etc.). `sameSite: "lax"` on the session cookie mitigates top-level POSTs but doesn't cover all CSRF vectors.

**Files affected:** new `src/middleware/csrf.js`, `src/server.js`, `src/middleware/shareLocals.js`, every EJS form, every client-side `fetch()`.

This is the same task as v1's P2-1, deferred at the time. v2 ships it.

**Required change:**

1. Install `csrf` (already in the v1 install command, but verify): `npm install csrf@^3`.

2. Create `src/middleware/csrf.js`:

```js
import { tokens } from "csrf";

const csrf = new tokens();

// Attaches a fresh CSRF token to res.locals.csrfToken for every GET.
// Marks req.session.csrfSecret for the duration of the session.
export async function csrfToken(req, res, next) {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = await tokens().secret();
  }
  res.locals.csrfToken = await tokens().create(req.session.csrfSecret);
  next();
}

// Verifies the CSRF token on every non-GET request.
export async function csrfVerify(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const secret = req.session.csrfSecret;
  if (!secret) return res.status(403).json({ ok: false, error: "Missing CSRF secret" });
  // Token can come from the X-CSRF-Token header (for fetch) or the _csrf body field (for forms).
  const token = req.headers["x-csrf-token"] || (req.body && req.body._csrf);
  if (!token || !(await tokens().verify(secret, token))) {
    return res.status(403).json({ ok: false, error: "Invalid CSRF token" });
  }
  next();
}
```

3. Mount in `src/server.js`:

```js
import { csrfToken, csrfVerify } from "./middleware/csrf.js";

// After session middleware, before routes:
app.use(csrfToken);
app.use((req, res, next) => {
  // Apply csrfVerify to everything that's not a safe method.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return csrfVerify(req, res, next);
  }
  next();
});
```

4. Register `csrfToken` as an EJS local (already done by `csrfToken` middleware above — it sets `res.locals.csrfToken`). Also expose via a meta tag in the layout for client-side fetch:

   In `src/views/layouts/main.ejs` `<head>`, add:

```ejs
<meta name="csrf-token" content="<%= csrfToken %>" />
```

5. In every EJS form (`login.ejs`, `register.ejs`, `quizzes/take.ejs`, `flashcards/editor.ejs`, `admin/settings.ejs`, `profile.ejs`, etc.), add a hidden input:

```ejs
<input type="hidden" name="_csrf" value="<%= csrfToken %>" />
```

6. In `public/js/app.js`, set up a global fetch wrapper that auto-attaches the CSRF token:

```js
// v2-P1-1: Auto-attach CSRF token to every fetch POST/PUT/PATCH/DELETE.
window.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
const originalFetch = window.fetch;
window.fetch = (url, opts = {}) => {
  if (opts.method && !["GET", "HEAD"].includes(opts.method.toUpperCase())) {
    opts.headers = opts.headers || {};
    if (opts.headers instanceof Headers) {
      if (!opts.headers.has('X-CSRF-Token')) opts.headers.set('X-CSRF-Token', window.csrfToken);
    } else {
      if (!opts.headers['X-CSRF-Token']) opts.headers['X-CSRF-Token'] = window.csrfToken;
    }
  }
  return originalFetch(url, opts);
};
```

7. For the `data-method` links in `app.js` (the `<a data-method="post">` helper), include the CSRF token in the generated form:

```js
document.querySelectorAll('a[data-method]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const form = document.createElement('form');
    form.method = a.dataset.method;
    form.action = a.href;
    // v2-P1-1: Attach CSRF token.
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = '_csrf';
    csrfInput.value = window.csrfToken;
    form.appendChild(csrfInput);
    document.body.appendChild(form);
    form.submit();
  });
});
```

**Acceptance criteria:**

- [ ] All existing forms still work (they include the `_csrf` hidden input).
- [ ] A `fetch` POST without `X-CSRF-Token` header returns 403.
- [ ] A `fetch` POST with the correct `X-CSRF-Token` header works.
- [ ] Login flow works end-to-end.
- [ ] `/api/admin/promote` from a malicious origin (no token) returns 403.

---

#### v2-P1-2 · Bump multer to 2.x (kill known vuln)

**Severity:** MEDIUM-HIGH — `npm install` prints: `Multer 1.x is impacted by a number of vulnerabilities, which have been patched in 2.x`.

**Files affected:** `package.json`, `src/server.js` (verify the multer config still works).

**Required change:**

1. `npm install multer@^2`
2. Verify the existing multer config in `src/server.js` still works (the API is largely the same; multer 2.x has some minor breaking changes around error handling).

Multer 2.x changes to watch for:
- `fileFilter` callback now uses an `Error` object — same as 1.x, no change needed.
- The `diskStorage` API is unchanged.
- The `limits` API is unchanged.
- One breaking change: multer 2.x may throw differently for file size exceeded. Wrap upload routes in a try/catch and check for `MulterError`.

3. Add error handling middleware that catches Multer errors specifically:

```js
// In src/server.js, before the generic 500 handler:
app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    return res.status(400).json({ ok: false, error: err.message, code: err.code });
  }
  if (err.message === "Only JPG, PNG, GIF, and WebP images are allowed") {
    return res.status(400).json({ ok: false, error: err.message });
  }
  next(err);
});
```

**Acceptance criteria:**

- [ ] `npm install` no longer prints the multer 1.x vulnerability warning.
- [ ] Profile picture upload still works.
- [ ] Uploading a 6 MB file returns 400 with a clear error, not 500.

---

#### v2-P1-3 · Error message leak — stop exposing `err.message` to users

**Severity:** MEDIUM — `err.message` can include DB connection strings, file paths, stack details. Currently rendered to the user on the 500 page.

**Files affected:** `src/server.js` lines 107–110, every controller's `catch (err) { res.status(500).render("error/500", { message: err.message }); }`.

**Current state (`src/server.js` lines 107–110):**

```js
app.use((err, req, res, _next) => {
  console.error("[unhandled error]", err);
  res.status(500).render("error/500", { title: "Server Error", message: err.message });
});
```

**Required change:**

1. In `src/server.js`, change the global error handler to log full error server-side but show a generic message to the user:

```js
app.use((err, req, res, _next) => {
  console.error("[unhandled error]", err);
  // v2-P1-3: Don't leak err.message to the client — it can include DB URIs, file paths, etc.
  // In development, show the message for debugging; in production, hide it.
  const message = config.env === "production"
    ? "Something went wrong. The admin has been notified."
    : err.message;
  res.status(500).render("error/500", { title: "Server Error", message });
});
```

2. Same pattern in every controller's catch block. Grep for `message: err.message` in `src/controllers/`:

```bash
grep -rn "message: err.message" src/controllers/
```

Replace each occurrence with:

```js
res.status(500).render("error/500", {
  message: config.env === "production" ? "Something went wrong." : err.message,
});
```

(A simpler refactor: add a `safeErrorMessage(err)` helper in `src/middleware/shareLocals.js` and use it everywhere.)

3. **Optional but recommended:** add a `req_id` (UUID) to every request and include it in both the server log and the user-facing 500 page, so users can report the ID and the admin can find it in logs:

```js
import { randomUUID } from "node:crypto";

app.use((req, res, next) => {
  req.id = randomUUID();
  res.locals.reqId = req.id;
  next();
});

app.use((err, req, res, _next) => {
  console.error(`[unhandled error] req_id=${req.id}`, err);
  res.status(500).render("error/500", {
    title: "Server Error",
    message: "Something went wrong.",
    reqId: req.id,
  });
});
```

Update `src/views/error/500.ejs` to show the `reqId` so the user can report it:

```ejs
<p class="muted">Reference ID: <code><%= reqId %></code></p>
```

**Acceptance criteria:**

- [ ] With `NODE_ENV=production`, hitting a route that throws shows "Something went wrong." with no DB URI / file path.
- [ ] With `NODE_ENV=development`, the full `err.message` still shows for debugging.
- [ ] The 500 page shows a `reqId` that matches the server log.

---

#### v2-P1-4 · Input validation with Zod (actually use it)

**Severity:** MEDIUM — Zod is in `package.json` but barely used. Most controllers trust `req.body` shape.

**Files affected:** new `src/validations/*.js`, every controller's POST/PUT/PATCH handler.

**Required change:**

1. Create `src/validations/index.js` with one schema per route:

```js
import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_.-]+$/),
  name: z.string().min(1).max(60),
  password: z.string().min(6).max(128),
  confirm: z.string().optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createFlashcardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(2000),
  unit_id: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
});

export const createQuizSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  kind: z.enum(["practice", "live"]).default("practice"),
  unit_id: z.string().optional(),
  shuffle_items: z.boolean().default(true),
  shuffle_options: z.boolean().default(true),
  time_limit_min: z.number().int().min(1).max(180).optional(),
  deadline: z.string().optional(),
});

export const createQuizItemSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "identification", "open_ended"]),
  question: z.string().min(1).max(1000),
  image_url: z.string().url().optional().or(z.literal("")),
  correct_answer: z.string().max(500).optional(),
  explanation: z.string().max(1000).optional(),
  points: z.number().int().min(1).max(10).default(1),
  options: z.array(z.object({
    text: z.string().min(1).max(500),
    image_url: z.string().url().optional().or(z.literal("")),
    is_correct: z.boolean(),
  })).optional(),
});

export const promoteSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["student", "moderator", "administrator"]),
});

export const settingsSchema = z.object({
  anti_cheat: z.object({
    blockTabSwitch: z.boolean(),
    requireFullscreen: z.boolean(),
    blockCopy: z.boolean(),
    blockRightClick: z.boolean(),
    maxWarnings: z.number().int().min(1).max(10),
  }),
  time_limit_min: z.number().int().min(1).max(180).optional(),
  quiz_id: z.string().optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(60),
  bio: z.string().max(280).optional(),
  avatarColor: z.number().int().min(0).max(360).optional(),
  socials: z.object({
    twitter: z.string().max(60).optional(),
    instagram: z.string().max(60).optional(),
    github: z.string().max(60).optional(),
    facebook: z.string().max(60).optional(),
    tiktok: z.string().max(60).optional(),
    youtube: z.string().max(60).optional(),
    website: z.string().max(200).optional(),
  }).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});
```

2. Add a validation middleware helper:

```js
// src/middleware/validate.js
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        issues: result.error.issues,
      });
    }
    req.validated = result.data;
    next();
  };
}
```

3. Wire schemas into the routes that need them. For example, in `src/routes/index.js`:

```js
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema, createFlashcardSchema, /* etc. */ } from "../validations/index.js";

router.post("/login", authLimiter, validate(loginSchema), auth.login);
router.post("/register", authLimiter, validate(registerSchema), auth.register);
router.post("/api/flashcards", requireAuth, requireModerator, validate(createFlashcardSchema), flashcards.createPost);
router.post("/api/admin/promote", requireAuth, requireAdmin, validate(promoteSchema), admin.promote);
router.post("/api/admin/settings", requireAuth, requireAdmin, validate(settingsSchema), admin.updateSettings);
// etc.
```

4. Update controllers to use `req.validated` instead of `req.body`:

```js
// src/controllers/flashcardsController.js
export async function createPost(req, res) {
  try {
    const c = await createFlashcard(req.validated);  // <-- validated, not req.body
    res.json({ ok: true, card: c });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
```

5. For routes that use `express.urlencoded` (form-encoded POSTs like login/register/quiz submit), Zod parsing still works because express.urlencoded produces an object.

**Acceptance criteria:**

- [ ] `curl -X POST /login -d 'username={"$ne":null}&password=x'` returns 400 with a validation error (currently throws 500 because `.trim()` fails on object).
- [ ] `curl -X POST /api/flashcards -H "Content-Type: application/json" -d '{"front":"","back":"x"}'` returns 400 with `front: String must contain at least 1 character(s)`.
- [ ] All existing flows still work — login, register, quiz submit, flashcard create/edit, admin promote, settings save.

---

#### v2-P1-5 · Audit log of admin actions

**Severity:** MEDIUM — currently `logActivity` is called on auth + study actions, but NOT on admin actions like `/api/admin/promote`, `/api/admin/settings`, `/api/admin/start-session`, `/api/admin/advance-item`, `/api/admin/end-session`. There's no way to investigate "who promoted this student" or "who disabled anti-cheat".

**Files affected:** `src/controllers/adminController.js`.

**Required change:**

Add `await logActivity(req.user.id, req.user.name, "admin_action", "<description>")` calls in every admin controller method. For example:

```js
// src/controllers/adminController.js
import { logActivity } from "../services/leaderboard.js";

export async function startSession(req, res) {
  try {
    const session = await startLiveSession(req.body.quizId);
    await logActivity(req.user.id, req.user.name, "admin_action", `Started live session ${session._id} (quiz ${req.body.quizId})`);
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function advanceItem(req, res) {
  try {
    const session = await advanceLiveItem(req.params.sessionId, Number(req.body.itemIndex));
    await logActivity(req.user.id, req.user.name, "admin_action", `Advanced session ${req.params.sessionId} to item ${req.body.itemIndex}`);
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function endSession(req, res) {
  try {
    const session = await endLiveSession(req.params.sessionId);
    await logActivity(req.user.id, req.user.name, "admin_action", `Ended live session ${req.params.sessionId}`);
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updateSettings(req, res) {
  try {
    // ... existing logic ...
    await logActivity(req.user.id, req.user.name, "admin_action", `Updated anti-cheat settings`);
    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function promote(req, res) {
  try {
    const { userId, role } = req.validated;  // v2-P1-4
    if (!["student", "moderator", "administrator"].includes(role)) return res.status(400).json({ ok: false, error: "Invalid role" });
    const profile = await User.findByIdAndUpdate(userId, { role }, { new: true }).lean();
    await logActivity(req.user.id, req.user.name, "admin_action", `Promoted user ${userId} to ${role}`);
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
```

Update `realtime.js` to also log when admin emits socket events directly (currently `admin:start_session` etc. bypass the controller path):

```js
// In realtime.js, in the admin:start_session handler:
import { logActivity } from "./leaderboard.js";

socket.on("admin:start_session", async ({ sessionId }) => {
  if (!requireAdmin(socket)) {
    return socket.emit("live:error", { message: "Forbidden: admin role required" });
  }
  activeSessionId = sessionId;
  io.to(`session:${sessionId}`).emit("live:started", { sessionId });
  io.to("admin:live").emit("live:started", { sessionId });
  // v2-P1-5: Audit log.
  await logActivity(socket.data.userId, socket.data.userName, "admin_action", `Started live session ${sessionId} (socket)`);
});
```

(Same for `admin:end_session`. The `admin:advance_item` event fires too frequently to log every time — log only at the start and end of the session, not per-item advance.)

**Acceptance criteria:**

- [ ] Admin dashboard activity feed shows entries when admin starts/ends sessions, promotes users, or changes settings.
- [ ] Each entry includes the admin's display name and a clear description.

---

### P2 — MEDIUM (responsive + emoji removal + design polish)

This is the bulk of v2's user-facing work.

#### v2-P2-1 · Responsive CSS audit + fixes (admin settings roles section + everything else)

**Severity:** MEDIUM (UX) — the user reported that admin settings roles section breaks on phones. Broader audit shows the issue is everywhere.

**Files affected:** `public/css/style.css`, possibly every EJS view.

**Current state — the responsive issues:**

The CSS has one media query at line 393 that handles `.grid-3` and `.grid-4` collapsing to 2 columns. But:

1. **`.participant-row`** (line 357): `display: flex; align-items: center; gap: 0.5rem;` — no `flex-wrap`. With avatar + name + 1-2 buttons, on a 360px phone, the buttons overflow horizontally and the row scrolls off-screen. **This is the user's reported bug.**

2. **`.role-actions`** (line 438): `display: flex; gap: 0.4rem;` — no `flex-wrap`. Buttons of 100+ pixels each don't fit on a 360px row.

3. **`.leader-row`** (line 298): `display: flex; align-items: center; gap: 0.75rem;` — no `flex-wrap`. With rank + avatar + name + score, on a phone the score gets cut off.

4. **`.activity-row`** (line 320): `display: flex; align-items: center; gap: 0.5rem;` — no `flex-wrap`. With kind chip + name + detail + timestamp, on a phone the timestamp wraps weirdly or gets cut.

5. **`.unit-card-head`** (line 330): `display: flex; align-items: flex-start; gap: 0.75rem;` — `.unit-card-actions` has 3 buttons that don't fit on a 360px phone.

6. **`.part-row`** (line 334): `display: flex; align-items: center; gap: 0.5rem;` — name + buttons.

7. **`.grid-4`** (line 140): `repeat(auto-fill, minmax(180px, 1fr))` — at 360px, fits 2 columns (180*2 + gap = 372, just barely). But on 320px iPhone SE, only 1 column. Actually this one is fine — it auto-collapses. Verify.

8. **`.grid-2`** (line 138): `repeat(auto-fill, minmax(280px, 1fr))` — at 320px, only 1 column (280 + padding fits). Fine.

9. **`.grid-3`** (line 139): `repeat(auto-fill, minmax(240px, 1fr))` — at 320px, only 1 column. Fine.

10. **`.stat-row`** (line 211): `repeat(auto-fit, minmax(120px, 1fr))` — at 320px, fits 2 columns. Probably fine but verify on tiny screens.

11. **`.tabs`** (line 294): `display: flex; gap: 0.25rem; width: fit-content;` — on a phone, the tabs may overflow if there are many. For the leaderboard (Weekly + All-time = 2 tabs), fine. For anywhere else with 3+ tabs, could overflow.

12. **`.live-test-head`** — no specific class definition found, but it's flex with badge + timer + warning badge. Verify it wraps on phone.

13. **`.topbar-right`** in `layout-main.ejs` — has live-pill + user-chip. Should be fine but verify.

14. **`.sidebar` on mobile**: the sidebar toggle (`#menu-toggle`) exists in `app.js`. Verify the sidebar slides in/out properly on mobile.

**Required change:**

1. Add a comprehensive mobile-first responsive section at the end of `public/css/style.css`. Start with a mobile-first baseline and override up:

```css
/* ============================================================
   v2-P2-1: Responsive design system — mobile-first.
   All flex rows that hold variable content (avatar + name + actions)
   must wrap or stack on small screens.
   ============================================================ */

/* === Mobile baseline (default, < 640px) === */
.participant-row {
  flex-wrap: wrap;
  /* On phones: avatar + name on row 1, actions on row 2 (full width) */
}
.participant-row .role-actions {
  flex: 1 0 100%;  /* force actions to wrap to next line */
  justify-content: flex-start;
}
.participant-row .role-actions .btn {
  flex: 1 1 auto;
}

.leader-row {
  flex-wrap: wrap;
  /* rank + avatar + name on row 1, score moves below on phone */
}
.leader-row .leader-score {
  /* On phone, score goes to a new line */
}

.activity-row {
  flex-wrap: wrap;
  font-size: 0.8rem;
}
.activity-row .muted.small {
  width: 100%;
  text-align: right;
}

.unit-card-head {
  flex-wrap: wrap;
}
.unit-card-actions {
  flex-wrap: wrap;
  width: 100%;
  margin-top: 0.5rem;
}
.unit-card-actions .btn {
  flex: 1 1 auto;
}

.part-row {
  flex-wrap: wrap;
}
.part-row .icon-btn {
  /* Keep edit/delete buttons accessible */
}

.live-test-head {
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* === Tablet (>= 640px) === */
@media (min-width: 640px) {
  .participant-row .role-actions {
    flex: 0 0 auto;
  }
  .leader-row .leader-score {
    /* score back on the right */
  }
}

/* === Phone-only (< 480px) — extra-narrow fixes === */
@media (max-width: 479px) {
  .grid-2, .grid-3, .grid-4 {
    grid-template-columns: 1fr;  /* single column on tiny phones */
  }
  .stat-row {
    grid-template-columns: 1fr 1fr;  /* 2 columns of stat cards */
  }
  .tabs {
    width: 100%;  /* full width on phone */
  }
  .tab {
    flex: 1;
    text-align: center;
  }
  .app-topbar {
    /* Compact topbar on phone */
    padding: 0.5rem;
  }
  .page-title {
    font-size: 1.1rem;
  }
  .user-chip .user-name {
    display: none;  /* just show avatar on phone */
  }
}

/* === Sidebar behavior on mobile === */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -280px;
    width: 280px;
    height: 100vh;
    transition: left 0.2s ease;
    z-index: 100;
  }
  .sidebar.open {
    left: 0;
  }
  .app-main {
    width: 100%;
  }
  /* Backdrop when sidebar is open */
  .sidebar.open::after {
    content: '';
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: -1;
  }
}
```

2. **The specific admin-settings roles section fix** — make sure `.participant-row` with 1-2 action buttons wraps the actions below the name on phones. The CSS above handles this with `flex: 1 0 100%` on `.role-actions` within `.participant-row` in the mobile baseline.

3. **Audit the entire app on phone-width viewports.** Open Chrome DevTools responsive mode at 360px width and click through every route:
   - `/` (landing) — verify hero, cards, footer don't overflow
   - `/login`, `/register` — verify auth card fits
   - `/notes`, `/notes/:slug` — verify grid and content blocks
   - `/practice`, `/practice/:id` (take), `/practice/:id` (result) — verify quiz cards, option rows, review items
   - `/flashcards` — verify flashcard stage, controls
   - `/leaderboard` — verify leader rows
   - `/classmates` — verify classmate cards (grid-4)
   - `/profile`, `/profile/:id` — verify profile grid
   - `/admin` — verify dashboard, stat cards, activity list
   - `/admin/live-monitor` — verify participant list, activity feed
   - `/admin/host-live` — verify host panel
   - `/admin/live-editor` — verify quiz editor
   - `/admin/settings` — **the user-reported bug — verify roles section wraps correctly**
   - `/moderator/notes` — verify unit cards, part rows, modals
   - `/moderator/practice` — verify quiz editor
   - `/moderator/flashcards` — verify flashcard editor

   For each, take a screenshot at 360px width and at 768px width. Anything that overflows horizontally or is unreadable goes on a fix list.

4. **Tighten the layout for narrow phones (320px iPhone SE).** Test at 320px width too. Anything that breaks at 320px goes on a "fix or accept" list.

**Acceptance criteria:**

- [ ] `/admin/settings` Manage roles section: at 360px width, each user row shows avatar + name on line 1 and Promote/Demote buttons full-width on line 2. No horizontal scroll.
- [ ] `/admin/live-monitor` participant list: at 360px, avatar + name on line 1, badges + score on line 2.
- [ ] `/leaderboard` rows: at 360px, rank + avatar + name on line 1, score on line 2 (right-aligned).
- [ ] `/classmates` grid: at 360px, 1 column. At 480px, 2 columns. At 768px+, 4 columns.
- [ ] `/admin` dashboard grid: at 360px, 1 column. At 640px+, 3 columns.
- [ ] `/profile` grid: at 360px, 1 column (profile card + edit form stack).
- [ ] Sidebar slides in from left on `< 768px`, with a backdrop overlay when open.
- [ ] No horizontal scrollbar on any route at 360px width.

---

#### v2-P2-2 · Remove emojis from sidebar, replace with Lucide SVG icons

**Severity:** MEDIUM (design polish) — emojis look unprofessional and render differently across platforms (Windows, macOS, Android, iOS all show different emoji art).

**Files affected:** `src/views/partials/sidebar.ejs`, `src/views/layouts/main.ejs` (load Lucide).

**Current state (`src/views/partials/sidebar.ejs`):** Every nav link has an emoji:

```
📊 Dashboard
📡 Live Monitor (admin only)
📜 Test History
📋 Host Live Test
📝 Edit Live Test
✏️ Edit Notes
📝 Edit Practice
⚡ Edit Flashcards
📖 View Notes
🧠 Practice Quizzes
⚡ Flashcards
🏆 Leaderboard
👥 Classmates
⚙️ Settings
👤 Profile
```

Inconsistent — "Edit Notes" uses ✏️, "Edit Live Test" uses 📝, "Edit Practice" also uses 📝, "Edit Flashcards" uses ⚡. The icons don't differentiate. And emojis render with different art on different platforms (Windows has flat monochrome, macOS/Apple has 3D-style, Android has its own set).

**Required change:**

1. Install Lucide (already in v2 install command above).

2. In `src/views/layouts/main.ejs`, add Lucide from CDN in `<head>`:

```ejs
<script src="https://unpkg.com/lucide@^0.460/dist/umd/lucide.min.js" defer></script>
```

Or self-host by copying the file to `public/js/lucide.min.js` (preferred for offline resilience):

```bash
curl -s https://unpkg.com/lucide@^0.460/dist/umd/lucide.min.js -o public/js/lucide.min.js
```

And in `layout-main.ejs`:

```ejs
<script src="/js/lucide.min.js" defer></script>
```

3. Add a global `lucide.createIcons()` call at the bottom of `public/js/app.js`:

```js
// v2-P2-2: Replace all <i data-lucide="..."> elements with inline SVG icons.
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();
});
// Also re-run after any dynamic DOM update (e.g., after fetch-rendered content)
window.refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };
```

4. Rewrite `src/views/partials/sidebar.ejs` to use Lucide icons:

```ejs
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">
    <img src="/assets/stem-logo.jpeg" alt="STEM logo" class="brand-logo-img" />
    <div>
      <div class="brand-text">DNHS STEM Tesla <strong>Hub</strong></div>
      <div class="sidebar-sub">Biology 2 · Class Hub</div>
    </div>
  </div>
  <nav class="sidebar-nav">
    <% const role = user.role; %>
    <% if (role === 'administrator') { %>
      <a href="/admin" class="<%= path.startsWith('/admin') && path !== '/admin/settings' ? 'active' : '' %>">
        <i data-lucide="layout-dashboard"></i> <span>Dashboard</span>
      </a>
      <a href="/admin/live-monitor"><i data-lucide="radio"></i> <span>Live Monitor</span></a>
      <a href="/admin/live-history"><i data-lucide="history"></i> <span>Test History</span></a>
      <a href="/admin/host-live"><i data-lucide="play-circle"></i> <span>Host Live Test</span></a>
      <a href="/admin/live-editor"><i data-lucide="file-text"></i> <span>Edit Live Test</span></a>
      <a href="/moderator/notes"><i data-lucide="pencil-line"></i> <span>Edit Notes</span></a>
      <a href="/moderator/practice"><i data-lucide="clipboard-list"></i> <span>Edit Practice</span></a>
      <a href="/moderator/flashcards"><i data-lucide="layers"></i> <span>Edit Flashcards</span></a>
      <a href="/notes"><i data-lucide="book-open"></i> <span>View Notes</span></a>
      <a href="/leaderboard"><i data-lucide="trophy"></i> <span>Leaderboard</span></a>
      <a href="/classmates"><i data-lucide="users"></i> <span>Classmates</span></a>
      <a href="/admin/settings"><i data-lucide="settings"></i> <span>Settings</span></a>
      <a href="/profile"><i data-lucide="user"></i> <span>Profile</span></a>
    <% } else if (role === 'moderator') { %>
      <a href="/moderator/notes" class="<%= path.startsWith('/moderator') ? 'active' : '' %>"><i data-lucide="pencil-line"></i> <span>Edit Notes</span></a>
      <a href="/moderator/practice"><i data-lucide="clipboard-list"></i> <span>Edit Practice</span></a>
      <a href="/moderator/flashcards"><i data-lucide="layers"></i> <span>Edit Flashcards</span></a>
      <a href="/notes"><i data-lucide="book-open"></i> <span>Read Notes</span></a>
      <a href="/practice"><i data-lucide="brain"></i> <span>Practice Quizzes</span></a>
      <a href="/flashcards"><i data-lucide="layers"></i> <span>Flashcards</span></a>
      <a href="/leaderboard"><i data-lucide="trophy"></i> <span>Leaderboard</span></a>
      <a href="/classmates"><i data-lucide="users"></i> <span>Classmates</span></a>
      <a href="/profile"><i data-lucide="user"></i> <span>Profile</span></a>
    <% } else { %>
      <a href="/notes"><i data-lucide="book-open"></i> <span>Notes</span></a>
      <a href="/practice"><i data-lucide="brain"></i> <span>Practice Quizzes</span></a>
      <a href="/flashcards"><i data-lucide="layers"></i> <span>Flashcards</span></a>
      <a href="/leaderboard"><i data-lucide="trophy"></i> <span>Leaderboard</span></a>
      <a href="/classmates"><i data-lucide="users"></i> <span>Classmates</span></a>
      <a href="/profile"><i data-lucide="user"></i> <span>Profile</span></a>
    <% } %>
  </nav>
  <div class="sidebar-user">
    <div class="avatar" style="background: linear-gradient(135deg, oklch(0.65 0.18 <%= user.avatarColor %>), oklch(0.55 0.16 <%= (user.avatarColor || 0) + 30 %>));">
      <% if (user.avatarUrl) { %>
        <img src="<%= user.avatarUrl %>" alt="<%= user.name %>" class="avatar-img" />
      <% } else { %>
        <%= (user.name || '').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() %>
      <% } %>
    </div>
    <div class="sidebar-user-info">
      <div class="sidebar-user-name"><%= user.name %></div>
      <div class="sidebar-user-role">@<%= user.username %> · <%= user.role %></div>
    </div>
    <form method="post" action="/logout" style="margin:0">
      <input type="hidden" name="_csrf" value="<%= csrfToken %>" />
      <button type="submit" class="icon-btn" title="Sign out"><i data-lucide="log-out"></i></button>
    </form>
  </div>
</aside>
```

5. Add CSS for the new icon-based sidebar links:

```css
/* v2-P2-2: Sidebar nav with SVG icons instead of emojis */
.sidebar-nav a {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  font-size: 0.875rem;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.sidebar-nav a:hover {
  background: var(--bg-card-hover);
  color: var(--fg);
  text-decoration: none;
}
.sidebar-nav a.active {
  background: var(--accent-dim);
  color: var(--accent);
}
.sidebar-nav a svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.sidebar-nav a span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Sidebar user button */
.sidebar-user .icon-btn svg {
  width: 16px;
  height: 16px;
}
```

**Acceptance criteria:**

- [ ] Sidebar renders with SVG icons (test in Chrome DevTools — confirm `<i data-lucide="...">` becomes `<svg>` after page load).
- [ ] Icons are visually consistent (no emoji platform-rendering differences).
- [ ] Hover and active states still work.
- [ ] Logout button still functions.
- [ ] Mobile: sidebar toggle still works, icons render correctly when sidebar slides in.

---

#### v2-P2-3 · Remove emojis from admin dashboard cards

**Files affected:** `src/views/admin/dashboard.ejs`.

**Current state:** Every card has an emoji:
- 👥 Students (stat-card)
- 📊 Quizzes (stat-card)
- ⚡ Flashcards (stat-card)
- 🔴/⚪ Live status (stat-card)
- 📡 Live Monitor (card-link)
- ✏️ Edit Notes (card-link)
- 📝 Edit Live Test (card-link)
- 🧠 Edit Practice (card-link)
- ⚡ Edit Flashcards (card-link)
- ⚙️ Settings (card-link)

Also, the card-link URLs are inconsistent:
- `/subadmin/notes` doesn't exist as a route — should be `/moderator/notes`
- `/subadmin/practice` should be `/moderator/practice`
- `/subadmin/flashcards` should be `/moderator/flashcards`

(Bug: these links 404 for admins. Fix in the same patch.)

**Required change:**

```ejs
<div class="stat-row">
  <a href="/classmates" class="stat-card stat-link">
    <i data-lucide="users" class="stat-icon"></i>
    <div class="stat-val"><%= studentCount || 0 %></div>
    <div class="stat-label">Students</div>
  </a>
  <div class="stat-card">
    <i data-lucide="clipboard-list" class="stat-icon"></i>
    <div class="stat-val"><%= quizCount || 0 %></div>
    <div class="stat-label">Quizzes</div>
  </div>
  <div class="stat-card">
    <i data-lucide="layers" class="stat-icon"></i>
    <div class="stat-val"><%= cardCount || 0 %></div>
    <div class="stat-label">Flashcards</div>
  </div>
  <div class="stat-card">
    <i data-lucide="<%= activeSession ? 'radio' : 'circle' %>" class="stat-icon <%= activeSession ? 'live' : '' %>"></i>
    <div class="stat-val"><%= activeSession ? 'Live' : 'Idle' %></div>
    <div class="stat-label">Live status</div>
  </div>
</div>

<% if (activeSession) { %>
  <div class="card live-banner">
    <span class="live-pulse"></span>
    <div><strong>Live now:</strong> <%= activeSession.quizzes && activeSession.quizzes.title %><div class="muted small">Item <%= activeSession.current_item_index + 1 %></div></div>
    <a href="/admin/host-live" class="btn btn-primary">Open host panel</a>
  </div>
<% } else { %>
  <div class="card">
    <strong>No active session</strong>
    <p class="muted">Start a live test from the host panel.</p>
    <a href="/admin/host-live" class="btn btn-primary">Host live test</a>
  </div>
<% } %>

<div class="grid grid-3">
  <a href="/admin/live-monitor" class="card card-link"><div class="card-icon"><i data-lucide="radio"></i></div><h3>Live Monitor</h3><p class="muted">Real-time activity & scores</p></a>
  <a href="/moderator/notes" class="card card-link"><div class="card-icon"><i data-lucide="pencil-line"></i></div><h3>Edit Notes</h3><p class="muted">Add units, parts, blocks</p></a>
  <a href="/admin/live-editor" class="card card-link"><div class="card-icon"><i data-lucide="file-text"></i></div><h3>Edit Live Test</h3><p class="muted">Configure test items</p></a>
  <a href="/moderator/practice" class="card card-link"><div class="card-icon"><i data-lucide="clipboard-list"></i></div><h3>Edit Practice</h3><p class="muted">Manage practice quizzes</p></a>
  <a href="/moderator/flashcards" class="card card-link"><div class="card-icon"><i data-lucide="layers"></i></div><h3>Edit Flashcards</h3><p class="muted">Add or edit review cards</p></a>
  <a href="/admin/settings" class="card card-link"><div class="card-icon"><i data-lucide="settings"></i></div><h3>Settings</h3><p class="muted">Anti-cheat, deadlines, points</p></a>
</div>
```

Add CSS for `.stat-icon` and `.card-icon`:

```css
/* v2-P2-3: SVG icons in stat cards and link cards */
.stat-card { display: flex; align-items: center; gap: 0.75rem; }
.stat-icon { width: 24px; height: 24px; color: var(--accent); flex-shrink: 0; }
.stat-icon.live { color: var(--danger); }
.card-icon { margin-bottom: 0.5rem; }
.card-icon svg { width: 28px; height: 28px; color: var(--accent); }
```

**Acceptance criteria:**

- [ ] Dashboard cards render with SVG icons.
- [ ] "Edit Notes" link goes to `/moderator/notes` (was broken: `/subadmin/notes`).
- [ ] "Edit Practice" link goes to `/moderator/practice`.
- [ ] "Edit Flashcards" link goes to `/moderator/flashcards`.
- [ ] Live status shows "Live"/"Idle" text instead of just an emoji.

---

#### v2-P2-4 · Remove emojis from notes editor block picker

**Files affected:** `public/js/notes-editor.js` (lines 9–17), and any other place where `BLOCK_KINDS` icons are used.

**Current state:**

```js
const BLOCK_KINDS = [
  { kind: 'paragraph', label: 'Paragraph', icon: '📝' },
  { kind: 'heading', label: 'Heading', icon: '🔍' },
  { kind: 'bullet', label: 'Bullets', icon: '•' },
  { kind: 'numbered', label: 'Numbered', icon: '1.' },
  { kind: 'image', label: 'Image', icon: '🖼' },
  { kind: 'divider', label: 'Divider', icon: '─' },
  { kind: 'callout', label: 'Callout', icon: '💡' },
];
```

**Required change:**

Replace emoji `icon` field with a Lucide icon name:

```js
const BLOCK_KINDS = [
  { kind: 'paragraph', label: 'Paragraph', icon: 'pilcrow' },     // ¶
  { kind: 'heading', label: 'Heading', icon: 'heading' },          // H
  { kind: 'bullet', label: 'Bulleted list', icon: 'list' },
  { kind: 'numbered', label: 'Numbered list', icon: 'list-ordered' },
  { kind: 'image', label: 'Image', icon: 'image' },
  { kind: 'divider', label: 'Divider', icon: 'minus' },
  { kind: 'callout', label: 'Callout', icon: 'info' },
];
```

Then, wherever the icon is rendered in the DOM (the block-picker dropdown), use `<i data-lucide="${kind.icon}"></i>` instead of `${kind.icon}`:

```js
// In the block-picker render:
const btn = document.createElement('button');
btn.className = 'block-kind-btn';
btn.innerHTML = `<i data-lucide="${kind.icon}"></i> <span>${kind.label}</span>`;
btn.addEventListener('click', () => addBlock(kind.kind));
// After all buttons are in the DOM:
window.refreshIcons && window.refreshIcons();
```

For the callout variant picker (info/warning/success), the existing CSS uses `.callout-info` etc. with no emoji — that's already fine. But if there's an emoji in the variant selector dropdown, replace it the same way:

```js
const CALLOUT_VARIANTS = [
  { variant: 'info', label: 'Info', icon: 'info' },
  { variant: 'warning', label: 'Warning', icon: 'triangle-alert' },
  { variant: 'success', label: 'Success', icon: 'check-circle' },
];
```

**Acceptance criteria:**

- [ ] Block picker dropdown shows Lucide SVG icons (test by inspecting the rendered DOM).
- [ ] Callout variant selector (if present) shows SVG icons.
- [ ] `window.refreshIcons()` is called after every dynamic DOM update that adds `<i data-lucide>` elements.

---

#### v2-P2-5 · Remove emojis from profile social links + stats

**Files affected:** `src/views/profile.ejs`.

**Current state (line 42):**

```js
const icons = { twitter:'𝕏', instagram:'📷', github:'🐙', facebook:'f', tiktok:'🎵', youtube:'▶', website:'🌐' };
```

And the social input labels (lines 76–82):

```ejs
<div class="social-input"><span>𝕏 Twitter / X</span>...</div>
<div class="social-input"><span>📷 Instagram</span>...</div>
<div class="social-input"><span>🐙 GitHub</span>...</div>
<div class="social-input"><span>f Facebook</span>...</div>
<div class="social-input"><span>🎵 TikTok</span>...</div>
<div class="social-input"><span>▶ YouTube</span>...</div>
<div class="social-input"><span>🌐 Website</span>...</div>
```

And the stats (lines 99–103, 110–114):

```ejs
<div class="stat-val">🏆 <%= profileUser.points %></div>
<div class="stat-val">🔥 <%= profileUser.streakDays %></div>
<div class="stat-val">🧠 <%= profileUser.practiceQuizzesTaken %></div>
<div class="stat-val">⚡ <%= profileUser.flashcardsReviewed %></div>
```

**Required change:**

1. Replace the emoji icons with Lucide icon names. For the social chips:

```ejs
<%
  const icons = {
    twitter: 'twitter',
    instagram: 'instagram',
    github: 'github',
    facebook: 'facebook',
    tiktok: 'music-2',  // Lucide doesn't have a TikTok brand icon, use music
    youtube: 'youtube',
    website: 'globe',
  };
%>
```

Wait — Lucide removed brand icons in 2024 due to trademark concerns. The `twitter`, `github`, `instagram`, `youtube`, `facebook`, `tiktok` icons were deprecated. For brand icons, use `simple-icons` (also MIT) instead — but that's another package.

For v2, the pragmatic move is to keep the social-row as text labels (no icons at all), OR use generic icons:

```ejs
<%
  const icons = {
    twitter: 'at-sign',       // 𝕏 is a stylized "at" — at-sign works
    instagram: 'camera',
    github: 'code-2',
    facebook: 'facebook',    // still in lucide for now
    tiktok: 'music',
    youtube: 'play',
    website: 'globe',
  };
%>
```

Better: just use text labels in the chips (no icon, just the platform name):

```ejs
<a href="<%= href %>" target="_blank" rel="noopener noreferrer" class="social-chip social-<%= k %>" title="<%= k %>: <%= v %>">
  <span class="social-label"><%= k %></span>
</a>
```

And style each platform with a brand color:

```css
.social-chip {
  display: inline-flex; align-items: center;
  padding: 0.4rem 0.75rem; border-radius: 999px;
  background: var(--bg-card); border: 1px solid var(--border);
  font-size: 0.75rem; text-transform: capitalize; color: var(--fg-muted);
  transition: all 0.15s;
}
.social-chip:hover { color: var(--fg); border-color: var(--border-strong); }
.social-twitter:hover { background: rgba(29, 161, 242, 0.15); color: #1da1f2; }
.social-instagram:hover { background: rgba(225, 48, 108, 0.15); color: #e1306c; }
.social-github:hover { background: rgba(110, 118, 129, 0.15); color: #fff; }
.social-facebook:hover { background: rgba(24, 119, 242, 0.15); color: #1877f2; }
.social-tiktok:hover { background: rgba(0, 242, 234, 0.15); color: #00f2ea; }
.social-youtube:hover { background: rgba(255, 0, 0, 0.15); color: #ff0000; }
.social-website:hover { background: var(--accent-dim); color: var(--accent); }
```

2. For the social input labels in the edit form, drop the emoji entirely:

```ejs
<div class="social-input"><label>Twitter / X</label><input data-k="twitter" value="<%= socials.twitter || '' %>" placeholder="@handle" /></div>
<div class="social-input"><label>Instagram</label><input data-k="instagram" value="<%= socials.instagram || '' %>" placeholder="@handle" /></div>
<!-- etc. -->
```

3. For the stats, replace emojis with Lucide icons:

```ejs
<div class="stat-card">
  <i data-lucide="trophy" class="stat-icon"></i>
  <div class="stat-val"><%= profileUser.points %></div>
  <div class="stat-label">Total points</div>
</div>
<div class="stat-card">
  <i data-lucide="flame" class="stat-icon"></i>
  <div class="stat-val"><%= profileUser.streakDays %></div>
  <div class="stat-label">Day streak</div>
</div>
<div class="stat-card">
  <i data-lucide="brain" class="stat-icon"></i>
  <div class="stat-val"><%= profileUser.practiceQuizzesTaken %></div>
  <div class="stat-label">Quizzes taken</div>
</div>
<div class="stat-card">
  <i data-lucide="layers" class="stat-icon"></i>
  <div class="stat-val"><%= profileUser.flashcardsReviewed %></div>
  <div class="stat-label">Cards reviewed</div>
</div>
```

4. After the page renders, call `window.refreshIcons()` to materialize the SVGs.

**Acceptance criteria:**

- [ ] Profile social chips show text labels (or generic icons), not emojis.
- [ ] Profile edit form has clean text labels, no emojis.
- [ ] Stats cards have SVG icons.
- [ ] Hover on each social chip uses the brand color.

---

#### v2-P2-6 · Remove emojis from leaderboard + classmates + live monitor

**Files affected:** `src/views/leaderboard.ejs`, `src/views/classmates.ejs`, `src/views/admin/live-monitor.ejs`, `src/views/admin/host-live.ejs`.

**Current state — leaderboard:**
```ejs
<button class="tab active" data-tab="weekly">📅 Weekly</button>
<button class="tab" data-tab="alltime">🏆 All-time</button>
<!-- and in each row: -->
<div class="muted small">🔥 <%= u.streakDays %>d streak</div>
```

**Current state — classmates:**
```ejs
<span class="adviser-crown">👑</span>
<p class="muted">👥 <%= students.length %> classmates</p>
<p class="muted small">🔥 <%= u.streakDays %>d · <%= u.points %> pts</p>
```

**Current state — live monitor:**
```ejs
<% if (p && p.warnings > 0) { %><span class="badge warn">⚠️ <%= p.warnings %></span><% } %>
```

**Required change:**

1. Leaderboard tabs — replace emojis with SVG icons inline:

```ejs
<button class="tab active" data-tab="weekly"><i data-lucide="calendar"></i> Weekly</button>
<button class="tab" data-tab="alltime"><i data-lucide="trophy"></i> All-time</button>
```

For the streak in each row, drop the emoji entirely:

```ejs
<div class="muted small"><%= u.streakDays %>d streak</div>
```

(Or use `<i data-lucide="flame"></i>` if you want the fire visual.)

2. Classmates — replace the 👑 with a Lucide `crown` icon, and the 👥 with `users`:

```ejs
<span class="adviser-crown"><i data-lucide="crown"></i></span>
<p class="muted"><i data-lucide="users"></i> <%= students.length %> classmates</p>
<p class="muted small"><i data-lucide="flame"></i> <%= u.streakDays %>d · <%= u.points %> pts</p>
```

3. Live monitor warning badge — replace ⚠️ with `triangle-alert`:

```ejs
<% if (p && p.warnings > 0) { %>
  <span class="badge warn"><i data-lucide="triangle-alert"></i> <%= p.warnings %></span>
<% } %>
```

4. Call `window.refreshIcons()` after each view's DOM is ready.

**Acceptance criteria:**

- [ ] No emojis in leaderboard, classmates, live monitor.
- [ ] All icons render as SVG.
- [ ] Tabs still switch between Weekly and All-time.

---

#### v2-P2-7 · Design consistency audit — fix inline styles, palette drift, spacing

**Files affected:** all EJS views, `public/css/style.css`.

The codebase has several consistency issues that make it feel "vibe coded":

1. **Inline `style="..."` attributes everywhere** — every avatar uses:
   ```ejs
   style="background: linear-gradient(135deg, oklch(0.65 0.18 <%= user.avatarColor %>), oklch(0.55 0.16 <%= (user.avatarColor || 0) + 30 %>));"
   ```
   This is duplicated in `sidebar.ejs`, `layout-main.ejs` (topbar), `classmates.ejs`, `leaderboard.ejs`, `profile.ejs`, `admin/settings.ejs`, `admin/live-monitor.ejs`. Move to a CSS class + a `--avatar-hue` custom property:

   ```css
   .avatar {
     background: linear-gradient(135deg,
       oklch(0.65 0.18 var(--avatar-hue, 200)),
       oklch(0.55 0.16 calc(var(--avatar-hue, 200) + 30)));
   }
   ```

   And every avatar element:
   ```ejs
   <div class="avatar" style="--avatar-hue: <%= user.avatarColor %>;">
   ```

   One style attribute, one CSS rule.

2. **Inconsistent `.muted.small` vs `.small.muted` vs `<small class="muted">`** — pick one and stick with it. Audit and normalize.

3. **Inconsistent button sizing** — `btn-sm`, `btn-primary`, `btn-outline`, sometimes `.dashed`, sometimes `.w-full`. Define a clear button system in CSS and use consistently.

4. **Spacing inconsistency** — some sections use `1rem` margin, some use `1.5rem`, some use `2rem`. Standardize on a spacing scale (e.g., `0.5, 0.75, 1, 1.5, 2, 3` rem) and use CSS variables:

   ```css
   :root {
     --space-1: 0.5rem;
     --space-2: 0.75rem;
     --space-3: 1rem;
     --space-4: 1.5rem;
     --space-5: 2rem;
     --space-6: 3rem;
   }
   ```

5. **`<hr class="my" />` in profile.ejs** — `.my` isn't a standard utility. Replace with `.margin-y` or use `<div class="separator"></div>` with `--space-4` margin.

6. **Color drift** — some places use `rgba(255,255,255,0.04)` for backgrounds, others use `var(--bg-card)`. Some places use `#8b95b3` for muted text, others use `var(--fg-muted)`. Audit and replace literal values with CSS variables.

7. **`.kicker.admin` vs `.kicker`** — `admin` variant exists for the kicker. Define what it does and use consistently.

8. **`.block` utility class** — used in `classmates.ejs` (`<strong class="block mt">`) but not defined in CSS. Add it or remove the class.

**Required change:**

Audit `public/css/style.css` and every EJS view. Create a list of inconsistencies. Refactor in batches:

- Batch 1: Move all avatar inline styles to CSS variables (one PR).
- Batch 2: Replace literal color/spacing values with CSS variables.
- Batch 3: Define button system, spacing scale, typography scale in `:root`.
- Batch 4: Standardize utility classes (`.muted.small`, `.block`, `.my`, etc.).

**Acceptance criteria:**

- [ ] No `style="background: linear-gradient..."` inline styles for avatars (all use `--avatar-hue`).
- [ ] Every button uses the documented button system.
- [ ] No literal `#8b95b3` or `rgba(255,255,255,...)` in EJS views.
- [ ] Spacing uses the `--space-N` scale.

---

### P3 — LOW (cleanup)

#### v2-P3-1 · Favicon + meta tags polish

**Files affected:** `src/views/layouts/main.ejs`.

Add a favicon link, Open Graph tags, theme-color, and apple-touch-icon. Use the existing STEM logo.

**Required change:**

```ejs
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><%= typeof title !== 'undefined' ? title : 'STEM Tesla BioHub' %> · STEM Tesla BioHub</title>
  <meta name="description" content="STEM Tesla BioHub — Biology 2 class study hub: notes, practice quizzes, flashcards, live tests, leaderboard." />
  <meta name="theme-color" content="#0a1228" />
  <link rel="icon" type="image/jpeg" href="/assets/stem-logo.jpeg" />
  <link rel="apple-touch-icon" href="/assets/stem-logo.jpeg" />
  <meta property="og:title" content="DNHS STEM Tesla Hub — Biology 2" />
  <meta property="og:description" content="Notes, practice quizzes, flashcards, live tests, leaderboard for the Tesla STEM Biology 2 class at Dangcagan National High School." />
  <meta property="og:image" content="/assets/stem-logo.jpeg" />
  <meta property="og:type" content="website" />
  <!-- ... existing font + CSS links ... -->
</head>
```

Also: convert `stem-logo.jpeg` to a 32×32 PNG favicon. Either run:

```bash
convert public/assets/stem-logo.jpeg -resize 32x32 public/assets/favicon.png  # if ImageMagick available
```

Or use an online tool. Then update the `<link rel="icon">` to point to `/assets/favicon.png`.

**Acceptance criteria:**

- [ ] Browser tab shows the STEM logo as favicon.
- [ ] Mobile "Add to Home Screen" shows the logo.
- [ ] Open Graph tags work (test with the Facebook debugger or just `curl`).

---

#### v2-P3-2 · Move inline toast styles to CSS

**Files affected:** `public/js/app.js` (lines 24–31), `public/css/style.css`.

**Current state:** Toast styles are inline in JS via `el.style.cssText = '...'`. Hard to maintain.

**Required change:** Move to CSS (already in v1 P3-6 spec, but v1 deferred it). v2 ships it.

In `public/css/style.css`:

```css
.toast {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.25rem;
  background: rgba(10, 18, 40, 0.95);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: #fff;
  font-size: 0.875rem;
  z-index: 200;
  backdrop-filter: blur(10px);
  animation: toast-in 0.2s ease-out;
}
.toast-success { border-color: var(--accent); color: #a3e3c5; }
.toast-error { border-color: var(--danger); color: #fca5a5; }

@keyframes toast-in {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
```

In `public/js/app.js`:

```js
window.toast = (msg, type = 'default') => {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
};
```

**Acceptance criteria:**

- [ ] No `el.style.cssText` in `public/js/app.js`.
- [ ] Toast animations work.
- [ ] Success/error toasts use the right colors.

---

#### v2-P3-3 · README: document the v2 patches in CHANGELOG

**Files affected:** `CHANGELOG.md`, `README.md`.

After all v2 patches ship, update `CHANGELOG.md` with a v2 section listing every task ID, and update the README's "Security" / "Anti-cheat" / "Project structure" sections to reflect the new state.

**Acceptance criteria:**

- [ ] `CHANGELOG.md` has a `## v2 — Security hardening + design polish` section.
- [ ] Every task ID in this prompt appears in the changelog with status: shipped or deferred.
- [ ] README's "Getting started" section mentions CSRF token requirement (forms now need `_csrf`).

---

## 4. Suggested Execution Order

1. **v2-P0-1 (SESSION_SECRET fallback)** — 1 line, do first because it's the worst security bug.
2. **v2-P0-2 (file upload whitelist)** — 5 lines, same security tier.
3. **v2-P0-3 (XSS in flashcard JSON)** — 1 line per view + the helper. Tightest coupled with v2-P1-4 (validation) — could batch.
4. **v2-P1-2 (multer 2.x upgrade)** — needed before v2-P0-2 fully works (the multer error handler change).
5. **v2-P1-1 (CSRF)** — biggest single task. Do after security P0s are in.
6. **v2-P1-3 (error leak)** — small, can be parallel.
7. **v2-P1-4 (Zod validation)** — bigger, do after CSRF is in.
8. **v2-P1-5 (audit log)** — small.
9. **v2-P2-2 (Lucide sidebar)** — first design task, gets Lucide loaded.
10. **v2-P2-3 (admin dashboard)** — uses Lucide.
11. **v2-P2-4 (notes editor)** — uses Lucide.
12. **v2-P2-5, v2-P2-6 (profile, leaderboard, classmates, live monitor)** — emoji removal batch.
13. **v2-P2-1 (responsive)** — do last in P2 because the design changes are settled.
14. **v2-P2-7 (design consistency)** — polish pass after all the above.
15. **v2-P3-1, v2-P3-2, v2-P3-3** — final cleanup.

---

## 5. Global Acceptance Checklist

Run through this list BEFORE declaring the work complete. Every box must be ticked.

### Security

- [ ] With `SESSION_SECRET` unset in `.env`, `npm run dev` exits with a clear error.
- [ ] Uploading `evil.html` with `Content-Type: image/jpeg` is rejected.
- [ ] No file in `/uploads/` ever has a non-image extension.
- [ ] A flashcard with `front: '</script><script>alert(1)</script>'` does NOT trigger XSS on `/flashcards`.
- [ ] `grep -r "<%- JSON.stringify" src/views/` returns zero matches.
- [ ] A POST request without `X-CSRF-Token` header (or `_csrf` form field) returns 403.
- [ ] `npm install` does NOT print the multer 1.x vulnerability warning.
- [ ] With `NODE_ENV=production`, the 500 page does not include `err.message` (DB URIs, etc.).
- [ ] `curl -X POST /api/flashcards -H "Content-Type: application/json" -d '{"front":"","back":"x"}'` returns 400 with a Zod validation error.
- [ ] Admin actions (start session, promote, settings update) appear in the activity feed.

### Functional

- [ ] `npm install` succeeds.
- [ ] `npm run db:seed` exits 0.
- [ ] `npm run dev` boots, `http://localhost:3000` loads the landing page.
- [ ] Register a new account → it becomes administrator automatically.
- [ ] Register a second account → it's a `student`.
- [ ] Student can read notes, take a practice quiz, see a per-item breakdown (v1 P1-1 still works).
- [ ] Student can review flashcards.
- [ ] Admin can start a live test → student sees the first item within 500ms (v1 P1-4 still works).
- [ ] Admin advances → student sees the next item via socket push.
- [ ] All forms (login, register, quiz submit, profile edit, admin settings) include the `_csrf` hidden input.

### Responsive (verify at 360px AND 768px width)

- [ ] `/admin/settings` Manage roles section: no horizontal scroll on phone.
- [ ] `/admin/live-monitor`: no horizontal scroll on phone.
- [ ] `/leaderboard`: rows wrap correctly on phone.
- [ ] `/classmates`: 1 column on phone, 4 on desktop.
- [ ] `/admin` dashboard: 1 column on phone, 3 on desktop.
- [ ] `/profile`: stacks vertically on phone.
- [ ] Sidebar slides in/out on `< 768px`.
- [ ] No horizontal scrollbar on any route at 360px.

### Design

- [ ] Sidebar uses Lucide SVG icons (no emojis).
- [ ] Admin dashboard uses SVG icons.
- [ ] Notes editor block picker uses SVG icons.
- [ ] Profile social links have no emojis (text labels or generic icons).
- [ ] Leaderboard tabs use SVG icons.
- [ ] Classmates adviser crown is SVG.
- [ ] Live monitor warning badge is SVG.
- [ ] Favicon shows in browser tab.
- [ ] Toast styles are in CSS, not inline JS.
- [ ] All avatars use `--avatar-hue` CSS variable, no inline `linear-gradient` strings.

### Data integrity

- [ ] Existing seed (`npm run db:seed`) creates the same data as before.
- [ ] Old `QuizAttempt` documents without `responses` still render on the result page (v1 P1-1 backward-compat preserved).
- [ ] v1 patches are intact (verify with `git log` and the pre-flight checks in §1).

---

## 6. Worklog protocol

After every task, append to `/home/z/my-project/worklog.md`:

```markdown
---
Task ID: v2-P0-1
Agent: <agent name>
Task: Kill the SESSION_SECRET fallback (fail-closed)

Work Log:
- Removed fallback string from required() call in src/config/env.js
- Updated required() helper to distinguish missing from empty string
- Updated .env.example with stronger warning about SESSION_SECRET
- Verified: app exits cleanly when SESSION_SECRET is unset

Stage Summary:
- v2-P0-1 fixed in one commit
- Acceptance criteria all green
- This unblocks v1 P0-3 (session-based socket auth) — without this fix, the session secret was publicly known
```

---

## 7. Stop conditions

If you hit any of these, stop and report back instead of pushing forward:

1. `npm install` fails after the multer 2.x upgrade — check the breaking changes log.
2. Lucide icons don't render — verify the `lucide.createIcons()` call is firing after the DOM is ready (defer script).
3. CSRF token breaks existing forms — verify the `csrfToken` is being passed to every EJS view via `shareLocals.js`.
4. v1 patches are missing from the branch — STOP, the branch state is wrong, re-verify against `fix/p0-critical`.
5. You discover a security issue not covered by this prompt. Report it; don't silently fix.

---

## 8. Done definition

All P0 tasks complete. At least P1-1, P1-2, P1-3 complete. At least P2-1, P2-2, P2-3, P2-4 complete (responsive + Lucide sidebar + admin dashboard + notes editor — the visible polish). The Global Acceptance Checklist is fully green. The worklog shows every task ID you completed. The CHANGELOG has a v2 section. The README documents the new CSRF requirement.

The remaining P2/P3 tasks (profile social, leaderboard, classmates, live monitor, favicon, toast CSS) can be deferred if the user is satisfied with the visible polish. Document what's deferred in `CHANGELOG.md`.

---

## 9. Diff against v1

For agents picking this up cold — here's what's new in v2 vs the v1 spec (`master-fix-prompt.md`):

| v1 task | v1 status | v2 follow-up |
|---------|-----------|--------------|
| P0-1 (server-side scoring) | Shipped | None — verified intact |
| P0-2 (admin role check) | Shipped | None |
| P0-3 (session socket auth) | Shipped | **v2-P0-1 unblocks this** — without the SESSION_SECRET fix, the session the socket reads can be forged |
| P0-4 (password_hash removal) | Shipped | None |
| P1-1 (per-item breakdown) | Shipped | None |
| P1-2 (rate limiting) | Shipped | None |
| P1-4 (single persistent socket) | Shipped | None |
| P2-2 (username enumeration) | Shipped | None |
| P2-6 (login loading state) | Shipped | None |
| **NEW v2-P0-2** (file upload whitelist) | Not in v1 | **v2 ships it** |
| **NEW v2-P0-3** (XSS in flashcard JSON) | Not in v1 | **v2 ships it** |
| **NEW v2-P1-1** (CSRF) | Deferred in v1 (P2-1) | **v2 ships it** |
| **NEW v2-P1-2** (multer 2.x) | Not in v1 | **v2 ships it** |
| **NEW v2-P1-3** (error leak) | Not in v1 | **v2 ships it** |
| **NEW v2-P1-4** (Zod validation) | Not in v1 | **v2 ships it** |
| **NEW v2-P1-5** (audit log) | Not in v1 | **v2 ships it** |
| **NEW v2-P2-1** (responsive) | Not in v1 | **v2 ships it** — user-reported bug |
| **NEW v2-P2-2..7** (emoji removal + design polish) | Not in v1 | **v2 ships it** — user-reported "vibe-coded" aesthetic |
| **NEW v2-P3-x** | Not in v1 | favicon, toast CSS, CHANGELOG |

If v1's P1-7 (ts-fsrs SRS) or P1-8 (bulk-add flashcards) are still TODO, they remain on the v2 backlog — but they're feature work, not security/design. v2 prioritizes the foundation so future feature work can proceed without security debt.

---

*End of v2 master prompt. Hand this file to any code agent (Claude, Cursor, Super Z, etc.) and they should be able to execute end-to-end against the `fix/p0-critical` branch of `ryzishin/dnhs-stem-tesla-hub`.*
