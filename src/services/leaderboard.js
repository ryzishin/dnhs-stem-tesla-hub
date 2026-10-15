// src/services/leaderboard.js
import { User, ActivityFeed } from "../models/index.js";

export async function awardPoints(userId, points) {
  if (!points || points <= 0) return;
  const user = await User.findById(userId);
  if (!user) return;
  user.points = (user.points || 0) + points;
  user.weeklyPoints = (user.weeklyPoints || 0) + points;
  await user.save();
}

export async function bumpStreak(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const user = await User.findById(userId);
  if (!user) return;
  if (user.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = user.lastActiveDate === yesterday ? (user.streakDays || 0) + 1 : 1;
  user.streakDays = newStreak;
  user.lastActiveDate = today;
  await user.save();
}

export async function getLeaderboard(scope = "weekly") {
  const sortField = scope === "alltime" ? "points" : "weeklyPoints";
  const users = await User.find({ role: { $ne: "administrator" } })
    .sort({ [sortField]: -1 })
    .limit(50)
    .select("name avatarColor avatarUrl points weeklyPoints streakDays")
    .lean();
  return users.map((u, i) => ({ ...u, rank: i + 1, id: u._id.toString() }));
}

export async function logActivity(userId, userName, kind, detail) {
  await ActivityFeed.create({
    userId: userId || null,
    userName: userName || "",
    kind,
    detail: detail || "",
  });
}

export async function getRecentActivity(limit = 30) {
  const items = await ActivityFeed.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return items.map((i) => ({ ...i, id: i._id.toString(), created_at: i.createdAt }));
}
