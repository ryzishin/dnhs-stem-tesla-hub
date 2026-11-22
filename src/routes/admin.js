// src/routes/admin.js — adviser-only area: subjects, roles, settings, overview.
import { Router } from "express";
import bcrypt from "bcryptjs";
import { User, Subject, Note, Deck, Quiz, Attempt, Settings, LiveSession, SUBJECT_COLORS, SUBJECT_ICONS } from "../models/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { wrap, slugify, uniqueSlug, apiFail, isHexId } from "./_util.js";

const router = Router();
// scope the guard to admin paths so unmatched URLs fall through to the 404 page
router.use(["/admin", "/api/admin"], requireAuth, requireAdmin);

// ===== overview =====
router.get("/admin", wrap(async (req, res) => {
  const [users, notes, quizzes, decks, attempts, subjects] = await Promise.all([
    User.countDocuments(), Note.countDocuments(), Quiz.countDocuments(), Deck.countDocuments(),
    Attempt.countDocuments(), Subject.find({ archived: false }).sort("order name").lean(),
  ]);
  const recentUsers = await User.find().sort("-createdAt").limit(6).select("name username role createdAt avatarColor").lean();
  const activeSessions = await LiveSession.find({ status: { $in: ["lobby", "active"] } })
    .sort("-createdAt").limit(5).populate("quiz", "title").populate("host", "name").lean();
  res.render("admin/dashboard", { title: "Admin", stats: { users, notes, quizzes, decks, attempts }, subjects, recentUsers, activeSessions, pageScript: "admin", pageData: { adminPage: "overview" } });
}));

// ===== subjects =====
router.get("/admin/subjects", wrap(async (req, res) => {
  const subjects = await Subject.find().sort("order name").lean();
  const counts = await Promise.all(subjects.map(async (s) => ({
    notes: await Note.countDocuments({ subject: s._id }),
    quizzes: await Quiz.countDocuments({ subject: s._id }),
    decks: await Deck.countDocuments({ subject: s._id }),
  })));
  res.render("admin/subjects", { title: "Subjects", subjects, counts, pageScript: "admin", pageData: { adminPage: "subjects" } });
}));

router.post("/api/admin/subjects", wrap(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  if (!name) return apiFail(res, 400, "Name is required.");
  const slug = await uniqueSlug(Subject, slugify(name));
  const maxOrder = (await Subject.findOne().sort("-order"))?.order || 0;
  // tile color/icon rotate automatically so every subject looks distinct without a picker
  const idx = maxOrder % SUBJECT_COLORS.length;
  const subject = await Subject.create({
    name, slug,
    blurb: String(req.body.blurb || "").trim().slice(0, 160),
    color: SUBJECT_COLORS[idx],
    icon: SUBJECT_ICONS[maxOrder % SUBJECT_ICONS.length],
    order: maxOrder + 1,
  });
  res.json({ ok: true, id: subject._id });
}));

router.put("/api/admin/subjects/:id", wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return apiFail(res, 404, "Subject not found.");
  const subject = await Subject.findById(req.params.id);
  if (!subject) return apiFail(res, 404, "Subject not found.");
  const name = String(req.body.name || "").trim().slice(0, 60);
  if (name) subject.name = name;
  if (req.body.blurb !== undefined) subject.blurb = String(req.body.blurb || "").trim().slice(0, 160);
  if (req.body.archived !== undefined) subject.archived = !!req.body.archived;
  await subject.save();
  res.json({ ok: true });
}));

router.delete("/api/admin/subjects/:id", wrap(async (req, res) => {
  const id = req.params.id;
  if (!isHexId(id)) return apiFail(res, 404, "Subject not found.");
  const [notes, quizzes, decks] = await Promise.all([
    Note.countDocuments({ subject: id }), Quiz.countDocuments({ subject: id }), Deck.countDocuments({ subject: id }),
  ]);
  if (notes + quizzes + decks > 0) {
    return apiFail(res, 409, `This subject still has ${notes + quizzes + decks} item(s). Empty it first, or archive it instead.`);
  }
  await Subject.findByIdAndDelete(id);
  await User.updateMany({ moderatedSubjects: id }, { $pull: { moderatedSubjects: id } });
  res.json({ ok: true });
}));

