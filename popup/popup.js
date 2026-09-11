document.addEventListener('DOMContentLoaded', async () => {
  // --- 1. Tab Navigation ---
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      document.getElementById(tabId).classList.add('active');

      if (tabId === 'tab-vocab') loadVocab();
    });
  });

  // --- 2. Load Languages ---
  const targetSelect = document.getElementById('target-lang-select');
  const defaultTargetSelect = document.getElementById('default-target-lang');
  
  if (window.LANGUAGES) {
    window.LANGUAGES.forEach(lang => {
      if (lang.code !== 'auto') {
        const option1 = new Option(lang.name, lang.code);
        const option2 = new Option(lang.name, lang.code);
        targetSelect.add(option1);
        defaultTargetSelect.add(option2);
      }
    });
  }

  // --- 3. Settings Management ---
  const settings = await Storage.getSettings();
  
  // Apply to Settings Tab
  document.querySelector(`input[name="engine"][value="${settings.engine}"]`).checked = true;
  document.getElementById('default-target-lang').value = settings.targetLang || 'vi';
  document.getElementById('show-floating-icon').checked = settings.showFloatingIcon !== false;

  const apiKeyInput = document.getElementById('gemini-api-key');
  apiKeyInput.value = ''; // Luôn làm rỗng input vì lý do bảo mật
  if (settings.geminiApiKey) {
    apiKeyInput.placeholder = 'Đã lưu Key. Nhập để thay đổi...';
  } else {
    apiKeyInput.placeholder = 'AQ... hoặc AIzaSy...';
  }

  // Apply to Translate Tab
  targetSelect.value = settings.targetLang || 'vi';

  // Toggle API key input visibility based on engine
  const toggleKeyGroup = () => {
    const isGemini = document.querySelector('input[name="engine"]:checked').value === 'gemini';
    document.getElementById('gemini-key-group').style.display = isGemini ? 'block' : 'none';
  };
  document.querySelectorAll('input[name="engine"]').forEach(r => r.addEventListener('change', toggleKeyGroup));
  toggleKeyGroup();

  // Save settings
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const inputKey = document.getElementById('gemini-api-key').value.trim();
    
    const newSettings = {
      engine: document.querySelector('input[name="engine"]:checked').value,
      targetLang: document.getElementById('default-target-lang').value,
      showFloatingIcon: document.getElementById('show-floating-icon').checked
    };

    if (inputKey) {
      newSettings.geminiApiKey = inputKey; // Ghi đè key mới nếu user có nhập
    } else {
      newSettings.geminiApiKey = settings.geminiApiKey; // Giữ nguyên key cũ nếu ô trống
    }

    await Storage.saveSettings(newSettings);
    
    // Cập nhật lại UI sau khi save
    settings.geminiApiKey = newSettings.geminiApiKey;
    if (settings.geminiApiKey) {
      document.getElementById('gemini-api-key').value = '';
      document.getElementById('gemini-api-key').placeholder = 'Đã lưu Key. Nhập để thay đổi...';
    }

    // update target in translation tab
    targetSelect.value = newSettings.targetLang;

    const status = document.getElementById('settings-status');
    status.textContent = 'Đã lưu thành công!';
    setTimeout(() => status.textContent = '', 2000);
  });

  // --- 4. Translate Logic ---
  const sourceText = document.getElementById('source-text');
  const targetTextContainer = document.getElementById('target-text');
  const btnTranslate = document.getElementById('btn-translate');
  const charCount = document.getElementById('char-count');
  let currentTranslationObj = null;

  sourceText.addEventListener('input', () => {
    charCount.textContent = `${sourceText.value.length}/5000`;
  });

  // Hotkey Ctrl + Enter
  sourceText.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      doTranslate();
    }
  });

  btnTranslate.addEventListener('click', doTranslate);

  async function doTranslate() {
    const text = sourceText.value.trim();
    if (!text) return;

    targetTextContainer.innerHTML = '<div class="loader"></div>';
    
    const targetLang = targetSelect.value;
    const currentSettings = await Storage.getSettings();

    try {
      const response = await new Promise(res => chrome.runtime.sendMessage({
        action: "DO_TRANSLATION",
        text: text,
        sourceLang: 'auto'
      }, res));

      if (!response || !response.success) {
        throw new Error(response ? response.error : "Không thể kết nối đến máy chủ dịch");
      }
      
      const result = response.data;
      targetTextContainer.innerHTML = escapeHtml(result.translatedText);
      
      // Update badge
      const sourceLangName = window.LANGUAGES.find(l => l.code === result.sourceLang)?.name || result.sourceLang.toUpperCase();
      document.getElementById('source-lang-badge').textContent = sourceLangName;

      // Prepare for vocab saving
      currentTranslationObj = {
        sourceText: text,
        translatedText: result.translatedText,
        sourceLang: result.sourceLang,
        targetLang: targetLang
      };
    } catch (error) {
      targetTextContainer.innerHTML = `<span style="color: var(--danger)">Lỗi: ${error.message}</span>`;
    }
  }

  // --- 5. Output Actions (Copy, TTS, Save) ---
  document.getElementById('btn-copy-result').addEventListener('click', () => {
    const text = targetTextContainer.innerText;
    if (text && text !== 'Bản dịch sẽ hiển thị ở đây...') {
      navigator.clipboard.writeText(text);
      const btn = document.getElementById('btn-copy-result');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="var(--primary)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      setTimeout(() => {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
      }, 2000);
    }
  });

  document.getElementById('btn-speak-result').addEventListener('click', () => {
    const text = targetTextContainer.innerText;
    if (text && text !== 'Bản dịch sẽ hiển thị ở đây...') {
      const lang = targetSelect.value;
      playHighQualityTTS(text, lang);
    }
  });

  document.getElementById('btn-save-vocab').addEventListener('click', async () => {
    if (currentTranslationObj) {
      await Storage.addHistory(currentTranslationObj);
      const btn = document.getElementById('btn-save-vocab');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="var(--primary)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      setTimeout(() => {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>`;
      }, 2000);
    }
  });

  // --- 6. Vocab / Flashcards ---
  async function loadVocab() {
    const vocabList = document.getElementById('vocab-list');
    vocabList.innerHTML = '<div class="loader"></div>';

    const history = await Storage.getHistory();
    
    if (history.length === 0) {
      vocabList.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top: 20px;">Sổ tay trống. Hãy lưu từ trong lúc dịch nhé.</div>';
      return;
    }

    vocabList.innerHTML = '';
    history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'flashcard';
      
      const langName = window.LANGUAGES.find(l => l.code === item.targetLang)?.name || item.targetLang;

      card.innerHTML = `
        <div class="fc-lang">${langName}</div>
        <div class="fc-source">${escapeHtml(item.sourceText)}</div>
        <div class="fc-target">${escapeHtml(item.translatedText)}</div>
        <button class="fc-delete" data-id="${item.id}" title="Xóa">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      `;

      card.querySelector('.fc-delete').addEventListener('click', async () => {
        await Storage.deleteHistoryItem(item.id);
        loadVocab();
      });

      vocabList.appendChild(card);
    });
  }

  document.getElementById('btn-clear-vocab').addEventListener('click', async () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử ôn tập không?")) {
      await Storage.clearHistory();
      loadVocab();
    }
  });

});

// Helper XSS
function escapeHtml(unsafe) {
  if (!unsafe) return '';
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

  // Tách văn bản thành các câu nhỏ vì Google TTS API có giới hạn độ dài
  const chunks = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  let playIndex = 0;

  const playNext = () => {
    if (playIndex >= chunks.length) return;
    let chunk = chunks[playIndex].trim();
    if (!chunk) {
      playIndex++;
      return playNext();
    }

    if (chunk.length > 200) chunk = chunk.substring(0, 200);

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(chunk)}`;
    const audio = new Audio(url);
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

    audio.play().catch(() => {
      fallbackTTS(chunk, lang);
      playIndex++;
      setTimeout(playNext, 2000);
    });
  };

  playNext();
}

function fallbackTTS(text, lang) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}
