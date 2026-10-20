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
  const playerResponseCache = new Map(); // videoId -> playerResponse

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

  // Hook XHR + fetch để bắt URL phụ đề của player và phản hồi player API
  const xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    recordUrl(url);
    if (typeof url === 'string' && url.includes('/youtubei/v1/player')) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          const vId = data?.videoDetails?.videoId;
          if (vId && data?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            playerResponseCache.set(vId, data);
          }
        } catch (e) { }
      });
    }
    return xhrOpen.apply(this, arguments);
  };

  window.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
    recordUrl(urlStr);
    const res = await originalFetch(input, init);
    if (urlStr.includes('/youtubei/v1/player')) {
      try {
        const clone = res.clone();
        clone.json().then(data => {
          const vId = data?.videoDetails?.videoId;
          if (vId && data?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            playerResponseCache.set(vId, data);
          }
        }).catch(() => { });
      } catch (e) { }
    }
    return res;
  };

  const getPlayer = () => document.getElementById('movie_player');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function getPlayerResponse(targetVideoId = null) {
    if (targetVideoId && playerResponseCache.has(targetVideoId)) {
      return playerResponseCache.get(targetVideoId);
    }
    const p = getPlayer();
    try {
      const r = p && typeof p.getPlayerResponse === 'function' ? p.getPlayerResponse() : null;
      if (r && r.videoDetails && (!targetVideoId || r.videoDetails.videoId === targetVideoId)) {
        return r;
      }
    } catch (e) { }
    try {
      const flexy = document.querySelector('ytd-watch-flexy, ytd-watch-grid, ytd-app');
      if (flexy && flexy.playerData && flexy.playerData.videoDetails && (!targetVideoId || flexy.playerData.videoDetails.videoId === targetVideoId)) {
        return flexy.playerData;
      }
    } catch (e) { }
    if (!targetVideoId || window.ytInitialPlayerResponse?.videoDetails?.videoId === targetVideoId) {
      return window.ytInitialPlayerResponse || null;
    }
    return null;
  }

  async function fetchInnertubePlayer(targetVideoId) {
    if (!targetVideoId) return null;
    try {
      const cfg = window.ytcfg;
      const key = cfg && typeof cfg.get === 'function' ? cfg.get('INNERTUBE_API_KEY') : '';
      const ctx = (cfg && typeof cfg.get === 'function' && cfg.get('INNERTUBE_CONTEXT')) || {
        client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'vi', gl: 'VN' }
      };
      const url = '/youtubei/v1/player' + (key ? `?key=${key}&prettyPrint=false` : '?prettyPrint=false');
      const res = await originalFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: ctx, videoId: targetVideoId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.videoDetails?.videoId === targetVideoId) {
          playerResponseCache.set(targetVideoId, data);
          return data;
        }
      }
    } catch (e) { }
    return null;
  }

  function trackName(t) {
    if (!t || !t.name) return t.languageCode;
    if (t.name.simpleText) return t.name.simpleText;
    if (Array.isArray(t.name.runs)) return t.name.runs.map(r => r.text).join('');
    return t.languageCode;
  }

  function urlParam(url, key) {
    try { return new URL(url, location.href).searchParams.get(key) || ''; } catch (e) { return ''; }
  }

  function pruneOldCaptured(currentVideoId) {
    if (!currentVideoId) return;
    for (let i = captured.length - 1; i >= 0; i--) {
      const v = captured[i].searchParams.get('v');
      if (v && v !== currentVideoId) {
        captured.splice(i, 1);
      }
    }
  }

  async function getTracks(targetVideoId = null) {
    if (targetVideoId) pruneOldCaptured(targetVideoId);

    let resp = getPlayerResponse(targetVideoId);
    if ((!resp || !resp.captions) && targetVideoId) {
      resp = await fetchInnertubePlayer(targetVideoId);
    }
    const p = getPlayer();
    let videoId = resp?.videoDetails?.videoId;
    if (!videoId && p && typeof p.getVideoData === 'function') {
      videoId = p.getVideoData()?.video_id;
    }
    if (!videoId && targetVideoId) videoId = targetVideoId;

    let list = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    // Dự phòng: Lấy từ player option tracklist nếu có
    if (!list.length && p) {
      try {
        const pTracks = (typeof p.getOption === 'function' ? p.getOption('captions', 'tracklist') : null)
          || (typeof p.getCaptionTracks === 'function' ? p.getCaptionTracks() : null);
        if (Array.isArray(pTracks) && pTracks.length) {
          list = pTracks;
        }
      } catch (e) { }
    }

    // Ngôn ngữ nói gốc của video:
    // 1) Track ASR (tự động) KHÔNG phải bản dịch máy (variant=gemini) = ngôn ngữ giọng nói thật
    const origAsr = list.find(t => t.kind === 'asr' && urlParam(t.baseUrl || '', 'variant') !== 'gemini');
    // 2) Audio track mặc định (video nhiều luồng âm thanh)
    let audioLang = '';
    try {
      const fmts = resp?.streamingData?.adaptiveFormats || [];
      const def = fmts.find(f => f.audioTrack && f.audioTrack.audioIsDefault);
      if (def && def.audioTrack.id) audioLang = String(def.audioTrack.id).split('.')[0];
    } catch (e) { }

    return {
      videoId: videoId || null,
      title: resp?.videoDetails?.title || (p && typeof p.getVideoData === 'function' ? p.getVideoData()?.title : '') || '',
      originalLang: origAsr ? origAsr.languageCode : '',
      audioLang,
      tracks: list.map(t => ({
        baseUrl: t.baseUrl || t.url || '',
        languageCode: t.languageCode || t.vssId?.replace(/^\.?a\./, '').split('.')[0] || '',
        kind: t.kind || (t.vssId && t.vssId.startsWith('a.') ? 'asr' : ''),
        name: trackName(t) || t.displayName || t.languageName || t.languageCode,
        vssId: t.vssId || '',
        variant: urlParam(t.baseUrl || t.url || '', 'variant')
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
      let res = await originalFetch(u.href, { credentials: 'include' }).catch(() => null);
      let text = res && res.ok ? await res.text().catch(() => '') : '';

      // Nếu json3 rỗng (status 200 nhưng 0 bytes), thử tải nguyên bản (XML transcript)
      if (!text || !text.trim()) {
        u.searchParams.delete('fmt');
        res = await originalFetch(u.href, { credentials: 'include' }).catch(() => null);
        text = res && res.ok ? await res.text().catch(() => '') : '';
      }

      // Nếu vẫn rỗng, thử fmt=srv3
      if (!text || !text.trim()) {
        u.searchParams.set('fmt', 'srv3');
        res = await originalFetch(u.href, { credentials: 'include' }).catch(() => null);
        text = res && res.ok ? await res.text().catch(() => '') : '';
      }

      if (!text || !text.trim()) return null;

      // 1. Thử parse JSON3
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json.events) && json.events.length) return json;
      } catch (e) { }

      // 2. Thử parse XML dự phòng (dạng <transcript><text start=... dur=...>...</text></transcript>)
      try {
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        const textNodes = doc.querySelectorAll('text');
        if (textNodes.length > 0) {
          const events = [];
          textNodes.forEach(node => {
            const start = parseFloat(node.getAttribute('start') || '0');
            const dur = parseFloat(node.getAttribute('dur') || '2');
            const utf8 = (node.textContent || '')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/\n/g, ' ')
              .trim();
            if (utf8) {
              events.push({
                tStartMs: Math.round(start * 1000),
                dDurationMs: Math.round(dur * 1000),
                segs: [{ utf8 }]
              });
            }
          });
          if (events.length > 0) return { events };
        }
      } catch (e) { }

      return null;
    } catch (e) {
      return null;
    }
  }

  // CHỈ trả về URL phụ đề mà player đã gọi CHO ĐÚNG video hiện tại.
  function findCaptured(videoId, languageCode = null) {
    if (!videoId) return null;
    const want = (languageCode || '').toLowerCase().split('-')[0];
    const same = captured.filter(u => u.searchParams.get('v') === videoId);
    if (!same.length) return null;

    for (let i = same.length - 1; i >= 0; i--) {
      const u = same[i];
      const l = (u.searchParams.get('lang') || '').toLowerCase().split('-')[0];
      if (want && l === want && !u.searchParams.get('tlang') && u.searchParams.get('pot')) return u;
    }
    for (let i = same.length - 1; i >= 0; i--) {
      if (same[i].searchParams.get('pot')) return same[i];
    }
    return same[same.length - 1];
  }

  // Bật CC tạm thời để player tự gọi API phụ đề (kèm token pot)
  async function triggerPlayerCaptions(videoId, languageCode) {
    const p = getPlayer();
    const btn = document.querySelector('.ytp-subtitles-button');
    const wasOn = btn && btn.getAttribute('aria-pressed') === 'true';
    try {
      if (p && p.loadModule) p.loadModule('captions');
      if (p && p.setOption) p.setOption('captions', 'track', { languageCode });
      if (p && p.setOption) p.setOption('captions', 'reload', true);
    } catch (e) { }

    if (btn) {
      if (wasOn) {
        btn.click();
        await sleep(150);
        btn.click();
      } else {
        btn.click();
      }
    }

    let found = null;
    for (let i = 0; i < 35 && !found; i++) {
      await sleep(150);
      found = findCaptured(videoId, languageCode);
    }
    // Trả lại trạng thái CC như cũ nếu trước đó chưa bật
    if (btn && !wasOn && btn.getAttribute('aria-pressed') === 'true') btn.click();
    return found;
  }

  const POT_PARAMS = ['pot', 'potc', 'c', 'cver', 'cplayer', 'cbr', 'cbrver', 'cos', 'cosver', 'cplatform', 'xorb', 'xobt', 'xovt'];

  async function fetchCaptions({ videoId, baseUrl, languageCode, tlang }) {
    const ok = (d) => d && Array.isArray(d.events) && d.events.length > 0;
    const base = new URL(baseUrl, location.href);
    // Không bao giờ tải phụ đề của video khác
    if (videoId && base.searchParams.get('v') && base.searchParams.get('v') !== videoId) return null;

    // 1. Thử trực tiếp baseUrl của track được chọn
    let data = await tryFetchJson3(baseUrl, tlang);
    if (ok(data)) return data;

    // 2. Lấy token pot từ request của player (chỉ của đúng video này)
    let cap = findCaptured(videoId, languageCode);
    if (!cap) cap = await triggerPlayerCaptions(videoId, languageCode);
    if (!cap) return null;

    // 2a. Ghép POT token vào baseUrl của track được chọn
    const u = new URL(base.href);
    POT_PARAMS.forEach(k => {
      const v = cap.searchParams.get(k);
      if (v != null) u.searchParams.set(k, v);
    });
    data = await tryFetchJson3(u.href, tlang);
    if (ok(data)) return data;

    // 2b. Dùng URL player đã gọi nhưng ép đúng lang/kind/variant của track được chọn
    const alt = new URL(cap.href);
    alt.searchParams.set('lang', languageCode);
    ['kind', 'variant', 'name'].forEach(k => {
      const v = base.searchParams.get(k);
      if (v) alt.searchParams.set(k, v); else alt.searchParams.delete(k);
    });
    data = await tryFetchJson3(alt.href, tlang);
    if (ok(data)) return data;

    // 2c. Nếu track ngôn ngữ này không tải được: nhờ YouTube dịch track của player sang đúng ngôn ngữ đó
    if (!tlang && languageCode) {
      const capLang = (cap.searchParams.get('lang') || '').toLowerCase().split('-')[0];
      const want = languageCode.toLowerCase().split('-')[0];
      if (capLang && capLang !== want) {
        data = await tryFetchJson3(cap.href, languageCode);
        if (ok(data)) return data;
      }
    }

    return null;
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.source !== ISO_SRC) return;
    const { id, type, payload } = e.data;
    const reply = (data, error) => window.postMessage({ source: MAIN_SRC, type: 'RESPONSE', id, data, error }, '*');
    try {
      if (type === 'GET_TRACKS') return reply(await getTracks(payload?.videoId));
      if (type === 'FETCH_CAPTIONS') return reply(await fetchCaptions(payload));
      reply(null, 'Unknown request');
    } catch (err) {
      reply(null, err && err.message ? err.message : String(err));
    }
  });
})();
