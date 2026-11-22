// src/models/index.js — import once to register every model.
import "./User.js";
import "./Subject.js";
import "./Note.js";
import "./Deck.js";
import "./Quiz.js";
import "./Attempt.js";
import "./Review.js";
import "./LiveSession.js";
import "./LiveParticipant.js";
import "./Settings.js";
import { BLOCK_TYPES } from "./Note.js";
import { SUBJECT_COLORS, SUBJECT_ICONS } from "./Subject.js";

export { BLOCK_TYPES, SUBJECT_COLORS, SUBJECT_ICONS };
export { default as User } from "./User.js";
export { default as Subject } from "./Subject.js";
export { default as Note } from "./Note.js";
export { default as Deck } from "./Deck.js";
export { default as Quiz } from "./Quiz.js";
export { default as Attempt } from "./Attempt.js";
export { default as Review } from "./Review.js";
export { default as LiveSession } from "./LiveSession.js";
export { default as LiveParticipant } from "./LiveParticipant.js";
export { default as Settings } from "./Settings.js";
