// Flashcards view — flip, next, prev, +2 points per review
(function() {
  const cards = window.__FLASHCARDS__ || [];
  if (cards.length === 0) return;
  let idx = 0;
  let reviewed = new Set();
  const front = document.getElementById('card-front');
  const back = document.getElementById('card-back');
  const counter = document.getElementById('card-counter');
  const card = document.getElementById('flashcard');

  function render() {
    const c = cards[idx];
    front.textContent = c.front;
    back.textContent = c.back;
    counter.textContent = `Card ${idx + 1} of ${cards.length}`;
  }
  card.addEventListener('click', () => card.classList.toggle('flipped'));
  document.getElementById('prev-card').addEventListener('click', (e) => { e.stopPropagation(); if (idx > 0) { idx--; render(); card.classList.remove('flipped'); } });
  document.getElementById('next-card').addEventListener('click', (e) => { e.stopPropagation(); if (idx < cards.length - 1) { idx++; render(); card.classList.remove('flipped'); } });
  document.getElementById('known-card').addEventListener('click', async (e) => {
    e.stopPropagation();
    const c = cards[idx];
    if (!reviewed.has(c.id)) {
      reviewed.add(c.id);
      await fetch('/flashcards/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: c.id }) });
      toast('+2 points!', 'success');
    } else {
      toast('Already reviewed this card', 'default');
    }
    if (idx < cards.length - 1) { idx++; render(); card.classList.remove('flipped'); }
    else { toast('Deck complete!', 'success'); }
  });

  render();
})();
