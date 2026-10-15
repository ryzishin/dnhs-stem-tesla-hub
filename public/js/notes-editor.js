// Notes editor — block-based templating engine (client side)
// Handles: edit unit metadata, edit part (title + blocks), add new blocks, edit existing blocks, delete blocks, add/delete units & parts.

let currentPartId = null;
let currentUnitId = null;
let blocks = [];
let editingBlockIdx = -1;

// v2-P2-4: Replaced emojis with Lucide SVG icon names.
// Each entry is rendered with <i data-lucide="icon-name"> and lucide.createIcons()
// is called after the picker is added to the DOM.
const BLOCK_KINDS = [
  { kind: 'paragraph', label: 'Paragraph', icon: 'pilcrow' },
  { kind: 'heading', label: 'Heading', icon: 'heading' },
  { kind: 'bullet', label: 'Bulleted list', icon: 'list' },
  { kind: 'numbered', label: 'Numbered list', icon: 'list-ordered' },
  { kind: 'image', label: 'Image', icon: 'image' },
  { kind: 'divider', label: 'Divider', icon: 'minus' },
  { kind: 'callout', label: 'Callout', icon: 'info' },
];

function defaultBlock(kind) {
  switch (kind) {
    case 'paragraph': return { kind, text: 'New paragraph text…' };
    case 'heading': return { kind, text: 'New heading', level: 2 };
    case 'bullet': return { kind, items: ['First point'] };
    case 'numbered': return { kind, items: ['First step'] };
    case 'image': return { kind, url: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=900&q=70', caption: 'Caption (optional)' };
    case 'divider': return { kind };
    case 'callout': return { kind, text: 'Important callout…', variant: 'info' };
  }
}

function openPartEditor(partId, unitId) {
  currentPartId = partId;
  currentUnitId = unitId;
  document.getElementById('editor-modal').classList.remove('hidden');
  fetch(`/api/notes/parts/${partId}/blocks`).then(r => r.json()).then(d => {
    blocks = d.blocks || [];
    renderBlocks();
    document.getElementById('part-title').value = d.title || '';
  });
}

function closePartEditor() {
  document.getElementById('editor-modal').classList.add('hidden');
  currentPartId = null;
  blocks = [];
  editingBlockIdx = -1;
}

function renderBlocks() {
  const ed = document.getElementById('blocks-editor');
  ed.innerHTML = '';
  blocks.forEach((b, i) => {
    const card = document.createElement('div');
    card.className = 'block-card';
    const head = document.createElement('div');
    head.className = 'block-card-head';
    head.innerHTML = `<span>${b.kind}</span><div>
      <button class="icon-btn up-block-btn" data-idx="${i}" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="icon-btn down-block-btn" data-idx="${i}" title="Move down" ${i === blocks.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="icon-btn dup-block-btn" data-idx="${i}" title="Duplicate">⧉</button>
      <button class="icon-btn del-block-btn" data-idx="${i}" title="Delete">×</button>
    </div>`;
    card.appendChild(head);

    const editor = document.createElement('div');
    editor.className = 'block-editor-fields';
    editor.innerHTML = renderBlockEditor(b, i);
    card.appendChild(editor);

    ed.appendChild(card);
  });

  // Wire up field changes
  ed.querySelectorAll('textarea[data-field], input[data-field]').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      if (blocks[idx]) {
        blocks[idx][field] = e.target.value;
      }
    });
  });

  // Wire up list item changes
  ed.querySelectorAll('input[data-list-idx]').forEach(el => {
    el.addEventListener('input', (e) => {
      const blockIdx = Number(e.target.dataset.blockIdx);
      const itemIdx = Number(e.target.dataset.listIdx);
      if (blocks[blockIdx] && blocks[blockIdx].items) {
        blocks[blockIdx].items[itemIdx] = e.target.value;
      }
    });
  });

  // Wire up add-item buttons
  ed.querySelectorAll('.add-list-item-btn').forEach(b => b.addEventListener('click', (e) => {
    const idx = Number(e.target.dataset.idx);
    if (blocks[idx]) {
      blocks[idx].items = [...(blocks[idx].items || []), 'New item'];
      renderBlocks();
    }
  }));

  // Wire up remove-item buttons
  ed.querySelectorAll('.del-list-item-btn').forEach(b => b.addEventListener('click', (e) => {
    const blockIdx = Number(e.target.dataset.blockIdx);
    const itemIdx = Number(e.target.dataset.listIdx);
    if (blocks[blockIdx]?.items?.length > 1) {
      blocks[blockIdx].items.splice(itemIdx, 1);
      renderBlocks();
    }
  }));

  // Wire up select changes (heading level, callout variant)
  ed.querySelectorAll('select[data-field]').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      if (blocks[idx]) {
        blocks[idx][field] = e.target.value === 'level' ? Number(e.target.value) : e.target.value;
      }
    });
  });

  ed.querySelectorAll('.del-block-btn').forEach(b => b.addEventListener('click', (e) => {
    const idx = Number(e.currentTarget.dataset.idx);
    blocks.splice(idx, 1);
    renderBlocks();
  }));
  ed.querySelectorAll('.dup-block-btn').forEach(b => b.addEventListener('click', (e) => {
    const idx = Number(e.currentTarget.dataset.idx);
    blocks.splice(idx + 1, 0, { ...blocks[idx] });
    renderBlocks();
  }));
  ed.querySelectorAll('.up-block-btn').forEach(b => b.addEventListener('click', (e) => {
    const idx = Number(e.currentTarget.dataset.idx);
    if (idx > 0) { [blocks[idx-1], blocks[idx]] = [blocks[idx], blocks[idx-1]]; renderBlocks(); }
  }));
  ed.querySelectorAll('.down-block-btn').forEach(b => b.addEventListener('click', (e) => {
    const idx = Number(e.currentTarget.dataset.idx);
    if (idx < blocks.length - 1) { [blocks[idx+1], blocks[idx]] = [blocks[idx], blocks[idx+1]]; renderBlocks(); }
  }));
}

