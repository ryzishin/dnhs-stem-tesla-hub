// src/models/ActivityFeed.js
import mongoose from "mongoose";

const activityFeedSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    userName: { type: String, default: "" },
    kind: {
      type: String,
      enum: ["login", "view_note", "practice_quiz", "flashcard", "live_quiz", "submit", "warning", "logout"],
      required: true,
    },
    detail: { type: String, default: "" },
  },
  { timestamps: true }
);

activityFeedSchema.index({ createdAt: -1 });

export default mongoose.model("ActivityFeed", activityFeedSchema);
