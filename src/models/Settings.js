// src/models/Settings.js
import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: Number, default: 1 },
    antiCheat: {
      blockTabSwitch: { type: Boolean, default: true },
      requireFullscreen: { type: Boolean, default: true },
      blockCopy: { type: Boolean, default: true },
      blockRightClick: { type: Boolean, default: true },
      maxWarnings: { type: Number, default: 3 },
    },
    // v3-P2-12: Default time limit + deadline for new live tests.
    // Stored on Settings so the admin settings page can display them on reload
    // (previously these were silently dropped from Settings — only written to the Quiz doc).
    defaultTimeLimitMin: { type: Number, default: null },
    defaultDeadline: { type: String, default: null },
  },
  { timestamps: true }
);

// Singleton — there's only ever one settings row.
settingsSchema.statics.getSingleton = async function () {
  let s = await this.findById(1);
  if (!s) s = await this.create({ _id: 1 });
  return s;
};

export default mongoose.model("Settings", settingsSchema);
