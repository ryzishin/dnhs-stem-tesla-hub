# QA & Audit — DNHS STEM Tesla Hub (Biology 2)

Code audit based on the actual `master` branch. Findings are cited by file and line so you can act on them directly. Severities: **CRITICAL** = security/data-integrity, **HIGH** = broken behavior, **MEDIUM** = UX/quality, **LOW** = polish.

---

## 1. Your specific questions

### 1a. "Login feels too fast — is that because of the demo account, or is it actually like that?"

It's actually like that, and the reason is **both** real-and-fast and missing-UX.

**What's happening in the code:**

`src/views/login.ejs` (lines 14–19) is a plain HTML form, no JS enhancement. `public/js/app.js` only handles the mobile sidebar toggle and `data-method` links — it does **not** intercept form submits.

So the flow is: browser POST → `authController.login` (line 67) → `User.findOne` (line 73) → `bcrypt.compare` (line 78) → `req.session.userId = ...` → `res.redirect(dest)` (line 88).

On localhost, `User.findOne` is ~5–10 ms, `bcrypt.compare` with cost 12 is ~250 ms, redirect + page render ~50 ms. Total ~300 ms. That **is** fast — it's not a demo-account thing. On Render with Atlas it'll be ~400–600 ms, still perceived as "instant".

**What's missing:** no button disable, no spinner, no "Signing in…" text. If the student double-clicks during a slow network, the form submits twice (harmless because the second one overwrites the session, but ugly).

**Fix (optional polish, 10 minutes of work):** in `login.ejs` (and `register.ejs`), add a submit listener that disables the button and adds a spinner class:

```js
document.querySelectorAll('form.auth-form').forEach(f => {
  f.addEventListener('submit', () => {
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.textContent = 'Signing in…';
  });
});
```

That's it. ~150 ms of perceived loading feedback, no double-submit. Recommended but not urgent.

---

### 1b. "Improvements to practice quizzes & flashcards — mastery like Gizmo?"

The current implementation has **zero mastery infrastructure**. Here's exactly what's missing vs. Gizmo/Quizlet/Anki:

**Flashcards — what's there:** `Flashcard.js` (lines 4–12) stores `unitId`, `front`, `back`, `imageUrl`. Nothing per-user. The "Got it" button (`public/js/flashcards.js` line 21–33) just calls `POST /flashcards/review` with `cardId`, the server (`flashcardsController.js` line 19–31) awards +2 points, and a client-side `Set` tracks "reviewed this session" so the same card can't earn points twice in one session. **Refresh the page and the Set is empty** — you can earn +2 on the same card again. No SRS, no intervals, no due dates, no per-card mastery state.

**Practice quizzes — what's there:** `QuizAttempt.js` (lines 4–13) stores only `quizId`, `userId`, `score`, `total`, `durationSec`. **No per-item responses.** The result page (`quizzes-result.ejs`) shows just `score/total` + a "Try again" button. The student has no way to see which questions they got wrong, what the correct answer was, or what the explanation is.

**What Gizmo-like mastery requires (recommended order):**

1. **New model `FlashcardReview`** — per-user-per-card state:
   ```js
   { userId, cardId, state: 'new'|'learning'|'reviewing'|'mastered',
     intervalDays, ease, timesReviewed, timesCorrect,
     lastReviewedAt, nextDueAt }
   ```
2. **SM-2 algorithm** in a new `src/services/srs.js`. SM-2 is 30 lines of code, well-documented on Wikipedia. Anki uses a descendant of it. Don't reinvent.
3. **"Study session" mode** that surfaces: 10 new cards + all due cards + a configurable cap. Replaces the current linear "next/prev" UI.
4. **Two-button UI**: `Got it` (advance interval) + `Review again` (reset to learning). The current single-button design is a Quizlet-1985 pattern.
5. **Per-set mastery bar**: `X of Y cards mastered` per unit. Visible on `/flashcards` next to the unit filter chips.

**For practice quizzes:**

1. **Extend `QuizAttempt` schema** with `responses: [{ itemId, answer, correct, pointsAwarded }]` so the result page can render per-item breakdown.
2. **Result page redesign** — show each item with: the question, your answer, the correct answer, the explanation, and a ✓/✗. This is the single highest-leverage learning improvement you can ship — students learn from mistakes, not from a `7/10` number.
3. **"Retry wrong only"** mode — re-attempt only the items you missed. Gizmo does this; it's how students actually study.
4. **Best score + attempt count** is already shown on `/practice` (`quizzes-practice.ejs` line 17) — good, keep.

