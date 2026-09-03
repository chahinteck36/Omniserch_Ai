import { AIModel, PricingPlan } from '../types';

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'gemini',
    name: 'Gemini 3.6 Flash',
    provider: 'Google',
    badgeColor: 'from-blue-500 to-cyan-400',
    description: {
      ar: 'محرك بحث فائق مع ربط حي بمصادر جوجل وسياق 1M+ رمز',
      en: 'Real-time Google search grounding with 1M+ context window',
    },
    contextWindow: '1M tokens',
    speed: 'Ultra Fast',
    iconName: 'Sparkles',
  },
  {
    id: 'gpt4o',
    name: 'OpenAI GPT-4o',
    provider: 'OpenAI',
    badgeColor: 'from-emerald-500 to-teal-400',
    description: {
      ar: 'النموذج الرائد متعدد الوسائط والاستدلال اللغوي المتقدم',
      en: 'Flagship multimodal model with superior structured reasoning',
    },
    contextWindow: '128k tokens',
    speed: 'Fast',
    iconName: 'Cpu',
  },
  {
    id: 'claude35',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    badgeColor: 'from-amber-500 to-orange-400',
    description: {
      ar: 'الأفضل في التحليل الأكاديمي الدقيق وكتابة الأكواد والتقارير',
      en: 'Industry-leading for nuanced writing, logic, and deep code analysis',
    },
    contextWindow: '200k tokens',
    speed: 'Fast',
    iconName: 'BookOpen',
    isPro: true,
  },
  {
    id: 'llama3',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    badgeColor: 'from-indigo-500 to-purple-400',
    description: {
      ar: 'أقوى نموذج مفتوح المصدر للاستجابات السريعة والمباشرة',
      en: 'State-of-the-art open-source LLM for high-throughput queries',
    },
    contextWindow: '128k tokens',
    speed: 'Ultra Fast',
    iconName: 'Layers',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek R1 / V3',
    provider: 'DeepSeek',
    badgeColor: 'from-cyan-500 to-blue-600',
    description: {
      ar: 'استدلال رياضي ومنطقي عميق مع تتبع خطوات التفكير المتسلسل',
      en: 'Deep reasoning & chain-of-thought architecture for complex problems',
    },
    contextWindow: '64k tokens',
    speed: 'Deep Reasoning',
    iconName: 'BrainCircuit',
  },
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: { ar: 'الخطة المجانية', en: 'Free Plan' },
    price: '$0',
    period: { ar: '10 أبحاث', en: '10 searches' },
    description: {
      ar: 'رصيد 10 عمليات بحث إجمالية غير متجددة مرتبطة ببريدك الإلكتروني',
      en: '10 lifetime non-renewing search credits linked to your email',
    },
    features: {
      ar: [
        '10 عمليات بحث تجريبية شاملة (مرتبطة بالبريد وغير قابلة للتجديد)',
        'استخدام نماذج Gemini 3.6 و Llama 3.3',
        'تصفح مصادر الويب الحية (Web Grounding)',
        'تنبيه فوري لترقية الحساب بعد استهلاك الـ 10 أبحاث',
        'سجل بحث محلي حتى 20 عملية',
      ],
      en: [
        '10 total lifetime search credits (linked to email, non-renewing)',
        'Access to Gemini 3.6 and Llama 3.3',
        'Live Web Grounding citations',
        'Direct upgrade prompt upon quota completion',
        'Local history up to 20 queries',
      ],
    },
    buttonText: { ar: 'الخطة الحالية', en: 'Current Plan' },
  },
  {
    id: 'pro',
    name: { ar: 'الباحث المحترف Pro', en: 'Pro Researcher' },
    price: '$7',
    originalPrice: '$19',
    discountBadge: { ar: 'تخفيض 63%', en: '63% OFF' },
    period: { ar: 'شهرياً', en: 'per month' },
    popular: true,
    description: {
      ar: 'للباحثين، المطورين، وصناع القرار الذين يحتاجون قوة كاملة',
      en: 'For researchers, developers, and professionals needing deep insights',
    },
    features: {
      ar: [
        'استعلامات سريعة غير محدودة (Unlimited Fast)',
        '100 بحث استقصائي عميق شهرياً (Deep Research)',
        'الوصول لجميع النماذج: GPT-4o, Claude 3.5, DeepSeek R1',
        'وضع المقارنة المتعددة (Multi-Model Battle Mode)',
        'تحليل مستندات وأكواد غير محدودة (Code & Doc Auditor)',
        'تصدير التقارير بصيغ PDF و Markdown',
        'أولوية معالجة وسرعة استجابة فائقة',
      ],
      en: [
        'Unlimited Fast Research queries',
        '100 Deep Research reports / month',
        'Full access: GPT-4o, Claude 3.5, DeepSeek R1',
        'Multi-Model Battle & Consensus Mode',
        'Unlimited Code & Document Audits',
        'Export reports to PDF & Markdown',
        'Priority high-speed GPU processing',
      ],
    },
    buttonText: { ar: 'ترقية إلى Pro الآن', en: 'Upgrade to Pro' },
  },
  {
    id: 'enterprise',
    name: { ar: 'المؤسسات والفرق', en: 'Enterprise & Teams' },
    price: '$18',
    originalPrice: '$49',
    discountBadge: { ar: 'تخفيض 63%', en: '63% OFF' },
    period: { ar: 'شهرياً / عضو', en: 'per user / mo' },
    description: {
      ar: 'أعلى مستوى أمان وربط مخصص لفرق العمل والشركات',
      en: 'Maximum security, custom API connectors, and team collaboration',
    },
    features: {
      ar: [
        'كل مزايا باقة Pro بدون أي قيود',
        'ربط مفاتيح OpenRouter / OpenAI / Anthropic مخصصة',
        'مساحات بحث مشتركة للفرق (Team Workspaces)',
        'دعم فني مخصص 24/7 مع SLA مضمون',
        'تحليل ملفات ضخمة حتى 100MB',
      ],
      en: [
        'Everything in Pro with Zero Limits',
        'Bring Your Own Keys (OpenRouter, Azure, OpenAI)',
        'Shared Team Research Workspaces',
        'Dedicated 24/7 Priority Support & SLA',
        'Large file audits up to 100MB',
      ],
    },
    buttonText: { ar: 'تفعيل المؤسسات', en: 'Contact / Activate' },
  },
];

