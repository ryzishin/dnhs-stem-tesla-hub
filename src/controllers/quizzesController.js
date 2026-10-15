// src/controllers/quizzesController.js
import {
  listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz,
  createItem, updateItem, deleteItem, saveOptions,
  recordAttempt, listAttemptsForUser, gradeAttempt,
  // v3-P1-4: mastery-mode functions
  getMasteryStudyItems, recordMasteryReview, getQuizMasteryStats,
} from "../services/quizzes.js";
import { awardPoints, bumpStreak, logActivity } from "../services/leaderboard.js";
import { User } from "../models/index.js";

export async function listPractice(req, res) {
  try {
    const quizzes = await listQuizzes("practice");
    const attempts = await listAttemptsForUser(req.user.id);
    res.render("quizzes/practice", { title: "Practice Quizzes", quizzes, attempts });
  } catch (err) {
    console.error("[listPractice]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function takePractice(req, res) {
  try {
    const quiz = await getQuiz(req.params.id);
    if (!quiz) return res.status(404).render("error/404");

    // v3-P1-4: Branch on quiz.masteryMode.
    if (quiz.masteryMode) {
      const { items, totalItems, dueCount, newCount } = await getMasteryStudyItems(req.user.id, quiz.id);
      const stats = await getQuizMasteryStats(req.user.id, quiz.id);
      return res.render("quizzes/take", {
        title: quiz.title,
        quiz,
        // For template compatibility: render the bare item list (sorted due-first by getMasteryStudyItems).
        items: items.map(i => i.item),
        masteryItems: items,
        masteryStats: stats,
        dueCount,
        newCount,
        isMastery: true,
      });
    }

    // Non-mastery: original behavior — shuffle, render all items.
    let items = quiz.items;
    if (quiz.shuffleItems) items = shuffle(items);
    if (quiz.shuffleOptions) {
      items = items.map((it) => ({ ...it, options: it.options ? shuffle(it.options) : it.options }));
    }
    res.render("quizzes/take", { title: quiz.title, quiz, items, isMastery: false });
  } catch (err) {
    console.error("[takePractice]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function submitPractice(req, res) {
  try {
    const quiz = await getQuiz(req.params.id);
    if (!quiz) return res.status(404).render("error/404");
    const answers = req.body.answers || {};

    // v3-P1-4: Branch on quiz.masteryMode.
    if (quiz.masteryMode) {
      // Mastery mode — grade each item, record SRS state, but DON'T award
      // 5+score points. Only first-correct-per-item-per-day awards 2 pts (handled in recordMasteryReview).
      const itemResults = [];
      let correctCount = 0;
      let pointsAwarded = 0;
      for (const item of quiz.items) {
        const answer = answers[item.id];
        const { correct, userAnswer, correctAnswer } = gradeItem(item, answer);
        const { pointsAwarded: pts } = await recordMasteryReview(req.user.id, item.id, quiz.id, correct, userAnswer);
        correctCount += correct ? 1 : 0;
        pointsAwarded += pts;
        itemResults.push({ item, correct, userAnswer, correctAnswer, pointsAwarded: pts });
      }
      if (pointsAwarded > 0) {
        await awardPoints(req.user.id, pointsAwarded);
        await bumpStreak(req.user.id);
      }
      await logActivity(req.user.id, req.user.name, "practice_quiz", `Mastery: ${quiz.title} — ${correctCount}/${quiz.items.length}`);
      const masteryStats = await getQuizMasteryStats(req.user.id, quiz.id);
      // Attach the updated review state to each item result so the result page can show mastery bucket + next due.
      for (const r of itemResults) {
        const updated = masteryStats._reviewMap?.[r.item.id] || null;
        // Simpler: re-fetch the review for each item; this is O(n) but n is small (~10).
      }
      // Re-fetch all reviews for this quiz+user so we can show per-item mastery state on the result page.
      const { QuizItemReview } = await import("../models/index.js");
      const reviews = await QuizItemReview.find({ userId: req.user.id, quizId: quiz.id }).lean();
      const reviewMap = new Map(reviews.map(r => [r.itemId.toString(), r]));
      for (const r of itemResults) {
        r.reviewState = reviewMap.get(String(r.item.id || r.item._id)) || null;
      }
      return res.render("quizzes/result", {
        title: "Result",
        quiz,
        score: correctCount,
        total: quiz.items.length,
        itemResults,
        isMastery: true,
        masteryStats,
      });
    }

    // Non-mastery: original behavior — grade, award 5+score, save attempt.
    const { score, total, responses } = gradeAttempt(quiz.items, answers);
    const durationSec = Number(req.body.durationSec) || 0;
    const attempt = await recordAttempt({
      userId: req.user.id, quizId: quiz.id, score, total, durationSec, responses,
    });

    const points = 5 + score;
    await awardPoints(req.user.id, points);
    await bumpStreak(req.user.id);
    const user = await User.findById(req.user.id);
    if (user) {
      user.practiceQuizzesTaken = (user.practiceQuizzesTaken || 0) + 1;
      await user.save();
    }
    await logActivity(req.user.id, req.user.name, "practice_quiz", `Completed ${quiz.title} — ${score}/${total}`);

    // v3-P1-5: Build itemResults using the same gradeItem helper so the non-mastery
    // result page can also render a per-item breakdown.
    const itemResults = quiz.items.map(item => {
      const answer = answers[item.id];
      const { correct, userAnswer, correctAnswer } = gradeItem(item, answer);
      return { item, correct, userAnswer, correctAnswer, pointsAwarded: correct ? (item.points || 1) : 0 };
    });

    res.render("quizzes/result", {
      title: "Result", quiz, score, total, attempt,
      itemResults, isMastery: false,
    });
  } catch (err) {
    console.error("[submitPractice]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function editor(req, res) {
  try {
    const quizzes = await listQuizzes("practice");
    res.render("quizzes/editor", { title: "Edit Practice Quizzes", quizzes, kind: "practice" }); // v3-fix: pass kind
  } catch (err) {
    console.error("[quizzes editor]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function createQuizPost(req, res) {
  try {
    // v3-P1-4: req.validated is set by validate(createQuizSchema).
    const q = await createQuiz({ ...req.validated, kind: "practice" });
    res.json({ ok: true, quiz: q });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updateQuizPost(req, res) {
  try {
    // v3-P1-4: req.validated is set by validate(updateQuizSchema).
    // updateQuiz() already translates mastery_mode → masteryMode.
    const q = await updateQuiz(req.params.id, req.validated);
    res.json({ ok: true, quiz: q });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function deleteQuizPost(req, res) {
  try {
    await deleteQuiz(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function createItemPost(req, res) {
  try {
    const it = await createItem(req.params.quizId, req.validated || req.body);
    res.json({ ok: true, item: it });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updateItemPost(req, res) {
  try {
    const { question, image_url, correct_answer, explanation, points, type } = req.body;
    const it = await updateItem(req.params.id, { question, image_url, correct_answer, explanation, points, type });
    if (req.body.options) await saveOptions(req.params.id, req.body.options);
    res.json({ ok: true, item: it });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function deleteItemPost(req, res) {
  try {
    await deleteItem(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// v3-P1-5: Grade a single item, return { correct, userAnswer, correctAnswer }.
// Used by both mastery and non-mastery paths so the result page can render a per-item breakdown.
function gradeItem(item, answer) {
  if (item.type === "multiple_choice" || item.type === "true_false") {
    const correctOpt = (item.options || []).find(o => o.isCorrect || o.is_correct);
    const userOpt = (item.options || []).find(o => o.id === answer || o._id?.toString() === answer);
    return {
      correct: !!(correctOpt && userOpt && (correctOpt.id === userOpt.id || correctOpt._id?.toString() === userOpt._id?.toString())),
      userAnswer: userOpt ? userOpt.text : "(no answer)",
      correctAnswer: correctOpt ? correctOpt.text : "—",
    };
  }
  // identification / open_ended — keyword match
  const correctAnswer = item.correctAnswer || item.correct_answer || "";
  const correct = !!(answer && String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase());
  return {
    correct,
    userAnswer: String(answer || "(no answer)"),
    correctAnswer: correctAnswer || "—",
  };
}
