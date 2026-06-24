/* ═══════════════════════════════════════════════
   MedNotes Admin — Dashboard JS
   home_admin.js
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  const BASE = '/dashboard/api/v1';
  const CSRF = getCookie('csrftoken');

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  async function api(method, path, body = null, isFormData = false) {
    const opts = { method, headers: { 'X-CSRFToken': CSRF }, credentials: 'same-origin' };
    if (body) {
      if (isFormData) { opts.body = body; }
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    const res = await fetch(BASE + path, opts);
    if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
    if (res.status === 204) return null;
    return res.json();
  }

  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  function fmt(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }

  function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  document.querySelectorAll('.modal-overlay:not(#post-modal)').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
  });
  document.querySelectorAll('[data-modal]:not(.pe-back-btn)').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  /* ── Sidebar Nav ── */
  const pageTitles = {
    dashboard:'Dashboard', posts:'Medical Notes',
    announcements:'Announcements', sections:'Homepage Sections', settings:'Site Settings',
  };
  const pageTitleExtras = {
    comments:'Comments', tags:'Tags', categories:'Categories',
    users:'Users', positions:'Positions',
  };

  function navigate(sectionKey) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === sectionKey));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `section-${sectionKey}`));
    document.getElementById('page-title').textContent = pageTitles[sectionKey] || pageTitleExtras[sectionKey] || sectionKey;

    if (sectionKey === 'posts'         && !window._postsLoaded)    { loadPosts();    window._postsLoaded    = true; }
    if (sectionKey === 'announcements' && !window._annLoaded)      { loadAnn();      window._annLoaded      = true; }
    if (sectionKey === 'sections'      && !window._sectionsLoaded) { loadSections(); window._sectionsLoaded = true; }
    if (sectionKey === 'settings'      && !window._settingsLoaded) { loadSettings(); window._settingsLoaded = true; }

    if (window.extLazyLoad) window.extLazyLoad(sectionKey);
  }

  window.adminNavigate = navigate;

  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); navigate(link.dataset.section); });
  });
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.goto));
  });

  const sidebar = document.getElementById('sidebar');
  document.getElementById('hamburger').addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target.id !== 'hamburger')
      sidebar.classList.remove('open');
  });

  /* ── Theme ── */
  const themeBtn = document.getElementById('theme-toggle');
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeBtn.querySelector('.icon-moon').style.display = t === 'dark'  ? '' : 'none';
    themeBtn.querySelector('.icon-sun').style.display  = t === 'light' ? '' : 'none';
    localStorage.setItem('mednotes-theme', t);
  }
  applyTheme(localStorage.getItem('mednotes-theme') || 'dark');
  themeBtn.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ── Refresh ── */
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.add('spinning');
    window._postsLoaded = window._annLoaded = window._sectionsLoaded = window._settingsLoaded = false;
    if (window.extReloadAll) window.extReloadAll();
    Promise.all([loadDashboard()]).finally(() => {
      refreshBtn.classList.remove('spinning');
      const cur = document.querySelector('.nav-link.active');
      if (cur && cur.dataset.section !== 'dashboard') navigate(cur.dataset.section);
    });
  });

  /* ── API Status ── */
  const statusDot  = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  async function checkAPI() {
    try {
      await api('GET', '/site-settings/');
      statusDot.className   = 'status-dot ok';
      statusText.textContent = 'API';
    } catch {
      statusDot.className   = 'status-dot err';
      statusText.textContent = 'API ✗';
    }
  }

  /* ── Dashboard ── */
  async function loadDashboard() {
    try {
      const [posts, anns, sections, settings] = await Promise.all([
        api('GET', '/posts/'),
        api('GET', '/announcements/'),
        api('GET', '/homepage-sections/'),
        api('GET', '/site-settings/'),
      ]);

      const published = posts.filter(p => p.status_display === 'published');
      const drafts    = posts.filter(p => p.status_display === 'draft');

      document.getElementById('stat-published').textContent  = published.length;
      document.getElementById('stat-drafts').textContent     = drafts.length;
      document.getElementById('stat-ann').textContent        = anns.filter(a => a.is_active).length;
      document.getElementById('stat-sections').textContent   = sections.filter(s => s.is_active).length;
      document.getElementById('nav-posts-count').textContent = posts.length;
      document.getElementById('nav-ann-count').textContent   = anns.length;

      const recentEl = document.getElementById('dash-recent-posts');
      recentEl.innerHTML = !posts.length
        ? '<p style="color:var(--text-3);font-size:13px">No notes yet.</p>'
        : posts.slice(0, 6).map(p => `
            <div class="dash-post-item">
              <span class="dash-post-status ${p.status_display === 'published' ? 'pub' : 'dft'}"></span>
              <span class="dash-post-title">${escHtml(p.title)}</span>
              <span class="dash-post-date">${fmt(p.published_date)}</span>
            </div>`).join('');

      document.getElementById('dash-settings-snap').innerHTML = `
        <div class="snap-row"><div class="snap-key">Site Title</div><div class="snap-val">${escHtml(settings?.site_title || '—')}</div></div>
        <div class="snap-row"><div class="snap-key">Footer</div><div class="snap-val">${escHtml(settings?.footer_text || '—')}</div></div>
        <div class="snap-row"><div class="snap-key">Hero Text</div><div class="snap-val">${escHtml((settings?.homepage_hero_text || '—').slice(0,80))}${(settings?.homepage_hero_text?.length > 80) ? '…' : ''}</div></div>`;
    } catch (err) {
      console.error('Dashboard load error', err);
    }
  }

  /* ── Posts ── */
  let allPosts = [];

  async function loadPosts() {
    const tbody = document.getElementById('posts-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row"><div class="spinner"></div></td></tr>';
    try {
      allPosts = await api('GET', '/posts/');
      renderPostsTable(allPosts);
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px">Failed to load notes.</td></tr>';
    }
  }

  function renderPostsTable(posts) {
    const tbody = document.getElementById('posts-tbody');
    if (!posts.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:30px">No notes found.</td></tr>';
      return;
    }
    tbody.innerHTML = posts.map(p => `
      <tr>
        <td><strong>${escHtml(p.title)}</strong></td>
        <td><span class="badge ${p.status_display === 'published' ? 'badge-pub' : 'badge-dft'}">${p.status_display}</span></td>
        <td>${fmt(p.published_date)}</td>
        <td style="font-family:'JetBrains Mono',monospace">${p.hit_count ?? 0}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn" title="Edit" onclick="window._editPost(${p.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${p.status === 'draft'
              ? `<button class="action-btn success" title="Publish" onclick="window._togglePublish(${p.id},'publish')">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                 </button>`
              : `<button class="action-btn" title="Unpublish" onclick="window._togglePublish(${p.id},'unpublish')">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 </button>`}
            <button class="action-btn danger" title="Delete" onclick="window._deletePost(${p.id},'${escAttr(p.title)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  window.renderPostsTable = renderPostsTable;
  window.allPosts = allPosts;

  function filterPosts() {
    const q      = document.getElementById('posts-search').value.toLowerCase();
    const status = document.getElementById('posts-filter').value;
    renderPostsTable(allPosts.filter(p =>
      p.title.toLowerCase().includes(q) &&
      (status === '' || p.status_display === status)
    ));
  }
  document.getElementById('posts-search').addEventListener('input', filterPosts);
  document.getElementById('posts-filter').addEventListener('change', filterPosts);

  window._editPost = (id) => { if (window._openPostEditor) window._openPostEditor(id); };
  document.getElementById('new-post-btn').addEventListener('click', () => {
    if (window._openPostEditor) window._openPostEditor(null);
  });

  window._togglePublish = async (id, action) => {
    try {
      await api('PATCH', `/posts/${id}/${action}/`);
      toast(action === 'publish' ? 'Note published ✓' : 'Note unpublished');
      allPosts = await api('GET', '/posts/');
      window.allPosts = allPosts;
      renderPostsTable(allPosts);
    } catch { toast('Action failed', 'error'); }
  };

  window._deletePost = (id, title) => {
    document.getElementById('confirm-text').textContent = `Delete "${title}"? This cannot be undone.`;
    openModal('confirm-modal');
    document.getElementById('confirm-ok').onclick = async () => {
      closeModal('confirm-modal');
      try {
        await api('DELETE', `/posts/${id}/`);
        allPosts = allPosts.filter(p => p.id !== id);
        window.allPosts = allPosts;
        renderPostsTable(allPosts);
        toast('Note deleted');
        document.getElementById('stat-published').textContent = allPosts.filter(p=>p.status==='published').length;
        document.getElementById('stat-drafts').textContent    = allPosts.filter(p=>p.status==='draft').length;
      } catch { toast('Delete failed', 'error'); }
    };
  };

  /* ── Announcements ── */
  let allAnn = [];

  async function loadAnn() {
    const grid = document.getElementById('ann-grid');
    grid.innerHTML = '<div class="glass panel loading-panel"><div class="spinner"></div></div>';
    try {
      allAnn = await api('GET', '/announcements/');
      renderAnnGrid();
    } catch {
      grid.innerHTML = '<p style="color:var(--danger)">Failed to load announcements.</p>';
    }
  }

  function renderAnnGrid() {
    const grid = document.getElementById('ann-grid');
    if (!allAnn.length) {
      grid.innerHTML = '<p style="color:var(--text-3);font-size:13px">No announcements yet. Create one!</p>';
      return;
    }
    grid.innerHTML = allAnn.map(a => `
      <div class="glass ann-card">
        <div class="ann-card-head">
          <span class="ann-card-title">${escHtml(a.title || 'Untitled')}</span>
          <span class="active-badge ${a.is_active ? 'on' : 'off'}">${a.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="ann-card-body">${escHtml((a.body || '').slice(0, 120))}${(a.body||'').length > 120 ? '…' : ''}</div>
        <div class="ann-card-foot">
          <span class="ann-card-date">${fmt(a.published_date)}</span>
          <div class="ann-card-actions">
            <button class="action-btn" title="Edit" onclick="window._editAnn(${a.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn ${a.is_active ? '' : 'success'}" title="${a.is_active ? 'Deactivate' : 'Activate'}" onclick="window._toggleAnn(${a.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${a.is_active ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' : '<polyline points="20 6 9 17 4 12"/>'}
              </svg>
            </button>
            <button class="action-btn danger" title="Delete" onclick="window._deleteAnn(${a.id},'${escAttr(a.title)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`).join('');
  }

  document.getElementById('new-ann-btn').addEventListener('click', () => {
    document.getElementById('ann-id').value = '';
    document.getElementById('ann-form').reset();
    document.getElementById('ann-modal-title').textContent = 'New Announcement';
    document.getElementById('ann-date-inp').value = new Date().toISOString().slice(0,10);
    openModal('ann-modal');
  });

  window._editAnn = (id) => {
    const a = allAnn.find(x => x.id === id);
    if (!a) return;
    document.getElementById('ann-id').value           = a.id;
    document.getElementById('ann-title-inp').value    = a.title || '';
    document.getElementById('ann-body-inp').value     = a.body  || '';
    document.getElementById('ann-date-inp').value     = a.published_date || '';
    document.getElementById('ann-active-inp').checked = !!a.is_active;
    document.getElementById('ann-modal-title').textContent = 'Edit Announcement';
    openModal('ann-modal');
  };

  window._toggleAnn = async (id) => {
    try {
      const res = await api('PATCH', `/announcements/${id}/toggle-active/`);
      const idx = allAnn.findIndex(a => a.id === id);
      if (idx !== -1) allAnn[idx].is_active = res.is_active;
      renderAnnGrid();
      toast(res.is_active ? 'Announcement activated ✓' : 'Announcement deactivated');
    } catch { toast('Toggle failed', 'error'); }
  };

  window._deleteAnn = (id, title) => {
    document.getElementById('confirm-text').textContent = `Delete announcement "${title}"?`;
    openModal('confirm-modal');
    document.getElementById('confirm-ok').onclick = async () => {
      closeModal('confirm-modal');
      try {
        await api('DELETE', `/announcements/${id}/`);
        allAnn = allAnn.filter(a => a.id !== id);
        renderAnnGrid();
        toast('Announcement deleted');
      } catch { toast('Delete failed', 'error'); }
    };
  };

  document.getElementById('ann-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('ann-id').value;
    const payload = {
      title:          document.getElementById('ann-title-inp').value,
      body:           document.getElementById('ann-body-inp').value,
      published_date: document.getElementById('ann-date-inp').value,
      is_active:      document.getElementById('ann-active-inp').checked,
    };
    try {
      if (id) {
        const updated = await api('PATCH', `/announcements/${id}/`, payload);
        const idx = allAnn.findIndex(a => a.id === parseInt(id));
        if (idx !== -1) allAnn[idx] = updated;
        toast('Announcement updated ✓');
      } else {
        allAnn.unshift(await api('POST', '/announcements/', payload));
        toast('Announcement created ✓');
      }
      closeModal('ann-modal');
      renderAnnGrid();
    } catch { toast('Save failed', 'error'); }
  });

  /* ── Homepage Sections ── */
  let allSections = [];
  const sectionLabels = { hero:'Hero Banner', features:'Features', about:'About', cta:'Call to Action', contact:'Contact' };

  async function loadSections() {
    const list = document.getElementById('sections-list');
    list.innerHTML = '<div class="spinner"></div>';
    try {
      allSections = await api('GET', '/homepage-sections/');
      renderSectionsList();
    } catch {
      list.innerHTML = '<p style="color:var(--danger)">Failed to load sections.</p>';
    }
  }

  function renderSectionsList() {
    const list = document.getElementById('sections-list');
    if (!allSections.length) { list.innerHTML = '<p style="color:var(--text-3);font-size:13px">No sections found.</p>'; return; }
    list.innerHTML = allSections.map((s, i) => `
      <div class="section-row" data-id="${s.id}" draggable="true">
        <div class="drag-handle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></svg></div>
        <span class="section-order">${i + 1}</span>
        <div class="section-type">
          <div class="section-type-name">${sectionLabels[s.section_type] || s.section_type}</div>
          <div class="section-type-key">${s.section_type}</div>
        </div>
        <span class="section-title-text">${escHtml(s.title || '')}</span>
        <label class="toggle" title="${s.is_active ? 'Deactivate' : 'Activate'}">
          <input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="window._toggleSection(${s.id},this.checked)" />
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
        </label>
      </div>`).join('');
    initDragDrop();
  }

  window._toggleSection = async (id, active) => {
    try {
      await api('PATCH', `/homepage-sections/${id}/toggle-active/`);
      const idx = allSections.findIndex(s => s.id === id);
      if (idx !== -1) allSections[idx].is_active = active;
      toast(active ? 'Section activated ✓' : 'Section hidden');
    } catch { toast('Toggle failed', 'error'); loadSections(); }
  };

  document.getElementById('save-order-btn').addEventListener('click', async () => {
    const order = Array.from(document.querySelectorAll('#sections-list .section-row')).map(r => parseInt(r.dataset.id));
    try {
      await api('POST', '/homepage-sections/reorder/', { order });
      toast('Section order saved ✓');
      const map = Object.fromEntries(allSections.map(s => [s.id, s]));
      allSections = order.map(id => map[id]);
    } catch { toast('Save order failed', 'error'); }
  });

  function initDragDrop() {
    const list = document.getElementById('sections-list');
    let dragged = null;
    list.querySelectorAll('.section-row').forEach(row => {
      row.addEventListener('dragstart', e => { dragged = row; setTimeout(() => row.classList.add('dragging'), 0); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); list.querySelectorAll('.section-row').forEach(r => r.classList.remove('drag-over')); dragged = null; list.querySelectorAll('.section-order').forEach((el, i) => el.textContent = i + 1); });
      row.addEventListener('dragover', e => { e.preventDefault(); if (row === dragged) return; list.querySelectorAll('.section-row').forEach(r => r.classList.remove('drag-over')); row.classList.add('drag-over'); const b = row.getBoundingClientRect(); list.insertBefore(dragged, e.clientY < b.y + b.height / 2 ? row : row.nextSibling); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => e.preventDefault());
    });
  }

  /* ── Site Settings ── */
  let _settingsOriginal = {};

  async function loadSettings() {
    try {
      const data = await api('GET', '/site-settings/');
      _settingsOriginal = data || {};
      fillSettings(data);
    } catch { toast('Failed to load settings', 'error'); }
  }

  function fillSettings(data) {
    document.getElementById('s-title').value   = data?.site_title         || '';
    document.getElementById('s-hero').value    = data?.homepage_hero_text || '';
    document.getElementById('s-contact').value = data?.contact_info       || '';
    document.getElementById('s-footer').value  = data?.footer_text        || '';
  }

  document.getElementById('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('settings-save-btn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    const payload = {
      site_title:         document.getElementById('s-title').value,
      homepage_hero_text: document.getElementById('s-hero').value,
      contact_info:       document.getElementById('s-contact').value,
      footer_text:        document.getElementById('s-footer').value,
    };
    try {
      await api('PATCH', '/site-settings/', payload);
      _settingsOriginal = { ..._settingsOriginal, ...payload };
      toast('Settings saved ✓');
    } catch { toast('Save failed', 'error'); }
    finally { btn.textContent = 'Save Settings'; btn.disabled = false; }
  });

  document.getElementById('settings-reset-btn').addEventListener('click', () => {
    fillSettings(_settingsOriginal);
    toast('Reset to last saved values');
  });

  /* ── Tilt ── */
  function initTilt() {
    document.querySelectorAll('.tilt').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        card.style.transform = `perspective(800px) rotateX(${(e.clientY - r.top - r.height/2)/18}deg) rotateY(${(r.width/2 - (e.clientX - r.left))/18}deg) translateZ(8px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function escAttr(s) { return String(s ?? '').replace(/'/g,"\\'"); }

  async function init() {
    await checkAPI();
    await loadDashboard();
    window._dashLoaded = true;
    initTilt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* ═══════════════════════════════════════════════
   EXTENDED ADMIN JS
   Comments · Tags · Categories · Users · Positions
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  const BASE = '/dashboard/api/v1';
  const CSRF = (document.cookie.match(/csrftoken=([^;]*)/) || [])[1] || '';

  async function api(method, path, body = null, isFormData = false) {
    const opts = { method, headers: { 'X-CSRFToken': CSRF }, credentials: 'same-origin' };
    if (body) {
      if (isFormData) { opts.body = body; }
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    const res = await fetch(BASE + path, opts);
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    if (res.status === 204) return null;
    return res.json();
  }

  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  ['tag-modal','pos-modal','user-modal','comment-view-modal'].forEach(id => {
    const ov = document.getElementById(id);
    if (!ov) return;
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(id); });
  });
  document.querySelectorAll('[data-modal]:not(.pe-acc-trigger)').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
  });

  const extraSections = ['comments','tags','categories','users','positions'];
  extraSections.forEach(key => {
    const link = document.querySelector(`.nav-link[data-section="${key}"]`);
    if (!link) return;
    link.addEventListener('click', e => {
      e.preventDefault();
      if (window.adminNavigate) { window.adminNavigate(key); return; }
      document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l === link));
      document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `section-${key}`));
      document.getElementById('page-title').textContent = { comments:'Comments', tags:'Tags', categories:'Categories', users:'Users', positions:'Positions' }[key];
      lazyLoad(key);
    });
  });

  const _loaded = {};
  function lazyLoad(key) {
    if (_loaded[key]) return;
    _loaded[key] = true;
    if (key === 'comments')   loadComments();
    if (key === 'tags')       loadTags();
    if (key === 'categories') loadCategories();
    if (key === 'users')      loadUsers();
    if (key === 'positions')  loadPositions();
  }

  window.extLazyLoad  = lazyLoad;
  window.extReloadAll = () => { Object.keys(_loaded).forEach(k => { _loaded[k] = false; }); };

  /* ════════ COMMENTS ════════ */
  let allComments = [];
  const CSTATUS = { 1:'Pending', 2:'Approved', 3:'Rejected' };
  const CCLASS  = { 1:'badge-pending', 2:'badge-approved', 3:'badge-rejected' };

  async function loadComments() {
    const tbody = document.getElementById('comments-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row"><div class="spinner"></div></td></tr>';
    const statusVal = document.getElementById('comments-filter').value;
    try {
      allComments = await api('GET', statusVal ? `/comments/?status=${statusVal}` : '/comments/');
      renderComments();
    } catch {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger);padding:20px">Failed to load.</td></tr>';
    }
  }

  function renderComments() {
    const tbody = document.getElementById('comments-tbody');
    const label = document.getElementById('comments-count-label');
    if (label) label.textContent = `${allComments.length} comment${allComments.length !== 1 ? 's' : ''}`;
    const pending = allComments.filter(c => c.status === 1).length;
    const badge   = document.getElementById('nav-comments-count');
    if (badge) badge.textContent = pending ? `${pending}` : allComments.length;
    if (!allComments.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:30px">No comments found.</td></tr>'; return; }
    tbody.innerHTML = allComments.map(c => `
      <tr>
        <td>${c.parent_snippet ? `<span class="reply-indicator" title="Reply to: ${esc(c.parent_snippet)}">↩</span>` : ''}</td>
        <td><div class="comment-snippet" onclick="window._viewComment(${c.id})">${esc(c.body)}</div></td>
        <td style="font-size:13px">${esc(c.author_name)}</td>
        <td style="font-size:12px;color:var(--text-3);max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.post_title)}</td>
        <td><span class="badge ${CCLASS[c.status] || ''}">${CSTATUS[c.status] || c.status}</span></td>
        <td style="font-size:11px;color:var(--text-3);font-family:'JetBrains Mono',monospace">${fmt(c.created_date)}</td>
        <td><div class="action-btns">
          ${c.status !== 2 ? `<button class="action-btn success" title="Approve" onclick="window._approveComment(${c.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
          ${c.status !== 3 ? `<button class="action-btn danger"  title="Reject"  onclick="window._rejectComment(${c.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
          <button class="action-btn danger" title="Delete" onclick="window._deleteComment(${c.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div></td>
      </tr>`).join('');
  }

  document.getElementById('comments-filter')?.addEventListener('change', () => {
    _loaded['comments'] = false; loadComments(); _loaded['comments'] = true;
  });

  window._viewComment = (id) => {
    const c = allComments.find(x => x.id === id);
    if (!c) return;
    document.getElementById('comment-view-body').innerHTML = `
      <div class="comment-detail-meta">
        <div><span>Author</span><br/>${esc(c.author_name)}</div>
        <div><span>Post</span><br/>${esc(c.post_title)}</div>
        <div><span>Date</span><br/>${fmt(c.created_date)}</div>
        <div><span>Status</span><br/><span class="badge ${CCLASS[c.status] || ''}">${CSTATUS[c.status] || ''}</span></div>
        ${c.parent_snippet ? `<div style="grid-column:span 2"><span>Reply to</span><br/><em style="color:var(--text-3)">"${esc(c.parent_snippet)}"</em></div>` : ''}
      </div>
      <div class="comment-detail-body">${esc(c.body)}</div>
      <div class="comment-detail-actions">
        ${c.status !== 2 ? `<button class="btn btn-primary" onclick="window._approveComment(${c.id});closeModal('comment-view-modal')">Approve</button>` : ''}
        ${c.status !== 3 ? `<button class="btn btn-danger"  onclick="window._rejectComment(${c.id});closeModal('comment-view-modal')">Reject</button>`  : ''}
      </div>`;
    openModal('comment-view-modal');
  };

  window._approveComment = async (id) => {
    try { await api('PATCH', `/comments/${id}/approve/`); const c = allComments.find(x => x.id === id); if (c) c.status = 2; renderComments(); toast('Comment approved ✓'); }
    catch { toast('Failed', 'error'); }
  };
  window._rejectComment = async (id) => {
    try { await api('PATCH', `/comments/${id}/reject/`); const c = allComments.find(x => x.id === id); if (c) c.status = 3; renderComments(); toast('Comment rejected'); }
    catch { toast('Failed', 'error'); }
  };
  window._deleteComment = (id) => {
    document.getElementById('confirm-text').textContent = 'Permanently delete this comment?';
    openModal('confirm-modal');
    document.getElementById('confirm-ok').onclick = async () => {
      closeModal('confirm-modal');
      try { await api('DELETE', `/comments/${id}/`); allComments = allComments.filter(c => c.id !== id); renderComments(); toast('Comment deleted'); }
      catch { toast('Delete failed', 'error'); }
    };
  };

  /* ════════ TAGS (with search) ════════ */
  let allTags = [];

  async function loadTags() {
    const tbody = document.getElementById('tags-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading-row"><div class="spinner"></div></td></tr>';
    try {
      allTags = await api('GET', '/tags/');
      const badge = document.getElementById('nav-tags-count');
      if (badge) badge.textContent = allTags.length;
      renderTagsTable();
    } catch {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--danger);text-align:center;padding:20px">Failed.</td></tr>';
    }
  }

  /* Wire search input — safe even before tags load */
  document.getElementById('tags-search')?.addEventListener('input', () => {
    renderTagsTable((document.getElementById('tags-search').value || '').toLowerCase());
  });

  function renderTagsTable(query = '') {
    const tbody    = document.getElementById('tags-tbody');
    const filtered = query
      ? allTags.filter(t => t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query))
      : allTags;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-3);text-align:center;padding:30px">${
        query ? `No tags matching "${esc(query)}"` : 'No tags yet.'
      }</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(t => `
      <tr>
        <td><strong>${esc(t.name)}</strong></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-3)">${esc(t.slug)}</td>
        <td style="font-family:'JetBrains Mono',monospace">${t.post_count ?? 0}</td>
        <td><div class="action-btns">
          <button class="action-btn" title="Edit" onclick="window._editTag(${t.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn danger" title="Delete" onclick="window._deleteTag(${t.id},'${esc(t.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div></td>
      </tr>`).join('');
  }

  function currentTagQuery() {
    return (document.getElementById('tags-search')?.value || '').toLowerCase();
  }

  document.getElementById('new-tag-btn')?.addEventListener('click', () => {
    document.getElementById('tag-id').value = '';
    document.getElementById('tag-form').reset();
    document.getElementById('tag-modal-title').textContent = 'New Tag';
    openModal('tag-modal');
  });

  window._editTag = (id) => {
    const t = allTags.find(x => x.id === id);
    if (!t) return;
    document.getElementById('tag-id').value       = t.id;
    document.getElementById('tag-name-inp').value = t.name;
    document.getElementById('tag-modal-title').textContent = 'Edit Tag';
    openModal('tag-modal');
  };

  window._deleteTag = (id, name) => {
    document.getElementById('confirm-text').textContent = `Delete tag "${name}"?`;
    openModal('confirm-modal');
    document.getElementById('confirm-ok').onclick = async () => {
      closeModal('confirm-modal');
      try {
        await api('DELETE', `/tags/${id}/`);
        allTags = allTags.filter(t => t.id !== id);
        renderTagsTable(currentTagQuery());
        toast('Tag deleted');
      } catch { toast('Delete failed', 'error'); }
    };
  };

  document.getElementById('tag-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id      = document.getElementById('tag-id').value;
    const payload = { name: document.getElementById('tag-name-inp').value };
    try {
      if (id) {
        const updated = await api('PATCH', `/tags/${id}/`, payload);
        const idx = allTags.findIndex(t => t.id === parseInt(id));
        if (idx !== -1) allTags[idx] = { ...allTags[idx], ...updated };
        toast('Tag updated ✓');
      } else {
        allTags.push(await api('POST', '/tags/', payload));
        toast('Tag created ✓');
      }
      closeModal('tag-modal');
      renderTagsTable(currentTagQuery());
      const badge = document.getElementById('nav-tags-count');
      if (badge) badge.textContent = allTags.length;
    } catch { toast('Save failed', 'error'); }
  });

  /* ════════ CATEGORIES ════════ */
  let allCatsFlat = [];
  let catRoots    = [];

  async function loadCategories() {
    const treeEl = document.getElementById('cat-tree');
    treeEl.innerHTML = '<div class="spinner"></div>';
    try {
      catRoots    = await api('GET', '/categories/');
      allCatsFlat = flattenCats(catRoots, []);
      renderCatTree();
      populateCatParentSelect(null);
    } catch {
      treeEl.innerHTML = '<p style="color:var(--danger)">Failed to load.</p>';
    }
  }

  function flattenCats(nodes, acc, depth = 0) {
    nodes.forEach(n => { acc.push({ id:n.id, name:n.name, slug:n.slug, depth }); if (n.children?.length) flattenCats(n.children, acc, depth + 1); });
    return acc;
  }

  function populateCatParentSelect(excludeId) {
    const sel = document.getElementById('cat-edit-parent');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Root (no parent) —</option>' +
      allCatsFlat.filter(c => c.id !== excludeId).map(c => `<option value="${c.id}">${'— '.repeat(c.depth)}${esc(c.name)}</option>`).join('');
  }

  function renderCatTree() {
    const treeEl = document.getElementById('cat-tree');
    if (!catRoots.length) { treeEl.innerHTML = '<p style="color:var(--text-3);font-size:13px">No categories yet.</p>'; return; }
    treeEl.innerHTML = catRoots.map(n => renderCatNode(n)).join('');
    treeEl.querySelectorAll('.cat-toggle').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); const ch = btn.closest('.cat-node').querySelector('.cat-children'); if (ch) { ch.classList.toggle('open'); btn.classList.toggle('open'); } });
    });
    treeEl.querySelectorAll('.cat-node-row').forEach(row => {
      row.addEventListener('click', e => { if (e.target.closest('.cat-toggle') || e.target.closest('.cat-add-child')) return; treeEl.querySelectorAll('.cat-node-row').forEach(r => r.classList.remove('selected')); row.classList.add('selected'); openCatEdit(parseInt(row.dataset.id)); });
    });
    treeEl.querySelectorAll('.cat-add-child').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openCatNew(parseInt(btn.dataset.parent)); });
    });
  }

  function renderCatNode(node) {
    const has = node.children?.length;
    return `<div class="cat-node">
      <div class="cat-node-row" data-id="${node.id}">
        <span class="cat-toggle ${has ? '' : 'invisible'}">${has ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' : ''}</span>
        <span class="cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
        <span class="cat-node-name">${esc(node.name)}</span>
        <span class="cat-node-count">${node.post_count ?? 0}</span>
      </div>
      <div class="cat-children${has ? '' : '" style="display:block'}">
        ${has ? node.children.map(c => renderCatNode(c)).join('') : ''}
        <button class="cat-add-child" data-parent="${node.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add subcategory</button>
      </div>
    </div>`;
  }

  function openCatEdit(id) {
    const cat = allCatsFlat.find(c => c.id === id);
    if (!cat) return;
    populateCatParentSelect(id);
    document.getElementById('cat-edit-id').value   = id;
    document.getElementById('cat-edit-name').value = cat.name;
    document.getElementById('cat-detail-title').textContent = 'Edit Category';
    document.getElementById('cat-delete-btn').style.display = '';
    document.getElementById('cat-detail-panel').style.display = '';
    const findParent = (nodes, childId) => { for (const n of nodes) { if (n.children?.some(c => c.id === childId)) return n.id; const r = findParent(n.children || [], childId); if (r) return r; } return null; };
    document.getElementById('cat-edit-parent').value = findParent(catRoots, id) || '';
  }

  function openCatNew(parentId = null) {
    populateCatParentSelect(null);
    document.getElementById('cat-edit-id').value    = '';
    document.getElementById('cat-edit-name').value  = '';
    document.getElementById('cat-edit-parent').value = parentId || '';
    document.getElementById('cat-detail-title').textContent = 'New Category';
    document.getElementById('cat-delete-btn').style.display = 'none';
    document.getElementById('cat-detail-panel').style.display = '';
  }

  document.getElementById('new-cat-btn')?.addEventListener('click', () => openCatNew());
  document.getElementById('cat-detail-close')?.addEventListener('click', () => {
    document.getElementById('cat-detail-panel').style.display = 'none';
    document.querySelectorAll('.cat-node-row').forEach(r => r.classList.remove('selected'));
  });

  document.getElementById('cat-edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('cat-edit-id').value;
    const name   = document.getElementById('cat-edit-name').value;
    const parent = document.getElementById('cat-edit-parent').value || null;
    try {
      if (id) { await api('PATCH', `/categories/${id}/`, { name, parent }); toast('Category updated ✓'); }
      else    { await api('POST',  '/categories/',        { name, parent }); toast('Category created ✓'); }
      document.getElementById('cat-detail-panel').style.display = 'none';
      _loaded['categories'] = false; loadCategories(); _loaded['categories'] = true;
    } catch { toast('Save failed', 'error'); }
  });

  document.getElementById('cat-delete-btn')?.addEventListener('click', () => {
    const id  = document.getElementById('cat-edit-id').value;
    if (!id) return;
    const cat = allCatsFlat.find(c => c.id === parseInt(id));
    document.getElementById('confirm-text').textContent = `Delete category "${cat?.name}"? All subcategories will be unlinked.`;
    openModal('confirm-modal');
    document.getElementById('confirm-ok').onclick = async () => {
      closeModal('confirm-modal');
      try {
        await api('DELETE', `/categories/${id}/`);
        document.getElementById('cat-detail-panel').style.display = 'none';
        toast('Category deleted');
        _loaded['categories'] = false; loadCategories(); _loaded['categories'] = true;
      } catch { toast('Delete failed', 'error'); }
    };
  });

  
})();