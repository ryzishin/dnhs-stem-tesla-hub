// src/services/quizzes.js
import { Quiz, QuizItem, QuizOption, QuizAttempt, LiveSession, LiveParticipant, QuizItemReview } from "../models/index.js";
// v3-P1-4: FSRS wrapper for mastery-mode quiz items.
import { reviewCard, emptyState } from "./srs.js";

export async function listQuizzes(kind = null) {
  const filter = kind ? { kind } : {};
  const quizzes = await Quiz.find(filter).sort({ createdAt: -1 }).lean();
  for (const q of quizzes) {
    q.items = await listItems(q._id);
    q.id = q._id.toString();
  }
  return quizzes;
}

export async function getQuiz(id) {
  const q = await Quiz.findById(id).lean();
  if (!q) return null;
  q.items = await listItems(q._id);
  q.id = q._id.toString();
  return q;
}

export async function listItems(quizId) {
  const items = await QuizItem.find({ quizId }).sort({ sortOrder: 1 }).lean();
  for (const it of items) {
    const opts = await QuizOption.find({ itemId: it._id }).sort({ sortOrder: 1 }).lean();
    it.options = opts.map((o) => ({ ...o, id: o._id.toString(), itemId: o.itemId.toString() }));
    it.id = it._id.toString();
    it.quizId = it.quizId.toString();
    it.image_url = it.imageUrl;
    it.correct_answer = it.correctAnswer;
  }
  return items;
}

export async function createQuiz(payload) {
  const q = await Quiz.create({
    title: payload.title,
    description: payload.description || "",
    kind: payload.kind || "practice",
    unitId: payload.unit_id || null,
    shuffleItems: payload.shuffle_items !== false,
    shuffleOptions: payload.shuffle_options !== false,
    timeLimitMin: payload.time_limit_min || null,
    deadline: payload.deadline || null,
    // v3-P1-4: Mastery mode toggle. Default false (backward compatible).
    masteryMode: !!payload.mastery_mode,
  });
  return q;
}

export async function updateQuiz(id, patch) {
  // Translate snake_case keys from form submissions to camelCase schema fields.
  const translated = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "shuffle_items") translated.shuffleItems = v;
    else if (k === "shuffle_options") translated.shuffleOptions = v;
    else if (k === "time_limit_min") translated.timeLimitMin = v;
    else if (k === "unit_id") translated.unitId = v;
    else if (k === "mastery_mode") translated.masteryMode = !!v; // v3-P1-4
    else translated[k] = v;
  }
  const updated = await Quiz.findByIdAndUpdate(id, translated, { new: true }).lean();
  return updated;
}

export async function deleteQuiz(id) {
  const items = await QuizItem.find({ quizId: id }).select("_id");
  const itemIds = items.map((i) => i._id);
  await QuizOption.deleteMany({ itemId: { $in: itemIds } });
  await QuizItem.deleteMany({ quizId: id });
  await Quiz.findByIdAndDelete(id);
}

export async function createItem(quizId, payload) {
  const count = await QuizItem.countDocuments({ quizId });
  const it = await QuizItem.create({
    quizId,
    type: payload.type || "multiple_choice",
    question: payload.question,
    imageUrl: payload.image_url || "",
    correctAnswer: payload.correct_answer || "",
    explanation: payload.explanation || "",
    points: payload.points || 1,
    sortOrder: count,
  });
  if (payload.options && payload.options.length > 0) {
    const optRows = payload.options.map((o, i) => ({
      itemId: it._id,
      text: o.text,
      imageUrl: o.image_url || "",
      isCorrect: !!o.is_correct,
      sortOrder: i,
    }));
    await QuizOption.insertMany(optRows);
  }
  return it;
}

export async function listOptions(itemId) {
  return QuizOption.find({ itemId }).sort({ sortOrder: 1 }).lean();
}

export async function updateItem(id, patch) {
  const translated = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "image_url") translated.imageUrl = v;
    else if (k === "correct_answer") translated.correctAnswer = v;
    else translated[k] = v;
  }
  return QuizItem.findByIdAndUpdate(id, translated, { new: true }).lean();
}

