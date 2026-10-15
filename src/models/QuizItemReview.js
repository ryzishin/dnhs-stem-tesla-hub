// src/models/QuizItemReview.js
// v3-P1-1: Per-user-per-quiz-item SRS state, for mastery-mode quizzes.
// Same shape as FlashcardReview but for QuizItem.
import mongoose from "mongoose";

const quizItemReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: "QuizItem", required: true, index: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
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
  masteryBucket: {
    type: String,
    enum: ["new", "learning", "young", "mastered"],
    default: "new",
    index: true,
  },
  nextDueAt: { type: Date, default: Date.now, index: true },
  timesReviewed: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
  // Last answer the student gave — for the result page's "your answer vs correct" display.
  lastAnswer: { type: String, default: "" },
  lastCorrect: { type: Boolean, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

quizItemReviewSchema.index({ userId: 1, itemId: 1 }, { unique: true });
// For "fetch all due items for this quiz for this user":
quizItemReviewSchema.index({ userId: 1, quizId: 1, nextDueAt: 1 });

export const QuizItemReview = mongoose.model("QuizItemReview", quizItemReviewSchema);
export default QuizItemReview;
