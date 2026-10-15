# Master Fix Prompt — DNHS STEM Tesla Hub (Biology 2)

**Repository:** `github.com/ryzishin/dnhs-stem-tesla-hub`
**Branch to work against:** `master`
**Default branch:** `master`
**Stack:** Node.js 18+ · Express 4 · EJS · Mongoose 8 · Socket.IO 4 · Zod · bcryptjs · Helmet
**Project type:** ES module (`"type": "module"` in `package.json`)
**Target user:** A single class section (Tesla STEM — Biology 2 at Dangcagan National High School)

---

## 0. Agent Briefing

You are an autonomous code agent. Your job is to apply the fixes described in this prompt to the repository above, working in priority order (P0 → P1 → P2 → P3). Treat this document as authoritative — it was generated from a full audit of the `master` branch.

**Hard constraints — do NOT break these:**

1. Do not change the role system (`student` / `moderator` / `administrator`) or the "first registered account becomes admin" rule (`authController.register` line 50–55).
2. Do not change the EJS templating approach or introduce a SPA framework. The project is server-rendered and stays that way.
3. Do not change the Mongoose connection config or rename existing collections. New collections are fine; migrations to existing collections must be backward-compatible (add fields with defaults, never rename or remove).
4. Do not change the route paths in `src/routes/index.js` that the sidebar (`src/views/partials/sidebar.ejs`) depends on.
5. Do not switch authentication libraries. The custom `bcryptjs` + `express-session` + `connect-mongo` setup is intentional and stays.
6. Do not introduce TypeScript. The project is plain ESM JS. Type hints via JSDoc are acceptable; `.ts` files are not.
7. Preserve the existing visual design language — dark navy `#0a1228` + Biology green `#10b981`, Inter font, OKLCH avatars. Match new UI to existing `public/css/style.css` conventions.
8. Every change must keep `npm run dev` booting and `npm run db:seed` succeeding with zero manual steps.

**Soft constraints — respect unless you have a good reason:**

1. One commit per task (e.g., `P0-1: server-side live test scoring`). Tag the task ID in the commit subject.
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
npm install
cp .env.example .env  # if .env.example doesn't exist, create it from README
# Fill MONGODB_URI, MONGODB_DB_NAME, SESSION_SECRET, PUBLIC_URL in .env
npm run db:seed
npm run dev
# Confirm http://localhost:3000 loads and /register works.
```

If `npm install` fails on `bcryptjs`, ensure Node 18+. If `npm run db:seed` fails, the MongoDB connection string in `.env` is wrong — fix and re-run.

---

## 2. MIT-Licensed Library Recommendations

After checking licenses on npm and GitHub, here is the recommended set of MIT-licensed additions. All other needs can be met with the existing dependencies (`zod`, `bcryptjs`, `helmet`, `cookie-parser`, `express-session`, `connect-mongo`, `multer`, `socket.io`, `mongoose`).

### Comparison table

| Concern | Recommended (MIT) | Why not the alternatives |
|---------|------------------|--------------------------|
| Spaced repetition | **`ts-fsrs`** (MIT, npm `ts-fsrs@5.x`, GitHub `open-spaced-repetition/ts-fsrs`) — FSRS-6 algorithm | `srs.js` on npm is the Sender Rewriting Scheme for email, NOT a flashcard library — do not use. SM-2 is public-domain (the algorithm itself) but `ts-fsrs` is FSRS-6, the data-driven successor used by Anki's official FSRS add-on. More accurate, MIT, TypeScript-native, ESM-compatible. |
| CSRF | **`csrf`** (MIT, npm `csrf@3.x`) — low-level token creation + verification | `csurf` (expressjs/csurf) is officially **archived** as of 2024. Don't use it. The `csrf` package is the maintained, low-level primitive; you wrap it in a small middleware. |
| Rate limiting | **`express-rate-limit`** (MIT, npm `express-rate-limit@7.x`, 3.3k stars) | `rate-limiter-flexible` is more powerful but overkill for a single-process app. `express-rate-limit` is the standard, has a `memory-store` default that's fine for one Render/Railway instance. |
| Markdown rendering (for notes `paragraph` blocks) | **`marked`** (MIT, npm `marked@14.x`) | `markdown-it` is more extensible but heavier. `remark` is overkill. `marked` is the simplest reliable choice. |
| CSV parsing (for bulk flashcard import) | **`csv-parse`** (MIT, npm `csv-parse@5.x`, from `adaltas/node-csv`) | `papaparse` works but is browser-oriented; `csv-parse` is server-native, sync/async/stream APIs, better for backend bulk import. |
| Test framework | **`vitest`** (MIT, npm `vitest@2.x`, 17k stars) — ESM-native | The project is ESM (`"type": "module"`). Jest has ESM friction. `node:test` is zero-dependency but lacks the fixture/coverage tooling. Vitest is the right balance. |

### Install command (run once at start, after `npm install`):

```bash
npm install ts-fsrs@^5 csrf@^3 express-rate-limit@^7 marked@^14 csv-parse@^5
npm install -D vitest@^2
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

### What NOT to add

- **Passport / passport-local** — already met by custom auth; switching is disruptive and adds no value.
- **`csurf`** — archived.
- **`helmet-cross-origin`** etc. — Helmet is already wired with a custom CSP in `src/server.js`; don't touch it without re-reading lines 30–50.
- **TypeScript runtime type checkers (e.g., `zod-to-ts`)** — already using Zod; do not duplicate.
- **WebSocket auth libraries** — the fix is 20 lines of cookie-session lookup, no package needed.

---

## 3. Task Catalog

Tasks are ordered by priority. P0 must all be done before P1. Within a priority tier, the order is the recommended execution order.

### P0 — CRITICAL (security / data integrity)

#### P0-1 · Server-side live test scoring

**Severity:** CRITICAL — current implementation either always scores 0 (multiple-choice) or is fully exploitable (any score sent by client is trusted).

**Files affected:**

- `src/services/realtime.js` — lines 65–75 (`live:submit` handler)
- `src/views/live-test/take.ejs` — lines 54–73 (`submitAnswer`)
- `src/routes/index.js` — lines 95–120 (`/api/live-test/current` — already correct, leave alone)
- `src/services/quizzes.js` — uses existing `gradeAttempt` function (line 205)

**Current state:**
The client (`live-test-take.ejs` line 56–68) computes `score` itself by looking at `o.is_correct`, which has been stripped by the server before sending. So either the client always sees `correct === undefined` and sends `score: 0` (silent fail) — or, if the safeItems filter is later loosened, it sends arbitrary scores. The server (`realtime.js` line 65–75) blindly trusts the `score` field.

**Required change:**

1. **Server becomes the source of truth.** The `live:submit` event must receive `{ sessionId, itemId, answer }` only — never `score`. The server looks up the correct answer server-side and computes the score.

