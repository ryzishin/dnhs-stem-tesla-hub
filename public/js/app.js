// STEM Tesla BioHub — main client JS
// Mobile sidebar toggle + form method override helper + CSRF fetch wrapper + Lucide init.
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // Convert links with data-method="post" into forms
  document.querySelectorAll('a[data-method]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const form = document.createElement('form');
      form.method = a.dataset.method;
      form.action = a.href;
      // v2-P1-1: Attach CSRF token to method-overridden forms.
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = '_csrf';
      csrfInput.value = window.csrfToken || '';
      form.appendChild(csrfInput);
      document.body.appendChild(form);
      form.submit();
    });
  });

  // P2-6: Loading state on forms marked with data-loading.
  document.querySelectorAll('form[data-loading]').forEach(f => {
    f.addEventListener('submit', () => {
      const btn = f.querySelector('button[type=submit]');
      if (!btn || btn.disabled) return;
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = btn.dataset.loadingText || 'Loading…';
    });
  });

  // v2-P2-2: Initialize Lucide SVG icons — replace every <i data-lucide="..."> element.
  if (window.lucide) window.lucide.createIcons();
});

// v2-P1-1: Auto-attach CSRF token to every fetch POST/PUT/PATCH/DELETE.
window.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

const originalFetch = window.fetch;
window.fetch = (url, opts = {}) => {
  if (opts.method && !["GET", "HEAD"].includes(opts.method.toUpperCase())) {
    opts.headers = opts.headers || {};
    if (opts.headers instanceof Headers) {
      if (!opts.headers.has('X-CSRF-Token')) opts.headers.set('X-CSRF-Token', window.csrfToken);
    } else {
      if (!opts.headers['X-CSRF-Token']) opts.headers['X-CSRF-Token'] = window.csrfToken;
    }
  }
  return originalFetch(url, opts);
};

// v2-P2-2: Exposed for re-running after dynamic DOM updates (e.g., after fetch-rendered content).
window.refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

// v2-P3-2: Toast helper — styles now in CSS, not inline.
window.toast = (msg, type = 'default') => {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
};
