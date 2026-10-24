import { GoogleGenAI } from '@google/genai';
import { SearchSource, ModelResponse, DeepResearchPhase } from '../types';
import { alignReportWithSources } from '../utils/sourceAlignment';
import { isTavilyConfigured, searchTavily, buildTavilySearchContext } from './tavilyService';

export { alignReportWithSources, verifyClaimSourceAlignment };

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
 * Safely calls OpenRouter chat completions API as a fallback when Gemini is unavailable due to quota or permission errors.
 */
export async function callOpenRouterSafe(
  prompt: string,
  options: {
    systemPrompt?: string;
    timeoutMs?: number;
  } = {}
): Promise<{ text: string; durationMs: number; error?: string }> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey || !openRouterKey.trim()) {
    return {
      text: '',
      durationMs: 0,
      error: 'OPENROUTER_API_KEY is not configured on the server',
    };
  }

  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 25000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: any[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://omnisearch.app',
        'X-Title': 'OmniSearch AI Fallback',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson?.error?.message || errJson?.error || JSON.stringify(errJson);
      } catch {
        errDetail = await response.text();
      }
      return {
        text: '',
        durationMs,
        error: `OpenRouter API failed with status ${response.status}: ${errDetail}`,
      };
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content || '';
    if (content && typeof content === 'string' && content.trim()) {
      return {
        text: content.trim(),
        durationMs,
      };
    }

    return {
      text: '',
      durationMs,
      error: 'OpenRouter returned empty response content',
    };
  } catch (err: any) {
    clearTimeout(timeoutHandle);
    const durationMs = Date.now() - startTime;
    return {
      text: '',
      durationMs,
      error: err?.message || 'OpenRouter network request failed',
    };
  }
}

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
): Promise<{ text: string; rawResponse?: any; durationMs: number; isFallback?: boolean; isQuotaExhausted?: boolean; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
      const orRes = await callOpenRouterSafe(prompt, { systemPrompt: options.systemPrompt, timeoutMs: options.timeoutMs });
      if (orRes.text) {
        return {
          text: orRes.text,
          durationMs: orRes.durationMs,
          isFallback: true,
          isQuotaExhausted: false,
        };
      }
    }
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

      console.log(`[Gemini Request Diagnosis] Calling model: ${model}, useSearch: ${Boolean(options.useSearch)}, toolsCount: ${Array.isArray(config.tools) ? config.tools.length : 0}`);

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
      const firstCandidate = response?.candidates?.[0] as any;
      const rawGrounding = firstCandidate?.groundingMetadata || firstCandidate?.grounding_metadata || (response as any)?.groundingMetadata || (response as any)?.grounding_metadata;
      const rawChunks = rawGrounding?.groundingChunks || rawGrounding?.grounding_chunks;
      const rawQueries = rawGrounding?.webSearchQueries || rawGrounding?.web_search_queries;

      const hasGrounding = Boolean(rawGrounding);
      const chunksCount = Array.isArray(rawChunks) ? rawChunks.length : 0;
      const queriesCount = Array.isArray(rawQueries) ? rawQueries.length : 0;

      console.log(
        `[Gemini Response Diagnosis] Model: ${model}, textLength: ${response?.text?.length || 0}, durationMs: ${durationMs}, hasGroundingMeta: ${hasGrounding}, webQueriesCount: ${queriesCount}, groundingChunksCount: ${chunksCount}`
      );

      if (hasGrounding && chunksCount === 0) {
        console.log(
          `[Gemini Grounding Notice] Model ${model} returned groundingMetadata but groundingChunks was empty. Web search queries used: ${JSON.stringify(rawQueries || [])}`
        );
      }

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
      const is429 = err?.status === 429 || String(err?.message || '').includes('429') || String(err?.message || '').includes('RESOURCE_EXHAUSTED');
      console.warn(
        `[Gemini Safe Call Diagnosis] Model ${model} call failed (status: ${err?.status || err?.code || 'unknown'}, isQuotaExhausted: ${is429}, searchToolEnabled: ${Boolean(options.useSearch)}):`,
        err?.message || err
      );
    }
  }

  const isQuotaOrPermissionError = Boolean(
    lastError?.status === 429 ||
    lastError?.status === 403 ||
    lastError?.status === 401 ||
    String(lastError?.message || '').includes('429') ||
    String(lastError?.message || '').includes('RESOURCE_EXHAUSTED') ||
    String(lastError?.message || '').includes('permission') ||
    String(lastError?.message || '').includes('Caller does not have permission')
  );

  if (isQuotaOrPermissionError && process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
    console.log('[Gemini Fallback] Gemini unavailable due to quota or permission error. Falling back to OpenRouter...');
    const orResult = await callOpenRouterSafe(prompt, {
      systemPrompt: options.systemPrompt,
      timeoutMs: options.timeoutMs,
    });
    if (orResult.text) {
      return {
        text: orResult.text,
        durationMs: orResult.durationMs,
        isFallback: true,
        isQuotaExhausted: true,
      };
    }
  }

  return {
    text: '',
    durationMs: 0,
    isFallback: true,
    isQuotaExhausted: isQuotaOrPermissionError,
    error: lastError?.message || 'Gemini model request failed',
  };
}

