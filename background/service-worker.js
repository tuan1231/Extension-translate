importScripts('../shared/languages.js', '../shared/storage.js', '../shared/translator.js');

// Khởi tạo Context Menu
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "polyglot_translate_selection",
    title: "Dịch bằng Polyglot",
    contexts: ["selection"]
  });

  // Tự động tiêm Content Script vào toàn bộ tab đang mở để không cần nhấn F5
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/content.js"]
      }).catch(() => {}); // Bỏ qua các tab bảo mật không thể tiêm

      // Tab YouTube: tiêm thêm tính năng học qua video
      if (tab.url && tab.url.startsWith('https://www.youtube.com/')) {
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/youtube-main.js"], world: "MAIN" }).catch(() => {});
        chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content/youtube.css"] }).catch(() => {});
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/youtube.js"] }).catch(() => {});
      }
    }
  } catch (e) {}
});

// Xử lý khi nhấn Context Menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "polyglot_translate_selection" && info.selectionText) {
    // Gửi message tới content script để xử lý hiển thị giao diện dịch
    chrome.tabs.sendMessage(tab.id, {
      action: "TRANSLATE_SELECTION",
      text: info.selectionText
    }).catch(err => {
      console.warn("Lỗi gửi message (Vui lòng tải lại F5 trang web để content script hoạt động):", err);
    });
  }
});