2. **In `src/services/realtime.js`**, replace the `live:submit` handler (lines 65–75) with:

```js
import { gradeAttempt, getActiveLiveSession } from "./quizzes.js";

// inside io.on("connection", ...)
socket.on("live:submit", async ({ sessionId, itemId, answer }) => {
  if (!sessionId || !itemId) return;
  const session = await LiveSession.findById(sessionId).lean();
  if (!session || session.status !== "active") {
    return socket.emit("live:error", { message: "Session not active" });
  }

  // Load the quiz items fresh — DO NOT trust the client about which item is current.
  const full = await getActiveLiveSession();
  if (!full || full.id !== sessionId) {
    return socket.emit("live:error", { message: "Session not found" });
  }
  const item = (full.quizzes.items || []).find((it) => it.id === itemId);
  if (!item) {
    return socket.emit("live:error", { message: "Item not found" });
  }

  // Build a single-item "quiz" and reuse the existing grading logic.
  const { score } = gradeAttempt([item], { [item.id]: answer });

  const existing = await LiveParticipant.findOne({ sessionId, userId });
  if (!existing || existing.status === "submitted") {
    return socket.emit("live:error", { message: "Not joined or already submitted" });
  }

  existing.score = (existing.score || 0) + score;
  existing.lastActivity = new Date();
  // (do not mark as 'submitted' yet — student should be able to answer later items;
  //  status stays 'answering' until admin ends session or anti-cheat auto-submits)
  await existing.save();

  io.to("admin:live").emit("live:submission", {
    sessionId, userId, itemId, score, total: item.points || 1,
  });
  socket.emit("live:submission_ack", { itemId, score });
});
```

3. **In `src/views/live-test/take.ejs`**, replace `submitAnswer` (lines 54–73) so it sends `answer` only:

```js
async function submitAnswer(it) {
  let answer = '';
  if (it.type === 'multiple_choice' || it.type === 'true_false') {
    const sel = document.querySelector('input[name="ans"]:checked');
    if (!sel) return alert('Pick an answer first.');
    answer = sel.value;
  } else {
    const v = document.getElementById('ans-input').value;
    if (!v.trim()) return alert('Type your answer.');
    answer = v;
  }
  socket.emit('live:submit', { sessionId: session.id, itemId: it.id, answer });
  document.getElementById('quiz-container').innerHTML =
    '<p class="muted center">✓ Answer submitted. Waiting for the next item…</p>';
}
```

Also: **fix the `socket` reference** — currently `submitAnswer` creates a fresh `io()` on every call (line 69). Hoist the socket creation to the top of the script (see P1-4 / H4 below).

**Acceptance criteria:**

- [ ] Client sends `{ sessionId, itemId, answer }` — no `score` field anywhere in the payload.
- [ ] Server computes score from `gradeAttempt` and stores it on `LiveParticipant.score`.
- [ ] Manually testing: with a fake client sending `score: 99999`, the recorded score matches what the server computed, not 99999.
- [ ] Existing flow still works: student can submit an answer, sees "Answer submitted", advances when admin advances.

---

#### P0-2 · Role-check `admin:subscribe_live` and admin-only socket events

**Severity:** CRITICAL — any connected socket can join `admin:live` and observe every anti-cheat warning, every submission, every activity event for every student.

**Files affected:** `src/services/realtime.js` lines 41–63.

**Current state:**
```js
socket.on("admin:subscribe_live", () => {
  socket.join("admin:live");
  if (activeSessionId) {
    socket.emit("live:current_session", { sessionId: activeSessionId });
  }
});

socket.on("admin:start_session", ({ sessionId }) => { ... });
socket.on("admin:advance_item", ({ sessionId, itemIndex }) => { ... });
socket.on("admin:end_session", ({ sessionId }) => { ... });
```

None of these check the user's role. Any student can connect and call them.

**Required change:**

1. Resolve the user's role once at connection time, after the auth middleware. Stash it on `socket.data.role`:

```js
io.use(async (socket, next) => {
  const userId = socket.data.userId; // set by the auth middleware in P0-3
  if (!userId) return next(new Error("unauthorized"));
  try {
    const user = await User.findById(userId).select("role name").lean();
    if (!user) return next(new Error("unauthorized"));
    socket.data.role = user.role;
    socket.data.userName = user.name;
    next();
  } catch (err) {
    next(err);
  }
});
```

2. Add a helper at the top of `attachRealtime`:

```js
function requireSocketRole(socket, role) {
  return socket.data.role === role;
}

function requireSocketAdmin(socket) {
  return requireSocketRole(socket, "administrator");
}
```

3. Guard all admin events:

```js
socket.on("admin:subscribe_live", () => {
  if (!requireSocketAdmin(socket)) return socket.emit("live:error", { message: "Forbidden" });
  socket.join("admin:live");
  if (activeSessionId) socket.emit("live:current_session", { sessionId: activeSessionId });
});

socket.on("admin:start_session", ({ sessionId }) => {
  if (!requireSocketAdmin(socket)) return;
  // ... rest unchanged
});

// Same guard for admin:advance_item and admin:end_session
```

**Acceptance criteria:**

- [ ] A student connecting and emitting `admin:subscribe_live` does NOT receive any `live:*` admin-room events.
- [ ] A student emitting `admin:start_session` is rejected.
- [ ] Admin still receives live updates.

---

#### P0-3 · Session-based Socket.IO auth (kill trust-the-client userId)

**Severity:** CRITICAL — `socket.handshake.auth.userId` is set by the client; anyone can spoof any userId.

**Files affected:** `src/services/realtime.js` lines 14–19, plus a read of express-session from the cookie.

**Current state:**
```js
io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error("unauthorized"));
  socket.data.userId = userId;
  next();
});
```

**Required change:**

The server already has `express-session` wired with `connect-mongo` as the store (`src/server.js` lines 64–78). Use the session cookie directly:

```js
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import { config } from "../config/env.js";

// Reuse the SAME session config used by Express — do not create a second store.
const sessionStore = MongoStore.create({
  mongoUrl: config.mongodb.uri,
  dbName: config.mongodb.dbName,
  collectionName: "sessions",
});

const parseCookie = cookieParser(config.sessionSecret, { decode: (v) => v });

io.use((socket, next) => {
  const req = socket.handshake;
  if (!req.headers.cookie) return next(new Error("unauthorized"));
  // Parse the cookie using the same secret Express uses.
  // cookie-parser's signature: (secret, options)
  parseCookie(req, {}, () => {
    const sessionId = req.cookies && req.cookies["connect.sid"];
    if (!sessionId) return next(new Error("unauthorized"));
    sessionStore.get(sessionId, (err, session) => {
      if (err) return next(err);
      if (!session || !session.userId) return next(new Error("unauthorized"));
      socket.data.userId = session.userId.toString();
      next();
    });
  });
});
```

