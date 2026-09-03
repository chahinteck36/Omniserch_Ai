export type ResearchMode = 'fast' | 'deep' | 'battle' | 'code';

export type Language = 'ar' | 'en';

export interface AIModel {
  id: string;
  name: string;
  provider: 'Google' | 'OpenAI' | 'Anthropic' | 'Meta' | 'DeepSeek' | 'Mistral';
  badgeColor: string;
  description: {
    ar: string;
    en: string;
  };
  contextWindow: string;
  speed: 'Ultra Fast' | 'Fast' | 'Deep Reasoning';
  iconName: string;
  isPro?: boolean;
}

export interface ModelConfig extends AIModel {
  isEnabled: boolean;
  temperature?: number;
  maxTokens?: number;
  tierRequired?: 'all' | 'pro' | 'enterprise';
  systemPromptAddition?: string;
}

export interface SearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ModelResponse {
  modelId: string;
  modelName: string;
  provider: string;
  badgeColor: string;
  content: string;
  latencyMs: number;
  tokensUsed: number;
}

export interface DeepResearchPhase {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  details?: string;
}

export interface CodeAnalysis {
  overview: string;
  bugsOrIssues: string[];
  improvements: string[];
  optimizedCode?: string;
  language?: string;
}

export interface SearchResult {
  id: string;
  query: string;
  timestamp: number;
  mode: ResearchMode;
  selectedModels: string[];
  summary?: string;
  detailedReport?: string;
  sources: SearchSource[];
  keyTakeaways?: string[];
  modelResponses?: ModelResponse[];
  suggestedQueries?: string[];
  codeAnalysis?: CodeAnalysis;
  deepResearchPhases?: DeepResearchPhase[];
  searchMetadata?: {
    searchQueriesUsed?: string[];
    totalSources: number;
    processingTimeMs: number;
  };
  isBookmarked?: boolean;
  attachedFileName?: string;
}

export interface UserPlan {
  tier: 'free' | 'pro' | 'enterprise';
  name: string;
  email?: string;
  totalFreeLimit: number; // 10 lifetime
  usedSearches: number;
  licenseKey?: string;
  activatedAt?: number;
  expiresAt?: number; // Expiration timestamp in milliseconds
  duration?: '1_month' | '3_months' | '1_year' | 'lifetime';
  hasExpiryNoticeShown?: boolean;
}

export interface ActivationCode {
  code: string;
  tier: 'pro' | 'enterprise';
  duration: '1_month' | '3_months' | '1_year' | 'lifetime';
  createdAt: number;
  isUsed: boolean;
  usedByEmail?: string;
  usedAt?: number;
  expiresAt?: number;
  note?: string;
}

export interface EmailNotificationLog {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  sentAt: number;
  type: 'activation_confirmed' | 'subscription_expiring_soon' | 'subscription_expired' | 'renewal_prompt';
  planTier: string;
  expirationDate: string;
}

export interface PricingPlan {
  id: 'free' | 'pro' | 'enterprise';
  name: { ar: string; en: string };
  price: string;
  originalPrice?: string;
  discountBadge?: { ar: string; en: string };
  period: { ar: string; en: string };
  description: { ar: string; en: string };
  popular?: boolean;
  features: { ar: string[]; en: string[] };
  buttonText: { ar: string; en: string };
}
