// src/routes/index.js — mount everything, then 404.
import { Router } from "express";
import auth from "./auth.js";
import pages from "./pages.js";
import quizzes from "./quizzes.js";
import flashcards from "./flashcards.js";
import build from "./build.js";
import host from "./host.js";
import admin from "./admin.js";

const router = Router();

router.use(auth);
router.use(pages);
router.use(quizzes);
router.use(flashcards);
router.use(build);
router.use(host);
router.use(admin);

router.use((req, res) => {
  res.status(404).render("error", {
    code: 404, title: "Page not found",
    message: "The page you followed doesn't exist. Check the address or head back to the hub.",
  });
});

export default router;
