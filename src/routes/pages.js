// src/routes/pages.js — landing, hub, subject pages, note reader, people pages, profile.
import { Router } from "express";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { User, Subject, Note, Deck, Quiz, Attempt, Review, LiveSession, LiveParticipant } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { touchUser, mondayISO } from "../services/points.js";
import { applyWarning } from "../services/realtime.js";
import { wrap, isHexId } from "./_util.js";

const router = Router();
const AVATAR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "uploads", "avatars");
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

// ===== landing (public) =====
router.get("/", wrap(async (req, res) => {
  const subjects = await Subject.find({ archived: false }).sort("order name").lean();
  const [notesCount, quizzesCount, decksCount, usersCount] = await Promise.all([
    Note.countDocuments({ published: true }),
    Quiz.countDocuments({ published: true }),
    Deck.countDocuments({ published: true }),
    User.countDocuments(),
  ]);
  res.render("landing", { title: "STEM Tesla Hub", subjects, stats: { notes: notesCount, quizzes: quizzesCount, decks: decksCount, users: usersCount } });
}));

// ===== hub (signed-in dashboard) =====
router.get("/hub", requireAuth, wrap(async (req, res) => {
  const { user } = await touchUser(req.user);
  req.user = user;
  res.locals.currentUser = user.toJSON();

  const subjects = await Subject.find({ archived: false }).sort("order name").lean();
  const counts = await Promise.all(subjects.map(async (s) => ({
    notes: await Note.countDocuments({ subject: s._id, published: true }),
    quizzes: await Quiz.countDocuments({ subject: s._id, mode: "practice", published: true }),
    decks: await Deck.countDocuments({ subject: s._id, published: true }),
  })));

  const activeSession = await LiveSession.findOne({ status: { $in: ["lobby", "active"] } })
    .sort("-createdAt").populate("subject", "name color slug").populate("host", "name").lean();

  res.render("hub", {
    title: "Hub",
    subjects,
    counts,
    activeSession,
    me: user.toJSON(),
  });
}));

// ===== subject page =====
router.get("/s/:slug", requireAuth, wrap(async (req, res) => {
  const subject = await Subject.findOne({ slug: req.params.slug });
  if (!subject) return res.status(404).render("error", { code: 404, title: "Subject not found", message: "That subject doesn't exist (or was renamed by the adviser)." });

  const [notes, quizzes, decks] = await Promise.all([
    Note.find({ subject: subject._id, published: true }).sort("order title").lean(),
    Quiz.find({ subject: subject._id, mode: "practice", published: true }).sort("-createdAt").lean(),
    Deck.find({ subject: subject._id, published: true }).sort("order title").lean(),
  ]);
  const myAttempts = await Attempt.find({ user: req.user._id, subject: subject._id }).select("quiz score total").lean();
  const bestByQuiz = {};
  for (const a of myAttempts) {
    const k = a.quiz?.toString?.() || a.quiz;
    bestByQuiz[k] = Math.max(bestByQuiz[k] ?? -1, a.total ? Math.round((a.score / a.total) * 100) : 0);
  }
  const canEdit = req.user.role === "admin" || (req.user.role === "moderator" && req.user.isModeratorOf(subject._id));

  res.render("subject", { title: subject.name, subject, notes, quizzes, decks, bestByQuiz, canEdit });
}));

// ===== note reader =====
router.get("/notes/:id", requireAuth, wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return res.status(404).render("error", { code: 404, title: "Note not found", message: "This note may have been removed." });
  const note = await Note.findById(req.params.id).populate("subject", "name color slug");
  if (!note) return res.status(404).render("error", { code: 404, title: "Note not found", message: "This note may have been removed." });
  const isEditor = req.user.role === "admin" || (req.user.role === "moderator" && req.user.isModeratorOf(note.subject?._id));
  if (!note.published && !isEditor) return res.status(404).render("error", { code: 404, title: "Note not found", message: "This note isn't published yet." });

  const siblings = await Note.find({ subject: note.subject._id, published: note.published }).sort("order title").select("title").lean();
  const idx = siblings.findIndex((n) => n._id.toString() === note._id.toString());
  res.render("notes/read", {
    title: note.title, note,
    prev: idx > 0 ? siblings[idx - 1] : null,
    next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
    canEdit: isEditor,
    pageScript: "note-toc",
  });
}));

