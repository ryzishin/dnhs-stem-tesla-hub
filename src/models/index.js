// src/models/index.js — Mongoose models registry.
// Import this file once (e.g. in server.js) to register all models with Mongoose.
import "./User.js";
import "./Unit.js";
import "./Part.js";
import "./ContentBlock.js";
import "./Quiz.js";
import "./QuizItem.js";
import "./QuizOption.js";
import "./Flashcard.js";
import "./FlashcardReview.js"; // v3-P1-1
import "./QuizItemReview.js";   // v3-P1-1
import "./QuizAttempt.js";
import "./LiveSession.js";
import "./LiveParticipant.js";
import "./ActivityFeed.js";
import "./Settings.js";
// v3-P2-6: PasswordReset model.
import "./PasswordReset.js";

export { default as User } from "./User.js";
export { default as Unit } from "./Unit.js";
export { default as Part } from "./Part.js";
export { default as ContentBlock } from "./ContentBlock.js";
export { default as Quiz } from "./Quiz.js";
export { default as QuizItem } from "./QuizItem.js";
export { default as QuizOption } from "./QuizOption.js";
export { default as Flashcard } from "./Flashcard.js";
export { default as FlashcardReview } from "./FlashcardReview.js"; // v3-P1-1
export { default as QuizItemReview } from "./QuizItemReview.js";   // v3-P1-1
export { default as QuizAttempt } from "./QuizAttempt.js";
export { default as LiveSession } from "./LiveSession.js";
export { default as LiveParticipant } from "./LiveParticipant.js";
export { default as ActivityFeed } from "./ActivityFeed.js";
export { default as Settings } from "./Settings.js";
export { default as PasswordReset } from "./PasswordReset.js"; // v3-P2-6
