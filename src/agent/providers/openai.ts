import config from '../../config.js';
import { createOpenAICompatibleAdapter } from './openai-compatible.js';

export function createOpenAIAdapter() {
  return createOpenAICompatibleAdapter({
    id: 'openai',
    displayName: 'OpenAI',
    apiKey: config.openaiApiKey,
    baseUrl: config.openaiBaseUrl,
    defaultModel: config.openaiModel,
  });
}
