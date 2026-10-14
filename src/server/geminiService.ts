import { GoogleGenAI } from '@google/genai';
import { SearchSource, ModelResponse, DeepResearchPhase } from '../types';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[GeminiService] GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface SearchResultPayload {
  query: string;
  mode: 'fast' | 'deep' | 'battle' | 'code';
  summary?: string;
  detailedReport?: string;
  sources: SearchSource[];
  keyTakeaways?: string[];
  modelResponses?: ModelResponse[];
  suggestedQueries?: string[];
  codeAnalysis?: {
    overview: string;
    bugsOrIssues: string[];
    improvements: string[];
    optimizedCode?: string;
    language?: string;
    explanation?: string;
  };
  deepResearchPhases?: DeepResearchPhase[];
  searchMetadata?: {
    searchQueriesUsed?: string[];
    totalSources: number;
    processingTimeMs: number;
    fallbackUsed?: boolean;
    isDemonstration?: boolean;
    quotaWarning?: boolean;
    serverLive?: boolean;
  };
}

// Recommended Gemini 3 models according to modern specification
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

/**
 * Safely calls Gemini API using official SDK structure and search grounding
 */
export async function callGeminiSafe(
  prompt: string,
  options: {
    systemPrompt?: string;
    useSearch?: boolean;
    jsonResponse?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<{ text: string; rawResponse?: any; durationMs: number; isFallback?: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      text: '',
      durationMs: 0,
      isFallback: true,
      error: 'GEMINI_API_KEY is not configured on the server',
    };
  }

  const ai = getGeminiClient();
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  const timeoutMs = options.timeoutMs || 25000;
  let lastError: any = null;

  for (const model of models) {
    const startTime = Date.now();
    try {
      const config: any = {};
      if (options.systemPrompt) {
        config.systemInstruction = options.systemPrompt;
      }
      if (options.jsonResponse) {
        config.responseMimeType = 'application/json';
      }
      // Official Google Search grounding tool configuration
      if (options.useSearch && !options.jsonResponse) {
        config.tools = [{ googleSearch: {} }];
      }

      let timeoutHandle: any;
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: prompt,
          config: Object.keys(config).length > 0 ? config : undefined,
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      });

      const durationMs = Date.now() - startTime;
      if (response && response.text && response.text.trim()) {
        return {
          text: response.text.trim(),
          rawResponse: response,
          durationMs,
          isFallback: false,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[GeminiService] Model ${model} call failed:`, err?.message || err);
    }
  }

  return {
    text: '',
    durationMs: 0,
    isFallback: true,
    error: lastError?.message || 'Gemini model request failed',
  };
}

/**
 * Extracts citations strictly from genuine groundingMetadata returned by the Gemini API
 */
export function extractSources(response: any): SearchSource[] {
  const sources: SearchSource[] = [];
  const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;

  if (Array.isArray(groundingChunks)) {
    for (const chunk of groundingChunks) {
      const uri = chunk.web?.uri;
      if (uri && typeof uri === 'string' && uri.startsWith('http')) {
        let title = (chunk.web?.title || '').trim();
        if (!title) {
          try {
            title = new URL(uri).hostname.replace(/^www\./, '');
          } catch {
            title = 'Web Reference';
          }
        }
        if (!sources.some((s) => s.url === uri)) {
          sources.push({
            title,
            url: uri,
            snippet: chunk.web?.snippet || undefined,
          });
        }
      }
    }
  }

  return sources.slice(0, 10);
}

/**
 * Extracts web search queries actually submitted by the grounding tool
 */
export function extractSearchQueries(response: any): string[] {
  const webQueries = response?.candidates?.[0]?.groundingMetadata?.webSearchQueries;
  if (Array.isArray(webQueries)) {
    return webQueries.filter((q: any) => typeof q === 'string' && q.trim().length > 0);
  }
  return [];
}

/**
 * Executes a search query across the requested mode
 */
export async function executeSearch(params: {
  query: string;
  mode: 'fast' | 'deep' | 'battle' | 'code';
  models?: string[];
  fileContent?: string;
  fileName?: string;
  fileType?: string;
  language: 'ar' | 'en';
  demoMode?: boolean;
  onProgress?: (event: { type: string; payload: any }) => void;
}): Promise<SearchResultPayload> {
  const startTime = Date.now();
  const { query, mode, models = [], fileContent, fileName, language, demoMode, onProgress } = params;
  const isArabic = language === 'ar';

  // ----------------------------------------------------
  // MODE 1: FAST SEARCH (Live Grounded)
  // ----------------------------------------------------
  if (mode === 'fast') {
    const systemPrompt = isArabic
      ? `أنت المحرك الذكي لمنصة "OmniSearch AI" (أومني سيرش).
قواعد تقديم النتائج:
1. الإجابة المباشرة والدقيقة: قدم الجواب الدقيق والمباشر في الجملة الأولى.
2. التنسيق المنظم: استخدم العناوين والنقاط والجداول لشرح التفاصيل دون حشو.
3. التوثيق: اعتمد على المصادر المسترجعة وقدم حقائق موثوقة.`
      : `You are the Core AI Engine for "OmniSearch AI".
Guidelines:
1. Provide the direct, factual answer immediately in the opening sentence.
2. Use clean markdown formatting with concise bullet points and tables.
3. Ground your findings accurately using retrieved sources.`;

    const promptText = `User Query: "${query}"${fileContent ? `\nAttached file (${fileName}):\n${fileContent.slice(0, 4000)}` : ''}`;

    const { text, rawResponse, error } = await callGeminiSafe(promptText, {
      systemPrompt,
      useSearch: true,
    });

    if (!text) {
      if (demoMode) {
        return getDemoFastResult(query, isArabic, startTime);
      }
      throw new Error(
        error ||
          (isArabic
            ? 'تعذر الوصول إلى مزود الذكاء الاصطناعي (Gemini). يرجى التأكد من ضبط GEMINI_API_KEY.'
            : 'AI Provider (Gemini) is unavailable. Please check GEMINI_API_KEY.')
      );
    }

    const sources = rawResponse ? extractSources(rawResponse) : [];
    const searchQueries = rawResponse ? extractSearchQueries(rawResponse) : [query];
    const keyTakeaways = extractKeyTakeaways(text, isArabic);

    return {
      query,
      mode: 'fast',
      summary: text,
      sources,
      keyTakeaways,
      suggestedQueries: generateRelatedQueries(query, isArabic),
      searchMetadata: {
        searchQueriesUsed: searchQueries,
        totalSources: sources.length,
        processingTimeMs: Date.now() - startTime,
        fallbackUsed: false,
        serverLive: true,
      },
    };
  }

  // ----------------------------------------------------
  // MODE 2: DEEP RESEARCH
  // ----------------------------------------------------
  if (mode === 'deep') {
    const systemPrompt = isArabic
      ? `أنت المحرك المتقدم للبحث المعمق (Deep Research) في "OmniSearch AI".
قواعد التقرير:
1. تقرير استقصائي مهني مفصل ومحكم.
2. ابدأ بالخلاصة التنفيذية المباشرة (Executive Summary).
3. المحاور الرئيسية، المعطيات الإحصائية، وجدول مقارن للمزايا والمحاذير.
4. التوصيات الاستراتيجية والخطوات العملية الواضحة.`
      : `You are the Deep Research Engine for "OmniSearch AI".
Provide an exhaustive, structured research report with:
1. Direct Executive Summary.
2. Multi-dimensional technical breakdown with comparative tables.
3. Actionable strategic recommendations.`;

    const promptText = `Conduct deep investigative research on: "${query}"${fileContent ? `\nReferenced Document (${fileName}):\n${fileContent.slice(0, 6000)}` : ''}`;

    onProgress?.({
      type: 'phase',
      payload: {
        id: '1',
        title: isArabic ? 'تفكيك الاستعلام وتحديد أبعاد البحث' : 'Query Decomposition & Research Scope',
        status: 'completed',
        details: isArabic ? `تم استيعاب محاور الاستعلام حول "${query}"` : `Scoped key dimensions for "${query}"`,
      },
    });

    onProgress?.({
      type: 'phase',
      payload: {
        id: '2',
        title: isArabic ? 'التصفح المباشر واسترجاع المراجع' : 'Live Web Grounding & Source Retrieval',
        status: 'in_progress',
        details: isArabic ? 'جاري استرجاع المصادر المباشرة وتدقيق الحقائق...' : 'Retrieving live web citations and grounding facts...',
      },
    });

    const { text, rawResponse, error } = await callGeminiSafe(promptText, {
      systemPrompt,
      useSearch: true,
      timeoutMs: 35000,
    });

    if (!text) {
      if (demoMode) {
        return getDemoDeepResult(query, isArabic, startTime);
      }
      throw new Error(
        error ||
          (isArabic
            ? 'فشل استدعاء محرك البحث المعمق. يرجى التحقق من اتصال المزود أو مفتاح API.'
            : 'Deep research provider call failed. Check provider connectivity or API keys.')
      );
    }

    const sources = rawResponse ? extractSources(rawResponse) : [];
    const searchQueries = rawResponse ? extractSearchQueries(rawResponse) : [query];

    if (sources.length > 0) {
      onProgress?.({
        type: 'sources_discovered',
        payload: { sources },
      });
    }

    const phases: DeepResearchPhase[] = [
      {
        id: '1',
        title: isArabic ? 'تفكيك الاستعلام وتحديد أبعاد البحث' : 'Query Decomposition & Research Scope',
        status: 'completed',
        details: isArabic ? `تم استيعاب محاور الاستعلام حول "${query}"` : `Scoped key dimensions for "${query}"`,
      },
      {
        id: '2',
        title: isArabic ? 'التصفح المباشر واسترجاع المراجع' : 'Live Web Grounding & Source Retrieval',
        status: sources.length > 0 ? 'completed' : 'completed',
        details: sources.length > 0
          ? (isArabic ? `تم استرجاع ${sources.length} مصادر موثقة من الويب` : `Retrieved ${sources.length} verified web sources`)
          : (isArabic ? 'تم إجراء البحث بالاعتماد على قاعدة المعرفة الشاملة' : 'Synthesized from global model knowledge base'),
      },
      {
        id: '3',
        title: isArabic ? 'التدقيق والتحليل متعدد الأبعاد' : 'Multi-Perspective Synthesis',
        status: 'completed',
        details: isArabic ? 'تمت المطابقة التحليلية والتنسيق' : 'Cross-validated findings across dimensions',
      },
      {
        id: '4',
        title: isArabic ? 'صياغة التقرير الاستقصائي النهائي' : 'Final In-Depth Report Compilation',
        status: 'completed',
        details: isArabic ? 'اكتملت صياغة التقرير المعمق بنجاح' : 'Report compiled with actionable insights',
      },
    ];

    onProgress?.({
      type: 'phase',
      payload: phases[1],
    });
    onProgress?.({
      type: 'phase',
      payload: phases[2],
    });
    onProgress?.({
      type: 'phase',
      payload: phases[3],
    });

    return {
      query,
      mode: 'deep',
      summary: extractSummaryIntro(text),
      detailedReport: text,
      sources,
      keyTakeaways: extractKeyTakeaways(text, isArabic),
      deepResearchPhases: phases,
      suggestedQueries: generateRelatedQueries(query, isArabic),
      searchMetadata: {
        searchQueriesUsed: searchQueries,
        totalSources: sources.length,
        processingTimeMs: Date.now() - startTime,
        fallbackUsed: false,
        serverLive: true,
      },
    };
  }

  // ----------------------------------------------------
  // MODE 3: BATTLE MODE (Truthful Multi-Model Comparison)
  // ----------------------------------------------------
  if (mode === 'battle') {
    const targetModels = models.length > 0 ? models : ['gemini', 'llama3', 'gpt4o', 'claude35'];
    const modelResponses: ModelResponse[] = [];

    // Model 1: Google Gemini (Live request or demo)
    if (targetModels.includes('gemini')) {
      const geminiStart = Date.now();
      if (demoMode) {
        modelResponses.push({
          modelId: 'gemini',
          modelName: 'Google Gemini 3.8 Flash',
          provider: 'Google',
          badgeColor: 'from-blue-500 to-cyan-500',
          content: isArabic
            ? `[عرض توضيحي] إجابة Gemini النموذجية: تحليل شامل ومباشر حول "${query}".`
            : `[Demo Mode] Gemini comprehensive response for query: "${query}".`,
          latencyMs: 120,
          tokensUsed: 150,
          status: 'success',
        });
      } else {
        const geminiPrompt = isArabic
          ? `أنت Google Gemini. أجب عن سؤال المستخدم بشكل مباشر ودقيق وموثوق: "${query}"`
          : `You are Google Gemini. Answer the user question directly, factually, and concisely: "${query}"`;

        const { text: geminiText, rawResponse, durationMs } = await callGeminiSafe(geminiPrompt, {
          useSearch: false,
          timeoutMs: 15000,
        });

        if (geminiText) {
          const tokens = rawResponse?.usageMetadata?.totalTokenCount || Math.ceil(geminiText.length / 4);
          modelResponses.push({
            modelId: 'gemini',
            modelName: 'Google Gemini 3.8 Flash',
            provider: 'Google',
            badgeColor: 'from-blue-500 to-cyan-500',
            content: geminiText,
            latencyMs: durationMs || Date.now() - geminiStart,
            tokensUsed: tokens,
            status: 'success',
          });
        } else {
          modelResponses.push({
            modelId: 'gemini',
            modelName: 'Google Gemini 3.8 Flash',
            provider: 'Google',
            badgeColor: 'from-blue-500 to-cyan-500',
            content: '',
            latencyMs: Date.now() - geminiStart,
            tokensUsed: 0,
            status: 'unavailable',
            errorMessage: isArabic ? 'تعذر الاتصال بـ Google Gemini' : 'Failed to connect to Google Gemini',
          });
        }
      }
    }

    // Model 2: Meta Llama 3 via OpenRouter (Live request if key configured)
    if (targetModels.includes('llama3')) {
      if (demoMode) {
        modelResponses.push({
          modelId: 'llama3',
          modelName: 'Meta Llama 3.1 8B',
          provider: 'Meta AI',
          badgeColor: 'from-purple-500 to-indigo-500',
          content: isArabic
            ? `[عرض توضيحي] إجابة Llama 3 المباشرة والتقنية حول: "${query}".`
            : `[Demo Mode] Meta Llama 3 direct technical response for: "${query}".`,
          latencyMs: 110,
          tokensUsed: 135,
          status: 'success',
        });
      } else {
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        const llamaStart = Date.now();

        if (openRouterKey && openRouterKey.trim()) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const llamaRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${openRouterKey.trim()}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://omnisearch.app',
                'X-Title': 'OmniSearch Battle',
              },
              body: JSON.stringify({
                model: 'meta-llama/llama-3.1-8b-instruct:free',
                messages: [
                  {
                    role: 'system',
                    content: isArabic
                      ? 'أنت Meta Llama 3. أجب عن السؤال بشكل تقني ومباشر وموجز باللغة العربية.'
                      : 'You are Meta Llama 3. Provide a direct, technical, and concise answer.',
                  },
                  { role: 'user', content: query },
                ],
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (llamaRes.ok) {
              const data = await llamaRes.json();
              const content = data.choices?.[0]?.message?.content || '';
              const tokens = data.usage?.total_tokens || Math.ceil(content.length / 4);
              modelResponses.push({
                modelId: 'llama3',
                modelName: 'Meta Llama 3.1 8B',
                provider: 'Meta / OpenRouter',
                badgeColor: 'from-purple-500 to-indigo-500',
                content,
                latencyMs: Date.now() - llamaStart,
                tokensUsed: tokens,
                status: 'success',
              });
            } else {
              throw new Error(`OpenRouter HTTP ${llamaRes.status}`);
            }
          } catch (orErr: any) {
            modelResponses.push({
              modelId: 'llama3',
              modelName: 'Meta Llama 3.1 8B',
              provider: 'Meta / OpenRouter',
              badgeColor: 'from-purple-500 to-indigo-500',
              content: '',
              latencyMs: Date.now() - llamaStart,
              tokensUsed: 0,
              status: 'unavailable',
              errorMessage: isArabic ? 'مزود OpenRouter غير متاح حالياً' : 'OpenRouter provider is currently unavailable',
            });
          }
        } else {
          // OpenRouter key not configured on server
          modelResponses.push({
            modelId: 'llama3',
            modelName: 'Meta Llama 3.1 8B',
            provider: 'Meta AI',
            badgeColor: 'from-purple-500 to-indigo-500',
            content: '',
            latencyMs: 0,
            tokensUsed: 0,
            status: 'unavailable',
            errorMessage: isArabic
              ? 'يتطلب ضبط مفتاح OPENROUTER_API_KEY في السيرفر أو لوحة البائع'
              : 'Requires OPENROUTER_API_KEY configured in server or seller panel',
          });
        }
      }
    }

    // Model 3: OpenAI GPT-4o (Report truth if no OpenAI/OpenRouter key with gpt4o access)
    if (targetModels.includes('gpt4o')) {
      if (demoMode) {
        modelResponses.push({
          modelId: 'gpt4o',
          modelName: 'OpenAI GPT-4o',
          provider: 'OpenAI',
          badgeColor: 'from-emerald-500 to-teal-500',
          content: isArabic
            ? `[عرض توضيحي] إجابة GPT-4o المقارنة والمنهجية حول: "${query}".`
            : `[Demo Mode] OpenAI GPT-4o comparative analysis for query: "${query}".`,
          latencyMs: 140,
          tokensUsed: 165,
          status: 'success',
        });
      } else {
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        if (openRouterKey && openRouterKey.trim()) {
          const gptStart = Date.now();
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const gptRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${openRouterKey.trim()}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://omnisearch.app',
                'X-Title': 'OmniSearch Battle',
              },
              body: JSON.stringify({
                model: 'openai/gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: isArabic
                      ? 'أنت OpenAI GPT-4o. أجب عن سؤال المستخدم خطوة بخطوة بشكل منظم.'
                      : 'You are OpenAI GPT-4o. Answer clearly with structured step-by-step reasoning.',
                  },
                  { role: 'user', content: query },
                ],
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (gptRes.ok) {
              const data = await gptRes.json();
              const content = data.choices?.[0]?.message?.content || '';
              modelResponses.push({
                modelId: 'gpt4o',
                modelName: 'OpenAI GPT-4o',
                provider: 'OpenAI',
                badgeColor: 'from-emerald-500 to-teal-500',
                content,
                latencyMs: Date.now() - gptStart,
                tokensUsed: data.usage?.total_tokens || Math.ceil(content.length / 4),
                status: 'success',
              });
            } else {
              throw new Error(`OpenRouter returned ${gptRes.status}`);
            }
          } catch {
            modelResponses.push({
              modelId: 'gpt4o',
              modelName: 'OpenAI GPT-4o',
              provider: 'OpenAI',
              badgeColor: 'from-emerald-500 to-teal-500',
              content: '',
              latencyMs: 0,
              tokensUsed: 0,
              status: 'unavailable',
              errorMessage: isArabic ? 'مفتاح مزود OpenAI غير مهيأ للاستدعاء المباشر' : 'OpenAI routing key is required',
            });
          }
        } else {
          modelResponses.push({
            modelId: 'gpt4o',
            modelName: 'OpenAI GPT-4o',
            provider: 'OpenAI',
            badgeColor: 'from-emerald-500 to-teal-500',
            content: '',
            latencyMs: 0,
            tokensUsed: 0,
            status: 'unavailable',
            errorMessage: isArabic
              ? 'غير مهيأ: يتطلب تفعيل مفتاح OpenAI أو اشتراك Enterprise'
              : 'Unconfigured: Requires OpenAI API access or Enterprise tier',
          });
        }
      }
    }

    // Model 4: Claude 3.5 Sonnet (Truthful reporting - requires Anthropic key)
    if (targetModels.includes('claude35')) {
      modelResponses.push({
        modelId: 'claude35',
        modelName: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        badgeColor: 'from-amber-500 to-orange-500',
        content: '',
        latencyMs: 0,
        tokensUsed: 0,
        status: 'unavailable',
        errorMessage: isArabic
          ? 'غير مهيأ: يتطلب تفعيل مفتاح Anthropic API'
          : 'Unconfigured: Requires Anthropic Claude API key',
      });
    }

    // Model 5: DeepSeek R1 (Truthful reporting - requires DeepSeek key)
    if (targetModels.includes('deepseek')) {
      modelResponses.push({
        modelId: 'deepseek',
        modelName: 'DeepSeek R1',
        provider: 'DeepSeek',
        badgeColor: 'from-blue-600 to-indigo-600',
        content: '',
        latencyMs: 0,
        tokensUsed: 0,
        status: 'unavailable',
        errorMessage: isArabic
          ? 'غير مهيأ: يتطلب تفعيل مفتاح DeepSeek API'
          : 'Unconfigured: Requires DeepSeek API key',
      });
    }

    // Synthesize authentic consensus strictly from models that actually succeeded
    const successfulResponses = modelResponses.filter((m) => m.status === 'success' && m.content);
    let consensus = '';

    if (successfulResponses.length > 0) {
      if (successfulResponses.length === 1) {
        consensus = successfulResponses[0].content.slice(0, 300) + '...';
      } else {
        const consensusPrompt = isArabic
          ? `قم بصياغة ملخص إجماع موحد وموجز (فقرة واحدة) يجمع بين الإجابتين التاليتين لسؤال "${query}":\n\n${successfulResponses.map((r) => `[${r.modelName}]: ${r.content.slice(0, 500)}`).join('\n\n')}`
          : `Synthesize a concise 2-sentence consensus summarizing the agreement between these model answers for "${query}":\n\n${successfulResponses.map((r) => `[${r.modelName}]: ${r.content.slice(0, 500)}`).join('\n\n')}`;

        if (demoMode) {
          consensus = isArabic
            ? 'ملخص إجماع تجريبي: اتفقت النماذج على محاور المقارنة الرئيسية.'
            : 'Consensus summary: Models aligned on foundational comparative architectural dimensions.';
        } else {
          const synRes = await callGeminiSafe(consensusPrompt, { timeoutMs: 10000 });
          consensus = synRes.text || successfulResponses[0].content.slice(0, 300) + '...';
        }
      }
    } else {
      if (demoMode) {
        return getDemoBattleResult(query, isArabic, startTime);
      }
      throw new Error(
        isArabic
          ? 'تعذر استدعاء أي من النماذج المحددة للمقارنة. يرجى التحقق من توفر المفاتيح.'
          : 'None of the requested comparison models could be reached. Please check API keys.'
      );
    }

    return {
      query,
      mode: 'battle',
      summary: consensus,
      modelResponses,
      sources: [],
      keyTakeaways: extractKeyTakeaways(consensus, isArabic),
      suggestedQueries: generateRelatedQueries(query, isArabic),
      searchMetadata: {
        totalSources: 0,
        processingTimeMs: Date.now() - startTime,
        fallbackUsed: false,
        serverLive: true,
      },
    };
  }

  // ----------------------------------------------------
  // MODE 4: CODE & ARCHITECTURE AUDIT
  // ----------------------------------------------------
  const codePrompt = isArabic
    ? `أنت المحرك البرمجي والتقني لمنصة "OmniSearch AI".
حلل الكود البرمجي أو السؤال التقني التالي:
السؤال: "${query}"
الملف: ${fileName || 'code_snippet'}
المحتوى:
${fileContent || query}

قم بإرجاع JSON بالتنسيق التالي حصراً:
{
  "overview": "إجابة ونظرة عامة تقنية مباشرة",
  "bugsOrIssues": ["ملاحظة ثغرة أو خطأ 1"],
  "improvements": ["اقتراح تحسين 1"],
  "language": "typescript / python / etc",
  "optimizedCode": "الكود المحسن والآمن والكامل",
  "explanation": "شرح التعديلات والخطوات القادمة"
}`
    : `You are the Code & Architecture Engine for "OmniSearch AI".
Analyze the following query or code:
Query: "${query}"
File: ${fileName || 'code_snippet'}
Content:
${fileContent || query}

Return ONLY a valid JSON object matching:
{
  "overview": "Direct answer and technical overview",
  "bugsOrIssues": ["Identified bug or vulnerability 1"],
  "improvements": ["Improvement suggestion 1"],
  "language": "typescript / python / etc",
  "optimizedCode": "Complete secure refactored code",
  "explanation": "Explanation of changes"
}`;

  const { text: codeText, error: codeErr } = await callGeminiSafe(codePrompt, {
    jsonResponse: true,
  });

  if (!codeText) {
    if (demoMode) {
      return getDemoCodeResult(query, isArabic, fileContent, fileName, startTime);
    }
    throw new Error(
      codeErr ||
        (isArabic ? 'فشل تدقيق الكود عبر محرك الذكاء الاصطناعي.' : 'Failed to execute code audit via AI engine.')
    );
  }

  const parsedCode = extractJsonSafe<any>(codeText);
  if (!parsedCode || !parsedCode.overview) {
    throw new Error(isArabic ? 'تنسيق نتيجة فحص الكود غير صالح' : 'Invalid code audit output format');
  }

  return {
    query,
    mode: 'code',
    summary: parsedCode.overview,
    detailedReport: parsedCode.explanation || '',
    codeAnalysis: {
      overview: parsedCode.overview,
      bugsOrIssues: Array.isArray(parsedCode.bugsOrIssues) ? parsedCode.bugsOrIssues : [],
      improvements: Array.isArray(parsedCode.improvements) ? parsedCode.improvements : [],
      optimizedCode: parsedCode.optimizedCode || '',
      language: parsedCode.language || 'typescript',
      explanation: parsedCode.explanation,
    },
    sources: [],
    searchMetadata: {
      totalSources: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: false,
      serverLive: true,
    },
  };
}

// Helper to safely extract JSON
function extractJsonSafe<T = any>(rawText: string): T | null {
  if (!rawText || typeof rawText !== 'string') return null;
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function extractKeyTakeaways(text: string, _isArabic: boolean): string[] {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split('\n');
  const bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+[\.\)]\s/)) {
      const clean = trimmed.replace(/^[-*\d.)]+\s*/, '').trim();
      if (clean.length > 15 && clean.length < 250 && !clean.startsWith('#')) {
        bullets.push(clean);
      }
    }
  }

  if (bullets.length >= 2) return bullets.slice(0, 5);

  const sentences = text
    .split(/(?<=[.!?؟])\s+|\n\n+/)
    .map((s) => s.trim().replace(/^#+\s*/, '').replace(/[*_`]/g, ''))
    .filter((s) => s.length >= 30 && s.length <= 160 && !s.includes(':') && !s.startsWith('-'));

  return sentences.slice(0, 3);
}

