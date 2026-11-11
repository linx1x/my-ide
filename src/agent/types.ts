export type AgentProviderId = 'openai' | 'anthropic' | 'qwen';

export type AgentMessageRole = 'system' | 'user' | 'assistant';

export interface AgentMessage {
  role: AgentMessageRole;
  content: string;
}

export interface AgentGenerateRequest {
  messages: AgentMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AgentTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AgentGenerateResponse {
  provider: AgentProviderId;
  model: string;
  content: string;
  usage?: AgentTokenUsage;
  raw: unknown;
}

export interface AgentProviderAdapter {
  id: AgentProviderId;
  displayName: string;
  defaultModel: string;
  isConfigured(): boolean;
  generate(request: AgentGenerateRequest): Promise<AgentGenerateResponse>;
}

export class AgentProviderError extends Error {
  provider: AgentProviderId;
  status?: number;
  retryable: boolean;

  constructor(
    provider: AgentProviderId,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AgentProviderError';
    this.provider = provider;
    this.retryable = options.retryable ?? false;
    if (options.status !== undefined) {
      this.status = options.status;
    }
  }
}
