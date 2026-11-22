// src/models/Quiz.js — practice + live quizzes. Items and options are embedded
// (refactored from three separate collections to one document per quiz).
import mongoose from "mongoose";
import { noteId } from "../services/ids.js";

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => noteId() },
    text: { type: String, trim: true, maxlength: 300, default: "" },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => noteId() },
    type: { type: String, enum: ["mcq", "tf", "short"], default: "mcq" },
    question: { type: String, required: true, trim: true, maxlength: 600 },
    points: { type: Number, default: 1, min: 1, max: 10 },
    options: { type: [optionSchema], default: undefined },   // mcq
    answer: { type: String, default: "" },                    // tf: "true"/"false" · short: accepted keyword
    explanation: { type: String, default: "", maxlength: 600 },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    blurb: { type: String, default: "", maxlength: 200 },
    mode: { type: String, enum: ["practice", "live"], default: "practice", index: true },
    timeLimitMin: { type: Number, default: 0, min: 0, max: 120 },   // 0 = no limit
    autoAdvanceSec: { type: Number, default: 0, min: 0, max: 300 }, // live only; 0 = host advances manually
    published: { type: Boolean, default: true },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true }
);

quizSchema.virtual("id").get(function () { return this._id.toString(); });
quizSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

// Safe copy for students: identical shape, no correct answers attached.
quizSchema.statics.stripForStudent = function (doc) {
  const q = doc.toJSON();
  q.items = (q.items || []).map((it) => ({
    ...it,
    options: it.options ? it.options.map((o) => ({ id: o.id, text: o.text })) : undefined,
    answer: undefined,
    explanation: undefined,
  }));
  return q;
};

export default mongoose.model("Quiz", quizSchema);
