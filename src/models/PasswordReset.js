// src/models/PasswordReset.js
// v3-P2-6: Password-reset token store. One row per (user, token) pair.
// Tokens are 32-byte random hex strings, expire 30 minutes after issue,
// and are one-shot (usedAt is set the moment they're consumed).
import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);
export default PasswordReset;
