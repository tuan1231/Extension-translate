const Translator = {
  /**
   * Dịch văn bản sử dụng Engine được cấu hình
   * @param {string} text - Văn bản cần dịch
   * @param {string} targetLang - Mã ngôn ngữ đích
   * @param {string} sourceLang - Mã ngôn ngữ nguồn (mặc định 'auto')
   * @param {object} settings - Cấu hình từ Storage
   */
  async translate(text, targetLang, sourceLang = 'auto', settings) {
    if (!text || text.trim() === '') return { translatedText: '', sourceLang: 'auto' };

    const engine = settings.engine || 'google';

    try {
      if (engine === 'gemini' && settings.geminiApiKey) {
        return await this._translateGemini(text, targetLang, sourceLang, settings.geminiApiKey);
      } else {
        return await this._translateGoogle(text, targetLang, sourceLang);
      }
    } catch (error) {
      console.error('Translation error:', error);
      // Fallback to Google Free if Gemini fails or config is bad
      if (engine === 'gemini') {
        console.warn('Gemini failed, falling back to Google Engine');
        return await this._translateGoogle(text, targetLang, sourceLang);
      }
      throw error;
    }
  },

  async _translateGoogle(text, targetLang, sourceLang) {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const tl = targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Google Translate API error');
    
    const data = await response.json();
    
    // Parse the translated text
    let translatedText = '';
    if (data[0] && Array.isArray(data[0])) {
      data[0].forEach(item => {
        if (item[0]) translatedText += item[0];
      });
    }

    // Detected source language
    const detectedLang = data[2] || sourceLang;

    return {
      translatedText,
      sourceLang: detectedLang
    };
  },

  async _translateGemini(text, targetLang, sourceLang, apiKey) {
    // We map code to name if possible, for better AI instruction
    const getLangName = (code) => {
      // Assuming window.LANGUAGES exists in context, but fallback to code
      if (typeof window !== 'undefined' && window.LANGUAGES) {
        const lang = window.LANGUAGES.find(l => l.code === code);
        return lang ? lang.name : code;
      }
      return code;
    };

    const targetLangName = getLangName(targetLang);
    const sourceInstruction = sourceLang === 'auto' 
        ? "Auto-detect the source language." 
        : `The source language is ${getLangName(sourceLang)}.`;

    const systemPrompt = `You are a highly advanced AI Translator. Your goal is to translate the user's text into ${targetLangName}. 
Business Rules:
1. Provide the most accurate, natural, and context-aware semantic translation.
2. DO NOT translate literally word-by-word if it makes it sound unnatural. Preserve cultural nuances, idioms, and professional terminology.
3. ${sourceInstruction}
4. RETURN ONLY THE TRANSLATED TEXT. Do not add markdown blocks, do not add introductory text like "Here is the translation". Just output the final translated text.`;

    let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [{ text }]
      }],
      generationConfig: {
        temperature: 0.3
      }
    };

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Nếu model 3.6 chưa khả dụng, fallback về 1.5-flash
    if (!response.ok && response.status === 404) {
      console.warn("Gemini 3.6 Flash not found, falling back to 1.5 Flash");
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${errText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      const translatedText = data.candidates[0].content.parts[0].text.trim();
      return {
        translatedText,
        sourceLang: sourceLang === 'auto' ? 'auto-ai' : sourceLang 
      };
    } else {
      throw new Error('Invalid response from Gemini');
    }
  }
};

if (typeof window !== 'undefined') {
  window.Translator = Translator;
}
