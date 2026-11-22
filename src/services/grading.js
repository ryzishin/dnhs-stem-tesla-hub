// src/services/grading.js — one grading rule for practice quizzes AND live tests.
export function normalizeAnswer(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Grade one item against a raw student answer. Returns boolean. */
export function gradeItem(item, given) {
  const g = String(given ?? "").trim();
  if (!g) return false;
  if (item.type === "mcq") return !!item.options?.find((o) => o.isCorrect && o.id === g);
  if (item.type === "tf") return g.toLowerCase() === String(item.answer || "").toLowerCase();
  if (item.type === "short") return !!item.answer && normalizeAnswer(g).includes(normalizeAnswer(item.answer));
  return false;
}

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
