// Polyglot Translator - Content Script

let shadowContainer = null;
let shadowRoot = null;
let currentSelection = '';
let currentRect = null;

// Khởi tạo Shadow DOM container để chống xung đột CSS với trang web
function initShadowDOM() {
  if (shadowContainer) return;
  shadowContainer = document.createElement('div');
  shadowContainer.id = 'polyglot-translator-host';
  // Đặt container ở mức cao nhất
  shadowContainer.style.position = 'absolute';
  shadowContainer.style.top = '0';
  shadowContainer.style.left = '0';
  shadowContainer.style.zIndex = '2147483647';
  document.body.appendChild(shadowContainer);

  shadowRoot = shadowContainer.attachShadow({ mode: 'open' });

  // Nhúng CSS vào Shadow DOM
  const styleUrl = chrome.runtime.getURL('content/content.css');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = styleUrl;
  shadowRoot.appendChild(link);
}

// Hàm dọn dẹp UI
function clearUI() {
  if (shadowRoot) {
    const bubble = shadowRoot.querySelector('.polyglot-bubble');
    const dialog = shadowRoot.querySelector('.polyglot-dialog');
    if (bubble) bubble.remove();
    if (dialog) dialog.remove();
  }
}

// Xử lý bắt sự kiện bôi đen
document.addEventListener('mouseup', async (e) => {
  // Bỏ qua nếu click vào bên trong shadow DOM
  if (e.composedPath().includes(shadowContainer)) return;

  // Lấy cài đặt xem có cho phép hiện icon nổi không
  let response;
  try {
    response = await new Promise((res, rej) => {
      chrome.runtime.sendMessage({ action: "GET_SETTINGS" }, (r) => {
        if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
        else res(r);
      });
    });
  } catch (err) {
    console.warn("Polyglot: Vui lòng nhấn F5 (Tải lại trang) để Extension hoạt động bình thường.", err);
    return;
  }
  
  const settings = response?.settings || { showFloatingIcon: true };
  if (!settings.showFloatingIcon) return;

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 0) {
      currentSelection = text;
      const range = selection.getRangeAt(0);
      currentRect = range.getBoundingClientRect();
      
      showBubble(currentRect, text);
    } else {
      // Ẩn icon nếu không có bôi đen, nhưng giữ dialog nếu đang mở
      if (shadowRoot && !shadowRoot.querySelector('.polyglot-dialog')) {
        clearUI();
      }
    }
  }, 10);
});

// Xử lý nhấp chuột ngoài để ẩn
document.addEventListener('mousedown', (e) => {
  if (shadowContainer && e.composedPath().includes(shadowContainer)) return;
  const selection = window.getSelection();
  if (selection.toString().trim() === '') {
    clearUI();
  }
});

// Lắng nghe message từ Background (Context Menu)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TRANSLATE_SELECTION") {
    currentSelection = request.text;
    // Lấy tọa độ tương đối giữa màn hình để hiển thị
    currentRect = {
      bottom: window.innerHeight / 2,
      left: window.innerWidth / 2,
      width: 0
    };
    showDialog(currentSelection, currentRect);
  }
});

// Hiển thị Icon nổi
function showBubble(rect, text) {
  initShadowDOM();
  clearUI();

  const bubble = document.createElement('div');
  bubble.className = 'polyglot-bubble';
  bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
  
  // Tính toán vị trí (ngay dưới đoạn bôi đen)
  const top = window.scrollY + rect.bottom + 10;
  const left = window.scrollX + rect.left + (rect.width / 2) - 16;
  
  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;

  bubble.addEventListener('click', () => {
    showDialog(text, rect);
    bubble.remove();
  });

  shadowRoot.appendChild(bubble);
}

