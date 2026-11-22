// src/routes/flashcards.js — study a deck and bank the session's points.
import { Router } from "express";
import { Deck, Review } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { shuffle } from "../services/grading.js";
import { awardCards } from "../services/points.js";
import { wrap, isHexId } from "./_util.js";

const router = Router();

router.get("/deck/:id", requireAuth, wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return res.status(404).render("error", { code: 404, title: "Deck not found", message: "This deck may have been removed." });
  const deck = await Deck.findById(req.params.id).populate("subject", "name color slug");
  if (!deck) return res.status(404).render("error", { code: 404, title: "Deck not found", message: "This deck may have been removed." });
  const isEditor = req.user.role === "admin" || (req.user.role === "moderator" && req.user.isModeratorOf(deck.subject?._id));
  if (!deck.published && !isEditor) return res.status(404).render("error", { code: 404, title: "Deck not found", message: "This deck isn't published yet." });
  if (!deck.cards?.length) return res.status(404).render("error", { code: 404, title: "Deck is empty", message: "The moderator hasn't added cards yet." });

  const cards = shuffle(deck.cards.map((c) => c.toJSON()));
  res.render("flashcards/study", {
    title: deck.title, deck: deck.toJSON(), cards,
    pageScript: "flashcards-study", pageData: { cards },
  });
}));

router.post("/deck/:id/finish", requireAuth, wrap(async (req, res) => {
  if (!isHexId(req.params.id)) return res.status(404).json({ error: "Deck not found." });
  const deck = await Deck.findById(req.params.id);
  if (!deck) return res.status(404).json({ error: "Deck not found." });
  const known = Math.max(0, Math.min(Number(req.body.known || 0), 60));
  const total = Math.max(0, Math.min(Number(req.body.total || deck.cards.length), 60));
  await Review.create({ user: req.user._id, deck: deck._id, subject: deck.subject, known, total });
  const { pointsEarned } = await awardCards(req.user, known);
  res.json({ ok: true, pointsEarned });
}));

export default router;
