// Profile page — avatar popup (upload/remove), bio/socials update, password change
document.addEventListener('DOMContentLoaded', () => {
  // ===== Avatar popup menu =====
  const avatarBtn = document.getElementById('avatar-btn');
  const avatarMenu = document.getElementById('avatar-menu');
  const fileInput = document.getElementById('avatar-file-input');
  const uploadBtn = document.getElementById('upload-photo-btn');
  const removeBtn = document.getElementById('remove-photo-btn');

  if (avatarBtn && avatarMenu) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarMenu.classList.toggle('hidden');
    });
    document.querySelectorAll('.cancel-avatar-menu').forEach(b => b.addEventListener('click', () => avatarMenu.classList.add('hidden')));
    document.addEventListener('click', (e) => {
      if (!avatarMenu.classList.contains('hidden') && !document.getElementById('avatar-wrap')?.contains(e.target)) {
        avatarMenu.classList.add('hidden');
      }
    });
  }

  async function uploadAvatar(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB.'); return; }
    const fd = new FormData();
    fd.append('avatar', file);
    const r = await fetch('/api/profile', { method: 'POST', body: fd });
    if (r.ok) {
      const d = await r.json();
      if (d.profile && d.profile.avatarUrl) {
        // Reload to show the new avatar everywhere
        location.reload();
      }
    } else {
      const d = await r.json(); alert(d.error || 'Failed to upload');
    }
  }

  uploadBtn?.addEventListener('click', () => {
    fileInput?.click();
    avatarMenu.classList.add('hidden');
  });
  fileInput?.addEventListener('change', (e) => uploadAvatar(e.target.files[0]));

  removeBtn?.addEventListener('click', async () => {
    const r = await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url: '' }),
    });
    if (r.ok) location.reload();
    else { const d = await r.json(); alert(d.error || 'Failed to remove'); }
  });

  // ===== Bio counter =====
  const bio = document.getElementById('profile-bio');
  const bioCount = document.getElementById('bio-count');
  bio?.addEventListener('input', () => { if (bioCount) bioCount.textContent = bio.value.length; });

  // ===== Save profile (name + bio) =====
  document.getElementById('save-profile')?.addEventListener('click', async () => {
    const name = document.getElementById('profile-name').value.trim();
    const bioVal = document.getElementById('profile-bio').value.trim();
    const r = await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio: bioVal }),
    });
    if (r.ok) toast('Profile saved', 'success');
    else { const d = await r.json(); alert(d.error || 'Failed'); }
  });

  // ===== Save socials =====
  document.getElementById('save-socials')?.addEventListener('click', async () => {
    const socials = {};
    document.querySelectorAll('#socials-form input[data-k]').forEach(inp => {
      socials[inp.dataset.k] = inp.value.trim();
    });
    const r = await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socials }),
    });
    if (r.ok) toast('Socials saved', 'success');
    else { const d = await r.json(); alert(d.error || 'Failed'); }
  });

  // ===== Change password =====
  document.getElementById('change-password-btn')?.addEventListener('click', async () => {
    const cur = document.getElementById('cur-pwd').value;
    const next = document.getElementById('new-pwd').value;
    const conf = document.getElementById('confirm-pwd').value;
    if (!cur || !next) return alert('Fill in all fields.');
    if (next.length < 6) return alert('New password must be at least 6 characters.');
    if (next !== conf) return alert('New password and confirmation do not match.');

    const r = await fetch('/api/profile/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    const d = await r.json();
    if (r.ok) {
      toast('Password changed', 'success');
      document.getElementById('cur-pwd').value = '';
      document.getElementById('new-pwd').value = '';
      document.getElementById('confirm-pwd').value = '';
    } else {
      alert(d.error || 'Failed to change password');
    }
  });
});
