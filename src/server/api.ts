import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import { executeSearch } from './geminiService';
import {
  verifyAdminPin,
  verifyAdminSession,
  getAllLicenses,
  generateServerLicenseCode,
  deleteServerLicenseCode,
  redeemServerLicense,
  getAuthoritativeQuota,
  consumeAuthoritativeQuota,
  getAllLicensesAsync,
  generateServerLicenseCodeAsync,
  deleteServerLicenseCodeAsync,
  redeemServerLicenseAsync,
  getAuthoritativeQuotaAsync,
  consumeAuthoritativeQuotaAsync,
  verifySignedUserToken,
} from './licenseStore';
import {
  createResearchSessionDb,
  updateResearchSessionDb,
  getResearchSessionDb,
  getUserResearchSessionsDb,
} from '../db/sessions.ts';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.ts';

export const apiRouter = express.Router();

// ----------------------------------------------------
// 1. Rate Limiter (In-Memory Sliding Window)
// ----------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }

    record.count += 1;
    rateLimitMap.set(key, record);

    if (record.count > maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please wait before submitting more requests.',
      });
      return;
    }

    next();
  };
}

const standardLimiter = createRateLimiter(45, 60 * 1000); // 45 per minute
const strictLimiter = createRateLimiter(8, 60 * 1000); // 8 per minute

// ----------------------------------------------------
// 2. Health & Diagnostic Check
// ----------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'OmniSearch AI Core Platform',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
  });
});

// ----------------------------------------------------
// 3. User License & Quota Endpoints
// ----------------------------------------------------
apiRouter.post('/license/redeem', strictLimiter, async (req: Request, res: Response) => {
  const { code, email } = req.body;
  if (!code || typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'License code is required' });
    return;
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Valid user email is required' });
    return;
  }

  const result = await redeemServerLicenseAsync(code, email);
  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }

  res.json(result);
});

apiRouter.get('/license/status', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const emailQuery = (req.query.email as string) || '';
  const ip = req.ip || req.socket.remoteAddress || 'client';

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const verified = verifySignedUserToken(token);
    if (verified.valid && verified.user) {
      res.json({
        authenticated: true,
        tier: verified.user.tier,
        email: verified.user.email,
        expiresAt: verified.user.expiresAt,
        unlimited: verified.user.tier !== 'free',
      });
      return;
    }
  }

  // Fallback to free quota check
  const quota = await getAuthoritativeQuotaAsync(emailQuery, ip);
  res.json({
    authenticated: false,
    tier: 'free',
    used: quota.used,
    total: quota.total,
    isExhausted: quota.isExhausted,
    unlimited: false,
  });
});

apiRouter.post('/quota/check', async (req: Request, res: Response) => {
  const { email } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'client';
  const quota = await getAuthoritativeQuotaAsync(email, ip);
  res.json(quota);
});

apiRouter.post('/auth/verify', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({
    valid: true,
    user: req.user,
  });
});

// ----------------------------------------------------
// 4. Protected Admin / Seller Panel Endpoints
// ----------------------------------------------------
apiRouter.post('/admin/verify-pin', strictLimiter, (req: Request, res: Response) => {
  const { pin } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'client';

  if (!pin || typeof pin !== 'string') {
    res.status(400).json({ error: 'PIN is required' });
    return;
  }

  const verification = verifyAdminPin(pin, ip);
  if (!verification.success) {
    res.status(401).json({ error: verification.error || 'Invalid administrator PIN' });
    return;
  }

  res.json({ success: true, token: verification.token });
});

// Admin Authorization Middleware
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !verifyAdminSession(authHeader)) {
    res.status(403).json({ error: 'Unauthorized: Valid administrator session required' });
    return;
  }
  next();
}

apiRouter.get('/admin/codes', requireAdminAuth, async (_req: Request, res: Response) => {
  const codes = await getAllLicensesAsync();
  res.json({ codes });
});

