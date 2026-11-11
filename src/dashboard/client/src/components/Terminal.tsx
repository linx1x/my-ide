import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

type TerminalProps = {
  wsPath: string;
  fontSize?: number;
  visible?: boolean;
  themeKey?: string;
};

export type TerminalHandle = {
  injectCommand?: (text: string) => void;
};

function getTerminalTheme() {
  const body = document.body;
  const styles = getComputedStyle(body);
  const theme = body.getAttribute('data-theme') || '';
  const terminalBg = styles.getPropertyValue('--terminal-bg').trim();
  const panel = styles.getPropertyValue('--panel').trim();
  const bg = terminalBg || panel || '#1A1F2B';
  const fg = styles.getPropertyValue('--text').trim() || '#cbd5e1';
  const accent = styles.getPropertyValue('--accent').trim() || '#3B82F6';

  if (theme === 'matrix') {
    return {
      background: '#0a0a0a',
      foreground: '#33ff00',
      cursor: '#33ff00',
      cursorAccent: '#0a0a0a',
      selectionBackground: 'rgba(51, 255, 0, 0.25)',
      selectionForeground: '#33ff00',
      black: '#0a0a0a',
      red: '#ff3333',
      green: '#33ff00',
      yellow: '#ffb000',
      blue: '#1f521f',
      magenta: '#33ff00',
      cyan: '#33ff00',
      white: '#33ff00',
      brightBlack: '#1f521f',
      brightRed: '#ff3333',
      brightGreen: '#33ff00',
      brightYellow: '#ffb000',
      brightBlue: '#33ff00',
      brightMagenta: '#33ff00',
      brightCyan: '#33ff00',
      brightWhite: '#33ff00',
    };
  }

  if (theme === 'cyberpunk') {
    return {
      background: '#0a0a0f',
      foreground: '#e0e0e0',
      cursor: '#00ff88',
      cursorAccent: '#0a0a0f',
      selectionBackground: 'rgba(0, 255, 136, 0.25)',
      selectionForeground: '#00ff88',
      black: '#0a0a0f',
      red: '#ff3366',
      green: '#00ff88',
      yellow: '#ffb000',
      blue: '#00d4ff',
      magenta: '#ff00ff',
      cyan: '#00d4ff',
      white: '#e0e0e0',
      brightBlack: '#2a2a3a',
      brightRed: '#ff3366',
      brightGreen: '#00ff88',
      brightYellow: '#ffb000',
      brightBlue: '#00d4ff',
      brightMagenta: '#ff00ff',
      brightCyan: '#00d4ff',
      brightWhite: '#e0e0e0',
    };
  }

  if (theme === 'glass') {
    return {
      background: 'rgba(255, 255, 255, 0.14)',
      foreground: '#1A1A2E',
      cursor: '#6366F1',
      cursorAccent: '#1A1A2E',
      selectionBackground: 'rgba(99, 102, 241, 0.25)',
      selectionForeground: '#1A1A2E',
      black: '#1A1A2E',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#4A4A68',
      brightBlack: '#4A4A68',
      brightRed: '#dc2626',
      brightGreen: '#16a34a',
      brightYellow: '#ca8a04',
      brightBlue: '#6366F1',
      brightMagenta: '#9333ea',
      brightCyan: '#0891b2',
      brightWhite: '#1A1A2E',
    };
  }

  if (theme === 'living-canvas') {
    return {
      background: '#050508',
      foreground: '#EDEDEF',
      cursor: '#648CFF',
      cursorAccent: '#050508',
      selectionBackground: 'rgba(100, 140, 255, 0.25)',
      selectionForeground: '#EDEDEF',
      black: '#050508',
      red: '#ef4444',
      green: '#34D399',
      yellow: '#F59E0B',
      blue: '#648CFF',
      magenta: '#A78BFA',
      cyan: '#34D399',
      white: '#8A8F98',
      brightBlack: '#0F0F18',
      brightRed: '#ef4444',
      brightGreen: '#34D399',
      brightYellow: '#F59E0B',
      brightBlue: '#648CFF',
      brightMagenta: '#A78BFA',
      brightCyan: '#34D399',
      brightWhite: '#EDEDEF',
    };
  }

  if (theme === 'tactical-dark') {
    return {
      background: '#141A25',
      foreground: '#cbd5e1',
      cursor: '#3B82F6',
      cursorAccent: '#141A25',
      selectionBackground: 'rgba(59, 130, 246, 0.25)',
      selectionForeground: '#cbd5e1',
      black: '#141A25',
      red: '#EF4444',
      green: '#22C55E',
      yellow: '#EAB308',
      blue: '#3B82F6',
      magenta: '#A855F7',
      cyan: '#06B6D4',
      white: '#8a94a8',
      brightBlack: '#2A2F3A',
      brightRed: '#F87171',
      brightGreen: '#4ADE80',
      brightYellow: '#FACC15',
      brightBlue: '#60A5FA',
      brightMagenta: '#C084FC',
      brightCyan: '#22D3EE',
      brightWhite: '#e2e8f0',
    };
  }

  if (theme === 'vs-dark') {
    return {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#0e639c',
      cursorAccent: '#1e1e1e',
      selectionBackground: 'rgba(14, 99, 156, 0.25)',
      selectionForeground: '#d4d4d4',
      black: '#1e1e1e',
      red: '#f44747',
      green: '#16825d',
      yellow: '#e6c547',
      blue: '#0e639c',
      magenta: '#9b46b0',
      cyan: '#0891b2',
      white: '#858585',
      brightBlack: '#2d2d2d',
      brightRed: '#f44747',
      brightGreen: '#4ec9b0',
      brightYellow: '#e6c547',
      brightBlue: '#1177bb',
      brightMagenta: '#9b46b0',
      brightCyan: '#0891b2',
      brightWhite: '#ffffff',
    };
  }

  if (theme === 'vs') {
    return {
      background: '#f3f3f3',
      foreground: '#333333',
      cursor: '#006ab1',
      cursorAccent: '#f3f3f3',
      selectionBackground: 'rgba(0, 106, 177, 0.25)',
      selectionForeground: '#333333',
      black: '#1e1e1e',
      red: '#e51400',
      green: '#16825d',
      yellow: '#bf8803',
      blue: '#006ab1',
      magenta: '#9b46b0',
      cyan: '#0891b2',
      white: '#6e6e6e',
      brightBlack: '#2d2d2d',
      brightRed: '#e51400',
      brightGreen: '#2ea043',
      brightYellow: '#bf8803',
      brightBlue: '#007acc',
      brightMagenta: '#9b46b0',
      brightCyan: '#0891b2',
      brightWhite: '#000000',
    };
  }

  if (theme === 'hc-black') {
    return {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#4fc1ff',
      cursorAccent: '#000000',
      selectionBackground: 'rgba(79, 193, 255, 0.35)',
      selectionForeground: '#ffffff',
      black: '#000000',
      red: '#f44747',
      green: '#4ec9b0',
      yellow: '#cca700',
      blue: '#4fc1ff',
      magenta: '#c586c0',
      cyan: '#0891b2',
      white: '#cccccc',
      brightBlack: '#1a1a1a',
      brightRed: '#f44747',
      brightGreen: '#4ec9b0',
      brightYellow: '#e6c547',
      brightBlue: '#75bfff',
      brightMagenta: '#c586c0',
      brightCyan: '#0891b2',
      brightWhite: '#ffffff',
    };
  }

  const error = styles.getPropertyValue('--error').trim() || '#f44747';
  const success = styles.getPropertyValue('--success').trim() || '#4ec9b0';
  const warning = styles.getPropertyValue('--warning').trim() || '#cca700';
  const muted = styles.getPropertyValue('--muted').trim() || '#858585';
  const surfaceLight = styles.getPropertyValue('--surface-light').trim() || '#2d2d2d';
  const textBright = styles.getPropertyValue('--text-bright').trim() || fg;
  return {
    background: bg,
    foreground: fg,
    cursor: accent,
    cursorAccent: bg,
    selectionBackground: accent + '33',
    selectionForeground: fg,
    black: bg,
    red: error,
    green: success,
    yellow: warning,
    blue: accent,
    magenta: '#c586c0',
    cyan: '#0891b2',
    white: muted,
    brightBlack: surfaceLight,
    brightRed: error,
    brightGreen: success,
    brightYellow: warning,
    brightBlue: accent,
    brightMagenta: '#c586c0',
    brightCyan: '#0891b2',
    brightWhite: textBright,
  };
}

