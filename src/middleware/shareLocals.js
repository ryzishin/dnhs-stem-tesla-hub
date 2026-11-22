// src/middleware/shareLocals.js — view helpers + flash messages, available in every template.
export function shareLocals(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.appName = "STEM Tesla Hub";
  res.locals.school = "Dangcagan National High School";
  res.locals.tagline = "Explore. Practice. Apply. Discover.";
  res.locals.query = req.query || {};

  res.locals.icon = (name, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

  res.locals.initials = (name = "?") =>
    String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

  res.locals.avatarHtml = (u, cls = "") => {
    if (!u) return "";
    const hue = ((u.avatarColor ?? 0) % 360 + 360) % 360;
    const initials = `<span aria-hidden="true">${res.locals.initials(u.name)}</span>`;
    const inner = u.avatarUrl
      ? `<img src="${u.avatarUrl}" alt="" loading="lazy">`
      : initials;
    return `<span class="avatar ${cls}" style="--h:${hue}" aria-hidden="true">${inner}</span>`;
  };

  // social platforms the profile supports: key → { icon, label, url(handle) }
  res.locals.SOCIAL_PLATFORMS = {
    facebook: { icon: "facebook", label: "Facebook", url: (h) => `https://facebook.com/${h}` },
    instagram: { icon: "instagram", label: "Instagram", url: (h) => `https://instagram.com/${h}` },
    tiktok: { icon: "tiktok", label: "TikTok", url: (h) => `https://tiktok.com/@${String(h).replace(/^@/, "")}` },
    x: { icon: "xcorp", label: "X (Twitter)", url: (h) => `https://x.com/${String(h).replace(/^@/, "")}` },
    youtube: { icon: "youtube", label: "YouTube", url: (h) => `https://youtube.com/@${String(h).replace(/^@/, "")}` },
    github: { icon: "github", label: "GitHub", url: (h) => `https://github.com/${String(h).replace(/^@/, "")}` },
  };

  // normalize a social input: keep full https URLs, turn @user / user into a platform URL
  res.locals.normalizeSocial = (platform, raw) => {
    const conf = res.locals.SOCIAL_PLATFORMS[platform];
    if (!conf) return "";
    let v = String(raw || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) {
      try { const u = new URL(v); if (u.protocol !== "https:" && u.protocol !== "http:") return ""; return v.slice(0, 200); } catch { return ""; }
    }
    return conf.url(v.replace(/^@/, "")).slice(0, 200);
  };

  // render the social chips for a person (used on public profiles + classmates)
  res.locals.socialHtml = (u) => {
    if (!u || !u.links) return "";
    const chips = Object.entries(u.links)
      .filter(([k, v]) => v && res.locals.SOCIAL_PLATFORMS[k])
      .map(([k, v]) => {
        const conf = res.locals.SOCIAL_PLATFORMS[k];
        return `<a class="social-chip" href="${v}" target="_blank" rel="noopener noreferrer nofollow" aria-label="${conf.label}">` +
          `<svg class="icon" aria-hidden="true"><use href="#i-${conf.icon}"></use></svg><span>${conf.label}</span></a>`;
      });
    return chips.length ? `<div class="social-row">${chips.join("")}</div>` : "";
  };

  res.locals.fmtDate = (d, opts) => {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("en-PH", opts || { month: "short", day: "numeric", year: "numeric" }); }
    catch { return ""; }
  };

  res.locals.json = (v) => JSON.stringify(v ?? null).replace(/</g, "\\u003c");

  res.locals.plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

  // flash messages: req.session.flash = { type, message }
  res.locals.flash = req.session?.flash || null;
  if (req.session) delete req.session.flash;

  next();
}

export function setFlash(req, type, message) {
  req.session.flash = { type, message };
}