**Estimate:** SM-2 + FlashcardReview + new study-session UI + 2-button UI = ~1 weekend. Quiz per-item breakdown = 1 day.

---

### 1c. "Flashcard bulk add — but each card needs 2+ inputs, what can you suggest?"

You're right that a strict "fill out 5 fields × N rows" UI is painful. Three approaches in order of effort vs. payoff:

**Approach 1 — Paste textarea (RECOMMENDED, ship first)**

Add a "Bulk add" button next to "New card" in `flashcards-editor.ejs`. Opens a modal with:

- A unit `<select>` (applies to all cards in the batch)
- A single `<textarea>` placeholder:
  ```
  Genotype | The genetic makeup of an organism
  Phenotype | The observable traits
  Allele | A variant form of a gene
  ```
- A "Save all" button.

Server-side: split by `\n` → split each line by `|` (or tab, for Quizlet paste compatibility) → `Flashcard.insertMany(rows)`. **One round-trip, no per-card reload.** Covers ~95% of "I have 30 vocab words to add" cases. Anki, Quizlet, and Gimkit all support this format.

**Why this works despite 2+ inputs:** the delimiter replaces the "click to focus the next field" friction. You're typing continuously, not interacting with the UI.

**Approach 2 — Inline editable list (better UX, more work)**

Replace the modal with a table of empty rows: `[front input | back input | unit select | 🗑]`, plus `+ Add row` and `+ Add 10 rows` buttons, plus a single "Save all" at the bottom. Mobile-unfriendly but best for power users. Ship after Approach 1.

**Approach 3 — CSV/JSON import (power-user, defer)**

File upload of `.csv` with `front,back,unit_slug` columns. Lets you migrate from Quizlet exports / Anki decks. Use `papaparse` on the client or `csv-parse` on the server. Ship only if your classmates actually have existing decks to migrate.

**My pick:** ship Approach 1 this week. It's a 40-line modal + a 15-line controller endpoint. Then Approach 2 if the editor gets heavy use.

---

## 2. Behavior issues I noticed

### CRITICAL

**C1. Live test scoring is fully client-trusted — the leaderboard can be hacked.**

`src/views/live-test/take.ejs` (lines 56–68): the client computes the score itself and sends it to the server:

```js
if (correct && answer === correct.id) score = it.points;
// ...
socket.emit('live:submit', { sessionId, itemId, answer, score });
```

`src/services/realtime.js` (lines 65–75) blindly trusts it:

```js
existing.score = (existing.score || 0) + (score || 0);
```

A student can send `score: 99999` for every item. The leaderboard isn't gameable for **practice** quizzes (those are server-graded by `gradeAttempt` in `quizzes-svc.js` line 205), but **live tests** are wide open.

**Fix:** server must receive `answer` only (not `score`), look up the correct option server-side, and call `gradeAttempt` (already exists) to compute the score. Strip `score` from the socket payload entirely.

---

**C2. `admin:subscribe_live` has zero role check — any student can spy on the admin feed.**

`src/services/realtime.js` (lines 41–46):

```js
socket.on("admin:subscribe_live", () => {
  socket.join("admin:live");
  // ...
});
```

Any connected socket can join `admin:live` and listen to every anti-cheat warning, every submission, every activity event for **every** student.

**Fix:** before joining, look up the user's role from `User.findById(socket.data.userId)` and reject if `role !== 'administrator'`.

---

**C3. Socket auth trusts any `userId` from the client.**

`src/services/realtime.js` (lines 14–19):

```js
io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error("unauthorized"));
  socket.data.userId = userId;
  next();
});
```

Anyone can pass any userId. Combined with C1 and C2, a student could connect as the admin and start/advance/end live sessions on their own (`admin:start_session`, `admin:advance_item`, `admin:end_session` — all unguarded in `realtime.js` lines 48–63).

**Fix:** read the session cookie from `socket.handshake.headers.cookie`, look up the express-session via `MongoStore`, extract `userId` and `role` from the session, and stash both on `socket.data`. Reject the connection if no session or no user.

---

**C4. Live test scoring is actually broken, not just exploitable.**

`/api/live-test/current` in `src/routes/index.js` (lines 101–108) strips `is_correct` from options before sending to the client — good for security. But `live-test-take.ejs` line 61 then does:

```js
const correct = it.options.find(o => o.is_correct);
if (correct && answer === correct.id) score = it.points;
```

Since `is_correct` is stripped, `correct` is always `undefined` and `score` is always 0. **Multiple-choice live test items always score 0** in the current build. For identification/open_ended, line 67 references `it.correct_answer` which is also not in `safeItems` — same problem.

