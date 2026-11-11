import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';

const LAYOUT_KEY = 'dashboard_layout';

type EditorView = 'code' | 'preview';

type LayoutState = {
  sidebarWidth: number;
  terminalHeight: number;
  chatTerminalHeight: number;
  chatTerminalOpen: boolean;
  sidebarVisible: boolean;
  activePanel: string;
  terminalOpen: boolean;
  quickOpenOpen: boolean;
  commandPaletteOpen: boolean;
  mobileSidebarOpen: boolean;
  editorTheme: string;
  editorWordWrap: boolean;
  editorView: EditorView;
};

type TerminalInjector = {
  injectCommand?: (text: string) => void;
};

type LayoutContextValue = LayoutState & {
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;
  setChatTerminalHeight: (h: number) => void;
  setActivePanel: (panel: string) => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  toggleChatTerminal: () => void;
  setQuickOpenOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setEditorTheme: (theme: string) => void;
  setEditorWordWrap: (wrap: boolean) => void;
  setEditorView: (view: EditorView) => void;
  isMobile: boolean;
  terminalInjectRef: MutableRefObject<TerminalInjector | null>;
  injectTerminalCommand: (text: string) => void;
};

const defaults: LayoutState = {
  sidebarWidth: 320,
  terminalHeight: 220,
  chatTerminalHeight: 180,
  chatTerminalOpen: true,
  sidebarVisible: true,
  activePanel: 'explorer',
  terminalOpen: true,
  quickOpenOpen: false,
  commandPaletteOpen: false,
  mobileSidebarOpen: false,
  editorTheme: 'tactical-dark',
  editorWordWrap: false,
  editorView: 'code',
};

function loadLayout(): LayoutState {
  const isMobileViewport =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LayoutState> & Record<string, unknown>;
      delete parsed.interactiveBackground;
      return { ...defaults, ...parsed };
    }
  } catch {}
  return {
    ...defaults,
    activePanel: isMobileViewport ? 'explorer' : defaults.activePanel,
  };
}

function saveLayout(layout: LayoutState): void {
  try {
    const { quickOpenOpen: _qo, commandPaletteOpen: _cp, ...toSave } = layout;
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(toSave));
  } catch {}
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState(loadLayout);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const terminalInjectRef = useRef<TerminalInjector | null>(null);
  /** Injects a command into the integrated terminal. Preview startup no longer uses this (sandbox API); still used by e.g. custom run. */
  const injectTerminalCommand = useCallback((text: string) => {
    try {
      terminalInjectRef.current?.injectCommand?.(text);
    } catch {}
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => saveLayout(layout), 300);
    return () => clearTimeout(timer);
  }, [layout]);

  const setSidebarWidth = useCallback((w: number) => {
    setLayout((prev) => ({ ...prev, sidebarWidth: Math.max(240, Math.min(window.innerWidth * 0.6, w)) }));
  }, []);

  const setTerminalHeight = useCallback((h: number) => {
    setLayout((prev) => ({ ...prev, terminalHeight: Math.max(140, Math.min(window.innerHeight * 0.72, h)) }));
  }, []);

  const setChatTerminalHeight = useCallback((h: number) => {
    setLayout((prev) => ({ ...prev, chatTerminalHeight: Math.max(80, h) }));
  }, []);

  const setActivePanel = useCallback((panel: string) => {
    setLayout((prev) => {
      const isSamePanel = prev.activePanel === panel;
      return {
        ...prev,
        activePanel: panel,
        sidebarVisible: isSamePanel ? !prev.sidebarVisible : true,
        mobileSidebarOpen: true,
      };
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setLayout((prev) => ({ ...prev, sidebarVisible: !prev.sidebarVisible }));
  }, []);

  const toggleTerminal = useCallback(() => {
    setLayout((prev) => ({ ...prev, terminalOpen: !prev.terminalOpen }));
  }, []);

  const toggleChatTerminal = useCallback(() => {
    setLayout((prev) => ({ ...prev, chatTerminalOpen: !prev.chatTerminalOpen }));
  }, []);

  const setQuickOpenOpen = useCallback((open: boolean) => {
    setLayout((prev) => ({ ...prev, quickOpenOpen: !!open }));
  }, []);

  const setCommandPaletteOpen = useCallback((open: boolean) => {
    setLayout((prev) => ({ ...prev, commandPaletteOpen: !!open }));
  }, []);

  const setMobileSidebarOpen = useCallback((open: boolean) => {
    setLayout((prev) => ({ ...prev, mobileSidebarOpen: !!open }));
  }, []);

  const setEditorTheme = useCallback((theme: string) => {
    setLayout((prev) => ({ ...prev, editorTheme: theme || defaults.editorTheme }));
  }, []);

  const setEditorWordWrap = useCallback((wrap: boolean) => {
    setLayout((prev) => ({ ...prev, editorWordWrap: !!wrap }));
  }, []);

  const setEditorView = useCallback((view: EditorView) => {
    setLayout((prev) => ({ ...prev, editorView: view === 'preview' ? 'preview' : 'code' }));
  }, []);

  const value = useMemo(
    () => ({
      ...layout,
      shortcutsOpen,
      setShortcutsOpen,
      setSidebarWidth,
      setTerminalHeight,
      setChatTerminalHeight,
      setActivePanel,
      toggleSidebar,
      toggleTerminal,
      toggleChatTerminal,
      setQuickOpenOpen,
      setCommandPaletteOpen,
      setMobileSidebarOpen,
      setEditorTheme,
      setEditorWordWrap,
      setEditorView,
      isMobile,
      terminalInjectRef,
      injectTerminalCommand,
    }),
    [
      layout,
      shortcutsOpen,
      setSidebarWidth,
      setTerminalHeight,
      setChatTerminalHeight,
      setActivePanel,
      toggleSidebar,
      toggleTerminal,
      toggleChatTerminal,
      setQuickOpenOpen,
      setCommandPaletteOpen,
      setMobileSidebarOpen,
      setEditorTheme,
      setEditorWordWrap,
      setEditorView,
      isMobile,
      injectTerminalCommand,
    ]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) {throw new Error('useLayout must be used within LayoutProvider');}
  return ctx;
}