export async function deleteItem(id) {
  await QuizOption.deleteMany({ itemId: id });
  await QuizItem.findByIdAndDelete(id);
}

export async function saveOptions(itemId, options) {
  await QuizOption.deleteMany({ itemId });
  if (!options || options.length === 0) return;
  const rows = options.map((o, i) => ({
    itemId,
    text: o.text,
    imageUrl: o.image_url || "",
    isCorrect: !!o.is_correct,
    sortOrder: i,
  }));
  await QuizOption.insertMany(rows);
}

// Attempts — P1-1: recordAttempt now accepts + persists per-item responses.
export async function recordAttempt({ userId, quizId, score, total, durationSec, responses = [] }) {
  return QuizAttempt.create({ userId, quizId, score, total, durationSec, responses });
}

export async function listAttemptsForUser(userId) {
  const attempts = await QuizAttempt.find({ userId })
    .sort({ createdAt: -1 })
    .populate({ path: "quizId", select: "title" })
    .lean();
  return attempts.map((a) => ({
    ...a,
    id: a._id.toString(),
    quiz_id: a.quizId?._id?.toString() || a.quizId?.toString(),
    takenAt: a.createdAt,
    quizzes: a.quizId ? { title: a.quizId.title } : null,
  }));
}

// Live sessions
export async function startLiveSession(quizId) {
  const session = await LiveSession.create({
    quizId,
    status: "active",
    startedAt: new Date(),
  });
  return session;
}

export async function endLiveSession(sessionId) {
  const session = await LiveSession.findByIdAndUpdate(
    sessionId,
    { status: "ended", endedAt: new Date() },
    { new: true }
  ).lean();
  return session;
}

export async function getActiveLiveSession() {
  const session = await LiveSession.findOne({ status: "active" })
    .sort({ createdAt: -1 })
    .populate({ path: "quizId" })
    .lean();
  if (!session) return null;
  const quiz = session.quizId;
  if (quiz) {
    quiz.items = await listItems(quiz._id);
    quiz.id = quiz._id.toString();
  }
  const participants = await LiveParticipant.find({ sessionId: session._id })
    .populate({ path: "userId", select: "name avatarColor avatarUrl" })
    .lean();
  return {
    ...session,
    id: session._id.toString(),
    quiz_id: quiz?._id?.toString(),
    quizzes: quiz,
    participants: participants.map((p) => ({
      ...p,
      id: p._id.toString(),
      user_id: p.userId?._id?.toString(),
      profiles: p.userId ? { name: p.userId.name, avatar_color: p.userId.avatarColor, avatar_url: p.userId.avatarUrl } : null,
    })),
  };
}

export async function advanceLiveItem(sessionId, newIndex) {
  const session = await LiveSession.findByIdAndUpdate(
    sessionId,
    { currentItemIndex: newIndex },
    { new: true }
  ).lean();
  await LiveParticipant.updateMany({ sessionId }, { status: "answering" });
  return session;
}

// Grade an attempt server-side (trustless — never trust the client score)
// P1-1: Also returns per-item responses so the result page can render a breakdown.
export function gradeAttempt(items, answers) {
  let score = 0;
  let total = 0;
  const responses = [];
  for (const it of items) {
    const pts = it.points || 1;
    total += pts;
    const ans = answers[it.id];
    let correct = false;
    if (ans) {
      if (it.type === "multiple_choice" || it.type === "true_false") {
        const correctOpt = (it.options || []).find((o) => o.isCorrect || o.is_correct);
        if (correctOpt && (ans === correctOpt.id || ans === correctOpt._id?.toString())) correct = true;
      } else if (it.type === "identification") {
        const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (norm(ans).includes(norm(it.correctAnswer || it.correct_answer))) correct = true;
      } else if (it.type === "open_ended") {
        if (String(ans).toLowerCase().includes(String(it.correctAnswer || it.correct_answer || "").toLowerCase())) correct = true;
      }
    }
    if (correct) score += pts;
    responses.push({
      itemId: it._id || it.id,
      answer: String(ans || ""),
      correct,
      pointsAwarded: correct ? pts : 0,
    });
  }
  return { score, total, responses };
}

