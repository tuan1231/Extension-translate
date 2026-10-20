const Storage = {
  // --- SETTINGS ---
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['polyglot_settings'], (result) => {
        resolve(result.polyglot_settings || {
          engine: 'google', // 'google' | 'gemini' | 'openrouter'
          geminiApiKey: '',
          openrouterApiKey: '',
          openrouterModel: 'openrouter/free',
          targetLang: 'vi', // Default target language
          showFloatingIcon: true,
          ytEnabled: true
        });
      });
    });
  },

  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ polyglot_settings: settings }, () => resolve());
    });
  },

  // --- HISTORY / VOCABULARY ---
  async getHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['polyglot_history'], (result) => {
        resolve(result.polyglot_history || []);
      });
    });
  },

  async addHistory(item) {
    // item: { id, sourceText, translatedText, sourceLang, targetLang, timestamp }
    const history = await this.getHistory();
    // Prevent exactly identical consecutive saves
    if (history.length > 0 && history[0].sourceText === item.sourceText && history[0].targetLang === item.targetLang) {
      return;
    }
    item.id = Date.now().toString();
    item.timestamp = Date.now();
    history.unshift(item); // Add to beginning
    // Keep max 500 items to save space
    if (history.length > 500) history.pop();
    return new Promise((resolve) => {
      chrome.storage.local.set({ polyglot_history: history }, () => resolve());
    });
  },

  async clearHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['polyglot_history'], () => resolve());
    });
  },
  
  async deleteHistoryItem(id) {
    let history = await this.getHistory();
    history = history.filter(item => item.id !== id);
    return new Promise((resolve) => {
      chrome.storage.local.set({ polyglot_history: history }, () => resolve());
    });
  }
};

if (typeof window !== 'undefined') {
  window.Storage = Storage;
}