// Defer cleanup so React StrictMode's unmount→remount doesn't close the WS before the remount reconnects
const DEFER_MS = 400;

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal({ wsPath, fontSize = 14, visible = true, themeKey = '' }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [showReconnectHint, setShowReconnectHint] = useState(false);

  useImperativeHandle(ref, () => ({
    injectCommand(text) {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {ws.send(text + '\r\n');}
    },
  }), []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) {return;}
    try {
      term.options.theme = getTerminalTheme();
    } catch {}
  }, [themeKey]);

  useEffect(() => {
    unmountedRef.current = false;
    const container = containerRef.current;
    if (!container || !wsPath) {return;}

    // Guard against React StrictMode double-invocation: if a WebSocket is
    // already open/connecting for this mount cycle, skip the second run.
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {return;}

    const term = new XTermTerminal({
      theme: getTerminalTheme(),
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = proto + '//' + window.location.host + wsPath;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      retryRef.current = 0;
      setShowReconnectHint(false);
      try {
        ws.send(`\x01resize:${term.cols},${term.rows}`);
      } catch {}
    });

    // Raw passthrough: PTY handles TTY, shell handles line editing
    ws.addEventListener('message', (e) => {
      try {
        const payload = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : e.data;
        term.write(payload);
      } catch {}
    });

    ws.addEventListener('close', () => {
      try { term.write('\r\n\x1b[33m[Terminal disconnected]\x1b[0m\r\n'); } catch {}
      if (unmountedRef.current) {return;}
      if (retryRef.current >= 5) {
        setShowReconnectHint(true);
        return;
      }
      const delay = Math.floor(1500 * (1.5 ** retryRef.current));
      retryRef.current += 1;
      try { term.write(`\x1b[33m[Reconnecting in ${Math.ceil(delay / 1000)}s...]\x1b[0m\r\n`); } catch {}
      reconnectTimerRef.current = setTimeout(() => {
        if (unmountedRef.current) {return;}
        setReconnectNonce((n) => n + 1);
      }, delay);
    });

    ws.addEventListener('error', () => { /* suppress */ });

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {try { ws.send(data); } catch {}}
    });

    const onResize = ({ cols, rows }: { cols: number; rows: number }) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(`\x01resize:${cols},${rows}`);
        } catch {}
      }
    };
    term.onResize(onResize);

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) {clearTimeout(reconnectTimerRef.current);}
      const wsToClose = ws;
      const termToDispose = term;
      termRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
      setTimeout(() => {
        try { wsToClose?.close(); } catch {}
        try { termToDispose?.dispose(); } catch {}
      }, DEFER_MS);
    };
  }, [wsPath, fontSize, reconnectNonce]);

  useEffect(() => {
    if (!visible || !fitAddonRef.current) {return;}
    const raf = requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !fitAddonRef.current) {return;}

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {}
      });
    });
    observer.observe(container);
    resizeObserverRef.current = observer;
    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [wsPath]);

  return (
    <>
      {showReconnectHint && (
        <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 5 }}>
          <button className="icon-btn" onClick={() => { retryRef.current = 0; setShowReconnectHint(false); setReconnectNonce((n) => n + 1); }}>
            Reconnect
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ width: '100%', height: '100%', minHeight: 80 }}
      />
    </>
  );
});