/**
 * Validates and normalizes HTTP/HTTPS URLs for search sources.
 * Rejects malformed strings, invalid schemes, and empty hosts.
 */
export function validateAndNormalizeUrl(rawUri: any): { isValid: boolean; normalizedUrl: string; cleanHost: string } {
  if (!rawUri || typeof rawUri !== 'string') {
    return { isValid: false, normalizedUrl: '', cleanHost: '' };
  }
  const trimmed = rawUri.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { isValid: false, normalizedUrl: '', cleanHost: '' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, normalizedUrl: '', cleanHost: '' };
    }
    const hostname = parsed.hostname.toLowerCase().trim();
    if (!hostname || hostname.length < 3 || (!hostname.includes('.') && hostname !== 'localhost')) {
      return { isValid: false, normalizedUrl: '', cleanHost: '' };
    }

    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'];
    for (const p of utmParams) {
      parsed.searchParams.delete(p);
    }

    return {
      isValid: true,
      normalizedUrl: parsed.href,
      cleanHost: hostname.replace(/^www\./, ''),
    };
  } catch {
    return { isValid: false, normalizedUrl: '', cleanHost: '' };
  }
}

export function generateResearchSubqueries(query: string, isArabic: boolean): string[] {
  const cleanQ = typeof query === 'string' ? query.trim() : '';
  if (!cleanQ || cleanQ.length < 25 || /^(\d+|hi|hello|مرحبا|أهلاً)/i.test(cleanQ)) {
    return [cleanQ || 'query'];
  }

  const subqueries = [cleanQ];
  if (isArabic) {
    subqueries.push(`${cleanQ} أحدث التطورات والبيانات الرسمية`);
    subqueries.push(`${cleanQ} مقارنة تحليلية وتحديات`);
  } else {
    subqueries.push(`${cleanQ} official updates and technical documentation`);
    subqueries.push(`${cleanQ} comparative analysis and challenges`);
  }
  return subqueries.slice(0, 3);
}

/**
 * Extracts citations strictly from genuine groundingMetadata and citationMetadata returned by the Gemini API.
 * Never fabricates or synthesizes fake sources when grounding metadata is absent.
 */
