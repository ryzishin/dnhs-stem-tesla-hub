# DNHS STEM Tesla Hub — Biology 2

> The study hub for the **Tesla STEM — Biology 2** section at **Dangcagan National High School**.
> Notes, practice quizzes, flashcards, live hosted tests, streaks, leaderboard, and public profiles — all in one place.
>
> _Explore. Practice. Apply. Discover Biology._

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![EJS](https://img.shields.io/badge/EJS-3.x-bfa97a)](https://ejs.co/)
[![Made for DNHS STEM Tesla](https://img.shields.io/badge/Made%20for-DNHS%20STEM%20Tesla%20%C2%B7%20Biology%202-8b5cf6)](#)

---

## What this is

A full-stack web app purpose-built for a single class section. Anyone can register with a username + display name. The **first registered account automatically becomes the administrator** (so the class adviser can set things up on first run). Every account after that defaults to `student`, and the administrator can promote trusted classmates to `moderator` from the admin dashboard.

Three roles:

| Role              | What they can do                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Student**       | Read notes, take practice quizzes (unlimited retries), review flashcards, climb the leaderboard, take live tests.                       |
| **Moderator**     | A trusted student. Everything a student can do, plus: edit notes, edit practice quizzes, edit flashcards. No live-test control access.  |
| **Administrator** | The adviser. Everything, plus: live monitoring, host live tests, edit the live test, settings, promote classmates.                    |

Points come from **practice quizzes & flashcards only** — never from live tests.

---

## Features

- **Notes** — units → parts → content blocks (paragraph, heading, bullet, numbered, image, divider, callout). All editable from the UI.
- **Practice quizzes** — unlimited retries, per-quiz time limit, instant scoring, explanations.
- **Flashcards** — quick review, +2 points per card reviewed each session.
- **Live tests** — administrator-hosted, real-time broadcast via Socket.IO, randomized item & option order per student.
- **Anti-cheat** — tab-switch detection, fullscreen lock, copy/paste/right-click blocking, warning cap with auto-submit.
- **Leaderboard** — weekly reset, streak bonuses, total points.
- **Public profiles** — display name, avatar, bio, social links, stats, recent activity.
- **Roles & permissions** — student / moderator / administrator, enforced through middleware.
- **Real-time admin monitor** — live activity feed, anti-cheat warnings, score updates.

---

## Tech stack

| Layer        | Choice                                                       |
| ------------ | ----------------------------------------------------------- |
| Backend      | Node.js + Express 4                                         |
| Templating   | EJS + `express-ejs-layouts`                                 |
| Database     | MongoDB via Mongoose 8                                      |
| Auth         | Custom — username + bcrypt-hashed passwords, MongoDB sessions |
| Real-time    | Socket.IO 4 (live test broadcast, admin monitor feed)        |
| File uploads | Multer (profile pictures, 5 MB image limit)                 |
| Validation   | Zod                                                         |
| Security     | Helmet (CSP-tuned), express-session, role middleware         |

---

## Project structure

```
dnhs-stem-tesla-hub/
├── public/
│   ├── assets/        # Logos, icons, static images
│   ├── css/           # Stylesheets
│   └── js/            # Client-side scripts (live test, anti-cheat, UI)
├── scripts/
│   └── seed.js        # Demo content seeder (re-runnable, upserts)
├── src/
│   ├── config/        # env.js · db.js
│   ├── controllers/   # admin · auth · flashcards · notes · pages · profile · quizzes
│   ├── middleware/    # shareLocals · auth · role guards
│   ├── models/        # User · Unit · Part · ContentBlock · Quiz · QuizItem · QuizOption
│   │                  #   · Flashcard · LiveSession · LiveParticipant · QuizAttempt
│   │                  #   · ActivityFeed · Settings
│   ├── routes/        # index.js (mounts all route groups)
│   ├── services/      # realtime.js (Socket.IO server)
│   ├── views/         # EJS templates + layouts/
│   └── server.js      # Express boot, Helmet, session, MongoStore, routes, 404/500
├── .gitignore
├── package.json
└── README.md
```

---

## Getting started (local)

### 1. Prerequisites

- **Node.js 18+**
- **MongoDB** — pick one:
  - **Local:** install MongoDB Community Server, or
  - **Docker:** `docker run -d -p 27017:27017 --name mongo mongo`, or
  - **Atlas (free cloud):** create a cluster at <https://www.mongodb.com/atlas>

### 2. Install

```bash
npm install
cp .env.example .env
```

### 3. Configure `.env`

| Variable           | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `MONGODB_URI`      | MongoDB connection string (local or Atlas)                                    |
| `MONGODB_DB_NAME`  | Database name (default `stem_tesla_biohub`)                                   |
| `SESSION_SECRET`   | Long random string for session signing (e.g. `openssl rand -hex 32`)        |
| `PUBLIC_URL`       | Public-facing URL of the app (`http://localhost:3000` for local)             |

Mongoose auto-creates collections and indexes on first write — no manual SQL setup needed.

### 4. Seed demo content

```bash
npm run db:seed
```

Creates 4 note units, 2 practice quizzes, 1 live quiz, 10 flashcards, and the settings singleton. **Does not create any user accounts.**

### 5. Run

```bash
npm run dev     # development (auto-restart on file changes via node --watch)
# or
npm start       # production
```

Open <http://localhost:3000> and click **Register**. The first account you create becomes the administrator automatically — sign up with the teacher's username (e.g. `ms.roa`) and you'll land on the admin dashboard. After that, anyone who registers is a `student`.

---

## Roles & permissions matrix

| Action                                | Student | Moderator | Administrator |
| ------------------------------------- | :-----: | :-------: | :-----------: |
| Read notes                            |   ✅    |    ✅     |      ✅       |
| Take practice quizzes                 |   ✅    |    ✅     |      ✅       |
| Review flashcards (+2 pts each)       |   ✅    |    ✅     |      ✅       |
| Take live tests                        |   ✅    |    ✅     |      ✅       |
| Change own password & profile         |   ✅    |    ✅     |      ✅       |
| View public profiles                  |   ✅    |    ✅     |      ✅       |
| View leaderboard & classmates         |   ✅    |    ✅     |      ✅       |
| **Edit notes** (units/parts/blocks)   |   ❌    |    ✅     |      ✅       |
| **Edit practice quizzes & items**     |   ❌    |    ✅     |      ✅       |
| **Edit flashcards**                   |   ❌    |    ✅     |      ✅       |
| **Host live test**                    |   ❌    |    ❌     |      ✅       |
| **Live monitor (real-time)**          |   ❌    |    ❌     |      ✅       |
| **Edit live test items**              |   ❌    |    ❌     |      ✅       |
| **Settings (anti-cheat, deadlines)** |   ❌    |    ❌     |      ✅       |
| **Promote classmates**                |   ❌    |    ❌     |      ✅       |

---

## Anti-cheat (live tests)

Configured in **Admin → Settings**. Applied to every student device while a live session is active:

- **Tab-switch detection** — Page Visibility API. Each switch adds a warning.
- **Fullscreen lock** — prompts the student to enter fullscreen before the test starts.
- **Copy / cut / paste blocked** — `copy`, `cut`, `paste` events prevented.
- **Right-click blocked** — `contextmenu` prevented.
- **Warning cap** — once a student hits the cap (default 3), their test is **auto-submitted** (with whatever score they've accumulated so far) and the admin is notified via Socket.IO.
- **Randomized items & options** — each student sees a different order. The admin sets the correct answer; the system handles reordering.

> **⚠️ Note:** Anti-cheat features are **deterrent-grade, not enforcement-grade**.
> A determined student with DevTools open can bypass all client-side checks (tab-switch
> detection, fullscreen lock, copy/paste blocking). These features exist to discourage
> casual cheating, not to prevent it entirely. For high-stakes assessment, use proctoring
> software or in-person testing.

---

## Real-time (Socket.IO)

`src/services/realtime.js` handles:

- **Live test broadcast** — admin starts → students see a banner; admin advances → students see next item; student submits → admin sees score update live.
- **Anti-cheat warnings** — student-side detection fires events to the server, which broadcasts to the admin monitor.
- **Activity feed** — students ping activity events (`login`, `view_note`, `practice_quiz`, `flashcard`, …) which the admin monitor displays in real time.

---

## Points & leaderboard rules

- **Practice quiz completion:** +5 base + score (correct items)
- **Flashcard reviewed:** +2 each (per session)
- **Daily streak bonus:** applied automatically when active
- **Weekly leaderboard:** resets every Monday
- **Live test scores:** never counted toward the leaderboard

---

## Public profiles

Every user has a public profile at `/profile/:id`. Click any classmate's card in `/classmates` or any row in the leaderboard to view their:

- Display name, role, username, avatar
- Bio (up to 280 characters — editable in profile settings)
- Social links (Twitter/X, Instagram, GitHub, Facebook, TikTok, YouTube, Website)
- Stats: total points, day streak, quizzes taken, cards reviewed
- Recent practice attempts

Edit your own profile at `/profile`:

- Display name (changeable anytime)
- Bio (280-char limit)
- Avatar photo (upload up to 5 MB) **or** avatar color (10 hue presets)
- Social links (all 7 platforms)
- Change password (current → new → confirm)

---

## Editing content

All content is added and modified from the in-app editors — no need to touch the database directly.

- **Notes editor** (`/moderator/notes`) — units, parts, and content blocks. Six block kinds: paragraph, heading, bullet, numbered, image, divider, callout.
- **Quiz editor** (`/moderator/practice` and `/admin/live-editor`) — quiz metadata, items, options, correct answer, explanation, time limit, deadline.
- **Flashcards editor** (`/moderator/flashcards`) — front/back per card, organized by unit.

---

## Scripts

| Script             | Description                                          |
| ------------------ | --------------------------------------------------- |
| `npm run dev`      | Start in development mode with auto-restart         |
| `npm start`         | Start in production mode                            |
| `npm run db:seed`  | Seed demo content (re-runnable, idempotent upserts) |
| `npm run lint`     | Lint `src/` with ESLint                              |

---

## Deployment

Recommended platforms: **Render** or **Railway** (both support WebSockets out of the box — Vercel serverless does not).

1. Push the project to a GitHub repo.
2. Create a new Web Service and pick the repo.
3. Set the build command to `npm install` and the start command to `npm start`.
4. Add every variable from `.env` (`MONGODB_URI`, `MONGODB_DB_NAME`, `SESSION_SECRET`, `PUBLIC_URL`) as environment variables.
5. Deploy.
6. Run `npm run db:seed` once (Render/Railway both let you run one-off shell commands).
7. Visit `/register` and sign up with the adviser's username — that account becomes the administrator automatically.

For MongoDB Atlas, add your deploy's IP to the Atlas IP Access List (or allow `0.0.0.0/0` for any IP).

---

## Troubleshooting

- **MongoDB connection fails** — check `MONGODB_URI` in `.env`. For Atlas, make sure your IP is in the Access List and the database user has read/write permissions.
- **Socket.IO events not flowing** — check that your deploy platform supports WebSocket (Render & Railway do; Vercel serverless does not).
- **Students see "No active live test"** — the admin hasn't started a session. Admin → Host Live Test → pick a quiz → Start.

---

## License

MIT. Built for the Tesla STEM — Biology 2 class at Dangcagan National High School.

> _Explore. Practice. Apply. Discover Biology._
