// src/models/QuizItem.js
import mongoose from "mongoose";

const quizItemSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    type: {
      type: String,
      enum: ["multiple_choice", "identification", "open_ended", "true_false"],
      required: true,
    },
    question: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    correctAnswer: { type: String, default: "" }, // for identification / open_ended
    explanation: { type: String, default: "" },
    points: { type: Number, default: 1 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("QuizItem", quizItemSchema);
