// scripts/sim-student.mjs — drive N fake students through the open live session (visual test aid).
//   node scripts/sim-student.mjs <sessionId> [names...]
import "dotenv/config";
import mongoose from "mongoose";
import { io } from "socket.io-client";
import { User, LiveSession } from "../src/models/index.js";

const [sessionId, ...names] = process.argv.slice(2);
if (!sessionId) { console.error("usage: node scripts/sim-student.mjs <sessionId> [names...]"); process.exit(1); }
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });

const users = [];
for (const name of names) {
  const uname = name.toLowerCase().replace(/\s+/g, "");
  let u = await User.findOne({ username: uname });
  if (!u) {
    // create through the app so sessions/points behave like real signups
    const res = await fetch("http://localhost:3000/register", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name, username: uname, password: "secret123", confirm: "secret123" }),
      redirect: "manual",
    });
    u = await User.findOne({ username: uname });
    console.log(`[sim] registered ${name}`, res.status);
  }
  users.push(u);
}

const session = await LiveSession.findById(sessionId);
if (!session) { console.error("no such session"); process.exit(1); }
const { Quiz } = await import("../src/models/index.js");
const quiz = await Quiz.findById(session.quiz);

const sockets = await Promise.all(users.map((u) => new Promise((resolve) => {
  const s = io("http://localhost:3000", { auth: { userId: u._id.toString() } });
  s.on("connect", () => resolve(s));
})));

await Promise.all(sockets.map((s) => new Promise((r) => { s.emit("live:join", { sessionId }); setTimeout(r, 700); })));
console.log("[sim] all joined, waiting for host to open item 1…");

let opened = 0;
sockets.forEach((s, i) => s.on("live:state", (st) => {
  if (st.status === "active" && st.item && st.index >= opened) {
    opened = st.index + 1;
    // answer after a small delay; last student is the "cheater" and never answers
    if (i === sockets.length - 1) return;
    setTimeout(() => {
      const correct = (quiz.items.find((it) => it.id === st.item.id) || {});
      const ans = correct.type === "mcq" ? (correct.options || [])[0]?.id : (correct.answer || "x");
      s.emit("live:answer", { sessionId, itemId: st.item.id, answer: ans });
    }, 400 + Math.random() * 900);
  }
}));
sockets[sockets.length - 1].on("live:state", (st) => {
  if (st.status === "active" && st.item) {
    // the cheater tab-switches twice to show warnings in the feed
    if (!sockets[sockets.length - 1]._warned) {
      sockets[sockets.length - 1]._warned = 0;
    }
    if (sockets[sockets.length - 1]._warned < 2 && st.index === 1) {
      sockets[sockets.length - 1]._warned++;
      setTimeout(() => sockets[sockets.length - 1].emit("live:warning", { sessionId, reason: "Left the tab (simulated)" }), 300);
    }
  }
});

process.on("SIGINT", async () => {
  sockets.forEach((s) => s.close());
  await mongoose.disconnect();
  process.exit(0);
});
setInterval(() => {}, 10000);
