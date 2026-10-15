// src/models/User.js
import mongoose from "mongoose";

const socialLinksSchema = new mongoose.Schema(
  {
    twitter: { type: String, default: "" },
    instagram: { type: String, default: "" },
    github: { type: String, default: "" },
    facebook: { type: String, default: "" },
    tiktok: { type: String, default: "" },
    youtube: { type: String, default: "" },
    website: { type: String, default: "" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // v3-P3-7: DB-level unique index already existed (set in v1) — `unique: true`
    // on the schema field. The controller's app-level `findOne` check is now also
    // backed by a 11000-error handler in authController.register (added in v3-P3-7).
    username: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, minlength: 3, maxlength: 20 },
    name: { type: String, required: true, default: "Student" }, // display name (changeable)
    // v3-P3-10: Dropped the unused `email` field. It was never collected in
    // registration, never shown in profile, never queried anywhere. Mongoose
    // is schema-less at the DB level so existing docs in MongoDB that still
    // have `email: ""` are unaffected — they just don't show up in the
    // Mongoose document anymore. (When email-based password reset is wired
    // up later, re-add this field at that time.)
    role: { type: String, enum: ["student", "moderator", "administrator"], default: "student" },
    avatarColor: { type: Number, default: () => Math.floor(Math.random() * 360) },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 280 },
    socials: { type: socialLinksSchema, default: () => ({}) },
    passwordHash: { type: String, required: true },
    points: { type: Number, default: 0 },
    weeklyPoints: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    lastActiveDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    practiceQuizzesTaken: { type: Number, default: 0 },
    flashcardsReviewed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.virtual("id").get(function () {
  return this._id.toString();
});

userSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.model("User", userSchema);
