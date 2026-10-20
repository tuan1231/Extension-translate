// Trình phát TTS chạy trong Offscreen Document (không bị CSP của trang web chặn)

const MAX_CHUNK = 180;
let session = 0;          // Tăng mỗi lần speak/stop để huỷ phiên cũ
let currentAudio = null;
let currentObjectUrl = null;

// Chia văn bản thành các đoạn <= MAX_CHUNK ký tự, ưu tiên cắt theo câu / dấu phẩy / khoảng trắng
function splitText(text, maxLen = MAX_CHUNK) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?。！？;；]+[.!?。！？;；]*\s*/g) || [clean];

  const pieces = [];
  for (let s of sentences) {
    s = s.trim();
    while (s.length > maxLen) {
      const head = s.slice(0, maxLen);
      let cut = Math.max(head.lastIndexOf(','), head.lastIndexOf('，'), head.lastIndexOf('、'), head.lastIndexOf(':'));
      if (cut < maxLen * 0.4) cut = head.lastIndexOf(' ');
      if (cut < maxLen * 0.4) cut = maxLen - 1; // Ngôn ngữ không có khoảng trắng (CJK, Thái...)
      pieces.push(s.slice(0, cut + 1).trim());
      s = s.slice(cut + 1).trim();
    }
    if (s) pieces.push(s);
  }

  // Gộp các câu ngắn liền nhau để giọng đọc liền mạch hơn
  const merged = [];
  for (const p of pieces) {
    const last = merged[merged.length - 1];
    if (last && (last.length + 1 + p.length) <= maxLen) {
      merged[merged.length - 1] = `${last} ${p}`;
    } else {
      merged.push(p);
    }
  }
  return merged;
}

function buildUrls(chunk, lang) {
  const q = encodeURIComponent(chunk);
  return [
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${q}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${lang}&q=${q}`
  ];
}

async function fetchAudioBlob(chunk, lang) {
  for (const url of buildUrls(chunk, lang)) {
    try {
      const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size > 0 && (blob.type.includes('audio') || blob.type === '')) return blob;
    } catch (e) { /* thử URL tiếp theo */ }
  }
  throw new Error('Google TTS không khả dụng');
}

function playBlob(blob, mySession) {
  return new Promise((resolve, reject) => {
    if (mySession !== session) return resolve();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentObjectUrl = url;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) { currentAudio = null; currentObjectUrl = null; }
    };
    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = () => { cleanup(); reject(new Error('Audio playback error')); };
    audio.onpause = () => { if (mySession !== session) { cleanup(); resolve(); } };
    audio.play().catch(err => { cleanup(); reject(err); });
  });
}

function stopAll() {
  session++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

async function speak(text, lang) {
  stopAll();
  const mySession = session;
  const chunks = splitText(text);
  if (!chunks.length) return;

  // Tải trước đoạn tiếp theo trong khi đang phát đoạn hiện tại để không bị ngắt quãng
  let nextFetch = fetchAudioBlob(chunks[0], lang);
  for (let i = 0; i < chunks.length; i++) {
    if (mySession !== session) return;
    try {
      const blob = await nextFetch;
      nextFetch = (i + 1 < chunks.length) ? fetchAudioBlob(chunks[i + 1], lang) : null;
      if (nextFetch) nextFetch.catch(() => {}); // tránh unhandled rejection
      await playBlob(blob, mySession);
    } catch (e) {
      if (mySession !== session) return;
      // Chuyển phần còn lại sang giọng hệ thống (chrome.tts) ở service worker
      chrome.runtime.sendMessage({
        action: 'TTS_FALLBACK',
        text: chunks.slice(i).join(' '),
        lang
      }).catch(() => {});
      return;
    }
  }
  if (mySession === session) {
    chrome.runtime.sendMessage({ action: 'TTS_ENDED' }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.action === 'PLAY') speak(msg.text, msg.lang);
  if (msg.action === 'STOP') stopAll();
  sendResponse({ ok: true });
});
