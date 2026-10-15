// src/services/srs.js
// v3-P1-2: FSRS wrapper. All SRS logic lives here.
//
// Grades (matching ts-fsrs Rating enum):
//   1 = Again (wrong, didn't remember)
//   2 = Hard (remembered, but with significant effort)
//   3 = Good (remembered, normal effort)
//   4 = Easy (remembered instantly)
//
// For flashcards: students get 2 buttons (Again / Good). Hard/Easy are for moderators.
// For quiz items: grade is derived from correctness — correct = Good, wrong = Again.
//
// NOTE: This file imports `ts-fsrs`. Per the v3 spec the user will run `npm install`
// separately. Until then, importing this module will throw — that's expected and OK.
// The flashcards/quizzes services that depend on it are wired in such a way that
// they only touch srs.js at request time, so a missing dep doesn't break boot.
import { fsrs, generatorParameters, Rating, State } from "ts-fsrs";

// Default parameters — tuned for "school student, 80% retention target".
// requestRetention: 0.9 means "we want the student to have 90% probability of
// remembering this card when it's next due". Higher = more reviews, stronger memory.
// 0.9 is the FSRS default and matches what Anki uses.
const params = generatorParameters({ request_retention: 0.9 });
const f = fsrs(params);

// Convert a stored fsrsState (MongoDB shape) back into a ts-fsrs Card object.
// ts-fsrs cards have a specific shape; we serialize it for storage.
function stateToCard(state) {
  if (!state || !state.last_review) {
    return f.createEmptyCard();
  }
  return {
    due: new Date(state.last_review.getTime() + (state.scheduled_days || 0) * 24 * 60 * 60 * 1000),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state === "new" ? State.New
          : state.state === "learning" ? State.Learning
          : state.state === "review" ? State.Review
          : State.Relearning,
    last_review: state.last_review,
  };
}

// Reverse — card to storable state.
function cardToState(card) {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state === State.New ? "new"
         : card.state === State.Learning ? "learning"
         : card.state === State.Review ? "review"
         : "relearning",
    last_review: card.last_review,
  };
}

// Compute mastery bucket from state — used for queries/UI display.
function masteryBucket(state) {
  if (!state || state.reps === 0) return "new";
  if (state.state === "learning" || state.state === "relearning") return "learning";
  if (state.state === "review" && state.stability >= 21) return "mastered";
  if (state.state === "review") return "young";
  return "new";
}

// Review a card: given current state + grade, return new state + next due date.
// grade: 1=Again, 2=Hard, 3=Good, 4=Easy
export function reviewCard(currentState, grade) {
  const card = stateToCard(currentState);
  const now = new Date();
  const result = f.repeat(card, now);
  const updated = result[grade];
  return {
    fsrsState: cardToState(updated),
    masteryBucket: masteryBucket(updated),
    nextDueAt: updated.due,
  };
}

// Is this card due for review as of `now`?
export function isDue(state, now = new Date()) {
  if (!state || !state.last_review) return true; // never reviewed = due
  const due = new Date(state.last_review.getTime() + (state.scheduled_days || 0) * 24 * 60 * 60 * 1000);
  return due <= now;
}

// Create the initial state for a brand-new card.
export function emptyState() {
  return {
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: "new",
    last_review: null,
  };
}

export const Grades = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

export const MasteryBuckets = ["new", "learning", "young", "mastered"];

export default { reviewCard, isDue, emptyState, Grades, MasteryBuckets };
