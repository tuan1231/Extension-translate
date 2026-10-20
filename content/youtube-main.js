// Polyglot – YouTube helper chạy trong MAIN world (cùng ngữ cảnh JS với trang YouTube)
// Nhiệm vụ: đọc danh sách phụ đề của player và tải phụ đề (json3).
// YouTube yêu cầu token "pot" cho API timedtext, nên script này "nghe lén" request
// phụ đề của chính player để lấy token, rồi dùng lại token đó.
(() => {
  if (window.__polyglotYTMain) return;
  window.__polyglotYTMain = true;

  const MAIN_SRC = 'polyglot-yt-main';
  const ISO_SRC = 'polyglot-yt-iso';
  const captured = []; // Các URL timedtext mà player đã gọi

  const originalFetch = window.fetch.bind(window);

  function recordUrl(raw) {
    try {
      if (!raw) return;
      const u = new URL(String(raw), location.href);
      if (!u.pathname.includes('/api/timedtext')) return;
      captured.push(u);
      if (captured.length > 30) captured.shift();
    } catch (e) { /* bỏ qua */ }
  }

  // Hook XHR + fetch để bắt URL phụ đề của player
  const xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    recordUrl(url);
    return xhrOpen.apply(this, arguments);
  };
  window.fetch = function (input, init) {
    try { recordUrl(typeof input === 'string' ? input : (input && input.url)); } catch (e) { }
    return originalFetch(input, init);
  };

  const getPlayer = () => document.getElementById('movie_player');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function getPlayerResponse() {
    const p = getPlayer();
    try {
      const r = p && typeof p.getPlayerResponse === 'function' ? p.getPlayerResponse() : null;
      if (r && r.videoDetails) return r;
    } catch (e) { }
    try {
      const flexy = document.querySelector('ytd-watch-flexy');
      if (flexy && flexy.playerData && flexy.playerData.videoDetails) return flexy.playerData;
    } catch (e) { }
    return window.ytInitialPlayerResponse || null;
  }

  function trackName(t) {
    if (!t || !t.name) return t.languageCode;
    if (t.name.simpleText) return t.name.simpleText;
    if (Array.isArray(t.name.runs)) return t.name.runs.map(r => r.text).join('');
    return t.languageCode;
  }

  function getTracks() {
    const resp = getPlayerResponse();
    const p = getPlayer();
    let videoId = resp?.videoDetails?.videoId;
    if (!videoId && p && typeof p.getVideoData === 'function') {
      videoId = p.getVideoData()?.video_id;
    }
    const list = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return {
      videoId: videoId || null,
      title: resp?.videoDetails?.title || (p && typeof p.getVideoData === 'function' ? p.getVideoData()?.title : '') || '',
      tracks: list.map(t => ({
        baseUrl: t.baseUrl,
        languageCode: t.languageCode,
        kind: t.kind || '',
        name: trackName(t),
        vssId: t.vssId || ''
      }))
    };
  }

  async function tryFetchJson3(url, tlang = null) {
    try {
      const u = new URL(url, location.href);
      u.searchParams.set('fmt', 'json3');
      if (tlang) {
        u.searchParams.set('tlang', tlang);
      } else {
        u.searchParams.delete('tlang');
      }
      const res = await originalFetch(u.href, { credentials: 'include' });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text || !text.trim()) return null;

      // 1. Thử parse JSON3
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json.events)) return json;
      } catch (e) { }

      // 2. Thử parse XML dự phòng (nếu YouTube trả XML dạng <transcript><text start=... dur=...>)
      try {
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        const textNodes = doc.querySelectorAll('text');
        if (textNodes.length > 0) {
          const events = [];
          textNodes.forEach(node => {
            const start = parseFloat(node.getAttribute('start') || '0');
            const dur = parseFloat(node.getAttribute('dur') || '2');
            const utf8 = node.textContent || '';
            events.push({
              tStartMs: Math.round(start * 1000),
              dDurationMs: Math.round(dur * 1000),
              segs: [{ utf8 }]
            });
          });
          return { events };
        }
      } catch (e) { }

      return null;
    } catch (e) {
      return null;
    }
  }

  function findCaptured(videoId) {
    for (let i = captured.length - 1; i >= 0; i--) {
      const u = captured[i];
      if (u.searchParams.get('v') === videoId && u.searchParams.get('pot')) return u;
    }
    for (let i = captured.length - 1; i >= 0; i--) {
      if (captured[i].searchParams.get('v') === videoId) return captured[i];
    }
    return null;
  }

  // Bật CC tạm thời để player tự gọi API phụ đề (kèm token pot)
  async function triggerPlayerCaptions(videoId, languageCode) {
    const p = getPlayer();
    const btn = document.querySelector('.ytp-subtitles-button');
    const wasOn = btn && btn.getAttribute('aria-pressed') === 'true';
    try {
      if (p && p.loadModule) p.loadModule('captions');
      if (p && p.setOption) p.setOption('captions', 'track', { languageCode });
    } catch (e) { }
    if (btn && !wasOn) btn.click();

    let found = null;
    for (let i = 0; i < 30 && !found; i++) {
      await sleep(200);
      found = findCaptured(videoId);
    }
    // Trả lại trạng thái CC như cũ
    if (btn && !wasOn && btn.getAttribute('aria-pressed') === 'true') btn.click();
    return found;
  }

  const POT_PARAMS = ['pot', 'potc', 'c', 'cver', 'cplayer', 'cbr', 'cbrver', 'cos', 'cosver', 'cplatform', 'xorb', 'xobt', 'xovt'];

  async function fetchCaptions({ videoId, baseUrl, languageCode, tlang }) {
    // 1. Thử trực tiếp (một số video không cần pot)
    let data = await tryFetchJson3(baseUrl, tlang);
    if (data && data.events && data.events.length) return data;

    // 2. Lấy token pot từ request của player
    let cap = findCaptured(videoId);
    if (!cap) cap = await triggerPlayerCaptions(videoId, languageCode);
    if (!cap) return null;

    const u = new URL(baseUrl, location.href);
    POT_PARAMS.forEach(k => {
      const v = cap.searchParams.get(k);
      if (v != null) u.searchParams.set(k, v);
    });
    data = await tryFetchJson3(u.href, tlang);
    if (data && data.events && data.events.length) return data;

    // 3. Dùng chính URL player đã gọi, đổi ngôn ngữ theo track được chọn
    const alt = new URL(cap.href);
    alt.searchParams.set('lang', languageCode);
    const kind = new URL(baseUrl, location.href).searchParams.get('kind');
    if (kind) alt.searchParams.set('kind', kind); else alt.searchParams.delete('kind');
    data = await tryFetchJson3(alt.href, tlang);
    if (data && data.events && data.events.length) return data;

    // 4. Cuối cùng: đúng URL player đã gọi
    return await tryFetchJson3(cap.href, tlang);
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.source !== ISO_SRC) return;
    const { id, type, payload } = e.data;
    const reply = (data, error) => window.postMessage({ source: MAIN_SRC, type: 'RESPONSE', id, data, error }, '*');
    try {
      if (type === 'GET_TRACKS') return reply(getTracks());
      if (type === 'FETCH_CAPTIONS') return reply(await fetchCaptions(payload));
      reply(null, 'Unknown request');
    } catch (err) {
      reply(null, err && err.message ? err.message : String(err));
    }
  });
})();
