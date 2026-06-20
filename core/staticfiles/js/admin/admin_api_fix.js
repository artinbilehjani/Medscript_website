/* ═══════════════════════════════════════════════
   admin_api_fix.js

   ROOT CAUSE of "no error shown when tag already exists":
   ─────────────────────────────────────────────────────────────
   The shared `api()` helper (duplicated 3x — once in home_admin.js,
   once in its "extended" IIFE, once in admin_post.js) does this on
   failure:

       if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);

   This discards the actual response body. Your backend DOES return
   a clear 400 with {"name": ["A tag named \"X\" already exists."]}
   (especially after the serializer fix), but the frontend never
   reads it — every failed save shows the same generic "Save failed"
   / "Failed to create tag" toast no matter what actually went wrong.

   FIX: this file defines a corrected `api()` that reads and attaches
   the parsed error body to the thrown Error, plus a shared
   `drfErrorMessage()` helper to turn that body into a readable
   string. It also REPLACES the three submit handlers that create/
   edit tags and categories so they show the real message.

   LOAD ORDER: include this AFTER home_admin.js and admin_post.js,
   so its declarations run last and `window.api` / the replaced
   handlers take precedence. See the bottom of this file for the
   exact wiring.
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const BASE = '/dashboard/api/v1';
  const CSRF = (document.cookie.match(/csrftoken=([^;]*)/) || [])[1] || '';

  /**
   * Corrected fetch wrapper: on failure, reads and parses the JSON
   * body (if any) and attaches it to the thrown Error as `.body`,
   * instead of discarding it.
   */
  async function api(method, path, body = null, isFormData = false) {
    const opts = { method, headers: { 'X-CSRFToken': CSRF }, credentials: 'same-origin' };
    if (body) {
      if (isFormData) { opts.body = body; }
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    const res = await fetch(BASE + path, opts);

    if (!res.ok) {
      let errBody = null;
      try { errBody = await res.json(); } catch { /* not JSON, fine */ }
      const err = new Error(
        drfErrorMessage(errBody) || `${method} ${path} → ${res.status}`
      );
      err.status = res.status;
      err.body = errBody;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /**
   * Turns a DRF error body into a single readable string.
   * Handles: {"detail": "..."}, {"name": ["msg"]}, {"non_field_errors": [...]},
   * nested field errors, and plain string bodies.
   */
  function drfErrorMessage(data) {
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (data.detail && typeof data.detail === 'string') return data.detail;

    const lines = [];
    const push = (path, val) => {
      if (val == null) return;
      if (typeof val === 'string') { lines.push(val); return; }
      if (Array.isArray(val)) { val.forEach(v => push(path, v)); return; }
      if (typeof val === 'object') {
        if (typeof val.message === 'string') { lines.push(val.message); return; }
        Object.entries(val).forEach(([k, v]) => push(k, v));
        return;
      }
      lines.push(String(val));
    };
    push('', data);
    return lines.length ? [...new Set(lines)].join(' ') : null;
  }

  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 3800); // slightly longer for error text
  }

  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  // Expose corrected helpers for reuse / debugging
  window.adminApi = api;
  window.drfErrorMessage = drfErrorMessage;

  /* ── Re-wire: Tags modal (standalone Tags page) ──────────────── */
  const tagForm = document.getElementById('tag-form');
  if (tagForm) {
    const freshForm = tagForm.cloneNode(true);   // strip the old broken listener
    tagForm.parentNode.replaceChild(freshForm, tagForm);

    freshForm.addEventListener('submit', async e => {
      e.preventDefault();
      const id      = document.getElementById('tag-id').value;
      const nameInp = document.getElementById('tag-name-inp');
      const payload = { name: nameInp.value };
      const saveBtn = freshForm.querySelector('button[type="submit"]');

      saveBtn.disabled = true;
      try {
        if (id) {
          const updated = await api('PATCH', `/tags/${id}/`, payload);
          if (window._patchTagInList) window._patchTagInList(updated);
          toast('Tag updated ✓');
        } else {
          const created = await api('POST', '/tags/', payload);
          if (window._appendTagToList) window._appendTagToList(created);
          toast('Tag created ✓');
        }
        closeModal('tag-modal');
      } catch (err) {
        // Show the REAL reason — e.g. 'A tag named "Cardiology" already exists.'
        toast(err.message || 'Save failed', 'error');
        nameInp.focus();
        nameInp.select();
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  /* ── Re-wire: Category form ───────────────────────────────────── */
  const catForm = document.getElementById('cat-edit-form');
  if (catForm) {
    const freshCatForm = catForm.cloneNode(true);
    catForm.parentNode.replaceChild(freshCatForm, catForm);

    freshCatForm.addEventListener('submit', async e => {
      e.preventDefault();
      const id      = document.getElementById('cat-edit-id').value;
      const nameInp = document.getElementById('cat-edit-name');
      const name    = nameInp.value;
      const parent  = document.getElementById('cat-edit-parent').value || null;
      const saveBtn = freshCatForm.querySelector('button[type="submit"]');

      saveBtn.disabled = true;
      try {
        if (id) { await api('PATCH', `/categories/${id}/`, { name, parent }); toast('Category updated ✓'); }
        else    { await api('POST',  '/categories/',        { name, parent }); toast('Category created ✓'); }
        document.getElementById('cat-detail-panel').style.display = 'none';
        if (window._reloadCategories) window._reloadCategories();
      } catch (err) {
        toast(err.message || 'Save failed', 'error');
        nameInp.focus();
        nameInp.select();
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  /* ── Re-wire: "create new tag" inline option inside Post Editor ── */
  const tagsDropdown = document.getElementById('pe-tags-dropdown');
  if (tagsDropdown) {
    // The original handler is bound fresh every render inside
    // renderTagsDropdown() in admin_post.js, via direct DOM listeners
    // on elements it creates. We can't un-bind those without
    // touching that file, but we CAN intercept at the container
    // level with event delegation BEFORE the bubble reaches a
    // generic handler, and stop it from double-firing by checking
    // a data flag. Simpler and safer: listen in the capture phase
    // and handle creation entirely here, then stop propagation so
    // the original (buggy) inline handler never runs.
    tagsDropdown.addEventListener('click', async (e) => {
      const createBtn = e.target.closest('[data-create]');
      if (!createBtn) return;

      e.stopImmediatePropagation(); // prevent the original swallow-everything handler
      e.preventDefault();

      const name = createBtn.dataset.create;
      tagsDropdown.hidden = true;
      const searchInp = document.getElementById('pe-tags-search');
      if (searchInp) searchInp.value = '';

      try {
        const newTag = await api('POST', '/tags/', { name });
        if (window._postEditorAddTag) {
          window._postEditorAddTag(newTag);
        } else {
          toast(`Tag "${newTag.name}" created ✓`);
        }
      } catch (err) {
        toast(err.message || 'Failed to create tag', 'error');
      }
    }, true); // capture phase — runs before admin_post.js's own listener
  }

})();