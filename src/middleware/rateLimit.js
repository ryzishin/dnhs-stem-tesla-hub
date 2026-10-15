// src/middleware/rateLimit.js
// P1-2: Rate limiting on auth and review endpoints.
// Blocks credential stuffing on /login + /register, blocks points farming on /flashcards/review,
// blocks quiz-submit spam on /practice/:id/submit.
import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many attempts. Try again in 15 minutes." },
});

export const reviewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 review POSTs per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many reviews. Slow down." },
});

export const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 quiz submissions per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many submissions. Slow down." },
});

export default { authLimiter, reviewLimiter, submitLimiter };
