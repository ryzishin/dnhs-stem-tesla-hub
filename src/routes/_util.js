// src/routes/_util.js — tiny helpers shared by route files.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

export async function uniqueSlug(Model, base, ignoreId = null) {
  let slug = base || "untitled";
  let n = 2;
  for (;;) {
    const clash = await Model.findOne({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }).select("_id").lean();
    if (!clash) return slug;
    slug = `${base}-${n++}`;
  }
}

export function apiFail(res, code, message) {
  return res.status(code).json({ error: message });
}

// True only for well-formed 24-char hex ids — keeps findById from CastError-ing (500) on garbage paths.
export function isHexId(id) {
  return /^[a-f0-9]{24}$/.test(String(id || ""));
}
