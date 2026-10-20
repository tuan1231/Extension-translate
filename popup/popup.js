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
  document.getElementById('yt-enabled').checked = settings.ytEnabled !== false;

  const apiKeyInput = document.getElementById('gemini-api-key');
  apiKeyInput.value = ''; // Luôn làm rỗng input vì lý do bảo mật
  if (settings.geminiApiKey) {
    apiKeyInput.placeholder = 'Đã lưu Key. Nhập để thay đổi...';
  } else {
    apiKeyInput.placeholder = 'AQ... hoặc AIzaSy...';
  }

  const openrouterKeyInput = document.getElementById('openrouter-api-key');
  const openrouterModelSelect = document.getElementById('openrouter-model-select');
  if (openrouterKeyInput) {
    openrouterKeyInput.value = '';
    if (settings.openrouterApiKey) {
      openrouterKeyInput.placeholder = 'Đã lưu Key. Nhập để thay đổi...';
    } else {
      openrouterKeyInput.placeholder = 'sk-or-v1-...';
    }
  }
  if (settings.openrouterModel && openrouterModelSelect) {
    let exists = false;
    for (let opt of openrouterModelSelect.options) {
      if (opt.value === settings.openrouterModel) { exists = true; break; }
    }
    if (!exists) {
      openrouterModelSelect.add(new Option(settings.openrouterModel, settings.openrouterModel));
    }
    openrouterModelSelect.value = settings.openrouterModel;
  }

  // Apply to Translate Tab
  targetSelect.value = settings.targetLang || 'vi';

  // Toggle API key input visibility based on engine
  const toggleKeyGroup = () => {
    const selected = document.querySelector('input[name="engine"]:checked')?.value;
    const geminiGroup = document.getElementById('gemini-key-group');
    const openrouterGroup = document.getElementById('openrouter-key-group');
    if (geminiGroup) geminiGroup.style.display = (selected === 'gemini') ? 'block' : 'none';
    if (openrouterGroup) openrouterGroup.style.display = (selected === 'openrouter') ? 'block' : 'none';
  };
  document.querySelectorAll('input[name="engine"]').forEach(r => r.addEventListener('change', toggleKeyGroup));
  toggleKeyGroup();

  // Kiểm tra Gemini API Key & Model động mới nhất
  const btnTestKey = document.getElementById('btn-test-key');
  const modelInfoEl = document.getElementById('gemini-model-info');

  const runTestKey = async () => {
    let rawKey = document.getElementById('gemini-api-key')?.value.trim();
    if (!rawKey) {
      rawKey = settings.geminiApiKey || '';
    }
    const cleanKey = rawKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (!cleanKey) {
      if (modelInfoEl) {
        modelInfoEl.style.display = 'block';
        modelInfoEl.style.color = '#ef4444';
        modelInfoEl.textContent = 'Vui lòng nhập API Key trước khi kiểm tra.';
      }
      return;
    }
    if (btnTestKey) {
      btnTestKey.disabled = true;
      btnTestKey.textContent = 'Đang kiểm tra...';
    }
    if (modelInfoEl) {
      modelInfoEl.style.display = 'block';
      modelInfoEl.style.color = '#64748b';
      modelInfoEl.textContent = 'Đang truy vấn Google ModelService.ListModels...';
    }

    try {
      if (Translator._modelsCache) {
        delete Translator._modelsCache[cleanKey];
      }
      const models = await Translator.getAvailableGeminiModels(cleanKey);
      if (modelInfoEl) {
        modelInfoEl.style.color = '#10b981';
        modelInfoEl.innerHTML = `✓ Kết nối thành công!<br><strong>Model mới nhất:</strong> <code>${models[0]}</code> (${models.length} models)`;
      }
    } catch (err) {
      if (modelInfoEl) {
        modelInfoEl.style.color = '#ef4444';
        modelInfoEl.textContent = `✕ ${err.message || 'Không thể kết nối đến Gemini'}`;
      }
    } finally {
      if (btnTestKey) {
        btnTestKey.disabled = false;
        btnTestKey.textContent = 'Kiểm tra';
      }
    }
  };

  if (btnTestKey) {
    btnTestKey.addEventListener('click', runTestKey);
  }

  // Kiểm tra OpenRouter API Key & Tải danh sách model Free
  const btnTestOpenRouter = document.getElementById('btn-test-openrouter-key');
  const openrouterInfoEl = document.getElementById('openrouter-model-info');

  const runTestOpenRouterKey = async () => {
    let rawKey = document.getElementById('openrouter-api-key')?.value.trim();
    if (!rawKey) {
      rawKey = settings.openrouterApiKey || '';
    }
    const cleanKey = rawKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (!cleanKey) {
      if (openrouterInfoEl) {
        openrouterInfoEl.style.display = 'block';
        openrouterInfoEl.style.color = '#ef4444';
        openrouterInfoEl.textContent = 'Vui lòng nhập OpenRouter API Key trước khi kiểm tra.';
      }
      return;
    }
    if (btnTestOpenRouter) {
      btnTestOpenRouter.disabled = true;
      btnTestOpenRouter.textContent = 'Đang kiểm tra...';
    }
    if (openrouterInfoEl) {
      openrouterInfoEl.style.display = 'block';
      openrouterInfoEl.style.color = '#64748b';
      openrouterInfoEl.textContent = 'Đang kiểm tra Key và tải danh sách model Free...';
    }

    try {
      // 1. Kiểm tra xác thực qua endpoint https://openrouter.ai/api/v1/auth/key
      const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${cleanKey}` }
      });

      if (!authRes.ok) {
        let msg = '';
        try {
          const errJ = await authRes.json();
          msg = errJ?.error?.message || (await authRes.text());
        } catch (_) {
          msg = `Mã HTTP ${authRes.status}`;
        }
        throw new Error(`Key không hợp lệ (${authRes.status}): ${msg}`);
      }

      const authData = await authRes.json();
      
      // 2. Lấy danh sách các model :free
      const models = await Translator.getAvailableOpenRouterModels(cleanKey);

      if (openrouterInfoEl) {
        openrouterInfoEl.style.color = '#10b981';
        const keyLabel = authData?.data?.label || 'Hợp lệ';
        const freeCount = models ? models.length : 0;
        openrouterInfoEl.innerHTML = `✓ Kết nối thành công! (Key: ${keyLabel})<br>Tìm thấy <strong>${freeCount}</strong> model Miễn phí (:free).`;
      }

      if (Array.isArray(models) && openrouterModelSelect) {
        const currentVal = openrouterModelSelect.value;
        openrouterModelSelect.innerHTML = '';
        models.forEach(m => {
          const opt = new Option(m.name || m.id, m.id);
          openrouterModelSelect.add(opt);
        });
        if (currentVal && Array.from(openrouterModelSelect.options).some(o => o.value === currentVal)) {
          openrouterModelSelect.value = currentVal;
        } else {
          openrouterModelSelect.value = 'openrouter/free';
        }
      }
    } catch (err) {
      if (openrouterInfoEl) {
        openrouterInfoEl.style.color = '#ef4444';
        openrouterInfoEl.textContent = `✕ ${err.message || 'Không thể kết nối đến OpenRouter'}`;
      }
    } finally {
      if (btnTestOpenRouter) {
        btnTestOpenRouter.disabled = false;
        btnTestOpenRouter.textContent = 'Kiểm tra';
      }
    }
  };

  if (btnTestOpenRouter) {
    btnTestOpenRouter.addEventListener('click', runTestOpenRouterKey);
  }

  // Save settings
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const rawGeminiKey = document.getElementById('gemini-api-key').value.trim();
    const rawOpenRouterKey = document.getElementById('openrouter-api-key') ? document.getElementById('openrouter-api-key').value.trim() : '';
    const selectedEngine = document.querySelector('input[name="engine"]:checked').value;
    
    const newSettings = {
      engine: selectedEngine,
      targetLang: document.getElementById('default-target-lang').value,
      showFloatingIcon: document.getElementById('show-floating-icon').checked,
      ytEnabled: document.getElementById('yt-enabled').checked,
      openrouterModel: openrouterModelSelect ? openrouterModelSelect.value : (settings.openrouterModel || 'openrouter/free')
    };

    if (rawGeminiKey) {
      newSettings.geminiApiKey = rawGeminiKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    } else {
      newSettings.geminiApiKey = settings.geminiApiKey;
    }

    if (rawOpenRouterKey) {
      newSettings.openrouterApiKey = rawOpenRouterKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    } else {
      newSettings.openrouterApiKey = settings.openrouterApiKey;
    }

    await Storage.saveSettings(newSettings);
    
    // Cập nhật lại UI sau khi save
    settings.geminiApiKey = newSettings.geminiApiKey;
    settings.openrouterApiKey = newSettings.openrouterApiKey;
    settings.openrouterModel = newSettings.openrouterModel;
    settings.engine = newSettings.engine;

    if (settings.geminiApiKey) {
      document.getElementById('gemini-api-key').value = '';
      document.getElementById('gemini-api-key').placeholder = 'Đã lưu Key. Nhập để thay đổi...';
    }
    if (settings.openrouterApiKey && document.getElementById('openrouter-api-key')) {
      document.getElementById('openrouter-api-key').value = '';
      document.getElementById('openrouter-api-key').placeholder = 'Đã lưu Key. Nhập để thay đổi...';
    }

    // update target in translation tab
    targetSelect.value = newSettings.targetLang;

    const status = document.getElementById('settings-status');
    status.textContent = 'Đã lưu thành công!';
    setTimeout(() => status.textContent = '', 2000);

    // Tự động kiểm tra kết nối nếu có key
    if (selectedEngine === 'gemini' && settings.geminiApiKey) {
      runTestKey();
    } else if (selectedEngine === 'openrouter' && settings.openrouterApiKey) {
      runTestOpenRouterKey();
    }
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

  // Đảo chiều dịch (Anh ⇄ Việt)
  const btnSwapLang = document.getElementById('btn-swap-lang');
  if (btnSwapLang) {
    btnSwapLang.addEventListener('click', () => {
      const cur = targetSelect.value;
      const next = (cur === 'vi' ? 'en' : 'vi');
      targetSelect.value = next;

      // Nếu đã có bản dịch sẵn, đảo kết quả vào ô nhập nguồn để dịch ngược lại
      const curResult = targetTextContainer.innerText.trim();
      if (curResult && curResult !== 'Bản dịch sẽ hiển thị ở đây...' && !curResult.startsWith('Lỗi:')) {
        sourceText.value = curResult;
        charCount.textContent = `${sourceText.value.length}/5000`;
      }
      doTranslate();
    });
  }

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

    // Tự động phát hiện thông minh: Nếu người dùng nhập tiếng Việt mà target đang là 'vi' -> tự đổi sang 'en' (Việt -> Anh)
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)
      || /\b(là|và|của|các|trong|người|với|được|cho|không|có|những|để|khi|này|tại|từ|về|đã|sẽ)\b/i.test(text);

    if (isVi && targetSelect.value === 'vi') {
      targetSelect.value = 'en';
    }

    targetTextContainer.innerHTML = '<div class="loader"></div>';
    
    const targetLang = targetSelect.value;
    const currentSettings = await Storage.getSettings();

    try {
      const response = await new Promise(res => chrome.runtime.sendMessage({
        action: "DO_TRANSLATION",
        text: text,
        sourceLang: 'auto',
        targetLang: targetLang
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

// TTS: gửi về service worker -> phát bằng Offscreen Document (giọng Google tự nhiên)
function playHighQualityTTS(text, lang) {
  if (!text) return;
  chrome.runtime.sendMessage({ action: "TTS_SPEAK", text, lang }, () => {
    void chrome.runtime.lastError;
  });
}
