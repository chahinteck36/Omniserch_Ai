import { SearchResult, ResearchMode, Language, ModelResponse, DeepResearchPhase } from '../types';
import { getOpenRouterApiKey, getCustomEndpoint, getGeminiApiKey } from './modelConfigService';
import { getUserToken } from './licenseService';

export interface SearchExecutionParams {
  query: string;
  mode: ResearchMode;
  selectedModels: string[];
  file?: {
    name: string;
    content: string;
    type: string;
  };
  language: Language;
  userEmail?: string;
  demoMode?: boolean;
  onProgress?: (event: { type: string; payload?: any; [key: string]: any }) => void;
}

export interface SearchExecutionResult {
  summary?: string;
  detailedReport?: string;
  sources: Array<{ title: string; url: string; snippet?: string }>;
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
    serverLive?: boolean;
    quotaWarning?: boolean;
  };
}

/**
 * Executes a search query across resilient tiers:
 * Tier 1: Authoritative Express backend (/api/search) with user auth & quota enforcement
 * Tier 1B: Cloudflare Pages Serverless Function (/api/chat) for static edge deployments
 * Tier 2: BYOK (Bring Your Own Key) for client-side direct execution (Settings Modal)
 * Explicit Error: Returns honest error state if no provider is reachable.
 */
