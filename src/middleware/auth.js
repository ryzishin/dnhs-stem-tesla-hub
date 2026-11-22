// src/middleware/auth.js — session user + role guards.
// Roles: admin (the adviser) · moderator (a trusted classmate, scoped to their subjects) · student.
import { User } from "../models/index.js";

export async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  req.user = null;
  if (req.session?.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
        res.locals.currentUser = user.toJSON();
      } else {
        delete req.session.userId;
      }
    } catch { /* bad session id — treat as guest */ }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.accepts("html")) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  return res.status(401).json({ error: "Please sign in first." });
}

export function requireAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  if (req.accepts("html")) return res.status(403).render("error", { code: 403, title: "Adviser only", message: "This area belongs to the adviser account." });
  return res.status(403).json({ error: "Admin only." });
}

/** Moderators and admins may open the builders. Subject-level checks happen per document. */
export function requireBuilder(req, res, next) {
  if (req.user && (req.user.role === "admin" || req.user.role === "moderator")) return next();
  if (req.accepts("html")) return res.status(403).render("error", { code: 403, title: "Builders are for moderators", message: "Ask the adviser to make you a moderator of a subject." });
  return res.status(403).json({ error: "Moderator only." });
}

/** Live-test hosting is reserved for the adviser (admin). Moderators build practice content only. */
export function requireHost(req, res, next) {
  if (req.user?.role === "admin") return next();
  if (req.accepts("html")) return res.status(403).render("error", { code: 403, title: "Adviser only", message: "Live tests are hosted by the adviser. Ask them if you need a session for your subject." });
  return res.status(403).json({ error: "Only the adviser can host live tests." });
}

/** API-level guard: can this user edit content in this subject? */
export function canEditSubject(user, subjectId) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "moderator") return user.isModeratorOf(subjectId);
  return false;
}
