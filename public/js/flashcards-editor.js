// Flashcards editor
let editingCard = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('new-card-btn')?.addEventListener('click', () => openCardModal(null));
  document.getElementById('card-close')?.addEventListener('click', () => document.getElementById('card-modal').classList.add('hidden'));
  document.getElementById('card-cancel')?.addEventListener('click', () => document.getElementById('card-modal').classList.add('hidden'));

  document.querySelectorAll('.edit-card').forEach(b => b.addEventListener('click', () => {
    const card = JSON.parse(b.dataset.card);
    openCardModal(card);
  }));

  document.querySelectorAll('.delete-card').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this card?')) return;
    const r = await fetch(`/api/flashcards/${b.dataset.cardId}`, { method: 'DELETE' });
    if (r.ok) location.reload();
  }));

  document.getElementById('card-save')?.addEventListener('click', async () => {
    const body = {
      front: document.getElementById('card-front').value,
      back: document.getElementById('card-back').value,
      unit_id: document.getElementById('card-unit').value,
    };
    if (!body.front.trim() || !body.back.trim()) return alert('Both fields are required.');
    const url = editingCard ? `/api/flashcards/${editingCard.id}` : '/api/flashcards';
    const method = editingCard ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) location.reload();
  });
});

function openCardModal(card) {
  editingCard = card;
  document.getElementById('card-modal-title').textContent = card ? 'Edit flashcard' : 'New flashcard';
  document.getElementById('card-front').value = card ? card.front : '';
  document.getElementById('card-back').value = card ? card.back : '';
  document.getElementById('card-unit').value = card && card.unit_id ? card.unit_id : '';
  document.getElementById('card-modal').classList.remove('hidden');
}