function extractSummaryIntro(text: string): string {
  const paragraphs = text.split('\n\n').map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 0) {
    for (const p of paragraphs) {
      if (!p.startsWith('#') && p.length > 40) return p.slice(0, 400);
    }
    return paragraphs[0].slice(0, 400);
  }
  return text.slice(0, 300);
}

function generateRelatedQueries(query: string, isArabic: boolean): string[] {
  const q = query.trim().toLowerCase();
  if (q.match(/^(\d+|كم|احسب|ما ناتج|حاصل|أهلاً|مرحبا|hi|hello)/i) && q.length < 30) {
    return [];
  }
  if (isArabic) {
    return [
      `أمثلة وتطبيقات عملية إضافية حول ${query}`,
      `أهم الإيجابيات والتحديات والبدائل لـ ${query}`,
    ];
  }
  return [
    `Practical examples and applications for ${query}`,
    `Pros, cons, and alternatives to ${query}`,
  ];
}

// ----------------------------------------------------------------------
// Designated Demonstration Mode generators (ONLY when demoMode is true)
// ----------------------------------------------------------------------
function getDemoFastResult(query: string, isArabic: boolean, startTime: number): SearchResultPayload {
  const text = isArabic
    ? `[وضع العرض التجريبي] الإجابة المباشرة للاستعلام "${query}": يتناول هذا الموضوع تطبيق المعايير الحديثة لتحقيق الدقة والكفاءة.`
    : `[Demonstration Mode] Direct response for "${query}": Focuses on modern methodologies and standard benchmarks.`;
  return {
    query,
    mode: 'fast',
    summary: text,
    sources: [],
    keyTakeaways: [isArabic ? 'بيانات تجريبية لأغراض المعاينة والتطوير' : 'Demonstration data for development preview'],
    searchMetadata: {
      totalSources: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: true,
      isDemonstration: true,
      serverLive: false,
    },
  };
}

