// src/models/LiveSession.js — one hosted live test. The host controls the pace;
// the server owns the item order and grading (never the student's browser).
import mongoose from "mongoose";

const liveSessionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", index: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["lobby", "active", "ended"], default: "lobby", index: true },
    itemOrder: { type: [String], default: [] },      // shuffled item ids — the server's source of truth
    currentItemIndex: { type: Number, default: 0 },
    itemStartedAt: { type: Date },                   // when the current item went live (drives the countdown)
    autoAdvanceSec: { type: Number, default: 0 },
    antiCheat: {
      tabWarning: { type: Boolean, default: true },
      fullscreen: { type: Boolean, default: true },
      blockCopy: { type: Boolean, default: true },
      warningsCap: { type: Number, default: 3 },
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

liveSessionSchema.virtual("id").get(function () { return this._id.toString(); });
liveSessionSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("LiveSession", liveSessionSchema);
