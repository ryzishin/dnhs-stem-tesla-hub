// src/models/Settings.js — single settings row (singleton, doc _id: "main").
import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "main" },
    allowRegistration: { type: Boolean, default: true },   // the class chose open signup; adviser can switch off
    antiCheat: {
      tabWarning: { type: Boolean, default: true },
      fullscreen: { type: Boolean, default: true },
      blockCopy: { type: Boolean, default: true },
      warningsCap: { type: Number, default: 3 },
    },
    points: {
      quizBase: { type: Number, default: 5 },      // per completed practice quiz
      cardPoints: { type: Number, default: 2 },    // per "I knew it" card
      streakBonus: { type: Number, default: 3 },   // per active day
    },
  },
  { timestamps: true, collection: "settings" }
);

settingsSchema.statics.get = async function () {
  let doc = await this.findById("main");
  if (!doc) doc = await this.create({ _id: "main" });
  return doc;
};

settingsSchema.virtual("id").get(function () { return this._id; });
settingsSchema.set("toJSON", { virtuals: true, transform: (_d, r) => { delete r.__v; return r; } });

export default mongoose.model("Settings", settingsSchema);