export const SAMPLE_QUERIES = {
  ar: [
    {
      title: 'مقارنة بين أطر عمل الذكاء الاصطناعي 2026',
      query: 'ما هي المقارنة التقنية الشاملة بين PyTorch و JAX ونماذج Transformers الحديثة في 2026؟',
      mode: 'deep' as const,
    },
    {
      title: 'تحليل أسواق الطاقة المتجددة والهيدروجين الأخضر',
      query: 'أحدث اتجاهات الاستثمار وتكلفة إنتاج الهيدروجين الأخضر عالمياً في 2025-2026',
      mode: 'deep' as const,
    },
    {
      title: 'مقارنة إجابات الذكاء الاصطناعي (Battle Mode)',
      query: 'هل سيتفوق الذكاء الاصطناعي العام (AGI) على البرمجة البشرية بالكامل؟',
      mode: 'battle' as const,
    },
    {
      title: 'تدقيق أمان الكود وتحسين الأداء',
      query: 'كيف يمكن تأمين تطبيق Node.js و React ضد ثغرات XSS و CSRF و Prototype Pollution؟',
      mode: 'code' as const,
    },
    {
      title: 'بحث سريع: أحدث معالجات الحوسبة الكمية',
      query: 'ما هي آخر إنجازات معالجات الحوسبة الكمية وتصحيح الأخطاء؟',
      mode: 'fast' as const,
    },
  ],
  en: [
    {
      title: 'AI Frameworks Benchmark 2026',
      query: 'Comprehensive architectural and performance benchmark of PyTorch, JAX, and emerging ML runtimes in 2026.',
      mode: 'deep' as const,
    },
    {
      title: 'Green Hydrogen & Clean Energy Markets',
      query: 'Global investment trends, levelized cost of production (LCOE), and supply chain forecasts for Green Hydrogen.',
      mode: 'deep' as const,
    },
    {
      title: 'Multi-LLM Battle: Future of Software Engineering',
      query: 'Will Autonomous AI Agents completely replace Full-Stack Developers in the next 5 years?',
      mode: 'battle' as const,
    },
    {
      title: 'Code Security & Memory Optimization',
      query: 'Best patterns to prevent memory leaks and concurrency race conditions in high-scale async TypeScript servers.',
      mode: 'code' as const,
    },
    {
      title: 'Fast Research: Quantum Error Correction',
      query: 'What are the most recent breakthroughs in topological qubits and quantum error correction?',
      mode: 'fast' as const,
    },
  ],
};
