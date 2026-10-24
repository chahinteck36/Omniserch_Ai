import { SearchSource } from '../types';
import { validateAndNormalizeUrl } from './geminiService';

export interface TavilySearchOptions {
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeAnswer?: boolean;
  timeoutMs?: number;
}

export interface TavilyRawResultItem {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  raw_content?: string | null;
}

export interface TavilyRawResponse {
  query?: string;
  answer?: string;
  results?: TavilyRawResultItem[];
  response_time?: number;
}

export interface TavilySearchResult {
  query: string;
  sources: SearchSource[];
  answer?: string;
  queriesUsed: string[];
  rawResults?: TavilyRawResultItem[];
  success: boolean;
  error?: string;
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/**
 * Checks if TAVILY_API_KEY is configured in the environment.
 * Never logs or exposes the key value.
 */
export function isTavilyConfigured(): boolean {
  const key = process.env.TAVILY_API_KEY;
  return Boolean(key && typeof key === 'string' && key.trim().length > 0);
}

/**
 * Extracts and sanitizes SearchSource objects from Tavily results.
 * Strictly enforces URL validation and deduplication, rejecting invalid schemes or fake links.
 */
export function extractTavilySources(rawResults: any[]): SearchSource[] {
  const sources: SearchSource[] = [];
  if (!Array.isArray(rawResults)) return sources;

  const seenUrls = new Set<string>();

  for (const item of rawResults) {
    if (!item || typeof item !== 'object') continue;

    const rawUri = item.url || item.uri;
    const rawTitle = item.title;
    const rawContent = item.content || item.snippet;

    const { isValid, normalizedUrl, cleanHost } = validateAndNormalizeUrl(rawUri);
    if (!isValid || seenUrls.has(normalizedUrl)) {
      continue;
    }

    seenUrls.add(normalizedUrl);

    let title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!title || title.toLowerCase() === 'undefined' || title.toLowerCase() === 'null') {
      title = cleanHost || 'Web Source';
    }

    let snippet: string | undefined;
    if (typeof rawContent === 'string' && rawContent.trim()) {
      snippet = rawContent.trim();
    }

    sources.push({
      title,
      url: normalizedUrl,
      snippet,
    });
  }

  return sources;
}

/**
 * Formats retrieved Tavily sources and direct answer into an authoritative
 * factual context block for LLM synthesis.
 */
export function buildTavilySearchContext(tavilyResult: TavilySearchResult): string {
  if (!tavilyResult || !Array.isArray(tavilyResult.sources) || tavilyResult.sources.length === 0) {
    return '';
  }

  const lines: string[] = ['### Verified Web Search Context (Retrieved via Tavily Web Search):'];

  if (tavilyResult.answer && typeof tavilyResult.answer === 'string' && tavilyResult.answer.trim()) {
    lines.push(`Direct Search Synthesis: ${tavilyResult.answer.trim()}`, '');
  }

  lines.push('Grounding References:');
  tavilyResult.sources.forEach((source, idx) => {
    lines.push(`[${idx + 1}] Title: ${source.title}`);
    lines.push(`    URL: ${source.url}`);
    if (source.snippet) {
      lines.push(`    Evidence: ${source.snippet}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Performs server-side search via the official Tavily API.
 * Never exposes TAVILY_API_KEY in logs, responses, or client payloads.
 */
export async function searchTavily(
  query: string,
  options: TavilySearchOptions = {}
): Promise<TavilySearchResult> {
  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  if (!cleanQuery) {
    return {
      query: '',
      sources: [],
      queriesUsed: [],
      success: false,
      error: 'Search query is required',
    };
  }

  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return {
      query: cleanQuery,
      sources: [],
      queriesUsed: [cleanQuery],
      success: false,
      error: 'TAVILY_API_KEY is not configured on the server',
    };
  }

  const searchDepth = options.searchDepth || 'basic';
  const maxResults = typeof options.maxResults === 'number' ? Math.min(Math.max(options.maxResults, 1), 20) : 5;
  const includeAnswer = options.includeAnswer !== false;
  const timeoutMs = options.timeoutMs || 15000;

  console.log(
    `[Tavily Search] Initiating search - query: "${cleanQuery}", depth: ${searchDepth}, maxResults: ${maxResults}`
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      api_key: apiKey,
      query: cleanQuery,
      search_depth: searchDepth,
      include_answer: includeAnswer,
      max_results: maxResults,
    };

    const response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson?.error || errJson?.detail || '';
      } catch {
        // Response body wasn't JSON
      }

      console.warn(
        `[Tavily Search] Server returned HTTP ${status} (${statusText})${errorDetail ? `: ${errorDetail}` : ''}`
      );

      return {
        query: cleanQuery,
        sources: [],
        queriesUsed: [cleanQuery],
        success: false,
        error: `Tavily API request failed with status ${status}`,
      };
    }

    const data = (await response.json()) as TavilyRawResponse;

    // --- TEMPORARY DIAGNOSTIC LOGGING (To be removed after diagnosis) ---
    const contentType = response.headers.get('content-type') || 'unknown';
    const topLevelKeys = data && typeof data === 'object' ? Object.keys(data) : [];
    const resultsExists = Boolean(data?.results);
    const resultsType = Array.isArray(data?.results) ? 'array' : typeof data?.results;
    const resultsCount = Array.isArray(data?.results) ? data.results.length : 0;
    const firstResultKeys = resultsCount > 0 && data.results[0] && typeof data.results[0] === 'object' ? Object.keys(data.results[0]) : [];

    let sanitizedFirstSample = null;
    if (resultsCount > 0 && data.results[0]) {
      const item = data.results[0];
      sanitizedFirstSample = {
        title: item.title ? String(item.title).slice(0, 50) : undefined,
        url: item.url ? String(item.url).slice(0, 50) : undefined,
        hasSnippet: Boolean(item.content || item.snippet),
        score: item.score,
      };
    }

    console.log('[Tavily Diagnostic Log] Response status:', response.status);
    console.log('[Tavily Diagnostic Log] Content-Type:', contentType);
    console.log('[Tavily Diagnostic Log] Top-level keys:', topLevelKeys);
    console.log('[Tavily Diagnostic Log] Results exists:', resultsExists, 'type:', resultsType, 'count:', resultsCount);
    console.log('[Tavily Diagnostic Log] First result keys:', firstResultKeys);
    console.log('[Tavily Diagnostic Log] Sanitized first result sample:', JSON.stringify(sanitizedFirstSample));
    // --- END TEMPORARY DIAGNOSTIC LOGGING ---

    const rawResults = Array.isArray(data?.results) ? data.results : [];
    const sources = extractTavilySources(rawResults);
    const answer = typeof data?.answer === 'string' && data.answer.trim() ? data.answer.trim() : undefined;

    console.log(
      `[Tavily Search] Success - query: "${cleanQuery}", retrieved: ${rawResults.length}, validSources: ${sources.length}`
    );

    return {
      query: cleanQuery,
      sources,
      answer,
      queriesUsed: [cleanQuery],
      rawResults,
      success: true,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === 'AbortError' || String(err?.message || '').includes('abort');
    const safeErrorMessage = isAbort ? `Tavily request timed out after ${timeoutMs}ms` : err?.message || 'Tavily search network failure';

    console.warn(`[Tavily Search] Call failed: ${safeErrorMessage}`);

    return {
      query: cleanQuery,
      sources: [],
      queriesUsed: [cleanQuery],
      success: false,
      error: safeErrorMessage,
    };
  }
}
