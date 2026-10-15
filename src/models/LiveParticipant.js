// src/models/LiveParticipant.js
import mongoose from "mongoose";

const liveParticipantSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "LiveSession", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, default: "joined" }, // joined | answering | submitted | kicked | left
    score: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    lastActivity: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

liveParticipantSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

export default mongoose.model("LiveParticipant", liveParticipantSchema);