So either live tests are silently broken (every student gets 0) or, if you've been testing with a mocked payload, the moment you go to production with the real `/api/live-test/current`, scoring breaks. Both are critical.

**Fix:** combine with C1 — server-side grading. The client sends only the `answer`; the server resolves correctness. No correct-answer info ever leaves the server.

---

### HIGH

**H1. Practice quiz time limit is not enforced.**

`Quiz.timeLimitMin` is set in the schema and configurable in the editor, but `quizzes-take.ejs` only tracks `durationSec` for stats — it doesn't show a countdown or auto-submit. A student can take 2 hours on a 10-minute quiz.

**Fix:** render the time limit as a countdown in the take view; on `0`, submit the form programmatically. ~30 lines of JS.

---

**H2. Practice quiz refresh loses all answers.**

`quizzes-take.ejs` keeps answers only in form state — refresh the page mid-quiz and you start over. Should save to `sessionStorage` on every change and restore on load.

---

**H3. Quiz result page shows no per-item breakdown.**

`quizzes-result.ejs` is 10 lines: icon, score/total, "+X points", two CTAs. Students can't see which items they got wrong, what the correct answer was, or why. This is the #1 learning-value gap in the app — see 1b above.

---

**H4. Live test creates a fresh Socket.IO connection on every event.**

`live-test-take.ejs` lines 69, 78: `const socket = io({...})` is called inside `submitAnswer()` and inside the `visibilitychange` listener. Every answer submit and every tab-switch opens a new connection. Memory leak on long sessions.

**Fix:** create one socket at page load, reuse it. Listen for `live:item_changed` and `live:ended` events on it.

---

**H5. Live test polls `/api/live-test/current` every 3 seconds — and ignores Socket.IO.**

`live-test-take.ejs` line 87: `setInterval(loadSession, 3000)`. The Socket.IO server already emits `live:item_changed` (realtime.js line 55) when the admin advances — but the client never listens. Wasted bandwidth + race conditions (student sees stale item for up to 3 seconds).

**Fix:** subscribe to `live:item_changed` and `live:ended` on the persistent socket; remove the interval.

---

**H6. Anti-cheat fires forever after session ends.**

`live-test-take.ejs` line 77: `if (document.hidden && session)` — but `session` is never nulled when `live:ended` is received. After the test ends, every tab-switch still emits an anti-cheat warning for a session that's already over.

**Fix:** on `live:ended`, set `session = null` and remove event listeners (or set a `liveEnded` flag and short-circuit).

---

**H7. Points farming is trivial.**

`flashcardsController.review` (lines 19–31) awards +2 on every POST with a `cardId` — no rate limit, no daily cap, no per-card-per-day check. A student can run `for i in 1..10000: curl -X POST /flashcards/review -d cardId=anything -b cookies.txt` and gain 20,000 points in 30 seconds.

Same for practice quizzes: `submitPractice` (line 37–61) awards `5 + score` on every attempt — no max attempts per day, no "best score only" rule.

**Fix:**
- Track `reviewedCardIds: [ObjectId]` on the User (or a separate `DailyReview` collection keyed by `userId + date`). Reject if already reviewed today.
- Cap practice quiz attempts at e.g. 5/day/quiz. Only the best score awards points; subsequent attempts award 0 (still recorded for analytics).

---

**H8. `requireFullscreen` toggle in admin settings is decorative.**

`admin-settings.ejs` line 12 has the toggle, `Settings.antiCheat.requireFullscreen` is stored — but `live-test-take.ejs` never calls `document.documentElement.requestFullscreen()`. The toggle does nothing. Either implement it or remove the toggle.

Same for `deadline` on the Quiz schema — set in the editor, never checked on submit.

---

### MEDIUM

**M1. Username enumeration on login.**

`authController.js` line 75: `"Account not found. Register a new one."`. Line 80: `"Wrong password."` These are different messages — an attacker can probe usernames and learn which exist.

**Fix:** same error message for both: `"Invalid username or password."` It's a class of 30 students so the practical risk is low, but it's free to fix.

---

**M2. No CSRF protection.**

All POST routes rely on the session cookie with no CSRF token. A malicious page can submit `/api/admin/promote` (line 87 of routes), `/api/admin/settings`, `/practice/:id/submit`, `/flashcards/review` on behalf of any logged-in user.

For a single-class app this is low-severity, but a classmate with a grudge could write a one-line HTML page that farms points off every logged-in student who visits.

