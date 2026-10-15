// v3-P1-3: Flashcard study session client JS.
// Fetches the next due card, handles flip + grade. Auto-advances.
const cardFlip = document.getElementById('card-flip');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');
const studyActions = document.getElementById('study-actions');
const statusEl = document.getElementById('study-status');
let currentCard = null;

async function loadNext() {
  studyActions.style.display = 'none';
  cardFlip.classList.remove('flipped');
  statusEl.textContent = 'Loading next card…';
  const params = new URLSearchParams(location.search);
  const unitId = params.get('unitId') || params.get('unit');
  const url = '/api/flashcards/study/next' + (unitId ? `?unitId=${unitId}` : '');
  const r = await fetch(url).then(r => r.json()).catch(() => null);
  if (!r || !r.card) {
    cardFront.textContent = 'All caught up!';
    cardBack.textContent = 'No cards due right now. Come back later.';
    statusEl.textContent = (r && r.isNew === false && r.isDue === false) ? 'No new or due cards.' : '';
    return;
  }
  currentCard = r.card;
  cardFront.textContent = r.card.front;
  cardBack.textContent = r.card.back;
  statusEl.textContent = r.isNew ? 'New card' : 'Due for review';
}

cardFlip.addEventListener('click', () => {
  if (!currentCard) return;
  cardFlip.classList.add('flipped');
  studyActions.style.display = 'flex';
});

async function grade(gradeNum) {
  if (!currentCard) return;
  studyActions.style.display = 'none';
  await fetch('/api/flashcards/review-graded', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.csrfToken },
    body: JSON.stringify({ cardId: currentCard.id, grade: gradeNum }),
  }).catch(() => {});
  await loadNext();
}

document.getElementById('grade-again').addEventListener('click', () => grade(1));
document.getElementById('grade-good').addEventListener('click', () => grade(3));

loadNext();
