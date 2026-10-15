// src/middleware/auth.js
import { User } from "../models/index.js";

// Attach `req.user` and `req.role` if a session user_id is present.
export async function attachUser(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    req.user = null;
    req.role = null;
    return next();
  }
  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      req.session.destroy(() => {});
      req.user = null;
      req.role = null;
      return next();
    }
    req.user = {
      ...user,
      id: user._id.toString(),
      avatar_color: user.avatarColor,
      avatar_url: user.avatarUrl,
    };
    req.role = user.role;
    // P0-4: Throttle lastActiveDate writes — only update if stale > 1 hour.
    // (Old code wrote to MongoDB on every page load per user.)
    const THROTTLE_MS = 60 * 60 * 1000;
    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).getTime() : 0;
    if (Date.now() - lastActive > THROTTLE_MS) {
      User.updateOne(
        { _id: user._id },
        { lastActiveDate: new Date().toISOString().slice(0, 10) }
      ).catch(() => {});
    }
    next();
  } catch (err) {
    console.error("[attachUser] error:", err.message);
    req.user = null;
    req.role = null;
    next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.redirect("/login?error=auth_required");
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect("/login?error=auth_required");
    if (!roles.includes(req.role)) {
      return res.status(403).render("error/403", { user: req.user });
    }
    next();
  };
}

export const requireStudent = requireRole("student", "moderator", "administrator"); // v3-fix: admin can also take practice quizzes & flashcards
export const requireModerator = requireRole("moderator", "administrator"); // admin can do everything moderator can
export const requireAdmin = requireRole("administrator");
