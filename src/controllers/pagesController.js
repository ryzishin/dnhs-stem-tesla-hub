// src/controllers/pagesController.js
import { getLeaderboard } from "../services/leaderboard.js";
import { User } from "../models/index.js";

export async function leaderboard(req, res) {
  try {
    const weekly = await getLeaderboard("weekly");
    const alltime = await getLeaderboard("alltime");
    res.render("leaderboard", { title: "Leaderboard", weekly, alltime });
  } catch (err) {
    console.error("[pages leaderboard]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

export async function classmates(req, res) {
  try {
    const students = await User.find({ role: { $ne: "administrator" } }).sort({ name: 1 }).lean();
    const adviser = await User.findOne({ role: "administrator" }).lean();
    res.render("classmates", {
      title: "Classmates",
      students: students.map((u) => ({ ...u, id: u._id.toString(), avatar_color: u.avatarColor, avatar_url: u.avatarUrl })),
      adviser: adviser ? { ...adviser, id: adviser._id.toString(), avatar_color: adviser.avatarColor, avatar_url: adviser.avatarUrl } : null,
    });
  } catch (err) {
    console.error("[pages classmates]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}