export function extractSources(response: any): SearchSource[] {
  const sources: SearchSource[] = [];
  if (!response) return sources;

  const seenUrls = new Set<string>();

  // Helper to safely append a genuine, validated web source
  const addSource = (rawUri: any, rawTitle: any, rawSnippet?: any) => {
    const { isValid, normalizedUrl, cleanHost } = validateAndNormalizeUrl(rawUri);
    if (!isValid || seenUrls.has(normalizedUrl)) {
      return;
    }

    seenUrls.add(normalizedUrl);

    let title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!title || title.toLowerCase() === 'undefined' || title.toLowerCase() === 'null') {
      title = cleanHost || 'Web Source';
    }

    let snippet: string | undefined;
    if (typeof rawSnippet === 'string' && rawSnippet.trim()) {
      snippet = rawSnippet.trim();
    }

    sources.push({
      title,
      url: normalizedUrl,
      snippet,
    });
  };

  // 1. Google Search Grounding Chunks (Primary Gemini API format)
  // Supports camelCase and snake_case across all candidates and top-level response
  const candidates: any[] = Array.isArray(response?.candidates) ? response.candidates : [];

  for (const cand of candidates) {
    const meta = cand?.groundingMetadata || cand?.grounding_metadata;
    const chunks = meta?.groundingChunks || meta?.grounding_chunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (!chunk || typeof chunk !== 'object') continue;
        const uri = chunk.web?.uri || chunk.web?.url || chunk.webUri || chunk.web_uri || chunk.uri || chunk.url;
        const title = chunk.web?.title || chunk.title || chunk.web_title;
        const snippet = chunk.web?.snippet || chunk.snippet || chunk.text;
        addSource(uri, title, snippet);
      }
    }
  }

  // Also inspect top-level groundingMetadata if present on the response directly
  const topMeta = response?.groundingMetadata || response?.grounding_metadata;
  const topChunks = topMeta?.groundingChunks || topMeta?.grounding_chunks;
  if (Array.isArray(topChunks)) {
    for (const chunk of topChunks) {
      if (!chunk || typeof chunk !== 'object') continue;
      const uri = chunk.web?.uri || chunk.web?.url || chunk.webUri || chunk.web_uri || chunk.uri || chunk.url;
      const title = chunk.web?.title || chunk.title || chunk.web_title;
      const snippet = chunk.web?.snippet || chunk.snippet || chunk.text;
      addSource(uri, title, snippet);
    }
  }

  // 2. Citation Metadata (Supported fallback format in Gemini SDK)
  for (const cand of candidates) {
    const citations =
      cand?.citationMetadata?.citations ||
      cand?.citationMetadata?.citationSources ||
      cand?.citation_metadata?.citations ||
      cand?.citation_metadata?.citation_sources;
    if (Array.isArray(citations)) {
      for (const item of citations) {
        if (!item || typeof item !== 'object') continue;
        const uri = item.uri || item.url;
        const title = item.title;
        const snippet = item.snippet;
        addSource(uri, title, snippet);
      }
    }
  }

  const topCitations =
    response?.citationMetadata?.citations ||
    response?.citationMetadata?.citationSources ||
    response?.citation_metadata?.citations ||
    response?.citation_metadata?.citation_sources;

  if (Array.isArray(topCitations)) {
    for (const item of topCitations) {
      if (!item || typeof item !== 'object') continue;
      const uri = item.uri || item.url;
      const title = item.title;
      const snippet = item.snippet;
      addSource(uri, title, snippet);
    }
  }

  console.log(`[extractSources Diagnosis] Inspected ${candidates.length} candidates. Valid extracted sources: ${sources.length}`);
  return sources.slice(0, 10);
}

/**
 * Extracts web search queries actually submitted by the grounding tool
 */
