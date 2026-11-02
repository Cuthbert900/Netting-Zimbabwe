import { NextResponse } from 'next/server';
import {
  callProvider,
  getProviderMeta,
  type ChatMessage,
  type ProviderId,
} from '@/lib/ai/providers';
import {
  DEFAULT_CHAT_LANGUAGE,
  isChatLanguage,
  replyLanguageInstruction,
} from '@/lib/ai/chat-language';
import { resolveProviderApiKey } from '@/lib/ai/key-resolution';
import { getFromCache, setInCache } from '@/lib/cache';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

const VALID_PROVIDERS: ProviderId[] = [
  'ai-factory',
  'mistral',
  'claude',
  'gemini',
];

export async function POST(request: Request) {
  let body: {
    provider?: string;
    messages?: ChatMessage[];
    context?: string;
    language?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider, messages, context } = body;

  if (!provider || !VALID_PROVIDERS.includes(provider as ProviderId)) {
    return NextResponse.json(
      { error: `provider must be one of ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'messages must be a non-empty array' },
      { status: 400 }
    );
  }

  const providerId = provider as ProviderId;
  // An unknown or missing language falls back to English rather than
  // rejecting the request, so older clients keep working.
  const language = isChatLanguage(body.language)
    ? body.language
    : DEFAULT_CHAT_LANGUAGE;
  const languageInstruction = replyLanguageInstruction(language);
  const meta = getProviderMeta(providerId);

  // Generate a cache key from the request body
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ provider, messages, context, language }));
  const cacheKey = hash.digest('hex');

  // Check the cache
  const cached = getFromCache<{
    reply: string;
    usage: { prompt: number; completion: number };
    configured: boolean;
    provider: string;
  }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const systemPrompt: ChatMessage = {
    role: 'system',
    content:
      "You are the AI assistant embedded in Liquid Zimbabwe's Netting Reconciliation Automation app, " +
      'built by Cassava AI. You help Treasury & Billing review reconciliation results across Dynamics 365, ' +
      'Prism BSS, and bank statement extracts. Answer only from the reconciliation context provided below — ' +
      "if the answer isn't in it, say so rather than guessing. When flagging unmatched or high-value records, " +
      'describe them as needing investigation, never assert fraud. Be concise and use concrete figures.\n\n' +
      (languageInstruction ? `${languageInstruction}\n\n` : '') +
      (context?.trim()
        ? `Current reconciliation snapshot:\n${context}`
        : 'No extracts have been uploaded yet.'),
  };

  try {
    const apiKey = await resolveProviderApiKey(providerId);
    const result = await callProvider(
      providerId,
      { messages: [systemPrompt, ...messages] },
      apiKey
    );

    const response = {
      reply: result.reply,
      usage: result.usage,
      configured: Boolean(apiKey),
      provider: meta.id,
    };

    // Cache the response
    setInCache(cacheKey, response);

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Provider call failed' },
      { status: 502 }
    );
  }
}