Then update the client (`live-test/take.ejs` and any other socket-init call) to **stop sending** `auth: { userId: ... }` — the server now reads it from the cookie. The `io()` connect becomes simply:

```js
const socket = io();
```

**Acceptance criteria:**

- [ ] A client connecting without a valid session cookie is rejected with `"unauthorized"`.
- [ ] A client connecting with `auth: { userId: 'SOME_OTHER_USER_ID' }` is rejected (or, better, the `auth.userId` is ignored entirely and the real session userId is used).
- [ ] The admin dashboard's live monitor still shows live events.

---

#### P0-4 · Remove `password_hash` from `req.user` and stop writing `lastActiveDate` on every request

**Severity:** CRITICAL-adjacent (defense in depth). The hash leak isn't currently exploitable but is a footgun; the per-request DB write is a performance bug.

**Files affected:** `src/middleware/auth.js` lines 20–31.

**Current state:**
```js
req.user = {
  ...user,
  id: user._id.toString(),
  avatar_color: user.avatarColor,
  avatar_url: user.avatarUrl,
  password_hash: user.passwordHash,  // <-- remove
};
req.role = user.role;
User.updateOne(
  { _id: user._id },
  { lastActiveDate: new Date().toISOString().slice(0, 10) }
).catch(() => {});
```

**Required change:**

1. Remove `password_hash: user.passwordHash` from the spread.
2. Replace the unconditional `User.updateOne` with a throttled write. Only update `lastActiveDate` if it's stale by > 1 hour:

```js
const THROTTLE_MS = 60 * 60 * 1000; // 1 hour
const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).getTime() : 0;
if (Date.now() - lastActive > THROTTLE_MS) {
  User.updateOne(
    { _id: user._id },
    { lastActiveDate: new Date().toISOString().slice(0, 10) }
  ).catch(() => {});
}
```

**Acceptance criteria:**

- [ ] `console.log(req.user)` in any controller shows no `password_hash` or `passwordHash` field.
- [ ] A user refreshing a page 100 times generates at most ONE `lastActiveDate` write to MongoDB.

---

### P1 — HIGH (broken behavior / high-value features)

#### P1-1 · Per-item breakdown on quiz result page

**Files affected:**

- `src/models/QuizAttempt.js` — add `responses` field
- `src/services/quizzes.js` — `recordAttempt` to accept responses; `gradeAttempt` to return per-item results
- `src/controllers/quizzesController.js` — `submitPractice` to pass responses and to pass them to the view
- `src/views/quizzes/result.ejs` — full redesign

**Required change:**

1. **Extend the schema** (`src/models/QuizAttempt.js`). Add backward-compatible field:

```js
const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    responses: {
      type: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        answer: { type: String, default: "" },
        correct: { type: Boolean, default: false },
        pointsAwarded: { type: Number, default: 0 },
      }],
      default: [],
    },
  },
  { timestamps: true }
);
```

2. **Refactor `gradeAttempt`** (`src/services/quizzes.js` line 205) to return per-item results:

```js
export function gradeAttempt(items, answers) {
  let score = 0;
  let total = 0;
  const responses = [];
  for (const it of items) {
    const pts = it.points || 1;
    total += pts;
    const ans = answers[it.id];
    let correct = false;
    if (ans) {
      if (it.type === "multiple_choice" || it.type === "true_false") {
        const correctOpt = (it.options || []).find((o) => o.isCorrect || o.is_correct);
        if (correctOpt && (ans === correctOpt.id || ans === correctOpt._id?.toString())) {
          correct = true;
        }
      } else if (it.type === "identification") {
        const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (norm(ans).includes(norm(it.correctAnswer || it.correct_answer))) correct = true;
      } else if (it.type === "open_ended") {
        if (String(ans).toLowerCase().includes(String(it.correctAnswer || it.correct_answer || "").toLowerCase())) correct = true;
      }
    }
    if (correct) score += pts;
    responses.push({ itemId: it._id || it.id, answer: String(ans || ""), correct, pointsAwarded: correct ? pts : 0 });
  }
  return { score, total, responses };
}
```

3. **Update `submitPractice`** (`src/controllers/quizzesController.js` line 37) to persist `responses` and pass them to the view:

```js
export async function submitPractice(req, res) {
  try {
    const quiz = await getQuiz(req.params.id);
    if (!quiz) return res.status(404).render("error/404");
    const answers = req.body.answers || {};
    const { score, total, responses } = gradeAttempt(quiz.items, answers);
    const durationSec = Number(req.body.durationSec) || 0;
    const attempt = await recordAttempt({
      userId: req.user.id, quizId: quiz.id, score, total, durationSec, responses,
    });
    // ... rest unchanged ...
    res.render("quizzes/result", {
      title: "Result", quiz, score, total, attempt,
      items: quiz.items, responses,
    });
  } catch (err) {
    console.error("[submitPractice]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}
```

Update `recordAttempt` (`src/services/quizzes.js` line 129) to accept `responses`:

```js
export async function recordAttempt({ userId, quizId, score, total, durationSec, responses = [] }) {
  return QuizAttempt.create({ userId, quizId, score, total, durationSec, responses });
}
```

4. **Redesign `src/views/quizzes/result.ejs`** — full replace, show every item with the student's answer, the correct answer, and the explanation:

```ejs
<div class="result-card">
  <div class="result-icon <%= score >= total * 0.6 ? 'pass' : 'fail' %>">
    <%= score >= total * 0.6 ? '✓' : '!' %>
  </div>
  <h1><%= score %> / <%= total %></h1>
  <p class="muted"><%= quiz.title %></p>
  <p class="muted">You earned <strong>+<%= 5 + score %></strong> points toward the leaderboard.</p>
  <div class="cta-row">
    <a href="/practice/<%= quiz.id %>" class="btn btn-primary">Try again</a>
    <a href="/practice" class="btn btn-outline">Back to quizzes</a>
  </div>
</div>

<h2 class="section-title">Review your answers</h2>
<% items.forEach((it, i) => {
  const r = responses.find(x => String(x.itemId) === String(it.id || it._id));
  const yourAnswer = r ? r.answer : '';
  const correct = r ? r.correct : false;
%>
  <div class="card review-item <%= correct ? 'review-correct' : 'review-wrong' %>">
    <div class="review-head">
      <span class="badge"><%= it.type.replace(/_/g, ' ') %></span>
      <span class="badge <%= correct ? 'pass' : 'fail' %>"><%= correct ? '✓ Correct' : '✗ Wrong' %></span>
    </div>
    <h3 class="review-q"><%= (i + 1) + '. ' + it.question %></h3>
    <% if (it.image_url) { %><img src="<%= it.image_url %>" alt="" class="quiz-img" /><% } %>
    <div class="review-answer-row">
      <p><strong>Your answer:</strong> <span class="muted"><%= yourAnswer || '(blank)' %></span></p>
      <p><strong>Correct answer:</strong>
        <% if (it.type === 'multiple_choice' || it.type === 'true_false') {
          const co = (it.options || []).find(o => o.is_correct || o.isCorrect);
        %>
          <span><%= co ? co.text : '(not set)' %></span>
        <% } else { %>
          <span><%= it.correct_answer || it.correctAnswer || '(not set)' %></span>
        <% } %>
      </p>
    </div>
    <% if (it.explanation) { %>
      <div class="callout info"><strong>Explanation:</strong> <%= it.explanation %></div>
    <% } %>
  </div>
<% }) %>
```

