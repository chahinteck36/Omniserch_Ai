import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractSources, extractSearchQueries, executeSearch, alignReportWithSources } from '../geminiService';

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

    // Undefined response
    assert.deepStrictEqual(extractSources(undefined), []);
    assert.deepStrictEqual(extractSources(null), []);
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
    assert.strictEqual(sources[1].title, 'arXiv: Fault Tolerant Circuits');

    const queries = extractSearchQueries(mockGeminiResponse);
    assert.strictEqual(queries.length, 1);
    assert.strictEqual(queries[0], 'quantum computing recent breakthroughs 2026');
  });

  test('Citation metadata fallback extraction and URL validation / deduplication', () => {
    const mockResponseWithCitations = {
      candidates: [
        {
          citationMetadata: {
            citations: [
              {
                uri: 'https://example.org/article-1',
                title: 'Official Report',
                snippet: 'Key findings summary',
              },
              {
                uri: 'https://example.org/article-1', // duplicate URL
                title: 'Duplicate Report',
              },
              {
                uri: 'javascript:alert(1)', // invalid scheme
                title: 'Malicious Link',
              },
              {
                uri: 'https://example.org/article-2',
                // missing title - should derive from URL hostname
              },
            ],
          },
        },
      ],
    };

    const sources = extractSources(mockResponseWithCitations);
    assert.strictEqual(sources.length, 2);
    assert.strictEqual(sources[0].url, 'https://example.org/article-1');
    assert.strictEqual(sources[0].title, 'Official Report');
    assert.strictEqual(sources[1].url, 'https://example.org/article-2');
    assert.strictEqual(sources[1].title, 'example.org');
  });

  test('extractSources rejects malformed URLs and deduplicates normalized variants', () => {
    const responseWithDirtyChunks = {
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://EXAMPLE.COM/research/', title: 'Caps Host' } },
          { webUri: 'https://example.com/research/', title: 'Exact Duplicate' },
          { uri: 'http://', title: 'Empty protocol' },
          { url: 'https://', title: 'Empty protocol' },
          { web: { uri: 'ftp://files.example.com/doc.pdf', title: 'FTP' } },
          { web: { uri: 'not a url at all', title: 'Plain text' } },
          { web: { uri: 'https://techcrunch.com/article', title: '   ' } }, // empty title
          { web: { uri: 'https://techcrunch.com/article', title: 'Duplicate' } },
          { web: { uri: 'https://reuters.com/news', title: 'undefined' } }, // generic string title
        ],
      },
    };

    const sources = extractSources(responseWithDirtyChunks);
    // Should keep only the 3 valid distinct URLs: example.com/research/, techcrunch.com/article, reuters.com/news
    assert.strictEqual(sources.length, 3);
    assert.strictEqual(sources[0].url, 'https://example.com/research/');
    assert.strictEqual(sources[0].title, 'Caps Host');
    assert.strictEqual(sources[1].url, 'https://techcrunch.com/article');
    assert.strictEqual(sources[1].title, 'techcrunch.com'); // derived from hostname
    assert.strictEqual(sources[2].url, 'https://reuters.com/news');
    assert.strictEqual(sources[2].title, 'reuters.com'); // sanitized from generic 'undefined'
  });


  test('Deep Research mode truthfully flags Phase 2 as unverified when 0 sources are returned', async () => {
    // In demo mode or when grounding returns no sources
    const deepDemo = await executeSearch({
      query: 'Future of quantum computing algorithms',
      mode: 'deep',
      language: 'en',
      demoMode: true,
    });

    assert.strictEqual(deepDemo.mode, 'deep');
    assert.strictEqual(deepDemo.sources.length, 0);
    assert.strictEqual(deepDemo.searchMetadata?.totalSources, 0);

    const phases = deepDemo.deepResearchPhases;
    assert.ok(Array.isArray(phases));
    assert.ok(phases.length >= 2);

    const phase2 = phases.find((p) => p.id === '2');
    assert.ok(phase2);
    // CRITICAL: Phase 2 MUST NOT be 'completed' when sources are absent
    assert.strictEqual(phase2.status, 'unverified');
    assert.match(phase2.details || '', /no live sources|لا توجد مصادر|No verified/i);
  });

  test('Deep Research mode in Arabic marks Phase 2 as unverified when no sources exist', async () => {
    const deepAr = await executeSearch({
      query: 'تحليل بنية الذكاء الاصطناعي',
      mode: 'deep',
      language: 'ar',
      demoMode: true,
    });

    assert.strictEqual(deepAr.mode, 'deep');
    assert.strictEqual(deepAr.sources.length, 0);
    assert.strictEqual(deepAr.searchMetadata?.totalSources, 0);

    const phase2 = deepAr.deepResearchPhases?.find((p) => p.id === '2');
    assert.ok(phase2);
    assert.strictEqual(phase2.status, 'unverified');
  });

  test('2. Provider failure does not produce fabricated search results in production', async () => {
    // When no API key is provided and demoMode is false, executeSearch MUST throw an honest error
    const prevKey = process.env.GEMINI_API_KEY;
    const prevTavily = process.env.TAVILY_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.TAVILY_API_KEY;

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
      if (prevTavily) process.env.TAVILY_API_KEY = prevTavily;
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
  test('alignReportWithSources removes hallucinated reference sections when sources is empty (Arabic)', () => {
    const fakeReportWithReferences = `# تقرير بحث استقصائي حول الذكاء الاصطناعي
هذا التقرير يستعرض تطورات النماذج التوليدية.

## المحاور الرئيسية
- التطور السريع في معالجة اللغات الطبيعية.
- كفاءة استهلاك الطاقة في مراكز البيانات.

## المصادر والمراجع:
1. منظمة الصحة العالمية (WHO) - تقرير التقنية السنوي
2. جامعة هارفارد - مركز أبحاث الذكاء الاصطناعي
3. مجلة نيتشر (Nature) - أبحاث الخوارزميات`;

    const aligned = alignReportWithSources(fakeReportWithReferences, [], true);

    // 1. Must NOT contain the fake reference list
    assert.strictEqual(aligned.includes('منظمة الصحة العالمية (WHO)'), false);
    assert.strictEqual(aligned.includes('جامعة هارفارد'), false);
    assert.strictEqual(aligned.includes('مجلة نيتشر'), false);

    // 2. Must contain the truthful transparency disclaimer
    assert.ok(aligned.includes('بيان التوثيق والمراجع'));
    assert.ok(aligned.includes('0 مصادر ويب مسترجعة'));
    assert.ok(aligned.includes('المعلومات والتحليلات الواردة في هذا التقرير مستخلصة من قاعدة المعرفة الداخلية'));
  });

  test('alignReportWithSources removes hallucinated reference sections when sources is empty (English)', () => {
    const fakeReportEnglish = `# Deep Research Report on Semiconductor Fabrication
Comprehensive analysis of next-generation lithography.

## Key Dimensions
* High-NA EUV lithography adoption.
* Packaging density and thermal limits.

### References & Sources
1. TSMC Whitepaper 2026 - Advanced Nodes
2. IEEE Spectrum - Moore's Law Trajectory
3. Gartner Semiconductor Forecast`;

    const aligned = alignReportWithSources(fakeReportEnglish, [], false);

    // 1. Must NOT contain the fake citation entries
    assert.strictEqual(aligned.includes('TSMC Whitepaper 2026'), false);
    assert.strictEqual(aligned.includes('IEEE Spectrum'), false);
    assert.strictEqual(aligned.includes('Gartner Semiconductor Forecast'), false);

    // 2. Must contain the honest notice
    assert.ok(aligned.includes('Grounding & Citations Notice'));
    assert.ok(aligned.includes('0 web sources retrieved'));
    assert.ok(aligned.includes('synthesized from internal model knowledge'));
  });

  test('alignReportWithSources accurately injects authentic sources when available', () => {
    const reportText = `# Quantum Computing Analysis
Current developments in fault tolerance.`;

    const realSources = [
      {
        title: 'Nature Physics 2026',
        url: 'https://nature.com/articles/phys-2026',
        snippet: 'Demonstration of 1000 physical qubit error correction threshold.',
      },
      {
        title: 'IBM Quantum Roadmap',
        url: 'https://ibm.com/quantum/roadmap',
      },
    ];

    const aligned = alignReportWithSources(reportText, realSources, true);

    assert.ok(aligned.includes('المصادر والمراجع الموثقة'));
    assert.ok(aligned.includes('https://nature.com/articles/phys-2026'));
    assert.ok(aligned.includes('Nature Physics 2026'));
    assert.ok(aligned.includes('https://ibm.com/quantum/roadmap'));
  });

  test('executeSearch deep mode produces aligned report with zero fabricated sources', async () => {
    const result = await executeSearch({
      query: 'أحدث التطورات في الحوسبة الكمومية 2026',
      mode: 'deep',
      language: 'ar',
      demoMode: true,
    });

    assert.strictEqual(result.sources.length, 0);
    assert.strictEqual(result.searchMetadata?.totalSources, 0);
    assert.ok(result.detailedReport);

    // Must not contain fake references
    assert.strictEqual(result.detailedReport.includes('## المصادر والمراجع:'), false);
    assert.ok(result.detailedReport.includes('بيان التوثيق والمراجع'));

    // Phase 2 is honest
    const phase2 = result.deepResearchPhases?.find((p) => p.id === '2');
    assert.strictEqual(phase2?.status, 'unverified');
  });

  test('alignReportWithSources strips mid-document reference section and preserves following sections when sources is empty', () => {
    const reportWithMidReferences = `# دراسة الجينوم البشري
مقدمة في تسلسل الحمض النووي.

### المحاور
- دقة التسلسل.

**المصادر والمراجع:**
- منظمة الصحة العالمية (WHO)
- معهد برود (Broad Institute)
- جامعة أكسفورد

### التوصيات الاستراتيجية
1. تحديث البنية التحتية للحوسبة الحيوية.
2. دعم بروتوكولات الحماية والخصوصية الجينية.`;

    const aligned = alignReportWithSources(reportWithMidReferences, [], true);

    // 1. Fake references removed
    assert.strictEqual(aligned.includes('معهد برود'), false);
    assert.strictEqual(aligned.includes('جامعة أكسفورد'), false);
    assert.strictEqual(aligned.includes('**المصادر والمراجع:**'), false);

    // 2. Subsequent section PRESERVED
    assert.ok(aligned.includes('### التوصيات الاستراتيجية'));
    assert.ok(aligned.includes('تحديث البنية التحتية للحوسبة الحيوية'));
    assert.ok(aligned.includes('دعم بروتوكولات الحماية والخصوصية الجينية'));

    // 3. Transparency disclaimer appended
    assert.ok(aligned.includes('بيان التوثيق والمراجع'));
    assert.ok(aligned.includes('0 مصادر ويب مسترجعة'));
  });

  test('alignReportWithSources sanitizes false in-text claims of external verification when sources is empty', () => {
    const reportWithFalseClaim = `# تقرير أمن البيانات
تمت المطابقة والتحقق بالاستناد إلى مصادر مستقلة للتأكد من المعايير.

استند هذا البحث إلى المصادر المعتمدة التالية:
- المعهد الوطني للمعايير والتقنية (NIST)`;

    const aligned = alignReportWithSources(reportWithFalseClaim, [], true);

    // False claims sanitized
    assert.strictEqual(aligned.includes('تمت المطابقة والتحقق بالاستناد إلى مصادر مستقلة'), false);
    assert.ok(aligned.includes('تم استخلاص التحليل من المعرفة التحليلية للنموذج'));
    assert.strictEqual(aligned.includes('المعهد الوطني للمعايير والتقنية'), false);
    assert.ok(aligned.includes('بيان التوثيق والمراجع'));
  });
});


