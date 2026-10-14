// functions/api/chat.js
// Cloudflare Pages Serverless Function for OmniSearch AI Chat

const ALLOWED_CHAT_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct',
  'google/gemini-2.0-flash-001',
  'deepseek/deepseek-r1',
  'openai/gpt-4o-mini',
];

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // 1. Verify Environment Secret
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'SERVER_MISCONFIGURED', message: 'OPENROUTER_API_KEY is not configured in Cloudflare Pages environment' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse and Validate Request Body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'INVALID_JSON', message: 'Invalid JSON request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, model = 'meta-llama/llama-3.1-8b-instruct:free' } = body;

    // 3. Model Allowlist Check
    if (!ALLOWED_CHAT_MODELS.includes(model)) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_MODEL',
          message: `Requested model is not allowed. Supported models: ${ALLOWED_CHAT_MODELS.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate Messages Array Structure
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'INVALID_MESSAGES', message: 'Messages array is required and must not be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (messages.length > 20) {
      return new Response(
        JSON.stringify({ error: 'PAYLOAD_TOO_LARGE', message: 'Conversation exceeds maximum 20 messages' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        return new Response(
          JSON.stringify({ error: 'INVALID_MESSAGE_OBJECT', message: 'Message must be an object' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return new Response(
          JSON.stringify({ error: 'INVALID_ROLE', message: `Invalid message role: ${msg.role}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (typeof msg.content !== 'string' || msg.content.length > 15000) {
        return new Response(
          JSON.stringify({ error: 'CONTENT_TOO_LARGE', message: 'Message content exceeds maximum allowed length' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Forward to OpenRouter API with Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': request.headers.get('origin') || 'https://omnisearch.pages.dev',
        'X-Title': 'OmniSearch AI Cloudflare Pages',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!openRouterResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'PROVIDER_ERROR', message: `Provider returned HTTP ${openRouterResponse.status}` }),
        { status: openRouterResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await openRouterResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'SERVER_ERROR', message: 'An internal server error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// OPTIONS for CORS pre-flight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
