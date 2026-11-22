// src/models/Note.js — a study note: typed content blocks + credited sources, embedded in one document.
// (Refactored from the old Unit → Part → ContentBlock trio to a single flat document,
//  so the builder saves everything with one request.)
import mongoose from "mongoose";
import { noteId } from "../services/ids.js";

export const BLOCK_TYPES = ["heading", "paragraph", "bullets", "numbered", "image", "callout", "keyterm", "divider"];

const sourceSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 120, default: "" },
    url: { type: String, trim: true, maxlength: 400, default: "" },
  },
  { _id: false }
);

const blockSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => noteId() },
    type: { type: String, enum: BLOCK_TYPES, required: true },
    // heading
    level: { type: Number, enum: [2, 3], default: 2 },
    // paragraph, heading, callout
    text: { type: String, default: "", maxlength: 4000 },
    // bullets / numbered
    items: { type: [String], default: undefined },
    // image
    url: { type: String, default: "", maxlength: 600 },
    caption: { type: String, default: "", maxlength: 240 },
    // callout: info | tip | warn
    variant: { type: String, enum: ["info", "tip", "warn"], default: "info" },
    // keyterm
    term: { type: String, default: "", maxlength: 120 },
    definition: { type: String, default: "", maxlength: 1200 },
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    blurb: { type: String, default: "", maxlength: 200 },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    blocks: { type: [blockSchema], default: [] },
    sources: { type: [sourceSchema], default: [] },
  },
  { timestamps: true }
);

noteSchema.virtual("id").get(function () { return this._id.toString(); });
noteSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("Note", noteSchema);
