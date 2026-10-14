import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractSources, extractSearchQueries, executeSearch } from '../geminiService';

describe('Task B, C & G: Truthful Search, Grounding Citations, and Model Comparison', () => {
  test('3. Missing citation metadata does NOT create fake sources', () => {
    // Empty grounding response
    const emptyResponse = { candidates: [{ content: { parts: [{ text: 'Response without web sources' }] } }] };
    const sources = extractSources(emptyResponse);
    assert.deepStrictEqual(sources, []);
    assert.strictEqual(sources.length, 0);

    // Grounding with null/undefined metadata
    const nullResponse = { candidates: [] };
    assert.deepStrictEqual(extractSources(nullResponse), []);
  });

  test('Accurate citation extraction from genuine Google Search grounding metadata', () => {
    const mockGeminiResponse = {
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ['quantum computing recent breakthroughs 2026'],
            groundingChunks: [
              {
                web: {
                  uri: 'https://nature.com/articles/quantum-2026',
                  title: 'Nature: Quantum Advances',
                  snippet: 'Recent developments in error mitigation...',
                },
              },
              {
                web: {
                  uri: 'https://arxiv.org/abs/2601.12345',
                  title: 'arXiv: Fault Tolerant Circuits',
                },
              },
            ],
          },
        },
      ],
    };

    const sources = extractSources(mockGeminiResponse);
    assert.strictEqual(sources.length, 2);
    assert.strictEqual(sources[0].url, 'https://nature.com/articles/quantum-2026');
    assert.strictEqual(sources[0].title, 'Nature: Quantum Advances');
    assert.strictEqual(sources[0].snippet, 'Recent developments in error mitigation...');
    assert.strictEqual(sources[1].url, 'https://arxiv.org/abs/2601.12345');

    const queries = extractSearchQueries(mockGeminiResponse);
    assert.strictEqual(queries.length, 1);
    assert.strictEqual(queries[0], 'quantum computing recent breakthroughs 2026');
  });

  test('2. Provider failure does not produce fabricated search results in production', async () => {
    // When no API key is provided and demoMode is false, executeSearch MUST throw an honest error
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await assert.rejects(
        async () => {
          await executeSearch({
            query: 'Explain thermodynamics',
            mode: 'fast',
            language: 'en',
            demoMode: false,
          });
        },
        (err: Error) => {
          assert.match(err.message, /GEMINI_API_KEY|unavailable/i);
          return true;
        }
      );
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  test('9 & 10. Battle Mode reports unconfigured models as unavailable and preserves partial results', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      // In demo mode or partial test, uncalled models must have status: 'unavailable'
      const demoResult = await executeSearch({
        query: 'What is photosynthesis?',
        mode: 'battle',
        models: ['gemini', 'gpt4o', 'claude35'],
        language: 'en',
        demoMode: true,
      });

      assert.strictEqual(demoResult.mode, 'battle');
      assert.ok(demoResult.modelResponses);
      assert.strictEqual(demoResult.modelResponses.length, 3);
      assert.strictEqual(demoResult.modelResponses[0].modelId, 'gemini');
      const unavail = demoResult.modelResponses.filter((m) => m.status === 'unavailable');
      assert.ok(unavail.length >= 1);
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
