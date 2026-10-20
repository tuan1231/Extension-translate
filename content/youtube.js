// Polyglot – YouTube Video Learning (isolated world)
// - Phụ đề song ngữ đè lên video
// - Bảng transcript bên cạnh video (click để tua)
// - Luyện nghe TOEIC/IELTS: Dictation (nghe - chép) & Điền từ (fill-in-the-blank)
(() => {
  if (window.__polyglotYT) return;
  window.__polyglotYT = true;

  const MAIN_SRC = 'polyglot-yt-main';
  const ISO_SRC = 'polyglot-yt-iso';
  const PREFS_KEY = 'polyglot_yt_prefs';
  const TR_CHUNK = 40;
  const DEFAULT_PREFS = { overlay: true, showOrig: true, showTrans: true, speed: 1, collapsed: false };

  const state = {
    videoId: null,
    tracks: [],
    track: null,
    cues: [],
    translations: [],
    targetLang: 'vi',
    languages: [],
    prefs: { ...DEFAULT_PREFS },
    tab: 'transcript',
    activeIdx: -1,
    lastActiveIdx: -1,
    stopAt: null,
    loadToken: 0,
    trToken: 0,
    userScrollUntil: 0,
    prevRate: null,
    isListeningAudio: false,
    practice: {
      index: 0,
      checked: false,
      revealed: false,
      lastAcc: null,
      hints: 0,
      stats: { dictation: { count: 0, sum: 0 }, fill: { count: 0, sum: 0 } }
    },
    ui: {}
  };

  // ================= Utils =================
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + ':' + String(sec).padStart(2, '0');
  };

  // DOM builder (YouTube bật Trusted Types nên tránh innerHTML)
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const ICONS = {
    logo: 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z',
    replay: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
    prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
    next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    eyeOff: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z',
    chevron: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z',
    hint: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
    check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    save: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
    headphones: 'M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h3v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h3c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z'
  };

  function icon(name, size = 18) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', ICONS[name]);
    svg.append(p);
    return svg;
  }

  function sendBg(msg) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(r);
        });
      } catch (e) { reject(e); }
    });
  }

  // ---- Giao tiếp với MAIN world ----
  let reqSeq = 0;
  const pending = new Map();
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== MAIN_SRC || e.data.type !== 'RESPONSE') return;
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.data);
  });

  function callMain(type, payload, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const id = `${++reqSeq}-${Math.random().toString(36).slice(2)}`;
      pending.set(id, { resolve, reject });
      window.postMessage({ source: ISO_SRC, type, id, payload }, '*');
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error('timeout')); }
      }, timeout);
    });
  }

  // ---- Prefs ----
  function loadPrefs() {
    return new Promise(res => {
      try {
        chrome.storage.local.get([PREFS_KEY], r => {
          state.prefs = { ...DEFAULT_PREFS, ...(r && r[PREFS_KEY]) };
          res();
        });
      } catch (e) { res(); }
    });
  }
  function savePrefs() {
    try { chrome.storage.local.set({ [PREFS_KEY]: state.prefs }); } catch (e) { }
  }

  // ---- Text helpers ----
  const normWord = (w) => w.toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, '')
    .replace(/^'+|'+$/g, '');

  function tokenize(s) {
    return s.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
      .split(/\s+/)
      .map(raw => ({ raw, n: normWord(raw) }))
      .filter(x => x.n);
  }

  // Longest common subsequence -> các chỉ số khớp
  function lcsMatch(a, b) {
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ma = new Set(), mb = new Set();
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ma.add(i); mb.add(j); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { ma, mb };
  }

  const STOPWORDS = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being am ' +
    'i you he she it we they me him her us them my your his its our their this that these those there here ' +
    'do does did have has had not no so than then too very can could will would shall should may might must ' +
    'just about into over out up down off all any some what which who whom whose when where why how ' +
    "it's i'm you're we're they're don't can't won't isn't aren't that's there's let's").split(/\s+/));

  function isPracticable(cue) {
    return cue && tokenize(cue.text).length >= 2;
  }

  // ================= Caption parsing =================
  function parseJson3(json, isAsr) {
    const events = (json.events || []).filter(e => Array.isArray(e.segs) && e.tStartMs != null);
    let cues = [];

    if (isAsr) {
      // Phụ đề tự động: ghép từng từ thành câu
      const words = [];
      for (const ev of events) {
        for (const s of ev.segs) {
          const w = (s.utf8 || '').replace(/\n/g, ' ').trim();
          if (!w) continue;
          words.push({ t: (ev.tStartMs + (s.tOffsetMs || 0)) / 1000, w });
        }
      }
      words.sort((a, b) => a.t - b.t);
      let cur = [];
      const flush = () => {
        if (!cur.length) return;
        cues.push({ start: cur[0].t, lastT: cur[cur.length - 1].t, text: cur.map(x => x.w).join(' ') });
        cur = [];
      };
      for (let i = 0; i < words.length; i++) {
        const wd = words[i];
        cur.push(wd);
        const next = words[i + 1];
        const endsSentence = /[.?!]$/.test(wd.w);
        const gap = next ? next.t - wd.t : 99;
        if (endsSentence || cur.length >= 14 || gap > 1.4 || (cur.length >= 8 && gap > 0.7)) flush();
      }
      flush();
      cues.forEach((c, i) => {
        const nxt = cues[i + 1];
        if (!nxt) c.end = c.lastT + 1.5;
        else if (nxt.start - c.lastT < 2) c.end = nxt.start;
        else c.end = Math.min(nxt.start, c.lastT + 1.0);
        delete c.lastT;
      });
    } else {
      for (const ev of events) {
        const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const start = ev.tStartMs / 1000;
        const end = (ev.tStartMs + (ev.dDurationMs || 2000)) / 1000;
        const last = cues[cues.length - 1];
        if (last && last.text === text && start - last.end < 0.5) { last.end = Math.max(last.end, end); continue; }
        cues.push({ start, end, text });
      }
      cues.sort((a, b) => a.start - b.start);
      cues.forEach((c, i) => {
        const nxt = cues[i + 1];
        if (nxt && c.end > nxt.start) c.end = nxt.start;
        if (c.end - c.start < 0.3) c.end = c.start + 0.3;
      });
    }
    return cues;
  }

  function isEnglishTrack(t) {
    if (!t) return false;
    const code = (t.languageCode || '').toLowerCase();
    const vss = (t.vssId || '').toLowerCase();
    const name = (t.name || '').toLowerCase();
    return code === 'en' || code.startsWith('en-') || code.startsWith('en_')
      || vss.endsWith('.en') || vss.includes('.en.') || vss.startsWith('a.en')
      || name.includes('english') || name.includes('tiếng anh');
  }

  function findEnglishTrack(tracks) {
    if (!tracks || !tracks.length) return null;
    return tracks.find(t => isEnglishTrack(t) && t.kind !== 'asr')
      || tracks.find(t => isEnglishTrack(t))
      || null;
  }

  function isVietnameseTrack(t) {
    if (!t) return false;
    const code = (t.languageCode || '').toLowerCase();
    const vss = (t.vssId || '').toLowerCase();
    const name = (t.name || '').toLowerCase();
    return code === 'vi' || code.startsWith('vi-') || code.startsWith('vi_')
      || vss.endsWith('.vi') || vss.includes('.vi.') || vss.startsWith('a.vi')
      || name.includes('vietnamese') || name.includes('tiếng việt');
  }

  function findVietnameseTrack(tracks) {
    if (!tracks || !tracks.length) return null;
    return tracks.find(t => isVietnameseTrack(t) && t.kind !== 'asr')
      || tracks.find(t => isVietnameseTrack(t))
      || null;
  }

  function pickDefaultTrack(tracks) {
    if (!tracks || !tracks.length) return null;
    // Nếu cài đặt dịch sang tiếng Anh, ưu tiên phụ đề tiếng Việt
    if (state.targetLang === 'en') {
      return findVietnameseTrack(tracks) || findEnglishTrack(tracks) || tracks[0];
    }
    return findEnglishTrack(tracks)
      || findVietnameseTrack(tracks)
      || tracks.find(t => t.kind !== 'asr')
      || tracks[0];
  }

  // ================= Player helpers =================
  const getPlayer = () => document.getElementById('movie_player');
  const getVideo = () => document.querySelector('#movie_player video.html5-main-video') || document.querySelector('#movie_player video');
  const getVideoIdFromUrl = () => {
    if (location.pathname !== '/watch') return null;
    return new URLSearchParams(location.search).get('v');
  };

  function findCue(t) {
    const c = state.cues;
    let lo = 0, hi = c.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (c[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return (ans >= 0 && t < c[ans].end) ? ans : -1;
  }

  function findCueNear(t) {
    const i = findCue(t);
    if (i >= 0) return i;
    const j = state.cues.findIndex(c => c.start >= t);
    return j < 0 ? Math.max(0, state.cues.length - 1) : j;
  }

  function seekTo(t, play = true) {
    const v = getVideo();
    if (!v) return;
    v.currentTime = Math.max(0, t);
    if (play) v.play().catch(() => { });
  }

  function playCue(i) {
    const cue = state.cues[i];
    const v = getVideo();
    if (!cue || !v) return;
    v.playbackRate = state.prefs.speed || 1;
    state.stopAt = cue.end;
    seekTo(cue.start - 0.08, true);
  }

  function swapLanguageDirection() {
    if (state.targetLang === 'vi') {
      const viTrack = findVietnameseTrack(state.tracks);
      if (viTrack) {
        state.targetLang = 'en';
        state.track = viTrack;
        if (state.ui.trackSel) state.ui.trackSel.value = String(state.tracks.indexOf(viTrack));
      } else {
        if (isVietnameseTrack(state.track)) {
          state.targetLang = 'en';
        } else {
          state.targetLang = 'vi';
        }
      }
    } else {
      const enTrack = findEnglishTrack(state.tracks);
      if (enTrack) {
        state.targetLang = 'vi';
        state.track = enTrack;
        if (state.ui.trackSel) state.ui.trackSel.value = String(state.tracks.indexOf(enTrack));
      } else {
        state.targetLang = 'vi';
      }
    }
    if (state.ui.langSel) state.ui.langSel.value = state.targetLang;
    try {
      chrome.storage.local.get(['polyglot_settings'], r => {
        const s = { ...(r && r.polyglot_settings), targetLang: state.targetLang };
        chrome.storage.local.set({ polyglot_settings: s });
      });
    } catch (e) { }
    loadTrack(++state.loadToken);
  }

  // ================= UI: Panel =================
  function buildPanel() {
    const ui = state.ui;

    ui.trackSel = h('select', { class: 'pgyt-select', title: 'Phụ đề gốc', onchange: onTrackChange });
    ui.langSel = h('select', { class: 'pgyt-select', title: 'Dịch sang', onchange: onLangChange });

    ui.btnLiveAudio = h('button', {
      class: 'pgyt-chip pgyt-chip-live',
      title: 'Tự nghe âm thanh video bằng AI và dịch trực tiếp (hỗ trợ cả Tiếng Anh & Tiếng Việt)',
      onclick: toggleLiveAudioMode
    }, '🎙️ Live AI');

    ui.btnOrig = h('button', { class: 'pgyt-chip', title: 'Hiện phụ đề gốc trên video', onclick: () => togglePref('showOrig') }, 'Gốc');
    ui.btnTrans = h('button', { class: 'pgyt-chip', title: 'Hiện bản dịch trên video', onclick: () => togglePref('showTrans') }, 'Dịch');
    ui.btnOverlay = h('button', { class: 'pgyt-icon-btn', title: 'Bật/tắt phụ đề Polyglot trên video', onclick: () => togglePref('overlay') });
    ui.btnCollapse = h('button', { class: 'pgyt-icon-btn pgyt-collapse', title: 'Thu gọn', onclick: () => togglePref('collapsed') }, icon('chevron'));

    ui.tabs = {};
    const mkTab = (key, label) => {
      const b = h('button', { class: 'pgyt-tab', 'data-tab': key, onclick: () => switchTab(key) }, label);
      ui.tabs[key] = b;
      return b;
    };

    ui.statusText = h('span', { class: 'pgyt-status-text' });
    ui.progressFill = h('div', { class: 'pgyt-progress-fill' });
    ui.status = h('div', { class: 'pgyt-status' }, ui.statusText, h('div', { class: 'pgyt-progress' }, ui.progressFill));

    ui.list = h('div', { class: 'pgyt-list' });
    ['wheel', 'touchmove', 'mousedown'].forEach(ev => ui.list.addEventListener(ev, () => { state.userScrollUntil = Date.now() + 4000; }, { passive: true }));

    ui.views = {
      transcript: h('div', { class: 'pgyt-view', 'data-view': 'transcript' }, ui.list),
      dictation: h('div', { class: 'pgyt-view', 'data-view': 'dictation' }),
      fill: h('div', { class: 'pgyt-view', 'data-view': 'fill' })
    };

    ui.panel = h('section', { class: 'pgyt-panel', id: 'polyglot-yt-panel' },
      h('header', { class: 'pgyt-head' },
        h('div', { class: 'pgyt-brand' },
          h('span', { class: 'pgyt-logo' }, icon('logo', 16)),
          h('div', null,
            h('div', { class: 'pgyt-title', text: 'Polyglot Video' }),
            h('div', { class: 'pgyt-sub', text: 'Dịch phụ đề · Luyện nghe TOEIC/IELTS' })
          )
        ),
        h('div', { class: 'pgyt-head-actions' }, ui.btnLiveAudio, ui.btnOrig, ui.btnTrans, ui.btnOverlay, ui.btnCollapse)
      ),
      h('div', { class: 'pgyt-collapsible' },
        h('div', { class: 'pgyt-controls' },
          h('label', { class: 'pgyt-field' }, h('span', { text: 'Phụ đề' }), ui.trackSel),
          h('button', { class: 'pgyt-swap-btn', title: 'Đảo chiều dịch (Việt ⇄ Anh / Anh ⇄ Việt)', onclick: swapLanguageDirection }, '⇄'),
          h('label', { class: 'pgyt-field' }, h('span', { text: 'Dịch sang' }), ui.langSel)
        ),
        h('nav', { class: 'pgyt-tabs' },
          mkTab('transcript', 'Transcript'),
          mkTab('dictation', 'Dictation'),
          mkTab('fill', 'Điền từ')
        ),
        ui.status,
        h('div', { class: 'pgyt-body' }, ui.views.transcript, ui.views.dictation, ui.views.fill)
      )
    );

    // Không để phím tắt của YouTube (k, j, l, f, space...) ăn phím khi đang gõ
    ui.panel.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') e.stopPropagation();
    });
    ui.panel.addEventListener('keypress', (e) => e.stopPropagation());

    // Overlay trên video
    ui.ovOrig = h('div', { class: 'pgyt-ov-orig' });
    ui.ovTrans = h('div', { class: 'pgyt-ov-tr' });
    ui.ovBox = h('div', { class: 'pgyt-ov-box' }, ui.ovOrig, ui.ovTrans);
    ui.overlay = h('div', { class: 'pgyt-ov', id: 'polyglot-yt-overlay' }, ui.ovBox);

    // Nút trên thanh điều khiển player
    ui.playerBtn = h('button', { class: 'ytp-button pgyt-player-btn', title: 'Polyglot: phụ đề song ngữ', onclick: () => togglePref('overlay') }, icon('logo', 22));

    renderLangOptions();
    applyPrefsToUI();
    switchTab(state.tab, true);
  }

  function mountUI() {
    const ui = state.ui;
    if (!ui.panel) buildPanel();

    if (!ui.panel.isConnected) {
      const host = document.querySelector('#secondary-inner') || document.querySelector('#secondary');
      if (host) host.prepend(ui.panel);
      else if (document.body) { ui.panel.classList.add('pgyt-floating'); document.body.append(ui.panel); }
    } else if (ui.panel.classList.contains('pgyt-floating')) {
      const host = document.querySelector('#secondary-inner') || document.querySelector('#secondary');
      if (host) { ui.panel.classList.remove('pgyt-floating'); host.prepend(ui.panel); }
    }

    const player = getPlayer();
    if (player && ui.overlay.parentElement !== player) player.append(ui.overlay);

    const controls = document.querySelector('#movie_player .ytp-right-controls');
    if (controls && ui.playerBtn.parentElement !== controls) controls.prepend(ui.playerBtn);
  }

  function teardownUI() {
    stopLiveAudio();
    const ui = state.ui;
    ui.panel && ui.panel.remove();
    ui.overlay && ui.overlay.remove();
    ui.playerBtn && ui.playerBtn.remove();
    document.documentElement.classList.remove('pgyt-hide-native');
    state.stopAt = null;
  }

  function setStatus(text, progress = null) {
    const ui = state.ui;
    if (!ui.status) return;
    ui.statusText.textContent = text || '';
    ui.status.classList.toggle('pgyt-hidden', !text && progress == null);
    ui.status.classList.toggle('pgyt-has-progress', progress != null);
    ui.progressFill.style.width = `${Math.round((progress || 0) * 100)}%`;
  }

  function renderLangOptions() {
    const sel = state.ui.langSel;
    if (!sel) return;
    sel.replaceChildren();
    const langs = state.languages.length ? state.languages : [{ code: 'vi', name: 'Vietnamese' }, { code: 'en', name: 'English' }];
    langs.forEach(l => sel.append(h('option', { value: l.code, text: l.name })));
    sel.value = state.targetLang;
  }

  function renderTrackOptions() {
    const sel = state.ui.trackSel;
    sel.replaceChildren();
    state.tracks.forEach((t, i) => {
      sel.append(h('option', { value: String(i), text: t.kind === 'asr' ? `${t.name} (tự động)` : t.name }));
    });
    sel.value = String(state.tracks.indexOf(state.track));
  }

  function applyPrefsToUI() {
    const ui = state.ui, p = state.prefs;
    ui.btnOrig.classList.toggle('pgyt-on', p.showOrig);
    ui.btnTrans.classList.toggle('pgyt-on', p.showTrans);
    ui.btnOverlay.replaceChildren(icon(p.overlay ? 'eye' : 'eyeOff'));
    ui.btnOverlay.classList.toggle('pgyt-on', p.overlay);
    ui.playerBtn.classList.toggle('pgyt-on', p.overlay);
    ui.panel.classList.toggle('pgyt-collapsed', p.collapsed);
    updateOverlay();
  }

  function togglePref(key) {
    state.prefs[key] = !state.prefs[key];
    savePrefs();
    applyPrefsToUI();
  }

  function switchTab(tab, silent = false) {
    const prev = state.tab;
    state.tab = tab;
    Object.entries(state.ui.tabs).forEach(([k, b]) => b.classList.toggle('pgyt-active', k === tab));
    Object.entries(state.ui.views).forEach(([k, v]) => v.classList.toggle('pgyt-hidden', k !== tab));

    const v = getVideo();
    if (tab === 'transcript') {
      state.stopAt = null;
      if (v && state.prevRate != null) { v.playbackRate = state.prevRate; state.prevRate = null; }
      if (!silent) scrollToActive(true);
    } else {
      // Chế độ luyện nghe: nếu đang dịch sang tiếng Việt mà track chưa phải tiếng Anh thì ưu tiên tiếng Anh
      if (state.targetLang === 'vi') {
        const enTrack = findEnglishTrack(state.tracks);
        if (enTrack && state.track !== enTrack) {
          state.track = enTrack;
          if (state.ui.trackSel) state.ui.trackSel.value = String(state.tracks.indexOf(enTrack));
          loadTrack(++state.loadToken);
        }
      }

      if (v && state.prevRate == null) state.prevRate = v.playbackRate;
      if (!silent && prev === 'transcript' && state.cues.length) {
        let idx = findCueNear(v ? v.currentTime : 0);
        while (idx < state.cues.length - 1 && !isPracticable(state.cues[idx])) idx++;
        resetPracticeCard(idx);
        if (v) v.pause();
      }
      renderPractice();
    }
    updateOverlay();
  }

  // ================= Transcript =================
  function renderTranscript() {
    const ui = state.ui;
    ui.list.replaceChildren();
    ui.rows = state.cues.map((cue, i) => {
      const tr = h('div', { class: 'pgyt-row-tr' });
      const row = h('div', { class: 'pgyt-row', 'data-idx': String(i), onclick: () => seekTo(cue.start, true) },
        h('span', { class: 'pgyt-row-time', text: fmtTime(cue.start) }),
        h('div', { class: 'pgyt-row-text' }, h('div', { class: 'pgyt-row-orig', text: cue.text }), tr)
      );
      row._tr = tr;
      return row;
    });
    ui.list.append(...ui.rows);
    state.ui.rows.forEach((_, i) => updateRowTranslation(i));
  }

  function updateRowTranslation(i) {
    const row = state.ui.rows && state.ui.rows[i];
    if (!row) return;
    const t = state.translations[i];
    row._tr.textContent = t == null ? '…' : t;
    row._tr.classList.toggle('pgyt-pending', t == null);
  }

  function highlightRow() {
    const rows = state.ui.rows;
    if (!rows) return;
    if (state.lastActiveIdx >= 0 && rows[state.lastActiveIdx]) rows[state.lastActiveIdx].classList.remove('pgyt-active');
    if (state.activeIdx >= 0 && rows[state.activeIdx]) {
      rows[state.activeIdx].classList.add('pgyt-active');
      state.lastActiveIdx = state.activeIdx;
      scrollToActive(false);
    }
  }

  function scrollToActive(force) {
    const rows = state.ui.rows;
    const row = rows && rows[state.lastActiveIdx];
    if (!row || state.tab !== 'transcript') return;
    if (!force && Date.now() < state.userScrollUntil) return;
    const list = state.ui.list;
    const target = row.offsetTop - list.clientHeight / 3;
    list.scrollTo({ top: Math.max(0, target), behavior: force ? 'auto' : 'smooth' });
  }

  // ================= Overlay =================
  function updateOverlay() {
    const ui = state.ui;
    if (!ui.overlay) return;
    const p = state.prefs;
    const practicing = state.tab !== 'transcript';
    const hasCues = state.cues.length > 0;

    document.documentElement.classList.toggle('pgyt-hide-native', hasCues && (p.overlay || practicing));

    const idx = state.activeIdx;
    const show = hasCues && p.overlay && !practicing && idx >= 0;
    ui.overlay.classList.toggle('pgyt-hidden', !show);
    if (!show) return;

    const orig = state.cues[idx].text;
    const tr = state.translations[idx];
    ui.ovOrig.textContent = p.showOrig ? orig : '';
    ui.ovTrans.textContent = p.showTrans && tr ? tr : '';
    ui.ovOrig.classList.toggle('pgyt-hidden', !p.showOrig);
    ui.ovTrans.classList.toggle('pgyt-hidden', !(p.showTrans && tr));
  }

  // ================= Practice (Dictation & Fill) =================
  function resetPracticeCard(idx) {
    const pr = state.practice;
    pr.index = Math.max(0, Math.min(idx, state.cues.length - 1));
    pr.checked = false;
    pr.revealed = false;
    pr.lastAcc = null;
    pr.hints = 0;
    pr.blanks = null;
    pr.draft = '';
    pr.dictResult = null;
  }

  function commitStats() {
    const pr = state.practice;
    if (pr.lastAcc == null) return;
    const s = pr.stats[state.tab];
    if (!s) return;
    s.count++;
    s.sum += pr.lastAcc;
  }

  function practiceGo(dir) {
    if (!state.cues.length) return;
    commitStats();
    let i = state.practice.index + dir;
    while (i > 0 && i < state.cues.length - 1 && !isPracticable(state.cues[i])) i += dir;
    i = Math.max(0, Math.min(i, state.cues.length - 1));
    resetPracticeCard(i);
    renderPractice();
    playCue(i);
  }

  function replay() {
    playCue(state.practice.index);
  }

  function renderPractice() {
    const mode = state.tab;
    if (mode !== 'dictation' && mode !== 'fill') return;
    const view = state.ui.views[mode];
    view.replaceChildren();

    if (!state.cues.length) {
      view.append(h('div', { class: 'pgyt-empty', text: 'Chưa có phụ đề để luyện tập.' }));
      return;
    }

    const pr = state.practice;
    const cue = state.cues[pr.index];
    const stats = pr.stats[mode];
    const avg = stats.count ? Math.round(stats.sum / stats.count) : null;

    const speedSel = h('select', {
      class: 'pgyt-select pgyt-speed', title: 'Tốc độ phát',
      onchange: (e) => {
        state.prefs.speed = parseFloat(e.target.value);
        savePrefs();
        const v = getVideo();
        if (v) v.playbackRate = state.prefs.speed;
      }
    }, [0.5, 0.65, 0.75, 0.85, 1, 1.25].map(s => h('option', { value: String(s), text: `${s}x` })));
    speedSel.value = String(state.prefs.speed || 1);

    const enTrack = findEnglishTrack(state.tracks);
    let warnBanner = null;
    if (state.targetLang === 'vi' && !isEnglishTrack(state.track)) {
      if (enTrack) {
        warnBanner = h('div', { class: 'pgyt-warn-banner' },
          h('span', { text: `Đang luyện nghe với: ${state.track?.name || 'khác'}. Bạn có muốn chuyển sang Tiếng Anh?` }),
          h('button', {
            class: 'pgyt-btn pgyt-btn-sm pgyt-btn-primary',
            onclick: () => {
              state.track = enTrack;
              if (state.ui.trackSel) state.ui.trackSel.value = String(state.tracks.indexOf(enTrack));
              loadTrack(++state.loadToken);
            }
          }, 'Chuyển sang Tiếng Anh')
        );
      }
    }

    const isViTrack = isVietnameseTrack(state.track);
    const top = h('div', { class: 'pgyt-p-top' },
      h('div', { class: 'pgyt-p-count' },
        h('span', { text: 'Câu ' }), h('b', { text: String(pr.index + 1) }), h('span', { text: ` / ${state.cues.length}` }),
        h('span', { class: 'pgyt-badge-en', text: isViTrack ? 'TIẾNG VIỆT' : 'ENGLISH' }),
        h('span', { class: 'pgyt-p-time', text: `${fmtTime(cue.start)} – ${fmtTime(cue.end)}` })
      ),
      h('div', { class: 'pgyt-p-stats' },
        h('span', { text: `Đã luyện ${stats.count}` }),
        avg != null ? h('span', { class: 'pgyt-p-avg', text: `TB ${avg}%` }) : null
      )
    );

    const progress = h('div', { class: 'pgyt-progress pgyt-p-progress' },
      h('div', { class: 'pgyt-progress-fill', style: `width:${((pr.index + 1) / state.cues.length) * 100}%` }));

    const controls = h('div', { class: 'pgyt-p-controls' },
      h('button', { class: 'pgyt-round', title: 'Câu trước', onclick: () => practiceGo(-1) }, icon('prev')),
      h('button', { class: 'pgyt-round pgyt-round-main', title: 'Nghe lại câu (Ctrl+Space)', onclick: replay }, icon('replay', 26)),
      h('button', { class: 'pgyt-round', title: 'Câu tiếp (Enter sau khi kiểm tra)', onclick: () => practiceGo(1) }, icon('next')),
      speedSel
    );

    state.ui.result = h('div', { class: 'pgyt-result' });

    if (warnBanner) view.append(warnBanner);
    view.append(top, progress, controls);
    if (mode === 'dictation') renderDictationBody(view, cue);
    else renderFillBody(view, cue);
    view.append(state.ui.result);
    view.append(h('div', { class: 'pgyt-keys' },
      h('kbd', { text: 'Enter' }), ' kiểm tra / câu tiếp',
      h('span', { class: 'pgyt-dot', text: '·' }),
      h('kbd', { text: 'Ctrl' }), '+', h('kbd', { text: 'Space' }), ' nghe lại'
    ));

    if (pr.checked) {
      if (mode === 'dictation') showDictationResult();
      else showFillResult();
    }
  }

  function handlePracticeKey(e, onEnter) {
    if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      replay();
      return true;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter();
      return true;
    }
    return false;
  }

  // ---------- Dictation ----------
  function renderDictationBody(view, cue) {
    const pr = state.practice;
    const ta = h('textarea', {
      class: 'pgyt-input',
      rows: '3',
      placeholder: 'Nghe và gõ lại câu tiếng Anh bạn nghe được…',
      spellcheck: 'false',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off',
      lang: 'en'
    });
    if (pr.draft) ta.value = pr.draft;
    ta.addEventListener('input', () => { pr.draft = ta.value; });
    ta.addEventListener('keydown', (e) => handlePracticeKey(e, () => {
      const done = pr.checked && (pr.revealed || pr.lastAcc === 100);
      if (done) practiceGo(1); else checkDictation();
    }));
    state.ui.dictInput = ta;

    const actions = h('div', { class: 'pgyt-p-actions' },
      h('button', { class: 'pgyt-btn pgyt-btn-ghost', onclick: dictationHint }, icon('hint', 16), 'Gợi ý 1 từ'),
      h('button', { class: 'pgyt-btn pgyt-btn-ghost', onclick: () => { pr.revealed = true; checkDictation(); } }, icon('eye', 16), 'Xem đáp án'),
      h('button', { class: 'pgyt-btn pgyt-btn-primary', onclick: checkDictation }, icon('check', 16), 'Kiểm tra')
    );
    view.append(ta, actions);
    setTimeout(() => ta.focus({ preventScroll: true }), 0);
  }

  function dictationHint() {
    const pr = state.practice;
    const ta = state.ui.dictInput;
    const exp = tokenize(state.cues[pr.index].text);
    const got = tokenize(ta.value);
    let k = 0;
    while (k < exp.length && k < got.length && exp[k].n === got[k].n) k++;
    if (k >= exp.length) return;
    ta.value = exp.slice(0, k + 1).map(x => x.raw).join(' ') + ' ';
    pr.draft = ta.value;
    pr.hints++;
    ta.focus();
  }

  function checkDictation() {
    const pr = state.practice;
    const exp = tokenize(state.cues[pr.index].text);
    const got = tokenize((state.ui.dictInput && state.ui.dictInput.value) || '');
    const { ma, mb } = lcsMatch(exp.map(x => x.n), got.map(x => x.n));
    let acc = exp.length ? Math.round((ma.size / exp.length) * 100) : 100;
    if (pr.hints) acc = Math.max(0, acc - pr.hints * Math.ceil(100 / Math.max(exp.length, 1) / 2));
    pr.checked = true;
    pr.lastAcc = acc;
    pr.dictResult = { exp, got, ma, mb, acc };
    showDictationResult();
  }

  function showDictationResult() {
    const pr = state.practice;
    const r = pr.dictResult;
    const box = state.ui.result;
    if (!r || !box) return;
    box.replaceChildren();

    const perfect = r.ma.size === r.exp.length;
    const reveal = pr.revealed || perfect;
    const sentence = h('div', { class: 'pgyt-answer' },
      r.exp.map((w, i) => {
        if (r.ma.has(i)) return h('span', { class: 'pgyt-w pgyt-w-ok', text: w.raw });
        if (reveal) return h('span', { class: 'pgyt-w pgyt-w-miss', text: w.raw });
        return h('span', { class: 'pgyt-w pgyt-w-mask', text: '•'.repeat(Math.min(w.n.length, 10)), title: `${w.n.length} ký tự` });
      })
    );

    const wrong = r.got.filter((_, j) => !r.mb.has(j)).map(w => w.raw);
    box.append(
      h('div', { class: 'pgyt-score-row' },
        h('span', { class: `pgyt-score ${scoreClass(r.acc)}`, text: `${r.acc}%` }),
        h('span', { class: 'pgyt-score-msg', text: perfect ? 'Chính xác! Nhấn Enter để sang câu tiếp.' : (reveal ? 'Đáp án đầy đủ ở dưới.' : 'Các từ còn thiếu được che bằng •••. Nghe lại và sửa nhé!') })
      ),
      sentence,
      wrong.length ? h('div', { class: 'pgyt-wrong' }, h('span', { text: 'Sai / thừa: ' }), wrong.map(w => h('s', { text: w }))) : null,
      reveal ? translationBlock() : null
    );
  }

  // ---------- Fill in the blank ----------
  function seeded(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function buildBlanks(cue, idx) {
    const parts = cue.text.split(/\s+/).filter(Boolean).map(raw => {
      const m = raw.match(/^([^\p{L}\p{N}']*)(.*?)([^\p{L}\p{N}']*)$/u);
      return { raw, pre: m ? m[1] : '', word: m ? m[2] : raw, post: m ? m[3] : '', n: normWord(raw) };
    });
    const candidates = parts.map((p, i) => ({ p, i }))
      .filter(({ p }) => p.n.length >= 3 && !STOPWORDS.has(p.n) && /\p{L}/u.test(p.n));
    const pool = candidates.length ? candidates : parts.map((p, i) => ({ p, i })).filter(({ p }) => p.n).sort((a, b) => b.p.n.length - a.p.n.length).slice(0, 1);
    const count = Math.max(1, Math.min(5, Math.round(pool.length * 0.4)));
    const rnd = seeded(idx * 7919 + cue.text.length);
    const chosen = new Set(pool.map(x => ({ x, r: rnd() })).sort((a, b) => a.r - b.r).slice(0, count).map(o => o.x.i));
    return parts.map((p, i) => ({ ...p, blank: chosen.has(i) }));
  }

  function renderFillBody(view, cue) {
    const pr = state.practice;
    if (!pr.blanks) pr.blanks = buildBlanks(cue, pr.index);
    const inputs = [];

    const sentence = h('div', { class: 'pgyt-fill' },
      pr.blanks.map((p) => {
        if (!p.blank) return h('span', { class: 'pgyt-fill-word', text: p.raw });
        const inp = h('input', {
          class: 'pgyt-blank',
          type: 'text',
          autocomplete: 'off',
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off',
          lang: 'en',
          style: `width:${Math.max(3, p.word.length + 1)}ch`
        });
        if (p.value) inp.value = p.value;
        inp.addEventListener('input', () => { p.value = inp.value; inp.classList.remove('pgyt-ok', 'pgyt-bad'); });
        inp._part = p;
        inputs.push(inp);
        return h('span', { class: 'pgyt-fill-slot' }, p.pre, inp, p.post);
      })
    );

    inputs.forEach((inp, k) => {
      inp.addEventListener('keydown', (e) => handlePracticeKey(e, () => {
        const done = pr.checked && (pr.revealed || pr.lastAcc === 100);
        if (done) return practiceGo(1);
        const nextEmpty = inputs.slice(k + 1).find(x => !x.value.trim());
        if (nextEmpty && !pr.checked) nextEmpty.focus();
        else checkFill();
      }));
    });
    state.ui.fillInputs = inputs;

    const actions = h('div', { class: 'pgyt-p-actions' },
      h('button', { class: 'pgyt-btn pgyt-btn-ghost', onclick: () => { pr.revealed = true; checkFill(); } }, icon('eye', 16), 'Xem đáp án'),
      h('button', { class: 'pgyt-btn pgyt-btn-primary', onclick: checkFill }, icon('check', 16), 'Kiểm tra')
    );

    view.append(sentence, actions);
    setTimeout(() => {
      const first = inputs.find(x => !x.value) || inputs[0];
      first && first.focus({ preventScroll: true });
    }, 0);
  }

  function checkFill() {
    const pr = state.practice;
    const inputs = state.ui.fillInputs || [];
    let ok = 0;
    inputs.forEach(inp => {
      const p = inp._part;
      const correct = normWord(inp.value) === p.n;
      p.correct = correct;
      if (correct) ok++;
    });
    pr.checked = true;
    pr.lastAcc = inputs.length ? Math.round((ok / inputs.length) * 100) : 100;
    showFillResult();
  }

  function showFillResult() {
    const pr = state.practice;
    const inputs = state.ui.fillInputs || [];
    const box = state.ui.result;
    if (!box) return;
    const perfect = pr.lastAcc === 100;

    inputs.forEach(inp => {
      const p = inp._part;
      inp.classList.toggle('pgyt-ok', !!p.correct);
      inp.classList.toggle('pgyt-bad', !p.correct);
      if (pr.revealed && !p.correct) {
        inp.value = p.word;
        p.value = p.word;
        inp.classList.add('pgyt-revealed');
      }
    });

    box.replaceChildren(
      h('div', { class: 'pgyt-score-row' },
        h('span', { class: `pgyt-score ${scoreClass(pr.lastAcc)}`, text: `${pr.lastAcc}%` }),
        h('span', { class: 'pgyt-score-msg', text: perfect ? 'Tuyệt vời! Nhấn Enter để sang câu tiếp.' : (pr.revealed ? 'Đã hiện đáp án.' : 'Ô đỏ là chưa đúng — nghe lại và sửa nhé!') })
      ),
      (perfect || pr.revealed) ? translationBlock() : null
    );
  }

  function scoreClass(acc) {
    if (acc >= 90) return 'pgyt-score-great';
    if (acc >= 60) return 'pgyt-score-ok';
    return 'pgyt-score-low';
  }

  function translationBlock() {
    const pr = state.practice;
    const cue = state.cues[pr.index];
    const tr = state.translations[pr.index];
    const saveBtn = h('button', {
      class: 'pgyt-btn pgyt-btn-ghost pgyt-btn-sm',
      onclick: async () => {
        try {
          await sendBg({
            action: 'SAVE_VOCAB',
            item: { sourceText: cue.text, translatedText: tr || '', sourceLang: state.track?.languageCode || 'en', targetLang: state.targetLang }
          });
          saveBtn.replaceChildren(icon('check', 14), 'Đã lưu');
        } catch (e) { }
      }
    }, icon('save', 14), 'Lưu câu');
    return h('div', { class: 'pgyt-tr-block' },
      h('div', { class: 'pgyt-tr-text', text: tr || '(đang dịch…)' }),
      saveBtn
    );
  }

  // ================= Real-time Audio STT (Tự nghe âm thanh video) =================
  let liveAudioEngine = null; // { stop(), type: 'gemini' | 'webspeech' }

  function stopLiveAudio() {
    if (liveAudioEngine) {
      try { liveAudioEngine.stop(); } catch (e) { }
      liveAudioEngine = null;
    }
    state.isListeningAudio = false;
    if (state.ui.btnLiveAudio) {
      state.ui.btnLiveAudio.classList.remove('pgyt-on');
    }
  }

  function toggleLiveAudioMode() {
    if (state.isListeningAudio) {
      stopLiveAudio();
      setStatus('Đã tắt chế độ tự nghe âm thanh. Đang dùng phụ đề CC video.');
      if (state.track) loadTrack(++state.loadToken);
    } else {
      state.cues = [];
      state.translations = [];
      state.activeIdx = -1;
      state.lastActiveIdx = -1;
      state.ui.list && state.ui.list.replaceChildren();
      state.ui.rows = [];
      startLiveAudio();
    }
  }

  async function startLiveAudio() {
    stopLiveAudio();
    const v = getVideo();
    if (!v) {
      setStatus('Không tìm thấy video để nghe âm thanh.');
      return;
    }

    state.isListeningAudio = true;
    if (state.ui.btnLiveAudio) {
      state.ui.btnLiveAudio.classList.add('pgyt-on');
    }

    let geminiApiKey = '';
    try {
      const res = await sendBg({ action: 'GET_SETTINGS' });
      geminiApiKey = res?.settings?.geminiApiKey || '';
    } catch (e) { }

    if (geminiApiKey) {
      startGeminiAudioMode(v, geminiApiKey);
    } else {
      startWebSpeechMode(v);
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        const base64 = typeof result === 'string' ? result.split(',')[1] : '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  let geminiFailures = 0;

  function addLiveCue(start, end, text, translated) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    const cleanTr = (translated || '').trim();

    // Tránh trùng lặp câu liền kề
    const last = state.cues[state.cues.length - 1];
    if (last && last.text.toLowerCase() === cleanText.toLowerCase() && Math.abs(last.start - start) < 3.0) {
      return;
    }

    const v = getVideo();
    const curTime = v ? v.currentTime : end;
    // Cho phép hiển thị phụ đề trực tiếp ít nhất 4.5s sau khi nhận diện
    const effectiveEnd = Math.max(end, curTime + 4.5);
    if (last && last.end > start) {
      last.end = start;
    }

    const newCue = { start, end: effectiveEnd, text: cleanText };
    state.cues.push(newCue);
    state.translations.push(cleanTr);

    const idx = state.cues.length - 1;
    state.activeIdx = idx;

    // Thêm dòng mới vào giao diện Transcript
    const trEl = h('div', { class: 'pgyt-row-tr', text: cleanTr });
    const row = h('div', { class: 'pgyt-row pgyt-active', 'data-idx': String(idx), onclick: () => seekTo(newCue.start, true) },
      h('span', { class: 'pgyt-row-time', text: fmtTime(newCue.start) }),
      h('div', { class: 'pgyt-row-text' }, h('div', { class: 'pgyt-row-orig', text: cleanText }), trEl)
    );
    row._tr = trEl;
    if (!state.ui.rows) state.ui.rows = [];
    if (state.lastActiveIdx >= 0 && state.ui.rows[state.lastActiveIdx]) {
      state.ui.rows[state.lastActiveIdx].classList.remove('pgyt-active');
    }
    state.lastActiveIdx = idx;
    state.ui.rows.push(row);
    if (state.ui.list) {
      state.ui.list.append(row);
      state.ui.list.scrollTo({ top: state.ui.list.scrollHeight, behavior: 'smooth' });
    }

    // Cập nhật overlay ngay lập tức trên video
    updateOverlay();

    // Nếu đang mở tab Dictation hoặc Điền từ và chưa có câu nào thì cập nhật câu này vào
    if (state.tab !== 'transcript' && state.cues.length === 1) {
      renderPractice();
    }
  }

  function startGeminiAudioMode(video, apiKey) {
    geminiFailures = 0;
    setStatus('🎙️ Đang nghe âm thanh video bằng Gemini AI... (phát video để bắt đầu)', 0.1);

    let stream = null;
    try {
      if (video.captureStream) stream = video.captureStream();
      else if (video.mozCaptureStream) stream = video.mozCaptureStream();
    } catch (e) { }

    let audioTrack = stream?.getAudioTracks()?.[0];
    let audioStream = audioTrack ? new MediaStream([audioTrack]) : null;

    if (!audioStream) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!window.__polyglotAudioCtx) {
            window.__polyglotAudioCtx = new AudioCtx();
            const src = window.__polyglotAudioCtx.createMediaElementSource(video);
            const dest = window.__polyglotAudioCtx.createMediaStreamDestination();
            src.connect(window.__polyglotAudioCtx.destination);
            src.connect(dest);
            window.__polyglotAudioDest = dest;
          }
          audioStream = window.__polyglotAudioDest.stream;
        }
      } catch (e) { }
    }

    if (!audioStream) {
      console.warn('Không thể trích xuất stream trực tiếp, chuyển sang Web Speech API fallback.');
      startWebSpeechMode(video);
      return;
    }

    let isRecording = true;
    let timer = null;
    let activeRecorder = null;

    const recordNextChunk = () => {
      if (!isRecording) return;
      if (video.paused || video.ended) {
        timer = setTimeout(recordNextChunk, 600);
        return;
      }

      const chunkStart = video.currentTime;
      let chunks = [];
      let rec;
      try {
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
        rec = new MediaRecorder(audioStream, mime ? { mimeType: mime } : undefined);
      } catch (err) {
        console.warn('MediaRecorder error, falling back to Web Speech:', err);
        startWebSpeechMode(video);
        return;
      }

      activeRecorder = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      rec.onstop = async () => {
        const chunkEnd = video.currentTime;
        if (chunks.length > 0 && chunkEnd > chunkStart + 0.6 && chunkEnd < chunkStart + 12.0) {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          processAudioChunkWithGemini(blob, chunkStart, chunkEnd);
        }
        if (isRecording) {
          recordNextChunk();
        }
      };

      rec.start();
      timer = setTimeout(() => {
        try {
          if (rec.state === 'recording') rec.stop();
        } catch (e) { }
      }, 3800);
    };

    liveAudioEngine = {
      type: 'gemini',
      stop() {
        isRecording = false;
        if (timer) clearTimeout(timer);
        if (activeRecorder && activeRecorder.state === 'recording') {
          try { activeRecorder.stop(); } catch (e) { }
        }
      }
    };

    recordNextChunk();
  }

  async function processAudioChunkWithGemini(blob, start, end) {
    try {
      const base64 = await blobToBase64(blob);
      setStatus('🎙️ Gemini đang nhận diện giọng nói & dịch...', 0.5);
      const res = await sendBg({
        action: 'TRANSCRIBE_AUDIO',
        audioBase64: base64,
        mimeType: blob.type || 'audio/webm',
        targetLang: state.targetLang
      });

      if (res && res.success && res.data && res.data.text) {
        geminiFailures = 0;
        addLiveCue(start, end, res.data.text, res.data.translated);
        setStatus(`🟢 Đã dịch câu: "${res.data.text.slice(0, 32)}..."`);
      } else if (res && !res.success) {
        geminiFailures++;
        console.warn('Lỗi nhận diện âm thanh Gemini:', res.error);
        if (geminiFailures >= 2) {
          setStatus(`⚠️ Gemini AI gặp lỗi (${res.error || 'STT failed'}). Tự động chuyển sang Web Speech...`);
          const v = getVideo();
          if (v) startWebSpeechMode(v);
          return;
        }
        setStatus(`🎙️ Gemini gặp lỗi (${(res.error || '').slice(0, 30)}...), đang thử lại...`);
      } else {
        setStatus('🎙️ Đang nghe âm thanh video...');
      }
    } catch (err) {
      geminiFailures++;
      console.warn('Lỗi nhận diện âm thanh Gemini:', err);
      if (geminiFailures >= 2) {
        setStatus(`⚠️ Lỗi Gemini STT (${err.message}). Tự động chuyển sang Web Speech...`);
        const v = getVideo();
        if (v) startWebSpeechMode(v);
        return;
      }
      setStatus('🎙️ Đang nghe âm thanh video...');
    }
  }

  function startWebSpeechMode(video) {
    const isVi = isVietnameseTrack(state.track) || (state.targetLang === 'en');
    setStatus(`🎙️ Đang nghe bằng Web Speech API (${isVi ? 'Tiếng Việt' : 'Tiếng Anh'})... (phát video để bắt đầu)`, 0.1);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Trình duyệt không hỗ trợ Web Speech API. Vui lòng nhập Gemini API Key trong Cài đặt extension để nhận diện âm thanh.');
      return;
    }

    let recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = isVi ? 'vi-VN' : 'en-US';

    let isRunning = true;
    let lastFinalTime = video.currentTime;

    recognition.onresult = async (event) => {
      let finalStr = '';
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalStr += item[0].transcript;
        } else {
          interimStr += item[0].transcript;
        }
      }

      if (interimStr && state.prefs.overlay) {
        state.ui.ovOrig.textContent = interimStr;
        state.ui.ovOrig.classList.remove('pgyt-hidden');
      }

      if (finalStr.trim()) {
        const text = finalStr.trim();
        const start = lastFinalTime;
        const end = Math.max(video.currentTime, start + 1.2);
        lastFinalTime = end;

        try {
          const trRes = await sendBg({ action: 'DO_TRANSLATION', text, sourceLang: 'auto', targetLang: state.targetLang });
          const translated = trRes?.data?.translatedText || '';
          addLiveCue(start, end, text, translated);
          setStatus(`🟢 Đã dịch câu: "${text.slice(0, 32)}..."`);
        } catch (e) {
          addLiveCue(start, end, text, '');
        }
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('Web Speech recognition error:', e.error);
      }
    };

    recognition.onend = () => {
      if (isRunning && state.isListeningAudio) {
        try { recognition.start(); } catch (e) { }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('Cannot start recognition:', e);
    }

    liveAudioEngine = {
      type: 'webspeech',
      stop() {
        isRunning = false;
        try { recognition.stop(); } catch (e) { }
      }
    };
  }

  // ================= Loading =================
  async function loadVideo(videoId) {
    stopLiveAudio();
    const token = ++state.loadToken;
    state.cues = [];
    state.translations = [];
    state.tracks = [];
    state.track = null;
    state.activeIdx = -1;
    state.lastActiveIdx = -1;
    state.stopAt = null;
    resetPracticeCard(0);
    state.ui.list && state.ui.list.replaceChildren();
    state.ui.rows = [];
    state.ui.trackSel && state.ui.trackSel.replaceChildren();
    renderPractice();
    updateOverlay();
    setStatus('Đang tìm phụ đề của video…', 0.05);

    let info = null;
    for (let i = 0; i < 20; i++) {
      try { info = await callMain('GET_TRACKS', null, 3000); } catch (e) { info = null; }
      if (token !== state.loadToken) return;
      if (info && info.videoId === videoId && info.tracks.length) break;
      await sleep(500);
    }
    if (token !== state.loadToken) return;

    if (!info || info.videoId !== videoId || !info.tracks.length) {
      setStatus('Video này không có phụ đề CC sẵn. Đang tự động nhận diện giọng nói từ âm thanh video 🎙️...', 0.1);
      startLiveAudio();
      return;
    }

    state.tracks = info.tracks;
    state.track = pickDefaultTrack(info.tracks);
    if (isVietnameseTrack(state.track) && state.targetLang === 'vi') {
      state.targetLang = 'en';
    } else if (isEnglishTrack(state.track) && state.targetLang === 'en') {
      state.targetLang = 'vi';
    }
    renderTrackOptions();
    if (state.ui.langSel) state.ui.langSel.value = state.targetLang;
    await loadTrack(token);
  }

  async function loadTrack(token) {
    const track = state.track;
    if (!track) return;
    setStatus(`Đang tải phụ đề: ${track.name}…`, 0.15);
    let json = null;
    let trJson = null;
    try {
      // 1. Tải phụ đề gốc trước và capture POT token của player
      json = await callMain('FETCH_CAPTIONS', { videoId: state.videoId, baseUrl: track.baseUrl, languageCode: track.languageCode }, 25000);
      if (token !== state.loadToken) return;

      // 2. Tải bản dịch tlang từ YouTube (tái sử dụng POT token đã capture, tránh xung đột nút CC)
      const srcCode = (track.languageCode || '').toLowerCase().split('-')[0];
      const targetCode = (state.targetLang || '').toLowerCase().split('-')[0];
      if (srcCode !== targetCode) {
        trJson = await callMain('FETCH_CAPTIONS', {
          videoId: state.videoId,
          baseUrl: track.baseUrl,
          languageCode: track.languageCode,
          tlang: state.targetLang
        }, 15000).catch(() => null);
      }
    } catch (e) { json = null; }
    if (token !== state.loadToken) return;

    if (!json) {
      setStatus('Không tải được phụ đề CC. Đang chuyển sang tự động nghe âm thanh video 🎙️...', 0.1);
      startLiveAudio();
      return;
    }

    state.cues = parseJson3(json, track.kind === 'asr');
    if (!state.cues.length) {
      setStatus('Phụ đề trống. Đang chuyển sang tự động nghe âm thanh video 🎙️...');
      startLiveAudio();
      return;
    }
    state.translations = new Array(state.cues.length).fill(null);

    // 3. Ghép nối bản dịch YouTube tlang dựa trên mốc thời gian (timestamp overlap) thay vì so sánh độ dài
    if (trJson && Array.isArray(trJson.events)) {
      const trCues = parseJson3(trJson, track.kind === 'asr');
      if (trCues.length > 0) {
        state.cues.forEach((cue, i) => {
          const mid = (cue.start + cue.end) / 2;
          const matched = trCues.filter(tc => {
            const overlap = Math.min(cue.end, tc.end) - Math.max(cue.start, tc.start);
            return overlap > 0.05 || (tc.start <= mid && tc.end >= mid);
          });
          if (matched.length > 0) {
            state.translations[i] = matched.map(m => m.text).join(' ').trim();
          } else {
            let closest = null, minDiff = 2.5;
            for (const tc of trCues) {
              const diff = Math.abs(tc.start - cue.start);
              if (diff < minDiff) { minDiff = diff; closest = tc; }
            }
            if (closest && closest.text) {
              state.translations[i] = closest.text.trim();
            }
          }
        });
      }
    }

    state.activeIdx = -1;
    state.lastActiveIdx = -1;
    resetPracticeCard(0);
    renderTranscript();
    renderPractice();
    updateOverlay();
    translateAll();
  }

  async function translateAll() {
    const token = ++state.trToken;
    const lang = state.targetLang;
    const n = state.cues.length;
    if (!n) return;

    const srcBase = (state.track?.languageCode || '').toLowerCase().split('-')[0];
    if (srcBase && srcBase === lang.toLowerCase().split('-')[0]) {
      state.translations = state.cues.map(() => '');
      for (let i = 0; i < n; i++) updateRowTranslation(i);
      setStatus('');
      updateOverlay();
      return;
    }

    // Kiểm tra xem câu nào chưa có bản dịch
    const missingIndices = [];
    for (let i = 0; i < n; i++) {
      if (!state.translations[i]) {
        state.translations[i] = null;
        missingIndices.push(i);
      }
      updateRowTranslation(i);
    }

    if (!missingIndices.length) {
      setStatus('');
      updateOverlay();
      return;
    }

    // Ưu tiên dịch các câu quanh vị trí đang phát của video trước
    const v = getVideo();
    const currentT = v ? v.currentTime : 0;
    missingIndices.sort((a, b) => Math.abs(state.cues[a].start - currentT) - Math.abs(state.cues[b].start - currentT));

    let done = n - missingIndices.length;
    setStatus(`Đang dịch phụ đề… ${Math.round((done / n) * 100)}%`, done / n);

    const BATCH_SIZE = 25;
    for (let i = 0; i < missingIndices.length; i += BATCH_SIZE) {
      const chunk = missingIndices.slice(i, i + BATCH_SIZE);
      let res = null;
      try {
        res = await sendBg({
          action: 'TRANSLATE_BATCH',
          texts: chunk.map(idx => state.cues[idx].text),
          targetLang: lang
        });
      } catch (e) { res = null; }
      if (token !== state.trToken) return;

      if (res && res.success && Array.isArray(res.data)) {
        res.data.forEach((t, k) => {
          const idx = chunk[k];
          if (t) {
            state.translations[idx] = t.trim();
            updateRowTranslation(idx);
          }
        });
      }
      done += chunk.length;
      setStatus(`Đang dịch phụ đề… ${Math.round((done / n) * 100)}%`, done / n);
      updateOverlay();
      if (state.tab !== 'transcript' && state.practice.checked) renderPractice();
    }
    setStatus('');
  }

  function onTrackChange(e) {
    const t = state.tracks[parseInt(e.target.value, 10)];
    if (!t) return;
    state.track = t;
    if (isVietnameseTrack(t) && state.targetLang === 'vi') {
      state.targetLang = 'en';
      if (state.ui.langSel) state.ui.langSel.value = 'en';
    } else if (isEnglishTrack(t) && state.targetLang === 'en') {
      state.targetLang = 'vi';
      if (state.ui.langSel) state.ui.langSel.value = 'vi';
    }
    loadTrack(++state.loadToken);
  }

  async function onLangChange(e) {
    state.targetLang = e.target.value;
    try {
      const r = await sendBg({ action: 'GET_SETTINGS' });
      const settings = { ...(r && r.settings), targetLang: state.targetLang };
      chrome.storage.local.set({ polyglot_settings: settings });
    } catch (err) { }
    translateAll();
  }

  // ================= Main loop =================
  function tick() {
    const v = getVideo();
    if (v && state.cues.length) {
      const t = v.currentTime;
      if (state.stopAt != null && t >= state.stopAt) {
        v.pause();
        state.stopAt = null;
      }
      const idx = findCue(t);
      if (idx !== state.activeIdx) {
        state.activeIdx = idx;
        updateOverlay();
        highlightRow();
      }
    }
    requestAnimationFrame(tick);
  }

  let isEnabled = true;

  function onNavigate() {
    if (!isEnabled) {
      teardownUI();
      return;
    }
    const vid = getVideoIdFromUrl();
    if (!vid) {
      if (state.videoId) { state.videoId = null; teardownUI(); }
      return;
    }
    mountUI();
    if (vid !== state.videoId) {
      state.videoId = vid;
      loadVideo(vid);
    }
  }

  async function init() {
    await loadPrefs();
    try {
      const [s, l] = await Promise.all([sendBg({ action: 'GET_SETTINGS' }), sendBg({ action: 'GET_LANGUAGES' })]);
      if (s && s.settings) {
        if (s.settings.ytEnabled === false) isEnabled = false;
        if (s.settings.targetLang) state.targetLang = s.settings.targetLang;
      }
      if (l && Array.isArray(l.languages)) state.languages = l.languages.filter(x => x.code !== 'auto');
    } catch (e) { }

    try {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.polyglot_settings && changes.polyglot_settings.newValue) {
          const val = changes.polyglot_settings.newValue;
          if (typeof val.ytEnabled === 'boolean') {
            isEnabled = val.ytEnabled;
            if (!isEnabled) {
              teardownUI();
            } else {
              onNavigate();
            }
          }
          if (val.targetLang && val.targetLang !== state.targetLang) {
            state.targetLang = val.targetLang;
            if (state.ui.langSel) state.ui.langSel.value = val.targetLang;
            translateAll();
          }
        }
      });
    } catch (e) { }

    document.addEventListener('yt-navigate-finish', onNavigate);
    // Dự phòng: YouTube render lại DOM hoặc điều hướng mà không bắn event
    setInterval(() => {
      if (isEnabled && getVideoIdFromUrl()) mountUI();
      onNavigate();
    }, 1500);

    onNavigate();
    requestAnimationFrame(tick);
  }

  init();
})();