Add CSS for `.review-item`, `.review-correct`, `.review-wrong`, `.review-head`, `.review-q`, `.review-answer-row` in `public/css/style.css`. Match existing card styling; `.review-correct` left border green, `.review-wrong` left border red.

**Acceptance criteria:**

- [ ] After submitting a practice quiz, the result page shows every item with the student's answer, correct answer, and explanation (if set).
- [ ] Old attempts without `responses` (created before this fix) still render — they show "Your answer: (no record)" gracefully.
- [ ] DB seed still passes; `npm run db:seed` works.

---

#### P1-2 · Rate limiting on auth and review endpoints

**Files affected:** `src/routes/index.js`, new file `src/middleware/rateLimit.js`.

**Required change:**

1. Create `src/middleware/rateLimit.js`:

```js
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many attempts. Try again in 15 minutes." },
});

export const reviewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 review POSTs per minute per IP — generous but blocks the 10k-requests-in-30s attack
  standardHeaders: true,
  legacyHeaders: false,
});

export const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 quiz submissions per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});
```

2. In `src/routes/index.js`:

```js
import { authLimiter, reviewLimiter, submitLimiter } from "../middleware/rateLimit.js";

router.post("/login", authLimiter, auth.login);
router.post("/register", authLimiter, auth.register);
router.post("/flashcards/review", requireAuth, requireStudent, reviewLimiter, flashcards.review);
router.post("/practice/:id/submit", requireAuth, requireStudent, submitLimiter, quizzes.submitPractice);
```

**Acceptance criteria:**

- [ ] `curl -X POST /login` 11 times in 15 minutes from the same IP returns 429 on the 11th.
- [ ] A script sending 1000 POSTs to `/flashcards/review` in 30s is blocked after 60.

---

#### P1-3 · Daily cap on flashcard points + per-card-per-day tracking

**Files affected:** new model `src/models/FlashcardReview.js`, `src/controllers/flashcardsController.js`, `src/services/flashcards.js`.

**Required change:**

1. Create `src/models/FlashcardReview.js`:

```js
import mongoose from "mongoose";

const flashcardReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: "Flashcard", required: true, index: true },
    reviewedAt: { type: Date, default: () => new Date() },
    dateKey: { type: String, required: true }, // YYYY-MM-DD for fast daily uniqueness checks
  },
  { timestamps: true }
);

flashcardReviewSchema.index({ userId: 1, cardId: 1, dateKey: 1 }, { unique: true });

export default mongoose.model("FlashcardReview", flashcardReviewSchema);
```

Register it in `src/models/index.js`.

2. Update `flashcardsController.review` to check the daily review record:

```js
import { FlashcardReview } from "../models/index.js";

export async function review(req, res) {
  const { cardId } = req.body;
  if (!cardId) return res.json({ ok: false, error: "cardId required" });

  const today = new Date().toISOString().slice(0, 10);
  const existing = await FlashcardReview.findOne({
    userId: req.user.id, cardId, dateKey: today,
  });
  if (existing) {
    return res.json({ ok: true, awarded: 0, reason: "already_reviewed_today" });
  }

  await FlashcardReview.create({ userId: req.user.id, cardId, dateKey: today });
  await awardPoints(req.user.id, 2);
  await bumpStreak(req.user.id);
  const user = await User.findById(req.user.id);
  if (user) {
    user.flashcardsReviewed = (user.flashcardsReviewed || 0) + 1;
    await user.save();
  }
  await logActivity(req.user.id, req.user.name, "flashcard", "Reviewed a flashcard");
  res.json({ ok: true, awarded: 2 });
}
```

**Acceptance criteria:**

- [ ] The same user reviewing the same card twice in one day earns +2 the first time, +0 the second time.
- [ ] The client-side `Set` in `public/js/flashcards.js` still works (cosmetic — it just stops showing the toast).
- [ ] Existing seed still works.

---

#### P1-4 · Single persistent socket + subscribe to live events in `live-test/take.ejs`

**Files affected:** `src/views/live-test/take.ejs` (entire script block).

**Required change:**

Refactor the inline `<script>` to use ONE socket created at page load, and listen to `live:item_changed` + `live:ended` instead of polling every 3s. Skeleton:

```js
const socket = io(); // server reads userId from session cookie now (P0-3)
let session = null;
let answers = {};

async function loadSession() {
  const r = await fetch('/api/live-test/current').then(r => r.json()).catch(() => null);
  if (!r || !r.session) {
    document.getElementById('quiz-container').innerHTML =
      '<p class="muted center">No active live test right now. Check back when your adviser starts one.</p>';
    session = null;
    return;
  }
  session = r.session;
  socket.emit('live:join', { sessionId: session.id });
  render();
}

function render() {
  const items = session.quiz.items || [];
  const idx = session.current_item_index;
  const it = items[idx];
  if (!it) return;
  // ... render the item (existing code in render() function)
}

socket.on('live:item_changed', ({ itemIndex }) => {
  if (!session) return;
  session.current_item_index = itemIndex;
  render();
});

socket.on('live:ended', () => {
  session = null;
  document.getElementById('quiz-container').innerHTML =
    '<p class="muted center">The live test has ended. Your answers have been submitted.</p>';
});

socket.on('live:auto_submitted', ({ reason }) => {
  alert(reason);
  session = null;
});

socket.on('live:warning', ({ warnings, max, reason }) => {
  const badge = document.getElementById('warning-badge');
  badge.classList.remove('hidden');
  document.getElementById('warning-count').textContent = warnings;
});

// Anti-cheat
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session) {
    socket.emit('live:anti_cheat_warning', { sessionId: session.id, reason: 'Tab switched' });
  }
});
document.addEventListener('copy', (e) => { if (session) { e.preventDefault(); alert('Copying is disabled during the live test.'); } });
document.addEventListener('contextmenu', (e) => { if (session) e.preventDefault(); });

async function submitAnswer(it) {
  // ... see P0-1 for the new submitAnswer body
}

loadSession();
// REMOVE the setInterval(loadSession, 3000) line — the socket subscriptions handle updates.
```

