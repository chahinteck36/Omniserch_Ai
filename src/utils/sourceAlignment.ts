import { SearchSource } from '../types';

/**
 * Ensures the detailed report body aligns 100% truthfully with the actual grounding sources.
 *
 * Requirements:
 * 1. When sources.length === 0:
 *    - Strips any hallucinated or simulated "References", "Sources", "المصادر والمراجع" sections,
 *      regardless of whether they appear at the end, middle, or formatted as headings, bold labels,
 *      or lists, while preserving subsequent content (e.g. recommendations, conclusions).
 *    - Prevents presenting names of organizations or websites as consulted or verified sources
 *      for this research, while preserving general informational context.
 *    - Injects an explicit transparency disclaimer stating that no external web citations were
 *      returned in this session, avoiding any claims of external fact-checking or verification.
 * 2. When sources.length > 0:
 *    - Ensures the references section in the report strictly matches the genuine verified sources
 *      extracted from Gemini's grounding metadata.
 */

// Matches headings and labels introducing a references/sources section or list
const REFERENCE_SECTION_PATTERN = /(?:^|\n)(?:[ \t]*(?:#{1,4}\s*|\*{1,2}|_{1,2})?(?:المصادر\s*(?:و|\/|&)\s*المراجع|المراجع\s*(?:و|\/|&)\s*المصادر|المصادر\s*المستند\s*إليها|المصادر\s*المعتمدة(?:\s*(?:في\s*هذا\s*البحث|لهذا\s*التقرير))?|المراجع\s*المعتمدة|قائمة\s*المراجع|قائمة\s*المصادر|المصادر\s*المستخدمة|المصادر\s*الموثقة|المصادر\s*الرئيسية|أهم\s*المصادر|أبرز\s*المصادر|المصادر|المراجع|مراجع\s*إضافية|(?:استند\s+هذا\s+البحث|تم\s+(?:الاعتماد|الرجوع))\s+إلى\s+(?:المصادر|المراجع)(?:\s+(?:المعتمدة|التالية|الموثقة))?|Based\s+on\s+the\s+following\s+(?:verified\s+)?sources|Sources\s+consulted\s+for\s+this\s+report|References(?:\s*(?:and|&)\s*Sources)?|Sources(?:\s*(?:and|&)\s*References)?|Sources(?:\s*(?:and|&)\s*Citations)?|Sources|References|Bibliography|Works\s*Cited|Citations)(?:\*{1,2}|_{1,2})?(?:[:\s\-–—]|$)[^\n]*)([\s\S]*?)(?=(?:\n[ \t]*#{1,4}\s+[^\n]+|\n[ \t]*---\s*|\s*$))/gi;

// Phrases falsely claiming external verification or consulted sources when none exist
const FALSE_VERIFICATION_CLAIMS_AR: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /تمت?\s+(?:المطابقة\s+و)?التحقق\s+(?:من\s+صحة\s+المعلومات\s+)?(?:ب|بال)?الاستناد\s+إلى\s+مصادر\s+(?:مستقلة|خارجية|موثوقة)/gi,
    replacement: 'تم استخلاص التحليل من المعرفة التحليلية للنموذج',
  },
  {
    pattern: /تمت?\s+مراجعة\s+(?:و|مع\s+)?(?:مقارنة\s+)?المصادر\s+(?:المستقلة|الخارجية|المعتمدة)/gi,
    replacement: 'تمت الصياغة استناداً إلى قاعدة المعرفة للنموذج',
  },
  {
    pattern: /(?:استند\s+هذا\s+البحث|تم\s+الاعتماد\s+في\s+هذا\s+البحث|تم\s+الرجوع)\s+إلى\s+(?:المصادر|المراجع)\s+(?:المعتمدة|التالية|الموثقة)\s*:/gi,
    replacement: 'المعطيات ذات الصلة:',
  },
  {
    pattern: /(?:المصادر|المراجع)\s+المعتمدة\s+(?:في\s+هذا\s+البحث|لهذا\s+التقرير)\s*:/gi,
    replacement: 'المعطيات ذات الصلة:',
  },
];

const FALSE_VERIFICATION_CLAIMS_EN: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /(?:cross-validated|verified|checked)\s+against\s+(?:independent|external|authoritative)\s+sources/gi,
    replacement: 'synthesized from model analytical knowledge',
  },
  {
    pattern: /(?:sources|references)\s+consulted\s+for\s+this\s+report\s*:/gi,
    replacement: 'Related contextual dimensions:',
  },
  {
    pattern: /based\s+on\s+the\s+following\s+verified\s+sources\s*:/gi,
    replacement: 'Relevant dimensions:',
  },
];

