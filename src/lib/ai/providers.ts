// Pluggable multi-provider AI chat (NAZ-16). Each provider is a thin adapter
// over its own HTTP API — no SDKs, so switching or adding a provider is a
// small, self-contained diff. All calls happen server-side (src/app/api/chat)
// so API keys never reach the browser.

export type ProviderId = 'ai-factory' | 'mistral' | 'claude' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  description: string;
  envKey: string;
  defaultModel: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'ai-factory',
    label: 'Cassava AI Factory',
    description:
      "Cassava's internal token factory — OpenAI-compatible endpoint",
    envKey: 'AI_FACTORY_API_KEY',
    defaultModel: process.env.AI_FACTORY_MODEL || 'ai-factory-default',
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    description: 'Claude via the Anthropic Messages API',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    description: 'Mistral chat completions API',
    envKey: 'MISTRAL_API_KEY',
    defaultModel: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  },
  {
    id: 'gemini',
    label: 'Gemini (Google)',
    description: 'Gemini via the Google Generative Language API',
    envKey: 'GEMINI_API_KEY',
    defaultModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  },
];

export function getProviderMeta(id: ProviderId): ProviderMeta {
  const meta = PROVIDERS.find((p) => p.id === id);
  if (!meta) throw new Error(`Unknown provider: ${id}`);
  return meta;
}

export function isProviderConfigured(id: ProviderId): boolean {
  const meta = getProviderMeta(id);
  return Boolean(process.env[meta.envKey]);
}

interface CallOptions {
  messages: ChatMessage[];
}

/** Token usage for a single call, normalized across providers whose APIs
 * each report it slightly differently. Powers the AI Usage page — this is
 * the actual number of tokens billed by the provider, not an estimate. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderCallResult {
  reply: string;
  /** Absent for a demo-mode reply — no real call was made, so there's
   * nothing to meter. */
  usage?: TokenUsage;
}

/** Reply used whenever the selected provider has no API key configured yet —
 * keeps the assistant usable in demo mode instead of erroring out, matching
 * how the rest of the app handles pending live-system access. */
export function demoModeReply(meta: ProviderMeta): string {
  return (
    `${meta.label} isn't connected yet — set \`${meta.envKey}\` in the environment to enable it. ` +
    `I can still answer from the reconciliation data already loaded on this screen once a provider is configured.`
  );
}

async function callAiFactory(
  apiKey: string,
  model: string,
  { messages }: CallOptions
): Promise<ProviderCallResult> {
  const baseUrl =
    process.env.AI_FACTORY_BASE_URL ||
    'https://api.aifactory.cassavatech.com/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok)
    throw new Error(`AI Factory error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    reply: data.choices?.[0]?.message?.content ?? '(empty response)',
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

async function callMistral(
  apiKey: string,
  model: string,
  { messages }: CallOptions
): Promise<ProviderCallResult> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok)
    throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    reply: data.choices?.[0]?.message?.content ?? '(empty response)',
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

async function callClaude(
  apiKey: string,
  model: string,
  { messages }: CallOptions
): Promise<ProviderCallResult> {
  const system = messages.find((m) => m.role === 'system')?.content;
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1024, system, messages: rest }),
  });
  if (!res.ok)
    throw new Error(`Claude error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;
  return {
    reply: data.content?.[0]?.text ?? '(empty response)',
    usage: data.usage
      ? {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        }
      : undefined,
  };
}

async function callGemini(
  apiKey: string,
  model: string,
  { messages }: CallOptions
): Promise<ProviderCallResult> {
  const system = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      }),
    }
  );
  if (!res.ok)
    throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const meta = data.usageMetadata;
  return {
    reply:
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(empty response)',
    usage: meta
      ? {
          promptTokens: meta.promptTokenCount ?? 0,
          completionTokens: meta.candidatesTokenCount ?? 0,
          totalTokens:
            meta.totalTokenCount ??
            (meta.promptTokenCount ?? 0) + (meta.candidatesTokenCount ?? 0),
        }
      : undefined,
  };
}

export async function callProvider(
  id: ProviderId,
  options: CallOptions,
  apiKeyOverride?: string
): Promise<ProviderCallResult> {
  const meta = getProviderMeta(id);
  // Callers that have already resolved a key (checking Supabase's
  // /admin/environment store before falling back to the env var — see
  // src/lib/ai/key-resolution.ts) pass it in directly; otherwise this
  // falls back to the env var alone, same as before that existed.
  const apiKey = apiKeyOverride ?? process.env[meta.envKey];
  if (!apiKey) return { reply: demoModeReply(meta) };

  switch (id) {
    case 'ai-factory':
      return callAiFactory(apiKey, meta.defaultModel, options);
    case 'mistral':
      return callMistral(apiKey, meta.defaultModel, options);
    case 'claude':
      return callClaude(apiKey, meta.defaultModel, options);
    case 'gemini':
      return callGemini(apiKey, meta.defaultModel, options);
  }
}
