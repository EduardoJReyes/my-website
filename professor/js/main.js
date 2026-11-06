/* Eduardo J. Reyes · Unreal Engine Professor
   Scroll moves through the parts of a chapter first, then to the next chapter.
   Every step has its own link (#formats-studio, #faq-pc...). */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scroller = document.getElementById('scroller');
  var chaptersBar = document.getElementById('chapters');
  var tapeEl = document.getElementById('tape');
  var crtEl = document.getElementById('crt'), crtOsd = document.getElementById('crtOsd');

  /* ---------- steps ---------- */
  var steps = [];
  var chapterEls = Array.prototype.slice.call(document.querySelectorAll('.chapter'));
  chapterEls.forEach(function (ch) {
    var marks = ch.querySelectorAll('.snaps i');
    Array.prototype.forEach.call(marks, function (m, i) {
      steps.push({ ch: ch, name: ch.dataset.chapter, idx: i, id: m.id, el: m });
    });
    // ticks in the chapter bar
    var link = chaptersBar.querySelector('[data-ch="' + ch.dataset.chapter + '"] .ticks');
    if (link && marks.length > 1) for (var k = 0; k < marks.length; k++) link.appendChild(document.createElement('i'));
  });
  var byId = {};
  steps.forEach(function (s, i) { byId[s.id] = i; });

  var stageH = 0, cur = -1, curChapter = null;
  function measure() {
    stageH = scroller.clientHeight;
    root.style.setProperty('--stage-h', stageH + 'px');
  }

  function setHash(id) {
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* some viewers block it */ }
  }

  function activate(i, fromScroll) {
    if (i === cur) return;
    var s = steps[i];
    var chapterChanged = curChapter && curChapter !== s.ch;
    cur = i;
    // a chapter change made by touch scrolling gets the wipe here; our own jumps run it in goTo
    if (chapterChanged && fromScroll) tape();
    else if (curChapter && !chapterChanged && sfx) sfx('step'); // notch tick between parts of a chapter
    curChapter = s.ch;

    // items + panels inside the chapter
    s.ch.querySelectorAll('[data-item]').forEach(function (el) {
      var on = +el.dataset.item === s.idx;
      el.classList.toggle('is-on', on);
      if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
    });
    s.ch.querySelectorAll('[data-panel]').forEach(function (el) {
      el.classList.toggle('is-on', +el.dataset.panel === s.idx);
    });
    var grid = s.ch.querySelector('.grid-panel');
    if (grid) grid.style.setProperty('--pan', s.idx);

    // chapter bar
    chaptersBar.querySelectorAll('a').forEach(function (a) {
      var on = a.dataset.ch === s.name;
      a.classList.toggle('is-on', on);
      if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      a.querySelectorAll('.ticks i').forEach(function (t, k) { t.classList.toggle('on', on && k === s.idx); });
    });

    if (s.name === 'start' && introDone) s.ch.classList.add('is-in');
    if (fromScroll && !bookOpen) setHash(s.id);
  }

  var ticking = false;
  scroller.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (tapeBusy) return;
      var i = Math.max(0, Math.min(steps.length - 1, Math.round(scroller.scrollTop / stageH)));
      if (target !== null) {                 // smooth scroll in progress: wait until it lands
        if (i === target && Math.abs(scroller.scrollTop - target * stageH) < 2) target = null;
        return;
      }
      activate(i, true);
    });
  }, { passive: true });

  var target = null, targetTimer = 0;
  function goTo(i, smooth) {
    i = Math.max(0, Math.min(steps.length - 1, i));
    if (i === cur && !smooth) return;
    var jump = function () {
      scroller.scrollTo({ top: i * stageH, behavior: 'auto' });
      activate(i, false);
      setHash(steps[i].id);
    };
    var otherChapter = curChapter && steps[i].ch !== curChapter;
    if (otherChapter && smooth && !reduce && introDone) { tape(jump); return; }
    if (!smooth || reduce) { jump(); return; }
    target = i;
    clearTimeout(targetTimer);
    targetTimer = setTimeout(function () { target = null; }, 1200); // safety net
    scroller.scrollTo({ top: i * stageH, behavior: 'smooth' });
    activate(i, false);
    setHash(steps[i].id);
  }

  /* ---------- sound: tiny synthesized effects (Web Audio, no files) ----------
     Browsers only allow audio after a click or key press, so nothing plays before that. */
  var sfx = (function () {
    var ctx = null, out = null, noiseBuf = null;
    var on = true;
    try { on = localStorage.getItem('ejr-sound') !== 'off'; } catch (e) {}
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); out = ctx.createGain(); out.gain.value = .5; out.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function env(g, t, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function noise(t, dur, type, f, q, peak, a) {
      var n = ctx.createBufferSource(); n.buffer = noiseBuf;
      var bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.setValueAtTime(f, t); bq.Q.value = q || 1;
      var g = ctx.createGain(); env(g, t, a || .002, peak, dur);
      n.connect(bq); bq.connect(g); g.connect(out); n.start(t, Math.random() * .5); n.stop(t + dur + .05);
      return bq;
    }
    function tone(t, type, f0, f1, dur, peak, a) {
      var o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      var g = ctx.createGain(); env(g, t, a || .004, peak, dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
    }
    var S = {
      // VCR button: a plastic click with a little body under it
      click: function (t) { noise(t, .025, 'highpass', 2200, .7, .35); tone(t, 'sine', 180, 70, .06, .25); },
      // a step inside a chapter: the soft tick of a dial notch
      step: function (t) { noise(t, .018, 'bandpass', 3200, 2, .22); tone(t, 'triangle', 900, 600, .03, .05); },
      // chapter wipe: tape being fast-forwarded past the head
      chapter: function (t) {
        var bq = noise(t, .5, 'bandpass', 500, 1.6, .22, .08);
        bq.frequency.exponentialRampToValueAtTime(2600, t + .22); bq.frequency.exponentialRampToValueAtTime(700, t + .55);
        tone(t, 'sawtooth', 70, 110, .45, .025, .06);
      },
      // CRT switching off: the picture collapses with a falling whine, then a thunk
      off: function (t) {
        tone(t, 'sine', 1400, 90, .38, .08, .01);
        var bq = noise(t, .3, 'lowpass', 6000, .7, .12, .01); bq.frequency.exponentialRampToValueAtTime(400, t + .3);
        tone(t + .4, 'sine', 120, 45, .12, .3); noise(t + .4, .03, 'highpass', 1500, .7, .2);
      },
      // CRT coming back: relay thunk, static settling, a short rising hum
      on: function (t) {
        noise(t, .03, 'highpass', 1800, .7, .25); tone(t, 'sine', 55, 40, .2, .35);
        var bq = noise(t + .03, .35, 'bandpass', 2400, .8, .1, .02); bq.frequency.exponentialRampToValueAtTime(900, t + .38);
        tone(t + .05, 'triangle', 90, 240, .3, .04, .05);
      }
    };
    function play(name, delay) {
      if (!on || !ctx || ctx.state !== 'running' || !S[name]) return;
      S[name](ctx.currentTime + .005 + (delay || 0) / 1000);
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, init, { passive: true }); });
    var btn = document.getElementById('soundBtn');
    function paint() { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.querySelector('.sound-label').textContent = on ? 'Sound on' : 'Sound off'; }
    btn.addEventListener('click', function () {
      on = !on; try { localStorage.setItem('ejr-sound', on ? 'on' : 'off'); } catch (e) {}
      paint(); init(); if (on) setTimeout(function () { play('click'); }, 30);
    });
    paint();
    return play;
  })();
  // every button or link press gets the VCR click
  document.addEventListener('pointerdown', function (e) {
    if (e.button === 0 && e.target.closest && e.target.closest('a, button') && !e.target.closest('#soundBtn')) sfx('click');
  });

  /* ---------- tape wipe between chapters ---------- */
  var tapeBusy = false;
  var TAPE_IN = 230, TAPE_TOTAL = 620;           // keep in sync with the CSS keyframes
  function tape(underCover) {
    if (reduce || !introDone) { if (underCover) underCover(); return; }
    if (tapeBusy) { if (underCover) underCover(); return; }   // never stack two wipes
    tapeBusy = true;
    sfx('chapter');
    tapeEl.classList.remove('run'); void tapeEl.offsetWidth;
    tapeEl.classList.add('run');
    setTimeout(function () {                       // bars fully cover the screen now
      if (underCover) underCover();
      scroller.classList.add('glitch');
    }, TAPE_IN);
    setTimeout(function () {
      tapeEl.classList.remove('run'); scroller.classList.remove('glitch');
      tapeBusy = false;
    }, TAPE_TOTAL);
  }

  /* ---------- CRT power off / on (booking screens) ---------- */
  var CRT_SWAP = 450, CRT_TOTAL = 1000;          // keep in sync with the crt keyframes
  function crt(label, underCover) {
    if (reduce || !introDone || tapeBusy) { if (underCover) underCover(); return; }
    tapeBusy = true;
    sfx('off'); sfx('on', CRT_SWAP + 40);
    crtOsd.innerHTML = label;
    crtEl.classList.remove('run'); void crtEl.offsetWidth;
    crtEl.classList.add('run');
    setTimeout(function () { if (underCover) underCover(); }, CRT_SWAP);
    setTimeout(function () { crtEl.classList.remove('run'); tapeBusy = false; }, CRT_TOTAL);
  }

  /* ---------- booking overlay ---------- */
  var BOOK = {
    'book': { title: 'First class<br><em>is free.</em>', text: "One session to see if it's a good fit, for both of us. No commitment, no sales call.",
              cal: 'Schedule a free first class', subject: 'Free first class', img: 'assets/render-01.jpg' },
    'book-studio': { title: 'Unreal training<br><em>for your team.</em>', text: "Official Epic training through the Unreal Authorized Instructor programme, scoped to your pipeline and your team's level. On site or remote. Trained teams at Scopely.",
              cal: 'Schedule a call', subject: 'UE5 team training', img: 'assets/render-02.jpg' },
    'book-uni': { title: 'Bring Unreal<br><em>to your programme.</em>', text: 'Two-hour seminars for masters and degree programmes across Europe: Technical Art with UE5, showreel and portfolio, Houdini tools with Claude. Currently teaching at La Salle URL.',
              cal: 'Schedule a call', subject: 'Seminar enquiry', img: 'assets/render-03.jpg' }
  };
  var SWITCH = [['book', 'Booking for yourself?'], ['book-studio', 'Booking for a team?'], ['book-uni', 'Booking for a university?']];
  var CAL_URL = 'https://calendar.google.com/'; // TODO: your Google Calendar appointment schedule link
  var EMAIL = 'eduardoj.reyes@hotmail.com';
  var topBook = document.getElementById('topBook');
  var book = document.getElementById('book'), bookOpen = false, lastFocus = null;

  function openBook(key) {
    var v = BOOK[key]; if (!v) return;
    document.getElementById('bookTitle').innerHTML = v.title;
    document.getElementById('bookText').textContent = v.text;
    document.getElementById('bookImg').src = v.img;
    document.getElementById('bookCalT').textContent = v.cal;
    document.getElementById('bookCal').href = CAL_URL;
    document.getElementById('bookMail').href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(v.subject);
    document.getElementById('bookSwitch').innerHTML = SWITCH.filter(function (s) { return s[0] !== key; })
      .map(function (s) { return '<a href="#' + s[0] + '">' + s[1] + ' &#8594;</a>'; }).join('');
    var show = function () {
      book.hidden = false;
      topBook.textContent = 'Go back'; topBook.href = '#' + steps[Math.max(cur, 0)].id;
      scroller.inert = true; chaptersBar.inert = true;
      book.classList.remove('is-in', 'crt-in'); void book.offsetWidth;
      book.classList.add('crt-in');
      requestAnimationFrame(function () { book.classList.add('is-in'); });
      document.getElementById('bookTitle').focus({ preventScroll: true });
    };
    setHash(key);
    if (!bookOpen) {
      lastFocus = document.activeElement;
      bookOpen = true;
      crt('&#9654; PLAY', show);
    } else show();
  }
  function closeBook(then) {
    if (!bookOpen) { if (typeof then === 'function') then(); return; }
    bookOpen = false;
    crt('&#9632; STOP', function () {
      book.classList.remove('is-in', 'crt-in');
      book.hidden = true;
      topBook.textContent = 'Book session'; topBook.href = '#book';
      scroller.inert = false; chaptersBar.inert = false;
      if (typeof then === 'function') then();
      else {
        setHash(steps[Math.max(cur, 0)].id);
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      }
    });
  }
  document.getElementById('bookClose').addEventListener('click', function () { closeBook(); });

  /* ---------- links ---------- */
  function route(hash, smooth) {
    var key = (hash || '').replace(/^#/, '');
    if (BOOK[key]) { openBook(key); return true; }
    if (key in byId) {
      var i = byId[key];
      if (bookOpen) closeBook(function () { scroller.scrollTo({ top: i * stageH, behavior: 'auto' }); activate(i, false); setHash(key); });
      else goTo(i, smooth);
      return true;
    }
    return false;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    if (route(a.getAttribute('href'), true)) e.preventDefault();
  });
  window.addEventListener('hashchange', function () { route(location.hash, true); });

  /* ---------- wheel: one step per flick (trackpads send long bursts) ---------- */
  var wheelLock = 0, wheelQuiet = 0;
  scroller.addEventListener('wheel', function (e) {
    if (bookOpen || introRunning || e.ctrlKey) return;
    if (tapeBusy) { e.preventDefault(); return; }
    // let inner panels that scroll (phone layouts) use the wheel first
    var inner = e.target.closest && e.target.closest('.right, .book');
    if (inner && inner.scrollHeight > inner.clientHeight + 2) {
      var atTop = inner.scrollTop <= 0, atEnd = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 2;
      if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atEnd)) return;
    }
    e.preventDefault();
    var now = performance.now(), quiet = now - wheelQuiet > 160;
    wheelQuiet = now;
    if (Math.abs(e.deltaY) < 4 || (now < wheelLock && !quiet)) return;
    if (now < wheelLock - 250) return;
    wheelLock = now + 700;
    goTo(cur + (e.deltaY > 0 ? 1 : -1), true);
  }, { passive: false });

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (introRunning) endIntro(); else closeBook(); return; }
    if (tapeBusy) { e.preventDefault(); return; }
    if (bookOpen || introRunning || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var next = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (e.key === ' ' && tag !== 'A' && tag !== 'BUTTON') next = e.shiftKey ? -1 : 1;
    if (e.key === 'Home') { e.preventDefault(); goTo(0, true); return; }
    if (e.key === 'End') { e.preventDefault(); goTo(steps.length - 1, true); return; }
    if (next) { e.preventDefault(); goTo(cur + next, true); }
  });

  /* ---------- carousels ---------- */
  var photos = document.querySelectorAll('.hero-photos img'), ph = 0;
  if (!reduce && photos.length > 1) setInterval(function () {
    photos[ph].classList.remove('is-on'); ph = (ph + 1) % photos.length; photos[ph].classList.add('is-on');
  }, 4500);

  var slides = document.querySelectorAll('.work-slide'), dotsEl = document.getElementById('workDots');
  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', 'Show project ' + (i + 1)); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.innerHTML = '<span></span>';
    b.addEventListener('click', function () {
      slides.forEach(function (x, k) { x.classList.toggle('is-on', k === i); });
      dotsEl.querySelectorAll('button').forEach(function (d, k) { d.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    });
    dotsEl.appendChild(b);
  });

  var REVIEWS = [
    { q: 'Eduardo genuinely wants his students to grow and do their best. Even when we ask for feedback on personal projects outside class, he is always happy to help.',
      who: 'Naji', ini: 'N', role: 'Animation & VFX, La Salle URL', now: '[Now: where Naji is today]', lang: 'en', url: 'https://www.linkedin.com/in/naji-swabri-274b98386/' },
    { q: 'Sus clases están muy bien organizadas, los materiales son claros y estructurados, y su feedback es siempre constructivo. Lo recomiendo totalmente.',
      who: 'Marta', ini: 'M', role: 'Design & Interactive Products, La Salle URL', now: '[Now: where Marta is today]', lang: 'es', url: 'https://www.linkedin.com/in/marta-gras/' },
    { q: 'He has helped me reach the right people in the industry and to this day remains a great inspiration. We really need more people like him.',
      who: 'Demir Danışman', ini: 'DD', role: '[Class / year with Eduardo]', now: 'Now: Freelance Developer & Tech Artist', lang: 'en', url: 'https://www.linkedin.com/in/demir-dan%C4%B1%C5%9Fman-20231a222/' }
  ];
  var rv = 0, reviewEl = document.querySelector('.review'), rvTimer;
  function showReview(i) {
    rv = (i + REVIEWS.length) % REVIEWS.length;
    var r = REVIEWS[rv];
    reviewEl.classList.add('swap');
    setTimeout(function () {
      var q = document.getElementById('rvQ'); q.textContent = '"' + r.q + '"'; q.lang = r.lang;
      document.getElementById('rvWho').textContent = r.who;
      document.getElementById('rvRole').textContent = r.role;
      document.getElementById('rvNow').textContent = r.now;
      document.getElementById('rvIni').textContent = r.ini;
      var l = document.getElementById('rvLink'); l.href = r.url; l.setAttribute('aria-label', r.who + ' on LinkedIn');
      reviewEl.classList.remove('swap');
    }, reduce ? 0 : 300);
  }
  function autoReviews() { clearInterval(rvTimer); if (!reduce) rvTimer = setInterval(function () { showReview(rv + 1); }, 8000); }
  document.getElementById('rvPrev').addEventListener('click', function () { showReview(rv - 1); autoReviews(); });
  document.getElementById('rvNext').addEventListener('click', function () { showReview(rv + 1); autoReviews(); });
  autoReviews();

  /* ---------- intro (first visit per session) ---------- */
  var intro = document.getElementById('intro');
  var introRunning = root.classList.contains('intro-on'), introDone = !introRunning, timers = [];
  function endIntro() {
    if (!introRunning) return;
    introRunning = false; introDone = true;
    timers.forEach(clearTimeout);
    intro.classList.remove('flip'); intro.classList.add('done');
    try { sessionStorage.setItem('ejr-intro', '1'); } catch (e) {}
    setTimeout(function () { root.classList.remove('intro-on'); }, 800);
    if (curChapter) curChapter.classList.add('is-in');
  }
  if (introRunning) {
    intro.addEventListener('click', endIntro); // click anywhere (or Esc) skips it
    var word = document.getElementById('introWord'), pct = document.getElementById('introPct');
    var WORDS = [['Lost in', 'Unreal Engine?'], ['Me too,', 'once.'], ["Let's fix", 'that.']];
    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    var render = function (w) {
      var d = 0; word.className = 'intro-word';
      word.innerHTML = w.map(function (line, li) {
        return '<span class="w w' + (li + 1) + '">' + line.split('').map(function (c) {
          return c === ' ' ? '<span class="ch" style="--d:' + (d++) + '">&nbsp;</span>' : '<span class="ch" style="--d:' + (d++) + '">' + c + '</span>';
        }).join('') + '</span>';
      }).join('');
    };
    var STEP = 1250, T0 = 150;
    WORDS.forEach(function (w, i) {
      var s = T0 + i * STEP;
      // the middle sentence is shown inverted (black on orange): one hard cut, no flashing
      at(s, function () { intro.classList.toggle('flip', i === 1); render(w); });
      if (i < WORDS.length - 1) at(s + STEP - 200, function () { word.classList.add('out'); });
    });
    var total = T0 + WORDS.length * STEP + 250, p0 = performance.now();
    (function tick(n) { if (!introRunning) return; var k = Math.min(1, (n - p0) / total); pct.textContent = Math.round(k * 100); if (k < 1) requestAnimationFrame(tick); })(p0);
    at(total, endIntro);
  }

  /* ---------- start ---------- */
  function init() {
    measure();
    var start = route(location.hash, false);
    if (!start) { activate(0, false); }
    if (introDone && curChapter) curChapter.classList.add('is-in');
  }
  window.addEventListener('resize', function () {
    var keep = Math.max(cur, 0); measure();
    scroller.scrollTo({ top: keep * stageH, behavior: 'auto' });
  });
  init();
})();
