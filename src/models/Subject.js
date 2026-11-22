// src/models/Subject.js — one entry per school subject; every piece of content hangs off one.
import mongoose from "mongoose";

export const SUBJECT_COLORS = ["coral", "teal", "navy", "amber", "sky", "plum"];
export const SUBJECT_ICONS = ["dna", "flask", "motion", "calculator", "globe", "language", "atom", "leaf"];

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]+$/ },
    blurb: { type: String, default: "", maxlength: 160 },
    color: { type: String, enum: SUBJECT_COLORS, default: "coral" },
    icon: { type: String, enum: SUBJECT_ICONS, default: "atom" },
    order: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

subjectSchema.virtual("id").get(function () { return this._id.toString(); });
subjectSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("Subject", subjectSchema);