// Xử lý các yêu cầu từ Content Script hoặc Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "DO_TRANSLATION") {
    (async () => {
      try {
        const settings = await Storage.getSettings();
        const tLang = request.targetLang || settings.targetLang;
        const result = await Translator.translate(request.text, tLang, request.sourceLang || 'auto', settings);
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error("Translation Error in Background:", error);
        sendResponse({ success: false, error: error.message || 'Translation failed' });
      }
    })();
    return true; // Keep the message channel open for async response
  }

  if (request.action === "SAVE_VOCAB") {
    (async () => {
      try {
        await Storage.addHistory(request.item);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === "GET_SETTINGS") {
    (async () => {
      const settings = await Storage.getSettings();
      sendResponse({ settings });
    })();
    return true;
  }

  if (request.action === "GET_LANGUAGES") {
    sendResponse({ languages: typeof LANGUAGES !== 'undefined' ? LANGUAGES : [] });
    return true;
  }

  // Dịch hàng loạt (phụ đề video)
  if (request.action === "TRANSLATE_BATCH") {
    (async () => {
      try {
        const data = await translateBatch(request.texts || [], request.targetLang || 'vi');
        sendResponse({ success: true, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Nhận diện giọng nói từ âm thanh video trực tiếp (Gemini Audio)
  if (request.action === "TRANSCRIBE_AUDIO") {
    (async () => {
      try {
        const settings = await Storage.getSettings();
        if (!settings.geminiApiKey) {
          sendResponse({ success: false, error: 'NO_API_KEY' });
          return;
        }
        const result = await Translator.transcribeAudioGemini(
          request.audioBase64,
          request.mimeType || 'audio/webm',
          request.targetLang || settings.targetLang || 'vi',
          settings.geminiApiKey
        );
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error("Transcribe Audio Error:", error);
        sendResponse({ success: false, error: error.message || 'Transcribe failed' });
      }
    })();
    return true;
  }

  // Kiểm tra kết nối Gemini API và lấy danh sách model động mới nhất
  if (request.action === "TEST_GEMINI_KEY") {
    (async () => {
      try {
        let key = (request.apiKey || '').trim();
        if (!key) {
          const settings = await Storage.getSettings();
          key = settings.geminiApiKey;
        }
        if (!key) {
          sendResponse({ success: false, error: 'Chưa nhập API Key.' });
          return;
        }
        if (Translator._modelsCache) {
          delete Translator._modelsCache[key];
        }
        const models = await Translator.getAvailableGeminiModels(key);
        sendResponse({ success: true, models, activeModel: models[0] });
      } catch (error) {
        sendResponse({ success: false, error: error.message || 'Lỗi kiểm tra API Key' });
      }
    })();
    return true;
  }

  // Kiểm tra kết nối OpenRouter API Key và lấy danh sách model Free
  if (request.action === "TEST_OPENROUTER_KEY") {
    (async () => {
      try {
        let key = (request.apiKey || '').trim();
        if (!key) {
          const settings = await Storage.getSettings();
          key = settings.openrouterApiKey;
        }
        if (!key) {
          sendResponse({ success: false, error: 'Chưa nhập OpenRouter API Key.' });
          return;
        }
        const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (!authRes.ok) {
          let msg = '';
          try {
            const errJ = await authRes.json();
            msg = errJ?.error?.message || (await authRes.text());
          } catch (_) { msg = `Mã lỗi ${authRes.status}`; }
          sendResponse({ success: false, error: `Key không hợp lệ: ${msg}` });
          return;
        }
        const authData = await authRes.json();
        const models = await Translator.getAvailableOpenRouterModels(key);
        sendResponse({ success: true, models, keyInfo: authData.data, activeModel: 'openrouter/free' });
      } catch (error) {
        sendResponse({ success: false, error: error.message || 'Lỗi kiểm tra OpenRouter Key' });
      }
    })();
    return true;
  }

  // --- Text-to-Speech ---
  if (request.action === "TTS_SPEAK") {
    (async () => {
      try {
        const toggledOff = await TTS.speak(request.text, request.lang);
        sendResponse({ success: true, speaking: !toggledOff });
      } catch (error) {
        console.error("TTS Error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === "TTS_STOP") {
    TTS.stop();
    sendResponse({ success: true });
    return true;
  }

  // Offscreen báo Google TTS lỗi -> đọc phần còn lại bằng giọng hệ thống
  if (request.action === "TTS_FALLBACK") {
    TTS.speakWithChromeTTS(request.text, request.lang);
    return false;
  }

  if (request.action === "TTS_ENDED") {
    TTS.state.speaking = false;
    return false;
  }
});

// ================= Batch Translation (phụ đề) =================
// ================= Batch Translation (phụ đề) =================
async function translateBatch(texts, tl) {
  const clean = texts.map(t => String(t || '').replace(/\s*\n\s*/g, ' ').trim());
  const out = new Array(clean.length).fill('');
  const settings = await Storage.getSettings().catch(() => ({}));

  // 1. Nếu dùng engine OpenRouter và có API Key: Dịch theo lô 25 câu/lần
  if (settings.engine === 'openrouter' && settings.openrouterApiKey) {
    const BATCH_SIZE = 25;
    for (let i = 0; i < clean.length; i += BATCH_SIZE) {
      const chunkIndices = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE, clean.length); j++) {
        if (clean[j]) chunkIndices.push(j);
      }
      if (!chunkIndices.length) continue;

      try {
        const subList = chunkIndices.map(idx => clean[idx]);
        const trs = await Translator.translateBatchOpenRouter(subList, tl, settings.openrouterApiKey, settings.openrouterModel);
        if (Array.isArray(trs) && trs.length === chunkIndices.length) {
          chunkIndices.forEach((idx, k) => {
            out[idx] = (trs[k] || '').trim();
          });
        }
      } catch (orErr) {
        console.warn('OpenRouter batch translation error, will fallback:', orErr);
      }
    }

    const allDone = chunkIndicesAllDone(clean, out);
    if (allDone) return out;
  }

  // 2. Nếu dùng engine Gemini và có API Key: Dịch theo lô 25 câu/lần cực nhanh
  if (settings.engine === 'gemini' && settings.geminiApiKey) {
    const BATCH_SIZE = 25;
    for (let i = 0; i < clean.length; i += BATCH_SIZE) {
      const chunkIndices = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE, clean.length); j++) {
        if (clean[j] && !out[j]) chunkIndices.push(j);
      }
      if (!chunkIndices.length) continue;

      try {
        const subList = chunkIndices.map(idx => clean[idx]);
        const trs = await Translator.translateBatchGemini(subList, tl, settings.geminiApiKey);
        if (Array.isArray(trs) && trs.length === chunkIndices.length) {
          chunkIndices.forEach((idx, k) => {
            out[idx] = (trs[k] || '').trim();
          });
        }
      } catch (gemErr) {
        console.warn('Gemini batch translation error, will fallback to Google:', gemErr);
      }
    }

    // Nếu toàn bộ câu đã có bản dịch thì trả về ngay
    const allDone = chunkIndicesAllDone(clean, out);
    if (allDone) return out;
  }

  // 2. Google Translate Batch: Dùng dấu phân cách đặc biệt không bị gộp câu
  const DELIM = ' ⬢ ';
  const BATCH_SIZE = 15;
  for (let i = 0; i < clean.length; i += BATCH_SIZE) {
    const chunkIndices = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, clean.length); j++) {
      if (clean[j] && !out[j]) chunkIndices.push(j);
    }
    if (!chunkIndices.length) continue;

    try {
      const combined = chunkIndices.map(idx => clean[idx]).join(DELIM);
      const res = await Translator._translateGoogle(combined, tl, 'auto');
      const trText = res?.translatedText || '';
      const parts = trText.split(/\s*⬢\s*/);
      if (parts.length === chunkIndices.length) {
        chunkIndices.forEach((idx, k) => {
          out[idx] = (parts[k] || '').trim();
        });
        continue;
      }
    } catch (e) { }

    // Fallback song song tối đa 5 luồng cho các câu chưa dịch
    let p = 0;
    const worker = async () => {
      while (p < chunkIndices.length) {
        const idx = chunkIndices[p++];
        if (out[idx]) continue;
        try {
          const res = await Translator._translateGoogle(clean[idx], tl, 'auto');
          out[idx] = (res?.translatedText || '').trim();
        } catch (err) {
          out[idx] = '';
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, chunkIndices.length) }, worker));
  }

  return out;
}

function chunkIndicesAllDone(clean, out) {
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] && !out[i]) return false;
  }
  return true;
}

// ================= TTS Controller =================
const TTS = {
  state: { speaking: false, text: '', lang: '' },
  creatingOffscreen: null,

  // Chuẩn hoá mã ngôn ngữ cho Google TTS
  normalizeLang(lang) {
    if (!lang || lang === 'auto') return 'en';
    const map = { jw: 'jv' };
    return map[lang] || lang;
  },

  async ensureOffscreen() {
    const path = 'offscreen/offscreen.html';
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(path)]
      });
      if (contexts.length > 0) return;
    }
    if (!this.creatingOffscreen) {
      this.creatingOffscreen = chrome.offscreen.createDocument({
        url: path,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Phát giọng đọc bản dịch'
      }).catch(err => {
        if (!String(err && err.message).includes('single offscreen')) throw err;
      }).finally(() => { this.creatingOffscreen = null; });
    }
    await this.creatingOffscreen;
  },

  // Trả về true nếu lần bấm này là để TẮT (bấm lại cùng đoạn đang đọc)
  async speak(text, lang) {
    if (!text || !text.trim()) return true;
    const normLang = this.normalizeLang(lang);

    if (this.state.speaking && this.state.text === text && this.state.lang === normLang) {
      this.stop();
      return true;
    }

    this.stop();
    this.state = { speaking: true, text, lang: normLang };

    try {
      await this.ensureOffscreen();
      await chrome.runtime.sendMessage({ target: 'offscreen', action: 'PLAY', text, lang: normLang });
    } catch (e) {
      // Không tạo được offscreen -> dùng giọng hệ thống
      this.speakWithChromeTTS(text, normLang);
    }
    return false;
  },

  stop() {
    this.state.speaking = false;
    chrome.tts.stop();
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'STOP' }).catch(() => {});
  },

  // Fallback: chọn giọng hệ thống tốt nhất (ưu tiên giọng Natural/Online/Google)
  async speakWithChromeTTS(text, lang) {
    const ttsLang = ({ iw: 'he', jw: 'jv', jv: 'jv', tl: 'fil' })[lang] || lang;
    const base = ttsLang.toLowerCase().split('-')[0];
    const voices = await chrome.tts.getVoices();

    const scored = voices
      .filter(v => v.lang && v.lang.toLowerCase().split('-')[0] === base)
      .map(v => {
        const name = (v.voiceName || '').toLowerCase();
        let score = 0;
        if (name.includes('natural')) score += 5;
        if (name.includes('online')) score += 3;
        if (name.includes('google')) score += 3;
        if (v.remote) score += 2;
        if (v.lang.toLowerCase() === ttsLang.toLowerCase()) score += 1;
        return { v, score };
      })
      .sort((a, b) => b.score - a.score);

    const options = { lang: ttsLang, rate: 1.0, pitch: 1.0 };
    if (scored.length) options.voiceName = scored[0].v.voiceName;
    options.onEvent = (e) => {
      if (['end', 'interrupted', 'cancelled', 'error'].includes(e.type)) this.state.speaking = false;
    };
    chrome.tts.speak(text, options);
  }
};