// Hiển thị Dialog dịch
async function showDialog(text, rect) {
  initShadowDOM();
  clearUI();

  // Lấy danh sách ngôn ngữ và settings từ background
  let languages = [];
  let currentTargetLang = 'vi';
  
  try {
    const [langRes, setRes] = await Promise.all([
      new Promise((res, rej) => chrome.runtime.sendMessage({ action: "GET_LANGUAGES" }, r => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r))),
      new Promise((res, rej) => chrome.runtime.sendMessage({ action: "GET_SETTINGS" }, r => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r)))
    ]);
    if (langRes?.languages) languages = langRes.languages;
    if (setRes?.settings?.targetLang) currentTargetLang = setRes.settings.targetLang;
  } catch (err) {
    console.warn("Polyglot: Cannot fetch settings.", err);
  }

  const dialog = document.createElement('div');
  dialog.className = 'polyglot-dialog';
  
  // Vị trí
  const top = window.scrollY + rect.bottom + 10;
  const left = window.scrollX + Math.max(0, rect.left + (rect.width / 2) - 170);
  
  dialog.style.top = `${top}px`;
  dialog.style.left = `${left}px`;

  // Tạo thẻ Select Ngôn ngữ
  const optionsHtml = languages
    .filter(l => l.code !== 'auto')
    .map(l => `<option value="${l.code}" ${l.code === currentTargetLang ? 'selected' : ''}>${l.name}</option>`)
    .join('');

  dialog.innerHTML = `
    <div class="polyglot-header">
      <div class="polyglot-title" style="display: flex; align-items: center; gap: 6px;">
        <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
        <span id="polyglot-lang-info">Auto</span>
        <span style="color: #94a3b8;">→</span>
        <select id="polyglot-inline-target-lang" class="polyglot-inline-select" style="background: transparent; border: 1px solid rgba(148,163,184,0.4); border-radius: 4px; color: inherit; font-size: 13px; font-weight: 600; padding: 2px 4px; outline: none; cursor: pointer; font-family: inherit;">
          ${optionsHtml}
        </select>
      </div>
      <button class="polyglot-close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="polyglot-body">
      <div class="polyglot-section">
        <div class="polyglot-label">Bản gốc</div>
        <div class="polyglot-text-box polyglot-source-text">${escapeHtml(text)}</div>
      </div>
      <div class="polyglot-section">
        <div class="polyglot-label">Bản dịch</div>
        <div id="polyglot-target-container" class="polyglot-text-box polyglot-target-text">
          <div class="polyglot-loader"></div>
        </div>
      </div>
    </div>
    <div class="polyglot-toolbar">
      <button id="polyglot-btn-copy" class="polyglot-btn">
        <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        Copy
      </button>
      <button id="polyglot-btn-speak" class="polyglot-btn">
        <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        Đọc
      </button>
      <button id="polyglot-btn-save" class="polyglot-btn primary" style="margin-left: auto;">
        <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>
        Lưu từ
      </button>
    </div>
  `;

  shadowRoot.appendChild(dialog);

  // Kéo thả Dialog (Draggable)
  makeDraggable(dialog, dialog.querySelector('.polyglot-header'));

  // Đóng dialog
  dialog.querySelector('.polyglot-close').addEventListener('click', () => {
    dialog.remove();
  });

  const targetContainer = dialog.querySelector('#polyglot-target-container');
  const langInfo = dialog.querySelector('#polyglot-lang-info');
  const inlineSelect = dialog.querySelector('#polyglot-inline-target-lang');
  let currentTranslatedText = '';
  let currentSourceLang = 'auto';

  const execTranslation = () => {
    targetContainer.innerHTML = '<div class="polyglot-loader"></div>';
    
    try {
      chrome.runtime.sendMessage({ 
        action: "DO_TRANSLATION", 
        text: text,
        targetLang: currentTargetLang
      }, (response) => {
        if (chrome.runtime.lastError) {
          targetContainer.innerHTML = `<span class="polyglot-error">Lỗi kết nối. Vui lòng tải lại (F5) trang web.</span>`;
          return;
        }

        if (response && response.success) {
          currentTranslatedText = response.data.translatedText;
          currentSourceLang = response.data.sourceLang;
          
          targetContainer.innerHTML = escapeHtml(currentTranslatedText);
          langInfo.textContent = currentSourceLang === 'auto' ? 'Auto' : currentSourceLang.toUpperCase();
        } else {
          targetContainer.innerHTML = `<span class="polyglot-error">Lỗi: ${response ? response.error : 'Không rõ'}</span>`;
          langInfo.textContent = "Lỗi";
        }
      });
    } catch (err) {
      targetContainer.innerHTML = `<span class="polyglot-error">Lỗi kết nối. Vui lòng tải lại (F5) trang web.</span>`;
    }
  };

  // Nút Copy
  dialog.querySelector('#polyglot-btn-copy').addEventListener('click', () => {
    if (!currentTranslatedText) return;
    navigator.clipboard.writeText(currentTranslatedText);
    const btn = dialog.querySelector('#polyglot-btn-copy');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copied!`;
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy`;
    }, 2000);
  });

  // Nút Text-to-Speech
  dialog.querySelector('#polyglot-btn-speak').addEventListener('click', () => {
    if (!currentTranslatedText) return;
    playHighQualityTTS(currentTranslatedText, currentTargetLang);
  });

  // Nút Save Vocab
  dialog.querySelector('#polyglot-btn-save').addEventListener('click', () => {
    if (!currentTranslatedText) return;
    chrome.runtime.sendMessage({
      action: "SAVE_VOCAB",
      item: {
        sourceText: text,
        translatedText: currentTranslatedText,
        sourceLang: currentSourceLang,
        targetLang: currentTargetLang
      }
    }, (res) => {
      if (res && res.success) {
        const btn = dialog.querySelector('#polyglot-btn-save');
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Đã lưu`;
      }
    });
  });

  // Thay đổi ngôn ngữ trực tiếp
  inlineSelect.addEventListener('change', (e) => {
    currentTargetLang = e.target.value;
    execTranslation();
  });

  // Chạy lần đầu
  execTranslation();
}

// Hàm hỗ trợ draggable
function makeDraggable(element, handle) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  handle.addEventListener("mousedown", dragStart);
  document.addEventListener("mouseup", dragEnd);
  document.addEventListener("mousemove", drag);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === handle || handle.contains(e.target)) {
      isDragging = true;
    }
  }

  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      element.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }
}

// Xử lý XSS an toàn
function escapeHtml(unsafe) {
  return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
}
// --- Audio TTS Helpers ---
function playHighQualityTTS(text, lang) {
  if (window.currentPolyglotAudio) window.currentPolyglotAudio.pause();
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  const chunks = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  let playIndex = 0;

  const playNext = async () => {
    if (playIndex >= chunks.length) return;
    let chunk = chunks[playIndex].trim();
    if (!chunk) {
      playIndex++;
      return playNext();
    }

    if (chunk.length > 200) chunk = chunk.substring(0, 200);

    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${lang}&q=${encodeURIComponent(chunk)}`;
    
    try {
      const response = await new Promise(res => chrome.runtime.sendMessage({
        action: "FETCH_TTS",
        url: url
      }, res));
      
      if (!response || !response.success) throw new Error('Fetch TTS failed');
      
      const audio = new Audio(response.dataUrl);
      window.currentPolyglotAudio = audio;

      audio.onended = () => {
        playIndex++;
        playNext();
      };

      audio.onerror = () => {
        fallbackTTS(chunk, lang);
        playIndex++;
        setTimeout(playNext, 2000);
      };

      await audio.play();
    } catch (e) {
      fallbackTTS(chunk, lang);
      playIndex++;
      setTimeout(playNext, 2000);
    }
  };

  playNext();
}

function fallbackTTS(text, lang) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const voice = voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (voice) {
      utterance.voice = voice;
    }
  }

  utterance.lang = lang;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

// Pre-load voices for fallback TTS
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
