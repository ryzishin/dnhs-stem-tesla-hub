// src/services/points.js — the single place points, streaks, and weekly resets are handled.
// Rules: practice quizzes and flashcards earn points; live tests never do.
import { User, Settings } from "../models/index.js";

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function mondayISO(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Mon = 1 ... Sun = 7
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

/** Keeps weeklyPoints fresh and the daily streak honest. Returns the updated user (+ bonus earned today). */
export async function touchUser(user) {
  const today = isoDate();
  const week = mondayISO();

  const set = {};
  const inc = {};
  let bonus = 0;

  if (user.lastActiveDate !== today) {
    const yesterday = isoDate(new Date(Date.now() - 86400000));
    set.lastActiveDate = today;
    set.streakDays = user.lastActiveDate === yesterday ? user.streakDays + 1 : 1;
    const settings = await Settings.get();
    bonus = settings.points.streakBonus;
    inc.points = bonus;
  }

  if (user.weekStart !== week) {
    // week rolled over: reset the weekly score (streak bonus, if any, seeds the new week)
    set.weekStart = week;
    set.weeklyPoints = bonus;
  } else if (bonus) {
    inc.weeklyPoints = bonus;
  }

  const fresh = await User.findByIdAndUpdate(user._id, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(inc).length ? { $inc: inc } : {}) }, { new: true });
  return { user: fresh, streakBonus: bonus };
}

export async function awardPractice(user, score) {
  const settings = await Settings.get();
  const pts = settings.points.quizBase + Math.max(0, score);
  const { user: touched } = await touchUser(user);
  const fresh = await User.findByIdAndUpdate(
    touched._id,
    { $inc: { points: pts, weeklyPoints: pts, practiceTaken: 1 } },
    { new: true }
  );
  return { pointsEarned: pts, user: fresh };
}

export async function awardCards(user, known) {
  const capped = Math.max(0, Math.min(known, 60));
  const { user: touched } = await touchUser(user);
  if (!capped) return { pointsEarned: 0, user: touched };
  const settings = await Settings.get();
  const pts = capped * settings.points.cardPoints;
  const fresh = await User.findByIdAndUpdate(
    touched._id,
    { $inc: { points: pts, weeklyPoints: pts, cardsReviewed: capped } },
    { new: true }
  );
  return { pointsEarned: pts, user: fresh };
}

export { mondayISO, isoDate };