function renderBlockEditor(b, i) {
  const base = `class="bg-input" data-idx="${i}"`;
  if (b.kind === 'paragraph') {
    return `<textarea data-field="text" data-idx="${i}" rows="4" placeholder="Write the paragraph text…">${esc(b.text || '')}</textarea>`;
  }
  if (b.kind === 'heading') {
    return `<input data-field="text" data-idx="${i}" value="${esc(b.text || '')}" placeholder="Heading text…" style="font-weight:600;font-size:1rem;" />
      <select data-field="level" data-idx="${i}">
        <option value="2" ${b.level == 2 ? 'selected' : ''}>H2 — Section</option>
        <option value="3" ${b.level == 3 ? 'selected' : ''}>H3 — Subsection</option>
      </select>`;
  }
  if (b.kind === 'bullet' || b.kind === 'numbered') {
    const items = (b.items || []).map((it, j) => `
      <div class="list-item-row">
        <span>${b.kind === 'numbered' ? (j+1)+'.' : '•'}</span>
        <input data-block-idx="${i}" data-list-idx="${j}" value="${esc(it)}" placeholder="Item ${j+1}" />
        <button class="icon-btn del-list-item-btn" data-block-idx="${i}" data-list-idx="${j}" ${b.items.length <= 1 ? 'disabled' : ''}>×</button>
      </div>`).join('');
    return items + `<button class="btn btn-sm btn-outline add-list-item-btn" data-idx="${i}">+ Add item</button>`;
  }
  if (b.kind === 'image') {
    return `<input data-field="url" data-idx="${i}" value="${esc(b.url || '')}" placeholder="https://example.com/image.jpg" />
      <input data-field="caption" data-idx="${i}" value="${esc(b.caption || '')}" placeholder="Caption (optional)" />
      ${b.url ? `<img src="${esc(b.url)}" alt="" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:4px;" />` : ''}`;
  }
  if (b.kind === 'divider') {
    return '<p class="muted small italic">A horizontal line. No content to edit.</p>';
  }
  if (b.kind === 'callout') {
    return `<textarea data-field="text" data-idx="${i}" rows="3" placeholder="Callout text…">${esc(b.text || '')}</textarea>
      <select data-field="variant" data-idx="${i}">
        <option value="info" ${b.variant === 'info' ? 'selected' : ''}>Info (blue)</option>
        <option value="warning" ${b.variant === 'warning' ? 'selected' : ''}>Warning (amber)</option>
        <option value="success" ${b.variant === 'success' ? 'selected' : ''}>Success (green)</option>
      </select>`;
  }
  return '';
}

