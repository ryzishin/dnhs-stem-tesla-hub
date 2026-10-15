// src/models/Quiz.js
import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    kind: { type: String, enum: ["practice", "live"], default: "practice", index: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", default: null },
    shuffleItems: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    timeLimitMin: { type: Number, default: null }, // live only
    deadline: { type: Date, default: null }, // live only
    // v3-P1-1 / v3-P1-4: Mastery mode toggle. When ON, the quiz uses spaced-repetition
    // (FSRS) instead of one-shot grading. Existing quizzes default to false → zero behavior change.
    masteryMode: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Quiz", quizSchema);
