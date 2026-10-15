// src/models/FlashcardReview.js
// v3-P1-1: Per-user-per-card SRS state, tracked via FSRS.
// One document per (userId, cardId) pair. Updated on every review.
import mongoose from "mongoose";

const flashcardReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: "Flashcard", required: true, index: true },
  // FSRS state — serialized form of the ts-fsrs Card object.
  // Stored as a flexible Mixed type because ts-fsrs's Card shape may evolve.
  fsrsState: {
    stability: { type: Number, default: 0 },
    difficulty: { type: Number, default: 0 },
    elapsed_days: { type: Number, default: 0 },
    scheduled_days: { type: Number, default: 0 },
    reps: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    state: {
      type: String,
      enum: ["new", "learning", "review", "relearning"],
      default: "new",
    },
    last_review: { type: Date, default: null },
  },
  // Derived human-readable mastery bucket — computed from fsrsState for query efficiency.
  // "new" = never reviewed, "learning" = state=learning or relearning,
  // "young" = state=review and stability < 21 days,
  // "mastered" = state=review and stability >= 21 days.
  masteryBucket: {
    type: String,
    enum: ["new", "learning", "young", "mastered"],
    default: "new",
    index: true,
  },
  // For "due today" queries.
  nextDueAt: { type: Date, default: Date.now, index: true },
  // Last time this card was reviewed (separate from fsrsState.last_review for query convenience).
  lastReviewedAt: { type: Date, default: null },
  // Stats
  timesReviewed: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound unique index — one review doc per (user, card).
flashcardReviewSchema.index({ userId: 1, cardId: 1 }, { unique: true });

export const FlashcardReview = mongoose.model("FlashcardReview", flashcardReviewSchema);
export default FlashcardReview;
