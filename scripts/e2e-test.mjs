// scripts/e2e-test.mjs — end-to-end verification against a running server + MongoDB.
//   1. start the app + mongo   2. npm run db:seed   3. node scripts/e2e-test.mjs
import "dotenv/config";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { io } from "socket.io-client";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB_NAME || "stem_tesla_hub";

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log("  [ok]   " + name); }
  else { fail++; console.log("  [FAIL] " + name + (extra ? " — " + extra : "")); }
}

// tiny cookie-jar fetch
function client() {
  let cookie = "";
  return async function req(method, path2, body, form) {
    const res = await fetch(BASE + path2, {
      method,
      redirect: "manual",
      headers: {
        cookie,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : body ? { "Content-Type": "application/json" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return res;
  };
}

await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });

console.log("\n== seed state ==");
const { Subject, Quiz, Note, Deck, User, LiveSession, LiveParticipant, Attempt } = await import("../src/models/index.js");
const bio = await Subject.findOne({ slug: "biology-2" });
const chem = await Subject.findOne({ slug: "chemistry-2" });
ok("4 subjects seeded", (await Subject.countDocuments()) === 4);
const practiceQuiz = await Quiz.findOne({ subject: bio._id, mode: "practice" });
const liveQuiz = await Quiz.findOne({ subject: bio._id, mode: "live" });
const deck = await Deck.findOne({ subject: bio._id });
ok("practice + live quiz + deck present", !!practiceQuiz && !!liveQuiz && !!deck);

console.log("\n== adviser: first registrant becomes admin ==");
const adviser = client();
let res = await adviser("POST", "/register", null, { name: "Adviser Tesla", username: "adviser", password: "secret123", confirm: "secret123" });
ok("register adviser", res.status === 302 && res.headers.get("location") === "/hub", res.status + " → " + res.headers.get("location"));
res = await adviser("GET", "/admin");
ok("admin dashboard loads", res.status === 200);
const adviserDoc = await User.findOne({ username: "adviser" });
ok("adviser role is admin", adviserDoc.role === "admin");

console.log("\n== students: open signup defaults to student role ==");
const makeStudent = async (name, username) => {
  const c = client();
  const r = await c("POST", "/register", null, { name, username, password: "secret123", confirm: "secret123" });
  const doc = await User.findOne({ username });
  ok(`register ${username} → student role`, r.status === 302 && doc.role === "student");
  return c;
};
const modUser = await makeStudent("Althea Reyes", "althea");
const plainUser = await makeStudent("JM Cruz", "jmreyes");

console.log("\n== role system: adviser assigns moderator with subject scope ==");
res = await adviser("POST", `/api/admin/users/${(await User.findOne({ username: "althea" }))._id}/role`, { role: "moderator", subjectIds: [bio._id.toString()] });
const altheaDoc = await User.findOne({ username: "althea" });
ok("althea promoted to moderator of Biology 2", res.status === 200 && altheaDoc.role === "moderator" && altheaDoc.moderatedSubjects.length === 1);

console.log("\n== builders: moderator scoped to their subject ==");
res = await modUser("GET", "/build");
ok("build page loads for moderator", res.status === 200);
res = await modUser("POST", "/api/build/notes", { subjectId: bio._id.toString(), title: "E2E Test Note" });
const noteBody = await res.json();
ok("moderator creates note in own subject", res.status === 200 && !!noteBody.id);
const testNoteId = noteBody.id;
res = await modUser("PUT", `/api/build/notes/${testNoteId}`, {
  title: "E2E Test Note", blurb: "built during e2e", published: true,
  blocks: [
    { type: "heading", level: 2, text: "Section" },
    { type: "paragraph", text: "Paragraph with content." },
    { type: "keyterm", term: "term", definition: "definition" },
    { type: "bullets", items: ["one", "two"] },
    { type: "callout", variant: "tip", text: "tip text" },
    { type: "heading", level: 3, text: "Deeper dive" },
    { type: "paragraph", text: "More content for the scroll-spy to chew on." },
    { type: "divider" },
    { type: "heading", level: 2, text: "Wrap-up" },
    { type: "paragraph", text: "Final thoughts." },
  ],
  sources: [{ label: "OpenStax", url: "https://openstax.org" }],
});
ok("moderator saves full note (blocks + sources)", res.status === 200);
res = await plainUser("GET", `/notes/${testNoteId}`);
const noteHtml = await res.text();
ok("note page renders with heading anchors for the mini-TOC", res.status === 200 && noteHtml.includes('id="sec-') && noteHtml.includes("note-toc-inline"), "anchors=" + (noteHtml.match(/id="sec-/g) || []).length);
ok("note TOC script attached", noteHtml.includes("/js/note-toc.js"));
res = await modUser("POST", "/api/build/notes", { subjectId: chem._id.toString(), title: "Not allowed" });
ok("moderator blocked outside their subject", res.status === 403);
res = await plainUser("GET", "/build");
ok("student cannot open builders", res.status === 403);
res = await plainUser("POST", "/api/build/notes", { subjectId: bio._id.toString(), title: "hax" });
ok("student API blocked from building", res.status === 403);

console.log("\n== role separation: live tests + members belong to the adviser ==");
res = await modUser("GET", "/host");
ok("moderator cannot open the host area", res.status === 403, res.status);
res = await modUser("POST", "/api/host/start", { quizId: liveQuiz._id.toString() });
ok("moderator cannot start a live session", res.status === 403, res.status);
res = await modUser("POST", "/api/build/quizzes", { subjectId: bio._id.toString(), title: "Sneaky live", mode: "live" });
ok("moderator cannot create a live quiz", res.status === 403, res.status);
res = await modUser("GET", "/build/quiz/" + liveQuiz._id);
ok("moderator cannot open a live quiz editor", res.status === 404, res.status);
res = await modUser("POST", `/api/build/members/${(await User.findOne({ username: "jmreyes" }))._id}/reset`, { password: "haxpass1" });
ok("moderator password-reset endpoint is gone", res.status === 403 || res.status === 404, res.status);
res = await adviser("POST", "/api/build/quizzes", { subjectId: bio._id.toString(), title: "Admin live quiz", mode: "live" });
const adminLiveBody = await res.json();
ok("admin can create a live quiz", res.status === 200 && adminLiveBody.mode === "live", res.status);
res = await adviser("POST", "/api/admin/subjects", { name: "E2E Subject" });
const subjBody = await res.json();
const e2eSubject = await Subject.findById(subjBody.id);
ok("subject created without color/icon gets defaults", res.status === 200 && !!e2eSubject.color && !!e2eSubject.icon, JSON.stringify(subjBody));

console.log("\n== practice quiz: server-side grading + points ==");
const attempter = plainUser;
res = await attempter("GET", `/quiz/${practiceQuiz._id}`);
ok("student opens quiz", res.status === 200);
const answers = {};
for (const it of practiceQuiz.items) {
  if (it.type === "mcq") answers[it.id] = it.options.find((o) => o.isCorrect).id;
  else answers[it.id] = it.answer;
}
res = await attempter("POST", `/quiz/${practiceQuiz._id}/submit`, null, { ...Object.fromEntries(Object.entries(answers).map(([k, v]) => [`answers[${k}]`, v])) });
ok("submit redirects to result", res.status === 302 && res.headers.get("location").includes("/result/"), res.status);
const attempt = await Attempt.findOne({ user: (await User.findOne({ username: "jmreyes" }))._id }).sort("-createdAt");
ok("attempt graded 5/5 by server", attempt && attempt.score === 5 && attempt.total === 5, attempt ? `${attempt.score}/${attempt.total}` : "no attempt");
const jmDoc = await User.findOne({ username: "jmreyes" });
ok("points awarded (base 5 + 5 correct + streak 3)", jmDoc.points >= 13, "points=" + jmDoc.points);

console.log("\n== cheating attempt: wrong answers score 0 ==");
const cheat = await makeStudent("Cheaty Charlene", "cheaty");
const wrong = {};
for (const it of practiceQuiz.items) {
  if (it.type === "mcq") wrong[it.id] = it.options.find((o) => !o.isCorrect)?.id || "bogus";
  else wrong[it.id] = it.type === "tf" ? (it.answer === "true" ? "false" : "true") : "wrong-guess";
}
await cheat("POST", `/quiz/${practiceQuiz._id}/submit`, null, { ...Object.fromEntries(Object.entries(wrong).map(([k, v]) => [`answers[${k}]`, v])) });
const cheatAttempt = await Attempt.findOne({ user: (await User.findOne({ username: "cheaty" }))._id }).sort("-createdAt");
ok("all-wrong answers graded 0", cheatAttempt.score === 0);

console.log("\n== flashcards: session banking ==");
res = await plainUser("POST", `/deck/${deck._id}/finish`, { known: 5, total: 8 });
const finBody = await res.json();
ok("flashcard session banks points (5 × 2)", res.status === 200 && finBody.pointsEarned === 10, JSON.stringify(finBody));

// leaderboard now carries the weekly reset countdown chip
res = await plainUser("GET", "/leaderboard");
const lbHtml = await res.text();
ok("leaderboard shows weekly reset countdown", res.status === 200 && lbHtml.includes("data-countdown="), res.status);

console.log("\n== profile: avatar upload, links, /u/username ==");
// 1x1 red PNG
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
res = await plainUser("POST", "/profile/avatar", { image: TINY_PNG });
const avBody = await res.json();
ok("avatar upload accepted", res.status === 200 && !!avBody.avatarUrl, res.status + " " + JSON.stringify(avBody));
const jmAfterAvatar = await User.findOne({ username: "jmreyes" });
const avFile = path.join(path.resolve("public"), jmAfterAvatar.avatarUrl || "/x");
ok("avatar file written under public/", jmAfterAvatar.avatarUrl.startsWith("/uploads/avatars/") && fs.existsSync(avFile), jmAfterAvatar.avatarUrl);
res = await plainUser("GET", jmAfterAvatar.avatarUrl);
ok("avatar file served", res.status === 200, res.status);
res = await plainUser("POST", "/profile", null, {
  name: "JM Cruz", bio: "hi", link_facebook: "jmcruz", link_tiktok: "@jm.cruz", link_bogus: "x",
});
ok("profile save with social links", res.status === 302);
const jmLinks = await User.findOne({ username: "jmreyes" });
ok("facebook handle normalized to a URL", jmLinks.links.facebook === "https://facebook.com/jmcruz", jmLinks.links.facebook);
ok("tiktok @handle normalized", jmLinks.links.tiktok === "https://tiktok.com/@jm.cruz", jmLinks.links.tiktok);
ok("bogus platform ignored", !jmLinks.links.bogus);
res = await plainUser("GET", "/u/jmreyes");
ok("public profile at /u/:username", res.status === 200 && (await res.text()).includes("JM Cruz"));
res = await plainUser("GET", `/profile/${jmLinks._id}`);
ok("old /profile/:id redirects to /u/:username", res.status === 302 && res.headers.get("location") === "/u/jmreyes");
res = await plainUser("POST", "/profile/avatar", { image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" });
ok("non-raster image rejected", res.status === 400, res.status);
res = await plainUser("POST", "/profile/avatar/remove", {});
ok("avatar removal works", res.status === 200 && !(await User.findOne({ username: "jmreyes" })).avatarUrl);

console.log("\n== live test: adviser hosts, student joins over sockets ==");
res = await adviser("POST", "/api/host/start", { quizId: liveQuiz._id.toString() });
const startBody = await res.json();
ok("adviser starts live session", res.status === 200 && !!startBody.id, res.status);
const sessionId = startBody.id;
const jmDoc2 = await User.findOne({ username: "jmreyes" });

const studentSock = io(BASE, { auth: { userId: jmDoc2._id.toString() } });
let state = null, ack = null, ended = null, autoSubmittedEvt = null;
await new Promise((r) => studentSock.on("connect", r));
studentSock.on("live:state", (s) => { state = s; });
studentSock.on("live:answer_ack", (a) => { ack = a; });
studentSock.on("live:ended", (e) => { ended = e; });
studentSock.on("live:auto_submitted", (e) => { autoSubmittedEvt = e; });
studentSock.emit("live:join", { sessionId });
await new Promise((r) => setTimeout(r, 1200));
ok("student receives lobby/active state", !!state);

// simulate the host opening the session over HTTP
res = await adviser("POST", `/api/host/${sessionId}/start`, {});
ok("host opens item 1", res.status === 200);
await new Promise((r) => setTimeout(r, 1200));
ok("student received active item (no answers attached)", state && state.status === "active" && state.item && !JSON.stringify(state.item).includes("isCorrect"), JSON.stringify(state?.item || {}).slice(0, 80));

const firstItemId = state.item.id;
const liveFirst = liveQuiz.items.find((i) => i.id === firstItemId);
const liveCorrect = liveFirst.type === "mcq" ? liveFirst.options.find((o) => o.isCorrect).id : liveFirst.answer;
studentSock.emit("live:answer", { sessionId, itemId: firstItemId, answer: liveCorrect });
await new Promise((r) => setTimeout(r, 800));
ok("server grades the answer as correct", ack && ack.correct === true, JSON.stringify(ack));
ok("points equal item points, banked server-side", ack && ack.points === liveFirst.points);

// the host monitor now tracks per-item progress ("X of Y answered this item")
res = await adviser("GET", `/host/monitor/${sessionId}`);
const monHtml = await res.text();
const monData = JSON.parse(monHtml.match(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/)[1]);
ok("monitor standings include per-item answer tracking", res.status === 200 && monData.standings.length >= 1 && monData.standings.some((p) => p.answeredCurrent === true && p.answered >= 1), JSON.stringify(monData.standings && monData.standings[0]));
ok("monitor page has the item-progress bar", monHtml.includes("mon-item-progress"));

// duplicate answer must be rejected
studentSock.emit("live:answer", { sessionId, itemId: firstItemId, answer: liveCorrect });
await new Promise((r) => setTimeout(r, 500));
const participant = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("duplicate answer ignored (one shot per item)", participant.score === liveFirst.points, "score=" + participant.score);

// stale item answer must be rejected
res = await adviser("POST", `/api/host/${sessionId}/next`, {});
await new Promise((r) => setTimeout(r, 600));
studentSock.emit("live:answer", { sessionId, itemId: firstItemId, answer: liveCorrect });
await new Promise((r) => setTimeout(r, 600));
const p2 = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("answering a closed item is rejected", p2.score === liveFirst.points, "score=" + p2.score);

console.log("\n== anti-cheat: warnings auto-submit instead of kicking ==");
// HTTP fallback counts as a leave too
res = await plainUser("POST", "/api/live/warning", { reason: "fallback leave" });
ok("HTTP warning fallback accepted", res.status === 200);
// a real leave fires several events (socket + HTTP fallback) — the server merges the burst into ONE count
studentSock.emit("live:warning", { sessionId, reason: "tab switch (same leave, socket echo)" });
await new Promise((r) => setTimeout(r, 700));
const pDup = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("event burst for one leave counted once", pDup.warnings === 1, "warnings=" + pDup.warnings);
await new Promise((r) => setTimeout(r, 2400)); // distinct actions are >2s apart, like real usage
studentSock.emit("live:warning", { sessionId, reason: "second leave" });
await new Promise((r) => setTimeout(r, 2400));
studentSock.emit("live:warning", { sessionId, reason: "third leave" });
await new Promise((r) => setTimeout(r, 900));
const p3 = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("3 leaves → auto-submitted (not kicked)", p3.autoSubmitted === true && p3.finished === true && p3.kicked === false, "warnings=" + p3.warnings + " auto=" + p3.autoSubmitted);
ok("score is kept after auto-submit", p3.score === liveFirst.points, "score=" + p3.score);
ok("client got the auto_submitted event", !!autoSubmittedEvt);

// no more answers accepted after auto-submit
const currentNow = await LiveSession.findById(sessionId);
const openItemId = currentNow.itemOrder[currentNow.currentItemIndex];
studentSock.emit("live:answer", { sessionId, itemId: openItemId, answer: liveCorrect });
await new Promise((r) => setTimeout(r, 600));
const p4 = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("auto-submitted student cannot answer anymore", p4.answers.size === 1, "answered=" + p4.answers.size);

console.log("\n== re-attempts: request → adviser decides ==");
studentSock.emit("live:retry_request", { sessionId, reason: "accidentally closed the app" });
await new Promise((r) => setTimeout(r, 700));
let p5 = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("retry request registered as pending", p5.retryStatus === "pending", p5.retryStatus);
res = await adviser("POST", `/api/host/${sessionId}/retry/${jmDoc2._id}`, { decision: "approve" });
const retryBody = await res.json();
ok("adviser approves the re-attempt", res.status === 200 && retryBody.attemptNo === 2, res.status + " " + JSON.stringify(retryBody));
p5 = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("approved attempt resets score/warnings and bumps attempt", p5.attemptNo === 2 && p5.score === 0 && p5.warnings === 0 && p5.answers.size === 0 && p5.autoSubmitted === false, JSON.stringify({ a: p5.attemptNo, s: p5.score, w: p5.warnings }));
// the fresh attempt can answer the currently open item again
const liveOpen = liveQuiz.items.find((i) => i.id === openItemId);
const openCorrect = liveOpen.type === "mcq" ? liveOpen.options.find((o) => o.isCorrect).id : liveOpen.answer;
studentSock.emit("live:answer", { sessionId, itemId: openItemId, answer: openCorrect });
await new Promise((r) => setTimeout(r, 700));
const p6 = await LiveParticipant.findOne({ session: sessionId, user: jmDoc2._id });
ok("student can answer again on attempt 2", p6.answers.size === 1 && p6.score === (liveOpen.points || 1), "score=" + p6.score);

// decline path with a second student
const jm2 = await User.findOne({ username: "jmreyes" });
const sock2 = io(BASE, { auth: { userId: jm2._id.toString() } });
await new Promise((r) => sock2.on("connect", r));
sock2.emit("live:join", { sessionId });
await new Promise((r) => setTimeout(r, 500));
const cheatDoc = await User.findOne({ username: "cheaty" });
const sock3 = io(BASE, { auth: { userId: cheatDoc._id.toString() } });
await new Promise((r) => sock3.on("connect", r));
sock3.emit("live:join", { sessionId });
await new Promise((r) => setTimeout(r, 500));
sock3.emit("live:warning", { sessionId, reason: "left" });
await new Promise((r) => setTimeout(r, 2300));
sock3.emit("live:warning", { sessionId, reason: "left again" });
await new Promise((r) => setTimeout(r, 2300));
sock3.emit("live:warning", { sessionId, reason: "left a third time" });
await new Promise((r) => setTimeout(r, 900));
const cheatP = await LiveParticipant.findOne({ session: sessionId, user: cheatDoc._id });
ok("second student also auto-submitted at cap", cheatP.autoSubmitted === true);
sock3.emit("live:retry_request", { sessionId, reason: "pls" });
await new Promise((r) => setTimeout(r, 500));
res = await adviser("POST", `/api/host/${sessionId}/retry/${cheatDoc._id}`, { decision: "decline" });
ok("adviser can decline a re-attempt", res.status === 200);
const cheatP2 = await LiveParticipant.findOne({ session: sessionId, user: cheatDoc._id });
ok("declined student stays finished", cheatP2.finished === true && cheatP2.retryStatus === "declined", cheatP2.retryStatus);

console.log("\n== logout mid-test counts as a leave ==");
const logoutDoc = await User.findOne({ username: "jmreyes" });
const loClient = client();
await loClient("POST", "/login", null, { username: "jmreyes", password: "secret123" });
res = await adviser("POST", `/api/host/${sessionId}/goto`, { index: 0 });
await loClient("POST", "/logout", null, {});
const p7 = await LiveParticipant.findOne({ session: sessionId, user: logoutDoc._id });
ok("signing out mid-test added a warning", p7.warnings >= 1, "warnings=" + p7.warnings);

// host ends the test
res = await adviser("POST", `/api/host/${sessionId}/end`, {});
ok("host ends session", res.status === 200);
await new Promise((r) => setTimeout(r, 800));
ok("student received standings at end", ended && Array.isArray(ended.standings) && ended.standings.length >= 2);

studentSock.close(); sock2.close(); sock3.close();

console.log("\n== CSV export ==");
res = await adviser("GET", `/host/monitor/${sessionId}/export.csv`);
const csv = await res.text();
ok("results CSV exports with status + attempt columns", res.status === 200 && csv.includes("auto-submitted") && csv.includes("Attempt"), csv.split("\n")[0]);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
await mongoose.disconnect();
process.exit(fail ? 1 : 0);
