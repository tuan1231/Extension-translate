import { LANGUAGES, getLanguageName } from '@polyglot/shared';

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
}

export class Translator {
  private static cache = new Map<string, TranslationResult>();
  private static activeGeminiModel: string | null = null;

  /**
   * Main translate function with multi-tier failover:
   * 1. Gemini AI (if key provided or env configured)
   * 2. OpenRouter AI (if key provided or env configured)
   * 3. Google Translate endpoints (no key required, rotating endpoints)
   */
  static async translate(
    text: string,
    targetLang = 'vi',
    sourceLang = 'auto',
    options?: { geminiKey?: string; openrouterKey?: string; engine?: 'gemini' | 'openrouter' | 'google' }
  ): Promise<TranslationResult> {
    if (!text || !text.trim()) {
      return { translatedText: '', sourceLang: 'auto' };
    }

    const geminiKey = options?.geminiKey || process.env.GEMINI_API_KEY;
    const openrouterKey = options?.openrouterKey || process.env.OPENROUTER_API_KEY;
    const preferredEngine = options?.engine || (geminiKey ? 'gemini' : openrouterKey ? 'openrouter' : 'google');

    try {
      if (preferredEngine === 'gemini' && geminiKey) {
        return await this.translateGemini(text, targetLang, sourceLang, geminiKey);
      }
      if (preferredEngine === 'openrouter' && openrouterKey) {
        return await this.translateOpenRouter(text, targetLang, sourceLang, openrouterKey);
      }
      return await this.translateGoogle(text, targetLang, sourceLang);
    } catch (err) {
      console.warn('[Translator] Preferred engine failed, falling back to Google Translate:', err);
      try {
        return await this.translateGoogle(text, targetLang, sourceLang);
      } catch (fallbackErr) {
        return { translatedText: text, sourceLang: 'auto' };
      }
    }
  }

  /**
   * Translate an array of subtitle strings in batch with Gemini AI
   */
  static async translateBatch(
    texts: string[],
    targetLang = 'vi',
    geminiKey?: string
  ): Promise<string[]> {
    if (!texts.length) return [];
    const key = geminiKey || process.env.GEMINI_API_KEY;

    if (key) {
      try {
        return await this.translateBatchGemini(texts, targetLang, key);
      } catch (e) {
        console.warn('[Translator] Batch Gemini failed, using sequential Google Translate:', e);
      }
    }

    // Fallback: translate chunked with Google Translate (concurrency of 5)
    const results: string[] = [];
    for (let i = 0; i < texts.length; i += 5) {
      const chunk = texts.slice(i, i + 5);
      const translatedChunk = await Promise.all(
        chunk.map((t) => this.translateGoogle(t, targetLang, 'auto').then((r) => r.translatedText))
      );
      results.push(...translatedChunk);
    }
    return results;
  }

  /**
   * Google Translate via public endpoints
   */
  static async translateGoogle(
    text: string,
    targetLang: string,
    sourceLang = 'auto'
  ): Promise<TranslationResult> {
    const sl = sourceLang;
    const tl = targetLang;
    const cacheKey = `${sl}_${tl}_${text.trim()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const endpoints = [
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`,
      `https://translate.google.com/translate_a/single?client=at&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          let translatedText = '';
          if (Array.isArray(data)) {
            if (data[0] && Array.isArray(data[0])) {
              data[0].forEach((item: unknown) => {
                if (Array.isArray(item) && item[0]) translatedText += item[0];
              });
            } else if (typeof data[0] === 'string') {
              translatedText = data[0];
            }
          }
          if (translatedText.trim()) {
            const result: TranslationResult = {
              translatedText: translatedText.trim(),
              sourceLang: data[2] || sourceLang,
            };
            if (this.cache.size > 1000) this.cache.clear();
            this.cache.set(cacheKey, result);
            return result;
          }
        }
      } catch {
        // try next endpoint
      }
    }

    return { translatedText: text, sourceLang };
  }

  /**
   * Gemini API Translation
   */
  static async translateGemini(
    text: string,
    targetLang: string,
    sourceLang: string,
    apiKey: string
  ): Promise<TranslationResult> {
    const targetName = getLanguageName(targetLang);
    const systemPrompt = `You are a professional subtitle and text translator. Translate the text into natural ${targetName}.
Return ONLY the raw translated text. No markdown formatting, no explanations, no introductory words.`;

    const model = this.activeGeminiModel || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini translation failed: ${await res.text()}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    return { translatedText: candidate, sourceLang };
  }

  /**
   * Gemini Batch Translation for Subtitles
   */
  static async translateBatchGemini(
    texts: string[],
    targetLang: string,
    apiKey: string
  ): Promise<string[]> {
    const targetName = getLanguageName(targetLang);
    const systemPrompt = `You are an expert subtitle translator. Translate each subtitle line in the input JSON array into ${targetName}.
RULES:
1. Return ONLY a valid JSON array of strings: ["line 1 translation", "line 2 translation", ...]
2. The output array MUST have exactly ${texts.length} items matching the input array indices.
3. Keep the translation natural and concise.
4. Output raw JSON string only, no code blocks.`;

    const model = this.activeGeminiModel || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(texts) }] }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini batch failed: ${await res.text()}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return texts;

    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : texts;
  }

  /**
   * OpenRouter AI Translation
   */
  static async translateOpenRouter(
    text: string,
    targetLang: string,
    sourceLang: string,
    apiKey: string
  ): Promise<TranslationResult> {
    const targetName = getLanguageName(targetLang);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://polyglot-learn.vercel.app',
        'X-Title': 'Polyglot Learn Web',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: `Translate the user's input into natural ${targetName}. Return ONLY the translated string without formatting.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter failed: ${await res.text()}`);
    }

    const data = await res.json();
    const candidate = data.choices?.[0]?.message?.content?.trim() || text;
    return { translatedText: candidate, sourceLang };
  }
}
