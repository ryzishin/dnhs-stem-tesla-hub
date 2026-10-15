// src/models/Flashcard.js
import mongoose from "mongoose";

const flashcardSchema = new mongoose.Schema(
  {
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", default: null },
    front: { type: String, required: true },
    back: { type: String, required: true },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Flashcard", flashcardSchema);