export async function executeUnifiedSearch(
  params: SearchExecutionParams
): Promise<SearchExecutionResult> {
  const startTime = Date.now();
  const isAr = params.language === 'ar';
  const openRouterKey = getOpenRouterApiKey();
  const customEndpoint = getCustomEndpoint();
  const userToken = getUserToken();

  // Tier 1: Express Server API (/api/search)
  let lastServerError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      // If progress callback is provided, attempt progressive SSE streaming delivery
      if (params.onProgress) {
        try {
          const streamRes = await fetch('/api/search/stream', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              query: params.query,
              mode: params.mode,
              models: params.selectedModels,
              fileContent: params.file?.content,
              fileName: params.file?.name,
              fileType: params.file?.type,
              language: params.language,
              userEmail: params.userEmail,
              demoMode: Boolean(params.demoMode),
            }),
            signal: controller.signal,
          });

          if (streamRes.ok && streamRes.body) {
            clearTimeout(timeoutId);
            const reader = streamRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalResult: SearchExecutionResult | null = null;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                  const dataStr = trimmed.slice(6);
                  if (dataStr === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.type === 'result_complete') {
                      finalResult = parsed.result;
                    } else if (parsed.type === 'quota_exhausted') {
                      throw new Error(
                        isAr
                          ? '⛔ انتهت عمليات البحث المجانية (10/10). يرجى الترقية وتفعيل كود اشتراك للمتابعة.'
                          : '⛔ Free search quota exhausted (10/10). Please redeem a license code to continue.'
                      );
                    } else if (parsed.type === 'error') {
                      throw new Error(parsed.message || parsed.error || 'Streaming error');
                    } else {
                      params.onProgress(parsed);
                    }
                  } catch (e: any) {
                    if (e.message && e.message.includes('عمليات البحث المجانية')) throw e;
                    if (e.message && e.message.includes('quota exhausted')) throw e;
                  }
                }
              }
            }

            if (finalResult) {
              return {
                ...finalResult,
                searchMetadata: {
                  ...finalResult.searchMetadata,
                  totalSources: finalResult.searchMetadata?.totalSources ?? (finalResult.sources?.length || 0),
                  serverLive: true,
                  processingTimeMs: Date.now() - startTime,
                },
              };
            }
          }
        } catch (streamErr: any) {
          if (streamErr.message && (streamErr.message.includes('عمليات البحث المجانية') || streamErr.message.includes('quota exhausted'))) {
            throw streamErr;
          }
          console.warn('[SearchService] SSE stream attempt failed, trying standard POST:', streamErr);
        }
      }

      const response = await fetch('/api/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: params.query,
          mode: params.mode,
          models: params.selectedModels,
          fileContent: params.file?.content,
          fileName: params.file?.name,
          fileType: params.file?.type,
          language: params.language,
          userEmail: params.userEmail,
          demoMode: Boolean(params.demoMode),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          ...data,
          searchMetadata: {
            ...data.searchMetadata,
            serverLive: true,
            processingTimeMs: Date.now() - startTime,
          },
        };
      } else {
        const errJson = await response.json().catch(() => null);
        if (response.status === 403 && errJson?.error === 'QUOTA_EXHAUSTED') {
          throw new Error(
            isAr
              ? '⛔ انتهت عمليات البحث المجانية (10/10). يرجى الترقية وتفعيل كود اشتراك للمتابعة.'
              : '⛔ Free search quota exhausted (10/10). Please redeem a license code to continue.'
          );
        }
        lastServerError = errJson?.message || errJson?.error || `Server status ${response.status}`;
        if (response.status === 400) {
          throw new Error(lastServerError || 'Invalid search parameters');
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('quota exhausted')) throw err;
      if (err.message && err.message.includes('عمليات البحث المجانية')) throw err;
      lastServerError = err?.message || String(err);
      console.warn(`[SearchService] Backend attempt ${attempt + 1} failed:`, lastServerError);
      if (err?.name === 'AbortError') break;
    }
  }

  // Tier 1B: Cloudflare Pages Edge Function (/api/chat)
  try {
    const cfResult = await callCloudflareChatEndpoint(params);
    if (cfResult) {
      return {
        ...cfResult,
        searchMetadata: {
          totalSources: cfResult.sources?.length || 0,
          processingTimeMs: Date.now() - startTime,
          fallbackUsed: false,
          serverLive: true,
        },
      };
    }
  } catch (cfErr) {
    console.warn('[SearchService] Cloudflare /api/chat fallback skipped:', cfErr);
  }

  // Tier 2A: BYOK Gemini Key (from client Settings Modal)
  const geminiApiKey = getGeminiApiKey();
  if (geminiApiKey && geminiApiKey.trim()) {
    try {
      const geminiResult = await callGeminiDirectly(params, geminiApiKey);
      if (geminiResult) {
        return {
          ...geminiResult,
          searchMetadata: {
            totalSources: geminiResult.sources?.length || 0,
            processingTimeMs: Date.now() - startTime,
            fallbackUsed: false,
            serverLive: false,
          },
        };
      }
    } catch (gErr) {
      console.warn('[SearchService] BYOK Gemini API call failed:', gErr);
    }
  }

  // Tier 2B: BYOK OpenRouter Key
  if (openRouterKey && openRouterKey.trim()) {
    try {
      const orResult = await callOpenRouterDirectly(params, openRouterKey, customEndpoint);
      if (orResult) {
        return {
          ...orResult,
          searchMetadata: {
            totalSources: orResult.sources?.length || 0,
            processingTimeMs: Date.now() - startTime,
            fallbackUsed: false,
            serverLive: false,
          },
        };
      }
    } catch (orErr) {
      console.warn('[SearchService] BYOK OpenRouter call failed:', orErr);
    }
  }

  // If in explicit demo mode, return designated demonstration data
  if (params.demoMode) {
    return generateDesignatedDemoResult(params, startTime);
  }

  // Explicit, Honest Error Handling: Never fabricate responses
  throw new Error(
    lastServerError ||
      (isAr
        ? 'تعذر الاتصال بمزود الذكاء الاصطناعي. يرجى التأكد من تشغيل الخادم أو إدخال مفتاح API في الإعدادات.'
        : 'AI provider is unreachable. Please verify server connectivity or provide an API key in Settings.')
  );
}

/**
 * Direct call to Google Gemini Generative Language API from client (BYOK)
 */