export function verifyClaimSourceAlignment(reportText: string, sources: SearchSource[] = []): { alignedText: string; hasUnverifiedClaims: boolean } {
  if (!reportText || typeof reportText !== 'string') {
    return { alignedText: '', hasUnverifiedClaims: false };
  }

  if (!sources || sources.length === 0) {
    return { alignedText: reportText, hasUnverifiedClaims: false };
  }

  const sourceCorpus = sources
    .map(s => `${s.title || ''} ${s.snippet || ''} ${s.url || ''}`)
    .join(' ')
    .toLowerCase();

  let hasUnverified = false;
  const percentageRegex = /(\b\d{1,3}(?:\.\d+)?%)/g;
  const yearRegex = /\b(20[1-3]\d)\b/g;
  const versionRegex = /\b(?:v|version|الإصدار)\s*\d+(?:\.\d+)*\b/gi;
  const paragraphs = reportText.split('\n');

  const updatedParagraphs = paragraphs.map(paragraph => {
    const pctMatches = paragraph.match(percentageRegex) || [];
    const yearMatches = paragraph.match(yearRegex) || [];
    const versionMatches = paragraph.match(versionRegex) || [];

    let paragraphSupported = true;

    for (const pct of pctMatches) {
      const numPart = pct.replace('%', '').trim();
      if (!sourceCorpus.includes(numPart) && !sourceCorpus.includes(pct.toLowerCase())) {
        paragraphSupported = false;
        break;
      }
    }

    for (const yr of yearMatches) {
      if (!sourceCorpus.includes(yr)) {
        paragraphSupported = false;
        break;
      }
    }

    for (const ver of versionMatches) {
      if (!sourceCorpus.includes(ver.toLowerCase())) {
        paragraphSupported = false;
        break;
      }
    }

    if (!paragraphSupported) {
      hasUnverified = true;
      if (!paragraph.includes('غير متحقق') && !paragraph.includes('Unverified')) {
        return `${paragraph} [⚠️ ملاحظة توثيقية: هذا الادعاء (الرقمي أو الزمني أو الإصدار) غير مثبت ببيانات المصادر المسترجعة ويعتبر غير متحقق].`;
      }
    }

    return paragraph;
  });

  return {
    alignedText: updatedParagraphs.join('\n'),
    hasUnverifiedClaims: hasUnverified,
  };
}

export function alignReportWithSources(
  reportText: string,
  sources: SearchSource[] = [],
  isArabic: boolean = true
): string {
  if (!reportText || typeof reportText !== 'string') return '';

  let cleaned = reportText.trim();

  const disclaimerArabic = `### بيان التوثيق والمراجع
> **تنبيه الشفافية (حالة غير موثقة):** لم يُرجع مزود البحث روابط خارجية موثقة لهذا الاستعلام في هذه الجلسة (0 مصادر ويب مسترجعة). المعلومات والتحليلات الواردة في هذا التقرير مستخلصة من قاعدة المعرفة الداخلية لنموذج الذكاء الاصطناعي دون مراجع ويب في هذه الجلسة أو ادعاء بإجراء تحقق خارجي.`;

  const disclaimerEnglish = `### Grounding & Citations Notice
> **Transparency Notice (Unverified State):** No verified external web sources were returned by the grounding provider for this query in this session (0 web sources retrieved). Findings and analyses in this report are synthesized from internal model knowledge without independent external web citations or claims of external verification.`;

  const disclaimer = isArabic ? disclaimerArabic : disclaimerEnglish;

  // 1. Strip all unverified / pseudo-references sections
  cleaned = cleaned.replace(REFERENCE_SECTION_PATTERN, '');

  if (!sources || sources.length === 0) {
    // Sanitize any in-text claims of external verification
    const claimsList = isArabic ? FALSE_VERIFICATION_CLAIMS_AR : FALSE_VERIFICATION_CLAIMS_EN;
    for (const claim of claimsList) {
      cleaned = cleaned.replace(claim.pattern, claim.replacement);
    }

    // Clean up trailing dashes or horizontal rules left after section removal
    cleaned = cleaned.replace(/\n\s*---\s*$/g, '').trim();

    // Constrain long confident narratives if zero sources retrieved
    if (cleaned.length > 1800) {
      const lines = cleaned.split('\n');
      cleaned = lines.slice(0, 15).join('\n') + '\n\n*(...تم تقييد النص الطويل لعدم توفر مصادر ويب موثقة للاستعلام...)*';
    }

    // Append transparency notice once
    if (!cleaned.includes('بيان التوثيق والمراجع') && !cleaned.includes('Grounding & Citations Notice')) {
      cleaned = `${cleaned}\n\n---\n\n${disclaimer}`;
    }
  } else {
    // 2. Verify claim-source numerical data alignment against actual source snippets
    const alignment = verifyClaimSourceAlignment(cleaned, sources);
    cleaned = alignment.alignedText;

    // 3. Verified real sources exist: format authentic references list strictly matching Gemini data
    const realSourcesList = sources
      .map((s, idx) => {
        let domain = '';
        try {
          domain = new URL(s.url).hostname.replace(/^www\./, '');
        } catch {
          domain = 'Web Source';
        }
        return `${idx + 1}. [${s.title || domain}](${s.url})${s.snippet ? ` — *${s.snippet.slice(0, 160)}*` : ''}`;
      })
      .join('\n');

    const realSectionTitle = isArabic ? '### المصادر والمراجع الموثقة' : '### Verified Grounding Sources';
    const realSection = `\n\n---\n\n${realSectionTitle}\n${realSourcesList}`;

    cleaned = cleaned.replace(/\n\s*---\s*$/g, '').trim();
    cleaned = `${cleaned}${realSection}`;
  }

  return cleaned.trim();
}
