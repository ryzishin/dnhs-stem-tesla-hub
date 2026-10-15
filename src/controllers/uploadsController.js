// src/controllers/uploadsController.js
// v3-P2-1: Auth-gated /uploads — only logged-in users can fetch profile pictures.
// Files are served from disk; we add a requireAuth check before sending.
import path from "node:path";
import fs from "node:fs";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export async function serveUpload(req, res) {
  // v3-P2-1: requireAuth middleware on the route ensures req.user is set.
  // If somehow it's not (misconfigured route), short-circuit to 401.
  if (!req.user) return res.status(401).render("error/403", { title: "Unauthorized" });
  // path.basename strips any `../` — prevents path traversal outside UPLOADS_DIR.
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  // Defense-in-depth: confirm the resolved path is still inside UPLOADS_DIR.
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return res.status(404).render("error/404", { title: "Not Found" });
  }

  try {
    await fs.promises.access(filePath);
  } catch {
    return res.status(404).render("error/404", { title: "Not Found" });
  }
  res.sendFile(filePath);
}

export default { serveUpload };
