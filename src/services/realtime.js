// src/services/realtime.js
// Socket.IO server — handles live test broadcasting & admin monitoring.
// P0-1: Server-side scoring (never trust client score).
// P0-2: Role-check admin socket events.
// P0-3: Session-based auth (reads express-session cookie, never trusts client userId).
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import MongoStore from "connect-mongo";
import { LiveSession, LiveParticipant, User, ActivityFeed, Settings, Quiz, QuizItem, QuizOption } from "../models/index.js";
import { gradeAttempt } from "./quizzes.js";
import { logActivity } from "./leaderboard.js";
import { config } from "../config/env.js";

// Reuse the same MongoDB-backed session store that Express uses.
// This reads the SAME sessions collection — no new persistence layer.
const sessionStore = MongoStore.create({
  mongoUrl: config.mongodb.uri,
  dbName: config.mongodb.dbName,
  collectionName: "sessions",
  ttl: 7 * 24 * 60 * 60,
});

const parseCookie = cookieParser(config.sessionSecret, { decode: (v) => v });

export function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.publicUrl, methods: ["GET", "POST"], credentials: true },
    path: "/socket.io",
  });

  let activeSessionId = null;

  // ===== P0-3: Session-based auth =====
  // Read the express-session cookie, look up the session in MongoStore,
  // extract userId + role. NEVER trust a client-supplied userId.
  io.use((socket, next) => {
    const handshake = socket.handshake;
    if (!handshake.headers.cookie) return next(new Error("unauthorized"));
    // Mock a request object for cookie-parser.
    const mockReq = { headers: handshake.headers };
    parseCookie(mockReq, {}, () => {
      const sid = mockReq.cookies && mockReq.cookies["connect.sid"];
      if (!sid) return next(new Error("unauthorized"));
      sessionStore.get(sid, (err, session) => {
        if (err) return next(err);
        if (!session || !session.userId) return next(new Error("unauthorized"));
        socket.data.userId = session.userId.toString();
        // Defer role lookup to the connection handler (async).
        next();
      });
    });
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;

    // Look up the user's role ONCE at connection time. Stash on socket.data.
    try {
      const user = await User.findById(userId).select("role name").lean();
      if (!user) return socket.disconnect(true);
      socket.data.role = user.role;
      socket.data.userName = user.name;
    } catch (err) {
      console.error("[socket auth] role lookup failed:", err.message);
      return socket.disconnect(true);
    }

    // ===== P0-2: Role guards =====
    const requireAdmin = () => socket.data.role === "administrator";
    const requireStudentOrAbove = () =>
      socket.data.role === "student" || socket.data.role === "moderator" || socket.data.role === "administrator";

    socket.on("live:join", async ({ sessionId }) => {
      if (!sessionId || !requireStudentOrAbove()) return;
      const profile = await User.findById(userId).select("name avatarColor avatarUrl").lean();
      if (!profile) return socket.emit("live:error", { message: "User not found" });

      await LiveParticipant.findOneAndUpdate(
        { sessionId, userId },
        { sessionId, userId, status: "answering", lastActivity: new Date() },
        { upsert: true, new: true }
      );

      socket.join(`session:${sessionId}`);
      activeSessionId = sessionId;
      io.to(`session:${sessionId}`).emit("live:participant_joined", { profile });
      io.to(`admin:live`).emit("live:participant_joined", { profile, sessionId });

      // v3-P2-8: Late-joiners / reconnectors get the current item immediately.
      // We re-fetch the session to get its currentItemIndex, then emit live:item_changed
      // so the joining client renders the right question (not item 0).
      const session = await LiveSession.findById(sessionId).lean();
      if (session && session.status === "active") {
        socket.emit("live:item_changed", { itemIndex: session.currentItemIndex });
      }
    });

    socket.on("admin:subscribe_live", () => {
      if (!requireAdmin()) {
        return socket.emit("live:error", { message: "Forbidden: admin role required" });
      }
      socket.join("admin:live");
      if (activeSessionId) {
        socket.emit("live:current_session", { sessionId: activeSessionId });
      }
    });

    socket.on("admin:start_session", async ({ sessionId }) => {
      if (!requireAdmin()) {
        return socket.emit("live:error", { message: "Forbidden: admin role required" });
      }
      activeSessionId = sessionId;
      io.to(`session:${sessionId}`).emit("live:started", { sessionId });
      io.to("admin:live").emit("live:started", { sessionId });
      // v2-P1-5: Audit log of socket-level admin actions.
      await logActivity(socket.data.userId, socket.data.userName, "admin_action", `Started live session ${sessionId} (socket)`);
    });

    socket.on("admin:advance_item", async ({ sessionId, itemIndex }) => {
      if (!requireAdmin()) {
        return socket.emit("live:error", { message: "Forbidden: admin role required" });
      }
      // v3-P2-8: Persist the current item index so late-joiners see the right item.
      // (Previously the session's currentItemIndex was only updated when the admin
      // used the HTTP /api/admin/advance-item endpoint — socket-based advances
      // left the DB stale, so late-joiners saw item 0 even after the admin had
      // advanced several items.)
      try {
        await LiveSession.findByIdAndUpdate(sessionId, { currentItemIndex: itemIndex });
      } catch (err) {
        console.error("[admin:advance_item] failed to persist currentItemIndex:", err.message);
      }
      io.to(`session:${sessionId}`).emit("live:item_changed", { itemIndex });
      io.to("admin:live").emit("live:item_changed", { sessionId, itemIndex });
    });

    socket.on("admin:end_session", async ({ sessionId }) => {
      if (!requireAdmin()) {
        return socket.emit("live:error", { message: "Forbidden: admin role required" });
      }
      io.to(`session:${sessionId}`).emit("live:ended", { sessionId });
      io.to("admin:live").emit("live:ended", { sessionId });
      if (activeSessionId === sessionId) activeSessionId = null;
      // v2-P1-5: Audit log.
      await logActivity(socket.data.userId, socket.data.userName, "admin_action", `Ended live session ${sessionId} (socket)`);
    });

    // ===== P0-1: Server-side scoring =====
    // Client sends only { sessionId, itemId, answer } — never score.
    // Server loads the item fresh, calls gradeAttempt, stores the result.
    socket.on("live:submit", async ({ sessionId, itemId, answer }) => {
      if (!sessionId || !itemId) return;
      if (!requireStudentOrAbove()) {
        return socket.emit("live:error", { message: "Forbidden" });
      }

      const session = await LiveSession.findById(sessionId).lean();
      if (!session || session.status !== "active") {
        return socket.emit("live:error", { message: "Session not active" });
      }

      // Load the item fresh — DO NOT trust the client about which item is current.
      const item = await QuizItem.findById(itemId).lean();
      if (!item || item.quizId.toString() !== session.quizId.toString()) {
        return socket.emit("live:error", { message: "Item not found" });
      }

      // Hydrate options + correct_answer in the shape gradeAttempt expects.
      let itemForGrading = {
        ...item,
        id: item._id.toString(),
        image_url: item.imageUrl,
        correct_answer: item.correctAnswer,
      };
      if (item.type === "multiple_choice" || item.type === "true_false") {
        const opts = await QuizOption.find({ itemId: item._id }).sort({ sortOrder: 1 }).lean();
        itemForGrading.options = opts.map((o) => ({
          ...o,
          id: o._id.toString(),
          is_correct: o.isCorrect,
          image_url: o.imageUrl,
        }));
      }

      // Compute score server-side using the existing grading function.
      const { score } = gradeAttempt([itemForGrading], { [itemForGrading.id]: answer });

      const existing = await LiveParticipant.findOne({ sessionId, userId });
      if (!existing) {
        return socket.emit("live:error", { message: "Not joined. Re-join the session." });
      }
      if (existing.status === "submitted") {
        return socket.emit("live:error", { message: "Already submitted." });
      }

      existing.score = (existing.score || 0) + score;
      existing.lastActivity = new Date();
      await existing.save();

      io.to("admin:live").emit("live:submission", {
        sessionId, userId, itemId, score, total: item.points || 1,
      });
      socket.emit("live:submission_ack", { itemId, score });
    });

    socket.on("live:anti_cheat_warning", async ({ sessionId, reason }) => {
      if (!sessionId || !requireStudentOrAbove()) return;
      const existing = await LiveParticipant.findOne({ sessionId, userId });
      if (existing) {
        existing.warnings = (existing.warnings || 0) + 1;
        const settings = await Settings.getSingleton();
        const max = settings?.antiCheat?.maxWarnings ?? 3;

        if (existing.warnings >= max) {
          // Auto-submit (matches README wording after P3-7 update).
          existing.status = "submitted";
          await existing.save();
          socket.emit("live:auto_submitted", { reason: "Max anti-cheat warnings reached. Your test has been auto-submitted." });
          io.to("admin:live").emit("live:warning", { sessionId, userId, warnings: existing.warnings, reason: "Auto-submitted (max warnings)" });
        } else {
          await existing.save();
          socket.emit("live:warning", { warnings: existing.warnings, max, reason });
          io.to("admin:live").emit("live:warning", { sessionId, userId, warnings: existing.warnings, reason });
        }
      }
    });

    socket.on("activity:ping", async ({ kind, detail }) => {
      const profile = await User.findById(userId).select("name").lean();
      if (!profile) return;
      const allowed = ["login", "view_note", "practice_quiz", "flashcard", "live_quiz", "submit", "warning", "logout"];
      if (!allowed.includes(kind)) return;
      await ActivityFeed.create({
        userId,
        userName: profile.name,
        kind,
        detail: detail || "",
      });
      io.to("admin:live").emit("activity:event", {
        userId,
        userName: profile.name,
        kind,
        detail: detail || "",
        ts: Date.now(),
      });
    });
  });

  return io;
}

export default attachRealtime;
