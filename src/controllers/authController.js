// src/controllers/authController.js
// Username + bcrypt login + self-registration.
// The first user to register becomes the administrator.
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { User } from "../models/index.js";
import { PasswordReset } from "../models/PasswordReset.js";
import { sendPasswordResetEmail } from "../services/email.js";
import { logActivity, bumpStreak } from "../services/leaderboard.js";

function isValidUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,20}$/.test(String(username || "").trim());
}

// P2-2: Use the same error for wrong-username and wrong-password to prevent enumeration.
// Also run bcrypt.compare against a dummy hash when the user doesn't exist so the
// timing is indistinguishable from a real wrong-password attempt.
const LOGIN_FAIL_MSG = "Invalid username or password.";

// v3-P3-2: Generate a dummy hash at module load. This is guaranteed valid
// because we just made it. Old code hardcoded a hash string that could have
// been malformed (wrong length, invalid base64 chars) — bcrypt.compare would
// have thrown synchronously, crashing the login flow.
let _dummyHash = null;
async function getDummyHash() {
  if (_dummyHash) return _dummyHash;
  _dummyHash = await bcrypt.hash("never-matches-anything-" + Date.now(), 12);
  return _dummyHash;
}

export async function showLogin(req, res) {
  const flash = req.session?.flash;
  if (req.session?.flash) req.session.flash = null;
  res.render("login", {
    title: "Sign in",
    error: req.query.error || flash?.error,
    // v3-P2-6: success flash from password-reset flow.
    success: req.query.success === "password_reset" ? "Your password has been reset. You can now sign in." : null,
  });
}

export async function showRegister(req, res) {
  res.render("register", {
    title: "Create account",
    error: req.query.error,
    isFirstUser: (await User.countDocuments()) === 0,
  });
}

