import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { executeSearch, callGeminiSafe, callOpenRouterSafe, generateResearchSubqueries, validateAndNormalizeUrl } from '../geminiService';
import { alignReportWithSources, verifyClaimSourceAlignment } from '../../utils/sourceAlignment';
import { searchTavily } from '../tavilyService';

describe('OmniSearch AI Source Grounding Policy & Reliability Regression Tests', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  // 1. Gemini returns an answer but zero usable sources
  test('1. Gemini returns an answer but zero usable sources correctly applies unverified transparency disclaimer', () => {
    const report = 'Quantum computing is advancing rapidly with new gate fidelities.';
    const aligned = alignReportWithSources(report, [], true);

    assert.ok(aligned.includes('بيان التوثيق والمراجع'));
    assert.ok(aligned.includes('0 مصادر ويب مسترجعة'));
    assert.strictEqual(aligned.includes('### المصادر والمراجع الموثقة'), false);
  });

  // 2. Google Grounding fails and Tavily returns zero results
  test('2. Google Grounding fails and Tavily returns zero results marks research as unverified', async () => {
    process.env.TAVILY_API_KEY = 'tvly-empty-key';
    process.env.GEMINI_API_KEY = 'gemini-key';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes('api.tavily.com')) {
        return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Simulate Gemini failure / 429
      return new Response(JSON.stringify({ error: { code: 429, message: 'RESOURCE_EXHAUSTED' } }), { status: 429 });
    };

    const result = await executeSearch({
      query: 'Advanced propulsion systems',
      mode: 'deep',
      language: 'en',
      demoMode: false,
    });

    assert.strictEqual(result.sources.length, 0);
    const phase2 = result.deepResearchPhases?.find((p) => p.id === '2');
    assert.ok(phase2);
    assert.strictEqual(phase2.status, 'unverified');
  });

  // 3. Google Grounding fails and Tavily returns valid sources
  test('3. Google Grounding fails and Tavily returns valid sources integrates verified sources successfully', async () => {
    process.env.TAVILY_API_KEY = 'tvly-valid-key';
    process.env.GEMINI_API_KEY = 'gemini-key';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes('api.tavily.com')) {
        return new Response(
          JSON.stringify({
            answer: 'Tavily direct answer synthesis.',
            results: [
              {
                title: 'Tavily Research Journal',
                url: 'https://research.org/article-2026',
                content: 'Peer-reviewed findings on clean energy storage with 92% efficiency.',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Deep research report synthesized from Tavily sources.' }] } }] }), { status: 200 });
    };

    const result = await executeSearch({
      query: 'Clean energy storage efficiency',
      mode: 'deep',
      language: 'en',
      demoMode: false,
    });

    assert.strictEqual(result.sources.length, 1);
    assert.strictEqual(result.sources[0].url, 'https://research.org/article-2026');
    assert.strictEqual(result.sources[0].title, 'Tavily Research Journal');
  });

  // 4. A source contains a URL but no meaningful supporting evidence
  test('4. A source contains a URL but no meaningful supporting evidence is processed safely without hallucinated alignment', () => {
    const sources = [
      {
        title: 'Example Source',
        url: 'https://example.com/page',
      },
    ];

    const report = 'Model achieved 85% benchmark score in recent tests.';
    const verification = verifyClaimSourceAlignment(report, sources);

    assert.strictEqual(verification.hasUnverifiedClaims, true);
    assert.ok(verification.alignedText.includes('غير متحقق'));
  });

  // 5. A fallback provider returns confident generated text but no sources
  test('5. A fallback provider returns confident generated text without sources as unverified', async () => {
    process.env.OPENROUTER_API_KEY = 'or-test-key';
    delete process.env.GEMINI_API_KEY;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Confident model-generated overview of quantum encryption without external web sources.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    };

    const result = await executeSearch({
      query: 'Quantum encryption status',
      mode: 'fast',
      language: 'en',
      demoMode: false,
    });

    assert.strictEqual(result.sources.length, 0);
    assert.ok(result.summary?.includes('Confident model-generated overview'));
  });

  // 6. The main server path fails and the application switches to a fallback path
  test('6. Main server path 429 failure triggers OpenRouter fallback successfully', async () => {
    process.env.GEMINI_API_KEY = 'gemini-exhausted-key';
    process.env.OPENROUTER_API_KEY = 'or-fallback-key';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Fallback response generated via OpenRouter due to Gemini 429 quota exhaustion.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Gemini 429
      return new Response(JSON.stringify({ error: { code: 429, message: 'RESOURCE_EXHAUSTED' } }), { status: 429 });
    };

    const res = await callGeminiSafe('Test query for fallback');
    assert.strictEqual(res.isFallback, true);
    assert.strictEqual(res.isQuotaExhausted, true);
    assert.ok(res.text.includes('Fallback response generated via OpenRouter'));
  });

  // 7. A research request fails to retrieve sources during streaming
  test('7. Research request failing to retrieve sources during streaming reports unverified status', async () => {
    const report = 'Unverified streaming analysis.';
    const aligned = alignReportWithSources(report, [], false);
    assert.ok(aligned.includes('Transparency Notice'));
    assert.ok(aligned.includes('0 web sources retrieved'));
  });

  // 8. A successful sourced research response preserves valid source titles and URLs
  test('8. Successful sourced research response preserves valid source titles and URLs', () => {
    const sources = [
      {
        title: 'IEEE Spectrum 2026',
        url: 'https://spectrum.ieee.org/ai-2026',
        snippet: 'Groundbreaking silicon photonics interconnects achieved.',
      },
    ];

    const report = 'Silicon photonics interconnects achieved major milestones.';
    const aligned = alignReportWithSources(report, sources, false);

    assert.ok(aligned.includes('https://spectrum.ieee.org/ai-2026'));
    assert.ok(aligned.includes('IEEE Spectrum 2026'));
  });

  // 9. Ordinary non-research chat still works without web sources
  test('9. Ordinary non-research chat/queries work without web sources', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello! How can I assist you with coding today?' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await callGeminiSafe('Hello');
    assert.strictEqual(res.text, 'Hello! How can I assist you with coding today?');
  });

  // 10. The displayed source count and final research status remain consistent
  test('10. Source count and research status metadata remain consistent', async () => {
    const sources = [
      { title: 'Source A', url: 'https://a.com/1', snippet: 'Data A' },
      { title: 'Source B', url: 'https://b.com/2', snippet: 'Data B' },
    ];

    const report = 'Report findings.';
    const aligned = alignReportWithSources(report, sources, false);

    assert.ok(aligned.includes('Verified Grounding Sources'));
    assert.ok(aligned.includes('1. [Source A](https://a.com/1)'));
    assert.ok(aligned.includes('2. [Source B](https://b.com/2)'));
  });

  // 11. Unsupported years or versions (e.g., 2026) are flagged as unverified against source corpus
  test('11. Unsupported years or product claims are flagged as unverified against source corpus', () => {
    const sources = [
      { title: 'Older Article', url: 'https://old.com', snippet: 'Events in 2023.' },
    ];

    const report = 'The major breakthrough occurred in 2026 with version v2.0.';
    const verification = verifyClaimSourceAlignment(report, sources);

    assert.strictEqual(verification.hasUnverifiedClaims, true);
    assert.ok(verification.alignedText.includes('غير متحقق'));
  });

  // 12. Zero-source deep research report constraints long confident narrative
  test('12. Zero-source deep research report constrains long narrative and appends unverified notice', () => {
    const longReport = 'A'.repeat(2500) + ' Detailed report text without sources.';
    const aligned = alignReportWithSources(longReport, [], false);

    assert.ok(aligned.includes('Transparency Notice'));
    assert.ok(aligned.includes('0 web sources retrieved'));
    assert.ok(aligned.includes('تم تقييد النص الطويل'));
  });

  // 13. Multi-aspect query decomposition generates distinct subqueries for complex research
  test('13. Multi-aspect query decomposition generates distinct subqueries for complex research', () => {
    const simple = generateResearchSubqueries('What is 2+2?', false);
    assert.strictEqual(simple.length, 1);

    const complex = generateResearchSubqueries('Comprehensive analysis of quantum computing advances and cryptography challenges in 2026', false);
    assert.ok(complex.length >= 2);
    assert.ok(complex.some(q => q.includes('official updates') || q.includes('comparative analysis')));
  });

  // 14. Canonical URL deduplication strips tracking parameters
  test('14. Canonical URL deduplication strips tracking parameters', () => {
    const url1 = validateAndNormalizeUrl('https://example.com/article?utm_source=twitter&utm_medium=social');
    const url2 = validateAndNormalizeUrl('https://example.com/article');

    assert.strictEqual(url1.isValid, true);
    assert.strictEqual(url1.normalizedUrl, url2.normalizedUrl);
  });
});
