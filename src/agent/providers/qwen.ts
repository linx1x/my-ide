import config from '../../config.js';
import { createOpenAICompatibleAdapter } from './openai-compatible.js';

export function createQwenAdapter() {
  return createOpenAICompatibleAdapter({
    id: 'qwen',
    displayName: 'Qwen',
    apiKey: config.qwenApiKey,
    baseUrl: config.qwenBaseUrl,
    defaultModel: config.qwenModel,
  });
}