**Acceptance criteria:**

- [ ] No `setInterval` polling in the page.
- [ ] Admin advancing an item updates the student's screen in < 500ms (Socket.IO push, no polling).
- [ ] Tab-switch during an active session emits exactly one anti-cheat warning per switch (not multiple sockets).
- [ ] After session ends, tab-switching does NOT emit anti-cheat warnings.

---

#### P1-5 · Practice quiz time-limit enforcement

**Files affected:** `src/views/quizzes/take.ejs`.

**Required change:**

If `quiz.timeLimitMin` is set, render a countdown and auto-submit at 0:

```ejs
<% if (quiz.timeLimitMin) { %>
  <div class="quiz-timer" id="quiz-timer">
    <span id="timer-text"><%= quiz.timeLimitMin %>:00</span>
  </div>
<% } %>
```

In the existing inline `<script>`:

```js
<% if (quiz.timeLimitMin) { %>
  let remaining = <%= quiz.timeLimitMin %> * 60;
  const timerEl = document.getElementById('timer-text');
  const timerInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = '0:00';
      // Make sure the durationSec hidden input has the right value
      document.getElementById('duration-input').value = <%= quiz.timeLimitMin %> * 60;
      // Disable all answer inputs so the form submits with what's filled
      document.querySelectorAll('input, textarea').forEach(el => el.disabled = true);
      document.getElementById('quiz-form').submit();
    } else {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      timerEl.textContent = m + ':' + String(s).padStart(2, '0');
    }
  }, 1000);
<% } %>
```

Also wire the existing form-submit listener to clear the interval so it doesn't fire after manual submit.

**Acceptance criteria:**

- [ ] A quiz with `timeLimitMin: 1` auto-submits after 60 seconds.
- [ ] A quiz with `timeLimitMin: null` shows no timer and doesn't auto-submit.
- [ ] Manually clicking Submit before the timer ends works.

---

#### P1-6 · Save quiz progress to sessionStorage

**Files affected:** `src/views/quizzes/take.ejs`.

**Required change:**

In the inline script, on every input change, save to `sessionStorage`. On page load, restore:

```js
const STORAGE_KEY = 'quiz:draft:' + '<%= quiz.id %>';

function saveDraft() {
  const data = {};
  document.querySelectorAll('input[name^="answers["], textarea[name^="answers["]').forEach(el => {
    if (el.type === 'radio' || el.type === 'checkbox') {
      if (el.checked) data[el.name] = el.value;
    } else {
      data[el.name] = el.value;
    }
  });
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreDraft() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    for (const [name, value] of Object.entries(data)) {
      document.querySelectorAll(`[name="${name}"]`).forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox') {
          if (el.value === value) el.checked = true;
        } else {
          el.value = value;
        }
      });
    }
  } catch (e) {}
}

document.querySelectorAll('input, textarea').forEach(el => {
  el.addEventListener('change', saveDraft);
  el.addEventListener('input', saveDraft);
});

restoreDraft();

// Clear on successful submit:
document.getElementById('quiz-form').addEventListener('submit', () => {
  sessionStorage.removeItem(STORAGE_KEY);
});
```

**Acceptance criteria:**

- [ ] Filling answers and refreshing restores them.
- [ ] Submitting clears the draft.

---

#### P1-7 · Spaced repetition for flashcards (`ts-fsrs`)

**Files affected:** new `src/models/FlashcardSrsState.js`, new `src/services/srs.js`, `src/controllers/flashcardsController.js` (new endpoints), `src/routes/index.js` (new routes), `src/views/flashcards/index.ejs` (new study-session button + mastery bar), new view `src/views/flashcards/study.ejs`.

**Required change:**

1. Install `ts-fsrs` (already in the global install command at the top).

2. Create `src/models/FlashcardSrsState.js`:

```js
import mongoose from "mongoose";

const flashcardSrsStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: "Flashcard", required: true, index: true },
    due: { type: Date, default: () => new Date() },
    stability: { type: Number, default: 0 },
    difficulty: { type: Number, default: 0 },
    elapsedDays: { type: Number, default: 0 },
    scheduledDays: { type: Number, default: 0 },
    reps: { type: Number, default: 0 },
    state: { type: Number, default: 0, enum: [0, 1, 2, 3] }, // 0=New, 1=Learning, 2=Review, 3=Relearning
    last: { type: Date, default: null },
  },
  { timestamps: true }
);

flashcardSrsStateSchema.index({ userId: 1, cardId: 1 }, { unique: true });
flashcardSrsStateSchema.index({ userId: 1, due: 1 });

export default mongoose.model("FlashcardSrsState", flashcardSrsStateSchema);
```

Register in `src/models/index.js`.

3. Create `src/services/srs.js`:

```js
import { fsrs, generatorGenerator, Rating, State } from "ts-fsrs";
import { FlashcardSrsState } from "../models/index.js";

const f = fsrs();
const generator = generatorGenerator({ enable_short_term: false });

export async function getDueCards(userId, { includeNew = true, limit = 30 } = {}) {
  const now = new Date();
  const filter = { userId, due: { $lte: now } };
  if (!includeNew) filter.state = { $ne: 0 };
  const due = await FlashcardSrsState.find(filter).sort({ due: 1 }).limit(limit).lean();
  const dueIds = due.map(s => s.cardId);

  // For "new" state cards or cards not yet in SrsState, fetch from Flashcard.
  const Flashcard = (await import("../models/index.js")).Flashcard;
  const dueCards = await Flashcard.find({ _id: { $in: dueIds } }).lean();
  return due.map(s => {
    const card = dueCards.find(c => c._id.toString() === s.cardId.toString());
    return { card, srs: s };
  }).filter(x => x.card);
}

export async function getNewCards(userId, limit = 10) {
  const FlashcardSrsState = (await import("../models/index.js")).FlashcardSrsState;
  const Flashcard = (await import("../models/index.js")).Flashcard;
  // Find cards the user has never seen.
  const seen = await FlashcardSrsState.find({ userId }).distinct("cardId");
  const unseen = await Flashcard.find({ _id: { $nin: seen } }).limit(limit).lean();
  return unseen.map(c => ({
    card: c,
    srs: { state: State.New, due: new Date(), reps: 0, stability: 0, difficulty: 0 },
  }));
}

export async function buildStudyQueue(userId, { newLimit = 10, dueLimit = 30 } = {}) {
  const due = await getDueCards(userId, { includeNew: false, limit: dueLimit });
  const fresh = await getNewCards(userId, newLimit);
  return [...due, ...fresh];
}

export async function rateCard(userId, cardId, rating) {
  // rating is one of Rating.Again (1), Rating.Hard (2), Rating.Good (3), Rating.Easy (4)
  const now = new Date();
  let state = await FlashcardSrsState.findOne({ userId, cardId });
  const card = state || new FlashcardSrsState({
    userId, cardId, due: now, stability: 0, difficulty: 0,
    elapsedDays: 0, scheduledDays: 0, reps: 0, state: State.New, last: null,
  });

  const prev = card.state === State.New ? null : {
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    last: card.last || now,
    reps: card.reps,
  };

  const next = generator(prev, now, rating);
  Object.assign(card, {
    stability: next.stability,
    difficulty: next.difficulty,
    state: next.state,
    elapsedDays: next.elapsed_days,
    scheduledDays: next.scheduled_days,
    due: next.due,
    reps: next.reps,
    last: now,
  });
  await card.save();
  return card;
}

export async function getMasteryForUser(userId, unitId = null) {
  const Flashcard = (await import("../models/index.js")).Flashcard;
  const totalFilter = unitId ? { unitId } : {};
  const total = await Flashcard.countDocuments(totalFilter);
  const states = await FlashcardSrsState.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $lookup: { from: "flashcards", localField: "cardId", foreignField: "_id", as: "card" } },
    { $unwind: "$card" },
    { $match: unitId ? { "card.unitId": new mongoose.Types.ObjectId(unitId) } : {} },
    { $group: { _id: "$state", count: { $sum: 1 } } },
  ]);
  const mastery = states.filter(s => s._id === State.Review || s._id === State.Relearning)
    .reduce((sum, s) => sum + s.count, 0);
  return { total, mastery, learning: states.filter(s => s._id === State.Learning).reduce((n, s) => n + s.count, 0) };
}
```

