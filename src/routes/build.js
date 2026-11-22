// src/routes/build.js — the builders: notes, practice quizzes, flashcards.
// Access: admins can build everywhere; moderators only inside their assigned subjects,
// and only practice quizzes — live tests belong to the adviser (host routes are admin-only).
import { Router } from "express";
import { Subject, Note, Deck, Quiz, BLOCK_TYPES } from "../models/index.js";
import { requireAuth, requireBuilder, canEditSubject } from "../middleware/auth.js";
import { wrap, slugify, uniqueSlug, apiFail, isHexId } from "./_util.js";

const router = Router();
// guard ONLY the builder paths — an unscoped router.use would swallow every
// unmatched URL (students would see "Builders are for moderators" instead of a 404)
router.use(["/build", "/api/build"], requireAuth, requireBuilder);

async function mySubjects(user) {
  if (user.role === "admin") return Subject.find({ archived: false }).sort("order name").lean();
  const ids = user.moderatedSubjects ?? [];
  return Subject.find({ _id: { $in: ids }, archived: false }).sort("order name").lean();
}

async function loadEditableSubject(req, slugOrId) {
  const subject = isHexId(slugOrId)
    ? await Subject.findById(slugOrId)
    : await Subject.findOne({ slug: slugOrId });
  if (!subject) return null;
  if (!canEditSubject(req.user, subject._id)) return null;
  return subject;
}

async function loadEditableDoc(req, Model, opts = {}) {
  if (!isHexId(req.params.id)) return null;
  const doc = await Model.findById(req.params.id);
  if (!doc) return null;
  if (!canEditSubject(req.user, doc.subject)) return null;
  // live quizzes are the adviser's domain — moderators can't open (or break) them
  if (Model.modelName === "Quiz" && doc.mode === "live" && req.user.role !== "admin") return null;
  return doc;
}

// ===== builders home =====
router.get("/build", wrap(async (req, res) => {
  const list = await mySubjects(req.user);
  const counts = await Promise.all(list.map(async (s) => ({
    notes: await Note.countDocuments({ subject: s._id }),
    quizzes: await Quiz.countDocuments({ subject: s._id }),
    decks: await Deck.countDocuments({ subject: s._id }),
  })));
  res.render("build/index", { title: "Builders", subjects: list, counts });
}));

// =============== NOTES ===============
const cleanText = (s, max) => String(s ?? "").trim().slice(0, max);

function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return { error: "blocks must be a list" };
  const out = [];
  for (const b of blocks) {
    if (!b || !BLOCK_TYPES.includes(b.type)) return { error: `Unknown block type: ${b?.type}` };
    const clean = { id: String(b.id || "").slice(0, 24) || undefined, type: b.type };
    switch (b.type) {
      case "heading": clean.level = Number(b.level) === 3 ? 3 : 2; clean.text = cleanText(b.text, 200); break;
      case "paragraph": clean.text = cleanText(b.text, 4000); break;
      case "bullets":
      case "numbered":
        clean.items = (Array.isArray(b.items) ? b.items : []).map((i) => cleanText(i, 300)).filter(Boolean).slice(0, 20);
        break;
      case "image":
        clean.url = cleanText(b.url, 600);
        clean.caption = cleanText(b.caption, 240);
        if (!/^https?:\/\//i.test(clean.url)) return { error: "Image links must start with http(s)://" };
        break;
      case "callout":
        clean.variant = ["info", "tip", "warn"].includes(b.variant) ? b.variant : "info";
        clean.text = cleanText(b.text, 1200);
        break;
      case "keyterm":
        clean.term = cleanText(b.term, 120);
        clean.definition = cleanText(b.definition, 1200);
        break;
      case "divider": break;
    }
    if (b.id) clean.id = b.id;
    out.push(clean);
  }
  return { blocks: out };
}

function sanitizeSources(sources) {
  if (!Array.isArray(sources)) return { error: "sources must be a list" };
  return {
    sources: sources
      .map((s) => ({ label: cleanText(s?.label, 120), url: cleanText(s?.url, 400) }))
      .filter((s) => s.label || s.url)
      .slice(0, 12),
  };
}

router.get("/build/notes", wrap(async (req, res) => {
  const subject = await loadEditableSubject(req, String(req.query.subject || ""));
  if (!subject) return res.status(404).render("error", { code: 404, title: "No access", message: "Pick one of your assigned subjects from the builders page." });
  const notes = await Note.find({ subject: subject._id }).sort("order title").lean();
  res.render("build/list", { title: `Notes · ${subject.name}`, subject: subject.toJSON(), kind: "notes", items: notes, pageScript: "builder-list" });
}));

