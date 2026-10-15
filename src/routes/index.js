// src/routes/index.js
import { Router } from "express";
import mongoose from "mongoose";
import { attachUser, requireAuth, requireRole, requireStudent, requireModerator, requireAdmin } from "../middleware/auth.js";
import { authLimiter, reviewLimiter, submitLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  loginSchema, registerSchema, createFlashcardSchema, updateFlashcardSchema,
  createQuizSchema, updateQuizSchema, createQuizItemSchema, promoteSchema,
  settingsSchema, startSessionSchema, advanceItemSchema, flashcardReviewSchema,
  profileUpdateSchema, passwordChangeSchema,
  // v3-P1-3: graded review schema. v3-P2-6: password-reset schemas.
  reviewGradedSchema, forgotPasswordSchema, resetPasswordSchema,
} from "../validations/index.js";

import * as auth from "../controllers/authController.js";
import * as notes from "../controllers/notesController.js";
import * as quizzes from "../controllers/quizzesController.js";
import * as flashcards from "../controllers/flashcardsController.js";
import * as admin from "../controllers/adminController.js";
import * as profile from "../controllers/profileController.js";
import * as uploads from "../controllers/uploadsController.js"; // v3-P2-1
import { leaderboard, classmates } from "../controllers/pagesController.js";

const router = Router();

// v3-P3-6: Healthcheck endpoint — must be BEFORE attachUser so it doesn't
// require auth (or trigger a session lookup). Deploy platforms (Render, Railway)
// hit this URL to verify the app is alive + DB is connected.
router.get("/api/health", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const dbStatus = dbState === 1 ? "connected" : "disconnected";
    const ok = dbState === 1;
    res.status(ok ? 200 : 503).json({
      ok,
      db: dbStatus,
      uptime: Math.round(process.uptime()),
      env: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

router.use(attachUser);

// ===== Landing & About =====
router.get("/", (req, res) => res.render("landing", { title: "DNHS STEM Tesla Hub" }));
router.get("/about", (req, res) => res.render("about", { title: "About" }));

// ===== Auth (username + bcrypt — register or login) =====
router.get("/login", auth.showLogin);
router.post("/login", authLimiter, validate(loginSchema), auth.login);
router.get("/register", auth.showRegister);
router.post("/register", authLimiter, validate(registerSchema), auth.register);
router.post("/logout", auth.logout);

// v3-P2-6: Password reset.
router.get("/forgot-password", auth.showForgotPassword);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), auth.requestPasswordReset);
router.get("/reset-password", auth.showResetPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), auth.performPasswordReset);

// ===== Public profile (anyone can view anyone's profile) =====
router.get("/profile/:id", requireAuth, profile.showPublic);

// ===== Classmates & Leaderboard (all logged-in users) =====
router.get("/classmates", requireAuth, classmates);
router.get("/leaderboard", requireAuth, leaderboard);

// ===== Notes (all logged-in users can read) =====
router.get("/notes", requireAuth, notes.listNotes);
router.get("/notes/:slug", requireAuth, notes.showUnit);

// ===== Notes editor (moderator + administrator) =====
router.get("/moderator/notes", requireAuth, requireModerator, notes.editor);
router.post("/api/notes/units", requireAuth, requireModerator, notes.createUnitPost);
router.patch("/api/notes/units/:id", requireAuth, requireModerator, notes.updateUnitPost);
router.delete("/api/notes/units/:id", requireAuth, requireModerator, notes.deleteUnitPost);
router.post("/api/notes/units/:unitId/parts", requireAuth, requireModerator, notes.createPartPost);
router.patch("/api/notes/parts/:id", requireAuth, requireModerator, notes.updatePartPost);
router.delete("/api/notes/parts/:id", requireAuth, requireModerator, notes.deletePartPost);
router.put("/api/notes/parts/:partId/blocks", requireAuth, requireModerator, notes.saveBlocksPost);

// ===== Practice quizzes (student + moderator + administrator) =====
router.get("/practice", requireAuth, requireStudent, quizzes.listPractice);
router.get("/practice/:id", requireAuth, requireStudent, quizzes.takePractice);
router.post("/practice/:id/submit", requireAuth, requireStudent, submitLimiter, quizzes.submitPractice);

// ===== Practice quiz editor (moderator + administrator) =====
router.get("/moderator/practice", requireAuth, requireModerator, quizzes.editor);
router.post("/api/quizzes", requireAuth, requireModerator, validate(createQuizSchema), quizzes.createQuizPost);
router.patch("/api/quizzes/:id", requireAuth, requireModerator, validate(updateQuizSchema), quizzes.updateQuizPost);
router.delete("/api/quizzes/:id", requireAuth, requireModerator, quizzes.deleteQuizPost);
router.post("/api/quizzes/:quizId/items", requireAuth, requireModerator, validate(createQuizItemSchema), quizzes.createItemPost);
router.patch("/api/quizzes/items/:id", requireAuth, requireModerator, quizzes.updateItemPost);
router.delete("/api/quizzes/items/:id", requireAuth, requireModerator, quizzes.deleteItemPost);