function previewHtml(b) {
  switch (b.kind) {
    case 'heading': return `<h${b.level || 2}>${esc(b.text)}</h${b.level || 2}>`;
    case 'paragraph': return `<p>${esc(b.text)}</p>`;
    case 'bullet': return `<ul>${(b.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    case 'numbered': return `<ol>${(b.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ol>`;
    case 'image': return `<figure><img src="${esc(b.url)}" style="max-width:100%;border-radius:8px"/><figcaption>${esc(b.caption || '')}</figcaption></figure>`;
    case 'divider': return '<hr/>';
    case 'callout': return `<div class="callout callout-${b.variant || 'info'}">${esc(b.text)}</div>`;
    default: return '';
  }
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function savePart() {
  const title = document.getElementById('part-title').value;
  await fetch(`/api/notes/parts/${currentPartId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  await fetch(`/api/notes/parts/${currentPartId}/blocks`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  toast('Part saved', 'success');
  closePartEditor();
  location.reload();
}

// ===== Edit unit metadata =====
function openEditUnitModal(unit) {
  document.getElementById('eu-id').value = unit.id;
  document.getElementById('eu-number').value = unit.number || '';
  document.getElementById('eu-title').value = unit.title || '';
  document.getElementById('eu-desc').value = unit.description || '';
  document.getElementById('edit-unit-modal').classList.remove('hidden');
}
function closeEditUnitModal() {
  document.getElementById('edit-unit-modal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  // ===== Open part editor =====
  document.querySelectorAll('.edit-part-link, .edit-part-btn').forEach(el => el.addEventListener('click', (e) => {
    e.preventDefault();
    openPartEditor(el.dataset.partId, el.dataset.unitId);
  }));
  document.getElementById('editor-close')?.addEventListener('click', closePartEditor);
  document.getElementById('editor-cancel')?.addEventListener('click', closePartEditor);
  document.getElementById('editor-save')?.addEventListener('click', savePart);

  document.getElementById('add-block-btn')?.addEventListener('click', () => {
    const choice = prompt('Block type: paragraph, heading, bullet, numbered, image, divider, callout', 'paragraph');
    if (!choice) return;
    const def = defaultBlock(choice);
    if (!def) return alert('Unknown block type');
    blocks.push(def);
    renderBlocks();
  });

  // ===== New unit =====
  document.getElementById('new-unit-btn')?.addEventListener('click', () => {
    document.getElementById('unit-modal').classList.remove('hidden');
  });
  document.getElementById('unit-close')?.addEventListener('click', () => document.getElementById('unit-modal').classList.add('hidden'));
  document.getElementById('unit-cancel')?.addEventListener('click', () => document.getElementById('unit-modal').classList.add('hidden'));
  document.getElementById('unit-create')?.addEventListener('click', async () => {
    const body = {
      number: document.getElementById('nu-number').value,
      title: document.getElementById('nu-title').value,
      description: document.getElementById('nu-desc').value,
    };
    const r = await fetch('/api/notes/units', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { location.reload(); } else { alert('Failed to create unit'); }
  });

  // ===== Edit existing unit =====
  document.querySelectorAll('.edit-unit-btn').forEach(b => b.addEventListener('click', () => {
    const unit = JSON.parse(b.dataset.unit);
    openEditUnitModal(unit);
  }));
  document.getElementById('eu-close')?.addEventListener('click', closeEditUnitModal);
  document.getElementById('eu-cancel')?.addEventListener('click', closeEditUnitModal);
  document.getElementById('eu-save')?.addEventListener('click', async () => {
    const id = document.getElementById('eu-id').value;
    const body = {
      number: document.getElementById('eu-number').value,
      title: document.getElementById('eu-title').value,
      description: document.getElementById('eu-desc').value,
    };
    const r = await fetch(`/api/notes/units/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { closeEditUnitModal(); location.reload(); } else { alert('Failed to save unit'); }
  });

  // ===== Add part =====
  document.querySelectorAll('.add-part-btn').forEach(b => b.addEventListener('click', async () => {
    const r = await fetch(`/api/notes/units/${b.dataset.unitId}/parts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Part' }) });
    if (r.ok) location.reload();
  }));

  // ===== Delete unit =====
  document.querySelectorAll('.delete-unit-btn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this unit?')) return;
    const r = await fetch(`/api/notes/units/${b.dataset.unitId}`, { method: 'DELETE' });
    if (r.ok) location.reload();
  }));

  // ===== Delete part =====
  document.querySelectorAll('.delete-part-btn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this part?')) return;
    const r = await fetch(`/api/notes/parts/${b.dataset.partId}`, { method: 'DELETE' });
    if (r.ok) location.reload();
  }));
});
