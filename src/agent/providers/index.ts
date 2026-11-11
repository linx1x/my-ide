import type { AgentProviderAdapter, AgentProviderId } from '../types.js';
import { createAnthropicAdapter } from './anthropic.js';
import { createOpenAIAdapter } from './openai.js';
import { createQwenAdapter } from './qwen.js';

export function createAgentProviderAdapter(provider: AgentProviderId): AgentProviderAdapter {
  switch (provider) {
    case 'openai':
      return createOpenAIAdapter();
    case 'anthropic':
      return createAnthropicAdapter();
    case 'qwen':
      return createQwenAdapter();
  }
}

export function createAgentProviderAdapters(): Record<AgentProviderId, AgentProviderAdapter> {
  return {
    openai: createOpenAIAdapter(),
    anthropic: createAnthropicAdapter(),
    qwen: createQwenAdapter(),
  };
}
