import config from '../../config.js';
import type {
  AgentGenerateRequest,
  AgentGenerateResponse,
  AgentMessage,
  AgentProviderAdapter,
  AgentTokenUsage,
} from '../types.js';
import { AgentProviderError } from '../types.js';

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AnthropicResponse {
  model?: string;
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

function splitSystemMessages(messages: AgentMessage[]): {
  system: string | undefined;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n');

  return {
    system: system || undefined,
    messages: messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
  };
}

function mapUsage(usage: AnthropicResponse['usage']): AgentTokenUsage | undefined {
  if (!usage) {
    return undefined;
  }
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const mapped: AgentTokenUsage = {};
  if (inputTokens !== undefined) {
    mapped.inputTokens = inputTokens;
  }
  if (outputTokens !== undefined) {
    mapped.outputTokens = outputTokens;
  }
  if (inputTokens !== undefined && outputTokens !== undefined) {
    mapped.totalTokens = inputTokens + outputTokens;
  }
  return mapped;
}

export function createAnthropicAdapter(): AgentProviderAdapter {
  const baseUrl = config.anthropicBaseUrl.replace(/\/+$/, '');

  return {
    id: 'anthropic',
    displayName: 'Anthropic',
    defaultModel: config.anthropicModel,
    isConfigured() {
      return config.anthropicApiKey.trim().length > 0;
    },
    async generate(request: AgentGenerateRequest): Promise<AgentGenerateResponse> {
      if (!this.isConfigured()) {
        throw new AgentProviderError('anthropic', 'Anthropic API key is not configured.');
      }

      const model = request.model || config.anthropicModel;
      const split = splitSystemMessages(request.messages);
      if (split.messages.length === 0) {
        throw new AgentProviderError('anthropic', 'Anthropic requires at least one user or assistant message.');
      }

      const body = {
        model,
        system: split.system,
        messages: split.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens || config.agentDefaultMaxTokens,
      };

      const init: RequestInit = {
        method: 'POST',
        headers: {
          'x-api-key': config.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      };
      if (request.signal) {
        init.signal = request.signal;
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1/messages`, init);
      } catch (error) {
        throw new AgentProviderError('anthropic', 'Anthropic request failed.', {
          retryable: true,
          cause: error,
        });
      }

      const data = (await response.json().catch(() => ({}))) as AnthropicResponse;
      if (!response.ok) {
        throw new AgentProviderError(
          'anthropic',
          data.error?.message || `Anthropic returned HTTP ${response.status}.`,
          { status: response.status, retryable: response.status >= 500 || response.status === 429 },
        );
      }

      const content = data.content
        ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim();

      if (!content) {
        throw new AgentProviderError('anthropic', 'Anthropic returned an empty response.');
      }

      const result: AgentGenerateResponse = {
        provider: 'anthropic',
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