4. Add controller methods to `src/controllers/flashcardsController.js`:

```js
import { buildStudyQueue, rateCard, getMasteryForUser } from "../services/srs.js";
import { Rating } from "ts-fsrs";

export async function studySession(req, res) {
  try {
    const queue = await buildStudyQueue(req.user.id);
    const units = await listUnits();
    const mastery = await getMasteryForUser(req.user.id);
    res.render("flashcards/study", { title: "Study Session", queue, units, mastery });
  } catch (err) {
    console.error("[studySession]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function rateCardPost(req, res) {
  try {
    const { cardId, rating } = req.body;
    if (![1, 2, 3, 4].includes(Number(rating))) {
      return res.status(400).json({ ok: false, error: "Invalid rating" });
    }
    await rateCard(req.user.id, cardId, Number(rating));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
```

5. Add routes:

```js
router.get("/flashcards/study", requireAuth, requireStudent, flashcards.studySession);
router.post("/api/flashcards/rate", requireAuth, requireStudent, flashcards.rateCardPost);
```

6. Create `src/views/flashcards/study.ejs` — modeled on the existing flashcard UI but with four buttons: `Again`, `Hard`, `Good`, `Easy` and a mastery bar at top.

7. Add a "Study" button + mastery bar on `src/views/flashcards/index.ejs` next to each unit chip.

**Acceptance criteria:**

- [ ] Clicking "Study" on a unit starts a session with due cards + 10 new cards.
- [ ] Rating a card `Again` resurfaces it later in the session; rating `Easy` pushes the due date far out.
- [ ] Mastery bar on `/flashcards` shows "X / Y mastered" per unit.
- [ ] No points are awarded for SRS reviews (the +2 cap from P1-3 still applies to the legacy "Got it" button on the old `flashcards/index.ejs` page).

---

#### P1-8 · Bulk add flashcards via paste textarea

**Files affected:** `src/views/flashcards/editor.ejs`, `public/js/flashcards-editor.js`, `src/controllers/flashcardsController.js`, `src/services/flashcards.js`, `src/routes/index.js`.

**Required change:**

1. New service function in `src/services/flashcards.js`:

```js
export async function bulkCreateFlashcards(rows) {
  // rows: [{ front, back, unit_id }]
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const valid = rows.filter(r => r.front?.trim() && r.back?.trim())
    .map(r => ({
      front: r.front.trim(),
      back: r.back.trim(),
      unitId: r.unit_id || null,
      imageUrl: "",
    }));
  if (valid.length === 0) return [];
  return Flashcard.insertMany(valid);
}
```

2. New controller in `src/controllers/flashcardsController.js`:

```js
export async function bulkCreatePost(req, res) {
  try {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const created = await bulkCreateFlashcards(rows);
    res.json({ ok: true, count: created.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
```

3. New route:

```js
router.post("/api/flashcards/bulk", requireAuth, requireModerator, flashcards.bulkCreatePost);
```

4. Add a "Bulk add" button next to "New card" in `src/views/flashcards/editor.ejs` (read the existing file first to add to the existing modal structure). Bulk modal contains:
   - Unit `<select>` (applies to all cards)
   - `<textarea>` placeholder: `Term | Definition` (one card per line)
   - "Save all" button

5. In `public/js/flashcards-editor.js`, add a handler:

```js
document.getElementById('bulk-save')?.addEventListener('click', async () => {
  const ta = document.getElementById('bulk-text');
  const unit = document.getElementById('bulk-unit').value;
  const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = lines.map(line => {
    const [front, ...rest] = line.split('|');
    return { front: front.trim(), back: rest.join('|').trim(), unit_id: unit || null };
  });
  if (rows.length === 0) return alert('Paste at least one card.');
  const r = await fetch('/api/flashcards/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  });
  if (r.ok) { location.reload(); }
  else { const d = await r.json(); alert(d.error || 'Failed'); }
});
```

**Acceptance criteria:**

- [ ] Pasting 20 lines of `Term | Definition` and clicking Save creates 20 cards in one round-trip.
- [ ] Lines with empty front or back are silently skipped (with a count of skipped in the response).
- [ ] Tab-separated paste (Quizlet export) also works because `|` and `\t` should both be supported. Update the parser: `line.split(/\||\t/)`.

---

### P2 — MEDIUM

#### P2-1 · CSRF protection

**Files affected:** new `src/middleware/csrf.js`, `src/server.js`, every form in `src/views/`.

**Required change:**

1. Install `csrf` (already in global install command).
2. Create `src/middleware/csrf.js`:

```js
import { tokens } from "csrf";

const csrf = new tokens();

export async function csrfToken(req, res, next) {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = await tokens().secret();
  }
  res.locals.csrfToken = await tokens().create(req.session.csrfSecret);
  next();
}

export async function csrfVerify(req, res, next) {
  const secret = req.session.csrfSecret;
  if (!secret) return res.status(403).json({ ok: false, error: "Missing CSRF secret" });
  const token = req.headers["x-csrf-token"] || req.body._csrf;
  if (!token || !(await tokens().verify(secret, token))) {
    return res.status(403).json({ ok: false, error: "Invalid CSRF token" });
  }
  next();
}
```

