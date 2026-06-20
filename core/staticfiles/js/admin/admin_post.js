/* ═══════════════════════════════════════════════
   POST EDITOR — admin_post.js
   Accordion sidebar version
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.detail || `${method} ${path} → ${res.status}`), { status: res.status, body: err });
    }
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

  function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
  function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── State ── */
  let currentPostId  = null;
  let allTags        = [];
  let allCategories  = [];
  let selectedTagIds = new Set();
  let selectedCatIds = new Set();
  let pendingFiles   = [];
  let existingFiles  = [];
  let removedFileIds = new Set();
  let coverFile      = null;
  let coverRemoved   = false;
  let isPreview      = false;
  let autoSaveTimer  = null;

  const FILE_EMOJI = { 1:'📄', 2:'📝', 3:'📊', 4:'🖼️', 5:'📈', 6:'📎' };

  /* ── DOM refs ── */
  const overlay          = document.getElementById('post-modal');
  const titleInp         = document.getElementById('pe-title-inp');
  const contentEditor    = document.getElementById('pe-content-editor');
  const statusInp        = document.getElementById('pe-status-inp');
  const dateInp          = document.getElementById('pe-date-inp');
  const linksInp         = document.getElementById('pe-links-inp');
  const tagsSearch       = document.getElementById('pe-tags-search');
  const tagsDropdown     = document.getElementById('pe-tags-dropdown');
  const tagsSelected     = document.getElementById('pe-tags-selected');
  const catsList         = document.getElementById('pe-cats-list');
  const filesList        = document.getElementById('pe-files-list');
  const uploadZone       = document.getElementById('pe-upload-zone');
  const fileInp          = document.getElementById('pe-file-inp');
  const uploadQueue      = document.getElementById('pe-upload-queue');
  const coverZone        = document.getElementById('pe-cover-zone');
  const coverPreview     = document.getElementById('pe-cover-preview');
  const coverPlaceholder = document.getElementById('pe-cover-placeholder');
  const coverActions     = document.getElementById('pe-cover-actions');
  const coverImageInp    = document.getElementById('pe-image-inp');
  const wordCountEl      = document.getElementById('pe-word-count');
  const autosaveEl       = document.getElementById('pe-autosave-status');
  const modalLabel       = document.getElementById('pe-modal-label');

  if (!overlay) return;

  /* ══════════════════════════════════════════
     ACCORDION — wired once on page load
  ══════════════════════════════════════════ */
  document.querySelectorAll('.pe-acc-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const key  = trigger.dataset.acc;
      const body = document.getElementById(`pe-acc-${key}`);
      if (!body) return;
      const isOpen = !body.classList.contains('pe-acc-body-hidden');
      if (isOpen) {
        body.classList.add('pe-acc-body-hidden');
        trigger.classList.remove('pe-acc-open');
      } else {
        body.classList.remove('pe-acc-body-hidden');
        trigger.classList.add('pe-acc-open');
      }
    });
  });

  // kept as no-op so existing calls don't error
  function initAccordions() {
    document.querySelectorAll('.pe-acc-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const key  = trigger.dataset.acc;
        const body = document.getElementById(`pe-acc-${key}`);
        if (!body) return;

        const isOpen = !body.classList.contains('pe-acc-body-hidden');

        if (isOpen) {
          // Close
          body.classList.add('pe-acc-body-hidden');
          trigger.classList.remove('pe-acc-open');
        } else {
          // Open
          body.classList.remove('pe-acc-body-hidden');
          trigger.classList.add('pe-acc-open');
        }
      });
    });
  }

  /* Update badge counts on accordions */
  function updateBadges() {
    // Tags
    const tagsBadge = document.getElementById('pe-tags-badge');
    if (tagsBadge) tagsBadge.textContent = selectedTagIds.size ? selectedTagIds.size : '';

    // Categories
    const catsBadge = document.getElementById('pe-cats-badge');
    if (catsBadge) catsBadge.textContent = selectedCatIds.size ? selectedCatIds.size : '';

    // Links
    const linksBadge = document.getElementById('pe-links-badge');
    if (linksBadge && linksInp) {
      const count = linksInp.value.split('\n').filter(l => l.trim()).length;
      linksBadge.textContent = count ? count : '';
    }

    // Files
    const filesBadge = document.getElementById('pe-files-badge');
    if (filesBadge) {
      const total = existingFiles.filter(f => !removedFileIds.has(f.id)).length + pendingFiles.length;
      filesBadge.textContent = total ? total : '';
    }

    // Publishing badge — show status
    const pubBadge = document.getElementById('pe-pub-badge');
    if (pubBadge && statusInp) {
      pubBadge.textContent = statusInp.value === 'published' ? 'Published' : 'Draft';
      pubBadge.style.background = statusInp.value === 'published'
        ? 'rgba(52,211,153,0.15)' : 'rgba(226,232,240,0.08)';
      pubBadge.style.color = statusInp.value === 'published'
        ? 'var(--success)' : 'var(--text-3)';
    }
  }

  /* ══════════════════════════════════════════
     OPEN / CLOSE
  ══════════════════════════════════════════ */
  async function openEditor(postId = null) {
    resetEditor();
    currentPostId = postId;
    if (modalLabel) modalLabel.textContent = postId ? 'Edit Medical Note' : 'New Medical Note';

    try {
      [allTags, allCategories] = await Promise.all([
        api('GET', '/tags/'),
        api('GET', '/categories/'),
      ]);
      renderCategoriesTree();

      if (postId) {
        const [post, files] = await Promise.all([
          api('GET', `/posts/${postId}/editor/`),
          api('GET', `/posts/${postId}/files/`),
        ]);
        fillEditor(post, files);
      }
    } catch (err) {
      toast('Failed to load editor data', 'error');
      console.error(err);
    }

    openModal('post-modal');
    updateBadges();
    if (titleInp) titleInp.focus();
  }

  function closeEditor() {
    clearTimeout(autoSaveTimer);
    closeModal('post-modal');
    resetEditor();
  }

  function resetEditor() {
    currentPostId = null;
    selectedTagIds = new Set();
    selectedCatIds = new Set();
    pendingFiles   = [];
    existingFiles  = [];
    removedFileIds = new Set();
    coverFile      = null;
    coverRemoved   = false;
    isPreview      = false;

    if (titleInp)      titleInp.value = '';
    if (contentEditor) contentEditor.innerHTML = '';
    if (statusInp)     statusInp.value = 'draft';
    if (dateInp)       dateInp.value = toLocalDatetime(new Date());
    if (linksInp)      linksInp.value = '';
    if (tagsSearch)    tagsSearch.value = '';
    if (tagsDropdown)  { tagsDropdown.hidden = true; tagsDropdown.innerHTML = ''; }
    if (tagsSelected)  tagsSelected.innerHTML = '';
    if (catsList)      catsList.innerHTML = '';
    if (filesList)     filesList.innerHTML = '';
    if (uploadQueue)   uploadQueue.innerHTML = '';
    if (wordCountEl)   wordCountEl.textContent = '0 words';
    if (autosaveEl)    autosaveEl.textContent = '';

    // Reset all accordions — publishing open, rest closed
    document.querySelectorAll('.pe-acc-trigger').forEach(t => {
      const key  = t.dataset.acc;
      const body = document.getElementById(`pe-acc-${key}`);
      if (key === 'publishing') {
        t.classList.add('pe-acc-open');
        body?.classList.remove('pe-acc-body-hidden');
      } else {
        t.classList.remove('pe-acc-open');
        body?.classList.add('pe-acc-body-hidden');
      }
    });

    setCoverPreview(null);
    autoResizeTitle();
  }

  function fillEditor(post, files) {
    if (titleInp) titleInp.value = post.title || '';
    if (contentEditor) contentEditor.innerHTML = plainTextToHtml(post.content || '');
    if (statusInp) statusInp.value = post.status || 'draft';
    if (linksInp)  linksInp.value  = post.links || '';

    if (post.published_date && dateInp) {
      dateInp.value = toLocalDatetime(new Date(post.published_date));
    }

    if (post.image) setCoverPreview(post.image);

    // Tags — API returns array of IDs
    if (post.tags?.length) {
      post.tags.forEach(id => selectedTagIds.add(typeof id === 'object' ? id.id : id));
    }
    renderSelectedTags();

    // Categories — API returns array of IDs
    if (post.categories?.length) {
      post.categories.forEach(id => selectedCatIds.add(typeof id === 'object' ? id.id : id));
    }
    renderCategoriesTree();

    existingFiles = files || [];
    renderFilesList();

    autoResizeTitle();
    updateWordCount();
    updateBadges();

    // Auto-open accordions that have content
    if (selectedTagIds.size)  openAccordion('tags');
    if (selectedCatIds.size)  openAccordion('categories');
    if (post.links?.trim())   openAccordion('links');
    if (existingFiles.length) openAccordion('files');
  }

  function openAccordion(key) {
    const trigger = document.querySelector(`.pe-acc-trigger[data-acc="${key}"]`);
    const body    = document.getElementById(`pe-acc-${key}`);
    if (!trigger || !body) return;
    trigger.classList.add('pe-acc-open');
    body.classList.remove('pe-acc-body-hidden');
  }

  /* ══════════════════════════════════════════
     COVER IMAGE
  ══════════════════════════════════════════ */
  function setCoverPreview(src) {
    if (!coverPreview || !coverPlaceholder || !coverActions) return;
    if (src) {
      coverPreview.src = src;
      coverPreview.hidden = false;
      coverPlaceholder.hidden = true;
      coverActions.hidden = false;
    } else {
      coverPreview.src = '';
      coverPreview.hidden = true;
      coverPlaceholder.hidden = false;
      coverActions.hidden = true;
    }
  }

  coverZone?.addEventListener('click', e => {
    if (e.target.closest('.pe-cover-actions') || e.target.closest('.pe-cover-btn')) return;
    coverImageInp?.click();
  });

  coverImageInp?.addEventListener('change', () => {
    const file = coverImageInp.files[0];
    if (!file) return;
    coverFile = file;
    coverRemoved = false;
    setCoverPreview(URL.createObjectURL(file));
  });

  document.getElementById('pe-cover-remove-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    coverFile = null;
    coverRemoved = true;
    setCoverPreview(null);
    if (coverImageInp) coverImageInp.value = '';
  });

  coverZone?.addEventListener('dragover',  e => { e.preventDefault(); coverZone.classList.add('drag-active'); });
  coverZone?.addEventListener('dragleave', ()  => coverZone.classList.remove('drag-active'));
  coverZone?.addEventListener('drop', e => {
    e.preventDefault();
    coverZone.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      coverFile = file;
      coverRemoved = false;
      setCoverPreview(URL.createObjectURL(file));
    }
  });

  /* ══════════════════════════════════════════
     TITLE AUTO-RESIZE
  ══════════════════════════════════════════ */
  function autoResizeTitle() {
    if (!titleInp) return;
    titleInp.style.height = 'auto';
    titleInp.style.height = titleInp.scrollHeight + 'px';
  }
  titleInp?.addEventListener('input', autoResizeTitle);

  /* ══════════════════════════════════════════
     RICH-TEXT TOOLBAR
  ══════════════════════════════════════════ */
  document.querySelectorAll('.pe-tb-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      updateToolbarState();
    });
  });

  document.getElementById('pe-heading-sel')?.addEventListener('change', function () {
    document.execCommand('formatBlock', false, this.value || 'p');
    this.value = '';
    contentEditor?.focus();
  });

  contentEditor?.addEventListener('keyup',   updateToolbarState);
  contentEditor?.addEventListener('mouseup',  updateToolbarState);
  contentEditor?.addEventListener('input',    () => { updateWordCount(); scheduleAutoSave(); });

  function updateToolbarState() {
    document.querySelectorAll('.pe-tb-btn[data-cmd]').forEach(btn => {
      try { btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd)); } catch {}
    });
  }

  function updateWordCount() {
    const words = (contentEditor?.innerText || '').trim().split(/\s+/).filter(Boolean).length;
    if (wordCountEl) wordCountEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  }

  /* ══════════════════════════════════════════
     TAGS
  ══════════════════════════════════════════ */
  tagsSearch?.addEventListener('input', () => renderTagsDropdown(tagsSearch.value.trim()));
  tagsSearch?.addEventListener('focus', () => renderTagsDropdown(tagsSearch.value.trim()));

  document.addEventListener('click', e => {
    if (!e.target.closest('#pe-tags-search') && !e.target.closest('#pe-tags-dropdown')) {
      if (tagsDropdown) tagsDropdown.hidden = true;
    }
  });

  function renderTagsDropdown(query) {
    if (!tagsDropdown) return;
    const q        = query.toLowerCase();
    const filtered = allTags.filter(t => !selectedTagIds.has(t.id) && t.name.toLowerCase().includes(q));

    let html = filtered.map(t => `
      <div class="pe-dropdown-item" data-tag-id="${t.id}">
        ${esc(t.name)}
        <span style="font-size:11px;color:var(--text-3)">${t.post_count ?? 0}</span>
      </div>`).join('');

    if (query && !allTags.some(t => t.name.toLowerCase() === q)) {
      html += `<div class="pe-dropdown-item create-new" data-create="${esc(query)}">"${esc(query)}"</div>`;
    }

    tagsDropdown.innerHTML = html || `<div class="pe-dropdown-empty">No tags found</div>`;
    tagsDropdown.hidden = false;

    tagsDropdown.querySelectorAll('[data-tag-id]').forEach(item => {
      item.addEventListener('click', () => {
        selectedTagIds.add(parseInt(item.dataset.tagId));
        renderSelectedTags();
        updateBadges();
        if (tagsSearch) tagsSearch.value = '';
        tagsDropdown.hidden = true;
      });
    });

    tagsDropdown.querySelector('[data-create]')?.addEventListener('click', async () => {
      const name = query;
      tagsDropdown.hidden = true;
      if (tagsSearch) tagsSearch.value = '';
      try {
        const newTag = await api('POST', '/tags/', { name });
        allTags.push(newTag);
        selectedTagIds.add(newTag.id);
        renderSelectedTags();
        updateBadges();
        toast(`Tag "${name}" created ✓`);
      } catch { toast('Failed to create tag', 'error'); }
    });
  }

  function renderSelectedTags() {
    if (!tagsSelected) return;
    tagsSelected.innerHTML = [...selectedTagIds].map(id => {
      const t = allTags.find(x => x.id === id);
      if (!t) return '';
      return `<span class="pe-tag-chip">${esc(t.name)}<button class="pe-tag-remove" data-tag-id="${t.id}">×</button></span>`;
    }).join('');

    tagsSelected.querySelectorAll('.pe-tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTagIds.delete(parseInt(btn.dataset.tagId));
        renderSelectedTags();
        updateBadges();
      });
    });
  }

  /* ══════════════════════════════════════════
     CATEGORIES
  ══════════════════════════════════════════ */
  function flattenCats(nodes, acc = [], depth = 0) {
    nodes.forEach(n => {
      acc.push({ ...n, depth });
      if (n.children?.length) flattenCats(n.children, acc, depth + 1);
    });
    return acc;
  }

  function renderCategoriesTree() {
    if (!catsList) return;
    catsList.innerHTML = flattenCats(allCategories).map(c => `
      <div class="pe-cat-item ${selectedCatIds.has(c.id) ? 'checked' : ''}" data-cat-id="${c.id}">
        <span class="pe-cat-check"></span>
        ${c.depth > 0 ? `<span class="pe-cat-indent">${'— '.repeat(c.depth)}</span>` : ''}
        <span>${esc(c.name)}</span>
      </div>`).join('');

    catsList.querySelectorAll('.pe-cat-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.catId);
        if (selectedCatIds.has(id)) { selectedCatIds.delete(id); item.classList.remove('checked'); }
        else                         { selectedCatIds.add(id);    item.classList.add('checked');    }
        updateBadges();
      });
    });
  }

  /* ══════════════════════════════════════════
     FILES
  ══════════════════════════════════════════ */
  function renderFilesList() {
    if (!filesList) return;
    const visible = existingFiles.filter(f => !removedFileIds.has(f.id));
    filesList.innerHTML = visible.map(f => `
      <div class="pe-file-item" data-file-id="${f.id}">
        <span class="pe-file-icon-sm">${FILE_EMOJI[f.file_type] || '📎'}</span>
        <span class="pe-file-name" title="${esc(f.title)}">${esc(f.title)}</span>
        <button class="pe-file-del" data-file-id="${f.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>`).join('');

    filesList.querySelectorAll('.pe-file-del').forEach(btn => {
      btn.addEventListener('click', () => {
        removedFileIds.add(parseInt(btn.dataset.fileId));
        renderFilesList();
        updateBadges();
      });
    });
  }

  function addToQueue(files) {
    Array.from(files).forEach(file => {
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingFiles.push({ file, title: file.name.replace(/\.[^/.]+$/, ''), tempId });
    });
    renderQueue();
    updateBadges();
    // Auto-open files accordion when files are added
    openAccordion('files');
  }

  function renderQueue() {
    if (!uploadQueue) return;
    uploadQueue.innerHTML = pendingFiles.map(pf => `
      <div class="pe-queue-item" data-temp-id="${pf.tempId}">
        <div class="pe-queue-row">
          <span class="pe-queue-name">${esc(pf.file.name)}</span>
          <button class="pe-queue-remove" data-temp-id="${pf.tempId}">×</button>
        </div>
        <input class="pe-queue-title-inp" type="text" value="${esc(pf.title)}" placeholder="Session title…" data-temp-id="${pf.tempId}" />
        <div class="pe-queue-progress"><div class="pe-queue-progress-bar" id="pe-bar-${pf.tempId}"></div></div>
      </div>`).join('');

    uploadQueue.querySelectorAll('.pe-queue-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingFiles = pendingFiles.filter(p => p.tempId !== btn.dataset.tempId);
        renderQueue();
        updateBadges();
      });
    });
    uploadQueue.querySelectorAll('.pe-queue-title-inp').forEach(inp => {
      inp.addEventListener('input', () => {
        const pf = pendingFiles.find(p => p.tempId === inp.dataset.tempId);
        if (pf) pf.title = inp.value;
      });
    });
  }

  uploadZone?.addEventListener('click',    () => fileInp?.click());
  fileInp?.addEventListener('change',      () => { addToQueue(fileInp.files); fileInp.value = ''; });
  uploadZone?.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-active'); });
  uploadZone?.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-active'));
  uploadZone?.addEventListener('drop',      e  => { e.preventDefault(); uploadZone.classList.remove('drag-active'); addToQueue(e.dataTransfer.files); });

  /* Links badge update */
  linksInp?.addEventListener('input', updateBadges);

  /* Status badge update */
  statusInp?.addEventListener('change', updateBadges);

  async function uploadPendingFile(postId, pf) {
    const fd  = new FormData();
    fd.append('file',  pf.file);
    fd.append('title', pf.title || pf.file.name);
    const bar = document.getElementById(`pe-bar-${pf.tempId}`);
    let prog  = 0;
    const t   = setInterval(() => { prog = Math.min(prog + 15, 85); if (bar) bar.style.width = prog + '%'; }, 120);
    try {
      await api('POST', `/posts/${postId}/files/`, fd, true);
      clearInterval(t);
      if (bar) bar.style.width = '100%';
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      clearInterval(t);
      toast(`Failed to upload "${pf.file.name}"`, 'error');
      throw err;
    }
  }

  /* ══════════════════════════════════════════
     AUTO-SAVE
  ══════════════════════════════════════════ */
  function scheduleAutoSave() {
    if (!currentPostId) return;
    clearTimeout(autoSaveTimer);
    if (autosaveEl) autosaveEl.textContent = 'Unsaved…';
    autoSaveTimer = setTimeout(async () => {
      try {
        await savePost(false);
        if (autosaveEl) autosaveEl.textContent = '✓ Saved';
        setTimeout(() => { if (autosaveEl) autosaveEl.textContent = ''; }, 2000);
      } catch {
        if (autosaveEl) autosaveEl.textContent = 'Save failed';
      }
    }, 2500);
  }

  /* ══════════════════════════════════════════
     SAVE / PUBLISH
  ══════════════════════════════════════════ */
  async function savePost(showToast = true, overrideStatus = null) {
    const title = titleInp?.value.trim();
    if (!title) { toast('Please enter a title', 'error'); throw new Error('No title'); }

    const status        = overrideStatus || statusInp?.value || 'draft';
    const content       = htmlToPlainText(contentEditor?.innerHTML || '');
    const links         = linksInp?.value || '';
    const publishedDate = dateInp?.value ? new Date(dateInp.value).toISOString() : null;

    const payload = {
      title, content, status, links,
      tags:       [...selectedTagIds],
      categories: [...selectedCatIds],
      ...(publishedDate ? { published_date: publishedDate } : {}),
    };

    let post;
    if (currentPostId) {
      post = await api('PATCH', `/posts/${currentPostId}/editor/`, payload);
    } else {
      post = await api('POST', '/posts/', { title, status: 'draft' });
      currentPostId = post.id;
      post = await api('PATCH', `/posts/${currentPostId}/editor/`, payload);
    }

    if (coverFile) {
      const fd = new FormData();
      fd.append('image', coverFile);
      await api('PATCH', `/posts/${currentPostId}/`, fd, true);
      coverFile = null;
    } else if (coverRemoved) {
      coverRemoved = false;
    }

    for (const fileId of removedFileIds) {
      await api('DELETE', `/posts/${currentPostId}/files/${fileId}/`).catch(() => {});
    }
    removedFileIds.clear();

    const uploaded = [];
    for (const pf of pendingFiles) {
      try { await uploadPendingFile(currentPostId, pf); uploaded.push(pf.tempId); }
      catch {}
    }
    pendingFiles = pendingFiles.filter(p => !uploaded.includes(p.tempId));
    renderQueue();

    const freshFiles = await api('GET', `/posts/${currentPostId}/files/`);
    existingFiles = freshFiles;
    renderFilesList();
    updateBadges();

    if (showToast) toast(`Note ${status === 'published' ? 'published' : 'saved'} ✓`);

    if (window._postsLoaded) {
      api('GET', '/posts/').then(posts => {
        window.allPosts = posts;
        if (typeof window.renderPostsTable === 'function') window.renderPostsTable(posts);
      }).catch(() => {});
    }

    return post;
  }

  /* ── Buttons ── */
  document.getElementById('pe-save-draft-btn')?.addEventListener('click', async () => {
    try { await savePost(true, 'draft'); }
    catch (err) { if (err.message !== 'No title') toast('Save failed', 'error'); }
  });

  document.getElementById('pe-publish-btn')?.addEventListener('click', async () => {
    try { await savePost(true, 'published'); if (statusInp) statusInp.value = 'published'; updateBadges(); }
    catch (err) { if (err.message !== 'No title') toast('Publish failed', 'error'); }
  });

  document.querySelector('.pe-back-btn[data-modal="post-modal"]')?.addEventListener('click', closeEditor);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeEditor(); });

  /* ── Preview ── */
  document.getElementById('pe-preview-btn')?.addEventListener('click', () => {
    isPreview = !isPreview;
    const toolbar = document.getElementById('pe-toolbar');
    const btn     = document.getElementById('pe-preview-btn');
    if (isPreview) {
      if (contentEditor) { contentEditor.contentEditable = 'false'; contentEditor.style.fontFamily = "'Georgia',serif"; contentEditor.style.fontSize = '15px'; }
      if (toolbar) toolbar.style.display = 'none';
      if (btn) btn.textContent = '✎ Edit';
    } else {
      if (contentEditor) { contentEditor.contentEditable = 'true'; contentEditor.style.fontFamily = ''; contentEditor.style.fontSize = ''; }
      if (toolbar) toolbar.style.display = '';
      if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview`;
    }
  });

  /* ── Expose ── */
  window._openPostEditor = openEditor;
  document.getElementById('new-post-btn')?.addEventListener('click', () => openEditor(null));
  window._editPost = (id) => openEditor(id);

  /* ── Helpers ── */
  function toLocalDatetime(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function plainTextToHtml(text) {
    if (!text) return '';
    return text.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }

  function htmlToPlainText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('p, h2, h3, h4, li').forEach(el => el.insertAdjacentText('afterend', '\n'));
    div.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return div.innerText.replace(/\n{3,}/g, '\n\n').trim();
  }

  if (dateInp) dateInp.value = toLocalDatetime(new Date());

})();