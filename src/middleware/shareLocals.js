// src/middleware/shareLocals.js
// Inject commonly-needed template variables into res.locals so every EJS view has them.
export function shareLocals(req, res, next) {
  res.locals.user = req.user || null;
  res.locals.role = req.role || null;
  res.locals.path = req.path;
  res.locals.flash = req.session?.flash || null;
  // one-shot flash — clear after read
  if (req.session?.flash) {
    req.session.flash = null;
  }
  // v3-P3-5: nonce may already be set by the server.js middleware (which runs before
  // shareLocals). Ensure it's always defined for views that just read `nonce`.
  res.locals.nonce = res.locals.nonce || "";
  // v2-P0-3: safeJson helper — escape <, >, &, U+2028, U+2029 so that
  // JSON-encoded values injected into <script> blocks can't break out of
  // the tag. Use: <%- safeJson(someObject) %> instead of <%- JSON.stringify(someObject) %>.
  res.locals.safeJson = (v) => JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  next();
}
