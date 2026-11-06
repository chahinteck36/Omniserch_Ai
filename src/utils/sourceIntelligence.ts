import { SearchSource } from '../types';

export type SourceType =
  | 'scientific_peer_reviewed'
  | 'university_research'
  | 'government_medical'
  | 'academic_books'
  | 'general_educational'
  | 'news_media'
  | 'social_or_unspecialized';

export interface EvaluatedSource extends SearchSource {
  publisherName: string;
  sourceType: SourceType;
  sourceTypeLabel: { ar: string; en: string };
  qualityScore: number; // 0 to 100
  publicationDate?: string;
  reasonForUse: string;
  isPrimarySource: boolean;
  scoreBreakdown: {
    publisherReliability: number;
    authorQualifications: number;
    peerReviewStatus: number;
    contentRecency: number;
    topicRelevance: number;
    accessibility: number;
    evidenceSupport: number;
  };
}

export type ResearchIntent = 'academic' | 'medical' | 'news' | 'general';

const SOURCE_TYPE_LABELS: Record<SourceType, { ar: string; en: string }> = {
  scientific_peer_reviewed: { ar: 'مصدر علمي محكّم', en: 'Peer-Reviewed Scientific Source' },
  university_research: { ar: 'بحث جامعي ومؤسسي', en: 'University & Research Institution' },
  government_medical: { ar: 'مؤسسة حكومية أو طبية رسمية', en: 'Official Government & Medical Institution' },
  academic_books: { ar: 'كتاب أو مرجع أكاديمي', en: 'Academic Book & Reference' },
  general_educational: { ar: 'موقع تعليمي عام', en: 'General Educational Portal' },
  news_media: { ar: 'مؤسسة إخبارية وصحفية', en: 'News & Journalistic Media' },
  social_or_unspecialized: { ar: 'منصة اجتماعية أو محتوى غير متخصص', en: 'Social Platform & Non-Specialized Content' },
};

export function classifySource(url: string, title: string = '', snippet: string = ''): { sourceType: SourceType; publisherName: string; isPrimary: boolean } {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();

  let publisherName = 'Web Source';
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    publisherName = hostname;
  } catch {
    publisherName = 'Unknown Publisher';
  }

  // 1. Scientific Peer-Reviewed
  if (
    lowerUrl.includes('pubmed.ncbi.nlm.nih.gov') ||
    lowerUrl.includes('ncbi.nlm.nih.gov/pmc') ||
    lowerUrl.includes('crossref.org') ||
    lowerUrl.includes('nature.com') ||
    lowerUrl.includes('science.org') ||
    lowerUrl.includes('sciencedirect.com') ||
    lowerUrl.includes('springer.com') ||
    lowerUrl.includes('ieee.org') ||
    lowerUrl.includes('acm.org') ||
    lowerUrl.includes('thelancet.com') ||
    lowerUrl.includes('nejm.org') ||
    lowerUrl.includes('jama.com') ||
    lowerUrl.includes('arxiv.org') ||
    lowerUrl.includes('plos.org') ||
    lowerTitle.includes('journal of') ||
    lowerTitle.includes('peer-reviewed') ||
    lowerSnippet.includes('peer-reviewed')
  ) {
    if (publisherName === 'Unknown Publisher' || publisherName.includes('ncbi')) publisherName = 'PubMed / PMC / Scientific Journal';
    return { sourceType: 'scientific_peer_reviewed', publisherName, isPrimary: true };
  }

  // 2. University Research (.edu, .ac.uk, etc.)
  if (
    lowerUrl.includes('.edu') ||
    lowerUrl.includes('.ac.uk') ||
    lowerUrl.includes('university') ||
    lowerUrl.includes('harvard.edu') ||
    lowerUrl.includes('stanford.edu') ||
    lowerUrl.includes('mit.edu') ||
    lowerUrl.includes('ox.ac.uk') ||
    lowerUrl.includes('cam.ac.uk') ||
    lowerTitle.includes('university research') ||
    lowerSnippet.includes('university press')
  ) {
    return { sourceType: 'university_research', publisherName, isPrimary: true };
  }

  // 3. Government & Medical Institutions (.gov, who.int, cdc.gov, fda.gov, nih.gov)
  if (
    lowerUrl.includes('.gov') ||
    lowerUrl.includes('who.int') ||
    lowerUrl.includes('cdc.gov') ||
    lowerUrl.includes('fda.gov') ||
    lowerUrl.includes('nih.gov') ||
    lowerUrl.includes('europa.eu') ||
    lowerUrl.includes('spa.gov.sa') ||
    lowerTitle.includes('ministry of') ||
    lowerTitle.includes('official') ||
    lowerSnippet.includes('official announcement')
  ) {
    return { sourceType: 'government_medical', publisherName, isPrimary: true };
  }

  // 4. Academic Books
  if (
    lowerUrl.includes('books.google') ||
    lowerUrl.includes('archive.org') ||
    lowerUrl.includes('jstor.org') ||
    lowerTitle.includes('book') ||
    lowerTitle.includes('encyclopedia') ||
    lowerSnippet.includes('academic press')
  ) {
    return { sourceType: 'academic_books', publisherName, isPrimary: false };
  }

  // 5. General Educational
  if (
    lowerUrl.includes('wikipedia.org') ||
    lowerUrl.includes('britannica.com') ||
    lowerUrl.includes('coursera.org') ||
    lowerUrl.includes('edx.org') ||
    lowerUrl.includes('khanacademy.org') ||
    lowerTitle.includes('tutorial') ||
    lowerSnippet.includes('educational guide')
  ) {
    return { sourceType: 'general_educational', publisherName, isPrimary: false };
  }

  // 6. News Media
  if (
    lowerUrl.includes('reuters.com') ||
    lowerUrl.includes('apnews.com') ||
    lowerUrl.includes('bbc.com') ||
    lowerUrl.includes('cnn.com') ||
    lowerUrl.includes('aljazeera.net') ||
    lowerUrl.includes('nytimes.com') ||
    lowerUrl.includes('wsj.com') ||
    lowerUrl.includes('bloomberg.com') ||
    lowerUrl.includes('theguardian.com') ||
    lowerUrl.includes('ft.com') ||
    lowerUrl.includes('economist.com') ||
    lowerTitle.includes('news') ||
    lowerSnippet.includes('reporters')
  ) {
    return { sourceType: 'news_media', publisherName, isPrimary: false };
  }

  // 7. Social or Unspecialized
  if (
    lowerUrl.includes('twitter.com') ||
    lowerUrl.includes('x.com') ||
    lowerUrl.includes('facebook.com') ||
    lowerUrl.includes('instagram.com') ||
    lowerUrl.includes('tiktok.com') ||
    lowerUrl.includes('reddit.com') ||
    lowerUrl.includes('medium.com') ||
    lowerUrl.includes('blog')
  ) {
    return { sourceType: 'social_or_unspecialized', publisherName, isPrimary: false };
  }

  return { sourceType: 'general_educational', publisherName, isPrimary: false };
}