// ===== Flashcards =====
router.get("/flashcards", requireAuth, requireStudent, flashcards.list);
router.post("/flashcards/review", requireAuth, requireStudent, reviewLimiter, validate(flashcardReviewSchema), flashcards.review);

// v3-P1-3: SRS study session.
router.get("/flashcards/study", requireAuth, requireStudent, flashcards.studySession);
router.get("/api/flashcards/study/next", requireAuth, requireStudent, flashcards.nextStudyCard);
router.post(
  "/api/flashcards/review-graded",
  requireAuth,
  requireStudent,
  reviewLimiter,
  validate(reviewGradedSchema),
  flashcards.reviewGraded
);

router.get("/moderator/flashcards", requireAuth, requireModerator, flashcards.editor);
router.post("/api/flashcards", requireAuth, requireModerator, validate(createFlashcardSchema), flashcards.createPost);
router.patch("/api/flashcards/:id", requireAuth, requireModerator, validate(updateFlashcardSchema), flashcards.updatePost);
router.delete("/api/flashcards/:id", requireAuth, requireModerator, flashcards.deletePost);

// ===== Profile (own + edit) =====
router.get("/profile", requireAuth, profile.show);
// v3-P0-2: Wire validate() on profile + password routes.
router.post("/api/profile", requireAuth, validate(profileUpdateSchema), profile.update);
router.post("/api/profile/password", requireAuth, validate(passwordChangeSchema), profile.changePassword);

// v3-P2-1: Auth-gated uploads — only logged-in users can fetch profile pictures.
router.get("/uploads/:filename", requireAuth, uploads.serveUpload);

// ===== Admin (administrator only) =====
router.get("/admin", requireAuth, requireAdmin, admin.dashboard);
router.get("/admin/live-monitor", requireAuth, requireAdmin, admin.liveMonitor);
router.get("/admin/live-history", requireAuth, requireAdmin, admin.liveHistory);
router.get("/admin/host-live", requireAuth, requireAdmin, admin.hostLive);
router.get("/admin/live-editor", requireAuth, requireAdmin, admin.liveQuizEditor);
router.get("/admin/settings", requireAuth, requireAdmin, admin.settings);
router.post("/api/admin/start-session", requireAuth, requireAdmin, validate(startSessionSchema), admin.startSession);
router.post("/api/admin/advance-item/:sessionId", requireAuth, requireAdmin, validate(advanceItemSchema), admin.advanceItem);
router.post("/api/admin/end-session/:sessionId", requireAuth, requireAdmin, admin.endSession);
router.post("/api/admin/settings", requireAuth, requireAdmin, validate(settingsSchema), admin.updateSettings);
router.post("/api/admin/promote", requireAuth, requireAdmin, validate(promoteSchema), admin.promote);
// v3-P2-9: CSV export of live-test results.
router.get("/api/admin/sessions/:sessionId/export", requireAuth, requireAdmin, admin.exportSessionCsv);

// ===== Live test take (student) =====
router.get("/live-test", requireAuth, requireStudent, (req, res) => {
  res.render("live-test/take", { title: "Live Test" });
});

// v3-P2-3: Public-ish endpoint for the take page to check fullscreen requirement.
// (requireAuth so a stranger can't probe it, but no role restriction — it just
// returns the settings that the live-test take page already needs.)
router.get("/api/live-test/settings", requireAuth, requireStudent, async (req, res) => {
  try {
    const { Settings } = await import("../models/index.js");
    const settings = await Settings.getSingleton();
    res.json({
      requireFullscreen: settings?.antiCheat?.requireFullscreen ?? false,
      maxWarnings: settings?.antiCheat?.maxWarnings ?? 3,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API endpoint for the live-test taking page (fetches current item)
router.get("/api/live-test/current", requireAuth, requireStudent, async (req, res) => {
  try {
    const { getActiveLiveSession } = await import("../services/quizzes.js");
    const session = await getActiveLiveSession();
    if (!session) return res.json({ session: null });
    // Strip correct_answer / is_correct from items before sending to student
    const safeItems = (session.quizzes.items || []).map((it) => ({
      id: it.id,
      type: it.type,
      question: it.question,
      image_url: it.imageUrl,
      points: it.points,
      options: it.options ? it.options.map((o) => ({ id: o.id, text: o.text, image_url: o.imageUrl })) : null,
    }));
    res.json({
      session: {
        id: session.id,
        status: session.status,
        current_item_index: session.currentItemIndex,
        quiz: { id: session.quizzes.id, title: session.quizzes.title, items: safeItems },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