// ===== live test (student view) =====
router.get("/live", requireAuth, (req, res) => {
  res.render("live/student", {
    title: "Live test",
    pageScript: "live-student",
    pageData: { userId: req.user._id.toString() },
  });
});

// which live session should a student be in right now?
router.get("/api/live/current", requireAuth, wrap(async (req, res) => {
  const session = await LiveSession.findOne({ status: { $in: ["lobby", "active"] } })
    .sort("-createdAt").populate("quiz", "title").populate("host", "name").lean();
  if (!session) return res.json({ session: null });
  const part = await LiveParticipant.findOne({ session: session._id, user: req.user._id }).select("kicked autoSubmitted finished").lean();
  res.json({
    session: {
      id: session._id.toString(),
      status: session.status,
      quizTitle: session.quiz?.title || "",
      hostName: session.host?.name || "",
      kicked: !!(part && part.kicked),
      autoSubmitted: !!(part && part.autoSubmitted),
      finished: !!(part && part.finished),
    },
  });
}));

// HTTP fallback for anti-cheat warnings — used by sendBeacon/keepalive when a
// student closes the tab or navigates away (sockets can't flush during unload).
router.post("/api/live/warning", requireAuth, wrap(async (req, res) => {
  const session = await LiveSession.findOne({ status: "active" }).sort("-createdAt").lean();
  if (session) {
    await applyWarning(session._id.toString(), req.user._id.toString(), String(req.body.reason || "left the test").slice(0, 120));
  }
  res.json({ ok: true });
}));

// ===== leaderboard =====
router.get("/leaderboard", requireAuth, wrap(async (req, res) => {
  const [weekly, alltime] = await Promise.all([
    User.find({ weeklyPoints: { $gt: 0 } }).sort("-weeklyPoints").limit(20).select("name username role points weeklyPoints streakDays avatarColor avatarUrl").lean(),
    User.find({ points: { $gt: 0 } }).sort("-points").limit(20).select("name username role points weeklyPoints streakDays avatarColor avatarUrl").lean(),
  ]);
  // the exact moment the weekly board resets = next Monday 00:00 UTC (same math as points.js),
  // so the countdown on the page matches what the server actually does
  const resetAt = Date.parse(mondayISO() + "T00:00:00.000Z") + 7 * 86400000;
  res.render("people/leaderboard", { title: "Leaderboard", weekly, alltime, meId: req.user._id.toString(), resetAt });
}));

// ===== classmates =====
router.get("/classmates", requireAuth, wrap(async (req, res) => {
  const users = await User.find().sort("-points").select("name username role points streakDays avatarColor avatarUrl bio links").lean();
  res.render("people/classmates", { title: "Classmates", users, meId: req.user._id.toString() });
}));

// ===== own profile =====
router.get("/profile", requireAuth, wrap(async (req, res) => {
  const attempts = await Attempt.find({ user: req.user._id }).sort("-createdAt").limit(5).populate("quiz", "title").lean();
  const reviews = await Review.find({ user: req.user._id }).sort("-createdAt").limit(5).populate("deck", "title").lean();
  const liveCount = await LiveParticipant.countDocuments({ user: req.user._id });
  res.render("people/profile", { title: "My profile", me: req.user.toJSON(), attempts, reviews, liveCount, error: null, pageScript: "profile" });
}));