async function callGeminiDirectly(
  params: SearchExecutionParams,
  apiKey: string
): Promise<SearchExecutionResult | null> {
  const isAr = params.language === 'ar';
  const cleanQuery = params.query.trim();
  const startTime = Date.now();

  const model = 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  let systemPrompt = '';
  let userPrompt = cleanQuery;

  if (params.mode === 'fast') {
    systemPrompt = isAr
      ? 'أنت المحرك الذكي لمنصة OmniSearch AI. أجب بشكل مباشر ودقيق وموثوق بتنسيق Markdown.'
      : 'You are OmniSearch AI. Provide an in-depth, structured research response in clean Markdown.';
    userPrompt = `Search Query: "${cleanQuery}"${params.file ? `\nAttached file (${params.file.name}):\n${params.file.content.slice(0, 3000)}` : ''}`;
  } else if (params.mode === 'deep') {
    systemPrompt = isAr
      ? 'أنت المحرك الاستقصائي العميق لمنصة OmniSearch AI. قدم تقريراً استقصائياً مفصلاً ومنظماً.'
      : 'You are OmniSearch AI deep research engine. Generate an exhaustive, structured research report.';
  }

  const payload: any = {
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: params.mode === 'deep' ? 4096 : 2048,
    },
  };

  if (systemPrompt) {
    payload.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const latencyMs = Date.now() - startTime;
  const sources: Array<{ title: string; url: string; snippet?: string }> = [];

  // Extract grounding if available
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        sources.push({
          title: chunk.web.title || 'Web Source',
          url: chunk.web.uri,
          snippet: chunk.web.snippet,
        });
      }
    }
  }

  const takeaways = extractKeyTakeaways(text, isAr);

  if (params.mode === 'battle') {
    const selected = params.selectedModels && params.selectedModels.length > 0 ? params.selectedModels : ['gemini'];
    const modelResponses: ModelResponse[] = selected.map((mId) => {
      if (mId === 'gemini') {
        return {
          modelId: 'gemini',
          modelName: 'Google Gemini 3.1 Flash (BYOK)',
          provider: 'Google',
          badgeColor: 'from-blue-500 to-cyan-500',
          content: text,
          latencyMs,
          tokensUsed: Math.ceil(text.length / 4),
          status: 'success',
        };
      }
      return {
        modelId: mId,
        modelName: mId.toUpperCase(),
        provider: 'Provider',
        badgeColor: 'from-slate-500 to-slate-700',
        content: '',
        latencyMs: 0,
        tokensUsed: 0,
        status: 'unavailable',
        errorMessage: isAr ? 'يتطلب مفتاح مزود منفصل' : 'Requires separate provider key',
      };
    });

    return {
      summary: text.slice(0, 320) + '...',
      modelResponses,
      sources,
      keyTakeaways: takeaways,
      suggestedQueries: generateRelatedQueries(cleanQuery, isAr),
    };
  }

  if (params.mode === 'deep') {
    return {
      detailedReport: text,
      summary: text.slice(0, 400) + '...',
      sources,
      keyTakeaways: takeaways,
      deepResearchPhases: [
        { id: '1', title: isAr ? 'استكشاف الأبعاد' : 'Scoping', status: 'completed' },
        { id: '2', title: isAr ? 'التحليل المعمق' : 'Deep Synthesis', status: 'completed' },
      ],
      suggestedQueries: generateRelatedQueries(cleanQuery, isAr),
    };
  }

  return {
    summary: text,
    sources,
    keyTakeaways: takeaways,
    suggestedQueries: generateRelatedQueries(cleanQuery, isAr),
  };
}

/**
 * Direct call to OpenRouter API from client (BYOK)
 */
async function callOpenRouterDirectly(
  params: SearchExecutionParams,
  apiKey: string,
  customEndpoint?: string
): Promise<SearchExecutionResult | null> {
  const isAr = params.language === 'ar';
  const startTime = Date.now();
  const url = customEndpoint?.trim() || 'https://openrouter.ai/api/v1/chat/completions';

  const systemMessage = isAr
    ? 'أنت محرك بحث OmniSearch AI الذكي. قدم إجابة بحثية دقيقة ومنظمة بتنسيق Markdown.'
    : 'You are OmniSearch AI. Provide an in-depth, structured research response in clean Markdown.';

  const userMessage = `Search Query: "${params.query}"\nMode: ${params.mode}${
    params.file ? `\nAttached file (${params.file.name}):\n${params.file.content.slice(0, 3000)}` : ''
  }`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'OmniSearch AI (BYOK)',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return null;

  const latencyMs = Date.now() - startTime;
  const tokens = data.usage?.total_tokens || Math.ceil(text.length / 4);
  const takeaways = extractKeyTakeaways(text, isAr);

  if (params.mode === 'battle') {
    return {
      summary: text.slice(0, 320) + '...',
      modelResponses: [
        {
          modelId: 'llama3',
          modelName: 'Meta Llama 3.1 8B (BYOK)',
          provider: 'Meta / OpenRouter',
          badgeColor: 'from-purple-500 to-indigo-500',
          content: text,
          latencyMs,
          tokensUsed: tokens,
          status: 'success',
        },
      ],
      sources: [],
      keyTakeaways: takeaways,
      suggestedQueries: generateRelatedQueries(params.query, isAr),
    };
  }

  return {
    summary: text,
    detailedReport: params.mode === 'deep' ? text : undefined,
    sources: [],
    keyTakeaways: takeaways,
    suggestedQueries: generateRelatedQueries(params.query, isAr),
  };
}

