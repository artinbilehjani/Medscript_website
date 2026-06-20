/* ═══════════════════════════════════════════════
   admin_post_mobile_patch.js
   Append this AFTER admin_post.js (separate <script> tag).
   Two small additions the CSS fix file depends on:

   1. setCoverPreview() needs to also set a CSS variable so the
      blurred backdrop (::before in the CSS fix) shows the same
      image instead of being blank. We override the existing
      function via patching window-exposed hooks where possible —
      since setCoverPreview is NOT exposed on window in the
      original file, this patch re-implements the same element
      lookups locally rather than requiring you to edit
      admin_post.js by hand.

   2. Body scroll-lock when the mobile sidebar is open, referenced
      in the CSS fix as `body.sidebar-open`.
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. Cover image blurred backdrop ──────────────────────────
     We can't easily intercept the existing setCoverPreview()
     closure (it's private to admin_post.js's IIFE), so instead we
     observe the actual <img id="pe-cover-preview"> element for src
     changes and mirror that src onto the cover zone's CSS variable.
     This works regardless of which code path set it (file picker,
     drag-drop, or loading an existing post for edit). */
  const coverPreview = document.getElementById('pe-cover-preview');
  const coverZone     = document.getElementById('pe-cover-zone');

  if (coverPreview && coverZone) {
    const syncBackdrop = () => {
      if (coverPreview.src && !coverPreview.hidden) {
        coverZone.style.setProperty('--pe-cover-bg', `url("${coverPreview.src}")`);
      } else {
        coverZone.style.removeProperty('--pe-cover-bg');
      }
    };

    // Covers: file picked, drag-drop, and existing post loaded into editor
    const observer = new MutationObserver(syncBackdrop);
    observer.observe(coverPreview, { attributes: true, attributeFilter: ['src', 'hidden'] });

    // Catch the case where src is set before 'hidden' toggles (initial load)
    syncBackdrop();
  }

  /* ── 2. Sidebar scroll lock on mobile ─────────────────────────
     The CSS fix references body.sidebar-open to disable background
     scroll while the mobile drawer is open. The original
     home_admin.js only toggles .open on #sidebar itself — this
     patch mirrors that onto <body> without touching the original
     file. */
  const sidebar   = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');

  if (sidebar) {
    const syncBodyLock = () => {
      document.body.classList.toggle('sidebar-open', sidebar.classList.contains('open'));
    };
    const sidebarObserver = new MutationObserver(syncBodyLock);
    sidebarObserver.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    syncBodyLock();
  }

})();