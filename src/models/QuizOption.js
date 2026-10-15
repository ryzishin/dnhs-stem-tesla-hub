// src/models/QuizOption.js
import mongoose from "mongoose";

const quizOptionSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "QuizItem", required: true, index: true },
    text: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    isCorrect: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("QuizOption", quizOptionSchema);
