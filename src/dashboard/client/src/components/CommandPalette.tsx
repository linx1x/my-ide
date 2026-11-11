import { useState, useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLayout } from '../context/LayoutContext';
import { useEditor } from '../context/EditorContext';

type Command = {
  id: string;
  label: string;
  shortcut?: string;
  aliases?: string[];
  run: () => void;
};

function fuzzyMatch(query: string, label: string, aliases: string[] = []) {
  if (!query.trim()) {return true;}
  const q = query.trim().toLowerCase();
  const haystack = [label, ...aliases].join(' ').toLowerCase();
  if (haystack.includes(q)) {return true;}
  let idx = 0;
  for (const char of q) {
    idx = haystack.indexOf(char, idx);
    if (idx === -1) {return false;}
    idx += 1;
  }
  return true;
}

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onLogout?: () => void;
};

export function CommandPalette({ open, onClose, onLogout }: CommandPaletteProps) {
  const {
    setActivePanel,
    setQuickOpenOpen,
    toggleTerminal,
    toggleSidebar,
    setShortcutsOpen,
    setCommandPaletteOpen,
  } = useLayout();
  const { openWebTab } = useEditor();

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const commands: Command[] = [
    { id: 'file', label: 'Go to File…', shortcut: 'Ctrl+P', aliases: ['quick open recent files'], run: () => { onClose(); setQuickOpenOpen(true); } },
    { id: 'explorer', label: 'Focus Explorer', shortcut: 'Ctrl+Shift+E', run: () => { onClose(); setActivePanel('explorer'); } },
    { id: 'search', label: 'Focus Search', shortcut: 'Ctrl+Shift+F', run: () => { onClose(); setActivePanel('search'); setTimeout(() => document.getElementById('search-input')?.focus(), 50); } },
    { id: 'git', label: 'Focus Source Control', shortcut: 'Ctrl+Shift+G', run: () => { onClose(); setActivePanel('git'); } },
    { id: 'terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', run: () => { onClose(); toggleTerminal(); } },
    { id: 'sidebar', label: 'Toggle Sidebar', run: () => { onClose(); toggleSidebar(); } },
    { id: 'settings', label: 'Open Settings', run: () => { onClose(); setActivePanel('settings'); } },
    { id: 'database', label: 'Open Database', aliases: ['db sql connections'], run: () => { onClose(); setActivePanel('database'); } },
    { id: 'docs', label: 'Open How It Works', aliases: ['help guide setup commands'], run: () => { onClose(); setActivePanel('docs'); } },
    { id: 'workflow', label: 'Open GitHub Workflow', aliases: ['prs ci actions branches'], run: () => { onClose(); setActivePanel('workflow'); } },
    { id: 'n8n-workflows', label: 'Open Workflow Library', aliases: ['n8n workflows automation install sync'], run: () => { onClose(); setActivePanel('n8n-workflows'); } },
    { id: 'more', label: 'Open Automations', aliases: ['integrations more tools'], run: () => { onClose(); setActivePanel('more'); } },
    {
      id: 'n8n',
      label: 'Open n8n Workspace',
      aliases: ['automation canvas workflows'],
      run: () => {
        onClose();
        openWebTab?.({ id: 'n8n', title: 'n8n', url: '/n8n/', icon: 'n8n' });
      },
    },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: '?', run: () => { onClose(); setShortcutsOpen(true); } },
    ...(onLogout ? [{ id: 'logout', label: 'Log out', run: () => { onClose(); onLogout(); } }] : []),
  ];

  const filtered = commands.filter((c) => fuzzyMatch(query, c.label, c.aliases));
  const selectedCommand = filtered[selectedIdx];

  useEffect(() => {
    if (!open) {return;}
    setQuery('');
    setSelectedIdx(0);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) {return;}
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, setCommandPaletteOpen]);

  const runSelected = useCallback(() => {
    if (selectedCommand?.run) {
      selectedCommand.run();
    }
  }, [selectedCommand]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runSelected();
    }
  };

  useEffect(() => {
    const el = listRef.current?.children[selectedIdx];
    if (el) {el.scrollIntoView({ block: 'nearest' });}
  }, [selectedIdx, filtered.length]);

  if (!open) {return null;}

  return (
    <div
      className="project-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={(e) => e.target === e.currentTarget && (setCommandPaletteOpen(false), onClose?.())}
    >
      <div className="project-modal command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIdx(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or search…"
          aria-label="Command search"
        />
        <div ref={listRef} className="command-palette-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="command-palette-item command-palette-empty">No matching commands</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                role="option"
                aria-selected={i === selectedIdx}
                className={`command-palette-item ${i === selectedIdx ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => cmd.run?.()}
              >
                <span className="command-palette-label">{cmd.label}</span>
                {cmd.shortcut && <kbd className="command-palette-shortcut">{cmd.shortcut}</kbd>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
