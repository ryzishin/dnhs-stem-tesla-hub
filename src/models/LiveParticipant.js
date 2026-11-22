// src/models/LiveParticipant.js — a student inside one live session: server-side answers + warnings.
import mongoose from "mongoose";

const liveParticipantSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "LiveSession", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, default: "" },
    score: { type: Number, default: 0 },
    answers: {
      type: Map, of: new mongoose.Schema(
        { answer: { type: String, default: "" }, correct: { type: Boolean, default: false }, points: { type: Number, default: 0 } },
        { _id: false }
      ),
      default: {},
    },
    warnings: { type: Number, default: 0 },
    lastWarnAt: { type: Date, default: null },        // dedupes burst events (blur + visibilitychange + pagehide) into one count
    kicked: { type: Boolean, default: false },        // removed manually by the host
    autoSubmitted: { type: Boolean, default: false }, // hit the warning cap — test submitted as-is
    finished: { type: Boolean, default: false },
    attemptNo: { type: Number, default: 1 },          // bumped when the adviser grants a re-attempt
    retryStatus: { type: String, enum: ["none", "pending", "declined"], default: "none" },
    retryReason: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

liveParticipantSchema.index({ session: 1, user: 1 }, { unique: true });

liveParticipantSchema.virtual("id").get(function () { return this._id.toString(); });
liveParticipantSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("LiveParticipant", liveParticipantSchema);
