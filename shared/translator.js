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
      if (engine === 'openrouter' && settings.openrouterApiKey) {
        return await this._translateOpenRouter(text, targetLang, sourceLang, settings.openrouterApiKey, settings.openrouterModel);
      } else if (engine === 'gemini' && settings.geminiApiKey) {
        return await this._translateGemini(text, targetLang, sourceLang, settings.geminiApiKey);
      } else {
        return await this._translateGoogle(text, targetLang, sourceLang);
      }
    } catch (error) {
      console.warn('[Polyglot] Lỗi engine chính:', error.message);
      // Cơ chế tự phục hồi đa tầng: OpenRouter <-> Gemini <-> Google
      if (engine === 'openrouter') {
        if (settings.geminiApiKey) {
          try {
            console.warn('[Polyglot] OpenRouter lỗi, thử sang Gemini AI...');
            return await this._translateGemini(text, targetLang, sourceLang, settings.geminiApiKey);
          } catch (e) { }
        }
      } else if (engine === 'gemini') {
        if (settings.openrouterApiKey) {
          try {
            console.warn('[Polyglot] Gemini lỗi, thử sang OpenRouter AI...');
            return await this._translateOpenRouter(text, targetLang, sourceLang, settings.openrouterApiKey, settings.openrouterModel);
          } catch (e) { }
        }
      } else if (engine === 'google') {
        if (settings.openrouterApiKey) {
          try {
            console.warn('[Polyglot] Google Translate bị chặn, thử sang OpenRouter AI...');
            return await this._translateOpenRouter(text, targetLang, sourceLang, settings.openrouterApiKey, settings.openrouterModel);
          } catch (e) { }
        }
        if (settings.geminiApiKey) {
          try {
            console.warn('[Polyglot] Google Translate bị chặn, thử sang Gemini AI...');
            return await this._translateGemini(text, targetLang, sourceLang, settings.geminiApiKey);
          } catch (e) { }
        }
      }

      // Dự phòng cuối cùng: Google Translate
      if (engine !== 'google') {
        console.warn('[Polyglot] Fallback cuối cùng sang Google Translate');
        return await this._translateGoogle(text, targetLang, sourceLang);
      }
      throw error;
    }
  },

  _transCache: new Map(),

  _modelsCache: {}, // { [apiKey]: { timestamp: number, models: string[] } }
  _activeModel: null,

  /**
   * Tính điểm xếp hạng động cho model Gemini:
   * 1. Phiên bản mới nhất (3.8 > 3.0 > 2.5 > 2.0 > 1.5...)
   * 2. Ưu tiên dòng Flash (hỗ trợ Free Tier tối đa của Google AI Studio, tốc độ cao nhất)
   * 3. Tránh các model deprecated hoặc cũ
   */
  _scoreGeminiModel(name) {
    const rawName = (name || '').replace(/^models\//, '').toLowerCase();
    let score = 0;

    // Trích xuất số phiên bản động (hỗ trợ mọi version như 1.5, 2.0, 2.5, 3.0, 3.8, 4.0...)
    const vMatch = rawName.match(/gemini-(\d+(?:\.\d+)?)/i);
    if (vMatch) {
      const version = parseFloat(vMatch[1]) || 0;
      score += Math.round(version * 10000);
    }

    // Ưu tiên dòng Flash (Free Tier chính của Google AI Studio, quota cao nhất)
    if (rawName.includes('flash') && !rawName.includes('lite') && !rawName.includes('8b')) {
      score += 50000;
    } else if (rawName.includes('flash-lite')) {
      score += 48000;
    } else if (rawName.includes('flash-8b')) {
      score += 45000;
    } else if (rawName.includes('pro')) {
      score += 20000;
    } else {
      score += 10000;
    }

    if (rawName.includes('latest')) score += 500;
    // Trừ điểm thinking vì mất nhiều thời gian suy luận, không hợp dịch nhanh
    if (rawName.includes('thinking')) score -= 15000;
    // Trừ điểm bản exp/preview nếu có bản ổn định
    if (rawName.includes('exp') || rawName.includes('preview')) score -= 3000;
    // Trừ điểm model cũ/deprecated
    if (rawName.includes('deprecated') || rawName.includes('legacy') || rawName.includes('001')) score -= 10000;

    return score;
  },

  /**
   * Lấy danh sách model HOÀN TOÀN ĐỘNG từ Google ModelService.ListModels
   * Sắp xếp từ model mới nhất hỗ trợ Free Tier xuống.
   * Tuyệt đối không fix cứng tên model.
   */
  async getAvailableGeminiModels(apiKey) {
    if (!apiKey) {
      throw new Error('Chưa cung cấp Gemini API Key.');
    }

    const cached = this._modelsCache[apiKey];
    const now = Date.now();
    // Cache danh sách model trong 30 phút để tăng tốc độ dịch
    if (cached && (now - cached.timestamp < 30 * 60 * 1000) && cached.models?.length > 0) {
      return cached.models;
    }

    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    } catch (netErr) {
      if (cached && cached.models?.length > 0) return cached.models;
      throw new Error(`Lỗi kết nối tới Gemini API: ${netErr.message}`);
    }

    if (!response.ok) {
      let errMessage = '';
      try {
        const errJson = await response.json();
        errMessage = errJson?.error?.message || JSON.stringify(errJson);
      } catch (_) {
        errMessage = await response.text();
      }
      throw new Error(`Google API lỗi (${response.status}): ${errMessage || 'Yêu cầu không hợp lệ'}`);
    }

    const data = await response.json();
    const rawList = Array.isArray(data.models) ? data.models : [];

    // Chỉ lấy các model hỗ trợ generateContent
    const usableModels = rawList.filter(m => 
      Array.isArray(m.supportedGenerationMethods) && 
      m.supportedGenerationMethods.includes('generateContent')
    );

    if (usableModels.length === 0) {
      throw new Error('API Key này không có model nào hỗ trợ generateContent.');
    }

    // Sắp xếp động theo thứ tự model mới nhất + tối ưu Free Tier
    usableModels.sort((a, b) => this._scoreGeminiModel(b.name) - this._scoreGeminiModel(a.name));

    const modelNames = usableModels.map(m => (m.name || '').replace(/^models\//, ''));
    console.log(`[Polyglot] Đã đồng bộ ${modelNames.length} models từ Google API. Model mới nhất ưu tiên: ${modelNames[0]}`);

    this._modelsCache[apiKey] = {
      timestamp: now,
      models: modelNames
    };

    return modelNames;
  },

  /**
   * Trả về model mới nhất hỗ trợ Free Tier từ danh sách động
   */
  async getWorkingModel(apiKey) {
    try {
      const models = await this.getAvailableGeminiModels(apiKey);
      return models[0];
    } catch (e) {
      console.warn('Lỗi lấy model Gemini động:', e);
      throw e;
    }
  },

  async _translateGoogle(text, targetLang, sourceLang) {
    let sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const tl = targetLang;
    
    // Tự động phát hiện tiếng Việt nếu sl là auto
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)
      || /\b(là|và|của|các|trong|người|với|được|cho|không|có|những|để|khi|này|tại|từ|về|đã|sẽ)\b/i.test(text);
    if (sl === 'auto' && isVi && tl !== 'vi') {
      sl = 'vi';
    }

    // Nếu ngôn ngữ nguồn và đích giống nhau, trả về nguyên bản
    if (sl === tl || (sl === 'vi' && isVi && tl === 'vi')) {
      return { translatedText: text, sourceLang: tl };
    }

    // Kiểm tra cache
    const cacheKey = `${sl}_${tl}_${text.trim()}`;
    if (this._transCache.has(cacheKey)) {
      return this._transCache.get(cacheKey);
    }

    // Danh sách các endpoint Google Translate uy tín, xoay vòng chống 429
    const googleEndpoints = [
      `https://translate.google.com/translate_a/single?client=at&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
      `https://translate.google.com.vn/translate_a/single?client=at&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`
    ];

    for (const url of googleEndpoints) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          let translatedText = '';
          if (Array.isArray(data)) {
            if (data[0] && Array.isArray(data[0])) {
              data[0].forEach(item => { if (item && item[0]) translatedText += item[0]; });
            } else if (typeof data[0] === 'string') {
              translatedText = data[0];
            }
          }
          if (translatedText && translatedText.trim()) {
            const resObj = {
              translatedText: translatedText.trim(),
              sourceLang: data[2] || (isVi ? 'vi' : sourceLang)
            };
            if (this._transCache.size > 500) this._transCache.clear();
            this._transCache.set(cacheKey, resObj);
            return resObj;
          }
        }
      } catch (e) { }
    }

    // Thử MyMemory API dự phòng nếu có
    try {
      const srcPair = sl === 'auto' ? (isVi ? 'vi' : 'en') : sl;
      if (srcPair !== tl) {
        const rnd = Math.floor(Math.random() * 10000);
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcPair}|${tl}&de=poly_${rnd}@gmail.com`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const tr = data?.responseData?.translatedText;
          if (tr && String(data.responseStatus) === '200' && !tr.includes('MYMEMORY WARNING') && !tr.includes('PLEASE SELECT')) {
            const resObj = { translatedText: tr.trim(), sourceLang: srcPair };
            this._transCache.set(cacheKey, resObj);
            return resObj;
          }
        }
      }
    } catch (e) { }

    throw new Error('Google Translate API error: All translation endpoints unavailable');
  },

  async _translateGemini(text, targetLang, sourceLang, apiKey) {
    const getLangName = (code) => {
      const list = (typeof LANGUAGES !== 'undefined' ? LANGUAGES : (typeof window !== 'undefined' && window.LANGUAGES ? window.LANGUAGES : []));
      const lang = list.find(l => l.code === code);
      return lang ? lang.name : code;
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

    // Lấy danh sách model 100% động từ Google ModelService.ListModels (sắp xếp mới nhất + tối ưu Free Tier)
    const dynamicModels = await this.getAvailableGeminiModels(apiKey);
    const candidateModels = [];
    if (this._activeModel && dynamicModels.includes(this._activeModel)) {
      candidateModels.push(this._activeModel);
    }
    for (const m of dynamicModels) {
      if (!candidateModels.includes(m)) {
        candidateModels.push(m);
      }
    }

    let lastErr = '';

    for (const m of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json();
          if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            this._activeModel = m;
            const translatedText = data.candidates[0].content.parts[0].text.trim();
            return {
              translatedText,
              sourceLang: sourceLang === 'auto' ? 'auto-ai' : sourceLang 
            };
          }
        } else {
          lastErr = await response.text();
        }
      } catch (err) {
        lastErr = err.message;
      }
    }

    throw new Error(`Gemini API error: ${lastErr}`);
  },

  /**
   * Dịch hàng loạt nhiều câu cùng lúc bằng Gemini (Batch Translation)
   * Tăng tốc dịch phụ đề gấp 20 lần so với dịch từng câu
   */
  async translateBatchGemini(texts, targetLang, apiKey) {
    if (!Array.isArray(texts) || !texts.length) return [];
    const list = (typeof LANGUAGES !== 'undefined' ? LANGUAGES : (typeof window !== 'undefined' && window.LANGUAGES ? window.LANGUAGES : []));
    const targetLangName = list.find(l => l.code === targetLang)?.name || targetLang;

    const systemPrompt = `You are an expert subtitle translator. Translate each subtitle line in the input JSON array into ${targetLangName}.
CRITICAL RULES:
1. Return ONLY a valid JSON array of strings: ["translation 1", "translation 2", ...]
2. The output array MUST have the exact same length (${texts.length} items) as the input array.
3. Keep the translation natural and concise.
4. Do NOT wrap in markdown block. Return raw JSON string only.`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify(texts) }]
      }],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: "application/json"
      }
    };

    const candidateModels = await this.getAvailableGeminiModels(apiKey);
    const orderedModels = [];
    if (this._activeModel && candidateModels.includes(this._activeModel)) {
      orderedModels.push(this._activeModel);
    }
    for (const m of candidateModels) {
      if (!orderedModels.includes(m)) orderedModels.push(m);
    }

    let lastErr = '';
    for (const m of orderedModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            this._activeModel = m;
            const clean = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed)) {
              return parsed;
            }
          }
        } else {
          lastErr = await response.text();
        }
      } catch (err) {
        lastErr = err.message;
      }
    }
    throw new Error(`Gemini Batch Translation error: ${lastErr}`);
  },

  /**
   * Nhận diện lời nói trực tiếp từ file âm thanh và dịch đa ngôn ngữ bằng Gemini Audio
   * Tối ưu hóa chuyên sâu cho Tiếng Việt và Tiếng Anh (song ngữ đối ứng thông minh)
   */
  async transcribeAudioGemini(base64Audio, mimeType, targetLang, apiKey) {
    const list = (typeof LANGUAGES !== 'undefined' ? LANGUAGES : (typeof window !== 'undefined' && window.LANGUAGES ? window.LANGUAGES : []));
    const targetLangName = list.find(l => l.code === targetLang)?.name || (targetLang === 'vi' ? 'Vietnamese' : 'English');

    const systemPrompt = `You are a real-time, highly accurate multilingual speech recognition and translation AI for video audio.
Languages Supported: All world languages (English, Vietnamese, Japanese, Korean, Chinese, French, Spanish, German, Russian, etc.).

CRITICAL INSTRUCTIONS & SPECIALIZED OPTIMIZATION:
1. Speech Recognition (STT):
   - Listen to the audio chunk carefully. Transcribe EXACT words spoken in their original language.
   - For VIETNAMESE: Output 100% accurate Vietnamese diacritics and tones (dấu thanh: sắc, huyền, hỏi, ngã, nặng; dấu mũ/móc: ă, â, ê, ô, ơ, ư, đ). Correctly recognize Northern, Central, and Southern regional accents. Accurately preserve natural English technical/colloquial loanwords (e.g., "setup", "fix bug", "review", "deadline", "check", "meeting", "share", "content").
   - For ENGLISH: Accurately capture native accents (US, UK, Australian, Canadian, Global), contractions ("I'm", "don't", "wanna", "gonna"), idioms, and casual expressions.
   - For other languages (Japanese, Korean, Chinese, Spanish, French, etc.): Transcribe accurately in that language script.

2. Smart Bilingual Translation (Tối ưu cặp Việt - Anh):
   - If the speech is in ENGLISH: Translate to natural, fluent, context-aware VIETNAMESE.
   - If the speech is in VIETNAMESE: Translate to idiomatic, conversational ENGLISH.
   - If the speech is in ANOTHER language (e.g., Japanese, Korean, Chinese, etc.): Translate to ${targetLangName}.
   - If the speech matches ${targetLangName}: If target is Vietnamese and speech is Vietnamese -> translate to English; if target is English and speech is English -> translate to Vietnamese. (ALWAYS guarantee a complementary bilingual pair).

3. Output Format:
   - Return ONLY a valid JSON object strictly matching this schema:
   {"text": "transcribed spoken words in original language", "translated": "fluent translation", "detectedLang": "en|vi|..."}
   - If there is NO discernable human speech (only silence, background music, beats, laughing, sound effects, intro/outro jingle, background noise): RETURN EXACTLY {"text": "", "translated": "", "detectedLang": ""}.
   - Do NOT wrap in markdown code blocks like \`\`\`json. Return pure JSON string only.`;

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [
          { text: `Transcribe speech and translate. Target language is ${targetLangName}.` },
          {
            inline_data: {
              mime_type: mimeType || "audio/webm",
              data: base64Audio
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json"
      }
    };

    // Lấy danh sách model 100% động từ Google ModelService.ListModels
    const dynamicModels = await this.getAvailableGeminiModels(apiKey);
    const candidateModels = [];
    if (this._activeModel && dynamicModels.includes(this._activeModel)) {
      candidateModels.push(this._activeModel);
    }
    for (const m of dynamicModels) {
      if (!candidateModels.includes(m)) {
        candidateModels.push(m);
      }
    }

    let lastErr = '';

    for (const m of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json();
          this._activeModel = m;
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!candidateText) return { text: '', translated: '', detectedLang: '' };

          try {
            const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
              text: (parsed.text || parsed.original || '').trim(),
              translated: (parsed.translated || parsed.translation || '').trim(),
              detectedLang: (parsed.detectedLang || '').toLowerCase().trim()
            };
          } catch (e) {
            return { text: candidateText.trim(), translated: '', detectedLang: '' };
          }
        } else {
          lastErr = await response.text();
        }
      } catch (err) {
        lastErr = err.message;
      }
    }

    throw new Error(`Gemini Audio STT error: ${lastErr}`);
  },

  /**
   * Nhận diện và dịch giọng nói trực tiếp qua OpenRouter AI (Multimodal Audio & STT)
   * Tối ưu đa ngôn ngữ, đặc biệt là cặp Tiếng Việt và Tiếng Anh
   */
  async transcribeAudioOpenRouter(base64Audio, mimeType = 'audio/webm', targetLang = 'vi', apiKey, preferredModel = '') {
    if (!apiKey) throw new Error('NO_API_KEY');
    const cleanKey = (apiKey || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    const list = (typeof LANGUAGES !== 'undefined' ? LANGUAGES : (typeof window !== 'undefined' && window.LANGUAGES ? window.LANGUAGES : []));
    const targetLangName = list.find(l => l.code === targetLang)?.name || targetLang;

    // Chuẩn hoá format audio cho OpenRouter
    let format = 'webm';
    const lowerMime = (mimeType || '').toLowerCase();
    if (lowerMime.includes('wav')) format = 'wav';
    else if (lowerMime.includes('mp3')) format = 'mp3';
    else if (lowerMime.includes('ogg')) format = 'ogg';
    else if (lowerMime.includes('flac')) format = 'flac';
    else if (lowerMime.includes('aac') || lowerMime.includes('m4a')) format = 'm4a';

    const systemPrompt = `You are a real-time speech recognizer and translator for YouTube video audio.
Primary focus: Accurate transcription and natural translation for Vietnamese (vi) and English (en), as well as other world languages.
Rules:
1. Listen carefully to the spoken voice in the audio.
2. Transcribe the spoken words in the original language accurately into "text".
3. Translate the transcribed words naturally into ${targetLangName} into "translated".
4. Identify the spoken language code (e.g. "vi", "en", "ja", "ko", "zh", "fr", "es", "de") into "detectedLang".
5. Bilingual rule for Vietnamese and English:
   - If spoken speech is Vietnamese, translate into English.
   - If spoken speech is English, translate into Vietnamese (or ${targetLangName}).
   - If spoken speech is any other language, translate into ${targetLangName}.
6. If the audio is silent, or contains only music/beats, sound effects, breathing, or laughter without speech: RETURN EXACTLY {"text": "", "translated": "", "detectedLang": ""}.
7. Return strictly valid JSON: {"text": "...", "translated": "...", "detectedLang": "..."} without markdown or code fences.`;

    // Danh sách model hỗ trợ audio input trên OpenRouter (TUYỆT ĐỐI KHÔNG thêm openrouter/free hoặc model text-only)
    const candidateModels = [];
    if (preferredModel && preferredModel !== 'openrouter/free' && !preferredModel.endsWith(':free')) {
      candidateModels.push(preferredModel);
    }
    const audioCandidates = [
      'google/gemini-2.5-flash',
      'google/gemini-2.5-flash-lite',
      'openai/gpt-audio-mini',
      'google/gemini-3.5-flash-lite'
    ];
    for (const m of audioCandidates) {
      if (!candidateModels.includes(m)) candidateModels.push(m);
    }

    let lastErr = '';

    for (const model of candidateModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/polyglot-ai-translator',
            'X-Title': 'Polyglot AI Translator'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Transcribe and translate to ${targetLangName}. Respond in JSON format only.` },
                  {
                    type: 'input_audio',
                    input_audio: {
                      data: base64Audio,
                      format: format
                    },
                    inputAudio: {
                      data: base64Audio,
                      format: format
                    }
                  }
                ]
              }
            ],
            temperature: 0.1
          })
        });

        if (res.ok) {
          const data = await res.json();
          const candidateText = data.choices?.[0]?.message?.content?.trim();
          if (!candidateText) return { text: '', translated: '', detectedLang: '', model };

          try {
            const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
              text: (parsed.text || parsed.original || '').trim(),
              translated: (parsed.translated || parsed.translation || '').trim(),
              detectedLang: (parsed.detectedLang || '').toLowerCase().trim(),
              model: model
            };
          } catch (e) {
            // Thử regex trích xuất nếu JSON bị dính text ngoài
            const mText = candidateText.match(/"text"\s*:\s*"([^"]+)"/);
            const mTr = candidateText.match(/"translated"\s*:\s*"([^"]+)"/);
            const mLang = candidateText.match(/"detectedLang"\s*:\s*"([^"]+)"/);
            if (mText) {
              return {
                text: mText[1].trim(),
                translated: mTr ? mTr[1].trim() : '',
                detectedLang: mLang ? mLang[1].trim() : '',
                model: model
              };
            }
            return { text: candidateText.trim(), translated: '', detectedLang: '', model: model };
          }
        } else {
          const errText = await res.text();
          console.warn(`OpenRouter audio model [${model}] failed (${res.status}):`, errText);
          lastErr = `[${model}] ${errText}`;
        }
      } catch (err) {
        console.warn(`OpenRouter fetch error for [${model}]:`, err.message);
        lastErr = `[${model}] ${err.message}`;
      }
    }

    if (lastErr.includes('insufficient credits') || lastErr.includes('Payment Required') || lastErr.includes('402')) {
      throw new Error('Tài khoản OpenRouter chưa có credit để dùng model âm thanh (OpenRouter hiện không có model âm thanh miễn phí). Hãy nạp credits trên OpenRouter hoặc nhập Gemini API Key miễn phí 100% tại aistudio.google.com để dùng Live AI.');
    }
    if (lastErr.includes('No endpoints found') || lastErr.includes('Filter by Input Audio Support') || lastErr.includes('input audio') || lastErr.includes('404')) {
      throw new Error('OpenRouter hiện không có model Miễn phí (:free) nào hỗ trợ âm thanh video. Để dùng Live AI miễn phí 100%, vui lòng nhập Gemini API Key (lấy miễn phí tại aistudio.google.com) trong Cài đặt extension.');
    }

    throw new Error(`OpenRouter Audio STT error: ${lastErr}`);
  },

  _openrouterModelsCache: { timestamp: 0, models: [] },

  /**
   * Lấy danh sách các model Miễn phí (:free) khả dụng trên OpenRouter
   */
  async getAvailableOpenRouterModels(apiKey) {
    const now = Date.now();
    if (this._openrouterModelsCache.models?.length > 0 && (now - this._openrouterModelsCache.timestamp < 60 * 60 * 1000)) {
      return this._openrouterModelsCache.models;
    }

    try {
      const headers = {};
      const cleanKey = (apiKey || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
      if (cleanKey) headers['Authorization'] = `Bearer ${cleanKey}`;
      const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        const freeList = rawList
          .filter(m => m.id && (m.id.endsWith(':free') || (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0')))
          .map(m => ({ id: m.id, name: m.name || m.id }));

        // Luôn đặt openrouter/free lên đầu tiên (router tự động chọn model free nhanh nhất)
        const result = [{ id: 'openrouter/free', name: 'openrouter/free (Tự động chọn model Free tốt nhất)' }];
        for (const item of freeList) {
          if (item.id !== 'openrouter/free') {
            result.push(item);
          }
        }
        this._openrouterModelsCache = { timestamp: now, models: result };
        return result;
      }
    } catch (e) {
      console.warn('Không thể tải danh sách model OpenRouter:', e);
    }

    return [{ id: 'openrouter/free', name: 'openrouter/free (Tự động chọn model Free tốt nhất)' }];
  },

  /**
   * Dịch văn bản bằng OpenRouter AI (hỗ trợ các model :free)
   */
  async _translateOpenRouter(text, targetLang, sourceLang, apiKey, model = 'openrouter/free') {
    const list = (typeof LANGUAGES !== 'undefined' ? LANGUAGES : (typeof window !== 'undefined' && window.LANGUAGES ? window.LANGUAGES : []));
    const targetLangName = list.find(l => l.code === targetLang)?.name || targetLang;

    const sourceInstruction = sourceLang === 'auto'
      ? "Auto-detect source language."
      : `Source language is ${list.find(l => l.code === sourceLang)?.name || sourceLang}.`;

    const systemPrompt = `You are a professional translator. Translate the given text accurately, naturally, and context-aware into ${targetLangName}.
${sourceInstruction}
CRITICAL: RETURN ONLY THE TRANSLATED TEXT. No quotes, no markdown block, no conversational filler.`;

    const useModel = model || 'openrouter/free';
    const cleanKey = (apiKey || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/polyglot-ai-translator',
        'X-Title': 'Polyglot AI Translator'
      },
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      let errText = '';
      try {
        const errJson = await res.json();
        errText = errJson?.error?.message || JSON.stringify(errJson);
      } catch (_) {
        errText = await res.text();
      }
      throw new Error(`OpenRouter lỗi (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidate = data.choices?.[0]?.message?.content?.trim();
    if (!candidate) {
      throw new Error('OpenRouter trả về kết quả rỗng.');
    }

    return {
      translatedText: candidate,
      sourceLang: sourceLang === 'auto' ? 'auto-ai' : sourceLang
    };
  },

  /**
   * Dịch hàng loạt nhiều câu cùng lúc bằng OpenRouter AI
   */
  async translateBatchOpenRouter(texts, targetLang, apiKey, model = 'openrouter/free') {
    if (!Array.isArray(texts) || !texts.length) return [];
    const list = (typeof LANGUAGES !== 'undefined' ? LANGUAGES : (typeof window !== 'undefined' && window.LANGUAGES ? window.LANGUAGES : []));
    const targetLangName = list.find(l => l.code === targetLang)?.name || targetLang;

    const systemPrompt = `You are an expert subtitle translator. Translate each subtitle line in the input JSON array into ${targetLangName}.
CRITICAL RULES:
1. Return ONLY a valid JSON array of strings: ["translation 1", "translation 2", ...]
2. The output array MUST have the exact same length (${texts.length} items) as the input array.
3. Keep the translation natural and concise.
4. Do NOT wrap in markdown block. Return raw JSON string only.`;

    const useModel = model || 'openrouter/free';
    const cleanKey = (apiKey || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/polyglot-ai-translator',
        'X-Title': 'Polyglot AI Translator'
      },
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(texts) }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter Batch error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content?.trim();
    if (rawText) {
      const clean = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed;
    }
    throw new Error('OpenRouter Batch trả về dữ liệu không đúng định dạng JSON.');
  }
};

if (typeof window !== 'undefined') {
  window.Translator = Translator;
}