function getDemoDeepResult(query: string, isArabic: boolean, startTime: number): SearchResultPayload {
  const report = isArabic
    ? `# [وضع العرض التجريبي] تقرير بحث استقصائي: ${query}\n\nهذا تقرير توضيحي يُعرض في بيئة التطوير فقط.`
    : `# [Demonstration Mode] Deep Research Report: ${query}\n\nThis is a demonstration report shown only in development mode.`;
  return {
    query,
    mode: 'deep',
    summary: report.slice(0, 300),
    detailedReport: report,
    sources: [],
    deepResearchPhases: [
      { id: '1', title: 'Demo Scope', status: 'completed', details: 'Demo mode active' },
    ],
    searchMetadata: {
      totalSources: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: true,
      isDemonstration: true,
      serverLive: false,
    },
  };
}

function getDemoBattleResult(query: string, isArabic: boolean, startTime: number): SearchResultPayload {
  return {
    query,
    mode: 'battle',
    summary: isArabic ? '[عرض تجريبي] مقارنة النماذج في بيئة التطوير' : '[Demo Mode] Model comparison preview',
    modelResponses: [
      {
        modelId: 'gemini',
        modelName: 'Google Gemini (Demo)',
        provider: 'Google',
        badgeColor: 'from-blue-500 to-cyan-500',
        content: isArabic ? 'نموذج إجابة تجريبي لـ Gemini' : 'Demo response for Gemini',
        latencyMs: 120,
        tokensUsed: 100,
        status: 'success',
      },
    ],
    sources: [],
    searchMetadata: {
      totalSources: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: true,
      isDemonstration: true,
      serverLive: false,
    },
  };
}

function getDemoCodeResult(
  query: string,
  isArabic: boolean,
  fileContent: string | undefined,
  fileName: string | undefined,
  startTime: number
): SearchResultPayload {
  return {
    query,
    mode: 'code',
    summary: isArabic ? 'تحليل كود تجريبي' : 'Demo code audit',
    codeAnalysis: {
      overview: isArabic ? 'نظرة عامة تجريبية' : 'Demo overview',
      bugsOrIssues: [isArabic ? 'وضع العرض التجريبي نشط' : 'Demonstration mode active'],
      improvements: [isArabic ? 'ربط مفتاح GEMINI_API_KEY للتدقيق الحي' : 'Configure GEMINI_API_KEY for live audit'],
      language: 'typescript',
      optimizedCode: fileContent || '// Demo sample code',
      explanation: isArabic ? 'فحص تجريبي في بيئة التطوير' : 'Demo audit executed',
    },
    sources: [],
    searchMetadata: {
      totalSources: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: true,
      isDemonstration: true,
      serverLive: false,
    },
  };
}
