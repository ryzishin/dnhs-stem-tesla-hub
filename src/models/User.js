// src/models/User.js — students, moderators (classmates), and the adviser (admin).
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, index: true,
      lowercase: true, trim: true, minlength: 3, maxlength: 20,
      match: /^[a-z0-9._-]+$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    role: { type: String, enum: ["student", "moderator", "admin"], default: "student", index: true },
    moderatedSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    avatarColor: { type: Number, default: () => Math.floor(Math.random() * 360) }, // fallback tint when no photo
    avatarUrl: { type: String, default: "" }, // uploaded photo (served from /uploads/avatars)
    bio: { type: String, default: "", maxlength: 280 },
    links: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
      x: { type: String, default: "" },
      youtube: { type: String, default: "" },
      github: { type: String, default: "" },
    },
    passwordHash: { type: String, required: true },
    points: { type: Number, default: 0 },
    weeklyPoints: { type: Number, default: 0 },
    weekStart: { type: String, default: "" }, // ISO date of the Monday this weekly score belongs to
    streakDays: { type: Number, default: 0 },
    lastActiveDate: { type: String, default: "" }, // YYYY-MM-DD
    practiceTaken: { type: Number, default: 0 },
    cardsReviewed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.virtual("id").get(function () { return this._id.toString(); });

userSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => { delete ret.__v; delete ret.passwordHash; return ret; },
});

userSchema.methods.isModeratorOf = function (subjectId) {
  if (this.role === "admin") return true;
  if (this.role !== "moderator") return false;
  return this.moderatedSubjects.some((s) => s.toString() === subjectId.toString());
};

export default mongoose.model("User", userSchema);