// ===== v3-P1-4: Mastery-mode quiz functions =====

// Get mastery-mode study items for a quiz: due items first, then new items.
// Returns { items: [{ item, reviewState, isDue, isNew }], totalItems, dueCount, newCount }
export async function getMasteryStudyItems(userId, quizId) {
  const allItems = await QuizItem.find({ quizId }).sort({ sortOrder: 1 }).lean();
  // Hydrate options on each item so the take page can render them.
  for (const it of allItems) {
    const opts = await QuizOption.find({ itemId: it._id }).sort({ sortOrder: 1 }).lean();
    it.options = opts.map((o) => ({ ...o, id: o._id.toString(), itemId: o.itemId.toString() }));
    it.id = it._id.toString();
    it.quizId = it.quizId.toString();
    it.image_url = it.imageUrl;
    it.correct_answer = it.correctAnswer;
  }
  const reviews = await QuizItemReview.find({ userId, quizId }).lean();
  const reviewMap = new Map(reviews.map(r => [r.itemId.toString(), r]));
  const now = new Date();

  const itemsWithState = allItems.map(item => {
    const review = reviewMap.get(item._id.toString());
    const isDue = !review || (review.nextDueAt <= now);
    const isNew = !review;
    return { item, reviewState: review, isDue, isNew };
  });

  // Sort: due items first (by nextDueAt asc), then new items, then non-due.
  itemsWithState.sort((a, b) => {
    if (a.isDue && !b.isDue) return -1;
    if (!a.isDue && b.isDue) return 1;
    if (a.isDue && b.isDue) {
      const aTime = a.reviewState?.nextDueAt?.getTime() || 0;
      const bTime = b.reviewState?.nextDueAt?.getTime() || 0;
      return aTime - bTime;
    }
    return 0;
  });

  const dueCount = itemsWithState.filter(i => i.isDue).length;
  const newCount = itemsWithState.filter(i => i.isNew).length;

  return { items: itemsWithState, totalItems: allItems.length, dueCount, newCount };
}

// Record a mastery-mode quiz item review.
// grade: 1=Again (wrong), 3=Good (correct). Map from boolean correct.
export async function recordMasteryReview(userId, itemId, quizId, correct, answerText) {
  const grade = correct ? 3 : 1;
  const existing = await QuizItemReview.findOne({ userId, itemId });
  const currentState = existing?.fsrsState || emptyState();
  const { fsrsState, masteryBucket, nextDueAt } = reviewCard(currentState, grade);

  const updated = await QuizItemReview.findOneAndUpdate(
    { userId, itemId },
    {
      $set: {
        fsrsState,
        masteryBucket,
        nextDueAt,
        quizId,
        lastAnswer: String(answerText || "").slice(0, 500),
        lastCorrect: correct,
        updatedAt: new Date(),
      },
      $inc: {
        timesReviewed: 1,
        timesCorrect: correct ? 1 : 0,
      },
      $setOnInsert: { userId, itemId, quizId, createdAt: new Date() },
    },
    { upsert: true, new: true }
  );

  // Award points only on first correct review per item per day.
  const today = new Date().toISOString().slice(0, 10);
  const lastReviewDate = existing?.updatedAt?.toISOString().slice(0, 10);
  const isFirstCorrectToday = correct && lastReviewDate !== today;
  const pointsAwarded = isFirstCorrectToday ? 2 : 0;

  return { updatedReview: updated, pointsAwarded };
}

// Get mastery stats for a user on a specific quiz.
export async function getQuizMasteryStats(userId, quizId) {
  const totalItems = await QuizItem.countDocuments({ quizId });
  const agg = await QuizItemReview.aggregate([
    { $match: { userId, quizId } },
    { $group: { _id: "$masteryBucket", count: { $sum: 1 } } },
  ]);
  const stats = { new: totalItems, learning: 0, young: 0, mastered: 0 };
  for (const row of agg) {
    stats[row._id] = row.count;
    stats.new -= row.count;
  }
  stats.total = totalItems;
  return stats;
}
