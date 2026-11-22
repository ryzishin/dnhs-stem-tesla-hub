// src/services/realtime.js — Socket.IO engine for live tests.
//
// Security model (server-authoritative):
//   · The SERVER owns the item order, the current index, and grading.
//   · Students can only answer the item the host has opened, exactly once.
//   · A student's browser never learns the correct answers — not even on refresh.
//   · Anti-cheat: every leave event (tab switch, app switch, fullscreen exit,
//     logout) increments a counter. At the cap the student's test is AUTO-SUBMITTED
//     as-is — they keep their score but cannot answer anything else. They may ask
//     the adviser for a re-attempt; the adviser approves or declines per case.
import { Server } from "socket.io";
import { LiveSession, LiveParticipant, Quiz, User, Settings } from "../models/index.js";
import { gradeItem } from "./grading.js";

let io = null;
const advanceTimers = new Map(); // sessionId -> timeout handle

export function attachRealtime(httpServer) {
  io = new Server(httpServer, { path: "/socket.io" });

  io.use(async (socket, next) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) return next(new Error("unauthorized"));
    const user = await User.findById(userId).select("name role").lean();
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = { id: userId, name: user.name, role: user.role };
    next();
  });

  io.on("connection", onConnection);
  return io;
}

export function getIo() {
  return io;
}

const room = (id) => `live:${id}`;
const monitorRoom = (id) => `live:${id}:monitor`;

function safeItem(quiz, itemId) {
  const it = (quiz.items || []).find((i) => i.id === itemId);
  if (!it) return null;
  return {
    id: it.id, type: it.type, question: it.question, points: it.points,
    options: it.options ? it.options.map((o) => ({ id: o.id, text: o.text })) : undefined,
  };
}

function itemAt(session, quiz, index) {
  const id = session.itemOrder[index];
  return id ? safeItem(quiz, id) : null;
}

async function loadSessionBundle(sessionId) {
  const session = await LiveSession.findById(sessionId).populate("quiz", "title items mode timeLimitMin");
  return session;
}

function statePayload(session, quiz) {
  return {
    status: session.status,
    index: session.currentItemIndex,
    total: (session.itemOrder || []).length,
    item: session.status === "active" ? itemAt(session, quiz, session.currentItemIndex) : null,
    itemStartedAt: session.itemStartedAt || null,
    autoAdvanceSec: session.autoAdvanceSec || 0,
    quizTitle: quiz?.title || "",
    antiCheat: session.antiCheat || {},
    serverNow: Date.now(),
  };
}

async function broadcastState(sessionId) {
  const session = await LiveSession.findById(sessionId).lean();
  if (!session) return;
  const quiz = await Quiz.findById(session.quiz).select("title items");
  const payload = statePayload(session, quiz);
  io.to(room(sessionId)).emit("live:state", payload);
  io.to(monitorRoom(sessionId)).emit("live:state", payload);
}

