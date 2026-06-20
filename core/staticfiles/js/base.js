/* ═══════════════════════════════════════════════
   base.js — MedScript
   Header scroll · Active nav · Mobile menu · Side panels · Particles
═══════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── DOM refs ── */
  const header      = document.getElementById('site-header');
  const hamburger   = document.getElementById('hamburger');
  const mobileNav   = document.getElementById('mobileNav');
  const navLinks    = document.querySelectorAll('.nav-links a, .mobile-nav a');
  const sectionEls  = document.querySelectorAll('section[id]');
  const leftDots    = document.querySelectorAll('.side-panel--left  .side-dot');
  const rightDots   = document.querySelectorAll('.side-panel--right .side-dot');
  const leftTrack   = document.getElementById('leftTrack');
  const rightTrack  = document.getElementById('rightTrack');
  const scrollPctEl = document.getElementById('scrollPct');

  /* ════════════════════════════════════════════
     ACTIVE NAV — match current URL path
  ════════════════════════════════════════════ */
  function markActiveByPath() {
    const path = window.location.pathname;
    navLinks.forEach(a => {
      const href = a.getAttribute('href') || '';
      /* exact match OR the link is a prefix of the current path */
      const isActive = href !== '/' && path.startsWith(href)
        || href === '/' && path === '/';
      a.classList.toggle('active', isActive);
    });
  }
  markActiveByPath();

  /* ════════════════════════════════════════════
     HEADER SCROLL
  ════════════════════════════════════════════ */
  function onScroll() {
    header?.classList.toggle('scrolled', window.scrollY > 50);
    updateSidePanels();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ════════════════════════════════════════════
     MOBILE MENU
  ════════════════════════════════════════════ */
  hamburger?.addEventListener('click', e => {
    e.stopPropagation();
    const open = mobileNav.classList.toggle('active');
    hamburger.classList.toggle('active', open);
    hamburger.setAttribute('aria-expanded', String(open));
    mobileNav.setAttribute('aria-hidden', String(!open));
  });

  /* close on link click */
  mobileNav?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });

  /* close on outside click */
  document.addEventListener('click', e => {
    if (!header?.contains(e.target) && !mobileNav?.contains(e.target)) closeMenu();
  });

  function closeMenu() {
    mobileNav?.classList.remove('active');
    hamburger?.classList.remove('active');
    hamburger?.setAttribute('aria-expanded', 'false');
    mobileNav?.setAttribute('aria-hidden', 'true');
  }

  /* ════════════════════════════════════════════
     SIDE PANELS
  ════════════════════════════════════════════ */
  function updateSidePanels() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;

    const pct = Math.min(window.scrollY / maxScroll, 1);
    const trackPct = Math.round(pct * 100);

    if (leftTrack)   leftTrack.style.height  = trackPct + '%';
    if (rightTrack)  rightTrack.style.height = trackPct + '%';
    if (scrollPctEl) scrollPctEl.textContent = String(trackPct).padStart(2, '0');

    /* which section are we in */
    const y = window.scrollY + window.innerHeight * 0.4;
    let activeIdx = 0;
    sectionEls.forEach((s, i) => { if (y >= s.offsetTop) activeIdx = i; });

    const lIdx = Math.min(activeIdx, leftDots.length  - 1);
    const rIdx = Math.min(activeIdx, rightDots.length - 1);
    leftDots.forEach( (d, i) => d.classList.toggle('active', i === lIdx));
    rightDots.forEach((d, i) => d.classList.toggle('active', i === rIdx));
  }
  updateSidePanels();

  /* ════════════════════════════════════════════
     SMOOTH SCROLL for on-page anchor links
  ════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ════════════════════════════════════════════
     QUANTUM PARTICLES
  ════════════════════════════════════════════ */
  function spawnParticle() {
    const colours = ['#e0a3ff', '#ff69b4', '#9370db', '#00ffff'];
    const p       = document.createElement('div');
    const size    = Math.random() * 3 + 1;
    const colour  = colours[Math.floor(Math.random() * colours.length)];
    const drift   = (Math.random() - 0.5) * 160;

    Object.assign(p.style, {
      position:      'fixed',
      width:         size + 'px',
      height:        size + 'px',
      background:    colour,
      borderRadius:  '50%',
      left:          Math.random() * 100 + '%',
      top:           '100vh',
      pointerEvents: 'none',
      zIndex:        '-1',
      boxShadow:     `0 0 8px ${colour}`,
    });

    document.body.appendChild(p);

    p.animate([
      { transform: 'translateY(0)   translateX(0px)',      opacity: 0   },
      { transform: `translateY(-100vh) translateX(${drift}px)`, opacity: 0.8 },
    ], {
      duration: Math.random() * 3000 + 2500,
      easing:   'ease-out',
    }).onfinish = () => p.remove();
  }
  setInterval(spawnParticle, 1600);

  /* ════════════════════════════════════════════
     INTERSECTION OBSERVER — fade-in elements
  ════════════════════════════════════════════ */
  const fadeEls = document.querySelectorAll('.timeline-content, .hexagon, .fade-in');
  if (fadeEls.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    fadeEls.forEach(el => {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(40px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      io.observe(el);
    });
  }

})();