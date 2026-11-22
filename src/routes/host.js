// src/routes/host.js — host live tests: admin (adviser) only.
// Control actions ride over HTTP; broadcasts ride over Socket.IO (see services/realtime.js).
import { Router } from "express";
import { Quiz, Subject, LiveSession, LiveParticipant, Settings } from "../models/index.js";
import { requireAuth, requireHost } from "../middleware/auth.js";
import { shuffle } from "../services/grading.js";
import { startSession, gotoItem, nextItem, prevItem, endSession, removeParticipant, currentStandings, decideRetry, retryRequests } from "../services/realtime.js";
import { wrap, apiFail } from "./_util.js";

const router = Router();
// scope the guard to host paths so unmatched URLs fall through to the 404 page
router.use(["/host", "/api/host"], requireAuth, requireHost);

const HEX24 = /^[a-f0-9]{24}$/; // guard findById against malformed ids (would otherwise CastError → 500)

async function loadHostableQuiz(req, quizId) {
  if (!HEX24.test(quizId || "")) return null;
  const quiz = await Quiz.findById(quizId).populate("subject", "name color slug");
  if (!quiz || quiz.mode !== "live" || !(quiz.items?.length)) return null;
  return quiz; // host routes are admin-only, so subject scoping doesn't apply
}

async function loadOwnSession(req, id) {
  if (!HEX24.test(id || "")) return null;
  const session = await LiveSession.findById(id).populate("quiz", "title items autoAdvanceSec timeLimitMin subject").populate("subject", "name color slug");
  if (!session) return null;
  const isHost = session.host.toString() === req.user._id.toString();
  if (!isHost && req.user.role !== "admin") return null;
  return session;
}

// ===== host home =====
router.get("/host", wrap(async (req, res) => {
  const subjects = await Subject.find({ archived: false }).sort("order name").lean();
  const subjectIds = subjects.map((s) => s._id);
  const liveQuizzes = await Quiz.find({ subject: { $in: subjectIds }, mode: "live" }).sort("-createdAt").lean();
  const sessions = await LiveSession.find({ host: req.user._id }).sort("-createdAt").limit(8)
    .populate("quiz", "title").populate("subject", "name color").lean();
  const settings = await Settings.get();
  res.render("host/index", {
    title: "Host a live test", subjects, liveQuizzes, sessions,
    antiCheat: settings.antiCheat.toJSON(),
    pageScript: "host-index",
  });
}));

// ===== start a session =====
router.post("/api/host/start", wrap(async (req, res) => {
  const quiz = await loadHostableQuiz(req, String(req.body.quizId || ""));
  if (!quiz) return apiFail(res, 403, "Pick a published live quiz with items.");
  const settings = await Settings.get();
  const session = await LiveSession.create({
    quiz: quiz._id,
    subject: quiz.subject?._id || quiz.subject,
    host: req.user._id,
    itemOrder: shuffle(quiz.items.map((i) => i.id)),
    autoAdvanceSec: quiz.autoAdvanceSec || 0,
    antiCheat: {
      tabWarning: settings.antiCheat.tabWarning,
      fullscreen: settings.antiCheat.fullscreen,
      blockCopy: settings.antiCheat.blockCopy,
      warningsCap: settings.antiCheat.warningsCap,
    },
  });
  res.json({ ok: true, id: session._id, redirect: `/host/monitor/${session._id}` });
}));

// ===== monitor page =====
router.get("/host/monitor/:id", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return res.status(404).render("error", { code: 404, title: "Session not found", message: "It may have ended or belongs to another host." });
  const quiz = await Quiz.findById(session.quiz._id || session.quiz).lean();
  const board = await currentStandings(session._id.toString());
  const requests = await retryRequests(session._id.toString());
  const safeItems = (quiz.items || []).map((it) => ({
    id: it.id, type: it.type, question: it.question, points: it.points,
    options: it.options ? it.options.map((o) => ({ id: o.id, text: o.text })) : undefined,
  }));
  res.render("host/monitor", {
    title: "Live monitor",
    session: session.toJSON(),
    quiz: { id: quiz._id.toString(), title: quiz.title, items: safeItems },
    standings: board,
    retryReqs: requests,
    pageScript: "live-host",
    pageData: {
      sessionId: session._id.toString(),
      userId: req.user._id.toString(),
      status: session.status,
      index: session.currentItemIndex,
      itemStartedAt: session.itemStartedAt || null,
      autoAdvanceSec: session.autoAdvanceSec || 0,
      items: safeItems,
      standings: board,
      retryRequests: requests,
    },
  });
}));

// ===== controls =====
router.post("/api/host/:id/start", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return apiFail(res, 404, "Session not found.");
  if (session.status === "ended") return apiFail(res, 400, "This session already ended.");
  await startSession(session._id.toString());
  res.json({ ok: true });
}));

router.post("/api/host/:id/goto", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return apiFail(res, 404, "Session not found.");
  await gotoItem(session._id.toString(), Number(req.body.index || 0));
  res.json({ ok: true });
}));

router.post("/api/host/:id/next", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return apiFail(res, 404, "Session not found.");
  await nextItem(session._id.toString());
  res.json({ ok: true });
}));

router.post("/api/host/:id/prev", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return apiFail(res, 404, "Session not found.");
  await prevItem(session._id.toString());
  res.json({ ok: true });
}));

router.post("/api/host/:id/end", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return apiFail(res, 404, "Session not found.");
  await endSession(session._id.toString());
  res.json({ ok: true });
}));

router.post("/api/host/:id/remove", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return apiFail(res, 404, "Session not found.");
  await removeParticipant(session._id.toString(), String(req.body.userId || ""));
  res.json({ ok: true });
}));

// ===== re-attempt requests =====
router.post("/api/host/:id/retry/:userId", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return apiFail(res, 404, "Session not found.");
  const decision = req.body.decision === "decline" ? "decline" : "approve";
  const result = await decideRetry(session._id.toString(), String(req.params.userId), decision);
  if (result.error) return apiFail(res, 400, result.error);
  res.json({ ok: true, ...result });
}));

// ===== results export =====
router.get("/host/monitor/:id/export.csv", wrap(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (!session) return res.status(404).send("Not found");
  const board = await currentStandings(session._id.toString());
  const rows = [["Rank", "Name", "Score", "Answered", "Warnings", "Status", "Attempt"]];
  board.forEach((p, i) => rows.push([
    i + 1, p.name, p.score, p.answered, p.warnings,
    p.kicked ? "removed" : p.autoSubmitted ? "auto-submitted" : p.finished ? "finished" : "in progress",
    p.attemptNo || 1,
  ]));
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="live-results-${session._id}.csv"`);
  res.send(csv);
}));

export default router;
