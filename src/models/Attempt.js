// src/models/Attempt.js — one completed practice-quiz run per student.
import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    itemId: { type: String },
    answer: { type: String, default: "" },
    correct: { type: Boolean, default: false },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", index: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    answers: { type: [answerSchema], default: [] },
  },
  { timestamps: true }
);

attemptSchema.virtual("id").get(function () { return this._id.toString(); });
attemptSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("Attempt", attemptSchema);
