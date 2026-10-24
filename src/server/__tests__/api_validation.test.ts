import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from '../api';

describe('Task D & F: API Validation, Allowlist, and Secret Protection', () => {
  // Test helper to dispatch requests to the Express router
  async function simulateRequest(method: string, path: string, body?: any, headers: Record<string, string> = {}) {
    return new Promise<{ status: number; body: any }>((resolve) => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = app.listen(0, async () => {
        const address = server.address() as any;
        const port = address.port;
        const url = `http://127.0.0.1:${port}/api${path}`;

        try {
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: body ? JSON.stringify(body) : undefined,
          });

          const resBody = await res.json().catch(() => ({}));
          server.close(() => resolve({ status: res.status, body: resBody }));
        } catch {
          server.close(() => resolve({ status: 500, body: {} }));
        }
      });
    });
  }

  test('8. Health endpoint does NOT expose raw platform API keys', async () => {
    const res = await simulateRequest('GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.geminiConfigured, 'boolean');
    assert.strictEqual(typeof res.body.tavilyConfigured, 'boolean');
    assert.strictEqual(res.body.GEMINI_API_KEY, undefined);
    assert.strictEqual(res.body.TAVILY_API_KEY, undefined);
    assert.strictEqual(res.body.OPENROUTER_API_KEY, undefined);
  });

  test('4. Invalid model identifier in chat request is strictly rejected with 400', async () => {
    const res = await simulateRequest('POST', '/chat', {
      model: 'unauthorized-arbitrary-model',
      messages: [{ role: 'user', content: 'hello' }],
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'INVALID_MODEL');
  });

  test('Search request rejects invalid research modes with 400', async () => {
    const res = await simulateRequest('POST', '/search', {
      query: 'Test search query',
      mode: 'invalid_mode_xyz',
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /Invalid research mode/i);
  });

  test('Search request rejects invalid model identifiers in array', async () => {
    const res = await simulateRequest('POST', '/search', {
      query: 'Valid query',
      mode: 'fast',
      models: ['gemini', 'malicious_model_injection'],
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /invalid/i);
  });

  test('Search request requires query or file content', async () => {
    const res = await simulateRequest('POST', '/search', {
      mode: 'fast',
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /Query or fileContent is required/i);
  });

  test('Admin routes strictly require authorization header', async () => {
    const res1 = await simulateRequest('GET', '/admin/codes');
    assert.strictEqual(res1.status, 403);

    const res2 = await simulateRequest('POST', '/admin/generate-code', { tier: 'pro' });
    assert.strictEqual(res2.status, 403);
  });
});