router.post("/api/build/notes", wrap(async (req, res) => {
  const subject = await loadEditableSubject(req, String(req.body.subjectId || ""));
  if (!subject) return apiFail(res, 403, "You can't build in that subject.");
  const title = cleanText(req.body.title, 120);
  if (!title) return apiFail(res, 400, "Give the note a title.");
  const slug = await uniqueSlug(Note, slugify(title));
  const maxOrder = (await Note.findOne({ subject: subject._id }).sort("-order"))?.order || 0;
  const note = await Note.create({ subject: subject._id, title, slug, blurb: cleanText(req.body.blurb, 200), order: maxOrder + 1 });
  res.json({ ok: true, id: note._id });
}));

router.get("/build/notes/:id", wrap(async (req, res) => {
  const note = await loadEditableDoc(req, Note);
  if (!note) return res.status(404).render("error", { code: 404, title: "Note not found", message: "It may have been deleted." });
  const n = note.toJSON();
  res.render("build/note", {
    title: `Edit · ${note.title}`, note: n,
    pageScript: "builder-note",
    pageData: { noteId: n.id, note: n, backUrl: `/build/notes?subject=${(await Subject.findById(note.subject)).slug}` },
  });
}));

router.put("/api/build/notes/:id", wrap(async (req, res) => {
  const note = await loadEditableDoc(req, Note);
  if (!note) return apiFail(res, 404, "Note not found or no access.");
  const title = cleanText(req.body.title, 120);
  if (!title) return apiFail(res, 400, "Title is required.");
  const blocks = sanitizeBlocks(req.body.blocks);
  if (blocks.error) return apiFail(res, 400, blocks.error);
  const sources = sanitizeSources(req.body.sources);
  if (sources.error) return apiFail(res, 400, sources.error);
  note.title = title;
  note.blurb = cleanText(req.body.blurb, 200);
  note.published = !!req.body.published;
  note.blocks = blocks.blocks;
  note.sources = sources.sources;
  await note.save();
  res.json({ ok: true });
}));

router.delete("/api/build/notes/:id", wrap(async (req, res) => {
  const note = await loadEditableDoc(req, Note);
  if (!note) return apiFail(res, 404, "Note not found or no access.");
  await note.deleteOne();
  res.json({ ok: true });
}));

// =============== DECKS ===============
function sanitizeCards(cards) {
  if (!Array.isArray(cards)) return { error: "cards must be a list" };
  const out = [];
  for (const c of cards) {
    const front = cleanText(c?.front, 300);
    const back = cleanText(c?.back, 600);
    if (!front && !back) continue;
    if (!front || !back) return { error: "Every card needs both a front and a back." };
    out.push({ id: c.id || undefined, front, back });
  }
  return { cards: out };
}

router.get("/build/decks", wrap(async (req, res) => {
  const subject = await loadEditableSubject(req, String(req.query.subject || ""));
  if (!subject) return res.status(404).render("error", { code: 404, title: "No access", message: "Pick one of your assigned subjects from the builders page." });
  const decks = await Deck.find({ subject: subject._id }).sort("order title").lean();
  res.render("build/list", { title: `Flashcards · ${subject.name}`, subject: subject.toJSON(), kind: "decks", items: decks, pageScript: "builder-list" });
}));

router.post("/api/build/decks", wrap(async (req, res) => {
  const subject = await loadEditableSubject(req, String(req.body.subjectId || ""));
  if (!subject) return apiFail(res, 403, "You can't build in that subject.");
  const title = cleanText(req.body.title, 120);
  if (!title) return apiFail(res, 400, "Give the deck a title.");
  const maxOrder = (await Deck.findOne({ subject: subject._id }).sort("-order"))?.order || 0;
  const deck = await Deck.create({ subject: subject._id, title, blurb: cleanText(req.body.blurb, 200), order: maxOrder + 1 });
  res.json({ ok: true, id: deck._id });
}));

router.get("/build/decks/:id", wrap(async (req, res) => {
  const deck = await loadEditableDoc(req, Deck);
  if (!deck) return res.status(404).render("error", { code: 404, title: "Deck not found", message: "It may have been deleted." });
  const d = deck.toJSON();
  res.render("build/deck", {
    title: `Edit · ${deck.title}`, deck: d,
    pageScript: "builder-deck",
    pageData: { deckId: d.id, deck: d, backUrl: `/build/decks?subject=${(await Subject.findById(deck.subject)).slug}` },
  });
}));

router.put("/api/build/decks/:id", wrap(async (req, res) => {
  const deck = await loadEditableDoc(req, Deck);
  if (!deck) return apiFail(res, 404, "Deck not found or no access.");
  const title = cleanText(req.body.title, 120);
  if (!title) return apiFail(res, 400, "Title is required.");
  const cards = sanitizeCards(req.body.cards);
  if (cards.error) return apiFail(res, 400, cards.error);
  deck.title = title;
  deck.blurb = cleanText(req.body.blurb, 200);
  deck.published = !!req.body.published;
  deck.cards = cards.cards;
  await deck.save();
  res.json({ ok: true });
}));

router.delete("/api/build/decks/:id", wrap(async (req, res) => {
  const deck = await loadEditableDoc(req, Deck);
  if (!deck) return apiFail(res, 404, "Deck not found or no access.");
  await deck.deleteOne();
  res.json({ ok: true });
}));

