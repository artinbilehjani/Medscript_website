/* ═══════════════════════════════════════════════
   home.js — MedScript Home
═══════════════════════════════════════════════ */
(() => {
  'use strict';

  const API_URL = window.APP_CONFIG?.homeApiUrl || '/dashboard/api/v1/home/';

  /* Static default thumbnail — purely a frontend fallback. Never written
     to any model field, so there's nothing for backend cleanup logic to
     ever delete. Adjust MEDIA_URL prefix below if it differs per-env. */
  const MEDIA_URL = window.APP_CONFIG?.mediaUrl || '/media/';
  const DEFAULT_POST_THUMBNAIL = MEDIA_URL + 'images/default_images/blank_post_thumbnail_400x250.jpg';

  /* ════════════════════════════════════════════
     FETCH
  ════════════════════════════════════════════ */
  async function loadHome() {
    try {
      const res  = await fetch(API_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applySettings(data.settings);
      applyAnnouncement(data.announcement);
      buildCoverflow('latest',  data.latest_posts      || []);
      buildCoverflow('popular', data.most_viewed_posts || []);

      /* Hand the full payload off to home_section_renderer.js via a
         custom event, instead of that file making its own duplicate
         fetch to the same endpoint. Dispatched on `document` so load
         order between the two <script> tags doesn't matter — the
         renderer can attach its listener either before or after this
         fires, and CustomEvent + addEventListener both work fine
         regardless of which file finishes loading first, AS LONG AS the
         listener is registered before this line runs. Since both
         scripts run synchronously top-to-bottom and home.js's
         DOMContentLoaded handler always fires after both files have
         finished parsing and registering their listeners, this is safe. */
      document.dispatchEvent(new CustomEvent('medscript:home-data', { detail: data }));
    } catch (err) {
      console.error('[home]', err);
      buildCoverflow('latest',  []);
      buildCoverflow('popular', []);
      document.dispatchEvent(new CustomEvent('medscript:home-data', { detail: null }));
    }
  }

  function applySettings(s) {
    if (!s) return;
    const t = document.getElementById('heroTitle');
    const u = document.getElementById('heroSub');
    if (t) t.textContent = s.site_title         || 'MedScript';
    if (u) u.textContent = s.homepage_hero_text || 'Your medical university notes, organized.';
  }

  function applyAnnouncement(a) {
    if (!a) return;
    const bar  = document.getElementById('announceBar');
    const text = document.getElementById('announceText');
    if (!bar || !text) return;
    text.textContent = a.title + (a.body ? ' — ' + a.body : '');
    bar.hidden = false;
    document.getElementById('announceClose')?.addEventListener('click', () => {
      bar.style.opacity = '0';
      bar.style.transition = 'opacity .3s';
      setTimeout(() => { bar.hidden = true; }, 320);
    });
  }

  /* ════════════════════════════════════════════
     COVERFLOW
     Key visual idea from screenshot:
     - Full viewport width, cards bleed to edges
     - Heavy perspective rotation on side cards
     - Centre card is much larger/brighter
  ════════════════════════════════════════════ */
  function buildCoverflow(id, posts) {
    const container = document.getElementById(id + 'Container');
    const dotsEl    = document.getElementById(id + 'Dots');
    const prevBtn   = document.getElementById(id + 'Prev');
    const nextBtn   = document.getElementById(id + 'Next');
    const playBtn   = document.getElementById(id + 'Play');
    if (!container) return;

    /* Loading state already removed by the time JS runs; clear it */
    container.innerHTML = '';

    if (!posts.length) {
      container.innerHTML = '<div class="cf-empty">No posts yet</div>';
      return;
    }

    let current = 0;
    let playing = true;
    let timer   = null;

    /* ── Build cards ── */
    posts.forEach((post, i) => {
      const a = document.createElement('a');
      a.className = 'coverflow-item';
      a.href      = post.absolute_url || '#';
      a.dataset.index = i;

      /* Reduced-size derived image (400x250, same as the post grid).
         object-fit:cover on .cf-img crops it to fill the portrait card
         box correctly regardless of source ratio. When the post has no
         upload, the API returns null for `thumbnail` and we fall back
         to the static default thumbnail image (still a real <img>, not
         an emoji placeholder). */
      const imgSrc = post.thumbnail || DEFAULT_POST_THUMBNAIL;
      const img = `<img class="cf-img" src="${esc(imgSrc)}" alt="${esc(post.title)}" loading="lazy">`;

      const date  = post.published_date
        ? new Date(post.published_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
        : '';
      const views = post.hit_count != null ? `👁 ${post.hit_count}` : '';

      a.innerHTML = `
        ${img}
        <div class="cf-overlay">
          <div class="cf-label">Medical Note</div>
          <div class="cf-title">${esc(post.title)}</div>
          <div class="cf-meta">
            ${date  ? `<span>${date}</span>`  : ''}
            ${views ? `<span>${views}</span>` : ''}
          </div>
        </div>`;

      /* Clicking a non-active card navigates to it first */
      a.addEventListener('click', e => {
        if (i !== current) { e.preventDefault(); goTo(i); }
      });

      container.appendChild(a);
    });

    /* ── Dots ── */
    if (dotsEl) {
      dotsEl.innerHTML = '';
      posts.forEach((_, i) => {
        const d = document.createElement('button');
        d.className = 'cf-dot';
        d.setAttribute('aria-label', `Slide ${i+1}`);
        d.addEventListener('click', () => goTo(i));
        dotsEl.appendChild(d);
      });
    }

    /* ── Position cards ──
       Spread = 260px per slot  (wider than before, fills viewport)
       Rotation = 52deg per slot  (more dramatic, like screenshot)
       Depth = -130px per slot
    */
    function positionCards() {
      const cards = container.querySelectorAll('.coverflow-item');
      const SPREAD = 240;
      const ROT    = 52;
      const DEPTH  = 130;

      cards.forEach((card, i) => {
        const off    = i - current;
        const absOff = Math.abs(off);
        const vis    = absOff <= 3;

        const x      = off * SPREAD;
        const z      = -(absOff * DEPTH);
        const rotY   = off * ROT;
        const scale  = off === 0 ? 1 : Math.max(0.62, 1 - absOff * 0.14);
        const op     = off === 0 ? 1 : Math.max(0.25, 1 - absOff * 0.28);
        const zi     = 10 - absOff;

        card.style.cssText = `
          transform: translateX(calc(-50% + ${x}px))
                     translateY(-50%)
                     translateZ(${z}px)
                     rotateY(${rotY}deg)
                     scale(${scale});
          z-index: ${zi};
          opacity: ${vis ? op : 0};
          pointer-events: ${vis ? 'auto' : 'none'};
        `;
        card.classList.toggle('cf-active', i === current);
      });

      dotsEl?.querySelectorAll('.cf-dot').forEach((d,i) => {
        d.classList.toggle('active', i === current);
      });
    }

    function goTo(idx) {
      current = ((idx % posts.length) + posts.length) % posts.length;
      positionCards();
    }

    function start() { clearInterval(timer); timer = setInterval(() => goTo(current+1), 2000); }
    function stop()  { clearInterval(timer); }

    prevBtn?.addEventListener('click', () => { goTo(current-1); if (playing) start(); });
    nextBtn?.addEventListener('click', () => { goTo(current+1); if (playing) start(); });
    playBtn?.addEventListener('click', () => {
      playing = !playing;
      playBtn.textContent = playing ? '⏸' : '▶';
      playing ? start() : stop();
    });

    container.addEventListener('mouseenter', stop);
    container.addEventListener('mouseleave', () => { if (playing) start(); });

    /* Touch swipe */
    let tx = 0;
    container.addEventListener('touchstart', e => { tx = e.touches[0].clientX; },{ passive:true });
    container.addEventListener('touchend',   e => {
      const d = tx - e.changedTouches[0].clientX;
      if (Math.abs(d) > 40) { goTo(current + (d>0?1:-1)); if (playing) start(); }
    });

    positionCards();
    start();
  }

  function esc(s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHome);
  } else {
    loadHome();
  }

})();