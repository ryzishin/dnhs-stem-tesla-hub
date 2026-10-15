// src/middleware/csrf.js
// v2-P1-1: CSRF protection.
// Issues a fresh token per GET (stored in res.locals.csrfToken and a <meta> tag),
// verifies on every non-GET/non-safe request.
// Tokens can come from X-CSRF-Token header (for fetch) or _csrf form field (for forms).
import CSRF from "csrf";

const csrf = new CSRF();

// v3-fix: csrf.secret() is callback-based, but csrf.create() and csrf.verify()
// are SYNCHRONOUS — they return values directly, not via callback. The original
// v2 code wrapped all three in Promises with callback-style, which meant
// createAsync and verifyAsync never resolved (the callbacks never fired),
// causing every HTTP request to hang forever.
function secretAsync() {
  return new Promise((resolve, reject) => {
    csrf.secret((err, s) => err ? reject(err) : resolve(s));
  });
}
// create() and verify() are sync — just call them directly.
function createSync(secret) {
  return csrf.create(secret);
}
function verifySync(secret, token) {
  return csrf.verify(secret, token);
}

// Attach a fresh CSRF token to res.locals for every GET request.
// Also ensures req.session.csrfSecret exists (one per session).
export async function csrfToken(req, res, next) {
  try {
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = await secretAsync();
    }
    res.locals.csrfToken = createSync(req.session.csrfSecret);
  } catch (err) {
    console.error("[csrf] token creation failed:", err.message);
    res.locals.csrfToken = "";
  }
  next();
}

// Verify the CSRF token on every non-GET/non-HEAD/non-OPTIONS request.
export async function csrfVerify(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const secret = req.session.csrfSecret;
  if (!secret) {
    return res.status(403).json({ ok: false, error: "Missing CSRF secret — refresh the page" });
  }
  // Token can come from the X-CSRF-Token header (for fetch) or the _csrf body field (for forms).
  const token = req.headers["x-csrf-token"] || (req.body && req.body._csrf);
  if (!token) {
    return res.status(403).json({ ok: false, error: "Missing CSRF token" });
  }
  try {
    const valid = verifySync(secret, token);
    if (!valid) {
      return res.status(403).json({ ok: false, error: "Invalid CSRF token" });
    }
  } catch (err) {
    return res.status(403).json({ ok: false, error: "Invalid CSRF token" });
  }
  next();
}

export default { csrfToken, csrfVerify };