router.post("/profile", requireAuth, wrap(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const bio = String(req.body.bio || "").trim();
  if (!name || name.length > 60) {
    const attempts = await Attempt.find({ user: req.user._id }).sort("-createdAt").limit(5).populate("quiz", "title").lean();
    const reviews = await Review.find({ user: req.user._id }).sort("-createdAt").limit(5).populate("deck", "title").lean();
    return res.status(400).render("people/profile", { title: "My profile", me: req.user.toJSON(), attempts, reviews, error: "Name is required (60 characters max).", pageScript: "profile" });
  }
  req.user.name = name;
  req.user.bio = bio.slice(0, 280);
  // social links — normalize each platform through the shared helper
  const platforms = ["facebook", "instagram", "tiktok", "x", "youtube", "github"];
  req.user.links = req.user.links || {};
  for (const p of platforms) {
    req.user.links[p] = res.locals.normalizeSocial(p, req.body[`link_${p}`]);
  }
  await req.user.save();
  res.redirect("/profile?saved=1");
}));

// ===== avatar photo upload (client resizes to a 256px JPEG data URL) =====
router.post("/profile/avatar", requireAuth, wrap(async (req, res) => {
  const match = AVATAR_RE.exec(String(req.body.image || ""));
  if (!match) return res.status(400).json({ error: "Send a JPEG, PNG or WebP image." });
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buf = Buffer.from(match[2], "base64");
  if (buf.length < 40) return res.status(400).json({ error: "That image looks empty." });
  if (buf.length > 800 * 1024) return res.status(413).json({ error: "Image is too large — keep it under 800KB." });

  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  // remove the previous file so the uploads folder never fills with orphans
  if (req.user.avatarUrl) {
    const oldName = req.user.avatarUrl.split("/").pop();
    if (oldName && /^[a-f0-9]{24}-\d+\.(jpg|png|webp)$/.test(oldName)) {
      fs.rmSync(path.join(AVATAR_DIR, oldName), { force: true });
    }
  }
  const filename = `${req.user._id.toString()}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(AVATAR_DIR, filename), buf);
  req.user.avatarUrl = `/uploads/avatars/${filename}`;
  await req.user.save();
  res.json({ ok: true, avatarUrl: req.user.avatarUrl });
}));

router.post("/profile/avatar/remove", requireAuth, wrap(async (req, res) => {
  if (req.user.avatarUrl) {
    const oldName = req.user.avatarUrl.split("/").pop();
    if (oldName) fs.rmSync(path.join(AVATAR_DIR, oldName), { force: true });
  }
  req.user.avatarUrl = "";
  await req.user.save();
  res.json({ ok: true });
}));

router.post("/profile/password", requireAuth, wrap(async (req, res) => {
  const current = String(req.body.current || "");
  const next = String(req.body.next || "");
  const confirm = String(req.body.confirm || "");
  const ok = await bcrypt.compare(current, req.user.passwordHash);
  if (!ok) return res.redirect("/profile?pw=wrong");
  if (next.length < 6 || next !== confirm) return res.redirect("/profile?pw=match");
  req.user.passwordHash = await bcrypt.hash(next, 10);
  await req.user.save();
  res.redirect("/profile?pw=ok");
}));

// ===== public profile (by username — /profile/:id still redirects for old links) =====
router.get("/u/:username", requireAuth, wrap(async (req, res) => {
  const person = await User.findOne({ username: String(req.params.username).toLowerCase() }).lean();
  if (!person) return res.status(404).render("error", { code: 404, title: "No such classmate", message: "That profile doesn't exist." });
  const attempts = await Attempt.find({ user: person._id }).sort("-createdAt").limit(5).populate("quiz", "title").lean();
  const reviews = await Review.find({ user: person._id }).sort("-createdAt").limit(5).populate("deck", "title").lean();
  res.render("people/profile-public", { title: person.name, person, attempts, reviews });
}));

router.get("/profile/:id", requireAuth, wrap(async (req, res) => {
  if (!/^[a-f0-9]{24}$/.test(req.params.id)) return res.redirect("/classmates");
  const person = await User.findById(req.params.id).select("username").lean();
  if (!person) return res.status(404).render("error", { code: 404, title: "No such classmate", message: "That profile doesn't exist." });
  res.redirect(`/u/${person.username}`);
}));

export default router;