3. Mount in `src/server.js`:
```js
import { csrfToken, csrfVerify } from "./middleware/csrf.js";
app.use(csrfToken);
```

4. Apply `csrfVerify` to every POST/PUT/PATCH/DELETE route in `src/routes/index.js` — either by listing it explicitly on each, or by using `router.use((req, res, next) => req.method === "GET" ? next() : csrfVerify(req, res, next))`.

5. In every EJS form (`login.ejs`, `register.ejs`, `quizzes/take.ejs`, `flashcards/editor.ejs`, `admin/settings.ejs`, etc.), add a hidden input:
```ejs
<input type="hidden" name="_csrf" value="<%= csrfToken %>" />
```

6. In every `fetch()` call in client JS, add the header. Easiest pattern: in `public/js/app.js`, set a global default:

```js
window.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
// In layout-main.ejs, add: <meta name="csrf-token" content="<%= csrfToken %>" />
const originalFetch = window.fetch;
window.fetch = (url, opts = {}) => {
  opts.headers = opts.headers || {};
  if (opts.headers instanceof Headers) {
    if (!opts.headers.has('X-CSRF-Token')) opts.headers.set('X-CSRF-Token', window.csrfToken);
  } else {
    if (!opts.headers['X-CSRF-Token']) opts.headers['X-CSRF-Token'] = window.csrfToken;
  }
  return originalFetch(url, opts);
};
```

**Acceptance criteria:**

- [ ] All existing forms still work (they include the `_csrf` hidden input).
- [ ] A POST without the token returns 403.
- [ ] Login flow works end-to-end.

---

#### P2-2 · Username enumeration fix

**Files affected:** `src/controllers/authController.js` lines 73–80.

**Required change:**

Replace the two distinct error messages with one:

```js
const user = await User.findOne({ username: username.trim().toLowerCase() });
if (!user) {
  return res.render("login", { title: "Sign in", error: "Invalid username or password." });
}

const match = await bcrypt.compare(password, user.passwordHash);
if (!match) {
  return res.render("login", { title: "Sign in", error: "Invalid username or password." });
}
```

For defense-in-depth, when the user doesn't exist, still call `bcrypt.compare` against a dummy hash so the timing is the same:

```js
const DUMMY_HASH = "$2a$12$...somehash..."; // generated once, lives in code
const user = await User.findOne({ username: username.trim().toLowerCase() });
const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
const match = await bcrypt.compare(password, hashToCompare);
if (!user || !match) {
  return res.render("login", { title: "Sign in", error: "Invalid username or password." });
}
```

**Acceptance criteria:**

- [ ] Both "wrong username" and "wrong password" show the same error.
- [ ] Both branches take ~250ms (bcrypt cost 12).

---

#### P2-3 · Fix admin dashboard N+1 query

**Files affected:** `src/controllers/adminController.js` line 9.

**Required change:**

```js
import { Quiz, Flashcard } from "../models/index.js";

// In dashboard():
const [studentCount, quizCount, cardCount, activeSession, activity] = await Promise.all([
  User.countDocuments({ role: { $ne: "administrator" } }),
  Quiz.countDocuments(),
  Flashcard.countDocuments(),
  getActiveLiveSession(),
  getRecentActivity(20),
]);
res.render("admin/dashboard", {
  title: "Admin Dashboard", studentCount, quizCount, cardCount, activeSession, activity,
});
```

**Acceptance criteria:**

- [ ] Dashboard loads with the same numbers.
- [ ] DB query count drops (verify with `mongoose.set('debug', true)` temporarily — should see ~5 queries, not dozens).

---

#### P2-4 · Sidebar avatar photo support

**Files affected:** `src/views/partials/sidebar.ejs` lines 45–47.

**Required change:**

Mirror the conditional from `admin-settings.ejs` line 39:

```ejs
<div class="avatar" style="background: linear-gradient(135deg, oklch(0.65 0.18 <%= user.avatarColor %>), oklch(0.55 0.16 <%= (user.avatarColor || 0) + 30 %>));">
  <% if (user.avatarUrl) { %>
    <img src="<%= user.avatarUrl %>" alt="<%= user.name %>" class="avatar-img" />
  <% } else { %>
    <%= (user.name || '').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() %>
  <% } %>
</div>
```

Add `.avatar-img` CSS in `public/css/style.css` if not present:
```css
.avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
```

Also do the same in `layout-main.ejs` (the topbar avatar, line 26–28).

**Acceptance criteria:**

- [ ] Uploading a profile photo shows it in the sidebar AND topbar.
- [ ] Users without a photo still see initials.

---

#### P2-5 · Socket.IO CORS tightening

**Files affected:** `src/services/realtime.js` line 8.

**Current state:**
```js
cors: { origin: "*", methods: ["GET", "POST"] },
```

**Required change:**
```js
import { config } from "../config/env.js";

cors: { origin: config.publicUrl, methods: ["GET", "POST"], credentials: true },
```

**Acceptance criteria:**

- [ ] A request from `https://evil.com` to the deployed socket endpoint is rejected by CORS.

---

#### P2-6 · Loading state on login & register forms

**Files affected:** `src/views/login.ejs`, `src/views/register.ejs`, `public/js/app.js`.

**Required change:**

Add a global form-submit listener in `public/js/app.js`:

```js
document.querySelectorAll('form[data-loading]').forEach(f => {
  f.addEventListener('submit', () => {
    const btn = f.querySelector('button[type=submit]');
    if (!btn) return;
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    btn.textContent = btn.dataset.loadingText || 'Loading…';
  });
});
```

In `login.ejs` and `register.ejs`, add `data-loading` and `data-loading-text` to the form:

```ejs
<form method="post" action="/login" class="auth-form" data-loading data-loading-text="Signing in…">
```

**Acceptance criteria:**

- [ ] Clicking "Sign in" disables the button and shows "Signing in…" until the redirect lands.

---

### P3 — LOW

#### P3-1 · Remove dead `signup.ejs`

If `grep -r "signup" src/` returns only `src/views/signup.ejs` referencing itself, delete `src/views/signup.ejs`.

#### P3-2 · Remove dead `email` field on User

If `grep -r "\.email" src/ | grep -v node_modules` returns nothing meaningful, remove `email: { type: String, default: "" }` from `src/models/User.js` line 21.

#### P3-3 · Verify and possibly remove `cipher.js`

Run `grep -r "cipher" src/`. If `src/config/cipher.js` is not imported anywhere, delete it. If it is imported (e.g., for some hashing util), leave it alone.

