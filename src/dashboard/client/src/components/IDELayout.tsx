import { useEffect, useRef } from 'react';
import type { ComponentType, TouchEvent } from 'react';
import { motion } from 'motion/react';
import {
  ExplorerNavIcon,
  SearchNavIcon,
  GitNavIcon,
  MoreNavIcon,
  TerminalNavIcon,
} from './BottomNavIcons';
import { LayoutProvider, useLayout } from '../context/LayoutContext';
import { EditorProvider, useEditor } from '../context/EditorContext';
import { setEditorToast } from '../context/EditorContext';
import { useToast } from '../context/ToastContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Sidebar } from './Sidebar';
import { EditorArea } from './EditorArea';
import { StatusBar } from './StatusBar';
import { QuickOpen } from './QuickOpen';
import { ShortcutsModal } from './ShortcutsModal';
import { CommandPalette } from './CommandPalette';
import { LivingCanvas } from './LivingCanvas';
import { ContextStrip } from './ContextStrip';

type BottomNavItem = {
  panel: string;
  label: string;
  NavIcon: ComponentType<{ active: boolean }>;
  /** Opens embedded web tab (e.g. n8n iframe) instead of a sidebar panel */
  webTab?: { id: string; title: string; url: string; icon?: string };
};

type BottomNavIconButtonProps = {
  label: string;
  NavIcon: ComponentType<{ active: boolean }>;
  active: boolean;
  onClick: () => void;
};

type IDELayoutProps = {
  onLogout: () => void;
};

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { panel: 'explorer', label: 'Explorer', NavIcon: ExplorerNavIcon },
  { panel: 'search',   label: 'Search',   NavIcon: SearchNavIcon },
  { panel: 'git',      label: 'Git',      NavIcon: GitNavIcon },
  { panel: 'more',     label: 'Automations',     NavIcon: MoreNavIcon },
];

function BottomNavIconButton({ label, NavIcon, active, onClick }: BottomNavIconButtonProps) {
  return (
    <motion.button
      type="button"
      className={`bottom-nav-btn ${active ? 'is-active' : ''}`}
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
    >
      <span className="bottom-nav-icon-wrap" aria-hidden>
        <NavIcon active={active} />
      </span>
    </motion.button>
  );
}

function IDELayoutInner({ onLogout }: IDELayoutProps) {
  const { toast } = useToast();
  const {
    isMobile,
    activePanel,
    mobileSidebarOpen,
    terminalOpen,
    setActivePanel,
    setMobileSidebarOpen,
    toggleTerminal,
    editorTheme,
    shortcutsOpen,
    setShortcutsOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
  } = useLayout();
  const { openWebTab, viewMode, activeTab } = useEditor();
  useKeyboardShortcuts();

  // Swipe-right to open sidebar, swipe-left/down to close — mobile only
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = isMobile ? (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) {return;}
    swipeOrigin.current = { x: t.clientX, y: t.clientY };
  } : undefined;
  const onTouchEnd = isMobile ? (e: TouchEvent<HTMLDivElement>) => {
    if (!swipeOrigin.current) {return;}
    const t = e.changedTouches[0];
    if (!t) {return;}
    const dx = t.clientX - swipeOrigin.current.x;
    const dy = t.clientY - swipeOrigin.current.y;
    swipeOrigin.current = null;
    if (Math.abs(dy) > 60) {return;} // too vertical
    if (!mobileSidebarOpen && dx > 60) {
      // swipe right → open sidebar to last active panel
      setMobileSidebarOpen(true);
    } else if (mobileSidebarOpen && dx < -60) {
      // swipe left → close sidebar
      setMobileSidebarOpen(false);
    }
  } : undefined;

  useEffect(() => {
    setEditorToast(toast);
    return () => setEditorToast(null);
  }, [toast]);

  useEffect(() => {
    document.body.setAttribute('data-theme', editorTheme || 'cursor-dark');
  }, [editorTheme]);

  const isGlass = editorTheme === 'glass';
  const isLivingCanvas = editorTheme === 'living-canvas';
  const showLivingCanvas = isLivingCanvas && !isMobile;

  return (
    <div className="ide-layout tactical-app">
      {isGlass && (
        <div className="glass-backdrop" aria-hidden="true">
          <div className="glass-orb glass-orb--primary" />
          <div className="glass-orb glass-orb--secondary" />
          <div className="glass-orb glass-orb--tertiary" />
          <div className="glass-orb glass-orb--warm" />
          <div className="glass-backdrop__noise" />
          <div className="glass-backdrop__grid" />
        </div>
      )}
      {showLivingCanvas && <LivingCanvas />}
      <div className="workspace-shell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="workspace-content-row">
          <Sidebar onLogout={onLogout} />
          <div className="main-content">
            <ContextStrip />
            <EditorArea />
            <StatusBar />
          </div>
        </div>
      </div>
      {isMobile && (
        <nav className="bottom-nav" aria-label="Primary">
          {BOTTOM_NAV_ITEMS.map(({ panel, label, NavIcon, webTab }) => (
            <BottomNavIconButton
              key={panel}
              label={label}
              NavIcon={NavIcon}
              active={
                webTab
                  ? viewMode === 'web' && activeTab?.type === 'web' && activeTab.webId === webTab.id
                  : activePanel === panel
              }
              onClick={() => {
                if (webTab) {
                  openWebTab(webTab);
                  setMobileSidebarOpen(false);
                  return;
                }
                setActivePanel(panel);
                setMobileSidebarOpen(true);
              }}
            />
          ))}
          <BottomNavIconButton
            label="Terminal"
            NavIcon={TerminalNavIcon}
            active={terminalOpen}
            onClick={toggleTerminal}
          />
        </nav>
      )}
      <QuickOpen />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onLogout={onLogout} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

export function IDELayout({ onLogout }: IDELayoutProps) {
  return (
    <LayoutProvider>
      <EditorProvider>
        <IDELayoutInner onLogout={onLogout} />
      </EditorProvider>
    </LayoutProvider>
  );
}