export function evaluateAndRankSources(
  sources: SearchSource[],
  query: string,
  researchIntent: ResearchIntent = 'general'
): EvaluatedSource[] {
  if (!sources || !Array.isArray(sources)) return [];

  // 1. Deduplicate sources by normalized URL
  const seenUrls = new Set<string>();
  const uniqueSources: SearchSource[] = [];
  for (const s of sources) {
    if (!s.url || typeof s.url !== 'string') continue;
    try {
      const parsed = new URL(s.url);
      const cleanUrl = `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        uniqueSources.push(s);
      }
    } catch {
      if (!seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        uniqueSources.push(s);
      }
    }
  }

  // 2. Evaluate each source
  const evaluated: EvaluatedSource[] = uniqueSources.map((s) => {
    const classification = classifySource(s.url, s.title, s.snippet);
    const sourceType = classification.sourceType;
    const publisherName = classification.publisherName;
    const isPrimarySource = classification.isPrimary;

    // Base reliability by type (0-100 scale)
    const baseReliabilityMap: Record<SourceType, number> = {
      scientific_peer_reviewed: 95,
      university_research: 90,
      government_medical: 90,
      academic_books: 85,
      general_educational: 75,
      news_media: 70,
      social_or_unspecialized: 30,
    };
    const publisherReliability = baseReliabilityMap[sourceType] || 60;

    // Author qualifications check (0-100 scale)
    const combinedText = `${s.title || ''} ${s.snippet || ''}`.toLowerCase();
    const hasAuthorCreds =
      combinedText.includes('dr.') ||
      combinedText.includes('professor') ||
      combinedText.includes('ph.d') ||
      combinedText.includes('دكتور') ||
      combinedText.includes('أستاذ') ||
      combinedText.includes('باحث');
    const authorQualifications = hasAuthorCreds ? 100 : 50;

    // Peer review status (0-100 scale)
    const hasPeerReview =
      sourceType === 'scientific_peer_reviewed' ||
      combinedText.includes('peer-reviewed') ||
      combinedText.includes('محكم') ||
      combinedText.includes('clinical trial');
    const peerReviewStatus = hasPeerReview ? 100 : 30;

    // Recency check (0-100 scale)
    const yearMatch = combinedText.match(/\b(20[2-6]\d)\b/);
    const contentRecency = yearMatch ? 100 : 50;

    // Topic relevance check against query words (0-100 scale)
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let matchedTerms = 0;
    for (const term of queryTerms) {
      if (combinedText.includes(term)) matchedTerms++;
    }
    const topicRelevance = queryTerms.length > 0 ? Math.min(100, Math.round((matchedTerms / queryTerms.length) * 100)) : 75;

    // Accessibility & Evidence support (0-100 scale)
    const hasSnippet = Boolean(s.snippet && s.snippet.trim().length > 30);
    const hasEvidence = hasSnippet && (s.snippet!.includes('%') || /\d/.test(s.snippet!));
    const accessibility = hasSnippet ? 100 : 40;
    const evidenceSupport = hasEvidence ? 100 : 50;

    // Total Quality Score calculation (weighted average, each component 0-100)
    let qualityScore = Math.round(
      publisherReliability * 0.30 +
      authorQualifications * 0.10 +
      peerReviewStatus * 0.15 +
      contentRecency * 0.10 +
      topicRelevance * 0.15 +
      accessibility * 0.10 +
      evidenceSupport * 0.10
    );

    // Intent-based boost/penalty
    if (researchIntent === 'academic') {
      if (sourceType === 'scientific_peer_reviewed' || sourceType === 'university_research') qualityScore += 8;
      if (sourceType === 'social_or_unspecialized') qualityScore -= 30;
    } else if (researchIntent === 'medical') {
      if (sourceType === 'government_medical' || sourceType === 'scientific_peer_reviewed') qualityScore += 10;
      if (sourceType === 'social_or_unspecialized') qualityScore -= 35;
    } else if (researchIntent === 'news') {
      if (sourceType === 'news_media') qualityScore += 10;
    }

    qualityScore = Math.max(10, Math.min(100, qualityScore));

    // Publication Date extraction if present
    const dateMatch = combinedText.match(/\b(20[2-6]\d[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01]))\b/) || yearMatch;
    const publicationDate = dateMatch ? dateMatch[0] : undefined;

    // Reason for use
    let reasonForUse = `Selected as a ${getSourceTypeLabel(sourceType, 'en')} with a quality score of ${qualityScore}/100.`;
    if (sourceType === 'scientific_peer_reviewed') {
      reasonForUse = `Provides peer-reviewed scientific evidence and validated research findings (Score: ${qualityScore}).`;
    } else if (sourceType === 'university_research') {
      reasonForUse = `Sourced from authoritative academic and university research work (Score: ${qualityScore}).`;
    } else if (sourceType === 'government_medical') {
      reasonForUse = `Sourced from official government or medical health institution guidelines (Score: ${qualityScore}).`;
    } else if (sourceType === 'news_media') {
      reasonForUse = `Provides timely journalistic reporting and recent news coverage (Score: ${qualityScore}).`;
    } else {
      reasonForUse = `General informational context reference (Score: ${qualityScore}).`;
    }

    return {
      ...s,
      publisherName,
      sourceType,
      sourceTypeLabel: SOURCE_TYPE_LABELS[sourceType],
      qualityScore,
      publicationDate,
      reasonForUse,
      isPrimarySource,
      scoreBreakdown: {
        publisherReliability,
        authorQualifications,
        peerReviewStatus,
        contentRecency,
        topicRelevance,
        accessibility,
        evidenceSupport,
      },
    };
  });

  // 3. Sort evaluated sources based on research intent and quality score
  evaluated.sort((a, b) => {
    if (researchIntent === 'academic') {
      const aPriority = a.sourceType === 'scientific_peer_reviewed' || a.sourceType === 'university_research' ? 2 : a.sourceType === 'academic_books' ? 1 : 0;
      const bPriority = b.sourceType === 'scientific_peer_reviewed' || b.sourceType === 'university_research' ? 2 : b.sourceType === 'academic_books' ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
    } else if (researchIntent === 'medical') {
      const aPriority = a.sourceType === 'government_medical' || a.sourceType === 'scientific_peer_reviewed' ? 2 : 0;
      const bPriority = b.sourceType === 'government_medical' || b.sourceType === 'scientific_peer_reviewed' ? 2 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
    } else if (researchIntent === 'news') {
      const aPriority = a.sourceType === 'news_media' ? 2 : 0;
      const bPriority = b.sourceType === 'news_media' ? 2 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
    }
    return b.qualityScore - a.qualityScore;
  });

  return evaluated;
}

export function getSourceTypeLabel(sourceType: SourceType, lang: 'ar' | 'en' = 'ar'): string {
  return SOURCE_TYPE_LABELS[sourceType]?.[lang] || SOURCE_TYPE_LABELS.general_educational[lang];
}
