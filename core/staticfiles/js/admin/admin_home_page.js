/* ═══════════════════════════════════════════════
   admin_home_page.js
   Load AFTER home_admin.js

   Fixes:
   1. Hamburger double-fire (cloneNode to strip old listener)
   2. Homepage section navigation
   3. Hides redundant sidebar items (announcements / sections / settings)
   4. Full homepage management logic
═══════════════════════════════════════════════ */
(function () {
  'use strict';

  const BASE = '/dashboard/api/v1';
  const CSRF = (document.cookie.match(/csrftoken=([^;]*)/) || [])[1] || '';

  async function api(method, path, body = null) {
    const opts = {
      method,
      headers: { 'X-CSRFToken': CSRF, 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    if (res.status === 204) return null;
    return res.json();
  }

  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                          .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ════════════════════════════════════════════
     FIX 1 — HAMBURGER
     home_admin.js already bound a click listener
     that toggles .open. We need to REPLACE it so
     there is exactly one handler.
     cloneNode(true) strips all listeners.
  ════════════════════════════════════════════ */
  const sidebar = document.getElementById('sidebar');

  function openSidebar()  { sidebar?.classList.add('open'); }
  function closeSidebar() { sidebar?.classList.remove('open'); }

  const oldHamburger = document.getElementById('hamburger');
  if (oldHamburger && sidebar) {
    const fresh = oldHamburger.cloneNode(true);   // no listeners
    oldHamburger.parentNode.replaceChild(fresh, oldHamburger);

    fresh.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  /* Close on backdrop click */
  document.addEventListener('click', e => {
    const ham = document.getElementById('hamburger');
    if (
      sidebar?.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      e.target !== ham && !ham?.contains(e.target)
    ) {
      closeSidebar();
    }
  });

  /* Close when a nav link is tapped on mobile */
  document.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', () => {
      if (window.innerWidth <= 900) closeSidebar();
    });
  });

  /* Close-button inside sidebar (sidebar-close-btn) */
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);

  /* ════════════════════════════════════════════
     FIX 2 — HOMEPAGE NAVIGATION
     Extend adminNavigate so 'homepage' is handled.
  ════════════════════════════════════════════ */
  const _origNavigate = window.adminNavigate;

  window.adminNavigate = function (key) {
    if (key === 'homepage') {
      /* Activate nav link */
      document.querySelectorAll('.nav-link').forEach(l =>
        l.classList.toggle('active', l.dataset.section === 'homepage')
      );
      /* Activate section */
      document.querySelectorAll('.section').forEach(s =>
        s.classList.toggle('active', s.id === 'section-homepage')
      );
      /* Page title */
      const titleEl = document.getElementById('page-title');
      if (titleEl) titleEl.textContent = 'Home Page';
      /* Load data once */
      if (!window._hpLoaded) { loadHomepage(); window._hpLoaded = true; }
      return;
    }
    if (_origNavigate) _origNavigate(key);
  };

  /* Wire the nav link (home_admin.js already wires all [data-section] links
     through navigate(), which now handles 'homepage'. No extra listener needed,
     but we add a safety one in case the link was added after DOMContentLoaded.) */
  document.querySelector('.nav-link[data-section="homepage"]')
    ?.addEventListener('click', e => {
      e.preventDefault();
      window.adminNavigate('homepage');
    });

  /* ════════════════════════════════════════════
     FIX 3 — HIDE REDUNDANT SIDEBAR ITEMS
     The Home Page section now consolidates
     Announcements, Homepage Sections, and Site
     Settings. Hide their nav entries.
  ════════════════════════════════════════════ */
  ['announcements', 'sections', 'settings'].forEach(key => {
    const link = document.querySelector(`.nav-link[data-section="${key}"]`);
    if (!link) return;
    /* If the group contains only this link, hide the whole group */
    const group = link.closest('.nav-group');
    const sibs  = group?.querySelectorAll('.nav-link');
    if (sibs && sibs.length === 1) {
      group.style.display = 'none';
    } else {
      link.style.display = 'none';
    }
  });

  /* ════════════════════════════════════════════
     HOMEPAGE DATA & LOGIC
  ════════════════════════════════════════════ */
  let _hpSettings = {};
  let _hpAnn      = [];
  let _hpSections = [];
  let _hpPosts    = [];

  async function loadHomepage() {
    try {
      [_hpSettings, _hpAnn, _hpSections, _hpPosts] = await Promise.all([
        api('GET', '/site-settings/'),
        api('GET', '/announcements/'),
        api('GET', '/homepage-sections/'),
        api('GET', '/posts/'),
      ]);
      fillHeroForm();
      renderHpAnnList();
      renderHpSections();
      updateCfStats();
    } catch (err) {
      console.error('[homepage]', err);
      toast('Failed to load home page data', 'error');
    }
  }

  /* ── Hero form ── */
  function fillHeroForm() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('hp-site-title',  _hpSettings?.site_title);
    set('hp-hero-text',   _hpSettings?.homepage_hero_text);
    set('hp-footer-text', _hpSettings?.footer_text);
    updatePreview();
  }

  document.getElementById('hp-site-title')?.addEventListener('input', updatePreview);
  document.getElementById('hp-hero-text')?.addEventListener('input',  updatePreview);

  function updatePreview() {
    const title = document.getElementById('hp-site-title')?.value || 'MEDSCRIPT';
    const sub   = document.getElementById('hp-hero-text')?.value  || '';
    const t = document.getElementById('hp-preview-title');
    const s = document.getElementById('hp-preview-sub');
    if (t) t.textContent = title;
    if (s) s.textContent = sub.slice(0, 80) + (sub.length > 80 ? '…' : '');
  }

  document.getElementById('hp-save-all-btn')?.addEventListener('click', saveAll);

  async function saveAll() {
    const payload = {
      site_title:         document.getElementById('hp-site-title')?.value  || '',
      homepage_hero_text: document.getElementById('hp-hero-text')?.value   || '',
      footer_text:        document.getElementById('hp-footer-text')?.value || '',
    };
    try {
      await api('PATCH', '/site-settings/', payload);
      _hpSettings = { ..._hpSettings, ...payload };
      toast('Home page settings saved ✓');
    } catch { toast('Save failed', 'error'); }
  }

  /* ── Announcements ── */
  function renderHpAnnList() {
    const el = document.getElementById('hp-ann-list');
    if (!el) return;
    if (!_hpAnn.length) {
      el.innerHTML = '<p style="color:var(--text-3);font-size:13px">No announcements yet.</p>';
      return;
    }
    el.innerHTML = _hpAnn.map(a => `
      <div class="hp-ann-item ${a.is_active ? 'active-ann' : ''}">
        <span class="hp-ann-dot ${a.is_active ? 'on' : 'off'}"></span>
        <span class="hp-ann-title">${esc(a.title || 'Untitled')}</span>
        <span class="hp-ann-date">${a.published_date || '—'}</span>
        <div class="action-btns" style="flex-shrink:0">
          <button class="action-btn ${a.is_active ? '' : 'success'}"
            title="${a.is_active ? 'Deactivate' : 'Activate'}"
            onclick="window._hpToggleAnn(${a.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${a.is_active
                ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
                : '<polyline points="20 6 9 17 4 12"/>'}
            </svg>
          </button>
        </div>
      </div>`).join('');
  }

  window._hpToggleAnn = async (id) => {
    try {
      const res = await api('PATCH', `/announcements/${id}/toggle-active/`);
      const idx = _hpAnn.findIndex(a => a.id === id);
      if (idx !== -1) _hpAnn[idx].is_active = res.is_active;
      renderHpAnnList();
      toast(res.is_active ? 'Banner activated ✓' : 'Banner deactivated');
    } catch { toast('Toggle failed', 'error'); }
  };

  /* "+ New Announcement" opens the existing ann modal */
  document.getElementById('hp-new-ann-btn')?.addEventListener('click', () => {
    const annModal = document.getElementById('ann-modal');
    if (!annModal) return;
    document.getElementById('ann-id').value = '';
    document.getElementById('ann-form')?.reset();
    document.getElementById('ann-modal-title').textContent = 'New Announcement';
    document.getElementById('ann-date-inp').value = new Date().toISOString().slice(0, 10);
    annModal.classList.add('open');
  });

  /* Refresh hp list after the shared ann-form saves */
  document.getElementById('ann-form')?.addEventListener('submit', () => {
    setTimeout(async () => {
      try { _hpAnn = await api('GET', '/announcements/'); renderHpAnnList(); } catch { /* ignore */ }
    }, 600);
  });

  /* ── Coverflow stats ── */
  function updateCfStats() {
    /* status_display is 'published'/'draft' from PostAdminSerializer */
    const published = _hpPosts.filter(p =>
      p.status_display === 'published' || p.status === 'published'
    );
    const drafts = _hpPosts.filter(p =>
      p.status_display === 'draft' || p.status === 'draft'
    );
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('hp-cf-latest',    Math.min(5, published.length));
    set('hp-cf-popular',   Math.min(5, published.length));
    set('hp-cf-published', published.length);
    set('hp-cf-draft',     drafts.length);
  }

  /* ── Page sections (drag + toggle) ── */
  const SECTION_LABELS = {
    hero:     'Hero Banner',
    features: 'Feature Rows',
    about:    'About',
    cta:      'Call to Action',
    contact:  'Contact',
    latest:   'Latest Posts',
    popular:  'Most Viewed',
    custom:   'Custom',
  };
  const SECTION_DESC = {
    hero:     'Full-screen hero with title, subtitle and CTA buttons',
    features: 'Three diagonal feature rows explaining MedScript',
    latest:   'Coverflow — 5 most recently published posts',
    popular:  'Coverflow — 5 most-viewed posts',
  };

  function renderHpSections() {
    const el = document.getElementById('hp-sections-list');
    if (!el) return;
    if (!_hpSections.length) {
      el.innerHTML = '<p style="color:var(--text-3);font-size:13px">No sections configured.</p>';
      return;
    }
    el.innerHTML = _hpSections.map((s, i) => `
      <div class="section-row" data-id="${s.id}" draggable="true">
        <div class="drag-handle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9"  cy="5"  r="1" fill="currentColor"/>
            <circle cx="15" cy="5"  r="1" fill="currentColor"/>
            <circle cx="9"  cy="12" r="1" fill="currentColor"/>
            <circle cx="15" cy="12" r="1" fill="currentColor"/>
            <circle cx="9"  cy="19" r="1" fill="currentColor"/>
            <circle cx="15" cy="19" r="1" fill="currentColor"/>
          </svg>
        </div>
        <span class="section-order">${i + 1}</span>
        <div class="section-type">
          <div class="section-type-name">${SECTION_LABELS[s.section_type] || s.section_type}</div>
          <div class="section-type-key">${esc(SECTION_DESC[s.section_type] || s.section_type)}</div>
        </div>
        <label class="toggle">
          <input type="checkbox" ${s.is_active ? 'checked' : ''}
            onchange="window._hpToggleSection(${s.id}, this.checked)" />
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>`).join('');
    initHpDragDrop();
  }

  window._hpToggleSection = async (id, active) => {
    try {
      await api('PATCH', `/homepage-sections/${id}/toggle-active/`);
      const idx = _hpSections.findIndex(s => s.id === id);
      if (idx !== -1) _hpSections[idx].is_active = active;
      toast(active ? 'Section shown ✓' : 'Section hidden');
    } catch { toast('Toggle failed', 'error'); }
  };

  document.getElementById('hp-save-order-btn')?.addEventListener('click', async () => {
    const order = Array.from(document.querySelectorAll('#hp-sections-list .section-row'))
      .map(r => parseInt(r.dataset.id));
    try {
      await api('POST', '/homepage-sections/reorder/', { order });
      toast('Section order saved ✓');
      const map = Object.fromEntries(_hpSections.map(s => [s.id, s]));
      _hpSections = order.map(id => map[id]);
    } catch { toast('Save failed', 'error'); }
  });

  function initHpDragDrop() {
    const list = document.getElementById('hp-sections-list');
    let dragged = null;
    list?.querySelectorAll('.section-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragged = row;
        setTimeout(() => row.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        list.querySelectorAll('.section-row').forEach(r => r.classList.remove('drag-over'));
        dragged = null;
        list.querySelectorAll('.section-order').forEach((el, i) => el.textContent = i + 1);
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (row === dragged) return;
        list.querySelectorAll('.section-row').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
        const b = row.getBoundingClientRect();
        list.insertBefore(dragged, e.clientY < b.y + b.height / 2 ? row : row.nextSibling);
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => e.preventDefault());
    });
  }

})();