apiRouter.post('/admin/generate-code', requireAdminAuth, async (req: Request, res: Response) => {
  const { tier = 'pro', duration = '1_month', note } = req.body;
  const allowedTiers = ['pro', 'enterprise'];
  const allowedDurations = ['1_month', '3_months', '1_year', 'lifetime'];

  if (!allowedTiers.includes(tier)) {
    res.status(400).json({ error: 'Invalid tier' });
    return;
  }
  if (!allowedDurations.includes(duration)) {
    res.status(400).json({ error: 'Invalid duration' });
    return;
  }

  const newCode = await generateServerLicenseCodeAsync(tier, duration, note);
  res.json({ success: true, code: newCode });
});

apiRouter.delete('/admin/code/:code', requireAdminAuth, async (req: Request, res: Response) => {
  const { code } = req.params;
  const deleted = await deleteServerLicenseCodeAsync(code);
  if (!deleted) {
    res.status(404).json({ error: 'Code not found' });
    return;
  }
  res.json({ success: true });
});

// ----------------------------------------------------
// 5. OpenRouter Key Validation (Server-side proxy)
// ----------------------------------------------------
apiRouter.post('/validate-openrouter', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      res.status(400).json({ valid: false, message: 'API key is required' });
      return;
    }

    const cleanKey = apiKey.trim();
    const testRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
      },
    });

    if (testRes.ok) {
      const info = await testRes.json();
      res.json({
        valid: true,
        message: 'OpenRouter API key is verified and operational',
        data: info?.data || info,
      });
    } else {
      res.status(testRes.status).json({
        valid: false,
        message: `OpenRouter rejected key with status ${testRes.status}`,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      valid: false,
      message: 'Failed to communicate with OpenRouter verification endpoint',
    });
  }
});

// ----------------------------------------------------
// 6. Unified Search Endpoint with Quota Enforcement
// ----------------------------------------------------
const ALLOWED_MODES = ['fast', 'deep', 'battle', 'code'];
const ALLOWED_MODELS = ['gemini', 'gpt4o', 'claude35', 'llama3', 'deepseek'];

apiRouter.post('/search', standardLimiter, async (req: Request, res: Response) => {
  try {
    const {
      query,
      mode = 'fast',
      models = [],
      fileContent,
      fileName,
      fileType,
      language = 'ar',
      userEmail,
      demoMode = false,
    } = req.body;

    // Input Validation
    if (!query && !fileContent) {
      res.status(400).json({ error: 'Query or fileContent is required' });
      return;
    }

    if (query && typeof query === 'string' && query.length > 2500) {
      res.status(400).json({ error: 'Query exceeds maximum allowed length of 2500 characters' });
      return;
    }

    if (fileContent && typeof fileContent === 'string' && fileContent.length > 60000) {
      res.status(400).json({ error: 'File content exceeds maximum allowed length' });
      return;
    }

    if (!ALLOWED_MODES.includes(mode)) {
      res.status(400).json({ error: `Invalid research mode. Allowed: ${ALLOWED_MODES.join(', ')}` });
      return;
    }

    if (!Array.isArray(models) || models.some((m) => !ALLOWED_MODELS.includes(m))) {
      res.status(400).json({ error: 'One or more requested model identifiers are invalid' });
      return;
    }

    // Quota & Authorization Check
    const ip = req.ip || req.socket.remoteAddress || 'client';
    const authHeader = req.headers.authorization;
    let isUserPaid = false;

    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const verified = verifySignedUserToken(token);
      if (verified.valid && verified.user && verified.user.tier !== 'free') {
        isUserPaid = true;
      }
    }

    if (!isUserPaid && !demoMode) {
      const quota = await getAuthoritativeQuotaAsync(userEmail, ip);
      if (quota.isExhausted) {
        res.status(403).json({
          error: 'QUOTA_EXHAUSTED',
          message: 'Free search limit reached (10/10 searches). Please redeem a license code to continue.',
          used: quota.used,
          total: quota.total,
        });
        return;
      }

      // Consume quota atomically in persistent database
      await consumeAuthoritativeQuotaAsync(userEmail, ip);
    }

    // Execute genuine search
    const cleanQuery = typeof query === 'string' ? query.trim() : '';
    const sessionId = crypto.randomUUID();

    // Persist session initialization
    try {
      await createResearchSessionDb(
        sessionId,
        cleanQuery || (fileName ? `Analysis of file: ${fileName}` : 'Analyze provided content'),
        mode,
        userEmail
      );
    } catch (e) {
      console.warn('[API /search] DB session init error:', e);
    }

    const result = await executeSearch({
      query: cleanQuery || (fileName ? `Analysis of file: ${fileName}` : 'Analyze provided content'),
      mode,
      models,
      fileContent: typeof fileContent === 'string' ? fileContent : undefined,
      fileName: typeof fileName === 'string' ? fileName : undefined,
      fileType: typeof fileType === 'string' ? fileType : undefined,
      language: language === 'en' ? 'en' : 'ar',
      demoMode: Boolean(demoMode),
    });

    // Update persisted result
    try {
      await updateResearchSessionDb(sessionId, 'completed', JSON.stringify(result));
    } catch (e) {
      console.warn('[API /search] DB session update error:', e);
    }

    res.json({
      ...result,
      sessionId,
    });
  } catch (error: any) {
    console.error('[API /search] Execution failed:', error?.message || error);
    res.status(502).json({
      error: 'AI_PROVIDER_UNAVAILABLE',
      message: error?.message || 'Failed to process search request with AI provider',
    });
  }
});

