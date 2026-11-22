# STEM Tesla Hub

The study hub for the STEM Tesla section at **Dangcagan National High School** — notes that credit their sources, practice quizzes, flashcards, live hosted tests, and a class leaderboard, across every subject the section takes.

Built with **Express + EJS + MongoDB (Mongoose) + Socket.IO**. One Node process, one port, no build step.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Why this exists

Our section was juggling group chats, scattered PDFs, and review links that died. The adviser asked for one place where classmates could actually study — and where the material is trustworthy, so every note ends with a "Where this comes from" list (OpenStax, Khan Academy, whatever your moderators used). The first version was Biology-only; this one grew up: any subject, moderated by classmates, with roles that hold up.

## Quick start (local)

You need Node.js 18+ and a MongoDB connection string (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works everywhere; no local install needed).

```bash
npm install
cp .env.example .env        # then fill MONGODB_URI and SESSION_SECRET
npm run db:seed             # creates 4 subjects with real starter content
npm run dev:mongo           # optional: throwaway local MongoDB instead of Atlas
npm run dev                 # http://localhost:3000
```

Sanity-check your config any time with `npm run check` — it verifies the MongoDB connection without booting the app.

The **first account that registers becomes the administrator** (the adviser). Everyone after that signs up as a student. There is no seed user and no default password.

## What's inside

- **Notes** — built from blocks (headings, paragraphs, lists, key terms, callouts, images, dividers), each note ending in a credited source list. Readers see clean typography; builders see a block editor.
- **Practice quizzes** — multiple choice, true/false, and short answer. Unlimited retakes, randomized item and option order, instant scoring with explanations. Server-side grading, always.
- **Flashcards** — decks with flip animation, "I knew it" / "Review again", points per session.
- **Live tests** — the adviser hosts from a monitor console, opening one item at a time; students answer at `/live`. The server owns the item order and the scoring, students' browsers never see correct answers. Anti-cheat: every leave (tab switch, app switch, fullscreen exit, sign-out) counts, and reaching the cap **auto-submits the student's test as-is** — no kick, no re-entry. Students can request a re-attempt; the adviser approves or declines per case. Results export as CSV.
- **Points & leaderboard** — practice quizzes, flashcards, and daily streaks earn points. Live tests never do. Weekly board resets every Monday automatically.
- **Classmates & profiles** — everyone gets a public profile at a clean `/u/username` address: photo (click your avatar to upload), points, streak, quizzes taken, cards reviewed, recent activity, and optional social links (Facebook, Instagram, TikTok, X, YouTube, GitHub).

## Roles

| | Student | Moderator | Admin (adviser) |
| --- | --- | --- | --- |
| Read notes, take quizzes & live tests, earn points | yes | yes | yes |
| Build notes / **practice** quizzes / decks — **in their assigned subjects** | — | yes | yes (all subjects) |
| Build live quizzes, host live tests, run anti-cheat | — | — | yes |
| Approve / decline re-attempt requests | — | — | yes |
| Reset passwords, manage roles & members | — | — | yes |
| Create subjects, edit settings | — | — | yes |

The first registered account is admin. After that, admins assign the moderator role per subject from **Admin → People & roles** — changes are staged per row and only applied after an explicit Save + confirm.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `MONGODB_URI` | — (required) | MongoDB connection string (Atlas or local) |
| `MONGODB_DB_NAME` | `stem_tesla_hub` | Database name inside that server |
| `SESSION_SECRET` | dev fallback | Long random string signing session cookies — required in production |
| `PUBLIC_URL` | `http://localhost:3000` | Public address, used for links |
| `PORT` | `3000` | Render injects this automatically |
| `NODE_ENV` | `development` | Set `production` on Render (secure cookies, log format) |

Anti-cheat defaults, registration on/off, and all point values are editable in **Admin → Settings** — no redeploy needed.

## Scripts

```bash
npm start       # run in production
npm run dev     # run with auto-restart on file changes
npm run db:seed # seed subjects + content (add --force to replace existing content)
npm run dev:mongo  # throwaway local MongoDB on :27017 (data in ./data)
npm run check   # verify env + MongoDB connection
node scripts/e2e-test.mjs  # full end-to-end test against a running server
```

## Deployment

Written for **Render + MongoDB Atlas** — see [DEPLOYMENT.md](DEPLOYMENT.md) for the exact click-by-click path. Any host that supports WebSockets works (Render, Railway, fly.io); serverless platforms like Vercel will break live tests.

## Limitations

- One Node process — fine for a section (50+ students), not for many schools on one instance.
- Images in notes and quiz items are links, not uploads.
- Password resets are admin/moderator-driven, not email-based (no email infrastructure).
- Registration is open by the section's choice; switch it off in Admin → Settings when sign-ups should pause.

## License

MIT. Built by the STEM Tesla section, Dangcagan National High School.
