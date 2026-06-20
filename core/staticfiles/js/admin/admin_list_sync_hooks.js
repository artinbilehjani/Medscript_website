/* ═══════════════════════════════════════════════
   admin_list_sync_hooks.js

   Small glue file so admin_api_fix.js can refresh on-screen lists
   after a successful save, without needing to touch the internal
   closures of home_admin.js / admin_post.js directly.

   LOAD ORDER: after home_admin.js, admin_post.js, AND admin_api_fix.js
   (last of all four).
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Tags list (standalone Tags page) — simplest reliable approach
     is to just re-trigger the existing loader if the Tags section
     has already been visited at least once. */
  window._appendTagToList = function () {
    if (window.extLazyLoad) {
      // Force a refresh even if already loaded once
      const wasLoaded = true;
      window.extReloadAll?.();
      window.extLazyLoad('tags');
    }
  };
  window._patchTagInList = window._appendTagToList;

  /* Categories — same approach: just reload the tree section. */
  window._reloadCategories = function () {
    if (window.extLazyLoad) {
      window.extReloadAll?.();
      window.extLazyLoad('categories');
    }
  };

  /* Post editor's tag dropdown — add the newly created tag into the
     editor's local state (selectedTagIds / allTags) so it appears
     as a chip immediately, matching what the old (buggy) inline
     handler in admin_post.js attempted to do. Since allTags/
     selectedTagIds are private to admin_post.js's closure, we
     replicate the minimal needed behavior here by directly
     manipulating the DOM the same way renderSelectedTags() does,
     keyed off data attributes already present in that file's markup. */
  window._postEditorAddTag = function (tag) {
    const selected = document.getElementById('pe-tags-selected');
    if (!selected) return;

    // Avoid duplicate chip if already present
    if (selected.querySelector(`[data-tag-id="${tag.id}"]`)) return;

    const chip = document.createElement('span');
    chip.className = 'pe-tag-chip';
    chip.innerHTML = `${tag.name}<button class="pe-tag-remove" data-tag-id="${tag.id}">×</button>`;
    selected.appendChild(chip);

    chip.querySelector('.pe-tag-remove').addEventListener('click', () => {
      chip.remove();
      const badge = document.getElementById('pe-tags-badge');
      if (badge) {
        const count = selected.querySelectorAll('.pe-tag-chip').length;
        badge.textContent = count ? count : '';
      }
    });

    const badge = document.getElementById('pe-tags-badge');
    if (badge) {
      const count = selected.querySelectorAll('.pe-tag-chip').length;
      badge.textContent = count ? count : '';
    }

    if (window.toast) window.toast(`Tag "${tag.name}" created ✓`);
  };

})();