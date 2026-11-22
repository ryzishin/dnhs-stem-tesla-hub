// src/routes/quizzes.js — take a practice quiz, submit, review the attempt.
import { Router } from "express";
import { Quiz, Attempt } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { gradeItem, shuffle } from "../services/grading.js";
import { awardPractice } from "../services/points.js";
import { wrap, isHexId } from "./_util.js";

const router = Router();

async function loadTakeableQuiz(req) {
  if (!isHexId(req.params.id)) return null;
  const quiz = await Quiz.findById(req.params.id).populate("subject", "name color slug");
  if (!quiz) return null;
  const isEditor = req.user.role === "admin" || (req.user.role === "moderator" && req.user.isModeratorOf(quiz.subject?._id));
  if (!quiz.published && !isEditor) return null;
  return quiz;
}

router.get("/quiz/:id", requireAuth, wrap(async (req, res) => {
  const quiz = await loadTakeableQuiz(req);
  if (!quiz) return res.status(404).render("error", { code: 404, title: "Quiz not found", message: "This quiz may have been unpublished or removed." });
  if (!quiz.items?.length) return res.status(404).render("error", { code: 404, title: "Quiz has no items yet", message: "The moderator is still building this one." });

  const q = quiz.toJSON();
  q.items = shuffle(q.items).map((it) => ({
    ...it,
    options: it.options ? shuffle(it.options.map((o) => ({ id: o.id, text: o.text }))) : undefined,
    answer: undefined, explanation: undefined,
  }));
  res.render("quizzes/take", { title: quiz.title, quiz: q, pageScript: "quiz-take", pageData: { total: q.items.length } });
}));

router.post("/quiz/:id/submit", requireAuth, wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return res.status(404).render("error", { code: 404, title: "Quiz not found", message: "This quiz may have been unpublished or removed." });
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz || !quiz.published || !quiz.items?.length) {
    return res.status(404).render("error", { code: 404, title: "Quiz not found", message: "This quiz may have been unpublished or removed." });
  }

  const given = req.body.answers || {};
  const answers = [];
  let score = 0;
  for (const item of quiz.items) {
    const raw = Array.isArray(given[item.id]) ? given[item.id][0] : given[item.id];
    const correct = gradeItem(item, raw);
    if (correct) score += item.points;
    answers.push({ itemId: item.id, answer: String(raw ?? "").slice(0, 300), correct });
  }
  const totalPoints = quiz.items.reduce((s, i) => s + i.points, 0);

  const attempt = await Attempt.create({
    user: req.user._id, quiz: quiz._id, subject: quiz.subject,
    score, total: quiz.items.length, answers,
  });
  const { pointsEarned } = await awardPractice(req.user, score);
  res.redirect(`/quiz/${quiz._id}/result/${attempt._id}?earned=${pointsEarned}&of=${totalPoints}`);
}));

router.get("/quiz/:id/result/:attemptId", requireAuth, wrap(async (req, res) => {
  if (!isHexId(req.params.attemptId)) return res.status(404).render("error", { code: 404, title: "Attempt not found", message: "That attempt doesn't belong to this account." });
  const attempt = await Attempt.findById(req.params.attemptId).populate("quiz");
  if (!attempt || attempt.user.toString() !== req.user._id.toString()) {
    return res.status(404).render("error", { code: 404, title: "Attempt not found", message: "That attempt doesn't belong to this account." });
  }
  const quiz = attempt.quiz;
  const byId = Object.fromEntries((quiz.items || []).map((i) => [i.id, i]));
  const review = attempt.answers.map((a) => {
    const item = byId[a.itemId];
    return {
      question: item?.question || "(removed item)",
      correct: a.correct,
      yourAnswer: a.answer,
      correctText: item ? (item.type === "mcq" ? item.options?.find((o) => o.isCorrect)?.text || "" : String(item.answer || "")) : "",
      explanation: item?.explanation || "",
      points: item?.points || 1,
    };
  });
  res.render("quizzes/result", {
    title: "Result", quizTitle: quiz.title,
    score: attempt.score, total: attempt.total,
    earned: Number(req.query.earned || 0), of: Number(req.query.of || 0),
    review, quizId: req.params.id,
  });
}));

export default router;
