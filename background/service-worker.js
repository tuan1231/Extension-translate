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

  if (request.action === "FETCH_TTS") {
    (async () => {
      try {
        const response = await fetch(request.url);
        if (!response.ok) throw new Error('Network response was not ok');
        const arrayBuffer = await response.arrayBuffer();
        
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:audio/mpeg;base64,${base64}`;
        
        sendResponse({ success: true, dataUrl });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
