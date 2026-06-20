/* ═══════════════════════════════════════════════
   post-list-search.js — Search + Filter page
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── DOM ── */
  const filterMenuBtn   = document.getElementById('filter-menu-button');
  const filterMenu      = document.getElementById('filter-menu');
  const applyBtn        = document.getElementById('apply-filters-button');
  const clearBtn        = document.getElementById('clear-filters-button');
  const searchInput     = document.getElementById('search-input');
  const searchBtn       = document.getElementById('search-button');
  const gridBtn         = document.getElementById('display-grid-button');
  const listBtn         = document.getElementById('display-list-button');
  const postGrid        = document.getElementById('post-grid');
  const postList        = document.getElementById('post-list');
  const catContainer    = document.getElementById('category-filters');
  const tagContainer    = document.getElementById('tag-filters');

  const API_URL         = '/content/api/v1/posts/search/';
  const FILTERS_URL     = '/content/api/v1/filters/';

  /* Static default thumbnails — purely a frontend fallback. Never written
     to any model field, so there's nothing for backend cleanup logic to
     ever delete. Two sizes: wide for grid cards, square for list rows —
     matching the same derived sizes posts get when they DO have an image. */
  const MEDIA_URL = window.APP_CONFIG?.mediaUrl || '/media/';
  const DEFAULT_POST_THUMBNAIL       = MEDIA_URL + 'images/default_images/blank_post_thumbnail_400x250.jpg';
  const DEFAULT_POST_THUMBNAIL_SMALL = MEDIA_URL + 'images/default_images/blank_post_thumbnail_120x120.jpg';

  /* ── State ── */
  let view          = 'grid';
  let currentPage   = 1;
  let totalPages    = 1;
  let postsData     = [];
  let searchTerm    = '';
  let filters       = { categories: [], tags: [] };

  /* ════════════════════════════════════════════
     FETCH POSTS
  ════════════════════════════════════════════ */
  async function fetchPosts(page = 1, { append = false } = {}) {
    currentPage = page;
    const url = new URL(API_URL, location.origin);
    if (searchTerm) url.searchParams.set('search', searchTerm);
    filters.categories.forEach(s => url.searchParams.append('category', s));
    filters.tags.forEach(s => url.searchParams.append('tag', s));
    url.searchParams.set('page', String(page));

    try {
      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const posts  = data.results || data;
      totalPages   = data.total_pages ?? 1;
      currentPage  = data.current_page_number ?? currentPage;
      postsData    = append ? postsData.concat(posts) : posts;

      renderPosts(postsData);
      renderPagination();
    } catch (err) {
      console.error('[search] fetch error', err);
      getContainer().innerHTML = '<p class="no-results">Failed to load posts. Please try again.</p>';
    }
  }

  /* ════════════════════════════════════════════
     RENDER POSTS
  ════════════════════════════════════════════ */
  function getContainer() { return view === 'grid' ? postGrid : postList; }

  function renderPosts(posts) {
    const container = getContainer();
    container.innerHTML = '';
    if (!posts?.length) {
      container.innerHTML = '<p class="no-results">No posts found matching your criteria.</p>';
      return;
    }
    const frag = document.createDocumentFragment();
    posts.forEach(p => frag.appendChild(createCard(p)));
    container.appendChild(frag);
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function createCard(post) {
    const el = document.createElement('div');
    const isList = view === 'list';
    el.className = `post-item ${isList ? 'list-item' : 'grid-item'}`;

    /* Reduced-size derived image. The API returns null when the post has
       no upload at all — in that case we fall back to a real static
       default image (sized to match the view: wide for grid, square for
       list), rather than an emoji placeholder div. */
    const fallback = isList ? DEFAULT_POST_THUMBNAIL_SMALL : DEFAULT_POST_THUMBNAIL;
    const imgSrc   = post.thumbnail || fallback;
    const imgHtml  = `<img src="${esc(imgSrc)}" alt="${esc(post.title)}" loading="lazy">`;

    const tags = (post.tag || []).map(t => `<span>${esc(t.name)}</span>`).join('');
    const cats = (post.category || []).map(c => `<span>${esc(c.name)}</span>`).join('');

    if (isList) {
      /* Notes style — thumbnail outside content, minimal metadata */
      el.innerHTML = `
        ${imgHtml}
        <div class="post-content">
          <h2><a href="${esc(post.absolute_url || '#')}">${esc(post.title)}</a></h2>
          ${post.snippet ? `<p class="post-snippet">${esc(post.snippet)}</p>` : ''}
          <div class="post-meta">
            ${post.display_date ? `<span>${esc(post.display_date)}</span>` : ''}
            ${post.author       ? `<span>${esc(post.author)}</span>`       : ''}
          </div>
        </div>`;
    } else {
      /* Grid style — full cover image, all metadata */
      el.innerHTML = `
        ${imgHtml}
        <div class="post-content">
          <h2><a href="${esc(post.absolute_url || '#')}">${esc(post.title)}</a></h2>
          <div class="post-meta">
            ${post.author       ? `<span>✍ ${esc(post.author)}</span>`       : ''}
            ${post.display_date ? `<span>📅 ${esc(post.display_date)}</span>` : ''}
          </div>
          ${post.snippet ? `<p class="post-snippet">${esc(post.snippet)}</p>` : ''}
          ${cats ? `<div class="post-categories">${cats}</div>` : ''}
          ${tags ? `<div class="post-tags">${tags}</div>`       : ''}
          <div class="post-views">👁 ${post.hit_count ?? 0} views</div>
        </div>`;
    }
    return el;
  }

  /* ════════════════════════════════════════════
     PAGINATION
  ════════════════════════════════════════════ */
  function renderPagination() {
    const el = document.getElementById('pagination-controls');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const pages = buildPageList(currentPage, totalPages);

    const prev = currentPage > 1
      ? `<button class="nav-btn" data-page="${currentPage - 1}">← Prev</button>` : '';
    const next = currentPage < totalPages
      ? `<button class="nav-btn" data-page="${currentPage + 1}">Next →</button>` : '';

    el.innerHTML = prev
      + pages.map(x => x === '…'
          ? `<span class="ellipsis">…</span>`
          : `<button class="page-btn ${x === currentPage ? 'is-active' : ''}"
               data-page="${x}" ${x === currentPage ? 'disabled' : ''}>${x}</button>`
        ).join('')
      + next;

    el.onclick = e => {
      const btn = e.target.closest('button[data-page]');
      if (!btn) return;
      const page = Number(btn.dataset.page);
      if (!page || page === currentPage) return;
      fetchPosts(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  function buildPageList(cur, total) {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 3)           return [1, 2, 3, 4, '…', total];
    if (cur >= total - 2)   return [1, '…', total-3, total-2, total-1, total];
    return [1, '…', cur-1, cur, cur+1, '…', total];
  }

  /* ════════════════════════════════════════════
     FILTERS
  ════════════════════════════════════════════ */
  async function loadFilters() {
    try {
      const res  = await fetch(FILTERS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderTagOptions(data.tags || []);
      renderCategoryBuckets(data.category_buckets || []);
    } catch (err) { console.error('[filters]', err); }
  }

  function renderTagOptions(tags) {
    tagContainer.innerHTML = '';
    [...tags].sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
      tagContainer.appendChild(makeCheckbox(t, 'tag'));
    });
  }

  function renderCategoryBuckets(buckets) {
    catContainer.innerHTML = '';
    buckets.forEach(({ root, leaves }) => {
      const details = document.createElement('details');
      details.className = 'category-pocket';
      const summary = document.createElement('summary');
      summary.className = 'category-pocket-button';
      summary.textContent = root?.name || 'Category';
      const body = document.createElement('div');
      body.className = 'category-pocket-body';
      (leaves || []).forEach(c => body.appendChild(makeCheckbox(c, 'category')));
      details.append(summary, body);
      catContainer.appendChild(details);
    });

    /* accordion: only one open at a time */
    catContainer.addEventListener('toggle', e => {
      if (e.target.tagName !== 'DETAILS' || !e.target.open) return;
      catContainer.querySelectorAll('details[open]').forEach(d => {
        if (d !== e.target) d.open = false;
      });
    }, true);
  }

  function makeCheckbox(item, type) {
    const label    = document.createElement('label');
    label.className = 'filter-option';
    const cb       = document.createElement('input');
    cb.type        = 'checkbox';
    cb.dataset.slug = item.slug;
    cb.dataset.type = type;
    const key = type === 'category' ? 'categories' : 'tags';
    if (filters[key].includes(item.slug)) cb.checked = true;
    const count = item.post_count != null ? ` (${item.post_count})` : '';
    label.append(cb, ` ${item.name}${count}`);
    return label;
  }

  /* ── Filter apply / clear ── */
  applyBtn?.addEventListener('click', () => {
    filters.categories = [...filterMenu.querySelectorAll('input[data-type="category"]:checked')]
      .map(cb => cb.dataset.slug);
    filters.tags = [...filterMenu.querySelectorAll('input[data-type="tag"]:checked')]
      .map(cb => cb.dataset.slug);
    closeFilterMenu();
    fetchPosts(1);
  });

  clearBtn?.addEventListener('click', () => {
    filters = { categories: [], tags: [] };
    filterMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    fetchPosts(1);
  });

  /* ── Filter menu open/close ── */
  filterMenuBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = filterMenu.classList.toggle('open');
    filterMenuBtn.classList.toggle('active', isOpen);
    if (isOpen) {
      /* Position just below the button, centred on screen */
      const rect = filterMenuBtn.getBoundingClientRect();
      filterMenu.style.top = (rect.bottom + 10) + 'px';
      document.addEventListener('click', outsideClick);
    }
  });

  function outsideClick(e) {
    if (!filterMenu.contains(e.target) && !filterMenuBtn.contains(e.target)) closeFilterMenu();
  }
  function closeFilterMenu() {
    filterMenu.classList.remove('open');
    filterMenuBtn.classList.remove('active');
    document.removeEventListener('click', outsideClick);
  }

  /* ════════════════════════════════════════════
     SEARCH
  ════════════════════════════════════════════ */
  searchBtn?.addEventListener('click', () => {
    searchTerm = searchInput.value.trim();
    fetchPosts(1);
  });
  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { searchTerm = searchInput.value.trim(); fetchPosts(1); }
  });

  /* ════════════════════════════════════════════
     VIEW TOGGLE
  ════════════════════════════════════════════ */
  function setView(v) {
    if (view === v) return;
    view = v;
    postGrid.style.display = v === 'grid' ? 'grid' : 'none';
    postList.style.display = v === 'list' ? 'grid' : 'none';
    gridBtn?.classList.toggle('active', v === 'grid');
    listBtn?.classList.toggle('active', v === 'list');
    renderPosts(postsData);
  }

  gridBtn?.addEventListener('click', () => setView('grid'));
  listBtn?.addEventListener('click', () => setView('list'));

  /* ── Boot ── */
  setView('grid');
  loadFilters();
  fetchPosts();
});