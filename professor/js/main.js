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
    'book-studio': { title: 'Unreal training<br><em>for your team.</em>', text: "Tell me what your project needs. I plan the training around it and train the whole team, through Epic's Unreal Authorized Instructor programme. On site or remote. Trained teams at Scopely.",
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

  var slides = document.querySelectorAll('.work-slide'), dotsEl = document.getElementById('workDots'), wk = 0, wkTimer = 0;
  function showWork(i) {
    wk = (i + slides.length) % slides.length;
    slides.forEach(function (x, k) { x.classList.toggle('is-on', k === wk); });
    dotsEl.querySelectorAll('button').forEach(function (d, k) { d.setAttribute('aria-pressed', k === wk ? 'true' : 'false'); });
    document.getElementById('workWho').textContent = slides[wk].dataset.who;
  }
  function autoWork() { clearInterval(wkTimer); if (!reduce) wkTimer = setInterval(function () { showWork(wk + 1); }, 6000); }
  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', 'Show project ' + (i + 1)); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.innerHTML = '<span></span>';
    b.addEventListener('click', function () { showWork(i); autoWork(); });
    dotsEl.appendChild(b);
  });
  autoWork();

  var REVIEWS = [
    {"q": "What I value most about his teaching is the quality of his feedback. He genuinely wants his students to grow and do their best. Even when we ask him for feedback on our personal projects, he is always happy to help.", "who": "Naji Swabri", "role": "Animation & VFX Student", "url": "https://www.linkedin.com/in/naji-swabri-274b98386/", "lang": "en"},
    {"q": "Eduardo has been a long term mentor and friend of mine ever since I was a student. He has helped me reach the right people in the industry and to this day remains a great inspiration.", "who": "Demir Danışman", "role": "Freelance Developer & Tech Artist", "url": "https://www.linkedin.com/in/demir-dan%C4%B1%C5%9Fman-20231a222/", "lang": "en"},
    {"q": "Ha sido muy buen profesor de Unreal Engine, sabe mucho y es muy majo.", "who": "JG", "role": "Technical Artist | 3D Animator", "url": "https://www.linkedin.com/in/jg-hern%C3%A1ndez-208752258/", "lang": "es"},
    {"q": "I remember asking him to check my portfolio during random times of the day whenever I found him and he always checked it and gave me good productive feedback. Great guy.", "who": "Pedro", "role": "3D Lighter and compositing, CFX and VFX Artist", "url": "https://www.linkedin.com/in/pedro-lopes-a68189250/", "lang": "en"},
    {"q": "Sus clases están muy bien organizadas, los materiales son claros y estructurados, y su feedback es siempre constructivo y ayuda a avanzar. Lo recomiendo totalmente como profesor.", "who": "Marta Gras", "role": "Developer in Creative Tech", "url": "https://www.linkedin.com/in/marta-gras/", "lang": "es"},
    {"q": "Gran profe, muy buena actitud y sus clases son muy chulas.", "who": "Nil", "role": "3D Generalist · Modeler | Texture Artist | Unreal Engine Dev", "url": "https://www.linkedin.com/in/nil-villaronga-56304123b/", "lang": "es"},
    {"q": "Recuerdo cuando nos explicó conocimientos sobre planos de cámara con el software Unreal Engine de forma clara e interesante. En resumen, muy interesante y recomendable.", "who": "Josep", "role": "Design and Creation of Interactive Products | Motion Graphics, Videomapping, and VFX Compositing", "url": "https://www.linkedin.com/in/josep-medina-valderrama/", "lang": "es"},
    {"q": "Sabe conectar muy bien con el alumnado, muestra mucha predisposición para resolver dudas, guiar individualmente y acompañar en el proceso de aprendizaje. Recomendado 100%.", "who": "Esther", "role": "3D Professor", "url": "https://www.linkedin.com/in/esther-g%C3%B3mez-portillo/", "lang": "es"},
    {"q": "Nos aportaba con una extensa documentación para las clases que sigo consultando a este día. Revisaba nuestros trabajos de forma dedicada y se entregaba para ayudarnos con cualquier problema.", "who": "Jade", "role": "Game Designer | Character Concept Artist", "url": "https://www.linkedin.com/in/jade-d%C3%ADaz-fabregat-1a99a3361/", "lang": "es"},
    {"q": "Edu me dio clases de animación y diseño de videojuegos, su forma de enseñar es entretenida pero efectiva. Siempre tuvo buen trato con los alumnos.", "who": "Andreas", "role": "Junior 3D Animator", "url": "https://www.linkedin.com/in/andreas-sundin-ortega-93a4092a6/", "lang": "es"},
    {"q": "De todos los profesores que tuve, Edu fue siempre el más atento, más paciente y disponible. Siempre está dispuesto a ayudarte.", "who": "Ivonne", "role": "Animation & VFX Student", "url": null, "lang": "es"},
    {"q": "A very dedicated teacher to his subjects! Respects how students have different ways of learning, and has always been kind to the english-only speakers at my university.", "who": "Mayo", "role": "Animation & VFX Student", "url": "https://www.linkedin.com/in/maja-katarzyna-jarzabek-974ab42b5/", "lang": "en"},
    {"q": "He is a patient teacher who is generous with his time and approachable. He has consistent expectations, is easy to contact, and is overall a positive presence in the classroom.", "who": "Alex", "role": "Animation & VFX Student", "url": null, "lang": "en"},
    {"q": "He understands what people are looking for in their projects and is able to instruct people in how to sweeten their projects both creatively and pitch-wise.", "who": "Ivy", "role": "Animation & VFX Student", "url": null, "lang": "en"},
    {"q": "Siempre aclara dudas y hace lo posible para que todo esté claro. Es un profe muy creativo y justo, explica muy bien y de manera clara sin dar rodeos.", "who": "Yane", "role": "Animation & VFX Student", "url": "https://www.linkedin.com/in/yaneidys-longat-785b51355/", "lang": "es"},
    {"q": "La asignatura que más me gustó fue la de project management, ya que todo lo que nos enseñó fue de ayuda para que mi interés se enfoque en esa área.", "who": "María", "role": "Animation & VFX Student", "url": null, "lang": "es"},
    {"q": "Siempre se interesa en saber si lo has entendido bien mediante ejercicios prácticos que te pone para que luego tengas autodesarrollo.", "who": "Deivid", "role": "Superprof student", "url": null, "lang": "es"}
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
      var l = document.getElementById('rvNow');
      if (r.url) { l.href = r.url; l.hidden = false; l.setAttribute('aria-label', r.who + ' on LinkedIn'); } else { l.hidden = true; l.removeAttribute('href'); }
      document.getElementById('rvCount').textContent = (rv + 1) + ' / ' + REVIEWS.length;
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