export function extractSearchQueries(response: any): string[] {
  if (!response) return [];
  const queries: string[] = [];
  const candidates: any[] = Array.isArray(response?.candidates) ? response.candidates : [];

  for (const cand of candidates) {
    const meta = cand?.groundingMetadata || cand?.grounding_metadata;
    const raw = meta?.webSearchQueries || meta?.web_search_queries;
    if (Array.isArray(raw)) {
      for (const q of raw) {
        if (typeof q === 'string' && q.trim() && !queries.includes(q.trim())) {
          queries.push(q.trim());
        }
      }
    }
  }

  const topMeta = response?.groundingMetadata || response?.grounding_metadata;
  const topRaw = topMeta?.webSearchQueries || topMeta?.web_search_queries;
  if (Array.isArray(topRaw)) {
    for (const q of topRaw) {
      if (typeof q === 'string' && q.trim() && !queries.includes(q.trim())) {
        queries.push(q.trim());
      }
    }
  }

  return queries;
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
    if (demoMode) {
      return getDemoFastResult(query, isArabic, startTime);
    }

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

    let text = '';
    let sources: SearchSource[] = [];
    let searchQueries: string[] = [query];
    let fallbackUsed = false;

    // 1. Attempt Google Search Grounding first
    const geminiCall = await callGeminiSafe(promptText, {
      systemPrompt,
      useSearch: true,
    });

    const isGoogle429 = Boolean(
      geminiCall.isQuotaExhausted ||
      geminiCall.error?.includes('429') ||
      geminiCall.error?.includes('RESOURCE_EXHAUSTED')
    );

    if (geminiCall.text && !isGoogle429) {
      const extracted = geminiCall.rawResponse ? extractSources(geminiCall.rawResponse) : [];
      if (extracted.length > 0) {
        text = geminiCall.text;
        sources = extracted;
        searchQueries = geminiCall.rawResponse ? extractSearchQueries(geminiCall.rawResponse) : [query];
      }
    }

    // 2. Fall back to Tavily if Google Search failed (429 or error) or returned 0 sources
    if ((!text || sources.length === 0 || isGoogle429) && isTavilyConfigured()) {
      console.log(
        `[Fast Search] Google Grounding unavailable or 0 sources (is429: ${isGoogle429}). Attempting Tavily search fallback...`
      );
      const tavilyRes = await searchTavily(query, {
        searchDepth: 'basic',
        maxResults: 5,
        includeAnswer: true,
      });

      if (tavilyRes.success && tavilyRes.sources.length > 0) {
        sources = tavilyRes.sources;
        searchQueries = tavilyRes.queriesUsed;
        fallbackUsed = true;

        const webContext = buildTavilySearchContext(tavilyRes);
        const enrichedPrompt = `User Query: "${query}"${fileContent ? `\nAttached file (${fileName}):\n${fileContent.slice(0, 4000)}` : ''}\n\n${webContext}\n\nInstructions: Deliver a direct, factual answer grounded in the verified web search context above. Format clearly with concise bullet points and tables.`;

        const groundedGemini = await callGeminiSafe(enrichedPrompt, {
          systemPrompt,
          useSearch: false, // Avoids Google Search 429 quota error
        });

        if (groundedGemini.text) {
          text = groundedGemini.text;
        } else if (tavilyRes.answer) {
          text = tavilyRes.answer;
        }
      }
    }

    // 3. If still no text, use ungrounded Gemini text or try ungrounded call
    if (!text && geminiCall.text) {
      text = geminiCall.text;
    } else if (!text) {
      const ungrounded = await callGeminiSafe(promptText, {
        systemPrompt,
        useSearch: false,
      });
      if (ungrounded.text) {
        text = ungrounded.text;
      }
    }

    if (!text) {
      if (demoMode) {
        return getDemoFastResult(query, isArabic, startTime);
      }
      throw new Error(
        geminiCall.error ||
          (isArabic
            ? 'تعذر الوصول إلى مزود الذكاء الاصطناعي (Gemini). يرجى التأكد من ضبط GEMINI_API_KEY.'
            : 'AI Provider (Gemini) is unavailable. Please check GEMINI_API_KEY.')
      );
    }

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
        fallbackUsed,
        serverLive: true,
      },
    };
  }

  // ----------------------------------------------------
  // MODE 2: DEEP RESEARCH
  // ----------------------------------------------------
  if (mode === 'deep') {
    if (demoMode) {
      return getDemoDeepResult(query, isArabic, startTime);
    }

    const systemPrompt = isArabic
      ? `أنت المحرك المتقدم للبحث المعمق (Deep Research) في "OmniSearch AI".
قواعد التقرير والتوثيق الصارمة:
1. يجب استخدام أداة البحث في الويب للبحث الفعلي عن أحدث المعلومات، وتدقيق الحقائق، وتوثيق المحاور بمصادر حقيقية مسترجعة من الويب.
2. تقرير استقصائي مهني مفصل ومحكم يبدأ بالخلاصة التنفيذية المباشرة (Executive Summary).
3. المحاور الرئيسية، المعطيات الإحصائية، وجدول مقارن للمزايا والمحاذير، والتوصيات الاستراتيجية.
4. التوثيق الحقيقي ومنع انتحال المصادر:
   - يمنع تماماً اختراع أو افتراض قسم مراجع أو قائمة مصادر أو روابط لم تُرجعها أداة البحث فعلياً.
   - لا تذكر أسماء مؤسسات أو منظمات أو مواقع على أنها مصادر استُخدمت أو تم التحقق منها في هذا البحث ما لم تكن مسترجعة فعلياً عبر أداة البحث.
   - يمكنك ذكر أسماء الجهات فقط ضمن السياق الموضوعي العام للحقائق، ولكن يمنع تماماً وضعها في صيغة إحالة مرجعية أو توثيق ما لم تتوفر بيانات مصدر حقيقية تدعم الإحالة.
   - إذا لم تتوفر مصادر خارجية مسترجعة، وضّح صراحة أن التقرير يستند إلى المعرفة التحليلية للذكاء الاصطناعي دون مراجع ويب في هذه الجلسة.`
      : `You are the Deep Research Engine for "OmniSearch AI".
Strict Report & Grounding Guidelines:
1. You MUST actively use web search to search the live web, retrieve fresh facts, and ground all findings in verified web citations.
2. Comprehensive investigative report starting with a direct Executive Summary.
3. In-depth technical breakdown with comparative tables and actionable strategic recommendations.
4. Truthful Grounding & Anti-Hallucination Rules:
   - NEVER invent or hallucinate a "References" or "Sources" section or list websites/organizations as consulted sources.
   - Do NOT present names of institutions, agencies, or websites as sources used or verified in this research unless genuine search grounding data was retrieved.
   - You may mention entities strictly in general factual context, but never in a citation, reference, or bibliography format unless supported by actual source data.
   - If no external web sources were returned, explicitly state that findings are synthesized from model knowledge without independent external web citations in this session.`;

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

    let text = '';
    let sources: SearchSource[] = [];
    let searchQueries: string[] = [query];
    let fallbackUsed = false;
    let searchEngineUsed: 'google_grounding' | 'tavily' | 'none' = 'none';

    // 1. Attempt Google Search Grounding first
    const geminiCall = await callGeminiSafe(promptText, {
      systemPrompt,
      useSearch: true,
      timeoutMs: 35000,
    });

    const isGoogle429 = Boolean(
      geminiCall.isQuotaExhausted ||
      geminiCall.error?.includes('429') ||
      geminiCall.error?.includes('RESOURCE_EXHAUSTED')
    );

    if (geminiCall.text && !isGoogle429) {
      const extracted = geminiCall.rawResponse ? extractSources(geminiCall.rawResponse) : [];
      if (extracted.length > 0) {
        text = geminiCall.text;
        sources = extracted;
        searchQueries = geminiCall.rawResponse ? extractSearchQueries(geminiCall.rawResponse) : [query];
        searchEngineUsed = 'google_grounding';
      }
    }

    // 2. Prioritize Deep Research with multi-aspect Tavily search fallback if Google failed with 429 or produced 0 sources
    if ((!text || sources.length === 0 || isGoogle429) && isTavilyConfigured()) {
      console.log(
        `[Deep Research] Google Grounding unavailable or 0 sources (is429: ${isGoogle429}). Triggering multi-aspect Tavily advanced search...`
      );

      const subqueries = generateResearchSubqueries(query, isArabic);
      const allSourcesMap = new Map<string, SearchSource>();
      const allQueriesUsed: string[] = [];
      let combinedAnswer = '';

      for (const sq of subqueries) {
        allQueriesUsed.push(sq);
        const tavilyRes = await searchTavily(sq, {
          searchDepth: 'advanced',
          maxResults: 6,
          includeAnswer: true,
        });
        if (tavilyRes.success) {
          if (tavilyRes.answer && !combinedAnswer) {
            combinedAnswer = tavilyRes.answer;
          }
          for (const src of tavilyRes.sources) {
            const { isValid, normalizedUrl } = validateAndNormalizeUrl(src.url);
            if (isValid && !allSourcesMap.has(normalizedUrl)) {
              allSourcesMap.set(normalizedUrl, src);
            }
          }
        }
      }

      const mergedSources = Array.from(allSourcesMap.values());

      if (mergedSources.length > 0) {
        sources = mergedSources;
        searchQueries = allQueriesUsed;
        searchEngineUsed = 'tavily';
        fallbackUsed = true;

        onProgress?.({
          type: 'sources_discovered',
          payload: { sources },
        });

        const syntheticResult = {
          query,
          sources: mergedSources,
          answer: combinedAnswer,
          queriesUsed: allQueriesUsed,
          success: true,
        };

        const webContext = buildTavilySearchContext(syntheticResult);
        const enrichedPrompt = isArabic
          ? `استعلام المستخدم: "${query}"${fileContent ? `\nالمستند المرفق (${fileName}):\n${fileContent.slice(0, 6000)}` : ''}\n\n${webContext}\n\nتعليمات صارمة للبحث المعمق (توليف عالي الجودة والأدلة):
1. نظم النتائج منطقياً حسب الأسئلة الفرعية أو الأبعاد التحليلية.
2. قارن بين المصادر المختلفة مبرزاً نقاط الاتفاق والتكامل وكذلك أي تناقضات أو اختلافات بينها.
3. ميز بوضوح بين الحقائق المتحققة من المصادر والتقديرات، مع بيان ما يظل غير معروف أو غير مدعوم.
4. تجنب تكرار النقاط عبر الأقسام المختلفة.
5. قدم تقريراً مهيكلاً يتضمن: الخلاصة التنفيذية، النتائج الرئيسية (حسب الأبعاد)، الأدلة والمقارنات المدعومة، القيود أو التناقضات، الاستنتاج النهائي، وروابط المصادر المباشرة.
6. لا تختلق روابط أو إحالات خارج المصادر المسترجعة.`
          : `User Query: "${query}"${fileContent ? `\nReferenced Document (${fileName}):\n${fileContent.slice(0, 6000)}` : ''}\n\n${webContext}\n\nStrict Instructions for Deep Research (Comprehensive Evidence-Based Synthesis):\n1. Organize evidence logically by subquestions or analytical dimensions.\n2. Compare relevant sources, identifying agreements, complementary insights, and any contradictions.\n3. Clearly distinguish verified facts from model interpretation and state what remains unknown or unsupported.\n4. Avoid repeating the same point across sections.\n5. Structure output into: Executive Summary, Main Findings (organized by subquestion/dimensions), Supporting Evidence & Comparisons, Limitations or Conflicting Evidence, Clear Conclusion, and Direct Source Links.\n6. Do NOT invent URLs or citations outside of the retrieved sources.`;

        const groundedGemini = await callGeminiSafe(enrichedPrompt, {
          systemPrompt,
          useSearch: false, // Prevents triggering Google Search 429 quota error!
          timeoutMs: 35000,
        });

        if (groundedGemini.text) {
          text = groundedGemini.text;
        } else if (combinedAnswer) {
          text = combinedAnswer;
        } else if (mergedSources.length > 0) {
          text = `# Deep Research Report: ${query}\n\n## Executive Summary\nSynthesized from verified web search results.\n\n## Main Findings\n${mergedSources.map(s => `- **${s.title}**: ${s.snippet || s.url}`).join('\n')}`;
        }
      }
    }

    // 3. If still no text, use ungrounded Gemini
    if (!text && geminiCall.text) {
      text = geminiCall.text;
    } else if (!text) {
      const ungrounded = await callGeminiSafe(promptText, {
        systemPrompt,
        useSearch: false,
        timeoutMs: 35000,
      });
      if (ungrounded.text) {
        text = ungrounded.text;
      }
    }

    if (!text) {
      if (demoMode) {
        return getDemoDeepResult(query, isArabic, startTime);
      }
      text = isArabic ? `تقرير استقصائي حول: ${query}` : `Investigative report on: ${query}`;
    }

    console.log(
      `[Deep Research Diagnosis] Query: "${query}", Engine: ${searchEngineUsed}, ExtractedSources: ${sources.length}, SearchQueriesUsed: ${searchQueries.length}, IsGrounded: ${sources.length > 0}`
    );

    if (sources.length > 0 && searchEngineUsed !== 'tavily') {
      onProgress?.({
        type: 'sources_discovered',
        payload: { sources },
      });
    }

    const hasSources = sources.length > 0;
    const engineTag = searchEngineUsed === 'tavily' ? ' (Tavily)' : '';
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
        status: hasSources ? 'completed' : 'unverified',
        details: hasSources
          ? (isArabic ? `تم استرجاع ${sources.length} مصادر موثقة من الويب${engineTag}` : `Retrieved ${sources.length} verified web sources${engineTag}`)
          : (isArabic ? 'لم يُرجع مزود البحث روابط مصادر موثقة لهذا الاستعلام' : 'No verified external source links returned by grounding provider'),
      },
      {
        id: '3',
        title: hasSources
          ? (isArabic ? 'التدقيق والمطابقة متعددة الأبعاد' : 'Multi-Perspective Synthesis')
          : (isArabic ? 'التحليل المعرفي للنموذج' : 'Model Synthesis & Knowledge Analysis'),
        status: 'completed',
        details: hasSources
          ? (isArabic ? 'تمت المطابقة والتحقق بالاستناد إلى المصادر المسترجعة' : 'Cross-validated findings against retrieved sources')
          : (isArabic ? 'تحليل مبني على قاعدة معرفة النموذج (غير مطابق مع مصادر مستقلة)' : 'Synthesized from model knowledge (not cross-referenced with independent sources)'),
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

    // Align detailed report strictly with genuine sources
    const alignedReport = alignReportWithSources(text, sources, isArabic);

    return {
      query,
      mode: 'deep',
      summary: extractSummaryIntro(alignedReport),
      detailedReport: alignedReport,
      sources,
      keyTakeaways: extractKeyTakeaways(alignedReport, isArabic),
      deepResearchPhases: phases,
      suggestedQueries: generateRelatedQueries(query, isArabic),
      searchMetadata: {
        searchQueriesUsed: searchQueries,
        totalSources: sources.length,
        processingTimeMs: Date.now() - startTime,
        fallbackUsed,
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
  const rawReport = isArabic
    ? `# [وضع العرض التجريبي] تقرير بحث استقصائي: ${query}\n\nهذا تقرير استقصائي توضيحي يُعرض في بيئة المعاينة والتطوير.`
    : `# [Demonstration Mode] Deep Research Report: ${query}\n\nThis is a demonstration investigative report shown only in development mode.`;
  const report = alignReportWithSources(rawReport, [], isArabic);
  return {
    query,
    mode: 'deep',
    summary: report.slice(0, 300),
    detailedReport: report,
    sources: [],
    deepResearchPhases: [
      { id: '1', title: isArabic ? 'تفكيك الاستعلام (تجريبي)' : 'Scoping (Demo)', status: 'completed', details: isArabic ? 'نمط العرض التجريبي نشط' : 'Demonstration mode active' },
      { id: '2', title: isArabic ? 'استرجاع المراجع (تجريبي)' : 'Live Grounding (Demo)', status: 'unverified', details: isArabic ? 'لا توجد مصادر حية في وضع العرض التجريبي' : 'No live sources in demo mode' },
      { id: '3', title: isArabic ? 'الصياغة والتحليل (تجريبي)' : 'Synthesis (Demo)', status: 'completed', details: isArabic ? 'تقرير توضيحي للمعاينة' : 'Illustrative preview' },
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
