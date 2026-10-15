// Quizzes editor — items + options
let currentQuizId = null;
let editingItem = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('new-quiz-btn')?.addEventListener('click', async () => {
    const title = prompt('New quiz title:');
    if (!title) return;
    const r = await fetch('/api/quizzes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description: '', kind: 'practice' }) });
    if (r.ok) location.reload();
  });

  document.querySelectorAll('.add-item-btn').forEach(b => b.addEventListener('click', () => openItemModal(b.dataset.quizId, null)));
  document.querySelectorAll('.edit-item-btn').forEach(b => b.addEventListener('click', () => {
    const item = JSON.parse(b.dataset.item);
    openItemModal(b.dataset.quizId, item);
  }));
  document.querySelectorAll('.delete-item-btn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this item?')) return;
    const r = await fetch(`/api/quizzes/items/${b.dataset.itemId}`, { method: 'DELETE' });
    if (r.ok) location.reload();
  }));
  document.querySelectorAll('.delete-quiz-btn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this quiz?')) return;
    const r = await fetch(`/api/quizzes/${b.dataset.quizId}`, { method: 'DELETE' });
    if (r.ok) location.reload();
  }));

  document.getElementById('item-close')?.addEventListener('click', closeItemModal);
  document.getElementById('item-cancel')?.addEventListener('click', closeItemModal);
  document.getElementById('item-save')?.addEventListener('click', saveItem);
  document.getElementById('add-option-btn')?.addEventListener('click', () => addOptionRow('', false));
  document.getElementById('item-type')?.addEventListener('change', syncTypeFields);

  // ===== Edit quiz metadata =====
  document.querySelectorAll('.edit-quiz-btn').forEach(b => b.addEventListener('click', () => {
    const q = JSON.parse(b.dataset.quiz);
    document.getElementById('eq-id').value = q.id;
    document.getElementById('eq-title').value = q.title || '';
    document.getElementById('eq-desc').value = q.description || '';
    document.getElementById('eq-tl').value = q.time_limit_min || '';
    // v3-P1-4: Mastery mode checkbox. Existing quizzes default to false → unchecked.
    document.getElementById('eq-mastery').checked = !!q.mastery_mode;
    // deadline comes back as ISO; trim to datetime-local format (YYYY-MM-DDTHH:mm)
    if (q.deadline) {
      document.getElementById('eq-dl').value = q.deadline.slice(0, 16);
    } else {
      document.getElementById('eq-dl').value = '';
    }
    document.getElementById('edit-quiz-modal').classList.remove('hidden');
  }));
  document.getElementById('eq-close')?.addEventListener('click', () => document.getElementById('edit-quiz-modal').classList.add('hidden'));
  document.getElementById('eq-cancel')?.addEventListener('click', () => document.getElementById('edit-quiz-modal').classList.add('hidden'));
  document.getElementById('eq-save')?.addEventListener('click', async () => {
    const id = document.getElementById('eq-id').value;
    const body = {
      title: document.getElementById('eq-title').value,
      description: document.getElementById('eq-desc').value,
      time_limit_min: document.getElementById('eq-tl').value ? Number(document.getElementById('eq-tl').value) : null,
      deadline: document.getElementById('eq-dl').value ? document.getElementById('eq-dl').value + ':00' : null,
      // v3-P1-4: Send mastery_mode alongside the other quiz metadata.
      mastery_mode: document.getElementById('eq-mastery').checked,
    };
    const r = await fetch(`/api/quizzes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { location.reload(); } else { const d = await r.json(); alert(d.error || 'Failed to save quiz'); }
  });
});

function openItemModal(quizId, item) {
  currentQuizId = quizId;
  editingItem = item;
  document.getElementById('item-modal-title').textContent = item ? 'Edit item' : 'New item';
  document.getElementById('item-type').value = item ? item.type : 'multiple_choice';
  document.getElementById('item-question').value = item ? item.question : '';
  document.getElementById('item-image').value = item ? (item.image_url || '') : '';
  document.getElementById('item-points').value = item ? item.points : 1;
  document.getElementById('item-answer').value = item ? (item.correct_answer || '') : '';
  document.getElementById('item-explanation').value = item ? (item.explanation || '') : '';
  // options
  const list = document.getElementById('options-list');
  list.innerHTML = '';
  if (item && item.options) {
    item.options.forEach(o => addOptionRow(o.text, o.is_correct, o.image_url || o.imageUrl));
  } else {
    addOptionRow('', true);
    addOptionRow('', false);
  }
  syncTypeFields();
  document.getElementById('item-modal').classList.remove('hidden');
}

function closeItemModal() {
  document.getElementById('item-modal').classList.add('hidden');
  editingItem = null;
}

function syncTypeFields() {
  const type = document.getElementById('item-type').value;
  const isChoice = type === 'multiple_choice' || type === 'true_false';
  document.getElementById('options-block').classList.toggle('hidden', !isChoice);
  document.getElementById('answer-key-block').classList.toggle('hidden', isChoice);
  if (type === 'true_false') {
    // reset options to True/False
    const list = document.getElementById('options-list');
    list.innerHTML = '';
    addOptionRow('True', true);
    addOptionRow('False', false);
  }
}

function addOptionRow(text, correct, imageUrl) {
  const list = document.getElementById('options-list');
  const row = document.createElement('div');
  row.className = 'option-row option-row-rich';
  row.style.cursor = 'default';
  row.style.flexDirection = 'column';
  row.style.alignItems = 'stretch';
  row.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.5rem;width:100%;">
      <button type="button" class="opt-correct" data-correct="${correct ? '1' : '0'}" style="width:18px;height:18px;border-radius:50%;border:2px solid var(--border);background:${correct ? 'var(--accent)' : 'transparent'};flex-shrink:0;"></button>
      <input type="text" class="opt-text" value="${esc(text)}" placeholder="Option text" style="flex:1;" ${document.getElementById('item-type').value === 'true_false' ? 'disabled' : ''} />
      ${document.getElementById('item-type').value !== 'true_false' ? '<button type="button" class="icon-btn opt-remove">✕</button>' : ''}
    </div>
    ${document.getElementById('item-type').value === 'multiple_choice' ? `
    <div style="display:flex;align-items:center;gap:0.5rem;width:100%;padding-left:26px;margin-top:4px;">
      <input type="text" class="opt-image" value="${esc(imageUrl || '')}" placeholder="Optional image URL for this option" style="flex:1;font-size:0.8rem;height:32px;" />
      ${imageUrl ? `<img src="${esc(imageUrl)}" alt="" style="width:32px;height:32px;border-radius:4px;object-fit:cover;" />` : ''}
    </div>` : ''}
  `;
  list.appendChild(row);
  row.querySelector('.opt-correct').addEventListener('click', () => {
    list.querySelectorAll('.opt-correct').forEach(b => { b.dataset.correct = '0'; b.style.background = 'transparent'; });
    row.querySelector('.opt-correct').dataset.correct = '1';
    row.querySelector('.opt-correct').style.background = 'var(--accent)';
  });
  row.querySelector('.opt-remove')?.addEventListener('click', () => row.remove());
}

async function saveItem() {
  const type = document.getElementById('item-type').value;
  const body = {
    type,
    question: document.getElementById('item-question').value.trim(),
    image_url: document.getElementById('item-image').value.trim() || null,
    correct_answer: type === 'identification' || type === 'open_ended' ? document.getElementById('item-answer').value.trim() : null,
    explanation: document.getElementById('item-explanation').value.trim() || null,
    points: Number(document.getElementById('item-points').value),
    options: type === 'multiple_choice' || type === 'true_false'
      ? Array.from(document.querySelectorAll('#options-list .option-row')).map(r => ({
          text: r.querySelector('.opt-text').value,
          is_correct: r.querySelector('.opt-correct').dataset.correct === '1',
          image_url: r.querySelector('.opt-image')?.value?.trim() || null,
        }))
      : null,
  };
  if (!body.question) return alert('Question is required.');

  const url = editingItem
    ? `/api/quizzes/items/${editingItem.id}`
    : `/api/quizzes/${currentQuizId}/items`;
  const method = editingItem ? 'PATCH' : 'POST';
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.ok) { location.reload(); } else { const d = await r.json(); alert(d.error || 'Failed to save'); }
}

function esc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
