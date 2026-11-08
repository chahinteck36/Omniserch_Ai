import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifySource, evaluateAndRankSources, getSourceTypeLabel } from '../../utils/sourceIntelligence';

describe('Source Intelligence Engine Tests', () => {
  test('1. Classifies scientific peer-reviewed sources correctly (PubMed / PMC)', () => {
    const classification = classifySource(
      'https://pubmed.ncbi.nlm.nih.gov/38200000/',
      'Clinical trial on neural plasticity in 2026',
      'A peer-reviewed study published by Dr. Smith showing 95% efficacy.'
    );
    assert.strictEqual(classification.sourceType, 'scientific_peer_reviewed');
    assert.strictEqual(classification.isPrimary, true);
  });

  test('2. Classifies university and research institutions correctly (.edu)', () => {
    const classification = classifySource(
      'https://www.stanford.edu/research/quantum-breakthrough',
      'Stanford Quantum Research Lab Report',
      'University research findings on quantum coherence.'
    );
    assert.strictEqual(classification.sourceType, 'university_research');
    assert.strictEqual(classification.isPrimary, true);
  });

  test('3. Classifies official government and medical bodies correctly (WHO / CDC / .gov)', () => {
    const classification = classifySource(
      'https://www.who.int/news/item/global-health-guidelines-2026',
      'WHO Official Health Guidelines',
      'Official guidelines from the World Health Organization.'
    );
    assert.strictEqual(classification.sourceType, 'government_medical');
    assert.strictEqual(classification.isPrimary, true);
  });

  test('4. Classifies social media and unspecialized content correctly', () => {
    const classification = classifySource(
      'https://twitter.com/user/status/123456789',
      'Random tweet about tech',
      'Just sharing my thoughts on AI.'
    );
    assert.strictEqual(classification.sourceType, 'social_or_unspecialized');
    assert.strictEqual(classification.isPrimary, false);
  });

  test('5. Evaluates and assigns higher quality score to peer-reviewed scientific sources than social media', () => {
    const sources = [
      {
        title: 'Random Blog Post',
        url: 'https://medium.com/@user/tech-blog',
        snippet: 'Some informal thoughts without data.'
      },
      {
        title: 'Journal of Medicine Clinical Trial',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
        snippet: 'Peer-reviewed clinical trial published in 2026 showing 88% improvement in patients.'
      }
    ];

    const evaluated = evaluateAndRankSources(sources, 'clinical trial medicine', 'medical');
    assert.strictEqual(evaluated.length, 2);
    // Peer-reviewed should be ranked first due to medical intent and high quality
    assert.strictEqual(evaluated[0].sourceType, 'scientific_peer_reviewed');
    assert.ok(evaluated[0].qualityScore >= 80);
    assert.ok(evaluated[1].qualityScore < 60);
  });

  test('6. Academic research intent prioritizes scientific and university sources', () => {
    const sources = [
      {
        title: 'General News Article',
        url: 'https://www.bbc.com/news/science-123',
        snippet: 'News summary of quantum computing.'
      },
      {
        title: 'University Department Overview',
        url: 'https://www.cam.ac.uk/about/university',
        snippet: 'Official university institutional page.'
      }
    ];

    const evaluated = evaluateAndRankSources(sources, 'quantum computing', 'academic');
    assert.strictEqual(evaluated[0].sourceType, 'university_research');
  });

  test('7. Deduplicates duplicate or syndicated sources correctly', () => {
    const sources = [
      {
        title: 'Original Article',
        url: 'https://reuters.com/technology/ai-2026',
        snippet: 'Detailed AI report.'
      },
      {
        title: 'Syndicated Duplicate',
        url: 'https://reuters.com/technology/ai-2026/', // trailing slash
        snippet: 'Detailed AI report duplicate.'
      }
    ];

    const evaluated = evaluateAndRankSources(sources, 'AI technology', 'general');
    assert.strictEqual(evaluated.length, 1);
  });

  test('8. Handles weak, empty, or malformed sources safely', () => {
    const sources = [
      {
        title: '',
        url: 'https://unknown-random-domain-test-12345.org/broken',
        snippet: ''
      }
    ];

    const evaluated = evaluateAndRankSources(sources, 'test query', 'general');
    assert.strictEqual(evaluated.length, 1);
    assert.ok(evaluated[0].qualityScore >= 10);
    assert.ok(evaluated[0].reasonForUse.length > 0);
  });
});