**Fix:** add the `csrf` package (or `csurf`) and put a token in every form. Or require a custom `X-Requested-With` header on all JSON endpoints — forms can't add custom headers without JS, so this blocks the easiest attacks.

---

**M3. No rate limiting on `/login` and `/register`.**

Credential stuffing and registration spam are wide open. For a class of 30 the practical risk is tiny, but `express-rate-limit` is 3 lines of code.

---

**M4. `attachUser` exposes `password_hash` on `req.user`.**

`src/middleware/auth.js` line 25:

```js
req.user = {
  ...user,
  password_hash: user.passwordHash,  // why?
};
```

It's not directly leaked to views (templates pick specific fields), but any `console.log(req.user)` or unhandled error that prints `req.user` leaks the hash. Remove the line — nothing reads it.

---

**M5. `attachUser` writes `lastActiveDate` to MongoDB on every request.**

`src/middleware/auth.js` lines 28–31:

```js
User.updateOne(
  { _id: user._id },
  { lastActiveDate: new Date().toISOString().slice(0, 10) }
).catch(() => {});
```

One DB write per page load per user. Pointless — `lastActiveDate` only needs day-level granularity, and `bumpStreak` already updates it on login. Either remove this write entirely or gate it on "has it been > 1 hour since the last write?".

---

**M6. `bumpStreak` called on register is a no-op.**

`authController.register` line 59 calls `await bumpStreak(user._id)`. But `User.create` (line 51) sets `lastActiveDate` to today via the schema default (User.js line 31). Then `bumpStreak` (leaderboard-svc.js line 17) sees `lastActiveDate === today` and returns immediately. So the first-ever user registers with streak 0, not 1. Minor — the next day's login will set it to 1.

---

**M7. `admin:dashboard` does N+1 queries to count quizzes.**

`adminController.js` line 9:

```js
const quizCount = await listQuizzes().then((q) => q.length);
```

`listQuizzes` (`quizzes-svc.js` line 4–12) loads every quiz **with all its items and all their options** just to count them. Use `Quiz.countDocuments()` instead. Inconsistent with line 10 which correctly uses `Flashcard.countDocuments()`.

---

**M8. Sidebar shows initials even when user uploaded a photo.**

`sidebar.ejs` (line 45–47) renders the OKLCH gradient div with initials inside, but never checks `user.avatar_url` to render an `<img>`. The `admin-settings.ejs` (line 39) **does** check. So a student uploads a photo, sees it in admin settings, but never sees it in the sidebar. Easy fix: copy the `<% if (u.avatarUrl) %>` branch from `admin-settings.ejs` into `sidebar.ejs`.

---

### LOW

**L1. Socket.io CDN script loaded on every page.**

`layout-main.ejs` line 41 loads `socket.io.min.js` unconditionally. Pages like `/notes`, `/profile`, `/practice` never use it. Move to a per-page `<%- extraScripts %>` slot.

**L2. `email` field on User schema is unused.**

`User.js` line 21. Never collected in registration, never shown in profile. Either collect it (password-reset flow) or drop it.

**L3. `signup.ejs` exists but no route uses it.**

`src/views/signup.ejs` is in the tree but `routes/index.js` only mounts `/register` → `register.ejs`. Delete `signup.ejs` or wire it up — pick one.