#### P3-4 · Move Socket.io CDN script to per-page slot

**Files affected:** `src/views/layouts/main.ejs` line 41.

Remove the unconditional `<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>` and instead pass it via `extraScripts` from the controllers that need it:

```js
// In pagesController or live-test routes:
res.render("live-test/take", {
  title: "Live Test",
  extraScripts: '<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>',
});
```

In `layout-main.ejs` line 43, this already works: `<%- typeof extraScripts !== 'undefined' ? extraScripts : '' %>`.

#### P3-5 · Favicon

Drop a 32×32 PNG of the STEM logo at `public/assets/favicon.png` and add to `src/views/layouts/main.ejs` head:

```ejs
<link rel="icon" type="image/png" href="/assets/favicon.png" />
```

If the logo is `stem-logo.jpeg`, convert it: `convert public/assets/stem-logo.jpeg -resize 32x32 public/assets/favicon.png` (ImageMagick). Or use any online tool.

#### P3-6 · Move inline toast styles to CSS

**Files affected:** `public/js/app.js` lines 24–31, `public/css/style.css`.

Move the inline `.style.cssText` to a `.toast` class in `style.css`:

```css
.toast {
  position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%);
  padding: 0.75rem 1.25rem; background: rgba(10, 18, 40, 0.95);
  border: 1px solid var(--border); border-radius: 8px;
  color: #fff; font-size: 0.875rem; z-index: 200;
  backdrop-filter: blur(10px);
}
.toast-success { border-color: var(--accent); }
.toast-error { border-color: var(--danger); }
```

In `app.js`, the `toast` helper becomes:
```js
window.toast = (msg, type = 'default') => {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
};
```

#### P3-7 · README update for `auto-submit` vs `auto-kick`

**Files affected:** `README.md`.

The code says "auto-submit instead of kicking" (`realtime.js` line 85) but the README says "auto-kicked". Update README's Anti-cheat section to say "auto-submitted" — match the code's actual behavior.

---

## 4. Suggested Execution Order

1. **P0-1 + P0-2 + P0-3 together** — these are tightly coupled (all touch `realtime.js` and `live-test/take.ejs`). Do them as one commit.
2. **P0-4** — independent, can be parallelized with P0-1..3.
3. **P1-1** (per-item breakdown) — high learning value, independent.
4. **P1-2 + P1-3** — both about points/auth integrity, do together.
5. **P1-4** — depends on P0-3 (uses session-auth socket).
6. **P1-5 + P1-6** — both touch `quizzes/take.ejs`, do together.
7. **P1-7** (ts-fsrs SRS) — biggest standalone task, no dependencies.
8. **P1-8** (bulk add flashcards) — independent.
9. **P2-x** — pick any order.
10. **P3-x** — pick any order.

---

## 5. Global Acceptance Checklist

Run through this list BEFORE declaring the work complete. Every box must be ticked.

### Functional

- [ ] `npm install` succeeds.
- [ ] `npm run db:seed` exits 0.
- [ ] `npm run dev` boots, `http://localhost:3000` loads the landing page.
- [ ] Register a new account → it becomes administrator automatically.
- [ ] Register a second account → it's a `student` with streak 0.
- [ ] Student can read notes (`/notes`), take a practice quiz, see a per-item breakdown on the result page.
- [ ] Student can review a flashcard, earn +2, refresh, review the same card → earns 0 ("already reviewed today").
- [ ] Student can start a study session (`/flashcards/study`) and rate cards.
- [ ] Admin can start a live test → student sees the first item within 500ms.
- [ ] Admin advances → student sees the next item within 500ms (no 3s polling).
- [ ] Admin ends session → student sees "live test has ended".
- [ ] Tab-switching during an active live test → 1 warning, not multiple.
- [ ] Tab-switching after the session ends → 0 warnings.

### Security

- [ ] Live test: client payload contains `answer`, not `score`. Verify with browser devtools Network tab.
- [ ] Live test: a tampered client sending `score: 99999` does not affect the recorded score.
- [ ] Socket.IO: a connection without a valid session cookie is rejected.
- [ ] Socket.IO: a student socket emitting `admin:subscribe_live` does not receive admin-room events.
- [ ] Socket.IO: a student socket emitting `admin:start_session` is rejected.
- [ ] `/login` returns the same error message for wrong-username and wrong-password.
- [ ] 11 login attempts in 15 minutes from the same IP returns 429.
- [ ] A `fetch` POST without an `X-CSRF-Token` header returns 403 (after P2-1).
- [ ] `console.log(req.user)` in any controller shows no `passwordHash` or `password_hash` field.

### Performance

- [ ] `mongoose.set('debug', true)` shows ~5 queries on `/admin` (not dozens).
- [ ] 100 page refreshes by one user generates ≤ 1 write to `lastActiveDate` per hour.

### Data integrity

- [ ] The existing seed (`npm run db:seed`) creates the same data as before.
- [ ] Old `QuizAttempt` documents without `responses` still render on the result page (graceful).

### Visual / UX

- [ ] Uploading a profile photo shows it in the sidebar AND topbar.
- [ ] The login button shows "Signing in…" while waiting.
- [ ] Favicon appears in the browser tab.
- [ ] Quiz result page shows per-item breakdown with the student's answer, correct answer, and explanation.

---

## 6. Worklog protocol

After every task, append to `/home/z/my-project/worklog.md`:

```markdown
---
Task ID: P0-1
Agent: <agent name>
Task: Server-side live test scoring

Work Log:
- Refactored `realtime.js` live:submit handler to call gradeAttempt server-side
- Updated `live-test/take.ejs` submitAnswer to send answer only
- Verified: tampered client cannot inflate score

Stage Summary:
- C1+C4 fixed in one commit
- Acceptance criteria all green
```

---

## 7. Stop conditions

If you hit any of these, stop and report back instead of pushing forward:

1. `npm run db:seed` fails after your changes and you can't fix it within 10 minutes.
2. The role middleware breaks (`requireStudent` / `requireModerator` / `requireAdmin` stop working).
3. Existing routes return 404 (you broke `src/routes/index.js`).
4. A schema migration requires dropping fields from existing collections (the constraint says backward-compatible only — if you need to drop, ask first).
5. You discover a security issue not covered by this prompt. Report it; don't silently fix.

---

## 8. Done definition

All P0 tasks complete. At least P1-1, P1-2, P1-3, P1-4 complete. The Global Acceptance Checklist is fully green. The worklog shows every task ID you completed. The README has been updated to reflect any new env vars, new endpoints, and the corrected "auto-submit" anti-cheat behavior.

---

*End of master prompt. Hand this file to any code agent (Claude, Cursor, Super Z, etc.) and they should be able to execute end-to-end against the `ryzishin/dnhs-stem-tesla-hub` repository.*