// ----------------------------------------------------
// 6B. Server-Sent Events (SSE) Streaming Search Endpoint
// ----------------------------------------------------
apiRouter.all('/search/stream', standardLimiter, async (req: Request, res: Response) => {
  const isPost = req.method === 'POST';
  const query = isPost ? req.body?.query : (req.query?.query as string);
  const mode = (isPost ? req.body?.mode : (req.query?.mode as string)) || 'fast';
  const models = isPost ? req.body?.models || [] : req.query?.models ? String(req.query.models).split(',') : [];
  const fileContent = isPost ? req.body?.fileContent : undefined;
  const fileName = isPost ? req.body?.fileName : undefined;
  const fileType = isPost ? req.body?.fileType : undefined;
  const language = (isPost ? req.body?.language : (req.query?.language as string)) === 'en' ? 'en' : 'ar';
  const userEmail = isPost ? req.body?.userEmail : (req.query?.userEmail as string);
  const demoMode = isPost ? Boolean(req.body?.demoMode) : req.query?.demoMode === 'true';

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const sendEvent = (eventData: Record<string, any>) => {
    try {
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    } catch {
      // Stream closed
    }
  };

  // Validation
  if (!query && !fileContent) {
    sendEvent({ type: 'error', error: 'Query or fileContent is required' });
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  if (!ALLOWED_MODES.includes(mode)) {
    sendEvent({ type: 'error', error: `Invalid mode: ${mode}` });
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // Quota & Authorization Check
  const ip = req.ip || req.socket.remoteAddress || 'client';
  const authHeader = req.headers.authorization;
  let isUserPaid = false;

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const verified = verifySignedUserToken(token);
    if (verified.valid && verified.user && verified.user.tier !== 'free') {
      isUserPaid = true;
    }
  }

  if (!isUserPaid && !demoMode) {
    const quota = await getAuthoritativeQuotaAsync(userEmail, ip);
    if (quota.isExhausted) {
      sendEvent({
        type: 'quota_exhausted',
        error: 'QUOTA_EXHAUSTED',
        message: 'Free search limit reached (10/10 searches). Please redeem a license code to continue.',
        used: quota.used,
        total: quota.total,
      });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    await consumeAuthoritativeQuotaAsync(userEmail, ip);
  }

  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  const sessionId = crypto.randomUUID();

  // Persist session initialization
  try {
    await createResearchSessionDb(
      sessionId,
      cleanQuery || (fileName ? `Analysis of file: ${fileName}` : 'Analyze provided content'),
      mode,
      userEmail
    );
  } catch (e) {
    console.warn('[SSE /search/stream] DB init error:', e);
  }

  sendEvent({
    type: 'session_init',
    sessionId,
    query: cleanQuery,
    mode,
    timestamp: Date.now(),
  });

  try {
    const result = await executeSearch({
      query: cleanQuery || (fileName ? `Analysis of file: ${fileName}` : 'Analyze provided content'),
      mode: mode as any,
      models,
      fileContent: typeof fileContent === 'string' ? fileContent : undefined,
      fileName: typeof fileName === 'string' ? fileName : undefined,
      fileType: typeof fileType === 'string' ? fileType : undefined,
      language,
      demoMode,
      onProgress: (evt) => {
        sendEvent(evt);
      },
    });

    // Save final result to Cloud SQL
    try {
      await updateResearchSessionDb(sessionId, 'completed', JSON.stringify(result));
    } catch (e) {
      console.warn('[SSE /search/stream] DB save error:', e);
    }

    sendEvent({
      type: 'result_complete',
      sessionId,
      result,
    });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    try {
      await updateResearchSessionDb(sessionId, 'failed', undefined, err?.message);
    } catch (e) {
      // Ignore
    }
    sendEvent({
      type: 'error',
      error: 'AI_PROVIDER_UNAVAILABLE',
      message: err?.message || 'Search failed',
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ----------------------------------------------------
// 6C. Research Sessions & History Endpoints (Cloud SQL)
// ----------------------------------------------------
apiRouter.get('/history', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const email = req.user?.email || (req.query.email as string) || '';
    const uid = (req.user as any)?.uid || (req.query.uid as string) || '';
    if (!email && !uid) {
      res.json({ sessions: [] });
      return;
    }
    const sessions = await getUserResearchSessionsDb(email, uid);
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve research history' });
  }
});

apiRouter.get('/session/:sessionId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await getResearchSessionDb(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // User isolation enforcement: If session belongs to a user, reject unauthorized requesters
    if (session.userEmail || session.userUid) {
      const requesterEmail = req.user?.email || (req.query.email as string);
      const requesterUid = (req.user as any)?.uid || (req.query.uid as string);

      const matchesEmail =
        session.userEmail &&
        requesterEmail &&
        session.userEmail.toLowerCase().trim() === requesterEmail.toLowerCase().trim();
      const matchesUid = session.userUid && requesterUid && session.userUid === requesterUid;

      if (!matchesEmail && !matchesUid) {
        res.status(403).json({ error: 'Forbidden: You do not have permission to view this session' });
        return;
      }
    }

    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// ----------------------------------------------------
// 7. Chat Endpoint with Model Allowlist & Validation
// ----------------------------------------------------
const ALLOWED_CHAT_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct',
  'google/gemini-2.0-flash-001',
  'deepseek/deepseek-r1',
  'openai/gpt-4o-mini',
];

apiRouter.post('/chat', standardLimiter, async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || (req.headers['x-openrouter-key'] as string);
    if (!apiKey) {
      res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on the server' });
      return;
    }

    const { messages, model = 'meta-llama/llama-3.1-8b-instruct:free' } = req.body;

    // Validate Model against strict allowlist
    if (!ALLOWED_CHAT_MODELS.includes(model)) {
      res.status(400).json({
        error: 'INVALID_MODEL',
        message: `Requested model is not allowed. Supported models: ${ALLOWED_CHAT_MODELS.join(', ')}`,
      });
      return;
    }

    // Validate Messages Structure
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required and must not be empty' });
      return;
    }

    if (messages.length > 20) {
      res.status(400).json({ error: 'Conversation history exceeds maximum of 20 messages' });
      return;
    }

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        res.status(400).json({ error: 'Invalid message object' });
        return;
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        res.status(400).json({ error: `Invalid role: ${msg.role}` });
        return;
      }
      if (typeof msg.content !== 'string' || msg.content.length > 15000) {
        res.status(400).json({ error: 'Message content must be string under 15000 characters' });
        return;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': req.headers.origin || 'https://omnisearch.app',
        'X-Title': 'OmniSearch AI Chat',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text().catch(() => '');
      res.status(openRouterResponse.status).json({
        error: 'PROVIDER_ERROR',
        message: `Provider returned HTTP ${openRouterResponse.status}`,
      });
      return;
    }

    const data = await openRouterResponse.json();
    res.json(data);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      res.status(504).json({ error: 'TIMEOUT', message: 'Chat request timed out' });
      return;
    }
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Internal server error while processing chat request',
    });
  }
});
