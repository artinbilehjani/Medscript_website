/* ═══════════════════════════════════════════════
   home_admin_section_editor.js
   Inline section editor panel for the Home Page
   section in the admin dashboard.

   LOAD AFTER: home_admin.js, admin_home_page.js
   This adds a slide-in edit panel when a section
   row is clicked, with a lightweight rich-text
   editor (bold, italic, link) — no heavy deps.
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
    if (!el) return;
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  /* ════════════════════════════════════════════
     BUILD THE EDITOR PANEL (injected once)
  ════════════════════════════════════════════ */
  function buildEditorPanel() {
    if (document.getElementById('sec-editor-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'sec-editor-panel';
    panel.className = 'sec-editor-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="sec-editor-inner glass">
        <div class="sec-editor-head">
          <h3 class="sec-editor-title" id="sec-editor-title">Edit Section</h3>
          <button class="modal-close" id="sec-editor-close">✕</button>
        </div>

        <div class="sec-editor-body">

          <!-- Section type badge (read-only) -->
          <div class="sec-type-badge" id="sec-type-badge"></div>

          <!-- Icon -->
          <div class="sec-field-group">
            <label class="sec-field-label">Icon (emoji)</label>
            <div class="sec-icon-row">
              <div class="sec-icon-preview" id="sec-icon-preview">🏠</div>
              <input type="text" class="field-input" id="sec-icon-inp"
                placeholder="Paste emoji, e.g. 🧠" maxlength="4" />
            </div>
            <div class="sec-emoji-picker" id="sec-emoji-picker">
              🧠 ⚡ 💬 📚 🏥 🔬 🧬 💊 🩺 📋 📝 🗂️ 📊 🔭 💡 🌐 📡 🧪 🏆 ⭐
            </div>
          </div>

          <!-- Title -->
          <div class="sec-field-group">
            <label class="sec-field-label">Title</label>
            <input type="text" class="field-input" id="sec-title-inp"
              placeholder="Section title…" maxlength="200" />
          </div>

          <!-- Subtitle -->
          <div class="sec-field-group">
            <label class="sec-field-label">Subtitle</label>
            <input type="text" class="field-input" id="sec-subtitle-inp"
              placeholder="Short subtitle or tagline…" maxlength="500" />
          </div>

          <!-- Rich content -->
          <div class="sec-field-group">
            <label class="sec-field-label">Content</label>
            <!-- Mini toolbar -->
            <div class="sec-rt-toolbar">
              <button type="button" class="sec-rt-btn" data-cmd="bold" title="Bold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/></svg>
              </button>
              <button type="button" class="sec-rt-btn" data-cmd="italic" title="Italic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
              </button>
              <button type="button" class="sec-rt-btn" data-cmd="underline" title="Underline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
              </button>
              <div class="sec-rt-sep"></div>
              <button type="button" class="sec-rt-btn" data-cmd="insertUnorderedList" title="Bullet list">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
              </button>
              <button type="button" class="sec-rt-btn" data-cmd="insertOrderedList" title="Numbered list">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
              </button>
              <div class="sec-rt-sep"></div>
              <button type="button" class="sec-rt-btn" id="sec-rt-link" title="Insert link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </button>
              <button type="button" class="sec-rt-btn" data-cmd="removeFormat" title="Clear formatting">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
              </button>
            </div>
            <div class="sec-rt-editor" id="sec-content-editor" contenteditable="true"
              data-placeholder="Section content (optional)…"></div>
          </div>

          <!-- Button -->
          <div class="sec-field-group">
            <label class="sec-field-label">Button</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="text" class="field-input" id="sec-btn-label-inp"
                placeholder="Button label" style="flex:1;min-width:120px" />
              <input type="text" class="field-input" id="sec-btn-url-inp"
                placeholder="URL or /path" style="flex:2;min-width:180px" />
            </div>
          </div>

          <!-- Actions -->
          <div class="sec-editor-actions">
            <button class="btn btn-ghost" id="sec-editor-cancel">Cancel</button>
            <button class="btn btn-primary" id="sec-editor-save">Save Section</button>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(panel);
    wireEditorPanel(panel);
  }

  /* ════════════════════════════════════════════
     WIRE INTERACTIONS
  ════════════════════════════════════════════ */
  let _currentSectionId = null;

  function wireEditorPanel(panel) {
    const editor = panel.querySelector('#sec-content-editor');

    /* Close */
    panel.querySelector('#sec-editor-close')?.addEventListener('click', closePanel);
    panel.querySelector('#sec-editor-cancel')?.addEventListener('click', closePanel);
    panel.addEventListener('click', e => { if (e.target === panel) closePanel(); });

    /* Toolbar */
    panel.querySelectorAll('.sec-rt-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        document.execCommand(btn.dataset.cmd, false, null);
        editor?.focus();
        updateToolbarState(panel);
      });
    });

    /* Link button */
    panel.querySelector('#sec-rt-link')?.addEventListener('click', () => {
      const sel = window.getSelection();
      const existing = sel?.anchorNode?.parentElement?.closest('a');
      const url = prompt('Enter URL:', existing?.href || 'https://');
      if (url === null) return;
      if (url === '') { document.execCommand('unlink'); return; }
      document.execCommand('createLink', false, url);
      // open in new tab for external links
      editor?.querySelectorAll('a').forEach(a => {
        if (a.href.startsWith('http')) a.target = '_blank';
      });
    });

    /* Toolbar state on selection change */
    editor?.addEventListener('keyup',   () => updateToolbarState(panel));
    editor?.addEventListener('mouseup', () => updateToolbarState(panel));

    /* Icon live preview */
    panel.querySelector('#sec-icon-inp')?.addEventListener('input', function () {
      const p = panel.querySelector('#sec-icon-preview');
      if (p) p.textContent = this.value || '🏠';
    });

    /* Emoji picker clicks */
    panel.querySelector('#sec-emoji-picker')?.addEventListener('click', e => {
      const char = e.target?.textContent?.trim();
      if (!char || char.length > 4) return;
      const inp = panel.querySelector('#sec-icon-inp');
      if (inp) { inp.value = char; inp.dispatchEvent(new Event('input')); }
    });

    /* Save */
    panel.querySelector('#sec-editor-save')?.addEventListener('click', async () => {
      if (!_currentSectionId) return;
      const payload = {
        title:        panel.querySelector('#sec-title-inp')?.value    || '',
        subtitle:     panel.querySelector('#sec-subtitle-inp')?.value || '',
        content:      editor?.innerHTML || '',
        icon:         panel.querySelector('#sec-icon-inp')?.value     || '',
        button_label: panel.querySelector('#sec-btn-label-inp')?.value || '',
        button_url:   panel.querySelector('#sec-btn-url-inp')?.value   || '',
      };
      try {
        await api('PATCH', `/homepage-sections/${_currentSectionId}/`, payload);
        toast('Section saved ✓');
        closePanel();
        /* Re-render sections list if available */
        if (typeof window._hpToggleSection === 'function' || window._hpLoaded) {
          window._hpLoaded = false;
          window.adminNavigate?.('homepage');
        }
      } catch (err) {
        toast('Save failed', 'error');
        console.error(err);
      }
    });
  }

  function updateToolbarState(panel) {
    panel.querySelectorAll('.sec-rt-btn[data-cmd]').forEach(btn => {
      try { btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd)); }
      catch {}
    });
  }

  function closePanel() {
    const panel = document.getElementById('sec-editor-panel');
    if (panel) {
      panel.classList.remove('open');
      setTimeout(() => { panel.hidden = true; }, 300);
    }
    _currentSectionId = null;
  }

  /* ════════════════════════════════════════════
     OPEN EDITOR for a section
  ════════════════════════════════════════════ */
  async function openSectionEditor(sectionId, sectionData) {
    buildEditorPanel();
    const panel = document.getElementById('sec-editor-panel');
    if (!panel) return;

    _currentSectionId = sectionId;

    /* Fill fields */
    const LABELS = {
      hero:'Hero Banner', features:'Feature Rows', about:'About',
      cta:'Call to Action', contact:'Contact', latest:'Latest Posts',
      popular:'Most Viewed', custom:'Custom',
    };

    panel.querySelector('#sec-editor-title').textContent =
      `Edit: ${LABELS[sectionData?.section_type] || sectionData?.section_type || 'Section'}`;
    panel.querySelector('#sec-type-badge').textContent =
      sectionData?.section_type || '';
    panel.querySelector('#sec-icon-inp').value     = sectionData?.icon         || '';
    panel.querySelector('#sec-icon-preview').textContent = sectionData?.icon  || '🏠';
    panel.querySelector('#sec-title-inp').value    = sectionData?.title        || '';
    panel.querySelector('#sec-subtitle-inp').value = sectionData?.subtitle     || '';
    panel.querySelector('#sec-btn-label-inp').value = sectionData?.button_label || '';
    panel.querySelector('#sec-btn-url-inp').value   = sectionData?.button_url   || '';

    const editor = panel.querySelector('#sec-content-editor');
    if (editor) editor.innerHTML = sectionData?.content || '';

    /* Show */
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('open'));
    panel.querySelector('#sec-title-inp')?.focus();
  }

  /* Expose so renderHpSections can use it */
  window._openSectionEditor = openSectionEditor;

  /* ════════════════════════════════════════════
     PATCH renderHpSections to add edit buttons
     (only if admin_home_page.js already ran)
  ════════════════════════════════════════════ */
  const _origRenderHpSections = window._renderHpSections;

  /* We patch via MutationObserver on hp-sections-list instead,
     because _renderHpSections is a closure. */
  const hpListEl = document.getElementById('hp-sections-list');
  if (hpListEl) {
    new MutationObserver(() => {
      hpListEl.querySelectorAll('.section-row').forEach(row => {
        if (row.dataset.editWired) return;
        row.dataset.editWired = '1';

        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn sec-edit-btn';
        editBtn.title = 'Edit content';
        editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>`;

        const sectionId = parseInt(row.dataset.id);
        editBtn.addEventListener('click', async e => {
          e.stopPropagation();
          try {
            /* Fetch fresh section data so we have content/icon fields */
            const data = await api('GET', `/homepage-sections/${sectionId}/`).catch(() => null);
            await openSectionEditor(sectionId, data);
          } catch {}
        });

        /* Insert before the toggle */
        const toggle = row.querySelector('.toggle');
        if (toggle) row.insertBefore(editBtn, toggle);
        else row.appendChild(editBtn);
      });
    }).observe(hpListEl, { childList: true, subtree: false });
  }

  /* ════════════════════════════════════════════
     CSS — injected into <head>
  ════════════════════════════════════════════ */
  const style = document.createElement('style');
  style.textContent = `
    /* ── Section editor panel ── */
    .sec-editor-panel {
      position: fixed;
      inset: 0;
      z-index: 700;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
      padding: 0;
    }
    .sec-editor-panel.open {
      opacity: 1;
      pointer-events: all;
    }
    .sec-editor-inner {
      width: 100%;
      max-width: 520px;
      height: 100vh;
      border-radius: 0;
      border-left: 1px solid var(--glass-bd);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(.16,1,.3,1);
      overflow: hidden;
    }
    .sec-editor-panel.open .sec-editor-inner {
      transform: translateX(0);
    }
    @media (max-width: 600px) {
      .sec-editor-panel { align-items: flex-end; justify-content: stretch; }
      .sec-editor-inner { max-width: 100%; height: 90vh; border-left: none; border-top: 1px solid var(--glass-bd); border-radius: 16px 16px 0 0; transform: translateY(100%); }
      .sec-editor-panel.open .sec-editor-inner { transform: translateY(0); }
    }

    .sec-editor-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--glass-bd); flex-shrink: 0;
    }
    .sec-editor-title { font-size: 15px; font-weight: 700; }
    .sec-editor-body {
      flex: 1; overflow-y: auto; padding: 20px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .sec-editor-body::-webkit-scrollbar { width: 4px; }
    .sec-editor-body::-webkit-scrollbar-thumb { background: var(--glass-bd); border-radius: 2px; }

    .sec-type-badge {
      display: inline-block;
      background: var(--teal-dim); color: var(--teal);
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; padding: 3px 10px; border-radius: 20px;
      align-self: flex-start;
    }

    .sec-field-group { display: flex; flex-direction: column; gap: 6px; }
    .sec-field-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; color: var(--text-3);
    }

    /* Icon row */
    .sec-icon-row { display: flex; align-items: center; gap: 10px; }
    .sec-icon-preview {
      width: 44px; height: 44px; border-radius: 10px;
      background: var(--glass-bg); border: 1px solid var(--glass-bd);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; flex-shrink: 0;
    }

    /* Emoji picker */
    .sec-emoji-picker {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 8px; background: var(--bg-1);
      border: 1px solid var(--glass-bd); border-radius: 10px;
      font-size: 20px; line-height: 1;
    }
    .sec-emoji-picker span,
    .sec-emoji-picker {
      cursor: pointer;
    }
    .sec-emoji-picker:empty { display: none; }

    /* Rich text toolbar */
    .sec-rt-toolbar {
      display: flex; align-items: center; gap: 2px;
      padding: 5px 8px;
      background: var(--glass-bg); border: 1px solid var(--glass-bd);
      border-radius: 8px 8px 0 0; border-bottom: none;
      flex-wrap: wrap;
    }
    .sec-rt-btn {
      width: 26px; height: 26px; border-radius: 5px; border: none;
      background: transparent; color: var(--text-2);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background .15s, color .15s;
    }
    .sec-rt-btn:hover { background: var(--glass-hover); color: var(--text); }
    .sec-rt-btn.active { background: var(--teal-dim); color: var(--teal); }
    .sec-rt-sep {
      width: 1px; height: 16px; background: var(--glass-bd); margin: 0 3px; flex-shrink: 0;
    }

    /* Rich text editor */
    .sec-rt-editor {
      min-height: 120px;
      padding: 10px 12px;
      background: var(--bg-1);
      border: 1px solid var(--glass-bd);
      border-radius: 0 0 8px 8px;
      color: var(--text); font-size: 13.5px; line-height: 1.75;
      outline: none; word-break: break-word;
    }
    .sec-rt-editor:empty::before {
      content: attr(data-placeholder); color: var(--text-3); pointer-events: none;
    }
    .sec-rt-editor:focus { border-color: var(--teal); }
    .sec-rt-editor b, .sec-rt-editor strong { color: #fff; font-weight: 700; }
    .sec-rt-editor i, .sec-rt-editor em { color: var(--text-2); font-style: italic; }
    .sec-rt-editor a { color: var(--teal); text-decoration: underline; }
    .sec-rt-editor ul, .sec-rt-editor ol { padding-left: 1.4em; }

    .sec-editor-actions {
      display: flex; gap: 10px; justify-content: flex-end;
      padding-top: 4px; border-top: 1px solid var(--glass-bd); margin-top: 4px;
    }

    /* Edit button on section rows */
    .sec-edit-btn { flex-shrink: 0; }
    .sec-edit-btn:hover { border-color: var(--teal) !important; }
    .sec-edit-btn:hover svg { stroke: var(--teal) !important; }
  `;
  document.head.appendChild(style);

})();