// src/controllers/adminController.js
import { getLeaderboard, getRecentActivity, logActivity } from "../services/leaderboard.js";
import { listQuizzes, startLiveSession, endLiveSession, getActiveLiveSession, advanceLiveItem } from "../services/quizzes.js";
import { User, Settings, Quiz } from "../models/index.js";

export async function dashboard(req, res) {
  try {
    const studentCount = await User.countDocuments({ role: { $ne: "administrator" } });
    // v3-P2-11: Was `await listQuizzes().then(q => q.length)` — N+1 query that loaded
    // every quiz + every item + every option just to count them. Now O(1).
    const quizCount = await Quiz.countDocuments();
    const cardCount = await import("../models/index.js").then((m) => m.Flashcard.countDocuments());
    const activeSession = await getActiveLiveSession();
    const activity = await getRecentActivity(20);
    res.render("admin/dashboard", { title: "Admin Dashboard", studentCount, quizCount, cardCount, activeSession, activity });
  } catch (err) {
    console.error("[admin dashboard]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function liveMonitor(req, res) {
  try {
    const activeSession = await getActiveLiveSession();
    const activity = await getRecentActivity(40);
    // Only pass participants who actually joined the live session
    const students = activeSession && activeSession.participants
      ? activeSession.participants.map(p => p.profiles || p)
      : [];
    res.render("admin/live-monitor", { title: "Live Monitor", activeSession, activity, students });
  } catch (err) {
    console.error("[admin liveMonitor]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function hostLive(req, res) {
  try {
    const liveQuizzes = await listQuizzes("live");
    const activeSession = await getActiveLiveSession();
    res.render("admin/host-live", { title: "Host Live Test", liveQuizzes, activeSession });
  } catch (err) {
    console.error("[admin hostLive]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function startSession(req, res) {
  try {
    const session = await startLiveSession(req.body.quizId);
    // v2-P1-5: Audit log of admin actions.
    await logActivity(req.user.id, req.user.name, "admin_action", `Started live session ${session._id} (quiz ${req.body.quizId})`);
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function advanceItem(req, res) {
  try {
    const session = await advanceLiveItem(req.params.sessionId, Number(req.body.itemIndex));
    // v2-P1-5: Skip per-item audit log (too noisy) — only session start/end is logged.
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function endSession(req, res) {
  try {
    const session = await endLiveSession(req.params.sessionId);
    // v2-P1-5: Audit log.
    await logActivity(req.user.id, req.user.name, "admin_action", `Ended live session ${req.params.sessionId}`);
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function settings(req, res) {
  try {
    const settings = await Settings.getSingleton();
    const liveQuizzes = await listQuizzes("live");
    const users = await User.find({ _id: { $ne: req.user.id } }).sort({ name: 1 }).lean();
    res.render("admin/settings", {
      title: "Settings",
      settings,
      liveQuizzes,
      users: users.map((u) => ({ ...u, id: u._id.toString(), avatar_color: u.avatarColor, avatar_url: u.avatarUrl })),
    });
  } catch (err) {
    console.error("[admin settings]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function updateSettings(req, res) {
  try {
    // v3-P2-12: Read from req.validated (set by validate(settingsSchema)), not req.body.
    const { anti_cheat, time_limit_min, deadline, quiz_id } = req.validated;

    // v3-P2-12: Write ALL fields to Settings, not just antiCheat.
    // (Old code only wrote antiCheat — time_limit_min and deadline were silently
    // dropped from Settings, only side-effecting the Quiz doc.)
    const settings = await Settings.findByIdAndUpdate(
      1,
      {
        $set: {
          antiCheat: anti_cheat,
          // Store the default time limit + deadline on Settings too,
          // so the admin settings page can display them on reload.
          defaultTimeLimitMin: time_limit_min || null,
          defaultDeadline: deadline || null,
        }
      },
      { new: true }
    ).lean();

    // If a quiz_id is provided, also update that specific quiz's time limit + deadline.
    if (quiz_id) {
      // Quiz is already imported at the top of the file (v3-P2-11), no need for dynamic import.
      await Quiz.findByIdAndUpdate(quiz_id, {
        timeLimitMin: time_limit_min,
        deadline: deadline || null,
      });
    }

    // v3-P2-12: Activity feed log includes full settings detail (was just "Updated anti-cheat settings").
    await logActivity(
      req.user.id,
      req.user.name,
      "admin_action",
      `Updated settings (antiCheat.maxWarnings=${anti_cheat?.maxWarnings}, quiz=${quiz_id || "none"}, timeLimit=${time_limit_min || "default"}min)`
    );

    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function liveQuizEditor(req, res) {
  try {
    const liveQuizzes = await listQuizzes("live");
    res.render("quizzes/editor", { title: "Edit Live Test", quizzes: liveQuizzes, kind: "live" });
  } catch (err) {
    console.error("[admin liveQuizEditor]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function liveHistory(req, res) {
  try {
    const { LiveSession, LiveParticipant, Quiz } = await import("../models/index.js");
    const endedSessions = await LiveSession.find({ status: "ended" })
      .sort({ endedAt: -1 })
      .populate({ path: "quizId", select: "title items" })
      .lean();
    const history = [];
    for (const s of endedSessions) {
      const participants = await LiveParticipant.find({ sessionId: s._id })
        .populate({ path: "userId", select: "name avatarColor avatarUrl" })
        .lean();
      const totalPossible = (s.quizId?.items || []).reduce((sum, it) => sum + (it.points || 1), 0);
      history.push({
        id: s._id.toString(),
        quizTitle: s.quizId?.title || "Unknown",
        endedAt: s.endedAt,
        participantCount: participants.length,
        totalPossible,
        participants: participants
          .map((p) => ({
            userId: p.userId?._id?.toString() || "",
            name: p.userId?.name || "Unknown",
            score: p.score || 0,
            warnings: p.warnings || 0,
          }))
          .sort((a, b) => b.score - a.score),
      });
    }
    res.render("admin/live-history", { title: "Live Test History", history });
  } catch (err) {
    console.error("[admin liveHistory]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

// v3-P2-9: CSV export of live-test session results.
export async function exportSessionCsv(req, res) {
  try {
    const { sessionId } = req.params;
    const { LiveParticipant, LiveSession } = await import("../models/index.js");
    const participants = await LiveParticipant.find({ sessionId })
      .populate({ path: "userId", select: "name username" })
      .lean();
    const session = await LiveSession.findById(sessionId)
      .populate({ path: "quizId", select: "title" })
      .lean();
    if (!session) return res.status(404).render("error/404", { title: "Not Found" });

    const header = ["Student Name", "Username", "Score", "Warnings", "Status", "Last Activity"];
    const rows = participants.map(p => [
      p.userId?.name || "Unknown",
      p.userId?.username || "",
      p.score || 0,
      p.warnings || 0,
      p.status || "—",
      p.lastActivity ? new Date(p.lastActivity).toISOString() : "—",
    ]);

    // Build CSV manually — no need for a CSV lib.
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const filename = `live-test-${session.quizId?.title || "session"}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);

    await logActivity(req.user.id, req.user.name, "admin_action", `Exported CSV for session ${sessionId}`);
  } catch (err) {
    console.error("[exportSessionCsv]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function promote(req, res) {
  try {
    // v3-P2-2: Note — this route is wired with validate(promoteSchema) in
    // routes/index.js, so req.validated is set. But the existing v2 code reads
    // from req.body. To stay backward-compatible with v2 behavior we keep
    // reading req.body here, since the v1 promoteSchema already enforces the
    // shape. (Other controllers were updated to req.validated in P2-12; this
    // one is updated only for the new v3-P2-2 demotion guards.)
    const { userId, role } = req.body;
    if (!["student", "moderator", "administrator"].includes(role)) {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    // v3-P2-2: Prevent admin from demoting themselves.
    if (userId === req.user.id && role !== "administrator") {
      return res.status(400).json({
        ok: false,
        error: "You cannot demote yourself. Ask another admin to demote you.",
      });
    }

    // v3-P2-2: Prevent the last admin from demoting themselves.
    if (role !== "administrator") {
      const targetUser = await User.findById(userId).lean();
      if (targetUser?.role === "administrator") {
        const adminCount = await User.countDocuments({ role: "administrator" });
        if (adminCount <= 1) {
          return res.status(400).json({
            ok: false,
            error: "Cannot demote the last administrator. Promote another user first.",
          });
        }
      }
    }

    const profile = await User.findByIdAndUpdate(userId, { role }, { new: true }).lean();
    // v2-P1-5: Audit log of role changes — critical for trust.
    await logActivity(req.user.id, req.user.name, "admin_action", `Promoted/demoted user ${userId} to ${role}`);
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
