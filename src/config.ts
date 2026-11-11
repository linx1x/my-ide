import { config as loadEnv } from 'dotenv';
import { randomBytes } from 'node:crypto';
loadEnv({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

/** In Docker, localhost is the bridge container, not n8n — use compose service hostname (n8n listens on 5678 in project compose). */
function resolveN8nInternalUrl(): string {
  const raw = (
    process.env.N8N_INTERNAL_URL ||
    process.env.N8N_URL ||
    'http://localhost:5678'
  ).replace(/\/+$/, '');
  if (process.env.DOCKER === '1') {
    if (raw === 'http://localhost:5678' || raw === 'http://127.0.0.1:5678') {
      return 'http://n8n:5678';
    }
  }
  return raw;
}

const config = {
  // Log level for shared logger (src/logger.ts): debug | info | warn | error. Default info.
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),

  // Only accept messages from these WhatsApp numbers (with country code, no + sign)
  // e.g. ["33612345678"] or "+33 6 12 34 56 78" — spaces and + are stripped
  // Leave empty to accept from anyone (NOT recommended)
  allowedNumbers: process.env.ALLOWED_NUMBERS
    ? process.env.ALLOWED_NUMBERS.split(',')
      .map((n) => n.replace(/[\s+]/g, '').trim())
      .filter(Boolean)
    : [],

  // Working directory used by dashboard file, git, terminal, and preview tools.
  codebaseWorkDir: (() => {
    const val = process.env.DASHBOARD_WORKDIR;
    // Discard Windows-style absolute paths (e.g. C:\...) when running on Linux/Docker
    if (val && process.platform !== 'win32' && /^[A-Za-z]:[\\\/]/.test(val)) {
      return process.cwd();
    }
    return val || process.cwd();
  })(),

  // Max characters to send back in a single WhatsApp message
  get maxReplyLength() {
    const val = parseInt(process.env.MAX_REPLY_LENGTH || '4000', 10);
    return Number.isNaN(val) || val < 500 || val > 65000 ? 4000 : val;
  },

  // Path to persist WhatsApp auth state
  authStorePath: process.env.AUTH_STORE_PATH || './auth_store',

  // WhatsApp Web version override (optional). Baileys uses its default when unset.
  // If you get 405 repeatedly, try setting WA_VERSION to a version array, e.g. WA_VERSION="[2,3000,1023223821]"
  get waVersion() {
    const raw = process.env.WA_VERSION?.trim();
    if (!raw) {return undefined;}
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) && v.length >= 3 ? v : undefined;
    } catch {
      return undefined;
    }
  },

  // Persistent data root (Docker/SaaS). When set: auth_store, chat_history, projects use this dir.
  bridgeDataDir:
    process.env.DOCKER_DATA_DIR || process.env.BRIDGE_DATA_DIR || null,

  // WhatsApp reply formatting
  whatsappPromptPrefix: process.env.WHATSAPP_PROMPT_PREFIX !== '0',
  screenshotEnabled: process.env.SCREENSHOT_ENABLED !== '0',

  // Git accept/reject controls for protected dashboard Git operations.
  gitAcceptRejectEnabled: process.env.GIT_ACCEPT_REJECT_ENABLED !== '0',

  // Voice message transcription (default: on, uses local Whisper - no API key)
  voiceEnabled: process.env.VOICE_ENABLED !== '0',
  groqApiKey: process.env.GROQ_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  whisperModel: process.env.WHISPER_MODEL || '',
  /** Empty = auto (Groq if groqApiKey set, else local). Else local|groq|openai */
  voiceProvider: (process.env.VOICE_PROVIDER || '').trim().toLowerCase(),

  // AI agent providers. All provider access goes through src/agent adapters.
  agentDefaultProvider: (process.env.AGENT_DEFAULT_PROVIDER || 'openai').trim().toLowerCase(),
  get agentDefaultMaxTokens() {
    const v = parseInt(process.env.AGENT_DEFAULT_MAX_TOKENS || '4096', 10);
    return Number.isNaN(v) || v < 1 ? 4096 : Math.min(v, 64000);
  },
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicBaseUrl: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, ''),
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  qwenApiKey: process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '',
  qwenBaseUrl: (
    process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, ''),
  qwenModel: process.env.QWEN_MODEL || 'qwen3.6-plus',

  /**
   * Mastra dashboard chat + persistence. Requires provider API keys for the chosen provider.
   * When disabled, /api/agent/chat returns 404.
   */
  agentChatEnabled: process.env.AGENT_CHAT_ENABLED === '1',
  /** Experimental: run a lightweight planner pass before the main agent stream. */
  agentTeamMode: process.env.AGENT_TEAM_MODE === '1',
  /** When false, Mastra memory omits semanticRecall (embeddings download skipped). */
  agentSemanticMemoryEnabled: process.env.AGENT_MEMORY_SEMANTIC !== '0',
  /** Override SQLite path for traces/budget/cache/evals (default: bridge-data/agent-runtime.db). */
  agentRuntimeDbPath: (process.env.AGENT_RUNTIME_DB || '').trim(),
  /** LibSQL URL for Mastra Memory storage + vectors (default file URL under bridge-data). */
  agentMastraLibsqlUrl: (process.env.AGENT_MASTRA_LIBSQL_URL || '').trim(),

  /** DB visualizer: drop idle connections after this many ms (default 30 min) */
  get dashboardDbConnectionIdleMs() {
    const v = parseInt(process.env.DASHBOARD_DB_CONNECTION_IDLE_MS || '1800000', 10);
    return Number.isNaN(v) || v < 60000 ? 1800000 : Math.min(v, 86400000);
  },
  /** Max concurrent DB visualizer connections per dashboard user (phone) */
  get dashboardDbMaxConnectionsPerUser() {
    const v = parseInt(process.env.DASHBOARD_DB_MAX_CONNECTIONS_PER_USER || '5', 10);
    return Number.isNaN(v) || v < 1 ? 5 : Math.min(v, 50);
  },
  /** Max total DB visualizer connections across all users */
  get dashboardDbMaxTotalConnections() {
    const v = parseInt(process.env.DASHBOARD_DB_MAX_TOTAL_CONNECTIONS || '50', 10);
    return Number.isNaN(v) || v < 1 ? 50 : Math.min(v, 500);
  },

  /** Project clone/build jobs: max entries in memory; oldest finished jobs evicted first */
  get projectJobsMaxEntries() {
    const v = parseInt(process.env.PROJECT_JOBS_MAX_ENTRIES || '50', 10);
    return Number.isNaN(v) || v < 5 ? 50 : Math.min(v, 500);
  },
  /** Remove finished project jobs after this many ms (default 15 min) */
  get projectJobsFinishedRetentionMs() {
    const v = parseInt(process.env.PROJECT_JOBS_FINISHED_RETENTION_MS || '900000', 10);
    return Number.isNaN(v) || v < 60000 ? 900000 : Math.min(v, 86400000);
  },

  // Dashboard (optional) — web UI with codebase tools.
  dashboardEnabled: process.env.DASHBOARD_ENABLED === '1',
  dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3847', 10) || 3847,
  dashboardAuthRateLimitWindowMs: parseInt(process.env.DASHBOARD_AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10) || 900000,
  dashboardAuthRateLimitMax: Math.max(1, parseInt(process.env.DASHBOARD_AUTH_RATE_LIMIT_MAX || '20', 10)),
  dashboardSecret: (() => {
    if (process.env.DASHBOARD_SECRET) {return process.env.DASHBOARD_SECRET;}
    const generated = randomBytes(32).toString('hex');
    console.warn(
      '[Security] DASHBOARD_SECRET not set — using random ephemeral secret. Sessions will not survive restarts. Set DASHBOARD_SECRET in .env.',
    );
    return generated;
  })(),
  // Codebase tab root: "__app__" = bridge's own directory (remote IDE), or path. Unset = DASHBOARD_WORKDIR
  dashboardCodebaseRoot: process.env.DASHBOARD_CODEBASE_ROOT || null,
  // CORS: when frontend is on a different origin (e.g. Cloudflare Pages), set allowed origins (comma-separated)
  dashboardCorsOrigins: process.env.DASHBOARD_CORS_ORIGIN
    ? process.env.DASHBOARD_CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    : [],
  /** Git panel: poll /api/git/status while panel is open (ms). Catches unstaged saves; SSE handles .git metadata. */
  get dashboardGitStatusPollMs() {
    const v = parseInt(process.env.DASHBOARD_GIT_STATUS_POLL_MS || '4000', 10);
    return Number.isNaN(v) || v < 1000 ? 4000 : Math.min(v, 60000);
  },
  // LangFuse observability UI (same-host reverse proxy)
  langfuseEnabled: process.env.LANGFUSE_UI_ENABLED === '1',
  langfuseInternalUrl: process.env.LANGFUSE_UI_INTERNAL_URL || 'http://localhost:3000',
  langfusePublicPath: (() => {
    const raw = (process.env.LANGFUSE_UI_PUBLIC_PATH || '/langfuse').trim();
    const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeading.replace(/\/+$/, '') || '/langfuse';
  })(),
  // n8n integration settings (same-host reverse proxy recommended)
  n8nEnabled: process.env.N8N_ENABLED === '1',
  n8nInternalUrl: resolveN8nInternalUrl(),
  n8nPublicPath: (() => {
    const raw = (process.env.N8N_PUBLIC_PATH || '/n8n').trim();
    const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeading.replace(/\/+$/, '') || '/n8n';
  })(),
  n8nApiKey: process.env.N8N_API_KEY || '',
  n8nUiEmbedMode: (process.env.N8N_UI_EMBED_MODE || 'iframe').toLowerCase(), // iframe | tab
  /** Base URL the bridge is reachable at (for n8n callback, CORS). If CUSTOM_DOMAIN is set, used as https://CUSTOM_DOMAIN when DASHBOARD_BASE_URL unset. */
  dashboardBaseUrl:
    process.env.DASHBOARD_BASE_URL ||
    (process.env.CUSTOM_DOMAIN
      ? `https://${String(process.env.CUSTOM_DOMAIN).replace(/^https?:\/\//, '').split('/')[0]}`
      : null) ||
    `http://localhost:${process.env.DASHBOARD_PORT || '3847'}`,
  // Editor AI completion (Ollama) — optional, for dashboard code editor
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaCompletionModel:
    process.env.OLLAMA_COMPLETION_MODEL || 'qwen2.5-coder:7b',

  // GitHub workflow panel.
  githubWorkflowEnabled:
    process.env.GITHUB_WORKFLOW_ENABLED === '1' ||
    process.env.LINEAR_GITHUB_WORKFLOW_ENABLED === '1',
  // Workflow panel — API key for GitHub (server-side only)
  githubToken: process.env.GITHUB_TOKEN || '',

  // ─── Security ──────────────────────────────────────────────────────────────
  // Protected branches — dashboard API will refuse to push or delete these.
  // Comma-separated. Default: main,master,develop,production
  protectedBranches: new Set(
    (process.env.PROTECTED_BRANCHES || 'main,master,develop,production')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean),
  ),

  // Allowed branch name prefixes for push. If non-empty, only branches starting
  // with one of these prefixes may be pushed. Empty string = allow all (except protected).
  // Set ALLOWED_PUSH_PREFIXES="" to disable the prefix check entirely.
  get allowedPushPrefixes() {
    if (process.env.ALLOWED_PUSH_PREFIXES !== undefined) {
      return process.env.ALLOWED_PUSH_PREFIXES.split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return ['feature/', 'fix/', 'hotfix/', 'chore/', 'release/', 'refactor/'];
  },

  // Terminal SSH — replaces node-pty. Connects to localhost by default.
  // Set TERMINAL_SSH_ENABLED=0 to disable (e.g. when SSH auth to localhost fails on Windows).
  terminalSshEnabled: process.env.TERMINAL_SSH_ENABLED !== '0',
  terminalSshHost: process.env.TERMINAL_SSH_HOST || '127.0.0.1',
  terminalSshPort: parseInt(process.env.TERMINAL_SSH_PORT || '22', 10),
  terminalSshUser: process.env.TERMINAL_SSH_USER || '', // empty = resolved at runtime from OS
  terminalSshKeyPath: process.env.TERMINAL_SSH_KEY_PATH || '', // empty = auto-detect ~/.ssh/id_*
  terminalSshPassphrase: process.env.TERMINAL_SSH_PASSPHRASE || '', // empty = key has no passphrase

  // Trust proxy hop count for rate-limiting/IP detection. Default 1 (single reverse proxy).
  // Set to match the number of reverse proxies in front of this server (e.g. 2 for Cloudflare + cloudflared).
  get trustProxyHops() {
    const val = parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
    return Number.isNaN(val) || val < 0 ? 1 : val;
  },

  // CORS strict mode: when "1", only explicitly listed origins (DASHBOARD_CORS_ORIGIN) are allowed.
  // Recommended when the dashboard is exposed via a public tunnel.
  dashboardCorsStrict: process.env.DASHBOARD_CORS_STRICT === '1',

  // Preview (localhost-style): temp dir for builder preview, port range, idle timeout
  previewTempDir: process.env.PREVIEW_TEMP_DIR || null, // null = bridge-data/preview
  previewPortMin: parseInt(process.env.PREVIEW_PORT_MIN || '5173', 10) || 5173,
  previewPortMax: parseInt(process.env.PREVIEW_PORT_MAX || '5199', 10) || 5199,
  previewIdleTimeoutMs: parseInt(process.env.PREVIEW_IDLE_TIMEOUT_MS || '1800000', 10) || 60000, // 30 min default
  previewMaterializeTimeoutMs: parseInt(process.env.PREVIEW_MATERIALIZE_TIMEOUT_MS || '120000', 10) || 60000,
  previewReadyTimeoutMs: parseInt(process.env.PREVIEW_READY_TIMEOUT_MS || '90000', 10) || 30000,
  // Host the preview proxy connects to. Default 127.0.0.1. Use host.docker.internal if dashboard runs in Docker and Vite runs on host; or host IP in WSL.
  previewProxyHost: process.env.PREVIEW_PROXY_HOST || '127.0.0.1',
  // Fixed port for terminal-driven preview (run in dashboard terminal, proxy to iframe). If busy, next free in range is used.
  previewTerminalPort: parseInt(process.env.PREVIEW_TERMINAL_PORT || '5173', 10) || 5173,
};

/**
 * Validates required configuration when NODE_ENV=production. Throws with a clear message if invalid.
 * Call once at startup (e.g. from index.ts).
 */
export function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') {return;}
  if (config.dashboardEnabled && !process.env.DASHBOARD_SECRET) {
    throw new Error(
      'Production: set DASHBOARD_SECRET in .env when DASHBOARD_ENABLED=1. Use a strong random value (e.g. openssl rand -hex 32).',
    );
  }
  if (config.allowedNumbers.length === 0 && !config.dashboardEnabled) {
    throw new Error(
      'Production: set ALLOWED_NUMBERS for WhatsApp and/or DASHBOARD_ENABLED=1.',
    );
  }
}

export default config;
