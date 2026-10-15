// src/controllers/flashcardsController.js
import {
  listFlashcards, createFlashcard, updateFlashcard, deleteFlashcard,
  // v3-P1-3: SRS-aware functions
  getDueCards, getNewCardCount, getMasteryStats, recordReview,
} from "../services/flashcards.js";
import { listUnits } from "../services/notes.js";
import { awardPoints, bumpStreak, logActivity } from "../services/leaderboard.js";
import { User, Flashcard, FlashcardReview } from "../models/index.js";

export async function list(req, res) {
  try {
    const unitId = req.query.unit || null;
    const cards = await listFlashcards(unitId);
    const units = await listUnits();
    // v3-P1-3: Pull mastery stats so the index page can render the per-unit progress bar.
    const stats = await getMasteryStats(req.user.id, unitId);
    res.render("flashcards/index", {
      title: "Flashcards", cards, units, unitId, stats,
    });
  } catch (err) {
    console.error("[flashcards list]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function review(req, res) {
  const { cardId } = req.body;
  if (!cardId) return res.json({ ok: false, error: "cardId required" });
  await awardPoints(req.user.id, 2);
  await bumpStreak(req.user.id);
  const user = await User.findById(req.user.id);
  if (user) {
    user.flashcardsReviewed = (user.flashcardsReviewed || 0) + 1;
    await user.save();
  }
  await logActivity(req.user.id, req.user.name, "flashcard", "Reviewed a flashcard");
  res.json({ ok: true, awarded: 2 });
}

export async function editor(req, res) {
  try {
    const cards = await listFlashcards();
    const units = await listUnits();
    res.render("flashcards/editor", { title: "Edit Flashcards", cards, units });
  } catch (err) {
    console.error("[flashcards editor]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function createPost(req, res) {
  try {
    const c = await createFlashcard(req.body);
    res.json({ ok: true, card: c });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function updatePost(req, res) {
  try {
    const c = await updateFlashcard(req.params.id, req.body);
    res.json({ ok: true, card: c });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function deletePost(req, res) {
  try {
    await deleteFlashcard(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ===== v3-P1-3: SRS study session =====

// GET /flashcards/study — render the study session page.
export async function studySession(req, res) {
  try {
    const unitId = req.query.unitId || null;
    const dueCards = await getDueCards(req.user.id, unitId, 30);
    const newCardCount = await getNewCardCount(req.user.id, unitId);
    const stats = await getMasteryStats(req.user.id, unitId);
    res.render("flashcards/study", {
      title: "Study Session",
      unitId,
      dueCount: dueCards.length,
      newCardCount,
      stats,
    });
  } catch (err) {
    console.error("[studySession]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

// GET /api/flashcards/study/next — fetch the next due card (or a new one).
// Returns { card: { id, front, back, imageUrl } | null, isDue: boolean, isNew: boolean }
export async function nextStudyCard(req, res) {
  try {
    const unitId = req.query.unitId || null;
    // Try due cards first.
    let due = await getDueCards(req.user.id, unitId, 1);
    if (due.length > 0) {
      const c = due[0].card;
      return res.json({
        card: { id: c._id.toString(), front: c.front, back: c.back, imageUrl: c.imageUrl },
        isDue: true,
        isNew: false,
      });
    }
    // No due cards — pull a new one (never reviewed).
    const reviewedIds = await FlashcardReview.find({ userId: req.user.id }).distinct("cardId");
    const newMatch = { _id: { $nin: reviewedIds } };
    if (unitId) newMatch.unitId = unitId;
    const newCard = await Flashcard.findOne(newMatch).lean();
    if (newCard) {
      return res.json({
        card: { id: newCard._id.toString(), front: newCard.front, back: newCard.back, imageUrl: newCard.imageUrl },
        isDue: false,
        isNew: true,
      });
    }
    // Nothing due, nothing new.
    res.json({ card: null, isDue: false, isNew: false });
  } catch (err) {
    console.error("[nextStudyCard]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /api/flashcards/review-graded — record a graded review.
// Body: { cardId, grade (1-4) }
export async function reviewGraded(req, res) {
  try {
    const { cardId, grade } = req.validated;
    const { pointsAwarded } = await recordReview(req.user.id, cardId, grade);
    if (pointsAwarded > 0) {
      await awardPoints(req.user.id, pointsAwarded);
      await bumpStreak(req.user.id);
    }
    res.json({ ok: true, pointsAwarded });
  } catch (err) {
    console.error("[reviewGraded]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
