// src/services/flashcards.js
import { Flashcard, FlashcardReview } from "../models/index.js";
// v3-P1-3: FSRS wrapper. Lazily imported — see note in srs.js about ts-fsrs not being installed yet.
import { reviewCard, emptyState } from "./srs.js";

export async function listFlashcards(unitId = null) {
  const filter = unitId ? { unitId } : {};
  const cards = await Flashcard.find(filter).sort({ createdAt: -1 }).lean();
  return cards.map((c) => ({
    ...c,
    id: c._id.toString(),
    unit_id: c.unitId ? c.unitId.toString() : null,
    image_url: c.imageUrl,
  }));
}

export async function createFlashcard({ front, back, unit_id, image_url }) {
  const c = await Flashcard.create({
    front,
    back,
    unitId: unit_id || null,
    imageUrl: image_url || "",
  });
  return c;
}

export async function updateFlashcard(id, patch) {
  const translated = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "unit_id") translated.unitId = v;
    else if (k === "image_url") translated.imageUrl = v;
    else translated[k] = v;
  }
  return Flashcard.findByIdAndUpdate(id, translated, { new: true }).lean();
}

export async function deleteFlashcard(id) {
  await Flashcard.findByIdAndDelete(id);
}

// ===== v3-P1-3: SRS-aware flashcard functions =====

// Get all FlashcardReview docs for a user, optionally filtered by unitId.
// Returns a Map keyed by cardId for fast lookup.
export async function getReviewStatesForUser(userId, unitId = null) {
  const match = { userId };
  if (unitId) {
    const cards = await Flashcard.find({ unitId }).select("_id").lean();
    match.cardId = { $in: cards.map(c => c._id) };
  }
  const reviews = await FlashcardReview.find(match).lean();
  return new Map(reviews.map(r => [r.cardId.toString(), r]));
}

// Get cards due for review for a user. Returns array of { card, reviewState }.
// Optionally limit to N cards (default 30).
export async function getDueCards(userId, unitId = null, limit = 30) {
  const match = { userId, nextDueAt: { $lte: new Date() } };
  if (unitId) {
    const cards = await Flashcard.find({ unitId }).select("_id").lean();
    match.cardId = { $in: cards.map(c => c._id) };
  }
  const dueReviews = await FlashcardReview.find(match)
    .sort({ nextDueAt: 1 })
    .limit(limit)
    .populate("cardId")
    .lean();
  return dueReviews.map(r => ({ card: r.cardId, reviewState: r }));
}

// Get count of new cards (never reviewed) for a user, optionally by unit.
export async function getNewCardCount(userId, unitId = null) {
  const reviewedCardIds = await FlashcardReview.find({ userId }).distinct("cardId");
  const newMatch = { _id: { $nin: reviewedCardIds } };
  if (unitId) newMatch.unitId = unitId;
  return Flashcard.countDocuments(newMatch);
}

// Get mastery stats for a user, optionally by unit.
// Returns { new, learning, young, mastered, total }.
export async function getMasteryStats(userId, unitId = null) {
  const match = { userId };
  if (unitId) {
    const cards = await Flashcard.find({ unitId }).select("_id").lean();
    match.cardId = { $in: cards.map(c => c._id) };
  }
  const agg = await FlashcardReview.aggregate([
    { $match: match },
    { $group: { _id: "$masteryBucket", count: { $sum: 1 } } },
  ]);
  const stats = { new: 0, learning: 0, young: 0, mastered: 0 };
  for (const row of agg) stats[row._id] = row.count;
  // Add "new" = total cards - reviewed cards
  const totalCards = unitId
    ? await Flashcard.countDocuments({ unitId })
    : await Flashcard.countDocuments();
  stats.new += Math.max(0, totalCards - (stats.learning + stats.young + stats.mastered));
  stats.total = totalCards;
  return stats;
}

// Record a review: update the FlashcardReview doc with FSRS state.
// grade: 1=Again, 2=Hard, 3=Good, 4=Easy
// Returns { updatedReview, pointsAwarded }
export async function recordReview(userId, cardId, grade) {
  const existing = await FlashcardReview.findOne({ userId, cardId });
  const currentState = existing?.fsrsState || emptyState();
  const { fsrsState, masteryBucket, nextDueAt } = reviewCard(currentState, grade);

  const updated = await FlashcardReview.findOneAndUpdate(
    { userId, cardId },
    {
      $set: {
        fsrsState,
        masteryBucket,
        nextDueAt,
        lastReviewedAt: new Date(),
        updatedAt: new Date(),
      },
      $inc: {
        timesReviewed: 1,
        timesCorrect: grade >= 3 ? 1 : 0,
      },
      $setOnInsert: { userId, cardId, createdAt: new Date() },
    },
    { upsert: true, new: true }
  );

  // Award points only on first correct review per card per day.
  // Use the `lastReviewedAt` to detect if this is the first review today.
  const today = new Date().toISOString().slice(0, 10);
  const lastReviewDate = existing?.lastReviewedAt?.toISOString().slice(0, 10);
  const isFirstCorrectToday = grade >= 3 && lastReviewDate !== today;
  const pointsAwarded = isFirstCorrectToday ? 2 : 0;

  return { updatedReview: updated, pointsAwarded };
}
