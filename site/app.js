/* =========================================================
   NORTHPEAK STUDIO — APP.JS
   Lenis smooth scroll, GSAP ScrollTrigger, custom cursor,
   magnetic buttons, language switcher, motion logic + FX.
   ========================================================= */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  /* -------------------------------------------------------
     0. YEAR
     ------------------------------------------------------- */
  const yEl = $('#year');
  if (yEl) yEl.textContent = new Date().getFullYear();
  // Last-updated date (today, formatted ISO)
  const luEl = $('#footerLastUpdate');
  if (luEl) luEl.textContent = new Date().toISOString().slice(0, 10);

  /* -------------------------------------------------------
     1. I18N — language switcher
     ------------------------------------------------------- */
  function applyI18n(lang) {
    const dict = window.NP_I18N[lang];
    if (!dict) return;
    document.documentElement.dataset.lang = lang;
    document.documentElement.lang = lang;
    // textContent
    $$('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (dict[key] != null) {
        if (el.dataset.splitDone) {
          el.textContent = dict[key];
          delete el.dataset.splitDone;
          if (el.parentElement && el.parentElement.matches('[data-reveal-words]')) {
            splitWords(el.parentElement);
          }
        } else if (el.dataset.charSplitDone) {
          el.textContent = dict[key];
          delete el.dataset.charSplitDone;
          splitChars(el);
        } else if (el.dataset.i18nHtml !== undefined) {
          el.innerHTML = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });
    // attribute placeholders (e.g. <input data-i18n-placeholder="cmdk.placeholder">)
    $$('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (dict[key] != null) el.placeholder = dict[key];
    });
    // <title> + <meta name=description> + <meta og:locale>
    if (lang === 'pl') {
      document.title = 'NorthPeak Studio — Strony i aplikacje, które się bronią';
      const desc = 'Niezależne studio produktowe. Projektujemy i budujemy aplikacje webowe, mobilne, MVP, branding i landing page — z dbałością o szybkość, dostępność i detal.';
      document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', 'NorthPeak Studio — Strony i aplikacje, które się bronią');
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
      document.querySelector('meta[property="og:locale"]')?.setAttribute('content', 'pl_PL');
    } else if (lang === 'en') {
      document.title = 'NorthPeak Studio — Sites and apps that hold up';
      const desc = "Independent product studio. We design and build web apps, mobile apps, MVPs, branding and landing pages — built for speed, accessibility, and detail.";
      document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', 'NorthPeak Studio — Sites and apps that hold up');
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
      document.querySelector('meta[property="og:locale"]')?.setAttribute('content', 'en_US');
    }
    // Cmd+K — re-render with new dict
    if (typeof window.__rerenderCmdK === 'function') window.__rerenderCmdK();
    try { localStorage.setItem('np-lang', lang); } catch (e) {}
  }

  function initLang() {
    let saved = 'pl';
    try { saved = localStorage.getItem('np-lang') || 'pl'; } catch (e) {}
    applyI18n(saved);
    const btn = $('#langSwitch');
    if (btn) btn.addEventListener('click', () => {
      const cur = document.documentElement.dataset.lang;
      applyI18n(cur === 'pl' ? 'en' : 'pl');
    });
  }

  /* -------------------------------------------------------
     1d. PWA — service worker + install prompt
     ------------------------------------------------------- */
  function initPWA() {
    // Register service worker (only on https or localhost — required by browsers)
    if ('serviceWorker' in navigator) {
      // Defer until window load so it doesn't compete with critical resources
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => {
            // If a waiting SW exists, prompt update via toast
            if (reg.waiting) {
              window.__npToast?.('Nowa wersja gotowa — odśwież');
            }
            // Listen for new updates
            reg.addEventListener('updatefound', () => {
              const sw = reg.installing;
              if (!sw) return;
              sw.addEventListener('statechange', () => {
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version is available
                  if (typeof window.__npToast === 'function') {
                    window.__npToast('Nowa wersja zainstalowana');
                  }
                }
              });
            });
          })
          .catch(() => { /* fail silently — site still works */ });
      });
    }

    // Detect platform — iOS Safari needs different install flow
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isInStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    const isMobile = /Mobi|Android/i.test(ua) || isIOS;

    if (isInStandalone) {
      document.documentElement.classList.add('is-pwa');
      return; // already installed, nothing to prompt
    }

    let deferredPrompt = null;
    const installBtn = document.querySelector('#pwaInstallBtn');
    const iosSheet = document.querySelector('#pwaIOSSheet');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn && window.scrollY > window.innerHeight * 0.5) {
        installBtn.classList.add('is-visible');
      }
    });

    if (installBtn) {
      // Mobile: show button sooner (people decide faster on phones)
      const threshold = isMobile ? 0.4 : 0.8;
      const showAfterScroll = () => {
        if (window.scrollY > window.innerHeight * threshold) {
          if (deferredPrompt || isIOS) {
            installBtn.classList.add('is-visible');
            window.removeEventListener('scroll', showAfterScroll);
          }
        }
      };
      window.addEventListener('scroll', showAfterScroll, { passive: true });

      installBtn.addEventListener('click', async () => {
        // iOS Safari: no beforeinstallprompt — show instructions sheet
        if (isIOS && iosSheet) {
          iosSheet.classList.add('is-open');
          return;
        }
        if (!deferredPrompt) return;
        installBtn.classList.add('is-loading');
        try {
          await deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice.outcome === 'accepted') {
            installBtn.classList.remove('is-visible');
            deferredPrompt = null;
          }
        } catch (e) { /* user dismissed */ }
        installBtn.classList.remove('is-loading');
      });
    }

    // iOS sheet close handler
    if (iosSheet) {
      iosSheet.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => iosSheet.classList.remove('is-open'));
      });
    }

    window.addEventListener('appinstalled', () => {
      if (installBtn) installBtn.classList.remove('is-visible');
      deferredPrompt = null;
    });
  }

  /* -------------------------------------------------------
     1c. BACK-TO-TOP — visible after hero, smooth scroll
     ------------------------------------------------------- */
  function initBackToTop() {
    const btn = $('#backToTop');
    if (!btn) return;
    const threshold = () => Math.max(window.innerHeight * 0.7, 600);
    let visible = false;
    const tick = () => {
      const should = window.scrollY > threshold();
      if (should !== visible) {
        visible = should;
        btn.classList.toggle('is-visible', visible);
      }
    };
    window.addEventListener('scroll', tick, { passive: true });
    tick();
    // Smooth scroll with Lenis if available
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.__lenis && typeof window.__lenis.scrollTo === 'function') {
        window.__lenis.scrollTo(0, { duration: 1.2 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (typeof window.__sfx === 'function') window.__sfx('tick');
    });
  }

  /* -------------------------------------------------------
     1b. THEME — dark/light toggle, persists, respects OS
     ------------------------------------------------------- */
  function initTheme() {
    const KEY = 'np-theme';
    const root = document.documentElement;
    const btn = $('#themeToggle');
    const mql = window.matchMedia('(prefers-color-scheme: light)');

    const apply = (theme) => {
      if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        root.removeAttribute('data-theme');
      }
      if (btn) {
        const next = theme === 'light' ? 'ciemny' : 'jasny';
        const lang = root.dataset.lang || 'pl';
        btn.setAttribute('aria-label',
          lang === 'en'
            ? `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`
            : `Przełącz na motyw ${next}`);
        btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      }
    };

    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    const initial = saved || (mql.matches ? 'light' : 'dark');
    apply(initial);

    if (btn) {
      btn.addEventListener('click', () => {
        const cur = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const next = cur === 'light' ? 'dark' : 'light';
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) {}
        if (typeof window.__sfx === 'function') window.__sfx('tick');
      });
    }

    // Follow OS changes if user hasn't explicitly chosen
    mql.addEventListener?.('change', (e) => {
      let userChose = null;
      try { userChose = localStorage.getItem(KEY); } catch (_) {}
      if (!userChose) apply(e.matches ? 'light' : 'dark');
    });
  }

  /* -------------------------------------------------------
     2. LOADER
     ------------------------------------------------------- */
  function runLoader() {
    return new Promise((resolve) => {
      const loader = $('#loader');
      const counter = $('#loaderCount');
      const bar = $('#loaderBar');
      if (!loader) return resolve();

      // Shorter intro (~2s) with soft scale+fade end instead of crash split
      const dur = prefersReduce ? 200 : 1600;
      const start = performance.now();
      let done = false;

      let revealCompleted = false;
      // ============================================================
      // CINEMA INTRO SEQUENCE (Christopher Nolan style — no interaction)
      // Act I   : counter ticks to 100 (1.6s)
      // Act II.a: logo block fades in cinematic (mark → wordmark → sub)
      // Act II.b: slate metadata appears
      // Act II.c: 4 manifesto lines stagger in
      // Act III : decisive white flash → blur dissolve → hero
      // ============================================================
      const cinemaPlay = () => {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        document.body.classList.add('is-loading-act');

        const mark = loader.querySelector('.loader__mark');
        const word = loader.querySelector('.loader__word');
        const sub = loader.querySelector('.loader__sub');
        const lines = Array.from(loader.querySelectorAll('.loader__actLine'));

        const show = (el, delay) => {
          if (!el) return;
          setTimeout(() => el.classList.add('is-act-shown'), delay);
        };

        // CINEMATIC TIMELINE — restored longer, more dramatic pacing
        // Logo opens from middle (scaleX 0→1, 1.6s) one element at a time
        show(mark, 400);
        show(word, 1000);
        show(sub, 1700);

        // Lines start AFTER logo block lands (sub @ 1700 + 1.6s = 3300)
        const LINE_GAP = 700;
        const LINES_BASE = 3000;
        lines.forEach((line, i) => {
          setTimeout(() => line.classList.add('is-shown'), LINES_BASE + i * LINE_GAP);
        });

        // After last line + 1s linger → flash
        const ACT_II_END = LINES_BASE + lines.length * LINE_GAP + 1000;
        setTimeout(() => triggerFlashAndExit(), ACT_II_END);
      };

      const triggerFlashAndExit = () => {
        const flash = document.querySelector('#revealFlash');
        if (flash && !prefersReduce) {
          // SMOOTH cinematic flash with overlapping hero reveal — pure
          // CSS transitions, GPU-accelerated, no jank.
          flash.style.transition = 'none';
          flash.style.animation = 'none';
          flash.style.visibility = 'visible';
          flash.style.opacity = '0';
          flash.style.filter = 'blur(0)';
          flash.style.pointerEvents = 'none';
          flash.style.willChange = 'opacity, filter';
          flash.classList.add('is-firing');
          // Force reflow so transition picks up
          void flash.offsetWidth;

          // Phase 1 (550ms): gentle ramp 0 → 1, soft easing
          flash.style.transition = 'opacity 550ms cubic-bezier(.4,.0,.4,1), filter 550ms cubic-bezier(.4,.0,.4,1)';
          flash.style.opacity = '1';

          // Phase 2 (550ms peak): hide loader instantly under flash
          setTimeout(() => {
            loader.style.transition = 'none';
            loader.style.opacity = '0';
            loader.style.display = 'none';
            loader.style.pointerEvents = 'none';
            document.body.classList.remove('is-loading-act');
            document.body.classList.add('is-loaded');
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
          }, 550);

          // Phase 3 (550 → 1300ms): HOLD blinding white — decisive moment
          // Phase 4 (1300ms): RESOLVE loader promise so main flow can boot
          // Lenis + initHeroParallax + revealHeroContent — hero will fade in
          // BEHIND the flash, becoming visible as the flash dissolves.
          setTimeout(() => {
            try { resolve(); } catch (e) {}
          }, 1300);

          // Phase 5 (1500ms): start slow flash dissolve (overlaps hero reveal)
          setTimeout(() => {
            flash.style.transition = 'opacity 2200ms cubic-bezier(.32,.0,.18,1), filter 2200ms cubic-bezier(.32,.0,.18,1)';
            flash.style.opacity = '0';
            flash.style.filter = 'blur(14px)';
          }, 1500);

          // Phase 6 (3800ms): cleanup AFTER the long fade completes
          setTimeout(() => {
            flash.classList.remove('is-firing');
            flash.style.visibility = 'hidden';
            flash.style.transition = '';
            flash.style.filter = '';
            flash.style.willChange = '';
          }, 3800);
        } else {
          // Reduced motion — skip flash, snap to loaded
          document.body.classList.remove('is-loading-act');
          document.body.classList.add('is-loaded');
          document.documentElement.style.overflow = '';
          document.body.style.overflow = '';
          loader.style.transition = 'opacity 0.4s linear';
          loader.style.opacity = '0';
          setTimeout(() => { loader.style.display = 'none'; resolve(); }, 420);
        }
      };

      const finish = () => {
        if (done) return;
        done = true;
        if (counter) counter.textContent = '100';
        if (bar) bar.style.width = '100%';

        // Horizon flash + line draw fully across — prelude to Act II
        document.body.classList.add('is-loading-stage-horizon');

        if (prefersReduce) {
          setTimeout(() => triggerFlashAndExit(), 100);
          return;
        }

        // Brief breath, then Act II — the cinema sequence begins
        setTimeout(() => cinemaPlay(), 350);
      };

      // Animated favicon — peak draws progressively as loader counts
      const fav = document.querySelector('link[rel="icon"]');
      const origFavHref = fav?.getAttribute('href');
      const buildFaviconSVG = (pct) => {
        // Peak path 5 anchor points, draw progressively
        const total = 100;
        const dashOffset = 100 - pct;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(245,237,225,0.12)" stroke-width="6"/><circle cx="50" cy="50" r="44" fill="none" stroke="#ffb892" stroke-width="6" stroke-linecap="round" stroke-dasharray="276" stroke-dashoffset="${276 - (276 * pct / 100)}" transform="rotate(-90 50 50)"/><path d="M22 68 L40 38 L52 50 L62 30 L78 48" fill="none" stroke="#f5ede1" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></svg>`
        );
      };

      // Counter ticks — cubic ease-in-out for dramatic flow
      const tick = (now) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / dur);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const pct = Math.round(eased * 100);
        if (counter) counter.textContent = pct;
        if (bar) bar.style.width = pct + '%';
        // Update favicon every 10% step for smooth dock animation
        if (fav && pct % 10 === 0) {
          fav.setAttribute('href', buildFaviconSVG(pct));
        }
        if (t < 1) requestAnimationFrame(tick);
        else {
          // Restore original favicon after intro
          if (fav && origFavHref) setTimeout(() => fav.setAttribute('href', origFavHref), 1500);
          finish();
        }
      };
      requestAnimationFrame(tick);

      setTimeout(finish, dur + 800);
    });
  }

  /* -------------------------------------------------------
     2a. LOADER BURST — particle explosion from horizon line
     ------------------------------------------------------- */
  function loaderBurst() {
    const canvas = $('#loaderParticles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2;
    const cy = h / 2;
    const N = Math.min(140, Math.floor(w / 12));
    const particles = [];
    for (let i = 0; i < N; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.4 + (Math.random() < 0.5 ? 0 : Math.PI);
      const speed = Math.random() * 14 + 6;
      // Alpine palette: warm peach + sage green + sky blue + gold sparkles
      const r = Math.random();
      const hue = r < 0.35 ? 22 + Math.random() * 12   // warm peach 22-34
                : r < 0.65 ? 145 + Math.random() * 25  // sage green 145-170
                : r < 0.88 ? 200 + Math.random() * 20  // sky blue 200-220
                : 42 + Math.random() * 8;              // gold sparkle 42-50
      const sat = r < 0.88 ? 65 : 85;
      particles.push({
        x: cx + (Math.random() - 0.5) * 240,
        y: cy + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.45 + (Math.random() - 0.5) * 1.4,
        life: 1,
        decay: Math.random() * 0.018 + 0.010,
        r: Math.random() * 2.4 + 0.7,
        hue: hue,
        sat: sat,
      });
    }

    const t0 = performance.now();
    const tick = (now) => {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      particles.forEach((p) => {
        if (p.life <= 0) return;
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.vy += 0.04; // light gravity
        p.life -= p.decay;
        const a = Math.max(0, p.life);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, ${p.sat || 80}%, 72%, ${a * 0.85})`;
        ctx.shadowColor = `hsla(${p.hue}, ${p.sat || 80}%, 72%, ${a})`;
        ctx.shadowBlur = 12;
        ctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      if (alive && (now - t0) < 1400) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------------
     2b. HERO INTRO — content fades in after curtain reveals
     ------------------------------------------------------- */
  function initHeroIntro() {
    if (prefersReduce) return;
    const hero = $('.hero');
    const content = $('.hero__content');
    if (!hero || !content) return;
    // Hide hero content until curtain wipes
    content.style.opacity = '0';
    content.style.transform = 'translateY(28px)';
    content.style.transition = 'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)';
    // Triggered by runLoader's resolve()
  }

  let __heroRevealed = false;
  function revealHeroContent() {
    if (__heroRevealed) return;
    __heroRevealed = true;
    const content = $('.hero__content');
    if (!content) return;

    // Cinematic entry — buttery slow easing (Apple-grade), GPU-accelerated.
    // Subtle scale 0.985 → 1 adds tactile depth without obvious zoom.
    const easing = 'cubic-bezier(.22,.61,.36,1)';
    content.style.willChange = 'opacity, filter, transform';
    content.style.transition =
      `opacity 1.8s ${easing}, ` +
      `transform 2.0s ${easing}, ` +
      `filter 1.8s ${easing}`;
    content.style.filter = 'blur(10px)';
    content.style.transform = 'translate3d(0, 28px, 0) scale(0.985)';
    content.style.opacity = '0';
    void content.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        content.style.opacity = '1';
        content.style.transform = 'translate3d(0, 0, 0) scale(1)';
        content.style.filter = 'blur(0)';
      });
    });
    // Trigger GSAP hero title char animation in sync with the fade-in
    // (slightly delayed so the chars rise as the blur dissolves)
    setTimeout(() => {
      if (typeof window.__playHeroChars === 'function') {
        try { window.__playHeroChars(); } catch (e) {}
      }
    }, 250);
    // Drop will-change after animation completes so the layer can be released
    setTimeout(() => { content.style.willChange = ''; }, 2200);

    // Stagger reveal of secondary hero elements — matches logo + manifesto wave
    const stagger = [
      { sel: '.hero__topline', delay: 200, finalOp: 1 },
      { sel: '.hero__meta',    delay: 800, finalOp: 1 },
      { sel: '.hero__scroll',  delay: 1100, finalOp: 1 },
      { sel: '.hero__refStamp',delay: 1300, finalOp: 0.7 },
    ];
    stagger.forEach(({ sel, delay, finalOp }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.style.willChange = 'opacity, filter, transform';
      el.style.opacity = '0';
      el.style.filter = 'blur(8px)';
      el.style.transform = 'translate3d(0, 14px, 0) scale(0.99)';
      el.style.transition =
        `opacity 1.6s ${easing}, filter 1.6s ${easing}, transform 1.8s ${easing}`;
      void el.offsetWidth;
      setTimeout(() => {
        el.style.opacity = String(finalOp);
        el.style.filter = 'blur(0)';
        el.style.transform = 'translate3d(0, 0, 0) scale(1)';
        // Release will-change after animation
        setTimeout(() => { el.style.willChange = ''; }, 2000);
      }, delay);
    });
  }

  /* -------------------------------------------------------
     3. CUSTOM CURSOR + LABEL
     ------------------------------------------------------- */
  function initCursor() {
    if (isMobile) return;
    const cursor = $('#cursor');
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    const label = $('.cursor__label', cursor);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let dx = mx, dy = my;
    let snapTarget = null;
    const SNAP_RADIUS = 90;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
    });

    const interactiveSel = 'a, button, .card, .work__card, .impact__cell, [data-magnetic], [data-cursor]';

    const findSnapTarget = () => {
      const candidates = $$(interactiveSel);
      let best = null;
      let bestDist = SNAP_RADIUS;
      candidates.forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const d = Math.hypot(dx, dy);
        // only snap when within element bounds (with halo)
        const insideX = Math.abs(dx) < r.width / 2 + SNAP_RADIUS;
        const insideY = Math.abs(dy) < r.height / 2 + SNAP_RADIUS;
        if (insideX && insideY && d < bestDist) {
          best = { el, cx, cy, r };
          bestDist = d;
        }
      });
      return best;
    };

    const loop = () => {
      // Find snap target every frame
      const found = findSnapTarget();
      if (found) {
        // Pull ring toward target center with strength based on proximity
        const tx = (mx + found.cx) / 2;
        const ty = (my + found.cy) / 2;
        rx += (tx - rx) * 0.22;
        ry += (ty - ry) * 0.22;
      } else {
        rx += (mx - rx) * 0.18;
        ry += (my - ry) * 0.18;
      }
      dx += (mx - dx) * 0.6;
      dy += (my - dy) * 0.6;
      dot.style.transform = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;

      // Manage snap state classes (label + size) here
      if (found && found.el !== snapTarget) {
        snapTarget = found.el;
        document.body.classList.add('cursor-active');
        const txt = snapTarget.dataset.cursor;
        if (txt && label) {
          label.textContent = txt;
          document.body.classList.add('cursor-labeled');
        } else {
          document.body.classList.remove('cursor-labeled');
        }
      } else if (!found && snapTarget) {
        snapTarget = null;
        document.body.classList.remove('cursor-active');
        document.body.classList.remove('cursor-labeled');
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* -------------------------------------------------------
     4. MAGNETIC BUTTONS
     ------------------------------------------------------- */
  function initMagnetic() {
    if (isMobile) return;
    $$('[data-magnetic]').forEach((el) => {
      const strength = el.dataset.magneticStrength
        ? parseFloat(el.dataset.magneticStrength)
        : 0.25;

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'translate(0, 0)';
        setTimeout(() => { el.style.transition = ''; }, 600);
      });
      el.addEventListener('mouseenter', () => {
        el.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
      });
    });
  }

  /* -------------------------------------------------------
     5. LENIS SMOOTH SCROLL
     ------------------------------------------------------- */
  let lenis;
  function initLenis() {
    if (prefersReduce || typeof Lenis === 'undefined') return;
    // Allow disabling via ?nolenis= for screenshot/preview tools
    if (new URLSearchParams(location.search).has('nolenis')) return;
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
    });
    window.__lenis = lenis;

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length > 1) {
          const target = $(id);
          if (target) {
            e.preventDefault();
            lenis.scrollTo(target, { offset: 0, duration: 1.4 });
          }
        }
      });
    });
  }

  /* -------------------------------------------------------
     6. WORD SPLITTING
     ------------------------------------------------------- */
  function splitWords(parent) {
    const targets = parent.matches('[data-i18n]') ? [parent] : $$('[data-i18n]', parent);
    targets.forEach((el) => {
      if (el.dataset.splitDone) return;
      const text = el.textContent.trim();
      const words = text.split(/(\s+)/);
      el.innerHTML = words.map((w) => {
        if (w.trim() === '') return w;
        return `<span class="word-r"><span>${w}</span></span>`;
      }).join('');
      el.dataset.splitDone = '1';
    });

    const wordRs = $$('.word-r > span', parent);
    wordRs.forEach((s, i) => {
      s.style.setProperty('--d', (i * 90) + 'ms');
    });
  }

  function initWordSplitting() {
    $$('[data-reveal-words]').forEach((el) => splitWords(el));
  }

  /* -------------------------------------------------------
     6b. CHARACTER SPLITTING (for hero title hyper effect)
     ------------------------------------------------------- */
  function splitChars(el) {
    if (el.dataset.charSplitDone) return;
    const text = el.textContent;
    // Break into words first so characters never wrap mid-word
    const words = text.split(/(\s+)/);
    el.innerHTML = words.map((w) => {
      if (w === '' ) return '';
      if (/^\s+$/.test(w)) return ' ';
      const chars = [...w].map((c) => `<span class="char-r"><span>${c}</span></span>`).join('');
      return `<span class="word-w">${chars}</span>`;
    }).join(' ');
    el.dataset.charSplitDone = '1';
    const inners = $$('.char-r > span', el);
    inners.forEach((s, i) => {
      s.style.setProperty('--cd', (i * 28) + 'ms');
    });
  }

  function initCharSplitting() {
    $$('[data-char-split]').forEach((el) => splitChars(el));
  }

  /* -------------------------------------------------------
     7. REVEAL ON SCROLL
     ------------------------------------------------------- */
  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    $$('[data-reveal], [data-reveal-words], [data-char-split], [data-divider]').forEach((el) => io.observe(el));
  }

  /* -------------------------------------------------------
     7b. STAGGER REVEAL on lists/grids — auto-applied to
     children of any [data-stagger] container
     ------------------------------------------------------- */
  function initStaggerLists() {
    if (typeof gsap === 'undefined') return;
    const groups = [
      { sel: '.faq__item',         delay: 0.06 },
      { sel: '.studio__antiList li', delay: 0.05 },
      { sel: '.stackGrid__list li',  delay: 0.025 },
      { sel: '.studio__list li',   delay: 0.07 },
    ];
    groups.forEach(({ sel, delay }) => {
      $$(sel).forEach((el, i) => {
        gsap.fromTo(el,
          { y: 18 },
          {
            y: 0,
            duration: 0.65,
            ease: 'expo.out',
            delay: i * delay,
            scrollTrigger: { trigger: el, start: 'top 94%', toggleActions: 'play none none none' },
            immediateRender: false,
          }
        );
      });
    });
  }

  /* -------------------------------------------------------
     8. NAV SCROLL STATE
     ------------------------------------------------------- */
  function initNav() {
    const nav = $('#nav');
    if (!nav) return;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 40) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -------------------------------------------------------
     9. HERO PARALLAX + MOUSE PARALLAX
     ------------------------------------------------------- */
  function initHeroParallax() {
    if (prefersReduce || typeof gsap === 'undefined') return;
    const layers = $$('.hero__layer');
    layers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.speed) || 0.1;
      gsap.to(layer, {
        yPercent: speed * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        },
      });
    });

    // Mouse-driven parallax on hero
    const hero = $('.hero');
    if (hero && !isMobile) {
      let tx = 0, ty = 0, cx = 0, cy = 0;
      hero.addEventListener('mousemove', (e) => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
      const tick = () => {
        cx += (tx - cx) * 0.06;
        cy += (ty - cy) * 0.06;
        layers.forEach((layer, idx) => {
          const depth = (idx + 1) * 8;
          const cur = layer.style.transform || '';
          // Append translate without removing GSAP yPercent
          layer.style.setProperty('--mx', (cx * depth) + 'px');
          layer.style.setProperty('--my', (cy * depth) + 'px');
        });
        const peak = $('.hero__peak');
        if (peak) {
          peak.style.setProperty('--mx', (cx * 18) + 'px');
          peak.style.setProperty('--my', (cy * 12) + 'px');
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // Hero title — character reveal via PURE CSS transitions (more reliable
    // than GSAP under Lenis-RAF integration). Set hidden state via inline
    // styles, expose __playHeroChars to flip them with stagger.
    const chars = $$('.hero__title .char-r > span');
    const animTargets = chars.length ? chars : $$('.hero__title .word');
    if (animTargets.length) {
      const easing = 'cubic-bezier(.16,.84,.3,1)'; // expo-out-ish
      animTargets.forEach((el) => {
        el.style.display = 'inline-block';
        el.style.willChange = 'opacity, transform';
        el.style.opacity = '0';
        el.style.transform = 'translate3d(0, 110%, 0) rotate(5deg)';
        el.style.transition =
          `opacity 1.0s ${easing}, transform 1.2s ${easing}`;
      });
      window.__playHeroChars = () => {
        animTargets.forEach((el, i) => {
          const delay = i * 22; // ms — same stagger as the GSAP version
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translate3d(0, 0, 0) rotate(0)';
          }, delay);
          // Release will-change after animation completes
          setTimeout(() => { el.style.willChange = ''; }, delay + 1300);
        });
      };
    }

    // Hero peak SVG draws with scroll
    const peakPath = $('.hero__peak path');
    if (peakPath && typeof gsap !== 'undefined') {
      const len = peakPath.getTotalLength ? peakPath.getTotalLength() : 1000;
      peakPath.style.strokeDasharray = len;
      peakPath.style.strokeDashoffset = len;
      gsap.to(peakPath, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
    }
  }

  /* -------------------------------------------------------
     10. GENERIC PARALLAX (data-parallax)
     ------------------------------------------------------- */
  function initParallax() {
    if (prefersReduce || typeof gsap === 'undefined') return;
    $$('[data-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.2;
      gsap.fromTo(el,
        { yPercent: -speed * 50 },
        {
          yPercent: speed * 50,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        }
      );
    });
  }

  /* -------------------------------------------------------
     11. CARD GLOW
     ------------------------------------------------------- */
  function initCardGlow() {
    $$('.card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const glow = $('.card__glow', card);
        if (glow) {
          glow.style.setProperty('--x', (e.clientX - r.left) + 'px');
          glow.style.setProperty('--y', (e.clientY - r.top) + 'px');
        }
      });
    });
  }

  /* -------------------------------------------------------
     12. PROCESS — STICKY TIMELINE
     ------------------------------------------------------- */
  function initProcess() {
    if (typeof gsap === 'undefined') return;
    const section = $('#process');
    if (!section) return;
    const steps = $$('.step', section);
    const bar = $('.process__progressBar', section);
    const bg = $('.process__bgImg', section);
    const linePath = $('.process__line path', section);
    const videos = $$('.process__bgVideo', section);
    const stepNumEl = $('#processStepNum', section);
    if (!steps.length) return;

    steps[0].classList.add('is-active');
    if (videos.length) videos[0].classList.add('is-active');

    if (linePath && linePath.getTotalLength) {
      const len = linePath.getTotalLength();
      linePath.style.strokeDasharray = len;
      linePath.style.strokeDashoffset = len;
    }

    let lastIdx = -1;
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        if (bg) bg.style.transform = `scale(${1 + p * 0.18}) translateY(${p * -8}%)`;
        if (bar) bar.style.width = (p * 100) + '%';
        if (linePath && linePath.getTotalLength) {
          const len = linePath.getTotalLength();
          linePath.style.strokeDashoffset = len * (1 - p);
        }
        const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
        if (idx !== lastIdx) {
          lastIdx = idx;
          steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
          videos.forEach((v, i) => v.classList.toggle('is-active', i === idx));
          if (stepNumEl) stepNumEl.textContent = String(idx + 1).padStart(2, '0');
        }
      },
    });
  }

  /* -------------------------------------------------------
     13. MARQUEE BOOST (scroll velocity)
     ------------------------------------------------------- */
  function initMarqueeBoost() {
    if (prefersReduce) return;
    const tracks = $$('.marquee__track, .stack__track, .ticker');
    if (!tracks.length) return;

    let lastScroll = window.scrollY;
    let boost = 1;
    let target = 1;

    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      const dy = y - lastScroll;
      target = Math.min(3, 1 + Math.abs(dy) * 0.05);
      lastScroll = y;
    }, { passive: true });

    const tick = () => {
      boost += (target - boost) * 0.08;
      target += (1 - target) * 0.05;
      tracks.forEach((t) => {
        const cur = getComputedStyle(t).animationDuration;
        const base = t.dataset.baseDuration || cur;
        t.dataset.baseDuration = base;
        const num = parseFloat(base);
        t.style.animationDuration = (num / boost) + 's';
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------------
     13a. HERO SHADER — Three.js VideoTexture + GLSL chromatic aberration + cursor distortion + grain
     ------------------------------------------------------- */
  function initHeroShader() {
    if (typeof THREE === 'undefined' || prefersReduce) return;
    const canvas = $('#heroShader');
    const video = $('.hero__video');
    const hero = $('.hero');
    if (!canvas || !video || !hero) return;

    // Wait for video metadata before initializing — need natural dimensions
    const start = () => {
      try {
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const tex = new THREE.VideoTexture(video);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;

        const uniforms = {
          uTex: { value: tex },
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uMouseVel: { value: new THREE.Vector2(0, 0) },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uVideoAspect: { value: video.videoWidth / video.videoHeight || 16/9 },
          uIntensity: { value: 1.0 },
        };

        const material = new THREE.ShaderMaterial({
          uniforms,
          transparent: true,
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            uniform sampler2D uTex;
            uniform float uTime;
            uniform vec2 uMouse;
            uniform vec2 uMouseVel;
            uniform vec2 uResolution;
            uniform float uVideoAspect;
            uniform float uIntensity;
            varying vec2 vUv;

            // Hash for grain
            float hash(vec2 p) {
              p = fract(p * vec2(123.34, 456.21));
              p += dot(p, p + 45.32);
              return fract(p.x * p.y);
            }

            // cover-fit UV (mimics object-fit: cover)
            vec2 coverUV(vec2 uv, vec2 res, float vAspect) {
              float screenAspect = res.x / res.y;
              vec2 result = uv;
              if (screenAspect > vAspect) {
                // wider screen — fit width, scale height
                float scale = screenAspect / vAspect;
                result.y = (uv.y - 0.5) / scale + 0.5;
              } else {
                float scale = vAspect / screenAspect;
                result.x = (uv.x - 0.5) / scale + 0.5;
              }
              return result;
            }

            void main() {
              vec2 uv = coverUV(vUv, uResolution, uVideoAspect);

              // distance from mouse (in normalized space)
              vec2 mouseDelta = uv - uMouse;
              float dist = length(mouseDelta);
              float falloff = exp(-dist * 6.0);

              // cursor-driven ripple displacement
              vec2 ripple = mouseDelta * falloff * 0.025 * uIntensity;
              ripple += vec2(
                sin(uTime * 0.6 + uv.y * 8.0) * 0.0012,
                cos(uTime * 0.5 + uv.x * 7.0) * 0.0012
              );

              // Chromatic aberration — much softer (less neon glitch)
              float velMag = length(uMouseVel);
              float caStrength = (0.0018 + falloff * 0.005 + velMag * 0.08) * uIntensity;
              vec2 caOffset = normalize(mouseDelta + 0.0001) * caStrength;

              // Warm + cool channel split (not pure RGB) — peach vs lilac
              vec3 col;
              col.r = texture2D(uTex, uv + caOffset * 1.0 + ripple).r;
              col.g = texture2D(uTex, uv + caOffset * 0.3 + ripple).g;
              col.b = texture2D(uTex, uv - caOffset * 0.8 + ripple).b;

              // Gentle saturation
              float lum = dot(col, vec3(0.299, 0.587, 0.114));
              col = mix(vec3(lum), col, 1.08);

              // Vignette (softer)
              float vig = smoothstep(1.15, 0.45, distance(vUv, vec2(0.5, 0.55)));
              col *= mix(0.62, 1.0, vig);

              // Painted grain (less intense)
              float g = hash(vUv * uResolution * 0.7 + vec2(uTime * 60.0, uTime * 40.0));
              col += (g - 0.5) * 0.035;

              // Alpine fairytale tint — shadows lean cool sage/sky,
              // mids stay neutral, highlights warm peach + gold
              vec3 cool = col * vec3(0.90, 1.02, 1.04);  // shadows: subtle sage-blue
              vec3 warm = col * vec3(1.06, 0.98, 0.88);  // highlights: warm cream
              col = mix(cool, warm, smoothstep(0.25, 0.78, lum));

              // Soft golden bloom in highlights (warm sunset glow on peaks)
              col += vec3(0.05, 0.04, 0.01) * smoothstep(0.65, 1.0, lum);

              // Misty blue-green push in deep shadows (forest valley feel)
              col += vec3(-0.01, 0.01, 0.02) * smoothstep(0.25, 0.0, lum);

              gl_FragColor = vec4(col, 1.0);
            }
          `,
        });

        const geom = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geom, material);
        scene.add(mesh);

        // Resize handler
        const resize = () => {
          const w = hero.clientWidth || window.innerWidth;
          const h = hero.clientHeight || window.innerHeight;
          renderer.setSize(w, h, false);
          uniforms.uResolution.value.set(w, h);
          uniforms.uVideoAspect.value = (video.videoWidth || 16) / (video.videoHeight || 9);
        };
        resize();
        window.addEventListener('resize', resize);

        // Mouse tracking with velocity smoothing
        let mx = 0.5, my = 0.5, mxT = 0.5, myT = 0.5, lvx = 0, lvy = 0;
        hero.addEventListener('mousemove', (e) => {
          const r = hero.getBoundingClientRect();
          mxT = (e.clientX - r.left) / r.width;
          myT = 1.0 - (e.clientY - r.top) / r.height; // GL y-flip
        });

        // Tap to play (some browsers need user gesture)
        hero.addEventListener('click', () => { video.play().catch(()=>{}); }, { once: true });
        video.play().catch(()=>{});

        const clock = new THREE.Clock();
        const loop = () => {
          const t = clock.getElapsedTime();
          // Smooth mouse
          const prevMx = mx, prevMy = my;
          mx += (mxT - mx) * 0.08;
          my += (myT - my) * 0.08;
          // Velocity (smoothed)
          const vx = (mx - prevMx) * 60;
          const vy = (my - prevMy) * 60;
          lvx += (vx - lvx) * 0.1;
          lvy += (vy - lvy) * 0.1;
          uniforms.uTime.value = t;
          uniforms.uMouse.value.set(mx, my);
          uniforms.uMouseVel.value.set(lvx, lvy);
          renderer.render(scene, camera);
          requestAnimationFrame(loop);
        };
        loop();

        hero.classList.add('has-shader');
      } catch (err) {
        console.warn('Hero shader init failed', err);
      }
    };

    if (video.readyState >= 2) {
      start();
    } else {
      video.addEventListener('loadeddata', start, { once: true });
    }
  }

  /* -------------------------------------------------------
     13z. TERRAIN — Three.js wireframe mountain mesh, scroll-driven camera
     ------------------------------------------------------- */
  function initTerrain() {
    if (typeof THREE === 'undefined' || prefersReduce) return;
    const canvas = $('#terrainCanvas');
    const section = $('#terrain');
    const pin = $('.terrain__pin');
    if (!canvas || !section || !pin) return;

    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x08080d, 6, 22);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 3.2, 7);
      camera.lookAt(0, 0, 0);

      // Plane geometry, displaced to make a mountain range
      const SEG = 96;
      const SIZE = 18;
      const geom = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
      geom.rotateX(-Math.PI / 2);

      // Pre-compute height field with multiple octaves of pseudo-noise
      const positions = geom.attributes.position;
      const baseHeights = new Float32Array(positions.count);
      const seedX = Math.random() * 100;
      const seedY = Math.random() * 100;
      const noise = (x, y) => {
        // cheap pseudo-noise (sum of sines)
        return (
          Math.sin(x * 0.6 + seedX) * Math.cos(y * 0.5 + seedY) * 0.55 +
          Math.sin(x * 1.4 + seedY) * Math.cos(y * 1.2 + seedX) * 0.32 +
          Math.sin(x * 2.7 + seedX * 1.3) * Math.cos(y * 2.5 + seedY * 1.1) * 0.18 +
          Math.sin(x * 5.1) * Math.cos(y * 4.8) * 0.09
        );
      };
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const dist = Math.sqrt(x * x + z * z);
        const ridge = Math.exp(-dist * dist * 0.012); // peak in middle
        const h = noise(x, z) * 1.2 + ridge * 1.8;
        baseHeights[i] = h;
        positions.setY(i, h);
      }
      positions.needsUpdate = true;
      geom.computeVertexNormals();

      // Wireframe in soft sage (alpine pine mist)
      const wireMat = new THREE.LineBasicMaterial({
        color: 0x87ceb5,
        transparent: true,
        opacity: 0.55,
      });
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geom), wireMat);
      scene.add(wire);

      // Subtle filled mesh underneath for depth (very dark)
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0x06060a,
        transparent: true,
        opacity: 0.85,
      });
      const fill = new THREE.Mesh(geom, fillMat);
      fill.position.y = -0.02;
      scene.add(fill);

      // Glow points at peaks (sample every Nth vertex with high y)
      const peakGeom = new THREE.BufferGeometry();
      const peakPositions = [];
      for (let i = 0; i < positions.count; i += 4) {
        if (positions.getY(i) > 1.4) {
          peakPositions.push(positions.getX(i), positions.getY(i) + 0.05, positions.getZ(i));
        }
      }
      peakGeom.setAttribute('position', new THREE.Float32BufferAttribute(peakPositions, 3));
      const peakMat = new THREE.PointsMaterial({
        color: 0xffe4a8,    // warm gold sparkle on peaks (alpine sunset)
        size: 0.08,
        transparent: true,
        opacity: 0.92,
        sizeAttenuation: true,
      });
      const peaks = new THREE.Points(peakGeom, peakMat);
      scene.add(peaks);

      // Resize
      const resize = () => {
        const w = pin.clientWidth || window.innerWidth;
        const h = pin.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener('resize', resize);

      // Scroll-driven camera orbit
      let scrollProgress = 0;
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: (self) => { scrollProgress = self.progress; },
      });

      // Mouse parallax
      let mxT = 0, myT = 0, mx = 0, my = 0;
      pin.addEventListener('mousemove', (e) => {
        const r = pin.getBoundingClientRect();
        mxT = ((e.clientX - r.left) / r.width - 0.5) * 2;
        myT = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });

      const clock = new THREE.Clock();
      const loop = () => {
        const t = clock.getElapsedTime();

        // Smooth mouse
        mx += (mxT - mx) * 0.05;
        my += (myT - my) * 0.05;

        // Scroll-driven orbit
        const angle = scrollProgress * Math.PI * 0.7 - Math.PI * 0.15;
        const radius = 7 - scrollProgress * 1.2;
        const elevation = 3.2 - scrollProgress * 0.8;
        camera.position.x = Math.sin(angle) * radius + mx * 0.6;
        camera.position.z = Math.cos(angle) * radius;
        camera.position.y = elevation - my * 0.4;
        camera.lookAt(0, 0.4, 0);

        // Subtle terrain animation — undulate vertices over time
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const z = positions.getZ(i);
          const wave = Math.sin(t * 0.6 + x * 0.3 + z * 0.2) * 0.04
                     + Math.sin(t * 0.9 + x * 0.5) * 0.02;
          positions.setY(i, baseHeights[i] + wave);
        }
        positions.needsUpdate = true;

        // Alpine hue cycle: sage → sky → warm peach across scroll
        // sage 0.40 → sky 0.55 → peach 0.08 (wrap-around path)
        const p = scrollProgress;
        const hue = p < 0.5
          ? 0.40 + p * 0.30        // 0.40 sage → 0.55 sky in first half
          : 0.55 + (p - 0.5) * 1.06; // 0.55 sky → 1.08 (wraps to 0.08 peach)
        wireMat.color.setHSL(hue % 1.0, 0.45, 0.72);

        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      console.warn('Terrain init failed', err);
    }
  }

  /* -------------------------------------------------------
     13b. HERO VIDEO — toggle .has-video if intro.mp4 loads
     ------------------------------------------------------- */
  function initHeroVideo() {
    // Single-video sections
    [
      { v: '.hero__video',    section: '.hero' },
      { v: '.cta__bgVideo',   section: '.cta' },
      { v: '.stack__bgVideo', section: '.stack' },
      { v: '.work__bgVideo',  section: '.work' },
      { v: '.studio__bgVideo', section: '.studio' },
      { v: '.faq__bgVideo',   section: '.faq' },
    ].forEach(({ v, section }) => {
      const vid = $(v);
      const sec = $(section);
      if (!vid || !sec) return;
      const onOk = () => sec.classList.add('has-video');
      const onErr = () => vid.remove();
      if (vid.readyState >= 2) onOk();
      else {
        vid.addEventListener('loadeddata', onOk, { once: true });
        vid.addEventListener('error', onErr, { once: true });
        setTimeout(() => { if (vid.readyState < 2) vid.remove(); }, 2500);
      }
    });
    // Multi-video process section: any one loaded = has-video
    const process = $('.process');
    const procVids = $$('.process__bgVideo');
    if (process && procVids.length) {
      procVids.forEach((vid) => {
        const onOk = () => process.classList.add('has-video');
        const onErr = () => vid.remove();
        if (vid.readyState >= 2) onOk();
        else {
          vid.addEventListener('loadeddata', onOk, { once: true });
          vid.addEventListener('error', onErr, { once: true });
          setTimeout(() => { if (vid.readyState < 2) vid.remove(); }, 2500);
        }
      });
    }

    // Lazy play: pause off-screen videos to save CPU/battery, play when in view
    const allVids = $$('video[autoplay]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        });
      }, { threshold: 0.1, rootMargin: '120px' });
      allVids.forEach(v => io.observe(v));
    }
  }

  /* -------------------------------------------------------
     13c. DISPLACEMENT WARP on work-card hover
     ------------------------------------------------------- */
  function initDisplacementWarp() {
    if (isMobile || prefersReduce) return;
    const filter = document.querySelector('#displaceWarp feDisplacementMap');
    if (!filter) return;
    let active = 0; // current scale
    let target = 0;
    $$('.work__card').forEach((card) => {
      card.addEventListener('mouseenter', () => { target = 26; });
      card.addEventListener('mouseleave', () => { target = 0; });
    });
    const tick = () => {
      active += (target - active) * 0.12;
      filter.setAttribute('scale', active.toFixed(2));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------------
     14. WORK CARDS — TILT + RGB SHIFT
     ------------------------------------------------------- */
  function initTilt() {
    if (isMobile) return;
    $$('.work__card').forEach((card) => {
      const cover = $('.work__cover', card);
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
        if (cover) {
          cover.style.transform = `translate(${x * 12}px, ${y * 12}px) scale(1.06)`;
          cover.style.setProperty('--rgb-x', (x * 8) + 'px');
          cover.style.setProperty('--rgb-y', (y * 4) + 'px');
        }
      });
      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        card.style.transform = 'perspective(900px) rotateX(0) rotateY(0)';
        if (cover) {
          cover.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
          cover.style.transform = '';
          cover.style.setProperty('--rgb-x', '0px');
          cover.style.setProperty('--rgb-y', '0px');
        }
        setTimeout(() => {
          card.style.transition = '';
          if (cover) cover.style.transition = '';
        }, 620);
      });
    });
  }

  /* -------------------------------------------------------
     15. SECTION TITLES — extra reveal trigger
     ------------------------------------------------------- */
  function initSectionTitles() {
    if (typeof gsap === 'undefined') return;
    $$('.section-head__title').forEach((title) => {
      ScrollTrigger.create({
        trigger: title,
        start: 'top 80%',
        onEnter: () => title.classList.add('is-revealed'),
      });
    });
  }

  /* -------------------------------------------------------
     16. GLOBAL CANVAS — topo lines + drifting particles
     ------------------------------------------------------- */
  function initGlobalCanvas() {
    if (prefersReduce) return;
    const canvas = $('#bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Particles (drifting embers)
    const N = isMobile ? 24 : 60;
    const particles = Array.from({ length: N }, () => {
      const r = Math.random();
      // Alpine drift: peach + sage + sky + occasional gold sparkle
      const hue = r < 0.35 ? 24 + Math.random() * 12   // peach
                : r < 0.65 ? 148 + Math.random() * 22  // sage
                : r < 0.88 ? 200 + Math.random() * 18  // sky
                : 44 + Math.random() * 6;              // gold
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -Math.random() * 0.22 - 0.04,
        a: Math.random() * 0.5 + 0.12,
        hue: hue,
        tw: Math.random() * Math.PI * 2,
      };
    });

    let scrollY = 0;
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

    let mx = w / 2, my = h / 2;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

    let t = 0;
    const draw = () => {
      t += 0.005;
      ctx.clearRect(0, 0, w, h);

      // Topographic contour lines (storybook peach + lavender mix)
      const lines = isMobile ? 4 : 7;
      ctx.lineWidth = 1;
      for (let i = 0; i < lines; i++) {
        const off = i / lines;
        const yBase = h * (0.2 + off * 0.7) + Math.sin(t * 0.6 + i) * 6 - scrollY * (0.04 + off * 0.04);
        ctx.beginPath();
        // Alternate sage / sky per line, fade with depth
        const alpha = 0.05 + off * 0.04;
        ctx.strokeStyle = (i % 3 === 0)
          ? `rgba(255, 184, 146, ${alpha * 0.7})`   // warm peach (rare)
          : (i % 2 === 0)
            ? `rgba(135, 206, 181, ${alpha})`       // sage green
            : `rgba(163, 200, 232, ${alpha * 0.9})`; // sky blue
        for (let x = 0; x <= w; x += 8) {
          const k = i * 0.5 + 1;
          const y = yBase
            + Math.sin((x * 0.006 + t) * k) * (12 + i * 4)
            + Math.sin((x * 0.014 - t * 0.7) * (k * 0.6)) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Particles
      particles.forEach((p) => {
        p.tw += 0.04;
        p.x += p.vx + Math.sin(p.tw) * 0.08;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        const tw = (Math.sin(p.tw) + 1) / 2;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 60%, 72%, ${p.a * (0.4 + tw * 0.6)})`;
        ctx.arc(p.x, p.y - scrollY * 0.06, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Mouse glow — soft sage-peach mix
      const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 280);
      grd.addColorStop(0, 'rgba(135, 206, 181, 0.05)');
      grd.addColorStop(1, 'rgba(135, 206, 181, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      requestAnimationFrame(draw);
    };
    draw();
  }

  /* -------------------------------------------------------
     17. SCRAMBLE NUMBERS (impact section + meta)
     ------------------------------------------------------- */
  function scrambleTo(el, target, duration = 1800) {
    // Odometer-style: build digit columns that roll up to final value
    const numericTarget = parseFloat(target.replace(/[^\d.]/g, '')) || 0;
    const isInt = !target.includes('.');
    const finalStr = isInt ? Math.round(numericTarget).toString() : numericTarget.toFixed(1);
    const start = performance.now();

    // Build digit reels once
    el.innerHTML = '';
    el.classList.add('odometer');
    const reels = [];
    for (let i = 0; i < finalStr.length; i++) {
      const c = finalStr[i];
      if (/\d/.test(c)) {
        const reel = document.createElement('span');
        reel.className = 'odometer__reel';
        const inner = document.createElement('span');
        // 0..9 column then final digit at the bottom for an extra spin
        let digits = '';
        for (let n = 0; n < 30; n++) digits += ((n) % 10).toString() + '\n';
        digits += c;
        inner.textContent = digits;
        inner.style.whiteSpace = 'pre';
        reel.appendChild(inner);
        el.appendChild(reel);
        reels.push({ reel, inner, target: 30 + parseInt(c, 10) });
      } else {
        const fixed = document.createElement('span');
        fixed.textContent = c;
        fixed.className = 'odometer__fixed';
        el.appendChild(fixed);
      }
    }

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      reels.forEach((r, idx) => {
        const stagger = idx * 0.05;
        const tt = Math.max(0, Math.min(1, (eased - stagger) / Math.max(0.0001, 1 - stagger)));
        const offset = tt * r.target; // in line-units
        r.inner.style.transform = `translateY(${-offset * 1.05}em)`;
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function initScrambleCounters() {
    const targets = $$('[data-scramble]');
    if (!targets.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.scrambled) return;
          el.dataset.scrambled = '1';
          scrambleTo(el, el.dataset.scramble, 1600);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    targets.forEach((el) => io.observe(el));
  }

  /* -------------------------------------------------------
     17b. TEXT SCRAMBLE EFFECT (for impact title)
     ------------------------------------------------------- */
  const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#________';
  function textScramble(el, finalText, duration = 1200) {
    const start = performance.now();
    const len = finalText.length;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      let out = '';
      for (let i = 0; i < len; i++) {
        if (i / len < t) {
          out += finalText[i];
        } else {
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function initTextScramble() {
    const targets = $$('[data-text-scramble]');
    if (!targets.length) return;
    targets.forEach((el) => { el.dataset.original = el.textContent; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.scrambled === '1') return;
          el.dataset.scrambled = '1';
          textScramble(el, el.dataset.original);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.6 });
    targets.forEach((el) => io.observe(el));
  }

  /* -------------------------------------------------------
     18. SCROLL PROGRESS BAR
     ------------------------------------------------------- */
  function initScrollProgress() {
    const bar = $('#scrollProgress');
    if (!bar) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = Math.max(0, Math.min(1, window.scrollY / max));
      bar.style.transform = `scaleX(${p})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -------------------------------------------------------
     19. FOOTER BIG WORD — horizontal parallax
     ------------------------------------------------------- */
  function initFooterBigWord() {
    if (prefersReduce || typeof gsap === 'undefined') return;
    const word = $('.footer__bigword');
    if (!word) return;
    gsap.fromTo(word,
      { xPercent: -15 },
      {
        xPercent: 15,
        ease: 'none',
        scrollTrigger: {
          trigger: '.footer',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      }
    );
  }

  /* -------------------------------------------------------
     20. SERVICES — scroll spotlight
     ------------------------------------------------------- */
  function initServicesSpotlight() {
    if (typeof gsap === 'undefined') return;
    const rows = $$('.svc__row');
    if (!rows.length) return;
    rows.forEach((row) => {
      gsap.fromTo(row,
        { y: 28 },
        {
          y: 0,
          duration: 0.8,
          ease: 'expo.out',
          scrollTrigger: { trigger: row, start: 'top 94%', toggleActions: 'play none none none' },
          immediateRender: false,
        }
      );
    });
  }

  /* -------------------------------------------------------
     21a0. SCENE TRANSITIONS — each major section reveals like
     a presentation slide: opacity + scale scrub on enter/exit
     ------------------------------------------------------- */
  function initSceneTransitions() {
    if (typeof gsap === 'undefined' || prefersReduce) return;
    const sceneSelectors = '#manifest, #studio, #services, #reel, #process, #terrain, #work, #stack, #faq, #contact';
    const scenes = $$(sceneSelectors);
    scenes.forEach((scene) => {
      // Skip pinned sections — they have their own pinning logic
      const isPinned = scene.matches('.process, .terrain, .reel');
      // Inner content target — prefer first direct child div, else section itself
      const inner = scene.querySelector(':scope > .section-head, :scope > div, :scope > header') || scene;
      // Scroll-driven scale + opacity. Sections feel like slides advancing.
      gsap.set(inner, { willChange: 'transform, opacity', force3D: true });
      gsap.fromTo(inner,
        { opacity: 0.45, scale: 0.965, y: isPinned ? 0 : 24 },
        {
          opacity: 1, scale: 1, y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: scene,
            start: 'top 95%',
            end: 'top 30%',
            scrub: 1.2,
          },
        }
      );
      if (!isPinned) {
        // Outgoing fade as section leaves top of viewport
        gsap.fromTo(inner,
          { opacity: 1, scale: 1 },
          {
            opacity: 0.55, scale: 0.985,
            ease: 'none',
            scrollTrigger: {
              trigger: scene,
              start: 'bottom 70%',
              end: 'bottom top',
              scrub: 1.4,
            },
          }
        );
      }
    });
  }

  /* -------------------------------------------------------
     21a1. SECTION-HEAD LABEL POP — accent + glow on first reveal
     ------------------------------------------------------- */
  function initLabelPop() {
    if (typeof gsap === 'undefined' || prefersReduce) return;
    $$('.section-head__label').forEach((label) => {
      gsap.fromTo(label,
        { x: -28 },
        {
          x: 0,
          duration: 1.0,
          ease: 'expo.out',
          scrollTrigger: { trigger: label, start: 'top 92%', toggleActions: 'play none none none' },
          immediateRender: false,
        }
      );
    });
  }

  /* -------------------------------------------------------
     21a2. SCENE INDICATOR — side chapter dots
     ------------------------------------------------------- */
  function initSceneIndicator() {
    if (prefersReduce) return;
    // Show on desktop only; CSS @media also hides under 1100px so this is a soft guard
    if (window.innerWidth && window.innerWidth < 1100) return;
    const sceneIds = ['hero', 'manifest', 'studio', 'services', 'reel', 'process', 'terrain', 'work', 'stack', 'faq', 'contact'];
    const sections = sceneIds.map(id => document.getElementById(id)).filter(Boolean);
    if (!sections.length) return;

    // Build markup
    const wrap = document.createElement('aside');
    wrap.className = 'scene-indicator';
    wrap.setAttribute('aria-hidden', 'true');
    sceneIds.forEach((id, i) => {
      const dot = document.createElement('a');
      dot.className = 'scene-indicator__dot';
      dot.href = '#' + id;
      dot.dataset.idx = i;
      dot.innerHTML = `<span class="scene-indicator__num">${String(i).padStart(2, '0')}</span><span class="scene-indicator__pip"></span>`;
      wrap.appendChild(dot);
    });
    document.body.appendChild(wrap);

    // Update active dot on scroll
    const dots = $$('.scene-indicator__dot', wrap);
    const update = () => {
      const mid = window.scrollY + window.innerHeight * 0.4;
      let activeIdx = 0;
      sections.forEach((s, i) => {
        if (s.offsetTop <= mid) activeIdx = i;
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === activeIdx));
    };
    window.addEventListener('scroll', update, { passive: true });
    setTimeout(update, 100);
  }

  /* -------------------------------------------------------
     21b1. SECTION HEAD PARALLAX — gentle rise across visibility
     ------------------------------------------------------- */
  function initSectionHeadParallax() {
    if (typeof gsap === 'undefined' || prefersReduce) return;
    $$('.section-head').forEach((head) => {
      const parent = head.closest('section');
      if (!parent) return;
      gsap.fromTo(head, { y: 24 }, {
        y: -36,
        ease: 'none',
        scrollTrigger: {
          trigger: parent,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.4,
        },
      });
    });
  }

  /* -------------------------------------------------------
     21b2. STUDIO PRINCIPLES — staggered subtle parallax
     ------------------------------------------------------- */
  function initStudioParallax() {
    if (typeof gsap === 'undefined' || prefersReduce) return;
    $$('.studio__list li').forEach((li, i) => {
      gsap.fromTo(li, { y: i % 2 === 0 ? 18 : 28 }, {
        y: i % 2 === 0 ? -18 : -28,
        ease: 'none',
        scrollTrigger: {
          trigger: '#studio',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.6,
        },
      });
    });
  }

  /* -------------------------------------------------------
     21b3. SERVICES ROWS — gentle scrub parallax (alt directions)
     ------------------------------------------------------- */
  function initServicesParallax() {
    if (typeof gsap === 'undefined' || prefersReduce) return;
    $$('.svc__row').forEach((row, i) => {
      const drift = (i % 3 === 0) ? 22 : (i % 3 === 1) ? 14 : 30;
      gsap.fromTo(row, { y: drift }, {
        y: -drift,
        ease: 'none',
        scrollTrigger: {
          trigger: '#services',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.8,
        },
      });
    });
  }

  /* -------------------------------------------------------
     21b4. DIVIDERS — drift on scroll for depth
     ------------------------------------------------------- */
  function initDividerParallax() {
    if (typeof gsap === 'undefined' || prefersReduce) return;
    $$('.divider').forEach((d, i) => {
      gsap.fromTo(d, { y: 18 }, {
        y: -18,
        ease: 'none',
        scrollTrigger: {
          trigger: d,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.5,
        },
      });
    });
  }

  /* -------------------------------------------------------
     21b5. EXTRA PARALLAX — faq items, work cards, footer big word, stack list rows
     ------------------------------------------------------- */
  function initExtraParallax() {
    if (typeof gsap === 'undefined' || prefersReduce) return;
    // FAQ items: subtle drift
    $$('.faq__item').forEach((el, i) => {
      gsap.fromTo(el, { y: 16 }, {
        y: -16, ease: 'none',
        scrollTrigger: { trigger: '#faq', start: 'top bottom', end: 'bottom top', scrub: 1.4 },
      });
    });
    // Work cards: alternating stronger drift
    $$('.work__card').forEach((el, i) => {
      const drift = (i % 2 === 0) ? 26 : 38;
      gsap.fromTo(el, { y: drift }, {
        y: -drift, ease: 'none',
        scrollTrigger: { trigger: '#work', start: 'top bottom', end: 'bottom top', scrub: 1.6 },
      });
    });
    // Stack list rows: tiny per-row drift
    $$('.stackGrid__list li').forEach((el, i) => {
      const drift = 8 + (i % 4) * 2;
      gsap.fromTo(el, { y: drift }, {
        y: -drift, ease: 'none',
        scrollTrigger: { trigger: '#stack', start: 'top bottom', end: 'bottom top', scrub: 2 },
      });
    });
    // Studio anti list: gentle drift
    $$('.studio__antiList li').forEach((el, i) => {
      gsap.fromTo(el, { y: 12 }, {
        y: -12, ease: 'none',
        scrollTrigger: { trigger: '#studio', start: 'top bottom', end: 'bottom top', scrub: 1.6 },
      });
    });
    // Process step duration chips
    $$('.step__dur').forEach((el) => {
      gsap.fromTo(el, { x: -8 }, {
        x: 8, ease: 'none',
        scrollTrigger: { trigger: '#process', start: 'top top', end: 'bottom bottom', scrub: 1.5 },
      });
    });
  }

  /* -------------------------------------------------------
     21b6. 3D TILT on svc rows + impact cells (mouse-tracked perspective)
     ------------------------------------------------------- */
  function init3DTilt() {
    if (isMobile || prefersReduce) return;
    const targets = $$('.svc__row, .impact__cell');
    targets.forEach((el) => {
      el.style.transformStyle = 'preserve-3d';
      el.style.willChange = 'transform';
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        const rx = -y * 4;
        const ry =  x * 4;
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(2px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateZ(0)';
        setTimeout(() => { el.style.transition = ''; }, 720);
      });
    });
  }

  /* -------------------------------------------------------
     21c. STACK GRID — staggered reveal + subtle parallax per col
     ------------------------------------------------------- */
  function initStackGrid() {
    if (typeof gsap === 'undefined') return;
    const cols = $$('.stackGrid__col');
    if (!cols.length) return;
    cols.forEach((col, i) => {
      // Use fromTo with safe initial state — slide only, no opacity (so failure-mode = visible)
      gsap.fromTo(col,
        { y: 28 },
        {
          y: 0,
          duration: 0.9,
          ease: 'expo.out',
          delay: i * 0.06,
          scrollTrigger: { trigger: col, start: 'top 92%', toggleActions: 'play none none none' },
          immediateRender: false,
        }
      );
    });
  }

  /* -------------------------------------------------------
     21d. CTA SPLIT — staggered reveal of reply list + alt channels
     ------------------------------------------------------- */
  function initCtaReveal() {
    if (typeof gsap === 'undefined') return;
    const items = $$('.cta__replyList li, .cta__altList a');
    if (!items.length) return;
    items.forEach((el, i) => {
      gsap.fromTo(el,
        { x: 24 },
        {
          x: 0,
          duration: 0.7,
          ease: 'expo.out',
          delay: i * 0.05,
          scrollTrigger: { trigger: el, start: 'top 94%', toggleActions: 'play none none none' },
          immediateRender: false,
        }
      );
    });
  }

  /* -------------------------------------------------------
     21. INTERLUDE QUOTE — text reveal char by char on scroll
     ------------------------------------------------------- */
  function initInterludeReveal() {
    if (typeof gsap === 'undefined') return;
    $$('.interlude__text').forEach((el) => {
      // wrap each word so we can fade in
      const text = el.textContent.trim();
      const words = text.split(/\s+/);
      el.innerHTML = words.map(w => `<span class="interlude__word"><span>${w}</span></span>`).join(' ');
      const innerWords = $$('.interlude__word > span', el);
      gsap.fromTo(innerWords,
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0, opacity: 1,
          duration: 1.0, stagger: 0.04, ease: 'expo.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 75%',
          },
        }
      );
    });
  }

  /* -------------------------------------------------------
     21b. HORIZONTAL REEL — scroll-jacked sliding text
     ------------------------------------------------------- */
  function initReel() {
    if (typeof gsap === 'undefined') return;
    const reel = $('#reel');
    const track = $('#reelTrack');
    if (!reel || !track) return;

    // Distance the track needs to translate so all words pass through viewport
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 80);

    // Set the reel section height to exactly match the scroll distance needed
    // (pin = 100vh) + (extra scroll for x-translation). This prevents the GSAP
    // pin from bleeding into the following section.
    const sizeReel = () => {
      const d = distance();
      reel.style.height = (window.innerHeight + d) + 'px';
    };
    sizeReel();
    window.addEventListener('resize', sizeReel);

    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: reel,
        start: 'top top',
        end: () => '+=' + distance(),
        scrub: 0.6,
        pin: '.reel__pin',
        pinSpacing: false, // section height already handles spacing; avoid double-counting
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
  }

  /* -------------------------------------------------------
     22ab. CTA CONTACT FORM — opens mailto: with prefilled body
     ------------------------------------------------------- */
  /* -------------------------------------------------------
     22ab2. WIZARD — multi-step contact brief
     ------------------------------------------------------- */
  function initWizard() {
    const wiz = $('#wizard');
    if (!wiz) return;
    const panes = $$('.wizard__pane', wiz);
    const stepEls = $$('.wizard__step', wiz);
    const back = $('#wizardBack');
    const next = $('#wizardNext');
    const nextLabel = $('#wizardNextLabel');
    const counter = $('#wizardCounter');
    const TOTAL = panes.length;
    const TARGET = 'contact@north-peak-studio.com';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let current = 0;

    const dict = () => window.NP_I18N?.[document.documentElement.dataset.lang || 'pl'] || {};

    const validateStep = (idx) => {
      const lang = document.documentElement.dataset.lang || 'pl';
      const d = dict();
      if (idx === 0) {
        if (!wiz.querySelector('input[name="type"]:checked')) {
          toast(d['wizard.invalid.type'] || 'Wybierz typ projektu');
          return false;
        }
      }
      if (idx === 1) {
        if (!wiz.querySelector('input[name="budget"]:checked')) {
          toast(d['wizard.invalid.budget'] || 'Wybierz orientacyjny budżet');
          return false;
        }
      }
      if (idx === 2) {
        if (!wiz.querySelector('input[name="deadline"]:checked')) {
          toast(d['wizard.invalid.deadline'] || 'Wybierz termin');
          return false;
        }
      }
      if (idx === 3) {
        const name = $('#wizName')?.value?.trim() || '';
        const email = $('#wizEmail')?.value?.trim() || '';
        let ok = true;
        if (!name) { $('#wizName').classList.add('is-invalid'); ok = false; }
        if (!EMAIL_RE.test(email)) { $('#wizEmail').classList.add('is-invalid'); ok = false; }
        if (!ok) {
          toast(d['wizard.invalid.contact'] || 'Uzupełnij imię i poprawny e-mail');
          return false;
        }
      }
      return true;
    };

    const showStep = (idx, dir) => {
      const old = panes[current];
      const fresh = panes[idx];
      if (old === fresh) return;
      old.classList.remove('is-active');
      fresh.classList.add('is-active');
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        el.classList.toggle('is-done', i < idx);
      });
      current = idx;
      if (counter) counter.textContent = String(idx + 1);
      back.disabled = idx === 0;
      const d = dict();
      if (idx === TOTAL - 1) {
        nextLabel.textContent = d['wizard.send'] || 'Wyślij brief';
      } else {
        nextLabel.textContent = d['wizard.next'] || 'Dalej';
      }
      // Focus first input/radio of new pane for keyboard flow
      const focusable = fresh.querySelector('input:not([type="hidden"]):not([type="radio"]), textarea, [type="radio"]');
      if (focusable) setTimeout(() => focusable.focus(), 100);
    };

    // Excludes panes from TOTAL count (the "done" pane is post-submit, not part of step flow)
    const FORM_STEPS = panes.filter(p => !p.classList.contains('wizard__pane--done')).length;

    const buildBriefBody = () => {
      const type = wiz.querySelector('input[name="type"]:checked')?.value || '';
      const budget = wiz.querySelector('input[name="budget"]:checked')?.value || '';
      const deadline = wiz.querySelector('input[name="deadline"]:checked')?.value || '';
      const name = $('#wizName')?.value?.trim() || '';
      const email = $('#wizEmail')?.value?.trim() || '';
      const brief = $('#wizBrief')?.value?.trim() || '';
      return { type, budget, deadline, name, email, brief };
    };

    const sendBrief = async () => {
      const data = buildBriefBody();
      const honey = wiz.querySelector('input[name="_honey"]')?.value || '';
      if (honey) return { ok: true, spam: true }; // silently swallow bot

      // Try real POST first (formsubmit.co AJAX). Fallback to mailto on failure.
      try {
        const res = await fetch(wiz.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            'project_type': data.type,
            budget: data.budget,
            deadline: data.deadline,
            brief: data.brief || '(empty)',
            _subject: `Brief · ${data.name} · ${data.type}`,
          }),
        });
        if (res.ok) return { ok: true };
        return { ok: false };
      } catch (_e) {
        return { ok: false };
      }
    };

    const goToDoneState = () => {
      const donePane = wiz.querySelector('.wizard__pane--done');
      if (!donePane) return;
      panes.forEach(p => p.classList.remove('is-active'));
      donePane.classList.add('is-active');
      // Hide nav and steps for done state
      stepEls.forEach((el, i) => {
        el.classList.remove('is-active');
        el.classList.add('is-done');
      });
      const nav = wiz.querySelector('.wizard__nav');
      if (nav) nav.style.display = 'none';
      current = panes.indexOf(donePane);
    };

    const fallbackMailto = () => {
      const data = buildBriefBody();
      const lang = document.documentElement.dataset.lang || 'pl';
      const labels = lang === 'en'
        ? { greet: 'Hi NorthPeak Studio,', proj: 'Project type', bud: 'Budget', dead: 'Deadline', notes: 'Notes', subj: 'Brief — from northpeak.studio wizard' }
        : { greet: 'Cześć NorthPeak Studio,', proj: 'Typ projektu', bud: 'Budżet', dead: 'Termin', notes: 'Notatki', subj: 'Brief — z formularza northpeak.studio' };
      const body = [
        labels.greet, '',
        `${labels.proj}: ${data.type}`,
        `${labels.bud}: ${data.budget}`,
        `${labels.dead}: ${data.deadline}`,
        data.brief ? `\n${labels.notes}: ${data.brief}` : '',
        '', '—', data.name, data.email,
      ].filter(Boolean).join('\n');
      const url = 'mailto:' + TARGET +
        '?subject=' + encodeURIComponent(`${labels.subj} · ${data.name}`) +
        '&body=' + encodeURIComponent(body);
      window.location.href = url;
    };

    next.addEventListener('click', async () => {
      if (!validateStep(current)) return;
      if (current < FORM_STEPS - 1) {
        showStep(current + 1);
        if (typeof window.__sfx === 'function') window.__sfx('tick');
      } else {
        // FINAL: real POST submit
        next.disabled = true;
        next.classList.add('is-loading');
        const original = nextLabel.textContent;
        nextLabel.textContent = (dict()['wizard.sending'] || 'Wysyłam...');

        const result = await sendBrief();
        if (result.ok) {
          goToDoneState();
          if (typeof window.__sfx === 'function') window.__sfx('open');
        } else {
          // POST failed — fall back to mail client
          toast(dict()['wizard.fallback'] || 'Otwieram klienta mailowego jako fallback...');
          fallbackMailto();
          next.disabled = false;
          next.classList.remove('is-loading');
          nextLabel.textContent = original;
        }
      }
    });

    // Reset back to step 1 from done state
    const resetBtn = wiz.querySelector('#wizardReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        wiz.reset();
        const nav = wiz.querySelector('.wizard__nav');
        if (nav) nav.style.display = '';
        next.disabled = false;
        next.classList.remove('is-loading');
        const d = dict();
        nextLabel.textContent = d['wizard.next'] || 'Dalej';
        showStep(0);
      });
    }

    back.addEventListener('click', () => {
      if (current > 0) {
        showStep(current - 1);
        if (typeof window.__sfx === 'function') window.__sfx('tick');
      }
    });

    // Clear invalid state on input
    [$('#wizName'), $('#wizEmail'), $('#wizBrief')].forEach((el) => {
      el?.addEventListener('input', () => el.classList.remove('is-invalid'));
    });

    // Auto-advance on radio choice
    wiz.querySelectorAll('input[type="radio"]').forEach((r) => {
      r.addEventListener('change', () => {
        // Don't auto-advance on final step
        if (current < TOTAL - 1) {
          setTimeout(() => {
            if (validateStep(current)) showStep(current + 1);
          }, 220);
        }
      });
    });

    // Keyboard support — Enter advances
    wiz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && current < TOTAL - 1) {
        const target = e.target;
        if (target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          next.click();
        }
      }
    });
  }

  function initContactForm() {
    const form = $('#ctaForm');
    if (!form) return;
    const nameEl = $('#ctaName', form);
    const emailEl = $('#ctaEmail', form);
    const msgEl = $('#ctaMsg', form);
    const submit = form.querySelector('button[type="submit"]');
    const TARGET = 'contact@north-peak-studio.com';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const setInvalid = (el, isInvalid) => el.classList.toggle('is-invalid', !!isInvalid);
    [nameEl, emailEl, msgEl].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', () => setInvalid(el, false));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (nameEl?.value || '').trim();
      const email = (emailEl?.value || '').trim();
      const msg = (msgEl?.value || '').trim();
      let invalid = false;
      if (!name)              { setInvalid(nameEl, true);  invalid = true; }
      if (!EMAIL_RE.test(email)) { setInvalid(emailEl, true); invalid = true; }
      if (msg.length < 10)    { setInvalid(msgEl, true);   invalid = true; }
      if (invalid) {
        const lang = document.documentElement.dataset.lang || 'pl';
        const dict = window.NP_I18N?.[lang] || {};
        toast(dict['cta.form.invalid'] || 'Uzupełnij wszystkie pola (e-mail i wiadomość ≥10 znaków)');
        const firstInvalid = form.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Build subject + body for mailto:
      const lang = document.documentElement.dataset.lang || 'pl';
      const dict = window.NP_I18N?.[lang] || {};
      const subject = (dict['cta.form.mailSubject'] || 'Brief projektu — z formularza northpeak.studio') + ' · ' + name;
      const bodyLines = lang === 'en'
        ? [`Hi NorthPeak Studio,`, '', msg, '', '—', name, email]
        : [`Cześć NorthPeak Studio,`, '', msg, '', '—', name, email];
      const body = bodyLines.join('\n');
      const url = 'mailto:' + TARGET +
        '?subject=' + encodeURIComponent(subject) +
        '&body='    + encodeURIComponent(body);

      // Open user's mail client + show success toast
      window.location.href = url;
      toast(dict['cta.form.opened'] || 'Otwieram klienta mailowego...');

      // Subtle reset after short delay (give mailto a moment to fire)
      setTimeout(() => { form.reset(); }, 1500);

      // Optional: tasteful audio feedback
      if (typeof window.__sfx === 'function') window.__sfx('open');
    });
  }

  /* -------------------------------------------------------
     22ad. COOKIE CONSENT — minimal GDPR banner with localStorage
     ------------------------------------------------------- */
  function initCookieConsent() {
    const banner = $('#cookieBanner');
    if (!banner) return;
    let consent = null;
    try { consent = localStorage.getItem('np-cookie-consent'); } catch {}
    if (consent === 'accepted' || consent === 'declined') return; // already decided
    // Show after small delay so it doesn't compete with intro
    setTimeout(() => {
      banner.classList.add('is-visible');
      banner.setAttribute('aria-hidden', 'false');
    }, prefersReduce ? 600 : 3200);
    const close = (decision) => {
      try { localStorage.setItem('np-cookie-consent', decision); } catch {}
      banner.classList.remove('is-visible');
      banner.classList.add('is-leaving');
      setTimeout(() => {
        banner.style.display = 'none';
        banner.setAttribute('aria-hidden', 'true');
      }, 500);
      if (typeof window.__sfx === 'function') window.__sfx('tick');
    };
    $('#cookieAccept', banner)?.addEventListener('click', () => close('accepted'));
    $('#cookieDecline', banner)?.addEventListener('click', () => close('declined'));
  }

  /* -------------------------------------------------------
     22ac. NEWSLETTER (Studio notes signup) — mailto-style fallback
     since we have no backend; saves email to localStorage list and
     opens a confirmation mailto for the studio to reply.
     ------------------------------------------------------- */
  function initNewsletter() {
    const form = $('#footerNewsletter');
    if (!form) return;
    const input = form.querySelector('input[type="email"]');
    const btn = form.querySelector('button[type="submit"]');
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = (input.value || '').trim();
      const lang = document.documentElement.dataset.lang || 'pl';
      const dict = window.NP_I18N?.[lang] || {};
      if (!EMAIL_RE.test(email)) {
        input.classList.add('is-invalid');
        toast(dict['footer.newsletter.invalid'] || 'Wpisz poprawny e-mail');
        input.focus();
        return;
      }
      input.classList.remove('is-invalid');
      // Persist locally (replaces real backend)
      try {
        const list = JSON.parse(localStorage.getItem('np-newsletter') || '[]');
        if (!list.includes(email)) list.push(email);
        localStorage.setItem('np-newsletter', JSON.stringify(list));
      } catch {}
      // Open mailto so user signs up via real channel
      const subject = dict['footer.newsletter.mailSubject'] || 'Studio notes — chcę się zapisać';
      const body = (lang === 'en'
        ? `Hi NorthPeak — please add ${email} to Studio notes.`
        : `Cześć NorthPeak — dopiszcie proszę ${email} do listy Studio notes.`);
      window.location.href = 'mailto:contact@north-peak-studio.com?subject=' +
        encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      // Visual success state
      form.classList.add('is-success');
      btn.textContent = dict['footer.newsletter.success'] || 'Zapisano ✓';
      toast(dict['footer.newsletter.toast'] || 'Otwieram klienta mailowego — kliknij Wyślij żeby potwierdzić');
      if (typeof window.__sfx === 'function') window.__sfx('open');
    });
    input?.addEventListener('input', () => input.classList.remove('is-invalid'));
  }

  /* -------------------------------------------------------
     22a. COMMAND PALETTE (⌘K)
     ------------------------------------------------------- */
  function initCommandPalette() {
    const overlay = $('#cmdk');
    const input = $('#cmdkInput');
    const list = $('#cmdkList');
    const trigger = $('#cmdkOpen');
    if (!overlay || !input || !list) return;

    function buildCmds() {
      const lang = document.documentElement.dataset.lang || 'pl';
      const dict = window.NP_I18N?.[lang] || {};
      const t = (k, fallback) => dict[k] != null ? dict[k] : (fallback || k);
      const G_NAV = t('cmdk.section.nav', 'Sekcje');
      const G_ACT = t('cmdk.section.actions', 'Akcje');
      const G_SET = t('cmdk.section.settings', 'Ustawienia');
      return [
        { group: G_NAV, id: 'go-studio',    title: t('cmdk.go.studio', 'Studio'),         hint: 'g 1', action: () => scrollToHash('#studio') },
        { group: G_NAV, id: 'go-services',  title: t('cmdk.go.services', 'Usługi'),       hint: 'g s', action: () => scrollToHash('#services') },
        { group: G_NAV, id: 'go-process',   title: t('cmdk.go.process', 'Proces'),        hint: 'g p', action: () => scrollToHash('#process') },
        { group: G_NAV, id: 'go-terrain',   title: t('cmdk.go.terrain', 'Mapa terenu'),   hint: 'g t', action: () => scrollToHash('#terrain') },
        { group: G_NAV, id: 'go-work',      title: t('cmdk.go.work', 'Realizacje'),       hint: 'g w', action: () => scrollToHash('#work') },
        { group: G_NAV, id: 'go-stack',     title: t('cmdk.go.stack', 'Technologie'),     hint: 'g k', action: () => scrollToHash('#stack') },
        { group: G_NAV, id: 'go-faq',       title: t('cmdk.go.faq', 'FAQ'),               hint: 'g f', action: () => scrollToHash('#faq') },
        { group: G_NAV, id: 'go-contact',   title: t('cmdk.go.contact', 'Kontakt'),       hint: 'g c', action: () => scrollToHash('#contact') },
        { group: G_ACT, id: 'copy-email',   title: t('cmdk.copyEmail', 'Kopiuj e-mail'),  hint: '⌘E', action: () => { navigator.clipboard?.writeText('contact@north-peak-studio.com'); toast(t('cmdk.copied', 'Skopiowano') + ': contact@north-peak-studio.com'); } },
        { group: G_ACT, id: 'open-email',   title: t('cmdk.openEmail', 'Napisz e-mail'),  hint: '↵',  action: () => { window.location.href = 'mailto:contact@north-peak-studio.com'; } },
        { group: G_SET, id: 'toggle-lang',  title: t('cmdk.toggleLang', 'Przełącz język'), hint: '⌘L', action: () => { $('#langSwitch')?.click(); } },
        { group: G_SET, id: 'toggle-audio', title: t('cmdk.toggleAudio', 'Włącz / wyłącz dźwięk'), hint: '⌘M', action: () => { $('#audioToggle')?.click(); } },
        { group: G_SET, id: 'toggle-motion', title: t('cmdk.toggleMotion', 'Włącz / wyłącz motion'), hint: '', action: () => { document.body.classList.toggle('motion-off'); toast(document.body.classList.contains('motion-off') ? 'Motion off' : 'Motion on'); } },
      ];
    }

    let cmds = buildCmds();
    let active = 0;
    let filtered = cmds.slice();

    function scrollToHash(hash) {
      close();
      const el = document.querySelector(hash);
      if (!el) return;
      if (window.__lenis) window.__lenis.scrollTo(el, { duration: 1.4 });
      else el.scrollIntoView({ behavior: 'smooth' });
    }

    function render() {
      const groups = {};
      filtered.forEach(c => { (groups[c.group] = groups[c.group] || []).push(c); });
      let html = '';
      let idx = 0;
      Object.keys(groups).forEach(g => {
        html += `<div class="cmdk__group">${g}</div>`;
        groups[g].forEach(c => {
          html += `<div class="cmdk__item ${idx === active ? 'is-active' : ''}" data-i="${idx}" data-id="${c.id}"><span class="cmdk__itemIcon">${c.id.startsWith('go-') ? '↗' : '⚡'}</span><span class="cmdk__itemTitle">${c.title}</span><span class="cmdk__itemHint">${c.hint}</span></div>`;
          idx++;
        });
      });
      list.innerHTML = html;
      list.querySelectorAll('.cmdk__item').forEach((el) => {
        el.addEventListener('click', () => {
          const i = parseInt(el.dataset.i, 10);
          if (filtered[i]) filtered[i].action();
        });
        el.addEventListener('mouseenter', () => {
          active = parseInt(el.dataset.i, 10);
          updateActive();
        });
      });
    }

    function updateActive() {
      list.querySelectorAll('.cmdk__item').forEach((el, i) => {
        el.classList.toggle('is-active', i === active);
      });
      const cur = list.querySelector('.cmdk__item.is-active');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    function filter(q) {
      const lower = q.trim().toLowerCase();
      filtered = lower ? cmds.filter(c => c.title.toLowerCase().includes(lower) || c.group.toLowerCase().includes(lower)) : cmds.slice();
      active = 0;
      render();
    }

    function open() {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      input.value = '';
      filter('');
      setTimeout(() => input.focus(), 50);
      if (window.__lenis) window.__lenis.stop();
      sfx('open');
    }
    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      if (window.__lenis) window.__lenis.start();
    }

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        overlay.classList.contains('is-open') ? close() : open();
      } else if (overlay.classList.contains('is-open')) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(filtered.length - 1, active + 1); updateActive(); sfx('tick'); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); active = Math.max(0, active - 1); updateActive(); sfx('tick'); }
        if (e.key === 'Enter')     { e.preventDefault(); if (filtered[active]) filtered[active].action(); }
      }
    });
    if (trigger) trigger.addEventListener('click', open);
    overlay.querySelector('.cmdk__backdrop')?.addEventListener('click', close);
    input.addEventListener('input', (e) => filter(e.target.value));

    // Expose so applyI18n() can rebuild cmd list when language changes
    window.__rerenderCmdK = () => {
      cmds = buildCmds();
      filter(input.value || '');
    };

    render();
  }

  /* -------------------------------------------------------
     22b. TOAST (small popup feedback)
     ------------------------------------------------------- */
  let toastTimer;
  function toast(msg, dur = 2000) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), dur);
  }

  /* -------------------------------------------------------
     22c. NAV TIME + ACTIVE SECTION DOT
     ------------------------------------------------------- */
  function initNavExtras() {
    // Live clock (Warsaw, Poland — Europe/Warsaw timezone)
    const clock = $('.nav__timeClock');
    if (clock) {
      const tick = () => {
        try {
          const fmt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false });
          clock.textContent = fmt.format(new Date());
        } catch { clock.textContent = new Date().toTimeString().slice(0, 5); }
      };
      tick();
      setInterval(tick, 30000);
    }

    // Active section dot
    const dot = $('#navActiveDot');
    const links = $$('.nav__links a[data-section]');
    if (!dot || !links.length) return;

    const navLinks = links.map(a => ({ a, id: a.dataset.section }));
    const sections = navLinks.map(({ id }) => document.getElementById(id)).filter(Boolean);

    const updateDot = () => {
      const mid = window.scrollY + window.innerHeight * 0.3;
      let activeId = null;
      sections.forEach((s) => {
        if (s.offsetTop <= mid) activeId = s.id;
      });
      const active = navLinks.find(n => n.id === activeId);
      if (active) {
        const r = active.a.getBoundingClientRect();
        const parentR = active.a.parentElement.getBoundingClientRect();
        dot.style.left = (r.left - parentR.left + r.width / 2 - 3) + 'px';
        dot.classList.add('is-on');
      } else {
        dot.classList.remove('is-on');
      }
    };
    window.addEventListener('scroll', updateDot, { passive: true });
    window.addEventListener('resize', updateDot);
    setTimeout(updateDot, 100);
  }

  /* -------------------------------------------------------
     22d. CURSOR PARTICLE TRAIL
     ------------------------------------------------------- */
  function initCursorTrail() {
    if (isMobile || prefersReduce) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'cursor-trail';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const dots = [];
    let lx = -1, ly = -1;
    window.addEventListener('mousemove', (e) => {
      if (lx >= 0) {
        const dx = e.clientX - lx;
        const dy = e.clientY - ly;
        const dist = Math.hypot(dx, dy);
        // Only spawn dots if cursor moved enough — prevents spam at rest
        if (dist > 4) {
          dots.push({
            x: e.clientX + (Math.random() - 0.5) * 4,
            y: e.clientY + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4 + 0.05,
            life: 1,
            r: Math.random() * 1.6 + 0.5,
            hue: Math.random() < 0.5 ? 22 : 190,
          });
        }
      }
      lx = e.clientX; ly = e.clientY;
    });

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        d.x += d.vx; d.y += d.vy;
        d.life -= 0.02;
        if (d.life <= 0) { dots.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${d.hue}, 95%, 65%, ${d.life * 0.6})`;
        ctx.arc(d.x, d.y, d.r * d.life, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* -------------------------------------------------------
     22e. AUDIO (subtle synth feedback)
     ------------------------------------------------------- */
  let audioCtx = null;
  let audioOn = false;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return audioCtx;
  }
  function sfx(kind = 'tick') {
    if (!audioOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    let freq, dur, type, vol;
    switch (kind) {
      case 'open':  freq = 660; dur = 0.16; type = 'sine'; vol = 0.04; break;
      case 'close': freq = 330; dur = 0.12; type = 'sine'; vol = 0.03; break;
      case 'hover': freq = 880; dur = 0.05; type = 'triangle'; vol = 0.015; break;
      case 'tick':  freq = 1100; dur = 0.04; type = 'square'; vol = 0.012; break;
      default: freq = 600; dur = 0.08; type = 'sine'; vol = 0.02;
    }
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }
  // Expose to other modules
  window.__sfx = sfx;

  function initAudio() {
    const btn = $('#audioToggle');
    if (!btn) return;
    try { audioOn = localStorage.getItem('np-audio') === '1'; } catch {}
    if (audioOn) btn.classList.add('is-on');
    btn.addEventListener('click', () => {
      audioOn = !audioOn;
      btn.classList.toggle('is-on', audioOn);
      try { localStorage.setItem('np-audio', audioOn ? '1' : '0'); } catch {}
      if (audioOn) { ensureAudio(); sfx('open'); toast('Audio on'); }
      else toast('Audio off');
    });

    // Hover/click sfx hooks (tasteful, only on key interactives)
    document.addEventListener('mouseenter', (e) => {
      const t = e.target;
      if (t && t.matches?.('a.btn, .nav__cta, .card, .work__card, .impact__cell, .lang')) sfx('hover');
    }, true);
    document.addEventListener('click', (e) => {
      const t = e.target?.closest?.('a.btn, .nav__cta, .lang, .nav__cmdk, .nav__audio');
      if (t) sfx('open');
    });
  }

  /* -------------------------------------------------------
     22. SCROLL-DRIVEN BG COLOR SHIFT
     ------------------------------------------------------- */
  /* -------------------------------------------------------
     22e1. STUDIO PRESENCE — time + ambient state
     ------------------------------------------------------- */

  // Returns Warsaw local hour (0-23) — used by daylight + greeting
  function warsawNow() {
    try {
      const d = new Date();
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Warsaw',
        hour: 'numeric', minute: 'numeric', weekday: 'short', day: 'numeric', month: 'short',
        hour12: false,
      });
      const parts = fmt.formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
      return {
        h: parseInt(parts.hour, 10),
        m: parseInt(parts.minute, 10),
        weekday: parts.weekday,
        day: parts.day,
        month: parts.month,
        date: d,
      };
    } catch {
      const d = new Date();
      return { h: d.getHours(), m: d.getMinutes(), weekday: '', day: d.getDate(), month: '', date: d };
    }
  }

  // BATCH A1: Daylight cycle — body class reflects time of day in Warsaw
  function initDaylight() {
    const apply = () => {
      const { h } = warsawNow();
      let phase = 'night';
      if (h >= 6 && h < 11) phase = 'morning';
      else if (h >= 11 && h < 17) phase = 'midday';
      else if (h >= 17 && h < 22) phase = 'evening';
      const body = document.body;
      body.classList.remove('is-morning', 'is-midday', 'is-evening', 'is-night');
      body.classList.add('is-' + phase);
    };
    apply();
    // Re-check every 5 min (cheap)
    setInterval(apply, 5 * 60 * 1000);
  }

  // BATCH A2: Studio status panel now-text — applyI18n handles localization
  // since `.studioStatus__text` has data-i18n + data-i18n-html. This is a no-op
  // but kept for symmetric init order.
  function initStudioPresence() {
    const t = $('.studioStatus__text');
    if (!t) return;
    const lang = document.documentElement.dataset.lang || 'pl';
    const dict = window.NP_I18N?.[lang];
    if (dict && dict['hero.nowText']) t.innerHTML = dict['hero.nowText'];
  }

  // BATCH A3: Activity ticker — rotating "what's happening in the studio"
  function initActivityTicker() {
    const ticker = $('.ticker');
    if (!ticker) return;
    const lang = document.documentElement.dataset.lang || 'pl';
    const phrases = lang === 'en' ? [
      'Bartek is sketching wireframes',
      'Coffee #4 of the day',
      'Sprint demo on Friday',
      'Reviewing client comments',
      'Debugging a tricky shader',
      'Brief just landed — reading...',
      'Pushing to staging',
      'Refactoring the design system',
      'Lunch break — back in 30',
      'Listening to ambient · room is quiet',
    ] : [
      'Bartek rysuje wireframy',
      'Kawa #4 dnia',
      'Sprint demo w piątek',
      'Przeglądamy komentarze klienta',
      'Debugujemy trudny shader',
      'Wpadł brief — czytamy...',
      'Push na staging',
      'Refaktor design systemu',
      'Przerwa na lunch — wracamy za 30',
      'Cichy ambient w studiu',
    ];
    // Replace ticker content with rotated phrases
    const phrase1 = phrases[Math.floor(Math.random() * phrases.length)];
    const phrase2 = phrases[Math.floor(Math.random() * phrases.length)];
    ticker.innerHTML = `<span>● ${phrase1} · ${phrase2} · NorthPeak Studio ●</span><span>● ${phrase1} · ${phrase2} · NorthPeak Studio ●</span>`;
  }

  // BATCH B3: Studio diary — date + dynamic stats (coffee count, last commit time)
  function initStudioDiary() {
    const diary = $('#studioDiary');
    if (!diary) return;
    const dateEl = $('#diaryDate', diary);
    const coffee = $('#diaryCoffeeCount', diary);
    const commit = $('#diaryCommit', diary);
    const lang = document.documentElement.dataset.lang || 'pl';
    const { weekday, day, month } = warsawNow();
    if (dateEl) dateEl.textContent = `${weekday} ${day} ${month}`;
    // Coffee count = pseudo-deterministic by day of year + hour, plus the more time passes the more coffees
    const now = warsawNow();
    const dayOfYear = Math.floor((Date.now() - new Date(now.date.getFullYear(), 0, 0)) / 86400000);
    const baseCoffees = Math.max(0, Math.floor((now.h - 7) * 0.7));  // start ~7am, +0.7/h
    if (coffee) coffee.textContent = String(Math.min(12, baseCoffees + (dayOfYear % 3)));
    // Last commit — pseudo-random 1-6h based on day of year
    const lastCommitHrs = ((dayOfYear * 7) % 5) + 1;
    if (commit) commit.textContent = `${lastCommitHrs}h`;
  }

  // BATCH C1: Status pill in nav — rotates between local time, sprint, slots
  function initStatusPill() {
    const lblEl = $('#navStatusLabel');
    const valEl = $('#navStatusValue');
    if (!lblEl || !valEl) return;
    const lang = document.documentElement.dataset.lang || 'pl';
    const states = lang === 'en' ? [
      () => { const { h, m } = warsawNow(); return ['WAW', `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`]; },
      () => ['SPRINT', '#14'],
      () => ['SLOTS', '2 / Q3'],
      () => ['LAST', '~3h'],
    ] : [
      () => { const { h, m } = warsawNow(); return ['WAW', `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`]; },
      () => ['SPRINT', '#14'],
      () => ['SLOTY', '2 / Q3'],
      () => ['COMMIT', '~3h'],
    ];
    let idx = 0;
    const apply = () => {
      const [k, v] = states[idx % states.length]();
      // Subtle fade transition
      lblEl.style.transition = 'opacity 0.4s var(--ease-out)';
      valEl.style.transition = 'opacity 0.4s var(--ease-out)';
      lblEl.style.opacity = '0'; valEl.style.opacity = '0';
      setTimeout(() => {
        lblEl.textContent = k; valEl.textContent = v;
        lblEl.style.opacity = '1'; valEl.style.opacity = '1';
      }, 350);
      idx++;
    };
    // Initial render without fade
    const [k, v] = states[0]();
    lblEl.textContent = k; valEl.textContent = v;
    idx = 1;
    setInterval(apply, 4500);
  }

  /* -------------------------------------------------------
     22f0. PINNED SCENES — toggle cinematic letterbox bars
     ------------------------------------------------------- */
  function initPinnedSceneDetector() {
    const pinnedIds = ['process', 'terrain', 'reel'];
    const targets = pinnedIds.map(id => document.getElementById(id)).filter(Boolean);
    if (!targets.length) return;
    const update = () => {
      const mid = window.scrollY + window.innerHeight * 0.5;
      let inPinned = false;
      targets.forEach((el) => {
        const top = el.offsetTop;
        const bot = top + el.offsetHeight;
        if (mid >= top && mid <= bot) inPinned = true;
      });
      document.body.classList.toggle('is-pinned', inPinned);
    };
    window.addEventListener('scroll', update, { passive: true });
    setTimeout(update, 100);
  }

  /* -------------------------------------------------------
     22f. AURORA QUIET — dim aurora over content-heavy sections
     ------------------------------------------------------- */
  function initAuroraQuiet() {
    const quietIds = ['services', 'faq', 'studio', 'stack'];
    const targets = quietIds.map(id => document.getElementById(id)).filter(Boolean);
    if (!targets.length) return;
    const io = new IntersectionObserver((entries) => {
      const anyIn = entries.some(e => e.isIntersecting);
      // We need overall state, not just per-entry. Recompute against all targets.
      const overall = targets.some(el => {
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
      });
      document.body.classList.toggle('aurora-quiet', overall);
    }, { threshold: [0, 0.4, 0.8] });
    targets.forEach(el => io.observe(el));
  }

  function initBgColorShift() {
    if (prefersReduce) return;
    const sections = [
      { id: 'hero', color: '#08080d' },
      { id: 'manifest', color: '#0d0a10' },
      { id: 'studio', color: '#08080d' },
      { id: 'services', color: '#0a0a12' },
      { id: 'terrain', color: '#06060c' },
      { id: 'process', color: '#0a0c14' },
      { id: 'work', color: '#08080d' },
      { id: 'stack', color: '#0c0a08' },
      { id: 'faq', color: '#08080d' },
      { id: 'contact', color: '#0a0a0a' },
    ];
    const els = sections.map(s => ({ el: document.getElementById(s.id), color: s.color })).filter(s => s.el);
    if (!els.length) return;
    const onScroll = () => {
      const mid = window.scrollY + window.innerHeight / 2;
      let active = els[0].color;
      els.forEach(s => {
        const r = s.el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        if (mid >= top) active = s.color;
      });
      document.body.style.backgroundColor = active;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -------------------------------------------------------
     INIT
     ------------------------------------------------------- */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initLang();
    initTheme();
    initPWA();
    initBackToTop();
    initWordSplitting();
    initCharSplitting();
    initReveal();
    initNav();
    initCursor();
    initMagnetic();
    initCardGlow();
    initTilt();
    initMarqueeBoost();
    initScrollProgress();
    initBgColorShift();
    initAuroraQuiet();
    initHeroIntro();

    await runLoader();

    // Lenis FIRST so gsap.ticker integration is wired BEFORE we tween chars
    initLenis();
    // Hero parallax sets up chars in hidden state + exposes __playHeroChars
    initHeroParallax();
    // Reveal hero content + trigger char animation in sync
    revealHeroContent();

    initGlobalCanvas();
    initHeroVideo();
    initDisplacementWarp();

    // Three.js is loaded as ES module (deferred) — wait for it.
    // Idempotent: each Three module runs only once even if event fires after sync check.
    let threeInited = false;
    const startThreeModules = () => {
      if (threeInited) return;
      threeInited = true;
      initHeroShader();
      initTerrain();
    };
    if (typeof window.THREE !== 'undefined') {
      startThreeModules();
    } else {
      const onReady = () => { window.removeEventListener('three-ready', onReady); startThreeModules(); };
      window.addEventListener('three-ready', onReady);
      // Fallback: skip after 3s if module didn't load
      setTimeout(() => { window.removeEventListener('three-ready', onReady); /* skip */ }, 3000);
    }
    initParallax();
    initProcess();
    initSectionTitles();
    initServicesSpotlight();
    initStackGrid();
    initCtaReveal();
    initStaggerLists();
    initSectionHeadParallax();
    initStudioParallax();
    initServicesParallax();
    initDividerParallax();
    initSceneTransitions();
    initLabelPop();
    initSceneIndicator();
    initPinnedSceneDetector();
    initContactForm();
    initWizard();
    initNewsletter();
    initCookieConsent();
    initDaylight();
    initStudioPresence();
    initActivityTicker();
    initStudioDiary();
    initStatusPill();
    initExtraParallax();
    init3DTilt();
    initInterludeReveal();
    initReel();
    initScrambleCounters();
    initTextScramble();
    initFooterBigWord();
    initCommandPalette();
    initNavExtras();
    initCursorTrail();
    initAudio();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      });
    }
  });

  window.addEventListener('load', () => {
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  });
})();
