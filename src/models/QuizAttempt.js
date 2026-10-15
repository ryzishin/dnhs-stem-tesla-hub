// src/models/QuizAttempt.js
import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    durationSec: { type: Number, default: 0 },
    // P1-1: Per-item responses — lets the result page show which questions the student
    // got wrong/ wrong, with the correct answer + explanation. Backward-compatible:
    // old attempts simply have an empty array here.
    responses: {
      type: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        answer: { type: String, default: "" },
        correct: { type: Boolean, default: false },
        pointsAwarded: { type: Number, default: 0 },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("QuizAttempt", quizAttemptSchema);
