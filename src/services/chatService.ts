/**
 * Chat Service
 * Handles communication with /api/chat (Cloudflare Pages Functions & Express server)
 */

import { getOpenRouterApiKey } from './modelConfigService';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  id?: string;
  choices?: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  error?: string;
  details?: string;
}

/**
 * Sends a message to the AI via /api/chat endpoint
 * Matches the requested sendMessageToAI signature and behavior
 */
export async function sendMessageToAI(
  input?: string | ChatMessage[],
  model: string = "meta-llama/llama-3.1-8b-instruct:free"
): Promise<string> {
  let messages: ChatMessage[];

  if (!input) {
    // Default prompt requested by user
    messages = [
      { role: "user", content: "مرحباً، كيف حالك؟" }
    ];
  } else if (typeof input === 'string') {
    messages = [
      { role: "user", content: input }
    ];
  } else {
    messages = input;
  }

  const openRouterKey = getOpenRouterApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Pass client-side key as fallback header if saved in settings
  if (openRouterKey) {
    headers['x-openrouter-key'] = openRouterKey;
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || "meta-llama/llama-3.1-8b-instruct:free",
      messages: messages
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error || `Request failed with status ${response.status}`;
    console.error('[ChatService] Error from /api/chat:', errorMsg);
    throw new Error(errorMsg);
  }

  const data: ChatResponse = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Log content to console as requested
  console.log(content);
  
  return content;
}

// Make available on window for direct browser console testing
if (typeof window !== 'undefined') {
  (window as any).sendMessageToAI = sendMessageToAI;
}