// ===== users & roles =====
router.get("/admin/users", wrap(async (req, res) => {
  const users = await User.find().sort("role name").populate("moderatedSubjects", "name color").lean();
  const subjects = await Subject.find({ archived: false }).sort("order name").lean();
  res.render("admin/users", { title: "People & roles", users, subjects, pageScript: "admin", pageData: { adminPage: "users" } });
}));

// role + subject assignments are staged in the UI and saved with one explicit action,
// so a stray click can never silently promote someone.
router.post("/api/admin/users/:id/role", wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return apiFail(res, 404, "User not found.");
  const target = await User.findById(req.params.id);
  if (!target) return apiFail(res, 404, "User not found.");
  const role = ["student", "moderator", "admin"].includes(req.body.role) ? req.body.role : null;
  if (!role) return apiFail(res, 400, "Unknown role.");
  if (target._id.toString() === req.user._id.toString() && role !== "admin") {
    return apiFail(res, 400, "You can't demote yourself.");
  }
  if (target.role === "admin" && role !== "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
    return apiFail(res, 400, "There must always be at least one admin (adviser) account.");
  }
  target.role = role;
  const subjectIds = Array.isArray(req.body.subjectIds) ? req.body.subjectIds.filter((s) => /^[a-f0-9]{24}$/.test(s)) : [];
  target.moderatedSubjects = role === "moderator" ? subjectIds : [];
  await target.save();
  res.json({ ok: true, message: `${target.name} is now ${role === "admin" ? "an admin" : role}.` });
}));

router.post("/api/admin/users/:id/reset", wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return apiFail(res, 404, "User not found.");
  const target = await User.findById(req.params.id);
  if (!target) return apiFail(res, 404, "User not found.");
  const password = String(req.body.password || "");
  if (password.length < 6) return apiFail(res, 400, "New password must be at least 6 characters.");
  target.passwordHash = await bcrypt.hash(password, 10);
  await target.save();
  res.json({ ok: true, message: `Password updated for ${target.name}.` });
}));

router.post("/api/admin/users/:id/delete", wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return apiFail(res, 404, "User not found.");
  const target = await User.findById(req.params.id);
  if (!target) return apiFail(res, 404, "User not found.");
  if (target.role === "admin") return apiFail(res, 403, "Admin accounts can't be deleted from the app.");
  if (target._id.toString() === req.user._id.toString()) return apiFail(res, 400, "You can't delete your own account.");
  await target.deleteOne();
  res.json({ ok: true });
}));

// ===== settings =====
router.get("/admin/settings", wrap(async (req, res) => {
  res.render("admin/settings", { title: "Settings", settings: (await Settings.get()).toJSON(), pageScript: "admin", pageData: { adminPage: "settings" } });
}));

router.post("/api/admin/settings", wrap(async (req, res) => {
  const settings = await Settings.get();
  settings.allowRegistration = !!req.body.allowRegistration;
  settings.antiCheat = {
    tabWarning: !!req.body.tabWarning,
    fullscreen: !!req.body.fullscreen,
    blockCopy: !!req.body.blockCopy,
    warningsCap: Math.max(1, Math.min(Number(req.body.warningsCap) || 3, 10)),
  };
  settings.points = {
    quizBase: Math.max(0, Math.min(Number(req.body.quizBase) || 0, 50)),
    cardPoints: Math.max(0, Math.min(Number(req.body.cardPoints) || 0, 10)),
    streakBonus: Math.max(0, Math.min(Number(req.body.streakBonus) || 0, 20)),
  };
  await settings.save();
  res.json({ ok: true });
}));

export default router;
