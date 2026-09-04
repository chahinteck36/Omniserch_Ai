import { AVAILABLE_MODELS } from '../data/models';
import { ModelConfig } from '../types';

const MODELS_CONFIG_STORAGE_KEY = 'omnisearch_models_config';
const GEMINI_KEY_STORAGE = 'omnisearch_gemini_key';
const OPENROUTER_KEY_STORAGE = 'omnisearch_openrouter_key';
const CUSTOM_ENDPOINT_STORAGE = 'omnisearch_custom_endpoint';

export function getDefaultModelsConfig(): ModelConfig[] {
  return AVAILABLE_MODELS.map((model) => ({
    ...model,
    isEnabled: true,
    temperature: 0.7,
    maxTokens: model.contextWindow.includes('1M') ? 4096 : 2048,
    tierRequired: model.isPro ? 'pro' : 'all',
  }));
}

export function getStoredModelsConfig(): ModelConfig[] {
  try {
    const raw = localStorage.getItem(MODELS_CONFIG_STORAGE_KEY);
    if (!raw) {
      const defaults = getDefaultModelsConfig();
      saveModelsConfig(defaults);
      return defaults;
    }

    const parsed: ModelConfig[] = JSON.parse(raw);
    const defaults = getDefaultModelsConfig();

    // Merge in case any new models were added to AVAILABLE_MODELS
    const merged = defaults.map((def) => {
      const existing = parsed.find((p) => p.id === def.id);
      if (existing) {
        return {
          ...def,
          ...existing,
          name: def.name, // keep updated name/badge
          badgeColor: def.badgeColor,
        };
      }
      return def;
    });

    return merged;
  } catch {
    return getDefaultModelsConfig();
  }
}

export function saveModelsConfig(configs: ModelConfig[]): void {
  try {
    localStorage.setItem(MODELS_CONFIG_STORAGE_KEY, JSON.stringify(configs));
    // Dispatch a custom event so other components can reactively update
    window.dispatchEvent(new CustomEvent('omnisearch:models_updated'));
  } catch (err) {
    console.error('Failed to save models config:', err);
  }
}

export function toggleModelStatus(modelId: string, isEnabled: boolean): ModelConfig[] {
  const current = getStoredModelsConfig();
  const updated = current.map((m) => (m.id === modelId ? { ...m, isEnabled } : m));
  saveModelsConfig(updated);
  return updated;
}

export function updateModelConfigItem(modelId: string, updates: Partial<ModelConfig>): ModelConfig[] {
  const current = getStoredModelsConfig();
  const updated = current.map((m) => (m.id === modelId ? { ...m, ...updates } : m));
  saveModelsConfig(updated);
  return updated;
}

export function resetModelsToDefault(): ModelConfig[] {
  const defaults = getDefaultModelsConfig();
  saveModelsConfig(defaults);
  return defaults;
}

export function getGeminiApiKey(): string {
  try {
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    return localStorage.getItem(GEMINI_KEY_STORAGE) || envKey || '';
  } catch {
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
    window.dispatchEvent(new CustomEvent('omnisearch:keys_updated'));
  } catch (err) {
    console.error('Failed to save Gemini key:', err);
  }
}

export function removeGeminiApiKey(): void {
  try {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    window.dispatchEvent(new CustomEvent('omnisearch:keys_updated'));
  } catch (err) {
    console.error('Failed to remove Gemini key:', err);
  }
}

/**
 * Validates a Gemini API Key via direct lightweight ping to Google Generative Language API
 */
export async function validateGeminiApiKey(key: string): Promise<{
  valid: boolean;
  message: string;
}> {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { valid: false, message: 'مفتاح Gemini فارغ' };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(cleanKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
        }),
      }
    );

    if (res.ok) {
      return { valid: true, message: 'مفتاح Gemini صالح وفعال بنجاح! جاهز للاستخدام.' };
    }

    const errData = await res.json().catch(() => null);
    const msg = errData?.error?.message || `خطأ استجابة من Google: كود ${res.status}`;
    return { valid: false, message: msg };
  } catch (err: any) {
    return {
      valid: false,
      message: err?.message || 'تعذر الاتصال بـ Google API للتحقق من المفتاح',
    };
  }
}

export function getOpenRouterApiKey(): string {
  return localStorage.getItem(OPENROUTER_KEY_STORAGE) || '';
}

export function saveOpenRouterApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(OPENROUTER_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(OPENROUTER_KEY_STORAGE);
  }
  window.dispatchEvent(new CustomEvent('omnisearch:keys_updated'));
}

export function removeOpenRouterApiKey(): void {
  localStorage.removeItem(OPENROUTER_KEY_STORAGE);
  window.dispatchEvent(new CustomEvent('omnisearch:keys_updated'));
}

export function getCustomEndpoint(): string {
  return localStorage.getItem(CUSTOM_ENDPOINT_STORAGE) || '';
}

export function saveCustomEndpoint(url: string): void {
  if (url.trim()) {
    localStorage.setItem(CUSTOM_ENDPOINT_STORAGE, url.trim());
  } else {
    localStorage.removeItem(CUSTOM_ENDPOINT_STORAGE);
  }
}

/**
 * Validates OpenRouter API Key via server proxy or client check
 */
export async function validateOpenRouterKey(key: string): Promise<{
  valid: boolean;
  message: string;
  data?: any;
}> {
  if (!key || !key.trim()) {
    return { valid: false, message: 'API key is empty' };
  }

  try {
    const res = await fetch('/api/validate-openrouter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key.trim() }),
    });

    const result = await res.json();
    return result;
  } catch (err: any) {
    return {
      valid: false,
      message: err.message || 'Network error while validating key',
    };
  }
}

/**
 * Checks backend health and Gemini status
 */
export async function checkBackendEngineHealth(): Promise<{
  ok: boolean;
  geminiKeyConfigured: boolean;
  timestamp?: string;
}> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health endpoint returned error');
    const data = await res.json();
    return {
      ok: true,
      geminiKeyConfigured: Boolean(data.geminiKeyConfigured),
      timestamp: data.timestamp,
    };
  } catch {
    return {
      ok: false,
      geminiKeyConfigured: false,
    };
  }
}
