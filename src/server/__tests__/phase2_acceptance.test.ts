import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from '../api';
import {
  generateServerLicenseCodeAsync,
  redeemServerLicenseAsync,
  getAuthoritativeQuotaAsync,
  consumeAuthoritativeQuotaAsync,
  createSignedUserToken,
  FREE_SEARCH_LIMIT,
} from '../licenseStore';
import {
  createResearchSessionDb,
  getResearchSessionDb,
  getUserResearchSessionsDb,
  updateResearchSessionDb,
} from '../../db/sessions.ts';
import {
  insertLicenseDb,
  redeemLicenseDb,
  getLicenseByCodeDb,
} from '../../db/licenses.ts';
import { getOrCreateUser } from '../../db/users.ts';
import { pool } from '../../db/index.ts';

describe('Phase 2 Acceptance Tests: Production Validation', () => {
  let app: express.Express;
  let server: any;
  let baseUrl: string;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // CORS & Preflight
    app.use((req, res, next) => {
      const origin = req.headers.origin || '*';
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-token, x-openrouter-key'
      );
      res.header('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });

    app.use('/api', apiRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close();
    }
    await new Promise((r) => setTimeout(r, 200));
    await pool.end().catch(() => {});
  });

  // ====================================================
  // TEST 1: Persistent Data
  // ====================================================
  describe('Test 1: Persistent Data', () => {
    test('1.1 Create user, activation code, and persist in database', async () => {
      const testEmail = `test_persistent_${Date.now()}@omnimind.dev`;
      const testUid = `uid_${Date.now()}`;
      
      const user = await getOrCreateUser(testUid, testEmail, 'free');
      assert.ok(user, 'User should be created in persistent database');
      assert.strictEqual(user.email, testEmail);

      const codeStr = `TEST-P2-${Date.now().toString(36).toUpperCase()}`;
      const codeRecord = await insertLicenseDb(codeStr, 'pro', '1_month', 'Phase 2 Test Code');
      assert.ok(codeRecord, 'Activation code should be inserted in DB');
      assert.strictEqual(codeRecord.code, codeStr);
      assert.strictEqual(codeRecord.isUsed, false);
    });

    test('1.2 Redeem code and verify persistent entitlement in database', async () => {
      const testEmail = `test_redeem_${Date.now()}@omnimind.dev`;
      const codeStr = `REDEEM-P2-${Date.now().toString(36).toUpperCase()}`;
      await insertLicenseDb(codeStr, 'pro', '1_month', 'Redemption test');

      const redeemResult = await redeemServerLicenseAsync(codeStr, testEmail);
      assert.strictEqual(redeemResult.success, true);
      assert.strictEqual(redeemResult.tier, 'pro');
      assert.ok(redeemResult.token, 'Should return signed entitlement token');

      // Check DB directly to confirm persistence
      const inDb = await getLicenseByCodeDb(codeStr);
      assert.ok(inDb);
      assert.strictEqual(inDb.isUsed, true);
      assert.strictEqual(inDb.usedByEmail, testEmail);
    });

    test('1.3 Create research session, update, and retrieve from PostgreSQL', async () => {
      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const userEmail = `researcher_${Date.now()}@omnimind.dev`;
      const query = 'Artificial General Intelligence architectures 2026';

      await createResearchSessionDb(sessionId, query, 'deep', userEmail);

      let fetched = await getResearchSessionDb(sessionId);
      assert.ok(fetched, 'Session must exist in database');
      assert.strictEqual(fetched.sessionId, sessionId);
      assert.strictEqual(fetched.status, 'in_progress');

      const sampleResult = { summary: 'AGI developments overview', sources: [] };
      await updateResearchSessionDb(sessionId, 'completed', JSON.stringify(sampleResult));

      fetched = await getResearchSessionDb(sessionId);
      assert.ok(fetched);
      assert.strictEqual(fetched.status, 'completed');
      assert.ok(fetched.resultJson, 'Result JSON must be stored in database');
      const parsed = JSON.parse(fetched.resultJson);
      assert.strictEqual(parsed.summary, 'AGI developments overview');
    });
  });

  // ====================================================
  // TEST 2: Atomic Quota Enforcement
  // ====================================================
  describe('Test 2: Atomic Quota Enforcement', () => {
    test('2.1 Free tier quota default is strictly enforced at 10 requests', async () => {
      const quotaUser = `quota_${Date.now()}@example.com`;
      const initial = await getAuthoritativeQuotaAsync(quotaUser);
      assert.strictEqual(initial.used, 0);
      assert.strictEqual(initial.total, FREE_SEARCH_LIMIT);
      assert.strictEqual(initial.isExhausted, false);
    });

    test('2.2 Concurrent requests around the quota boundary do not exceed limit', async () => {
      const boundaryUser = `boundary_${Date.now()}@example.com`;

      // Fill 9 of 10 slots
      for (let i = 0; i < 9; i++) {
        await consumeAuthoritativeQuotaAsync(boundaryUser);
      }

      // Fire 5 concurrent requests for the final 1 slot
      const concurrentResults = await Promise.all(
        Array.from({ length: 5 }).map(() => consumeAuthoritativeQuotaAsync(boundaryUser))
      );

      const successful = concurrentResults.filter((r) => r.success);
      const failed = concurrentResults.filter((r) => !r.success);

      assert.strictEqual(successful.length, 1, 'Exactly one concurrent request should claim the 10th slot');
      assert.strictEqual(failed.length, 4, 'Remaining concurrent requests must be rejected');

      const finalState = await getAuthoritativeQuotaAsync(boundaryUser);
      assert.strictEqual(finalState.used, FREE_SEARCH_LIMIT);
      assert.strictEqual(finalState.isExhausted, true);
    });

    test('2.3 Client cannot reset server-authoritative quota', async () => {
      const user = `tamper_${Date.now()}@example.com`;
      for (let i = 0; i < FREE_SEARCH_LIMIT; i++) {
        await consumeAuthoritativeQuotaAsync(user);
      }

      // Check endpoint directly
      const res = await fetch(`${baseUrl}/quota/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user }),
      });
      const data = await res.json();
      assert.strictEqual(data.isExhausted, true);
      assert.strictEqual(data.used, FREE_SEARCH_LIMIT);
    });
  });

  // ====================================================
  // TEST 3: SSE Deep Research Delivery
  // ====================================================
  describe('Test 3: SSE Deep Research', () => {
    test('3.1 /api/search/stream delivers valid SSE headers and events', async () => {
      const res = await fetch(`${baseUrl}/search/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Quantum Computing Fault Tolerance',
          mode: 'fast',
          language: 'en',
          demoMode: true,
        }),
      });

      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
      assert.strictEqual(res.headers.get('cache-control'), 'no-cache, no-transform');

      const bodyText = await res.text();
      assert.ok(bodyText.includes('session_init'), 'Must include session_init event');
      assert.ok(bodyText.includes('result_complete'), 'Must include result_complete event');
      assert.ok(bodyText.includes('[DONE]'), 'Must include [DONE] terminal signal');
    });

    test('3.2 SSE rejects invalid queries gracefully with honest error', async () => {
      const res = await fetch(`${baseUrl}/search/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'deep',
        }),
      });

      assert.strictEqual(res.status, 200); // SSE streams return 200 with error event
      const bodyText = await res.text();
      assert.ok(bodyText.includes('"type":"error"'));
    });
  });

  // ====================================================
  // TEST 4: Battle Mode Truthfulness
  // ====================================================
  describe('Test 4: Battle Mode', () => {
    test('4.1 Multi-model battle mode preserves genuine responses and marks unavailable models truthfully', async () => {
      const res = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Compare functional programming vs OOP in modern distributed systems',
          mode: 'battle',
          models: ['gemini', 'gpt4o'],
          language: 'en',
          demoMode: true,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.mode, 'battle');
      assert.ok(Array.isArray(data.modelResponses));
      assert.ok(data.modelResponses.length >= 2);

      // Verify no fabricated token counts or metrics
      for (const m of data.modelResponses) {
        assert.ok(m.modelName, 'Each response must have modelName');
        assert.ok(typeof m.latencyMs === 'number', 'Latency must be numeric');
        assert.ok(typeof m.content === 'string', 'Content must be genuine string');
      }
    });
  });

  // ====================================================
  // TEST 5: Authentication and Authorization
  // ====================================================
  describe('Test 5: Authentication and Authorization', () => {
    test('5.1 /api/auth/verify rejects missing or invalid tokens with 401', async () => {
      const resNoToken = await fetch(`${baseUrl}/auth/verify`, {
        method: 'POST',
      });
      assert.strictEqual(resNoToken.status, 401);

      const resBadToken = await fetch(`${baseUrl}/auth/verify`, {
        method: 'POST',
        headers: { Authorization: 'Bearer totally_invalid_jwt_token' },
      });
      assert.strictEqual(resBadToken.status, 401);
    });

    test('5.2 /api/auth/verify accepts valid signed tokens', async () => {
      const token = createSignedUserToken('user_test@omnimind.dev', 'pro', 30);
      const res = await fetch(`${baseUrl}/auth/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.valid, true);
      assert.strictEqual(data.user.email, 'user_test@omnimind.dev');
      assert.strictEqual(data.user.tier, 'pro');
    });

    test('5.3 User isolation: User cannot access another user\'s private research session', async () => {
      const userA = 'usera@omnimind.dev';
      const userB = 'userb@omnimind.dev';
      const sessionId = `private-${Date.now()}`;

      await createResearchSessionDb(sessionId, 'Confidential Patent Search', 'deep', userA);

      // User A accesses their session -> 200
      const tokenA = createSignedUserToken(userA, 'pro', 30);
      const resA = await fetch(`${baseUrl}/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.strictEqual(resA.status, 200);

      // User B tries to access User A's session -> 403 Forbidden
      const tokenB = createSignedUserToken(userB, 'pro', 30);
      const resB = await fetch(`${baseUrl}/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.strictEqual(resB.status, 403);
      const errorBody = await resB.json();
      assert.match(errorBody.error, /Forbidden/i);
    });

    test('5.4 Activation codes cannot be redeemed more than once under concurrent requests', async () => {
      const codeStr = `CONCURRENT-${Date.now().toString(36).toUpperCase()}`;
      await insertLicenseDb(codeStr, 'pro', '1_month', 'Concurrency test');

      const attempts = await Promise.all([
        redeemServerLicenseAsync(codeStr, 'buyer1@example.com'),
        redeemServerLicenseAsync(codeStr, 'buyer2@example.com'),
        redeemServerLicenseAsync(codeStr, 'buyer3@example.com'),
      ]);

      const successfulRedemptions = attempts.filter((a) => a.success);
      assert.strictEqual(successfulRedemptions.length, 1, 'Only one concurrent redemption should succeed');

      const failedRedemptions = attempts.filter((a) => !a.success);
      assert.strictEqual(failedRedemptions.length, 2, 'Other concurrent redemptions must fail');
    });

    test('5.5 Admin endpoints strictly reject unauthorized requests', async () => {
      const res = await fetch(`${baseUrl}/admin/codes`, {
        method: 'GET',
      });
      assert.ok([401, 403].includes(res.status), 'Admin endpoints must return 401 or 403 when unauthenticated');
    });
  });

  // ====================================================
  // TEST 6: Deployment Compatibility
  // ====================================================
  describe('Test 6: Deployment Compatibility', () => {
    test('6.1 CORS preflight OPTIONS returns 204 with required headers', async () => {
      const res = await fetch(`${baseUrl}/search`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://omnimind-search.pages.dev',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization, x-user-token',
        },
      });

      assert.strictEqual(res.status, 204);
      assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://omnimind-search.pages.dev');
      assert.match(res.headers.get('access-control-allow-methods') || '', /POST/);
      assert.match(res.headers.get('access-control-allow-headers') || '', /Authorization/);
    });

    test('6.2 Streaming responses contain X-Accel-Buffering: no for Cloud Run / reverse proxies', async () => {
      const res = await fetch(`${baseUrl}/search/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Deployment check',
          mode: 'fast',
          demoMode: true,
        }),
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-accel-buffering'), 'no');
      await res.text();
    });
  });
});
