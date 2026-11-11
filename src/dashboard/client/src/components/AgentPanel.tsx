import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { streamAgentChat, type AgentChatSseEvent } from '../api';
import { queryKeys } from '../queryKeys';
import { fetchStatus } from '../api';

type ChatMsg = { role: 'user' | 'assistant'; text: string };

const THREAD_KEY = 'dashboard_agent_thread';

export function AgentPanel() {
  const statusQuery = useQuery({
    queryKey: queryKeys.status,
    queryFn: fetchStatus,
    staleTime: 30_000,
  });

  const agentEnabled = Boolean(
    (statusQuery.data as { agentChatEnabled?: boolean } | undefined)?.agentChatEnabled,
  );

  const [threadId] = useState(() => {
    try {
      const existing = sessionStorage.getItem(THREAD_KEY);
      if (existing) {
        return existing;
      }
      const id = `thr-${crypto.randomUUID?.() ?? String(Date.now())}`;
      sessionStorage.setItem(THREAD_KEY, id);
      return id;
    } catch {
      return `thr-${Date.now()}`;
    }
  });

  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'qwen'>('openai');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const disableSend = !agentEnabled || busy || !input.trim();

  const handleEvent = useCallback(
    (ev: AgentChatSseEvent) => {
      switch (ev.type) {
      case 'token':
        setStreaming((s) => s + ev.text);
        break;
      case 'tool_call_started':
        setStreaming(
          (s) =>
            `${s}\n[tool ${ev.toolName}]`,
        );
        break;
      case 'tool_result':
        setStreaming((s) => `${s}\n[tool result ${ev.toolName}]`);
        break;
      case 'error':
        setError(ev.message);
        break;
      case 'done':
        setStreaming((full) => {
          const t = full.trim();
          if (t) {
            setMessages((prev) => [...prev, { role: 'assistant', text: t }]);
          }
          return '';
        });
        break;
      default:
        break;
      }
    },
    [],
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (disableSend) {
        return;
      }
      const text = input.trim();
      setInput('');
      setMessages((m) => [...m, { role: 'user', text }]);
      setError(null);
      setStreaming('');
      setBusy(true);
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        await streamAgentChat({ message: text, threadId, provider }, handleEvent, abortRef.current.signal);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        setBusy(false);
      }
    },
    [disableSend, handleEvent, input, provider, threadId],
  );

  const hint = useMemo(() => {
    if (!agentEnabled) {
      return 'Enable AGENT_CHAT_ENABLED=1 and restart the bridge (requires provider API keys).';
    }
    return `Thread ${threadId.slice(0, 12)}… · Streaming tokens & tool traces below.`;
  }, [agentEnabled, threadId]);

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">AGENT</span>
      </div>
      <div className="sidebar-body agent-panel">
        <p className="more-panel-intro">{hint}</p>
        {agentEnabled && (
          <label className="agent-provider-row">
            <span className="agent-provider-label">Provider</span>
            <select
              className="agent-provider-select"
              value={provider}
              onChange={(ev) => setProvider(ev.target.value as typeof provider)}
              disabled={busy}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="qwen">Qwen (OpenAI-compatible)</option>
            </select>
          </label>
        )}
        <div className="agent-chat-log" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`agent-msg agent-msg--${m.role}`}>
              <span className="agent-msg-role">{m.role === 'user' ? 'You' : 'Assistant'}</span>
              <pre className="agent-msg-text">{m.text}</pre>
            </div>
          ))}
          {streaming ? (
            <div className="agent-msg agent-msg--assistant agent-msg--streaming">
              <span className="agent-msg-role">Assistant</span>
              <pre className="agent-msg-text">{streaming}</pre>
            </div>
          ) : null}
        </div>
        {error && <div className="agent-error">{error}</div>}
        <form className="agent-chat-form" onSubmit={onSubmit}>
          <textarea
            className="agent-chat-input"
            rows={3}
            placeholder={agentEnabled ? 'Ask about the codebase…' : 'Agent disabled'}
            value={input}
            disabled={!agentEnabled || busy}
            onChange={(ev) => setInput(ev.target.value)}
          />
          <button type="submit" className="agent-send-btn" disabled={disableSend}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </>
  );
}
