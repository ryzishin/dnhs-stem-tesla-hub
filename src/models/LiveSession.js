// src/models/LiveSession.js
import mongoose from "mongoose";

const liveSessionSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    status: { type: String, enum: ["lobby", "active", "ended"], default: "lobby" },
    currentItemIndex: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("LiveSession", liveSessionSchema);