/**
 * Executes a search query via Cloudflare Pages /api/chat endpoint
 */
async function callCloudflareChatEndpoint(
  params: SearchExecutionParams
): Promise<SearchExecutionResult | null> {
  const isAr = params.language === 'ar';
  const cleanQuery = params.query.trim();
  if (!cleanQuery) return null;

  const startTime = Date.now();
  const systemPrompt = isAr
    ? 'أنت محرك الذكاء الاصطناعي الشامل لـ OmniSearch AI. أجب بشكل دقيق، مفصل ومنظم باللغة العربية.'
    : 'You are the comprehensive AI engine for OmniSearch AI. Provide an accurate and well-structured response.';

  const userPrompt = `${cleanQuery}${params.file ? `\n[مرفق: ${params.file.name}]\n${params.file.content}` : ''}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!res.ok) return null;
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) return null;

  const latencyMs = Date.now() - startTime;
  const tokens = data.usage?.total_tokens || Math.ceil(answer.length / 4);
  const keyTakeaways = extractKeyTakeaways(answer, isAr);

  return {
    summary: answer.slice(0, 320) + (answer.length > 320 ? '...' : ''),
    detailedReport: params.mode === 'deep' ? answer : undefined,
    sources: [],
    keyTakeaways,
    modelResponses: [
      {
        modelId: 'llama3',
        modelName: 'Meta Llama 3.1 8B',
        provider: 'Meta / OpenRouter',
        badgeColor: 'from-blue-500 to-cyan-500',
        content: answer,
        latencyMs,
        tokensUsed: tokens,
        status: 'success',
      },
    ],
    suggestedQueries: generateRelatedQueries(cleanQuery, isAr),
  };
}

/**
 * Designated Demonstration Mode generator (Clearly marked as demo data)
 */
function generateDesignatedDemoResult(
  params: SearchExecutionParams,
  startTime: number
): SearchExecutionResult {
  const isAr = params.language === 'ar';
  const cleanQuery = params.query.trim();

  return {
    summary: isAr
      ? `[وضع العرض التجريبي] الإجابة المعاينة للاستعلام "${cleanQuery}": تم تفعيل وضع العرض التجريبي لأغراض الفحص والتطوير.`
      : `[Demonstration Mode] Preview response for "${cleanQuery}": Demonstration mode is enabled for preview purposes.`,
    sources: [],
    keyTakeaways: [isAr ? 'بيانات تجريبية لأغراض المعاينة' : 'Demonstration preview data'],
    modelResponses: [
      {
        modelId: 'gemini',
        modelName: 'Demo Model',
        provider: 'Demo Provider',
        badgeColor: 'from-blue-500 to-cyan-500',
        content: isAr ? 'هذا رد تجريبي توضيحي.' : 'This is a demonstration response.',
        latencyMs: 120,
        tokensUsed: 100,
        status: 'success',
      },
    ],
    suggestedQueries: generateRelatedQueries(cleanQuery, isAr),
    searchMetadata: {
      totalSources: 0,
      processingTimeMs: Date.now() - startTime,
      fallbackUsed: true,
      isDemonstration: true,
      serverLive: false,
    },
  };
}

function extractKeyTakeaways(text: string, _isAr: boolean): string[] {
  if (!text) return [];
  const lines = text
    .split('\n')
    .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*') || /^\d+[\.\)]\s/.test(l.trim()));
  if (lines.length >= 2) {
    return lines
      .slice(0, 4)
      .map((l) => l.replace(/^[-*•\d.)]+\s*/, '').trim())
      .filter((s) => s.length > 10 && !s.startsWith('#'));
  }
  return [];
}

function generateRelatedQueries(query: string, isAr: boolean): string[] {
  const q = query.trim().toLowerCase();
  if (q.match(/^(\d+|كم|احسب|ما ناتج|حاصل|أهلاً|مرحبا|hi|hello)/i) && q.length < 30) {
    return [];
  }
  if (isAr) {
    return [`أمثلة عملية وتطبيقات إضافية لـ ${query}`, `أهم الإيجابيات والتحديات لـ ${query}`];
  }
  return [`Practical examples and applications for ${query}`, `Key pros, cons, and alternatives to ${query}`];
}
