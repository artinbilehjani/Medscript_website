/* ═══════════════════════════════════════════════
   post-list.js — Category post list page
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  const gridBtn  = document.getElementById('display-grid-button');
  const listBtn  = document.getElementById('display-list-button');
  const postGrid = document.getElementById('post-grid');
  const postList = document.getElementById('post-list');

  const API_URL     = '/content/api/v1/posts/';
  const categorySlug = new URLSearchParams(location.search).get('category');

  /* Static default thumbnails — purely a frontend fallback. Never written
     to any model field, so there's nothing for backend cleanup logic to
     ever delete. Two sizes: wide for grid cards, square for list rows —
     matching the same derived sizes posts get when they DO have an image. */
  const MEDIA_URL = window.APP_CONFIG?.mediaUrl || '/media/';
  const DEFAULT_POST_THUMBNAIL       = MEDIA_URL + 'images/default_images/blank_post_thumbnail_400x250.jpg';
  const DEFAULT_POST_THUMBNAIL_SMALL = MEDIA_URL + 'images/default_images/blank_post_thumbnail_120x120.jpg';

  let view        = 'grid';
  let currentPage = 1;
  let totalPages  = 1;
  let postsData   = [];

  /* ════════════════════════════════════════════
     FETCH
  ════════════════════════════════════════════ */
  async function fetchPosts(page = 1) {
    currentPage = page;
    const url = new URL(API_URL, location.origin);
    if (categorySlug) url.searchParams.set('category', categorySlug);
    url.searchParams.set('page', String(page));

    try {
      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      postsData   = data.results || data;
      totalPages  = data.total_pages ?? 1;
      currentPage = data.current_page_number ?? currentPage;

      renderPosts(postsData);
      renderPagination();
    } catch (err) {
      console.error('[post-list] fetch error', err);
      getContainer().innerHTML = '<p class="no-results">Failed to load posts. Please try again.</p>';
    }
  }

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  function getContainer() { return view === 'grid' ? postGrid : postList; }

  function renderPosts(posts) {
    const container = getContainer();
    container.innerHTML = '';
    if (!posts?.length) {
      container.innerHTML = '<p class="no-results">No posts found.</p>';
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
    const prev  = currentPage > 1
      ? `<button class="nav-btn" data-page="${currentPage - 1}">← Prev</button>` : '';
    const next  = currentPage < totalPages
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
    if (cur <= 3)         return [1, 2, 3, 4, '…', total];
    if (cur >= total - 2) return [1, '…', total-3, total-2, total-1, total];
    return [1, '…', cur-1, cur, cur+1, '…', total];
  }

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
  fetchPosts();
});