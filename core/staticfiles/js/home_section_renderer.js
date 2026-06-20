/* ═══════════════════════════════════════════════
   home_section_renderer.js
   Load AFTER home.js on the public home page.

   Reads sections[] from the home API response
   (already fetched by home.js — zero extra calls)
   and applies DB-driven content to the page:
     • Feature rows replaced from DB
     • Hero title/subtitle overridden if set in DB
     • CTA button injected if section has button_url
     • Sections hidden via is_active flag
═══════════════════════════════════════════════ */
(() => {
  'use strict';

  const API_URL = window.APP_CONFIG?.homeApiUrl || '/home/api/v1/home/';

  /* Patch window.fetch to intercept the home API response */
  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await _origFetch.apply(this, args);

    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    /* Only intercept the home API call */
    if (!url.includes('home')) return res;
    const isHome = (() => {
      try { return new URL(url, location.origin).pathname === new URL(API_URL, location.origin).pathname; }
      catch { return url.includes(API_URL.replace(/^\//,'')); }
    })();
    if (!isHome) return res;

    /* Clone so home.js can still consume the original */
    res.clone().json().then(data => {
      if (data?.sections) applyDynamicSections(data.sections);
    }).catch(() => {});

    return res;
  };

  /* ════════════════════════════════════════════
     APPLY SECTIONS
  ════════════════════════════════════════════ */
  function applyDynamicSections(sections) {

    /* ── 1. Feature rows ─────────────────────── */
    const featBlock  = document.getElementById('home-features-block');
    const featureSecs = sections.filter(s => s.section_type === 'features' && s.is_active);

    if (featBlock && featureSecs.length) {
      /* Remove fallback rows */
      featBlock.querySelectorAll('.feature-row[data-fallback]').forEach(r => r.remove());

      /* Inject DB rows */
      featureSecs.forEach((sec, i) => {
        const icon    = sec.icon    || ['🧠','⚡','💬'][i % 3];
        const title   = sec.title   || '';
        const body    = sec.content || (sec.subtitle ? `<p>${esc(sec.subtitle)}</p>` : '');
        const btnHtml = sec.button_label && sec.button_url
          ? `<a href="${esc(sec.button_url)}" class="hero-btn hero-btn--ghost"
               style="margin-top:18px;display:inline-flex;align-items:center;gap:8px">
               ${esc(sec.button_label)}
             </a>` : '';

        const row = document.createElement('div');
        row.className = 'feature-row';
        row.innerHTML = `
          <div class="feature-content">
            <span class="feature-icon">${esc(icon)}</span>
            ${title ? `<h3>${esc(title)}</h3>` : ''}
            ${body}
            ${btnHtml}
          </div>
          <div class="feature-visual">${esc(icon)}</div>`;
        featBlock.appendChild(row);
      });
    }

    /* ── 2. Hero section overrides ───────────── */
    const heroSec = sections.find(s => s.section_type === 'hero' && s.is_active);
    if (heroSec) {
      /* title / subtitle only override if non-empty (DB wins over SiteSettings) */
      if (heroSec.title) {
        const el = document.getElementById('heroTitle');
        if (el) el.textContent = heroSec.title;
      }
      if (heroSec.subtitle) {
        const el = document.getElementById('heroSub');
        if (el) el.textContent = heroSec.subtitle;
      }
      /* CTA button */
      if (heroSec.button_label && heroSec.button_url) {
        const actions = document.getElementById('hero-actions');
        if (actions && !actions.querySelector('.hero-btn--db')) {
          const btn = document.createElement('a');
          btn.href      = heroSec.button_url;
          btn.className = 'hero-btn hero-btn--primary hero-btn--db';
          btn.textContent = heroSec.button_label;
          actions.prepend(btn);
        }
      }
    }

    /* ── 3. Show / hide whole sections by is_active ─── */
    const TYPE_TO_ID = { hero:'hero', latest:'latest', popular:'popular' };
    sections.forEach(sec => {
      const id = TYPE_TO_ID[sec.section_type];
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.style.display = sec.is_active ? '' : 'none';
    });

    /* Hide the whole features block if no active feature section */
    if (featBlock) {
      const hasActive = sections.some(s => s.section_type === 'features' && s.is_active);
      /* Only hide if there is at least one feature section in DB
         (if none exist at all, keep the fallback rows visible) */
      const hasFeatSec = sections.some(s => s.section_type === 'features');
      if (hasFeatSec && !hasActive) featBlock.style.display = 'none';
    }
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                          .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();