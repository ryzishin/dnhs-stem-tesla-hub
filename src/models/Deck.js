// src/models/Deck.js — a flashcard deck with its cards embedded (one save from the builder).
import mongoose from "mongoose";
import { noteId } from "../services/ids.js";

const cardSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => noteId() },
    front: { type: String, required: true, trim: true, maxlength: 300 },
    back: { type: String, required: true, trim: true, maxlength: 600 },
  },
  { _id: false }
);

const deckSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    blurb: { type: String, default: "", maxlength: 200 },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    cards: { type: [cardSchema], default: [] },
  },
  { timestamps: true }
);

deckSchema.virtual("id").get(function () { return this._id.toString(); });
deckSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("Deck", deckSchema);
