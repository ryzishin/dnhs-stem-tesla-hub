// src/controllers/profileController.js
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { listAttemptsForUser } from "../services/quizzes.js";

// ===== Own profile (editable) =====
export async function show(req, res) {
  try {
    const attempts = await listAttemptsForUser(req.user.id);
    res.render("profile", {
      title: "Profile",
      attempts,
      profileUser: req.user,
      isOwn: true,
      mustChangePassword: req.query.mustChangePassword === "1",
    });
  } catch (err) {
    console.error("[profile show]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

// ===== Public profile (anyone can view anyone's profile) =====
export async function showPublic(req, res) {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).render("error/404");
    const attempts = await listAttemptsForUser(user._id.toString());
    const profileUser = {
      ...user,
      id: user._id.toString(),
      avatar_color: user.avatarColor,
      avatar_url: user.avatarUrl,
    };
    res.render("profile", {
      title: user.name,
      attempts,
      profileUser,
      isOwn: false,
    });
  } catch (err) {
    console.error("[profile showPublic]", err);
    res.status(500).render("error/500", { message: err.message });
  }
}

// ===== Update profile (name, bio, socials, avatar) =====
export async function update(req, res) {
  try {
    // v3-P0-2: Read from req.validated (set by validate(profileUpdateSchema)).
    // NOTE: profileUpdateSchema uses camelCase `avatarColor` (not `avatar_color`).
    const { name, avatarColor, bio, socials } = req.validated;
    const patch = {};
    if (name) patch.name = name;
    // v3-P0-2: avatarColor is already a Number (validated by Zod). Old code read
    // avatar_color from req.body as a string and ran Number() on it.
    if (avatarColor !== undefined) patch.avatarColor = avatarColor;
    if (bio !== undefined) patch.bio = String(bio).slice(0, 280);
    if (socials) {
      // Only update known keys
      const allowed = ["twitter", "instagram", "github", "facebook", "tiktok", "youtube", "website"];
      const cleaned = {};
      for (const k of allowed) {
        if (socials[k] !== undefined) cleaned[k] = String(socials[k]).trim();
      }
      patch.socials = cleaned;
    }
    if (req.file) {
      patch.avatarUrl = `/uploads/${req.file.filename}`;
    }
    const user = await User.findByIdAndUpdate(req.user.id, patch, { new: true }).lean();
    res.json({ ok: true, profile: { ...user, id: user._id.toString(), avatar_url: user.avatarUrl } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ===== Change password =====
export async function changePassword(req, res) {
  try {
    // v3-P0-2: Read from req.validated (set by validate(passwordChangeSchema)).
    // The schema already enforces newPassword.length >= 6, so the manual checks below
    // are redundant defensive code kept for clarity.
    const { currentPassword, newPassword } = req.validated;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "Both current and new passwords are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "New password must be at least 6 characters." });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect." });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
