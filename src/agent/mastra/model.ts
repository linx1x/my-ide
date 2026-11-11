import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { MastraModelConfig } from '@mastra/core/llm';
import config from '../../config.js';

export type DashboardAgentProvider = 'openai' | 'anthropic' | 'qwen';

export function resolveDefaultProvider(): DashboardAgentProvider {
  const p = config.agentDefaultProvider;
  if (p === 'anthropic' || p === 'qwen' || p === 'openai') {
    return p;
  }
  return 'openai';
}

export function assertProviderConfigured(provider: DashboardAgentProvider): void {
  if (provider === 'openai' && !config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  if (provider === 'anthropic' && !config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  if (provider === 'qwen' && !config.qwenApiKey) {
    throw new Error('QWEN_API_KEY (or DASHSCOPE_API_KEY) is not set');
  }
}

export function buildMastraModelForProvider(provider: DashboardAgentProvider): MastraModelConfig {
  assertProviderConfigured(provider);
  switch (provider) {
  case 'openai': {
    const openai = createOpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl,
    });
    return openai(config.openaiModel);
  }
  case 'anthropic': {
    const anthropic = createAnthropic({
      apiKey: config.anthropicApiKey,
      baseURL: config.anthropicBaseUrl,
    });
    return anthropic(config.anthropicModel);
  }
  case 'qwen':
  default:
    return {
      id: `openai/${config.qwenModel}`,
      url: config.qwenBaseUrl,
      apiKey: config.qwenApiKey,
    };
  }
}
