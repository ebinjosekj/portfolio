/**
 * Ebin Jose — portfolio interactions.
 * Small, dependency-free modules. Each one checks for its own markup,
 * respects prefers-reduced-motion and degrades to plain HTML.
 */

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const desktopQuery = window.matchMedia('(min-width: 901px)');
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

window.__ejReady = true;
if (reduce) root.classList.add('reduce');

/* ------------------------------------------------------------------ */
/* Text splitting                                                       */
/* ------------------------------------------------------------------ */
function splitHeroTitle() {
  const title = $('[data-split]');
  if (!title) return;
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  $$('.line', title).forEach((line, li) => {
    const text = line.textContent.trim();
    line.setAttribute('aria-hidden', 'true');
    line.textContent = '';
    [...text].forEach((ch, ci) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch;
      span.style.setProperty('--ci', ci);
      span.style.setProperty('--li', li);
      line.appendChild(span);
    });
  });
}

function splitHeadings() {
  $$('[data-reveal="heading"]').forEach((h) => {
    const parts = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = parts.map((p, i) => `<span class="hline" style="--li:${i}"><span>${p.trim()}</span></span>`).join('');
  });
}

/* ------------------------------------------------------------------ */
/* Preloader → intro                                                    */
/* ------------------------------------------------------------------ */
function runPreloader() {
  return new Promise((resolve) => {
    const el = $('.preloader');
    if (reduce || !el) { resolve(); return; }

    const isReturn = root.classList.contains('is-return');
    const minTime = isReturn ? 400 : 1100;
    const maxTime = isReturn ? 1000 : 2400;
    root.classList.add('is-loading');

    const bar = $('.preloader__bar', el);
    const count = $('[data-preload-count]', el);
    const tasks = [
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))),
    ];
    let loaded = 0;
    tasks.forEach((p) => Promise.resolve(p).then(() => { loaded += 1; }, () => { loaded += 1; }));

    const start = performance.now();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      bar.style.setProperty('--p', '1');
      count.textContent = '100';
      setTimeout(() => {
        el.classList.add('is-done');
        root.classList.remove('is-loading');
        try { sessionStorage.setItem('ej-visited', '1'); } catch (e) { /* storage unavailable */ }
        resolve();
        setTimeout(() => el.remove(), 900);
      }, 220);
    };
    const tick = (now) => {
      if (finished) return;
      const t = now - start;
      const ready = loaded === tasks.length || t > maxTime;
      if (ready && t >= minTime) { finish(); return; }
      const p = 1 - Math.pow(1 - Math.min(1, t / minTime), 3);
      const shown = p * (ready ? 0.96 : 0.88);
      bar.style.setProperty('--p', shown.toFixed(3));
      count.textContent = Math.round(shown * 100);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
/* ------------------------------------------------------------------ */
function initNav() {
  const nav = $('[data-nav]');
  if (!nav) return;
  const links = $$('.nav__links a', nav);
  links.forEach((a, i) => a.style.setProperty('--n', i));
  const linkWrap = $('.nav__links', nav);
  const indicator = $('.nav__indicator', nav);
  const menuLinks = $$('.menu__links a');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const moveIndicator = (link) => {
    if (!link) { linkWrap.classList.remove('has-active'); return; }
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    linkWrap.classList.add('has-active');
  };

  let current = null;
  const setActive = (id) => {
    if (id === current) return;
    current = id;
    const match = (a) => a.getAttribute('href') === `#${id}`;
    links.forEach((a) => { a.classList.toggle('is-active', match(a)); if (match(a)) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    menuLinks.forEach((a) => a.classList.toggle('is-active', match(a)));
    moveIndicator(links.find(match));
  };

  const sections = ['home', ...links.map((a) => a.getAttribute('href').slice(1))]
    .map((id) => document.getElementById(id)).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }
  window.addEventListener('resize', () => moveIndicator(links.find((a) => a.classList.contains('is-active'))), { passive: true });

  // Hover preview of the indicator
  links.forEach((a) => a.addEventListener('pointerenter', () => moveIndicator(a)));
  linkWrap.addEventListener('pointerleave', () => moveIndicator(links.find((a) => a.classList.contains('is-active'))));

  initMobileMenu(nav);
}

function initMobileMenu(nav) {
  const toggle = $('.nav__toggle', nav);
  const menu = $('#mobile-menu');
  if (!toggle || !menu) return;
  let open = false;
  let closeTimer;

  const focusables = () => [toggle, ...$$('a', menu)];

  const setOpen = (state) => {
    open = state;
    toggle.setAttribute('aria-expanded', String(state));
    toggle.setAttribute('aria-label', state ? 'Close menu' : 'Open menu');
    clearTimeout(closeTimer);
    if (state) {
      menu.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      setTimeout(() => $('a', menu)?.focus({ preventScroll: true }), 350);
    } else {
      menu.classList.remove('is-open');
      document.body.style.overflow = '';
      closeTimer = setTimeout(() => { menu.hidden = true; }, reduce ? 0 : 700);
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); toggle.focus(); }
    if (e.key === 'Tab') {
      const f = focusables();
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  desktopQuery.addEventListener('change', (e) => { if (e.matches && open) setOpen(false); });
}

/* ------------------------------------------------------------------ */
/* Scroll reveals                                                       */
/* ------------------------------------------------------------------ */
function initReveals() {
  const els = $$('[data-reveal]');
  // Stagger siblings that reveal together
  els.forEach((el) => {
    if (el.dataset.reveal === 'stagger') $$(':scope > *', el).forEach((c, i) => c.style.setProperty('--si', i));
    const sibs = $$(':scope > [data-reveal]', el.parentElement);
    const idx = sibs.indexOf(el);
    if (idx > 0 && el.dataset.reveal !== 'heading') el.style.setProperty('--rd', `${Math.min(idx, 5) * 0.08}s`);
  });

  if (reduce || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      e.target.dispatchEvent(new CustomEvent('reveal'));
      io.unobserve(e.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ */
/* Statistics                                                           */
/* ------------------------------------------------------------------ */
function initStats() {
  const stats = $('.stats');
  if (!stats) return;
  const counters = $$('[data-count]', stats);
  const scramble = $('[data-scramble]', stats);
  if (reduce) return;
  counters.forEach((c) => { c.textContent = '0'; });

  const run = () => {
    counters.forEach((c) => {
      const to = Number(c.dataset.count);
      const dur = 1600;
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        c.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    if (scramble) {
      const final = scramble.dataset.scramble;
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#<>/{}01';
      let frame = 0;
      const total = 26;
      const step = () => {
        frame += 1;
        scramble.textContent = [...final].map((ch, i) => (frame / total > (i + 1) / final.length || ch === '.' ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join('');
        if (frame < total) setTimeout(step, 45);
        else scramble.textContent = final;
      };
      step();
    }
  };
  stats.addEventListener('reveal', run, { once: true });
}

/* ------------------------------------------------------------------ */
/* Custom cursor + magnetic elements                                    */
/* ------------------------------------------------------------------ */
function initCursor() {
  if (!finePointer || reduce) return;
  const cursor = $('.cursor');
  if (!cursor) return;
  const dot = $('.cursor__dot', cursor);
  const ring = $('.cursor__ring', cursor);
  let mx = -100, my = -100, rx = -100, ry = -100;
  let active = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    if (!active) { active = true; rx = mx; ry = my; cursor.classList.remove('is-hidden'); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  document.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));

  const hoverSel = 'a, button, summary, [data-magnetic], .work__preview, .tnode';
  document.addEventListener('pointerover', (e) => { if (e.target.closest(hoverSel)) cursor.classList.add('is-hover'); });
  document.addEventListener('pointerout', (e) => { if (e.target.closest(hoverSel) && !e.relatedTarget?.closest?.(hoverSel)) cursor.classList.remove('is-hover'); });

  const loop = () => {
    rx = lerp(rx, mx, 0.18);
    ry = lerp(ry, my, 0.18);
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function initMagnetic() {
  if (!finePointer || reduce) return;
  $$('[data-magnetic]').forEach((el) => {
    const strength = el.classList.contains('contact__email') ? 0.16 : 0.32;
    const inner = el.querySelector(':scope > span');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transition = 'transform .2s ease-out';
      el.style.transform = `translate3d(${x * strength}px, ${y * strength * 1.1}px, 0)`;
      if (inner) inner.style.transform = `translate3d(${x * 0.1}px, ${y * 0.1}px, 0)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)';
      el.style.transform = '';
      if (inner) { inner.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; inner.style.transform = ''; }
    });
  });
}

/* ------------------------------------------------------------------ */
/* About: depth parallax on the portrait composition                   */
/* ------------------------------------------------------------------ */
function initTilt() {
  if (!finePointer || reduce) return;
  const box = $('[data-tilt]');
  if (!box) return;
  const portrait = $('.portrait', box);
  const layers = $$('[data-depth]', box);
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const animate = () => {
    cx = lerp(cx, tx, 0.08); cy = lerp(cy, ty, 0.08);
    portrait.style.setProperty('--ry', `${cx * 7}deg`);
    portrait.style.setProperty('--rx', `${-cy * 6}deg`);
    layers.forEach((l) => { const d = Number(l.dataset.depth); l.style.transform = `translate3d(${cx * d * 9}px, ${cy * d * 9}px, 0)`; });
    if (Math.abs(cx - tx) > 0.001 || Math.abs(cy - ty) > 0.001) raf = requestAnimationFrame(animate); else raf = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(animate); };
  window.addEventListener('pointermove', (e) => {
    const r = box.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    tx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width), -1, 1);
    ty = clamp((e.clientY - (r.top + r.height / 2)) / (r.height), -1, 1);
    kick();
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Hero particles (2D canvas, cheap)                                    */
/* ------------------------------------------------------------------ */
function initParticles() {
  const canvas = $('[data-particles]');
  const hero = $('#home');
  if (!canvas || !hero) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const colors = ['79,140,255', '139,92,246', '54,214,232', '220,230,255'];
  let w, h, dpr, parts = [];
  const mouse = { x: 0, y: 0, cx: 0, cy: 0 };

  const build = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = w < 760 ? 34 : 80;
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      r: Math.random() * 1.3 + 0.3,
      vy: -(Math.random() * 0.12 + 0.03),
      vx: (Math.random() - 0.5) * 0.05,
      c: colors[Math.floor(Math.random() * colors.length)],
      tw: Math.random() * Math.PI * 2,
    }));
  };
  build();

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    mouse.cx = lerp(mouse.cx, mouse.x, 0.05);
    mouse.cy = lerp(mouse.cy, mouse.y, 0.05);
    for (const p of parts) {
      if (!reduce) {
        p.y += p.vy * p.z * 2; p.x += p.vx;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      }
      const px = p.x - mouse.cx * 24 * p.z;
      const py = p.y - mouse.cy * 18 * p.z;
      const a = (0.25 + 0.55 * p.z) * (0.6 + 0.4 * Math.sin(t * 0.0015 + p.tw));
      ctx.beginPath();
      ctx.arc(px, py, p.r * (0.6 + p.z), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`;
      ctx.fill();
    }
  };

  if (reduce) { draw(0); return; }

  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  let running = false, raf = 0;
  const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
  const start = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop())).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 150); }, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Hero WebGL sculpture (lazy, with CSS fallback)                       */
/* ------------------------------------------------------------------ */
async function initHeroScene() {
  const canvas = $('[data-hero-gl]');
  if (!canvas) return;
  const fallback = () => { root.classList.add('no-webgl'); canvas.remove(); };
  const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) || navigator.connection?.saveData;
  if (lowPower) { fallback(); return; }
  try {
    const { initHeroGL } = await import('./hero-gl.js');
    const ok = initHeroGL(canvas, { reduce, hero: $('#home') });
    if (!ok) fallback();
    canvas.addEventListener('gl-fallback', fallback, { once: true });
  } catch (e) {
    fallback();
  }
}

/* ------------------------------------------------------------------ */
/* Technology universe                                                  */
/* ------------------------------------------------------------------ */
const CATEGORY_INFO = {
  all: { name: '36 technologies, one connected stack', desc: 'Centred on .NET and C#, reaching from the database to the browser and out to the cloud. Choose any technology to see what it connects to.' },
  backend: { name: 'Backend', desc: 'C# and .NET at the core: APIs, business logic and data access for enterprise applications.' },
  frontend: { name: 'Frontend', desc: 'Responsive interfaces built with Angular and React on a solid HTML, CSS and JavaScript foundation.' },
  database: { name: 'Database', desc: 'Relational data with SQL Server, Azure SQL and PostgreSQL, from schema design to stored procedures.' },
  cloud: { name: 'Cloud', desc: 'Hosting, scaling and identity on Microsoft Azure.' },
  devops: { name: 'DevOps', desc: 'Automated build and release pipelines that keep delivery predictable.' },
  security: { name: 'Security', desc: 'Authentication and authorization for APIs and enterprise sign-in.' },
  testing: { name: 'Testing', desc: 'Automated tests and peer review that protect quality as systems grow.' },
  agile: { name: 'Agile', desc: 'Iterative delivery and version control in collaborative teams.' },
};

function initTech() {
  const wrap = $('[data-tech]');
  if (!wrap) return;
  const stage = $('[data-tech-stage]', wrap);
  const items = $$('[data-tech-nodes] > li', wrap);
  const nodes = items.map((li) => $('.tnode', li));
  const byId = new Map(nodes.map((n) => [n.dataset.id, n]));
  const svg = $('.tech__links', wrap);
  const info = $('[data-tech-info]', wrap);
  const infoCat = $('[data-info-cat]', info);
  const infoName = $('[data-info-name]', info);
  const infoDesc = $('[data-info-desc]', info);
  const infoRel = $('[data-info-related]', info);
  const filters = $$('[data-filter]', wrap);
  const catLabel = (c) => CATEGORY_INFO[c]?.name || c;
  const label = (n) => $('.tnode__label', n).textContent;

  nodes.forEach((n) => n.setAttribute('aria-label', `${label(n)}, ${catLabel(n.dataset.cat)}`));

  let filter = 'all';
  let pinned = null;
  let activeNode = null;

  const swapInfo = (fn) => {
    if (reduce) { fn(); return; }
    info.classList.add('is-swapping');
    clearTimeout(swapInfo.t);
    swapInfo.t = setTimeout(() => { fn(); info.classList.remove('is-swapping'); }, 160);
  };

  const showCategory = () => {
    const c = CATEGORY_INFO[filter];
    swapInfo(() => {
      infoCat.textContent = filter === 'all' ? 'Ecosystem' : `${nodes.filter((n) => n.dataset.cat === filter).length} technologies`;
      infoName.textContent = c.name;
      infoDesc.textContent = c.desc;
      infoRel.innerHTML = '';
    });
  };

  const clearLinks = () => { svg.innerHTML = ''; };
  const drawLinks = () => {
    clearLinks();
    if (!activeNode || !desktopQuery.matches) return;
    const sr = stage.getBoundingClientRect();
    const a = activeNode.getBoundingClientRect();
    const ax = a.left + a.width / 2 - sr.left;
    const ay = a.top + a.height / 2 - sr.top;
    (activeNode.dataset.related || '').split(' ').forEach((id) => {
      const t = byId.get(id);
      if (!t) return;
      const b = t.getBoundingClientRect();
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', ax); line.setAttribute('y1', ay);
      line.setAttribute('x2', b.left + b.width / 2 - sr.left); line.setAttribute('y2', b.top + b.height / 2 - sr.top);
      svg.appendChild(line);
    });
  };

  const activate = (node) => {
    activeNode = node;
    const related = new Set((node.dataset.related || '').split(' '));
    nodes.forEach((n) => {
      n.classList.toggle('is-active', n === node);
      n.classList.toggle('is-related', related.has(n.dataset.id));
      n.classList.toggle('is-dim', n !== node && !related.has(n.dataset.id));
    });
    swapInfo(() => {
      infoCat.textContent = catLabel(node.dataset.cat);
      infoName.textContent = label(node);
      infoDesc.textContent = node.dataset.desc;
      infoRel.innerHTML = '';
      [...related].map((id) => byId.get(id)).filter(Boolean).forEach((r, i) => {
        const li = document.createElement('li');
        li.textContent = label(r);
        li.style.setProperty('--i', i);
        infoRel.appendChild(li);
      });
    });
    drawLinks();
  };

  const reset = () => {
    if (pinned) { activate(pinned); return; }
    activeNode = null;
    nodes.forEach((n) => n.classList.remove('is-active', 'is-related', 'is-dim'));
    clearLinks();
    showCategory();
  };

  nodes.forEach((n) => {
    n.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') activate(n); });
    n.addEventListener('focus', () => activate(n));
    n.addEventListener('click', () => {
      pinned = pinned === n ? null : n;
      n.setAttribute('aria-pressed', String(pinned === n));
      nodes.forEach((o) => { if (o !== n) o.removeAttribute('aria-pressed'); });
      if (pinned) activate(n); else reset();
      if (!desktopQuery.matches && pinned) info.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
    n.addEventListener('blur', () => { if (!stage.matches(':hover')) reset(); });
  });
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') reset(); });

  filters.forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    filters.forEach((f) => f.setAttribute('aria-pressed', String(f === b)));
    nodes.forEach((n) => n.classList.toggle('is-filtered-out', filter !== 'all' && n.dataset.cat !== filter));
    pinned = null;
    nodes.forEach((n) => n.removeAttribute('aria-pressed'));
    activeNode = null;
    nodes.forEach((n) => n.classList.remove('is-active', 'is-related', 'is-dim'));
    clearLinks();
    showCategory();
  }));

  // Orbital layout (desktop only)
  const rings = [
    { r: 0.22, speed: 0.05, items: [] },
    { r: 0.34, speed: -0.035, items: [] },
    { r: 0.47, speed: 0.022, items: [] },
  ];
  items.forEach((li) => rings[Number(li.dataset.ring)].items.push(li));
  let angle = 0;
  let size = 0;
  let hovering = false;
  let running = false;
  let raf = 0;
  let last = 0;

  const place = () => {
    rings.forEach((ring, ri) => {
      const n = ring.items.length;
      ring.items.forEach((li, i) => {
        const a = (i / n) * Math.PI * 2 + angle * ring.speed * 10 + ri * 0.6;
        const x = Math.cos(a) * ring.r * size;
        const y = Math.sin(a) * ring.r * size;
        li.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      });
    });
    if (activeNode) drawLinks();
  };
  const measure = () => { size = stage.clientWidth; };

  const loop = (t) => {
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
    last = t;
    if (!hovering) { angle += dt; place(); }
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (running || reduce || !desktopQuery.matches) return; running = true; last = 0; raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  const setMode = () => {
    if (desktopQuery.matches) { measure(); place(); start(); }
    else { stop(); items.forEach((li) => { li.style.transform = ''; }); clearLinks(); }
  };
  stage.addEventListener('pointerenter', () => { hovering = true; });
  stage.addEventListener('pointerleave', () => { hovering = false; });
  stage.addEventListener('focusin', () => { hovering = true; });
  stage.addEventListener('focusout', () => { hovering = false; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { if (e.isIntersecting) setMode(); else stop(); }, { rootMargin: '100px' }).observe(stage);
  } else setMode();
  desktopQuery.addEventListener('change', setMode);
  window.addEventListener('resize', () => { if (desktopQuery.matches) { measure(); place(); } }, { passive: true });
  if (desktopQuery.matches) { measure(); place(); }
}

/* ------------------------------------------------------------------ */
/* Experience timeline                                                  */
/* ------------------------------------------------------------------ */
function initTimeline() {
  const tl = $('[data-timeline]');
  if (!tl) return;

  if (!reduce) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = tl.getBoundingClientRect();
      const p = clamp((window.innerHeight * 0.62 - r.top) / r.height, 0, 1);
      tl.style.setProperty('--tp', p.toFixed(4));
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  $$('.job details', tl).forEach((d) => {
    const summary = $('summary', d);
    const body = $('.job__body', d);
    let busy = false;
    summary.addEventListener('pointermove', (e) => {
      const r = summary.getBoundingClientRect();
      summary.style.setProperty('--mx', `${e.clientX - r.left}px`);
    });
    if (reduce || !body.animate) return;
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      const opts = { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' };
      if (d.open) {
        const h = body.offsetHeight;
        const anim = body.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { ...opts, duration: 380 });
        anim.onfinish = () => { d.open = false; busy = false; };
      } else {
        d.open = true;
        const h = body.offsetHeight;
        const anim = body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], opts);
        $$('li', body).forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 80 + i * 50, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
        anim.onfinish = () => { busy = false; };
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Projects: hover direction, glow, tilt, overlay                       */
/* ------------------------------------------------------------------ */
function initWorks() {
  const works = $$('[data-work]');
  const overlay = $('[data-overlay]');
  if (!works.length) return;

  works.forEach((work) => {
    $$('.tags li', work).forEach((li, i) => li.style.setProperty('--i', i));
    const preview = $('.work__preview', work);

    if (finePointer && !reduce) {
      preview.addEventListener('pointerenter', (e) => {
        const r = preview.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        // Gradient starts from the edge the pointer entered through
        const deg = Math.abs(x) > Math.abs(y) ? (x < 0 ? 90 : 270) : (y < 0 ? 180 : 0);
        preview.style.setProperty('--hd', `${deg}deg`);
      });
      preview.addEventListener('pointermove', (e) => {
        const r = preview.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        preview.style.setProperty('--gx', `${x}px`);
        preview.style.setProperty('--gy', `${y}px`);
        preview.style.setProperty('--ry', `${((x / r.width) - 0.5) * 6}deg`);
        preview.style.setProperty('--rx', `${-((y / r.height) - 0.5) * 5}deg`);
      });
      preview.addEventListener('pointerleave', () => {
        preview.style.setProperty('--rx', '0deg');
        preview.style.setProperty('--ry', '0deg');
      });
    }

    if (!overlay) return;
    const open = () => openOverlay(work, overlay);
    $('[data-open-work]', work).addEventListener('click', open);
    preview.addEventListener('click', open);
  });

  if (!overlay) return;
  const close = () => {
    if (!overlay.open) return;
    if (reduce) { overlay.close(); return; }
    overlay.classList.add('is-closing');
    setTimeout(() => { overlay.classList.remove('is-closing'); overlay.close(); }, 330);
  };
  $('[data-overlay-close]', overlay).addEventListener('click', close);
  overlay.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('close', () => { document.body.style.overflow = ''; });
}

function openOverlay(work, overlay) {
  const media = $('[data-overlay-media]', overlay);
  media.innerHTML = '';
  const mock = $('.mock', work)?.cloneNode(true);
  if (mock) media.appendChild(mock);
  const badge = document.createElement('span');
  badge.className = 'work__badge';
  badge.textContent = 'Concept illustration';
  media.appendChild(badge);
  $('[data-overlay-index]', overlay).textContent = $('.work__index', work).textContent;
  $('[data-overlay-title]', overlay).textContent = $('.work__title', work).textContent;
  $('[data-overlay-tags]', overlay).innerHTML = $('.tags', work).innerHTML;
  $('[data-overlay-body]', overlay).innerHTML = $('.work__detail', work).innerHTML;
  document.body.style.overflow = 'hidden';
  if (typeof overlay.showModal === 'function') overlay.showModal();
  else overlay.setAttribute('open', '');
  $('.overlay__panel', overlay).scrollTop = 0;
}

/* ------------------------------------------------------------------ */
/* Contact: copy email                                                  */
/* ------------------------------------------------------------------ */
function initCopy() {
  const btn = $('[data-copy]');
  const status = $('[data-copy-status]');
  if (!btn) return;
  const label = $('span', btn);
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
    }
    label.textContent = ok ? 'Email copied' : 'Copy failed';
    status.textContent = ok ? 'Email address copied to your clipboard.' : 'Copy didn’t work here. Select the address above to copy it.';
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { label.textContent = 'Copy email'; status.textContent = ''; }, 2600);
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */
splitHeroTitle();
splitHeadings();
initNav();
initReveals();
initStats();
initTech();
initTimeline();
initWorks();
initCopy();
initCursor();
initMagnetic();
initTilt();
initParticles();

runPreloader().then(() => {
  root.classList.add('is-ready');
  initHeroScene();
});