export async function register(req, res) {
  const { username, name, password, confirm } = req.body;
  if (!username || !name || !password) {
    return res.render("register", { title: "Create account", error: "All fields are required.", isFirstUser: (await User.countDocuments()) === 0 });
  }
  if (!isValidUsername(username)) {
    return res.render("register", { title: "Create account", error: "Username must be 3–20 characters (letters, digits, _, ., -).", isFirstUser: (await User.countDocuments()) === 0 });
  }
  if (password.length < 6) {
    return res.render("register", { title: "Create account", error: "Password must be at least 6 characters.", isFirstUser: (await User.countDocuments()) === 0 });
  }
  if (confirm && password !== confirm) {
    return res.render("register", { title: "Create account", error: "Passwords do not match.", isFirstUser: (await User.countDocuments()) === 0 });
  }

  const existing = await User.findOne({ username: username.trim().toLowerCase() });
  if (existing) {
    return res.render("register", { title: "Create account", error: "That username is taken. Try another.", isFirstUser: (await User.countDocuments()) === 0 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const isFirstUser = (await User.countDocuments()) === 0;

  // v3-P2-10: Initialize streakDays to 1 on creation, skip the bumpStreak call.
  // (bumpStreak is a no-op here because lastActiveDate is already today — see User schema default.
  // Previously new users registered with streakDays: 0 and it only became 1 on the next day's login.)
  let user;
  try {
    user = await User.create({
      username: username.trim().toLowerCase(),
      name: name.trim(),
      passwordHash,
      role: isFirstUser ? "administrator" : "student", // first registered account becomes admin
      streakDays: 1,                                  // v3-P2-10
      lastActiveDate: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    // v3-P3-7: Handle race condition — two concurrent registrations with same username.
    if (err.code === 11000 && err.keyPattern?.username) {
      return res.render("register", {
        title: "Create account",
        error: "That username is taken. Try another.",
        isFirstUser: (await User.countDocuments()) === 0,
      });
    }
    // Any other error → render the register page with a generic error.
    console.error("[register] User.create failed:", err);
    return res.render("register", {
      title: "Create account",
      error: "Could not create your account. Please try again.",
      isFirstUser: (await User.countDocuments()) === 0,
    });
  }

  req.session.userId = user._id.toString();
  // v3-P2-10: Don't call bumpStreak — it's a no-op because lastActiveDate is already today.
  // We've already initialized streakDays to 1 above.
  await logActivity(user._id, user.name, "login", "Registered & signed in");

  // Route by role
  const dest = isFirstUser ? "/admin" : "/notes";
  res.redirect(dest);
}

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render("login", { title: "Sign in", error: "Username and password are required." });
  }

  const user = await User.findOne({ username: username.trim().toLowerCase() });
  // P2-2: Compare against a dummy hash when the user doesn't exist so the timing
  // matches a real wrong-password attempt. Either way, return the same message.
  // v3-P3-2: Use getDummyHash() instead of the hardcoded DUMMY_HASH constant.
  const dummyHash = await getDummyHash();
  const hashToCompare = user ? user.passwordHash : dummyHash;
  const match = await bcrypt.compare(password, hashToCompare);
  if (!user || !match) {
    return res.render("login", { title: "Sign in", error: LOGIN_FAIL_MSG });
  }

  req.session.userId = user._id.toString();
  await bumpStreak(user._id);
  await logActivity(user._id, user.name, "login", "Signed in");

  const dest = user.role === "administrator" ? "/admin" : user.role === "moderator" ? "/moderator/notes" : "/notes";
  res.redirect(dest);
}

export async function logout(req, res) {
  if (req.user) {
    await logActivity(req.user.id, req.user.name, "logout", "Signed out");
  }
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

// ===== v3-P2-6: Password reset =====

export async function showForgotPassword(req, res) {
  res.render("forgot-password", { title: "Forgot password", error: null, success: null });
}

export async function requestPasswordReset(req, res) {
  const successMsg = "If that account exists, a reset link has been sent.";
  try {
    const { username } = req.validated;
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    // Always show the same success message to prevent user enumeration.
    if (!user) {
      return res.render("forgot-password", { title: "Forgot password", error: null, success: successMsg });
    }
    // Invalidate any existing unused tokens for this user.
    await PasswordReset.updateMany({ userId: user._id, usedAt: null }, { usedAt: new Date() });
    // Generate a new token.
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await PasswordReset.create({ userId: user._id, token, expiresAt });
    // Build the reset URL. Use the publicUrl from app locals if available (set by server.js).
    const base = res.locals.publicUrl || "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${token}`;
    // Email stub — logs to console so the dev can click the link.
    await sendPasswordResetEmail(user.username, resetUrl);
    res.render("forgot-password", { title: "Forgot password", error: null, success: successMsg });
  } catch (err) {
    console.error("[requestPasswordReset]", err);
    // Don't leak the error to the client — same generic success message.
    res.render("forgot-password", { title: "Forgot password", error: null, success: successMsg });
  }
}

export async function showResetPassword(req, res) {
  const { token } = req.query;
  if (!token) return res.redirect("/forgot-password");
  const reset = await PasswordReset.findOne({ token, usedAt: null, expiresAt: { $gt: new Date() } });
  if (!reset) {
    return res.render("reset-password", { title: "Reset password", error: "This reset link is invalid or has expired.", token: null });
  }
  res.render("reset-password", { title: "Reset password", error: null, token });
}

export async function performPasswordReset(req, res) {
  try {
    const { token, newPassword } = req.validated;
    const reset = await PasswordReset.findOne({ token, usedAt: null, expiresAt: { $gt: new Date() } });
    if (!reset) {
      return res.render("reset-password", { title: "Reset password", error: "This reset link is invalid or has expired.", token: null });
    }
    const user = await User.findById(reset.userId);
    if (!user) return res.redirect("/forgot-password");
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    reset.usedAt = new Date();
    await reset.save();
    res.redirect("/login?success=password_reset");
  } catch (err) {
    console.error("[performPasswordReset]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}
