import type {
  AgentGenerateRequest,
  AgentGenerateResponse,
  AgentMessage,
  AgentProviderAdapter,
  AgentProviderId,
  AgentTokenUsage,
} from '../types.js';
import { AgentProviderError } from '../types.js';

interface OpenAICompatibleAdapterOptions {
  id: AgentProviderId;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

interface OpenAICompatibleUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAICompatibleChoice {
  message?: {
    content?: unknown;
  };
}

interface OpenAICompatibleResponse {
  model?: string;
  choices?: OpenAICompatibleChoice[];
  usage?: OpenAICompatibleUsage;
  error?: {
    message?: string;
  };
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function mapUsage(usage: OpenAICompatibleUsage | undefined): AgentTokenUsage | undefined {
  if (!usage) {
    return undefined;
  }
  const mapped: AgentTokenUsage = {};
  if (usage.prompt_tokens !== undefined) {
    mapped.inputTokens = usage.prompt_tokens;
  }
  if (usage.completion_tokens !== undefined) {
    mapped.outputTokens = usage.completion_tokens;
  }
  if (usage.total_tokens !== undefined) {
    mapped.totalTokens = usage.total_tokens;
  }
  return mapped;
}

export function createOpenAICompatibleAdapter(
  options: OpenAICompatibleAdapterOptions,
): AgentProviderAdapter {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');

  return {
    id: options.id,
    displayName: options.displayName,
    defaultModel: options.defaultModel,
    isConfigured() {
      return options.apiKey.trim().length > 0;
    },
    async generate(request: AgentGenerateRequest): Promise<AgentGenerateResponse> {
      if (!this.isConfigured()) {
        throw new AgentProviderError(options.id, `${options.displayName} API key is not configured.`);
      }

      const model = request.model || options.defaultModel;
      const body = {
        model,
        messages: request.messages.map((message: AgentMessage) => ({
          role: message.role,
          content: message.content,
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      };

      const init: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      };
      if (request.signal) {
        init.signal = request.signal;
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, init);
      } catch (error) {
        throw new AgentProviderError(options.id, `${options.displayName} request failed.`, {
          retryable: true,
          cause: error,
        });
      }

      const data = (await response.json().catch(() => ({}))) as OpenAICompatibleResponse;
      if (!response.ok) {
        throw new AgentProviderError(
          options.id,
          data.error?.message || `${options.displayName} returned HTTP ${response.status}.`,
          { status: response.status, retryable: response.status >= 500 || response.status === 429 },
        );
      }

      const content = normalizeContent(data.choices?.[0]?.message?.content);
      if (!content) {
        throw new AgentProviderError(options.id, `${options.displayName} returned an empty response.`);
      }

      const result: AgentGenerateResponse = {
        provider: options.id,
        model: data.model || model,
        content,
        raw: data,
      };
      const usage = mapUsage(data.usage);
      if (usage) {
        result.usage = usage;
      }
      return result;
    },
  };
}
