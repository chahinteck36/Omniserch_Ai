/**
 * Centralized API Client for OmniSearch AI
 * Unifies backend connectivity across Cloudflare Pages (Frontend) and Express / Render / Cloud Run (Backend).
 */

import { getUserToken } from './licenseService';

export function getApiBaseUrl(): string {
  try {
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
  } catch {
    // Fall back to relative path if env is not defined
  }
  return '';
}

/**
 * Builds a fully qualified API URL or relative path based on environment configuration.
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

/**
 * Enhanced fetch wrapper with default JSON headers, authentication token, and timeout.
 */
export async function fetchApi(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const url = apiUrl(path);
  const { timeoutMs = 35000, headers: customHeaders, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(customHeaders || {});
  if (!headers.has('Content-Type') && rest.body && typeof rest.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Attach authoritative user token if available
  const userToken = getUserToken();
  if (userToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${userToken}`);
  }

  try {
    const response = await fetch(url, {
      ...rest,
      headers,
      signal: options.signal || controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verifies live connection to the backend service.
 */
export async function testBackendConnection(): Promise<{
  ok: boolean;
  status: number;
  url: string;
  data?: any;
  error?: string;
}> {
  const endpoint = apiUrl('/api/health');
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, status: res.status, url: endpoint, data };
    }
    return {
      ok: false,
      status: res.status,
      url: endpoint,
      error: `Server responded with HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      url: endpoint,
      error: err?.message || 'Network error / server unreachable',
    };
  }
}