async function standings(sessionId) {
  const session = await LiveSession.findById(sessionId).select("currentItemIndex itemOrder").lean();
  const currentId = session ? (session.itemOrder || [])[session.currentItemIndex] : null;
  const parts = await LiveParticipant.find({ session: sessionId })
    .select("name score answers warnings kicked autoSubmitted finished attemptNo retryStatus").lean();
  const hasAnswer = (p, itemId) => {
    if (!itemId || !p.answers) return false;
    return typeof p.answers.get === "function" ? p.answers.has(itemId) : !!p.answers[itemId];
  };
  return parts
    .map((p) => ({
      id: p._id.toString(), name: p.name, score: p.score,
      answered: p.answers ? (typeof p.answers.size === "number" ? p.answers.size : Object.keys(p.answers).length) : 0,
      warnings: p.warnings, kicked: p.kicked, autoSubmitted: !!p.autoSubmitted,
      finished: p.finished, attemptNo: p.attemptNo || 1, retryStatus: p.retryStatus || "none",
      answeredCurrent: hasAnswer(p, currentId),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

async function pushStandings(sessionId) {
  io.to(monitorRoom(sessionId)).emit("live:standings", { standings: await standings(sessionId) });
}

// ===== auto-advance (optional per quiz) =====
function clearTimer(sessionId) {
  const t = advanceTimers.get(sessionId);
  if (t) { clearTimeout(t); advanceTimers.delete(sessionId); }
}

function scheduleAdvance(sessionId) {
  clearTimer(sessionId);
  LiveSession.findById(sessionId).lean().then((session) => {
    if (!session || session.status !== "active" || !session.autoAdvanceSec) return;
    const t = setTimeout(() => autoAdvance(sessionId), session.autoAdvanceSec * 1000 + 400);
    advanceTimers.set(sessionId, t);
  });
}

async function autoAdvance(sessionId) {
  const session = await LiveSession.findById(sessionId);
  if (!session || session.status !== "active") return;
  const quiz = await Quiz.findById(session.quiz).select("items").lean();
  const total = (session.itemOrder || []).length;
  const next = session.currentItemIndex + 1;
  if (next >= total) return endSession(sessionId); // last item done → finish automatically
  session.currentItemIndex = next;
  session.itemStartedAt = new Date();
  await session.save();
  await broadcastState(sessionId);
  await pushStandings(sessionId);
  scheduleAdvance(sessionId);
}

// ===== exported host controls (called from HTTP routes) =====
export async function startSession(sessionId) {
  const session = await LiveSession.findById(sessionId).populate("quiz", "title items");
  if (!session || session.status === "ended") return;
  session.status = "active";
  session.currentItemIndex = 0;
  session.itemStartedAt = new Date();
  session.startedAt = session.startedAt || new Date();
  await session.save();
  await broadcastState(sessionId);
  await pushStandings(sessionId);
  scheduleAdvance(sessionId);
}

export async function gotoItem(sessionId, index) {
  const session = await LiveSession.findById(sessionId);
  if (!session || session.status !== "active") return;
  const total = (session.itemOrder || []).length;
  session.currentItemIndex = Math.max(0, Math.min(index, total - 1));
  session.itemStartedAt = new Date();
  await session.save();
  clearTimer(sessionId);
  await broadcastState(sessionId);
  scheduleAdvance(sessionId);
}

export async function nextItem(sessionId) {
  const session = await LiveSession.findById(sessionId).lean();
  if (!session) return;
  return gotoItem(sessionId, (session.currentItemIndex || 0) + 1);
}

export async function prevItem(sessionId) {
  const session = await LiveSession.findById(sessionId).lean();
  if (!session) return;
  return gotoItem(sessionId, Math.max(0, (session.currentItemIndex || 1) - 1));
}

export async function endSession(sessionId) {
  const session = await LiveSession.findById(sessionId);
  if (!session || session.status === "ended") return;
  session.status = "ended";
  session.endedAt = new Date();
  await session.save();
  clearTimer(sessionId);
  await LiveParticipant.updateMany({ session: sessionId }, { $set: { finished: true } });
  const board = await standings(sessionId);
  io.to(room(sessionId)).emit("live:ended", { standings: board });
  io.to(monitorRoom(sessionId)).emit("live:ended", { standings: board });
  await broadcastState(sessionId);
}

export async function removeParticipant(sessionId, userId) {
  // host's manual judgment: pull a disruptive student out of the session
  const p = await LiveParticipant.findOneAndUpdate(
    { session: sessionId, user: userId },
    { $set: { kicked: true } },
    { new: true }
  );
  if (!p) return;
  socketEmitToUser(sessionId, userId, "live:removed", {});
  io.to(monitorRoom(sessionId)).emit("live:removed", { userId: userId.toString(), name: p.name });
  await pushStandings(sessionId);
}

export async function currentStandings(sessionId) {
  return standings(sessionId);
}

// ===== anti-cheat core: one atomic warning pipeline shared by socket + HTTP =====
// One physical leave fires several browser events (blur + visibilitychange + pagehide,
// plus the logout hook). LEAVE_DEDUPE_MS folds that burst into a single count.
const LEAVE_DEDUPE_MS = 2000;

export async function applyWarning(sessionId, userId, reason) {
  const session = await LiveSession.findById(sessionId).lean();
  if (!session || session.status !== "active") return null;
  if (!session.antiCheat?.tabWarning) return null; // disabled by the adviser's settings
  const cap = session.antiCheat?.warningsCap || 3;

  // atomic increment so rapid warnings can't slip past the cap — but only when the
  // previous warning is older than the dedupe window (a burst = one action = one count)
  const cutoff = new Date(Date.now() - LEAVE_DEDUPE_MS);
  const participant = await LiveParticipant.findOneAndUpdate(
    {
      session: sessionId, user: userId, kicked: { $ne: true }, finished: { $ne: true },
      $expr: { $lt: [{ $ifNull: ["$lastWarnAt", null] }, cutoff] },
    },
    { $inc: { warnings: 1 }, $set: { lastWarnAt: new Date() } },
    { new: true }
  );

  if (!participant) {
    // either already finished/kicked, or the warning was deduped — surface current state without counting
    const p = await LiveParticipant.findOne({ session: sessionId, user: userId }).select("warnings finished kicked").lean();
    if (!p || p.finished || p.kicked) return null;
    return { warnings: p.warnings, cap, autoSubmitted: false, deduped: true };
  }

  const breached = participant.warnings >= cap;

  let autoSubmitted = false;
  if (breached) {
    participant.autoSubmitted = true;
    participant.finished = true;
    await participant.save();
    autoSubmitted = true;
  }

  io.to(monitorRoom(sessionId)).emit("live:warning", {
    userId: userId.toString(), name: participant.name, reason,
    warnings: participant.warnings, cap, autoSubmitted,
  });
  io.to(room(sessionId)).emit("live:warning", {
    targetUser: userId.toString(), warnings: participant.warnings, cap, autoSubmitted,
  });
  socketEmitToUser(sessionId, userId, "live:warning_ack", { warnings: participant.warnings, cap, autoSubmitted });

  if (autoSubmitted) {
    socketEmitToUser(sessionId, userId, "live:auto_submitted", { warnings: participant.warnings, cap });
    await pushStandings(sessionId);
  }
  return { warnings: participant.warnings, cap, autoSubmitted };
}

// sockets live in the session room; a targeted event goes through a small helper
// that asks every connected client whether it belongs to the user (the clients filter).
function socketEmitToUser(sessionId, userId, event, payload) {
  io.to(room(sessionId)).emit(event, { ...payload, targetUser: userId.toString() });
}

// a student signed out mid-test — count it as leaving the test window
export async function warnOnLogout(userId) {
  const session = await LiveSession.findOne({ status: "active" }).sort("-createdAt").lean();
  if (!session) return;
  const p = await LiveParticipant.exists({ session: session._id, user: userId, finished: { $ne: true }, kicked: { $ne: true } });
  if (!p) return;
  await applyWarning(session._id.toString(), userId.toString(), "Signed out during the test");
}

// ===== re-attempt requests (the adviser decides who gets another try) =====
export async function requestRetry(sessionId, userId, reason) {
  const session = await LiveSession.findById(sessionId).lean();
  if (!session) return { error: "That session no longer exists." };
  if (session.status === "ended") return { error: "The test already ended — talk to your adviser instead." };
  const p = await LiveParticipant.findOne({ session: sessionId, user: userId });
  if (!p) return { error: "Join the test first." };
  if (!p.finished) return { error: "You're still in the test." };
  if (p.retryStatus === "pending") return { ok: true, retryStatus: "pending" };
  p.retryStatus = "pending";
  p.retryReason = String(reason || "").slice(0, 200);
  await p.save();
  io.to(monitorRoom(sessionId)).emit("live:retry_request", {
    userId: userId.toString(), name: p.name, reason: p.retryReason,
    attemptNo: p.attemptNo, autoSubmitted: p.autoSubmitted,
  });
  await pushStandings(sessionId);
  return { ok: true, retryStatus: "pending" };
}

export async function decideRetry(sessionId, userId, decision) {
  const p = await LiveParticipant.findOne({ session: sessionId, user: userId });
  if (!p) return { error: "No participant found." };

  if (decision === "decline") {
    p.retryStatus = "declined";
    await p.save();
    socketEmitToUser(sessionId, userId, "live:retry_result", { approved: false, message: "Your adviser declined the re-attempt request. Talk to them after class." });
    io.to(monitorRoom(sessionId)).emit("live:retry_requests", { requests: await retryRequests(sessionId) });
    await pushStandings(sessionId);
    return { ok: true };
  }

  // approved → fresh attempt: clear answers/score/warnings, bump attempt number
  p.kicked = false;
  p.autoSubmitted = false;
  p.finished = false;
  p.score = 0;
  p.warnings = 0;
  p.lastWarnAt = null;
  p.answers = new Map();
  p.attemptNo = (p.attemptNo || 1) + 1;
  p.retryStatus = "none";
  p.retryReason = "";
  await p.save();
  socketEmitToUser(sessionId, userId, "live:retry_result", { approved: true, attemptNo: p.attemptNo });
  io.to(monitorRoom(sessionId)).emit("live:retry_requests", { requests: await retryRequests(sessionId) });
  await pushStandings(sessionId);
  await broadcastState(sessionId);
  return { ok: true, attemptNo: p.attemptNo };
}

// pending retry requests for the host monitor
export async function retryRequests(sessionId) {
  const parts = await LiveParticipant.find({ session: sessionId, retryStatus: "pending" })
    .select("name user retryReason attemptNo autoSubmitted warnings").lean();
  return parts.map((p) => ({
    userId: p.user.toString(), name: p.name, reason: p.retryReason,
    attemptNo: p.attemptNo || 1, warnings: p.warnings,
  }));
}

// ===== student socket handlers =====
function onConnection(socket) {
  const user = socket.data.user;

  socket.on("live:join", async ({ sessionId } = {}) => {
    if (!sessionId) return;
    const session = await LiveSession.findById(sessionId).populate("quiz", "title items timeLimitMin");
    if (!session) return socket.emit("live:error", { message: "That live test no longer exists." });

    let participant = await LiveParticipant.findOne({ session: sessionId, user: user.id });
    if (participant?.kicked) {
      // manually removed by the host — only a granted re-attempt lets them back in
      return socket.emit("live:removed", { userId: user.id });
    }
    if (!participant) {
      participant = await LiveParticipant.create({ session: sessionId, user: user.id, name: user.name });
    }

    socket.join(room(sessionId));
    socket.data.sessionId = sessionId;

    const myAnswers = {};
    if (participant.answers) for (const [k, v] of participant.answers.entries()) myAnswers[k] = { correct: v.correct, points: v.points };
    socket.emit("live:state", {
      ...statePayload(session, session.quiz),
      me: {
        name: participant.name, score: participant.score,
        finished: participant.finished, autoSubmitted: participant.autoSubmitted,
        attemptNo: participant.attemptNo || 1, retryStatus: participant.retryStatus || "none",
        warnings: participant.warnings,
      },
      myAnswers,
    });
    await pushStandings(sessionId);
  });

  socket.on("live:monitor", async ({ sessionId } = {}) => {
    if (!sessionId) return;
    const session = await LiveSession.findById(sessionId).lean();
    if (!session) return;    // only the host (or an admin) may sit in the monitor room
    if (!(session.host.toString() === user.id || user.role === "admin")) return;
    socket.join(monitorRoom(sessionId));
    socket.emit("live:standings", { standings: await standings(sessionId) });
    socket.emit("live:retry_requests", { requests: await retryRequests(sessionId) });
    const bundle = await loadSessionBundle(sessionId);
    socket.emit("live:state", statePayload(bundle, bundle.quiz));
  });

  socket.on("live:answer", async ({ sessionId, itemId, answer } = {}) => {
    if (!sessionId || !itemId) return;
    const session = await LiveSession.findById(sessionId).populate("quiz", "items");
    if (!session || session.status !== "active") return;
    const currentId = session.itemOrder[session.currentItemIndex];
    if (itemId !== currentId) return; // only the open item can be answered

    const participant = await LiveParticipant.findOne({ session: sessionId, user: user.id });
    if (!participant || participant.kicked || participant.finished || participant.autoSubmitted) return;
    if (participant.answers?.has(itemId)) return; // one attempt per item

    const item = (session.quiz.items || []).find((i) => i.id === itemId);
    if (!item) return;

    const correct = gradeItem(item, answer);
    const points = correct ? item.points : 0;
    const given = String(answer ?? "");

    participant.answers = participant.answers || new Map();
    participant.answers.set(itemId, { answer: given, correct, points });
    participant.score += points;
    await participant.save();

    socket.emit("live:answer_ack", { itemId, correct, points });
    io.to(monitorRoom(sessionId)).emit("live:progress", {
      userId: user.id, name: participant.name, itemId, correct, score: participant.score,
    });
    await pushStandings(sessionId);
  });

  // the student's client reports leaving: tab switch, app switch, fullscreen exit…
  socket.on("live:warning", async ({ sessionId, reason } = {}) => {
    if (!sessionId) return;
    await applyWarning(String(sessionId), user.id, String(reason || "left the test").slice(0, 120));
  });

  // student asks the adviser for another attempt (auto-submitted or finished early)
  socket.on("live:retry_request", async ({ sessionId, reason } = {}) => {
    if (!sessionId) return;
    const result = await requestRetry(String(sessionId), user.id, String(reason || "").slice(0, 200));
    if (result.error) return socket.emit("live:error", { message: result.error });
    socketEmitToUser(String(sessionId), user.id, "live:retry_status", { retryStatus: "pending" });
  });
}
