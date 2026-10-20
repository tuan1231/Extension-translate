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
   * Nhận diện lời nói trực tiếp từ file âm thanh và dịch sang ngôn ngữ đích bằng Gemini Audio
   */
  async transcribeAudioGemini(base64Audio, mimeType, targetLang, apiKey) {
    const list = (typeof LANGUAGES !== 'undefined' ? LANGUAGES : (typeof window !== 'undefined' && window.LANGUAGES ? window.LANGUAGES : []));
    const targetLangName = list.find(l => l.code === targetLang)?.name || targetLang;

    const systemPrompt = `You are a real-time speech recognizer and translator for video audio.
Instructions:
1. Listen to the audio chunk carefully. Transcribe the exact speech spoken in its original language (supports Vietnamese, English, and other languages).
2. Translate that speech into ${targetLangName} (for example, if spoken in Vietnamese, translate to English; if spoken in English, translate to Vietnamese).
3. Return ONLY a valid JSON object matching this schema:
{"text": "transcribed spoken words", "translated": "translation into ${targetLangName}"}
Rules:
- If there is NO speech (only silence, background music, laughter, applause, sound effects, or indistinct murmur): return {"text": "", "translated": ""}.
- Do NOT wrap in markdown code blocks like \`\`\`json. Return pure JSON string only.`;

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [
          { text: `Transcribe the speech and translate to ${targetLangName}.` },
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
          if (!candidateText) return { text: '', translated: '' };

          try {
            const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
              text: (parsed.text || parsed.original || '').trim(),
              translated: (parsed.translated || parsed.translation || '').trim()
            };
          } catch (e) {
            return { text: candidateText.trim(), translated: '' };
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
