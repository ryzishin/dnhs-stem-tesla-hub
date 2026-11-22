// src/models/Review.js — one flashcard study session per student (for profile history).
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deck: { type: mongoose.Schema.Types.ObjectId, ref: "Deck", required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", index: true },
    known: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reviewSchema.virtual("id").get(function () { return this._id.toString(); });
reviewSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("Review", reviewSchema);