**L4. `cipher.js` config file — read it before assuming it's used.** If it's not imported anywhere, delete it. (I didn't fetch it; verify with `grep -r "cipher" src/`.)

**L5. Toast styles are inline in `app.js`.**

`public/js/app.js` lines 24–31 inline the toast's CSS via `.style.cssText`. Hard to theme, hard to maintain. Move to a `.toast` class in `style.css`.

**L6. No favicon in `layout-main.ejs`.**

The browser tab is blank. Drop a 32×32 PNG of the STEM logo into `public/assets/` and add `<link rel="icon" href="/assets/favicon.png" />`.

**L7. Live test "auto-submit" contradicts README "auto-kick".**

`realtime.js` line 85: `// Auto-submit instead of kicking`. The README says "auto-kicked". Either change the code to actually kick the student (status: "kicked", force-disconnect socket) or update the README. Pick one story.

---

## 3. Design feedback

**What's working:**

- Dark navy (#0a1228) + Biology green (#10b981) palette is on-brand for "Biology" + "Tesla STEM".
- Inter is the right default. OKLCH for avatar hues is modern and correct.
- Role-aware sidebar (`sidebar.ejs`) — different links per role — is clean.
- The hero in `landing.ejs` has good visual hierarchy: kicker → tagline → title → CTA.

**What's not:**

1. **`quizzes-result.ejs` is too sparse.** 10 lines of EJS for the most important page in the learning loop. After finishing a quiz the student should see per-item breakdown, their previous best, time spent, and the explanation for each missed item. Right now they see a number and a button. This is the single biggest design improvement you can make — and it ties directly to the mastery-system question (1b).

2. **Empty states are weak.** `flashcards-index.ejs` line 15: `<p>No flashcards in this filter.</p>` in a centered muted paragraph. A student who lands here thinks the app is broken. Add an illustration or a CTA ("Ask your moderator to add cards for this unit").

3. **Live test taking view is JS-or-die.** `live-test-take.ejs` is one `<div>` plus 75 lines of inline JS. JS-disabled users see "Connecting to live session…" forever. Not a real concern for a class of 30 on school Chromebooks, but worth a `<noscript>` fallback.

4. **Quiz take view uses `display: block/none` between items.** No transition, no animation. Feels jarring. A 200 ms fade or slide would smooth it out.

5. **Accessibility is sparse.** No `aria-current` on active sidebar links. Flashcard flip is click-only (no Space/Enter). Quiz radio groups have no `<fieldset>`/`<legend>`. Form errors aren't associated with inputs via `aria-describedby`. Muted text `#8b95b3` on `#0a1228` — contrast ratio ~5.5:1, passes WCAG AA but barely. These are easy wins if you ever care about it; for a class app, low priority.

6. **No consistent error/input styling.** There's no `.input-error` class, no inline form validation. All errors are alerts. Profile editor would benefit from inline validation (e.g., "username taken" appears under the field, not in a popup).

7. **Toast styles are inline.** See L5 above.

---

## 4. Essentials to ADD (priority order)

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | Server-side scoring for live tests (C1, C4) | CRITICAL | ~2 hrs |
| 2 | Role check on `admin:subscribe_live` (C2) | CRITICAL | 30 min |
| 3 | Session-based socket auth (C3) | CRITICAL | ~2 hrs |
| 4 | Per-item breakdown on quiz results (H3, ties to 1b) | HIGH | 1 day |
| 5 | Rate limiting on /login, /register, /flashcards/review (H7, M3) | HIGH | 1 hr |
| 6 | Daily cap on flashcard points + per-card-per-day (H7) | HIGH | 2 hrs |
| 7 | Time limit enforcement on practice quizzes (H1) | HIGH | 2 hrs |
| 8 | FlashcardReview model + SM-2 SRS (1b) | HIGH | 1 weekend |
| 9 | Bulk add flashcards via paste textarea (1c) | MEDIUM | 2 hrs |
| 10 | CSRF protection (M2) | MEDIUM | 1 hr |
| 11 | Save quiz progress to sessionStorage (H2) | MEDIUM | 1 hr |
| 12 | Avatar URL support in sidebar (M8) | MEDIUM | 10 min |
| 13 | Loading state on login/register forms (1a) | LOW | 30 min |
| 14 | Favicon (L6) | LOW | 5 min |

---

## 5. Things to REMOVE

- `requireFullscreen` toggle in admin settings until you actually implement `requestFullscreen()` (H8). Or implement it.
- `deadline` field on Quiz schema if you're not going to enforce it on submit (H8).
- `email` field on User schema if you're not collecting it (L2).
- `signup.ejs` if no route uses it (L3).
- `password_hash` line in `attachUser` middleware (M4).
- `User.updateOne` for `lastActiveDate` on every request in `attachUser` (M5).
- Socket.io CDN script from `layout-main.ejs` — move to per-page slot (L1).
- The 3-second polling interval in `live-test-take.ejs` — replace with socket subscription (H5).

---

## 6. Summary

The architecture is sound — Express + EJS + Mongoose + Socket.IO is the right stack for this. The code is readable, the role middleware is clean, the seed script is idempotent. **The problems are concentrated in the live-test path**: socket auth, scoring, and admin-room authorization all need work before you trust a real test to it.

For learning value, the two highest-leverage changes are:

1. Per-item breakdown on the quiz result page (H3).
2. SM-2-based flashcard mastery (1b).

Those two turn this from "a class website with quizzes" into "a class website students actually use to study". Gizmo's moat is the mastery loop, not the UI — and the mastery loop is replicable in a weekend.

The login "feels too fast" thing is genuinely not a bug — it's just missing polish. Add the button-disable + spinner and you're done.

---
*Audit performed against the `master` branch as of the time of writing. File and line references may drift as the code evolves.*
