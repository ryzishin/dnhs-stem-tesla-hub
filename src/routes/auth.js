// src/routes/auth.js — register / login / logout. Open signup (adviser can toggle it off in Admin → Settings).
import { Router } from "express";
import bcrypt from "bcryptjs";
import { User, Settings } from "../models/index.js";
import { touchUser } from "../services/points.js";
import { warnOnLogout } from "../services/realtime.js";
import { wrap } from "./_util.js";

const router = Router();

router.get("/login", (req, res) => {
  if (req.user) return res.redirect("/hub");
  res.render("auth/login", { title: "Sign in", next: req.query.next || "", error: null, username: "" });
});

router.post("/login", wrap(async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const nextUrl = String(req.body.next || "");
  const fail = (msg) => res.status(401).render("auth/login", { title: "Sign in", next: nextUrl, error: msg, username });

  if (!username || !password) return fail("Enter both your username and password.");
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail("We couldn't match that username and password. Check them and try again.");
  }

  req.session.userId = user._id.toString();
  await touchUser(user);
  res.redirect(nextUrl && nextUrl.startsWith("/") ? nextUrl : "/hub");
}));

router.get("/register", async (req, res) => {
  if (req.user) return res.redirect("/hub");
  const settings = await Settings.get();
  res.render("auth/register", { title: "Create account", allowRegistration: settings.allowRegistration, error: null, form: {} });
});

router.post("/register", wrap(async (req, res) => {
  const settings = await Settings.get();
  const form = { name: String(req.body.name || "").trim(), username: String(req.body.username || "").trim().toLowerCase() };
  const renderFail = (error) => res.status(400).render("auth/register", { title: "Create account", allowRegistration: settings.allowRegistration, error, form });

  if (!settings.allowRegistration) return renderFail("Registration is closed right now. Ask your adviser to enable it in Admin → Settings.");
  if (!form.name || form.name.length > 60) return renderFail("Enter the name you want to appear on the leaderboard.");
  if (!/^[a-z0-9._-]{3,20}$/.test(form.username)) return renderFail("Usernames are 3–20 characters: lowercase letters, numbers, dots, dashes only.");
  const password = String(req.body.password || "");
  if (password.length < 6) return renderFail("Password must be at least 6 characters.");
  if (password !== String(req.body.confirm || "")) return renderFail("Passwords don't match. Try again.");
  if (await User.exists({ username: form.username })) return renderFail("That username is taken — pick another.");

  const count = await User.countDocuments();
  const user = await User.create({
    name: form.name,
    username: form.username,
    passwordHash: await bcrypt.hash(password, 10),
    role: count === 0 ? "admin" : "student",
  });
  if (count === 0) console.log(`[auth] first account created → ${user.username} is now the administrator (adviser).`);
  req.session.userId = user._id.toString();
  await touchUser(user);
  res.redirect("/hub");
}));

router.post("/logout", wrap(async (req, res) => {
  // signing out mid-test counts as leaving the test window (anti-cheat)
  if (req.session?.userId) {
    try { await warnOnLogout(req.session.userId); } catch { /* never block a logout */ }
  }
  req.session.destroy(() => res.redirect("/"));
}));

export default router;
