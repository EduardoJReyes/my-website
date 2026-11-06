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
    if (chapterChanged) tape();
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
      var i = Math.max(0, Math.min(steps.length - 1, Math.round(scroller.scrollTop / stageH)));
      activate(i, true);
    });
  }, { passive: true });

  function goTo(i, smooth) {
    i = Math.max(0, Math.min(steps.length - 1, i));
    scroller.scrollTo({ top: i * stageH, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    activate(i, false);
    setHash(steps[i].id);
  }

  /* ---------- tape wipe between chapters ---------- */
  function tape() {
    if (reduce || !introDone) return;
    tapeEl.classList.remove('run'); scroller.classList.remove('glitch');
    void tapeEl.offsetWidth;
    tapeEl.classList.add('run'); scroller.classList.add('glitch');
    setTimeout(function () { tapeEl.classList.remove('run'); scroller.classList.remove('glitch'); }, 450);
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
    if (!bookOpen) {
      lastFocus = document.activeElement;
      tape();
      book.hidden = false;
      scroller.inert = true; chaptersBar.inert = true;
      bookOpen = true;
    }
    book.classList.remove('is-in'); void book.offsetWidth;
    requestAnimationFrame(function () { book.classList.add('is-in'); });
    setHash(key);
    document.getElementById('bookTitle').focus({ preventScroll: true });
  }
  function closeBook() {
    if (!bookOpen) return;
    bookOpen = false;
    book.classList.remove('is-in');
    book.hidden = true;
    scroller.inert = false; chaptersBar.inert = false;
    setHash(steps[Math.max(cur, 0)].id);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.getElementById('bookClose').addEventListener('click', closeBook);

  /* ---------- links ---------- */
  function route(hash, smooth) {
    var key = (hash || '').replace(/^#/, '');
    if (BOOK[key]) { openBook(key); return true; }
    if (key in byId) { if (bookOpen) closeBook(); goTo(byId[key], smooth); return true; }
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
  var intro = document.getElementById('intro'), skip = document.getElementById('skipIntro');
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
    skip.addEventListener('click', endIntro);
    var word = document.getElementById('introWord'), pct = document.getElementById('introPct');
    var WORDS = [['Open', 'Unreal.'], ['Stop', 'Panicking.'], ['Make', 'Things.']];
    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    var render = function (w) {
      var d = 0; word.className = 'intro-word';
      word.innerHTML = w.map(function (line, li) {
        return '<span class="w w' + (li + 1) + '">' + line.split('').map(function (c) {
          return '<span class="ch" style="--d:' + (d++) + '">' + c + '</span>';
        }).join('') + '</span>';
      }).join('');
    };
    var STEP = 1050, T0 = 150;
    WORDS.forEach(function (w, i) {
      var s = T0 + i * STEP;
      at(s, function () { intro.classList.remove('flip'); render(w); });
      [480, 560, 640, 720].forEach(function (o) { at(s + o, function () { intro.classList.toggle('flip'); }); });
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
