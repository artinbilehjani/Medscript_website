/* ═══════════════════════════════════════════════
   home_section_renderer.js — MedScript Home
   Renders the admin-configurable "features" rows
   (HomepageSection, section_type='features') inside
   #home-features-block, connected by a zigzag
   ECG-style pulse line. Works for any row count —
   left/right alternates by index automatically.
═══════════════════════════════════════════════ */
(() => {
  'use strict';

  const BLOCK    = document.getElementById('home-features-block');
  const TITLE_EL = document.getElementById('home-features-title');
  const TRACK    = document.getElementById('feature-ecg-track');
  const PATH     = document.getElementById('feature-ecg-path');
  const PULSE    = document.getElementById('feature-ecg-pulse');
  const SVG_EL   = document.getElementById('feature-ecg-svg');

  if (!BLOCK) return;

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentSections = [];
  let resizeTimer = null;

  /* ════════════════════════════════════════════
     RENDER ROWS
     Each HomepageSection (section_type='features')
     becomes one .feature-row. Side alternates
     left/right automatically by index — matches the
     zigzag's natural shape, no DB field needed for it.
  ════════════════════════════════════════════ */
  function renderRows(sections) {
    /* Remove any existing fallback/previous rows, keep the ECG track. */
    BLOCK.querySelectorAll('.feature-row').forEach(el => el.remove());

    if (!sections || !sections.length) {
      const empty = document.createElement('p');
      empty.className = 'feature-empty';
      empty.textContent = 'No feature sections published yet.';
      BLOCK.appendChild(empty);
      currentSections = [];
      updateZigzag();
      return;
    }

    currentSections = sections;

    sections.forEach((section, i) => {
      const row = document.createElement('div');
      row.className = 'feature-row';
      row.dataset.side = i % 2 === 0 ? 'left' : 'right';

      const icon  = section.icon || '◆';
      const title = section.title || '';
      const body  = section.content || section.subtitle || '';

      row.innerHTML = `
        <div class="feature-content">
          <span class="feature-icon">${esc(icon)}</span>
          ${title ? `<h3>${esc(title)}</h3>` : ''}
          ${body  ? `<p>${esc(body)}</p>` : ''}
          ${section.button_label && section.button_url
            ? `<a class="feature-link" href="${esc(section.button_url)}">${esc(section.button_label)} →</a>`
            : ''}
        </div>
      `;

      BLOCK.appendChild(row);
    });

    /* Wait one frame so layout is committed before measuring positions. */
    requestAnimationFrame(() => requestAnimationFrame(updateZigzag));
  }

  /* ════════════════════════════════════════════
     ZIGZAG PATH
     Computed from the ACTUAL rendered position of
     each row's connection anchor (a 1px marker at
     the inner edge of .feature-content), rather than
     hardcoded coordinates — stays correct regardless
     of how tall each row renders (variable content
     length from the DB) or how many rows exist.
  ════════════════════════════════════════════ */
  function updateZigzag() {
    if (!TRACK || !PATH || !SVG_EL) return;

    const rows = Array.from(BLOCK.querySelectorAll('.feature-row'));
    if (rows.length < 2) {
      PATH.setAttribute('d', '');
      if (PULSE) PULSE.style.display = 'none';
      return;
    }
    if (PULSE) PULSE.style.display = '';

    const trackRect = TRACK.getBoundingClientRect();
    if (trackRect.width === 0 || trackRect.height === 0) return;

    /* For each row, find the x position of its connection point
       (inner edge of the text content, alternating left/right) and
       its vertical center — both relative to the track's own box,
       so the SVG's viewBox can be 1:1 with real pixels. */
    const points = rows.map(row => {
      const side    = row.dataset.side;
      const content = row.querySelector('.feature-content');
      const cRect   = content.getBoundingClientRect();

      const x = side === 'left'
        ? (cRect.right - trackRect.left)   /* connects from the right edge of left-aligned text */
        : (cRect.left  - trackRect.left);  /* connects from the left edge of right-aligned text  */
      const y = (cRect.top + cRect.height / 2) - trackRect.top;

      return { x, y };
    });

    /* Build a true zigzag: straight line segments between each row's
       anchor point, via a midpoint at the vertical center between
       consecutive rows so the line has a clear diagonal "spike"
       between rows rather than a single straight line cutting
       through row content. */
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const midY = (a.y + b.y) / 2;
      d += ` L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`;
    }

    PATH.setAttribute('d', d);

    /* Match the viewBox to the track's real pixel size so the path's
       computed coordinates render 1:1, no scaling distortion. */
    SVG_EL.setAttribute('viewBox', `0 0 ${trackRect.width} ${trackRect.height}`);

    if (REDUCED_MOTION) {
      /* Show the finished line immediately, no draw-in, and don't
         animate the traveling pulse — keep it static and hidden
         rather than a constantly-moving dot. */
      PATH.style.transition = 'none';
      PATH.style.strokeDasharray = 'none';
      PATH.style.strokeDashoffset = '0';
      if (PULSE) PULSE.style.display = 'none';
      return;
    }

    /* Restart the draw-in animation so it replays whenever content
       (and therefore path length) changes — e.g. after a resize. */
    const length = PATH.getTotalLength();
    PATH.style.strokeDasharray = `${length}`;
    PATH.style.strokeDashoffset = `${length}`;
    PATH.getBoundingClientRect(); /* force reflow before re-enabling the transition */
    PATH.style.transition = 'none';
    requestAnimationFrame(() => {
      PATH.style.transition = 'stroke-dashoffset 1.4s ease';
      PATH.style.strokeDashoffset = '0';
    });

    /* Re-point the <animateMotion> at the freshly computed path so the
       traveling pulse dot follows the new shape exactly. */
    if (PULSE) {
      const motion = PULSE.querySelector('animateMotion');
      if (motion) {
        motion.setAttribute('path', d);
        /* Restart the SMIL animation so it picks up the new path immediately. */
        if (typeof motion.beginElement === 'function') {
          try { motion.beginElement(); } catch (e) { /* ignore if unsupported */ }
        }
      }
    }
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ════════════════════════════════════════════
     FEATURES BLOCK TITLE
     Admin-managed via a HomepageSection row with
     section_type='features_title'. Uses its `title`
     field as the heading text above the zigzag rows.
     Falls back to "News" if no active row of this
     type exists, so the heading never goes blank.
  ════════════════════════════════════════════ */
  function applyFeaturesTitle(allSections) {
    if (!TITLE_EL) return;
    const titleSection = allSections.find(s => s.section_type === 'features_title');
    TITLE_EL.textContent = (titleSection && titleSection.title) || 'News';
  }

  /* ════════════════════════════════════════════
     DATA SOURCE
     Reuses the payload already fetched by home.js
     (dispatched as a custom event) instead of making
     a second request to the same endpoint.
  ════════════════════════════════════════════ */
  document.addEventListener('medscript:home-data', (e) => {
    const data = e.detail;
    /* Backend currently returns one mixed 'sections' list (hero, features,
       features_title, about, cta, contact all together) rather than
       separate per-type keys — filter client-side instead, so a future
       'about'/'cta' row never silently renders inside the zigzag block. */
    const allSections = data?.sections || [];

    applyFeaturesTitle(allSections);

    const sections = allSections
      .filter(s => s.section_type === 'features')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderRows(sections);
  });

  /* Recompute the zigzag on resize (debounced) since row heights and
     left/right positions shift at different breakpoints. */
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateZigzag, 150);
  });

})();