// =============== QUIZZES ===============
function sanitizeItems(items) {
  if (!Array.isArray(items)) return { error: "items must be a list" };
  const out = [];
  for (const it of items) {
    const question = cleanText(it?.question, 600);
    const type = ["mcq", "tf", "short"].includes(it?.type) ? it.type : "mcq";
    const points = Math.max(1, Math.min(Number(it?.points) || 1, 10));
    if (!question) return { error: "Every item needs a question." };
    const clean = { id: it.id || undefined, type, question, points, explanation: cleanText(it?.explanation, 600) };
    if (type === "mcq") {
      const options = (Array.isArray(it.options) ? it.options : [])
        .map((o) => ({ id: o?.id || undefined, text: cleanText(o?.text, 300), isCorrect: !!o?.isCorrect }))
        .filter((o) => o.text)
        .slice(0, 6);
      if (options.length < 2) return { error: "Multiple-choice items need at least 2 options." };
      if (!options.some((o) => o.isCorrect)) return { error: `Mark the correct option for: "${question.slice(0, 60)}…"` };
      clean.options = options;
    } else if (type === "tf") {
      clean.answer = String(it.answer).toLowerCase() === "false" ? "false" : "true";
    } else {
      clean.answer = cleanText(it.answer, 120);
      if (!clean.answer) return { error: `Short-answer items need an accepted keyword: "${question.slice(0, 60)}…"` };
    }
    if (it.id) clean.id = it.id;
    out.push(clean);
  }
  return { items: out };
}

router.get("/build/quizzes", wrap(async (req, res) => {
  const subject = await loadEditableSubject(req, String(req.query.subject || ""));
  if (!subject) return res.status(404).render("error", { code: 404, title: "No access", message: "Pick one of your assigned subjects from the builders page." });
  // moderators see practice quizzes only — live ones live in the adviser's Host area
  const filter = req.user.role === "admin" ? { subject: subject._id } : { subject: subject._id, mode: "practice" };
  const quizzes = await Quiz.find(filter).sort("-createdAt").lean();
  res.render("build/list", { title: `Quizzes · ${subject.name}`, subject: subject.toJSON(), kind: "quizzes", items: quizzes, isAdmin: req.user.role === "admin", pageScript: "builder-list" });
}));

router.post("/api/build/quizzes", wrap(async (req, res) => {
  const subject = await loadEditableSubject(req, String(req.body.subjectId || ""));
  if (!subject) return apiFail(res, 403, "You can't build in that subject.");
  const mode = req.body.mode === "live" ? "live" : "practice";
  // live quizzes are hosted by the adviser — moderators create practice quizzes only
  if (mode === "live" && req.user.role !== "admin") {
    return apiFail(res, 403, "Live tests belong to the adviser. You can build practice quizzes here.");
  }
  const title = cleanText(req.body.title, 120);
  if (!title) return apiFail(res, 400, "Give the quiz a title.");
  const quiz = await Quiz.create({ subject: subject._id, title, blurb: cleanText(req.body.blurb, 200), mode });
  res.json({ ok: true, id: quiz._id, mode });
}));

router.get("/build/quiz/:id", wrap(async (req, res) => {
  const quiz = await loadEditableDoc(req, Quiz);
  if (!quiz) return res.status(404).render("error", { code: 404, title: "Quiz not found", message: "It may have been deleted." });
  const q = quiz.toJSON();
  res.render("build/quiz", {
    title: `Edit · ${quiz.title}`, quiz: q,
    pageScript: "builder-quiz",
    pageData: { quizId: q.id, quiz: q, backUrl: `/build/quizzes?subject=${(await Subject.findById(quiz.subject)).slug}` },
  });
}));

router.put("/api/build/quiz/:id", wrap(async (req, res) => {
  const quiz = await loadEditableDoc(req, Quiz);
  if (!quiz) return apiFail(res, 404, "Quiz not found or no access.");
  const title = cleanText(req.body.title, 120);
  if (!title) return apiFail(res, 400, "Title is required.");
  const items = sanitizeItems(req.body.items);
  if (items.error) return apiFail(res, 400, items.error);
  quiz.title = title;
  quiz.blurb = cleanText(req.body.blurb, 200);
  quiz.published = !!req.body.published;
  quiz.timeLimitMin = Math.max(0, Math.min(Number(req.body.timeLimitMin) || 0, 120));
  quiz.autoAdvanceSec = quiz.mode === "live" ? Math.max(0, Math.min(Number(req.body.autoAdvanceSec) || 0, 300)) : 0;
  quiz.items = items.items;
  await quiz.save();
  res.json({ ok: true });
}));

router.delete("/api/build/quizzes/:id", wrap(async (req, res) => {
  const quiz = await loadEditableDoc(req, Quiz);
  if (!quiz) return apiFail(res, 404, "Quiz not found or no access.");
  await quiz.deleteOne();
  res.json({ ok: true });
}));

export default router;
